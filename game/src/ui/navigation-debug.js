/**
 * ui/navigation-debug.js — a debug panel for the citizens' navigation.
 *
 * OWNER: UX.
 *
 * WHY THIS EXISTS
 *   V7 gave the citizens a grid A* pathfinder (`core/navigation.js`), and
 *   `findPath()` answers with numbers: the route, its cost, how many cells
 *   the search visited, and WHY it failed. None of that is visible. When a
 *   citizen walks into a warehouse, takes the long way round a hill or
 *   refuses to move at all, the developer sees only the SYMPTOM — a sprite
 *   behaving badly and no way to ask the city what happened.
 *
 * WHAT THIS IS
 *   Two halves, deliberately separated:
 *
 *     - `describeRoute()` — a PURE model of one pathfinder result. No DOM,
 *       no `three`, unit-tested in Node. It turns
 *       `{ok, path, cost, visited, reason}` into something a human can read:
 *       the reason in words, the cells, the world points, the length of the
 *       walk.
 *     - `createNavigationDebug()` — the service that owns the DOM panel and
 *       the route overlay, and knows nothing about the rules.
 *
 * THE OVERLAY IS OFF BY DEFAULT
 *   A debug overlay that is on costs a frame whether or not anyone is
 *   looking at it. This one costs NOTHING while it is off: no DOM reads, no
 *   projection, no re-render. Switching it on is cheap because it is a
 *   small panel of text, not a 3D overlay.
 *
 * NO `three`
 *   The UX domain imports `three` nowhere, and this module does not either.
 *   The route is drawn as a DOM/SVG overlay above the canvas.
 *
 * THE HONEST LIMIT ON THE PROJECTION
 *   The renderer's public API (`core/CONTRACT.md` §4) exposes `screenToGround`
 *   — screen to world — and NO world-to-screen projection. So this module
 *   projects the route ITSELF, from the camera matrices the renderer already
 *   exposes (`ctx.renderer.camera`), using the same NDC convention
 *   `screenToGround` uses. If no camera is available the overlay is skipped
 *   and the panel falls back to listing the route as cells: a truthful text
 *   panel beats a broken line.
 *
 * WHAT IT DOES NOT DO
 *   It does not run a search. It describes the result of one.
 */

import { CELL, GRID, PALETTE, cellToWorld } from '../core/config.js';

// --------------------------------------------------------------------------
// Constants
// --------------------------------------------------------------------------

/**
 * How many route cells are listed in the panel before it truncates.
 *
 * TBD: the publisher never published a debug-panel cell budget, so this is a
 * design value. A path may hold thousands of cells and the panel is a
 * debugging aid, not a spreadsheet — the SVG line still draws the WHOLE
 * route even when the list is cut short.
 */
export const MAX_CELLS_SHOWN = 64;

/**
 * How wide the panel is, in CSS pixels.
 *
 * TBD: a design value — the publisher never published a debug-panel size.
 */
const PANEL_WIDTH = 264;

/** The SVG namespace — SVG elements cannot be made with `createElement`. */
const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * The words for every reason `findPath()` can return.
 *
 * The table is exported so the integrator (and the tests) can see that the
 * coverage is complete: a reason the pathfinder grows tomorrow must get a
 * sentence here, or the fallback text will say so out loud.
 */
export const REASON_TEXT = Object.freeze({
  found: 'Route found — the citizen can walk this path.',
  trivial: 'Start and goal are the same cell — the citizen is already there.',
  'blocked-goal':
    'The goal cell is blocked (a building or water), so no citizen can stand on it.',
  unreachable:
    'The goal is walled off — buildings or water enclose it completely.',
  budget:
    'The search ran out of node budget before it reached the goal — this is the closest route it found.',
  'out-of-bounds':
    'The start or the goal lies outside the city grid.',
  'invalid-endpoint':
    'The start or the goal is not a usable cell coordinate.',
  'no-grid':
    'No navigation grid was given to the search, so no route could be looked for.',
  unknown:
    'No usable search result — the pathfinder reported nothing the panel could read.',
});

/** Every reason the panel knows about, in the order the pathfinder names them. */
export const PATH_REASONS = Object.freeze(Object.keys(REASON_TEXT));

// --------------------------------------------------------------------------
// The pure model
// --------------------------------------------------------------------------

/**
 * A number, or the fallback when the value is not one.
 *
 * @param {*} value
 * @param {number} fallback
 * @returns {number}
 */
function finiteNumber(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * A cell coordinate, or null when the value cannot be one.
 *
 * `null` and `undefined` are NOT zero: a path with a hole in it must not
 * silently become a route through cell (0, 0).
 *
 * @param {*} value
 * @returns {number|null}
 */
function cellNumber(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/**
 * The sentence for a search reason.
 *
 * @param {string} reason the reason `findPath()` reported
 * @param {object} [overrides] a map of reason -> text, merged over the built-in table
 * @returns {string} a human-readable explanation
 */
export function reasonTextFor(reason, overrides = null) {
  const key = typeof reason === 'string' ? reason.trim() : '';
  const table = overrides && typeof overrides === 'object'
    ? { ...REASON_TEXT, ...overrides }
    : REASON_TEXT;
  if (!key) return REASON_TEXT.unknown;
  if (typeof table[key] === 'string' && table[key]) return table[key];
  // An unknown reason is said out loud rather than hidden: a reason this
  // panel does not know is a sign the pathfinder grew a new one.
  return `Unknown search reason "${key}" — the pathfinder reported something this panel does not know.`;
}

/**
 * The empty model — what the panel shows when it has nothing to show.
 *
 * @param {string} [reason]
 * @returns {object} the model
 */
function emptyModel(reason = 'unknown') {
  return {
    ok: false,
    reason,
    reasonText: reasonTextFor(reason),
    cells: [],
    length: 0,
    cost: 0,
    visited: 0,
    points: [],
  };
}

/**
 * Describe one pathfinder result in a form a human can read.
 *
 * The model is PURE: no DOM, no `three`, no globals. It survives garbage —
 * `null`, a missing path, a path with a cell that is not a cell — and
 * returns the empty model rather than throwing, because a debug tool that
 * crashes while debugging is worse than no debug tool.
 *
 * @param {object} result a `findPath()` result: `{ok, path, cost, visited, reason}`
 * @param {object} [options]
 * @param {Function} [options.cellToWorld] (cx, cz) => `{x,y,z}`; defaults to `core/config.js`
 * @param {object} [options.reasonText] a map of reason -> text, merged over the built-in table
 * @returns {{ok:boolean, reason:string, reasonText:string, cells:Array<{x:number,z:number}>,
 *   length:number, cost:number, visited:number, points:Array<{x:number,y:number,z:number}>}}
 */
export function describeRoute(result, options = {}) {
  try {
    const opts = options && typeof options === 'object' ? options : {};
    const convert = typeof opts.cellToWorld === 'function' ? opts.cellToWorld : cellToWorld;
    const ok = !!result?.ok;
    const reason = typeof result?.reason === 'string' && result.reason.trim()
      ? result.reason.trim()
      : 'unknown';
    const cost = finiteNumber(result?.cost, 0);
    const visited = Math.max(0, finiteNumber(result?.visited, 0));

    const cells = [];
    const points = [];
    const rawPath = Array.isArray(result?.path) ? result.path : [];
    for (const cell of rawPath) {
      const cx = cellNumber(cell?.x);
      const cz = cellNumber(cell?.z);
      // A cell that is not a cell is DROPPED, not guessed at. The rest of
      // the route is still worth showing.
      if (cx === null || cz === null) continue;
      cells.push({ x: cx, z: cz });
      const p = convert(cx, cz);
      points.push({
        x: finiteNumber(p?.x, 0),
        y: finiteNumber(p?.y, 0),
        z: finiteNumber(p?.z, 0),
      });
    }

    // The length is the GEOMETRIC walk — the straight-line distance the
    // citizen covers. It is not the pathfinder's `cost`, which also carries
    // the slope and terrain multipliers; the panel shows both.
    let length = 0;
    for (let i = 1; i < points.length; i += 1) {
      const a = points[i - 1];
      const b = points[i];
      length += Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
    }

    return {
      ok,
      reason,
      reasonText: reasonTextFor(reason, opts.reasonText),
      cells,
      length,
      cost,
      visited,
      points,
    };
  } catch {
    // A description that throws is a description that hides the bug it was
    // asked to describe.
    return emptyModel();
  }
}

// --------------------------------------------------------------------------
// The projection
// --------------------------------------------------------------------------

/**
 * Multiply a point by a column-major 4x4 matrix, the way three.js does.
 *
 * @param {ArrayLike<number>} e the matrix elements (column-major)
 * @param {number} x
 * @param {number} y
 * @param {number} z
 * @returns {{x:number,y:number,z:number}}
 */
function applyMatrix4(e, x, y, z) {
  const w = e[3] * x + e[7] * y + e[11] * z + e[15];
  const inv = Math.abs(w) < 1e-12 ? 1 : 1 / w;
  return {
    x: (e[0] * x + e[4] * y + e[8] * z + e[12]) * inv,
    y: (e[1] * x + e[5] * y + e[9] * z + e[13]) * inv,
    z: (e[2] * x + e[6] * y + e[10] * z + e[14]) * inv,
  };
}

/**
 * Project a world point onto the canvas, in the canvas' own pixels.
 *
 * WHY THIS EXISTS AT ALL
 *   The renderer's public API has `screenToGround` (screen -> world) and no
 *   inverse, so a route in world space cannot be drawn on the canvas
 *   without projecting it. This does that from the camera matrices the
 *   renderer already exposes, using the same NDC convention `screenToGround`
 *   uses (`ndc.y` is flipped), so the line lands exactly where the city is.
 *
 * @param {{x:number,y?:number,z:number}} point a point in world space
 * @param {object} camera an object with `projectionMatrix.elements` and `matrixWorldInverse.elements`
 * @param {{left:number, top:number, width:number, height:number}} rect the canvas rectangle
 * @returns {{x:number,y:number}|null} canvas pixels, or null when the point cannot be projected
 */
export function projectWorldToScreen(point, camera, rect) {
  try {
    const proj = camera?.projectionMatrix?.elements;
    const view = camera?.matrixWorldInverse?.elements;
    if (!proj || !view || proj.length < 16 || view.length < 16) return null;

    const px = finiteNumber(point?.x, NaN);
    const py = finiteNumber(point?.y, 0);
    const pz = finiteNumber(point?.z, NaN);
    if (!Number.isFinite(px) || !Number.isFinite(pz)) return null;

    const width = finiteNumber(rect?.width, 0);
    const height = finiteNumber(rect?.height, 0);
    if (width <= 0 || height <= 0) return null;

    // world -> camera
    const v = applyMatrix4(view, px, py, pz);
    // camera -> clip. The raw w is kept so a point BEHIND the camera can be
    // refused instead of being drawn mirrored across the view.
    const cw = proj[3] * v.x + proj[7] * v.y + proj[11] * v.z + proj[15];
    if (!Number.isFinite(cw) || cw <= 1e-6) return null;
    const ndcX = (proj[0] * v.x + proj[4] * v.y + proj[8] * v.z + proj[12]) / cw;
    const ndcY = (proj[1] * v.x + proj[5] * v.y + proj[9] * v.z + proj[13]) / cw;
    if (!Number.isFinite(ndcX) || !Number.isFinite(ndcY)) return null;

    return {
      x: (ndcX * 0.5 + 0.5) * width,
      y: (-ndcY * 0.5 + 0.5) * height,
    };
  } catch {
    return null;
  }
}

// --------------------------------------------------------------------------
// The service
// --------------------------------------------------------------------------

/**
 * A CSS colour from the project's 16-bit palette.
 *
 * @param {number} hex
 * @returns {string}
 */
function cssColor(hex) {
  const n = Number(hex);
  if (!Number.isFinite(n)) return '#ffffff';
  return `#${Math.max(0, Math.min(0xffffff, Math.trunc(n))).toString(16).padStart(6, '0')}`;
}

/**
 * Create the navigation debug service.
 *
 * The service owns a small DOM panel and an SVG overlay. It is OFF until
 * `setEnabled(true)` is called, and it does no work at all while it is off.
 *
 * @param {object} ctx the shared context (uses `ctx.renderer` for the canvas and the camera)
 * @param {object} [deps]
 * @param {object} [deps.document] the document to build the panel in (default: the global one)
 * @param {object} [deps.mount] the element to mount the panel into (default: resolved from `ctx.ui`)
 * @param {Function} [deps.projectWorldToScreen] (worldPoint) => `{x,y}` in CANVAS pixels
 * @param {object} [deps.camera] a camera to project with (default: `ctx.renderer.camera`)
 * @param {object} [deps.reasonText] a map of reason -> text, merged over the built-in table
 * @param {number} [deps.maxCells] how many route cells the panel lists
 * @param {object} [deps.logger]
 * @returns {object} the service
 */
export function createNavigationDebug(ctx, deps = {}) {
  const logger = deps.logger ?? ctx?.logger ?? null;
  const doc = deps.document ?? (typeof document !== 'undefined' ? document : null);
  const renderer = ctx?.renderer ?? null;
  const maxCells = Number.isFinite(deps.maxCells) && deps.maxCells > 0
    ? Math.floor(deps.maxCells)
    : MAX_CELLS_SHOWN;

  let enabled = false;
  let route = null;
  let disposed = false;

  // --- the DOM ------------------------------------------------------------
  let panel = null;
  let overlay = null;
  let polyline = null;
  let body = null;
  let cellsBox = null;
  let note = null;
  let built = false;

  /**
   * Where the panel is mounted.
   *
   * The mount point is looked up rather than assumed, because the UI layer
   * owns its own roots and this module does not know their names. The
   * canvas' own parent is the last DOM fallback, so the panel always lands
   * somewhere visible.
   */
  function resolveMount() {
    if (deps.mount && typeof deps.mount.appendChild === 'function') return deps.mount;
    const ui = ctx?.ui ?? null;
    const candidates = [ui?.root, ui?.layer, ui?.overlay, ui?.hudRoot, ui?.panelRoot];
    for (const candidate of candidates) {
      if (candidate && typeof candidate.appendChild === 'function') return candidate;
    }
    const canvas = renderer?.renderer?.domElement ?? null;
    if (canvas?.parentElement) return canvas.parentElement;
    return doc?.body ?? null;
  }

  /** The canvas element, if the renderer has one. */
  function canvasElement() {
    return renderer?.renderer?.domElement ?? null;
  }

  /**
   * The canvas rectangle in viewport pixels.
   *
   * @returns {{left:number,top:number,width:number,height:number}|null}
   */
  function canvasRect() {
    const canvas = canvasElement();
    if (!canvas || typeof canvas.getBoundingClientRect !== 'function') return null;
    const rect = canvas.getBoundingClientRect();
    if (!rect || !(rect.width > 0) || !(rect.height > 0)) return null;
    return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
  }

  /**
   * Build the panel and the overlay. Done once, lazily.
   *
   * @returns {boolean} true when the DOM exists
   */
  function build() {
    if (built) return !!panel;
    built = true;
    if (!doc || typeof doc.createElement !== 'function') {
      // Headless (a Node test, or a page that never mounted): the service
      // still tracks the route, it just has nothing to draw it on.
      return false;
    }

    // --- the panel -------------------------------------------------------
    panel = doc.createElement('div');
    panel.className = 'scc-nav-debug';
    panel.setAttribute('aria-live', 'polite');
    const s = panel.style;
    s.position = 'fixed';
    s.top = '10px';
    s.left = '10px';
    s.width = `${PANEL_WIDTH}px`;
    s.maxWidth = 'calc(100vw - 20px)';
    s.boxSizing = 'border-box';
    s.padding = '8px 10px';
    s.background = 'rgba(13, 15, 28, 0.88)';
    s.border = `1px solid ${cssColor(PALETTE.slate)}`;
    s.borderRadius = '4px';
    s.color = cssColor(PALETTE.snow);
    s.font = '11px/1.45 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
    s.pointerEvents = 'auto';
    s.zIndex = '60';
    s.display = 'none';

    const title = doc.createElement('div');
    title.className = 'scc-nav-debug__title';
    title.textContent = `NAVIGATION DEBUG · ${GRID.size}×${GRID.size} grid`;
    title.style.color = cssColor(PALETTE.gold);
    title.style.fontWeight = 'bold';
    title.style.marginBottom = '4px';
    panel.appendChild(title);

    body = doc.createElement('div');
    body.className = 'scc-nav-debug__body';
    panel.appendChild(body);

    note = doc.createElement('div');
    note.className = 'scc-nav-debug__note';
    note.style.color = cssColor(PALETTE.mist);
    note.style.marginTop = '4px';
    note.style.whiteSpace = 'normal';
    panel.appendChild(note);

    cellsBox = doc.createElement('div');
    cellsBox.className = 'scc-nav-debug__cells';
    cellsBox.style.marginTop = '4px';
    cellsBox.style.maxHeight = '110px';
    cellsBox.style.overflow = 'auto';
    cellsBox.style.color = cssColor(PALETTE.mint);
    cellsBox.style.whiteSpace = 'normal';
    panel.appendChild(cellsBox);

    // --- the route overlay ------------------------------------------------
    if (typeof doc.createElementNS === 'function') {
      overlay = doc.createElementNS(SVG_NS, 'svg');
      overlay.className = 'scc-nav-debug__route';
      overlay.setAttribute('data-scc-nav-debug', 'route');
      const os = overlay.style;
      os.position = 'fixed';
      os.left = '0px';
      os.top = '0px';
      os.width = '0px';
      os.height = '0px';
      os.pointerEvents = 'none';
      os.zIndex = '50';
      os.display = 'none';
      os.overflow = 'visible';

      polyline = doc.createElementNS(SVG_NS, 'polyline');
      polyline.setAttribute('fill', 'none');
      polyline.setAttribute('stroke', cssColor(PALETTE.gold));
      polyline.setAttribute('stroke-width', '2');
      polyline.setAttribute('stroke-linejoin', 'round');
      polyline.setAttribute('stroke-linecap', 'round');
      overlay.appendChild(polyline);
    }

    const mount = resolveMount();
    if (!mount || typeof mount.appendChild !== 'function') {
      logger?.warn?.('the navigation debug panel has nowhere to mount');
      return false;
    }
    mount.appendChild(panel);
    if (overlay) mount.appendChild(overlay);
    return true;
  }

  /**
   * A label/value row in the panel.
   *
   * @param {string} label
   * @param {string} value
   */
  function addRow(label, value) {
    if (!body || !doc) return;
    const row = doc.createElement('div');
    row.className = 'scc-nav-debug__row';
    row.style.whiteSpace = 'normal';
    const key = doc.createElement('span');
    key.textContent = `${label}: `;
    key.style.color = cssColor(PALETTE.mist);
    const val = doc.createElement('span');
    val.textContent = value;
    val.style.color = route?.ok ? cssColor(PALETTE.mint) : cssColor(PALETTE.amber);
    row.appendChild(key);
    row.appendChild(val);
    body.appendChild(row);
  }

  /**
   * Redraw the panel from the current model.
   */
  function renderPanel() {
    if (!body || !doc) return;
    body.textContent = '';
    if (cellsBox) cellsBox.textContent = '';
    if (note) note.textContent = '';

    if (!route) {
      addRow('Result', 'no route');
      if (note) note.textContent = 'Call show(result) with a findPath() result.';
      return;
    }

    addRow('Result', route.ok ? 'route found' : 'no route');
    addRow('Reason', route.reasonText);
    addRow('Reason code', route.reason);
    addRow('Cost', route.cost.toFixed(2));
    addRow('Visited', `${route.visited} cells`);
    addRow('Route', `${route.cells.length} cells · ${route.length.toFixed(1)} world units`
      + ` (${(route.length / CELL).toFixed(1)} cells of walking)`);

    if (route.cells.length) {
      const first = route.cells[0];
      const last = route.cells[route.cells.length - 1];
      addRow('From', `(${first.x}, ${first.z})`);
      addRow('To', `(${last.x}, ${last.z})`);
    }

    if (!cellsBox) return;
    const shown = route.cells.slice(0, maxCells);
    for (const cell of shown) {
      const chip = doc.createElement('span');
      chip.textContent = `(${cell.x},${cell.z}) `;
      cellsBox.appendChild(chip);
    }
    if (route.cells.length > shown.length) {
      const more = doc.createElement('span');
      more.textContent = `… +${route.cells.length - shown.length} more`;
      more.style.color = cssColor(PALETTE.mist);
      cellsBox.appendChild(more);
    }
  }

  /**
   * The projector for this frame, or null when there is none.
   *
   * @param {{left:number,top:number,width:number,height:number}|null} rect
   * @returns {Function|null} (worldPoint) => `{x,y}` in canvas pixels
   */
  function resolveProjector(rect) {
    if (typeof deps.projectWorldToScreen === 'function') {
      return (p) => deps.projectWorldToScreen(p);
    }
    if (typeof renderer?.projectWorldToScreen === 'function') {
      return (p) => renderer.projectWorldToScreen(p);
    }
    // The renderer has no world-to-screen projection of its own, so the
    // camera matrices it already exposes are used instead.
    const camera = renderer?.camera ?? deps.camera ?? null;
    if (camera && rect) return (p) => projectWorldToScreen(p, camera, rect);
    return null;
  }

  /**
   * Put the overlay exactly over the canvas.
   *
   * The overlay is `position: fixed`, so it is placed against the VIEWPORT.
   * If the mount point sits inside a transformed ancestor, "fixed" resolves
   * against that ancestor instead and the line would float away from the
   * city — so the placement is measured and corrected.
   *
   * @returns {{left:number,top:number,width:number,height:number}|null}
   */
  function layoutOverlay() {
    const rect = canvasRect();
    if (!rect || !overlay) return rect;
    overlay.style.left = `${rect.left}px`;
    overlay.style.top = `${rect.top}px`;
    overlay.style.width = `${rect.width}px`;
    overlay.style.height = `${rect.height}px`;
    const own = typeof overlay.getBoundingClientRect === 'function'
      ? overlay.getBoundingClientRect()
      : null;
    if (own && (Math.abs(own.left - rect.left) > 0.5 || Math.abs(own.top - rect.top) > 0.5)) {
      overlay.style.left = `${rect.left - own.left}px`;
      overlay.style.top = `${rect.top - own.top}px`;
    }
    return rect;
  }

  /**
   * Draw the route on the overlay.
   *
   * @param {object} [rect] the canvas rectangle, if it has already been read
   * @returns {boolean} true when the route was drawn
   */
  function drawRoute(rect = null) {
    if (!polyline) return false;
    const frameRect = rect ?? layoutOverlay();
    const projector = resolveProjector(frameRect);
    if (!route || !route.points.length) {
      polyline.setAttribute('points', '');
      if (overlay) overlay.style.display = 'none';
      return false;
    }
    if (!projector) {
      // No projection: the panel's cell list is the route, and the panel
      // says so rather than pretending there is a line.
      if (note && !note.textContent) {
        note.textContent = 'No world-to-screen projection available — the route is listed as cells.';
      }
      polyline.setAttribute('points', '');
      if (overlay) overlay.style.display = 'none';
      return false;
    }

    const parts = [];
    let hidden = 0;
    for (const point of route.points) {
      const p = projector(point);
      if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) {
        // A point behind the camera cannot be drawn; it is counted so the
        // developer knows the line is incomplete.
        hidden += 1;
        continue;
      }
      parts.push(`${p.x.toFixed(1)},${p.y.toFixed(1)}`);
    }
    polyline.setAttribute('points', parts.join(' '));
    polyline.setAttribute('stroke', cssColor(route.ok ? PALETTE.gold : PALETTE.ember));
    if (overlay) overlay.style.display = parts.length ? 'block' : 'none';
    if (note) {
      note.textContent = hidden
        ? `${hidden} route point(s) could not be projected (behind the camera).`
        : '';
    }
    return parts.length > 0;
  }

  // --- the public surface --------------------------------------------------

  /**
   * A copy of the model, so a caller cannot corrupt the service's state by
   * editing what it was handed.
   *
   * @returns {object|null}
   */
  function copyModel() {
    if (!route) return null;
    return {
      ...route,
      cells: route.cells.map((c) => ({ ...c })),
      points: route.points.map((p) => ({ ...p })),
    };
  }

  return {
    /** True while the overlay is on. */
    enabled() { return enabled; },

    /**
     * Switch the overlay on or off.
     *
     * Switching ON is cheap: it builds a small panel of text, once, and
     * shows it. Switching OFF hides the panel — the route stays recorded so
     * it can be read again.
     *
     * @param {boolean} on
     * @returns {boolean} the new state
     */
    setEnabled(on) {
      if (disposed) return false;
      const next = !!on;
      if (next === enabled) return enabled;
      enabled = next;
      if (enabled) {
        build();
        if (panel) panel.style.display = 'block';
        if (overlay) overlay.style.display = 'none';
        renderPanel();
        drawRoute();
      } else {
        if (panel) panel.style.display = 'none';
        if (overlay) overlay.style.display = 'none';
      }
      return enabled;
    },

    /**
     * Record the latest pathfinder result and show it.
     *
     * @param {object} result a `findPath()` result
     * @returns {object} the model that was recorded
     */
    show(result) {
      if (disposed) return emptyModel();
      route = describeRoute(result, { reasonText: deps.reasonText });
      renderPanel();
      drawRoute();
      return route;
    },

    /** Forget the recorded route. */
    clear() {
      route = null;
      renderPanel();
      if (polyline) polyline.setAttribute('points', '');
      if (overlay) overlay.style.display = 'none';
    },

    /**
     * A snapshot of the service, not the live objects.
     *
     * @returns {{enabled:boolean, route:object|null}}
     */
    state() {
      return { enabled, route: copyModel() };
    },

    /**
     * Re-draw the route. Call once per frame, AFTER the renderer has drawn,
     * so the line sits on the frame the player is looking at.
     *
     * It does nothing at all while the overlay is off.
     */
    update() {
      if (!enabled || disposed) return;
      drawRoute(layoutOverlay());
    },

    /** The panel element, once it has been built. */
    get element() { return panel; },

    /** The SVG overlay element, once it has been built. */
    get overlay() { return overlay; },

    /** Remove the panel and the overlay. */
    dispose() {
      disposed = true;
      enabled = false;
      route = null;
      try { panel?.parentElement?.removeChild(panel); } catch { /* already gone */ }
      try { overlay?.parentElement?.removeChild(overlay); } catch { /* already gone */ }
      panel = null;
      overlay = null;
      polyline = null;
      body = null;
      cellsBox = null;
      note = null;
      built = false;
    },
  };
}
