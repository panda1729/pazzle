import { describe, expect, it } from "vitest";
import { generateMaze } from "./maze";
import { findPath, findRouteThrough, routeCost } from "./solver";
import type { Grid, Position } from "./types";

/** 全マス開通の size×size グリッド(壁なし)を作る */
function openGrid(size: number): Grid {
  return Array.from({ length: size }, (_, r) =>
    Array.from({ length: size }, (_, c) => ({
      n: r > 0,
      s: r < size - 1,
      e: c < size - 1,
      w: c > 0,
    })),
  );
}

function assertValidPath(grid: Grid, path: Position[]) {
  for (let i = 1; i < path.length; i++) {
    const [r, c] = path[i - 1];
    const [nr, nc] = path[i];
    const dr = nr - r;
    const dc = nc - c;
    const key = dr === -1 ? "n" : dr === 1 ? "s" : dc === 1 ? "e" : "w";
    expect(grid[r][c][key]).toBe(true);
  }
}

describe("findPath", () => {
  it("生成された迷路でスタートからゴールへの経路を見つける", () => {
    const size = 10;
    const grid = generateMaze(size, 42);
    const path = findPath(grid, size, [0, 0], [size - 1, size - 1]);
    expect(path).not.toBeNull();
    expect(path![0]).toEqual([0, 0]);
    expect(path![path!.length - 1]).toEqual([size - 1, size - 1]);
    assertValidPath(grid, path!);
  });

  it("壁なしグリッドでは最短経路(マンハッタン距離)になる", () => {
    const path = findPath(openGrid(5), 5, [0, 0], [4, 4]);
    expect(path).not.toBeNull();
    expect(path!.length - 1).toBe(8);
  });

  it("ワープ元マスに踏み込むとワープ先に着地する", () => {
    const path = findPath(openGrid(5), 5, [0, 0], [4, 0], [{ from: [0, 1], to: [4, 0] }]);
    expect(path).not.toBeNull();
    // [0,0] → 東に1歩 → ワープで [4,0]
    expect(path).toEqual([
      [0, 0],
      [4, 0],
    ]);
  });

  it("heavy 未指定なら従来どおり最短経路になる", () => {
    const size = 10;
    const grid = generateMaze(size, 42);
    const withDefault = findPath(grid, size, [0, 0], [size - 1, size - 1]);
    const withEmptyHeavy = findPath(grid, size, [0, 0], [size - 1, size - 1], [], []);
    expect(withEmptyHeavy).toEqual(withDefault);
  });

  it("heavy マスを避けた方が安ければ迂回経路を選ぶ", () => {
    // 2x2 の全開通グリッド: (0,0)⇄(0,1)⇄(1,1)⇄(1,0)⇄(0,0) の環状路。
    // (0,0)→(1,1) の直行路は (0,1) 経由・(1,0) 経由のどちらも2歩で同コスト。
    // (0,1) を heavy にすると直行路のコストが3になり、(1,0) 経由(コスト2)の方が安くなる。
    const grid = openGrid(2);
    const path = findPath(grid, 2, [0, 0], [1, 1], [], [[0, 1]]);
    expect(path).toEqual([
      [0, 0],
      [1, 0],
      [1, 1],
    ]);
    expect(routeCost(path!, [[0, 1]])).toBe(2);
  });

  it("迂回路がなければ heavy マスをそのまま踏む経路になる", () => {
    // 0行目だけが一直線につながった廊下(他マスとは非接続)。迂回のしようがない。
    const empty = { n: false, s: false, e: false, w: false };
    const grid: Grid = [
      [
        { ...empty, e: true },
        { ...empty, e: true, w: true },
        { ...empty, w: true },
      ],
      [{ ...empty }, { ...empty }, { ...empty }],
      [{ ...empty }, { ...empty }, { ...empty }],
    ];
    const path = findPath(grid, 3, [0, 0], [0, 2], [], [[0, 1]]);
    expect(path).toEqual([
      [0, 0],
      [0, 1],
      [0, 2],
    ]);
  });
});

describe("routeCost", () => {
  it("heavy マスの分だけコストが加算される", () => {
    const path: Position[] = [
      [0, 0],
      [0, 1],
      [0, 2],
      [0, 3],
    ];
    expect(routeCost(path, [])).toBe(3);
    expect(routeCost(path, [[0, 2]])).toBe(4);
    expect(routeCost(path, [[0, 1], [0, 3]])).toBe(5);
  });
});

describe("findRouteThrough", () => {
  it("チェックポイントを全て経由する", () => {
    const size = 5;
    const grid = openGrid(size);
    const route = findRouteThrough(grid, size, [0, 0], [4, 4], [{ row: 0, col: 4 }]);
    expect(route).not.toBeNull();
    expect(route!.some(([r, c]) => r === 0 && c === 4)).toBe(true);
    expect(route![route!.length - 1]).toEqual([4, 4]);
  });

  it("複数チェックポイントで最短の通過順を選ぶ", () => {
    const size = 5;
    const grid = openGrid(size);
    const route = findRouteThrough(grid, size, [0, 0], [4, 4], [
      { row: 4, col: 0 },
      { row: 0, col: 4 },
    ]);
    expect(route).not.toBeNull();
    // どちらの順でも通過している
    expect(route!.some(([r, c]) => r === 4 && c === 0)).toBe(true);
    expect(route!.some(([r, c]) => r === 0 && c === 4)).toBe(true);
    // 最短は 0,0 → 片方 → もう片方 → 4,4 の 16 歩
    expect(route!.length - 1).toBe(16);
  });

  it("チェックポイントなしなら findPath と同じ", () => {
    const size = 5;
    const grid = generateMaze(size, 42);
    expect(findRouteThrough(grid, size, [0, 0], [4, 4], [])).toEqual(
      findPath(grid, size, [0, 0], [4, 4]),
    );
  });
});
