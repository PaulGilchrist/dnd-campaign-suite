# CAMPAIGN_LOCK middleware validates only the URL source campaign — PUT rename of the LOCKED campaign passes the lock with any newName (live incident 2026-10-28: test-campaign → zz)

## Summary
The dev-lock middleware (`server.js:38-47`) authorizes mutating requests by comparing the **first path segment after `/api/campaigns`** against `CAMPAIGN_LOCK`. For `PUT /api/campaigns/:campaign` (campaign rename), the destination lives in `req.body.newName` — which the middleware never reads. So while locked to `test-campaign`, `PUT /api/campaigns/test-campaign {newName:"anything"}` sails through the lock (source == locked name) and renames the folder, taking the entire locked campaign's data out from under every running automation. This fired as a **live incident** during the fix-ungated-lanes run on 2026-10-28 (recovered via `cp -R` + API-only restart, byte-diff verified — playbook §LOCK-RENAME GAP): at the time the route itself also lacked the host gate, so nothing stopped it. The route is now localhost-gated (`654b9ee2a`), which shrinks the blast radius to localhost callers, but the lock's authority model is still wrong-by-design: **the lock promises "automations can never touch production campaigns," and rename is the one mutation where the checked identity is not the identity being changed.**

## Steps to reproduce
Reproduce against a **throwaway locked instance on an isolated port** (never experiment on the :80 dev stack):
1. `PORT=8082 CAMPAIGN_LOCK=test-campaign node server.js` (background; `GET http://localhost:8082/api/server-config` → `campaignLocked:true`).
2. From localhost (the lock middleware is host-blind; localhost is all a same-machine automation is anyway): `curl -s --max-time 5 -X PUT -H 'Content-Type: application/json' -d '{"newName":"zz-lock-probe"}' http://localhost:8082/api/campaigns/test-campaign`.
3. Observe the middleware decision in the server log: **no `[campaign-lock] BLOCKED` line** — the request reached the route (post-`654b9ee2a` it should now die at the route's `isLocalhost`… it will NOT 403, since :8082 is localhost; expect **200 and `public/campaigns/test-campaign/` renamed to `zz-lock-probe/`**). This is the proof: the lock alone never protected the locked campaign's own name.
4. Restore immediately: `mv public/campaigns/zz-lock-probe public/campaigns/test-campaign`, kill ONLY the :8082 process (`lsof -ti :8082 | xargs kill`), and if step 3 ran against any long-lived instance, follow the playbook recovery ladder (diff -r, API-only restart, phantom-key self-purge).
   Safer disk-inert variant: skip the happy-path rename and instead assert the middleware directly — unit test (see Suggested fix) with a stubbed route chain; steps 1-3 are for confirming the live seam before writing the test.

## Expected behavior
Under `CAMPAIGN_LOCK=X`, no mutating request may change anything about campaign `X` beyond in-folder data writes that keep the folder name intact. For `PUT /api/campaigns/:campaign`, the middleware must ALSO check `req.body?.newName` (decoded, trimmed) — any rename whose SOURCE **or** DESTINATION is outside `{CAMPAIGN_LOCK}` is 403'd with the same `[campaign-lock] BLOCKED …` log line. Equivalently: rename is permitted only `X → X`-family operations… i.e. locked mode should refuse **every** rename whose endpoints aren't both the locked name (a no-op), which in practice means all renames are denied while locked.

## Actual behavior
`newName` is invisible to the authority check; the locked campaign can be renamed (and, mid-session, orphaned — running tabs hold stale campaign state, changeData keys point at a now-missing folder). Any automation or subagent that obeys the lock's contract can still destroy the lock's guarantee with one body field. Audit of other body-borne targets: `migrate-image-paths` (bulk, fixed-or-filed separately), character rename-in-PUT (`campaigns-character.js:84` moves the *file*, folder stays — acceptable under lock), map rename (`/:campaign/maps/:mapname/rename` — both source params are checked by the segment walk? NO: `rest.split('/')[0]` returns the campaign only; `:mapname` and body new-name are unchecked but map-scoped, folder-safe — in-scope for this ticket is just the campaign-rename case).

## Likely location
Confident (verified in current snapshot 2026-10-28):
- `server.js:38-47` — middleware: `const target = rest ? decodeURIComponent(rest.split('/')[0]) : ''; if (target === CAMPAIGN_LOCK) return next();` — no body inspection.
- Consumer route: `server/routes/campaigns-admin.js` PUT `/api/campaigns/:campaign` (~:194 area post-guard-patch) performing `fs.renameSync`.
- Incident + recovery ladder already documented in `docs/test-setup-playbook.md` §LOCK-RENAME GAP.

## Suggested fix
In the middleware, after computing `target === CAMPAIGN_LOCK`, add a rename-specific clause: if `req.method === 'PUT' && rest (after target) === '' && typeof req.body?.newName === 'string'` and the decoded `newName !== CAMPAIGN_LOCK`, fall through to the same 403 `[campaign-lock] BLOCKED … denied` branch (log it). Note middleware order: `express.json()` currently runs AFTER this middleware (server.js ~:51), so `req.body` is unparsed at check time — either move the lock after body parsing (verify no early-rejection DoS concern: 5mb parse before 403) or parse `newName` cheaply for this one shape (raw-body regex on `content-type: application/json`). Pick one, mirror existing style, keep GET/HEAD/OPTIONS passthrough.
Test: a `server.js`-level supertest (or extract the middleware into a tiny testable factory if one exists in `server/` conventions) pinning: locked, `PUT /api/campaigns/<locked>` + `newName:"other"` → 403 + folder untouched; `newName:"<locked>"` (no-op) → reaches route; non-rename PUT into the locked campaign → unchanged behavior.
Additionally (defense in depth, optional): the route's rename handler could refuse `newName === CAMPAIGN_LOCK` env value — belt-and-braces for the env-driven rig.

## Severity
**Automation-safety hole (defense-in-depth)** — the host gate from `654b9ee2a` already blocks the network path to the dangerous route; what remains broken is the lock's own contract: dev/CI subagents trusting `CAMPAIGN_LOCK` as the authority for "cannot touch the protected campaign" can still rename it away. Live-proven consequence (the `zz` incident) makes this a certainty, not a theory — it just no longer has a remote trigger.

## Resolution
**FIXED 2026-10-28** — diagnosis confirmed exactly (repro fired first try: throwaway `PORT=8082 CAMPAIGN_LOCK=test-campaign` instance, `PUT /api/campaigns/test-campaign {newName:"zz-lock-probe"}` → **200 + folder renamed, zero `[campaign-lock]` log lines**; restored + killed immediately).

**Root cause:** the single inline middleware in `server.js` authorized only the decoded first path segment, and it ran *before* `express.json()` so `req.body` was structurally invisible to it — the rename destination could never be checked.

**Fix (two-phase lock, extracted to a testable factory module following the existing `createServerConfigRouter(CAMPAIGN_LOCK)` injection pattern):**
- NEW `server/utils/campaignLock.js` — exports `createCampaignLockMiddleware(lock)` (phase 1, byte-identical path/segment logic to the old inline middleware, still mounted BEFORE `express.json()` so off-target mutations incl. multer uploads are refused pre-parse) and `createCampaignRenameGuard(lock)` (phase 2, mounted immediately AFTER `express.json()`; blocks only the exact shape `PUT /api/campaigns/<locked>` [trailing slash tolerated] with a string `body.newName` whose trim ≠ lock — same 403 + `[campaign-lock] BLOCKED …` log line via a shared `blockRequest` helper). No-op rename (`newName` trims to lock) and non-rename PUTs pass to the route; all other methods/paths/lock-states behave exactly as before. Chose phase-2-after-parser over moving the whole lock after parsing: zero ordering change for every other route (only requests phase 1 *already admitted* — which would be JSON-parsed anyway — are ever parsed before the destination check), and no raw-body stream re-injection hackery.
- `server.js` — inline middleware replaced by the two factory mounts (with comments explaining the pre/post-parse split).

**Skipped (optional defense-in-depth):** route-side refusal in `campaigns-admin.js` — that module never reads env vars (the decoded lock is injected into factories from `server.js`, single source of truth per its own comment); a `process.env.CAMPAIGN_LOCK` read there would duplicate env parsing and diverge on decode/trim semantics. Not worth the drift risk given phase 2 + pinned tests.

**Verified:**
- Live re-verification on throwaway :8082 (post-fix): hostile rename → **403 + `[campaign-lock] BLOCKED PUT /api/campaigns/test-campaign (locked to "test-campaign")`**, folder untouched; no-op rename → reaches route (400 already-exists, inert); non-rename PUT → reaches route (400 name-required); off-target PUT → 403 (phase 1 unchanged); GET → 200.
- NEW `server/utils/campaignLock.test.js` — 12 tests (rename-block incl. trailing-slash + log-line assertion, no-op/non-rename/body-less passthrough, off-target 403, nested-write/GET/non-campaign passthrough, unlocked = pure passthrough). `npx vitest run server/utils/campaignLock.test.js` 12/12; `npx vitest run server/utils/` 457/457; `npm run lint` zero warnings.
- Main :80 restarted on the new code: `/api/server-config` → `campaignLocked:true`, test-campaign log/change-data GETs healthy (`[]`/`{}`, untouched), `public/campaigns` git-clean, :8082 empty.

Files changed: `server.js` (modified), `server/utils/campaignLock.js` (new), `server/utils/campaignLock.test.js` (new).
