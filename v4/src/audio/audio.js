/**
 * V4 — Audio management.
 *
 * A thin, testable layer over the Web Audio API. The point of the abstraction
 * is that the runtime never touches `AudioContext` directly: it asks the audio
 * system for a sound by id and gets back a handle. That makes the whole thing
 * runnable in Node (where there is no AudioContext) with a null backend, which
 * is how the automated tests exercise audio state without pretending to have
 * heard anything.
 *
 * Four category buses (master -> {sfx, music, ambience, ui}) give the mix a
 * shape that a designer can reason about, and every channel is addressable by
 * category so a settings screen can mute ambience without touching music.
 *
 * Positional sounds use a PannerNode and are positioned in world space; the
 * listener is driven from the camera each frame, so the mix follows the player
 * without any per-sound bookkeeping.
 */

/** The category buses, in mix order (master is not a category). */
export const AUDIO_CATEGORIES = Object.freeze(['sfx', 'music', 'ambience', 'ui']);

/** Default per-category gain, before any user preference is applied. */
export const DEFAULT_MIX = Object.freeze({
  master: 0.8,
  sfx: 1.0,
  music: 0.7,
  ambience: 0.6,
  ui: 0.9,
});

/**
 * A backend that records what it was asked to do. Used when the environment has
 * no Web Audio (Node, headless browsers with autoplay blocked, CI).
 */
export function createNullBackend() {
  const played = [];
  const stopped = [];
  let started = 0;
  return {
    kind: 'null',
    played,
    stopped,
    get started() { return started; },
    async unlock() { return false; },
    async decode() { return null; },
    play(id, { loop = false, volume = 1 } = {}) {
      played.push({ id, loop, volume });
      started += 1;
      return { id, loop, volume, startedAt: 0, stop: () => { stopped.push(id); } };
    },
    stopAll() { stopped.push('*'); },
    setListener() { /* no listener in a null backend */ },
    dispose() { stopped.push('dispose'); },
  };
}

/**
 * The real backend, built on the Web Audio API.
 * `contextFactory` is injectable so tests can supply a stub context.
 */
export function createWebAudioBackend({ contextFactory = null, logger = null } = {}) {
  const Ctor = contextFactory
    ?? (globalThis.AudioContext ?? globalThis.webkitAudioContext ?? null);
  if (!Ctor) return createNullBackend();

  let ctx = null;
  try {
    ctx = new Ctor();
  } catch (err) {
    logger?.warn?.(`audio context unavailable: ${err?.message ?? err}`);
    return createNullBackend();
  }

  const master = ctx.createGain();
  master.gain.value = 1;
  master.connect(ctx.destination);

  const categories = new Map();
  for (const cat of AUDIO_CATEGORIES) {
    const gain = ctx.createGain();
    gain.gain.value = 1;
    gain.connect(master);
    categories.set(cat, gain);
  }

  /** id -> decoded AudioBuffer */
  const buffers = new Map();
  /** id -> {source, gain} for looping sounds */
  const loops = new Map();

  function busFor(category) {
    return categories.get(category) ?? categories.get('sfx');
  }

  return {
    kind: 'web-audio',
    context: ctx,

    async unlock() {
      if (ctx.state === 'suspended') {
        try { await ctx.resume(); } catch { /* autoplay policy — stays silent */ }
      }
      return ctx.state === 'running';
    },

    async decode(id, bytes) {
      if (buffers.has(id)) return buffers.get(id);
      try {
        const buf = await ctx.decodeAudioData(bytes);
        buffers.set(id, buf);
        return buf;
      } catch (err) {
        logger?.warn?.(`could not decode audio "${id}": ${err?.message ?? err}`);
        return null;
      }
    },

    play(id, { category = 'sfx', loop = false, volume = 1, position = null, loopId = null } = {}) {
      const buffer = buffers.get(id);
      if (!buffer) return null;
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = loop;

      let node = source;
      if (position) {
        const panner = ctx.createPanner();
        panner.panningModel = 'HRTF';
        panner.distanceModel = 'inverse';
        panner.refDistance = 4;
        panner.maxDistance = 120;
        panner.positionX.value = position.x ?? 0;
        panner.positionY.value = position.y ?? 0;
        panner.positionZ.value = position.z ?? 0;
        source.connect(panner);
        node = panner;
      }

      const gain = ctx.createGain();
      gain.gain.value = volume;
      node.connect(gain);
      gain.connect(busFor(category));

      source.start(0);
      const handle = {
        id,
        category,
        loop,
        source,
        gain,
        stop() {
          try { source.stop(0); } catch { /* already stopped */ }
          if (loopId) loops.delete(loopId);
        },
        setVolume(v) { gain.gain.value = v; },
      };
      if (loop) loops.set(loopId ?? id, handle);
      return handle;
    },

    stopAll() {
      for (const handle of loops.values()) handle.stop();
      loops.clear();
    },

    setListener(position, forward = { x: 0, y: 0, z: -1 }, up = { x: 0, y: 1, z: 0 }) {
      const l = ctx.listener;
      if (!l) return;
      if (l.positionX) {
        l.positionX.value = position.x ?? 0;
        l.positionY.value = position.y ?? 0;
        l.positionZ.value = position.z ?? 0;
        l.forwardX.value = forward.x ?? 0;
        l.forwardY.value = forward.y ?? 0;
        l.forwardZ.value = forward.z ?? -1;
        l.upX.value = up.x ?? 0;
        l.upY.value = up.y ?? 1;
        l.upZ.value = up.z ?? 0;
      } else if (l.setPosition) {
        l.setPosition(position.x ?? 0, position.y ?? 0, position.z ?? 0);
        l.setOrientation(forward.x ?? 0, forward.y ?? 0, forward.z ?? -1, up.x ?? 0, up.y ?? 1, up.z ?? 0);
      }
    },

    setCategoryGain(category, value) {
      const bus = categories.get(category);
      if (bus) bus.gain.value = value;
    },

    setMasterGain(value) { master.gain.value = value; },

    dispose() {
      this.stopAll();
      try { ctx.close(); } catch { /* already closed */ }
    },
  };
}

/**
 * The audio system. `backend` is injectable; by default it picks the Web Audio
 * backend when the environment has it and the null backend otherwise.
 */
export function createAudioSystem({
  bus = null,
  logger = null,
  backend = null,
  mix = DEFAULT_MIX,
  volume = 1,
  muted = false,
} = {}) {
  const be = backend ?? createWebAudioBackend({ logger });

  /** category -> gain, plus master. */
  const gains = { master: volume, ...mix };
  /** Currently playing one-shot handles, by category. */
  const active = new Map();
  /** id -> {category, volume} for loops, so stop('ambience:wind') works. */
  const loopIndex = new Map();

  function effectiveGain(category) {
    if (muted) return 0;
    const cat = gains[category] ?? 1;
    return (gains.master ?? 1) * cat;
  }

  const system = {
    get backendKind() { return be.kind; },
    get muted() { return muted; },
    get gains() { return { ...gains }; },
    get activeCount() { return active.size; },
    get loopIds() { return [...loopIndex.keys()]; },

    /** Browsers block audio until a user gesture; call this from one. */
    async unlock() {
      const ok = await be.unlock?.();
      if (ok) logger?.info?.('audio unlocked');
      return !!ok;
    },

    /**
     * Register a decoded buffer for an id. `bytes` is an ArrayBuffer of encoded
     * audio. Returns the decoded buffer, or null when decoding failed.
     */
    async register(id, bytes) {
      if (!be.decode) return null;
      const buf = await be.decode(id, bytes);
      if (buf) logger?.debug?.(`registered audio "${id}"`);
      return buf;
    },

    /**
     * Play a one-shot sound.
     * `position` makes it positional (world-space); omit for a 2D UI sound.
     */
    play(id, {
      category = 'sfx',
      volume = 1,
      position = null,
      loop = false,
      loopId = null,
    } = {}) {
      const gain = effectiveGain(category);
      if (gain <= 0) return null;
      const handle = be.play(id, {
        category,
        loop,
        volume: gain * volume,
        position,
        loopId,
      });
      if (!handle) {
        logger?.warn?.(`audio "${id}" is not registered`);
        return null;
      }
      if (loop) loopIndex.set(loopId ?? id, { id, category });
      else active.set(`${id}#${active.size}`, handle);
      bus?.emit?.('audio:play', { id, category, loop });
      return handle;
    },

    /** Play (or replace) a looping bed, e.g. ambience. */
    playLoop(id, { category = 'ambience', volume = 1, position = null } = {}) {
      const key = `${category}:${id}`;
      system.stopLoop(key);
      const handle = system.play(id, { category, volume, position, loop: true, loopId: key });
      return handle;
    },

    stopLoop(loopId) {
      const entry = loopIndex.get(loopId);
      if (!entry) return false;
      const handle = active.get(entry.id) ?? null;
      handle?.stop?.();
      loopIndex.delete(loopId);
      bus?.emit?.('audio:stop', { id: entry.id });
      return true;
    },

    /** Stop every sound in a category, or everything when no category is given. */
    stop(category = null) {
      if (category) {
        for (const [key, handle] of [...active]) {
          if (loopIndex.has(key)) continue;
          handle?.stop?.();
          active.delete(key);
        }
        for (const [key, entry] of [...loopIndex]) {
          if (entry.category !== category) continue;
          const handle = active.get(entry.id);
          handle?.stop?.();
          active.delete(entry.id);
          loopIndex.delete(key);
        }
        return;
      }
      be.stopAll?.();
      active.clear();
      loopIndex.clear();
    },

    /** Set a category (or master) gain, clamped to 0..1. */
    setGain(category, value) {
      const v = Math.max(0, Math.min(1, Number(value) || 0));
      gains[category] = v;
      be.setCategoryGain?.(category, v);
      be.setMasterGain?.(gains.master ?? 1);
      return v;
    },

    setMuted(value) {
      muted = !!value;
      bus?.emit?.('audio:muted', { muted });
      if (muted) be.stopAll?.();
      return muted;
    },

    toggleMute() { return system.setMuted(!muted); },

    /** Move the listener. Called each frame with the camera's world pose. */
    updateListener(position, forward, up) {
      if (!position) return;
      be.setListener?.(position, forward, up);
    },

    /** A snapshot suitable for a settings screen or a HUD. */
    state() {
      return {
        backend: be.kind,
        muted,
        gains: { ...gains },
        playing: active.size,
        loops: [...loopIndex.keys()],
      };
    },

    dispose() {
      be.dispose?.();
      active.clear();
      loopIndex.clear();
    },
  };

  return system;
}
