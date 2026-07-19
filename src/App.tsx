import { useEffect, useMemo, useState } from "react";
import { CheckpointList } from "./components/CheckpointList";
import { DPad } from "./components/DPad";
import { GUTTER, boardPx } from "./components/boardMetrics";
import { MazeCanvas } from "./components/MazeCanvas";
import { ResultOverlay } from "./components/ResultOverlay";
import { StageTabs } from "./components/StageTabs";
import { StatsPanel } from "./components/StatsPanel";
import { blockCells } from "./game/metrics";
import { findRouteThrough } from "./game/solver";
import { ALL_STAGES } from "./game/stages";
import { useGame } from "./hooks/useGame";

export default function App() {
  const { state, stage, move, reset, selectStage } = useGame();
  const [showHint, setShowHint] = useState(false);

  useEffect(() => setShowHint(false), [state.stageIdx]);

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
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) e.preventDefault();
      if (e.key === "ArrowUp" || e.key === "w") move(-1, 0);
      if (e.key === "ArrowDown" || e.key === "s") move(1, 0);
      if (e.key === "ArrowRight" || e.key === "d") move(0, 1);
      if (e.key === "ArrowLeft" || e.key === "a") move(0, -1);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [move]);

  // lineLimits ステージは MazeCanvas 側もガター分だけ広く描画するため、幅を揃える
  const widthPx = boardPx(stage.size) + (stage.lineLimits ? GUTTER : 0);

  return (
    <div className="app">
      <header className="header">
        <div className="header-system">MAZE SYSTEM</div>
        <div className="header-stage">
          {stage.label}
          <span className="header-desc">{stage.desc}</span>
        </div>
      </header>

      <StageTabs stages={ALL_STAGES} currentIdx={state.stageIdx} onSelect={selectStage} />
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
        <button onClick={reset} className="action-btn">RESET</button>
        <button
          onClick={() => setShowHint((h) => !h)}
          className={`action-btn${showHint ? " is-primary" : ""}`}
          disabled={stage.oneStroke}
        >
          HINT {showHint ? "ON" : "OFF"}
        </button>
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
        hasNext={state.stageIdx < ALL_STAGES.length - 1}
        onRetry={reset}
        onNext={() => selectStage(state.stageIdx + 1)}
      />
    </div>
  );
}
