import { generateMaze, generateOpenGrid } from "./maze";
import { findRouteThrough, routeCost } from "./solver";
import { samePos } from "./types";
import type { Stage, StageDef } from "./types";

/**
 * StageDef → Stage への変換(par はソルバーによる最小コストから自動算出し、limit はその2倍とする)。
 * stages.ts(手作りステージ)と generator.ts(自動生成ステージ)の両方から使われるため、
 * どちらにも依存しない独立モジュールに置いている(generator.ts が stages.ts を、
 * stages.ts が generator.ts を import する循環参照を避けるため)。
 */
export function buildStage(def: StageDef): Stage {
  const heavyCells = def.heavyCells ?? [];
  const crumbleCells = def.crumbleCells ?? [];
  const oneStroke = def.oneStroke ?? false;
  const braid = def.braid ?? 0;

  if (oneStroke) {
    // 一筆書きモードは他ギミックと併用しない(全マス踏破の判定がシンプルでなくなるため)
    if (
      def.checkpoints.length > 0 ||
      def.warps.length > 0 ||
      heavyCells.length > 0 ||
      crumbleCells.length > 0
    ) {
      throw new Error(`Stage ${def.id}: 一筆書きモードは他のギミックと併用できません`);
    }
    // 通常の迷路(木構造)は全マス一筆書きがほぼ不可能なので、内壁のないオープングリッドを使う
    const grid = generateOpenGrid(def.size);
    // 再訪不可なので歩数は「全マス数-1」を超えられず、par もそれと一致する
    const par = def.size * def.size - 1;
    return { ...def, grid, par, limit: par, heavyCells, crumbleCells, oneStroke, braid };
  }

  const grid = generateMaze(def.size, def.seed, braid);

  // crumble マスが start と重ならないかチェック
  for (const crumble of crumbleCells) {
    if (samePos(crumble.pos, def.start)) {
      throw new Error(`Stage ${def.id}: 崩れる床が start マスと重なっています`);
    }
  }

  const route = findRouteThrough(
    grid,
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

  const par = routeCost(route, heavyCells);
  return { ...def, grid, par, limit: par * 2, heavyCells, crumbleCells, oneStroke, braid };
}
