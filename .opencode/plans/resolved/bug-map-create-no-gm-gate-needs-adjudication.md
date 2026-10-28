# POST /api/campaigns/:campaign/maps (map create) is the only map mutation with no refuseUnlessGm — but the hex travel-encounter spawn lane may be a legitimate player-tab caller: needs owner adjudication, then gate or document

## Summary
In `server/routes/maps.js` every map **mutation** sibling carries the GM host gate — PUT whole-map save (:301, `if (!isOutdoor && !refuseUnlessGm…)`), DELETE (:329), rename (:357), activate (:413), description (:444) — but `POST /api/campaigns/:campaign/maps` (:236, create) starts with no `refuseUnlessGm`. A network client can therefore create arbitrary map files (and `fs.mkdirSync` the maps dir) in any campaign, unlocked. **However, unlike the other authority-gap bugs, this one may be intentional:** the hex-map travel-encounter spawn lane calls the same route from whichever client resolves a travel event — `HexMap.jsx` renders for all clients (`isLocalhost = false` default, :72), `handleStartEncounter` → `useEncounterGeneration`/`encounterStagingService.stageEventEncounterMap` → `mapsService.createMap` → `POST /:campaign/maps` (mapsService.js :35-38), and its header comment (:30-35) states maps are "written through the existing server-first map lanes (mapsService POST/PUT)" for player-accepted events. If travel can be resolved from a player tab, a naive gate breaks encounter spawning; if travel is GM-only in practice, the route is a pure gap. **Adjudicate first (Paul): is the travel/hex-event resolution lane reachable from non-localhost clients in the intended game flow?**

## Steps to reproduce
1. Unlocked instance (`PORT=8081 node server.js`; never touch the :80/:5173 dev:locked stack): `curl -s --max-time 5 -X GET http://localhost:8081/api/server-config` → `campaignLocked:false`.
2. LAN-host create probe **in test-campaign** (cleanup after): `curl -s --max-time 5 -X POST -H 'Content-Type: application/json' -d '{"name":"zz Gate Probe"}' http://<LAN-IP>:8081/api/campaigns/test-campaign/maps` → **200** with the created map — route BODY executed for a network client while every sibling mutation would have answered 403. (Under dev:locked on :80 this same request also passes CAMPAIGN_LOCK — source param == `test-campaign` — so nothing gates it anywhere.)
3. Control on the same socket: non-localhost `DELETE …/test-campaign/maps/zz-gate-probe.json` (after step 2) → **403** — proving the gate machinery exists in this file and is absent only from POST.
4. Clean up the probe map via localhost DELETE.
5. Adjudication probe (read-only): with two tabs on :5173 test-campaign, determine whether a non-localhost URL (e.g. `http://<LAN-IP>:5173`, player view) can reach a travel state where a hex event resolution fires `handleStartEncounter` (the POST maps call). If the player tab ever issues it, a bare `refuseUnlessGm` would break that flow — record the finding either way.

## Expected behavior
One of (owner decides):
- **(a) GM-only create:** first line of the POST handler is `if (!refuseUnlessGm(req, res)) return;` mirroring :329 byte-for-byte, AND the travel-spawn lane is verified GM-only (or moves to a server-side/localhost-only resolution); or
- **(b) legitimate player writes:** the deliberate exception is documented at the route head (a comment like the PUT save's nuanced players-clobber note, :293-299) and narrowed if possible (e.g. only spawn-slugs under `<parent> - <Event> @ q,r` naming pass for non-localhost, arbitrary names stay GM-only).

## Actual behavior
Today it is neither: an undocumented, unfiltered, un-gated create for every client, sitting as the lone outlier among five gated mutations. Worst case (if (a) is the truth): any LAN device litters production campaigns with arbitrary map files and can win the auto-activate race (`activateMapIfNoneActive`) so players get redirected onto an attacker-named map. If (b) is the truth, the current code is still wrong-by-documentation: the naming-collision `400 A map with this name already exists` is the only "validation", and a player-tab bug becomes indistinguishable from an attack.

## Likely location
Confident (verified in current snapshot 2026-10-28):
- `server/routes/maps.js:236-…` — `POST /api/campaigns/:campaign/maps` handler head; gate machinery in-file: `isLocalhost` :47, `refuseUnlessGm` :49, consumers :301/:329/:357/:413/:444.
- Client callers of the route: `src/services/maps/mapsService.js:35` (`createMap`, used by GM map UI **and** by `encounterStagingService.js` + `useEncounterGeneration.js` via `HexMap.jsx:165/361-363/587`).
- Related history: `bug-player-clients-clobber-fog-reset` (resolved) established the PUT save's split authority (outdoor saves are player-reachable, hence the `!isOutdoor &&` clause) — precedent that map lanes DO have legitimate non-localhost writers; that is why this ticket needs adjudication, not a reflex gate.

## Suggested fix
After the owner answer:
- (a): one-line `refuseUnlessGm` at handler head + supertest pair mirroring `campaigns-admin-crud-localhost-guard.test.js` conventions (existing map-route test files show the local pattern) — non-localhost → 403 + zero files created; localhost → unchanged. Then live-verify hex encounter spawn still creates its map from the GM tab (localhost) and — if travel is ever player-resolvable — relocate the spawn write behind a server-side lane.
- (b): add the intentional-exception comment + narrow the non-GM path to the spawn naming scheme (`buildEncounterMapDisplayName` slug family) with a 403 for everything else, and pin both branches with tests.

## Severity
**Minor security / authority-model ambiguity** — non-destructive write (map create + dir mkdir) exposed to LAN clients; escalation limited (no delete/rename reach, name-collision 400). Downgrades to documentation-only if adjudicated intentional — but leaving it undocumented keeps GM-model enforcement unauditable.

## Resolution
**FIXED 2026-10-28 — option (a): `refuseUnlessGm` added at the `POST /api/campaigns/:campaign/maps` handler head.**

**What was wrong:** create was the lone map mutation without the GM host gate — five siblings (PUT whole-map save, DELETE, rename, activate, description) all enforced `refuseUnlessGm`, but POST executed its body for any client: a LAN-origin create returned **201 + wrote the map file** (reproduced live on the throwaway unlocked instance: POST `{"name":"zz Gate Probe"}` → 201, `zz-gate-probe.json` on disk; sibling DELETE on the same socket → 403), littering campaigns with arbitrary map files and winning the `activateMapIfNoneActive` race.

**Adjudication recorded (Paul):** "Only the GM can start travel mode, but players can enter and leave the outdoor map as long as the GM has it active" — travel/hex-event resolution is GM-driven; the player lane is read-only viewing.

**Why (a) and not the narrowed (b) — evidence, both live and code:**
1. **Live two-tab probe (:5173, GM tab localhost + player tab LAN-IP, both mounting the active hex map, zero reloads):** server-armed `travel-pendingEvent` opened the event dialog on BOTH tabs; clicking **Accept on the GM tab** fired the spawn `POST /maps {"name":"Travel Encounter Stage",…}` from the GM tab only — the player tab's dialog **auto-closed via the SSE clear (bug-travel-event-dialog-stale-cross-tab fix) with ZERO `/maps` POSTs** across the whole session (fetch-spy on the player tab). The intended flow never fires the spawn write from a player tab.
2. **The player-tab spawn was never a functional lane anyway:** every spawn route (`encounterStagingService.stageEventEncounterMap`, `useEncounterGeneration.handleStartEncounter`) ends in an **indoor full-document PUT** (`mapsService.saveMapData`), and that route already refuses non-localhost at :301 (`!isOutdoor && refuseUnlessGm`) — proven live: LAN PUT of an indoor doc → **403, file byte-unchanged**. An un-gated POST from a preempting player tab could therefore only ever create an orphan EMPTY file the authoring PUT would never fill. (b)-style slug-narrowing would have kept open exactly that garbage-write hole for zero functional benefit.
3. **Player viewing is served entirely by GET lanes** (live: LAN GET /maps → 200; player tab mounts `div.hex-map` with zero POSTs) — untouched by the gate, honoring the adjudication's players-enter-and-leave clause.

**Files changed:**
- `server/routes/maps.js` — gate call mirrored byte-for-byte from DELETE (~:329 → now :248): `if (!refuseUnlessGm(req, res)) return;` at the POST handler head (before body validation and the `mkdirSync`), plus a comment recording the adjudication + evidence.
- `server/routes/maps-create-localhost-guard.test.js` (NEW) — 6 cases: foreign-Host arbitrary create → 403 + zero files written; foreign-Host **spawn-family name** ("Travel Encounter Stage") → also 403 (pins the no-narrowed-exception decision); gate runs before validation (blank name from LAN → 403 not 400); localhost indoor create → 201 + doc + broadcast bytes unchanged; localhost staging-name create → 201; blank/duplicate validation lanes unchanged.

**Verification:**
- New test file green; `server/routes` folder green (71 files / 1248 tests); `npm run lint` zero warnings; `no-timers-guard` OK.
- Live post-fix on restarted :80 (lock re-proven `campaignLocked:true`) + fresh throwaway :8081: LAN POST arbitrary name → **403** + zero files; LAN POST spawn-family name → **403**; LAN POST vs locked :80 → 403; LAN GET → 200; localhost control POST → 201. Server log shows `[maps] BLOCKED non-localhost POST …`, zero campaign-lock denials.
- **Critical adjacent sanity — GM spawn flow end-to-end through the gate:** QA outdoor hex map created + activated (localhost), two tabs mounted, combat event armed, **GM-tab Accept** → staging lane POSTed `Travel Encounter Stage` **201** from localhost, stage doc persisted (27 placedItems + 12 players), board auto-landed in the staging editor, player-tab dialog auto-closed again with zero POSTs. No regression.
- Cleanup verified: QA maps deleted (maps back to [Battle Arena, Test Map]), change-data `{}` + log `[]` GET-verified from closed-tab quiet, throwaway killed, `git status public/campaigns` clean.
