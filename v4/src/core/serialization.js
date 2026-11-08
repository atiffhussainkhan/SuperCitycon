/**
 * V4 — Component registry and serialization.
 *
 * The save format is built from the registry, so a component that knows how
 * to describe itself round-trips through save/load without the scene code
 * needing to know anything about it.
 */

/**
 * A JSON-safe deep copy.
 *
 * A component can legitimately hold a *runtime handle* — an animation
 * controller, a Three.js object, a callback. Those must never reach the save
 * format: they are not data, they cannot be serialised (they contain cycles),
 * and they are rebuilt on load anyway. This copy keeps plain data, drops
 * functions and unknown object types, and replaces a cycle with a marker
 * instead of throwing.
 */
export function toPlainData(value, seen = new WeakSet()) {
  if (value === null || value === undefined) return value ?? null;
  const t = typeof value;
  if (t === 'number' || t === 'string' || t === 'boolean') return value;
  if (t === 'function' || t === 'symbol' || t === 'bigint') return undefined;
  if (t !== 'object') return undefined;
  if (seen.has(value)) return '[circular]';
  // The set tracks the *current path*, not everything ever visited: a value
  // that is shared by two siblings is copied twice, and only a value that
  // contains itself is a cycle.
  seen.add(value);
  try {
    if (Array.isArray(value)) {
      return value.map((v) => toPlainData(v, seen) ?? null);
    }
    if (value instanceof Date) return value.toISOString();
    if (value instanceof Map) {
      const out = {};
      for (const [k, v] of value.entries()) out[String(k)] = toPlainData(v, seen) ?? null;
      return out;
    }
    if (value instanceof Set) {
      return [...value].map((v) => toPlainData(v, seen) ?? null);
    }
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      const plain = toPlainData(v, seen);
      if (plain !== undefined) out[k] = plain;
    }
    return out;
  } finally {
    seen.delete(value);
  }
}

export function createRegistry() {
  const defs = new Map();

  const registry = {
    /**
     * @param {string} type
     * @param {{serialize?:(data:any)=>any, deserialize?:(raw:any)=>any, defaults?:()=>any}} def
     */
    register(type, def) {
      defs.set(type, { type, ...def });
      return registry;
    },

    has(type) { return defs.has(type); },

    get(type) { return defs.get(type) ?? null; },

    types() { return [...defs.keys()]; },

    /** Default component data for a type (fresh copy each call). */
    defaults(type) {
      const def = defs.get(type);
      if (!def || typeof def.defaults !== 'function') return {};
      return def.defaults();
    },

    serializeComponent(type, data) {
      const def = defs.get(type);
      if (!def) return null;
      if (typeof def.serialize === 'function') return def.serialize(data);
      // Plain JSON data round-trips as-is, minus anything that is a runtime
      // handle rather than data.
      return toPlainData(data ?? null);
    },

    deserializeComponent(type, raw) {
      const def = defs.get(type);
      if (!def) return null;
      if (typeof def.deserialize === 'function') return def.deserialize(raw);
      return raw;
    },

    /** Register the built-in component types. */
    registerBuiltins() {
      registry.register('transform', {
        defaults: () => ({
          position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1], parent: null, children: [],
        }),
        // A transform component may have been attached with only some of its
        // fields (an editor that only sets a position is common), so the
        // serialiser fills the rest from the defaults rather than throwing.
        serialize: (t) => {
          const src = t ?? {};
          return {
            position: [...(src.position ?? [0, 0, 0])],
            rotation: [...(src.rotation ?? [0, 0, 0])],
            scale: [...(src.scale ?? [1, 1, 1])],
            // The hierarchy is stored as entity ids. `serializeScene` fills
            // these in from the world, because only the world knows which
            // entity owns which transform.
            parent: typeof src.parent === 'number' ? src.parent : null,
            children: (src.children ?? []).filter((child) => typeof child === 'number'),
          };
        },
        deserialize: (r) => ({
          position: [...(r.position ?? [0, 0, 0])],
          rotation: [...(r.rotation ?? [0, 0, 0])],
          scale: [...(r.scale ?? [1, 1, 1])],
          parent: r.parent ?? null,
          children: [...(r.children ?? [])],
          dirty: true,
          local: new Array(16).fill(0),
          world: new Array(16).fill(0),
        }),
      });

      registry.register('mesh', {
        defaults: () => ({ kind: 'box', size: [1, 1, 1], colour: '#7f8fa6', castShadow: true, receiveShadow: true }),
      });

      registry.register('light', {
        defaults: () => ({ type: 'directional', colour: '#ffffff', intensity: 1, castShadow: true }),
      });

      registry.register('physics', {
        defaults: () => ({ shape: 'box', halfExtents: [0.5, 0.5, 0.5], mass: 0, restitution: 0, friction: 0.8, kinematic: false }),
      });

      registry.register('npc', {
        defaults: () => ({ behaviour: 'patrol', speed: 2.2, sight: 12, radius: 0.6, home: [0, 0, 0], patrol: [] }),
      });

      registry.register('interactive', {
        defaults: () => ({ kind: 'generic', prompt: 'Interact', once: false, onInteract: null }),
      });

      registry.register('animation', {
        defaults: () => ({ clip: 'Idle', speed: 1, loop: true, state: 'idle' }),
        // The live animator (a Three.js AnimationMixer and its actions) is a
        // runtime handle: it cannot be serialised and is rebuilt on load, so
        // only the state description is saved.
        serialize: (a) => ({
          clip: a?.clip ?? 'Idle',
          speed: a?.speed ?? 1,
          loop: a?.loop ?? true,
          state: a?.state ?? 'idle',
          clips: Array.isArray(a?.clips) ? [...a.clips] : [],
        }),
        deserialize: (r) => ({
          clip: r?.clip ?? 'Idle',
          speed: r?.speed ?? 1,
          loop: r?.loop ?? true,
          state: r?.state ?? 'idle',
          clips: Array.isArray(r?.clips) ? [...r.clips] : [],
          controller: null,
        }),
      });

      registry.register('health', {
        defaults: () => ({ current: 100, max: 100 }),
      });

      registry.register('inventory', {
        defaults: () => ({ slots: [] }),
      });

      registry.register('player', {
        defaults: () => ({ speed: 5, sprint: 9, jump: 6, cameraDistance: 6, cameraHeight: 2.4, mouseSensitivity: 0.0022 }),
      });

      registry.register('meta', {
        defaults: () => ({ note: '', locked: false, group: '' }),
      });

      return registry;
    },
  };
  return registry;
}

/**
 * Serialize a world into a plain JSON scene document.
 *
 * @param {object} world
 * @param {object} registry
 * @param {string} name
 */
export function serializeScene(world, registry, name = 'Untitled') {
  // The transform hierarchy is stored as *entity ids*, not as object
  // references: a parent link and a child link point at each other, so
  // copying the objects would make the document cyclic and `JSON.stringify`
  // would throw. The id map is what makes the format self-contained.
  const idOfTransform = new Map();
  for (const entity of world.entities.values()) {
    const transform = entity.components.get('transform');
    if (transform) idOfTransform.set(transform, entity.id);
  }

  const entities = [];
  for (const entity of world.entities.values()) {
    const components = {};
    for (const [type, data] of entity.components) {
      const raw = registry.serializeComponent(type, data);
      if (raw === null || raw === undefined) continue;
      if (type === 'transform' && raw && typeof raw === 'object') {
        raw.parent = idOfTransform.get(data.parent) ?? null;
        raw.children = (data.children ?? [])
          .map((child) => idOfTransform.get(child))
          .filter((id) => id !== undefined);
      }
      components[type] = raw;
    }
    entities.push({
      id: entity.id,
      name: entity.name,
      tags: [...entity.tags],
      components,
    });
  }
  return {
    format: 'v4-scene',
    version: 1,
    name,
    createdAt: new Date().toISOString(),
    entities,
  };
}

/**
 * Load a scene document into a world. Returns the number of entities loaded.
 * Unknown component types are skipped, not fatal — an old save must still open.
 */
export function deserializeScene(world, registry, doc) {
  if (!doc || doc.format !== 'v4-scene') {
    throw new Error(`not a V4 scene document (format: ${doc?.format ?? 'none'})`);
  }
  world.clear();
  let loaded = 0;

  /** entityId -> the entity's transform component. */
  const transforms = new Map();

  for (const raw of doc.entities ?? []) {
    const entity = world.createEntity({ name: raw.name, tags: raw.tags ?? [], id: raw.id });
    for (const [type, data] of Object.entries(raw.components ?? {})) {
      if (!registry.has(type)) continue;
      const value = registry.deserializeComponent(type, data);
      if (value === null || value === undefined) continue;
      world.addComponent(entity.id, type, value);
      if (type === 'transform') transforms.set(entity.id, value);
    }
    loaded += 1;
  }

  // Rebuild the object links of the hierarchy from the ids the document
  // carries. Without this a loaded scene would have a hierarchy of numbers
  // instead of transforms.
  for (const [entityId, transform] of transforms) {
    const parentId = transform.parent;
    transform.parent = (typeof parentId === 'number' ? transforms.get(parentId) : null) ?? null;
    const childIds = Array.isArray(transform.children) ? transform.children : [];
    transform.children = childIds
      .map((id) => (typeof id === 'number' ? transforms.get(id) : null))
      .filter(Boolean);
    transform.dirty = true;
  }
  // The parent link is also mirrored on the child, so the tree can be walked
  // from either end.
  for (const transform of transforms.values()) {
    for (const child of transform.children) {
      if (child && typeof child === 'object') child.parent = transform;
    }
  }

  return loaded;
}
