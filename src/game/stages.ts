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
    seed: 55,
    start: [0, 0],
    goal: [4, 4],
    checkpoints: [{ row: 2, col: 2 }],
    warps: [],
    // 最適経路が CP への往復で 2 回ずつ通るマス。無駄な往復をすると床が抜けて詰む
    crumbleCells: [
      { pos: [2, 3], uses: 2 },
      { pos: [3, 4], uses: 2 },
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
    seed: 5,
    start: [0, 0],
    goal: [6, 6],
    // CP1(2,5)→CP2(4,6)の順に行き止まりの支道を往復する構成。par 31 で大回りが必須
    checkpoints: [
      { row: 2, col: 5 },
      { row: 4, col: 6 },
    ],
    // (2,2)は最適経路から外れた行き止まり。踏むと(3,0)へ飛ばされ、寄り道すると大きく損をする罠
    warps: [{ from: [2, 2], to: [3, 0] }],
    // (1,4)はCP1手前の必須通過点、(4,4)(5,4)はCP2からゴールへ戻る道中の必須通過点
    heavyCells: [
      [1, 4],
      [4, 4],
      [5, 4],
    ],
    // 最適経路がCPへの行き帰りでちょうど2回ずつ通るマス。無駄な寄り道をすると詰む
    crumbleCells: [
      { pos: [3, 5], uses: 2 },
      { pos: [5, 6], uses: 2 },
    ],
  },
  {
    id: 8,
    label: "STAGE 08",
    desc: "EXTREME",
    size: 9,
    seed: 3,
    start: [0, 0],
    goal: [8, 8],
    // CP3個(6通りの順序総当たり)。行き止まりの支道を3か所往復する構成で par 58
    checkpoints: [
      { row: 0, col: 8 },
      { row: 2, col: 5 },
      { row: 5, col: 6 },
    ],
    // どちらも最適経路から外れた行き止まり同士を結ぶ罠。寄り道すると盤面の反対側まで飛ばされる
    warps: [
      { from: [1, 1], to: [7, 3] },
      { from: [7, 8], to: [8, 1] },
    ],
    // いずれも最適経路上の必須通過点(CP到達前後の道中)
    heavyCells: [
      [0, 4],
      [2, 3],
      [4, 4],
      [7, 5],
    ],
    // 最適経路がCPへの行き帰りでちょうど2回ずつ通るマス。3か所とも同時に管理する必要がある
    crumbleCells: [
      { pos: [1, 8], uses: 2 },
      { pos: [3, 5], uses: 2 },
      { pos: [5, 5], uses: 2 },
    ],
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
