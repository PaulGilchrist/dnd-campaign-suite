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
