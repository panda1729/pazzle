import { describe, expect, it } from "vitest";
import { findRouteThrough, routeCost } from "./solver";
import { buildStage, STAGES } from "./stages";
import { samePos } from "./types";
import type { StageDef } from "./types";

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
});
