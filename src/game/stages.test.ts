import { describe, expect, it } from "vitest";
import { findRouteThrough, routeCost } from "./solver";
import { buildStage, STAGES } from "./stages";
import { samePos } from "./types";
import type { Checkpoint, Direction, Grid, Position, StageDef, Warp } from "./types";

const BLOCK_DIRS: { dr: number; dc: number; from: Direction; to: Direction }[] = [
  { dr: -1, dc: 0, from: "s", to: "n" },
  { dr: 1, dc: 0, from: "n", to: "s" },
  { dr: 0, dc: 1, from: "w", to: "e" },
  { dr: 0, dc: -1, from: "e", to: "w" },
];

/** 指定マス群の四方の壁を全て閉じたグリッドのコピーを返す(そのマスを経路探索から除外するため) */
function blockCells(grid: Grid, size: number, cells: Position[]): Grid {
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
function blockedCost(
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

const chebyshev = (a: Position, b: Position): number =>
  Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]));

describe("STAGES", () => {
  it("全ステージがクリア可能で par/limit が算出されている", () => {
    for (const stage of STAGES) {
      expect(stage.par).toBeGreaterThan(0);
      // 一筆書きモードは再訪不可のため limit === par、それ以外は par の2倍
      expect(stage.limit).toBe(stage.oneStroke ? stage.par : stage.par * 2);
    }
  });

  it("start / goal / checkpoints / warps が盤面の範囲内にある", () => {
    for (const stage of STAGES) {
      const inBounds = ([r, c]: readonly [number, number]) =>
        r >= 0 && r < stage.size && c >= 0 && c < stage.size;
      expect(inBounds(stage.start)).toBe(true);
      expect(inBounds(stage.goal)).toBe(true);
      for (const cp of stage.checkpoints) expect(inBounds([cp.row, cp.col])).toBe(true);
      for (const warp of stage.warps) {
        expect(inBounds(warp.from)).toBe(true);
        expect(inBounds(warp.to)).toBe(true);
      }
    }
  });

  it("ワープ元が start / goal / checkpoint と重なっていない", () => {
    for (const stage of STAGES) {
      for (const warp of stage.warps) {
        expect(samePos(warp.from, stage.start)).toBe(false);
        expect(samePos(warp.from, stage.goal)).toBe(false);
        for (const cp of stage.checkpoints) {
          expect(samePos(warp.from, [cp.row, cp.col])).toBe(false);
        }
      }
    }
  });

  it("STAGE 04(HEAVY)が含まれ、heavyCells が start / goal と重ならない", () => {
    const stage = STAGES.find((s) => s.id === 4);
    expect(stage).toBeDefined();
    expect(stage!.desc).toBe("HEAVY");
    expect(stage!.heavyCells.length).toBeGreaterThan(0);
    for (const h of stage!.heavyCells) {
      expect(samePos(h, stage!.start)).toBe(false);
      expect(samePos(h, stage!.goal)).toBe(false);
    }
  });

  it("par は routeCost(最小コスト経路, heavyCells) と一致する(一筆書きステージを除く)", () => {
    for (const stage of STAGES) {
      if (stage.oneStroke) continue; // 一筆書きはソルバーを使わないため対象外
      const route = findRouteThrough(
        stage.grid,
        stage.size,
        stage.start,
        stage.goal,
        stage.checkpoints,
        stage.warps,
        stage.heavyCells,
      );
      expect(route).not.toBeNull();
      expect(stage.par).toBe(routeCost(route!, stage.heavyCells));
    }
  });

  it("STAGE 05(CRUMBLE)が含まれ、crumbleCells が start と重ならない", () => {
    const stage = STAGES.find((s) => s.id === 5);
    expect(stage).toBeDefined();
    expect(stage!.desc).toBe("CRUMBLE");
    expect(stage!.crumbleCells.length).toBeGreaterThan(0);
    for (const crumble of stage!.crumbleCells) {
      expect(samePos(crumble.pos, stage!.start)).toBe(false);
    }
  });

  it("最適経路が crumble マスを uses 以上の回数で通る不正な定義は throw", () => {
    const invalidDef: StageDef = {
      id: 999,
      label: "INVALID",
      desc: "TEST",
      size: 5,
      seed: 42,
      start: [0, 0],
      goal: [4, 4],
      checkpoints: [],
      warps: [],
      crumbleCells: [
        { pos: [0, 1], uses: 0 }, // 最適経路でも通るが uses が 0 は不正
      ],
    };
    expect(() => buildStage(invalidDef)).toThrow();
  });

  it("crumble マスが start と重なる定義は throw", () => {
    const invalidDef: StageDef = {
      id: 999,
      label: "INVALID",
      desc: "TEST",
      size: 5,
      seed: 42,
      start: [0, 0],
      goal: [4, 4],
      checkpoints: [],
      warps: [],
      crumbleCells: [
        { pos: [0, 0], uses: 1 }, // start と重なる
      ],
    };
    expect(() => buildStage(invalidDef)).toThrow();
  });

  it("STAGE 06(ONE STROKE)が含まれ、par=24, limit=24 で全内壁が開通している", () => {
    const stage = STAGES.find((s) => s.id === 6);
    expect(stage).toBeDefined();
    expect(stage!.desc).toBe("ONE STROKE");
    expect(stage!.oneStroke).toBe(true);
    expect(stage!.par).toBe(24);
    expect(stage!.limit).toBe(24);
    for (let r = 0; r < stage!.size; r++) {
      for (let c = 0; c < stage!.size; c++) {
        if (c + 1 < stage!.size) expect(stage!.grid[r][c].e).toBe(true);
        if (r + 1 < stage!.size) expect(stage!.grid[r][c].s).toBe(true);
      }
    }
  });

  it("STAGE 07(MIXED)が含まれ、ギミックが規定数以上・par が 25 以上", () => {
    const stage = STAGES.find((s) => s.id === 7);
    expect(stage).toBeDefined();
    expect(stage!.desc).toBe("MIXED");
    expect(stage!.checkpoints.length).toBe(2);
    expect(stage!.warps.length).toBeGreaterThanOrEqual(1);
    expect(stage!.heavyCells.length).toBeGreaterThanOrEqual(2);
    expect(stage!.crumbleCells.length).toBeGreaterThanOrEqual(1);
    expect(stage!.par).toBeGreaterThanOrEqual(25);
  });

  it("STAGE 08(EXTREME)が含まれ、ギミックが規定数以上・par が 40 以上", () => {
    const stage = STAGES.find((s) => s.id === 8);
    expect(stage).toBeDefined();
    expect(stage!.desc).toBe("EXTREME");
    expect(stage!.checkpoints.length).toBe(3);
    expect(stage!.warps.length).toBeGreaterThanOrEqual(1);
    expect(stage!.heavyCells.length).toBeGreaterThanOrEqual(3);
    expect(stage!.crumbleCells.length).toBeGreaterThanOrEqual(2);
    expect(stage!.par).toBeGreaterThanOrEqual(40);
  });

  it("全ステージで、特殊マス(start/goal/checkpoints/warp from・to/heavy/crumble)が互いに重複していない", () => {
    for (const stage of STAGES) {
      const cells: Position[] = [
        stage.start,
        stage.goal,
        ...stage.checkpoints.map((cp): Position => [cp.row, cp.col]),
        ...stage.warps.flatMap((w) => [w.from, w.to]),
        ...stage.heavyCells,
        ...stage.crumbleCells.map((c) => c.pos),
      ];
      for (let i = 0; i < cells.length; i++) {
        for (let j = i + 1; j < cells.length; j++) {
          expect(samePos(cells[i], cells[j])).toBe(false);
        }
      }
    }
  });

  it("oneStroke: true と他のギミック(checkpoints/warps/heavyCells/crumbleCells)を併用する定義は throw", () => {
    const base: Omit<StageDef, "checkpoints" | "warps" | "heavyCells" | "crumbleCells"> = {
      id: 999,
      label: "INVALID",
      desc: "TEST",
      size: 5,
      seed: 0,
      start: [0, 0],
      goal: [4, 4],
      oneStroke: true,
    };
    expect(() =>
      buildStage({ ...base, checkpoints: [{ row: 2, col: 2 }], warps: [] }),
    ).toThrow();
    expect(() =>
      buildStage({ ...base, checkpoints: [], warps: [{ from: [0, 4], to: [4, 0] }] }),
    ).toThrow();
    expect(() =>
      buildStage({ ...base, checkpoints: [], warps: [], heavyCells: [[1, 1]] }),
    ).toThrow();
    expect(() =>
      buildStage({ ...base, checkpoints: [], warps: [], crumbleCells: [{ pos: [1, 1], uses: 1 }] }),
    ).toThrow();
  });

  describe("設計ガード: ×2マス・crumble・ワープが「選択」として機能しているか", () => {
    it("STAGE 04: ×2マスを全て避けた最短コストが par+1〜par+6 の範囲にある(踏むのが最適だが迂回も現実的)", () => {
      const stage = STAGES.find((s) => s.id === 4)!;
      const avoidCost = blockedCost(
        stage.grid,
        stage.size,
        stage.start,
        stage.goal,
        stage.checkpoints,
        stage.warps,
        [],
        stage.heavyCells,
      );
      expect(avoidCost).toBeLessThan(Infinity);
      expect(avoidCost).toBeGreaterThanOrEqual(stage.par + 1);
      expect(avoidCost).toBeLessThanOrEqual(stage.par + 6);
    });

    it("STAGE 05: crumble マスを全て塞いだ場合の最短コストが par+2 以上(近道に価値がある)", () => {
      const stage = STAGES.find((s) => s.id === 5)!;
      const blocked = blockedCost(
        stage.grid,
        stage.size,
        stage.start,
        stage.goal,
        stage.checkpoints,
        stage.warps,
        stage.heavyCells,
        stage.crumbleCells.map((c) => c.pos),
      );
      expect(blocked).toBeLessThan(Infinity);
      expect(blocked).toBeGreaterThanOrEqual(stage.par + 2);
    });

    it("STAGE 07 / 08: 崩れる床は全チェックポイントからチェビシェフ距離2以上離れている(CP手前パターンの再発防止)", () => {
      for (const id of [5, 7, 8]) {
        const stage = STAGES.find((s) => s.id === id)!;
        for (const crumble of stage.crumbleCells) {
          for (const cp of stage.checkpoints) {
            expect(chebyshev(crumble.pos, [cp.row, cp.col])).toBeGreaterThanOrEqual(2);
          }
        }
      }
    });

    it("STAGE 07 / 08: ×2マスを全て避けた最短コストが par+1〜par+6 の範囲にある", () => {
      for (const id of [7, 8]) {
        const stage = STAGES.find((s) => s.id === id)!;
        const avoidCost = blockedCost(
          stage.grid,
          stage.size,
          stage.start,
          stage.goal,
          stage.checkpoints,
          stage.warps,
          [],
          stage.heavyCells,
        );
        expect(avoidCost).toBeLessThan(Infinity);
        expect(avoidCost).toBeGreaterThanOrEqual(stage.par + 1);
        expect(avoidCost).toBeLessThanOrEqual(stage.par + 6);
      }
    });

    it("STAGE 07 / 08: crumble マスを全て塞いでもゴールに到達可能で、コストは par+2 以上に増える", () => {
      for (const id of [7, 8]) {
        const stage = STAGES.find((s) => s.id === id)!;
        const blocked = blockedCost(
          stage.grid,
          stage.size,
          stage.start,
          stage.goal,
          stage.checkpoints,
          stage.warps,
          stage.heavyCells,
          stage.crumbleCells.map((c) => c.pos),
        );
        expect(blocked).toBeLessThan(Infinity);
        expect(blocked).toBeGreaterThanOrEqual(stage.par + 2);
      }
    });

    it("STAGE 07 / 08: ワープを使わない場合との最短コスト差が3以内(得か損か一見わからない配置)", () => {
      for (const id of [7, 8]) {
        const stage = STAGES.find((s) => s.id === id)!;
        const routeWithoutWarp = findRouteThrough(
          stage.grid,
          stage.size,
          stage.start,
          stage.goal,
          stage.checkpoints,
          [],
          stage.heavyCells,
        );
        expect(routeWithoutWarp).not.toBeNull();
        const parWithoutWarp = routeCost(routeWithoutWarp!, stage.heavyCells);
        const diff = parWithoutWarp - stage.par;
        expect(diff).toBeGreaterThanOrEqual(0);
        expect(diff).toBeLessThanOrEqual(3);
      }
    });
  });
});
