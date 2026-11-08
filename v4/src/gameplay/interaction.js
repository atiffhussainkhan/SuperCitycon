/**
 * V4 — Interaction system.
 *
 * Finds the interactive entities near the player, publishes the prompt the
 * HUD shows, and fires `onInteract` when the player presses E.
 *
 * The module knows nothing about what it triggers: an interactive entity owns
 * an `onInteract(entity)` callback in its `interactive` component. That keeps
 * the system reusable for doors, chests, signs and NPCs alike.
 */

import { Events } from '../core/events.js';
import { Tags } from '../core/ecs.js';

/** World position of an entity (tolerates an un-updated transform). */
function entityPosition(entity) {
  const t = entity?.components?.get?.('transform');
  if (!t) return null;
  if (t.dirty === false && Array.isArray(t.world) && t.world.length === 16) {
    return { x: t.world[12], y: t.world[13], z: t.world[14] };
  }
  const p = t.position ?? [0, 0, 0];
  return { x: p[0], y: p[1], z: p[2] };
}

/**
 * @param {object} opts
 * @param {object} opts.world
 * @param {object} [opts.bus]
 * @param {object} [opts.input]  reads the 'player.interact' action
 * @param {number} [opts.playerId]
 * @param {number} [opts.radius]  how close the player must be
 * @param {string} [opts.defaultPrompt]
 */
export function createInteractionSystem({
  world = null,
  bus = null,
  input = null,
  playerId = null,
  radius = 2.5,
  defaultPrompt = 'Interact',
  logger = null,
} = {}) {
  let currentId = null;
  let used = new Set();

  function playerEntity() {
    if (typeof playerId === 'number') {
      const e = world?.get?.(playerId);
      if (e) return e;
    }
    const found = world?.query?.(Tags.PLAYER)?.[0] ?? null;
    if (found) playerId = found.id;
    return found;
  }

  /** Every entity that carries the 'interactive' component (or the tag). */
  function interactiveEntities() {
    if (!world) return [];
    const byComponent = world.query('interactive');
    const byTag = world.query(Tags.INTERACTIVE);
    if (byTag.length === 0) return byComponent;
    const seen = new Set(byComponent.map((e) => e.id));
    const out = [...byComponent];
    for (const entity of byTag) {
      if (!seen.has(entity.id)) out.push(entity);
    }
    return out;
  }

  /** Every interactive entity within range, nearest first. */
  function candidates() {
    const player = playerEntity();
    if (!player || !world) return [];
    const pp = entityPosition(player);
    if (!pp) return [];

    const found = [];
    for (const entity of interactiveEntities()) {
      const data = entity.components.get('interactive');
      if (!data) continue;
      if (data.once && used.has(entity.id)) continue;
      const pos = entityPosition(entity);
      if (!pos) continue;
      const distance = Math.hypot(pos.x - pp.x, pos.z - pp.z);
      if (distance > radius) continue;
      found.push({ entity, data, distance, position: pos });
    }
    found.sort((a, b) => a.distance - b.distance);
    return found;
  }

  /** The prompt for the current target, or null. */
  function prompt() {
    if (currentId === null) return null;
    const entity = world?.get?.(currentId);
    const data = entity?.components?.get?.('interactive');
    if (!data) return null;
    return data.prompt ?? defaultPrompt;
  }

  /**
   * Trigger the current target's `onInteract`.
   * @returns {object|null} the interaction payload
   */
  function interact() {
    if (currentId === null) return null;
    const entity = world?.get?.(currentId);
    if (!entity) return null;
    const data = entity.components.get('interactive');
    if (!data) return null;
    if (data.once && used.has(entity.id)) return null;

    let result = null;
    if (typeof data.onInteract === 'function') {
      try {
        result = data.onInteract(entity, { source: 'interaction' });
      } catch (err) {
        logger?.error('interactive onInteract threw', { entityId: entity.id, error: String(err?.message ?? err) });
      }
    }

    if (data.once) {
      used.add(entity.id);
      if (currentId === entity.id) currentId = null;
    }

    const payload = {
      entityId: entity.id,
      kind: data.kind ?? 'generic',
      prompt: data.prompt ?? defaultPrompt,
      result: result ?? null,
    };
    bus?.emit?.(Events.INTERACTION, payload);
    return payload;
  }

  /**
   * Refresh the current target and (optionally) read the interact key.
   * @param {number} [dt]
   */
  function update(dt = 0) {
    const list = candidates();
    currentId = list.length > 0 ? list[0].entity.id : null;

    if (input?.wasPressed?.('player.interact')) {
      interact();
    }
    return currentId;
  }

  return {
    /** The entity id currently in range, or null. */
    get targetId() { return currentId; },
    /** The entity currently in range, or null. */
    get target() { return currentId === null ? null : (world?.get?.(currentId) ?? null); },
    /** The prompt text for the HUD, or null. */
    prompt,
    /** Every interactive entity within range, nearest first. */
    candidates,
    /** Fire the current target's callback. */
    interact,
    /** Advance the system (and read the interact key). */
    update,
    /** Point the system at a player entity. */
    setPlayer(id) { playerId = id; },
    /** Forget which once-only entities have been used. */
    reset() { used = new Set(); currentId = null; },
    destroy() { used = new Set(); currentId = null; },
  };
}
