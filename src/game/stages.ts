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
    seed: 21,
    start: [0, 0],
    goal: [4, 4],
    checkpoints: [],
    warps: [],
    heavyCells: [
      [1, 1],
      [0, 4],
      [4, 1],
    ],
  },
  {
    id: 5,
    label: "STAGE 05",
    desc: "CRUMBLE",
    size: 5,
    seed: 42,
    start: [0, 0],
    goal: [4, 4],
    checkpoints: [{ row: 2, col: 2 }],
    warps: [],
    crumbleCells: [
      { pos: [2, 1], uses: 2 },
      { pos: [1, 2], uses: 2 },
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
];

/** par はソルバーによる最小コストから自動算出し、limit はその2倍とする */
export function buildStage(def: StageDef): Stage {
  const heavyCells = def.heavyCells ?? [];
  const crumbleCells = def.crumbleCells ?? [];
  const oneStroke = def.oneStroke ?? false;

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
    return { ...def, grid, par, limit: par, heavyCells, crumbleCells, oneStroke };
  }

  const grid = generateMaze(def.size, def.seed);

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
  return { ...def, grid, par, limit: par * 2, heavyCells, crumbleCells, oneStroke };
}

export const STAGES: Stage[] = STAGE_DEFS.map(buildStage);
