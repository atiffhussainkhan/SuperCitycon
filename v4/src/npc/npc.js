/**
 * V4 — NPC system.
 *
 * Owns the population: spawning, senses, pathing, behaviour, interaction and
 * a frame budget that keeps the AI responsive as the crowd grows.
 *
 * Everything here is deterministic. There is no `Math.random()` in a
 * simulation path — the per-NPC randomness (wander targets, idle jitter)
 * comes from a seeded mulberry32 generator, so a replay of the same inputs
 * produces the same output.
 *
 * The system never assumes a renderer exists: it drives the ECS, the physics
 * world and the event bus, and the render layer binds to the entities.
 */

import { Tags } from '../core/ecs.js';
import { Events } from '../core/events.js';
import { createTransform, setPosition, setRotation } from '../core/transform.js';
import { createNavGrid, findPathDetailed, smoothPath } from './pathfinding.js';
import { createBehaviourMachine, DEMO_BEHAVIOURS, createDifficultyProfile } from './behaviours.js';

/**
 * A small, fast, seeded PRNG (mulberry32). Same seed → same sequence.
 * @param {number} seed
 * @returns {() => number} a function returning floats in [0,1)
 */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** World position of an entity, tolerating an un-updated transform. */
function entityPosition(entity) {
  const t = entity?.components?.get?.('transform');
  if (!t) return null;
  if (t.dirty === false && Array.isArray(t.world) && t.world.length === 16) {
    return { x: t.world[12], y: t.world[13], z: t.world[14] };
  }
  const p = t.position ?? [0, 0, 0];
  return { x: p[0], y: p[1], z: p[2] };
}

/** Normalise a dialogue table into an array of `{speaker, text}` lines. */
function normaliseDialogue(dialogue) {
  if (!dialogue) return [];
  const list = Array.isArray(dialogue) ? dialogue : (Array.isArray(dialogue.lines) ? dialogue.lines : []);
  return list
    .filter((line) => line !== null && line !== undefined)
    .map((line) => (typeof line === 'string' ? { speaker: null, text: line } : { ...line }));
}

/**
 * Create the NPC system.
 *
 * @param {object} opts
 * @param {object} opts.world    the ECS world
 * @param {object} [opts.bus]    the event bus
 * @param {object} [opts.physics] the physics world
 * @param {object} [opts.logger] the logger
 * @param {object} [opts.nav]    a navigation grid (one is created if omitted)
 * @param {number} [opts.updateBudget] how many NPCs are updated per frame
 * @param {number} [opts.seed]   the PRNG seed
 * @param {number} [opts.playerId] the player entity id
 * @param {string|object} [opts.difficulty] the difficulty profile
 */
export function createNpcSystem({
  world,
  bus = null,
  physics = null,
  logger = null,
  nav = null,
  updateBudget = 8,
  seed = 1337,
  playerId = null,
  difficulty = 'normal',
  navBudget = 4000,
  repathDistance = 2.0,
  repathInterval = 0.35,
  stalePathTolerance = 0.75,
} = {}) {
  if (!world) throw new Error('createNpcSystem requires a world');

  // The grid is a reference, not a copy: `setNav` swaps it wholesale (a grid
  // owns its blocked cells in a closure, so copying fields would lose them).
  let grid = nav ?? createNavGrid({ size: [64, 64], cellSize: 1, origin: [-32, -32] });
  /** @type {Map<number, object>} */
  const npcs = new Map();
  /** @type {object[]} iteration order — the round-robin cursor walks this. */
  const order = [];
  let cursor = 0;
  let budget = Math.max(1, updateBudget);
  let playerEntityId = playerId;
  let baseSeed = seed;
  let spawnCounter = 0;

  function playerEntity() {
    if (typeof playerEntityId === 'number') {
      const e = world.get(playerEntityId);
      if (e) return e;
    }
    const found = world.query(Tags.PLAYER)[0];
    if (found) playerEntityId = found.id;
    return found ?? null;
  }

  function playerPosition() {
    const e = playerEntity();
    if (!e) return null;
    const p = entityPosition(e);
    if (!p) return null;
    return { x: p.x, y: p.y, z: p.z };
  }

  /**
   * Spawn an NPC.
   *
   * @param {object} config
   * @returns {number} the new entity id
   */
  function spawn(config = {}) {
    const {
      name = 'NPC',
      position = [0, 0, 0],
      behaviour = 'patrol',
      patrol = [],
      home = null,
      speed = 2.2,
      sight = null,
      radius = 0.6,
      height = 1.8,
      difficulty: npcDifficulty = null,
      profile = null,
      wander = false,
      wanderRadius = 4,
      wanderInterval = 5,
      idleTime = 3,
      talkDuration = 2,
      interactRange = 2,
      alertable = true,
      dialogue = null,
      interactive = false,
      prompt = 'Talk',
      once = false,
      seed: npcSeed = null,
      tags = [],
    } = config;

    const entity = world.createEntity({
      name,
      tags: [Tags.NPC, ...(interactive ? [Tags.INTERACTIVE] : []), ...tags],
    });
    const entityId = entity.id;

    const transform = createTransform({
      position: [position[0] ?? 0, position[1] ?? 0, position[2] ?? 0],
    });
    world.addComponent(entityId, 'transform', transform);

    const resolvedProfile = createDifficultyProfile(
      npcDifficulty ?? profile ?? difficulty,
      // Only override the profile's sight when the caller actually gave one —
      // passing `sight: undefined` would wipe the profile value.
      (sight === null || sight === undefined) ? {} : { sight },
    );

    const npcData = {
      behaviour,
      speed,
      sight: resolvedProfile.sight,
      radius,
      home: home ?? [position[0] ?? 0, position[1] ?? 0, position[2] ?? 0],
      patrol: patrol.map((p) => (Array.isArray(p) ? [...p] : [p.x ?? 0, p.y ?? 0, p.z ?? 0])),
      patience: resolvedProfile.patience,
      chaseSpeed: resolvedProfile.chaseSpeed,
      wander,
      alertable,
    };
    world.addComponent(entityId, 'npc', npcData);
    world.addComponent(entityId, 'health', { current: 100, max: 100 });
    world.addComponent(entityId, 'physics', {
      shape: 'box', halfExtents: [radius, height / 2, radius], mass: 0, restitution: 0, friction: 0.8, kinematic: true,
    });
    if (interactive) {
      world.addComponent(entityId, 'interactive', {
        kind: 'npc',
        prompt,
        once,
        onInteract: null,
      });
    }

    if (physics) {
      physics.addBody({
        entityId,
        shape: 'box',
        halfExtents: [radius, height / 2, radius],
        position: { x: position[0] ?? 0, y: position[1] ?? 0, z: position[2] ?? 0 },
        kinematic: true,
      });
    }

    const rng = mulberry32(npcSeed ?? (baseSeed + spawnCounter * 7919));
    spawnCounter += 1;

    const record = {
      entityId,
      id: entityId,
      name,
      behaviour,
      speed,
      sight: resolvedProfile.sight,
      radius,
      height,
      home: npcData.home,
      patrol: npcData.patrol,
      profile: resolvedProfile,
      wander,
      wanderRadius,
      wanderInterval,
      wanderTarget: null,
      idleTime,
      idleTimer: idleTime,
      talkDuration,
      talkTimer: 0,
      talkCooldown: 0,
      talkCooldownDuration: 4,
      pathFailures: 0,
      interactRange,
      alertable,
      dialogue: normaliseDialogue(dialogue),
      dialogueIndex: 0,
      line: null,
      path: [],
      waypoints: [],
      pathIndex: 0,
      pathExhausted: false,
      goal: null,
      repathTimer: 0,
      desiredSpeed: 0,
      arriveRadius: 0.35,
      eyeHeight: height * 0.85,
      lostTimer: 0,
      lastSeen: null,
      distanceToPlayer: Infinity,
      rng,
      machine: null,
      ctx: null,
      facing: 0,
    };

    record.position = () => {
      const body = physics?.getBody?.(entityId);
      if (body) return { x: body.position.x, y: body.position.y, z: body.position.z };
      const p = entityPosition(world.get(entityId));
      return p ?? { x: 0, y: 0, z: 0 };
    };

    const ctx = {
      npc: record,
      world,
      bus,
      physics,
      logger,
      profile: resolvedProfile,
      rng,
      get player() { return playerEntity(); },
      playerPosition,
      canSeePlayer: () => canSeePlayer(record),
      pathTo: (x, z, opts) => pathTo(record, x, z, opts),
      setSpeed: (v) => { record.desiredSpeed = v; },
      stop: () => {
        record.path = [];
        record.waypoints = [];
        record.pathIndex = 0;
        record.goal = null;
      },
      speak: (line) => speak(record, line),
      randomNearHome: (r) => randomNearHome(record, r),
      requestState: (name) => record.machine?.setState(name, ctx),
    };
    record.ctx = ctx;

    record.machine = createBehaviourMachine(behaviour, {
      bus,
      states: DEMO_BEHAVIOURS,
      profile: resolvedProfile,
      context: ctx,
    });

    npcs.set(entityId, record);
    order.push(record);

    if (bus) {
      bus.emit(Events.ENTITY_ADDED, { entityId, name, kind: 'npc' });
    }
    if (logger) logger.debug(`npc spawned: ${name} (#${entityId})`, { behaviour });
    return entityId;
  }

  /** A deterministic random point near the NPC's home. */
  function randomNearHome(record, radius) {
    const angle = record.rng() * Math.PI * 2;
    const distance = radius * (0.35 + record.rng() * 0.65);
    const home = record.home;
    return {
      x: (home[0] ?? 0) + Math.cos(angle) * distance,
      z: (home[2] ?? home[1] ?? 0) + Math.sin(angle) * distance,
    };
  }

  /**
   * Compute (or refresh) a path to a world position.
   * Re-pathing is skipped when the target barely moved, so a chasing NPC does
   * not re-run A* every single frame.
   */
  function pathTo(record, x, z, { force = false } = {}) {
    const goal = { x, z };
    if (!force && record.path.length && record.goal) {
      // Keep the current path while it still ends near the target. A path
      // whose end has drifted away from the target is stale, but re-pathing
      // every frame would burn an A* search per frame — so a stale path is
      // only recomputed once the re-path interval has elapsed.
      const goalMoved = Math.hypot(record.goal.x - x, record.goal.z - z);
      const last = record.waypoints[record.waypoints.length - 1];
      const endGap = last ? Math.hypot(last.x - x, last.z - z) : Infinity;
      const stale = endGap > stalePathTolerance;
      const due = (record.repathTimer ?? 0) <= 0;
      if (goalMoved < repathDistance && (!stale || !due)) {
        record.goal = goal;
        return true;
      }
    }
    const pos = record.position();
    const result = findPathDetailed(grid, { x: pos.x, z: pos.z }, goal, { maxExpanded: navBudget });
    if (!result.found) {
      record.path = [];
      record.waypoints = [];
      record.pathIndex = 0;
      record.goal = goal;
      record.pathExhausted = true;
      return false;
    }
    record.path = result.cells;
    record.waypoints = smoothPath(grid, result.cells, { start: { x: pos.x, z: pos.z } });
    record.pathIndex = 0;
    record.pathExhausted = false;
    record.goal = goal;
    record.repathTimer = repathInterval;
    return true;
  }

  /** Sight + line of sight against the player. */
  function canSeePlayer(record) {
    const player = playerEntity();
    if (!player) {
      record.distanceToPlayer = Infinity;
      return false;
    }
    const pp = entityPosition(player);
    if (!pp) return false;
    const pos = record.position();
    const dx = pp.x - pos.x;
    const dz = pp.z - pos.z;
    const distance = Math.hypot(dx, dz);
    record.distanceToPlayer = distance;
    if (distance > record.sight) return false;

    if (!physics?.raycast) return true;

    const eye = { x: pos.x, y: pos.y + record.eyeHeight, z: pos.z };
    const target = { x: pp.x, y: pp.y + 1.0, z: pp.z };
    const tx = target.x - eye.x;
    const ty = target.y - eye.y;
    const tz = target.z - eye.z;
    const len = Math.hypot(tx, ty, tz);
    if (len < 1e-4) return true;
    const dir = { x: tx / len, y: ty / len, z: tz / len };
    const hit = physics.raycast(eye, dir, len + 0.35);
    if (!hit) return true;
    // The ground is below the player, so only a hit *before* the player blocks.
    return hit.distance >= len - 0.3;
  }

  /** Speak a line: store it on the record and announce it.
   *
   * The line is announced on 'npc:line', NOT on Events.INTERACTION: the
   * interaction system already emits INTERACTION for the key press, and two
   * events per interaction would double-count every conversation.
   */
  function speak(record, line) {
    if (!line) return null;
    record.line = { speaker: line.speaker ?? record.name, text: line.text ?? '' };
    bus?.emit?.('npc:line', {
      entityId: record.entityId,
      speaker: record.line.speaker,
      text: record.line.text,
    });
    return record.line;
  }

  /** Move the NPC along its current waypoints. */
  function step(record, dt) {
    const speed = record.desiredSpeed;
    if (speed <= 0) return;
    if (record.waypoints.length === 0) {
      record.pathExhausted = true;
      return;
    }

    const pos = record.position();
    let waypoint = record.waypoints[record.pathIndex];
    let remaining = Math.hypot(waypoint.x - pos.x, waypoint.z - pos.z);

    let guard = 8;
    while (remaining < record.arriveRadius && record.pathIndex < record.waypoints.length - 1 && guard > 0) {
      guard -= 1;
      record.pathIndex += 1;
      waypoint = record.waypoints[record.pathIndex];
      remaining = Math.hypot(waypoint.x - pos.x, waypoint.z - pos.z);
    }

    if (remaining < 0.08 && record.pathIndex >= record.waypoints.length - 1) {
      record.waypoints = [];
      record.path = [];
      record.pathIndex = 0;
      record.pathExhausted = true;
      return;
    }

    const travel = Math.min(remaining, speed * dt);
    const nx = pos.x + ((waypoint.x - pos.x) / remaining) * travel;
    const nz = pos.z + ((waypoint.z - pos.z) / remaining) * travel;
    const delta = { x: nx - pos.x, y: 0, z: nz - pos.z };

    if (physics?.moveBody) {
      physics.moveBody(record.entityId, delta);
    } else {
      // No physics world: move the transform directly.
      const t = world.getComponent(record.entityId, 'transform');
      if (t) setPosition(t, pos.x + delta.x, pos.y, pos.z + delta.z);
    }

    // Face the direction of travel.
    if (Math.abs(delta.x) > 1e-5 || Math.abs(delta.z) > 1e-5) {
      record.facing = Math.atan2(delta.x, delta.z);
      const transform = world.getComponent(record.entityId, 'transform');
      if (transform) setRotation(transform, 0, record.facing, 0);
    }

    // Keep the transform in sync with the physics body.
    const after = record.position();
    const transform = world.getComponent(record.entityId, 'transform');
    if (transform) setPosition(transform, after.x, after.y, after.z);
  }

  function updateNpc(record, dt) {
    const health = world.getComponent(record.entityId, 'health');
    if (health && health.current <= 0) {
      record.desiredSpeed = 0;
      return;
    }
    if (record.talkCooldown > 0) record.talkCooldown = Math.max(0, record.talkCooldown - dt);
    if (record.repathTimer > 0) record.repathTimer = Math.max(0, record.repathTimer - dt);
    record.machine.update(dt, record.ctx);
    step(record, dt);
  }

  const system = {
    /** The navigation grid the NPCs walk on. */
    get nav() { return grid; },
    /** The NPC records, keyed by entity id. */
    records: npcs,
    /** How many NPCs are alive. */
    count() { return npcs.size; },
    /** The population size (the same number as `count()`). */
    get population() { return npcs.size; },
    /** The current per-frame update budget. */
    get budget() { return budget; },
    set budget(v) { budget = Math.max(1, Math.floor(v) || 1); },
    /** The round-robin cursor (exposed for tests and the debug overlay). */
    get cursor() { return cursor; },

    /** Spawn an NPC. See {@link createNpcSystem}. */
    spawn,

    /** Remove an NPC and clean up its body. */
    remove(entityId) {
      const record = npcs.get(entityId);
      if (!record) return false;
      npcs.delete(entityId);
      const index = order.indexOf(record);
      if (index >= 0) order.splice(index, 1);
      if (cursor > order.length) cursor = 0;
      physics?.removeBody?.(entityId);
      world.removeEntity(entityId);
      return true;
    },

    /** Point the system at the player entity. */
    setPlayer(entityId) { playerEntityId = entityId; },
    /** The player entity id the system is using. */
    get playerId() { return typeof playerEntityId === 'number' ? playerEntityId : null; },
    /** Replace the navigation grid (e.g. when a level loads). */
    setNav(next) { grid = next; return grid; },
    /** The difficulty profile applied to newly spawned NPCs. */
    difficulty,
    setDifficulty(next) { difficulty = next; },

    /**
     * Update the population. At most `budget` NPCs are updated per frame,
     * picked round-robin so no NPC is starved when the crowd is large.
     */
    update(dt) {
      if (order.length === 0) return 0;
      const count = Math.min(budget, order.length);
      for (let i = 0; i < count; i += 1) {
        const index = (cursor + i) % order.length;
        const record = order[index];
        if (!record) continue;
        try {
          updateNpc(record, dt);
        } catch (err) {
          logger?.error('npc update failed', { entityId: record.entityId, error: String(err?.message ?? err) });
        }
      }
      cursor = (cursor + count) % order.length;
      return count;
    },

    /**
     * Interact with an NPC: it speaks the next line of its dialogue table and
     * switches to the `interact` state.
     */
    interact(entityId) {
      const record = npcs.get(entityId);
      if (!record) return null;
      let line = null;
      if (record.dialogue.length > 0) {
        const index = record.dialogueIndex % record.dialogue.length;
        record.dialogueIndex += 1;
        line = record.dialogue[index];
      }
      if (line) speak(record, line);
      if (record.machine.state !== 'interact') {
        record.machine.setState('interact', record.ctx);
      }
      return record.line;
    },

    /** The line an NPC is currently saying, if any. */
    lineOf(entityId) {
      return npcs.get(entityId)?.line ?? null;
    },

    /**
     * A snapshot of every NPC, for the debug overlay.
     * @returns {{id:number,name:string,state:string,position:number[],pathLength:number,lastTransition:object|null}[]}
     */
    debugState() {
      const out = [];
      for (const record of order) {
        const pos = record.position();
        out.push({
          id: record.entityId,
          name: record.name,
          state: record.machine.state,
          position: [pos.x, pos.y, pos.z],
          pathLength: Math.max(0, record.waypoints.length - record.pathIndex),
          lastTransition: record.machine.lastTransition(),
        });
      }
      return out;
    },

    /** The NPC records, in iteration order. */
    list() { return [...order]; },
  };

  return system;
}
