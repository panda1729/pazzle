import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildDailyStage } from "../game/generator";
import { STAGES } from "../game/stages";
import { loadProgress, recordClear, stageKeyFor } from "./progress";

/** テスト用の最小限の localStorage 実装(Storage インターフェースを満たす) */
class MemoryStorage implements Storage {
  private store = new Map<string, string>();
  get length(): number {
    return this.store.size;
  }
  clear(): void {
    this.store.clear();
  }
  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }
  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
}

describe("stageKeyFor", () => {
  it("手作りステージ(id 1〜99)は stage-<id> になる", () => {
    const stage = STAGES.find((s) => s.id === 1)!;
    expect(stageKeyFor(stage)).toBe("stage-1");
  });

  it("デイリー(id 100)は daily-<UTC日付> になる", () => {
    const stage = buildDailyStage(new Date(Date.UTC(2026, 6, 19)));
    expect(stageKeyFor(stage)).toBe("daily-2026-07-19");
  });

  it("フリープレイ(id 200番台)は null(保存しない)になる", () => {
    const stage = { ...STAGES[0], id: 200 };
    expect(stageKeyFor(stage)).toBeNull();
  });
});

describe("progress (localStorage が使えない環境)", () => {
  // vitest の test environment は "node" なので、明示的にスタブしなければ localStorage は存在しない
  it("loadProgress は throw せず空オブジェクトを返す", () => {
    expect(loadProgress()).toEqual({});
  });

  it("recordClear は throw せず、計算結果のマップを返す(永続化はされない)", () => {
    expect(() => recordClear("stage-1", 1000, "S")).not.toThrow();
    const result = recordClear("stage-1", 1000, "S");
    expect(result["stage-1"]).toEqual({ bestScore: 1000, bestRank: "S", clearCount: 1 });
    // 保存先が無いため、次回の loadProgress には反映されない
    expect(loadProgress()).toEqual({});
  });
});

describe("progress (localStorage をモック)", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", new MemoryStorage());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("初回クリアで bestScore/bestRank/clearCount が記録される", () => {
    const updated = recordClear("stage-1", 800, "A");
    expect(updated["stage-1"]).toEqual({ bestScore: 800, bestRank: "A", clearCount: 1 });
    expect(loadProgress()).toEqual(updated);
  });

  it("ベストスコアを更新した場合のみ bestScore/bestRank が上書きされる", () => {
    recordClear("stage-1", 500, "C");
    const updated = recordClear("stage-1", 900, "A");
    expect(updated["stage-1"]).toEqual({ bestScore: 900, bestRank: "A", clearCount: 2 });
  });

  it("ベストスコアを更新しない場合、bestScore/bestRank は変わらず clearCount だけ+1される", () => {
    recordClear("stage-1", 900, "A");
    const updated = recordClear("stage-1", 500, "C");
    expect(updated["stage-1"]).toEqual({ bestScore: 900, bestRank: "A", clearCount: 2 });
  });

  it("同スコアの場合は bestRank を上書きしない(更新条件は score > prev.bestScore)", () => {
    recordClear("stage-1", 700, "A");
    const updated = recordClear("stage-1", 700, "B");
    expect(updated["stage-1"]).toEqual({ bestScore: 700, bestRank: "A", clearCount: 2 });
  });

  it("異なる stageKey は独立して記録される", () => {
    recordClear("stage-1", 1000, "S");
    const updated = recordClear("stage-2", 400, "B");
    expect(updated["stage-1"]).toEqual({ bestScore: 1000, bestRank: "S", clearCount: 1 });
    expect(updated["stage-2"]).toEqual({ bestScore: 400, bestRank: "B", clearCount: 1 });
  });

  it("壊れたJSONが保存されていても loadProgress は throw せず空オブジェクトを返す", () => {
    localStorage.setItem("pazzle.progress.v1", "{ not valid json");
    expect(loadProgress()).toEqual({});
  });
});
