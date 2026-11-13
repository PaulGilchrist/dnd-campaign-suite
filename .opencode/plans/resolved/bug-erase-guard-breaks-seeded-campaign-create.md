# Bug: generalized map-PUT erasure guard breaks New Arena/Starter quick-create + Regenerate adventure (seed dungeon PUT omits `type` → 400)

## Summary

The erasure guard shipped in `625db8fae` (improve map-put-erasure-guard, 2026-11-12) now requires `type` (and `gridSize` + walls/placedItems) on every whole-doc `PUT /api/campaigns/:c/maps/:slug`. But the seeded-campaign client `persistDungeonMap()` creates the map doc via POST, then PUTs the **raw dungeon-generator output**, which carries `gridSize/walls/placedItems/players/…` but **no `type` key**. Result: the PUT 400s, arena/starter quick-create seed half-fails (campaign folder created, seed maps empty/missing), and `regenerateAdventure` cannot write its new dungeon at all.

## Steps to reproduce

1. Run the dev pair with a throwaway-allowlisted lock, e.g. `CAMPAIGN_LOCK='test-campaign,qa-arena,qa-starter' node server.js` (or `npm run dev`), on localhost.
2. From campaign selection click `New Arena Battle`, name it `qa-arena`, press `Create`.
3. Observe the quick-create modal: it stays open showing the raw server error `Map save rejected: a whole-map save must include the "type" field — without it the map would be reclassified and reopen in the wrong editor.`
4. Cancel; check the created folder: `public/campaigns/qa-arena/maps/` contains only `the-sparring-hall.json` with `"type": "indoor", "walls": []` — the carved arena walls never landed and the second hall is absent (seed aborted). (Console: `PUT /api/campaigns/qa-arena/maps/the-sparring-hall` 400 ×2 maps, error thrown from `saveMapData` ← `persistDungeonMap`.)
5. Repeat with `New Starter Adventure` named `qa-starter` → identical 400 face.
6. Same root call for `Admin → Regenerate adventure` (`regenerateAdventure()` line ~527 → same `persistDungeonMap`) — cannot write its new dungeon doc under the same guard.

## Expected behavior

Seeded campaign creation writes its generated dungeon maps (POST create + PUT with the full doc), and Regenerate adventure lands a new dungeon file. The erasure guard should not fire against a body that legitimately describes a complete indoor map — or the seed client should send the required fields.

## Actual behavior

`PUT /api/campaigns/qa-arena/maps/the-sparring-hall` → **400** `Map save rejected: a whole-map save must include the "type" field …` (server `wholeMapErasureError` in `server/routes/maps.js`). Both throwaway quick-create lanes now produce half-seeded orphan campaigns (folder + empty shell map kept, error shown inline, no rollback). Verified live twice (arena + starter), same copy, zero generated walls on disk.

## Likely location

Confident: the contract mismatch between
- `src/services/campaign/seededCampaign.js` → `persistDungeonMap()` (line 152): `createMap(...)` then `saveMapData(campaignName, mapName, dungeon)` where `dungeon` is `generateDungeon()`/`carveArena()` output — no `type` key (grep: `dungeonGenerator.js` return object has no `type`).
- `server/routes/maps.js` → the new per-type required-key set added by `625db8fae` (`type`+`gridSize`+`walls`/`placedItems`), which was previously satisfied enough by the players-only asymmetry.

Note: this shipped yesterday (`625db8fae`) and its unit tests added per-field 400 pins but did not cover the seed-client PUT body shape; the throwaway lanes passed in the QR/RS runs earlier the same day, before the generalization.

## Suggested fix

One-line class fix client-side: in `persistDungeonMap`, PUT `saveMapData(campaignName, mapName, { type: 'indoor', ...dungeon })` (or merge the stored doc). Alternative server-side: exempt the create-then-PUT seed pattern — but the guard is deliberately dumb and Replace-semantics law says send every token, so the client merge is the right lane. Either way add a regression pin: a unit test asserting the seed lane’s PUT body passes `wholeMapErasureError` (fixture: raw `generateDungeon()` output + `type`). Also consider rolling back the campaign folder (or offering Retry) when seeding aborts — today a Cancel leaves an orphaned, misleadingly-listed campaign card.

## Severity

Broken feature — both owner-sanctioned seeded-campaign creation flows and the starter Regenerate-adventure flow are unusable on the current build, and they leave half-seeded orphan campaigns on disk. Not a data-integrity risk for existing campaigns (guard only rejects writes; nothing valid is corrupted).

## Resolution

FIXED 2026-11-13 — diagnosis confirmed exactly as filed.

**What was actually wrong.** The `625db8fae` guard is honest; the seed client was the contract-breaker. `persistDungeonMap()` POSTed the create body (`{type:'indoor', gridSize}` — the server's `buildIndoorMapData` whitelist arms the stored doc with `type/gridSize/walls/placedItems/players`), then PUT the RAW `generateDungeon()`/`carveArena()` output as a full REPLACE. That output carries `gridSize/walls/placedItems/players/zoom/panX/panY` but no `type`, so `wholeMapErasureError` (indoor required set) 400'd with the `type` sentence. All three broken lanes — arena quick-create, starter quick-create, `regenerateAdventure()` — route through this ONE function, so a single merge fixes all three. The other seed PUT (starter hex map) already carried `type:'outdoor'` + all outdoor required keys and was unaffected. No 2024-ruleset twin: the seed lane is ruleset-agnostic (single `seededCampaign.js`).

**Files changed.**
- `src/services/campaign/seededCampaign.js` — `persistDungeonMap()` now PUTs `{ ...dungeon, type: 'indoor' }` (guard-contract comment added). Client-side lane per the bug file's adjudication: Replace-semantics law says send every token; the guard stays deliberately dumb.
- `src/services/campaign/seededCampaign.erasure-guard.test.js` (NEW) — imports the real server guard (`wholeMapErasureError` + `erasesStoredPlayers`, cross-import precedent: `characterFileName.test.js`) and runs the REAL lanes with spied services: pins the regression itself (raw generator output alone still trips the `"type"` 400), then asserts every dungeon-PUT body from the arena preset, starter preset (dungeon AND hex per-type), and `regenerateAdventure()` passes both guards against the create-stored doc shape.

**Not in scope (noted, not done):** the orphaned half-seeded folder on abort (folder rollback / Retry offer) remains open as the bug file's own "also consider" improvement — the bug's failure mode is gone, so it no longer fires.

**Verification.**
- Live repro BEFORE fix (Playwright, allowlist pair): New Arena Battle → `qa-arena` → Create: modal stayed open with the exact verbatim 400 copy; network `POST /maps 201` + `PUT /maps/the-sparring-hall 400`; disk had only `the-sparring-hall.json` with `walls: []` and no Colosseum Pit.
- Live re-verify AFTER fix, all three lanes: **New Arena Battle** → modal closes, app auto-enters campaign; disk: BOTH halls, `type: indoor`, carved walls 258 / 217 + 39 / 23 placedItems, Sparring Hall active, `meta {type:'arena'}`, 3 sparring encounters. **New Starter Adventure** → modal closes; disk: dungeon (492 walls / 76 items) + hex countryside (terrain 288, 2 POIs), seed doc layer 1, 3 quests. **Admin → Regenerate adventure** (role=dialog `Yes, Regenerate`) → status `New adventure rolled: The Crimson Dungeon of Whispers…`; disk: new dungeon 584 walls, OLD dungeon file gone, hex portal `linkedMap` re-pointed, seed doc layer 2 + pastTitles, and the `adventure_regenerated` audit row names old → new + layer.
- Adjacent sanity: real indoor-editor save (Maps → open dungeon → Grid Size 30→31) autosaved whole-doc PUTs → 200; and the guard STILL 400s a genuinely partial PUT (GET stored doc, delete `type`, PUT → verbatim 400, disk byte-inert).
- Tests: `seededCampaign.erasure-guard.test.js` 4/4; touched-area run `src/services/campaign` + erasure/players-guard server tests = 23 files / 329 tests PASS; `npm run lint` clean (zero warnings).
- Cleanup: `qa-arena` + `qa-starter` API-deleted (ghost-404, folders gone; `public/campaigns/` back to the 5 baseline); `test-campaign` never dirtied (change-data `{}` + log `[]` GET-verified — no Admin clears needed). Note: entering a zero-character seeded campaign auto-opens the character wizard; an untouched draft closes on `×` with no confirm (RS law re-proved).
