/**
 * V4 editor — the editor application.
 *
 * `createEditor` builds the whole editor UI (toolbar, hierarchy, viewport,
 * inspector, console) around the host's canvas and returns the small public
 * API the host drives:
 *
 *   update(dt, now) · setMode('edit'|'play') · selection · select(ids)
 *   duplicate() · undo() · redo() · save() · load() · validate() · dispose()
 *
 * The host owns the world, the renderer and the frame loop; the editor never
 * creates a second canvas and never renders the main frame itself.
 */

import { Events } from '../core/events.js';
import { createHierarchyPanel } from './hierarchy.js';
import { createInspector, makeButton } from './inspector.js';
import { createViewport } from './viewport.js';
import { createGizmos } from './gizmos.js';
import {
  createUndoStack,
  createEntityAddCommand,
  createEntityRemoveCommand,
  createReparentCommand,
  copyComponentData,
  entityIdOfTransform,
  parentEntityId,
  reparent as reparentEntity,
} from './undo.js';
import { validateScene } from './validation.js';
import editorCss from './editor.css?inline';

const STYLE_ID = 'v4-editor-style';

/**
 * @param {{
 *   world:any, bus:any, registry:any, sceneManager:any,
 *   renderer:any, input:any, logger:any, canvas:HTMLCanvasElement
 * }} deps
 */
export function createEditor({ world, bus, registry, sceneManager, renderer, input, logger, canvas }) {
  if (!world || !renderer || !canvas) {
    throw new Error('createEditor requires world, renderer and canvas');
  }

  injectStyles();

  /* ---------------------------------------------------------------- DOM */

  const host = document.getElementById('v4-app') ?? document.body;
  const container = document.createElement('div');
  container.className = 'v4-editor';
  host.appendChild(container);
  document.getElementById('v4-boot')?.classList.add('is-hidden');

  const toolbar = document.createElement('div');
  toolbar.className = 'v4-toolbar';
  container.appendChild(toolbar);

  const hierarchyPanel = document.createElement('div');
  hierarchyPanel.className = 'v4-panel v4-hierarchy';
  const hierarchyHead = panelHead('Hierarchy');
  hierarchyPanel.appendChild(hierarchyHead);
  container.appendChild(hierarchyPanel);

  const inspectorPanel = document.createElement('div');
  inspectorPanel.className = 'v4-panel v4-inspector';
  const inspectorHead = panelHead('Inspector');
  inspectorPanel.appendChild(inspectorHead);
  container.appendChild(inspectorPanel);

  const consolePanel = document.createElement('div');
  consolePanel.className = 'v4-panel v4-console';
  consolePanel.appendChild(panelHead('Console / Problems'));
  const consoleLog = document.createElement('div');
  consoleLog.className = 'v4-console-log';
  consolePanel.appendChild(consoleLog);
  container.appendChild(consolePanel);

  /* --------------------------------------------------------------- state */

  let frame = 0;

  const ctx = {
    world,
    bus,
    registry,
    sceneManager,
    renderer,
    input,
    logger,
    canvas,
    mode: 'edit',
    gizmoMode: 'translate',
    gizmoSpace: 'world',
    snapEnabled: true,
    snapSize: 0.5,
    showGrid: true,
    showColliders: false,
    showPreview: true,
    selection: [],
    undo: null,
    gizmos: null,
    viewport: null,
    select: (ids, options) => select(ids, options),
    deleteSelection: () => deleteSelection(),
    reparent: (childId, parentId) => reparent(childId, parentId),
    frameSelection: () => viewport.frameSelection(),
    refreshAll: () => refreshAll(),
    onTransformChanged: () => { hierarchy.refresh(); },
    onComponentChanged: () => { hierarchy.refresh(); },
    onGizmoChanged: () => { updateToolbarState(); },
  };

  ctx.undo = createUndoStack({
    limit: 250,
    onChange: (state) => {
      undoBtn.disabled = !state.canUndo;
      redoBtn.disabled = !state.canRedo;
      undoBtn.title = state.undoLabel ? `Undo ${state.undoLabel} (Ctrl/Cmd+Z)` : 'Undo';
      redoBtn.title = state.redoLabel ? `Redo ${state.redoLabel} (Ctrl/Cmd+Shift+Z)` : 'Redo';
    },
  });

  /* ------------------------------------------------------------ toolbar */

  const title = document.createElement('span');
  title.className = 'v4-title';
  title.textContent = 'Game Studio Ultra V4';
  toolbar.appendChild(title);

  const modeGroup = group('Mode');
  const editBtn = makeButton('Edit', () => setMode('edit'));
  const playBtn = makeButton('Play', () => setMode('play'));
  modeGroup.append(editBtn, playBtn);
  toolbar.appendChild(modeGroup);

  const gizmoGroup = group('Gizmo');
  const moveBtn = makeButton('Move (W)', () => setGizmoMode('translate'));
  const rotateBtn = makeButton('Rotate (E)', () => setGizmoMode('rotate'));
  const scaleBtn = makeButton('Scale (R)', () => setGizmoMode('scale'));
  const spaceBtn = makeButton('World', () => {
    ctx.gizmoSpace = ctx.gizmoSpace === 'world' ? 'local' : 'world';
    ctx.gizmos.setSpace(ctx.gizmoSpace);
    updateToolbarState();
  });
  gizmoGroup.append(moveBtn, rotateBtn, scaleBtn, spaceBtn);
  toolbar.appendChild(gizmoGroup);

  const snapGroup = group('Snap');
  const snapBtn = makeButton('On', () => {
    ctx.snapEnabled = !ctx.snapEnabled;
    ctx.gizmos.setSnap(ctx.snapEnabled, ctx.snapSize);
    updateToolbarState();
  });
  const snapSize = document.createElement('select');
  for (const size of [0.25, 0.5, 1]) {
    const option = document.createElement('option');
    option.value = String(size);
    option.textContent = String(size);
    if (size === ctx.snapSize) option.selected = true;
    snapSize.appendChild(option);
  }
  snapSize.addEventListener('change', () => {
    ctx.snapSize = Number(snapSize.value) || 0.5;
    ctx.gizmos.setSnap(ctx.snapEnabled, ctx.snapSize);
    updateToolbarState();
  });
  snapGroup.append(snapBtn, snapSize);
  toolbar.appendChild(snapGroup);

  const editGroup = group('Edit');
  const undoBtn = makeButton('Undo', () => undo());
  const redoBtn = makeButton('Redo', () => redo());
  const duplicateBtn = makeButton('Duplicate', () => duplicate());
  const deleteBtn = makeButton('Delete', () => deleteSelection(), 'v4-danger');
  const frameBtn = makeButton('Frame (F)', () => viewport.frameSelection());
  editGroup.append(undoBtn, redoBtn, duplicateBtn, deleteBtn, frameBtn);
  toolbar.appendChild(editGroup);
  // Push the initial (empty) undo state into the toolbar buttons.
  ctx.undo.clear();

  const viewGroup = group('View');
  const gridBtn = makeButton('Grid', () => {
    ctx.showGrid = !ctx.showGrid;
    updateToolbarState();
  });
  const colliderBtn = makeButton('Colliders', () => {
    ctx.showColliders = !ctx.showColliders;
    updateToolbarState();
  });
  const previewBtn = makeButton('Preview', () => {
    ctx.showPreview = !ctx.showPreview;
    updateToolbarState();
  });
  viewGroup.append(gridBtn, colliderBtn, previewBtn);
  toolbar.appendChild(viewGroup);

  const sceneGroup = group('Scene');
  const sceneName = document.createElement('input');
  sceneName.type = 'text';
  sceneName.value = 'Untitled';
  sceneName.title = 'Scene name';
  const sceneSelect = document.createElement('select');
  sceneSelect.title = 'Saved scenes';
  const saveBtn = makeButton('Save', () => save());
  const loadBtn = makeButton('Load', () => load());
  sceneGroup.append(sceneName, sceneSelect, saveBtn, loadBtn);
  toolbar.appendChild(sceneGroup);

  const toolsGroup = group('Tools');
  const validateBtn = makeButton('Validate', () => runValidation());
  const helpBtn = makeButton('Shortcuts (?)', () => toggleHelp());
  toolsGroup.append(validateBtn, helpBtn);
  toolbar.appendChild(toolsGroup);

  const spacer = document.createElement('span');
  spacer.className = 'v4-spacer';
  toolbar.appendChild(spacer);

  /* -------------------------------------------------------------- panels */

  const hierarchy = createHierarchyPanel({ ctx, root: hierarchyPanel });
  const inspector = createInspector({ ctx, root: inspectorPanel });
  const viewport = createViewport({ ctx, root: container });
  ctx.viewport = viewport;
  const gizmos = createGizmos({ ctx });
  ctx.gizmos = gizmos;
  // The gizmo listens first so that a drag on a handle is never a click.
  viewport.attachInput();

  /* ---------------------------------------------------------------- help */

  const help = document.createElement('div');
  help.className = 'v4-help is-hidden';
  help.innerHTML = `
    <div class="v4-help-card">
      <h2>Keyboard shortcuts</h2>
      <table>
        <tr><td class="v4-key">W / E / R</td><td>Move · Rotate · Scale gizmo</td></tr>
        <tr><td class="v4-key">Ctrl/Cmd + Z</td><td>Undo</td></tr>
        <tr><td class="v4-key">Ctrl/Cmd + Shift + Z</td><td>Redo</td></tr>
        <tr><td class="v4-key">Ctrl/Cmd + D</td><td>Duplicate selection</td></tr>
        <tr><td class="v4-key">Ctrl/Cmd + S</td><td>Save scene</td></tr>
        <tr><td class="v4-key">Ctrl/Cmd + P</td><td>Toggle play / edit mode</td></tr>
        <tr><td class="v4-key">Ctrl/Cmd + A</td><td>Select all</td></tr>
        <tr><td class="v4-key">Delete / Backspace</td><td>Delete selection</td></tr>
        <tr><td class="v4-key">F</td><td>Frame the selection</td></tr>
        <tr><td class="v4-key">G</td><td>Toggle the grid</td></tr>
        <tr><td class="v4-key">C</td><td>Toggle collision boxes</td></tr>
        <tr><td class="v4-key">Left click</td><td>Select an object (shift-click adds)</td></tr>
        <tr><td class="v4-key">Left drag on a handle</td><td>Move / rotate / scale the selection</td></tr>
        <tr><td class="v4-key">Middle / Right drag</td><td>Orbit the camera</td></tr>
        <tr><td class="v4-key">Shift + Middle drag</td><td>Pan the camera</td></tr>
        <tr><td class="v4-key">Wheel</td><td>Zoom</td></tr>
        <tr><td class="v4-key">? or F1</td><td>Toggle this help</td></tr>
        <tr><td class="v4-key">Esc</td><td>Close help / clear the selection</td></tr>
      </table>
      <button type="button" class="v4-help-close">Close</button>
    </div>`;
  container.appendChild(help);
  help.querySelector('.v4-help-close').addEventListener('click', () => toggleHelp(false));
  help.addEventListener('click', (event) => {
    if (event.target === help) toggleHelp(false);
  });

  /* -------------------------------------------------------------- console */

  const seenRecords = new WeakSet();
  let consoleEmpty = document.createElement('div');
  consoleEmpty.className = 'v4-log-empty';
  consoleEmpty.textContent = 'No log output yet.';
  consoleLog.appendChild(consoleEmpty);

  function appendLog(level, message, at) {
    if (consoleEmpty.parentElement) consoleEmpty.remove();
    const line = document.createElement('div');
    line.className = `v4-log-line is-${level}`;
    const lvl = document.createElement('span');
    lvl.className = 'v4-lvl';
    lvl.textContent = level.toUpperCase();
    const msg = document.createElement('span');
    msg.className = 'v4-msg';
    msg.textContent = message;
    const time = document.createElement('span');
    time.className = 'v4-time';
    time.textContent = new Date(at ?? Date.now()).toLocaleTimeString();
    line.append(lvl, msg, time);
    consoleLog.appendChild(line);
    consoleLog.scrollTop = consoleLog.scrollHeight;
    while (consoleLog.childElementCount > 400) consoleLog.firstElementChild.remove();
  }

  function pollLogs() {
    const records = logger?.records?.() ?? [];
    for (const record of records) {
      if (seenRecords.has(record)) continue;
      seenRecords.add(record);
      appendLog(record.level ?? 'info', record.message ?? String(record.data ?? ''), record.at);
    }
  }

  const offBusError = bus?.on?.('error', (payload) => {
    // A listener that throws would make the bus re-emit 'error' forever.
    try {
      // Logger records are already shown; only bus-native errors are added.
      if (payload && typeof payload === 'object' && payload.level && payload.at) return;
      const message = payload?.message ?? payload?.error ?? safeStringify(payload);
      appendLog('error', String(message));
    } catch { /* a broken payload must never break the editor */ }
  });
  const offBusWarning = bus?.on?.('warning', (payload) => {
    try {
      if (payload && typeof payload === 'object' && payload.level && payload.at) return;
      appendLog('warn', String(payload?.message ?? safeStringify(payload)));
    } catch { /* a broken payload must never break the editor */ }
  });

  /* ------------------------------------------------------------- actions */

  function refreshAll() {
    hierarchy.refresh();
    inspector.refresh();
  }

  function select(ids, { additive = false } = {}) {
    const list = (Array.isArray(ids) ? ids : [ids])
      .filter((id) => Number.isFinite(id) && world.get(id));
    let next;
    if (additive) {
      const set = new Set(ctx.selection);
      for (const id of list) {
        if (set.has(id)) set.delete(id);
        else set.add(id);
      }
      next = [...set];
    } else {
      next = list;
    }
    const changed = next.length !== ctx.selection.length
      || next.some((id, i) => id !== ctx.selection[i]);
    ctx.selection = next;
    if (changed) {
      bus?.emit?.(Events.SELECTION_CHANGED, { ids: [...ctx.selection] });
      // The camera (and the host's rig) follows the selection.
      ctx.viewport?.focusOnSelection?.();
      refreshAll();
    }
    return ctx.selection;
  }

  function duplicate() {
    const ids = [...ctx.selection];
    if (!ids.length) return [];
    const specs = [];
    for (const id of ids) {
      const entity = world.get(id);
      if (!entity) continue;
      const components = {};
      for (const [type, data] of entity.components) {
        components[type] = copyComponentData(type, data, { keepChildren: false });
      }
      specs.push({
        name: `${entity.name} copy`,
        tags: [...entity.tags],
        components,
        parent: parentEntityId(world, entity.components.get('transform')),
      });
    }
    const undoSpecs = [];
    const created = [];
    for (const spec of specs) {
      const entity = world.createEntity({ name: spec.name, tags: [...spec.tags] });
      for (const [type, data] of Object.entries(spec.components)) {
        world.addComponent(entity.id, type, copyComponentData(type, data, { keepChildren: false }));
      }
      // Keep the scene-graph links consistent: the copy hangs off the same parent.
      if (spec.parent != null) {
        const parentTransform = world.getComponent(spec.parent, 'transform');
        const childTransform = world.getComponent(entity.id, 'transform');
        if (parentTransform && childTransform) {
          childTransform.parent = parentTransform;
          parentTransform.children = parentTransform.children ?? [];
          parentTransform.children.push(childTransform);
          parentTransform.dirty = true;
        }
      }
      created.push(entity.id);
      undoSpecs.push({ id: entity.id, name: entity.name, tags: [...entity.tags], components: spec.components });
    }
    ctx.undo.push(createEntityAddCommand({ world, entities: undoSpecs }));
    select(created);
    refreshAll();
    logger?.info?.(`Duplicated ${created.length} object(s)`);
    return created;
  }

  function deleteSelection() {
    const ids = [...ctx.selection];
    const specs = [];
    for (const id of ids) {
      const entity = world.get(id);
      if (!entity) continue;
      const components = {};
      for (const [type, data] of entity.components) {
        components[type] = copyComponentData(type, data, { keepChildren: true });
      }
      specs.push({ id: entity.id, name: entity.name, tags: [...entity.tags], components });
    }
    if (!specs.length) return [];
    ctx.undo.run(createEntityRemoveCommand({ world, entities: specs }));
    select([]);
    refreshAll();
    logger?.info?.(`Deleted ${specs.length} object(s)`);
    return specs.map((s) => s.id);
  }

  function reparent(childId, parentId) {
    const child = world.get(childId);
    if (!child) return false;
    const transform = world.getComponent(childId, 'transform');
    if (!transform) {
      logger?.warn?.('Cannot re-parent an object without a transform');
      return false;
    }
    if (parentId != null && isDescendant(parentId, childId)) {
      logger?.warn?.('Cannot re-parent an object into its own subtree');
      return false;
    }
    const beforeParent = parentEntityId(world, transform);
    if (!reparentEntity(world, childId, parentId)) return false;
    const afterParent = parentEntityId(world, world.getComponent(childId, 'transform'));
    ctx.undo.push(createReparentCommand({ world, id: childId, beforeParent, afterParent }));
    refreshAll();
    logger?.info?.(`Re-parented "${child.name}"`);
    return true;
  }

  function isDescendant(candidateId, ancestorId) {
    let current = candidateId;
    for (let i = 0; i < 64; i += 1) {
      const entity = world.get(current);
      if (!entity) return false;
      const transform = entity.components.get('transform');
      if (!transform) return false;
      const parentId = parentEntityId(world, transform);
      if (parentId == null) return false;
      if (parentId === ancestorId) return true;
      current = parentId;
    }
    return false;
  }

  function undo() {
    const command = ctx.undo.undo();
    if (!command) return null;
    bus?.emit?.(Events.UNDO, { label: command.label });
    logger?.info?.(`Undo: ${command.label}`);
    refreshAll();
    return command;
  }

  function redo() {
    const command = ctx.undo.redo();
    if (!command) return null;
    bus?.emit?.(Events.REDO, { label: command.label });
    logger?.info?.(`Redo: ${command.label}`);
    refreshAll();
    return command;
  }

  /**
   * Run `fn` with the transform hierarchy expressed as entity ids.
   *
   * The core stores a transform's parent and children as object references,
   * which makes the serialised scene document cyclic (JSON.stringify throws,
   * so the storage adapter drops the file). The editor therefore swaps the
   * links for ids while it saves and restores them straight afterwards.
   */
  function withSerializableHierarchy(fn) {
    const saved = [];
    for (const entity of world.entities.values()) {
      const transform = entity.components.get('transform');
      if (!transform) continue;
      saved.push({ transform, parent: transform.parent, children: transform.children });
      const parentId = parentEntityId(world, transform);
      const childIds = [];
      for (const child of transform.children ?? []) {
        const childId = entityIdOfTransform(world, child);
        if (childId != null) childIds.push(childId);
      }
      transform.parent = parentId ?? null;
      transform.children = childIds;
    }
    try {
      return fn();
    } finally {
      for (const entry of saved) {
        entry.transform.parent = entry.parent;
        entry.transform.children = entry.children;
        entry.transform.dirty = true;
      }
    }
  }

  /**
   * Rebuild the object links of the transform hierarchy after a load: the
   * scene document carries parent ids, the runtime expects transform objects.
   */
  function restoreHierarchy() {
    const transforms = [];
    for (const entity of world.entities.values()) {
      const transform = entity.components.get('transform');
      if (transform) transforms.push(transform);
    }
    for (const transform of transforms) {
      const parentId = typeof transform.parent === 'number' ? transform.parent : null;
      const parentTransform = parentId != null ? world.getComponent(parentId, 'transform') : null;
      transform.parent = parentTransform ?? null;
      transform.children = [];
      transform.dirty = true;
    }
    for (const transform of transforms) {
      const parent = transform.parent;
      if (!parent) continue;
      parent.children = parent.children ?? [];
      parent.children.push(transform);
    }
  }

  async function save() {
    const name = (sceneName.value || '').trim() || 'Untitled';
    try {
      const doc = await withSerializableHierarchy(() => sceneManager.save(name));
      logger?.info?.(`Scene saved: "${name}" (${doc?.entities?.length ?? 0} objects)`);
      refreshSceneList();
      return doc;
    } catch (err) {
      logger?.error?.(`Scene save failed: ${err?.message ?? err}`);
      return null;
    }
  }

  async function load() {
    const name = (sceneSelect.value || sceneName.value || '').trim();
    if (!name) {
      logger?.warn?.('No scene selected to load');
      return null;
    }
    try {
      const count = sceneManager.names?.includes?.(name)
        ? sceneManager.load(name)
        : await sceneManager.loadFromStorage(name);
      restoreHierarchy();
      select([]);
      refreshAll();
      logger?.info?.(`Scene loaded: "${name}" (${count ?? 0} objects)`);
      return count;
    } catch (err) {
      logger?.error?.(`Scene load failed: ${err?.message ?? err}`);
      return null;
    }
  }

  function refreshSceneList() {
    const names = new Set(sceneManager?.names ?? []);
    try {
      const raw = globalThis.localStorage?.getItem('v4.scenes');
      if (raw) for (const key of Object.keys(JSON.parse(raw))) names.add(key);
    } catch { /* storage is optional */ }
    const current = sceneSelect.value;
    sceneSelect.textContent = '';
    for (const name of names) {
      const option = document.createElement('option');
      option.value = name;
      option.textContent = name;
      if (name === current) option.selected = true;
      sceneSelect.appendChild(option);
    }
    if (!names.size) {
      const option = document.createElement('option');
      option.value = '';
      option.textContent = '(no saved scenes)';
      sceneSelect.appendChild(option);
    }
  }

  function runValidation() {
    const issues = validateScene(world, registry);
    const errors = issues.filter((i) => i.level === 'error').length;
    const warns = issues.length - errors;
    logger?.info?.(`Validation: ${errors} error(s), ${warns} warning(s)`);
    for (const issue of issues) appendLog(issue.level, issue.message);
    return issues;
  }

  function setGizmoMode(mode) {
    ctx.gizmoMode = gizmos.setMode(mode) ? mode : ctx.gizmoMode;
    updateToolbarState();
    return ctx.gizmoMode;
  }

  function toggleHelp(force) {
    const hidden = help.classList.contains('is-hidden');
    const show = force === undefined ? hidden : force;
    help.classList.toggle('is-hidden', !show);
  }

  function setMode(next) {
    if (next !== 'edit' && next !== 'play') return false;
    const changed = ctx.mode !== next;
    ctx.mode = next;
    gizmos.setEnabled(next === 'edit');
    if (changed) {
      bus?.emit?.(Events.MODE_CHANGED, { mode: next });
      logger?.info?.(`Editor mode: ${next}`);
    }
    updateToolbarState();
    return true;
  }

  function updateToolbarState() {
    editBtn.classList.toggle('is-active', ctx.mode === 'edit');
    playBtn.classList.toggle('is-active', ctx.mode === 'play');
    moveBtn.classList.toggle('is-active', ctx.gizmoMode === 'translate');
    rotateBtn.classList.toggle('is-active', ctx.gizmoMode === 'rotate');
    scaleBtn.classList.toggle('is-active', ctx.gizmoMode === 'scale');
    spaceBtn.textContent = ctx.gizmoSpace === 'local' ? 'Local' : 'World';
    spaceBtn.classList.toggle('is-active', ctx.gizmoSpace === 'local');
    snapBtn.textContent = ctx.snapEnabled ? 'On' : 'Off';
    snapBtn.classList.toggle('is-active', ctx.snapEnabled);
    gridBtn.classList.toggle('is-active', ctx.showGrid);
    colliderBtn.classList.toggle('is-active', ctx.showColliders);
    previewBtn.classList.toggle('is-active', ctx.showPreview);
    duplicateBtn.disabled = ctx.selection.length === 0;
    deleteBtn.disabled = ctx.selection.length === 0;
    frameBtn.disabled = ctx.selection.length === 0;
  }

  /* ----------------------------------------------------------- shortcuts */

  function isTypingTarget(target) {
    if (!target) return false;
    const tag = target.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable === true;
  }

  function onKeyDown(event) {
    if (isTypingTarget(event.target)) return;
    const mod = event.metaKey || event.ctrlKey;
    const key = event.key;

    if (mod && (key === 'z' || key === 'Z')) {
      event.preventDefault();
      if (event.shiftKey) redo(); else undo();
      return;
    }
    if (mod && (key === 'y' || key === 'Y')) { event.preventDefault(); redo(); return; }
    if (mod && (key === 'd' || key === 'D')) { event.preventDefault(); duplicate(); return; }
    if (mod && (key === 's' || key === 'S')) { event.preventDefault(); save(); return; }
    if (mod && (key === 'p' || key === 'P')) { event.preventDefault(); setMode(ctx.mode === 'edit' ? 'play' : 'edit'); return; }
    if (mod && (key === 'a' || key === 'A')) {
      event.preventDefault();
      select([...world.entities.keys()]);
      return;
    }

    switch (key) {
      case 'w': case 'W': setGizmoMode('translate'); break;
      case 'e': case 'E': setGizmoMode('rotate'); break;
      case 'r': case 'R': setGizmoMode('scale'); break;
      case 'f': case 'F': viewport.frameSelection(); break;
      case 'g': case 'G': ctx.showGrid = !ctx.showGrid; updateToolbarState(); break;
      case 'c': case 'C': ctx.showColliders = !ctx.showColliders; updateToolbarState(); break;
      case '?': toggleHelp(); break;
      case 'F1': event.preventDefault(); toggleHelp(); break;
      case 'Escape':
        if (!help.classList.contains('is-hidden')) toggleHelp(false);
        else select([]);
        break;
      case 'Delete': case 'Backspace':
        event.preventDefault();
        deleteSelection();
        break;
      default: break;
    }
  }

  const offKey = input?.on?.('keydown', onKeyDown);
  const windowKeyHandler = offKey ? null : onKeyDown;
  if (windowKeyHandler) globalThis.addEventListener?.('keydown', windowKeyHandler);

  /* --------------------------------------------------------------- boot */

  refreshSceneList();
  updateToolbarState();
  logger?.info?.('Editor ready');

  const offBusMode = bus?.on?.(Events.MODE_CHANGED, () => updateToolbarState());

  return {
    /** Called by the host every frame. */
    update(dt = 0, now = performance.now()) {
      // Keep the host's canvas inside the editor viewport.
      if (canvas.parentElement !== viewport.el) viewport.el.appendChild(canvas);
      hierarchy.update();
      inspector.update();
      gizmos.update();
      viewport.update();
      frame += 1;
      if (frame % 10 === 0) {
        pollLogs();
        hierarchyHead.querySelector('.v4-count').textContent = String(world.entityCount);
        inspectorHead.querySelector('.v4-count').textContent = ctx.selection.length
          ? `${ctx.selection.length} selected`
          : '';
      }
    },

    /** Switch between edit and play mode. */
    setMode,

    /** The currently selected entity ids. */
    get selection() {
      return [...ctx.selection];
    },

    /**
     * The camera focus point (the orbit centre) as a THREE.Vector3.
     *
     * The host's camera rig asks the editor where to look before it drives
     * the camera, so this must be a Vector3 — a plain {x,y,z} object makes
     * `camera.lookAt()` produce NaN.
     */
    focusPoint() {
      return ctx.viewport?.focusPoint?.() ?? { x: 0, y: 1, z: 0 };
    },

    /** Select entities by id. */
    select,

    /** Duplicate the selection; returns the new entity ids. */
    duplicate,

    /** Undo the last editor action. */
    undo,

    /** Redo the last undone editor action. */
    redo,

    /** Save the scene through the injected scene manager. */
    save,

    /** Load a scene through the injected scene manager. */
    load,

    /** Validate the scene; returns `[{level, message}]`. */
    validate() {
      return validateScene(world, registry);
    },

    /** Tear the editor down. */
    dispose() {
      offKey?.();
      if (windowKeyHandler) globalThis.removeEventListener?.('keydown', windowKeyHandler);
      offBusError?.();
      offBusWarning?.();
      offBusMode?.();
      hierarchy.dispose();
      inspector.dispose();
      gizmos.dispose();
      viewport.dispose();
      // The canvas belongs to the host — hand it back rather than dropping it.
      if (canvas.parentElement !== host) host.appendChild(canvas);
      ctx.undo.clear();
      container.remove();
    },
  };

  /* ------------------------------------------------------------ helpers */

  function group(label) {
    const el = document.createElement('div');
    el.className = 'v4-group';
    if (label) {
      const span = document.createElement('span');
      span.className = 'v4-title';
      span.style.opacity = '0.6';
      span.textContent = label;
      el.appendChild(span);
    }
    return el;
  }

  function panelHead(text) {
    const head = document.createElement('div');
    head.className = 'v4-panel-head';
    const span = document.createElement('span');
    span.textContent = text;
    const count = document.createElement('span');
    count.className = 'v4-count';
    head.append(span, count);
    return head;
  }
}

/**
 * Stringify an arbitrary bus payload without ever throwing.
 *
 * Bus payloads can hold live objects (an AnimationMixer, a mesh, …) whose
 * structures are circular — a plain JSON.stringify would throw inside a bus
 * listener, and the bus would then re-emit 'error' for that throw.
 *
 * @param {any} value
 * @returns {string}
 */
function safeStringify(value) {
  if (value === null || value === undefined) return String(value);
  if (typeof value !== 'object') return String(value);
  const seen = new WeakSet();
  try {
    return JSON.stringify(value, (key, val) => {
      if (typeof val === 'function') return '[function]';
      if (typeof val === 'object' && val !== null) {
        if (seen.has(val)) return '[circular]';
        seen.add(val);
      }
      return val;
    }) ?? String(value);
  } catch {
    return Object.prototype.toString.call(value);
  }
}

/**
 * Inject the editor stylesheet as a single <style> tag.
 *
 * `editor.css` is imported with Vite's `?inline` suffix, so the CSS arrives
 * as a string and can be injected directly — no external stylesheet, no
 * fonts, no build step. The short fallback below only matters if the CSS
 * import resolves to nothing.
 *
 * @returns {void}
 */
function injectStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = editorCss || FALLBACK_CSS;
  document.head.appendChild(style);
}

/** Minimal layout used only if editor.css could not be resolved. */
const FALLBACK_CSS = `
.v4-editor{position:fixed;inset:0;display:grid;
  grid-template-columns:268px minmax(0,1fr) 340px;
  grid-template-rows:auto minmax(0,1fr) 180px;
  grid-template-areas:"toolbar toolbar toolbar" "hierarchy viewport inspector" "hierarchy console inspector";
  background:#0b1220;color:#d7e0ef;font:12px ui-monospace,monospace;overflow:hidden}
.v4-toolbar{grid-area:toolbar;display:flex;flex-wrap:wrap;gap:6px;padding:6px;background:#101a2c}
.v4-hierarchy{grid-area:hierarchy}.v4-inspector{grid-area:inspector}.v4-console{grid-area:console}
.v4-viewport{grid-area:viewport;position:relative}.v4-viewport>canvas{width:100%;height:100%;display:block}
.v4-panel{display:flex;flex-direction:column;min-height:0;overflow:auto;background:#111a2b}
.v4-panel-body{overflow:auto;flex:1 1 auto}.v4-tree-row{padding:2px 6px;cursor:pointer}
.v4-tree-row.is-selected{background:rgba(56,189,248,.2)}.v4-help{position:absolute;inset:0;background:#000a}
`;
