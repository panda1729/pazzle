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
          // id >= 100 は自動生成のデイリーチャレンジ(見た目で区別できるよう別クラスを付与)
          className={`stage-tab${stage.id >= 100 ? " is-daily" : ""}${
            i === currentIdx ? " is-active" : ""
          }`}
        >
          {stage.label}
        </button>
      ))}
    </div>
  );
}
