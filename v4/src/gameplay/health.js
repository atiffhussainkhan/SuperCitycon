/**
 * V4 — Health.
 *
 * Damage, healing and a death flag. The module is standalone: it can be
 * attached to an ECS entity or used on its own.
 *
 * Events: 'gameplay:health' (every change) and 'gameplay:death' (once, when
 * the last point is removed).
 */

/**
 * @param {object} [opts]
 * @param {number} [opts.max]
 * @param {number} [opts.current]
 * @param {number} [opts.entityId]
 * @param {object} [opts.bus]
 * @param {object} [opts.logger]
 */
export function createHealth({ max = 100, current = null, entityId = null, bus = null, logger = null } = {}) {
  const maxHealth = Math.max(1, Math.floor(max));
  let hp = current === null ? maxHealth : Math.min(maxHealth, Math.max(0, Math.floor(current)));
  let dead = hp <= 0;
  const damageLog = [];

  function publish(reason, amount) {
    bus?.emit?.('gameplay:health', { entityId, current: hp, max: maxHealth, dead, reason, amount });
  }

  /**
   * Apply damage.
   * @param {number} amount
   * @param {object} [source]
   * @returns {number} the health left
   */
  function damage(amount, source = null) {
    const value = Math.max(0, Number(amount) || 0);
    if (value === 0) return hp;
    const before = hp;
    hp = Math.max(0, hp - value);
    damageLog.push({ amount: value, source, at: damageLog.length });
    if (damageLog.length > 32) damageLog.shift();
    publish('damage', value);
    if (hp === 0 && !dead) {
      dead = true;
      bus?.emit?.('gameplay:death', { entityId, source });
      logger?.debug(`entity ${entityId ?? '-'} died`, { source });
    }
    if (hp !== before) return hp;
    return hp;
  }

  /**
   * Restore health.
   * @param {number} amount
   * @returns {number} the health left
   */
  function heal(amount) {
    const value = Math.max(0, Number(amount) || 0);
    if (value === 0) return hp;
    hp = Math.min(maxHealth, hp + value);
    // Healing brings a dead entity back to life.
    if (hp > 0 && dead) dead = false;
    publish('heal', value);
    return hp;
  }

  /** Set the health to an exact value. */
  function set(value) {
    hp = Math.min(maxHealth, Math.max(0, Math.floor(Number(value) || 0)));
    if (hp === 0 && !dead) {
      dead = true;
      bus?.emit?.('gameplay:death', { entityId, source: null });
    } else if (hp > 0 && dead) {
      dead = false;
    }
    publish('set', hp);
    return hp;
  }

  return {
    /** Current health. */
    get current() { return hp; },
    /** Maximum health. */
    get max() { return maxHealth; },
    /** Health as a 0..1 fraction. */
    get ratio() { return maxHealth > 0 ? hp / maxHealth : 0; },
    /** Has this entity died? */
    get dead() { return dead; },
    /** Is this entity alive? */
    get alive() { return !dead; },
    /** The entity this health belongs to. */
    get entityId() { return entityId; },

    damage,
    heal,
    set,
    /** Full restore. */
    reset() { return set(maxHealth); },
    /** The last few damage events (newest last). */
    log() { return [...damageLog]; },
  };
}
