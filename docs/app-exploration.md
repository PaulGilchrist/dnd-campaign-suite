# App Exploration Map

**DESCENT RUN JV — 2026-11-11 (post-JU same-day 4-commit improve batch all LIVE-VERIFIED + travel-honesty triple + POI-enter & MarchingOrderPanel first live rides; 3 NEW BUGS.** JV live results:

1. **Improve batch (13:56–14:22, on top of ed391aba7) 4/4 PASS:**
   - `54dd865db` active-map split-brain: naturally rolled 'Wolves on the Hunt' accept (hazard→npc→combat reroll chain at Normal+Rain) → `__map__`={activeMapName:'Travel Encounter Stage'} AND maps-list active flag AND the Maps-manager chip (only the stage row carries `maps-manager-active-badge`) all move together; `event_accept` row battleMap-labelled; reroll rows name the PRE-reroll event honestly; stage doc = 13-player fan-out + 4 wolves as `placedItems` `type:'npc'` (never initiative — autoEncounters off).
   - `bcbb8f231` forced-march copy: exhausted-banner FM press → status row "Forced March · 1 / 6 stacks · Daily budget: 83%" (hourglass icon, `.travel-exhaustion-budget`), lastMessage "…Daily budget reduced to 83%.", ZERO "Speed:" strings panel-wide; budget math coherent 1 = floor(2×5/6) (slow base 2); `forced_march` row 1; +1 EX 12/13 PCs (self-restoration holder honestly exempt). Retired helper grep-zero: only `applyExhaustionSpeedPenaltyToBudget` exists, no per-hex twin.
   - `c2aa54f0a` panel-chrome toast (MutationObserver three-face count law): pace-chip click silent (button guard) · header-title chrome click → `.travel-toast` "Select a destination hex on the map" byte-exact · 34 px header drag → latch suppresses toast (panel moved left:808 top:695).
   - `93a12b67e` 3D travel counts: mounted HexMap3D, 4-pt route → {travelPath:1, travelPathSegments:3, travelPathTravelled:0}; foreign `travel-pathIndex` POST 2 → travelled adopts LIVE (same `__hexmap3d` handle, `sameHandle:true` — patch lane, no remount); clamp idx5 → travelled 3 (arrival branch `travelled===segments` real); cleared-path face honest 0/0 PRESENT (`'travelPathSegments' in census` true).
2. **Travel-honesty — 3 bugs filed** (details in files): weather `visibility` (Fog 1/Mist 2/Storm 3/Extreme 0) has ZERO consumers repo-wide — fog→clear differential live = cosmetic overlay + description row ONLY (POI 8 hex away opacity "1" both states; 4-hex destination plans under visibility:1) — `bug-weather-visibility-advertised-never-enforced.md`; `TRAVEL_PACES` `encounterMod`/`perception`/`stealthAdvantage` dead fields while pace chip tooltips advertise them (roll = freq+terrain+weather only) — `bug-travel-pace-odds-fields-inert.md`; panel prints raw "12% chance per hex" while the live roll was 22% (rain +10) — `bug-event-chance-label-ignores-mods.md`.
3. **PT3 POI indoor-enter lane CLOSED (first live ride):** gate = validLinkedMaps mount-probe AND `hexDistance(party,poi)===1` (doc-PUT partyPosition adjacent arms the chip); native mouse click at `rect.placed-hit-area` bbox centre → indoor handoff (view + mapHistory push; `__map__` untouched by design); DELETE target under mounted board → SSE retires the chip BEFORE any harness click can race, so the `refusal:'missing'` leg is live-unreachable (unit spec pins it); poisoned `loadMaps` → named toast "Could not verify linked map \"jv-dungeon\" — try again." + `enter_refused` row `{refusal:'unreachable', linkedMap, hex, terrain, weather}` + link AND chip kept (transient-blip law) ✓.
4. **PT4/PT5 CLOSED + extras:** MarchingOrderPanel first ride — no isLocalhost gate; default order = all 13 chars (sidebar order) when the doc lacks `marchingOrder`; toolbar badge counts; swap/remove/add-append all work, badge live-updates; order autosaves to the MAP DOC (whole-doc field, ~2 s) GET-verified. "Back to maps" pops map HISTORY when the stack is non-empty (jv-dungeon→jv-travel) — label lies (backlog). Scene-capture URL verbatim (IE owed leg): 3D avatar texture resolves `http://<host>/campaigns/test-campaign/images/ElderPaladin.png` (campaign-relative, matches 2D marching img src) via fiber hook-chain crawl. Horseback = cost/time-only (`HORSEBACK_SPEED_MULTIPLIER`, never enters `shouldTriggerEvent`) — the PT4 odds question honestly closed by census.
5. **Indoor echo observation (backlog lead):** whole-doc `players[]` PUT onto the settled OPEN indoor board did NOT live-adopt tokens (2D text probe + 3D census players:0) until a remount via Maps-manager Open (→2, avatars 1); hex boards adopt per-field via `useHexMapSSESync` — re-verify the indoor face before treating as a bug.
6. **Session health:** dev pair :80+:5173 `CAMPAIGN_LOCK='test-campaign,qa-arena,qa-starter'` (launch via `background:true` — the §2 `nohup &` recipe DIED within ~1 min this harness, corrected in place); header-verified test-campaign; zero lock denials; console 1 error = own poison fetch; no throwaways created (seeded/TV/allies/delegation lanes not entered); exit: jv-travel + jv-dungeon + travel-encounter-stage DEACTIVATED→DELETED (ghost GETs 404 honest; honest 409s deactivating never-active maps), maps = 4 owner fixtures ALL inactive (`activeMap` None×4), `__map__` null, closed-tab two-pass API clears GET-verified `{}`+`[]`+`[]` zero rehydrations, battle-arena md5 94fcd0bf byte-exact, campaigns/ = 5 baseline folders, npcs.json Marta-only, 13 char files untouched (porcelain empty), servers KILLED by PID, ports free.

## Live-Claims Folded History

<details><summary>JT/IF/IE/HD/GC/GB-era + earlier records (full text in git log of this file)</summary>

**JU** (11-11, superseded where re-ridden above): cross-client replay fix-verify; arrival-toast/census-weather/tool-parity/create-stamp improves; PT2 event legs first ride (dialog DOM, reroll family, skip-resume, accept×4, weatherChange budget re-derive); PT3 day-state legs (mirror-flag vs press-reject, camp ×9, FM faces, max-EX gate, pace chips, horseback); PT4 3D tube no behind/ahead split (v2 reserved), 2D-only console. **JT** (11-11): travel advance/arrival full ride; weather adoption census; LR purge legs; filed the replay bug. **IF** (11-11): charm-grant fix 3/3; save-prompt testid; census avatars/textured; 3D inline imageUrl; hidden-vs-fogged ring; SSE severity; popup-family law; aria-exact Open law; Maps-manager aria-labels; player-avatar permanent fixture. **IE** (11-11): sheet-open-rebake ×3; PFEG faces; long-rest faces; census handles first rides; 3D gestures; 2D fog mount-stamp; AoE-picker law. **HD** (11-10): write_rejected + OA-chip fix-verifies; indoor overlay collision; Map3D per-mesh; Lion faces; PFEG multi-condition; short-rest seam. **GC** (11-10): visitor DELETE atomicity, Lion exemption, turnlock zero-cost, §82 ledger, pendingOAs visitor-press, rider clock. **GB** (11-10): pendingOAs producer-drop, summon board-refresh, GM-move advisory, clamp toasts. **GA/FZ/FY/FX–ER**: movementBudget, OA matrixes, ST×economy, EffectAdder tabs, EB renumber, overlay chips, away-gating, victory-banner, delegation double-apply, split-party. **EP–CV**: presence, floaters, TV zoom/bloodied, allies+friendly-fire cycles, rider-log honesty, music trio, attribution, custom items, AI lanes, identity gate, DS/VT/boon/stroke/corona, CRUD eras, throwaway seeded lanes.

</details>

## Priority Targets (next descent)

1. **Fix-verifies owed:** the 3 JV bug files once fixes land (weather-visibility de-advertise-or-implement; pace odds fields; `effectiveEventChance` shared display/roll pin — expect an improve that unifies TravelPanel copy with `randomEventService`).
2. **Indoor map-data echo adoption** (players PUT → open indoor board stale-until-remount observation) — re-derive live, GM+LAN differential, decide bug vs playbook-law.
3. **Enforcement-ON auto-encounter leg** of combat-event accept (carried blocked row — `autoStartEncounterFromEvent` never armed).
4. **LAN cross-client marching order / weather face** — GM-side deep; visitor adoption so far structural-only.
5. Natural-RNG weatherChange dialog — still skip unless free (synthetically ridden JU).

## Depth Seeds (live 2026-11-11 JV unless noted)

- **POI-enter rig law:** outdoor doc needs `pois[{…,linkedMap}]` + party at `hexDistance===1`; mount probe (or mapsListVersion bump) arms `validLinkedMaps`; chip = `.poi-item-enterable rect.placed-hit-area` — click via NATIVE mouse at its `getBoundingClientRect()` centre (Playwright force-click on the `Enter` `<text>` silently absorbs — scroll-into-view moves the SVG after bbox math); enter pushes map HISTORY ("Back to maps" pops jv-dungeon→jv-travel first); `__map__` never moves. Poison lane for `unreachable`: fetch wrapper matching path `endsWith('/campaigns/<c>/maps')` (loadMaps has NO query string) returning 500 `{error}`. Deleting the target retires the chip via SSE first — the `missing` refuse click-face is harness-unreachable live.
- **Census travel law:** route pts+1 → segments pts−1; travelled = pathIndex CLAMPED [0,segments]; cleared path = 0/0 PRESENT; after switching to 3D, ASYNC build — poll the census VALUES (waitForFunction on expected count), not on handle existence (avatars/tokens land after texture/scene build).
- **Marching-order law:** default = full 13-char roster; persists to map doc `marchingOrder` (~2 s dirty-autosave); badge `.hex-map-poi-indicator` (shared class with POI indicator); add-appends-to-end; panel has NO isLocalhost gate (matches the visitor all-tab outdoor PUT lane).
- **Fast event farm:** `.event-btn-reroll` chain (3/day, camp resets) re-rolls the pending event in ~1 s per press — hazard→npc→combat in 2 presses beat 'frequent'-chip advance-hunting for accept-face rides.
- **FM face law:** FM button renders ONLY inside the exhausted banner; slow pace + rain exhausted after 2 advances (accrued 1.9/2 display); clicking a NEW destination clears `travel-dayExhausted` (re-plan resets the mirror).
- **Carried seeds (event-clear, unchanged):** travel console laws (playbook §18), cross-client LAN tab recipe, census handles recipe, popup-family, PFEG rig, long-rest, AoE-picker, sheet-switch eviction.

## Coverage

| Feature/Flow | Depth | Notes |
|---|---|---|
| Travel console (plan→walk→arrival, cross-client adoption, chrome-toast 3 faces, FM budget copy, pace/mount, exhausted banner) | **deep (JU ride + JV improve re-verify 2026-11-11)** | `hooks/management/useTravelManagement.js`, `hex-map/TravelPanel.jsx`, `TravelToast.jsx`, `services/campaign/travelService.js` |
| Travel event-interrupt (reroll farm ×3-face, hazard/npc/combat accept, paused seam, rows honest) | deep (JU ride + JV re-ride 2026-11-11) | `hex-map/EventDialog.jsx`, `HexMap.jsx`, `randomEventService.js` |
| Travel day-state (mirror-flag, camp family, FM stacks, max-EX gate) | deep (JU; JV re-observed exhausted banner + FM stack 1) | `hex-map/TravelPanel.jsx`, `useTravelManagement.js` |
| Weather/pace/event-odds MECHANICS honesty | **deep (JV first census + live differentials — 3 bugs filed)** | `services/campaign/weatherService.js`, `randomEventService.js`, `TravelPanel.jsx` |
| Combat-event staging + activate lane (`54dd865db` verified: `__map__`/activeMaps/chip together, battleMap row, 13-fan + 4 npc placedItems) | deep (JU ride + JV fix-verify 2026-11-11) | `services/encounters/encounterStagingService.js`, `server/routes/maps.js` |
| POI indoor-enter lane (adjacency gate, happy handoff + history, unreachable row+toast, SSE chip-retire) | **deep (JV first live ride 2026-11-11; 'missing' click-face unit-pinned only)** | `hex-map/POILayer.jsx`, `HexMap.jsx` handlePoiEnter, `POILayer.enter-click.test.js`, `HexMap.poi-enter-stale-link.test.jsx` |
| MarchingOrderPanel (default roster, reorder, remove/add, badge, doc autosave) | **deep (JV first live ride; LAN cross-client face structural-only)** | `hex-map/MarchingOrderPanel.jsx`, `hooks/useMapLoader.js`, `hooks/useHexMapSSESync.js` |
| 3D hex census + patch lanes (travel counts incl. clamp + 0/0 cleared + same-handle adoption) | deep (JU + JV `93a12b67e` verify 2026-11-11) | `hex-map/HexMap3D/hex3dScene.js` |
| 3D scene-capture URL values (avatar texture resolves verbatim campaign-relative) | **deep (JV closed the IE-owed leg)** | `map/Map3D/map3dScene.js`, `Map3D.jsx` |
| Outdoor create stamp + doc PUT echo + activate/deactivate + role=dialog delete | deep (JU + JV re-verify — duplicate POST honestly 400) | `server/routes/maps.js` |
| Indoor map-data echo adoption (players PUT face) | shallow (JV observed stale-until-remount — re-verify, PT2) | `components/map/Map.jsx` + hooks |
| Map create/delete, indoor overlay lanes, Lion measured, write_rejected, short-rest faces | carried — event-clear (HD-era) | playbook + HD history |
| Charm-grant + save-prompt testid + popup-family + aria-exact Open + hidden-ring + SSE severity + 3D gestures + fog/wall LAN differential | carried — event-clear (IF/IE 11-11, JU git re-check) | playbook §§81/132 |
| Roll-ledger §82, pendingOAs, enforcement, away gating, ST lanes, delegation/LAN, TV/banner/allies/ff throwaway lanes | carried — event-clear (not entered; JU git re-check same-day grey) | playbook §§84-93/119-120/430 |

## Baseline Fingerprints (canonical test-campaign state at JV exit — verified 2026-11-11)

change-data `{}` + log `[]` + overlays `[]` (closed-tab two-pass API clears GET-verified, zero rehydrations; all travel-* keys incl. started-by/pace/EX buckets, __map__ activate cycles, 12×exhaustionLevel 1 buckets, poison-rig residues swept); maps = 4 owner fixtures ALL inactive (jv-travel + jv-dungeon + travel-encounter-stage DEACTIVATED→DELETED, ghost GETs 404 honest); battle-arena md5 94fcd0bf byte-exact; npcs.json Marta Copperkettle only; 13 char files byte-canonical (ZERO fixture surgery this run — EP keeps the IF+ image grant md5 6e4341e4 + image 29a508d7); campaigns/ = 5 baseline folders, no throwaways; disk change-data/log files deleted (missing ≡ baseline); servers KILLED by PID, ports :80/:5173 free; zero lock denials; `git status --porcelain public/campaigns/` empty; console 1 error = own deliberate poison-fetch probe.

## Improvement Backlog

<!-- Open items only. e2e-explore appends dated bullets here; e2e-improve consumes and REMOVES them. -->

- (2026-11-11 JV) Open/ settled INDOOR board does not live-adopt a whole-doc `players[]` PUT (tokens appear only after remount) while hex boards adopt per-field via `useHexMapSSESync` — if confirmed by the PT2 re-verify, extend the indoor echo lane to adopt token fields (removes the remount dance from every token rig). `src/components/map/Map.jsx` + its SSE sync hook.
- (2026-11-11 JV) MarchingOrderPanel `+ <name>` always APPENDS to the tail — building an ordered roster then inserting one 2nd-in-line costs N "Move up" presses; suggest an insert-into-slot affordance (or a "move to top" shortcut) on the add button. `src/components/hex-map/MarchingOrderPanel.jsx`.

## Blocked / Not Verified (fold-gate ledger)

- POI `enter_refused refusal:'missing'` CLICK face — the delete-SSE retires the Enter chip before any harness click can race the live-list re-check; the self-heal branch is unit-pinned (`HexMap.poi-enter-stale-link.test.jsx`). Everything else about the lane re-derived live.
- Enforcement-ON auto-encounter leg of combat-event accept (carried — enforcement never armed; off-face proven zero-writes).
- LAN visitor cross-client face for MarchingOrderPanel/weather overlay (GM tab only this run; adoption structural via the field-merge echo law + JU same-handle proof on hexes).
- Natural-RNG weatherChange dialog (carried — synthetically ridden JU).
- Camp-while-PAUSED leg (carried — structurally hard to co-instantiate).
- Indoor players-PUT stale-until-remount: single observation, NOT concluded (could be timing/subscribed-only-while-active) — PT2 for the next run.
