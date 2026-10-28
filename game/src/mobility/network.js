/**
 * MOB — pure road-network topology.
 *
 * No Three.js, no DOM, no sibling-domain imports: the network is a plain
 * graph of cells, so it is unit-testable in bare Node.
 *
 * TOPOLOGY DECISION (OQ-MOB-08)
 * ------------------------------
 * The dossier proposes a node/segment graph but publishes no representation.
 * This rebuild uses the VOXEL CELL as the node: every road cell is a node and
 * every orthogonal pair of neighbouring road cells is a segment. Two segments
 * are therefore connected exactly when they share a cell (FR-MOB-029), a
 * segment that terminates is a node of kind `end` (FR-MOB-030) and traffic
 * turns back there instead of vanishing.
 *
 * Node kinds: `isolated` (degree 0), `end` (degree 1), `straight` / `corner`
 * (degree 2), `tsplit` (degree 3), `junction` (degree 4+). The kinds are
 * unevidenced in the sources and are a rebuild decision.
 */

import { TUNING } from '../core/config.js';
import { cellKey as coreCellKey, parseCellKey as coreParseCellKey } from '../core/state.js';

/**
 * The road models, one per junction shape.
 *
 * Every key exists in `data/manifest.json` (family `citybits`). The
 * catalogue is data, not code, so a new shape ships as content (FR-MOB-017).
 */
export const ROAD_MODELS = Object.freeze({
  straight: 'road_straight',
  corner: 'road_corner',
  curvedCorner: 'road_corner_curved',
  tsplit: 'road_tsplit',
  junction: 'road_junction',
  crossing: 'road_straight_crossing',
});

/**
 * The road-type catalogue (FR-MOB-017/018).
 *
 * TBD: no source states a speed limit, a lane count or a per-lane capacity
 * (FR-MOB-021, OQ-MOB-04), so those fields are filled from the PUBLISHED
 * `TUNING` keys instead of from a guess: the traffic speed comes from
 * `TUNING.secondsPerCell` and the per-cell capacity from
 * `TUNING.vehiclesPerCell`. Proposed TUNING keys, if the publisher ever
 * documents them: `mobility.roadMaxSpeed`, `mobility.roadLaneCapacity`.
 */
export const ROAD_TYPES = Object.freeze({
  street: Object.freeze({
    id: 'street',
    displayName: 'Street',
    tier: 1,
    /** FR-MOB-026 — this tier grants building road connection. */
    grantsConnection: true,
    footprintCells: Object.freeze([1, 1]),
    directionMode: 'two-way',
    lanesPerDirection: 1,
    maxSpeedCellsPerSecond: 1 / Math.max(0.05, TUNING.secondsPerCell),
    laneCapacity: Math.max(1, TUNING.vehiclesPerCell),
    trackAcceptance: false,
    frontageAcceptance: true,
    bridgeTunnelEligible: true,
    /** TBD: can the road be laid over water? (FR-MOB-025, OQ-MOB-06). */
    layableOverWater: false,
    /**
     * Which corner tile this type draws: 'curved' uses the rounded
     * `road_corner_curved` tile, 'hard' the square `road_corner` one.
     *
     * TBD: the library ships BOTH corner tiles and no source says which one
     * a street uses; the choice could not be verified visually in this
     * environment. It is one data field, so it can be flipped without a code
     * change. Proposed TUNING key: `mobility.roadCornerStyle` ('curved').
     */
    cornerStyle: 'curved',
    models: ROAD_MODELS,
  }),
});

/**
 * The stable key of a cell.
 *
 * This is CORE's shared cell key (`cx * GRID.size + cz`) — the buildings
 * domain looks roads up with exactly this helper, so MOB must use it too or
 * `buildings/placement.js:roadAt` would never find a road.
 */
export function cellKey(cx, cz) {
  return coreCellKey(cx, cz);
}

/** The cell coordinates of a key. */
export function parseCellKey(key) {
  if (typeof key !== 'number' || !Number.isFinite(key)) return null;
  const parsed = coreParseCellKey(key);
  if (!parsed || !Number.isFinite(parsed.x) || !Number.isFinite(parsed.z)) return null;
  return parsed;
}

/**
 * Accepts a cell key or `{ x, z }` and returns a key.
 *
 * @returns {number|null} the key, or null when the input is not a cell
 */
export function toCellKey(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (value && Number.isFinite(Number(value.x)) && Number.isFinite(Number(value.z))) {
    return coreCellKey(Number(value.x), Number(value.z));
  }
  return null;
}

const DIRECTIONS = Object.freeze([
  Object.freeze({ dx: 1, dz: 0 }),
  Object.freeze({ dx: -1, dz: 0 }),
  Object.freeze({ dx: 0, dz: 1 }),
  Object.freeze({ dx: 0, dz: -1 }),
]);

function isStraight(node, nodes) {
  if (node.degree !== 2) return false;
  const [a, b] = node.neighbors;
  const na = nodes.get(a);
  const nb = nodes.get(b);
  if (!na || !nb) return false;
  const sameAxis = (na.x === node.x && nb.x === node.x) || (na.z === node.z && nb.z === node.z);
  return sameAxis;
}

/**
 * Build the road graph from the road cells the player placed.
 *
 * @param {Array|Map|Set} roadCells `{ x, z }` cells, or a Map of road records
 * @returns {{
 *   nodes: Map<number, {key:number,x:number,z:number,neighbors:number[],degree:number,kind:string}>,
 *   edges: number,
 *   components: {id:number,cells:string[],size:number,nodes:Set<string>}[],
 *   componentOf: Map<number, number>,
 *   roadCount: number,
 *   isolated: number[],
 * }}
 */
export function buildNetwork(roadCells) {
  const nodes = new Map();

  const list = [];
  if (Array.isArray(roadCells)) list.push(...roadCells);
  else if (roadCells instanceof Map) list.push(...roadCells.values());
  else if (roadCells && typeof roadCells.forEach === 'function') list.push(...roadCells);

  for (const cell of list) {
    if (!cell) continue;
    const x = Number(cell.x);
    const z = Number(cell.z);
    if (!Number.isFinite(x) || !Number.isFinite(z)) continue;
    const key = cellKey(x, z);
    if (nodes.has(key)) continue;
    nodes.set(key, { key, x, z, neighbors: [], degree: 0, kind: 'end' });
  }

  let degreeSum = 0;
  for (const node of nodes.values()) {
    const neighbours = [];
    for (const dir of DIRECTIONS) {
      const key = cellKey(node.x + dir.dx, node.z + dir.dz);
      if (nodes.has(key)) neighbours.push(key);
    }
    node.neighbors = neighbours;
    node.degree = neighbours.length;
    degreeSum += neighbours.length;
  }
  const edges = degreeSum / 2;

  for (const node of nodes.values()) {
    if (node.degree === 0) node.kind = 'isolated';
    else if (node.degree === 1) node.kind = 'end';
    else if (node.degree === 2) node.kind = isStraight(node, nodes) ? 'straight' : 'corner';
    else if (node.degree === 3) node.kind = 'tsplit';
    else node.kind = 'junction';
  }

  const components = [];
  const componentOf = new Map();
  for (const start of nodes.keys()) {
    if (componentOf.has(start)) continue;
    const id = components.length;
    const cells = [];
    const stack = [start];
    componentOf.set(start, id);
    while (stack.length) {
      const current = stack.pop();
      cells.push(current);
      const node = nodes.get(current);
      if (!node) continue;
      for (const neighbour of node.neighbors) {
        if (componentOf.has(neighbour)) continue;
        componentOf.set(neighbour, id);
        stack.push(neighbour);
      }
    }
    components.push({ id, cells, size: cells.length, nodes: new Set(cells) });
  }

  const isolated = [];
  for (const node of nodes.values()) if (node.degree === 0) isolated.push(node.key);

  return { nodes, edges, components, componentOf, roadCount: nodes.size, isolated };
}

/**
 * The shortest path between two cells (BFS — every segment costs one).
 *
 * @param {object} network the graph from {@link buildNetwork}
 * @param {string|{x:number,z:number}} a
 * @param {string|{x:number,z:number}} b
 * @returns {number[]|null} the cell keys from `a` to `b` inclusive, or null
 */
export function routeBetween(network, a, b) {
  if (!network?.nodes) return null;
  const start = toCellKey(a);
  const end = toCellKey(b);
  if (start === null || end === null) return null;
  if (!network.nodes.has(start) || !network.nodes.has(end)) return null;
  if (start === end) return [start];

  const previous = new Map([[start, null]]);
  const queue = [start];

  for (let head = 0; head < queue.length; head += 1) {
    const current = queue[head];
    const node = network.nodes.get(current);
    if (!node) continue;
    for (const neighbour of node.neighbors) {
      if (previous.has(neighbour)) continue;
      previous.set(neighbour, current);
      if (neighbour === end) {
        const path = [];
        let cursor = end;
        while (cursor !== null && cursor !== undefined) {
          path.push(cursor);
          cursor = previous.get(cursor);
        }
        path.reverse();
        return path;
      }
      queue.push(neighbour);
    }
  }
  return null;
}

/** The number of segments on a path (a path of one cell has length 0). */
export function pathLength(path) {
  if (!Array.isArray(path)) return 0;
  return Math.max(0, path.length - 1);
}

/**
 * How well connected the network is: the share of road cells that sit in the
 * largest connected component.
 *
 * @param {object} network
 * @returns {number} 0..1 (0 when there are no roads)
 */
export function connectivityScore(network) {
  const total = network?.nodes?.size ?? 0;
  if (total === 0) return 0;
  let largest = 0;
  for (const component of network?.components ?? []) {
    if (component.size > largest) largest = component.size;
  }
  return largest / total;
}

/**
 * The shape of one network cell and the road model that draws it.
 *
 * @param {object} network
 * @param {number} key the cell key
 * @param {object} [type] a road-type record (defaults to `street`)
 * @returns {{shape:string, model:string, rotation:number, kind:string}}
 */
export function roadShapeFor(network, key, type = ROAD_TYPES.street) {
  const node = network?.nodes?.get(key);
  if (!node) {
    return { shape: 'straight', model: ROAD_MODELS.straight, rotation: 0, kind: 'straight' };
  }

  const origin = parseCellKey(node.key) ?? { x: node.x, z: node.z };
  const arms = [];
  for (const neighbourKey of node.neighbors ?? []) {
    const cell = parseCellKey(neighbourKey);
    if (!cell) continue;
    arms.push({ dx: cell.x - origin.x, dz: cell.z - origin.z });
  }

  let shape = 'straight';
  if (node.degree >= 5) shape = 'junction';
  else if (node.degree === 4) shape = 'crossing';
  else if (node.degree === 3) shape = 'tsplit';
  else if (node.degree === 2) {
    const [a, b] = arms;
    const straightOnX = a.dx !== 0 && b.dx !== 0;
    const straightOnZ = a.dz !== 0 && b.dz !== 0;
    if (straightOnX || straightOnZ) {
      shape = 'straight';
    } else {
      // A corner: the road type decides which corner tile is drawn.
      shape = (type?.cornerStyle ?? 'curved') === 'hard' ? 'corner' : 'curvedCorner';
    }
  }

  // The rotation is derived from the geometry: a straight segment faces its
  // neighbour, a corner faces the bisector of its two arms.
  // TBD: the canonical orientation of the library road models is not
  // published, so this may need a global offset. Proposed TUNING key:
  // `mobility.roadModelRotationOffset` (0).
  let rotation = 0;
  if (arms.length === 1) {
    rotation = Math.atan2(arms[0].dx, arms[0].dz);
  } else if (arms.length === 2) {
    const sumX = arms[0].dx + arms[1].dx;
    const sumZ = arms[0].dz + arms[1].dz;
    rotation = (sumX || sumZ) ? Math.atan2(sumX, sumZ) : 0;
  }

  return {
    shape,
    model: ROAD_MODELS[shape] ?? ROAD_MODELS.straight,
    rotation,
    kind: node.kind ?? 'straight',
  };
}

/** A readable summary of the network (the transport statistics panel). */
export function networkReport(network) {
  const total = network?.nodes?.size ?? 0;
  let largest = 0;
  for (const component of network?.components ?? []) {
    if (component.size > largest) largest = component.size;
  }
  return {
    roadCount: total,
    edges: network?.edges ?? 0,
    componentCount: network?.components?.length ?? 0,
    largestComponent: largest,
    connectivity: connectivityScore(network),
    isolatedCount: network?.isolated?.length ?? 0,
    isolated: (network?.isolated ?? []).slice(),
    networkLength: network?.edges ?? 0,
  };
}
