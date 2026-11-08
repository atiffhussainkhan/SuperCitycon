/**
 * V4 — NPC behaviour state machine.
 *
 * A small, explicit finite state machine. Every state has an `enter`, an
 * `update` and an `exit` hook, and the machine — not the states — owns the
 * transition bookkeeping and the event emission, so the NPC system only has
 * to decide *what* it wants, never *how* a transition is recorded.
 *
 * States: idle, patrol, chase, return, interact.
 *
 *   idle     -> patrol (when a route exists) / chase (when the player is seen)
 *   patrol   -> chase (player seen) / idle (route finished)
 *   chase    -> return (player lost for longer than the patience window)
 *   return   -> idle (home reached)
 *   interact -> idle (the line has been spoken)
 *
 * The difficulty profile (sight radius, chase speed, patience) is data, so a
 * designer can retune the AI without touching the state logic.
 */

import { Events } from '../core/events.js';

/** The states the demo NPC brain knows about. */
export const BEHAVIOUR_STATES = Object.freeze(['idle', 'patrol', 'chase', 'return', 'interact']);

/** Difficulty profiles — the knobs a designer tunes. */
export const DIFFICULTY_PROFILES = Object.freeze({
  easy: Object.freeze({ sight: 8, chaseSpeed: 2.0, patience: 4.5, hearing: 4 }),
  normal: Object.freeze({ sight: 12, chaseSpeed: 3.2, patience: 2.5, hearing: 6 }),
  hard: Object.freeze({ sight: 18, chaseSpeed: 4.4, patience: 1.2, hearing: 9 }),
});

/**
 * Merge a profile name (or object) with overrides.
 * @param {string|object} [profile]
 * @param {object} [overrides]
 */
export function createDifficultyProfile(profile = 'normal', overrides = {}) {
  const base = typeof profile === 'string'
    ? (DIFFICULTY_PROFILES[profile] ?? DIFFICULTY_PROFILES.normal)
    : (profile ?? {});
  const merged = { ...DIFFICULTY_PROFILES.normal, ...base };
  // An override of `undefined` must not wipe the profile's value.
  for (const [key, value] of Object.entries(overrides ?? {})) {
    if (value !== undefined) merged[key] = value;
  }
  return merged;
}

/**
 * The demo behaviours.
 *
 * A state's hooks receive `(ctx, machine, dt)`:
 *   ctx.npc        — the NPC record (speed, home, patrol route, path, ...)
 *   ctx.machine    — the behaviour machine (use `machine.setState(...)`)
 *   ctx.player     — the player record or null
 *   ctx.canSeePlayer() — line-of-sight test against the player
 *   ctx.playerPosition() -> {x,z} | null
 *   ctx.pathTo(x, z) -> boolean — compute a path, returns false when unreachable
 *   ctx.setSpeed(v) — the movement speed for this frame
 *   ctx.stop()      — drop the current path
 *   ctx.speak(line) — say a line (dialogue)
 */
export const DEMO_BEHAVIOURS = {
  idle: {
    enter(ctx) {
      if (!ctx?.npc) return;
      ctx.stop();
      ctx.setSpeed(0);
      ctx.npc.idleTimer = ctx.npc.idleTime ?? 3;
    },
    update(ctx, machine, dt) {
      if (!ctx?.npc) return;
      ctx.setSpeed(0);
      // A player in plain sight always wins over idling — unless this NPC is
      // deliberately unalertable (a shopkeeper who stays put, say).
      if (ctx.npc.alertable !== false && ctx.canSeePlayer()) {
        machine.setState('chase', ctx);
        return;
      }
      ctx.npc.idleTimer -= dt;
      if (ctx.npc.idleTimer <= 0) {
        // Patrol if there is a route (or a wander mode), otherwise keep idling.
        if (ctx.npc.patrol.length > 0 || ctx.npc.wander) machine.setState('patrol', ctx);
        else ctx.npc.idleTimer = ctx.npc.idleTime ?? 3;
      }
    },
    exit() {},
  },

  patrol: {
    enter(ctx) {
      if (!ctx?.npc) return;
      ctx.npc.patrolIndex = ctx.npc.patrolIndex ?? 0;
      ctx.npc.patrolWait = 0;
      ctx.npc.pathExhausted = false;
      ctx.setSpeed(ctx.npc.speed);
    },
    update(ctx, machine, dt) {
      if (!ctx?.npc) return;
      if (ctx.npc.alertable !== false && ctx.canSeePlayer()) {
        machine.setState('chase', ctx);
        return;
      }
      const route = ctx.npc.patrol;
      if (route.length === 0) {
        // Wander mode: pick a fresh point near home and go there.
        if (!ctx.npc.wander) {
          machine.setState('idle', ctx);
          return;
        }
        ctx.npc.wanderWait = (ctx.npc.wanderWait ?? 0) - dt;
        if (ctx.npc.wanderWait <= 0 || ctx.npc.waypoints.length === 0) {
          ctx.npc.wanderWait = ctx.npc.wanderInterval ?? 5;
          const target = ctx.randomNearHome(ctx.npc.wanderRadius ?? 4);
          ctx.npc.wanderTarget = target;
          ctx.pathTo(target.x, target.z, { force: true });
        }
        ctx.setSpeed(ctx.npc.speed * 0.7);
        return;
      }

      // The previous leg finished during the last frame's movement step.
      // Advance the route BEFORE asking for a path, otherwise the NPC would
      // walk back to the waypoint it just finished.
      if (ctx.npc.pathExhausted) {
        ctx.npc.pathExhausted = false;
        ctx.npc.patrolIndex = (ctx.npc.patrolIndex + 1) % route.length;
        if (ctx.npc.patrolIndex === 0) {
          machine.setState('idle', ctx);
          return;
        }
      }

      const index = ctx.npc.patrolIndex % route.length;
      const point = route[index];
      // `waypoints` is the real "do I need a path?" test: a path whose start
      // and goal are the same cell has no waypoints at all.
      if (ctx.npc.waypoints.length === 0) {
        const ok = ctx.pathTo(point[0], point[2] ?? point[1] ?? 0);
        if (!ok) {
          // Unreachable waypoint: skip it rather than standing still forever —
          // but give up on the route after a few failures so the NPC does not
          // burn an A* search on every single update.
          ctx.npc.pathFailures = (ctx.npc.pathFailures ?? 0) + 1;
          ctx.npc.patrolIndex = (index + 1) % route.length;
          ctx.npc.pathExhausted = false;
          if (ctx.npc.pathFailures >= 3) {
            ctx.npc.pathFailures = 0;
            machine.setState('idle', ctx);
          }
          return;
        }
        ctx.npc.pathFailures = 0;
      }
      ctx.setSpeed(ctx.npc.speed);
    },
    exit() {},
  },

  chase: {
    enter(ctx) {
      if (!ctx?.npc) return;
      ctx.npc.lostTimer = 0;
      ctx.npc.lastSeen = ctx.playerPosition();
      ctx.setSpeed(ctx.profile.chaseSpeed);
    },
    update(ctx, machine, dt) {
      if (!ctx?.npc) return;
      const seen = ctx.canSeePlayer();
      if (seen) {
        ctx.npc.lostTimer = 0;
        ctx.npc.lastSeen = ctx.playerPosition();
      } else {
        ctx.npc.lostTimer += dt;
      }

      const target = seen ? ctx.playerPosition() : ctx.npc.lastSeen;
      if (target) {
        ctx.pathTo(target.x, target.z);
        ctx.setSpeed(ctx.profile.chaseSpeed);
      }

      // Close enough to talk / catch the player. The cooldown keeps the NPC
      // from flipping between chase and interact every talk duration.
      if (seen
        && ctx.npc.distanceToPlayer <= (ctx.npc.interactRange ?? 2)
        && (ctx.npc.talkCooldown ?? 0) <= 0) {
        machine.setState('interact', ctx);
        return;
      }

      if (ctx.npc.lostTimer >= (ctx.profile.patience ?? 2.5)) {
        machine.setState('return', ctx);
      }
    },
    exit(ctx) {
      ctx.npc.lostTimer = 0;
    },
  },

  return: {
    enter(ctx) {
      if (!ctx?.npc) return;
      ctx.setSpeed(ctx.npc.speed);
      ctx.npc.pathExhausted = false;
      const home = ctx.npc.home;
      ctx.pathTo(home[0], home[2] ?? home[1] ?? 0);
    },
    update(ctx, machine, dt) {
      if (!ctx?.npc) return;
      if (ctx.canSeePlayer()) {
        machine.setState('chase', ctx);
        return;
      }
      ctx.setSpeed(ctx.npc.speed);
      const home = ctx.npc.home;
      const pos = ctx.npc.position();
      const hx = home[0];
      const hz = home[2] ?? home[1] ?? 0;
      const dx = pos.x - hx;
      const dz = pos.z - hz;
      if (Math.hypot(dx, dz) <= (ctx.npc.homeRadius ?? 0.8) || ctx.npc.pathExhausted) {
        ctx.npc.pathExhausted = false;
        machine.setState('idle', ctx);
      }
    },
    exit() {},
  },

  interact: {
    enter(ctx) {
      if (!ctx?.npc) return;
      ctx.stop();
      ctx.setSpeed(0);
      ctx.npc.talkTimer = ctx.npc.talkDuration ?? 2;
      // The NPC will not start another conversation for a while.
      ctx.npc.talkCooldown = ctx.npc.talkCooldownDuration ?? 4;
    },
    update(ctx, machine, dt) {
      if (!ctx?.npc) return;
      ctx.setSpeed(0);
      // The NPC stays put and finishes its line. It does NOT fall back into
      // the chase state just because the player is still visible — that would
      // make the two states fight over the NPC every frame.
      ctx.npc.talkTimer -= dt;
      if (ctx.npc.talkTimer <= 0) {
        // The line is finished. Only chase if the player has walked away and
        // this NPC is allowed to react to them at all.
        const stillClose = ctx.npc.distanceToPlayer <= (ctx.npc.interactRange ?? 2);
        if (ctx.npc.alertable !== false && ctx.canSeePlayer() && !stillClose) {
          machine.setState('chase', ctx);
        } else {
          machine.setState('idle', ctx);
        }
      }
    },
    exit() {},
  },
};

/**
 * Create a behaviour machine.
 *
 * @param {string} [initial]      the starting state
 * @param {object} [opts]
 * @param {object} [opts.bus]      the event bus (Events.NPC_STATE is emitted)
 * @param {object} [opts.states]   state table, defaults to DEMO_BEHAVIOURS
 * @param {string|object} [opts.profile] difficulty profile
 * @param {object} [opts.context]  the context handed to the initial `enter`
 */
export function createBehaviourMachine(initial = 'idle', { bus = null, states = DEMO_BEHAVIOURS, profile = 'normal', context = null } = {}) {
  let current = null;
  let previous = null;
  let timeInState = 0;
  const history = [];
  const difficulty = createDifficultyProfile(profile);

  const machine = {
    /** The current state name. */
    get state() { return current; },
    /** The state we came from. */
    get previous() { return previous; },
    /** Seconds spent in the current state. */
    get time() { return timeInState; },
    /** The resolved difficulty profile. */
    profile: difficulty,
    /** Every state name this machine knows. */
    states: () => Object.keys(states),
    /** The transition log, newest last. */
    transitions: () => [...history],
    /** The most recent transition, or null. */
    lastTransition: () => (history.length ? history[history.length - 1] : null),

    /**
     * Change state. Runs `exit` on the old state and `enter` on the new one,
     * records the transition and emits Events.NPC_STATE.
     */
    setState(next, ctx = context) {
      if (!next || !states[next]) return false;
      if (next === current) return false;

      const from = current;
      if (from && states[from]?.exit) {
        try { states[from].exit(ctx ?? context, machine, 0); } catch (err) { console.error('[v4/npc] exit hook failed:', err); }
      }

      previous = from;
      current = next;
      timeInState = 0;

      const entry = { from, to: next, at: history.length };
      history.push(entry);
      if (history.length > 64) history.shift();

      if (states[next]?.enter) {
        try { states[next].enter(ctx ?? context, machine, 0); } catch (err) { console.error('[v4/npc] enter hook failed:', err); }
      }

      if (bus) {
        bus.emit(Events.NPC_STATE, {
          entityId: ctx?.npc?.entityId ?? null,
          name: ctx?.npc?.name ?? null,
          from,
          to: next,
          state: next,
          time: entry.at,
        });
      }
      return true;
    },

    /** Run the current state's `update` hook. */
    update(dt, ctx = context) {
      if (!current) return null;
      timeInState += dt;
      const state = states[current];
      if (!state?.update) return current;
      try {
        state.update(ctx ?? context, machine, dt);
      } catch (err) {
        console.error(`[v4/npc] state "${current}" update failed:`, err);
      }
      return current;
    },

    /** Force a state without running hooks (used when restoring a save). */
    reset(stateName = initial, ctx = context) {
      current = null;
      previous = null;
      timeInState = 0;
      history.length = 0;
      return machine.setState(stateName, ctx);
    },
  };

  if (initial && states[initial]) {
    machine.setState(initial, context);
  }
  return machine;
}
