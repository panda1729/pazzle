import { samePos } from "./types";
import type { Checkpoint, Direction, Grid, Position, Warp } from "./types";

const DIRS: { dr: number; dc: number; key: Direction }[] = [
  { dr: -1, dc: 0, key: "n" },
  { dr: 1, dc: 0, key: "s" },
  { dr: 0, dc: 1, key: "e" },
  { dr: 0, dc: -1, key: "w" },
];

/** path.slice(1) の各マスについて、heavy なら2、それ以外1として合計した移動コストを返す */
export function routeCost(path: Position[], heavyCells: Position[]): number {
  let cost = 0;
  for (const pos of path.slice(1)) {
    cost += heavyCells.some((h) => samePos(h, pos)) ? 2 : 1;
  }
  return cost;
}

/**
 * Dijkstra 法で from→to の最小コスト経路を返す(経路は from を含む座標列)。
 * ワープ元マスに踏み込むと着地点はワープ先になる(コスト判定は最終着地マスで行う)。
 * heavyCells に含まれるマスへの移動はコスト2、それ以外はコスト1。
 * グリッドは高々100x100なので、優先度付きキューは配列ソートによる素朴な実装で十分。
 * 到達不能なら null。
 */
export function findPath(
  grid: Grid,
  size: number,
  from: Position,
  to: Position,
  warps: Warp[] = [],
  heavyCells: Position[] = [],
): Position[] | null {
  const posKey = (pos: Position) => `${pos[0]},${pos[1]}`;
  const weightOf = (pos: Position) => (heavyCells.some((h) => samePos(h, pos)) ? 2 : 1);

  const bestCost = new Map<string, number>([[posKey(from), 0]]);
  const bestPath = new Map<string, Position[]>([[posKey(from), [from]]]);
  const settled = new Set<string>();
  const queue: { pos: Position; cost: number }[] = [{ pos: from, cost: 0 }];

  while (queue.length > 0) {
    queue.sort((a, b) => a.cost - b.cost);
    const { pos, cost } = queue.shift()!;
    const k = posKey(pos);
    if (settled.has(k)) continue;
    settled.add(k);
    if (samePos(pos, to)) return bestPath.get(k)!;

    const [r, c] = pos;
    for (const { dr, dc, key } of DIRS) {
      if (!grid[r][c][key]) continue;
      let nr = r + dr;
      let nc = c + dc;
      const warp = warps.find((w) => w.from[0] === nr && w.from[1] === nc);
      if (warp) [nr, nc] = warp.to;
      if (nr < 0 || nr >= size || nc < 0 || nc >= size) continue;
      const npos: Position = [nr, nc];
      const nk = posKey(npos);
      if (settled.has(nk)) continue;
      const newCost = cost + weightOf(npos);
      if (bestCost.has(nk) && bestCost.get(nk)! <= newCost) continue;
      bestCost.set(nk, newCost);
      bestPath.set(nk, [...bestPath.get(k)!, npos]);
      queue.push({ pos: npos, cost: newCost });
    }
  }
  return null;
}

function permutations<T>(items: T[]): T[][] {
  if (items.length <= 1) return [items];
  const result: T[][] = [];
  items.forEach((item, i) => {
    const rest = [...items.slice(0, i), ...items.slice(i + 1)];
    for (const p of permutations(rest)) result.push([item, ...p]);
  });
  return result;
}

/**
 * 全チェックポイントを経由して goal へ向かう最小コスト経路を返す。
 * チェックポイントの通過順は総当たりで、総移動コストが最小のものを選ぶ(数が少ない前提)。
 */
export function findRouteThrough(
  grid: Grid,
  size: number,
  from: Position,
  goal: Position,
  checkpoints: Checkpoint[],
  warps: Warp[] = [],
  heavyCells: Position[] = [],
): Position[] | null {
  if (checkpoints.length === 0) return findPath(grid, size, from, goal, warps, heavyCells);

  let best: Position[] | null = null;
  let bestCost = Infinity;
  for (const order of permutations(checkpoints)) {
    const waypoints: Position[] = [
      ...order.map((cp): Position => [cp.row, cp.col]),
      goal,
    ];
    let route: Position[] = [from];
    let current: Position = from;
    let reachable = true;
    for (const waypoint of waypoints) {
      const segment = findPath(grid, size, current, waypoint, warps, heavyCells);
      if (!segment) {
        reachable = false;
        break;
      }
      route = route.concat(segment.slice(1));
      current = waypoint;
    }
    if (reachable) {
      const cost = routeCost(route, heavyCells);
      if (cost < bestCost) {
        best = route;
        bestCost = cost;
      }
    }
  }
  return best;
}
