# Punctuation/non-Latin map names kebab to an empty slug — unmanageable dotfile + false-success delete

## Summary

Creating a map whose display name kebab-cases to nothing (punctuation-only like `!!!`, emoji, or full non-Latin scripts like Cyrillic/CJK) writes a hidden `.json` DOTFILE with `slug: ""`. Every subsequent lane then collapses its URL segment to empty (`toKebabCase(name)` = `''`) and silently mis-routes: Delete returns a false `200 "Data deleted successfully"` (swallowed by the change-data `:key` wildcard), Open silently opens a blank fresh map instead of the stored document, and the map can never be removed or renamed from the UI with zero error feedback. Additionally, a second empty-kebab name (`??` when `!!!` exists) gets a server 400 that the client swallows into a fake success (`alreadyExists:true`) — the row vanishes with no message.

## Steps to reproduce

All inside `test-campaign` (GM/localhost), Maps view:

1. Type `!!!` into `input[placeholder="New map name..."]` → `Create Map` (aria `Create Map`). Row `!!!` appears. Disk: `public/campaigns/test-campaign/maps/.json` (a dotfile; list API reports `fileName: ".json"`, `slug: ""`).
2. Click `Delete "!!!"` → modal `Yes, Delete Permanently` → confirm. **No error toast, no console error, the row SURVIVES the list refresh.** Network: `DELETE /api/campaigns/test-campaign/maps/` → **200** `{"message":"Data deleted successfully"}` — this is the runtime-store wildcard `DELETE /api/campaigns/:campaign/:key` (campaigns-changedata.js:265) answering with key=`maps` (nonexistent → deleted-nothing, claims success). The map file is untouched on disk.
3. Open the map: `Open "!!!"` → `GET /api/campaigns/test-campaign/maps/` → the same wildcard returns `{value:null}` → falsy create-lane fallthrough opens a BLANK editor showing none of the stored document, with zero notice.
4. Rename / Activate / Edit-description die the same way: the client builds `/maps//rename` etc. from `toKebabCase('!!!') = ''`; e.g. `PUT /api/campaigns/test-campaign/maps/` → 404 `Cannot PUT …` (HTML error page), surfaced only as the generic `Failed to …` catch with the file permanently orphaned.
5. Collision face: with `!!!` existing, create `??` → server `400 "A map with this name already exists"` (both sanitize to `.json`) — but `mapsService.createMap` (:42-52) rewrites that 400 into `{alreadyExists:true}` (no throw), so the UI shows NO error and NO new row; the typed name just evaporates (only a browser resource-400 console line).
6. Control for the false-200 (not maps-specific): `curl -X DELETE /api/campaigns/test-campaign/__no_such_key_xyz__` → also `200 "Data deleted successfully"` — the wildcard claims success for absent keys.

## Expected behavior

Either refuse names that sanitize to an empty file handle at create time (inline `Map name must contain letters or numbers`), or give every lane a non-empty identifier (e.g. fall back to a generated slug from the fileName field which the list already carries). Delete of a nonexistent key should not report success; a swallowed server-400 duplicate must surface the server message (the client dup-check only compares DISPLAY names, so kebab-collisions are reachable).

## Actual behavior

A permanently unmanageable hidden map file accumulates in the campaign (delete lies success, rename 404s, open shows a phantom blank map), and duplicate-kebab creates fail silently. Data-integrity risk + false feedback on four lanes.

## Likely location

Confident on the chain (source-read + live-proven):
- `server/routes/maps.js` `toKebabCase`/`sanitizeMapName` (:13-14) — empty result not rejected at POST (:252 only checks `name.trim()`).
- `src/services/maps/mapsService.js` `toKebabCase` (mirror, :2) used by deleteMap/renameMap/activateMap (:60-141) — empty segment never checked.
- `src/services/maps/mapsService.js` `createMap` (:50-52) — maps the 400 `already exists` into `{alreadyExists:true}` (client dup gate MapsManager.jsx:159 compares display names only, so it misses kebab collisions).
- `server/routes/campaigns-changedata.js:265` `DELETE /:campaign/:key` wildcard — matches `/test-campaign/maps/` (trailing-slash collapse) and returns success for absent keys (false-200; same for GET `{value:null}` which the map loader's falsy create-lane silently adopts).

## Suggested fix

Server POST: after `sanitizeMapName`, `if (!toKebabCase(name.trim()))` → 400 `Map name must contain letters or numbers`. Client: gate `Create Map` on the same predicate (inline error), and in delete/rename/activate/GET prefer the row's carried `fileName`/`slug` over re-kebabbing the display name (the list envelope already has both). `createMap` should stop swallowing the 400 as success (or surface `alreadyExists` to the UI). Consider the wildcard DELETE answering 404 for absent keys (broader blast radius — separate judgement).

## Severity

Data integrity risk — the dotfile map is undeletable and invisible (hidden file, `slug:""`), silently accumulating while the UI lies about delete success; every non-Latin-script campaign name hits this on the first map.

## Resolution

**FIXED 2026-10-30 (fix-queue run).** Reproduced live first, exactly as described: create `!!!` → `.json` dotfile on disk (`fileName: ".json"`, `slug: ""`); UI delete → `DELETE /maps/` → 200, row survives; rename → HTML-404 surfaced only as a raw JSON-parse error string, row orphaned; `??` while `!!!` exists → server 400 silently swallowed (input cleared, no row, no message); wildcard control `DELETE /__no_such_key_xyz__` → 200 confirmed via curl.

What was actually wrong (matches the diagnosis, one refinement): the MapsManager rows ALREADY carried/passed `fileName` to the service layer — the collapse happens one layer deeper: every `mapsService` lane ran `encodeURIComponent(toKebabCase(name))`, and `toKebabCase('.json')` is `''`, so even the carried fileName collapsed to the wildcard URL.

### Changes

- `server/routes/maps.js` — POST create AND `/rename` now 400 `Map name must contain letters or numbers` when `toKebabCase(name.trim()) === ''` (rename gate added too: renaming INTO an empty handle just relocates the file onto the undeletable dotfile).
- `src/services/maps/mapsService.js` — new `mapSegment()` used by all six lanes (delete/rename/activate/GET/PUT/description): kebab when bytes exist, else carry the raw name through (the row's fileName `.json` resolves exactly server-side, so legacy dotfile rows become deletable/renamable — verified live), else throw the create-gate message instead of mis-routing. `createMap`'s alreadyExists resolve now carries the server `error` message (encounter-spawn lane keeps resolve-not-throw).
- `src/components/maps-manager/MapsManager.jsx` — inline create gate (same predicate + message, zero POST) and same gate in `handleRenameSave`; a resolved `alreadyExists` create now surfaces the server message inline and keeps the typed name for editing.
- Tests: NEW `server/routes/maps.empty-kebab-create.test.js` (POST + rename refuse `!!! ??? @$ 🎲 Привет 地城`, no dotfile written, original file untouched), NEW `src/services/maps/mapsService.empty-kebab.test.js` (lane URLs never collapse to `/maps/`; `.json` fileName targets `/maps/.json…`; empty names throw without fetching; collision carries the server message; normal fileName/slug/display-name bytes pinned), NEW `src/components/maps-manager/MapsManager.empty-kebab-gate.test.jsx` (inline create/rename gates, alreadyExists surfacing, happy-path pin). UPDATED `mapsService.test.js` (conflict envelope gains `error`), plus `toKebabCase: (name) => name` stubs added to the three sibling MapsManager test mocks (component now imports it).
- Wildcard-DELETE false-200 (`campaigns-changedata.js:265`): NOT changed — deliberate, per the bug file's own judgement note. Blast radius touches every runtime-key delete app-wide (many callers tolerate/fire deletes of absent keys and would start logging 404s); the maps lanes can no longer reach the wildcard at all since `mapSegment` guarantees a non-empty segment. Recommend a separate ticket if Paul wants honest 404s there.

Note: the running `dev:locked` API has no watcher, so the :80 process keeps the old route code until the orchestrator restarts it; the new server gates were proven live on a fresh throwaway boot (`PORT=8124 CAMPAIGN_LOCK=test-campaign node server.js` → all five refusal faces 400 `Map name must contain letters or numbers`, disk-inert, process killed).

### Verification

- Live (test-campaign, header-verified): `!!!` create → inline `Map name must contain letters or numbers`, **zero** maps POSTs, no dotfile; `??` → same inline gate; legacy `!!!` dotfile row (from the repro) → UI delete now WORKS (`DELETE /maps/.json` → file unlinked, row gone); `Café` exists + create `Caf` → inline `A map with this name already exists` (display dup-check misses it, server 400 no longer swallowed), input keeps `Caf`; adjacent sanity: `QA Fix` create → rename-to-`!!!` gate → rename to `QA Fixed` → open (editor mounts, no notice) → Activate → UI-deletes, all clean. Maps md5s byte-identical to baseline (94fcd0bf… / 8e40779e…).
- Tests: `npx vitest run` over `src/services/maps`, `src/components/maps-manager`, `src/components/sessions`, all `server/routes/maps*.test.js`, `Map.editor-testid`, App map lanes → **38 files / 583 passed**. `npm run lint` clean (zero warnings). `node .opencode/plans/no-timers-guard.mjs` OK.
- Cleanup: maps dir ends at Battle Arena + Test Map (no `.json` residue), change-data `{}` + log `[]` GET-verified two-pass from closed-tab quiet, zero campaign-lock denials in `/tmp/dnd-fixqueue.log`.
