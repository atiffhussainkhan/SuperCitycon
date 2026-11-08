/**
 * V4 — Level registry.
 *
 * A level is an async builder: it receives the engine services and returns
 * the ids of the entities it created. The runtime loads a level by id.
 */

import { buildDemoLevel } from './demo-level.js';

/** Every level the runtime can load. */
export const LEVELS = Object.freeze([
  {
    id: 'demo',
    name: 'Demo Level',
    description: 'A village square: four NPCs, two interactive props, one player.',
    build: buildDemoLevel,
  },
]);

/**
 * Look a level up by id.
 * @param {string} id
 * @returns {object|null}
 */
export function getLevel(id) {
  return LEVELS.find((level) => level.id === id) ?? null;
}

/**
 * Build a level by id.
 * @param {string} id
 * @param {object} services  { world, registry, bus, renderer, physics, logger }
 * @returns {Promise<object|null>} the level's build result
 */
export async function loadLevel(id, services = {}) {
  const level = getLevel(id);
  if (!level) throw new Error(`unknown level "${id}"`);
  return level.build(services);
}

/** The level ids, for a level-select menu. */
export function levelIds() {
  return LEVELS.map((level) => level.id);
}

export { buildDemoLevel };
