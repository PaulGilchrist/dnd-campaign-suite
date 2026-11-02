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
