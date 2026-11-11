# write_rejected audit + denied SSE missing on the scoped PATCH write lane

## Summary
cf8c33d7c made every server-validator refusal leave a persistent `write_rejected` log
row (plus a `denied-<campaign>-<key>` SSE moment) so the audit ledger shows what the
server refused even after the SSE moment passed (§10.4 rationale, stated unconditionally
in the commit message). It was applied to the wildcard POST handler only. The scoped
`PATCH /api/campaigns/:campaign/:key` lane pays the same `validateRuntimeWrite` chokepoint
on merged truth, but its refusal branch emits ONLY a server console.log — no log row,
no denied-* SSE. Same-class rejections are auditable on one lane and silent on the other.

## Steps to reproduce
1. In `test-campaign`, have any tab mounted so a character bucket exists (e.g. FeyRanger).
2. Refuse via PATCH (scoped lane):
   `curl -s -X PATCH -H 'Content-Type: application/json' -d '{"value":{"activeConditions":[{"key":"poisoned","name":"Poisoned"}]}}' http://localhost/api/campaigns/test-campaign/FeyRanger`
   → 400 with the plain-English reason; server console shows `[FeyRanger] BLOCKED PATCH test-campaign — …`.
3. `GET /api/campaigns/test-campaign/log` → NO `write_rejected` row added (live run: logCount stayed 17).
4. Same payload via POST (full-store lane):
   `curl -s -X POST -d '{"value":{"activeConditions":[{"key":"poisoned","name":"Poisoned"}]}}' http://localhost/api/campaigns/test-campaign/FeyRanger`
   → same 400 body, AND the log gains
   `{type:'write_rejected', origin:'server-validator', key:'FeyRanger', reason:'…'}`
   (live run: logCount 17→18), rendered by the dedicated `log-write-rejected` entry
   ("Write Rejected | FeyRanger | Server rejected write to …") in the Log view.

## Expected behavior
Per cf8c33d7c's own rationale ("denials are PERSISTENT audit"), every validator refusal
on EVERY write lane leaves the `write_rejected` row and broadcasts the `denied-*` SSE.

## Actual behavior
PATCH refusals are console-only: invisible in the Log view, absent from the on-disk
ledger, and no `denied-*` event fires, so open tabs get no live feedback either.

## Likely location
Confident: `server/routes/campaigns-changedata.js` — the PATCH handler's
`if (!validation.ok)` branch (logs `[key] BLOCKED PATCH …` then returns 400) lacks the
`publish('denied-…')` + `addLogEntry(campaign,{type:'write_rejected',…})` pair that the
POST wildcard handler carries a few dozen lines above. cf8c33d7c's diff only touched the
POST branch. (Could be an owner-scoping choice — but nothing documents it, and the
commit message is unconditional.)

## Suggested fix
Mirror the POST branch inside the PATCH refusal path with the same payload fields
(key, reason, description, origin:'server-validator') and the same `denied-${campaign}-${key}`
publish; extend `campaigns-changedata-l5-validation.test.js` with a PATCH-shape pin.

## Severity
Minor data-integrity risk — no gameplay state is corrupted, but the tamper/misuse audit
trail the fix set out to build is silently incomplete on the newer scoped lane, and
clients watching denied-* SSE never learn a write was refused there.

## Resolution
FIXED 2026-11-11. The black-box diagnosis was confirmed verbatim: the scoped
`PATCH /api/campaigns/:campaign/:key` refusal branch in
`server/routes/campaigns-changedata.js` (`if (!validation.ok)` after the
merged-truth `validateRuntimeWrite` call) emitted only the `[key] BLOCKED PATCH …`
console line, while the wildcard POST handler's identical branch carried the
`publish('denied-<campaign>-<key>')` + `addLogEntry(… write_rejected …)` pair from
cf8c33d7c. No owner-scoping note existed anywhere — cf8c33d7c's diff simply only
touched the POST branch.

**Files changed**
- `server/routes/campaigns-changedata.js` — PATCH refusal branch now mirrors the POST
  branch exactly: same `denied-${campaign}-${key}` publish payload (`{key, reason}`),
  same persistent `write_rejected` row (`origin:'server-validator'`, `key`, `reason`,
  `description:'Server rejected write to <key>: <reason>'`), 400 body byte-identical.
- `server/routes/campaigns-changedata-l5-validation.test.js` — new
  `P4-d denial persistence — scoped PATCH lane (§10.4)` suite (3 tests, mirroring the
  POST lane's P4-d conventions incl. the logCache evict ritual): (1) live repro payload
  (object-shaped `activeConditions` into a character bucket) ⇒ 400 + denied-* SSE +
  `write_rejected` row + merged truth never stored + no `change-*` echo; (2) audit
  payload byte-identical to the POST lane (description == `Server rejected write to
  <key>: <400 body>`); (3) accepted PATCH logs NO denial.

**Scope notes**
- The reserved-key `PUT spell-overlay` guard remains console-BLOCKED-only BY DESIGN —
  `campaigns-changedata-spell-overlay-guard.test.js` explicitly pins that face (asserts
  the BLOCKED PUT line, no audit pair), and nothing persists through that verb.
- Dual-ruleset: N/A (server route, ruleset-agnostic).
- Client side: no `denied-*` consumer exists in `src/` today (the POST lane's event has
  had no subscriber since cf8c33d7c either) — the SSE broadcast is for parity/future
  use, matching the POST lane exactly; no new client architecture invented.

**Verification**
- Live repro REPLAYED pre-fix on `test-campaign` (localhost, dev stack): PATCH refusal →
  log stayed `[]`, Log view rendered nothing for it; identical POST payload → 400 +
  `write_rejected` row rendered as the dedicated `log-write-rejected` entry
  ("Write Rejected | FeyRanger | Server rejected write to …"). Bug confirmed as filed.
- Live re-verify post-fix (API restarted — `npm run api` has no watcher): after admin
  log-clear baseline (`[]` + "No entries yet." face), a PATCH refusal instantly rendered
  the `Write Rejected | FeyRanger` row in the mounted Log view (no reload, log-test-campaign
  SSE adopted), the raw `/subscribe` stream carried exactly one
  `denied-test-campaign-FeyRanger` frame, the POST refusal still appends its row, and a
  successful PATCH (`activeConditions:["poisoned"]` → 200, GET-verified stored) logged
  ZERO new rejections.
- Tests: `campaigns-changedata-l5-validation.test.js` 54/54; full `server/routes/`
  folder 101 files / 1542 tests green; `npm run lint` zero warnings; full suite green.
- Exit ritual: browser tab closed first (resurrection law), admin clear-change-data +
  clear-log, two-pass GET-verified `{}` / `[]`, disk files deleted,
  `git status --porcelain public/campaigns/` empty.

