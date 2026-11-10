# SuperCitycon V7 — Security Review

**Reviewed at:** the V7 commit, on the whole worktree AND the built bundle.
**Tool:** `tools/secret-scan.mjs` (new in V7)

---

## 1. The result

```
$ node tools/secret-scan.mjs
secret scan: 274 file(s) scanned under .
PASS — no credential-shaped value was found
```

The scanner exits **0** on a clean tree and **1** on a finding. It was
verified against a planted secret before it was trusted:

```
$ node tools/secret-scan.mjs --dir /tmp/sc-scan-test
secret scan: 2 file(s) scanned under ...
  CRITICAL  github-token  leak.js:2  ghp_ABCDEFGH…
  CRITICAL  stripe-secret-key  leak.js:1  sk_live_4eC3…
  HIGH  assigned-credential  leak.js:1  sk_live_4eC3…
  HIGH  assigned-credential  leak.js:3  correct-hors…
FAIL — 4 finding(s), 0 forbidden file(s)
$ echo $?
1
```

The same run did **not** flag `const apiKey = process.env.API_KEY;` or
`const password = "placeholder";` — a scanner that cannot tell a
placeholder from a leak gets switched off within a week.

## 2. The rules

| Rule | Severity | What it matches |
|---|---|---|
| `private-key-block` | critical | a PEM private key header |
| `github-token` | critical | `ghp_` / `gho_` / `ghu_` / `ghs_` / `ghr_` tokens |
| `aws-access-key-id` | critical | an `AKIA` / `ASIA` key id |
| `slack-token` | critical | an `xox…` token |
| `google-api-key` | critical | an `AIza…` key |
| `stripe-secret-key` | critical | an `sk_live_` / `sk_test_` key |
| `bearer-token` | high | a long `Bearer …` header value |
| `assigned-credential` | high | a credential-shaped NAME assigned a high-entropy value |

Plus a filename rule: `.env`, `id_rsa`, `credentials.json`,
`service-account.json`, `secrets.json` and their relatives must not be in
the tree.

## 3. The dependency audit

```
$ cd game && npm audit
found 0 vulnerabilities
```

The dependency set did **not** change in V7: `game/package.json` still
declares `three` and nothing else at runtime, and the dev dependency is
still Vite alone. V7 adds no supply-chain surface.

## 4. The trust boundaries

| Boundary | How it is held |
|---|---|
| The browser → the game | The game reads no input from the network. A save file is imported only through `importSave()`, which validates the record before it is applied. |
| A save file → the state tree | `core/save.js` `migrateRecord()` refuses a record from a newer build instead of guessing at it; `isPlausibleSnapshot()` refuses a half-written or hand-edited file. |
| A level → the content validator | `content/validate.js` checks the metadata, the objectives, the spawns and the reachability. A level with an unreachable target is an **error**. |
| The asset library → the shipped bundle | The 2D art is licence-unverified and is quarantined. `npm run build:cleared` strips it and **fails the build** if any of it survives. The V7 cleared bundle contains no `dist/assets/ui`, no `dist/assets/ui-assets.json` and no `dist/DO-NOT-PUBLISH.txt`. |
| The build → the published identity | The build identity is stamped from `package.json` by `vite.config.js`, so the version in the bundle cannot drift from the version in the repository. |

## 5. The V7 changes, reviewed

| Change | The security question | The answer |
|---|---|---|
| `core/navigation.js` | does it trust anything from outside? | No. It reads a grid the caller supplies, and it never mutates it. |
| `core/touch.js` | can a malformed event do damage? | No. A `NaN` coordinate is rejected, and the malformed-input test proves no gesture is produced. |
| `ui/touch.js` | can a touch reach something it should not? | No. The tap goes through the same `ctx.dispatchWorldClick()` the mouse uses, and the domains apply their own gates (budget, construction slots, terrain). |
| `main.js` `dispatchWorldClick` | does it widen the attack surface? | No. It does exactly what `handleClick()` did — it moved the existing loop into the context so the mouse and the touch share one path. |
| `content/validate.js` | does the reachability proof read anything untrusted? | It generates the terrain from the level's own seed with the world's own functions. It reads no file and no network. |

## 6. The open security items

**None that block the release.** The known limits are not security issues:

- the game has no server component, so there is no authentication surface,
  no session, no credential store and no network call at all;
- the 2D art licence is unresolved, and the fix is to keep it out of the
  build — which the cleared build enforces.

## 7. The recommendation

**PASS.** No credential-shaped value in the tree, 0 dependency
vulnerabilities, no new dependency, and the save-import path is unchanged
and still validating.
