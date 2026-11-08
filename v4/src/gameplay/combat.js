/**
 * V4 — Melee combat.
 *
 * A single melee swing on a cooldown. The swing hits the nearest NPC inside
 * the reach and in front of the player, damages it, and drives the 'attack'
 * animation state.
 *
 * Damage is applied to the target's `health` component (the same plain
 * `{ current, max }` shape the health module writes), so the combat system
 * does not need to own a health instance per target.
 */

import { Tags } from '../core/ecs.js';

const DEFAULT_CONFIG = {
  damage: 25,
  range: 2.2,
  arc: 80,          // degrees, the total cone in front of the player
  cooldown: 0.8,    // seconds between swings
  attackDuration: 0.45,
};

/** World position of an entity. */
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
 * @param {object} [opts.animator] the player's animator
 * @param {number} [opts.entityId] the player's entity
 * @param {object} [opts.input]     reads the 'player.attack' action
 * @param {object} [opts.config]
 */
export function createCombat({
  world = null,
  bus = null,
  animator = null,
  entityId = null,
  input = null,
  logger = null,
  config = {},
} = {}) {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  let cooldown = 0;
  let attackTimer = 0;
  let attacking = false;
  let lastResult = null;

  /** The direction the player faces. */
  function facing() {
    const transform = world?.getComponent?.(entityId, 'transform');
    const yaw = transform?.rotation?.[1] ?? 0;
    return { x: Math.sin(yaw), z: Math.cos(yaw) };
  }

  /** Every NPC in the world (by component or by tag). */
  function npcEntities() {
    if (!world) return [];
    const byComponent = world.query('npc');
    const byTag = world.query(Tags.NPC);
    if (byTag.length === 0) return byComponent;
    const seen = new Set(byComponent.map((e) => e.id));
    const out = [...byComponent];
    for (const entity of byTag) {
      if (!seen.has(entity.id)) out.push(entity);
    }
    return out;
  }

  /** Every NPC within reach and inside the swing cone. */
  function targets() {
    if (!world) return [];
    const origin = entityPosition(world.get(entityId));
    if (!origin) return [];
    const forward = facing();
    const halfArc = Math.cos((cfg.arc * Math.PI) / 180 / 2);
    const out = [];

    for (const entity of npcEntities()) {
      const pos = entityPosition(entity);
      if (!pos) continue;
      const dx = pos.x - origin.x;
      const dz = pos.z - origin.z;
      const distance = Math.hypot(dx, dz);
      if (distance > cfg.range) continue;
      const dot = distance < 1e-4
        ? 1
        : (dx * forward.x + dz * forward.z) / distance;
      if (dot < halfArc) continue;
      out.push({ entity, distance, dot });
    }
    out.sort((a, b) => a.distance - b.distance);
    return out;
  }

  function setCondition(name, value) {
    animator?.setCondition?.(name, value);
  }

  /**
   * Perform a swing.
   * @returns {{hit:boolean,targetId:number|null,damage:number,reason:string}}
   */
  function attack() {
    if (cooldown > 0) {
      lastResult = { hit: false, targetId: null, damage: 0, reason: 'cooldown' };
      return lastResult;
    }
    cooldown = cfg.cooldown;
    attacking = true;
    attackTimer = cfg.attackDuration;

    setCondition('attacking', true);
    setCondition('!attacking', false);
    if (animator?.states?.().includes?.('attack')) animator.play('attack');

    const candidates = targets();
    const target = candidates[0] ?? null;

    let damage = 0;
    let targetId = null;
    if (target) {
      targetId = target.entity.id;
      const health = world.getComponent(targetId, 'health');
      if (health) {
        health.current = Math.max(0, (health.current ?? health.max ?? 100) - cfg.damage);
        damage = cfg.damage;
        bus?.emit?.('gameplay:damage', {
          entityId: targetId,
          amount: damage,
          current: health.current,
          max: health.max ?? 100,
          source: entityId,
        });
        if (health.current <= 0) {
          bus?.emit?.('gameplay:death', { entityId: targetId, source: entityId });
        }
      }
    }

    lastResult = {
      hit: !!target,
      targetId,
      damage,
      reason: target ? 'hit' : 'miss',
    };
    bus?.emit?.('gameplay:attack', { entityId, ...lastResult });
    if (!target) logger?.debug('melee attack missed', { entityId });
    return lastResult;
  }

  /**
   * Advance the cooldown and the attack animation.
   * @param {number} dt
   */
  function update(dt = 0) {
    const step = Math.max(0, dt);
    if (cooldown > 0) cooldown = Math.max(0, cooldown - step);
    if (attacking) {
      attackTimer -= step;
      if (attackTimer <= 0) {
        attacking = false;
        setCondition('attacking', false);
        setCondition('!attacking', true);
      }
    }
    if (input?.wasPressed?.('player.attack')) attack();
    return lastResult;
  }

  return {
    /** The resolved configuration. */
    config: cfg,
    /** Is the player mid-swing? */
    get attacking() { return attacking; },
    /** Seconds until the next swing is allowed. */
    get cooldown() { return cooldown; },
    /** The result of the last swing. */
    get lastResult() { return lastResult; },
    /** Attach the animator the swing drives. */
    setAnimator(next) { animator = next; },

    attack,
    update,
    /** The NPCs currently inside the swing cone. */
    targets,
  };
}
