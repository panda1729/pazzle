import type { Stage } from "../game/types";

/**
 * クリア状況を localStorage に保存する。
 *
 * キー: "pazzle.progress.v1"
 * 値: { [stageKey]: { bestScore, bestRank, clearCount } }
 *
 * stageKey の規約(stageKeyFor 参照):
 *  - 手作りステージ(id 1〜99): "stage-<id>"
 *  - デイリー(id 100): "daily-<UTC日付 YYYY-MM-DD>"(desc に既にその形式で入っている)
 *  - フリープレイ(id 200番台、generator.ts の buildFreePlayStage が発行する)は保存しない
 */

const STORAGE_KEY = "pazzle.progress.v1";

export interface StageProgress {
  bestScore: number;
  bestRank: string;
  clearCount: number;
}

export type ProgressMap = Record<string, StageProgress>;

/** localStorage が使えない環境(SSR・privateモード等)でも例外を投げないためのガード */
function getStorage(): Storage | null {
  try {
    if (typeof localStorage === "undefined") return null;
    return localStorage;
  } catch {
    return null;
  }
}

/**
 * Stage から進捗保存用のキーを導出する。フリープレイ(id >= 200)は保存対象外なので null を返す。
 */
export function stageKeyFor(stage: Stage): string | null {
  if (stage.id >= 200) return null; // フリープレイは保存しない
  if (stage.id === 100) return `daily-${stage.desc}`; // desc は buildDailyStage が "YYYY-MM-DD"(UTC) を設定する
  return `stage-${stage.id}`;
}

/** 保存済みの進捗を読み込む。壊れたデータ・localStorage不可の場合は空オブジェクトを返す */
export function loadProgress(): ProgressMap {
  const storage = getStorage();
  if (!storage) return {};
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return {};
    return parsed as ProgressMap;
  } catch {
    return {};
  }
}

function saveProgress(progress: ProgressMap): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch {
    // 容量超過等は無視する(進捗保存はベストエフォートで、ゲーム進行自体は妨げない)
  }
}

/**
 * クリアを記録する。ベストスコアを更新した場合のみ bestScore/bestRank を上書きし、
 * clearCount は呼ぶたびに常に+1する。localStorage が使えない環境では保存されないが例外は投げない。
 */
export function recordClear(stageKey: string, score: number, rank: string): ProgressMap {
  const progress = loadProgress();
  const prev = progress[stageKey];
  const next: StageProgress = prev
    ? {
        bestScore: Math.max(prev.bestScore, score),
        bestRank: score > prev.bestScore ? rank : prev.bestRank,
        clearCount: prev.clearCount + 1,
      }
    : { bestScore: score, bestRank: rank, clearCount: 1 };
  const updated: ProgressMap = { ...progress, [stageKey]: next };
  saveProgress(updated);
  return updated;
}
