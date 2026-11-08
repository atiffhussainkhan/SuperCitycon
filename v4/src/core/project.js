/**
 * V4 — Project management.
 *
 * A project is a named bundle: a manifest plus the scene documents that belong
 * to it. This module owns the project lifecycle — create, open, save, list,
 * export, import — and it is deliberately storage-agnostic so the same code
 * drives the browser (localStorage), the Node tests (memory) and the CLI
 * (filesystem).
 *
 * The manifest is the single source of truth for "what is this project": its
 * name, the scene list, the current scene, the asset provenance and the
 * version of the format. Everything else is derived.
 */

import { createLocalStorageAdapter, createMemoryAdapter } from './scene.js';

export const PROJECT_FORMAT_VERSION = 1;

/** Events the project manager emits on the bus. */
export const ProjectEvents = Object.freeze({
  CREATED: 'project:created',
  OPENED: 'project:opened',
  SAVED: 'project:saved',
  CLOSED: 'project:closed',
  EXPORTED: 'project:exported',
});

function nowIso() {
  return new Date().toISOString();
}

function makeManifest(name) {
  return {
    formatVersion: PROJECT_FORMAT_VERSION,
    name,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    currentScene: null,
    scenes: [],
    assets: { models: 0, textures: 0, audio: 0, other: 0 },
    meta: {},
  };
}

/**
 * @param {object} opts
 * @param {object} opts.sceneManager the scene manager that owns scene documents
 * @param {object} [opts.storage]  a storage adapter (read/write/list of docs)
 * @param {object} [opts.bus]
 * @param {object} [opts.logger]
 */
export function createProjectManager({
  sceneManager,
  storage = null,
  bus = null,
  logger = null,
} = {}) {
  const store = storage ?? createMemoryAdapter();
  /** @type {Map<string, object>} */
  const projects = new Map();
  let open = null;

  async function persist(manifest, scenes) {
    await store.write(`${manifest.name}/manifest.json`, manifest);
    for (const [sceneName, doc] of Object.entries(scenes)) {
      await store.write(`${manifest.name}/scenes/${sceneName}.json`, doc);
    }
  }

  const manager = {
    get current() { return open; },
    get names() { return [...projects.keys()]; },

    /** Create an empty project. */
    async create(name, { meta = {} } = {}) {
      if (!name || typeof name !== 'string') throw new Error('project name is required');
      if (projects.has(name)) throw new Error(`project "${name}" already exists`);
      const manifest = makeManifest(name);
      manifest.meta = { ...meta };
      projects.set(name, manifest);
      open = { manifest, scenes: {} };
      bus?.emit?.(ProjectEvents.CREATED, { name });
      logger?.info?.(`project created: ${name}`);
      return manifest;
    },

    /** Open an existing project from storage (or from memory if already known). */
    async open(name) {
      const manifest = projects.get(name) ?? await store.read(`${name}/manifest.json`);
      if (!manifest) throw new Error(`project "${name}" not found`);
      const scenes = {};
      for (const sceneName of manifest.scenes ?? []) {
        const doc = await store.read(`${name}/scenes/${sceneName}.json`);
        if (doc) scenes[sceneName] = doc;
        sceneManager?.define?.(sceneName, doc);
      }
      projects.set(name, manifest);
      open = { manifest, scenes };
      bus?.emit?.(ProjectEvents.OPENED, { name, scenes: Object.keys(scenes).length });
      logger?.info?.(`project opened: ${name}`);
      return manifest;
    },

    /** Capture the live world into a scene of the open project. */
    addScene(sceneName, { switchTo = true } = {}) {
      if (!open) throw new Error('no project is open');
      const doc = sceneManager?.capture?.(sceneName);
      if (!doc) throw new Error('scene manager cannot capture');
      open.scenes[sceneName] = doc;
      if (!open.manifest.scenes.includes(sceneName)) open.manifest.scenes.push(sceneName);
      if (switchTo) open.manifest.currentScene = sceneName;
      open.manifest.updatedAt = nowIso();
      return doc;
    },

    /** Save the open project: manifest + scenes. */
    async save() {
      if (!open) throw new Error('no project is open');
      open.manifest.updatedAt = nowIso();
      await persist(open.manifest, open.scenes);
      bus?.emit?.(ProjectEvents.SAVED, { name: open.manifest.name });
      logger?.info?.(`project saved: ${open.manifest.name}`);
      return open.manifest;
    },

    /** List the projects available in storage. */
    async list() {
      const names = new Set(projects.keys());
      if (store.list) {
        try {
          for (const key of await store.list()) {
            const name = key.split('/')[0];
            if (name) names.add(name);
          }
        } catch { /* a broken storage adapter must not break the editor */ }
      }
      return [...names].sort();
    },

    /**
     * Export a project as a plain object — the format used by the CLI's
     * export/import commands and by the release packager.
     */
    async exportProject(name = open?.manifest?.name) {
      if (!name) throw new Error('no project to export');
      const manifest = projects.get(name) ?? await store.read(`${name}/manifest.json`);
      if (!manifest) throw new Error(`project "${name}" not found`);
      const scenes = {};
      for (const sceneName of manifest.scenes ?? []) {
        const doc = await store.read(`${name}/scenes/${sceneName}.json`);
        if (doc) scenes[sceneName] = doc;
      }
      const bundle = { manifest, scenes };
      bus?.emit?.(ProjectEvents.EXPORTED, { name, scenes: Object.keys(scenes).length });
      return bundle;
    },

    /** Import a project bundle produced by `exportProject`. */
    async importProject(bundle, { name = null } = {}) {
      if (!bundle?.manifest) throw new Error('not a project bundle');
      const manifest = { ...bundle.manifest };
      if (name) manifest.name = name;
      const scenes = bundle.scenes ?? {};
      projects.set(manifest.name, manifest);
      await persist(manifest, scenes);
      open = { manifest, scenes };
      bus?.emit?.(ProjectEvents.OPENED, { name: manifest.name, imported: true });
      return manifest;
    },

    /** Close the open project without saving. */
    close() {
      if (!open) return false;
      const name = open.manifest.name;
      open = null;
      bus?.emit?.(ProjectEvents.CLOSED, { name });
      return true;
    },

    /** The open project's manifest, or null. */
    manifest() { return open?.manifest ?? null; },

    /** A summary for the editor's title bar and the CLI's status output. */
    status() {
      if (!open) return { open: false, projects: projects.size };
      return {
        open: true,
        name: open.manifest.name,
        scenes: open.manifest.scenes.length,
        currentScene: open.manifest.currentScene,
        updatedAt: open.manifest.updatedAt,
      };
    },
  };

  return manager;
}

export { createLocalStorageAdapter, createMemoryAdapter };
