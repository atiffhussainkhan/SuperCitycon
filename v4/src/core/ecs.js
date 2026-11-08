/**
 * V4 — Entity/Component core.
 *
 * A deliberately small ECS: entities are ids, components are plain objects
 * stored per type, and systems are functions the host calls each frame. The
 * point is not to be a framework — it is that the editor, the runtime and the
 * save format all speak the same vocabulary, so a scene saved in the editor
 * is exactly the scene the game loads.
 */

export function createWorld() {
  /** @type {Map<number, {id:number,name:string,tags:Set<string>,components:Map<string,any>,enabled:boolean}>} */
  const entities = new Map();
  const listeners = { added: [], removed: [] };

  /**
   * Entity ids are per-world, not per-module. Two worlds created in the same
   * process must not share a counter, or a scene loaded into a fresh world
   * would come back with ids that no longer match the ones it was saved with.
   */
  let nextId = 1;

  function emit(list, entity, type) {
    for (const fn of list) {
      try { fn(entity, type); } catch (err) { console.error('[v4/ecs]', err); }
    }
  }

  const world = {
    entities,

    createEntity({ name = 'Entity', tags = [], id = null } = {}) {
      const eid = id ?? nextId++;
      if (id !== null && id >= nextId) nextId = id + 1;
      const entity = { id: eid, name, tags: new Set(tags), components: new Map(), enabled: true };
      entities.set(eid, entity);
      emit(listeners.added, entity, null);
      return entity;
    },

    removeEntity(id) {
      const entity = entities.get(id);
      if (!entity) return false;
      entities.delete(id);
      emit(listeners.removed, entity, null);
      return true;
    },

    get(id) { return entities.get(id) ?? null; },

    addComponent(id, type, data = {}) {
      const entity = entities.get(id);
      if (!entity) return null;
      entity.components.set(type, data);
      emit(listeners.added, entity, type);
      return data;
    },

    removeComponent(id, type) {
      const entity = entities.get(id);
      if (!entity) return false;
      const had = entity.components.delete(type);
      if (had) emit(listeners.removed, entity, type);
      return had;
    },

    getComponent(id, type) {
      const entity = entities.get(id);
      if (!entity) return null;
      return entity.components.get(type) ?? null;
    },

    hasComponent(id, type) {
      const entity = entities.get(id);
      return !!entity && entity.components.has(type);
    },

    /**
     * Entities carrying every listed filter (all of them must match).
     *
     * A string filter matches an entity that has the **tag** with that name
     * *or* a **component** of that type. This keeps one vocabulary for the
     * editor's hierarchy filtering (`query('npc')` finds every NPC whether it
     * is tagged or carries an `npc` component) and for the runtime's systems.
     *
     * `query('player')`, `query('transform')`, `query('npc', 'npc')` and
     * `query()` all behave as expected under that rule.
     */
    query(...filters) {
      const out = [];
      for (const entity of entities.values()) {
        if (!entity.enabled) continue;
        let ok = true;
        for (const f of filters) {
          if (typeof f === 'string') {
            if (!entity.tags.has(f) && !entity.components.has(f)) { ok = false; break; }
          } else if (!entity.components.has(f)) { ok = false; break; }
        }
        if (ok) out.push(entity);
      }
      return out;
    },

    onAdd(fn) { listeners.added.push(fn); return () => listeners.added.splice(listeners.added.indexOf(fn), 1); },
    onRemove(fn) { listeners.removed.push(fn); return () => listeners.removed.splice(listeners.removed.indexOf(fn), 1); },

    clear() { entities.clear(); },

    get entityCount() { return entities.size; },
  };
  return world;
}

/** Tags used across V4. Kept here so the editor, runtime and tests agree. */
export const Tags = {
  EDITOR_ONLY: 'editor-only',
  NPC: 'npc',
  PLAYER: 'player',
  INTERACTIVE: 'interactive',
  STATIC: 'static',
  LIGHT: 'light',
};
