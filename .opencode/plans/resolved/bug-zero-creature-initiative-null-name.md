# Zero-creature Initiative mount corrupts `activeCreatureName` runtime key and crashes expireStaleEffects

## Summary
When the Initiative view mounts for a campaign whose combat summary resolves with zero creatures (e.g. a freshly quick-created arena — zero characters, no server combatSummary), the client POSTs `activeCreatureName` with the value `undefined`, which serializes to an unwrapped `{}` body and persists `{}` as the stored key. The SSE echo of that object then crashes `expireStaleEffects` (`targetName.toLowerCase is not a function`) and poisons the turn gate with `"1:[object Object]"`.

## Steps to reproduce
1. `npm run dev` (or `CAMPAIGN_LOCK='test-campaign,qa-arena,qa-starter' node server.js` + vite).
2. On campaign selection, click **New Arena Battle**, name it (e.g. `qa-arena`), Create. Auto-select lands in the campaign; Cancel the zero-character wizard.
3. Observe console error: `[expireStaleEffects] Zone save expiration processing failed: TypeError: targetName.toLowerCase is not a function` (stack through `expirationQueue.js:192 expireForTarget` ← `expireStaleEffects.js:87` ← `initiative/sseHandlers.js:113 handleActiveCreatureNameChange`).
4. `GET /api/campaigns/qa-arena/change-data` → contains `"activeCreatureName": {}` and `"__initiative__": {"lastAppliedTurnStartCreature": "1:[object Object]"}`.
5. Deterministic re-run: `DELETE` the `activeCreatureName`/`combatSummary`/`__initiative__` keys (200 each; wait ~12s debounce), then on a GM tab click Campaigns → re-select `qa-arena` → Cancel wizard. Fetch spy records: `POST /api/campaigns/qa-arena/activeCreatureName` with literal body `{}` (unwrapped), plus `POST .../combatSummary {"value":{"round":1,"creatures":[]}}` (wrapped, fine). The `{}` key and the crash return.

## Expected behavior
`activeCreatureName` should store a string creature name or `null` (Initiative.jsx already falls back to `null` in the other branch when `merged.creatures[0]` is absent). No console error; no `[object Object]` in `__initiative__`.

## Actual behavior
- `storage.set('activeCreatureName', firstName, …)` runs with `firstName === undefined` (line `const firstName = creatures[0]?.name`, creatures is `[]` for a zero-character campaign). `JSON.stringify({value: undefined})` → `{}` body; the change-data wildcard stores `{}` (verified live; the key survives into `character-change-data.json` on disk after debounce).
- SSE broadcasts `{}` → `handleActiveCreatureNameChange(newActive = {})`: `cs.activeCreatureName = {}` cached, gateKey `` `1:${{}}` `` → `"1:[object Object]"` written to `__initiative__`, and `expireStaleEffects(campaign, {})` proceeds (object is truthy) → `expireForTarget` calls `{}.toLowerCase` → TypeError, caught and logged (one error per echo; all turn-start expiration work for that pass is skipped).
- Reproduced twice live (creation + clean re-select after key deletes), console error count incremented both times (1 → +2).

## Likely location
Confident: `src/components/initiative/Initiative.jsx:657-664` — the no-server-cs branch of the mount effect:
`const firstName = creatures[0]?.name` (undefined for empty creatures) → `storage.set('activeCreatureName', firstName, campaignName)`.
Secondary hardening seams: `src/services/ui/storage.js` (should not emit a POST whose `{value}` collapses to `{}`), `src/components/initiative/sseHandlers.js:106-131` (should reject non-string `newActive`), `src/services/rules/effects/expireStaleEffects.js:71-75` (`if (!activeName) return` lets objects through).

## Suggested fix
Primary: use `const firstName = creatures[0]?.name || null` in the else-branch of Initiative.jsx (mirrors the merged-branch fallback one level up) so `null` is stored/passed. NOTE: commit 2036625ff already applied the exact twin guard (`newSummary.creatures[0]?.name ?? null`) to the sibling CLEAR path in `createCreatureHandlers.js:215-225` — the mount lane was simply missed in that pass, so the fix is a known-good one-token precedent, not a design question. Defensive: early-return in `handleActiveCreatureNameChange` when `typeof newActive !== 'string'` (log + ignore), and/or skip the write in storage.set when the serialized body would be `{}`. Add a regression test pinning `storage.set('activeCreatureName', null)` for the zero-creature mount, mirroring `initiative.localhost-gate.test.jsx` write-capture style.

## Severity
Data integrity risk — every zero-creature Initiative mount (which is the FIRST mount a brand-new seeded arena ever does) persists a malformed runtime key, poisons the `lastAppliedTurnStartCreature` gate format, and emits an uncaught-class console error; no user-facing crash, but the stored `{}` is an invalid value every future consumer must special-case.

## Resolution
FIXED 2026-11-02 (subagent run, adapted repro to test-campaign per lockdown — `qa-arena` off-limits).

**What was wrong (diagnosis confirmed as filed).** `Initiative.jsx` no-server-cs mount branch (line 660): `const firstName = creatures[0]?.name` → `undefined` for a zero-character roster → `storage.set('activeCreatureName', undefined, …)` → `JSON.stringify({value: undefined})` collapses to an unwrapped `{}` POST → wildcard route stores `{}` under the key → SSE echo `{}` → `handleActiveCreatureNameChange` stamps the gate `"1:[object Object]"` into `__initiative__` and calls `expireStaleEffects(campaign, {})` → `expireForTarget` crashes on `targetName.toLowerCase is not a function` (caught + logged; that pass's expiration work skipped). The CLEAR-path twin (commit 2036625ff) had the `?? null` guard; the mount lane was simply missed.

**Live repro (test-campaign, pre-fix).** Faithful corrupting condition = "Initiative mounts with a zero-creature roster and no server combatSummary". Rigged inside test-campaign by Playwright-stubbing `GET /api/campaigns/test-campaign` → `{files:[]}` (client-side zero-character campaign; server change-data untouched baseline `{}`), selecting the campaign, cancelling the auto-wizard, clicking Initiative. Fetch spy captured exactly the bug-file bytes: `POST …/activeCreatureName` body `{}` (unwrapped) + `POST …/__initiative__` `{"value":{"lastAppliedTurnStartCreature":"1:[object Object]"}}`; console error verbatim (`expirationQueue.js:192 ← expireStaleEffects.js:87 ← sseHandlers.js:113`); `GET change-data` showed `"activeCreatureName": {}`.

**Files changed.**
- `src/components/initiative/Initiative.jsx` — mount else-branch: `const firstName = creatures[0]?.name ?? null` (mirrors the `createCreatureHandlers.js:221` CLEAR-path precedent) + explanatory comment. `null` serializes as `{"value":null}` (properly wrapped), the server stores `null`, and downstream consumers treat it as the legitimate "no active creature" sentinel (`expireStaleEffects` early-return on falsy; `applyTurnStartEffects` guards `!activeName`; SSE dispatch drops `data == null` so a null echo never even reaches the turn mirror).
- `src/components/initiative/sseHandlers.js` — defensive hardening per the bug file: `handleActiveCreatureNameChange` early-returns with a `console.error` on truthy non-string `newActive` (rejects legacy `{}` echoes; null/undefined stay legitimate sentinels — verified how existing nulls flow before adding the guard).
- Dual-ruleset: no 2024 twin of this mount lane exists (single `Initiative.jsx`; grep of `creatures[0]` writers shows only this lane, the already-guarded CLEAR path, and `seededCampaign.js` which already uses `|| null`).
- New tests: `src/components/initiative/Initiative.zero-creature-mount.test.jsx` (write-capture style of `initiative.localhost-gate.test.jsx`: zero-creature localhost mount asserts `storage.set('activeCreatureName', null, 'test-campaign')` exact bytes + never `undefined`; normal roster still arms first creature; non-localhost authors zero writes) and `src/components/initiative/sseHandlers.malformed-active-echo.test.jsx` (`{}` echo fully dropped — no gate stamp/expiry/state writes + error logged; string names still mirror; nullish still dropped at dispatch). Both verified VACUOUS-FREE: reverting each fix individually makes the matching test fail with the exact pre-fix fingerprint (`undefined` vs `null` / gate stamped).

**Verification.**
1. New tests: 2 files / 6 tests pass (`npx vitest run` on the two files).
2. Touched-area: `npx vitest run src/components/initiative` → 75 files / 580 tests pass; `src/services/rules/effects` → 55 files / 471 tests pass.
3. `npm run lint` → clean (zero warnings; fixed one unused-arg in the new test).
4. Live re-verify (same stubbed zero-char rig, post-fix): `POST …/activeCreatureName` body now `{"value":null}` (wrapped), NO `__initiative__` POST, `GET change-data` → `"activeCreatureName": null`, zero `[object Object]`, **zero console errors**. Adjacent sanity: real 13-PC roster mount renders `Initiative (round 1)` with 13 cards + first creature active, still zero console errors.
5. Cleanup: campaign tab deselected (quiet), Admin clear-change-data + clear-log, two-pass GET verify `{}` / `[]` baseline restored; corrupt on-disk key removed by the clears.
