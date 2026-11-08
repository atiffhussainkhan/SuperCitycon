/**
 * V4 — Navigation grid and A* pathfinding.
 *
 * The NPC system navigates on a uniform 2D grid in the XZ plane. The grid is
 * explicit data rather than something derived from the render scene, so the AI
 * can run — and be tested — with no renderer, no GPU and no DOM.
 *
 * Rules:
 *   - diagonal movement is allowed, but corner-cutting is NOT: a step from
 *     (x,z) to (x+1,z+1) is only legal when (x+1,z) and (x,z+1) are both free,
 *     otherwise an NPC would clip through the corner of a wall,
 *   - the open list is a binary heap, so the frontier costs O(log V) per push,
 *   - the search has a hard budget of expanded nodes, so a hopeless query can
 *     never stall a frame,
 *   - a smoothing pass removes redundant waypoints (string pulling) using a
 *     grid-aware line-of-sight test that honours the same corner rule.
 *
 * The grid is indexed `cx` along X and `cz` along Z. `origin` is the world
 * position of the CENTRE of cell (0,0); cell (cx,cz) spans
 * `origin + (cx ± 0.5, cz ± 0.5) * cellSize`.
 */

const SQRT2 = Math.SQRT2;

/** Binary min-heap keyed by an f-score. */
class MinHeap {
  constructor() {
    /** @type {{index:number, f:number}[]} */
    this.items = [];
  }

  get size() { return this.items.length; }

  push(index, f) {
    const items = this.items;
    items.push({ index, f });
    let i = items.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (items[parent].f <= items[i].f) break;
      const tmp = items[parent]; items[parent] = items[i]; items[i] = tmp;
      i = parent;
    }
  }

  pop() {
    const items = this.items;
    if (items.length === 0) return null;
    const top = items[0];
    const last = items.pop();
    if (items.length > 0) {
      items[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let smallest = i;
        if (l < items.length && items[l].f < items[smallest].f) smallest = l;
        if (r < items.length && items[r].f < items[smallest].f) smallest = r;
        if (smallest === i) break;
        const tmp = items[smallest]; items[smallest] = items[i]; items[i] = tmp;
        i = smallest;
      }
    }
    return top;
  }
}

/**
 * Create a navigation grid.
 *
 * @param {object} opts
 * @param {[number,number]|number} [opts.size]      grid size in cells ([nx,nz] or n)
 * @param {number} [opts.cellSize]                   world units per cell
 * @param {[number,number]} [opts.origin]            world position of cell (0,0)'s centre
 * @param {Function|Array|null} [opts.blocked]      (worldX,worldZ)=>bool, or [[cx,cz],...]
 */
export function createNavGrid({ size = [64, 64], cellSize = 1, origin = [-32, -32], blocked = null } = {}) {
  const nx = Array.isArray(size) ? Math.max(1, Math.floor(size[0])) : Math.max(1, Math.floor(size));
  const nz = Array.isArray(size) ? Math.max(1, Math.floor(size[1])) : nx;
  const cs = cellSize > 0 ? cellSize : 1;
  const ox = origin[0] ?? 0;
  const oz = origin[1] ?? 0;

  /** 1 = blocked, 0 = free. */
  const cells = new Uint8Array(nx * nz);

  function index(cx, cz) { return cz * nx + cx; }

  const grid = {
    size: { nx, nz },
    cellSize: cs,
    origin: [ox, oz],

    /** World position of a cell's centre. */
    cellToWorld(cx, cz) {
      return { x: ox + cx * cs, z: oz + cz * cs };
    },

    /** The cell containing a world position. May be out of bounds. */
    worldToCell(x, z) {
      return {
        cx: Math.floor((x - ox) / cs + 0.5),
        cz: Math.floor((z - oz) / cs + 0.5),
      };
    },

    inBounds(cx, cz) {
      return cx >= 0 && cz >= 0 && cx < nx && cz < nz;
    },

    isBlocked(cx, cz) {
      if (!grid.inBounds(cx, cz)) return true;
      return cells[index(cx, cz)] === 1;
    },

    /** Free means: inside the grid and not blocked. */
    walkable(cx, cz) {
      return !grid.isBlocked(cx, cz);
    },

    setBlocked(cx, cz, value = true) {
      if (!grid.inBounds(cx, cz)) return false;
      cells[index(cx, cz)] = value ? 1 : 0;
      return true;
    },

    /** Block every cell whose centre falls inside the world-space rectangle. */
    blockRect(minX, minZ, maxX, maxZ) {
      let blockedCount = 0;
      for (let cz = 0; cz < nz; cz += 1) {
        for (let cx = 0; cx < nx; cx += 1) {
          if (cells[index(cx, cz)] === 1) continue;
          const w = grid.cellToWorld(cx, cz);
          if (w.x >= minX && w.x <= maxX && w.z >= minZ && w.z <= maxZ) {
            cells[index(cx, cz)] = 1;
            blockedCount += 1;
          }
        }
      }
      return blockedCount;
    },

    /** Block a circle of cells around a world position. */
    blockCircle(centerX, centerZ, radius) {
      let blockedCount = 0;
      const r2 = radius * radius;
      for (let cz = 0; cz < nz; cz += 1) {
        for (let cx = 0; cx < nx; cx += 1) {
          if (cells[index(cx, cz)] === 1) continue;
          const w = grid.cellToWorld(cx, cz);
          const dx = w.x - centerX;
          const dz = w.z - centerZ;
          if (dx * dx + dz * dz <= r2) {
            cells[index(cx, cz)] = 1;
            blockedCount += 1;
          }
        }
      }
      return blockedCount;
    },

    /**
     * The closest free cell to (cx,cz), searched in rings. Used so an NPC
     * that starts inside a blocked cell can still path.
     */
    findNearestWalkable(cx, cz, maxRadius = 12) {
      if (grid.walkable(cx, cz)) return { cx, cz };
      for (let r = 1; r <= maxRadius; r += 1) {
        for (let dz = -r; dz <= r; dz += 1) {
          for (let dx = -r; dx <= r; dx += 1) {
            if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
            const x = cx + dx;
            const z = cz + dz;
            if (grid.walkable(x, z)) return { cx: x, cz: z };
          }
        }
      }
      return null;
    },

    /** A copy of the grid with the same layout and blocked cells. */
    clone() {
      const copy = createNavGrid({ size: [nx, nz], cellSize: cs, origin: [ox, oz] });
      for (let i = 0; i < cells.length; i += 1) copy._setRaw(i, cells[i]);
      return copy;
    },

    _setRaw(i, value) { cells[i] = value; },

    /** Raw blocked flags, row-major — handy for tests and the editor. */
    raw() { return Array.from(cells); },

    /** Number of blocked cells. */
    blockedCount() {
      let n = 0;
      for (let i = 0; i < cells.length; i += 1) if (cells[i] === 1) n += 1;
      return n;
    },
  };

  // Initial blocked set.
  if (typeof blocked === 'function') {
    for (let cz = 0; cz < nz; cz += 1) {
      for (let cx = 0; cx < nx; cx += 1) {
        const w = grid.cellToWorld(cx, cz);
        if (blocked(w.x, w.z)) cells[index(cx, cz)] = 1;
      }
    }
  } else if (Array.isArray(blocked)) {
    for (const entry of blocked) {
      if (!entry) continue;
      const cx = entry[0];
      const cz = entry[1];
      if (grid.inBounds(cx, cz)) cells[index(cx, cz)] = 1;
    }
  }

  return grid;
}

/** Normalise a start/goal argument into a cell coordinate. */
function toCell(grid, point) {
  if (!point) return null;
  if (typeof point.cx === 'number' && typeof point.cz === 'number') {
    return { cx: Math.floor(point.cx), cz: Math.floor(point.cz) };
  }
  const x = point.x ?? point[0] ?? 0;
  const z = point.z ?? point[1] ?? 0;
  return grid.worldToCell(x, z);
}

/** Octile distance — the admissible heuristic for 8-way movement. */
function octile(ax, az, bx, bz, cellSize) {
  const dx = Math.abs(ax - bx);
  const dz = Math.abs(az - bz);
  const lo = Math.min(dx, dz);
  const hi = Math.max(dx, dz);
  return (hi - lo + SQRT2 * lo) * cellSize;
}

/**
 * Grid-aware line of sight between two world points.
 *
 * Walks the cells the segment passes through (DDA). A diagonal cell change
 * requires both orthogonal neighbours to be free, so the test agrees with the
 * pathfinder's no-corner-cutting rule.
 */
export function lineOfSight(grid, ax, az, bx, bz) {
  const cs = grid.cellSize;
  const ox = grid.origin[0];
  const oz = grid.origin[1];

  let cx = Math.floor((ax - ox) / cs + 0.5);
  let cz = Math.floor((az - oz) / cs + 0.5);
  const ex = Math.floor((bx - ox) / cs + 0.5);
  const ez = Math.floor((bz - oz) / cs + 0.5);

  if (!grid.walkable(cx, cz)) return false;

  const dx = bx - ax;
  const dz = bz - az;
  const stepX = dx > 0 ? 1 : dx < 0 ? -1 : 0;
  const stepZ = dz > 0 ? 1 : dz < 0 ? -1 : 0;

  let tMaxX = stepX === 0 ? Infinity
    : (((cx + (stepX > 0 ? 0.5 : -0.5)) * cs + ox) - ax) / dx;
  let tMaxZ = stepZ === 0 ? Infinity
    : (((cz + (stepZ > 0 ? 0.5 : -0.5)) * cs + oz) - az) / dz;
  const tDeltaX = stepX === 0 ? Infinity : Math.abs(cs / dx);
  const tDeltaZ = stepZ === 0 ? Infinity : Math.abs(cs / dz);

  let guard = grid.size.nx + grid.size.nz + 4;
  while ((cx !== ex || cz !== ez) && guard > 0) {
    guard -= 1;
    if (tMaxX < tMaxZ) {
      cx += stepX;
      tMaxX += tDeltaX;
    } else if (tMaxZ < tMaxX) {
      cz += stepZ;
      tMaxZ += tDeltaZ;
    } else {
      // Exactly through a corner: both side cells must be free.
      if (!grid.walkable(cx + stepX, cz) || !grid.walkable(cx, cz + stepZ)) return false;
      cx += stepX;
      cz += stepZ;
      tMaxX += tDeltaX;
      tMaxZ += tDeltaZ;
    }
    if (!grid.walkable(cx, cz)) return false;
  }
  return cx === ex && cz === ez;
}

/**
 * Remove redundant waypoints from a cell path (string pulling).
 *
 * Returns WORLD-space waypoints. The first waypoint is the cell the path
 * starts in, so callers usually drop it when the agent is already there.
 */
export function smoothPath(grid, cells, { start = null } = {}) {
  if (!Array.isArray(cells) || cells.length === 0) return [];
  const pts = cells.map((c) => grid.cellToWorld(c.cx, c.cz));
  if (start) pts[0] = { x: start.x, z: start.z };
  // A single-cell path (the agent is already there) still yields one
  // waypoint, so "path found" always means "there is a waypoint to walk to".
  if (pts.length === 1) return [pts[0]];

  const out = [];
  let anchor = pts[0];
  let i = 1;
  while (i < pts.length) {
    let best = i;
    for (let j = pts.length - 1; j > i; j -= 1) {
      if (lineOfSight(grid, anchor.x, anchor.z, pts[j].x, pts[j].z)) { best = j; break; }
    }
    out.push(pts[best]);
    if (best >= pts.length - 1) break;
    anchor = pts[best];
    i = best + 1;
  }
  return out;
}

/**
 * A* over the grid.
 *
 * @param {object} grid
 * @param {{x:number,z:number}|{cx:number,cz:number}} start
 * @param {{x:number,z:number}|{cx:number,cz:number}} goal
 * @param {object} [options]
 * @param {number} [options.maxExpanded]  hard budget of expanded nodes
 * @param {boolean} [options.allowDiagonal]
 * @returns {{cx:number,cz:number}[]|null} the cell path (start..goal) or null
 */
export function findPath(grid, start, goal, options = {}) {
  const detail = findPathDetailed(grid, start, goal, options);
  return detail.found ? detail.cells : null;
}

/**
 * A* with diagnostics. Same search as {@link findPath}, plus the number of
 * expanded nodes and the reason a search failed (for the NPC debug overlay).
 */
export function findPathDetailed(grid, start, goal, options = {}) {
  const {
    maxExpanded = 8000,
    allowDiagonal = true,
  } = options;

  const empty = { found: false, cells: [], expanded: 0, reason: 'invalid' };
  if (!grid || !start || !goal) return empty;

  const { nx, nz } = grid.size;
  const total = nx * nz;
  const cs = grid.cellSize;

  let s = toCell(grid, start);
  let g = toCell(grid, goal);
  if (!s || !g) return empty;

  if (!grid.walkable(s.cx, s.cz)) {
    const alt = grid.findNearestWalkable(s.cx, s.cz);
    if (!alt) return { ...empty, reason: 'start-blocked' };
    s = alt;
  }
  if (!grid.walkable(g.cx, g.cz)) {
    const alt = grid.findNearestWalkable(g.cx, g.cz);
    if (!alt) return { ...empty, reason: 'goal-blocked' };
    g = alt;
  }

  const startIndex = s.cz * nx + s.cx;
  const goalIndex = g.cz * nx + g.cx;

  const gScore = new Float64Array(total).fill(Infinity);
  const cameFrom = new Int32Array(total).fill(-1);
  const closed = new Uint8Array(total);

  const open = new MinHeap();
  gScore[startIndex] = 0;
  open.push(startIndex, octile(s.cx, s.cz, g.cx, g.cz, cs));

  const neighbours = allowDiagonal
    ? [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1],
      [1, 1, SQRT2], [1, -1, SQRT2], [-1, 1, SQRT2], [-1, -1, SQRT2]]
    : [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1]];

  let expanded = 0;

  while (open.size > 0) {
    const current = open.pop();
    if (!current) break;
    const ci = current.index;
    if (closed[ci]) continue;
    closed[ci] = 1;
    expanded += 1;

    if (ci === goalIndex) {
      const cells = [];
      let node = ci;
      while (node !== -1) {
        cells.push({ cx: node % nx, cz: Math.floor(node / nx) });
        node = cameFrom[node];
      }
      cells.reverse();
      return { found: true, cells, expanded, reason: 'ok' };
    }

    if (expanded >= maxExpanded) {
      return { found: false, cells: [], expanded, reason: 'budget-exceeded' };
    }

    const cx = ci % nx;
    const cz = Math.floor(ci / nx);

    for (const [dx, dz, cost] of neighbours) {
      const ncx = cx + dx;
      const ncz = cz + dz;
      if (!grid.inBounds(ncx, ncz)) continue;
      if (grid.isBlocked(ncx, ncz)) continue;
      if (dx !== 0 && dz !== 0) {
        // No corner cutting: both orthogonal neighbours must be free.
        if (grid.isBlocked(cx + dx, cz) || grid.isBlocked(cx, cz + dz)) continue;
      }
      const ni = ncz * nx + ncx;
      if (closed[ni]) continue;
      const tentative = gScore[ci] + cost * cs;
      if (tentative < gScore[ni]) {
        gScore[ni] = tentative;
        cameFrom[ni] = ci;
        const f = tentative + octile(ncx, ncz, g.cx, g.cz, cs);
        open.push(ni, f);
      }
    }
  }

  return { found: false, cells: [], expanded, reason: 'unreachable' };
}
