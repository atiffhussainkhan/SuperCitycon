/**
 * V4 — application entry point.
 *
 * Boots the engine, the editor, the runtime systems and the demo level, then
 * runs one loop that drives all of them. The editor and the runtime share one
 * world: pressing Play does not reload a level, it switches the same scene
 * from edit mode to simulation mode, which is what makes "edit what you play"
 * true rather than aspirational.
 *
 * Everything optional (the editor, the NPC system, the HUD) is loaded
 * dynamically, so a missing module degrades with a logged message instead of
 * taking the whole app down.
 */

import { createWorld, Tags } from './core/ecs.js';
import { createEventBus, Events } from './core/events.js';
import { createRegistry } from './core/serialization.js';
import { createSceneManager, createLocalStorageAdapter } from './core/scene.js';
import { createClock, createProfiler } from './core/time.js';
import { createLogger } from './core/log.js';
import { createRenderer, createCameraRig } from './render/renderer.js';
import { createInput } from './input/input.js';
import { createPhysicsWorld } from './physics/physics.js';

const appRoot = document.getElementById('v4-app')
  ?? document.getElementById('app')
  ?? document.body;

/**
 * The canvas the renderer draws into.
 *
 * The page is not required to provide one: the editor builds its own DOM and
 * then adopts whatever canvas it is handed, so the app owns the canvas and
 * the editor owns the layout around it.
 */
function ensureCanvas() {
  let el = document.getElementById('viewport');
  if (!el) {
    el = document.createElement('canvas');
    el.id = 'viewport';
    el.setAttribute('style', 'display:block;width:100%;height:100%;outline:none;touch-action:none;');
    appRoot.appendChild(el);
  }
  return el;
}

/** The HUD's overlay container. Created when the page has none. */
function ensureHud() {
  let el = document.getElementById('hud');
  if (!el) {
    el = document.createElement('div');
    el.id = 'hud';
    el.setAttribute('style', 'position:absolute;inset:0;pointer-events:none;');
    document.body.appendChild(el);
  }
  return el;
}

const canvas = ensureCanvas();
const hudRoot = ensureHud();

const bus = createEventBus();
const logger = createLogger({ level: 'info', bus });
logger.installGlobalHandlers();

const world = createWorld();
const registry = createRegistry().registerBuiltins();
const clock = createClock({ fixedStep: 1 / 60 });
const profiler = createProfiler();
const renderer = createRenderer({ canvas, quality: 'medium' });
const input = createInput({ target: window });
const physics = createPhysicsWorld({ gravity: -24, groundY: 0 });
const sceneManager = createSceneManager({ world, registry, bus, storage: createLocalStorageAdapter() });
const cameraRig = createCameraRig({ camera: renderer.camera });

/** Everything the harness and the developer console can inspect. */
const v4 = {
  version: '4.0.0',
  world, bus, registry, clock, profiler, renderer, input, physics, sceneManager, logger,
  editor: null, npc: null, hud: null, player: null, level: null,
  /** The live gameplay systems, so the developer console can inspect them. */
  get controller() { return controller; },
  get interaction() { return interaction; },
  mode: 'edit',
  ready: false,
  errors: [],
  stats: () => profiler.stats(),
  gpu: () => renderer.gpuInfo(),
  setMode(mode) {
      if (mode !== 'edit' && mode !== 'play') return false;
      v4.mode = mode;
      v4.editor?.setMode?.(mode);
      bus.emit(Events.MODE_CHANGED, { mode });
      return true;
    },
  pause() { clock.paused = true; bus.emit(Events.PAUSED, { paused: true }); },
  resume() { clock.paused = false; bus.emit(Events.PAUSED, { paused: false }); },
};
window.__v4 = v4;

/**
 * Optional subsystems, loaded dynamically so one failure cannot kill the app.
 *
 * The importer is passed as a thunk with a *literal* path on purpose: a
 * bundler can only code-split a dynamic import it can see statically. Passing
 * a path variable instead leaves `import(path)` untouched in the production
 * bundle, and every optional subsystem then 404s at runtime.
 */
async function loadOptional(name, importer, apply) {
  try {
    const mod = await importer();
    apply(mod);
    logger.info(`loaded ${name}`);
    return true;
  } catch (err) {
    logger.warn(`${name} unavailable: ${err?.message ?? err}`);
    return false;
  }
}

/** One fixed simulation step. */
function simulate(dt) {
  if (v4.mode !== 'play') return;
  physics.step(dt);
  controller?.update(dt);
  interaction?.update(dt);
  v4.npc?.update(dt);
  driveNpcAnimations();
  for (const animator of animators.values()) animator.update(dt);
}

/**
 * Point each NPC's animator at the state its behaviour is in.
 *
 * A patrolling NPC walks, an idle one stands: the behaviour machine decides,
 * the animator follows.
 */
function driveNpcAnimations() {
  const states = v4.npc?.debugState?.() ?? [];
  for (const npc of states) {
    const animator = animators.get(npc.id);
    if (!animator) continue;
    const moving = npc.state === 'patrol' || npc.state === 'chase' || npc.state === 'return';
    animator.setCondition('moving', moving);
    animator.setCondition('sprinting', npc.state === 'chase');
  }
}

let controller = null;
let interaction = null;
let objectives = null;
let pause = null;
const animators = new Map();

/** The last thing that was said or read, shown by the HUD. */
let lastMessage = null;

/** The player's real health, read from the entity's component. */
function playerHealth() {
  const player = world.query(Tags.PLAYER)[0];
  const health = player ? world.getComponent(player.id, 'health') : null;
  return {
    current: health?.current ?? 100,
    max: health?.max ?? 100,
  };
}

function buildHudState() {
  const stats = profiler.stats();
  const player = controller?.state ?? {};
  const health = playerHealth();
  return {
    fps: stats.fps,
    frameMs: stats.frameMs,
    drawCalls: stats.drawCalls,
    triangles: stats.triangles,
    npcCount: v4.npc?.count?.() ?? 0,
    health,
    objective: objectives?.currentText?.() || 'Explore the district',
    prompt: interaction?.prompt?.() ?? player.prompt ?? '',
    // A line stays on screen for a few seconds and then fades.
    message: lastMessage && Date.now() - lastMessage.at < 6000 ? lastMessage.text : '',
    // The HUD reads `animState`; `animationState` is kept as an alias so
    // other consumers can use either name.
    animState: animators.get(v4.player)?.state ?? player.animationState ?? '-',
    animationState: animators.get(v4.player)?.state ?? player.animationState ?? '-',
    position: player.position ?? null,
    mode: v4.mode,
  };
}

async function boot() {
  // --- the editor ------------------------------------------------------------
  await loadOptional('editor', () => import('./editor/editor.js'), (mod) => {
    v4.editor = mod.createEditor({
      world, bus, registry, sceneManager, renderer, input, logger, canvas,
    });
  });

  // --- the runtime systems --------------------------------------------------
  await loadOptional('character controller', () => import('./gameplay/character-controller.js'), (mod) => {
    controller = mod.createCharacterController({
      world, bus, input, physics, logger,
      // The camera steers the movement: "forward" is the way the camera is
      // looking, not a fixed world axis.
      camera: renderer.camera,
    });
  });
  await loadOptional('interaction system', () => import('./gameplay/interaction.js'), (mod) => {
    interaction = mod.createInteractionSystem({ world, bus, input, logger });
  });
  await loadOptional('objectives', () => import('./gameplay/objectives.js'), (mod) => {
    objectives = mod.createObjectives({
      bus,
      objectives: [
        { id: 'explore', text: 'Explore the district', state: 'active' },
        { id: 'talk', text: 'Speak to the villagers', state: 'pending' },
        { id: 'chest', text: 'Look inside the chest', state: 'pending' },
      ],
    });
  });
  await loadOptional('hud', () => import('./gameplay/hud.js'), (mod) => {
    v4.hud = mod.createHud({ container: hudRoot, bus });
  });

  // --- pause ----------------------------------------------------------------
  // The pause module is wired here so the Escape key really pauses the game.
  // It is read from the frame loop rather than from the simulation, because a
  // paused clock stops the fixed steps — a game paused with the keyboard
  // could otherwise never be resumed.
  await loadOptional('pause', () => import('./gameplay/pause.js'), (mod) => {
    pause = mod.createPause({ clock, bus, input });
    v4.pause = () => pause.pause();
    v4.resume = () => pause.resume();
  });

  // --- the demo level -------------------------------------------------------
  try {
    const levels = await import('./levels/demo-level.js');
    v4.level = await levels.buildDemoLevel({ world, registry, bus, renderer, physics, logger });
    logger.info(`demo level built: ${v4.level.entityCount ?? '?'} entities`);
  } catch (err) {
    logger.error(`demo level failed to build: ${err?.message ?? err}`, err?.stack ?? null);
  }

  // The level owns the NPC system: it is the only thing that knows which
  // navigation cells its own buildings block. Adopting the level's instance
  // is what keeps the NPCs from walking through the village.
  if (v4.level?.npcSystem) {
    v4.npc = v4.level.npcSystem;
  } else {
    await loadOptional('npc system', () => import('./npc/npc.js'), (mod) => {
      v4.npc = mod.createNpcSystem({ world, bus, physics, logger });
    });
  }

  // --- wire the animations --------------------------------------------------
  // Every animated entity gets its controller registered, not just the player:
  // the NPCs animate too.
  const playerEntity = world.query(Tags.PLAYER)[0];
  for (const entity of world.entities.values()) {
    const anim = world.getComponent(entity.id, 'animation');
    if (anim?.controller) animators.set(entity.id, anim.controller);
  }
  if (playerEntity) {
    v4.player = playerEntity.id;
    // The character controller drives the animator's state machine.
    controller?.setAnimator?.(animators.get(playerEntity.id) ?? null);
  }

  // --- a loaded scene restores the objects, not just the data ---------------
  bus.on(Events.SCENE_LOADED, ({ name }) => {
    const doc = sceneManager.current?.doc;
    const applied = v4.level?.applyScene?.(doc);
    const rebound = v4.level?.rebindAnimators?.() ?? [];
    const reboundInteractions = v4.level?.rebindInteractions?.() ?? [];
    animators.clear();
    for (const entity of world.entities.values()) {
      const anim = world.getComponent(entity.id, 'animation');
      if (anim?.controller) animators.set(entity.id, anim.controller);
    }
    const player = world.query(Tags.PLAYER)[0];
    if (player) {
      v4.player = player.id;
      controller?.setAnimator?.(animators.get(player.id) ?? null);
    }
    logger.info(`scene "${name}" restored: ${applied?.applied ?? 0} objects, ${rebound.length} animators, ${reboundInteractions.length} interactions`);
  });

  // --- keep the app's mode in step with the editor's ------------------------
  // The editor owns the Play/Edit buttons, so it emits MODE_CHANGED. Without
  // this listener, clicking "Play" in the editor would leave the simulation
  // paused — the world would look frozen and nothing would respond.
  bus.on(Events.MODE_CHANGED, ({ mode }) => {
    if (mode === v4.mode) return;
    v4.mode = mode === 'play' ? 'play' : 'edit';
    logger.info(`mode: ${v4.mode}`);
  });

  // --- what the player hears and reads --------------------------------------
  // An interaction produces a result and an NPC produces a line; without a
  // listener both were computed and thrown away, so pressing E looked like
  // it did nothing at all.
  bus.on(Events.INTERACTION, (payload) => {
    const text = payload?.result?.text
      ?? (typeof payload?.result === 'string' ? payload.result : null)
      ?? payload?.prompt
      ?? null;
    if (text) lastMessage = { text: String(text), at: Date.now() };
  });
  bus.on('npc:line', (payload) => {
    if (payload?.text) lastMessage = { text: `${payload.speaker}: ${payload.text}`, at: Date.now() };
  });

  v4.ready = true;
  bus.emit(Events.WORLD_READY, { entities: world.entityCount });
  logger.info(`V4 ready — ${world.entityCount} entities, ${renderer.gpuInfo().renderer ?? 'unknown GPU'}`);
  document.body?.setAttribute('data-v4-ready', '1');
}

/** The frame loop. */
let lastStats = null;
function frame(now) {
  requestAnimationFrame(frame);
  const { delta, steps } = clock.tick(now);
  profiler.beginFrame(now);

  // The pause key is read outside the simulation: a paused clock stops the
  // fixed steps, so a game paused with the keyboard could never be resumed.
  pause?.update?.();

  if (!clock.paused && steps > 0) {
    for (let i = 0; i < steps; i += 1) {
      simulate(clock.fixedStep);
      // One key press must trigger one action. The clock catches up with
      // several fixed steps in a single frame, and every one of them would
      // otherwise read the same key-down edge: one press of E would
      // interact five times, one press of Escape would toggle the pause
      // five times. The first step consumes the edge.
      if (i === 0) input.consumeEdges();
    }
  } else if (v4.mode === 'play' && !clock.paused) {
    // A slow frame still needs the NPC/animation state to advance smoothly —
    // but a paused game must not animate either.
    for (const animator of animators.values()) animator.update(delta);
  }

  // Scene transitions are driven by the scene manager, not by the loader.
  sceneManager.update(now);

  v4.editor?.update?.(delta, now);

  // The simulation writes to the entities' transforms; the meshes follow.
  v4.level?.syncTransforms?.();

  // The editor relocates the canvas into its own viewport element, so the HUD
  // overlay follows it there instead of covering the whole page.
  if (hudRoot.parentElement !== canvas.parentElement) {
    canvas.parentElement?.appendChild(hudRoot);
  }

  // Camera: in play mode the runtime rig follows the player; in edit mode the
  // editor owns the camera (it drives the orbit, the pan and the zoom), so
  // the app must not fight it for the same transform.
  if (v4.mode === 'play') {
    const p = controller?.state?.position;
    if (p) cameraRig.updateFollow(p, delta);
  }

  syncRendererSize();

  lastStats = renderer.render();
  profiler.endFrame(performance.now(), lastStats);
  input.endFrame();
  // The HUD is live in both modes: in edit mode it reports the frame cost and
  // the entity count, in play mode it also reports the player's state.
  // `v4.hud` — not a bare `hud`: an element with the id "hud" becomes a
  // global, so a bare `hud` would silently resolve to the DOM node.
  v4.hud?.update?.(buildHudState());
  bus.emit(Events.FRAME, { delta, stats: profiler.stats() });
}

/**
 * Match the drawing buffer to the canvas's real size.
 *
 * The renderer starts at a nominal 1280x720; once the editor has laid the
 * canvas out, the buffer has to follow it or the picture is stretched.
 */
let bufferWidth = 0;
let bufferHeight = 0;
function syncRendererSize() {
  const w = Math.round(canvas.clientWidth || 0);
  const h = Math.round(canvas.clientHeight || 0);
  if (w < 1 || h < 1) return;
  if (w === bufferWidth && h === bufferHeight) return;
  bufferWidth = w;
  bufferHeight = h;
  renderer.resize(w, h);
}

boot().then(() => {
  requestAnimationFrame(frame);
}).catch((err) => {
  logger.error(`boot failed: ${err?.message ?? err}`, err?.stack ?? null);
  document.body?.setAttribute('data-v4-ready', 'error');
});
