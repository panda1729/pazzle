import { generateMaze } from "./maze";
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
];

/** par はソルバーによる最小コストから自動算出し、limit はその2倍とする */
export function buildStage(def: StageDef): Stage {
  const grid = generateMaze(def.size, def.seed);
  const heavyCells = def.heavyCells ?? [];
  const crumbleCells = def.crumbleCells ?? [];

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
  return { ...def, grid, par, limit: par * 2, heavyCells, crumbleCells };
}

export const STAGES: Stage[] = STAGE_DEFS.map(buildStage);
