/**
 * V4 editor — 3D viewport.
 *
 * The host owns the canvas and the renderer; the editor adds an overlay
 * (grid, selection outlines, collision boxes), the camera controls, the
 * pointer picking and the inset preview camera.
 *
 * The inset preview is rendered with `setViewport` / `setScissor` into the
 * *same* canvas — no second WebGL context is created.
 */

import * as THREE from 'three';
import { entityWorldMatrix } from './gizmos.js';

const MIN_DISTANCE = 0.4;
const MAX_DISTANCE = 800;

/**
 * @param {{ctx:any, root:HTMLElement}} deps
 */
export function createViewport({ ctx, root }) {
  const el = document.createElement('div');
  el.className = 'v4-viewport';
  root.appendChild(el);

  // The canvas is created by the host — the editor only mounts it.
  if (ctx.canvas && ctx.canvas.parentElement !== el) el.appendChild(ctx.canvas);

  const overlay = document.createElement('div');
  overlay.className = 'v4-viewport-overlay';
  el.appendChild(overlay);

  const hud = document.createElement('div');
  hud.className = 'v4-hud';
  overlay.appendChild(hud);

  const modeBadge = document.createElement('div');
  modeBadge.className = 'v4-viewport-mode';
  modeBadge.textContent = 'edit';
  overlay.appendChild(modeBadge);

  const previewFrame = document.createElement('div');
  previewFrame.className = 'v4-preview-frame';
  previewFrame.innerHTML = '<span>preview</span>';
  overlay.appendChild(previewFrame);

  /* --------------------------------------------------------------- scene */

  const scene = ctx.renderer.scene;
  const camera = ctx.renderer.camera;

  const editorGroup = new THREE.Group();
  editorGroup.name = 'v4-editor-overlay';
  scene.add(editorGroup);

  const grid = new THREE.GridHelper(200, 200, 0x35507a, 0x1d2942);
  grid.name = 'v4-grid';
  grid.material.transparent = true;
  grid.material.opacity = 0.65;
  grid.material.depthWrite = false;
  grid.renderOrder = -1;
  editorGroup.add(grid);

  const outlineMaterial = new THREE.LineBasicMaterial({ color: 0x38bdf8, depthTest: false, transparent: true, opacity: 0.95 });
  const colliderMaterial = new THREE.LineBasicMaterial({ color: 0xfbbf24, depthTest: false, transparent: true, opacity: 0.9 });
  const unitBoxEdges = new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1));

  /** @type {Map<number, THREE.LineSegments>} */
  const outlines = new Map();
  /** @type {Map<number, THREE.LineSegments>} */
  const colliders = new Map();
  /** @type {Map<number, THREE.Mesh>} */
  const proxies = new Map();

  const raycaster = new THREE.Raycaster();
  const pointerNdc = new THREE.Vector2();
  let pickTargets = [];

  /* -------------------------------------------------------------- camera */

  const focus = new THREE.Vector3(0, 0, 0);
  let distance = 20;
  let yaw = 0.7;
  let pitch = 0.5;
  let orbiting = false;
  let panning = false;
  let lastX = 0;
  let lastY = 0;

  /** The camera focus (orbit centre) as a plain Vector3 the host can reuse. */
  function focusPoint() {
    return focus.clone();
  }

  /**
   * Place the editor camera. The host may drive the camera itself (its camera
   * rig runs after the editor's update), so this is applied again immediately
   * before the frame is rendered — the editor's view always wins in edit mode.
   */
  function applyEditorCamera() {
    if (ctx.mode !== 'edit') return;
    const cp = Math.cos(pitch);
    camera.position.set(
      focus.x + Math.sin(yaw) * distance * cp,
      focus.y + Math.sin(pitch) * distance,
      focus.z + Math.cos(yaw) * distance * cp,
    );
    camera.lookAt(focus);
  }

  function updateCamera() {
    applyEditorCamera();
  }

  /* --------------------------------------------------------------- picking */

  function entityIdOf(object) {
    let node = object;
    let guard = 0;
    while (node && guard < 64) {
      const raw = node.userData?.entityId ?? node.userData?.entity_id ?? node.userData?.entity;
      if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
      if (typeof raw === 'string' && raw.trim() !== '' && Number.isFinite(Number(raw))) return Number(raw);
      node = node.parent;
      guard += 1;
    }
    return null;
  }

  /** Local visual size of an entity (mesh size, collider size, or a default cube). */
  function localSize(entity) {
    const mesh = entity.components.get('mesh');
    if (mesh && Array.isArray(mesh.size) && mesh.size.length >= 3) {
      return new THREE.Vector3(mesh.size[0] || 1, mesh.size[1] || 1, mesh.size[2] || 1);
    }
    const physics = entity.components.get('physics');
    if (physics && Array.isArray(physics.halfExtents) && physics.halfExtents.length >= 3) {
      return new THREE.Vector3(
        (physics.halfExtents[0] || 0.5) * 2,
        (physics.halfExtents[1] || 0.5) * 2,
        (physics.halfExtents[2] || 0.5) * 2,
      );
    }
    return new THREE.Vector3(1, 1, 1);
  }

  /** Place an object from an entity's world matrix and a local size. */
  function applyTransform(object, entityId, size) {
    const matrix = entityWorldMatrix(ctx.world, entityId);
    const position = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    matrix.decompose(position, quaternion, scale);
    object.position.copy(position);
    object.quaternion.copy(quaternion);
    object.scale.set(size.x * scale.x, size.y * scale.y, size.z * scale.z);
    object.updateMatrixWorld(true);
  }

  function rebuildPickTargets() {
    // Host-owned objects that already carry an entity id.
    /** @type {Map<number, THREE.Object3D[]>} */
    const hostObjects = new Map();
    scene.traverse((object) => {
      const id = entityIdOf(object);
      if (id == null) return;
      if (!hostObjects.has(id)) hostObjects.set(id, []);
      hostObjects.get(id).push(object);
    });

    // Drop proxies for entities that the host now renders itself.
    for (const [id, proxy] of proxies) {
      if (hostObjects.has(id) || !ctx.world.get(id)) {
        proxy.removeFromParent();
        proxy.geometry.dispose();
        proxy.material.dispose();
        proxies.delete(id);
      }
    }

    for (const entity of ctx.world.entities.values()) {
      if (hostObjects.has(entity.id) || proxies.has(entity.id)) continue;
      // An entity the host does not render (one created in the editor) still
      // has to be *visible*, or duplicating an object would show nothing in
      // the viewport but the selection wireframe.
      const proxy = new THREE.Mesh(
        new THREE.BoxGeometry(1, 1, 1),
        new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.28, depthWrite: false }),
      );
      proxy.userData.entityId = entity.id;
      proxy.name = `v4-pick-${entity.id}`;
      editorGroup.add(proxy);
      proxies.set(entity.id, proxy);
    }

    const targets = [];
    for (const objects of hostObjects.values()) targets.push(...objects);
    for (const proxy of proxies.values()) targets.push(proxy);
    pickTargets = targets;
  }

  function pickAt(clientX, clientY) {
    if (pickTargets.length === 0) rebuildPickTargets();
    const rect = ctx.canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    pointerNdc.set(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    );
    raycaster.setFromCamera(pointerNdc, camera);
    const hits = raycaster.intersectObjects(pickTargets, true);
    for (const hit of hits) {
      const id = entityIdOf(hit.object);
      if (id != null && ctx.world.get(id)) return id;
    }
    return null;
  }

  /* -------------------------------------------------------------- overlay */

  function updateOverlay() {
    const selected = new Set(ctx.selection);

    // Selection outlines.
    for (const [id, outline] of outlines) {
      if (!selected.has(id) || !ctx.world.get(id)) {
        outline.removeFromParent();
        outline.geometry.dispose();
        outlines.delete(id);
      }
    }
    for (const id of selected) {
      const entity = ctx.world.get(id);
      if (!entity) continue;
      let outline = outlines.get(id);
      if (!outline) {
        outline = new THREE.LineSegments(unitBoxEdges.clone(), outlineMaterial);
        outline.renderOrder = 10;
        editorGroup.add(outline);
        outlines.set(id, outline);
      }
      applyTransform(outline, id, localSize(entity));
    }

    // Collision visualisation.
    for (const [id, box] of colliders) {
      if (!ctx.showColliders || !ctx.world.get(id) || !ctx.world.getComponent(id, 'physics')) {
        box.removeFromParent();
        box.geometry.dispose();
        colliders.delete(id);
      }
    }
    if (ctx.showColliders) {
      for (const entity of ctx.world.entities.values()) {
        const physics = entity.components.get('physics');
        if (!physics) continue;
        let box = colliders.get(entity.id);
        if (!box) {
          box = new THREE.LineSegments(unitBoxEdges.clone(), colliderMaterial);
          box.renderOrder = 9;
          editorGroup.add(box);
          colliders.set(entity.id, box);
        }
        const half = Array.isArray(physics.halfExtents) ? physics.halfExtents : [0.5, 0.5, 0.5];
        applyTransform(box, entity.id, new THREE.Vector3(
          (half[0] || 0.5) * 2,
          (half[1] || 0.5) * 2,
          (half[2] || 0.5) * 2,
        ));
      }
    }

    // Pick proxies follow their entities.
    for (const [id, proxy] of proxies) {
      const entity = ctx.world.get(id);
      if (!entity) continue;
      applyTransform(proxy, id, localSize(entity));
    }

    grid.visible = !!ctx.showGrid;
  }

  /* -------------------------------------------------------- preview inset */

  const previewCamera = new THREE.PerspectiveCamera(50, 1.6, 0.05, 4000);
  const threeRenderer = ctx.renderer.renderer;
  const originalRender = threeRenderer.render;
  let renderingInset = false;

  function selectionBounds() {
    const box = new THREE.Box3();
    let any = false;
    for (const id of ctx.selection) {
      const entity = ctx.world.get(id);
      if (!entity) continue;
      const matrix = entityWorldMatrix(ctx.world, id);
      const size = localSize(entity);
      const position = new THREE.Vector3();
      const quaternion = new THREE.Quaternion();
      const scale = new THREE.Vector3();
      matrix.decompose(position, quaternion, scale);
      const half = size.multiply(scale).multiplyScalar(0.5);
      box.expandByPoint(position.clone().sub(half));
      box.expandByPoint(position.clone().add(half));
      any = true;
    }
    if (!any) {
      box.setFromCenterAndSize(new THREE.Vector3(0, 1, 0), new THREE.Vector3(10, 10, 10));
    }
    return box;
  }

  function renderInset() {
    const size = threeRenderer.getSize(new THREE.Vector2());
    if (size.x <= 0 || size.y <= 0) return;
    const width = Math.max(140, Math.min(300, Math.round(size.x * 0.24)));
    const height = Math.round(width * 0.66);
    const x = Math.round(size.x - width - 14);
    const y = 14;

    // Frame the selection.
    const box = selectionBounds();
    const center = box.getCenter(new THREE.Vector3());
    const radius = Math.max(0.5, box.getSize(new THREE.Vector3()).length() * 0.5);
    const direction = new THREE.Vector3();
    camera.getWorldDirection(direction);
    const fov = (previewCamera.fov * Math.PI) / 180;
    const distanceToFit = (radius / Math.tan(fov * 0.5)) * 1.5;
    previewCamera.position.copy(center).addScaledVector(direction, -distanceToFit);
    previewCamera.lookAt(center);
    previewCamera.aspect = width / height;
    previewCamera.updateProjectionMatrix();

    // The preview shows the scene, not the editor furniture.
    const gizmoHelper = ctx.gizmos?.helper;
    const gizmoWasVisible = gizmoHelper?.visible ?? false;
    if (gizmoHelper) gizmoHelper.visible = false;

    threeRenderer.setViewport(x, y, width, height);
    threeRenderer.setScissor(x, y, width, height);
    threeRenderer.setScissorTest(true);
    threeRenderer.clear(true, true, false);
    threeRenderer.render(scene, previewCamera);
    threeRenderer.setScissorTest(false);
    threeRenderer.setViewport(0, 0, size.x, size.y);
    threeRenderer.setScissor(0, 0, size.x, size.y);

    if (gizmoHelper) gizmoHelper.visible = gizmoWasVisible;

    // Keep the HTML frame aligned with the rendered inset.
    const canvasWidth = ctx.canvas.clientWidth || size.x;
    const canvasHeight = ctx.canvas.clientHeight || size.y;
    const ratio = canvasWidth / size.x;
    previewFrame.style.left = `${Math.round(x * ratio)}px`;
    previewFrame.style.top = `${Math.round(canvasHeight - (y + height) * ratio)}px`;
    previewFrame.style.width = `${Math.round(width * ratio)}px`;
    previewFrame.style.height = `${Math.round(height * ratio)}px`;
  }

  threeRenderer.render = function patchedRender(renderScene, renderCamera) {
    // The host's camera rig runs after the editor's update, so the editor's
    // camera is applied here — just before the frame is drawn.
    if (renderCamera === camera) applyEditorCamera();
    originalRender.call(threeRenderer, renderScene, renderCamera);
    if (renderingInset) return;
    if (!ctx.showPreview || ctx.mode !== 'edit') return;
    renderingInset = true;
    try {
      renderInset();
    } catch (err) {
      ctx.logger?.error?.('editor: preview render failed', { error: String(err?.message ?? err) });
    } finally {
      renderingInset = false;
    }
  };

  /* --------------------------------------------------------------- input */

  function onPointerDown(event) {
    if (ctx.mode !== 'edit') return;
    lastX = event.clientX;
    lastY = event.clientY;
    if (event.button === 2) {
      orbiting = true;
      event.preventDefault();
      return;
    }
    if (event.button === 1) {
      if (event.shiftKey) panning = true;
      else orbiting = true;
      event.preventDefault();
      return;
    }
    if (event.button === 0) {
      // A gizmo handle wins over picking.
      if (ctx.gizmos?.hovering) return;
      const id = pickAt(event.clientX, event.clientY);
      if (id == null) {
        if (!event.shiftKey) ctx.select([]);
      } else {
        ctx.select([id], { additive: event.shiftKey });
      }
    }
  }

  function onPointerMove(event) {
    const dx = event.clientX - lastX;
    const dy = event.clientY - lastY;
    lastX = event.clientX;
    lastY = event.clientY;
    if (orbiting) {
      yaw -= dx * 0.006;
      pitch = Math.max(-1.5, Math.min(1.5, pitch + dy * 0.006));
      updateCamera();
    } else if (panning) {
      const scale = distance * 0.0016;
      const right = new THREE.Vector3();
      const up = new THREE.Vector3();
      camera.matrixWorld.extractBasis(right, up, new THREE.Vector3());
      focus.addScaledVector(right, -dx * scale);
      focus.addScaledVector(up, dy * scale);
      updateCamera();
    }
  }

  function onPointerUp() {
    orbiting = false;
    panning = false;
  }

  function onWheel(event) {
    if (ctx.mode !== 'edit') return;
    event.preventDefault();
    const factor = Math.exp(event.deltaY * 0.0012);
    distance = Math.max(MIN_DISTANCE, Math.min(MAX_DISTANCE, distance * factor));
    updateCamera();
  }

  function onContextMenu(event) {
    event.preventDefault();
  }

  /** Attached after the gizmo so that TransformControls sees the event first. */
  function attachInput() {
    ctx.canvas.addEventListener('pointerdown', onPointerDown);
    ctx.canvas.addEventListener('pointermove', onPointerMove);
    ctx.canvas.addEventListener('pointerup', onPointerUp);
    ctx.canvas.addEventListener('wheel', onWheel, { passive: false });
    ctx.canvas.addEventListener('contextmenu', onContextMenu);
  }

  function detachInput() {
    ctx.canvas.removeEventListener('pointerdown', onPointerDown);
    ctx.canvas.removeEventListener('pointermove', onPointerMove);
    ctx.canvas.removeEventListener('pointerup', onPointerUp);
    ctx.canvas.removeEventListener('wheel', onWheel);
    ctx.canvas.removeEventListener('contextmenu', onContextMenu);
  }

  /* --------------------------------------------------------------- resize */

  let lastSize = { w: 0, h: 0 };
  function ensureSize() {
    const width = Math.max(1, Math.round(el.clientWidth));
    const height = Math.max(1, Math.round(el.clientHeight));
    if (width === lastSize.w && height === lastSize.h) return;
    lastSize = { w: width, h: height };
    ctx.renderer.resize?.(width, height);
  }

  /* --------------------------------------------------------------- update */

  let frame = 0;

  return {
    el,
    attachInput,
    detachInput,

    /** The camera focus point (orbit centre) as a Vector3. */
    focusPoint,

    /** Frame the current selection (or the origin) with the camera. */
    frameSelection() {
      const box = selectionBounds();
      const center = box.getCenter(new THREE.Vector3());
      const radius = Math.max(0.5, box.getSize(new THREE.Vector3()).length() * 0.5);
      focus.copy(center);
      distance = Math.max(2, radius * 3);
      updateCamera();
    },

    focusOn(point, dist) {
      focus.copy(point);
      if (typeof dist === 'number') distance = dist;
      updateCamera();
    },

    /**
     * Move the orbit centre to the middle of the current selection.
     * Called when the selection changes, so the camera (and the host's rig,
     * which asks for focusPoint()) look at what is selected.
     */
    focusOnSelection() {
      const ids = ctx.selection;
      if (!ids.length) return;
      const pivot = new THREE.Vector3();
      let count = 0;
      for (const id of ids) {
        if (!ctx.world.get(id)) continue;
        pivot.add(new THREE.Vector3().setFromMatrixPosition(entityWorldMatrix(ctx.world, id)));
        count += 1;
      }
      if (count === 0) return;
      pivot.multiplyScalar(1 / count);
      focus.copy(pivot);
      updateCamera();
    },

    /** Render the inset preview on demand (the host may also call it). */
    renderInset,

    update() {
      frame += 1;
      ensureSize();
      if (frame % 30 === 1) rebuildPickTargets();
      updateOverlay();
      if (ctx.mode === 'edit') updateCamera();

      modeBadge.textContent = ctx.mode;
      modeBadge.classList.toggle('is-play', ctx.mode === 'play');
      previewFrame.classList.toggle('is-off', !ctx.showPreview || ctx.mode !== 'edit');

      const ids = ctx.selection;
      const names = ids.slice(0, 3).map((id) => ctx.world.get(id)?.name ?? id).join(', ');
      hud.textContent = '';
      const line1 = document.createElement('div');
      line1.append(`${ctx.mode.toUpperCase()}  gizmo: ${ctx.gizmoMode}${ctx.snapEnabled ? ` (snap ${ctx.snapSize})` : ''}`);
      const line2 = document.createElement('div');
      line2.append(`selected: ${ids.length}${names ? ` (${names}${ids.length > 3 ? '…' : ''})` : ''}`);
      const line3 = document.createElement('div');
      line3.append(`cam: ${distance.toFixed(1)}m   objects: ${ctx.world.entityCount}`);
      hud.append(line1, line2, line3);
    },

    dispose() {
      detachInput();
      threeRenderer.render = originalRender;
      for (const outline of outlines.values()) {
        outline.geometry.dispose();
        outline.removeFromParent();
      }
      for (const box of colliders.values()) {
        box.geometry.dispose();
        box.removeFromParent();
      }
      for (const proxy of proxies.values()) {
        proxy.geometry.dispose();
        proxy.material.dispose();
        proxy.removeFromParent();
      }
      outlines.clear();
      colliders.clear();
      proxies.clear();
      unitBoxEdges.dispose();
      outlineMaterial.dispose();
      colliderMaterial.dispose();
      grid.geometry.dispose();
      grid.material.dispose();
      editorGroup.removeFromParent();
      el.remove();
    },
  };
}
