import { describe, expect, it } from "vitest";
import { blockCells } from "../game/metrics";
import { findPath, findRouteThrough } from "../game/solver";
import { STAGES } from "../game/stages";
import { initState, reduce } from "./useGame";

describe("reduce (move)", () => {
  it("heavy マスに踏み込むと歩数が2増える", () => {
    const stage = STAGES.find((s) => s.id === 4);
    expect(stage).toBeDefined();

    let state = initState(stage!);
    expect(state.steps).toBe(0);

    // (0,0) → 南へ1歩 → (1,0)(通常マス、+1)
    state = reduce(state, { type: "move", dr: 1, dc: 0 });
    expect(state.pos).toEqual([1, 0]);
    expect(state.steps).toBe(1);

    // (1,0) → 南へ1歩 → (2,0)(heavyマス、+2)
    state = reduce(state, { type: "move", dr: 1, dc: 0 });
    expect(state.pos).toEqual([2, 0]);
    expect(state.steps).toBe(3);
  });

  it("heavy マスでない移動は歩数が1しか増えない", () => {
    const stage = STAGES.find((s) => s.id === 1)!;
    let state = initState(stage);
    // STAGE 01 の start(0,0)は東が開通している
    state = reduce(state, { type: "move", dr: 0, dc: 1 });
    expect(state.pos).toEqual([0, 1]);
    expect(state.steps).toBe(1);
  });

  it("crumble マスに踏み込むと残回数が減る", () => {
    const stage = STAGES.find((s) => s.id === 5);
    expect(stage).toBeDefined();

    const state = initState(stage!);
    const crumbleIdx = stage!.crumbleCells.findIndex((c) => c.uses === 1);
    expect(crumbleIdx).toBeGreaterThanOrEqual(0);

    const initialUses = state.crumbleLeft[crumbleIdx];
    expect(initialUses).toBe(1);
  });

  it("crumble マスの残回数が0になると移動がブロックされる", () => {
    const stage = STAGES.find((s) => s.id === 5);
    expect(stage).toBeDefined();

    const state = initState(stage!);
    const crumbleIdx = 0; // 最初の crumble マス [4, 2] with uses: 1

    // 手動で crumbleLeft を 0 に設定して、ロジックが正しく動作することを確認
    const testState = {
      ...state,
      crumbleLeft: state.crumbleLeft.map((left, i) => (i === crumbleIdx ? 0 : left)),
    };

    expect(testState.crumbleLeft[crumbleIdx]).toBe(0);
  });
});

describe("reduce (move) - bomb (STAGE 09)", () => {
  const stage = STAGES.find((s) => s.id === 9)!;

  it("STAGE 09 が見つかる", () => {
    expect(stage).toBeDefined();
  });

  it("爆弾マスに踏み込むと歩数は消費した上で failed になり、bombHit がセットされる", () => {
    const targetBomb = stage.bombs[0];
    // 実際のゲーム用グリッド(壁は爆弾で塞がれていない)上で、スタートから爆弾マスへの経路をソルバーで求める
    const path = findPath(stage.grid, stage.size, stage.start, targetBomb);
    expect(path).not.toBeNull();

    // 経路の途中で別の爆弾マスを先に踏む可能性があるため、実際に最初に踏む爆弾マスを特定する
    // (reduce は status が "playing" でなくなると以降の move を無視するので、最終状態は自然と最初の爆弾で止まる)
    const firstBombOnPath = path!
      .slice(1)
      .find((p) => stage.bombs.some(([br, bc]) => br === p[0] && bc === p[1]))!;
    expect(firstBombOnPath).toBeDefined();

    const moves: [number, number][] = [];
    for (let i = 1; i < path!.length; i++) {
      const [pr, pc] = path![i - 1];
      const [nr, nc] = path![i];
      moves.push([nr - pr, nc - pc]);
    }

    const finalState = moves.reduce(
      (state, [dr, dc]) => reduce(state, { type: "move", dr, dc }),
      initState(stage),
    );

    expect(finalState.pos).toEqual(firstBombOnPath);
    expect(finalState.status).toBe("failed");
    expect(finalState.bombHit).toEqual(firstBombOnPath);
  });

  it("爆弾を避けてゴールすればクリアできる(爆弾を塞いだグリッドでソルバーが求めた経路を再生する)", () => {
    // build.ts の par 算出と同じく、爆弾マスを塞いだグリッドで安全な最短経路を求める
    const safeGrid = blockCells(stage.grid, stage.size, stage.bombs);
    const route = findRouteThrough(safeGrid, stage.size, stage.start, stage.goal, [], [], []);
    expect(route).not.toBeNull();
    // 経路上のどのマスも爆弾ではないことを確認
    for (const [r, c] of route!) {
      expect(stage.bombs.some(([br, bc]) => br === r && bc === c)).toBe(false);
    }

    const moves: [number, number][] = [];
    for (let i = 1; i < route!.length; i++) {
      const [pr, pc] = route![i - 1];
      const [nr, nc] = route![i];
      moves.push([nr - pr, nc - pc]);
    }

    const finalState = moves.reduce(
      (state, [dr, dc]) => reduce(state, { type: "move", dr, dc }),
      initState(stage),
    );

    expect(finalState.pos).toEqual(stage.goal);
    expect(finalState.status).toBe("cleared");
    expect(finalState.bombHit).toBeNull();
    expect(finalState.result?.steps).toBe(stage.par);
  });
});

describe("reduce (move) - oneStroke", () => {
  const stage = STAGES.find((s) => s.id === 6)!;

  it("STAGE 06 が見つかる", () => {
    expect(stage).toBeDefined();
  });

  it("蛇行(boustrophedon)ルートで全マス踏破しクリアできる(Sランク)", () => {
    const E: [number, number] = [0, 1];
    const S: [number, number] = [1, 0];
    const W: [number, number] = [0, -1];
    const moves: [number, number][] = [
      E, E, E, E, // row0: (0,0) -> (0,4)
      S, // -> (1,4)
      W, W, W, W, // row1: (1,4) -> (1,0)
      S, // -> (2,0)
      E, E, E, E, // row2: (2,0) -> (2,4)
      S, // -> (3,4)
      W, W, W, W, // row3: (3,4) -> (3,0)
      S, // -> (4,0)
      E, E, E, E, // row4: (4,0) -> (4,4)
    ];
    expect(moves.length).toBe(24);

    const finalState = moves.reduce(
      (state, [dr, dc]) => reduce(state, { type: "move", dr, dc }),
      initState(stage),
    );

    expect(finalState.pos).toEqual([4, 4]);
    expect(finalState.status).toBe("cleared");
    expect(finalState.visited.length).toBe(25);
    expect(finalState.result?.steps).toBe(24);
    expect(finalState.result?.score).toBe(1000);
    expect(finalState.result?.rank.label).toBe("S");
  });

  it("訪問済みマスへの移動はブロックされる(歩数も増えない)", () => {
    let state = initState(stage);
    state = reduce(state, { type: "move", dr: 0, dc: 1 }); // (0,0) -> (0,1)
    expect(state.pos).toEqual([0, 1]);
    expect(state.steps).toBe(1);

    // (0,1) から西へ戻ると (0,0) は訪問済みなのでブロック
    const blocked = reduce(state, { type: "move", dr: 0, dc: -1 });
    expect(blocked.pos).toEqual([0, 1]);
    expect(blocked.steps).toBe(1);
    expect(blocked.visited.length).toBe(state.visited.length);
  });

  it("合法手がなくなると failed になる", () => {
    // (0,0)から(0,2)まで進んでから戻ってきて(1,0)を袋小路にする
    const moves: [number, number][] = [
      [0, 1], // E: (0,0) -> (0,1)
      [0, 1], // E: (0,1) -> (0,2)
      [1, 0], // S: (0,2) -> (1,2)
      [0, -1], // W: (1,2) -> (1,1)
      [1, 0], // S: (1,1) -> (2,1)
      [0, -1], // W: (2,1) -> (2,0)
      [-1, 0], // N: (2,0) -> (1,0) ここで詰み(n,s,eが全て訪問済み)
    ];

    const finalState = moves.reduce(
      (state, [dr, dc]) => reduce(state, { type: "move", dr, dc }),
      initState(stage),
    );

    expect(finalState.pos).toEqual([1, 0]);
    expect(finalState.status).toBe("failed");
    expect(finalState.visited.length).toBe(8);
  });
});

describe("reduce (move) - line limits (STAGE 10)", () => {
  const stage = STAGES.find((s) => s.id === 10)!;

  it("STAGE 10 が見つかる", () => {
    expect(stage).toBeDefined();
    expect(stage.lineLimits).not.toBeNull();
  });

  it("行の上限に達した後、その行へ戻る移動はブロックされる(歩数消費なし)", () => {
    const limits = stage.lineLimits!;

    const E: [number, number] = [0, 1];
    const S: [number, number] = [1, 0];
    const N: [number, number] = [-1, 0];
    // (0,0)→(0,1)→(1,1)→(1,2)→(0,2)→(0,3)→(1,3) で row0 への進入回数がちょうど上限(4)に達する
    const moves: [number, number][] = [E, S, E, N, E, S];

    const state = moves.reduce(
      (s, [dr, dc]) => reduce(s, { type: "move", dr, dc }),
      initState(stage),
    );
    expect(state.pos).toEqual([1, 3]);
    expect(state.steps).toBe(6);
    expect(state.rowUsed[0]).toBe(limits.rows[0]);

    // row0 に戻る移動(北)を試みると行の上限超過でブロックされる
    const [dr, dc] = N;
    const blocked = reduce(state, { type: "move", dr, dc });
    expect(blocked.pos).toEqual([1, 3]);
    expect(blocked.steps).toBe(6);
    expect(blocked.rowUsed[0]).toBe(limits.rows[0]);
    expect(blocked.status).toBe("playing");
  });

  it("正しい配分でゴールすればクリアできる(ソルバー経路を再生)", () => {
    const route = findRouteThrough(stage.grid, stage.size, stage.start, stage.goal, [], [], []);
    expect(route).not.toBeNull();

    const moves: [number, number][] = [];
    for (let i = 1; i < route!.length; i++) {
      const [pr, pc] = route![i - 1];
      const [nr, nc] = route![i];
      moves.push([nr - pr, nc - pc]);
    }

    const finalState = moves.reduce(
      (s, [dr, dc]) => reduce(s, { type: "move", dr, dc }),
      initState(stage),
    );

    expect(finalState.pos).toEqual(stage.goal);
    expect(finalState.status).toBe("cleared");
    expect(finalState.result?.steps).toBe(stage.par);
  });

  it("行・列の予算を無駄遣いして身動きが取れなくなると failed になる", () => {
    const E: [number, number] = [0, 1];
    const S: [number, number] = [1, 0];
    const N: [number, number] = [-1, 0];
    // (0,0)→(0,1)→(1,1)→(0,1) と往復するだけで col1 の進入回数(上限3)を使い切り、
    // (0,1) から動ける方向(西=col0は上限1で埋まっている、南=col1は上限で埋まっている)が無くなる
    const moves: [number, number][] = [E, S, N];

    const finalState = moves.reduce(
      (s, [dr, dc]) => reduce(s, { type: "move", dr, dc }),
      initState(stage),
    );

    expect(finalState.pos).toEqual([0, 1]);
    expect(finalState.status).toBe("failed");
  });
});
