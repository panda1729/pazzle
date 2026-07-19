import type { Rank } from "../game/score";
import {
  buildDailyStage,
  buildFreePlayStage,
  FREE_PLAY_DIFFICULTIES,
  freePlayDifficultyOf,
} from "../game/generator";
import type { Difficulty } from "../game/generator";
import { STAGES } from "../game/stages";
import type { Stage } from "../game/types";

/**
 * 結果シェア・URLでのステージ共有に関する純粋関数群。
 * DOM(location, history, clipboard, window.open 等)には依存しない。UI配線側(App.tsx,
 * components/ResultOverlay.tsx)がこれらの関数を呼び出す形にする。
 */

/** YYYY-MM-DD 形式(daily パラメータ・desc の形式) */
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** 数字のみで構成された文字列か(先頭ゼロ・符号・小数を許容しない) */
const isDigits = (s: string): boolean => /^\d+$/.test(s);

/**
 * Stage を表すクエリ文字列(先頭 "?" なし)を返す。
 * 手作り: stage=<id> / デイリー: daily=<YYYY-MM-DD> / フリープレイ: free=<difficulty>&seed=<seed>
 * どれにも該当しない(復元不能な)場合は null。
 */
export function stageToParams(stage: Stage): string | null {
  const freeDifficulty = freePlayDifficultyOf(stage.id);
  if (freeDifficulty) {
    // originalSeed が無ければ URL から再生成できないため共有不可扱いにする
    if (stage.originalSeed === undefined) return null;
    return `free=${freeDifficulty}&seed=${stage.originalSeed}`;
  }
  if (stage.id === 100) {
    // desc は buildDailyStage が UTC日付("YYYY-MM-DD")を設定する
    return `daily=${stage.desc}`;
  }
  if (STAGES.some((s) => s.id === stage.id)) {
    return `stage=${stage.id}`;
  }
  return null;
}

/**
 * クエリ文字列(location.search 相当、先頭 "?" 有無どちらでも可)から Stage を復元する。
 * 不正な値・生成失敗の場合は throw せず null を返す。
 */
export function parseStageParams(search: string): Stage | null {
  const params = new URLSearchParams(search);

  const stageIdRaw = params.get("stage");
  if (stageIdRaw !== null) {
    if (!isDigits(stageIdRaw)) return null;
    const id = Number(stageIdRaw);
    return STAGES.find((s) => s.id === id) ?? null;
  }

  const dailyRaw = params.get("daily");
  if (dailyRaw !== null) {
    const match = DATE_RE.exec(dailyRaw);
    if (!match) return null;
    const [, yStr, mStr, dStr] = match;
    const y = Number(yStr);
    const mo = Number(mStr);
    const d = Number(dStr);
    const date = new Date(Date.UTC(y, mo - 1, d));
    // Date.UTC は月末超過などをロールオーバーするため、往復一致で不正日付(2月30日等)を弾く
    if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) {
      return null;
    }
    try {
      return buildDailyStage(date);
    } catch {
      return null;
    }
  }

  const freeRaw = params.get("free");
  const seedRaw = params.get("seed");
  if (freeRaw !== null && seedRaw !== null) {
    if (!FREE_PLAY_DIFFICULTIES.includes(freeRaw as Difficulty)) return null;
    if (!isDigits(seedRaw)) return null;
    const seed = Number(seedRaw);
    if (!Number.isSafeInteger(seed)) return null;
    try {
      return buildFreePlayStage(freeRaw as Difficulty, seed);
    } catch {
      return null;
    }
  }

  return null;
}

/** baseUrl(origin+pathname を想定)に Stage のクエリを付けた共有URLを返す。復元不能なら null */
export function buildShareUrl(baseUrl: string, stage: Stage): string | null {
  const params = stageToParams(stage);
  if (!params) return null;
  return `${baseUrl}?${params}`;
}

/** シェア文面の1行目(ステージ名)。フリープレイのみ desc ではなく #<seed> 表記にする */
function shareTitle(stage: Stage): string {
  const freeDifficulty = freePlayDifficultyOf(stage.id);
  if (freeDifficulty && stage.originalSeed !== undefined) {
    return `PAZZLE ${stage.label} #${stage.originalSeed}`;
  }
  return `PAZZLE ${stage.label} ${stage.desc}`;
}

export interface ShareResult {
  score: number;
  rank: Rank;
  steps: number;
}

/**
 * シェア文面を組み立てる(例)。
 *   PAZZLE DAILY 2026-07-19
 *   RANK S | 23 STEPS (PAR 23)
 *   https://panda1729.github.io/pazzle/?daily=2026-07-19
 * 失敗時は2行目が `FAILED | 30 STEPS (PAR 23)` になる。
 */
export function buildShareText(
  stage: Stage,
  result: ShareResult | null,
  failed: boolean,
  url: string,
): string {
  const steps = result?.steps ?? 0;
  const statusLine = failed
    ? `FAILED | ${steps} STEPS (PAR ${stage.par})`
    : result
      ? `RANK ${result.rank.label} | ${steps} STEPS (PAR ${stage.par})`
      : null;
  const lines = [shareTitle(stage), statusLine, url].filter((line): line is string => line !== null);
  return lines.join("\n");
}
