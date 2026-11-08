/**
 * V4 — Asset loading and the model catalogue.
 *
 * The V4 world is built from the 3D models the project ALREADY owns and has
 * already cleared: the KayKit / Avramania / Holokat / Quaternius packs in
 * `game/public/assets/models` (CC0-1.0 / MIT). Nothing here may load a
 * 2D image from the unverified 2D corpus — those are quarantined.
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

/**
 * Where the cleared 3D models live. They are copied into the V4 app by
 * `v4/scripts/prepare-assets.mjs`, which copies ONLY the licence-cleared
 * 3D models and never the quarantined 2D art.
 */
export const MODEL_ROOT = 'assets/models';

/**
 * The cleared model catalogue. `licence` is copied from the shipped
 * LICENSES/ files; `redistributable` is true only for those.
 */
export const MODEL_CATALOGUE = [
  { id: 'nature.bank', file: 'nature/mdvl_nature_bank_01.glb', category: 'environment', licence: 'CC0-1.0', author: 'Avramania', redistributable: true },
  { id: 'nature.birch', file: 'nature/mdvl_nature_birch_01.glb', category: 'environment', licence: 'CC0-1.0', author: 'Avramania', redistributable: true },
  { id: 'nature.boulder', file: 'nature/mdvl_nature_boulder_01.glb', category: 'environment', licence: 'CC0-1.0', author: 'Avramania', redistributable: true },
  { id: 'nature.bush', file: 'nature/mdvl_nature_bush_01.glb', category: 'environment', licence: 'CC0-1.0', author: 'Avramania', redistributable: true },
  { id: 'props.cafe', file: 'props/Cafe.glb', category: 'building', licence: 'MIT', author: 'Holokat', redistributable: true },
  { id: 'props.clinic', file: 'props/Clinic.glb', category: 'building', licence: 'MIT', author: 'Holokat', redistributable: true },
  { id: 'props.factory', file: 'props/Factory.glb', category: 'building', licence: 'MIT', author: 'Holokat', redistributable: true },
  { id: 'props.warehouse', file: 'props/Warehouse.glb', category: 'building', licence: 'MIT', author: 'Holokat', redistributable: true },
  { id: 'props.bridge', file: 'props/Bridge.glb', category: 'building', licence: 'MIT', author: 'Holokat', redistributable: true },
  { id: 'citybits.building_a', file: 'citybits/building_A.gltf', category: 'building', licence: 'CC0-1.0', author: 'KayKit', redistributable: true },
  { id: 'citybits.building_h', file: 'citybits/building_H.gltf', category: 'building', licence: 'CC0-1.0', author: 'KayKit', redistributable: true },
  { id: 'citybits.road_straight', file: 'citybits/road_straight.gltf', category: 'building', licence: 'CC0-1.0', author: 'KayKit', redistributable: true },
  { id: 'citybits.car_sedan', file: 'citybits/car_sedan.gltf', category: 'vehicle', licence: 'CC0-1.0', author: 'KayKit', redistributable: true },
  { id: 'character.kaykit', file: 'characters/KayKit_AnimatedCharacter_v1.2.glb', category: 'character', licence: 'CC0-1.0', author: 'KayKit', redistributable: true, animated: true },
  { id: 'character.barbarian', file: 'characters/Barbarian.glb', category: 'character', licence: 'CC0-1.0', author: 'KayKit', redistributable: true, animated: true },
  { id: 'character.knight', file: 'characters/Knight.glb', category: 'character', licence: 'CC0-1.0', author: 'KayKit', redistributable: true, animated: true },
  { id: 'character.mage', file: 'characters/Mage.glb', category: 'character', licence: 'CC0-1.0', author: 'KayKit', redistributable: true, animated: true },
  { id: 'character.rogue', file: 'characters/Rogue.glb', category: 'character', licence: 'CC0-1.0', author: 'KayKit', redistributable: true, animated: true },
  { id: 'character.rogue_hooded', file: 'characters/Rogue_Hooded.glb', category: 'character', licence: 'CC0-1.0', author: 'KayKit', redistributable: true, animated: true },
  { id: 'citizen.casual_male', file: 'citizens/Casual_Male.glb', category: 'character', licence: 'CC0-1.0', author: 'Quaternius', redistributable: true, animated: true },
  { id: 'citizen.casual_female', file: 'citizens/Casual_Female.glb', category: 'character', licence: 'CC0-1.0', author: 'Quaternius', redistributable: true, animated: true },
  { id: 'citizen.casual2_male', file: 'citizens/Casual2_Male.glb', category: 'character', licence: 'CC0-1.0', author: 'Quaternius', redistributable: true, animated: true },
  { id: 'citizen.casual2_female', file: 'citizens/Casual2_Female.glb', category: 'character', licence: 'CC0-1.0', author: 'Quaternius', redistributable: true, animated: true },
];

const loader = new GLTFLoader();
const cache = new Map();

/**
 * Load a GLTF/GLB by catalogue id (or raw path). Results are cached — the
 * same character is loaded once and cloned per instance.
 *
 * @returns {Promise<{scene:THREE.Object3D, animations:THREE.AnimationClip[]}>}
 */
export async function loadModel(idOrPath) {
  const entry = MODEL_CATALOGUE.find((m) => m.id === idOrPath);
  const path = entry ? entry.file : idOrPath;
  if (cache.has(path)) return cache.get(path);

  const promise = new Promise((resolve, reject) => {
    loader.load(
      `${MODEL_ROOT}/${path}`,
      (gltf) => {
        gltf.scene.traverse((obj) => {
          if (obj.isMesh) {
            obj.castShadow = true;
            obj.receiveShadow = true;
          }
        });
        resolve({ scene: gltf.scene, animations: gltf.animations ?? [] });
      },
      undefined,
      (err) => reject(new Error(`failed to load model "${path}": ${err?.message ?? err}`)),
    );
  });
  cache.set(path, promise);
  return promise;
}

/** Load several catalogue entries at once, reporting which ones failed. */
export async function loadModels(ids) {
  const out = { loaded: [], failed: [] };
  await Promise.all(ids.map(async (id) => {
    try {
      const model = await loadModel(id);
      out.loaded.push({ id, ...model });
    } catch (err) {
      out.failed.push({ id, error: String(err.message ?? err) });
    }
  }));
  return out;
}

/** The animation clips a character model actually contains. */
export function clipNames(model) {
  return (model?.animations ?? []).map((c) => c.name);
}

/** The animation clips of a model that match a set of wanted states. */
export function pickClips(model, wanted) {
  const names = clipNames(model);
  const found = {};
  for (const [state, candidates] of Object.entries(wanted)) {
    for (const candidate of [].concat(candidates)) {
      const match = names.find((n) => n.toLowerCase() === String(candidate).toLowerCase());
      if (match) { found[state] = match; break; }
    }
  }
  return found;
}
