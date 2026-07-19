export type Direction = "n" | "s" | "e" | "w";

/** 各方向が開通しているか(true = 壁がなく通れる) */
export interface Cell {
  n: boolean;
  s: boolean;
  e: boolean;
  w: boolean;
}

export type Grid = Cell[][];

export type Position = readonly [row: number, col: number];

export interface Warp {
  from: Position;
  to: Position;
}

export interface Checkpoint {
  row: number;
  col: number;
}

export interface CrumbleCell {
  pos: Position;
  uses: number;
}

/** ステージの定義(手書きするのはここまで) */
export interface StageDef {
  id: number;
  label: string;
  desc: string;
  size: number;
  seed: number;
  start: Position;
  goal: Position;
  checkpoints: Checkpoint[];
  warps: Warp[];
  /** 踏むと歩数カウントが+2になるマス */
  heavyCells?: Position[];
  /** 指定回数までしか踏めない床 */
  crumbleCells?: CrumbleCell[];
  /** 一筆書きモード(全マスをちょうど1回ずつ踏破してゴールする)か */
  oneStroke?: boolean;
}

/** 定義から生成された、プレイ可能なステージ */
export interface Stage extends StageDef {
  grid: Grid;
  /** 最短手数。以下ならSランク */
  par: number;
  /** この手数に達したら失敗 */
  limit: number;
  heavyCells: Position[];
  crumbleCells: CrumbleCell[];
  oneStroke: boolean;
}

export const samePos = (a: Position, b: Position): boolean =>
  a[0] === b[0] && a[1] === b[1];
