/** 1マスの描画サイズ(px) */
export const CELL = 60;
/** 壁の太さ(px) */
export const WALL = 4;

/** 盤面全体の描画サイズ(px)= 外周 + マス + 内壁 */
export const boardPx = (size: number) => WALL + size * (CELL + WALL);
