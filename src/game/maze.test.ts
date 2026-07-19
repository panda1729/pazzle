import { describe, expect, it } from "vitest";
import { generateMaze, generateOpenGrid } from "./maze";
import type { Grid } from "./types";

function reachableCount(grid: Grid, size: number): number {
  const visited = new Set(["0,0"]);
  const queue: [number, number][] = [[0, 0]];
  const dirs = [
    { dr: -1, dc: 0, key: "n" },
    { dr: 1, dc: 0, key: "s" },
    { dr: 0, dc: 1, key: "e" },
    { dr: 0, dc: -1, key: "w" },
  ] as const;
  while (queue.length > 0) {
    const [r, c] = queue.shift()!;
    for (const { dr, dc, key } of dirs) {
      if (!grid[r][c][key]) continue;
      const nr = r + dr;
      const nc = c + dc;
      if (nr < 0 || nr >= size || nc < 0 || nc >= size) continue;
      const k = `${nr},${nc}`;
      if (visited.has(k)) continue;
      visited.add(k);
      queue.push([nr, nc]);
    }
  }
  return visited.size;
}

describe("generateMaze", () => {
  it("同じシードから同じ迷路が生成される", () => {
    expect(generateMaze(8, 123)).toEqual(generateMaze(8, 123));
  });

  it("異なるシードからは異なる迷路が生成される", () => {
    expect(generateMaze(8, 1)).not.toEqual(generateMaze(8, 2));
  });

  it("全マスに到達できる", () => {
    for (const seed of [1, 42, 999]) {
      const size = 10;
      expect(reachableCount(generateMaze(size, seed), size)).toBe(size * size);
    }
  });

  it("壁の開通状態が隣接マス間で矛盾しない", () => {
    const size = 10;
    const grid = generateMaze(size, 7);
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (c + 1 < size) expect(grid[r][c].e).toBe(grid[r][c + 1].w);
        if (r + 1 < size) expect(grid[r][c].s).toBe(grid[r + 1][c].n);
      }
    }
  });

  it("外周は閉じている", () => {
    const size = 6;
    const grid = generateMaze(size, 3);
    for (let i = 0; i < size; i++) {
      expect(grid[0][i].n).toBe(false);
      expect(grid[size - 1][i].s).toBe(false);
      expect(grid[i][0].w).toBe(false);
      expect(grid[i][size - 1].e).toBe(false);
    }
  });

  it("大きな迷路でもスタックオーバーフローしない", () => {
    expect(() => generateMaze(100, 1)).not.toThrow();
  });
});

describe("generateOpenGrid", () => {
  it("全ての内壁が開通している", () => {
    const size = 5;
    const grid = generateOpenGrid(size);
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (c + 1 < size) {
          expect(grid[r][c].e).toBe(true);
          expect(grid[r][c + 1].w).toBe(true);
        }
        if (r + 1 < size) {
          expect(grid[r][c].s).toBe(true);
          expect(grid[r + 1][c].n).toBe(true);
        }
      }
    }
  });

  it("外周は閉じている", () => {
    const size = 5;
    const grid = generateOpenGrid(size);
    for (let i = 0; i < size; i++) {
      expect(grid[0][i].n).toBe(false);
      expect(grid[size - 1][i].s).toBe(false);
      expect(grid[i][0].w).toBe(false);
      expect(grid[i][size - 1].e).toBe(false);
    }
  });
});
