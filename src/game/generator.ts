import { buildStage } from "./build";
import { generateMaze } from "./maze";
import { blockedCost, chebyshev } from "./metrics";
import { createRng, shuffle } from "./rng";
import { findPath, findRouteThrough, routeCost } from "./solver";
import { samePos } from "./types";
import type { Checkpoint, CrumbleCell, Direction, Grid, Position, Stage, StageDef, Warp } from "./types";

/**
 * 難易度別ステージ自動生成器。
 *
 * 手作業ステージ(STAGE 04〜08)は ADR-0004 の定量指標(×2全回避コストが par+1〜+6、
 * crumble封鎖時コストが par+2以上、ワープ有無のコスト差3以内、crumbleはCPからチェビシェフ
 * 距離2以上)で「意味のある選択」が生まれるよう設計している。この指標をそのまま
 * 「生成 → 検証 → 合格したものだけ採用」の面白さフィルタとして転用する(ADR-0005)。
 */

export type Difficulty = "easy" | "normal" | "hard" | "extreme";

/** [min, max] の範囲(両端含む)からランダムに選ぶことを表す */
type Range = [number, number];

export interface GeneratorParams {
  size: number;
  /** braid 確率の範囲 */
  braid: Range;
  /** チェックポイント数の範囲 */
  checkpoints: Range;
  /** ワープ組数の範囲 */
  warps: Range;
  /** ×2マス数の範囲 */
  heavyCells: Range;
  /** 崩れる床の数の範囲 */
  crumbleCells: Range;
  /** 合格に必要な par の下限 */
  parMin: number;
}

export const GENERATOR_PRESETS: Record<Difficulty, GeneratorParams> = {
  easy: {
    size: 5,
    braid: [0.3, 0.3],
    checkpoints: [0, 1],
    warps: [0, 0],
    heavyCells: [0, 1],
    crumbleCells: [0, 0],
    parMin: 8,
  },
  normal: {
    size: 7,
    braid: [0.4, 0.4],
    checkpoints: [1, 1],
    warps: [0, 0],
    heavyCells: [1, 2],
    crumbleCells: [0, 1],
    parMin: 15,
  },
  hard: {
    size: 7,
    braid: [0.4, 0.5],
    checkpoints: [2, 2],
    warps: [0, 1],
    heavyCells: [2, 2],
    crumbleCells: [1, 1],
    parMin: 22,
  },
  extreme: {
    size: 9,
    braid: [0.4, 0.4],
    checkpoints: [2, 3],
    warps: [1, 1],
    heavyCells: [2, 3],
    crumbleCells: [1, 2],
    parMin: 40,
  },
};

/** 試行の上限回数(これを超えて合格が出なければ throw する) */
const MAX_ATTEMPTS = 300;

const randFloat = (rand: () => number, min: number, max: number): number =>
  min + rand() * (max - min);

const randInt = (rand: () => number, min: number, max: number): number =>
  min + Math.floor(rand() * (max - min + 1));

const posKey = (pos: Position): string => `${pos[0]},${pos[1]}`;

/**
 * 使用済みマス(used)・追加フィルタ(filter)を避けて count 個のマスを重複なくランダムに選ぶ。
 * preferred を指定すると、その集合に含まれるマスを優先的に選ぶ(preferred だけで count に
 * 満たない場合は残りを他の空きマスから補う)。heavy/crumble を「最短ルート上」に置きやすくして、
 * 「踏むのが最適だが迂回もできる」という設計原則(ADR-0004)に合う配置の当選確率を上げるために使う。
 * 空きマスが足りなければ null(この試行は不合格として扱う)。
 */
function pickUniqueCells(
  rand: () => number,
  size: number,
  count: number,
  used: Position[],
  filter?: (pos: Position) => boolean,
  preferred?: Position[],
): Position[] | null {
  if (count === 0) return [];
  const usedKeys = new Set(used.map(posKey));
  const preferredKeys = new Set((preferred ?? []).map(posKey));
  const preferredFree: Position[] = [];
  const otherFree: Position[] = [];
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const pos: Position = [r, c];
      if (usedKeys.has(posKey(pos))) continue;
      if (filter && !filter(pos)) continue;
      if (preferredKeys.has(posKey(pos))) preferredFree.push(pos);
      else otherFree.push(pos);
    }
  }
  shuffle(preferredFree, rand);
  shuffle(otherFree, rand);
  const pool = [...preferredFree, ...otherFree];
  if (pool.length < count) return null;
  return pool.slice(0, count);
}

const ART_DIRS: { dr: number; dc: number; key: Direction }[] = [
  { dr: -1, dc: 0, key: "n" },
  { dr: 1, dc: 0, key: "s" },
  { dr: 0, dc: 1, key: "e" },
  { dr: 0, dc: -1, key: "w" },
];

/**
 * 関節点(articulation point)、すなわち「そのマスを取り除くと迷路が非連結になる」マスを
 * Tarjan 法で列挙する。×2マスや崩れる床をここに置くと「全て避ける/塞ぐ」検証(blockedCost)が
 * 必ず到達不能(Infinity)になってしまうため、生成段階で候補から除外する。
 */
function findArticulationPoints(grid: Grid, size: number): boolean[][] {
  const disc: number[][] = Array.from({ length: size }, () => Array(size).fill(-1));
  const low: number[][] = Array.from({ length: size }, () => Array(size).fill(-1));
  const isArt: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));
  let timer = 0;

  const neighborsOf = (r: number, c: number): Position[] =>
    ART_DIRS.filter(({ key }) => grid[r][c][key]).map(({ dr, dc }): Position => [r + dr, c + dc]);

  // 再帰バックトラック(size×sizeはたかだか数十マスなのでスタック深さは問題にならない)
  const dfs = (u: Position, parent: Position | null) => {
    const [ur, uc] = u;
    disc[ur][uc] = low[ur][uc] = timer++;
    let children = 0;
    for (const v of neighborsOf(ur, uc)) {
      const [vr, vc] = v;
      if (parent && vr === parent[0] && vc === parent[1]) continue;
      if (disc[vr][vc] === -1) {
        children++;
        dfs(v, u);
        low[ur][uc] = Math.min(low[ur][uc], low[vr][vc]);
        if (parent && low[vr][vc] >= disc[ur][uc]) isArt[ur][uc] = true;
      } else {
        low[ur][uc] = Math.min(low[ur][uc], disc[vr][vc]);
      }
    }
    if (!parent && children > 1) isArt[ur][uc] = true;
  };

  dfs([0, 0], null);
  return isArt;
}

/** 1回分の生成試行。合格すれば StageDef(の骨組み)を、不合格なら null を返す */
function tryGenerate(params: GeneratorParams, rand: () => number): StageDef | null {
  const { size } = params;
  const subSeed = Math.floor(rand() * 0xffffffff);
  const braid = randFloat(rand, params.braid[0], params.braid[1]);
  const grid = generateMaze(size, subSeed, braid);

  // start/goal: 最短距離(移動マス数)が size 以上離れるまでランダム配置を試す
  let start: Position | null = null;
  let goal: Position | null = null;
  for (let i = 0; i < 20; i++) {
    const s: Position = [randInt(rand, 0, size - 1), randInt(rand, 0, size - 1)];
    const g: Position = [randInt(rand, 0, size - 1), randInt(rand, 0, size - 1)];
    if (s[0] === g[0] && s[1] === g[1]) continue;
    const path = findPath(grid, size, s, g);
    if (path && path.length - 1 >= size) {
      start = s;
      goal = g;
      break;
    }
  }
  if (!start || !goal) return null;

  const isArt = findArticulationPoints(grid, size);
  const used: Position[] = [start, goal];

  const cpCount = randInt(rand, params.checkpoints[0], params.checkpoints[1]);
  const cpCells = pickUniqueCells(rand, size, cpCount, used);
  if (!cpCells) return null;
  used.push(...cpCells);
  const checkpoints: Checkpoint[] = cpCells.map(([row, col]) => ({ row, col }));

  const warpCount = randInt(rand, params.warps[0], params.warps[1]);
  const warpCells = pickUniqueCells(rand, size, warpCount * 2, used);
  if (!warpCells) return null;
  used.push(...warpCells);
  const warps: Warp[] = [];
  for (let i = 0; i < warpCount; i++) {
    warps.push({ from: warpCells[i * 2], to: warpCells[i * 2 + 1] });
  }

  // heavy/crumble の候補地を「ギミック無しでの最短ルート」に寄せるための下敷き経路。
  // ADR-0004 の設計原則(踏むのが最適だが迂回もできる/一度きりの近道になる)通りに
  // 「ルート上に置く」配置の当選確率を上げ、生成の試行効率を上げる(必須ではなく優先ヒント)
  const baseRoute = findRouteThrough(grid, size, start, goal, checkpoints, [], []) ?? [];
  const routeInterior = baseRoute.slice(1, -1).filter((pos) => !used.some((u) => samePos(u, pos)));

  // heavy/crumble は関節点(除くと非連結になるマス)を避ける。関節点に置くと
  // 「全て迂回/封鎖した場合のコスト」検証(blockedCost)が必ず到達不能になり不合格が確定するため
  const heavyCount = randInt(rand, params.heavyCells[0], params.heavyCells[1]);
  const heavyCells = pickUniqueCells(
    rand,
    size,
    heavyCount,
    used,
    (pos) => !isArt[pos[0]][pos[1]],
    routeInterior,
  );
  if (!heavyCells) return null;
  used.push(...heavyCells);

  // crumble は関節点を避け、かつ全チェックポイントからチェビシェフ距離2以上離す
  // (CP手前パターンの再発防止、ADR-0004)
  const crumbleCount = randInt(rand, params.crumbleCells[0], params.crumbleCells[1]);
  const crumblePositions = pickUniqueCells(
    rand,
    size,
    crumbleCount,
    used,
    (pos) => {
      if (isArt[pos[0]][pos[1]]) return false;
      return checkpoints.every((cp) => chebyshev(pos, [cp.row, cp.col]) >= 2);
    },
    routeInterior,
  );
  if (!crumblePositions) return null;
  const crumbleCells: CrumbleCell[] = crumblePositions.map((pos) => ({ pos, uses: 1 }));

  return {
    id: 0,
    label: "",
    desc: "",
    size,
    seed: subSeed,
    start,
    goal,
    checkpoints,
    warps,
    heavyCells,
    crumbleCells,
    braid,
  };
}

/** 生成された StageDef が「面白さフィルタ」の合格条件を全て満たすか検証する */
function passesQualityGate(def: StageDef, params: GeneratorParams): Stage | null {
  let stage: Stage;
  try {
    stage = buildStage(def);
  } catch {
    return null; // 到達不能・crumble不整合などは不合格
  }

  if (stage.par < params.parMin) return null;

  if (stage.heavyCells.length > 0) {
    const avoidCost = blockedCost(
      stage.grid,
      stage.size,
      stage.start,
      stage.goal,
      stage.checkpoints,
      stage.warps,
      [],
      stage.heavyCells,
    );
    if (avoidCost === Infinity) return null;
    if (avoidCost < stage.par + 1 || avoidCost > stage.par + 6) return null;
  }

  if (stage.crumbleCells.length > 0) {
    const blocked = blockedCost(
      stage.grid,
      stage.size,
      stage.start,
      stage.goal,
      stage.checkpoints,
      stage.warps,
      stage.heavyCells,
      stage.crumbleCells.map((c) => c.pos),
    );
    // 到達不能(詰み)になる配置は不合格
    if (blocked === Infinity) return null;
    if (blocked < stage.par + 2) return null;
  }

  if (stage.warps.length > 0) {
    const routeWithoutWarp = findRouteThrough(
      stage.grid,
      stage.size,
      stage.start,
      stage.goal,
      stage.checkpoints,
      [],
      stage.heavyCells,
    );
    if (!routeWithoutWarp) return null;
    const parWithoutWarp = routeCost(routeWithoutWarp, stage.heavyCells);
    const diff = parWithoutWarp - stage.par;
    if (diff < 0 || diff > 3) return null;
  }

  return stage;
}

export interface StageDefOverrides {
  id?: number;
  label?: string;
  desc?: string;
}

/**
 * (difficulty, seed) から決定的にステージ定義を生成する。
 * 試行を繰り返し、面白さフィルタ(passesQualityGate)に最初に合格した定義を返す。
 * 上限回数まで合格が出なければ throw する(プリセットのパラメータ調整が必要というシグナル)。
 */
export function generateStageDef(
  difficulty: Difficulty,
  seed: number,
  overrides: StageDefOverrides = {},
): StageDef {
  const params = GENERATOR_PRESETS[difficulty];
  const rand = createRng(seed);

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const def = tryGenerate(params, rand);
    if (!def) continue;
    if (passesQualityGate(def, params)) {
      return {
        ...def,
        id: overrides.id ?? 0,
        label: overrides.label ?? difficulty.toUpperCase(),
        desc: overrides.desc ?? `SEED ${seed}`,
      };
    }
  }
  throw new Error(
    `generateStageDef: difficulty=${difficulty} seed=${seed} で ${MAX_ATTEMPTS} 回試行しても合格するステージを生成できませんでした`,
  );
}

/**
 * date の UTC 日付から YYYYMMDD 形式の数値シードを作る。
 * デイリーチャレンジは全プレイヤーで同じマップになる必要があるため、
 * プレイヤーのローカルタイムゾーンに依存しない UTC の日付を基準にする。
 */
export function getDailySeed(date: Date): number {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth() + 1;
  const d = date.getUTCDate();
  return y * 10000 + m * 100 + d;
}

const formatUtcDate = (date: Date): string => {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

/** UTC日付シードで難易度 hard のデイリーチャレンジステージを生成する */
export function buildDailyStage(date: Date): Stage {
  const seed = getDailySeed(date);
  const def = generateStageDef("hard", seed, {
    id: 100,
    label: "DAILY",
    desc: formatUtcDate(date),
  });
  return buildStage(def);
}

/**
 * フリープレイの難易度一覧(選択画面のカード表示順でもある)。
 * id 規約: 手作りステージが 1〜99、デイリーが 100 を使うため、フリープレイは
 * 200 + このインデックス(200〜203)を使い、progress.ts の stageKeyFor が
 * 「id >= 200 は保存しない」で確実にフリープレイを識別できるようにしている。
 */
export const FREE_PLAY_DIFFICULTIES: Difficulty[] = ["easy", "normal", "hard", "extreme"];

/** 難易度に対応するフリープレイの id(200番台)を返す */
export function freePlayId(difficulty: Difficulty): number {
  return 200 + FREE_PLAY_DIFFICULTIES.indexOf(difficulty);
}

/** id がフリープレイ(200番台)のものであれば対応する難易度を、そうでなければ null を返す */
export function freePlayDifficultyOf(id: number): Difficulty | null {
  if (id < 200 || id >= 200 + FREE_PLAY_DIFFICULTIES.length) return null;
  return FREE_PLAY_DIFFICULTIES[id - 200];
}

/** [0, 0xffffffff) の整数からランダムなシードを1つ選ぶ(生成自体は決定的、シード選びのみ非決定的) */
export function randomSeed(): number {
  return Math.floor(Math.random() * 0xffffffff);
}

/** difficulty・seed からフリープレイの Stage を組み立てる。label/desc/id はフリープレイ規約に従う */
export function buildFreePlayStage(difficulty: Difficulty, seed: number): Stage {
  const def = generateStageDef(difficulty, seed, {
    id: freePlayId(difficulty),
    label: `FREE ${difficulty.toUpperCase()}`,
    desc: `SEED ${seed}`,
  });
  return buildStage(def);
}
