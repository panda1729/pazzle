import { createRng, shuffle } from "./rng";
import type { Direction, Grid, Position } from "./types";

const DIRS: { dr: number; dc: number; from: Direction; to: Direction }[] = [
  { dr: -1, dc: 0, from: "s", to: "n" },
  { dr: 1, dc: 0, from: "n", to: "s" },
  { dr: 0, dc: 1, from: "w", to: "e" },
  { dr: 0, dc: -1, from: "e", to: "w" },
];

/**
 * 再帰バックトラック法で size×size の迷路を生成する。
 * スタックによる反復実装なので、大きな迷路でも呼び出し深度の制限を受けない。
 * 同じ seed からは常に同じ迷路が生成される。
 */
export function generateMaze(size: number, seed: number): Grid {
  const rand = createRng(seed);
  const grid: Grid = Array.from({ length: size }, () =>
    Array.from({ length: size }, () => ({ n: false, s: false, e: false, w: false })),
  );
  const visited = Array.from({ length: size }, () => Array<boolean>(size).fill(false));

  const stack: Position[] = [[0, 0]];
  visited[0][0] = true;

  while (stack.length > 0) {
    const [r, c] = stack[stack.length - 1];
    const candidates = shuffle([...DIRS], rand).filter(({ dr, dc }) => {
      const nr = r + dr;
      const nc = c + dc;
      return nr >= 0 && nr < size && nc >= 0 && nc < size && !visited[nr][nc];
    });

    if (candidates.length === 0) {
      stack.pop();
      continue;
    }

    const { dr, dc, from, to } = candidates[0];
    const nr = r + dr;
    const nc = c + dc;
    grid[r][c][to] = true;
    grid[nr][nc][from] = true;
    visited[nr][nc] = true;
    stack.push([nr, nc]);
  }

  return grid;
}
