interface Props {
  steps: number;
  par: number;
  limit: number;
  widthPx: number;
}

export function StatsPanel({ steps, par, limit, widthPx }: Props) {
  const remaining = limit - steps;
  const pct = Math.min(100, (steps / limit) * 100);
  const barColor = pct < 60 ? "#3A3A3A" : pct < 85 ? "#C8A000" : "#CC3333";

  return (
    <>
      <div className="stats-row" style={{ width: widthPx }}>
        {(
          [
            ["STEPS", steps, false],
            ["PAR", par, false],
            ["LEFT", remaining, remaining <= 3],
          ] as const
        ).map(([label, value, warn]) => (
          <div key={label} className="stat-box">
            <div className="stat-label">{label}</div>
            <div className={`stat-value${warn ? " is-warn" : ""}`}>{value}</div>
          </div>
        ))}
      </div>
      <div className="progress-track" style={{ width: widthPx }}>
        <div className="progress-bar" style={{ width: `${pct}%`, background: barColor }} />
      </div>
    </>
  );
}
