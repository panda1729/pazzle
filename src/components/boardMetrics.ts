/** 1マスの描画サイズ(px) */
export const CELL = 60;
/** 壁の太さ(px) */
export const WALL = 4;

/** 盤面(迷路グリッド部分のみ)の描画サイズ(px)= 外周 + マス + 内壁 */
export const boardPx = (size: number) => WALL + size * (CELL + WALL);

/** lineLimits ステージで盤面の上・左に確保するガター幅(残り回数表示用、px) */
export const GUTTER = 24;

/** canvas 全体の描画サイズ(px)。lineLimits があるステージはガター分だけ広くなる */
export const canvasPx = (size: number, hasGutter: boolean) =>
  boardPx(size) + (hasGutter ? GUTTER : 0);
