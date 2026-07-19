import { describe, expect, it } from "vitest";
import { calcRank, calcScore } from "./score";

describe("calcScore", () => {
  it("par 以下は満点", () => {
    expect(calcScore(8, 8, 16)).toBe(1000);
    expect(calcScore(5, 8, 16)).toBe(1000);
  });

  it("par を超えると線形に減衰する", () => {
    expect(calcScore(12, 8, 16)).toBe(500);
  });

  it("limit ちょうどでは最低 1 点", () => {
    expect(calcScore(16, 8, 16)).toBe(1);
  });

  it("limit 超過は 0 点", () => {
    expect(calcScore(17, 8, 16)).toBe(0);
  });
});

describe("calcRank", () => {
  it.each([
    [1000, "S"],
    [700, "A"],
    [699, "B"],
    [400, "B"],
    [399, "C"],
    [1, "C"],
    [0, "F"],
  ] as const)("score %i は %s ランク", (score, label) => {
    expect(calcRank(score).label).toBe(label);
  });
});
