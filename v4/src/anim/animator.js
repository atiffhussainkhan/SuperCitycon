/**
 * V4 — Character animation.
 *
 * Three.js' `AnimationMixer` does the interpolation; this module owns the
 * things a game actually needs on top of it:
 *
 *   - a state machine (idle / walk / run / jump / land …) with transitions
 *     driven by named conditions,
 *   - cross-fade blending between states,
 *   - animation *events* (a clip can carry timed markers such as "footstep"
 *     or "attack-hit"), fired through the event bus,
 *   - per-entity animation controllers that can be saved and restored.
 *
 * The clips come from the project's own cleared character models — the
 * KayKit characters ship 30 clips (Idle, Walk, Run, Jump, Attack, Interact …)
 * and the Quaternius-style characters 76.
 */

import * as THREE from 'three';
import { Events } from '../core/events.js';

/**
 * The state machine used by the demo character. `clip` names are matched
 * case-insensitively against the model's real clip names.
 */
export const DEFAULT_STATES = {
  idle: { clips: ['Idle', 'BasePose', 'Unarmed_Idle'], loop: true, speed: 1 },
  walk: { clips: ['Walk', 'Walking_A'], loop: true, speed: 1 },
  run: { clips: ['Run', 'Running_A'], loop: true, speed: 1 },
  jump: { clips: ['Jump', 'Jump_Start'], loop: false, speed: 1 },
  land: { clips: ['Jump_Land', 'Landing'], loop: false, speed: 1 },
  attack: { clips: ['Attack(1h)', '1H_Melee_Attack_Chop'], loop: false, speed: 1 },
  interact: { clips: ['Interact'], loop: false, speed: 1 },
  wave: { clips: ['Wave', 'Cheer'], loop: false, speed: 1 },
};

/** The transitions of the demo character state machine. */
export const DEFAULT_TRANSITIONS = [
  { from: 'idle', to: 'walk', when: 'moving', fade: 0.2 },
  { from: 'walk', to: 'idle', when: '!moving', fade: 0.25 },
  { from: 'walk', to: 'run', when: 'sprinting', fade: 0.15 },
  { from: 'run', to: 'walk', when: '!sprinting && moving', fade: 0.2 },
  { from: 'run', to: 'idle', when: '!moving', fade: 0.25 },
  { from: 'idle', to: 'jump', when: 'jumping', fade: 0.1 },
  { from: 'walk', to: 'jump', when: 'jumping', fade: 0.1 },
  { from: 'run', to: 'jump', when: 'jumping', fade: 0.1 },
  { from: 'jump', to: 'land', when: 'landed', fade: 0.05 },
  { from: 'land', to: 'idle', when: '!moving', fade: 0.2 },
  { from: 'land', to: 'walk', when: 'moving', fade: 0.2 },
  { from: 'idle', to: 'attack', when: 'attacking', fade: 0.1 },
  { from: 'walk', to: 'attack', when: 'attacking', fade: 0.1 },
  { from: 'idle', to: 'interact', when: 'interacting', fade: 0.1 },
  { from: 'attack', to: 'idle', when: '!attacking', fade: 0.25 },
  { from: 'interact', to: 'idle', when: '!interacting', fade: 0.25 },
];

/**
 * A reusable animation controller for one character.
 *
 * @param {object} opts
 * @param {THREE.Object3D} opts.root  the skinned object to drive
 * @param {THREE.AnimationClip[]} opts.clips
 * @param {object} opts.bus
 */
export function createAnimator({ root, clips = [], bus = null, states = DEFAULT_STATES, transitions = DEFAULT_TRANSITIONS, entityId = null } = {}) {
  const mixer = new THREE.AnimationMixer(root);
  const actions = new Map();     // state -> THREE.AnimationAction
  const actionFor = new Map();   // state -> the real clip used

  for (const [state, def] of Object.entries(states)) {
    const wanted = [].concat(def.clips);
    let clip = null;
    for (const candidate of wanted) {
      clip = clips.find((c) => c.name.toLowerCase() === String(candidate).toLowerCase())
        ?? clips.find((c) => c.name.toLowerCase().includes(String(candidate).toLowerCase()));
      if (clip) break;
    }
    if (!clip) continue;
    const action = mixer.clipAction(clip);
    action.setLoop(def.loop ? THREE.LoopRepeat : THREE.LoopOnce, def.loop ? Infinity : 1);
    action.clampWhenFinished = true;
    action.enabled = true;
    action.setEffectiveWeight(0);
    action.play();
    actions.set(state, action);
    actionFor.set(state, clip);
  }

  let current = actions.has('idle') ? 'idle' : [...actions.keys()][0] ?? null;
  let previous = null;
  const conditions = {};
  const pendingEvents = [];
  let time = 0;

  function setCondition(name, value) { conditions[name] = !!value; }

  /**
   * Is a transition's `when` expression satisfied?
   *
   * The expression is a small boolean language over the named conditions:
   * `moving`, `!moving`, `sprinting && moving`. It used to be looked up as a
   * literal key, which meant a compound condition such as
   * `!sprinting && moving` could never fire.
   */
  function conditionMet(when) {
    if (!when) return false;
    if (when === 'true') return true;
    if (when === 'false') return false;
    return when.split('&&').every((part) => {
      const term = part.trim();
      if (!term) return true;
      if (term.startsWith('!')) return !conditions[term.slice(1).trim()];
      return !!conditions[term];
    });
  }

  function evaluateTransitions() {
    for (const t of transitions) {
      if (t.from !== current) continue;
      if (!conditionMet(t.when)) continue;
      if (!actions.has(t.to)) continue;
      play(t.to, t.fade ?? 0.2);
      return true;
    }
    return false;
  }

  function play(state, fade = 0.2) {
    if (!actions.has(state) || state === current) return false;
    const next = actions.get(state);
    const prev = current ? actions.get(current) : null;
    next.reset();
    next.setEffectiveWeight(1);
    next.fadeIn(fade);
    if (prev) {
      prev.fadeOut(fade);
      prev.setEffectiveWeight(0);
    }
    previous = current;
    current = state;
    time = 0;
    // Clip markers become animation events.
    const clip = actionFor.get(state);
    for (const marker of clip?.userData?.events ?? []) {
      pendingEvents.push({ at: time + marker.time, name: marker.name });
    }
    if (bus) bus.emit(Events.ANIMATION_STATE, { entityId, state, previous });
    return true;
  }

  return {
    mixer,
    get state() { return current; },
    get previousState() { return previous; },
    states: () => [...actions.keys()],
    clips: () => [...actionFor.values()].map((c) => c.name),
    setCondition,
    play,
    /** True when the current clip has finished (used for one-shot states). */
    get finished() {
      const action = current ? actions.get(current) : null;
      return !!action && action.time >= action.getClip().duration - 1e-3;
    },

    update(dt) {
      mixer.update(dt);
      time += dt;
      // Fire animation events whose time has come.
      for (let i = pendingEvents.length - 1; i >= 0; i -= 1) {
        if (pendingEvents[i].at <= time) {
          const ev = pendingEvents.splice(i, 1)[0];
          if (bus) bus.emit(Events.ANIMATION_EVENT, { entityId, name: ev.name, state: current });
        }
      }
      evaluateTransitions();
      return current;
    },

    dispose() { mixer.stopAllAction(); mixer.uncacheRoot(root); },
  };
}

/**
 * Attach animation events to a clip by name — the marker lives on the clip,
 * so it is saved with the asset rather than in code.
 */
export function withEvents(clips, eventsByClip) {
  for (const clip of clips) {
    const events = eventsByClip[clip.name];
    if (!events) continue;
    clip.userData = clip.userData ?? {};
    clip.userData.events = events;
  }
  return clips;
}
