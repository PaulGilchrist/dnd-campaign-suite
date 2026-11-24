# Bug: AI-authoring fixture tests red — Cap Drill Sergeant row lacks schema-required `attitude`, and party.test pins a stale 13-character baseline

## Summary

Four server tests in `server/services/ai/authoring/` fail on current `test-campaign` data (full suite 37653 passed / 4 failed, witnessed 2026-11-23 in the save-equation fix run): (a) `entitySchemas.test.js` + `entitySchemas.name-law.test.js` reject the permanent `Cap Drill Sergeant` row in `public/campaigns/test-campaign/data/npcs.json` with `$.attitude must be one of: deep bonds, positive, neutral, negative, extreme opposition` — the row was authored during the Magic Jar sandbox drill without the schema-required `attitude` enum; and (b) `party.test.js:13` pins `party.length === 13` ("campaign baseline: 13 characters") but 14 character files now exist (`expected 14 to be 13`), taking `storyBible.test.js > knows the party from the character files` down with it. The app lanes are unaffected (the NPC rides the npcs CRUD + initiative lanes fine, live-proved); this is fixture-data nonconformance plus stale count pins.

## Steps to reproduce

1. `npx vitest run server/services/ai/authoring` (≤60 s) — 4 failures with the exact assertion output above (full-run log preserved at `/tmp/fix-spell-results-face-suite.log`).
2. `cat public/campaigns/test-campaign/data/npcs.json | grep -c attitude` — the Cap row has no `attitude` field.
3. Count `public/campaigns/test-campaign/` character files (the loader `readParty` walks them) — 14, but `party.test.js` asserts 13.

## Expected behavior

Canonical repo-owned data conforms to the app's own entity schemas (the authoring schemas are the truth for authored rows), and count pins match the current canonical campaign baseline.

## Actual behavior

Cap's row fails `validateEntity('npc', …)` (missing `attitude`); `readParty` returns 14 against a 13 pin.

## Likely location

- `public/campaigns/test-campaign/data/npcs.json` — add the conforming field to the Cap row (owner-reviewed fixture, permanent per `docs/test-monster-registry.json`).
- `server/services/ai/authoring/party.test.js:13` (count pin) and `storyBible.test.js` party expectations — re-baseline to the current character roster.

## Suggested fix

Per the no-legacy/stale-pins doctrine: adjust ONCE to canonical. (1) Give Cap's row `attitude: "neutral"` via the npcs CRUD API PUT lane (server pair is RUNNING — a cold-disk edit risks cache clobber; PUT then GET-verify and confirm md5 stability after debounce). (2) Update the count pin(s) to the true roster size and list the 14 files in the Resolution so future baselines are greppable; verify no other test pins 13 (`grep -rn "toBe(13)\|length).toBe(1[0-9]" server/`). Do NOT delete fixture data to make pins pass.

## Severity

Suite hygiene — full suite cannot go green; every future run must carry an "unrelated pre-existing failures" caveat. Data-integrity-adjacent: our own permanent fixture violates our own entity schema.

## Resolution

FIX: FIXED 2026-11-23 (fix subagent). Full suite green: **3547 files / 37660 tests / 0 failures** (`/tmp/fix-cap-attitude-fullsuite.log`, EXIT:0).

### What was actually wrong

**Two independent defects; the 13-pin staleness was NOT from Cap.**

1. **Cap Drill Sergeant `attitude` (2 schema tests).** At fix time the row carried `attitude: "hostile"` — an **invalid enum value**, not the missing field the filing described. Reconstruction forensics (the PUT route serializes deterministically via `JSON.stringify(rows, null, 2)`) show the pre-fix bytes md5 `903bb2c6…`, which ≠ the WW-era docs pin `db6666c12…` — so the row was re-authored (updatedAt `1793…` → `1795480187372`) between the docs pin and the filing, acquiring `hostile` (the npc CRUD PUT lane never validated `attitude`; only the authoring schema and the UI's `ATTITUDE_OPTIONS` dropdown know the enum `deep bonds | positive | neutral | negative | extreme opposition`). The validator's enum-violation error is identical in shape to the missing-field error, which is why the filing read as "missing". Fixed per doctrine: valid value `neutral` written through the **live CRUD PUT lane** (`PUT /api/campaigns/test-campaign/npcs/Cap%20Drill%20Sergeant`, GET→mutate→PUT one-shot, name in body, current `updatedAt` echoed to pass the concurrent-save guard → force-re-stamped `1795484660245`). GET-verified server-side and on disk; row md5 `01bf02964323a572fc909d816cb9a623` stable across the debounce window. The re-run of `entitySchemas.test.js`/`name-law.test.js` re-validated **every** remaining field on the row against `npcSchema` (`additionalProperties: false`) — clean, no further schema misses. No schema weakened, no app code changed.

2. **Stale 13-party pins (2 tests).** The pin was stale since the **permanent `FixtureFighter5e` fixture landed (d709198ef)** — already recorded in `docs/app-exploration.md` ("roster is now 14 characters", re-proved ZY-era) — nothing to do with Cap. `readParty` walks the campaign-root `*.json` files; the true canonical 14-file roster is: `AasimarTest, AberrantSorcerer, CelestialWarlock, Disciplined_Monk, DivinationWizard, DraconicDragon, ElderPaladin, EvasiveFighter, FeyRanger, FixtureFighter5e, HeroesFeastBard, HexWarlock, War_Cleric, Wild_Sage_Druid`. `party.test.js` now asserts the directory-derived count (`readdirSync(root).filter(.json)` == `party.length`, proving readParty skips none — no sibling test derived counts dynamically, so this is the new pattern) **plus** the literal `toBe(14)` baseline with a comment naming the fixture that moved it; `storyBible.test.js` pinned to 14 with a cross-reference comment. Repo-wide pin sweep (`toBe(13)`, `party.length`, `13 charac`, `db6666c12`, `514ec55f`, `fb536d55`, `md5` in `*.test.js`): the only other hits are unrelated save-DC/heal values in `src/components/encounter/` and `campaigns-character-patch.test.js:216` (`stats.con === 13`, fixture-local); `log.test.js` uses a MOCKED roster, unaffected. The 14-char campaign-root aggregate `514ec55f3671ab207833c0e8fdb0a84b` is UNMOVED (character files untouched — npcs.json is not part of it).

### Files changed

- `public/campaigns/test-campaign/data/npcs.json` — Cap row `attitude: "hostile" → "neutral"` (via CRUD PUT lane, not cold-disk; **campaign-data file, needs staging**). Post-fix md5 `01bf02964323a572fc909d816cb9a623`.
- `server/services/ai/authoring/party.test.js` — dynamic roster-directory assertion + re-baselined `toBe(14)`; added `fs` import.
- `server/services/ai/authoring/storyBible.test.js` — `partyLevels.size` pin 13 → 14 with provenance comment.
- `docs/app-exploration.md` — Baseline Fingerprints: `data/npcs.json` pin `db6666c12…` → `01bf0296…` + what moved it; aggregate line notes the fix re-proved `514ec55f…` unchanged.
- `docs/test-setup-playbook.md` — in-place: two stale `db6666c12` recovery-restore refs updated to `01bf0296`; new durable law appended to the campaign-NPC upsert bullet (GET /npcs is `{npcs:[…]}`-wrapped; the PUT lane read-modify-writes npcs.json SYNCHRONOUSLY in-request — no debounce/cache-clobber surface).

### Evidence

Before (`npx vitest run server/services/ai/authoring`): `Test Files 4 failed | 19 passed (23) / Tests 4 failed | 187 passed (191)` — `npc Cap Drill Sergeant: $.attitude must be one of: deep bonds, positive, neutral, negative, extreme opposition` ×2; `expected 14 to be 13` ×2 (`party.test.js:13`, `storyBible.test.js:19`).

After (same command): `Test Files 23 passed (23) / Tests 191 passed (191)`. `npx vitest run server`: 175/175 files, 2777/2777 tests. `npm run lint`: clean (zero warnings). Full suite: `Test Files 3547 passed (3547) / Tests 37660 passed (37660)`, EXIT:0. (Total test count grew 37657→37660 vs the filing's run from unrelated suite growth since; zero failures is the point.)
