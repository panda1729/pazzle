import { describe, expect, it } from "vitest";
import { blockedCost, chebyshev } from "./metrics";
import { findRouteThrough, routeCost } from "./solver";
import { buildStage, STAGES } from "./stages";
import { samePos } from "./types";
import type { Position, StageDef } from "./types";

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

  it("STAGE 09(BOMB)が含まれ、爆弾数が4〜6個・par が15以上・他ギミックなし", () => {
    const stage = STAGES.find((s) => s.id === 9);
    expect(stage).toBeDefined();
    expect(stage!.desc).toBe("BOMB");
    expect(stage!.bombs.length).toBeGreaterThanOrEqual(4);
    expect(stage!.bombs.length).toBeLessThanOrEqual(6);
    expect(stage!.par).toBeGreaterThanOrEqual(15);
    expect(stage!.checkpoints.length).toBe(0);
    expect(stage!.warps.length).toBe(0);
    expect(stage!.heavyCells.length).toBe(0);
    expect(stage!.crumbleCells.length).toBe(0);
  });

  it("STAGE 09: start の8近傍に爆弾がない(初手死の理不尽防止)", () => {
    const stage = STAGES.find((s) => s.id === 9)!;
    for (const bomb of stage.bombs) {
      expect(chebyshev(bomb, stage.start)).toBeGreaterThanOrEqual(2);
    }
  });

  it("STAGE 09: 爆弾の過半数が最適経路からチェビシェフ距離1以内にある(推理要素が成立する配置)", () => {
    const stage = STAGES.find((s) => s.id === 9)!;
    const route = findRouteThrough(stage.grid, stage.size, stage.start, stage.goal, [], [], []);
    expect(route).not.toBeNull();
    const nearCount = stage.bombs.filter((b) => route!.some((p) => chebyshev(b, p) <= 1)).length;
    expect(nearCount / stage.bombs.length).toBeGreaterThanOrEqual(0.5);
  });

  it("爆弾マスが他の特殊マス(ここでは checkpoint)と重なる定義は throw", () => {
    const invalidDef: StageDef = {
      id: 999,
      label: "INVALID",
      desc: "TEST",
      size: 5,
      seed: 42,
      start: [0, 0],
      goal: [4, 4],
      checkpoints: [{ row: 2, col: 2 }],
      warps: [],
      bombs: [[2, 2]], // checkpoint と重なる
    };
    expect(() => buildStage(invalidDef)).toThrow();
  });

  it("STAGE 10(LINE LIMIT)が含まれ、lineLimits が設定され par が12以上・他ギミックなし", () => {
    const stage = STAGES.find((s) => s.id === 10);
    expect(stage).toBeDefined();
    expect(stage!.desc).toBe("LINE LIMIT");
    expect(stage!.lineLimits).not.toBeNull();
    expect(stage!.lineLimits!.rows.length).toBe(stage!.size);
    expect(stage!.lineLimits!.cols.length).toBe(stage!.size);
    expect(stage!.par).toBeGreaterThanOrEqual(12);
    expect(stage!.checkpoints.length).toBe(0);
    expect(stage!.warps.length).toBe(0);
    expect(stage!.heavyCells.length).toBe(0);
    expect(stage!.crumbleCells.length).toBe(0);
    expect(stage!.bombs.length).toBe(0);
  });

  it("STAGE 10: 最適経路の行・列進入回数(start含む)が lineLimits の範囲内に収まっている", () => {
    const stage = STAGES.find((s) => s.id === 10)!;
    const route = findRouteThrough(stage.grid, stage.size, stage.start, stage.goal, [], [], []);
    expect(route).not.toBeNull();

    const rowsUsage = Array(stage.size).fill(0);
    const colsUsage = Array(stage.size).fill(0);
    for (const [r, c] of route!) {
      rowsUsage[r]++;
      colsUsage[c]++;
    }
    for (let i = 0; i < stage.size; i++) {
      expect(rowsUsage[i]).toBeLessThanOrEqual(stage.lineLimits!.rows[i]);
      expect(colsUsage[i]).toBeLessThanOrEqual(stage.lineLimits!.cols[i]);
    }
  });

  it("STAGE 10: 最適経路の使用回数ちょうどが上限になっている(タイトな)行・列が2本以上ある", () => {
    const stage = STAGES.find((s) => s.id === 10)!;
    const route = findRouteThrough(stage.grid, stage.size, stage.start, stage.goal, [], [], []);
    expect(route).not.toBeNull();

    const rowsUsage = Array(stage.size).fill(0);
    const colsUsage = Array(stage.size).fill(0);
    for (const [r, c] of route!) {
      rowsUsage[r]++;
      colsUsage[c]++;
    }
    const tightCount =
      rowsUsage.filter((u, i) => u === stage.lineLimits!.rows[i]).length +
      colsUsage.filter((u, i) => u === stage.lineLimits!.cols[i]).length;
    expect(tightCount).toBeGreaterThanOrEqual(2);
  });

  it("lineLimits の配列長が size と一致しない定義は throw", () => {
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
      lineLimits: { rows: [5, 5, 5, 5], cols: [5, 5, 5, 5, 5] }, // rows の長さが size と不一致
    };
    expect(() => buildStage(invalidDef)).toThrow();
  });

  it("最適経路が lineLimits の上限を超える不正な定義は throw", () => {
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
      // 最短経路ですら通れないほど厳しい上限(全行・全列1回まで)
      lineLimits: { rows: [1, 1, 1, 1, 1], cols: [1, 1, 1, 1, 1] },
    };
    expect(() => buildStage(invalidDef)).toThrow();
  });

  it("oneStroke: true と lineLimits を併用する定義は throw", () => {
    const invalidDef: StageDef = {
      id: 999,
      label: "INVALID",
      desc: "TEST",
      size: 5,
      seed: 0,
      start: [0, 0],
      goal: [4, 4],
      checkpoints: [],
      warps: [],
      oneStroke: true,
      lineLimits: { rows: [5, 5, 5, 5, 5], cols: [5, 5, 5, 5, 5] },
    };
    expect(() => buildStage(invalidDef)).toThrow();
  });

  it("oneStroke: true と bombs を併用する定義は throw", () => {
    const invalidDef: StageDef = {
      id: 999,
      label: "INVALID",
      desc: "TEST",
      size: 5,
      seed: 0,
      start: [0, 0],
      goal: [4, 4],
      checkpoints: [],
      warps: [],
      oneStroke: true,
      bombs: [[1, 1]],
    };
    expect(() => buildStage(invalidDef)).toThrow();
  });

  it("全ステージで、特殊マス(start/goal/checkpoints/warp from・to/heavy/crumble/bomb)が互いに重複していない", () => {
    for (const stage of STAGES) {
      const cells: Position[] = [
        stage.start,
        stage.goal,
        ...stage.checkpoints.map((cp): Position => [cp.row, cp.col]),
        ...stage.warps.flatMap((w) => [w.from, w.to]),
        ...stage.heavyCells,
        ...stage.crumbleCells.map((c) => c.pos),
        ...stage.bombs,
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
    expect(() =>
      buildStage({ ...base, checkpoints: [], warps: [], bombs: [[1, 1]] }),
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
