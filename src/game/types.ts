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
  /** 見えない爆弾マス。踏むと即失敗。8近傍のマスには隣接数が常時表示される */
  bombs?: Position[];
  /** 一筆書きモード(全マスをちょうど1回ずつ踏破してゴールする)か */
  oneStroke?: boolean;
  /** 0〜1。行き止まりを確率的に壊してループ(閉路)を作り、ルート選択を生む度合い */
  braid?: number;
  /** 各行・各列に「進入できる回数」の上限を設けるイラストロジック風の制限 */
  lineLimits?: { rows: number[]; cols: number[] } | null;
  /**
   * generateStageDef に渡された元の seed(内部の迷路生成用 subSeed とは別物)。
   * デイリー・フリープレイの共有URL復元(hooks/share.ts)に使う。手作りステージでは undefined
   */
  originalSeed?: number;
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
  bombs: Position[];
  oneStroke: boolean;
  braid: number;
  /** 未設定なら null に正規化される */
  lineLimits: { rows: number[]; cols: number[] } | null;
}

export const samePos = (a: Position, b: Position): boolean =>
  a[0] === b[0] && a[1] === b[1];
