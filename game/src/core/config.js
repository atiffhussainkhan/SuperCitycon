/**
 * core/config.js — SuperCitycon global constants.
 *
 * Owned by the integrator (spine). Every domain module imports its constants
 * from here; no domain may redefine grid, palette or tuning values locally.
 *
 * HONESTY RULE (from the requirements dossier, pass-2 remediation):
 *   Any number the publisher never published is marked `TBD:` and exposed as
 *   a live, tunable parameter. Domain modules must read it from here rather
 *   than hard-coding a guess. `tuning.tbd()` reports every unresolved value
 *   so the UI can surface them honestly to the player.
 */

// --------------------------------------------------------------------------
// Grid & world
// --------------------------------------------------------------------------

/** One grid cell = one building plot. 4 world units. */
export const CELL = 4;

/** Playfield is GRID.size x GRID.size cells (256 x 256 world units). */
export const GRID = Object.freeze({
  size: 64,
  cell: CELL,
  levels: 8,
});

export const WORLD = Object.freeze({
  width: GRID.size * CELL,
  depth: GRID.size * CELL,
  originX: -(GRID.size * CELL) / 2,
  originZ: -(GRID.size * CELL) / 2,
});

// --------------------------------------------------------------------------
// Retro 16-bit palette
// --------------------------------------------------------------------------

export const PALETTE = Object.freeze({
  void: 0x0d0f1c,
  ink: 0x1a1c2c,
  night: 0x232844,
  slate: 0x2e3457,
  steel: 0x4b5280,
  mist: 0x9aa3d4,
  snow: 0xe8ecff,
  gold: 0xffd166,
  amber: 0xf4a261,
  ember: 0xef476f,
  rose: 0xf78fb3,
  violet: 0x9b5de5,
  azure: 0x118ab2,
  sky: 0x4cc9f0,
  mint: 0x06d6a0,
  grass: 0x63c174,
  moss: 0x3f8f4d,
  bark: 0x7a5230,
  soil: 0x8a5a3b,
  sand: 0xe6c98a,
  rock: 0x7d8597,
  water: 0x3a7ca5,
  deepWater: 0x1b4965,
});

export const PALETTE_NAMES = Object.freeze(Object.keys(PALETTE));

// --------------------------------------------------------------------------
// Simulation speed & time
// --------------------------------------------------------------------------

export const SPEED = Object.freeze({
  paused: 0,
  slow: 1,
  normal: 2,
  fast: 4,
  ultra: 8,
});

export const SPEED_ORDER = Object.freeze(['paused', 'slow', 'normal', 'fast', 'ultra']);

/** Real seconds of one in-game day at `normal` speed. */
export const DAY_LENGTH = 60;

/** In-game days per real minute at `normal` speed. */
export const DAYS_PER_MINUTE = 60 / DAY_LENGTH;

// --------------------------------------------------------------------------
// Modes & stages
// --------------------------------------------------------------------------

export const MODES = Object.freeze({
  play: 'play',
  scenario: 'scenario',
  sandbox: 'sandbox',
  editor: 'editor',
});

export const MODE_LABELS = Object.freeze({
  play: 'City Life',
  scenario: 'Scenario',
  sandbox: 'Sandbox',
  editor: 'SCC Studio',
});

// --------------------------------------------------------------------------
// Gameplay tuning
// --------------------------------------------------------------------------
// TBD entries are deliberately published as `null` in the source dossier and
// are surfaced as "assumed" values the player can change. Keep this table the
// single source of truth.

export const TUNING = Object.freeze({
  // --- ECO -------------------------------------------------------------
  /** TBD: the starting coin balance. The dossier never publishes it. */
  startingTreasury: 25000,
  /** TBD: price index for a base residential plot. */
  baseBuildCost: 120,
  /** TBD: monthly upkeep per occupied residential unit. */
  monthlyUpkeepPerUnit: 2,
  /** TBD: tax yield per resident per month. */
  monthlyTaxPerResident: 6,
  /** TBD: construction cost multiplier per service tier. */
  serviceCostMultiplier: 1.35,
  /** TBD: how much of a building's cost is refunded on demolish. */
  demolishRefundRate: 0.4,

  // --- POP -------------------------------------------------------------
  /** TBD: residents a level-1 residential building houses. */
  residentsPerLevel1: 8,
  /** TBD: residents added per level-up of a residential building. */
  residentsPerUpgrade: 6,
  /** TBD: maximum residential levels per building. */
  maxLevels: 3,
  /** TBD: happiness ceiling and floor (0..100). */
  happinessMin: 0,
  happinessMax: 100,
  /** TBD: happiness below this triggers a migration wave. */
  migrationThreshold: 35,
  /** TBD: bonus multiplier ceiling for score bonuses. */
  bonusCeiling: 15,          // TBD: publisher value unresolved (x15 vs x16)
  /** TBD: happiness at which the bonus curve saturates (0..1). */
  bonusSaturation: 0.9,

  // --- MOB -------------------------------------------------------------
  /** TBD: target number of simulated vehicles for a mid-size city. */
  targetVehicleCount: 60,
  /** TBD: seconds a vehicle takes to traverse one cell of road. */
  secondsPerCell: 2.2,
  /** TBD: maximum vehicles per road cell before congestion. */
  vehiclesPerCell: 3,
  /** TBD: base commute tolerance before citizens complain. */
  commuteTolerance: 45,

  // --- SRV -------------------------------------------------------------
  /** TBD: service radius in world units for a level-1 service building. */
  baseServiceRadius: 32,
  /** TBD: radius growth per service level. */
  serviceRadiusPerLevel: 8,
  /** TBD: households one level-1 service building can serve. */
  householdsPerService: 24,

  // --- WLD -------------------------------------------------------------
  /** TBD: maximum terrain height in world units. */
  maxTerrainHeight: 12,
  /** TBD: fraction of the map covered by water at start. */
  waterFraction: 0.18,
  /** TBD: terrain height step between voxel layers. */
  heightStep: 1.5,

  // --- BLD -------------------------------------------------------------
  /** TBD: how many levels a service building can be upgraded to. */
  maxServiceLevels: 3,

  // --- UX --------------------------------------------------------------
  /** TBD: camera pitch in degrees at the default isometric view. */
  cameraPitch: 55,
  /** TBD: default camera distance from the focus point. */
  cameraDistance: 66,
  /** TBD: min/max camera zoom distance. */
  cameraMinDistance: 22,
  cameraMaxDistance: 220,
});

// --------------------------------------------------------------------------
// Tool palette (STD / BLD / UX share these names)
// --------------------------------------------------------------------------

export const TOOLS = Object.freeze({
  inspect: 'inspect',
  build: 'build',
  bulldoze: 'bulldoze',
  road: 'road',
  terraform: 'terraform',
  paint: 'paint',
  voxel: 'voxel',
});

// --------------------------------------------------------------------------
// Deterministic RNG (mulberry32)
// --------------------------------------------------------------------------

export function makeRng(seed = 1337) {
  let a = seed >>> 0;
  return function rng() {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function rngRange(rng, min, max) {
  return min + rng() * (max - min);
}

export function rngInt(rng, min, maxInclusive) {
  return Math.floor(min + rng() * (maxInclusive - min + 1));
}

export function rngPick(rng, arr) {
  return arr[Math.floor(rng() * arr.length) % arr.length];
}

// --------------------------------------------------------------------------
// Grid <-> world conversion
// --------------------------------------------------------------------------

/** Cell coordinate (integer) -> centre of that cell in world space. */
export function cellToWorld(cx, cz, y = 0) {
  return {
    x: WORLD.originX + (cx + 0.5) * CELL,
    y,
    z: WORLD.originZ + (cz + 0.5) * CELL,
  };
}

/** World space -> fractional cell coordinate. */
export function worldToCell(x, z) {
  return {
    x: (x - WORLD.originX) / CELL - 0.5,
    z: (z - WORLD.originZ) / CELL - 0.5,
  };
}

/** World space -> integer cell coordinate (may be out of bounds). */
export function worldToCellInt(x, z) {
  const c = worldToCell(x, z);
  return {
    x: Math.floor(c.x + 0.5),
    z: Math.floor(c.z + 0.5),
  };
}

/** True when the integer cell is inside the playable grid. */
export function inBounds(cx, cz) {
  return cx >= 0 && cz >= 0 && cx < GRID.size && cz < GRID.size;
}

export function clampCell(cx, cz) {
  return {
    x: Math.min(GRID.size - 1, Math.max(0, cx)),
    z: Math.min(GRID.size - 1, Math.max(0, cz)),
  };
}

// --------------------------------------------------------------------------
// TBD reporting — the honesty discipline
// --------------------------------------------------------------------------

const TBD_RE = /\bTBD\b/;

/**
 * The tuning keys whose value the publisher NEVER published.
 *
 * A key in this set is a DESIGN DECISION: the rule around it may be
 * published, but the number is not, so the UI has to show it as a provisional
 * value. A key that is NOT in this set carries a PUBLISHED number and must
 * never be marked as assumed.
 *
 * The list is explicit rather than derived from the table, because a derived
 * list cannot tell a published value from an unpublished one — the old
 * implementation reported EVERY numeric key, so a published value would have
 * been marked provisional too. It is explicit here so that:
 *   - a published value added later is never wrongly flagged, and
 *   - a new key is not silently treated as published either: it has to be
 *     added to this set on purpose.
 *
 * `startingTreasury` is in this set: the dossier never publishes the
 * starting balance (the earlier table entry simply lacked the marker).
 */
export const TUNING_TBD = Object.freeze(new Set([
  // --- ECO -------------------------------------------------------------
  'startingTreasury',
  'baseBuildCost',
  'monthlyUpkeepPerUnit',
  'monthlyTaxPerResident',
  'serviceCostMultiplier',
  'demolishRefundRate',
  // --- POP -------------------------------------------------------------
  'residentsPerLevel1',
  'residentsPerUpgrade',
  'maxLevels',
  'happinessMin',
  'happinessMax',
  'migrationThreshold',
  'bonusCeiling',
  'bonusSaturation',
  // --- MOB -------------------------------------------------------------
  'targetVehicleCount',
  'secondsPerCell',
  'vehiclesPerCell',
  'commuteTolerance',
  // --- SRV -------------------------------------------------------------
  'baseServiceRadius',
  'serviceRadiusPerLevel',
  'householdsPerService',
  // --- WLD -------------------------------------------------------------
  'maxTerrainHeight',
  'waterFraction',
  'heightStep',
  // --- BLD -------------------------------------------------------------
  'maxServiceLevels',
  // --- UX --------------------------------------------------------------
  'cameraPitch',
  'cameraDistance',
  'cameraMinDistance',
  'cameraMaxDistance',
]));

/**
 * Collect the tuning values the publisher never published.
 *
 * The UX layer renders these as "assumed value — adjust in settings".
 *
 * @returns {Array<{key:string, value:number}>}
 */
export function tuningTbd() {
  const out = [];
  for (const [k, v] of Object.entries(TUNING)) {
    if (typeof v !== 'number') continue;
    if (!TUNING_TBD.has(k)) continue;
    out.push({ key: k, value: v });
  }
  return out;
}

/**
 * Is this tuning key an unpublished (design-decision) number?
 * @param {string} key
 * @returns {boolean}
 */
export function tuningIsTbd(key) {
  return TUNING_TBD.has(String(key));
}

/** True when a comment/doc string declares a value as unresolved. */
export function isTbd(note) {
  return TBD_RE.test(String(note || ''));
}
