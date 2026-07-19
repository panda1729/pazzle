import type { GameResult, GameStatus } from "../hooks/useGame";
import type { Stage } from "../game/types";

interface Props {
  status: GameStatus;
  result: GameResult | null;
  stage: Stage;
  /** 次の手作りステージが存在する(手作りステージをプレイ中の場合のみ)か */
  hasNext: boolean;
  /** フリープレイをプレイ中か(同難易度・新シードでの再生成ボタンを出すかどうか) */
  isFreePlay: boolean;
  onRetry: () => void;
  onNext: () => void;
  onRegenerate: () => void;
  onBackToSelect: () => void;
}

export function ResultOverlay({
  status,
  result,
  stage,
  hasNext,
  isFreePlay,
  onRetry,
  onNext,
  onRegenerate,
  onBackToSelect,
}: Props) {
  if (status === "playing") return null;

  if (status === "failed") {
    return (
      <div className="overlay">
        <div className="overlay-box">
          <div className="overlay-title">LIMIT EXCEEDED</div>
          <div className="overlay-rank is-fail">F</div>
          <div className="overlay-actions">
            <button onClick={onRetry} className="action-btn is-danger">RETRY</button>
            <button onClick={onBackToSelect} className="action-btn">STAGE LIST</button>
          </div>
        </div>
      </div>
    );
  }

  if (!result) return null;
  return (
    <div className="overlay">
      <div className="overlay-box">
        <div className="overlay-title">STAGE CLEAR</div>
        <div className="overlay-rank" style={{ color: result.rank.color }}>
          {result.rank.label}
        </div>
        <div className="overlay-score">
          {result.score} <span className="overlay-unit">pts</span>
        </div>
        <div className="overlay-detail">
          {result.steps} STEPS / PAR {stage.par}
        </div>
        <div className="overlay-actions">
          <button onClick={onRetry} className="action-btn">RETRY</button>
          {hasNext && (
            <button onClick={onNext} className="action-btn is-primary">NEXT ▶</button>
          )}
          {isFreePlay && (
            <button onClick={onRegenerate} className="action-btn is-primary">NEW SEED</button>
          )}
          <button onClick={onBackToSelect} className="action-btn">STAGE LIST</button>
        </div>
      </div>
    </div>
  );
}
