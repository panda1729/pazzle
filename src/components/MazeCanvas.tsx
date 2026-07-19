import { useEffect, useRef } from "react";
import { samePos } from "../game/types";
import type { Position, Stage } from "../game/types";
import { CELL, WALL, boardPx } from "./boardMetrics";

const WALL_COLOR = "#484848";
const FLOOR_COLOR = "#1A1A1A";
const VISITED_COLOR = "#222";
const HINT_COLOR = "#141F1F";
const FLASH_COLOR = "#1E3A3A";
const HEAVY_COLOR = "#F59E0B";

interface Props {
  stage: Stage;
  pos: Position;
  visitedPath: Position[];
  hintPath: Position[] | null;
  warpFlash: Position | null;
}

export function MazeCanvas({ stage, pos, visitedPath, hintPath, warpFlash }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const size = stage.size;
  const totalPx = boardPx(size);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, totalPx, totalPx);

    ctx.fillStyle = WALL_COLOR;
    ctx.fillRect(0, 0, totalPx, totalPx);

    const cx0 = (c: number) => WALL + c * (CELL + WALL);
    const cy0 = (r: number) => WALL + r * (CELL + WALL);
    const inPath = (path: Position[] | null, r: number, c: number) =>
      path !== null && path.some(([pr, pc]) => pr === r && pc === c);

    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        const x = cx0(c);
        const y = cy0(r);
        const cell = stage.grid[r][c];

        const inVisited = inPath(visitedPath, r, c);
        const inHint = inPath(hintPath, r, c);
        const flash = warpFlash !== null && samePos(warpFlash, [r, c]);
        const isPlayer = samePos(pos, [r, c]);

        ctx.fillStyle = flash ? FLASH_COLOR : inHint ? HINT_COLOR : inVisited ? VISITED_COLOR : FLOOR_COLOR;
        ctx.fillRect(x, y, CELL, CELL);

        // 開通している壁の隙間を床色で塗る(隣接マスと状態が揃うときは強調色を引き継ぐ)
        if (cell.e && c + 1 < size) {
          const rightVisited = inPath(visitedPath, r, c + 1);
          const rightHint = inPath(hintPath, r, c + 1);
          ctx.fillStyle =
            inVisited && rightVisited ? VISITED_COLOR : inHint && rightHint ? HINT_COLOR : FLOOR_COLOR;
          ctx.fillRect(x + CELL, y, WALL, CELL);
        }
        if (cell.s && r + 1 < size) {
          const belowVisited = inPath(visitedPath, r + 1, c);
          const belowHint = inPath(hintPath, r + 1, c);
          ctx.fillStyle =
            inVisited && belowVisited ? VISITED_COLOR : inHint && belowHint ? HINT_COLOR : FLOOR_COLOR;
          ctx.fillRect(x, y + CELL, CELL, WALL);
        }

        if (inVisited && !isPlayer) {
          ctx.fillStyle = "#383838";
          ctx.beginPath();
          ctx.arc(x + CELL / 2, y + CELL / 2, 3, 0, Math.PI * 2);
          ctx.fill();
        }

        if (inHint && !isPlayer) {
          ctx.strokeStyle = "#1E5050";
          ctx.lineWidth = 1;
          ctx.strokeRect(x + 9, y + 9, CELL - 18, CELL - 18);
        }

        const isGoal = samePos(stage.goal, [r, c]);
        if (isGoal) {
          ctx.strokeStyle = "#FFD700";
          ctx.lineWidth = 2;
          ctx.strokeRect(x + 10, y + 10, CELL - 20, CELL - 20);
          ctx.fillStyle = "#FFD70022";
          ctx.fillRect(x + 10, y + 10, CELL - 20, CELL - 20);
          ctx.fillStyle = "#FFD70099";
          ctx.font = "bold 8px 'Courier New'";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText("GOAL", x + CELL / 2, y + CELL / 2);
        }

        if (samePos(stage.start, [r, c]) && !isPlayer) {
          ctx.fillStyle = "#3A3A3A";
          ctx.font = "8px 'Courier New'";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText("START", x + CELL / 2, y + CELL / 2);
        }

        const cpIdx = stage.checkpoints.findIndex((cp) => cp.row === r && cp.col === c);
        if (cpIdx >= 0) {
          ctx.strokeStyle = "#4ECDC4";
          ctx.lineWidth = 1.5;
          ctx.strokeRect(x + 10, y + 10, CELL - 20, CELL - 20);
          ctx.fillStyle = "#4ECDC4";
          ctx.font = "bold 8px 'Courier New'";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(`CP${cpIdx + 1}`, x + CELL / 2, y + CELL / 2);
        }

        if (stage.warps.some((w) => samePos(w.from, [r, c]))) {
          const rad = CELL / 2 - 10;
          ctx.strokeStyle = "#A78BFA";
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(x + CELL / 2, y + CELL / 2, rad, 0, Math.PI * 2);
          ctx.stroke();
          ctx.fillStyle = "#A78BFA";
          ctx.font = "bold 9px 'Courier New'";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText("W", x + CELL / 2, y + CELL / 2);
        }

        if (stage.warps.some((w) => samePos(w.to, [r, c])) && !isGoal) {
          const rad = CELL / 2 - 10;
          ctx.strokeStyle = "#A78BFA55";
          ctx.lineWidth = 1;
          ctx.setLineDash([3, 3]);
          ctx.beginPath();
          ctx.arc(x + CELL / 2, y + CELL / 2, rad, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);
        }

        // 2倍マス: 菱形マーカー + "×2" 表示(CP・WARP・GOALと区別できるアンバー系)
        if (stage.heavyCells.some((h) => samePos(h, [r, c]))) {
          const cx = x + CELL / 2;
          const cy = y + CELL / 2;
          const half = CELL / 2 - 10;
          ctx.strokeStyle = HEAVY_COLOR;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(cx, cy - half);
          ctx.lineTo(cx + half, cy);
          ctx.lineTo(cx, cy + half);
          ctx.lineTo(cx - half, cy);
          ctx.closePath();
          ctx.stroke();
          ctx.fillStyle = HEAVY_COLOR;
          ctx.font = "bold 8px 'Courier New'";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText("×2", cx, cy);
        }
      }
    }

    // プレイヤー
    const [pr, pc] = pos;
    const px = cx0(pc);
    const py = cy0(pr);
    const hw = 10;
    ctx.fillStyle = "#E8E8E8";
    ctx.fillRect(px + CELL / 2 - hw, py + CELL / 2 - hw, hw * 2, hw * 2);
  }, [stage, pos, visitedPath, hintPath, warpFlash, size, totalPx]);

  return <canvas ref={ref} width={totalPx} height={totalPx} className="maze-canvas" />;
}
