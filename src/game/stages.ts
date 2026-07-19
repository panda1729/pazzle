import { generateMaze } from "./maze";
import { findRouteThrough } from "./solver";
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
];

/** par はソルバーによる最短手数から自動算出し、limit はその2倍とする */
export function buildStage(def: StageDef): Stage {
  const grid = generateMaze(def.size, def.seed);
  const route = findRouteThrough(grid, def.size, def.start, def.goal, def.checkpoints, def.warps);
  if (!route) throw new Error(`Stage ${def.id}: ゴールに到達できない迷路定義です`);
  const par = route.length - 1;
  return { ...def, grid, par, limit: par * 2 };
}

export const STAGES: Stage[] = STAGE_DEFS.map(buildStage);
