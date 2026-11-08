/**
 * V4 — The demo level.
 *
 * A small but real scene: a ground plane, a village square built from the
 * CLEARED model catalogue, a player, four NPCs with different brains, two
 * interactive props and some lights.
 *
 * Every model comes from `MODEL_CATALOGUE` (the KayKit / Avramania / Holokat
 * packs the project already owns and has already cleared). Nothing here
 * loads from the quarantined 2D corpus, and nothing is generated.
 *
 * The function is async because the models have to be loaded before they can
 * be placed in the scene. When there is no DOM (Node tests) the loader is
 * skipped and simple primitives stand in for the models, so the level can
 * still be built and inspected headlessly.
 */

import * as THREE from 'three';
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { Tags } from '../core/ecs.js';
import { createTransform } from '../core/transform.js';
import { loadModels, MODEL_CATALOGUE } from '../render/asset-loader.js';
import { createAnimator } from '../anim/animator.js';
import { createNpcSystem } from '../npc/npc.js';
import { createNavGrid } from '../npc/pathfinding.js';

/** The environment props, all from the cleared catalogue. */
export const DEMO_PROPS = Object.freeze([
  { id: 'nature.bank', position: [-12, 0, -9], scale: 1.6, rotation: 0.3, collider: null },
  { id: 'nature.birch', position: [-6.5, 0, -12], scale: 1.0, rotation: 0, collider: null },
  { id: 'nature.boulder', position: [9, 0, -10], scale: 1.3, rotation: 0.8, collider: { half: 1.1, height: 1.2 } },
  { id: 'nature.bush', position: [-2, 0, -6], scale: 1.0, rotation: 0.4, collider: null },
  { id: 'props.cafe', position: [14, 0, 4], scale: 1.0, rotation: -Math.PI / 2, collider: { half: 3.2, height: 3.0 } },
  { id: 'props.warehouse', position: [-14, 0, 6], scale: 1.0, rotation: Math.PI / 2, collider: { half: 3.4, height: 3.2 } },
  { id: 'citybits.road_straight', position: [0, 0, -1], scale: 1.0, rotation: 0, collider: null },
  { id: 'citybits.building_a', position: [11, 0, -16], scale: 1.0, rotation: 0.2, collider: { half: 3.0, height: 4.0 } },
  { id: 'citybits.car_sedan', position: [5, 0, 5], scale: 1.0, rotation: Math.PI, collider: null },
]);

/** The player's model. */
export const PLAYER_MODEL = 'character.kaykit';

/** The four NPCs: different brains, different cleared character models. */
export const DEMO_NPCS = Object.freeze([
  {
    name: 'Barista',
    model: 'character.barbarian',
    behaviour: 'idle',
    position: [6, 0.9, 2],
    difficulty: 'easy',
    patrol: [],
    wander: false,
    alertable: false,
    dialogue: [
      { speaker: 'Barista', text: 'The coffee is fresh. Or it was.' },
      { speaker: 'Barista', text: 'Watch out for the guard up north.' },
    ],
  },
  {
    name: 'Courier',
    model: 'character.rogue',
    behaviour: 'patrol',
    position: [4, 0.9, -6],
    difficulty: 'normal',
    patrol: [[4, 0.9, -6], [10, 0.9, -4], [10, 0.9, 2], [4, 0.9, 0]],
    wander: false,
    dialogue: [
      { speaker: 'Courier', text: 'Special delivery. Do not touch.' },
    ],
  },
  {
    name: 'Guard',
    model: 'character.mage',
    behaviour: 'idle',
    position: [-4, 0.9, 2],
    difficulty: 'normal',
    patrol: [],
    wander: false,
    sight: 10,
    dialogue: [
      { speaker: 'Guard', text: 'You are not from around here.' },
      { speaker: 'Guard', text: 'Turn around and walk back.' },
    ],
  },
  {
    name: 'Drifter',
    model: 'citizen.casual_male',
    behaviour: 'idle',
    position: [-8, 0.9, -4],
    difficulty: 'easy',
    patrol: [],
    wander: true,
    alertable: false,
    wanderRadius: 5,
    wanderInterval: 4,
    dialogue: [
      { speaker: 'Drifter', text: 'Good day for a walk.' },
    ],
  },
]);

/** The interactive props. */
export const DEMO_INTERACTIVE = Object.freeze([
  {
    name: 'Chest',
    kind: 'chest',
    position: [-3, 0.4, 3],
    prompt: 'Open chest',
    once: true,
    rotation: 0.4,
  },
  {
    name: 'Sign',
    kind: 'sign',
    position: [2.5, 0.9, -4],
    prompt: 'Read sign',
    once: false,
    rotation: -0.2,
  },
]);

/** The lights. */
export const DEMO_LIGHTS = Object.freeze([
  { name: 'Sun', type: 'directional', colour: '#fff4e0', intensity: 2.0, position: [12, 18, 8], rotation: [-0.9, 0.6, 0] },
  { name: 'Lamp', type: 'point', colour: '#ffd39a', intensity: 12, position: [8, 4.5, 2], rotation: [0, 0, 0] },
  { name: 'Sign light', type: 'point', colour: '#9fd0ff', intensity: 6, position: [-10, 3.5, 7], rotation: [0, 0, 0] },
]);

/** The catalogue ids the level needs. */
export function demoModelIds() {
  return [
    ...DEMO_PROPS.map((p) => p.id),
    PLAYER_MODEL,
    ...DEMO_NPCS.map((n) => n.model),
  ];
}

/** Is the model catalogue actually reachable? (It needs a DOM + fetch.) */
function canLoadModels() {
  return typeof document !== 'undefined' && typeof globalThis.fetch === 'function';
}

/** A primitive stand-in for a model that could not be loaded. */
function makePrimitive(kind, scale = 1) {
  let geometry;
  if (kind === 'character') {
    geometry = new THREE.CapsuleGeometry(0.35, 1.0, 4, 8);
  } else if (kind === 'building') {
    geometry = new THREE.BoxGeometry(4, 4, 4);
  } else if (kind === 'tree') {
    geometry = new THREE.ConeGeometry(1.2, 4, 6);
  } else {
    geometry = new THREE.BoxGeometry(1.4, 1.4, 1.4);
  }
  const material = new THREE.MeshStandardMaterial({ color: 0x8a94a6, roughness: 0.85, metalness: 0.05 });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.scale.setScalar(scale);
  return mesh;
}

/** Clone a loaded model. Characters keep their skeleton so they can animate. */
function cloneModel(entry) {
  const scene = entry?.scene;
  if (!scene) return null;
  try {
    // SkeletonUtils keeps the bone hierarchy intact for skinned characters;
    // a plain Object3D.clone() would leave the bones behind.
    return cloneSkeleton(scene);
  } catch {
    return scene.clone(true);
  }
}

/**
 * Build the demo level.
 *
 * @param {object} deps
 * @param {object} deps.world     the ECS world
 * @param {object} deps.registry  the component registry
 * @param {object} deps.bus       the event bus
 * @param {object} [deps.renderer] the renderer facade (its `scene` is used)
 * @param {object} [deps.physics] the physics world
 * @param {object} [deps.logger]
 * @returns {Promise<{playerId:number,npcIds:number[],interactiveIds:number[]}>}
 */
export async function buildDemoLevel({ world, registry, bus, renderer = null, physics = null, logger = null } = {}) {
  if (!world) throw new Error('buildDemoLevel requires a world');

  const scene = renderer?.scene ?? null;
  /** @type {Map<number, THREE.Object3D>} */
  const objects = new Map();
  /** entityId -> the clips its model shipped, so animators can be rebuilt. */
  const clipsByEntity = new Map();

  // ---------------------------------------------------------------- models
  const ids = demoModelIds();
  let models = { loaded: [], failed: [] };
  if (canLoadModels()) {
    models = await loadModels(ids);
    for (const failure of models.failed) {
      logger?.warn(`model failed to load: ${failure.id}`, { error: failure.error });
    }
  } else {
    models.failed = ids.map((id) => ({ id, error: 'no DOM — model loading skipped' }));
  }
  /** @type {Map<string, object>} */
  const byId = new Map();
  for (const entry of models.loaded) byId.set(entry.id, entry);

  function modelFor(id, kind) {
    const entry = byId.get(id);
    const clone = cloneModel(entry);
    if (clone) return clone;
    return makePrimitive(kind, 1);
  }

  // -------------------------------------------------------------- entities
  function addEntity(name, tags = []) {
    const entity = world.createEntity({ name, tags });
    return entity.id;
  }

  function addTransform(entityId, position, rotationY = 0, scale = 1) {
    const transform = createTransform({
      position: [position[0] ?? 0, position[1] ?? 0, position[2] ?? 0],
      rotation: [0, rotationY, 0],
      scale: [scale, scale, scale],
    });
    world.addComponent(entityId, 'transform', transform);
    return transform;
  }

  function attachModel(entityId, object3d, position, rotationY = 0, scale = 1) {
    if (!object3d) return;
    object3d.position.set(position[0] ?? 0, position[1] ?? 0, position[2] ?? 0);
    object3d.rotation.y = rotationY;
    object3d.scale.setScalar(scale);
    object3d.traverse?.((obj) => {
      if (obj.isMesh) { obj.castShadow = true; obj.receiveShadow = true; }
    });
    scene?.add(object3d);
    objects.set(entityId, object3d);
  }

  // --------------------------------------------------------------- ground
  const groundId = addEntity('Ground', [Tags.STATIC]);
  addTransform(groundId, [0, 0, 0]);
  world.addComponent(groundId, 'mesh', {
    kind: 'box', size: [60, 0.2, 60], colour: '#5c6b4a', castShadow: false, receiveShadow: true,
  });
  const groundMesh = new THREE.Mesh(
    new THREE.BoxGeometry(60, 0.2, 60),
    new THREE.MeshStandardMaterial({ color: 0x5c6b4a, roughness: 1, metalness: 0 }),
  );
  // The geometry is offset so the *top* of the slab is at y = 0, which is
  // where the entities' feet are. The mesh itself then sits at y = 0, so the
  // per-frame transform sync cannot push the ground up under the player.
  groundMesh.geometry.translate(0, -0.1, 0);
  groundMesh.position.set(0, 0, 0);
  groundMesh.receiveShadow = true;
  scene?.add(groundMesh);
  objects.set(groundId, groundMesh);

  // ---------------------------------------------------------------- props
  const propIds = [];
  for (const prop of DEMO_PROPS) {
    const entityId = addEntity(`Prop:${prop.id}`, [Tags.STATIC]);
    addTransform(entityId, prop.position, prop.rotation, prop.scale);
    world.addComponent(entityId, 'mesh', {
      kind: 'model', model: prop.id, size: [1, 1, 1], colour: '#9aa6b8', castShadow: true, receiveShadow: true,
    });
    const kind = prop.id.startsWith('props.') || prop.id.startsWith('citybits.building')
      ? 'building'
      : (prop.id === 'nature.birch' ? 'tree' : 'prop');
    attachModel(entityId, modelFor(prop.id, kind), prop.position, prop.rotation, prop.scale);
    propIds.push(entityId);

    // Big props block movement.
    if (prop.collider && physics) {
      physics.addCollider({
        min: { x: prop.position[0] - prop.collider.half, y: 0, z: prop.position[2] - prop.collider.half },
        max: { x: prop.position[0] + prop.collider.half, y: prop.collider.height, z: prop.position[2] + prop.collider.half },
        name: prop.id,
      });
    }
  }

  // ------------------------------------------------------------ navigation
  const nav = createNavGrid({ size: [64, 64], cellSize: 1, origin: [-32, -32] });
  for (const prop of DEMO_PROPS) {
    if (!prop.collider) continue;
    const half = prop.collider.half + 0.4;
    nav.blockRect(prop.position[0] - half, prop.position[2] - half, prop.position[0] + half, prop.position[2] + half);
  }
  // The sign and the chest are walk-around clutter.
  nav.blockCircle(DEMO_INTERACTIVE[0].position[0], DEMO_INTERACTIVE[0].position[2], 1.2);
  nav.blockCircle(DEMO_INTERACTIVE[1].position[0], DEMO_INTERACTIVE[1].position[2], 1.0);

  // ---------------------------------------------------------------- player
  const playerId = addEntity('Player', [Tags.PLAYER]);
  const playerPosition = [0, 0.9, 6];
  addTransform(playerId, playerPosition);
  world.addComponent(playerId, 'player', registry?.defaults?.('player') ?? {
    speed: 5, sprint: 9, jump: 6, cameraDistance: 6, cameraHeight: 2.4, mouseSensitivity: 0.0022,
  });
  world.addComponent(playerId, 'animation', registry?.defaults?.('animation') ?? {
    clip: 'Idle', speed: 1, loop: true, state: 'idle',
  });
  world.addComponent(playerId, 'health', { current: 100, max: 100 });
  world.addComponent(playerId, 'inventory', { slots: [] });
  world.addComponent(playerId, 'physics', {
    shape: 'box', halfExtents: [0.4, 0.9, 0.4], mass: 0, restitution: 0, friction: 0.8, kinematic: true,
  });
  if (physics) {
    // Kinematic: the character controller owns the body, so the physics step
    // must not integrate it a second time.
    physics.addBody({
      entityId: playerId,
      shape: 'box',
      halfExtents: [0.4, 0.9, 0.4],
      position: { x: playerPosition[0], y: playerPosition[1], z: playerPosition[2] },
      kinematic: true,
    });
  }
  attachModel(playerId, modelFor(PLAYER_MODEL, 'character'), playerPosition, 0, 1);

  // Give the player a *real* animation controller: the KayKit character model
  // ships 30 clips, and the animator drives them through the state machine.
  // The controller lives on the animation component, so the app can find it
  // the same way it finds any other animated entity.
  const playerObject = objects.get(playerId);
  const playerClips = byId.get(PLAYER_MODEL)?.animations ?? [];
  if (playerObject && playerClips.length > 0) {
    const animator = createAnimator({ root: playerObject, clips: playerClips, bus, entityId: playerId });
    const animComponent = world.getComponent(playerId, 'animation');
    if (animComponent) {
      animComponent.controller = animator;
      animComponent.clips = animator.clips();
    }
    clipsByEntity.set(playerId, playerClips);
  }

  // ------------------------------------------------------------------ NPCs
  const npcSystem = createNpcSystem({
    world,
    bus,
    physics,
    logger,
    nav,
    playerId,
    updateBudget: 8,
    seed: 20240101,
    difficulty: 'normal',
  });

  const npcIds = [];
  for (const npc of DEMO_NPCS) {
    const entityId = npcSystem.spawn({
      name: npc.name,
      position: npc.position,
      behaviour: npc.behaviour,
      patrol: npc.patrol,
      home: npc.position,
      difficulty: npc.difficulty,
      sight: npc.sight,
      wander: npc.wander,
      alertable: npc.alertable,
      wanderRadius: npc.wanderRadius,
      wanderInterval: npc.wanderInterval,
      dialogue: npc.dialogue,
      interactive: true,
      prompt: `Talk to ${npc.name}`,
    });
    npcIds.push(entityId);

    // The NPC speaks when the player interacts with it.
    const interactive = world.getComponent(entityId, 'interactive');
    if (interactive) {
      interactive.onInteract = () => npcSystem.interact(entityId);
    }

    const model = modelFor(npc.model, 'character');
    attachModel(entityId, model, npc.position, 0, 1);

    // NPCs animate too: the behaviour decides which state they are in, and
    // the animator follows it.
    const npcClips = byId.get(npc.model)?.animations ?? [];
    if (model && npcClips.length > 0) {
      if (!world.hasComponent(entityId, 'animation')) {
        world.addComponent(entityId, 'animation', {
          clip: 'Idle', speed: 1, loop: true, state: 'idle',
        });
      }
      const animator = createAnimator({ root: model, clips: npcClips, bus, entityId });
      const animComponent = world.getComponent(entityId, 'animation');
      if (animComponent) {
        animComponent.controller = animator;
        animComponent.clips = animator.clips();
      }
      clipsByEntity.set(entityId, npcClips);
    }
  }

  // ----------------------------------------------------------- interactive
  const interactiveIds = [];
  for (const item of DEMO_INTERACTIVE) {
    const entityId = addEntity(item.name, [Tags.INTERACTIVE]);
    addTransform(entityId, item.position, item.rotation);
    world.addComponent(entityId, 'mesh', {
      kind: item.kind, size: [1, 1, 1], colour: item.kind === 'chest' ? '#8a5a2b' : '#6b5a3b',
      castShadow: true, receiveShadow: true,
    });
    world.addComponent(entityId, 'interactive', {
      kind: item.kind,
      prompt: item.prompt,
      once: item.once,
      onInteract: null,
    });

    const geometry = item.kind === 'chest'
      ? new THREE.BoxGeometry(1.1, 0.7, 0.7)
      : new THREE.BoxGeometry(0.16, 1.6, 0.16);
    const mesh = new THREE.Mesh(
      geometry,
      new THREE.MeshStandardMaterial({ color: item.kind === 'chest' ? 0x8a5a2b : 0x6b5a3b, roughness: 0.9 }),
    );
    mesh.position.set(item.position[0], item.position[1], item.position[2]);
    if (item.kind === 'sign') {
      // A sign is a post with a board on top.
      const board = new THREE.Mesh(
        new THREE.BoxGeometry(1.4, 0.7, 0.08),
        new THREE.MeshStandardMaterial({ color: 0x6b5a3b, roughness: 0.9 }),
      );
      board.position.set(0, 0.85, 0);
      mesh.add(board);
    }
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene?.add(mesh);
    objects.set(entityId, mesh);

    // The behaviour of the interactive props.
    const data = world.getComponent(entityId, 'interactive');
    if (item.kind === 'chest') {
      data.onInteract = () => {
        bus?.emit?.('gameplay:chest', { entityId });
        return 'The chest is empty, except for a faded photograph.';
      };
    } else {
      data.onInteract = () => {
        bus?.emit?.('gameplay:sign', { entityId });
        return 'VILLAGE SIGN — "Guard patrols the north road."';
      };
    }
    interactiveIds.push(entityId);
  }

  // ---------------------------------------------------------------- lights
  for (const light of DEMO_LIGHTS) {
    const entityId = addEntity(`Light:${light.name}`, [Tags.LIGHT]);
    addTransform(entityId, light.position, 0);
    world.addComponent(entityId, 'light', {
      type: light.type, colour: light.colour, intensity: light.intensity, castShadow: light.type === 'directional',
    });
    let object;
    if (light.type === 'directional') {
      object = new THREE.DirectionalLight(new THREE.Color(light.colour), light.intensity);
      object.position.set(light.position[0], light.position[1], light.position[2]);
      object.castShadow = true;
      object.shadow.mapSize.set(1024, 1024);
      object.shadow.camera.left = -30;
      object.shadow.camera.right = 30;
      object.shadow.camera.top = 30;
      object.shadow.camera.bottom = -30;
      object.target.position.set(0, 0, 0);
      scene?.add(object.target);
    } else {
      object = new THREE.PointLight(new THREE.Color(light.colour), light.intensity, 24, 2);
      object.position.set(light.position[0], light.position[1], light.position[2]);
    }
    scene?.add(object);
    objects.set(entityId, object);
  }

  bus?.emit?.('world:ready', { level: 'demo' });

  /**
   * Re-apply a loaded scene document to the level's 3D objects.
   *
   * The save format stores entity *data*; the meshes live here. After a load
   * each entity's transform is pushed onto its object, so a change made in
   * the editor is visible again rather than only being in the data.
   */
  function applyScene(doc) {
    const applied = [];
    const missing = [];
    for (const raw of doc?.entities ?? []) {
      const object = objects.get(raw.id);
      const t = raw.components?.transform;
      if (!object || !t) { missing.push(raw.id); continue; }
      const p = t.position ?? [0, 0, 0];
      object.position.set(p[0] ?? 0, p[1] ?? 0, p[2] ?? 0);
      object.rotation.y = t.rotation?.[1] ?? 0;
      const s = t.scale ?? [1, 1, 1];
      object.scale.set(s[0] ?? 1, s[1] ?? 1, s[2] ?? 1);
      applied.push(raw.id);
    }
    return { applied: applied.length, missing: missing.length };
  }

  /**
   * Recreate the animation controllers after a scene load.
   *
   * An animator is a runtime handle, so it is never part of the save format.
   * The clips are still in memory, so the controllers can be rebuilt.
   */
  function rebindAnimators() {
    const rebound = [];
    for (const [entityId, clips] of clipsByEntity) {
      const object = objects.get(entityId);
      const component = world.getComponent(entityId, 'animation');
      if (!object || !component || !clips.length) continue;
      component.controller = createAnimator({ root: object, clips, bus, entityId });
      rebound.push(entityId);
    }
    return rebound;
  }

  /**
   * Copy the world's transforms onto the level's 3D objects.
   *
   * The simulation moves entities, not meshes: the character controller and
   * the NPC system both write to the entity's transform component. Without
   * this step the characters would slide through the village without moving on
   * screen, so the game would look broken even though the data was right.
   */
  function syncTransforms() {
    let synced = 0;
    for (const [entityId, object] of objects) {
      const t = world.getComponent(entityId, 'transform');
      if (!t || !object?.position) continue;
      const p = t.position ?? [0, 0, 0];
      object.position.set(p[0] ?? 0, p[1] ?? 0, p[2] ?? 0);
      const r = t.rotation ?? [0, 0, 0];
      object.rotation.set(r[0] ?? 0, r[1] ?? 0, r[2] ?? 0);
      const s = t.scale ?? [1, 1, 1];
      object.scale.set(s[0] ?? 1, s[1] ?? 1, s[2] ?? 1);
      synced += 1;
    }
    return synced;
  }

  return {
    playerId,
    npcIds,
    interactiveIds,
    propIds,
    groundId,
    entityCount: world.entityCount,
    npcSystem,
    nav,
    objects,
    applyScene,
    rebindAnimators,
    syncTransforms,
    models: { loaded: models.loaded.map((m) => m.id), failed: models.failed.map((m) => m.id) },
    catalogue: MODEL_CATALOGUE.map((m) => m.id),
  };
}
