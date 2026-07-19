import { samePos } from "./types";
import type { Checkpoint, Direction, Grid, Position, Warp } from "./types";

const DIRS: { dr: number; dc: number; key: Direction }[] = [
  { dr: -1, dc: 0, key: "n" },
  { dr: 1, dc: 0, key: "s" },
  { dr: 0, dc: 1, key: "e" },
  { dr: 0, dc: -1, key: "w" },
];

/**
 * BFS で from→to の最短経路を返す(経路は from を含む座標列)。
 * ワープ元マスに踏み込むと着地点はワープ先になる。到達不能なら null。
 */
export function findPath(
  grid: Grid,
  size: number,
  from: Position,
  to: Position,
  warps: Warp[] = [],
): Position[] | null {
  const queue: [Position, Position[]][] = [[from, [from]]];
  const visited = new Set([`${from[0]},${from[1]}`]);

  while (queue.length > 0) {
    const [pos, path] = queue.shift()!;
    if (samePos(pos, to)) return path;
    const [r, c] = pos;
    for (const { dr, dc, key } of DIRS) {
      if (!grid[r][c][key]) continue;
      let nr = r + dr;
      let nc = c + dc;
      const warp = warps.find((w) => w.from[0] === nr && w.from[1] === nc);
      if (warp) [nr, nc] = warp.to;
      if (nr < 0 || nr >= size || nc < 0 || nc >= size) continue;
      const k = `${nr},${nc}`;
      if (visited.has(k)) continue;
      visited.add(k);
      queue.push([[nr, nc], [...path, [nr, nc]]]);
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
 * 全チェックポイントを経由して goal へ向かう最短経路を返す。
 * チェックポイントの通過順は総当たりで最短を選ぶ(数が少ない前提)。
 */
export function findRouteThrough(
  grid: Grid,
  size: number,
  from: Position,
  goal: Position,
  checkpoints: Checkpoint[],
  warps: Warp[] = [],
): Position[] | null {
  if (checkpoints.length === 0) return findPath(grid, size, from, goal, warps);

  let best: Position[] | null = null;
  for (const order of permutations(checkpoints)) {
    const waypoints: Position[] = [
      ...order.map((cp): Position => [cp.row, cp.col]),
      goal,
    ];
    let route: Position[] = [from];
    let current: Position = from;
    let reachable = true;
    for (const waypoint of waypoints) {
      const segment = findPath(grid, size, current, waypoint, warps);
      if (!segment) {
        reachable = false;
        break;
      }
      route = route.concat(segment.slice(1));
      current = waypoint;
    }
    if (reachable && (best === null || route.length < best.length)) {
      best = route;
    }
  }
  return best;
}
