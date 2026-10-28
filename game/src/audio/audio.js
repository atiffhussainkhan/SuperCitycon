/**
 * audio/audio.js — procedural audio for SuperCitycon.
 *
 * OWNERSHIP: TEC. Imports nothing (pure WebAudio).
 *
 * ART-SOURCE HONESTY — READ THIS FIRST:
 *   There is NO audio in the asset library. We checked every pack under
 *   `~/.minimax/asset-library` (12 packs: KayKit City Builder Bits, KayKit
 *   Adventurers, KayKit Character Animations 1.2, KayKit Dungeon, KayKit
 *   Medieval Hexagon, KayKit Skeletons, Holokat Game Assets, Avramania Nature
 *   & Terrain, Barnabe Wild Rigged Character, OGA 3D Character Pack, Quaternius
 *   Animated Animals, Quaternius Animated Character) — the number of files
 *   with a sound extension (.wav/.mp3/.ogg/.m4a/.flac/.aiff/.opus) is ZERO,
 *   and the manifest has no audio key either. The library also holds a
 *   separate 2D image catalogue, but no audio assets.
 *   Therefore every sound in this game is SYNTHESISED at runtime from
 *   oscillators and noise. No file is downloaded and no file path is
 *   referenced anywhere in this module.
 *
 * BUS MODEL (FR-TEC-077/078): Master -> { Music, SFX, Ambience, UI, Voice }.
 * Gameplay code asks for a sound by SEMANTIC NAME (`sfx.play('place')`),
 * never by asset path (FR-TEC-079).
 *
 * AUTOPLAY (FR-TEC-085, E17): `unlock()` must be called from a user gesture.
 * Until then the service is alive but silent — the game never depends on
 * audio succeeding (FR-TEC-086).
 */

/** The named buses, per FR-TEC-077. */
export const BUS_NAMES = Object.freeze(['master', 'music', 'sfx', 'ambience', 'ui', 'voice']);

/** Default bus levels, per the dossier's audio bus matrix (§4.5). */
export const DEFAULT_BUS_GAINS = Object.freeze({
  master: 1.0,
  music: 0.7,
  sfx: 1.0,
  ambience: 0.6,
  ui: 0.8,
  voice: 1.0,
});

/**
 * The sound library. Every entry is a SYNTHESIS RECIPE, not a file.
 *
 *  wave   'square' | 'triangle' | 'sawtooth' | 'sine' | 'noise'
 *  from/to  frequency sweep in Hz ('to' optional)
 *  duration   seconds
 *  gain       peak gain (0..1)
 *  bus        which named bus the sound plays into
 *  notes  optional chord: an array of frequencies played in sequence
 *  loop       true = a continuous bed, stopped with stop(name)
 */
export const SOUND_LIBRARY = Object.freeze({
  place: {
    wave: 'square', from: 520, to: 790, duration: 0.09, gain: 0.20, bus: 'sfx',
  },
  bulldoze: {
    wave: 'noise', from: 900, to: 90, duration: 0.30, gain: 0.26, bus: 'sfx',
    filter: 'lowpass', filterFreq: 1200,
  },
  error: {
    wave: 'square', from: 210, to: 150, duration: 0.17, gain: 0.18, bus: 'ui',
  },
  'day-change': {
    wave: 'triangle', notes: [392, 523, 659], step: 0.10, duration: 0.40,
    gain: 0.14, bus: 'ui',
  },
  'level-up': {
    wave: 'triangle', notes: [523, 659, 784, 1047], step: 0.075, duration: 0.42,
    gain: 0.16, bus: 'sfx',
  },
  click: {
    wave: 'square', from: 1150, to: 900, duration: 0.035, gain: 0.10, bus: 'ui',
  },
  confirm: {
    wave: 'square', from: 740, to: 990, duration: 0.085, gain: 0.15, bus: 'ui',
  },
  cancel: {
    wave: 'square', from: 520, to: 300, duration: 0.11, gain: 0.13, bus: 'ui',
  },
  ambient: {
    wave: 'noise', loop: true, from: 380, to: 380, duration: 0, gain: 0.055,
    bus: 'ambience', filter: 'lowpass', filterFreq: 380,
  },
});

/** Every sound name, in library order. */
export const SOUND_NAMES = Object.freeze(Object.keys(SOUND_LIBRARY));

/**
 * @param {number} name
 * @returns {string[]} a copy of the sound-name list
 */
export function listSounds() {
  return SOUND_NAMES.slice();
}

// --------------------------------------------------------------------------
// Internals
// --------------------------------------------------------------------------

/** Deterministic noise buffer, cached per sample rate. */
let noiseBuffer = null;
let noiseSampleRate = 0;

function getNoiseBuffer(ctx) {
  if (noiseBuffer && noiseSampleRate === ctx.sampleRate) return noiseBuffer;
  const len = Math.max(1, Math.floor(ctx.sampleRate));
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  let seed = 0x13579bdf;
  for (let i = 0; i < len; i++) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    data[i] = (seed / 4294967296) * 2 - 1;
  }
  noiseBuffer = buf;
  noiseSampleRate = ctx.sampleRate;
  return buf;
}

function scheduleTone(ctx, dest, spec, when) {
  const osc = ctx.createOscillator();
  osc.type = spec.wave || 'square';
  const to = spec.to && spec.to !== spec.from ? Math.max(1, spec.to) : null;
  osc.frequency.setValueAtTime(Math.max(1, spec.from), when);
  if (to) osc.frequency.exponentialRampToValueAtTime(to, when + spec.duration);

  const gain = ctx.createGain();
  const attack = spec.attack ?? 0.005;
  gain.gain.setValueAtTime(0.0001, when);
  gain.gain.linearRampToValueAtTime(spec.gain, when + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, when + spec.duration);

  osc.connect(gain);
  gain.connect(dest);
  osc.start(when);
  osc.stop(when + spec.duration + 0.02);
  return { osc, gain };
}

function scheduleNoise(ctx, dest, spec, when) {
  const src = ctx.createBufferSource();
  src.buffer = getNoiseBuffer(ctx);
  src.loop = true;

  const filter = ctx.createBiquadFilter();
  filter.type = spec.filter || 'lowpass';
  filter.frequency.setValueAtTime(Math.max(20, spec.from), when);
  if (spec.to && spec.to !== spec.from) {
    filter.frequency.exponentialRampToValueAtTime(Math.max(20, spec.to), when + spec.duration);
  }
  filter.Q.value = 1;

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, when);
  gain.gain.linearRampToValueAtTime(spec.gain, when + (spec.attack ?? 0.006));
  gain.gain.exponentialRampToValueAtTime(0.0001, when + spec.duration);

  src.connect(filter);
  filter.connect(gain);
  gain.connect(dest);
  src.start(when);
  src.stop(when + spec.duration + 0.02);
  return { src, gain };
}

function startLoop(ctx, dest, spec) {
  const src = ctx.createBufferSource();
  src.buffer = getNoiseBuffer(ctx);
  src.loop = true;

  const filter = ctx.createBiquadFilter();
  filter.type = spec.filter || 'lowpass';
  filter.frequency.value = spec.filterFreq || 380;

  const gain = ctx.createGain();
  const now = ctx.currentTime;
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.linearRampToValueAtTime(spec.gain, now + 1.5);

  // A slow wobble so the bed never sounds like static.
  const lfo = ctx.createOscillator();
  lfo.type = 'sine';
  lfo.frequency.value = 0.07;
  const lfoGain = ctx.createGain();
  lfoGain.gain.value = spec.gain * 0.5;
  lfo.connect(lfoGain);
  lfoGain.connect(gain.gain);

  src.connect(filter);
  filter.connect(gain);
  gain.connect(dest);
  src.start(now);
  lfo.start(now);
  return { src, gain, lfo };
}

/** Resolve an AudioContext from whatever the caller handed us. */
function resolveContext(ctx) {
  if (!ctx) return null;
  if (typeof ctx.createGain === 'function' && typeof ctx.resume === 'function') return ctx;
  if (ctx.audioContext && typeof ctx.audioContext.createGain === 'function') return ctx.audioContext;
  if (ctx.ctx?.audioContext && typeof ctx.ctx.audioContext.createGain === 'function') {
    return ctx.ctx.audioContext;
  }
  if (ctx.renderer?.audioContext) return ctx.renderer.audioContext;
  return null;
}

function createDefaultContext() {
  const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
  if (!AC) return null;
  try {
    return new AC();
  } catch {
    return null;
  }
}

// --------------------------------------------------------------------------
// The service
// --------------------------------------------------------------------------

/**
 * Create the audio service.
 *
 * @param {*} [ctx] the game context, an AudioContext, or nothing at all.
 * @returns {{
 *   play: (name:string)=>boolean,
 *   stop: (name:string)=>boolean,
 *   setMuted: (b:boolean)=>void,
 *   isMuted: ()=>boolean,
 *   unlock: ()=>Promise<boolean>,
 *   listSounds: ()=>string[],
 *   setBusVolume: (bus:string,v:number)=>boolean,
 *   getBusVolume: (bus:string)=>number,
 *   busLevels: ()=>object,
 *   suspend: ()=>void,
 *   resume: ()=>void,
 *   isAvailable: ()=>boolean,
 *   contextState: ()=>string,
 *   dispose: ()=>void,
 * }}
 */
export function createAudio(ctx) {
  let audioCtx = resolveContext(ctx);
  let muted = false;
  let disposed = false;

  /** @type {Map<string, {gain: any}>} */
  const buses = new Map();
  /** @type {Map<string, {src:any,gain:any,lfo?:any}>} */
  const loops = new Map();
  const levels = { ...DEFAULT_BUS_GAINS };

  let masterGain = null;

  function ensureContext() {
    if (disposed) return null;
    if (!audioCtx) audioCtx = createDefaultContext();
    if (!audioCtx) return null;
    if (!masterGain) buildGraph();
    return audioCtx;
  }

  function buildGraph() {
    try {
      masterGain = audioCtx.createGain();
      masterGain.gain.value = muted ? 0 : levels.master;
      masterGain.connect(audioCtx.destination);
      for (const name of BUS_NAMES) {
        if (name === 'master') continue;
        const g = audioCtx.createGain();
        g.gain.value = levels[name] ?? 1;
        g.connect(masterGain);
        buses.set(name, { gain: g });
      }
    } catch {
      masterGain = null;
    }
  }

  function busFor(name) {
    if (name === 'master') return masterGain;
    return buses.get(name)?.gain || buses.get('sfx')?.gain || masterGain;
  }

  function play(name) {
    if (disposed || muted) return false;
    const spec = SOUND_LIBRARY[name];
    if (!spec) return false;
    const audio = ensureContext();
    if (!audio || !masterGain) return false;
    if (audio.state === 'suspended') {
      // Autoplay policy: try to wake up, but never block the caller.
      try { audio.resume?.()?.catch?.(() => {}); } catch { /* ignore */ }
    }
    const dest = busFor(spec.bus);
    if (!dest) return false;

    try {
      const now = audio.currentTime;
      if (spec.loop) {
        stop(name);
        loops.set(name, startLoop(audio, dest, spec));
      } else if (Array.isArray(spec.notes)) {
        spec.notes.forEach((f, i) => {
          scheduleTone(audio, dest, {
            wave: spec.wave, from: f, to: f, duration: spec.duration, gain: spec.gain,
          }, now + i * (spec.step ?? 0.08));
        });
      } else if (spec.wave === 'noise') {
        scheduleNoise(audio, dest, spec, now);
      } else {
        scheduleTone(audio, dest, spec, now);
      }
      return true;
    } catch {
      return false;
    }
  }

  function stop(name) {
    const loop = loops.get(name);
    if (!loop) return false;
    loops.delete(name);
    try {
      loop.src?.stop?.();
      loop.lfo?.stop?.();
      loop.gain?.disconnect?.();
    } catch { /* ignore */ }
    return true;
  }

  function setMuted(b) {
    muted = !!b;
    if (masterGain) {
      try {
        masterGain.gain.value = muted ? 0 : levels.master;
      } catch { /* ignore */ }
    }
    if (muted) {
      for (const name of Array.from(loops.keys())) stop(name);
    }
  }

  async function unlock() {
    const audio = ensureContext();
    if (!audio) return false;
    try {
      if (audio.state === 'suspended') await audio.resume();
      return audio.state === 'running';
    } catch {
      return false;
    }
  }

  function setBusVolume(bus, v) {
    if (!BUS_NAMES.includes(bus)) return false;
    const value = Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : levels[bus];
    levels[bus] = value;
    if (bus === 'master') {
      if (masterGain && !muted) {
        try { masterGain.gain.value = value; } catch { /* ignore */ }
      }
      return true;
    }
    const node = buses.get(bus);
    if (node) {
      try { node.gain.gain.value = value; } catch { /* ignore */ }
    }
    return true;
  }

  function getBusVolume(bus) {
    return levels[bus] ?? 0;
  }

  function busLevels() {
    return { ...levels };
  }

  function suspend() {
    try { audioCtx?.suspend?.(); } catch { /* ignore */ }
  }

  function resume() {
    try { audioCtx?.resume?.(); } catch { /* ignore */ }
  }

  function isAvailable() {
    return !!ensureContext();
  }

  function contextState() {
    return audioCtx?.state || 'unavailable';
  }

  function dispose() {
    disposed = true;
    for (const name of Array.from(loops.keys())) stop(name);
    for (const { gain } of buses.values()) {
      try { gain.disconnect?.(); } catch { /* ignore */ }
    }
    buses.clear();
    try { masterGain?.disconnect?.(); } catch { /* ignore */ }
    masterGain = null;
  }

  // Suspend when the page is hidden, resume on return (FR-TEC-084, E5).
  if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
    try {
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) suspend(); else resume();
      });
    } catch { /* ignore */ }
  }

  return {
    play,
    stop,
    setMuted,
    isMuted: () => muted,
    unlock,
    listSounds,
    setBusVolume,
    getBusVolume,
    busLevels,
    suspend,
    resume,
    isAvailable,
    contextState,
    dispose,
  };
}
