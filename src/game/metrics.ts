import { findRouteThrough, routeCost } from "./solver";
import type { Checkpoint, Direction, Grid, Position, Warp } from "./types";

/**
 * ステージ設計の「面白さ」を定量評価するための共通ヘルパー群。
 * 元々は stages.test.ts の設計ガードテスト専用だったが、自動生成器(generator.ts)の
 * 合否判定フィルタとしても同じ指標を使うため、ここに切り出して両者から参照する。
 */

const BLOCK_DIRS: { dr: number; dc: number; from: Direction; to: Direction }[] = [
  { dr: -1, dc: 0, from: "s", to: "n" },
  { dr: 1, dc: 0, from: "n", to: "s" },
  { dr: 0, dc: 1, from: "w", to: "e" },
  { dr: 0, dc: -1, from: "e", to: "w" },
];

/** 指定マス群の四方の壁を全て閉じたグリッドのコピーを返す(そのマスを経路探索から除外するため) */
export function blockCells(grid: Grid, size: number, cells: Position[]): Grid {
  const copy = grid.map((row) => row.map((cell) => ({ ...cell })));
  for (const [r, c] of cells) {
    for (const { dr, dc, from, to } of BLOCK_DIRS) {
      if (copy[r][c][to]) {
        const nr = r + dr;
        const nc = c + dc;
        copy[r][c][to] = false;
        if (nr >= 0 && nr < size && nc >= 0 && nc < size) copy[nr][nc][from] = false;
      }
    }
  }
  return copy;
}

/** 指定マス群を壁で塞いだ場合の from→goal(CP経由)の最短コスト。到達不能なら Infinity */
export function blockedCost(
  grid: Grid,
  size: number,
  start: Position,
  goal: Position,
  checkpoints: Checkpoint[],
  warps: Warp[],
  heavyCells: Position[],
  blocked: Position[],
): number {
  const blockedGrid = blockCells(grid, size, blocked);
  const route = findRouteThrough(blockedGrid, size, start, goal, checkpoints, warps, heavyCells);
  return route ? routeCost(route, heavyCells) : Infinity;
}

/** チェビシェフ距離(将棋の王が2点間を移動するのに必要な最小手数) */
export const chebyshev = (a: Position, b: Position): number =>
  Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]));
