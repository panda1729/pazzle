import type { Stage } from "../game/types";

interface Props {
  stages: Stage[];
  currentIdx: number;
  onSelect: (idx: number) => void;
}

export function StageTabs({ stages, currentIdx, onSelect }: Props) {
  return (
    <div className="stage-tabs">
      {stages.map((stage, i) => (
        <button
          key={stage.id}
          onClick={() => onSelect(i)}
          className={`stage-tab${i === currentIdx ? " is-active" : ""}`}
        >
          {stage.label}
        </button>
      ))}
    </div>
  );
}
