#!/usr/bin/env node
/**
 * tools/generate.mjs — CLI wrapper around the deterministic generators.
 *
 * Usage:
 *   node tools/generate.mjs project --name demo [--template platformer] [--out DIR]
 *   node tools/generate.mjs scene --name level1 [--entity "Name:tag,tag"] [--out DIR]
 *   node tools/generate.mjs component --name health [--field current:number] [--out DIR]
 *   node tools/generate.mjs animation --name hero [--state idle:Idle] [--out DIR]
 *   node tools/generate.mjs npc --name guard [--state idle] [--out DIR]
 *   node tools/generate.mjs tests --module-name ecs [--out DIR]
 *
 * With --out the files are written to disk; without it the generated files
 * are printed to stdout.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';

import { V4_ROOT } from '../src/assets/catalogue.js';
import {
  generateAnimationController,
  generateComponent,
  generateNpcBehaviour,
  generateProject,
  generateScene,
  generateTests,
} from '../src/ai/generators.js';

const V4_ROOT_PATH = resolve(V4_ROOT);

/** Parse `--key value` pairs and `--flag` switches. */
function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token.startsWith('--')) {
      const key = token.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) {
        args[key] = true;
      } else {
        args[key] = next;
        i += 1;
      }
    } else {
      args._.push(token);
    }
  }
  return args;
}

/** `--field current:number:100` -> {name:'current', type:'number', default:100} */
function parseFields(list) {
  return [].concat(list ?? []).map((raw) => {
    const [name, type = 'number', def] = String(raw).split(':');
    const field = { name, type };
    if (def !== undefined) field.default = def === 'true' ? true : def === 'false' ? false : def === 'null' ? null : Number.isNaN(Number(def)) ? def : Number(def);
    return field;
  });
}

/** `--state idle:Idle,Idle_2:loop` -> {idle: {clips:['Idle']}} */
function parseStates(list) {
  const states = {};
  for (const raw of [].concat(list ?? [])) {
    const [name, clips] = String(raw).split(':');
    states[name] = { clips: clips ? clips.split(',') : [name] };
  }
  return states;
}

/** `--entity "Name:tag,tag"` -> {name, tags} */
function parseEntities(list) {
  return [].concat(list ?? []).map((raw) => {
    const [name, tags] = String(raw).split(':');
    return { name, tags: tags ? tags.split(',').filter(Boolean) : [] };
  });
}

const args = parseArgs(process.argv.slice(2));
const command = args._[0] ?? 'project';

const outDir = args.out ? resolve(String(args.out)) : null;

// Never write generated code over the engine's own source.
const protectedDirs = ['src', 'tools', 'tests', 'data'].map((d) => join(V4_ROOT_PATH, d));
if (outDir && protectedDirs.some((p) => outDir === p || outDir.startsWith(`${p}/`))) {
  console.error(`Refusing to write generated files into the engine source tree (${outDir}).`);
  process.exit(1);
}

let result;
let projectRoot;

switch (command) {
  case 'project': {
    const name = String(args.name ?? 'demo');
    projectRoot = args.projectRoot ? String(args.projectRoot) : `generated/${name.replace(/[^a-z0-9-]+/gi, '-').toLowerCase()}`;
    result = generateProject({ name, template: String(args.template ?? 'minimal'), projectRoot });
    break;
  }
  case 'scene': {
    const name = String(args.name ?? 'scene');
    projectRoot = String(args.projectRoot ?? `generated/${name}`);
    result = generateScene({ name, entities: parseEntities(args.entity), projectRoot });
    break;
  }
  case 'component': {
    const name = String(args.name ?? 'component');
    projectRoot = String(args.projectRoot ?? `generated/${name}`);
    result = generateComponent({ name, fields: parseFields(args.field), projectRoot });
    break;
  }
  case 'animation': {
    const name = String(args.name ?? 'controller');
    projectRoot = String(args.projectRoot ?? `generated/${name}`);
    result = generateAnimationController({ name, states: parseStates(args.state), projectRoot });
    break;
  }
  case 'npc': {
    const name = String(args.name ?? 'npc');
    projectRoot = String(args.projectRoot ?? `generated/${name}`);
    const states = parseStates(args.state);
    result = generateNpcBehaviour({
      name,
      states: Object.entries(states).map(([n, def]) => ({ name: n, ...def })),
      projectRoot,
    });
    break;
  }
  case 'tests': {
    const moduleName = String(args['module-name'] ?? args.moduleName ?? 'ecs');
    projectRoot = String(args.projectRoot ?? `generated/${moduleName}`);
    result = generateTests({ moduleName, projectRoot });
    break;
  }
  default:
    console.error(`Unknown command "${command}". Use: project | scene | component | animation | npc | tests`);
    process.exit(1);
}

if (outDir) {
  for (const f of result.files) {
    const target = join(outDir, f.path);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, f.content, 'utf8');
    console.log(`wrote ${relative(process.cwd(), target)}`);
  }
} else {
  for (const f of result.files) {
    console.log(`// ---- ${f.path} ----`);
    console.log(f.content);
  }
}

for (const note of result.notes ?? []) console.log(`note: ${note}`);
