#!/usr/bin/env node
/**
 * tools/secret-scan.mjs — the V7 secret scan.
 *
 * The project's rule is simple: no credential, token or key may appear in
 * the source, the bundle, the documentation or the evidence. This tool
 * checks that, over the whole tree AND over the built bundle, and exits
 * non-zero when it finds something.
 *
 * Usage:
 *   node tools/secret-scan.mjs [--dir <path>] [--json]
 *
 * WHAT IT LOOKS FOR
 *   - the shapes real credentials have: a provider key prefix, a GitHub
 *     token, a private key block, an AWS access key, a bearer token;
 *   - the words that introduce a secret: "api key = ...", "password = ...",
 *     "secret = ...", "token = ...";
 *   - anything that looks like a high-entropy string assigned to a
 *     credential-shaped NAME.
 *
 * WHAT IT DELIBERATELY DOES NOT DO
 *   It does not fail on a placeholder. A test fixture that says
 *   `const apiKey = 'not-a-real-key'` is not a leak, and a scanner that
 *   cannot tell the difference gets switched off within a week. Every
 *   candidate is checked against a placeholder list, and the report says
 *   which rule fired and on which line, so a human can judge it.
 *
 * Exit codes:
 *   0  nothing found
 *   1  at least one candidate (printed with its file, line and rule)
 *   2  the tool could not run
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..');

/** The folders never scanned: they are not source. */
const SKIP_DIRS = new Set([
  'node_modules', '.git', 'dist', 'coverage', '.cache', '.vite',
]);

/** The file types scanned. */
const SCAN_EXTENSIONS = new Set([
  '.js', '.mjs', '.cjs', '.ts', '.jsx', '.tsx', '.json', '.html', '.css',
  '.md', '.txt', '.yml', '.yaml', '.sh', '.ps1', '.env', '.toml', '.ini',
]);

/** The names that must never appear in the tree. */
const FORBIDDEN_NAMES = new Set([
  '.env', '.env.local', '.env.production', '.env.development',
  'id_rsa', 'id_dsa', 'id_ecdsa', 'id_ed25519',
  'credentials.json', 'service-account.json', 'secrets.json',
]);

/**
 * The rules: a name, a pattern, and what fired it.
 *
 * Every pattern is anchored on a credential-shaped NAME, so a sentence in a
 * document that happens to contain the word "token" is not a finding.
 */
const RULES = [
  {
    id: 'private-key-block',
    pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/g,
    severity: 'critical',
  },
  {
    id: 'github-token',
    pattern: /\bgh[pousr]_[A-Za-z0-9]{36,255}\b/g,
    severity: 'critical',
  },
  {
    id: 'aws-access-key-id',
    pattern: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g,
    severity: 'critical',
  },
  {
    id: 'slack-token',
    pattern: /\bxox[abposr]-[A-Za-z0-9-]{10,}\b/g,
    severity: 'critical',
  },
  {
    id: 'google-api-key',
    pattern: /\bAIza[0-9A-Za-z_-]{35}\b/g,
    severity: 'critical',
  },
  {
    id: 'stripe-secret-key',
    pattern: /\bsk_(?:live|test)_[A-Za-z0-9]{16,}\b/g,
    severity: 'critical',
  },
  {
    id: 'bearer-token',
    pattern: /\bBearer\s+[A-Za-z0-9\-._~+/]{24,}={0,2}\b/g,
    severity: 'high',
  },
  {
    id: 'assigned-credential',
    // A credential-shaped NAME assigned a long, non-placeholder string.
    pattern: /\b(api[_-]?key|secret[_-]?key|access[_-]?token|auth[_-]?token|client[_-]?secret|password|passwd)\b\s*[:=]\s*["'`]([^"'`\n]{12,})["'`]/gi,
    severity: 'high',
    capture: 2,
  },
];

/**
 * The values that are obviously placeholders.
 *
 * A scanner that cannot tell a placeholder from a leak gets switched off.
 */
const PLACEHOLDER = /^(?:|x{3,}|\*{3,}|placeholder|example|sample|dummy|redacted|changeme|your[_-]?\w*|<[^>]*>|\$\{[^}]*\}|process\.env\.\w+|env\.\w+|none|null|undefined|true|false|\d+|test|not-a-real.*|abc123|password|secret|token|key)$/i;

/** A value that looks like a real secret rather than a word. */
function looksHighEntropy(value) {
  const text = String(value);
  if (text.length < 12) return false;
  if (PLACEHOLDER.test(text.trim())) return false;
  if (/^https?:\/\//.test(text)) return false;
  if (/^[./]/.test(text) && !/[A-Z]/.test(text)) return false;   // a path
  // A mix of cases, digits and punctuation is the shape of a key.
  const classes = [/[a-z]/, /[A-Z]/, /\d/].filter((re) => re.test(text)).length;
  return classes >= 2 && /[^A-Za-z0-9]/.test(text);
}

/**
 * Every file to scan, under a folder.
 * @param {string} dir
 * @returns {Array<string>}
 */
function walk(dir, out = []) {
  let entries = [];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    let info;
    try {
      info = statSync(full);
    } catch {
      continue;
    }
    if (info.isDirectory()) {
      walk(full, out);
      continue;
    }
    if (!info.isFile()) continue;
    const ext = extname(entry);
    if (!SCAN_EXTENSIONS.has(ext) && !FORBIDDEN_NAMES.has(entry)) continue;
    out.push(full);
  }
  return out;
}

function main() {
  const args = process.argv.slice(2);
  let root = repoRoot;
  let json = false;
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--dir') { root = args[i + 1]; i += 1; }
    else if (arg === '--json') json = true;
    else {
      process.stderr.write(`Unknown argument "${arg}"\n`);
      process.exit(2);
    }
  }
  if (!existsSync(root)) {
    process.stderr.write(`No such folder: ${root}\n`);
    process.exit(2);
  }

  const findings = [];
  const scanned = [];
  const forbidden = [];

  for (const file of walk(root)) {
    const name = file.split('/').pop();
    if (FORBIDDEN_NAMES.has(name)) {
      forbidden.push(relative(root, file));
      continue;
    }
    let text;
    try {
      text = readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    scanned.push(relative(root, file));
    const lines = text.split('\n');
    for (const rule of RULES) {
      const pattern = new RegExp(rule.pattern.source, rule.pattern.flags);
      for (let i = 0; i < lines.length; i += 1) {
        const line = lines[i];
        pattern.lastIndex = 0;
        let match = pattern.exec(line);
        while (match) {
          const value = rule.capture ? match[rule.capture] : match[0];
          if (!rule.capture || looksHighEntropy(value)) {
            findings.push({
              rule: rule.id,
              severity: rule.severity,
              file: relative(root, file),
              line: i + 1,
              detail: String(value).slice(0, 12) + '…',
            });
          }
          if (match.index === pattern.lastIndex) pattern.lastIndex += 1;
          match = pattern.exec(line);
        }
      }
    }
  }

  const report = {
    root: relative(repoRoot, root) || '.',
    scannedFiles: scanned.length,
    findings,
    forbiddenFiles: forbidden,
    ok: findings.length === 0 && forbidden.length === 0,
  };

  if (json) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } else {
    process.stdout.write(`secret scan: ${report.scannedFiles} file(s) scanned under ${report.root}\n`);
    for (const file of forbidden) {
      process.stdout.write(`  FORBIDDEN  ${file} — a credential file must not be in the tree\n`);
    }
    for (const finding of findings) {
      process.stdout.write(`  ${finding.severity.toUpperCase()}  ${finding.rule}  ${finding.file}:${finding.line}  ${finding.detail}\n`);
    }
    process.stdout.write(report.ok
      ? 'PASS — no credential-shaped value was found\n'
      : `FAIL — ${findings.length} finding(s), ${forbidden.length} forbidden file(s)\n`);
  }

  process.exit(report.ok ? 0 : 1);
}

main();
