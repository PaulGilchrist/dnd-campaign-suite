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
