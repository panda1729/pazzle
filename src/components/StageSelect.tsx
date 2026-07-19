import { useMemo } from "react";
import {
  buildDailyStage,
  buildFreePlayStage,
  FREE_PLAY_DIFFICULTIES,
  randomSeed,
} from "../game/generator";
import type { Difficulty } from "../game/generator";
import { STAGES } from "../game/stages";
import type { Stage } from "../game/types";
import { loadProgress, stageKeyFor, type ProgressMap } from "../hooks/progress";

interface Props {
  onSelect: (stage: Stage) => void;
}

/** クリア済みバッジ(クリア回数・ベストランク)。未クリアなら何も表示しない */
function ClearBadge({ progress }: { progress: ProgressMap[string] | undefined }) {
  if (!progress) return null;
  return (
    <div className="stage-card-badge">
      CLEAR ×{progress.clearCount} <span className="stage-card-rank">BEST {progress.bestRank}</span>
    </div>
  );
}

export function StageSelect({ onSelect }: Props) {
  // 今日のデイリーは選択画面を開くたびに組み立てる(日付が変わればビルドし直される)
  const daily = useMemo(() => buildDailyStage(new Date()), []);
  const progress = useMemo(() => loadProgress(), []);

  const handleFreePlay = (difficulty: Difficulty) => {
    onSelect(buildFreePlayStage(difficulty, randomSeed()));
  };

  return (
    <div className="app">
      <header className="header">
        <div className="header-system">MAZE SYSTEM</div>
        <div className="header-stage">STAGE SELECT</div>
      </header>

      <section className="select-section">
        <div className="select-section-title">DAILY</div>
        <div className="stage-grid">
          <button className="stage-card is-daily" onClick={() => onSelect(daily)}>
            <div className="stage-card-label">{daily.label}</div>
            <div className="stage-card-desc">{daily.desc}</div>
            <div className="stage-card-meta">
              {daily.size}×{daily.size} / PAR {daily.par}
            </div>
            <ClearBadge progress={progress[stageKeyFor(daily) ?? ""]} />
          </button>
        </div>
      </section>

      <section className="select-section">
        <div className="select-section-title">STAGES</div>
        <div className="stage-grid">
          {STAGES.map((stage) => (
            <button key={stage.id} className="stage-card" onClick={() => onSelect(stage)}>
              <div className="stage-card-label">{stage.label}</div>
              <div className="stage-card-desc">{stage.desc}</div>
              <div className="stage-card-meta">
                {stage.size}×{stage.size} / PAR {stage.par}
              </div>
              <ClearBadge progress={progress[stageKeyFor(stage) ?? ""]} />
            </button>
          ))}
        </div>
      </section>

      <section className="select-section">
        <div className="select-section-title">FREE PLAY</div>
        <div className="stage-grid">
          {FREE_PLAY_DIFFICULTIES.map((difficulty) => (
            <button
              key={difficulty}
              className="stage-card is-freeplay"
              onClick={() => handleFreePlay(difficulty)}
            >
              <div className="stage-card-label">FREE {difficulty.toUpperCase()}</div>
              <div className="stage-card-desc">RANDOM SEED</div>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
