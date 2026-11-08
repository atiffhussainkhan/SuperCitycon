/**
 * V4 editor — transform gizmo.
 *
 * A `TransformControls` gizmo drives a hidden anchor object. The anchor is
 * positioned at the pivot of the current selection; when the user drags an
 * axis, the resulting world-space delta is written back into the ECS
 * transform of every selected entity, which keeps the editor, the runtime
 * and the save format in agreement.
 *
 * Snapping is delegated to TransformControls (translation / rotation / scale).
 */

import * as THREE from 'three';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import { composeMatrix } from '../core/transform.js';
import {
  resolveParentTransform,
  snapshotTransform,
  createTransformCommand,
} from './undo.js';

/** Rotation snap step, in radians (15°). */
const ROTATION_SNAP = Math.PI / 12;
/** Scale snap step. */
const SCALE_SNAP = 0.1;

/**
 * The world matrix of an entity, computed from the ECS transform chain.
 * @param {any} world
 * @param {number} entityId
 * @returns {THREE.Matrix4}
 */
export function entityWorldMatrix(world, entityId) {
  const transform = world.getComponent(entityId, 'transform');
  if (!transform) return new THREE.Matrix4();
  return transformWorldMatrix(world, transform, 0);
}

/**
 * @param {any} world
 * @param {any} transform
 * @param {number} depth
 * @returns {THREE.Matrix4}
 */
function transformWorldMatrix(world, transform, depth) {
  const local = new THREE.Matrix4().fromArray(composeMatrix(
    transform.position ?? [0, 0, 0],
    transform.rotation ?? [0, 0, 0],
    transform.scale ?? [1, 1, 1],
  ));
  const parent = resolveParentTransform(world, transform);
  if (!parent || depth > 32) return local;
  return new THREE.Matrix4().multiplyMatrices(transformWorldMatrix(world, parent, depth + 1), local);
}

/**
 * @param {any} world
 * @param {any} transform
 * @returns {THREE.Matrix4}
 */
function parentWorldMatrix(world, transform) {
  const parent = resolveParentTransform(world, transform);
  if (!parent) return new THREE.Matrix4();
  return transformWorldMatrix(world, parent, 0);
}

/**
 * @param {{ctx:any}} deps
 */
export function createGizmos({ ctx }) {
  const controls = new TransformControls(ctx.renderer.camera, ctx.canvas);
  controls.size = 0.9;
  controls.setMode('translate');
  const helper = controls.getHelper();
  ctx.renderer.scene.add(helper);

  /** The object TransformControls actually manipulates. */
  const anchor = new THREE.Object3D();
  anchor.name = 'v4-gizmo-anchor';
  ctx.renderer.scene.add(anchor);

  let mode = 'translate';
  let space = 'world';
  let attached = false;
  let dragging = false;
  /** @type {Record<number, any>|null} */
  let before = null;
  let startMatrix = null;
  let startMatrixInverse = null;

  function applySnap() {
    const snap = ctx.snapEnabled;
    controls.setTranslationSnap(snap ? ctx.snapSize : null);
    controls.setRotationSnap(snap ? ROTATION_SNAP : null);
    controls.setScaleSnap(snap ? SCALE_SNAP : null);
  }
  applySnap();

  function captureTransforms() {
    /** @type {Record<number, any>} */
    const out = {};
    for (const id of ctx.selection) {
      const transform = ctx.world.getComponent(id, 'transform');
      if (transform) out[id] = snapshotTransform(transform);
    }
    return out;
  }

  function onMouseDown() {
    dragging = true;
    before = captureTransforms();
    anchor.updateMatrixWorld(true);
    startMatrix = anchor.matrixWorld.clone();
    startMatrixInverse = startMatrix.clone().invert();
  }

  function onObjectChange() {
    if (!dragging || !startMatrixInverse) return;
    applyDelta();
  }

  /**
   * Write the anchor's world-space change back into every selected entity.
   *
   * The delta is the full world transform `anchorNow * anchorStart⁻¹`, so a
   * scale or a rotation happens around the pivot (the selection centre)
   * rather than around the world origin.
   */
  function applyDelta() {
    anchor.updateMatrixWorld(true);
    const delta = new THREE.Matrix4().multiplyMatrices(anchor.matrixWorld, startMatrixInverse);

    for (const id of ctx.selection) {
      const transform = ctx.world.getComponent(id, 'transform');
      if (!transform) continue;
      const snapshot = before?.[id];
      if (!snapshot) continue;

      const parentWorld = parentWorldMatrix(ctx.world, transform);
      const localStart = new THREE.Matrix4().fromArray(composeMatrix(snapshot.position, snapshot.rotation, snapshot.scale));
      const worldStart = parentWorld.clone().multiply(localStart);
      const newWorld = delta.clone().multiply(worldStart);
      const newLocal = parentWorld.clone().invert().multiply(newWorld);

      const position = new THREE.Vector3();
      const quaternion = new THREE.Quaternion();
      const scale = new THREE.Vector3();
      newLocal.decompose(position, quaternion, scale);
      const euler = new THREE.Euler().setFromQuaternion(quaternion, 'XYZ');

      transform.position = [position.x, position.y, position.z];
      transform.rotation = [euler.x, euler.y, euler.z];
      transform.scale = [scale.x, scale.y, scale.z];
      transform.dirty = true;
      for (const child of transform.children ?? []) if (child && typeof child === 'object') child.dirty = true;
    }
    ctx.onTransformChanged?.();
  }

  function onMouseUp() {
    if (!dragging) return;
    dragging = false;
    const after = captureTransforms();
    const changed = before && Object.keys(before).some((id) => {
      const a = before[id];
      const b = after[id];
      if (!a || !b) return false;
      return a.position.some((v, i) => Math.abs(v - b.position[i]) > 1e-9)
        || a.rotation.some((v, i) => Math.abs(v - b.rotation[i]) > 1e-9)
        || a.scale.some((v, i) => Math.abs(v - b.scale[i]) > 1e-9);
    });
    if (changed) {
      ctx.undo.push(createTransformCommand({
        world: ctx.world, before, after, label: `${mode === 'translate' ? 'Move' : mode === 'rotate' ? 'Rotate' : 'Scale'}`,
      }));
    }
    before = null;
    startMatrix = null;
    startMatrixInverse = null;
    // The anchor's scale is a scratch value for the current drag only.
    anchor.scale.set(1, 1, 1);
  }

  controls.addEventListener('mouseDown', onMouseDown);
  controls.addEventListener('objectChange', onObjectChange);
  controls.addEventListener('mouseUp', onMouseUp);

  /** World-space pivot of the current selection. */
  function pivot() {
    const center = new THREE.Vector3();
    let count = 0;
    for (const id of ctx.selection) {
      const matrix = entityWorldMatrix(ctx.world, id);
      center.add(new THREE.Vector3().setFromMatrixPosition(matrix));
      count += 1;
    }
    if (count > 0) center.multiplyScalar(1 / count);
    return center;
  }

  /** Orientation used for the 'local' gizmo space. */
  function localOrientation() {
    const id = ctx.selection[0];
    if (id == null) return new THREE.Quaternion();
    const matrix = entityWorldMatrix(ctx.world, id);
    const quaternion = new THREE.Quaternion();
    matrix.decompose(new THREE.Vector3(), quaternion, new THREE.Vector3());
    return quaternion;
  }

  return {
    get mode() { return mode; },
    get space() { return space; },
    get dragging() { return dragging; },
    get controls() { return controls; },
    /** The gizmo object added to the scene — hidden while the preview renders. */
    get helper() { return helper; },
    /** True when the pointer is over a gizmo handle — used to suppress picking. */
    get hovering() { return controls.axis !== null; },

    setMode(next) {
      if (next !== 'translate' && next !== 'rotate' && next !== 'scale') return false;
      mode = next;
      controls.setMode(next);
      applySnap();
      ctx.onGizmoChanged?.(mode);
      return true;
    },

    setSpace(next) {
      space = next === 'local' ? 'local' : 'world';
      controls.setSpace(space);
      ctx.onGizmoChanged?.(mode);
      return space;
    },

    setSnap(enabled, size) {
      ctx.snapEnabled = !!enabled;
      if (typeof size === 'number' && size > 0) ctx.snapSize = size;
      applySnap();
    },

    setEnabled(enabled) {
      controls.enabled = !!enabled;
      helper.visible = !!enabled && attached;
    },

    /** Keep the gizmo in step with the selection. */
    update() {
      const ids = ctx.selection;
      if (ids.length === 0) {
        if (attached) {
          controls.detach();
          attached = false;
        }
        helper.visible = false;
        return;
      }
      if (!attached) {
        controls.attach(anchor);
        attached = true;
      }
      helper.visible = ctx.mode === 'edit' && controls.enabled !== false;
      if (dragging) return;

      anchor.position.copy(pivot());
      anchor.quaternion.copy(space === 'local' ? localOrientation() : new THREE.Quaternion());
      anchor.scale.set(1, 1, 1);
      anchor.updateMatrixWorld(true);
    },

    dispose() {
      controls.removeEventListener('mouseDown', onMouseDown);
      controls.removeEventListener('objectChange', onObjectChange);
      controls.removeEventListener('mouseUp', onMouseUp);
      // three r169's TransformControls.dispose() calls this.traverse() on a
      // non-Object3D and throws, so disconnect and clean up the helper here.
      try {
        controls.disconnect?.();
      } catch { /* the dom element may already be gone */ }
      ctx.renderer.scene.remove(helper);
      ctx.renderer.scene.remove(anchor);
      helper.traverse?.((obj) => {
        obj.geometry?.dispose?.();
        if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose?.());
        else obj.material?.dispose?.();
      });
    },
  };
}
