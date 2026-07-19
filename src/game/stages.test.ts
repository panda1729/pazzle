import { describe, expect, it } from "vitest";
import { STAGES } from "./stages";
import { samePos } from "./types";

describe("STAGES", () => {
  it("全ステージがクリア可能で par/limit が算出されている", () => {
    for (const stage of STAGES) {
      expect(stage.par).toBeGreaterThan(0);
      expect(stage.limit).toBe(stage.par * 2);
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
});
