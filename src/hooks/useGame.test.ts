import { describe, expect, it } from "vitest";
import { STAGES } from "../game/stages";
import { initState, reduce } from "./useGame";

describe("reduce (move)", () => {
  it("heavy マスに踏み込むと歩数が2増える", () => {
    const idx = STAGES.findIndex((s) => s.id === 4);
    expect(idx).toBeGreaterThanOrEqual(0);

    let state = initState(idx);
    expect(state.steps).toBe(0);

    // (0,0) → 南へ1歩 → (1,0)(通常マス、+1)
    state = reduce(state, { type: "move", dr: 1, dc: 0 });
    expect(state.pos).toEqual([1, 0]);
    expect(state.steps).toBe(1);

    // (1,0) → 東へ1歩 → (1,1)(heavyマス、+2)
    state = reduce(state, { type: "move", dr: 0, dc: 1 });
    expect(state.pos).toEqual([1, 1]);
    expect(state.steps).toBe(3);
  });

  it("heavy マスでない移動は歩数が1しか増えない", () => {
    const idx = STAGES.findIndex((s) => s.id === 1);
    let state = initState(idx);
    // STAGE 01 の start(0,0)は東が開通している
    state = reduce(state, { type: "move", dr: 0, dc: 1 });
    expect(state.pos).toEqual([0, 1]);
    expect(state.steps).toBe(1);
  });
});
