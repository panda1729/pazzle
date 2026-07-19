import { describe, expect, it } from "vitest";
import { calcRank } from "../game/score";
import { buildDailyStage, buildFreePlayStage } from "../game/generator";
import { STAGES } from "../game/stages";
import { buildShareText, buildShareUrl, parseStageParams, stageToParams } from "./share";

const DAILY_DATE = new Date(Date.UTC(2026, 6, 19)); // 2026-07-19(UTC)

describe("stageToParams / parseStageParams", () => {
  it("手作りステージは stage=<id> になり、往復で同じステージに復元できる", () => {
    const stage = STAGES.find((s) => s.id === 9)!; // STAGE 09 BOMB
    const params = stageToParams(stage);
    expect(params).toBe("stage=9");
    expect(parseStageParams(params!)).toBe(stage); // STAGES から取得するので同一参照
  });

  it("デイリーは daily=<YYYY-MM-DD> になり、往復で同内容のステージに復元できる", () => {
    const stage = buildDailyStage(DAILY_DATE);
    const params = stageToParams(stage);
    expect(params).toBe("daily=2026-07-19");
    expect(parseStageParams(params!)).toEqual(stage);
  });

  it("過去日付のデイリーも日付シードから決定的に再現できる", () => {
    const past = new Date(Date.UTC(2020, 0, 1));
    const stage = buildDailyStage(past);
    const params = stageToParams(stage);
    expect(params).toBe("daily=2020-01-01");
    expect(parseStageParams(params!)).toEqual(stage);
  });

  it("フリープレイは free=<difficulty>&seed=<seed> になり、往復で同内容のステージに復元できる", () => {
    const stage = buildFreePlayStage("hard", 12345);
    const params = stageToParams(stage);
    expect(params).toBe("free=hard&seed=12345");
    expect(parseStageParams(params!)).toEqual(stage);
  });

  it("? 付きのクエリ文字列(location.search 相当)も受け付ける", () => {
    expect(parseStageParams("?stage=1")).toBe(STAGES.find((s) => s.id === 1)!);
  });
});

describe("parseStageParams の不正値", () => {
  it("存在しない手作りステージ id は null", () => {
    expect(parseStageParams("stage=9999")).toBeNull();
  });

  it("数値でない stage id は null", () => {
    expect(parseStageParams("stage=abc")).toBeNull();
  });

  it("壊れた日付(存在しない日)は null", () => {
    expect(parseStageParams("daily=2026-02-30")).toBeNull();
  });

  it("日付形式でない daily 値は null", () => {
    expect(parseStageParams("daily=not-a-date")).toBeNull();
  });

  it("不正な difficulty は null", () => {
    expect(parseStageParams("free=insane&seed=1")).toBeNull();
  });

  it("数値でない seed は null", () => {
    expect(parseStageParams("free=hard&seed=abc")).toBeNull();
  });

  it("該当パラメータが無ければ null", () => {
    expect(parseStageParams("")).toBeNull();
    expect(parseStageParams("foo=bar")).toBeNull();
  });
});

describe("buildShareUrl", () => {
  it("baseUrl にクエリを付けて返す", () => {
    const stage = STAGES.find((s) => s.id === 9)!;
    expect(buildShareUrl("https://panda1729.github.io/pazzle/", stage)).toBe(
      "https://panda1729.github.io/pazzle/?stage=9",
    );
  });
});

describe("buildShareText", () => {
  const url = "https://panda1729.github.io/pazzle/?daily=2026-07-19";

  it("デイリー・クリア時の文面", () => {
    const stage = buildDailyStage(DAILY_DATE);
    const text = buildShareText(stage, { score: 1000, rank: calcRank(1000), steps: 23 }, false, url);
    expect(text).toBe(
      ["PAZZLE DAILY 2026-07-19", "RANK S | 23 STEPS (PAR 23)", url].join("\n"),
    );
  });

  it("デイリー・失敗時の文面", () => {
    const stage = buildDailyStage(DAILY_DATE);
    const text = buildShareText(stage, { score: 0, rank: calcRank(0), steps: 30 }, true, url);
    expect(text).toBe(
      ["PAZZLE DAILY 2026-07-19", "FAILED | 30 STEPS (PAR 23)", url].join("\n"),
    );
  });

  it("手作りステージの文面(1行目が STAGE番号+desc)", () => {
    const stage = STAGES.find((s) => s.id === 9)!; // label "STAGE 09" desc "BOMB"
    const stageUrl = "https://panda1729.github.io/pazzle/?stage=9";
    const text = buildShareText(
      stage,
      { score: 1000, rank: calcRank(1000), steps: stage.par },
      false,
      stageUrl,
    );
    expect(text).toBe(
      ["PAZZLE STAGE 09 BOMB", `RANK S | ${stage.par} STEPS (PAR ${stage.par})`, stageUrl].join("\n"),
    );
  });

  it("フリープレイの文面(1行目が #<seed> 表記)", () => {
    const stage = buildFreePlayStage("hard", 12345);
    const freeUrl = "https://panda1729.github.io/pazzle/?free=hard&seed=12345";
    const text = buildShareText(
      stage,
      { score: 1000, rank: calcRank(1000), steps: stage.par },
      false,
      freeUrl,
    );
    expect(text).toBe(
      ["PAZZLE FREE HARD #12345", `RANK S | ${stage.par} STEPS (PAR ${stage.par})`, freeUrl].join("\n"),
    );
  });
});
