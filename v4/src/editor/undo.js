/**
 * V4 editor — undo / redo.
 *
 * A plain command stack. Every mutating editor operation pushes a command
 * that knows how to apply and un-apply itself; the stack keeps the redo
 * branch alive until a new command is pushed.
 *
 * Commands are built by the small factories at the bottom of this file so
 * that the editor never has to hand-roll snapshots.
 */

/**
 * Structural deep copy that keeps functions by reference and copies
 * arrays / plain objects / Maps / Sets.
 *
 * Cycle safe: a reference that has already been copied is copied once and
 * shared, so a transform graph (parent <-> children) cannot recurse forever.
 *
 * @template T
 * @param {T} value
 * @param {WeakMap<object, any>} [seen]
 * @returns {T}
 */
export function deepCopy(value, seen = new WeakMap()) {
  if (Array.isArray(value)) {
    if (seen.has(value)) return seen.get(value);
    const out = [];
    seen.set(value, out);
    for (const item of value) out.push(deepCopy(item, seen));
    return out;
  }
  if (value && typeof value === 'object') {
    if (seen.has(value)) return seen.get(value);
    if (value instanceof Map) {
      const out = new Map();
      seen.set(value, out);
      for (const [k, v] of value) out.set(k, deepCopy(v, seen));
      return out;
    }
    if (value instanceof Set) {
      const out = new Set();
      seen.set(value, out);
      for (const v of value) out.add(deepCopy(v, seen));
      return out;
    }
    // A class instance is a live runtime handle (an animation controller, a
    // Three.js object). Copying it would produce a broken clone whose
    // methods still drive the *original*, so it is dropped instead: the
    // copy gets a fresh handle when the scene rebuilds it.
    const proto = Object.getPrototypeOf(value);
    if (proto !== null && proto !== Object.prototype) return undefined;
    const out = {};
    seen.set(value, out);
    for (const key of Object.keys(value)) {
      const copied = deepCopy(value[key], seen);
      if (copied !== undefined) out[key] = copied;
    }
    return out;
  }
  return value;
}

/**
 * Copy one component's data for an undo snapshot or a duplication.
 *
 * The transform component is special: its `parent` and `children` are links
 * into the scene graph, not data. Copying them would either duplicate the
 * hierarchy or recurse through a cycle, so the parent is kept by reference
 * and the children are kept as a list of references.
 *
 * @param {string} type
 * @param {any} data
 * @param {{keepChildren?:boolean}} [options]
 * @returns {any}
 */
export function copyComponentData(type, data, { keepChildren = true } = {}) {
  if (type === 'transform' && data && typeof data === 'object') {
    return {
      position: [...(data.position ?? [0, 0, 0])],
      rotation: [...(data.rotation ?? [0, 0, 0])],
      scale: [...(data.scale ?? [1, 1, 1])],
      parent: data.parent ?? null,
      children: keepChildren ? [...(data.children ?? [])] : [],
      dirty: true,
    };
  }
  return deepCopy(data);
}

/**
 * @typedef {{label:string, do:()=>void, undo:()=>void}} Command
 */

/**
 * Create a command stack.
 * @param {{limit?:number, onChange?:(state:{canUndo:boolean,canRedo:boolean,undoLabel:string|null,redoLabel:string|null})=>void}} [options]
 */
export function createUndoStack({ limit = 200, onChange = null } = {}) {
  /** @type {Command[]} */
  const undoStack = [];
  /** @type {Command[]} */
  const redoStack = [];

  function notify() {
    if (!onChange) return;
    onChange({
      canUndo: undoStack.length > 0,
      canRedo: redoStack.length > 0,
      undoLabel: undoStack.length ? undoStack[undoStack.length - 1].label : null,
      redoLabel: redoStack.length ? redoStack[redoStack.length - 1].label : null,
    });
  }

  return {
    /** Push a command and run it (the command describes an already-applied change). */
    push(command) {
      if (!command || typeof command.do !== 'function' || typeof command.undo !== 'function') {
        throw new Error('undo: command needs do() and undo()');
      }
      undoStack.push(command);
      if (undoStack.length > limit) undoStack.shift();
      redoStack.length = 0;
      notify();
      return command;
    },

    /** Execute a command and record it. */
    run(command) {
      command.do();
      return this.push(command);
    },

    undo() {
      const command = undoStack.pop();
      if (!command) return null;
      try {
        command.undo();
      } catch (err) {
        undoStack.push(command);
        throw err;
      }
      redoStack.push(command);
      notify();
      return command;
    },

    redo() {
      const command = redoStack.pop();
      if (!command) return null;
      try {
        command.do();
      } catch (err) {
        redoStack.push(command);
        throw err;
      }
      undoStack.push(command);
      notify();
      return command;
    },

    clear() {
      undoStack.length = 0;
      redoStack.length = 0;
      notify();
    },

    get canUndo() { return undoStack.length > 0; },
    get canRedo() { return redoStack.length > 0; },
    get undoLabel() { return undoStack.length ? undoStack[undoStack.length - 1].label : null; },
    get redoLabel() { return redoStack.length ? redoStack[redoStack.length - 1].label : null; },
    get size() { return undoStack.length; },
    get redoSize() { return redoStack.length; },
    labels() { return undoStack.map((c) => c.label); },
  };
}

/* ------------------------------------------------------------------ *
 * Command factories
 * ------------------------------------------------------------------ */

/**
 * Snapshot of a transform component (the editable local values only).
 * @param {any} transform
 */
export function snapshotTransform(transform) {
  if (!transform) return null;
  return {
    position: [...(transform.position ?? [0, 0, 0])],
    rotation: [...(transform.rotation ?? [0, 0, 0])],
    scale: [...(transform.scale ?? [1, 1, 1])],
  };
}

/**
 * Write a transform snapshot back into the world, marking the transform dirty.
 * @param {any} world
 * @param {number} id
 * @param {any} snapshot
 */
export function applyTransformSnapshot(world, id, snapshot) {
  const transform = world.getComponent(id, 'transform');
  if (!transform || !snapshot) return false;
  transform.position = [...snapshot.position];
  transform.rotation = [...snapshot.rotation];
  transform.scale = [...snapshot.scale];
  transform.dirty = true;
  for (const child of transform.children ?? []) if (child && typeof child === 'object') child.dirty = true;
  return true;
}

/**
 * A command that changes the local transform of one or more entities.
 * @param {{world:any, before:Record<number,any>, after:Record<number,any>, label?:string}} opts
 */
export function createTransformCommand({ world, before, after, label = 'Transform' }) {
  return {
    label,
    do() {
      for (const [id, snap] of Object.entries(after)) applyTransformSnapshot(world, Number(id), snap);
    },
    undo() {
      for (const [id, snap] of Object.entries(before)) applyTransformSnapshot(world, Number(id), snap);
    },
  };
}

/**
 * Replace a component's data in place (so live references stay valid).
 * @param {any} world
 * @param {number} id
 * @param {string} type
 * @param {any} snapshot
 */
export function applyComponentSnapshot(world, id, type, snapshot) {
  if (snapshot === null || snapshot === undefined) {
    if (world.hasComponent(id, type)) world.removeComponent(id, type);
    return;
  }
  const live = world.getComponent(id, type);
  if (!live) {
    world.addComponent(id, type, copyComponentData(type, snapshot));
    return;
  }
  for (const key of Object.keys(live)) if (!(key in snapshot)) delete live[key];
  for (const [key, value] of Object.entries(snapshot)) {
    live[key] = (key === 'parent' || key === 'children') ? value : deepCopy(value);
  }
}

/**
 * A command that changes one component's data.
 * @param {{world:any,id:number,type:string,before:any,after:any,label?:string}} opts
 */
export function createComponentCommand({ world, id, type, before, after, label = `Edit ${type}` }) {
  return {
    label,
    do() { applyComponentSnapshot(world, id, type, deepCopy(after)); },
    undo() { applyComponentSnapshot(world, id, type, deepCopy(before)); },
  };
}

/**
 * A command that changes entity metadata (name / tags).
 * @param {{world:any,id:number,before:{name:string,tags:string[]},after:{name:string,tags:string[]},label?:string}} opts
 */
export function createEntityMetaCommand({ world, id, before, after, label = 'Rename' }) {
  const apply = (state) => {
    const entity = world.get(id);
    if (!entity) return;
    entity.name = state.name;
    entity.tags = new Set(state.tags);
  };
  return { label, do: () => apply(after), undo: () => apply(before) };
}

/**
 * A command that creates entities (duplication / "add object").
 * @param {{world:any,entities:Array<{id:number,name:string,tags:string[],components:Record<string,any>}>,keepChildren?:boolean}} opts
 */
export function createEntityAddCommand({ world, entities, keepChildren = false }) {
  return {
    label: entities.length > 1 ? `Create ${entities.length} objects` : 'Create object',
    do() {
      for (const spec of entities) {
        if (world.get(spec.id)) continue;
        const entity = world.createEntity({ id: spec.id, name: spec.name, tags: [...spec.tags] });
        for (const [type, data] of Object.entries(spec.components ?? {})) {
          world.addComponent(entity.id, type, copyComponentData(type, data, { keepChildren }));
        }
      }
    },
    undo() {
      for (const spec of entities) world.removeEntity(spec.id);
    },
  };
}

/**
 * A command that removes entities (delete).
 * @param {{world:any,entities:Array<{id:number,name:string,tags:string[],components:Record<string,any>}>}} opts
 */
export function createEntityRemoveCommand({ world, entities }) {
  return {
    label: entities.length > 1 ? `Delete ${entities.length} objects` : 'Delete object',
    do() {
      for (const spec of entities) world.removeEntity(spec.id);
    },
    undo() {
      for (const spec of entities) {
        if (world.get(spec.id)) continue;
        const entity = world.createEntity({ id: spec.id, name: spec.name, tags: [...spec.tags] });
        for (const [type, data] of Object.entries(spec.components ?? {})) {
          world.addComponent(entity.id, type, copyComponentData(type, data, { keepChildren: true }));
        }
      }
    },
  };
}

/**
 * A command that re-parents an entity (hierarchy drag & drop).
 * @param {{world:any,id:number,beforeParent:any,afterParent:any,childrenOf:any}} opts
 */
export function createReparentCommand({ world, id, beforeParent, afterParent }) {
  return {
    label: 'Reparent',
    do() { reparent(world, id, afterParent); },
    undo() { reparent(world, id, beforeParent); },
  };
}

/**
 * Set the parent of an entity's transform. `parentId` of null clears it.
 * @param {any} world
 * @param {number} id
 * @param {number|null} parentId
 */
export function reparent(world, id, parentId) {
  const entity = world.get(id);
  if (!entity) return false;
  const transform = world.getComponent(id, 'transform');
  if (!transform) return false;
  const parentTransform = parentId == null ? null : world.getComponent(parentId, 'transform');
  if (parentId != null && !parentTransform) return false;
  if (parentId === id) return false;

  // Detach from the old parent. The parent link may be stored as a transform
  // object or as a plain entity id — both are handled.
  const oldParent = resolveParentTransform(world, transform);
  if (oldParent && Array.isArray(oldParent.children)) {
    const i = oldParent.children.indexOf(transform);
    if (i >= 0) oldParent.children.splice(i, 1);
  }
  // Detach from the new parent's old child list.
  if (parentTransform && Array.isArray(parentTransform.children)) {
    const i = parentTransform.children.indexOf(transform);
    if (i >= 0) parentTransform.children.splice(i, 1);
  }

  transform.parent = parentTransform ?? null;
  if (parentTransform) {
    parentTransform.children = parentTransform.children ?? [];
    parentTransform.children.push(transform);
    parentTransform.dirty = true;
  }
  transform.dirty = true;
  return true;
}

/**
 * Resolve a transform's parent link to a transform object.
 * @param {any} world
 * @param {any} transform
 * @returns {any|null}
 */
export function resolveParentTransform(world, transform) {
  const parent = transform?.parent;
  if (!parent) return null;
  if (typeof parent === 'number') return world.getComponent(parent, 'transform') ?? null;
  if (typeof parent === 'object') return parent;
  return null;
}

/**
 * The entity id that owns a transform object, or null.
 * @param {any} world
 * @param {any} transform
 * @returns {number|null}
 */
export function entityIdOfTransform(world, transform) {
  if (!transform) return null;
  for (const entity of world.entities.values()) {
    if (entity.components.get('transform') === transform) return entity.id;
  }
  return null;
}

/**
 * The entity id of a transform's parent, or null.
 * @param {any} world
 * @param {any} transform
 * @returns {number|null}
 */
export function parentEntityId(world, transform) {
  const parent = transform?.parent;
  if (parent == null) return null;
  if (typeof parent === 'number') return world.get(parent) ? parent : null;
  if (typeof parent === 'object') {
    for (const entity of world.entities.values()) {
      if (entity.components.get('transform') === parent) return entity.id;
    }
  }
  return null;
}
