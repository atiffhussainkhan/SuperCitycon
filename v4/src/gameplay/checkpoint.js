/**
 * V4 — Checkpoints.
 *
 * A checkpoint records a snapshot payload (the player's position, the
 * objectives, the inventory — whatever the caller wants to restore) and can
 * hand it back later.
 *
 * The module never decides what a snapshot contains: the caller passes a
 * payload, or a `capture` function that produces one when a checkpoint is
 * touched.
 */

/**
 * @param {object} [opts]
 * @param {object} [opts.bus]
 * @param {object} [opts.storage]   an adapter with async write/read
 * @param {string} [opts.key]       the storage key
 * @param {Function} [opts.capture]  () => payload, called when a checkpoint is touched
 */
export function createCheckpoints({ bus = null, storage = null, key = 'v4.checkpoint', capture = null, logger = null } = {}) {
  /** @type {{entityId:number, payload:any, order:number}[]} */
  const checkpoints = [];
  let latest = null;
  let counter = 0;

  function publish(reason, checkpoint) {
    bus?.emit?.('gameplay:checkpoint', {
      reason,
      entityId: checkpoint?.entityId ?? null,
      payload: checkpoint?.payload ?? null,
      count: checkpoints.length,
    });
  }

  /**
   * Register a checkpoint entity.
   * @param {number} entityId
   * @param {any} [payload] the snapshot to restore from this checkpoint
   */
  function register(entityId, payload = null) {
    const existing = checkpoints.find((c) => c.entityId === entityId);
    if (existing) {
      existing.payload = payload;
      return existing;
    }
    const checkpoint = { entityId, payload, order: counter };
    counter += 1;
    checkpoints.push(checkpoint);
    return checkpoint;
  }

  /**
   * Touch a checkpoint: capture the current snapshot and make it the latest.
   * @param {number} entityId
   * @param {any} [payload] — overrides the `capture` function
   * @returns {object|null} the stored checkpoint
   */
  function touch(entityId, payload = undefined) {
    let checkpoint = checkpoints.find((c) => c.entityId === entityId) ?? null;
    if (!checkpoint) {
      checkpoint = register(entityId, null);
    }
    let snapshot = payload;
    if (snapshot === undefined) {
      if (typeof capture === 'function') {
        try {
          snapshot = capture(entityId);
        } catch (err) {
          logger?.error('checkpoint capture failed', { entityId, error: String(err?.message ?? err) });
          snapshot = null;
        }
      } else {
        // No capture function: keep the payload the checkpoint was registered with.
        snapshot = checkpoint.payload ?? null;
      }
    }
    checkpoint.payload = snapshot;
    latest = checkpoint;
    if (storage?.write) {
      Promise.resolve(storage.write(key, serialise(latest))).catch((err) => {
        logger?.error('checkpoint save failed', { error: String(err?.message ?? err) });
      });
    }
    publish('save', checkpoint);
    return checkpoint;
  }

  /** A JSON-safe copy of a checkpoint. */
  function serialise(checkpoint) {
    if (!checkpoint) return null;
    try {
      return JSON.parse(JSON.stringify({
        entityId: checkpoint.entityId,
        payload: checkpoint.payload,
        order: checkpoint.order,
      }));
    } catch {
      return { entityId: checkpoint.entityId, payload: null, order: checkpoint.order };
    }
  }

  /**
   * Restore the latest checkpoint's payload.
   * @returns {any} the payload (null when there is no checkpoint)
   */
  function restore() {
    if (!latest) {
      bus?.emit?.('gameplay:checkpoint:restore', { payload: null, found: false });
      return null;
    }
    bus?.emit?.('gameplay:checkpoint:restore', {
      payload: latest.payload,
      entityId: latest.entityId,
      found: true,
    });
    return latest.payload;
  }

  return {
    /** Every registered checkpoint. */
    all() { return checkpoints.map((c) => ({ ...c })); },
    /** The most recent checkpoint. */
    get latest() { return latest ? { ...latest } : null; },
    /** How many checkpoints are registered. */
    get count() { return checkpoints.length; },

    register,
    touch,
    restore,
    /** Forget every checkpoint. */
    clear() { checkpoints.length = 0; latest = null; counter = 0; },
    /** Load a stored snapshot from the storage adapter. */
    async load() {
      if (!storage?.read) return null;
      const raw = await storage.read(key);
      if (!raw) return null;
      const checkpoint = { entityId: raw.entityId, payload: raw.payload, order: raw.order ?? 0 };
      latest = checkpoint;
      if (!checkpoints.some((c) => c.entityId === checkpoint.entityId)) checkpoints.push(checkpoint);
      publish('load', checkpoint);
      return checkpoint;
    },
  };
}
