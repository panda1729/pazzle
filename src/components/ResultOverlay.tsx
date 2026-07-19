import { useEffect, useState } from "react";
import { calcRank } from "../game/score";
import type { Stage } from "../game/types";
import { buildShareText } from "../hooks/share";
import type { GameResult, GameStatus } from "../hooks/useGame";

interface Props {
  status: GameStatus;
  result: GameResult | null;
  stage: Stage;
  /** 現在の歩数。失敗時は result が null になるため、シェア文面の歩数表示にはこちらを使う */
  steps: number;
  /** COPY LINK と同じ共有URL。stageToParams が null(復元不能)なステージでは null */
  shareUrl: string | null;
  /** 次の手作りステージが存在する(手作りステージをプレイ中の場合のみ)か */
  hasNext: boolean;
  /** フリープレイをプレイ中か(同難易度・新シードでの再生成ボタンを出すかどうか) */
  isFreePlay: boolean;
  onRetry: () => void;
  onNext: () => void;
  onRegenerate: () => void;
  onBackToSelect: () => void;
}

/** シェア文面のコピー・X投稿ボタン(クリア/失敗どちらの overlay-actions にも並べる) */
function ShareButtons({ shareText }: { shareText: string }) {
  const [copied, setCopied] = useState(false);
  // シェア文面が変わったら(=別の結果になったら)コピー済み表示をリセットする
  useEffect(() => setCopied(false), [shareText]);

  const handleCopy = () => {
    navigator.clipboard
      .writeText(shareText)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => {
        // クリップボードが使えない環境でも UI は壊さない
      });
  };

  const handlePostX = () => {
    const intentUrl = `https://x.com/intent/post?text=${encodeURIComponent(shareText)}`;
    window.open(intentUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <>
      <button onClick={handleCopy} className={`action-btn${copied ? " is-primary" : ""}`}>
        {copied ? "COPIED" : "COPY RESULT"}
      </button>
      <button onClick={handlePostX} className="action-btn">POST X</button>
    </>
  );
}

export function ResultOverlay({
  status,
  result,
  stage,
  steps,
  shareUrl,
  hasNext,
  isFreePlay,
  onRetry,
  onNext,
  onRegenerate,
  onBackToSelect,
}: Props) {
  if (status === "playing") return null;

  if (status === "failed") {
    // GameResult は cleared 時のみ作られるため、失敗時のシェア文面は steps から score:0/rank:F を組む
    const shareText = buildShareText(stage, { score: 0, rank: calcRank(0), steps }, true, shareUrl ?? "");
    return (
      <div className="overlay">
        <div className="overlay-box">
          <div className="overlay-title">LIMIT EXCEEDED</div>
          <div className="overlay-rank is-fail">F</div>
          <div className="overlay-actions">
            <button onClick={onRetry} className="action-btn is-danger">RETRY</button>
            <ShareButtons shareText={shareText} />
            <button onClick={onBackToSelect} className="action-btn">STAGE LIST</button>
          </div>
        </div>
      </div>
    );
  }

  if (!result) return null;
  const shareText = buildShareText(stage, result, false, shareUrl ?? "");
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
          <ShareButtons shareText={shareText} />
          <button onClick={onBackToSelect} className="action-btn">STAGE LIST</button>
        </div>
      </div>
    </div>
  );
}
