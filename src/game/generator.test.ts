import { describe, expect, it } from "vitest";
import { buildStage } from "./build";
import {
  buildDailyStage,
  generateStageDef,
  getDailySeed,
  GENERATOR_PRESETS,
} from "./generator";
import type { Difficulty } from "./generator";
import { blockedCost, chebyshev } from "./metrics";
import { findRouteThrough, routeCost } from "./solver";
import { samePos } from "./types";
import type { Position } from "./types";

const DIFFICULTIES: Difficulty[] = ["easy", "normal", "hard", "extreme"];
const SEEDS = Array.from({ length: 20 }, (_, i) => i + 1);

describe("generateStageDef", () => {
  it("同じ (difficulty, seed) からは常に同一の StageDef が生成される(決定性)", () => {
    for (const difficulty of DIFFICULTIES) {
      const a = generateStageDef(difficulty, 12345);
      const b = generateStageDef(difficulty, 12345);
      expect(a).toEqual(b);
    }
  });

  describe.each(DIFFICULTIES)("難易度 %s", (difficulty) => {
    const params = GENERATOR_PRESETS[difficulty];

    it.each(SEEDS)("seed=%i で生成が成功し、面白さフィルタの条件を満たす", (seed) => {
      const def = generateStageDef(difficulty, seed);
      const stage = buildStage(def); // buildStage が throw しない(到達可能・crumble整合含む)

      // par がプリセットの下限以上
      expect(stage.par).toBeGreaterThanOrEqual(params.parMin);

      // 特殊マス(start/goal/checkpoints/warp from・to/heavy/crumble)が互いに重複していない
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

      // crumble は全チェックポイントからチェビシェフ距離2以上離れている
      for (const crumble of stage.crumbleCells) {
        for (const cp of stage.checkpoints) {
          expect(chebyshev(crumble.pos, [cp.row, cp.col])).toBeGreaterThanOrEqual(2);
        }
      }

      // heavy がある場合: 全heavy回避コストが par+1〜par+6
      if (stage.heavyCells.length > 0) {
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

      // crumble がある場合: crumble封鎖時コストが par+2 以上(到達不能は不合格のはず)
      if (stage.crumbleCells.length > 0) {
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

      // warp がある場合: ワープ元封鎖時とのコスト差が3以内
      if (stage.warps.length > 0) {
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

  it("id/label/desc を上書きできる", () => {
    const def = generateStageDef("easy", 1, { id: 42, label: "TEST", desc: "DESC" });
    expect(def.id).toBe(42);
    expect(def.label).toBe("TEST");
    expect(def.desc).toBe("DESC");
  });
});

describe("getDailySeed", () => {
  it("UTC日付が同じなら、時刻が異なっても同じシードになる", () => {
    const a = new Date(Date.UTC(2026, 6, 19, 0, 0, 0));
    const b = new Date(Date.UTC(2026, 6, 19, 23, 59, 59));
    expect(getDailySeed(a)).toBe(getDailySeed(b));
  });

  it("UTC日付が異なれば異なるシードになる", () => {
    const a = new Date(Date.UTC(2026, 6, 19));
    const b = new Date(Date.UTC(2026, 6, 20));
    expect(getDailySeed(a)).not.toBe(getDailySeed(b));
  });

  it("YYYYMMDD 形式の数値になっている", () => {
    expect(getDailySeed(new Date(Date.UTC(2026, 6, 19)))).toBe(20260719);
  });
});

describe("buildDailyStage", () => {
  it("連続する30日分の日付で throw しない", () => {
    const base = new Date(Date.UTC(2026, 0, 1));
    for (let i = 0; i < 30; i++) {
      const date = new Date(base.getTime() + i * 86400000);
      expect(() => buildDailyStage(date)).not.toThrow();
    }
  });

  it("id=100 / label=DAILY / desc がUTC日付文字列になっている", () => {
    const stage = buildDailyStage(new Date(Date.UTC(2026, 6, 19)));
    expect(stage.id).toBe(100);
    expect(stage.label).toBe("DAILY");
    expect(stage.desc).toBe("2026-07-19");
  });
});
