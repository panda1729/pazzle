/** 固定シードで再現可能な擬似乱数生成器(LCG)を返す */
export function createRng(seed: number): () => number {
  let s = seed || 12345;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

/** Fisher-Yates シャッフル(破壊的) */
export function shuffle<T>(arr: T[], rand: () => number): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
