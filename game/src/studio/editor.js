/**
 * studio/editor.js — the SCC Studio 3D voxel workspace (FR-STD-014 … 030).
 *
 * OWNER: STD (BOT-08). This is the VIEW half of the studio; the data model
 * lives in `studio/voxels.js` (pure, Node-testable).
 *
 * WHAT THIS IS
 *   A modal overlay with its own WebGL canvas, an orbit/pan camera of its
 *   own (independent of the game camera, FR-STD-028) and a live 3D preview
 *   of the model being sculpted, rendered as a `THREE.InstancedMesh` of
 *   coloured cubes.
 *
 * ON THE ART
 *   The cubes are the EDITOR'S OWN TOOL GEOMETRY — they are the voxels the
 *   player is placing, not artwork. Every piece of ART in this project
 *   comes from the user's library (see src/data/manifest.json). This file
 *   loads no art at all: the palette is the game's own 16-colour palette.
 *
 * THE CONTROLS
 *   LMB            paint a voxel on the face you clicked
 *   Shift + LMB    erase the voxel you clicked
 *   RMB drag       orbit
 *   MMB drag       pan
 *   Wheel          zoom
 *   [ / ]          lower / raise the working level
 *   1 .. 5         brush size
 */

import * as THREE from 'three';
import { PALETTE } from '../core/config.js';

const MAX_INSTANCES = 8192;

/** The editor's camera defaults — the editor camera is its own rig. */
const CAM = {
  distance: 68,
  minDistance: 12,
  maxDistance: 240,
  yaw: Math.PI / 4,
  pitch: 0.72,
  panSpeed: 0.14,
  rotateSpeed: 0.007,
  zoomSpeed: 0.0016,
};

/**
 * Create the studio editor view.
 *
 * @param {object} ctx the shared context (for `ctx.config`)
 * @param {object} service the studio service (data + callbacks)
 * @returns {object} the editor view
 */
export function createStudioEditor(ctx, service) {
  const dims = service.dims();
  const palette = service.palette();

  // -------------------------------------------------------------------------
  // DOM
  // -------------------------------------------------------------------------
  const el = document.createElement('div');
  el.className = 'sc-studio';
  el.hidden = true;
  el.setAttribute('data-sc-studio', '1');

  const bar = document.createElement('div');
  bar.className = 'sc-studio-bar';
  const title = document.createElement('h2');
  title.textContent = 'SCC STUDIO';
  bar.append(title);

  const mkBtn = (label, action, titleText) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'sc-btn';
    b.textContent = label;
    b.dataset.scStudio = action;
    if (titleText) b.title = titleText;
    return b;
  };

  const modeBtn = mkBtn('PAINT', 'mode', 'Toggle paint / camera mode');
  const levelDown = mkBtn('LEVEL -', 'level-down', 'Lower the working level');
  const levelUp = mkBtn('LEVEL +', 'level-up', 'Raise the working level');
  const brushDown = mkBtn('BRUSH -', 'brush-down', 'Smaller brush');
  const brushUp = mkBtn('BRUSH +', 'brush-up', 'Bigger brush');
  const saveBtn = mkBtn('SAVE', 'save', 'Save the workshop document');
  const loadBtn = mkBtn('LOAD', 'load', 'Load the workshop document');
  const duplicateBtn = mkBtn('DUPLICATE', 'duplicate', 'Duplicate this model into a new asset');
  const exportBtn = mkBtn('EXPORT OBJ', 'export', 'Export the model as an OBJ file');
  const closeBtn = mkBtn('CLOSE', 'close', 'Close SCC Studio (Esc)');
  bar.append(modeBtn, levelDown, levelUp, brushDown, brushUp, saveBtn, loadBtn, duplicateBtn, exportBtn, closeBtn);

  const view = document.createElement('div');
  view.className = 'sc-studio-view';

  const hudBox = document.createElement('div');
  hudBox.className = 'sc-studio-hud';
  const hudText = document.createElement('div');
  hudBox.append(hudText);
  view.append(hudBox);

  const foot = document.createElement('div');
  foot.className = 'sc-studio-foot';
  const paletteEl = document.createElement('div');
  paletteEl.className = 'sc-palette';
  const statusEl = document.createElement('div');
  statusEl.className = 'sc-studio-status';
  foot.append(paletteEl, statusEl);

  el.append(bar, view, foot);

  // -------------------------------------------------------------------------
  // Palette swatches
  // -------------------------------------------------------------------------
  /**
   * The voxel map. The contract exposes it as a Map PROPERTY
   * (`voxels`), but a callable is accepted too so the view can be driven
   * from either shape.
   */
  const voxelMap = () => (typeof service.voxels === 'function' ? service.voxels() : service.voxels);

  const swatches = new Map();
  for (const entry of palette) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'sc-swatch';
    b.style.background = `#${entry.color.toString(16).padStart(6, '0')}`;
    b.dataset.scMaterial = String(entry.index);
    b.title = `${entry.name} (material ${entry.index})`;
    paletteEl.append(b);
    swatches.set(entry.index, b);
  }
  function markActiveMaterial(index) {
    for (const [id, node] of swatches) node.classList.toggle('is-active', id === index);
  }
  markActiveMaterial(service.material());

  // -------------------------------------------------------------------------
  // Three.js scene
  // -------------------------------------------------------------------------
  let renderer = null;
  let canvas = null;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    canvas = renderer.domElement;
    view.append(canvas);
  } catch (err) {
    // No WebGL: the studio still opens and the model is still editable
    // through the service API; the 3D preview is simply unavailable.
    const warn = document.createElement('div');
    warn.className = 'sc-studio-hud';
    warn.textContent = `3D preview unavailable: ${err?.message ?? 'WebGL failed'}`;
    view.append(warn);
    hudText.textContent = '3D preview unavailable';
  }

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0d0f1c);

  const camera = new THREE.PerspectiveCamera(50, 1, 0.5, 2000);
  const focus = new THREE.Vector3(dims.x / 2, dims.y / 3, dims.z / 2);

  const hemi = new THREE.HemisphereLight(0xbfe9ff, 0x3f8f4d, 1.1);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff3d6, 1.6);
  sun.position.set(40, 80, 30);
  scene.add(sun);

  // The voxel cloud: one instanced cube per voxel.
  const cubeGeo = new THREE.BoxGeometry(1, 1, 1);
  const cubeMat = new THREE.MeshLambertMaterial({});
  const cloud = new THREE.InstancedMesh(cubeGeo, cubeMat, MAX_INSTANCES);
  cloud.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  cloud.count = 0;
  cloud.frustumCulled = false;
  scene.add(cloud);

  // The lattice outline, so the authoring volume is visible.
  const gridHelper = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(dims.x, dims.y, dims.z)),
    new THREE.LineBasicMaterial({ color: 0x4b5280 }),
  );
  gridHelper.position.set(dims.x / 2, dims.y / 2, dims.z / 2);
  scene.add(gridHelper);

  // A floor grid, one unit per voxel.
  const floorPoints = [];
  for (let i = 0; i <= dims.x; i += 4) {
    floorPoints.push(i, 0, 0, i, 0, dims.z);
  }
  for (let i = 0; i <= dims.z; i += 4) {
    floorPoints.push(0, 0, i, dims.x, 0, i);
  }
  const floorGeo = new THREE.BufferGeometry();
  floorGeo.setAttribute('position', new THREE.Float32BufferAttribute(floorPoints, 3));
  const floor = new THREE.LineSegments(floorGeo, new THREE.LineBasicMaterial({ color: 0x2e3457 }));
  scene.add(floor);

  // The brush footprint marker.
  const brushMarker = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)),
    new THREE.LineBasicMaterial({ color: 0xffd166 }),
  );
  scene.add(brushMarker);

  // ---- instance bookkeeping ------------------------------------------------
  /** instanceId -> lattice position */
  let instanceVoxels = [];
  let dirty = true;

  const tmpMatrix = new THREE.Matrix4();
  const tmpColor = new THREE.Color();

  /**
   * Point the editor camera at the CONTENT, not at the empty authoring
   * volume: a small model in a 32^3 lattice must not open as a speck.
   */
  function frameContent() {
    const map = voxelMap();
    let min = null;
    let max = null;
    for (const key of map.keys()) {
      const parts = key.split(',').map(Number);
      if (parts.length !== 3) continue;
      if (!min) { min = { x: parts[0], y: parts[1], z: parts[2] }; max = { ...min }; continue; }
      min.x = Math.min(min.x, parts[0]); min.y = Math.min(min.y, parts[1]); min.z = Math.min(min.z, parts[2]);
      max.x = Math.max(max.x, parts[0]); max.y = Math.max(max.y, parts[1]); max.z = Math.max(max.z, parts[2]);
    }
    if (!min) {
      focus.set(dims.x / 2, dims.y / 3, dims.z / 2);
      CAM.distance = Math.min(CAM.maxDistance, Math.max(dims.x, dims.z) * 1.4);
      return;
    }
    focus.set((min.x + max.x) / 2 + 0.5, (min.y + max.y) / 2 + 0.5, (min.z + max.z) / 2 + 0.5);
    const radius = Math.max(4, Math.hypot(max.x - min.x + 1, max.y - min.y + 1, max.z - min.z + 1) / 2);
    CAM.distance = Math.min(CAM.maxDistance, Math.max(CAM.minDistance, radius * 2.6));
  }

  function rebuildInstances() {
    const voxels = voxelMap();
    const count = Math.min(voxels.size, MAX_INSTANCES);
    instanceVoxels = [];
    let i = 0;
    for (const [key, rec] of voxels) {
      if (i >= MAX_INSTANCES) break;
      const [x, y, z] = key.split(',').map(Number);
      tmpMatrix.makeTranslation(x + 0.5, y + 0.5, z + 0.5);
      cloud.setMatrixAt(i, tmpMatrix);
      tmpColor.setHex(rec?.color ?? PALETTE.slate);
      cloud.setColorAt(i, tmpColor);
      instanceVoxels.push({ x, y, z });
      i += 1;
    }
    cloud.count = i;
    cloud.instanceMatrix.needsUpdate = true;
    if (cloud.instanceColor) cloud.instanceColor.needsUpdate = true;
    dirty = false;
  }

  // -------------------------------------------------------------------------
  // Interaction
  // -------------------------------------------------------------------------
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let mode = 'paint';
  let workingLevel = 0;
  let drag = null;
  let hoverVoxel = null;

  function pointerToNdc(e) {
    const rect = canvas.getBoundingClientRect();
    pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  }

  /** Raycast the voxel cloud; returns the voxel under the pointer. */
  function pickVoxel(e) {
    if (!renderer) return null;
    pointerToNdc(e);
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObject(cloud, false);
    if (!hits.length) return null;
    const hit = hits[0];
    const id = hit.instanceId;
    const vox = instanceVoxels[id];
    if (!vox) return null;
    const normal = hit.face?.normal ?? new THREE.Vector3(0, 1, 0);
    return { ...vox, normal: { x: normal.x, y: normal.y, z: normal.z } };
  }

  /** Raycast the working plane; returns the lattice cell under the pointer. */
  function pickPlane(e) {
    if (!renderer) return null;
    pointerToNdc(e);
    raycaster.setFromCamera(pointer, camera);
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -workingLevel);
    const point = new THREE.Vector3();
    if (!raycaster.ray.intersectPlane(plane, point)) return null;
    return {
      x: Math.floor(point.x),
      y: workingLevel,
      z: Math.floor(point.z),
      normal: { x: 0, y: 1, z: 0 },
    };
  }

  function onPointerDown(e) {
    if (!canvas) return;
    if (e.button === 0 && mode === 'paint') {
      const target = pickVoxel(e);
      if (target) {
        // Paint on the face that was clicked; fall back to the cell itself.
        const ax = target.x + Math.round(target.normal.x);
        const ay = target.y + Math.round(target.normal.y);
        const az = target.z + Math.round(target.normal.z);
        const inside = ax >= 0 && ay >= 0 && az >= 0 && ax < dims.x && ay < dims.y && az < dims.z;
        if (e.shiftKey) {
          service.erase(target.x, target.y, target.z);
        } else if (inside) {
          service.paint(ax, ay, az);
          workingLevel = Math.min(dims.y - 1, Math.max(0, ay));
        } else {
          service.paint(target.x, target.y, target.z);
        }
        dirty = true;
        e.preventDefault();
      } else {
        const cell = pickPlane(e);
        if (cell && !e.shiftKey) {
          service.paint(cell.x, cell.y, cell.z);
          dirty = true;
        }
      }
      return;
    }
    if (e.button === 2) drag = { mode: 'orbit', x: e.clientX, y: e.clientY };
    else if (e.button === 1) drag = { mode: 'pan', x: e.clientX, y: e.clientY };
    else if (e.button === 0) drag = { mode: 'orbit', x: e.clientX, y: e.clientY };
  }

  function onPointerMove(e) {
    if (drag) {
      const dx = e.clientX - drag.x;
      const dy = e.clientY - drag.y;
      drag.x = e.clientX;
      drag.y = e.clientY;
      if (drag.mode === 'orbit') {
        CAM.yaw -= dx * CAM.rotateSpeed;
        CAM.pitch = Math.min(Math.PI / 2 - 0.05, Math.max(0.05, CAM.pitch + dy * CAM.rotateSpeed));
      } else {
        const right = new THREE.Vector3(Math.cos(CAM.yaw), 0, -Math.sin(CAM.yaw));
        const fwd = new THREE.Vector3(Math.sin(CAM.yaw), 0, Math.cos(CAM.yaw));
        focus.addScaledVector(right, -dx * CAM.panSpeed);
        focus.addScaledVector(fwd, -dy * CAM.panSpeed);
      }
      return;
    }
    const hit = pickVoxel(e);
    hoverVoxel = hit ? { x: hit.x, y: hit.y, z: hit.z } : null;
  }

  function onPointerUp() { drag = null; }

  function onWheel(e) {
    if (!canvas) return;
    e.preventDefault();
    const factor = 1 + Math.sign(e.deltaY) * CAM.zoomSpeed * 4;
    CAM.distance = Math.min(CAM.maxDistance, Math.max(CAM.minDistance, CAM.distance * factor));
  }

  function onContextMenu(e) { e.preventDefault(); }

  if (canvas) {
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointerleave', onPointerUp);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('contextmenu', onContextMenu);
  }

  // -------------------------------------------------------------------------
  // Buttons
  // -------------------------------------------------------------------------
  el.addEventListener('click', (e) => {
    const btn = e.target instanceof Element ? e.target.closest('[data-sc-studio]') : null;
    if (!btn) return;
    const action = btn.dataset.scStudio;
    if (action === 'close') { service.close(); return; }
    if (action === 'mode') {
      mode = mode === 'paint' ? 'camera' : 'paint';
      modeBtn.textContent = mode === 'paint' ? 'PAINT' : 'CAMERA';
      return;
    }
    if (action === 'level-down') { workingLevel = Math.max(0, workingLevel - 1); return; }
    if (action === 'level-up') { workingLevel = Math.min(dims.y - 1, workingLevel + 1); return; }
    if (action === 'brush-down') { service.setBrush(Math.max(1, service.brushSize() - 1)); return; }
    if (action === 'brush-up') { service.setBrush(Math.min(5, service.brushSize() + 1)); return; }
    if (action === 'save') { service.saveWorkshop(); return; }
    if (action === 'load') { service.loadWorkshop(); return; }
    if (action === 'duplicate') { service.duplicateDocument?.(); return; }
    if (action === 'export') { service.exportOBJFile(); return; }
  });

  el.addEventListener('click', (e) => {
    const swatch = e.target instanceof Element ? e.target.closest('[data-sc-material]') : null;
    if (!swatch) return;
    const index = Number(swatch.dataset.scMaterial);
    service.setMaterial(index);
    markActiveMaterial(index);
  });

  // -------------------------------------------------------------------------
  // Frame
  // -------------------------------------------------------------------------
  function resize() {
    if (!renderer) return;
    const w = view.clientWidth || 640;
    const h = view.clientHeight || 400;
    renderer.setSize(w, h, false);
    camera.aspect = w / Math.max(1, h);
    camera.updateProjectionMatrix();
  }

  function updateCamera() {
    const cp = Math.cos(CAM.pitch);
    camera.position.set(
      focus.x + CAM.distance * cp * Math.sin(CAM.yaw),
      focus.y + CAM.distance * Math.sin(CAM.pitch),
      focus.z + CAM.distance * cp * Math.cos(CAM.yaw),
    );
    camera.lookAt(focus);
  }

  function update(dt) {
    if (!renderer) return;
    if (service.revision() !== undefined && service.revision() !== lastRevision) {
      lastRevision = service.revision();
      dirty = true;
    }
    // Frame the model the first time there is something to frame.
    if (!framed && voxelMap().size > 0) {
      framed = true;
      frameContent();
    }
    if (dirty) rebuildInstances();
    updateCamera();

    // The brush marker follows the hovered voxel (or the working level).
    const brush = service.brushSize();
    if (hoverVoxel) {
      brushMarker.position.set(hoverVoxel.x + 0.5, hoverVoxel.y + 0.5, hoverVoxel.z + 0.5);
      brushMarker.scale.set(brush, 1, brush);
      brushMarker.visible = true;
    } else {
      brushMarker.position.set(0.5, workingLevel + 0.5, 0.5);
      brushMarker.scale.set(brush, 1, brush);
      brushMarker.visible = true;
    }

    renderer.render(scene, camera);
    void dt;
  }

  let lastRevision = -1;
  let framed = false;
  let hudSignature = '';

  function updateHud() {
    const count = voxelMap().size;
    const derived = service.derived();
    const signature = `${count}|${service.brushSize()}|${workingLevel}|${mode}|${derived?.buildCost}`;
    if (signature === hudSignature) return;
    hudSignature = signature;
    hudText.innerHTML = '';
    const line1 = document.createElement('div');
    line1.innerHTML = `VOXELS <b>${count}</b> / ${dims.x}x${dims.y}x${dims.z}`;
    const line2 = document.createElement('div');
    line2.innerHTML = `BRUSH <b>${service.brushSize()}</b> · LEVEL <b>${workingLevel}</b> · MODE <b>${mode.toUpperCase()}</b>`;
    const line3 = document.createElement('div');
    line3.innerHTML = `DERIVED COST <b>${derived?.buildCost ?? '—'}</b> <span class="sc-assumed">assumed</span>`;
    hudText.append(line1, line2, line3);

    statusEl.replaceChildren();
    const add = (label, value) => {
      const s = document.createElement('span');
      s.innerHTML = `${label} <b>${value}</b>`;
      statusEl.append(s);
    };
    add('VOXELS', count);
    add('BRUSH', service.brushSize());
    add('LEVEL', workingLevel);
    add('MATERIAL', service.material());
    add('COST (ASSUMED)', derived?.buildCost ?? '—');
  }

  const resizeObserver = typeof ResizeObserver !== 'undefined'
    ? new ResizeObserver(() => resize())
    : null;
  if (resizeObserver && view) resizeObserver.observe(view);
  if (typeof window !== 'undefined') window.addEventListener('resize', resize);

  return {
    /** The overlay element. */
    el,
    /** Called when the studio opens. */
    open() {
      el.hidden = false;
      resize();
      dirty = true;
      framed = false;
      frameContent();
      updateHud();
    },
    /** Called when the studio closes. */
    close() {
      el.hidden = true;
    },
    /** Per-frame update. */
    update(dt) {
      update(dt);
      updateHud();
    },
    /** Force a rebuild of the voxel cloud. */
    invalidate() { dirty = true; },
    dispose() {
      resizeObserver?.disconnect();
      if (typeof window !== 'undefined') window.removeEventListener('resize', resize);
      if (canvas) {
        canvas.removeEventListener('pointerdown', onPointerDown);
        canvas.removeEventListener('pointermove', onPointerMove);
        canvas.removeEventListener('pointerup', onPointerUp);
        canvas.removeEventListener('pointerleave', onPointerUp);
        canvas.removeEventListener('wheel', onWheel);
        canvas.removeEventListener('contextmenu', onContextMenu);
      }
      cubeGeo.dispose();
      cubeMat.dispose();
      gridHelper.geometry.dispose();
      gridHelper.material.dispose();
      floorGeo.dispose();
      floor.material.dispose();
      brushMarker.geometry.dispose();
      brushMarker.material.dispose();
      renderer?.dispose();
      el.remove();
    },
  };
}
