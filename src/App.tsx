import { useEffect, useMemo, useState } from "react";
import { CheckpointList } from "./components/CheckpointList";
import { DPad } from "./components/DPad";
import { GUTTER, boardPx } from "./components/boardMetrics";
import { MazeCanvas } from "./components/MazeCanvas";
import { ResultOverlay } from "./components/ResultOverlay";
import { StageSelect } from "./components/StageSelect";
import { StatsPanel } from "./components/StatsPanel";
import { buildFreePlayStage, freePlayDifficultyOf, randomSeed } from "./game/generator";
import { blockCells } from "./game/metrics";
import { findRouteThrough } from "./game/solver";
import { STAGES } from "./game/stages";
import type { Stage } from "./game/types";
import { buildShareUrl, parseStageParams, stageToParams } from "./hooks/share";
import { useGame } from "./hooks/useGame";

type View = "select" | "play";

export default function App() {
  // URL(location.search)にステージが指定されていれば、選択画面を経由せずその場で開始する
  // (useState の遅延初期化なので初回マウント時にのみ評価される)
  const [urlStage] = useState<Stage | null>(() => parseStageParams(window.location.search));
  const [view, setView] = useState<View>(urlStage ? "play" : "select");
  const { state, stage, move, reset, selectStage } = useGame(urlStage ?? STAGES[0]);
  const [showHint, setShowHint] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  useEffect(() => setShowHint(false), [state.stage]);
  useEffect(() => setLinkCopied(false), [state.stage]);

  // ステージ選択画面に戻ったらクエリを除去し、プレイ中は現在のステージに URL クエリを同期する。
  // pushState ではなく replaceState を使い、ステージ遷移のたびに履歴を汚さないようにする
  useEffect(() => {
    const params = view === "play" ? stageToParams(stage) : null;
    const url = params ? `${window.location.pathname}?${params}` : window.location.pathname;
    window.history.replaceState(null, "", url);
  }, [view, stage]);

  // COPY LINK ボタン用の共有URL。stageToParams が null(復元不能)なステージでは非表示にする
  const shareUrl = useMemo(
    () => buildShareUrl(`${window.location.origin}${window.location.pathname}`, stage),
    [stage],
  );
  const handleCopyLink = () => {
    if (!shareUrl) return;
    navigator.clipboard
      .writeText(shareUrl)
      .then(() => {
        setLinkCopied(true);
        setTimeout(() => setLinkCopied(false), 2000);
      })
      .catch(() => {
        // クリップボードが使えない環境でも UI は壊さない
      });
  };

  // 爆弾ありステージでは、爆弾マスを塞いだグリッドでヒント探索する(爆弾を通るヒントを出さないため)
  const hintGrid = useMemo(
    () => (stage.bombs.length > 0 ? blockCells(stage.grid, stage.size, stage.bombs) : stage.grid),
    [stage],
  );

  // 現在地から未通過チェックポイントを経由してゴールへ向かう最短経路
  // 注: 崩れる床の残回数を考慮しない既知の制限。ヒント経路が不正になる可能性あり
  // 一筆書きモードはハミルトン路探索が未実装なのでヒントを出さない
  const hintPath = useMemo(() => {
    if (stage.oneStroke || !showHint || state.status !== "playing") return null;
    const remaining = stage.checkpoints.filter((_, i) => !state.cpDone[i]);
    return findRouteThrough(
      hintGrid,
      stage.size,
      state.pos,
      stage.goal,
      remaining,
      stage.warps,
      stage.heavyCells,
    );
  }, [showHint, state.status, state.pos, state.cpDone, hintGrid, stage]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (view !== "play") return;
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) e.preventDefault();
      if (e.key === "ArrowUp" || e.key === "w") move(-1, 0);
      if (e.key === "ArrowDown" || e.key === "s") move(1, 0);
      if (e.key === "ArrowRight" || e.key === "d") move(0, 1);
      if (e.key === "ArrowLeft" || e.key === "a") move(0, -1);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [move, view]);

  // lineLimits ステージは MazeCanvas 側もガター分だけ広く描画するため、幅を揃える
  const widthPx = boardPx(stage.size) + (stage.lineLimits ? GUTTER : 0);

  const handleSelectStage = (s: Stage) => {
    selectStage(s);
    setView("play");
  };

  const handleBackToSelect = () => setView("select");

  // NEXT は手作りステージ(STAGES)の連番のみ対象。デイリー・フリープレイでは非表示にする
  const handcraftedIdx = STAGES.findIndex((s) => s.id === stage.id);
  const hasNext = handcraftedIdx >= 0 && handcraftedIdx < STAGES.length - 1;
  const handleNext = () => {
    if (hasNext) handleSelectStage(STAGES[handcraftedIdx + 1]);
  };

  // フリープレイをプレイ中なら、クリア後に同難易度・新シードで再生成できるようにする
  const freePlayDifficulty = freePlayDifficultyOf(stage.id);
  const handleRegenerate = () => {
    if (!freePlayDifficulty) return;
    selectStage(buildFreePlayStage(freePlayDifficulty, randomSeed()));
  };

  if (view === "select") {
    return <StageSelect onSelect={handleSelectStage} />;
  }

  return (
    <div className="app">
      <header className="header">
        <div className="header-system">MAZE SYSTEM</div>
        <div className="header-stage">
          {stage.label}
          <span className="header-desc">{stage.desc}</span>
        </div>
      </header>

      <StatsPanel steps={state.steps} par={stage.par} limit={stage.limit} widthPx={widthPx} />
      <CheckpointList checkpoints={stage.checkpoints} cpDone={state.cpDone} />

      <div className="board-frame">
        <MazeCanvas
          stage={stage}
          pos={state.pos}
          visitedPath={state.visited}
          hintPath={hintPath}
          warpFlash={state.lastWarp}
          crumbleLeft={state.crumbleLeft}
          bombHit={state.bombHit}
          rowUsed={state.rowUsed}
          colUsed={state.colUsed}
        />
      </div>

      <DPad onMove={move} />

      <div className="actions">
        <button onClick={handleBackToSelect} className="action-btn">BACK</button>
        <button onClick={reset} className="action-btn">RESET</button>
        <button
          onClick={() => setShowHint((h) => !h)}
          className={`action-btn${showHint ? " is-primary" : ""}`}
          disabled={stage.oneStroke}
        >
          HINT {showHint ? "ON" : "OFF"}
        </button>
        {shareUrl && (
          <button onClick={handleCopyLink} className={`action-btn${linkCopied ? " is-primary" : ""}`}>
            {linkCopied ? "COPIED" : "COPY LINK"}
          </button>
        )}
      </div>

      <div className="legend">
        <span className="legend-goal">GOAL</span>
        <span className="legend-cp">CHECKPOINT</span>
        <span className="legend-warp">WARP</span>
        <span className="legend-heavy">×2</span>
        <span className="legend-crumble">CRUMBLE</span>
        <span className="legend-bomb">BOMB</span>
      </div>
      <div className="key-help">ARROW KEYS / WASD</div>

      <ResultOverlay
        status={state.status}
        result={state.result}
        stage={stage}
        steps={state.steps}
        shareUrl={shareUrl}
        hasNext={hasNext}
        isFreePlay={freePlayDifficulty !== null}
        onRetry={reset}
        onNext={handleNext}
        onRegenerate={handleRegenerate}
        onBackToSelect={handleBackToSelect}
      />
    </div>
  );
}
