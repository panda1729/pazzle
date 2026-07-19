interface Props {
  onMove: (dr: number, dc: number) => void;
}

export function DPad({ onMove }: Props) {
  return (
    <div className="dpad">
      <button onClick={() => onMove(-1, 0)} className="dpad-btn">▲</button>
      <div className="dpad-row">
        <button onClick={() => onMove(0, -1)} className="dpad-btn">◀</button>
        <button onClick={() => onMove(1, 0)} className="dpad-btn">▼</button>
        <button onClick={() => onMove(0, 1)} className="dpad-btn">▶</button>
      </div>
    </div>
  );
}
