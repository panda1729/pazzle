export interface Rank {
  label: "S" | "A" | "B" | "C" | "F";
  color: string;
}

/**
 * 歩数からスコアを算出する。
 * par 以下で満点 1000、limit でほぼ 0 になるよう線形に減衰する。
 */
export function calcScore(steps: number, par: number, limit: number): number {
  if (steps > limit) return 0;
  if (steps <= par) return 1000;
  const ratio = 1 - (steps - par) / (limit - par);
  return Math.max(1, Math.round(ratio * 1000));
}

export function calcRank(score: number): Rank {
  if (score >= 1000) return { label: "S", color: "#FFD700" };
  if (score >= 700) return { label: "A", color: "#88CCFF" };
  if (score >= 400) return { label: "B", color: "#88DD99" };
  if (score > 0) return { label: "C", color: "#AAAAAA" };
  return { label: "F", color: "#FF6B6B" };
}
