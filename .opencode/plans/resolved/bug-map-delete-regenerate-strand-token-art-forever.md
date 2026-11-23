# Token art orphaned forever when a map is deleted (map-DELETE + Admin Regenerate lanes never prune `images/token-*`)

### Summary
The shipped orphan-prune (`improve(token-art-orphan-prune)` 7be3e8fa8) unlinks superseded `images/token-*` uploads at the **map-PUT save seam only**. The map `DELETE` route and the Admin → Regenerate adventure flow (which deletes the retired dungeon file via `deleteMap` → the same DELETE route) unlink the map DOCUMENT but leave every token-art upload the document referenced on disk. Because the prune diff derives candidates from the *stored document's rows*, once the doc is gone nothing on disk can ever name those files again — they are permanent orphans that accumulate for the campaign's lifetime (only deleting the whole campaign folder sweeps them, `campaigns-admin.js`).

### Steps to reproduce
Leg A — map DELETE (API-proved in test-campaign):
1. In test-campaign (dev pair, GM origin): upload token art via `POST /api/campaigns/test-campaign/token-image` (e.g. returns `images/token-…-grf3iv.png`).
2. `POST /api/campaigns/test-campaign/maps` a sandbox map with a `placedItems` row carrying that `imagePath` → 200; file exists in `public/campaigns/test-campaign/images/`.
3. `DELETE /api/campaigns/test-campaign/maps/<sandbox>` → `{"message":"Map deleted successfully"}`; the map JSON is gone from `maps/`, but the `token-….png` REMAINS in `images/` (witnessed; probe file then removed by hand to restore the baseline).

Leg B — Admin Regenerate (UI-proved in the `qa-starter` throwaway):
1. Quick-create **qa-starter** (`New Starter Adventure`), enter the campaign.
2. Upload token art into qa-starter (`POST /api/campaigns/qa-starter/token-image` → `images/token-…-p5p0qe.png`) and PUT the seeded dungeon doc with a `placedItems` row referencing it → 200.
3. Admin → `Regenerate Adventure` → in-app confirm `Yes, Regenerate` → success strip `New adventure rolled: The Cursed Mines of the Dark Lord — waves re-rolled, portal and main quest re-pointed.`
4. Disk census: `maps/` holds exactly the countryside + the NEW dungeon file (the old dungeon file correctly deleted); quests/POI/layer/pastTitles all re-pointed honestly; BUT `images/` still holds `token-…-p5p0qe.png` — an orphan referencing a document that no longer exists.

Grep: the only prune call site is `pruneOrphanedTokenArt` at the PUT seam (`server/routes/maps.js:712` region); `fs.unlinkSync` in the DELETE route (:546 region) unlinks the map file only; no disk-scan sweep exists anywhere else.

### Expected behavior
The shipped feature's stated goal is that superseded uploads don't "live on disk forever". Deleting a map (or re-rolling the adventure that replaces the map file) removes the LAST references to its token uploads — the save seam's keep-set logic should be mirrored at the DELETE seam (diff the stored document's `placedItems[].imagePath` against the `images/token-*` naming gate and unlink), so `Regenerate adventure` and map deletion don't strand art.

### Actual behavior
Both lanes silently leave the art files behind. Repeated regenerate/map churn grows `images/` without bound; a GM who deletes a map believing the art went with it accumulates invisible cruft (and the files are untargetable by the PUT-seam prune afterwards — the candidate set comes from stored doc rows).

### Likely location
Confident:
- `server/routes/maps.js` DELETE handler — unlinks `filePath` only; no `pruneOrphanedTokenArt(campaign, storedData, { placedItems: [] })` call.
- `src/services/campaign/seededCampaign.js regenerateAdventure()` step 2 — `await deleteMap(campaignName, oldDungeon.slug)` rides that same DELETE route.
- Rename is SAFE (witnessed: `imagePath` lives relative to the campaign `images/` dir, so the moved doc keeps its art, and the prune lane still works through the renamed slug — witnessed pruning B through `qa-prune-sandbox-renamed`).

### Suggested fix
In the DELETE handler, after reading the stored doc (it already reads it for the `__map__` reconcile, or re-read before unlinking), call the existing `pruneOrphanedTokenArt(campaign, storedData, { placedItems: [] })` — the pure diff already refuses anything outside the `images/token-…` naming gate and never fails the operation. No client change needed; `regenerateAdventure` inherits the fix. Add a `maps.token-art-prune.test.js` case for the DELETE leg (upload shape pruned, `ElderPaladin.png`-shaped portrait untouched).

### Severity
Data-integrity risk (hygiene class) — permanent, unbounded orphan accumulation inside shipped campaign data triggered by normal GM gestures (delete map / regenerate adventure); the write-lane pair of the feature that was built to prevent exactly this class. Not data LOSS, but the accumulation is unreclaimable by any in-app lane.

## Resolution
FIXED 2026-11-23 (fix subagent run). The diagnosis held: the map DELETE route unlinked only the map JSON, and the shipped PUT-seam prune derives candidates from the stored document's rows, so once the document is gone nothing could ever reclaim its `images/token-*` uploads. Reproduced live first: uploaded a token in test-campaign, hung it on a sandbox map, deleted the map through the Maps-manager UI dialog — the map JSON left, the PNG stayed.

The fix deviates deliberately from the suggested one-liner. `pruneOrphanedTokenArt(campaign, storedData, { placedItems: [] })` would blind-unlink the deleted doc's token art even when a live SIBLING document still references the same upload — the per-document PUT diff cannot see cross-document references, and the bug file itself later demands "only unlink files no live document names". Instead:

- `server/routes/maps.js` — new `pruneStrandedTokenArt(campaign)`, called by the DELETE route immediately after `fs.unlinkSync(filePath)`. Disk-wide sweep: candidates are the `images/token-*` files on disk matching the shipped `TOKEN_ART_PATTERN` naming gate (nested paths, non-token names and dot-dirs can never qualify); a candidate survives when its relative path appears in ANY remaining live document — every `maps/*.json`, every character file at the campaign root, every `data/*.json` entity doc (raw-text keep test, so NPC/quest rows and any future row shape keep the file; log/change-data text under `data/` can only KEEP files). Fail-closed: an unreadable live document aborts the whole sweep with a `console.error` (an incomplete keep-set never deletes). Unlink errors never fail the delete — same doctrine as the save-seam prune. Bonus: because candidates come from the disk listing, the sweep also reclaims strays orphaned BEFORE the fix (witnessed live: a repro-era orphan was reclaimed by the next map delete).
- Admin → Regenerate needs no separate change: `regenerateAdventure()` step 2 rides `mapsService.deleteMap` → `DELETE /api/campaigns/:c/maps/:slug`, i.e. exactly the fixed route. Rename stays art-untouched (unchanged behavior; art paths live campaign-images-relative and move with the doc).
- `server/routes/maps.token-art-prune.test.js` — shared fs mock gains `readdirSync`; new describe `maps DELETE — stranded token-art sweep` pins 8 faces: last-reference prune; cross-map shared reference survives the first delete and prunes with the sibling; stray (no-namer) reclaim; `ElderPaladin.png` + nested paths survive; a character document naming the path keeps it; unreadable live doc fails the sweep closed with the delete still answering success; EPERM unlink never fails the delete; missing images dir is a no-op.

Verified: repro re-run post-fix on the relaunched pair — UI Maps-manager delete of the sandbox map unlinked BOTH its referenced upload and the pre-fix stray, while the sibling map's live-referenced upload and `ElderPaladin.png` survived; PUT-seam replace-prune on the surviving sibling map still unlinked only the superseded art; API delete lane reclaims too; disk restored to baseline (`images/` = ElderPaladin.png only, md5 `29a508d76c3ec849d08b3b4c7ce84174`; maps dir = the 4 baseline files; change-data `{}`, log `[]`). `npx vitest run server/routes/` → 125 files / 1953 tests passed; `npm run lint` → zero warnings. The Admin Regenerate UI leg itself was NOT ridden live: test-campaign's `/starter-seed` is null (no Regenerate card) and qa-* throwaway creation is refused by the session's single-name CAMPAIGN_LOCK — its only server lane is the DELETE route proved above.
