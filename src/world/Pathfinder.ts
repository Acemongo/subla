// A* pathfinder for isometric grid navigation.
// Works on a boolean walkability grid (true = walkable).

export interface GridPos { col: number; row: number; }

interface Node {
  col: number; row: number;
  g: number; h: number; f: number;
  parent: Node | null;
}

function heuristic(a: GridPos, b: GridPos): number {
  // Chebyshev distance (allows diagonal movement)
  return Math.max(Math.abs(a.col - b.col), Math.abs(a.row - b.row));
}

function key(col: number, row: number): string {
  return `${col},${row}`;
}

/** 8-directional neighbours */
const DIRS = [
  { dc: -1, dr:  0 }, { dc:  1, dr:  0 },
  { dc:  0, dr: -1 }, { dc:  0, dr:  1 },
  { dc: -1, dr: -1 }, { dc:  1, dr: -1 },
  { dc: -1, dr:  1 }, { dc:  1, dr:  1 },
];

/**
 * Find a path from start to goal on a walkability grid.
 * Returns array of grid positions (not including start), or null if no path.
 */
export function findPath(
  walkable: boolean[][],
  start: GridPos,
  goal: GridPos,
): GridPos[] | null {
  const rows = walkable.length;
  const cols = walkable[0]?.length ?? 0;

  const inBounds = (c: number, r: number) => c >= 0 && r >= 0 && c < cols && r < rows;
  const isWalkable = (c: number, r: number) => inBounds(c, r) && walkable[r][c];

  if (!isWalkable(goal.col, goal.row)) return null;

  const open = new Map<string, Node>();
  const closed = new Set<string>();

  const startNode: Node = {
    col: start.col, row: start.row,
    g: 0, h: heuristic(start, goal), f: 0, parent: null,
  };
  startNode.f = startNode.g + startNode.h;
  open.set(key(start.col, start.row), startNode);

  while (open.size > 0) {
    // Pick lowest f
    let current: Node | null = null;
    for (const node of open.values()) {
      if (!current || node.f < current.f) current = node;
    }
    if (!current) break;

    if (current.col === goal.col && current.row === goal.row) {
      // Reconstruct path
      const path: GridPos[] = [];
      let n: Node | null = current;
      while (n && (n.col !== start.col || n.row !== start.row)) {
        path.unshift({ col: n.col, row: n.row });
        n = n.parent;
      }
      return path;
    }

    open.delete(key(current.col, current.row));
    closed.add(key(current.col, current.row));

    for (const { dc, dr } of DIRS) {
      const nc = current.col + dc;
      const nr = current.row + dr;
      const nk = key(nc, nr);
      if (!isWalkable(nc, nr) || closed.has(nk)) continue;

      // Diagonal movement blocked if both cardinal neighbours are solid
      if (dc !== 0 && dr !== 0) {
        if (!isWalkable(current.col + dc, current.row) &&
            !isWalkable(current.col, current.row + dr)) continue;
      }

      const g = current.g + (dc !== 0 && dr !== 0 ? 1.414 : 1);
      const existing = open.get(nk);
      if (existing && g >= existing.g) continue;

      const node: Node = {
        col: nc, row: nr,
        g, h: heuristic({ col: nc, row: nr }, goal),
        f: 0, parent: current,
      };
      node.f = node.g + node.h;
      open.set(nk, node);
    }

    // Safety: bail out if search is too large
    if (closed.size > 2000) break;
  }

  return null;
}
