/**
 * V4 — Inventory.
 *
 * A flat item list with a slot capacity. Items are identified by a string
 * id; `{ id, count }` entries are merged so the same item never occupies two
 * slots.
 *
 * The module is deliberately free of ECS and DOM dependencies so it can be
 * unit tested on its own.
 */

/**
 * @param {object} [opts]
 * @param {number} [opts.capacity]  how many distinct stacks fit
 * @param {Array}  [opts.items]     initial items
 * @param {object} [opts.bus]
 */
export function createInventory({ capacity = 10, items = [], bus = null } = {}) {
  const maxSlots = Math.max(0, Math.floor(capacity));
  /** @type {{id:string,count:number,name?:string}[]} */
  let slots = [];

  function normalise(item) {
    if (typeof item === 'string') return { id: item, count: 1 };
    if (!item || !item.id) return null;
    return { id: String(item.id), count: Math.max(1, Math.floor(item.count ?? 1)), ...(item.name ? { name: item.name } : {}) };
  }

  function indexOf(id) {
    return slots.findIndex((s) => s.id === id);
  }

  function changed(reason) {
    bus?.emit?.('inventory:changed', { slots: list(), size: slots.length, capacity: maxSlots, reason });
  }

  for (const raw of items) {
    const item = normalise(raw);
    if (item) {
      const at = indexOf(item.id);
      if (at >= 0) slots[at].count += item.count;
      else if (slots.length < maxSlots) slots.push(item);
    }
  }

  /**
   * Add items.
   * @param {string|{id:string,count?:number}} item
   * @param {number} [count]  overrides the count carried by the object form
   * @returns {boolean} false when the inventory is full
   */
  function add(item, count = undefined) {
    const source = typeof item === 'object' ? item : { id: item };
    const amount = count === undefined ? (source.count ?? 1) : count;
    const normalised = normalise({ ...source, count: amount });
    if (!normalised) return false;
    const at = indexOf(normalised.id);
    if (at >= 0) {
      slots[at].count += normalised.count;
      changed('add');
      return true;
    }
    if (slots.length >= maxSlots) return false;
    slots.push(normalised);
    changed('add');
    return true;
  }

  /**
   * Remove items.
   * @returns {boolean} false when there were not enough
   */
  function remove(item, count = 1) {
    const id = typeof item === 'object' ? item.id : item;
    const amount = Math.max(0, Math.floor(count));
    const at = indexOf(String(id));
    if (at < 0) return false;
    if (slots[at].count < amount) return false;
    slots[at].count -= amount;
    if (slots[at].count <= 0) slots.splice(at, 1);
    changed('remove');
    return true;
  }

  /** How many of an item are held. */
  function countOf(item) {
    const id = typeof item === 'object' ? item.id : item;
    const at = indexOf(String(id));
    return at < 0 ? 0 : slots[at].count;
  }

  /** Do we hold at least `count` of an item? */
  function has(item, count = 1) {
    return countOf(item) >= count;
  }

  /** Empty the inventory. */
  function clear() {
    slots = [];
    changed('clear');
  }

  return {
    /** The capacity in slots. */
    get capacity() { return maxSlots; },
    /** How many slots are used. */
    get size() { return slots.length; },
    /** How many slots are free. */
    get free() { return Math.max(0, maxSlots - slots.length); },
    /** A copy of the item stacks. */
    list() { return slots.map((s) => ({ ...s })); },
    /** The item ids, one per slot. */
    ids() { return slots.map((s) => s.id); },
    /** Is the inventory full? */
    get full() { return slots.length >= maxSlots; },

    add,
    remove,
    count: countOf,
    has,
    clear,
    /** Replace the whole contents. */
    set(next) {
      slots = [];
      for (const raw of next ?? []) {
        const item = normalise(raw);
        if (!item) continue;
        const at = indexOf(item.id);
        if (at >= 0) slots[at].count += item.count;
        else if (slots.length < maxSlots) slots.push(item);
      }
      changed('set');
    },
  };
}
