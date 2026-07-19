import { generateMaze, generateOpenGrid } from "./maze";
import { blockCells } from "./metrics";
import { findRouteThrough, routeCost } from "./solver";
import { samePos } from "./types";
import type { Position, Stage, StageDef } from "./types";

/**
 * StageDef → Stage への変換(par はソルバーによる最小コストから自動算出し、limit はその2倍とする)。
 * stages.ts(手作りステージ)と generator.ts(自動生成ステージ)の両方から使われるため、
 * どちらにも依存しない独立モジュールに置いている(generator.ts が stages.ts を、
 * stages.ts が generator.ts を import する循環参照を避けるため)。
 */
export function buildStage(def: StageDef): Stage {
  const heavyCells = def.heavyCells ?? [];
  const crumbleCells = def.crumbleCells ?? [];
  const bombs = def.bombs ?? [];
  const oneStroke = def.oneStroke ?? false;
  const braid = def.braid ?? 0;
  const lineLimits = def.lineLimits ?? null;

  // lineLimits の配列長は size と一致していなければならない
  if (lineLimits && (lineLimits.rows.length !== def.size || lineLimits.cols.length !== def.size)) {
    throw new Error(`Stage ${def.id}: lineLimits の配列長が size と一致していません`);
  }

  if (oneStroke) {
    // 一筆書きモードは他ギミックと併用しない(全マス踏破の判定がシンプルでなくなるため)
    if (
      def.checkpoints.length > 0 ||
      def.warps.length > 0 ||
      heavyCells.length > 0 ||
      crumbleCells.length > 0 ||
      bombs.length > 0 ||
      lineLimits !== null
    ) {
      throw new Error(`Stage ${def.id}: 一筆書きモードは他のギミックと併用できません`);
    }
    // 通常の迷路(木構造)は全マス一筆書きがほぼ不可能なので、内壁のないオープングリッドを使う
    const grid = generateOpenGrid(def.size);
    // 再訪不可なので歩数は「全マス数-1」を超えられず、par もそれと一致する
    const par = def.size * def.size - 1;
    return {
      ...def,
      grid,
      par,
      limit: par,
      heavyCells,
      crumbleCells,
      bombs,
      oneStroke,
      braid,
      lineLimits,
    };
  }

  const grid = generateMaze(def.size, def.seed, braid);

  // crumble マスが start と重ならないかチェック
  for (const crumble of crumbleCells) {
    if (samePos(crumble.pos, def.start)) {
      throw new Error(`Stage ${def.id}: 崩れる床が start マスと重なっています`);
    }
  }

  // 爆弾マスが他の特殊マス(start/goal/checkpoints/warp from・to/heavy/crumble)と重なっていないかチェック
  if (bombs.length > 0) {
    const otherSpecialCells: Position[] = [
      def.start,
      def.goal,
      ...def.checkpoints.map((cp): Position => [cp.row, cp.col]),
      ...def.warps.flatMap((w) => [w.from, w.to]),
      ...heavyCells,
      ...crumbleCells.map((c) => c.pos),
    ];
    for (const bomb of bombs) {
      if (otherSpecialCells.some((cell) => samePos(cell, bomb))) {
        throw new Error(`Stage ${def.id}: 爆弾マスが他の特殊マスと重なっています`);
      }
    }
  }

  // par 算出・到達可能性チェックは、爆弾マスを塞いだグリッド(爆弾を避ける前提)で行う。
  // ゲーム用の grid 自体(実際に爆弾マスへ踏み込めること)は変えない。
  const routingGrid = bombs.length > 0 ? blockCells(grid, def.size, bombs) : grid;

  const route = findRouteThrough(
    routingGrid,
    def.size,
    def.start,
    def.goal,
    def.checkpoints,
    def.warps,
    heavyCells,
  );
  if (!route) throw new Error(`Stage ${def.id}: ゴールに到達できない迷路定義です`);

  // 最適経路での crumble マスへの進入回数チェック
  for (const crumble of crumbleCells) {
    const count = route.slice(1).filter((pos) => samePos(pos, crumble.pos)).length;
    if (count > crumble.uses) {
      throw new Error(
        `Stage ${def.id}: 最適経路が崩れる床 ${crumble.pos} を ${count} 回通りますが、uses は ${crumble.uses} です`
      );
    }
  }

  // 最適経路(start含む)の行・列進入回数が、lineLimits の上限を超えていないかチェック
  // (超えていると、最短経路ですら踏破不能な「解けない」ステージ定義になってしまう)
  if (lineLimits) {
    const rowsUsage = Array<number>(def.size).fill(0);
    const colsUsage = Array<number>(def.size).fill(0);
    for (const [r, c] of route) {
      rowsUsage[r]++;
      colsUsage[c]++;
    }
    for (let i = 0; i < def.size; i++) {
      if (rowsUsage[i] > lineLimits.rows[i]) {
        throw new Error(
          `Stage ${def.id}: 最適経路が行${i}に${rowsUsage[i]}回進入しますが、上限は${lineLimits.rows[i]}です`
        );
      }
      if (colsUsage[i] > lineLimits.cols[i]) {
        throw new Error(
          `Stage ${def.id}: 最適経路が列${i}に${colsUsage[i]}回進入しますが、上限は${lineLimits.cols[i]}です`
        );
      }
    }
  }

  const par = routeCost(route, heavyCells);
  return {
    ...def,
    grid,
    par,
    limit: par * 2,
    heavyCells,
    crumbleCells,
    bombs,
    oneStroke,
    braid,
    lineLimits,
  };
}
