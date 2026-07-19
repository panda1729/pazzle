import { useCallback, useEffect, useReducer } from "react";
import { calcRank, calcScore } from "../game/score";
import type { Rank } from "../game/score";
import { STAGES } from "../game/stages";
import { samePos } from "../game/types";
import type { Position } from "../game/types";

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
}

type Action =
  | { type: "select"; idx: number }
  | { type: "reset" }
  | { type: "move"; dr: number; dc: number }
  | { type: "clearWarpFlash" };

export function initState(stageIdx: number): GameState {
  const stage = STAGES[stageIdx];
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
  };
}

const DIR_KEYS = { "-1,0": "n", "1,0": "s", "0,1": "e", "0,-1": "w" } as const;

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
      const stage = STAGES[state.stageIdx];
      const [r, c] = state.pos;
      const key = DIR_KEYS[`${action.dr},${action.dc}` as keyof typeof DIR_KEYS];
      if (!key || !stage.grid[r][c][key]) return state;

      let nr = r + action.dr;
      let nc = c + action.dc;
      const warp = stage.warps.find((w) => w.from[0] === nr && w.from[1] === nc);
      if (warp) [nr, nc] = warp.to;

      const pos: Position = [nr, nc];

      // 着地マスが崩れる床で、残回数が 0 なら移動をブロック
      const crumbleIdx = stage.crumbleCells.findIndex((c) => samePos(c.pos, pos));
      if (crumbleIdx >= 0 && state.crumbleLeft[crumbleIdx] <= 0) {
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
      const crumbleLeft = state.crumbleLeft.slice();
      if (crumbleIdx >= 0) {
        crumbleLeft[crumbleIdx]--;
      }

      const next: GameState = {
        ...state,
        pos,
        steps,
        visited: [...state.visited, pos],
        cpDone,
        lastWarp: warp ? pos : null,
        crumbleLeft,
      };

      if (samePos(pos, stage.goal) && cpDone.every(Boolean)) {
        const score = calcScore(steps, stage.par, stage.limit);
        return { ...next, status: "cleared", result: { score, rank: calcRank(score), steps } };
      }
      if (steps >= stage.limit) return { ...next, status: "failed" };
      return next;
    }
  }
}

export function useGame() {
  const [state, dispatch] = useReducer(reduce, 0, initState);
  const stage = STAGES[state.stageIdx];

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
