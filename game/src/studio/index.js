/**
 * studio/index.js — the SCC Studio domain factory (STD / BOT-08).
 *
 * OWNER: STD (BOT-08). Public API is fixed by `core/CONTRACT.md` §7:
 *
 *   export function createStudio(ctx) -> { init, update, tick,
 *     open(), close(), isOpen(),
 *     voxels,                 // Map "x,y,z" -> { color, id }
 *     paint(x, y, z, color), erase(x, y, z),
 *     brushSize(), setBrush(n),
 *     saveWorkshop(), loadWorkshop(),
 *     exportOBJ(), dispose };
 *
 * WHAT THIS DOMAIN IS
 *   SCC Studio — the PC title's built-in voxel editor (FR-STD-001). It opens
 *   from inside the running city without leaving the game, authors a model
 *   on an axis-aligned lattice, previews it live in 3D and exports it so the
 *   buildings domain can place it as a custom building.
 *
 * THE DIVISION OF LABOUR
 *   voxels.js — the PURE data model: painting, erasing, bounds, the OBJ
 *               export/import, the workshop serialisation, the derivation
 *               inputs. No `three`, fully unit-tested in Node.
 *   editor.js — the Three.js VIEW: the instanced-cube preview, the orbit
 *               camera, the palette chrome.
 *   index.js  — this file: the service, the state wiring, the save/load.
 *
 * HONESTY
 *   - Materials are addressed by INDEX into the palette (FR-STD-035); the
 *     palette is the game's own 16-colour palette from `config.PALETTE`.
 *   - The authoring volume's resolution and the cost-derivation formula are
 *     not published (OQ-STD-02, OQ-STD-33). The defaults are proposed
 *     values and are reported as "assumed".
 *   - No artwork is loaded here. The editor's cubes are tool geometry.
 */

import { EVENTS } from '../core/events.js';
import {
  DEFAULT_DIMS, VOXELS_PER_CELL, FORMAT_VERSION,
  buildPalette, defaultPalette, voxelKey, parseVoxelKey, clampVoxel,
  inVoxelBounds, voxelBounds, paintVoxel, eraseVoxel, paintMaterial,
  paintBrush, eraseBrush, footprintCells, derivationInputs, deriveBuildCost,
  exportOBJ as buildOBJString, importOBJ, parseOBJ, serializeWorkshop, deserializeWorkshop,
  createHistory, applyChange,
} from './voxels.js';
import { createStudioEditor } from './editor.js';
import { liveStateProxy, liveSubtree } from '../core/state.js';

/** The local-storage key the workshop documents live under. */
export const WORKSHOP_STORAGE_KEY = 'supercitycon.sccstudio.workshop';

/**
 * Resolve whatever the caller passed as a "colour" into a material index.
 * Accepts a material index (1..16), a palette colour value (0xffd166), a
 * CSS hex string ('#ffd166') or a voxel record.
 *
 * @param {number|string|object} value
 * @param {Array} palette
 * @returns {number} the material index, or 0 when it cannot be resolved
 */
export function resolveMaterial(value, palette = defaultPalette()) {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'object') return resolveMaterial(value.id ?? value.color ?? value.materialIndex, palette);
  if (typeof value === 'string') {
    const hex = value.trim().replace(/^#/, '');
    const n = Number.parseInt(hex, 16);
    if (Number.isFinite(n)) return resolveMaterial(n, palette);
    const named = palette.find((p) => p.name.toLowerCase() === value.trim().toLowerCase());
    return named ? named.index : 0;
  }
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  // A small integer is a material index; a large one is a colour value.
  if (Number.isInteger(n) && n >= 1 && n <= palette.length) return n;
  const byColour = palette.find((p) => p.color === n);
  return byColour ? byColour.index : 0;
}

/**
 * Create or repair the live `state.studio` sub-tree.
 *
 * Called by `liveSubtree()` whenever the sub-tree object changes — that is,
 * on first use and after a save/load replaced it with a fresh object.
 *
 * @param {object} tree the live state tree
 * @returns {object} the live studio sub-tree
 */
function ensureStudioState(tree) {
  const s = tree?.studio ?? (tree.studio = {});
  s.open = false;
  s.voxels = s.voxels instanceof Map ? s.voxels : new Map();
  s.doc = s.doc ?? null;
  s.dirty = false;
  s.palette = Array.isArray(s.palette) && s.palette.length ? s.palette : defaultPalette();
  s.brush = Number.isFinite(s.brush) ? s.brush : 1;
  return s;
}

/**
 * Create the studio service.
 * @param {object} ctx the shared context
 */
export function createStudio(ctx) {
  /**
   * The live state tree.
   *
   * `ctx.state` is a GETTER in main.js (core/state.js `setState()` REPLACES
   * the state object when a save is loaded or the game is reset), so a
   * captured `ctx.state` would be an ORPHANED tree: the domain would keep
   * writing into an object nobody reads while the live tree stayed at zero.
   * Every access therefore resolves through `ctx.state` again.
   */
  const state = liveStateProxy(ctx);
  const bus = ctx?.bus;

  /**
   * The live studio sub-tree.
   *
   * The sub-tree is REPLACED wholesale when a save is loaded (`core/save.js`
   * copies the restored tree over the live one), so the reference is
   * re-resolved whenever `state.studio` is not the object we last saw.
   */
  const studioState = liveSubtree(ctx, 'studio', ensureStudioState);

  const dims = { ...DEFAULT_DIMS };

  let material = studioState.palette[0]?.index ?? 1;
  let brush = studioState.brush ?? 1;
  let editor = null;
  let revision = 0;
  let disposed = false;
  let mounted = false;

  const history = createHistory(64);

  // -------------------------------------------------------------------------
  // Editing
  // -------------------------------------------------------------------------

  function markDirty() {
    revision += 1;
    if (studioState) studioState.dirty = true;
    bus?.emit?.(EVENTS.STUDIO_DIRTY, { voxels: studioState.voxels.size });
  }

  /**
   * Paint a voxel.
   * @param {number} x @param {number} y @param {number} z
   * @param {number|string} color a material index, a palette colour or a hex string
   * @returns {{ok:boolean, reason:string|null}}
   */
  function paint(x, y, z, color = material) {
    const index = resolveMaterial(color, studioState.palette);
    if (!index) return { ok: false, reason: 'bad-material' };
    const before = captureCell(x, y, z);
    const result = brush > 1
      ? paintBrush(studioState.voxels, x, y, z, index, brush, { palette: studioState.palette, dims })
      : paintVoxel(studioState.voxels, x, y, z, index, { palette: studioState.palette, dims });
    if (!result.ok) return { ok: false, reason: result.reason };
    history.push({ before, after: captureArea(x, y, z, brush) });
    markDirty();
    return { ok: true, reason: null };
  }

  /** Erase a voxel (or the brush footprint). */
  function erase(x, y, z) {
    const before = captureArea(x, y, z, brush);
    const result = brush > 1
      ? eraseBrush(studioState.voxels, x, y, z, brush, { palette: studioState.palette, dims })
      : eraseVoxel(studioState.voxels, x, y, z, { palette: studioState.palette, dims });
    if (!result.ok) return { ok: false, reason: result.reason };
    history.push({ before, after: captureCell(x, y, z) });
    markDirty();
    return { ok: true, reason: null };
  }

  /** Recolour an occupied voxel without changing its occupancy. */
  function recolor(x, y, z, color = material) {
    const index = resolveMaterial(color, studioState.palette);
    const result = paintMaterial(studioState.voxels, x, y, z, index, { palette: studioState.palette, dims });
    if (result.ok) markDirty();
    return result;
  }

  function captureCell(x, y, z) {
    const key = voxelKey(x, y, z);
    const rec = studioState.voxels.get(key);
    return { [key]: rec ? { color: rec.color, id: rec.id } : null };
  }

  function captureArea(x, y, z, size) {
    const out = {};
    const n = Math.max(1, Math.round(size));
    const half = Math.floor((n - 1) / 2);
    for (let dz = -half; dz <= half; dz += 1) {
      for (let dx = -half; dx <= half; dx += 1) {
        const key = voxelKey(x + dx, y, z + dz);
        const rec = studioState.voxels.get(key);
        out[key] = rec ? { color: rec.color, id: rec.id } : null;
      }
    }
    return out;
  }

  // -------------------------------------------------------------------------
  // Workshop save / load (FR-STD-098 … 109)
  // -------------------------------------------------------------------------

  /**
   * Serialise the document.
   * @returns {string} the JSON document
   */
  function toJSON() {
    return serializeWorkshop({
      voxels: studioState.voxels,
      dims,
      palette: studioState.palette,
      kind: studioState?.doc?.kind ?? 'building',
      id: studioState?.doc?.id ?? 'workshop-model',
      name: studioState?.doc?.name ?? 'Untitled model',
    });
  }

  /**
   * Save the workshop document to this browser's storage.
   * @param {string} [slot='default']
   * @returns {{ok:boolean, reason:string|null, slot:string, bytes:number}}
   */
  function saveWorkshop(slot = 'default') {
    const json = toJSON();
    try {
      if (typeof localStorage === 'undefined') {
        return { ok: false, reason: 'no-storage', slot, bytes: json.length };
      }
      localStorage.setItem(`${WORKSHOP_STORAGE_KEY}.${slot}`, json);
      if (studioState) studioState.dirty = false;
      bus?.emit?.(EVENTS.GAME_SAVED, { slot: `studio:${slot}` });
      return { ok: true, reason: null, slot, bytes: json.length };
    } catch (err) {
      return { ok: false, reason: err?.message ?? 'save-failed', slot, bytes: json.length };
    }
  }

  /**
   * Load the workshop document from this browser's storage.
   * @param {string} [slot='default']
   * @returns {{ok:boolean, reason:string|null, slot:string}}
   */
  function loadWorkshop(slot = 'default') {
    let json = null;
    try {
      if (typeof localStorage === 'undefined') {
        return { ok: false, reason: 'no-storage', slot };
      }
      json = localStorage.getItem(`${WORKSHOP_STORAGE_KEY}.${slot}`);
    } catch (err) {
      return { ok: false, reason: err?.message ?? 'load-failed', slot };
    }
    if (!json) return { ok: false, reason: 'no-save', slot };
    const parsed = deserializeWorkshop(json);
    if (!parsed.ok) return { ok: false, reason: parsed.reason, slot };
    applyDoc(parsed.doc);
    return { ok: true, reason: null, slot };
  }

  /** Replace the current document with a parsed one. */
  function applyDoc(doc) {
    studioState.voxels.clear();
    for (const [key, rec] of doc.voxels) studioState.voxels.set(key, { color: rec.color, id: rec.id });
    if (studioState) {
      studioState.doc = {
        id: doc.id,
        name: doc.name,
        kind: doc.kind,
        parentAssetId: doc.parentAssetId,
        pivot: doc.pivot,
        formatVersion: doc.formatVersion,
        contentHash: doc.contentHash,
      };
      studioState.dirty = false;
    }
    markDirty();
    editor?.invalidate();
  }

  /**
   * Import an OBJ string into the document (the reverse of `exportOBJ`).
   * @param {string} text
   * @returns {{ok:boolean, reason:string|null, count:number}}
   */
  function importOBJDocument(text) {
    const imported = importOBJ(text, { palette: studioState.palette, dims });
    if (!imported.size) return { ok: false, reason: 'empty-import', count: 0 };
    studioState.voxels.clear();
    for (const [key, rec] of imported) studioState.voxels.set(key, { color: rec.color, id: rec.id });
    markDirty();
    editor?.invalidate();
    return { ok: true, reason: null, count: imported.size };
  }

  /**
   * Duplicate the current asset into a NEW asset record (FR-STD-025).
   * The original is left untouched; the copy joins the player's library.
   *
   * @returns {{ok:boolean, reason:string|null, id:string|null, name:string|null}}
   */
  function duplicateDocument(name) {
    const source = studioState?.doc ?? null;
    const id = `workshop-${Date.now().toString(36)}-${(state?.studio?.documents?.length ?? 0) + 1}`;
    const copy = {
      id,
      name: name ?? `${source?.name ?? 'Untitled model'} copy`,
      kind: source?.kind ?? 'building',
      parentAssetId: source?.id ?? null,
      dims: { ...dims },
      pivot: { ...(source?.pivot ?? { x: 0, y: 0, z: 0 }) },
      formatVersion: FORMAT_VERSION,
      contentHash: null,
      voxels: new Map(),
    };
    for (const [key, rec] of studioState.voxels) copy.voxels.set(key, { color: rec.color, id: rec.id });
    if (state?.studio) {
      if (!Array.isArray(state.studio.documents)) state.studio.documents = [];
      state.studio.documents.push(copy);
    }
    return { ok: true, reason: null, id, name: copy.name };
  }

  // -------------------------------------------------------------------------
  // Export
  // -------------------------------------------------------------------------

  /**
   * Export the model as a Wavefront OBJ string.
   * @returns {string} the OBJ text (always a string, even when empty)
   */
  function exportOBJ() {
    return buildOBJString(studioState.voxels, { palette: studioState.palette, name: studioState?.doc?.name ?? 'scc-studio-model' });
  }

  /** Trigger a browser download of the OBJ. No-op outside a browser. */
  function exportOBJFile() {
    const text = exportOBJ();
    try {
      if (typeof document === 'undefined' || typeof URL?.createObjectURL !== 'function') return false;
      const blob = new Blob([text], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${(studioState?.doc?.name ?? 'model').replace(/[^\w.-]+/g, '_')}.obj`;
      a.click();
      URL.revokeObjectURL(url);
      return true;
    } catch {
      return false;
    }
  }

  // -------------------------------------------------------------------------
  // Derivation (FR-STD-053/071 — the inputs are emitted; ECO owns the money)
  // -------------------------------------------------------------------------

  /** The derivation snapshot for the current model. */
  function derived() {
    const inputs = derivationInputs(studioState.voxels, dims);
    const cost = deriveBuildCost(studioState.voxels);
    return {
      ...inputs,
      buildCost: cost.buildCost,
      assumed: true,
      rule: cost.rule,
      footprint: footprintCells(studioState.voxels),
      residentialCapacity: 0,
      jobCount: 0,
      productionCapacity: 0,
      coverageRadius: 0,
      culturePoints: 0,
      entertainmentPoints: 0,
      recreationPoints: 0,
      wealthLevel: 0,
      pollution: 0,
      trafficGenerated: 0,
      isDecoration: true,
    };
  }

  // -------------------------------------------------------------------------
  // Open / close
  // -------------------------------------------------------------------------

  function open() {
    if (disposed) return false;
    if (studioState) studioState.open = true;
    if (!editor) {
      editor = createStudioEditor(ctx, service);
      mount();
    }
    editor.open();
    bus?.emit?.(EVENTS.STUDIO_OPEN, { voxels: studioState.voxels.size });
    return true;
  }

  function close() {
    if (studioState) studioState.open = false;
    editor?.close();
    bus?.emit?.(EVENTS.STUDIO_CLOSE, {});
    return true;
  }

  function isOpen() {
    return !!(studioState && studioState.open);
  }

  // -------------------------------------------------------------------------
  // Mounting
  // -------------------------------------------------------------------------

  function mount() {
    if (mounted || !editor) return false;
    const root = typeof document !== 'undefined' ? document.getElementById('ui-root') : null;
    if (!root) return false;
    root.append(editor.el);
    mounted = true;
    return true;
  }

  // -------------------------------------------------------------------------
  // The service
  // -------------------------------------------------------------------------

  const service = {
    async init() {
      if (!editor) {
        editor = createStudioEditor(ctx, service);
        mount();
      }
      if (studioState && !studioState.palette?.length) studioState.palette = defaultPalette();
      return service;
    },

    /** Wall-clock update: the studio renders only while it is open. */
    update(dt) {
      if (disposed) return;
      if (isOpen()) editor?.update(dt);
    },

    /** Game-time tick: the studio is not affected by the simulation clock. */
    tick(dt) { void dt; },

    open,
    close,
    isOpen,

    /**
     * The live voxel map: "x,y,z" -> { color, id }.
     *
     * A getter, not a snapshot: `state.studio` is replaced wholesale when a
     * save is loaded, and the map must follow it.
     */
    get voxels() { return studioState.voxels; },

    /** The authoring volume, in voxels. */
    dims: () => ({ ...dims }),

    /** The material set (index-addressed). */
    palette: () => studioState.palette,

    /** Paint a voxel. */
    paint,

    /** Erase a voxel. */
    erase,

    /** Recolour an occupied voxel. */
    recolor,

    /** The brush size (voxels per side). */
    brushSize() { return brush; },

    /** Set the brush size (1..5). */
    setBrush(n) {
      const v = Math.max(1, Math.min(5, Math.round(Number(n) || 1)));
      brush = v;
      if (studioState) studioState.brush = v;
      return v;
    },

    /** The active material index. */
    material() { return material; },

    /** Set the active material index. */
    setMaterial(index) {
      const v = resolveMaterial(index, studioState.palette);
      if (v) material = v;
      return material;
    },

    /** Save / load the workshop document. */
    saveWorkshop,
    loadWorkshop,

    /** Duplicate the current asset into a new asset record (FR-STD-025). */
    duplicateDocument,

    /** Import an OBJ document into the editor. */
    importOBJDocument,

    /** Export the model as an OBJ string. */
    exportOBJ,

    /** Trigger a browser download of the OBJ. */
    exportOBJFile,

    /** The derivation snapshot for the current model. */
    derived,

    /** The bounding box of the model. */
    bounds: () => voxelBounds(studioState.voxels),

    /** The world-cell footprint of the model (FR-STD-043). */
    footprint: () => footprintCells(studioState.voxels),

    /** Undo the last edit. */
    undo() {
      const change = history.take();
      if (!change) return false;
      applyChange(studioState.voxels, change);
      markDirty();
      editor?.invalidate();
      return true;
    },

    /** Redo the last undone edit. */
    redo() {
      const change = history.redo();
      if (!change) return false;
      applyChange(studioState.voxels, change);
      markDirty();
      editor?.invalidate();
      return true;
    },

    /** A revision counter the view uses to know when to rebuild. */
    revision: () => revision,

    /** The editor view (for tests / advanced use). */
    get editor() { return editor; },

    dispose() {
      disposed = true;
      editor?.dispose();
      editor = null;
      mounted = false;
      if (studioState) studioState.open = false;
    },
  };

  // Expose the pure helpers on the service so callers (and the BLD domain)
  // can reuse the exact same rules without importing the module again.
  Object.assign(service, {
    voxelKey,
    parseVoxelKey,
    clampVoxel,
    inVoxelBounds,
    parseOBJ,
    serializeWorkshop,
    deserializeWorkshop,
    VOXELS_PER_CELL,
    FORMAT_VERSION,
  });

  return service;
}

export {
  DEFAULT_DIMS, VOXELS_PER_CELL, FORMAT_VERSION,
  buildPalette, defaultPalette, voxelKey, parseVoxelKey, clampVoxel,
  inVoxelBounds, voxelBounds, paintVoxel, eraseVoxel, paintMaterial,
  paintBrush, eraseBrush, footprintCells, derivationInputs, deriveBuildCost,
  importOBJ, parseOBJ, serializeWorkshop, deserializeWorkshop,
  createHistory, applyChange,
  // The pure OBJ writer (the service method of the same name lives on the
  // service object, so the module-level one is re-exported under this alias).
  buildOBJString as exportOBJ,
};
