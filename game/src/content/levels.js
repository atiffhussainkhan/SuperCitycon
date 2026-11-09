/**
 * content/levels.js — CONTENT (pure rule module).
 *
 * OWNER: the integrator (content/).
 *
 * The V5 content pipeline needs more than one map to be a pipeline. This
 * module holds the shipped level library:
 *
 *   - `LEVELS`            — the level definitions (pure data).
 *   - `LEVEL_INDEX`       — id -> level.
 *   - `getLevel(id)`      — lookup.
 *   - `listLevels()`      — the library, in display order.
 *   - `levelOrder()`      — the world-map progression chain.
 *   - `nextLevel(id)`     — the next map in the chain.
 *   - `levelsForMode(mode)`— the maps a mode offers.
 *
 * HONESTY — every number below that the publisher never published is marked
 * `TBD:` and carries the reason. The levels are DESIGN PLACEHOLDERS built on
 * the game's own published grid, palette and catalogue. They are genuinely
 * loadable and genuinely playable (the validator proves the internal
 * consistency), but they are not claimed to be balanced content.
 *
 * A "level" here is the CITY-BUILDER idiom of a map: a terrain seed, a
 * starting city, objectives, hazards, collectibles and checkpoints. The
 * directive's "enemy / boss" language maps onto the multi-phase HAZARD system
 * (see `src/hazards/`): a flood, a wildfire or a grid outage escalates through
 * phases and the player has to resolve it.
 *
 * This module never imports `three` and is unit-testable in plain Node.
 */

import { GRID } from '../core/config.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * A rectangular ring of road cells around a centre.
 * Used to lay out the starting street grid of a level.
 *
 * @param {number} cx centre column
 * @param {number} cz centre row
 * @param {number} radius half-width in cells
 * @returns {Array<{x:number,z:number}>}
 */
export function ringCells(cx, cz, radius) {
  const out = [];
  for (let x = cx - radius; x <= cx + radius; x += 1) {
    out.push({ x, z: cz - radius });
    out.push({ x, z: cz + radius });
  }
  for (let z = cz - radius + 1; z <= cz + radius - 1; z += 1) {
    out.push({ x: cx - radius, z });
    out.push({ x: cx + radius, z });
  }
  return out;
}

/**
 * A solid block of cells.
 * @param {number} x0
 * @param {number} z0
 * @param {number} x1
 * @param {number} z1
 * @returns {Array<{x:number,z:number}>}
 */
export function blockCells(x0, z0, x1, z1) {
  const out = [];
  for (let x = x0; x <= x1; x += 1) {
    for (let z = z0; z <= z1; z += 1) out.push({ x, z });
  }
  return out;
}

// ---------------------------------------------------------------------------
// The library
// ---------------------------------------------------------------------------

/**
 * The shipped levels.
 *
 * Every level is a complete, self-consistent definition:
 *   id, name, description, seed, difficulty, metadata
 *   objectives   — what the player must achieve
 *   checkpoints  — named milestones the player passes through
 *   collectibles — optional one-off finds
 *   hazards      — the multi-phase threats, each with its own phase ladder
 *   spawns       — the starting city: roads, buildings, nature, citizens
 *   exits        — how the level is finished
 */
export const LEVELS = Object.freeze([

  // -------------------------------------------------------------------------
  // 1 — First Light: the tutorial map. No hazard. Teaches roads, housing and
  //     the first checkpoint.
  // -------------------------------------------------------------------------
  Object.freeze({
    id: 'first-light',
    name: 'First Light',
    description:
      'A quiet valley on the morning of the founding. Lay the first streets, '
      + 'house the first citizens and light the grid.',
    seed: 20261023,
    difficulty: 'tutorial',
    metadata: Object.freeze({
      author: 'SuperCitycon team',
      version: '1.0.0',
      tags: Object.freeze(['tutorial', 'valley', 'peaceful']),
      licence: 'Original content, shipped with SuperCitycon.',
    }),
    objectives: Object.freeze([
      Object.freeze({
        id: 'obj-first-roads',
        label: 'Lay the first streets',
        type: 'buildings',
        target: 24,
      }),
      Object.freeze({
        id: 'obj-first-residents',
        label: 'House the first citizens',
        type: 'population',
        target: 12,
      }),
      Object.freeze({
        id: 'obj-first-checkpoint',
        label: 'Reach the old bridge',
        type: 'checkpoint',
        target: 1,
        checkpointId: 'cp-bridge',
      }),
    ]),
    checkpoints: Object.freeze([
      Object.freeze({
        id: 'cp-bridge',
        label: 'The old bridge',
        x: 32,
        z: 16,
        requires: Object.freeze(['obj-first-roads']),
      }),
    ]),
    collectibles: Object.freeze([
      Object.freeze({ id: 'col-survey', label: 'The surveyor\'s marker', x: 18, z: 40 }),
    ]),
    hazards: Object.freeze([]),
    spawns: Object.freeze([
      ...ringCells(32, 32, 10).map((c, i) => Object.freeze({
        id: `spawn-road-${i}`, type: 'road', x: c.x, z: c.z,
      })),
      ...blockCells(24, 24, 26, 26).map((c, i) => Object.freeze({
        id: `spawn-house-${i}`, type: 'building', key: 'res.house', x: c.x, z: c.z,
      })),
      Object.freeze({
        id: 'spawn-grocery', type: 'building', key: 'com.grocery', x: 28, z: 24, rect: { w: 3, h: 3 },
      }),
      Object.freeze({
        id: 'spawn-park', type: 'building', key: 'prk.park', x: 24, z: 28, rect: { w: 3, h: 2 },
      }),
      Object.freeze({ id: 'spawn-civic-0', type: 'character', key: 'Knight', x: 32, z: 34 }),
      Object.freeze({ id: 'spawn-civic-1', type: 'character', key: 'Mage', x: 30, z: 34 }),
      Object.freeze({ id: 'spawn-tree-0', type: 'nature', key: 'mdvl_nature_oak_01', x: 18, z: 44 }),
      Object.freeze({ id: 'spawn-tree-1', type: 'nature', key: 'mdvl_nature_oak_01', x: 46, z: 44 }),
      Object.freeze({ id: 'spawn-tree-2', type: 'nature', key: 'mdvl_nature_pine_01', x: 46, z: 20 }),
    ]),
    exits: Object.freeze([
      Object.freeze({
        id: 'exit-first-light',
        label: 'Open the city hall',
        x: 32,
        z: 20,
        requires: Object.freeze(['obj-first-residents', 'obj-first-checkpoint']),
      }),
    ]),
  }),

  // -------------------------------------------------------------------------
  // 2 — High Water: the first multi-phase hazard. A flood escalates through
  //     three phases; the player must reach the high-ground checkpoint.
  // -------------------------------------------------------------------------
  Object.freeze({
    id: 'high-water',
    name: 'High Water',
    description:
      'The river breaks its banks. The flood climbs through three phases — '
      + 'floodwater, surge, then the breach — and the only safe ground is the '
      + 'north ridge.',
    seed: 20261107,
    difficulty: 'normal',
    metadata: Object.freeze({
      author: 'SuperCitycon team',
      version: '1.0.0',
      tags: Object.freeze(['river', 'flood', 'multi-phase']),
      licence: 'Original content, shipped with SuperCitycon.',
    }),
    objectives: Object.freeze([
      Object.freeze({
        id: 'obj-hw-residents',
        label: 'Keep the district populated',
        type: 'population',
        target: 60,
      }),
      Object.freeze({
        id: 'obj-hw-buildings',
        label: 'Raise enough of the old town to house the district',
        type: 'buildings',
        target: 40,
      }),
      Object.freeze({
        id: 'obj-hw-hazard',
        label: 'Survive the flood',
        type: 'hazard',
        target: 1,
        hazardId: 'hz-flood',
      }),
      Object.freeze({
        id: 'obj-hw-landing',
        label: 'Reach the ferry landing',
        type: 'checkpoint',
        target: 1,
        checkpointId: 'cp-landing',
      }),
      Object.freeze({
        id: 'obj-hw-checkpoint',
        label: 'Reach the north ridge',
        type: 'checkpoint',
        target: 1,
        checkpointId: 'cp-ridge',
      }),
    ]),
    checkpoints: Object.freeze([
      Object.freeze({
        id: 'cp-landing',
        label: 'The ferry landing',
        x: 14,
        z: 44,
        requires: Object.freeze(['obj-hw-buildings']),
      }),
      Object.freeze({
        id: 'cp-ridge',
        label: 'The north ridge',
        x: 20,
        z: 10,
        requires: Object.freeze(['obj-hw-residents']),
      }),
    ]),
    collectibles: Object.freeze([
      Object.freeze({ id: 'col-lifebuoy', label: 'A rusted lifebuoy', x: 44, z: 46 }),
      Object.freeze({ id: 'col-chart', label: 'The river chart', x: 12, z: 22 }),
    ]),
    hazards: Object.freeze([
      Object.freeze({
        id: 'hz-flood',
        label: 'The river breaks its banks',
        type: 'flood',
        x: 46,
        z: 48,
        radius: 14,
        // TBD: no published hazard cadence; the phase ladder is a design
        // placeholder and is the single place these numbers live.
        phases: Object.freeze([
          Object.freeze({
            id: 'flood-1', name: 'Floodwater', duration: 45,
            damagePerSecond: 1, telegraphSeconds: 6,
          }),
          Object.freeze({
            id: 'flood-2', name: 'Surge', duration: 60,
            damagePerSecond: 2, telegraphSeconds: 4,
          }),
          Object.freeze({
            id: 'flood-3', name: 'The breach', duration: 75,
            damagePerSecond: 4, telegraphSeconds: 3,
          }),
        ]),
      }),
    ]),
    spawns: Object.freeze([
      ...ringCells(28, 34, 9).map((c, i) => Object.freeze({
        id: `spawn-road-${i}`, type: 'road', x: c.x, z: c.z,
      })),
      ...blockCells(22, 30, 24, 32).map((c, i) => Object.freeze({
        id: `spawn-house-${i}`, type: 'building', key: 'res.house', x: c.x, z: c.z,
      })),
      Object.freeze({
        id: 'spawn-flats', type: 'building', key: 'res.low_rise_flats', x: 26, z: 30, rect: { w: 2, h: 3 },
      }),
      Object.freeze({
        id: 'spawn-market', type: 'building', key: 'com.market_hall', x: 30, z: 30, rect: { w: 4, h: 4 },
      }),
      Object.freeze({ id: 'spawn-civic-0', type: 'character', key: 'Knight', x: 28, z: 36 }),
      Object.freeze({ id: 'spawn-civic-1', type: 'character', key: 'Mage', x: 26, z: 36 }),
      Object.freeze({ id: 'spawn-civic-2', type: 'character', key: 'Rogue', x: 30, z: 36 }),
      Object.freeze({ id: 'spawn-tree-0', type: 'nature', key: 'mdvl_nature_pine_01', x: 10, z: 14 }),
      Object.freeze({ id: 'spawn-tree-1', type: 'nature', key: 'mdvl_nature_boulder_01', x: 52, z: 24 }),
    ]),
    exits: Object.freeze([
      Object.freeze({
        id: 'exit-high-water',
        label: 'Evacuate to the ridge',
        x: 20,
        z: 8,
        requires: Object.freeze([
          'obj-hw-hazard',
          'obj-hw-landing',
          'obj-hw-checkpoint',
          'obj-hw-residents',
        ]),
      }),
    ]),
  }),

  // -------------------------------------------------------------------------
  // 3 — The Long Night: the crisis map. A wildfire escalates through four
  //     phases and the city has to be kept alive through it. This is the
  //     directive's "boss encounter" in the city-builder idiom.
  // -------------------------------------------------------------------------
  Object.freeze({
    id: 'the-long-night',
    name: 'The Long Night',
    description:
      'A wildfire starts on the eastern edge and walks west, phase by phase, '
      + 'through the whole district. Keep the grid lit, keep the people '
      + 'evacuated and hold the north gate until the fire burns out.',
    seed: 20261123,
    difficulty: 'crisis',
    metadata: Object.freeze({
      author: 'SuperCitycon team',
      version: '1.0.0',
      tags: Object.freeze(['fire', 'crisis', 'multi-phase', 'evacuation']),
      licence: 'Original content, shipped with SuperCitycon.',
    }),
    objectives: Object.freeze([
      Object.freeze({
        id: 'obj-tln-buildings',
        label: 'Stand a city worth defending',
        type: 'buildings',
        target: 70,
      }),
      Object.freeze({
        id: 'obj-tln-residents',
        label: 'Keep the district alive',
        type: 'population',
        target: 120,
      }),
      Object.freeze({
        id: 'obj-tln-hazard',
        label: 'Survive the fire',
        type: 'hazard',
        target: 1,
        hazardId: 'hz-fire',
      }),
      Object.freeze({
        id: 'obj-tln-collectibles',
        label: 'Recover the district records',
        type: 'collectible',
        target: 3,
      }),
      Object.freeze({
        id: 'obj-tln-quay',
        label: 'Reach the east quay',
        type: 'checkpoint',
        target: 1,
        checkpointId: 'cp-east-quay',
      }),
      Object.freeze({
        id: 'obj-tln-market',
        label: 'Reach the old market',
        type: 'checkpoint',
        target: 1,
        checkpointId: 'cp-mid-market',
      }),
      Object.freeze({
        id: 'obj-tln-checkpoint',
        label: 'Hold the north gate',
        type: 'checkpoint',
        target: 1,
        checkpointId: 'cp-north-gate',
      }),
    ]),
    checkpoints: Object.freeze([
      Object.freeze({
        id: 'cp-east-quay',
        label: 'The east quay',
        x: 52,
        z: 30,
        requires: Object.freeze(['obj-tln-buildings']),
      }),
      Object.freeze({
        id: 'cp-mid-market',
        label: 'The old market',
        x: 32,
        z: 32,
        requires: Object.freeze(['obj-tln-residents']),
      }),
      Object.freeze({
        id: 'cp-north-gate',
        label: 'The north gate',
        x: 32,
        z: 8,
        requires: Object.freeze(['obj-tln-collectibles']),
      }),
    ]),
    collectibles: Object.freeze([
      Object.freeze({ id: 'col-ledger', label: 'The city ledger', x: 48, z: 34 }),
      Object.freeze({ id: 'col-seal', label: 'The mayor\'s seal', x: 20, z: 38 }),
      Object.freeze({ id: 'col-plan', label: 'The fire plan', x: 44, z: 16 }),
    ]),
    hazards: Object.freeze([
      Object.freeze({
        id: 'hz-fire',
        label: 'The wildfire',
        type: 'wildfire',
        // A CRISIS: its phases run back to back with no lull, and a
        // city-wide panic builds while they run.
        crisis: true,
        x: 56,
        z: 32,
        radius: 18,
        // TBD: no published hazard cadence; four escalating phases.
        phases: Object.freeze([
          Object.freeze({
            id: 'fire-1', name: 'Spot fire', duration: 50,
            damagePerSecond: 2, telegraphSeconds: 8,
          }),
          Object.freeze({
            id: 'fire-2', name: 'Crown fire', duration: 60,
            damagePerSecond: 4, telegraphSeconds: 6,
          }),
          Object.freeze({
            id: 'fire-3', name: 'Fire storm', duration: 70,
            damagePerSecond: 7, telegraphSeconds: 5,
          }),
          Object.freeze({
            id: 'fire-4', name: 'The burnout', duration: 45,
            damagePerSecond: 1, telegraphSeconds: 10,
          }),
        ]),
      }),
    ]),
    spawns: Object.freeze([
      ...ringCells(32, 30, 12).map((c, i) => Object.freeze({
        id: `spawn-road-${i}`, type: 'road', x: c.x, z: c.z,
      })),
      ...blockCells(26, 26, 27, 28).map((c, i) => Object.freeze({
        id: `spawn-house-${i}`, type: 'building', key: 'res.house', x: c.x, z: c.z,
      })),
      Object.freeze({
        id: 'spawn-flats', type: 'building', key: 'res.mid_rise_flats', x: 30, z: 26, rect: { w: 3, h: 3 },
      }),
      Object.freeze({
        id: 'spawn-office', type: 'building', key: 'com.office_block', x: 34, z: 26, rect: { w: 4, h: 3 },
      }),
      Object.freeze({
        id: 'spawn-clinic', type: 'building', key: 'hea.medical_center', x: 26, z: 34, rect: { w: 2, h: 2 },
      }),
      Object.freeze({
        id: 'spawn-depot', type: 'building', key: 'ind.freight_depot', x: 38, z: 24, rect: { w: 4, h: 4 },
      }),
      Object.freeze({ id: 'spawn-civic-0', type: 'character', key: 'Knight', x: 32, z: 32 }),
      Object.freeze({ id: 'spawn-civic-1', type: 'character', key: 'Mage', x: 34, z: 32 }),
      Object.freeze({ id: 'spawn-civic-2', type: 'character', key: 'Rogue', x: 30, z: 32 }),
      Object.freeze({ id: 'spawn-civic-3', type: 'character', key: 'Barbarian', x: 32, z: 30 }),
      Object.freeze({ id: 'spawn-tree-0', type: 'nature', key: 'mdvl_nature_deadtree_01', x: 50, z: 46 }),
      Object.freeze({ id: 'spawn-tree-1', type: 'nature', key: 'mdvl_nature_boulder_01', x: 12, z: 20 }),
      Object.freeze({ id: 'spawn-tree-2', type: 'nature', key: 'mdvl_nature_oak_01', x: 12, z: 46 }),
    ]),
    exits: Object.freeze([
      Object.freeze({
        id: 'exit-long-night',
        label: 'Hold the north gate',
        x: 32,
        z: 6,
        requires: Object.freeze([
          'obj-tln-hazard',
          'obj-tln-quay',
          'obj-tln-market',
          'obj-tln-checkpoint',
          'obj-tln-residents',
          'obj-tln-collectibles',
        ]),
      }),
    ]),
  }),
]);

// ---------------------------------------------------------------------------
// Lookup helpers
// ---------------------------------------------------------------------------

/** id -> level. */
export const LEVEL_INDEX = Object.freeze(
  LEVELS.reduce((acc, level) => {
    acc[level.id] = level;
    return acc;
  }, Object.create(null)),
);

/**
 * Look a level up by id.
 * @param {string} id
 * @returns {object|null}
 */
export function getLevel(id) {
  if (!id) return null;
  return LEVEL_INDEX[id] ?? null;
}

/**
 * The library in display order.
 * @returns {Array<object>}
 */
export function listLevels() {
  return LEVELS.slice();
}

/**
 * The world-map progression chain: the level ids in order.
 *
 * TBD: no published world-map order; the chain follows the difficulty band
 * (tutorial -> normal -> crisis) and is the single place this order lives.
 *
 * @returns {string[]}
 */
export function levelOrder() {
  return LEVELS.map((l) => l.id);
}

/**
 * The next map in the chain.
 * @param {string} id
 * @returns {object|null}
 */
export function nextLevel(id) {
  const order = levelOrder();
  const index = order.indexOf(id);
  if (index < 0) return null;
  return getLevel(order[index + 1]) ?? null;
}

/**
 * The previous map in the chain.
 * @param {string} id
 * @returns {object|null}
 */
export function previousLevel(id) {
  const order = levelOrder();
  const index = order.indexOf(id);
  if (index <= 0) return null;
  return getLevel(order[index - 1]) ?? null;
}

/**
 * The maps a mode offers.
 *
 * - `play`      — the full chain.
 * - `scenario`  — the full chain (a scenario IS a level).
 * - `sandbox`   — every map, unlocked, because sandbox has no gating.
 * - `editor`    — every map, because the editor is not progression-gated.
 *
 * @param {string} mode
 * @returns {Array<object>}
 */
export function levelsForMode(mode) {
  switch (mode) {
    case 'play':
    case 'scenario':
      return listLevels();
    case 'sandbox':
    case 'editor':
      return listLevels();
    default:
      return listLevels();
  }
}

/**
 * The level ids a mode offers, as plain strings.
 * @param {string} mode
 * @returns {string[]}
 */
export function levelIdsForMode(mode) {
  return levelsForMode(mode).map((l) => l.id);
}

/**
 * The playfield size the levels are authored for.
 * @returns {number}
 */
export function levelGridSize() {
  return GRID.size;
}
