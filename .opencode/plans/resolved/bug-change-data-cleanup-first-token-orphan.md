# Bug: change-data cleanup on character delete only matches the FIRST NAME TOKEN — multi-word characters leave orphaned runtime buckets forever

## Summary
When a character is deleted, the server's `removeChangeDataKey()` cleans the per-character change-data bucket by comparing bucket keys against the FIRST alphanumeric token of the character name. For multi-word names (e.g. "QA Space Cadet"), the bucket key is the full name, so the comparison never matches and the bucket (with HP truth `hitPoints`, feature latches like `fanaticalFocusUsed`) is orphaned in the campaign's change-data — permanently, via either the API or the UI delete lane.

## Steps to reproduce
1. In `test-campaign`, create a space-named character through the UI wizard named `QA Space Cadet` (create → 201, sheet + sidebar link render; just viewing the sheet seeds its runtime bucket).
2. Delete it via the sheet Delete button (named confirm → accept). DELETE returns 200; sidebar link and disk file are gone.
3. Wait >12 s (changeData debounce) and GET `http://localhost/api/campaigns/test-campaign/change-data`.
4. Observe the response STILL contains a `QA Space Cadet` bucket, e.g. `{"fanaticalFocusUsed": false, "hitPoints": 9}`; it persists across further re-reads (present 12 s after delete, disk-stamped).
5. CONTROL: single-token characters (e.g. `AasimarTest`) have bucket key == name == first token, so their cleanup DOES match — this lane only breaks for multi-word display names.
6. RENAME LEG: create API char `Cadet One`, seed its bucket (`POST /:c/Cadet%20One {value:{hitPoints:7}}` → 200), rename to `Cadet Two` via `PUT /:c/Cadet_One.json`, then `DELETE /:c/Cadet_Two.json`. After the 10 s debounce, change-data still contains `{"Cadet One": {"hitPoints": 7}}` — the PUT rename lane calls `removeChangeDataKey(campaign, originalCharacter.name)` with the full old name and misses it exactly the same way.
7. Session-end read confirmed THREE orphan buckets from deleted characters co-existing: `{"QA Space Cadet": {...}, "QA Alert Probe": {"hitPoints":143}, "Cadet One": {"hitPoints":7}}` while zero Cadet/Probe files exist on disk.

## Expected behavior
Deleting a character removes its entire change-data bucket regardless of how many words the display name has (bucket keys are the full display name — cleanup should match the full name, case-insensitively like before).

## Actual behavior
`removeChangeDataKey(campaign, 'QA Space Cadet')` derives `firstName = 'QA'` and only deletes bucket keys equal to `'QA'` (case-insensitive) — the `'QA Space Cadet'` bucket survives. Verified live: `change-data` retains `{"QA Space Cadet": {"fanaticalFocusUsed": false, "hitPoints": 9}}` after both the create→view→delete cycle. Zero console/network errors — silent orphan.

Consequences: (a) orphaned buckets accumulate per deleted multi-word character; (b) data-integrity risk — a NEW character created later with the same display name re-seeds from the dead character's stale `hitPoints` (client full-store re-publishes what it reads; prior runs proved loaded tabs resurrect cleared data), i.e. a fresh Level-1 PC could inherit an HP pool or feature latches from a deleted character.

## Likely location
`server/utils/changeData.js:184-198` — `removeChangeDataKey` line 185: `const firstName = characterName.split(/[^a-zA-Z0-9]/)[0] || characterName;` then the match `key.toLowerCase() === firstName.toLowerCase()`. Confident (code read matches live behavior exactly). Callers: `server/routes/campaigns-character.js` DELETE (line ~209) and the PUT rename lane (line ~134) — BOTH are affected, so renames of multi-word characters also orphan their old buckets.

## Suggested fix
Match the FULL name in addition to (or instead of) the first token, e.g. delete keys where `key.toLowerCase() === characterName.toLowerCase()` OR `key.toLowerCase() === firstName.toLowerCase()` (keeping the first-token leg for legacy rename-cleanup semantics that motivated it). Add a unit test to `server/utils/changeData.test.js` with a two-word name (existing tests only cover `Bob` / `Bob-Jr`, where first-token == full name — which is why this slipped).

## Related observation (same probe session, same theme — validate at the create boundary)
`POST /api/campaigns/:c` accepts minimal payloads (no `class.subclass`, no `inventory.magicItems`) with 201. The sheet lane for such a character CRASH-SILENT: `CharSheet.jsx:~318` calls `fetchData()` with NO `.catch`, and `rules-magicItems.js:8` / `rules-proficiencies.js:149` THROW on the missing fields → `setPlayerStats` never runs → the sheet keeps rendering the PREVIOUS character's body while the header/title/sidebar show the newly-selected one. Worst leg: the visible `Delete "X"` / `Edit "X"` buttons (aria-labels derive from the stale playerStats) are LIVE — clicking Delete mutates the WRONG character (observed live with the confirm dismissed before accept; no mutation occurred only because the confirm was caught). Suggested: server-side shape validation on create (400 on missing required sections) and/or a `.catch` in CharSheet fetchData that surfaces an error state instead of leaving a stale body.

## Severity
Data integrity risk — silent stale-state resurrection for same-named future characters; no crash, but HP/latch truth from deleted characters can flow back into live gameplay.

## Resolution
FIXED 2026-10-28 (fix subagent run).

**What was actually wrong:** exactly as diagnosed — `removeChangeDataKey()` in `server/utils/changeData.js` derived `firstName = characterName.split(/[^a-zA-Z0-9]/)[0]` and only deleted bucket keys equal to that first token, while change-data buckets are keyed by the FULL display name. Both caller lanes (`campaigns-character.js` DELETE :209 and PUT-rename :135) already pass the full name, so the defect was purely the util's match predicate — no route changes needed. Reproduced live BEFORE fixing: UI-wizard-created `Zap Repro Cadet` (16-step wizard, seeded bucket `{fanaticalFocusUsed:false, hitPoints:9}`), UI sheet Delete → file + link gone but the `Zap Repro Cadet` bucket survived in memory AND on disk after the debounce; API rename leg `Cadet One`→`Cadet Two`→DELETE left `{"Cadet One":{"hitPoints":7}}` orphaned. Confirmed no prior fix existed (clean working tree, `git log` on the util).

**Fix (minimal, suggested-fix shape):** `removeChangeDataKey` now normalizes the name via the existing `normalizeCharacterName()` from `server/utils/characterName.js` (re-use, not re-invention) and deletes keys matching the FULL name case-insensitively **or** the legacy first token (first-token leg kept deliberately for rename-cleanup semantics like `Bob-Jr` → `Bob`, pinned by the pre-existing `Bob-Jr` test). Whitespace-tolerant matching comes free via the normalization helper. Non-string/empty names are now a safe no-op instead of a throw.

**Files changed:**
- `server/utils/changeData.js` — full-name + first-token match in `removeChangeDataKey`, `normalizeCharacterName` import.
- `server/utils/changeData.test.js` — 6 regression tests added to the existing `removeChangeDataKey` describe: multi-word full-name bucket removed; case-insensitive multi-word; rename-lane full-old-name removed while `Bob-Jr`→`Bob` legacy leg retained; sibling bucket sharing only the first token (`Cadet Two` when deleting `Cadet One`) NOT wiped; uneven-whitespace name matches collapsed bucket; empty/missing name no-op.

**Verification:**
1. `npx vitest run server/utils/changeData.test.js` → 69/69 pass.
2. `npx vitest run server/utils server/routes/campaigns-character` → 17 files, 529/529 pass (route tests pin callers still pass full names).
3. `npm run lint` → clean (zero warnings).
4. Live re-run after API restart (`CAMPAIGN_LOCK=test-campaign`, `campaignLocked:true` verified): UI wizard create `Zap Repro Cadet` → bucket seeded → UI Delete → >12 s → `GET /change-data` keys `['combatSummary','__campaign__','AasimarTest']` — bucket GONE from API and disk; live `AasimarTest` bucket untouched. Rename leg: `Cadet One` seeded → PUT→`Cadet Two` → DELETE → no `Cadet One`/`Cadet Two` buckets remain. Single-token control: `ZapSolo` create→seed→delete → bucket removed (first-token lane un-regressed).
5. Cleanup: all probe chars deleted (disk-verified), tabs closed, admin clear → change-data `{}` + log `[]` GET-verified; zero campaign-lock denials in the server log.

**Related observation NOT fixed here (out of scope per brief):** the create-boundary validation / CharSheet crash-silent hazard described above is a distinct bug (server payload shape validation + client `fetchData().catch`) and deserves its own bug file; only the change-data cleanup matching was in this ticket's scope.
