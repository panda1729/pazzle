import { useCallback, useEffect, useReducer } from "react";
import { calcRank, calcScore } from "../game/score";
import type { Rank } from "../game/score";
import { ALL_STAGES } from "../game/stages";
import { samePos } from "../game/types";
import type { Position, Stage } from "../game/types";

export type GameStatus = "playing" | "cleared" | "failed";

export interface GameResult {
  score: number;
  rank: Rank;
  steps: number;
}

export interface GameState {
  stageIdx: number;
  pos: Position;
  steps: number;
  visited: Position[];
  cpDone: boolean[];
  status: GameStatus;
  result: GameResult | null;
  /** 直前の移動でワープした着地点(演出用、400ms後に消える) */
  lastWarp: Position | null;
  /** 各 crumble マスの残り踏み込み回数(stage.crumbleCells と同じ並び) */
  crumbleLeft: number[];
  /** 踏んでしまった爆弾マス(失敗時のみ非null) */
  bombHit: Position | null;
  /** 各行への進入回数(lineLimits のないステージでも配列自体は保持する) */
  rowUsed: number[];
  /** 各列への進入回数(lineLimits のないステージでも配列自体は保持する) */
  colUsed: number[];
}

type Action =
  | { type: "select"; idx: number }
  | { type: "reset" }
  | { type: "move"; dr: number; dc: number }
  | { type: "clearWarpFlash" };

export function initState(stageIdx: number): GameState {
  const stage = ALL_STAGES[stageIdx];
  // 行・列進入回数は start の分を先に加算しておく(start マスも「進入」の1回として数える)
  const rowUsed = Array<number>(stage.size).fill(0);
  const colUsed = Array<number>(stage.size).fill(0);
  rowUsed[stage.start[0]] = 1;
  colUsed[stage.start[1]] = 1;
  return {
    stageIdx,
    pos: stage.start,
    steps: 0,
    visited: [stage.start],
    cpDone: stage.checkpoints.map(() => false),
    status: "playing",
    result: null,
    lastWarp: null,
    crumbleLeft: stage.crumbleCells.map((c) => c.uses),
    bombHit: null,
    rowUsed,
    colUsed,
  };
}

const DIR_KEYS = { "-1,0": "n", "1,0": "s", "0,1": "e", "0,-1": "w" } as const;

/** 隣接4マスを走査するための方向定義(詰み判定に使う) */
const NEIGHBOR_DIRS: { dr: number; dc: number; key: "n" | "s" | "e" | "w" }[] = [
  { dr: -1, dc: 0, key: "n" },
  { dr: 1, dc: 0, key: "s" },
  { dr: 0, dc: 1, key: "e" },
  { dr: 0, dc: -1, key: "w" },
];

/**
 * 着地マス pos への移動が(壁以外の理由で)ブロックされるかどうかを判定する。
 * 一筆書きモードの再訪禁止・崩れる床の残回数0・行列進入回数の上限超過が対象。
 * 爆弾は「踏めるが即失敗する」マスであり移動自体はブロックされないため、ここでは扱わない。
 */
function isBlocked(stage: Stage, state: GameState, pos: Position): boolean {
  if (stage.oneStroke && state.visited.some((v) => samePos(v, pos))) {
    return true;
  }

  const crumbleIdx = stage.crumbleCells.findIndex((c) => samePos(c.pos, pos));
  if (crumbleIdx >= 0 && state.crumbleLeft[crumbleIdx] <= 0) {
    return true;
  }

  if (stage.lineLimits) {
    const [r, c] = pos;
    if (state.rowUsed[r] + 1 > stage.lineLimits.rows[r]) return true;
    if (state.colUsed[c] + 1 > stage.lineLimits.cols[c]) return true;
  }

  return false;
}

/**
 * pos から壁で塞がれておらず、かつ isBlocked にも該当しない移動先が1つでもあるか。
 * 一筆書き・行列制限ステージの詰み判定(これ以上動けなくなったら failed)に使う。
 */
function hasLegalMove(stage: Stage, state: GameState, pos: Position): boolean {
  const [pr, pc] = pos;
  return NEIGHBOR_DIRS.some(({ dr, dc, key }) => {
    if (!stage.grid[pr][pc][key]) return false;
    let nr = pr + dr;
    let nc = pc + dc;
    const warp = stage.warps.find((w) => w.from[0] === nr && w.from[1] === nc);
    if (warp) [nr, nc] = warp.to;
    const npos: Position = [nr, nc];
    return !isBlocked(stage, state, npos);
  });
}

export function reduce(state: GameState, action: Action): GameState {
  switch (action.type) {
    case "select":
      return initState(action.idx);
    case "reset":
      return initState(state.stageIdx);
    case "clearWarpFlash":
      return { ...state, lastWarp: null };
    case "move": {
      if (state.status !== "playing") return state;
      const stage = ALL_STAGES[state.stageIdx];
      const [r, c] = state.pos;
      const key = DIR_KEYS[`${action.dr},${action.dc}` as keyof typeof DIR_KEYS];
      if (!key || !stage.grid[r][c][key]) return state;

      let nr = r + action.dr;
      let nc = c + action.dc;
      const warp = stage.warps.find((w) => w.from[0] === nr && w.from[1] === nc);
      if (warp) [nr, nc] = warp.to;

      const pos: Position = [nr, nc];

      // 一筆書きの再訪・崩れる床の残回数0・行列進入回数の上限超過のいずれかならブロック
      // (歩数消費なし。壁と同じ扱い)
      if (isBlocked(stage, state, pos)) {
        return state;
      }

      // 着地マス(ワープ後なら着地先)が2倍マスなら歩数を+2、そうでなければ+1
      const isHeavy = stage.heavyCells.some((h) => samePos(h, pos));
      const steps = state.steps + (isHeavy ? 2 : 1);
      const cpDone = state.cpDone.map((done, i) => {
        const cp = stage.checkpoints[i];
        return done || (cp.row === nr && cp.col === nc);
      });

      // 崩れる床の残回数を減らす
      const crumbleIdx = stage.crumbleCells.findIndex((c) => samePos(c.pos, pos));
      const crumbleLeft = state.crumbleLeft.slice();
      if (crumbleIdx >= 0) {
        crumbleLeft[crumbleIdx]--;
      }

      // 行・列への進入回数を加算(lineLimits がないステージでも配列自体は保持し続ける)
      const rowUsed = state.rowUsed.slice();
      const colUsed = state.colUsed.slice();
      rowUsed[nr]++;
      colUsed[nc]++;

      const next: GameState = {
        ...state,
        pos,
        steps,
        visited: [...state.visited, pos],
        cpDone,
        lastWarp: warp ? pos : null,
        crumbleLeft,
        rowUsed,
        colUsed,
      };

      // 着地マス(ワープ後なら着地先)が爆弾なら、歩数は消費した上で即失敗
      if (stage.bombs.some((b) => samePos(b, pos))) {
        return { ...next, status: "failed", bombHit: pos };
      }

      if (stage.oneStroke) {
        // クリア判定: ゴールに到達し、かつ全マスを踏破している
        if (samePos(pos, stage.goal) && next.visited.length === stage.size * stage.size) {
          const score = calcScore(steps, stage.par, stage.limit);
          return { ...next, status: "cleared", result: { score, rank: calcRank(score), steps } };
        }
        // 詰み判定: 現在地から移動できる隣接マスが1つもなければ失敗
        if (!hasLegalMove(stage, next, pos)) return { ...next, status: "failed" };
        return next;
      }

      if (samePos(pos, stage.goal) && cpDone.every(Boolean)) {
        const score = calcScore(steps, stage.par, stage.limit);
        return { ...next, status: "cleared", result: { score, rank: calcRank(score), steps } };
      }
      // 行列制限ステージの詰み判定: 現在地から移動できる隣接マスが1つもなければ失敗
      if (stage.lineLimits && !hasLegalMove(stage, next, pos)) {
        return { ...next, status: "failed" };
      }
      if (steps >= stage.limit) return { ...next, status: "failed" };
      return next;
    }
  }
}

export function useGame() {
  const [state, dispatch] = useReducer(reduce, 0, initState);
  const stage = ALL_STAGES[state.stageIdx];

  const move = useCallback((dr: number, dc: number) => dispatch({ type: "move", dr, dc }), []);
  const reset = useCallback(() => dispatch({ type: "reset" }), []);
  const selectStage = useCallback((idx: number) => dispatch({ type: "select", idx }), []);

  useEffect(() => {
    if (!state.lastWarp) return;
    const timer = setTimeout(() => dispatch({ type: "clearWarpFlash" }), 400);
    return () => clearTimeout(timer);
  }, [state.lastWarp]);

  return { state, stage, move, reset, selectStage };
}
