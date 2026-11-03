# App Exploration Map

**DESCENT RUN CM — 2026-11-03 (post-CL improve/fix batch descent: the four post-CL commits re-derived LIVE and all PASS — monster-lane rage-aura fix (31cc31b9a, CL Priority Target 1 CLOSED via 5-face live matrix), ghost-API 404 guard (90e0b0d08), hidden-input aria-label (d23e1135c), EB fan-out log row (91456ce0b). ONE new bug: GM map-Activate without Open leaves the GM tab's own roller lanes gridless — measured range + aura gating silently skipped until Open/re-select.)**

Event-check: commits since CL = 31cc31b9a + c675dbe18 (docs) + 90e0b0d08 + d23e1135c + 91456ce0b + 4e0348c69 (docs) + fb0df28b9 (fold). Every file they touched re-derived live this run. Map rows for untouched areas (spell-overlay, victory/TV, delegation, LAN maps, fog, hex3D, inventory, AI lanes, factions/quests/settlement CRUD in test-campaign, POWW producer matrix, Reach labels, save-prompt lifecycle, starter-copy seams) stay event-valid — git log empty for their paths since their dated verification; tree clean at entry.

## CM live facts (all re-derived THIS run, test-campaign + qa-arena throwaway, :5173 dev `CAMPAIGN_LOCK='test-campaign,qa-arena,qa-starter'`)

1. **Monster-lane Lion fix (31cc31b9a) — PASS 5/5 live matrix** (CL Priority Target 1 CLOSED). Rig: bucket POST `ElderPaladin {value:{activeConditions:[],activeBuffs:[Rage, PowW-Lion(optionName:'Lion',range:'5 ft')]}}` BEFORE campaign-select (no swap needed); bearer token PUT into battle-arena `players[]`@(2,8) (map census = players[]; EP must be in it when mapData present); Goblin EB-joined (fresh board → cs name **unsuffixed 'Goblin'**, avatar alt 'Goblin'); own-card `[data-testid="target-select"]` arm; scimitar `+4` chip. Faces: (a) **tokenless** on positioned map → `mode:"disadvantage"` d20 min-popup + `lion_aura_disadvantage` row — CL's exact bug face flipped ✓; (b) **placed (1,8) adjacent, map OPEN** → measured disadvantage + row #4 ✓; (c) **placed (5,8) 15 ft away, map OPEN** → `mode:"normal"`, no row ✓ (range gate measures); (d) **adjacent but target = bearer** → normal, real HIT 22 vs AC19, no row ✓ (self-target exclusion on monster lane); (e) **control, Rage-without-Lion stamp** → normal, row count frozen ✓ (disadvantage tracks the stamp). Machine truth = log `roll/attack` `mode` + `automation/lion_aura_disadvantage` rows; roll logs land ~3ms after the aura row (await ordering preserved).
2. **NEW BUG — GM Activate-without-Open gridless lane:** clicking `Activate "Battle Arena"` writes server `__map__` (verified `{activeMapName:'battle-arena'}`) + auto-opens player tabs, but the GM tab's App `activeMapName` STATE (App.jsx:435) stays null — set only by Open (onOpenMap/handleEnterMap) or select-time `loadActiveMapAndOpen`; `handleMapActivateEvent` early-returns for localhost; MapsManager `handleActivate` (:192) POSTs with no App callback. Consequence measured live: same board, same positions — activate-only face rolled `mode:"disadvantage"` + aura row at 15 ft (skipRangeCheck via mapData-null) and a 25-ft scimitar was NOT auto-missed; after Open the identical state rolled normal + honest `AUTO-MISS (25 ft > 8 ft)`. Silent, zero console. → `bug-gm-activate-without-open-gridless-roller-lane.md`. (My F-A/F-B "passes" pre-Open rode the lenient lane; F-B was re-proven measured post-Open — face (b) above.)
3. **Ghost-API 404 guard (90e0b0d08) — PASS all faces:** created+exercised fresh `qa-arena` (typed name in quick-create modal; default shown `Arena-20261103`), closed tab, `DELETE /api/campaigns/qa-arena` 200 → every campaign-scoped GET (meta/change-data/maps/encounters/log) AND HEAD → **404 `{"error":"Campaign not found"}`**; folder gone, zero re-materialization after 14s, selection row gone via list-SSE; `campaign-lock` grep of server log = 0 denials. CL fact-8 ghost defaults are dead.
4. **Hidden-input aria-label (d23e1135c) — PASS both faces:** campaign-selection DOM has ZERO inputs (first-probe false-negative class closed); app-shell first `input` = `input[type=file]` aria-label `Import campaign JSON`, hidden by design.
5. **EB fan-out row (91456ce0b) — PASS live:** Goblin join wrote exactly ONE `{type:'automation', automationType:'party_joined_initiative', characterName:'Party'}` "Party joined initiative (13 members) — the saved PC party is seeded onto the tracker with the encounter." counting the 13 saved PCs on the accepted 14-creature board.
6. **Arena throwaway seed lane re-derived:** `ARENA BATTLE` badge in header; campaign-only views (quests/factions/settlements/…) hidden from sidebar per modal promise; seeded maps `The Colosseum Pit` + `The Sparring Hall` (latter auto-ACTIVE); 3 saved `Sparring — *` encounters (draft:false); `meta.type:"arena"`; zero-character wizard auto-opened → Cancel required. Button labels are **New Arena Battle / New Starter Adventure** (not "…Campaign").
7. **UX/quirk findings:** seed quick-create buttons remain clickable while a sibling seed modal is open — stacked `.modal-overlay` then intercepts ALL clicks until Cancel (my misclick hit "New **Start**er Adventure" because of a Create|Start regex; two recovery passes). MISS popups carry a Done button (Done dismisses; backdrop dismiss flaky as ever). After re-select, `combat-ui-viewingMonster` residue AUTO-REOPENS the monster card — avatar click intercepts until you work with the open card. Console census: 0 errors / 0 warnings all session; only network anomaly = the expected `/subscribe` ERR_ABORTED across reloads.

**Freshness for the NEXT run:** CM entered/re-derived: MonsterCardModal rage-aura seam (5 faces) + lionAuraUtils measured lane + App.jsx activate/aria lanes + MapsManager activate/manager DOM + encounterToInitiative fan-out + read-guard 404s + arena quick-create/seed/badge/view-hiding + typed-delete-free curl DELETE. Commits touching `MonsterCardModal.jsx|lionAuraUtils.js|App.jsx(activeMapName/handleMapActivateEvent)|MapsManager.jsx|encounterToInitiative.js|server read-guard middleware|seededCampaign.js(arena)` after 2026-11-03 demote these rows. Untouched-and-event-clear: spell-overlay, victory/TV, delegation, LAN, fog, hex3D, inventory, music, rules tray, NPC/quest/faction-settlement CRUD, AI lanes, OA popup lanes, PowW producer matrix, save-prompt lifecycle, Reach labels, starter-copy seams, maps drop-clamp/label/first-click.

## Priority Targets (next descent)

1. **GM-activate-without-Open fix-verification** (new bug this run) — acceptance: after Activate (no Open), a >8-ft monster melee chip auto-misses and the Lion face measures (no spurious row at 15 ft); player-tab auto-open behavior unchanged; check the delete-active-map face clears state too.
2. **OA popup × wolf axis cross-check** (carried CJ→CK→CL→CM, budget-owed) — popup + aura mode agree for both lanes on one NPC-token rig.
3. **jsonSchema:true refusing backend** — STILL owed (infra, unchanged since AQ).
4. Deferred low-value (unchanged): 3D per-mesh geometry, hex travel-in-3D patch rigs, indoor-overlay wand-drag face, Lion "another Barbarian with this option" exemption (unbuilt+unpinned).

## Depth Seeds (live 2026-11-03 CM unless noted)

- **Monster-lane aura matrix rig (CM):** stamp bucket BEFORE select (no swap needed when testing consumers); when the modal has mapData the census is map `players[]` — include the bearer token there; tokenless modal-lane (mapData null OR unplaced attacker) = skipRangeCheck lenient (disadv fires regardless of distance — to test MEASUREMENT you must Open the map (Activate alone = null state, see bug) and PUT the attacker token into placedItems by its exact cs name; card close/reopen refreshes modal mapData; selectOption arming survives card reopen within session; MISS popups need Done-click, an un-dismissed popup absorbs the next chip click (log stays stale — always diff log entry count, not just popup text); post-re-select the card auto-reopens (combat-ui-viewingMonster) — audit before avatar-clicking.
- **Fan-out row truth (CM):** one `party_joined_initiative` row per acked join; N counts saved-PC matches ON the accepted board (13 here), not delta.
- **Ghost-404 recipe (CM):** close tab → `DELETE /api/campaigns/<throwaway>` → per-route GET + HEAD must 404 `Campaign not found`; verify folder absence twice (t+0, t+14s); selection row disappears live.
- **Arena lane (CM):** `.new-campaign-button--seeded` buttons; modal = `.modal-overlay` with default-name text input + exact `Create` button; badge copy `ARENA BATTLE`; view-hiding check = sidebar lacks Quests/Factions/Settlements.
- **Carried seeds (CL, event-clear):** Lion bucket-stamp sheet-roller rig, per-card target-select census, drop-clamp face, typed-delete choreography, quick-create rigs, OA popup three-lane rig, victory/TV/EB/checklist state-gates.

## Coverage

| Feature/Flow | Depth | Notes |
|---|---|---|
| Monster-card attack lane × Lion rage aura (tokenless lenient, measured adjacent, far-range exempt, bearer-target exclusion, no-stamp control) | deep (CM: 5-face live matrix, machine-log modes, aura-row timing) — **31cc31b9a VERIFIED, CL target CLOSED** | `MonsterCardModal.jsx resolveMonsterLionAura/foldAuraDisadvantage lionAuraUtils.js` — fix rows #1-4 |
| Map context adoption on GM tab (Activate vs Open vs re-select) | deep (CM NEW: same-board differential proves silent gridless lane both directions) — **bug filed** | `App.jsx:243/435/438/577/781 MapsManager.jsx:192 handleMapActivateEvent` — **bug-gm-activate-without-open-gridless-roller-lane.md** |
| EB join: goblin join, PC fan-out (13), own-card arm, scimitar chip, fan-out disclosure row | deep (CM: 91456ce0b live + unsuffixed-fresh-board name face) | `encounterToInitiative.js logPartyFanOut` — improve VERIFIED |
| Deleted-campaign ghost APIs (GET×5 + HEAD 404, no re-materialize, selection row evict) | deep (CM fresh qa-arena: all faces post-delete) — **90e0b0d08 VERIFIED, CL backlog closed** | `server/ read-guard middleware campaigns-admin` |
| Hidden import input aria-label + zero-input selection screen | deep (CM both DOM faces) — **d23e1135c VERIFIED** | `App.jsx input` |
| Arena quick-create seed lane (badge, view-hiding, 2 halls, 3 encounters, meta, wizard auto-open) | deep (CM fresh qa-arena, created+deleted) | `seededCampaign.js CampaignSelection quick-create` |
| Lion aura PC-roller 4-face matrix + Maps drop-clamp/label/first-click + starter copy seams + Admin typed-delete | deep (CL) — event-clear (untouched by CM-scope commits) | rows as dated by CL: ef05ac8d5/415c7eacd/d924a8f71/2c8d7a8ad/d14b519e6/1defc5406/9ffd4421b VERIFIED |
| Spell-overlay / victory / TV / delegation / LAN / fog / hex3D / inventory / music / rules tray / NPC-quest-faction-settlement CRUD / AI lanes / OA popup / PowW producer / save-prompt lifecycle | carried — event-clear at CM | rows as dated by CI/BH/BG/CK |

## Baseline Fingerprints (canonical test-campaign state at CM exit — verified 2026-11-03)

- change-data `{}` + log `[]` — GET-verified 14s+ after closing the tab (two-pass, API-lane clears, no dialogs).
- maps [Battle Arena, Test Map] battle-arena md5 **94fcd0bfe9e4cf6e1118f736b920e7a2** byte-identical to dist (PUT-copy restore; EP/EF/goblin rig positions gone; placedItems back to []).
- campaigns/ = 5 baseline folders (qa-arena created, exercised, DELETED via API — zero re-materialization; qa-starter not needed this run).
- npcs [Marta Copperkettle]; ZERO character-file writes (git porcelain on public/campaigns empty); 13 char files untouched.
- Env at exit: dev pair RUNNING (`CAMPAIGN_LOCK='test-campaign,qa-arena,qa-starter'` node server.js :80 + vite :5173; logs /tmp/dnd-api-cm.log, /tmp/dnd-vite-cm.log) — kill trio before next run. Browser tabs CLOSED.
- Bug files this run: 1 (GM-activate gridless). CL's monster-lane bug RESOLVED + live re-verified dead here (5 faces).

## Improvement Backlog

<!-- Open items only. e2e-explore appends dated bullets here; e2e-improve consumes and REMOVES them (DONE/BLOCKED/skipped are recorded in the run summary, never left as markers). FAILED bullets stay open. -->

- (2026-11-03 CM) Multi-source disadvantage attribution: when the Lion aura AND a range-band disadvantage both apply, the HIT/MISS popup chip shows only ONE reason ("Disadv (Target out of melee range (25 ft > 8 ft))") and silently drops the aura reason — the per-press `lion_aura_disadvantage` log row is the only surface telling the GM why. Consider stacking reason chips or joining reasons in the label. Likely `MonsterCardModal.jsx` popup builder / `AttackResultPopup.jsx`.
- (2026-11-03 CM) `lion_aura_disadvantage` log copy asserts "within 5 feet of raging <bearer>" even on the tokenless/`skipRangeCheck` lenient face where proximity was never measured (MonsterCardModal `logLionAuraApplied` static template). Honest variant: "proximity unmeasured (no token) — GM-enforced" tail, mirroring house-law advisory phrasing.
- (2026-11-03 CM) Seed quick-create buttons (`New Arena Battle` / `New Starter Adventure`) stay clickable while a sibling seed modal is open; the stacked `.modal-overlay` then intercepts every click until Cancel (recovery cost two tool passes). Disable the other seeded buttons while one modal is up, or replace the overlay instead of stacking. `CampaignSelection` + modal component.

## Blocked / Deepen Targets (fold-gate ledger)

- CLOSED this run: CL Priority Target 1 (monster-lane aura fix, 5-face live matrix PASS); the three post-CL improve-commit faces (ghost-404, aria-label, fan-out row) all re-derived live PASS; qa-arena throwaway lane walked + deleted clean.
- OPEN (new): GM-activate gridless fix-verification (Priority Target 1 next run).
- OPEN (carried ×4): OA popup × wolf axis cross-check — budget-owed, needs NPC-token rig.
- OPEN (infra, unchanged): llama.cpp-style refusing backend for jsonSchema:true.
- DEFERRED (low value): 3D per-mesh geometry; hex travel-in-3D patch rigs; indoor overlay wand-drag face; Lion "another Barbarian with this option" exemption; qa-starter lane intentionally not re-created (event-clear at CL).
