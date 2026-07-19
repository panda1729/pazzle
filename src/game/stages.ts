import { generateMaze, generateOpenGrid } from "./maze";
import { findRouteThrough, routeCost } from "./solver";
import { samePos } from "./types";
import type { Stage, StageDef } from "./types";

export const STAGE_DEFS: StageDef[] = [
  {
    id: 1,
    label: "STAGE 01",
    desc: "BASIC",
    size: 5,
    seed: 42,
    start: [0, 0],
    goal: [4, 4],
    checkpoints: [],
    warps: [],
  },
  {
    id: 2,
    label: "STAGE 02",
    desc: "CHECKPOINT",
    size: 5,
    seed: 7,
    start: [0, 0],
    goal: [4, 4],
    checkpoints: [{ row: 2, col: 2 }],
    warps: [],
  },
  {
    id: 3,
    label: "STAGE 03",
    desc: "WARP",
    size: 5,
    seed: 99,
    start: [0, 0],
    goal: [4, 4],
    checkpoints: [],
    warps: [{ from: [0, 4], to: [4, 0] }],
  },
  {
    id: 4,
    label: "STAGE 04",
    desc: "HEAVY",
    size: 5,
    seed: 3,
    // braid でループを作り、×2マスを「踏むのが最短だが、迂回もできる」配置にする
    braid: 0.5,
    start: [0, 0],
    goal: [4, 4],
    checkpoints: [],
    warps: [],
    // 最短経路(par=9)はこの3マスを通る。全て迂回すると avoidCost=12(par+3)で踏破可能
    heavyCells: [
      [2, 0],
      [3, 0],
      [3, 2],
    ],
  },
  {
    id: 5,
    label: "STAGE 05",
    desc: "CRUMBLE",
    size: 5,
    seed: 8,
    // braid でループを作り、crumble マスを「一度しか使えない近道」にする
    braid: 0.4,
    start: [0, 0],
    goal: [4, 4],
    checkpoints: [{ row: 2, col: 1 }],
    warps: [],
    // 最適経路(par=10)がちょうど1回ずつ通る近道。CPからチェビシェフ距離2以上離れているため
    // 「CP手前で崩れる」旧パターンにはならない。両方封鎖すると18(par+8)まで悪化する
    crumbleCells: [
      { pos: [4, 2], uses: 1 },
      { pos: [4, 3], uses: 1 },
    ],
  },
  {
    id: 6,
    label: "STAGE 06",
    desc: "ONE STROKE",
    size: 5,
    seed: 0, // 未使用(オープングリッドは seed に依存しない)
    start: [0, 0],
    goal: [4, 4],
    checkpoints: [],
    warps: [],
    oneStroke: true,
  },
  {
    id: 7,
    label: "STAGE 07",
    desc: "MIXED",
    size: 7,
    seed: 1,
    // HEAVY(避け道の選択)と CRUMBLE(一度きりの近道)の両方の原理を1ステージに混ぜる
    braid: 0.4,
    start: [0, 0],
    goal: [6, 6],
    checkpoints: [
      { row: 2, col: 1 },
      { row: 2, col: 5 },
    ],
    // (5,1)→(4,5)へのワープ。使っても使わなくても最短コストの差はわずか1(diff<=3)で
    // 「得か損か一見わからない」寄り道になる
    warps: [{ from: [5, 1], to: [4, 5] }],
    // 最適経路(par=25)はこの2マスを通る。全て迂回すると avoidCost=29(par+4)まで悪化する
    heavyCells: [
      [3, 0],
      [4, 0],
    ],
    // 最適経路がちょうど1回ずつ通る近道。両CPからチェビシェフ距離2以上離れている
    crumbleCells: [
      { pos: [5, 0], uses: 1 },
      { pos: [5, 5], uses: 1 },
    ],
  },
  {
    id: 8,
    label: "STAGE 08",
    desc: "EXTREME",
    size: 9,
    seed: 2,
    // STAGE07 と同じ設計原理(避け道・一度きりの近道・損得不明なワープ)を、より大きな盤面で重ねる
    braid: 0.4,
    start: [0, 0],
    goal: [8, 8],
    checkpoints: [
      { row: 4, col: 4 },
      { row: 4, col: 7 },
      { row: 7, col: 1 },
    ],
    // (1,3)→(6,7)へのワープ。使わない場合との差はわずか3(diff<=3)で得失の判断が難しい
    warps: [{ from: [1, 3], to: [6, 7] }],
    // 最適経路(par=52)はこの3マスを通る。全て迂回すると avoidCost=55(par+3)まで悪化する
    heavyCells: [
      [7, 5],
      [6, 4],
      [5, 3],
    ],
    // 最適経路がちょうど1回ずつ通る近道。全CPからチェビシェフ距離2以上離れている
    crumbleCells: [
      { pos: [7, 8], uses: 1 },
      { pos: [8, 3], uses: 1 },
    ],
  },
];

/** par はソルバーによる最小コストから自動算出し、limit はその2倍とする */
export function buildStage(def: StageDef): Stage {
  const heavyCells = def.heavyCells ?? [];
  const crumbleCells = def.crumbleCells ?? [];
  const oneStroke = def.oneStroke ?? false;
  const braid = def.braid ?? 0;

  if (oneStroke) {
    // 一筆書きモードは他ギミックと併用しない(全マス踏破の判定がシンプルでなくなるため)
    if (
      def.checkpoints.length > 0 ||
      def.warps.length > 0 ||
      heavyCells.length > 0 ||
      crumbleCells.length > 0
    ) {
      throw new Error(`Stage ${def.id}: 一筆書きモードは他のギミックと併用できません`);
    }
    // 通常の迷路(木構造)は全マス一筆書きがほぼ不可能なので、内壁のないオープングリッドを使う
    const grid = generateOpenGrid(def.size);
    // 再訪不可なので歩数は「全マス数-1」を超えられず、par もそれと一致する
    const par = def.size * def.size - 1;
    return { ...def, grid, par, limit: par, heavyCells, crumbleCells, oneStroke, braid };
  }

  const grid = generateMaze(def.size, def.seed, braid);

  // crumble マスが start と重ならないかチェック
  for (const crumble of crumbleCells) {
    if (samePos(crumble.pos, def.start)) {
      throw new Error(`Stage ${def.id}: 崩れる床が start マスと重なっています`);
    }
  }

  const route = findRouteThrough(
    grid,
    def.size,
    def.start,
    def.goal,
    def.checkpoints,
    def.warps,
    heavyCells,
  );
  if (!route) throw new Error(`Stage ${def.id}: ゴールに到達できない迷路定義です`);

  // 最適経路での crumble マスへの進入回数チェック
  for (const crumble of crumbleCells) {
    const count = route.slice(1).filter((pos) => samePos(pos, crumble.pos)).length;
    if (count > crumble.uses) {
      throw new Error(
        `Stage ${def.id}: 最適経路が崩れる床 ${crumble.pos} を ${count} 回通りますが、uses は ${crumble.uses} です`
      );
    }
  }

  const par = routeCost(route, heavyCells);
  return { ...def, grid, par, limit: par * 2, heavyCells, crumbleCells, oneStroke, braid };
}

export const STAGES: Stage[] = STAGE_DEFS.map(buildStage);
