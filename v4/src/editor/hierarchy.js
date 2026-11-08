/**
 * V4 editor — scene hierarchy panel.
 *
 * Lists the world's entities as a tree (parent/child comes from the
 * `transform` component's `parent` link), supports click-to-select,
 * shift-click multi-select and drag & drop re-parenting.
 */

import { parentEntityId } from './undo.js';

const INDENT = '  ';

/**
 * @param {{ctx:any, root:HTMLElement}} deps
 */
export function createHierarchyPanel({ ctx, root }) {
  const list = document.createElement('div');
  list.className = 'v4-panel-body';
  root.appendChild(list);

  let dirty = true;
  let draggedId = null;

  const markDirty = () => { dirty = true; };

  /** @returns {Map<number,{entity:any,parentId:number|null,children:number[]}>} */
  function buildIndex() {
    const index = new Map();
    for (const entity of ctx.world.entities.values()) {
      index.set(entity.id, { entity, parentId: null, children: [] });
    }
    for (const entry of index.values()) {
      const transform = entry.entity.components.get('transform');
      if (!transform) continue;
      const parentId = parentEntityId(ctx.world, transform);
      if (parentId != null && parentId !== entry.entity.id && index.has(parentId)) {
        entry.parentId = parentId;
        index.get(parentId).children.push(entry.entity.id);
      }
    }
    return index;
  }

  function render() {
    const index = buildIndex();
    list.textContent = '';

    if (index.size === 0) {
      const empty = document.createElement('div');
      empty.className = 'v4-tree-empty';
      empty.textContent = 'The world is empty — create an object to begin.';
      list.appendChild(empty);
      return;
    }

    const selected = new Set(ctx.selection);
    const roots = [];
    for (const entry of index.values()) if (entry.parentId == null) roots.push(entry.entity.id);
    roots.sort((a, b) => index.get(a).entity.name.localeCompare(index.get(b).entity.name));

    const frag = document.createDocumentFragment();
    const walk = (id, depth, seen) => {
      if (seen.has(id)) return;
      seen.add(id);
      const entry = index.get(id);
      if (!entry) return;
      frag.appendChild(buildRow(entry.entity, depth, selected));
      for (const childId of entry.children) walk(childId, depth + 1, seen);
    };
    const seen = new Set();
    for (const rootId of roots) walk(rootId, 0, seen);
    // Anything left over (cycle) still gets listed.
    for (const id of index.keys()) if (!seen.has(id)) walk(id, 0, seen);

    list.appendChild(frag);
  }

  function buildRow(entity, depth, selected) {
    const row = document.createElement('div');
    row.className = 'v4-tree-row';
    row.dataset.entityId = String(entity.id);
    row.draggable = true;
    if (selected.has(entity.id)) row.classList.add('is-selected');

    const indent = document.createElement('span');
    indent.className = 'v4-indent';
    indent.textContent = INDENT.repeat(depth);
    row.appendChild(indent);

    const name = document.createElement('span');
    name.className = 'v4-name';
    name.textContent = entity.name || `Entity ${entity.id}`;
    name.title = `${entity.name} (id ${entity.id})`;
    row.appendChild(name);

    for (const tag of entity.tags ?? []) {
      const tagEl = document.createElement('span');
      tagEl.className = 'v4-tag';
      tagEl.textContent = tag;
      row.appendChild(tagEl);
    }

    const comps = [...entity.components.keys()];
    const badge = document.createElement('span');
    badge.className = 'v4-badge';
    badge.textContent = comps.length ? comps.join(',') : '—';
    row.appendChild(badge);

    row.addEventListener('pointerdown', (event) => {
      if (event.button !== 0) return;
      const additive = event.shiftKey || event.metaKey || event.ctrlKey;
      ctx.select([entity.id], { additive });
    });

    row.addEventListener('dragstart', (event) => {
      draggedId = entity.id;
      event.dataTransfer?.setData('text/plain', String(entity.id));
      if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
    });

    row.addEventListener('dragend', () => {
      draggedId = null;
      for (const el of list.querySelectorAll('.is-drop-target')) el.classList.remove('is-drop-target');
    });

    row.addEventListener('dragover', (event) => {
      if (draggedId == null || draggedId === entity.id) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
      row.classList.add('is-drop-target');
    });

    row.addEventListener('dragleave', () => {
      row.classList.remove('is-drop-target');
    });

    row.addEventListener('drop', (event) => {
      event.preventDefault();
      row.classList.remove('is-drop-target');
      const sourceId = draggedId ?? Number(event.dataTransfer?.getData('text/plain'));
      if (!Number.isFinite(sourceId)) return;
      ctx.reparent(sourceId, entity.id);
    });

    return row;
  }

  const offAdd = ctx.world.onAdd?.(markDirty);
  const offRemove = ctx.world.onRemove?.(markDirty);

  return {
    refresh: markDirty,
    update() {
      if (!dirty) return;
      dirty = false;
      render();
    },
    dispose() {
      offAdd?.();
      offRemove?.();
      list.remove();
    },
  };
}
