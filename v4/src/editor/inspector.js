/**
 * V4 editor — object inspector.
 *
 * Shows the selected entity's name, tags, parent and every component, and
 * writes every edit straight through to the world. Transform edits go through
 * the core transform helpers so the transform is marked dirty; every other
 * edit mutates the live component data in place.
 *
 * Each edit pushes an undo command, so the inspector is fully undoable.
 */

import {
  copyComponentData,
  deepCopy,
  snapshotTransform,
  applyTransformSnapshot,
  createComponentCommand,
  createEntityMetaCommand,
  parentEntityId,
} from './undo.js';
import { toPlainData } from '../core/serialization.js';

const DEG = 180 / Math.PI;

/**
 * Is this value a live runtime handle rather than editable data?
 *
 * An animation controller, a Three.js object or a physics body is not a
 * record: it cannot be shown as an editable JSON value (an animator holds a
 * whole scene graph, which is both cyclic and enormous) and it must never be
 * written back into the component.
 *
 * Two rules catch them: a class instance is never plain data, and a plain
 * object that carries functions is a handle rather than a record — real
 * component data is JSON all the way down.
 */
function isRuntimeHandle(value) {
  if (!value || typeof value !== 'object') return false;
  if (Array.isArray(value)) return value.some((v) => isRuntimeHandle(v));
  const proto = Object.getPrototypeOf(value);
  if (proto !== null && proto !== Object.prototype) return true;
  for (const key of Object.keys(value)) {
    if (typeof value[key] === 'function') return true;
  }
  return false;
}

/**
 * A short, honest description of a runtime handle: what it is, and the few
 * scalar properties that are worth showing. It never tries to print the
 * object itself.
 */
function describeHandle(value) {
  const name = value?.constructor?.name ?? 'Object';
  const parts = [];
  for (const key of ['state', 'previousState', 'clip', 'speed', 'kind', 'type']) {
    const v = value[key];
    if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') parts.push(`${key}=${v}`);
  }
  return `${name} (runtime handle, read-only)${parts.length ? ` — ${parts.join(' ')}` : ''}`;
}

/**
 * @param {{ctx:any, root:HTMLElement}} deps
 */
export function createInspector({ ctx, root }) {
  const body = document.createElement('div');
  body.className = 'v4-panel-body';
  root.appendChild(body);

  let structureDirty = true;
  let lastKey = '';

  const markStructureDirty = () => { structureDirty = true; };
  const offAdd = ctx.world.onAdd?.(markStructureDirty);
  const offRemove = ctx.world.onRemove?.(markStructureDirty);

  const selectionKey = () => ctx.selection.join(',');

  function render() {
    const ids = ctx.selection;
    body.textContent = '';

    if (ids.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'v4-insp-empty';
      empty.textContent = 'Nothing selected. Click an object in the viewport or the hierarchy.';
      body.appendChild(empty);
      return;
    }

    if (ids.length > 1) {
      const note = document.createElement('div');
      note.className = 'v4-insp-section';
      note.innerHTML = `<h3>${ids.length} objects selected</h3><div class="v4-insp-note">Editing the first object: ${ctx.world.get(ids[0])?.name ?? ids[0]}</div>`;
      body.appendChild(note);
    }

    const id = ids[0];
    const entity = ctx.world.get(id);
    if (!entity) {
      const empty = document.createElement('div');
      empty.className = 'v4-insp-empty';
      empty.textContent = 'The selected object no longer exists.';
      body.appendChild(empty);
      return;
    }

    body.appendChild(buildIdentitySection(entity));
    body.appendChild(buildTransformSection(entity));
    for (const [type, data] of entity.components) {
      if (type === 'transform') continue;
      body.appendChild(buildComponentSection(entity, type, data));
    }
    body.appendChild(buildAddComponentSection(entity));
  }

  /* ------------------------------------------------------------ identity */

  function buildIdentitySection(entity) {
    const section = document.createElement('div');
    section.className = 'v4-insp-section';
    const head = document.createElement('h3');
    head.textContent = 'Object';
    const actions = document.createElement('span');
    actions.className = 'v4-actions';
    const focusBtn = makeButton('Frame', () => ctx.frameSelection());
    const deleteBtn = makeButton('Delete', () => ctx.deleteSelection(), 'v4-danger');
    actions.append(focusBtn, deleteBtn);
    head.appendChild(actions);
    section.appendChild(head);

    section.appendChild(field('Name', textInput(entity.name ?? '', (value) => {
      const before = { name: entity.name, tags: [...entity.tags] };
      entity.name = value;
      const after = { name: entity.name, tags: [...entity.tags] };
      ctx.undo.push(createEntityMetaCommand({ world: ctx.world, id: entity.id, before, after, label: 'Rename' }));
      ctx.refreshAll();
    })));

    section.appendChild(field('Tags', textInput([...entity.tags].join(', '), (value) => {
      const before = { name: entity.name, tags: [...entity.tags] };
      entity.tags = new Set(value.split(',').map((t) => t.trim()).filter(Boolean));
      const after = { name: entity.name, tags: [...entity.tags] };
      ctx.undo.push(createEntityMetaCommand({ world: ctx.world, id: entity.id, before, after, label: 'Edit tags' }));
      ctx.refreshAll();
    })));

    section.appendChild(field('Parent', parentSelect(entity)));
    return section;
  }

  function parentSelect(entity) {
    const select = document.createElement('select');
    const none = document.createElement('option');
    none.value = '';
    none.textContent = '— none —';
    select.appendChild(none);

    const transform = entity.components.get('transform');
    const current = transform ? parentEntityId(ctx.world, transform) : null;
    const descendants = collectDescendants(entity.id);

    for (const other of ctx.world.entities.values()) {
      if (other.id === entity.id || descendants.has(other.id)) continue;
      const option = document.createElement('option');
      option.value = String(other.id);
      option.textContent = `${other.name} (${other.id})`;
      if (current === other.id) option.selected = true;
      select.appendChild(option);
    }
    select.addEventListener('change', () => {
      const value = select.value === '' ? null : Number(select.value);
      ctx.reparent(entity.id, value);
    });
    return select;
  }

  function collectDescendants(rootId) {
    const out = new Set();
    const index = new Map();
    for (const entity of ctx.world.entities.values()) {
      const transform = entity.components.get('transform');
      if (!transform) continue;
      const parentId = parentEntityId(ctx.world, transform);
      if (parentId != null) index.set(entity.id, parentId);
    }
    let changed = true;
    while (changed) {
      changed = false;
      for (const [childId, parentId] of index) {
        if (parentId === rootId && !out.has(childId)) { out.add(childId); changed = true; }
      }
    }
    return out;
  }

  /* ----------------------------------------------------------- transform */

  function buildTransformSection(entity) {
    const section = document.createElement('div');
    section.className = 'v4-insp-section';
    const head = document.createElement('h3');
    head.textContent = 'Transform';
    section.appendChild(head);

    const transform = entity.components.get('transform');
    if (!transform) {
      const note = document.createElement('div');
      note.className = 'v4-insp-note';
      note.textContent = 'This object has no transform component.';
      section.appendChild(note);
      const add = makeButton('Add transform', () => {
        const data = ctx.registry?.defaults?.('transform') ?? {
          position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1], parent: null, children: [],
        };
        ctx.world.addComponent(entity.id, 'transform', data);
        structureDirty = true;
        ctx.refreshAll();
      });
      section.appendChild(add);
      return section;
    }

    section.appendChild(vectorField('Position', transform.position, (index, value) => {
      commitTransform(entity, 'position', index, value);
    }, { step: 0.1 }));

    section.appendChild(vectorField('Rotation°', transform.rotation.map((r) => r * DEG), (index, value) => {
      commitTransform(entity, 'rotation', index, value / DEG);
    }, { step: 1 }));

    section.appendChild(vectorField('Scale', transform.scale, (index, value) => {
      commitTransform(entity, 'scale', index, value);
    }, { step: 0.1 }));

    return section;
  }

  function commitTransform(entity, key, index, value) {
    const transform = entity.components.get('transform');
    if (!transform || !Number.isFinite(value)) return;
    const before = snapshotTransform(transform);
    const values = [...(transform[key] ?? [])];
    values[index] = value;
    transform[key] = values;
    transform.dirty = true;
    for (const child of transform.children ?? []) if (child && typeof child === 'object') child.dirty = true;
    const after = snapshotTransform(transform);
    ctx.undo.push({
      label: `Edit ${key}`,
      do: () => applyTransformSnapshot(ctx.world, entity.id, after),
      undo: () => applyTransformSnapshot(ctx.world, entity.id, before),
    });
    ctx.onTransformChanged?.();
  }

  /* ----------------------------------------------------------- components */

  function buildComponentSection(entity, type, data) {
    const section = document.createElement('div');
    section.className = 'v4-insp-section';
    const comp = document.createElement('div');
    comp.className = 'v4-comp';

    const head = document.createElement('div');
    head.className = 'v4-comp-head';
    const typeLabel = document.createElement('span');
    typeLabel.className = 'v4-type';
    typeLabel.textContent = type;
    head.appendChild(typeLabel);
    const actions = document.createElement('span');
    actions.className = 'v4-actions';
    actions.appendChild(makeButton('Remove', () => {
      const before = copyComponentData(type, data);
      ctx.world.removeComponent(entity.id, type);
      ctx.undo.push(createComponentCommand({
        world: ctx.world, id: entity.id, type, before, after: null, label: `Remove ${type}`,
      }));
      structureDirty = true;
      ctx.refreshAll();
    }, 'v4-danger'));
    head.appendChild(actions);
    comp.appendChild(head);

    const compBody = document.createElement('div');
    compBody.className = 'v4-comp-body';
    for (const [key, value] of Object.entries(data ?? {})) {
      compBody.appendChild(componentField(entity, type, data, key, value));
    }
    comp.appendChild(compBody);
    section.appendChild(comp);
    return section;
  }

  function componentField(entity, type, data, key, value) {
    if (typeof value === 'number') {
      return field(key, numberInput(value, (v) => {
        commitComponent(entity, type, data, key, v);
      }));
    }
    if (typeof value === 'boolean') {
      const wrap = document.createElement('div');
      const box = document.createElement('input');
      box.type = 'checkbox';
      box.checked = value;
      box.addEventListener('change', () => commitComponent(entity, type, data, key, box.checked));
      wrap.appendChild(box);
      return field(key, wrap);
    }
    if (typeof value === 'string') {
      return field(key, textInput(value, (v) => commitComponent(entity, type, data, key, v)));
    }
    if (Array.isArray(value) && value.length >= 2 && value.length <= 4 && value.every((v) => typeof v === 'number')) {
      return vectorField(key, value, (index, v) => {
        const next = [...value];
        next[index] = v;
        commitComponent(entity, type, data, key, next);
      }, { step: 0.1 });
    }
    if (Array.isArray(value) && value.every((v) => typeof v === 'number')) {
      return field(key, textInput(value.join(', '), (v) => {
        const next = v.split(',').map((s) => Number(s.trim())).filter((n) => Number.isFinite(n));
        commitComponent(entity, type, data, key, next);
      }));
    }
    if (value && typeof value === 'object') {
      // A live handle (an animator, a mesh) is shown, but never as an
      // editable field: it is not data and it cannot be serialised.
      if (isRuntimeHandle(value)) {
        return field(key, readonlyInput(describeHandle(value)));
      }
      return field(key, jsonInput(value, (v) => commitComponent(entity, type, data, key, v)));
    }
    return field(key, readonlyInput(value === null ? 'null' : String(value)));
  }

  function commitComponent(entity, type, data, key, value) {
    const before = copyComponentData(type, data);
    data[key] = value;
    const after = copyComponentData(type, data);
    ctx.undo.push(createComponentCommand({
      world: ctx.world, id: entity.id, type, before, after, label: `Edit ${type}.${key}`,
    }));
    ctx.onComponentChanged?.(entity.id, type);
  }

  /* ------------------------------------------------------- add component */

  function buildAddComponentSection(entity) {
    const section = document.createElement('div');
    section.className = 'v4-insp-section';
    const head = document.createElement('h3');
    head.textContent = 'Add component';
    section.appendChild(head);

    const types = ctx.registry?.types?.() ?? [];
    const row = document.createElement('div');
    row.className = 'v4-field';
    const label = document.createElement('label');
    label.textContent = 'Type';
    const select = document.createElement('select');
    for (const type of types) {
      if (entity.components.has(type)) continue;
      const option = document.createElement('option');
      option.value = type;
      option.textContent = type;
      select.appendChild(option);
    }
    const add = makeButton('Add', () => {
      const type = select.value;
      if (!type) return;
      const data = ctx.registry?.defaults?.(type) ?? {};
      const snapshot = copyComponentData(type, data);
      ctx.world.addComponent(entity.id, type, copyComponentData(type, data));
      ctx.undo.push(createComponentCommand({
        world: ctx.world, id: entity.id, type, before: null, after: snapshot, label: `Add ${type}`,
      }));
      structureDirty = true;
      ctx.refreshAll();
    });
    row.append(label, select, add);
    section.appendChild(row);
    return section;
  }

  /* ------------------------------------------------------------- widgets */

  function field(labelText, control) {
    const wrap = document.createElement('div');
    wrap.className = 'v4-field';
    const label = document.createElement('label');
    label.textContent = labelText;
    wrap.append(label, control);
    return wrap;
  }

  function vectorField(labelText, values, onChange, { step = 0.1 } = {}) {
    const wrap = document.createElement('div');
    wrap.className = 'v4-field v4-field-vector';
    const label = document.createElement('label');
    label.textContent = labelText;
    wrap.appendChild(label);

    const group = document.createElement('div');
    group.className = 'v4-vec-group';
    group.style.setProperty('--v4-vec', String(Math.max(values.length, 1)));
    const axes = ['X', 'Y', 'Z', 'W'];
    for (let i = 0; i < values.length; i += 1) {
      const cell = document.createElement('div');
      cell.className = 'v4-vec-cell';
      const axis = document.createElement('span');
      axis.className = 'v4-vec-label';
      axis.textContent = axes[i] ?? `#${i}`;
      const input = document.createElement('input');
      input.type = 'number';
      input.step = String(step);
      input.value = formatNumber(values[i]);
      input.addEventListener('change', () => {
        const value = Number(input.value);
        if (!Number.isFinite(value)) return;
        onChange(i, value);
      });
      input.addEventListener('keydown', (event) => event.stopPropagation());
      cell.append(axis, input);
      group.appendChild(cell);
    }
    wrap.appendChild(group);
    return wrap;
  }

  function textInput(value, onCommit) {
    const input = document.createElement('input');
    input.type = 'text';
    input.value = value ?? '';
    input.addEventListener('change', () => onCommit(input.value));
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') input.blur();
      event.stopPropagation();
    });
    return input;
  }

  function numberInput(value, onCommit) {
    const input = document.createElement('input');
    input.type = 'number';
    input.step = 'any';
    input.value = formatNumber(value);
    input.addEventListener('change', () => {
      const next = Number(input.value);
      if (!Number.isFinite(next)) return;
      onCommit(next);
    });
    input.addEventListener('keydown', (event) => event.stopPropagation());
    return input;
  }

  function jsonInput(value, onCommit) {
    const area = document.createElement('textarea');
    // `toPlainData` is cycle-safe: a component that still holds a reference
    // to something live must not throw while the panel is being drawn.
    let text = JSON.stringify(toPlainData(value), null, 1) ?? '';
    if (text.length > 4000) {
      // A very large value is shown, not edited: writing it back by hand
      // would be a mistake waiting to happen.
      text = `${text.slice(0, 4000)}\n… (${text.length - 4000} more characters)`;
      area.readOnly = true;
    }
    area.value = text;
    area.addEventListener('change', () => {
      try {
        onCommit(JSON.parse(area.value));
      } catch {
        area.classList.add('v4-bad');
      }
    });
    area.addEventListener('keydown', (event) => event.stopPropagation());
    return area;
  }

  function readonlyInput(value) {
    const input = document.createElement('input');
    input.type = 'text';
    input.value = value;
    input.readOnly = true;
    input.disabled = true;
    return input;
  }

  return {
    /**
     * Value-only refresh: the panels redraw their own values, the inspector
     * keeps its inputs (and the caret) intact.
     */
    refresh() {},
    update() {
      const key = selectionKey();
      if (structureDirty || key !== lastKey) {
        structureDirty = false;
        lastKey = key;
        render();
      }
    },
    dispose() {
      offAdd?.();
      offRemove?.();
      body.remove();
    },
  };
}

/**
 * Small DOM helpers shared by the editor panels.
 * @param {string} text
 * @param {()=>void} onClick
 * @param {string} [extraClass]
 */
export function makeButton(text, onClick, extraClass = '') {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = text;
  if (extraClass) button.classList.add(extraClass);
  button.addEventListener('click', (event) => {
    event.stopPropagation();
    onClick(event);
  });
  return button;
}

/**
 * @param {number} value
 * @returns {string}
 */
export function formatNumber(value) {
  if (!Number.isFinite(value)) return '0';
  const rounded = Math.round(value * 1000) / 1000;
  return String(rounded);
}
