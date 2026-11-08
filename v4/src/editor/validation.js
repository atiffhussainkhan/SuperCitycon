/**
 * V4 editor — scene validation.
 *
 * The validator answers one question: "would this scene misbehave when it
 * runs?" It reports problems as `{level, message}` records so the editor can
 * show them in the console strip and the host can surface them as a report.
 */

import { MODEL_CATALOGUE } from '../render/asset-loader.js';

const KNOWN_MODEL_IDS = new Set(MODEL_CATALOGUE.map((m) => m.id));

/**
 * @typedef {{level:'error'|'warn', message:string, entityId?:number, code?:string}} Issue
 */

/**
 * Validate the live world.
 * @param {any} world
 * @param {any} [registry] - optional component registry (used to check known types)
 * @returns {Issue[]}
 */
export function validateScene(world, registry = null) {
  /** @type {Issue[]} */
  const issues = [];

  if (!world || typeof world.entities?.values !== 'function') return issues;

  const entities = [...world.entities.values()];
  const nameCounts = new Map();
  for (const entity of entities) {
    const key = String(entity.name ?? '').trim().toLowerCase();
    nameCounts.set(key, (nameCounts.get(key) ?? 0) + 1);
  }

  for (const entity of entities) {
    const label = `${entity.name} [${entity.id}]`;

    // 1. No components at all.
    if (entity.components.size === 0) {
      issues.push({
        level: 'error',
        code: 'no-components',
        entityId: entity.id,
        message: `${label} has no components`,
      });
    }

    // 2. Missing transform.
    const transform = entity.components.get('transform');
    if (!transform) {
      issues.push({
        level: 'error',
        code: 'missing-transform',
        entityId: entity.id,
        message: `${label} has no transform component`,
      });
    } else {
      // 3. NaN / non-finite values in the transform.
      const bad = findNonFinite(transform.position) || findNonFinite(transform.rotation) || findNonFinite(transform.scale);
      if (bad) {
        issues.push({
          level: 'error',
          code: 'nan-transform',
          entityId: entity.id,
          message: `${label} has a non-finite transform value (${bad})`,
        });
      }
    }

    // 4. Duplicate names.
    const key = String(entity.name ?? '').trim().toLowerCase();
    if (nameCounts.get(key) > 1) {
      issues.push({
        level: 'error',
        code: 'duplicate-name',
        entityId: entity.id,
        message: `${label} shares its name with ${nameCounts.get(key) - 1} other object(s)`,
      });
    }

    // 5. Missing / unknown asset references.
    const mesh = entity.components.get('mesh');
    if (mesh) {
      const ref = mesh.model ?? mesh.asset ?? mesh.modelId ?? mesh.assetId ?? null;
      if (ref !== null && ref !== undefined && ref !== '') {
        if (!KNOWN_MODEL_IDS.has(String(ref))) {
          issues.push({
            level: 'error',
            code: 'missing-asset',
            entityId: entity.id,
            message: `${label} references a missing asset "${ref}"`,
          });
        }
      } else if (mesh.kind && !KNOWN_MESH_KINDS.has(String(mesh.kind))) {
        // A custom kind is legal (the host may know how to draw it), so this
        // is a hint rather than an error.
        issues.push({
          level: 'warn',
          code: 'unknown-mesh-kind',
          entityId: entity.id,
          message: `${label} uses an unfamiliar mesh kind "${mesh.kind}"`,
        });
      }
      if (mesh.size && findNonFinite(mesh.size)) {
        issues.push({
          level: 'error',
          code: 'nan-transform',
          entityId: entity.id,
          message: `${label} has a non-finite mesh size`,
        });
      }
    }

    const physics = entity.components.get('physics');
    if (physics && physics.halfExtents && findNonFinite(physics.halfExtents)) {
      issues.push({
        level: 'error',
        code: 'nan-transform',
        entityId: entity.id,
        message: `${label} has non-finite physics half extents`,
      });
    }

    // 6. Unknown component type (only when a registry is available).
    if (registry && typeof registry.has === 'function') {
      for (const type of entity.components.keys()) {
        if (!registry.has(type)) {
          issues.push({
            level: 'warn',
            code: 'unknown-component',
            entityId: entity.id,
            message: `${label} has an unregistered component "${type}"`,
          });
        }
      }
    }
  }

  return issues;
}

/** Mesh kinds the built-in renderer knows how to draw. */
const KNOWN_MESH_KINDS = new Set([
  'box', 'cube', 'sphere', 'plane', 'cylinder', 'cone', 'capsule',
  'torus', 'circle', 'circleGeometry', 'boxGeometry', 'sphereGeometry',
  'planeGeometry', 'cylinderGeometry', 'coneGeometry', 'capsuleGeometry',
  'torusGeometry', 'mesh', 'model', 'none',
]);

/**
 * Return a description of the first non-finite number in an array, or null.
 * @param {any} values
 * @returns {string|null}
 */
function findNonFinite(values) {
  if (!Array.isArray(values)) return null;
  for (let i = 0; i < values.length; i += 1) {
    const v = values[i];
    if (typeof v === 'number' && !Number.isFinite(v)) return `[${i}]=${v}`;
  }
  return null;
}
