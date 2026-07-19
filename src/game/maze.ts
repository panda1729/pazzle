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
 *
 * braid (0〜1): 完全迷路(木構造 = 任意の2点間の経路が一意)のままだと、
 * ギミックを置いても「踏むか迂回するか」の選択が生まれない。
 * 生成後に行き止まりマス(開通方向が1つだけのマス)を走査し、
 * 確率 braid で追加の壁を1枚壊して閉路(ループ)を作ることで、ルート選択の余地を持たせる。
 * braid=0(デフォルト)なら従来通りの完全迷路と完全に同一になる。
 */
export function generateMaze(size: number, seed: number, braid = 0): Grid {
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

  if (braid > 0) {
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        // 盤内で開通している方向を数える(行き止まり=1方向のみ開通)
        const openDirs = DIRS.filter(({ dr, dc, to }) => {
          const nr = r + dr;
          const nc = c + dc;
          return nr >= 0 && nr < size && nc >= 0 && nc < size && grid[r][c][to];
        });
        if (openDirs.length !== 1) continue;
        if (rand() >= braid) continue;

        // 既存の開通方向以外(かつ盤内)から壊す壁を選ぶ
        const candidates = DIRS.filter(({ dr, dc, to }) => {
          const nr = r + dr;
          const nc = c + dc;
          return nr >= 0 && nr < size && nc >= 0 && nc < size && !grid[r][c][to];
        });
        if (candidates.length === 0) continue;

        const { dr, dc, from, to } = candidates[Math.floor(rand() * candidates.length)];
        const nr = r + dr;
        const nc = c + dc;
        grid[r][c][to] = true;
        grid[nr][nc][from] = true;
      }
    }
  }

  return grid;
}

/**
 * 内壁を全て取り払った size×size のオープングリッドを返す(外周は閉じたまま)。
 * 一筆書きモード用: 通常の迷路(木構造)は全マス一筆書きがほぼ不可能なため使用する。
 */
export function generateOpenGrid(size: number): Grid {
  const grid: Grid = Array.from({ length: size }, () =>
    Array.from({ length: size }, () => ({ n: false, s: false, e: false, w: false })),
  );

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (r > 0) {
        grid[r][c].n = true;
        grid[r - 1][c].s = true;
      }
      if (c > 0) {
        grid[r][c].w = true;
        grid[r][c - 1].e = true;
      }
    }
  }

  return grid;
}
