/**
 * V4 — Static analysers.
 *
 * Rule-based checks over the asset library and the source tree. No model, no
 * network: every finding is reproducible from the input alone.
 */

/* ------------------------------------------------------------- unused assets */

/**
 * Which catalogue entries are not referenced by the project.
 *
 * @param {{library:object, referencedIds?:Iterable<string>}} opts
 * @returns {{unused:Array, used:Array, unknownReferences:Array, total:number}}
 */
export function detectUnusedAssets({ library, referencedIds = [] } = {}) {
  if (!library) throw new Error('detectUnusedAssets needs a library');
  const referenced = new Set([].concat(referencedIds ?? []));
  const known = new Set(library.list().map((e) => e.id));

  const unused = [];
  const used = [];
  for (const entry of library.list()) {
    if (referenced.has(entry.id)) used.push(entry);
    else unused.push(entry);
  }

  const unknownReferences = [...referenced].filter((id) => !known.has(id));

  return { unused, used, unknownReferences, total: library.list().length };
}

/* -------------------------------------------------------------- build errors */

/**
 * Parse the output of `npm run build` / `vite build` and summarise it.
 *
 * @param {{output?:string}} opts
 * @returns {{ok:boolean, errors:Array, warnings:Array, summary:string, raw:string}}
 */
export function reviewBuildErrors({ output = '' } = {}) {
  const raw = String(output);
  const lines = raw.split(/\r?\n/);
  const errors = [];
  const warnings = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Vite / esbuild: "file:line:col: ERROR: message"
    const esbuild = trimmed.match(/^(.+?):(\d+):(\d+):\s*(ERROR|WARNING):\s*(.+)$/);
    if (esbuild) {
      const record = { file: esbuild[1], line: Number(esbuild[2]), column: Number(esbuild[3]), message: esbuild[5] };
      if (esbuild[4] === 'ERROR') errors.push(record);
      else warnings.push(record);
      continue;
    }

    // Rollup / vite: "[plugin:vite:...] file:line: message"
    const rollup = trimmed.match(/^\[.+?\]\s+(.+?):(\d+):(\d+):\s*(.+)$/);
    if (rollup) {
      errors.push({ file: rollup[1], line: Number(rollup[2]), column: Number(rollup[3]), message: rollup[4] });
      continue;
    }

    // Plain node stack frames: "at file:///path/file.js:12:5" or "at fn (file:12:5)"
    const frame = trimmed.match(/^at\s+(?:.*\()?(.+?):(\d+):(\d+)\)?$/);
    if (frame) {
      errors.push({ file: frame[1], line: Number(frame[2]), column: Number(frame[3]), message: 'stack frame' });
      continue;
    }

    if (/^error\b/i.test(trimmed) || /^\s*Error:/i.test(trimmed)) {
      errors.push({ file: null, line: null, column: null, message: trimmed.replace(/^error\s*/i, '') });
      continue;
    }
    if (/^warn(ing)?\b/i.test(trimmed)) {
      warnings.push({ file: null, line: null, column: null, message: trimmed.replace(/^warn(ing)?\s*/i, '') });
    }
  }

  const summary = errors.length === 0
    ? (warnings.length ? `build produced no errors, ${warnings.length} warning(s)` : 'build produced no errors')
    : `build failed with ${errors.length} error(s) and ${warnings.length} warning(s)`;

  return { ok: errors.length === 0, errors, warnings, summary, raw };
}

/* ---------------------------------------------------------------- refactors */

/** A crude but honest function-boundary finder. */
function findFunctions(source) {
  const lines = source.split(/\r?\n/);
  const functions = [];
  const pattern = /^\s*(?:export\s+)?(?:async\s+)?function\s+([A-Za-z0-9_$]*)\s*\(|^\s*(?:export\s+)?const\s+([A-Za-z0-9_$]+)\s*=\s*(?:async\s*)?\(/;
  let start = -1;
  let name = null;
  let depth = 0;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (start === -1) {
      const match = line.match(pattern);
      if (match) {
        start = i;
        name = match[1] ?? match[2] ?? '(anonymous)';
        depth = 0;
      }
      continue;
    }
    for (const ch of line) {
      if (ch === '{') depth += 1;
      else if (ch === '}') depth -= 1;
    }
    if (depth <= 0 && line.includes('}')) {
      functions.push({ name, start: start + 1, end: i + 1, lines: i + 1 - start });
      start = -1;
      name = null;
    }
  }
  if (start !== -1) {
    functions.push({ name, start: start + 1, end: lines.length, lines: lines.length - start });
  }
  return functions;
}

/**
 * Rule-based refactoring suggestions.
 *
 * @param {{files?:Array<{path:string,content:string}>|object, source?:string, thresholds?:object}} opts
 * @returns {{findings:Array, files:number, summary:string}}
 */
export function suggestRefactors({ files = [], source = '', thresholds = {} } = {}) {
  const limits = {
    longFunctionLines: thresholds.longFunctionLines ?? 40,
    duplicateLiteralCount: thresholds.duplicateLiteralCount ?? 3,
    maxNestingDepth: thresholds.maxNestingDepth ?? 4,
  };

  const list = [];
  if (Array.isArray(files)) {
    for (const f of files) list.push({ path: f.path ?? '(unnamed)', content: f.content ?? f.source ?? '' });
  } else if (files && typeof files === 'object') {
    for (const [path, content] of Object.entries(files)) list.push({ path, content: String(content) });
  }
  if (source && list.length === 0) list.push({ path: '(source)', content: source });

  const findings = [];

  for (const file of list) {
    const content = file.content;
    if (!content) continue;

    // Long functions.
    for (const fn of findFunctions(content)) {
      if (fn.lines > limits.longFunctionLines) {
        findings.push({
          rule: 'long-function',
          path: file.path,
          line: fn.start,
          message: `function "${fn.name}" is ${fn.lines} lines long (limit ${limits.longFunctionLines})`,
          suggestion: 'Split it into smaller functions; the parts that only need one input can be extracted.',
        });
      }
    }

    // TODO / FIXME markers.
    const lines = content.split(/\r?\n/);
    lines.forEach((line, index) => {
      const marker = line.match(/\b(TODO|FIXME|HACK|XXX)\b[:\s]*(.*)$/);
      if (marker) {
        findings.push({
          rule: 'todo-marker',
          path: file.path,
          line: index + 1,
          message: `${marker[1]}: ${marker[2] || '(no detail)'}`,
          suggestion: 'Resolve the marker or turn it into a tracked issue — a marker nobody reads is noise.',
        });
      }
    });

    // Deep nesting.
    let depth = 0;
    let maxDepth = 0;
    for (const line of lines) {
      for (const ch of line) {
        if (ch === '{') {
          depth += 1;
          if (depth > maxDepth) maxDepth = depth;
        } else if (ch === '}') {
          depth -= 1;
        }
      }
    }
    if (maxDepth >= limits.maxNestingDepth) {
      findings.push({
        rule: 'deep-nesting',
        path: file.path,
        line: null,
        message: `nesting reaches ${maxDepth} levels (limit ${limits.maxNestingDepth})`,
        suggestion: 'Use early returns or extract the inner block into a named function.',
      });
    }
  }

  // Duplicate literals across the whole set.
  const literalCounts = new Map();
  const literalPattern = /(['"`])([^'"`\n]{4,})\1/g;
  for (const file of list) {
    for (const match of file.content.matchAll(literalPattern)) {
      const literal = match[2];
      if (!literalCounts.has(literal)) literalCounts.set(literal, { count: 0, files: new Set() });
      const record = literalCounts.get(literal);
      record.count += 1;
      record.files.add(file.path);
    }
  }
  for (const [literal, record] of literalCounts) {
    if (record.count >= limits.duplicateLiteralCount) {
      findings.push({
        rule: 'duplicate-literal',
        path: [...record.files][0],
        line: null,
        message: `literal "${literal}" appears ${record.count} time(s) in ${record.files.size} file(s)`,
        suggestion: 'Give it a name — a constant or a shared config entry.',
      });
    }
  }

  const summary = findings.length
    ? `${findings.length} finding(s) across ${list.length} file(s)`
    : `no findings across ${list.length} file(s)`;

  return { findings, files: list.length, summary };
}
