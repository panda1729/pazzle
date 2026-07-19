import type { Checkpoint } from "../game/types";

interface Props {
  checkpoints: Checkpoint[];
  cpDone: boolean[];
}

export function CheckpointList({ checkpoints, cpDone }: Props) {
  if (checkpoints.length === 0) return null;
  return (
    <div className="cp-list">
      {checkpoints.map((_, i) => (
        <div key={i} className={`cp-item${cpDone[i] ? " is-done" : ""}`}>
          <div className="cp-dot" />
          CHECKPOINT {i + 1} {cpDone[i] ? "✓" : ""}
        </div>
      ))}
    </div>
  );
}
