# App Exploration Map

**POST-WK IMPROVE-TAIL FIX-VERIFY DESCENT — 2026-11-16 run XB (all six post-WK commits live-verified GREEN, zero bug files; full suite 3326 files / 35,671 tests EXIT:0 alongside):**

- **`a8337dbbb` NPC bestiary client-gate (fix-VERIFIED XB):** typing a published-monster name into New NPC DISABLES Save live and renders the server guard copy VERBATIM inline (`"Goblin" is a published monster — monsters join through the Encounter Builder…`), ZERO `/npcs` requests (the WK-era doomed-400 trio face is dead for the typed lane); trim+lowercase matching — `  goblin ` gates, control `Ogroid` (not a monster) enables Save; whitespace-only Save-disable law unchanged; dirtied-form Cancel still native `Discard changes to "Ogroid"?`. Gate fail-opens while `/data/monsters.json` loads (`src/services/npcs/bestiaryNameGuard.js`); server 400 stays the backstop.
- **`2007a3c03` EncounterModal blank-name gate (fix-VERIFIED XB):** name-modal Save and rename-modal Rename now DISABLE while blank/whitespace (`!name.trim()`); the Enter-key lane still pays the inline `Encounter name is required` backstop (modal held); typed name re-enables. Empty-draft Save/Update legs unchanged: inline `.encounter-modal-error` "Encounter has no monsters to save", modal never opens. Backlog: the inline error copy STAYS after you then type a valid name.
- **`c10ab82fd` Load-row icon titles (fix-VERIFIED XB):** all 29 pool rows' Rename/Delete icon buttons carry `title` byte-mirroring the `aria-label` (`Rename "…"` / `Delete "…"`).
- **`7f499c007` AT-clean EB toolbar (fix-VERIFIED XB):** toolbar `Save/Update/Load/Generate/Reset/Join Encounter/Refine with AI` — textContent space-free, aria-label OVERRIDES REMOVED (long copy moved to `title`); `getByRole exact` on the bare words now resolves (WK's icon-leading-space DOM-filter law RETIRED; caveat: toolbar `Save` vs modal `Save` share the name — scope modal clicks).
- **`7def06444` Map activate/deactivate notice (fix-VERIFIED XB):** sandbox `qa-xb-notice` created → row Activate → ephemeral `role=status` notice `Map "QA XB Notice" activated` captured via MutationObserver (auto-hides ~4 s — live-DOM probes miss the window, use an observer), server truth first (`__map__` GET reads the activeMapName BEFORE the notice commits); Deactivate twin `Map "QA XB Notice" deactivated` verbatim; row flips Activate↔Deactivate in lockstep; zero-notice on failure leg by design (persistent `.maps-manager-error` role=status). Map deleted via role=dialog `Yes, Delete Permanently` → ghost 404; 4 owner fixtures byte-exact never activated.
- **`24fff11c1`+`77f7bcdf3` legacy sweep (fix-VERIFIED XB):** `encounters.json` MIGRATED on disk to 29 rows, every row `selectedMonsters`-carrying, ZERO `creatures[]` — `test-encounter` repaired (Goblin×2, effXP 100) and loads a REAL draft (`Selected Monsters (2)`, XP 100, Easy); rows pre-stamped → load pays ZERO effectiveXP-reconcile PUTs, md5 `dce8d33a` byte-stable through the ride (NEW canonical pin, supersedes WK's `2356342b`). `monsters.json` normalized (636 entries): Goblin search→select→Join→board row with REAL stats (HP 7/7, init rolled 12), avatar→`.mc-overlay` full stat block (AC 15, 7 (2d6), Stealth +6, Scimitar/Shortbow dice chips, Allies badge), Clear dialog copy (`clear-combat-confirm-title`, "+NPC placeholder slots kept and re-seeded") → zero-attack banner SILENT re-lived. Test-campaign gained the canonical `data/campaign-meta.json` (sweep artifact, GET /meta honest `{"type":"standard"}`).
- **Mount-merge guard re-verification (XB):** SOLO second-context race (select→Initiative click within ms while roster fetches, seeded 2-row board) is GREEN on BOTH faces — :80 dist bundle AND :5173 dev: deferred-merge hold, additive settle (seeded monster keeps init, roster PCs appended blank), zero eviction. An apparent 13→0 wipe mid-run was a TWO-CONCURRENT-TABS artifact (both tabs' full-store write-behind mirrors racing, §77/§103 stale-tab law), NOT a mount-merge failure — solo the race before judging. Transient cosmetic during the settle window: fresh-tab cards render HP `0/""` inputs pre-bake (documented thin-bucket law §46(c); NOT filed).
- **XB hygiene:** zero fixture characters created/edited (13 md5s = WK exit pins throughout); zero NPC/quest/map/char writes; encounters pool byte-stable (loaded only, drafts Reset); sandbox map created→ridden→DELETED ghost-404; console: only self-inflicted harness selector error + one environmental `ai:models Failed to fetch` during the nohup pair's turn-boundary death; full suite green; campaigns/ = 5 baseline folders; closed-tab two-pass clears GET-verified `{}`/`[]`/overlays `[]`, disk cd/log files absent; dev pair killed at exit.

<details><summary>Prior descents (full text in this file's git log): WK 2026-11-16 (classic-CRUD re-derive: NPCs/Quests/EB save-load/fog/fogged-item/GM-guard matrix all fresh, 0 bugs, clear-label fix-verify), TB 2026-11-16 (RR dismiss/success/ladder + unarmed-chip + visitor-select + singular-victory + qa-arena smoke, 2 bugs — BOTH since fixed & resolved: `b9bae456f` popup copy, `b149b2977` fall-damage row), TA 2026-11-16 (loud-gate/camel-key/testids + Levels 1–4 full re-ride + starter regenerate full success set, 0 bugs), RB/QY/PX/PW/OV/NP/MM/LC/KB/JA/IZ/GZ/FX/EH/DG/CF/BE/AD/ZC/YB/XA + WY..GB-era 2026-11-10..15 (revive/interceptor, death-save, healing, AI authoring, planner CUD, generate-modal, enforcement/travel/weather/3D/sheet/PFEG/long-rest/AoE/aura laws — all fix-verified families).</summary>

- The post-TB improve-tail trio (`ec66cb726` save-attribution, `b149b2977` fall-damage row, `b9bae456f` lethal popup) still carries fix-run-owned self-verify claims in commit bodies, un-re-lived by an explore descent (RR §11 rig can re-live if wanted).

</details>

## Priority Targets (next descent)

1. **Fog depth seeds (open since WK):** closed-DOOR occlusion leg (`computeClosedDoors` via a door placedItem — walls-only was ridden WK), the `hidden-item-ring` amber face (73bb60655, not re-lived since DG era), and visitor-mount does-NOT-stamp-revealed under a fresh GM-less board.
2. **DeathSavePromptModal resolved-id-guard RACE face** (unchanged — deterministic rig unknown; unit-pinned; carried).
3. Sessions/Notes GM-side CRUD presses not re-fired since OP-era via UI (guards lived matrix-wide WK, zero in-lane commits since — rows still stand).
4. Post-TB improve-tail re-ride (optional; see fold note).
5. Concurrent-two-tab combatSummary write-behind discipline: a deterministic two-rider rig could put a boundary on the known full-store last-writer-wins family (§77/§103) — XB's confounded sighting shows how easily it reads as a mount-merge bug.

## Depth Seeds (live 2026-11-16 XB unless noted)

- **EB selectors law RE-DERIVED (XB):** space-free toolbar labels + `title` tooltips (see fold); pool row Load click closes the whole modal chain; loading a real draft flips `Save`→`Update` and renders `Reset` + `Refine with AI`; `Reset` detaches back to create (re-lived). Bestiary checkbox role=checkbox `aria-label="Select <Name>"` (cap law: un-filtered renders first-50 alphabetical — "Goblin" requires the search field, `input.search-input` placeholder "Search by name, type, or subtype…"; fuzzy lane returns Bugbear-family rows for "Goblin" — read the rows before clicking).
- **Maps notice probes (XB):** the activate/deactivate notice is EPHEMERAL ~4 s — capture with a MutationObserver stashed on `window.__notices`, never a follow-up live-DOM query; row-action buttons respond to synthetic `el.click()`; create-form submit = LAST `Create Map` button; new row's aria uses the displayName (`Activate "QA XB Notice"`), the FILE slug is `qa-xb-notice`.
- **NPC/Quest/EB confirm family + form ids:** carried from WK (event-clear — none of the six post-WK commits touched quest lanes or NPC Stats tabs).
- **Monster-card attack lane / visitor select / victory copy / RR fall-rig / allies-FF family / cannotAct / caster testids / throwaway quick-create+typed-delete / starter checklist+regenerate:** carried — event-clear (XB audited `git show --stat` of all six post-WK commits: no lane-file touches outside the verified faces; monsters.json/MonsterCardBody/initiativeService smoke-ridden above).

## Coverage

| Feature/Flow | Depth | Notes |
|---|---|---|
| NPCs CRUD: create gates incl NEW client bestiary-name gate (fix-verified), rename/delete SSE, md5 byte-exact | deep (WK full ride + XB gate face) | `src/components/npcs/`, `src/services/npcs/bestiaryNameGuard.js`, `server/routes/npcs.js` |
| Quests CRUD: gates, dup-name client block, status edit, native confirms, search, md5 round-trip | deep (WK 2026-11-16) — event-clear (zero in-lane commits since) | `src/components/quests/`, `server/routes/quests.js` |
| Encounters save-load: NEW disabled-name gates both modals (fix-verified), AT-clean toolbar, icon titles, migrated pool (29 rows, no `creatures[]`), real-draft load + zero-drift + Reset, legacy empty face RETIRED | deep (WK + XB 2026-11-16 fresh ride post-migration) | `src/components/encounter/`, `useEncounterManagement.js`, encounters CRUD |
| EB join → Initiative → Clear: checkbox→Join auto-nav, REAL stat merge post-sweep (HP 7/7), card modal full block renders, clear dialog copy, zero-attack banner silent | deep (XB 2026-11-16 re-stamp over swept data) | `Initiative.jsx`, `encounterToInitiative.js`, `MonsterCardModal/MonsterCardBody.jsx`, `monsters.json` |
| Mount-merge roster guard: solo 2nd-tab race GREEN on :80 + :5173; concurrent-tab clobber is the write-behind stale-mirror family | deep (XB 2026-11-16 re-verification) | `Initiative.jsx mountMergeMustWaitForRoster`, `initiativeService.js` |
| Maps manager: create, activate/deactivate ephemeral `role=status` notices (fix-verified, observer recipe), Delete dialog + ghost 404 | deep on notice lane (XB); regenerate/generate twins carried VG/TE/SD-era | `src/components/maps-manager/`, `server/routes/maps.js` |
| Planner GM-origin guards matrix | deep (WK 2026-11-16) — event-clear | `server/routes/{npcs,quests,factions,settlements,sessions,notes}.js` |
| Fog of war (indoor): LOS/paint/reset/growth/veil/fogged-item laws deep (WK); door-occlusion + hidden-ring faces OPEN | deep-partial (PT1) | `useFogOfWar.js`, `lineOfSight.js`, `FogOverlay.jsx`, `PlacedItems.jsx` |
| Party Inventory | smoke (WK); deep (NN) — event-clear | `src/components/party-inventory/` |
| Factions/Settlements GM faces | shallow (WK census) | `src/components/factions/`, `settlements/` |
| TV / victory / delegation / allies+FF / travel / RR arc / death-save / heal families / AI lanes / throwaway seeds+checklist+regenerate | carried — event-clear (XB audited all six post-WK commit file-lists; no lane-file touches) | per prior tags |
| Full vitest suite over the swept tree | green (XB 2026-11-16: 3326 files / 35,671 tests, EXIT:0) | — |

## Baseline Fingerprints (canonical test-campaign state at XB exit — verified 2026-11-16)

change-data `{}` + log `[]` + overlays `[]` (closed-tab two-pass headless clears GET-verified; disk cd/log files ABSENT); all 13 char md5s = WK exit pins (never written); ALL data files WK-identical except `encounters.json` = **NEW post-migration pin `dce8d33a`** (29 rows, selectedMonsters-only) plus the NEW canonical `data/campaign-meta.json d8dddd37` (no-legacy-sweep artifact); maps = 4 owner fixtures byte-exact (battle-arena `94fcd0bf`, test-map `8e40779e`, item-showcase `860eda23`, poi-showcase `7561e4bf` — none activated, qa-xb-notice created→ridden→deleted ghost-404); campaigns/ = 5 baseline folders; console honest (self-inflicted/harness only); `git status --porcelain` docs-only; dev pair killed at exit, ports dark.

## Improvement Backlog

<!-- Open items only. e2e-explore appends dated bullets here; e2e-improve consumes and REMOVES them. -->

- 2026-11-16 XB: EncounterModal name modal — after the Enter-key blank backstop prints `Encounter name is required`, the copy STAYS while you then type a valid name (Save re-enables, red error persists — stale feedback). Clear `error` on the input's change lane, mirroring the maps-rename `setError(null)`-on-reopen pattern. `src/components/encounter/EncounterModal.jsx`.
- 2026-11-16 XB: fresh-tab Initiative renders cards with `0/""` HP inputs during the roster-settle window before the additive merge/bake paints real values (cosmetic flash, thin-bucket §46(c) family) — a mount-skeleton or `disabled` settle state on the HP inputs would stop the misleading 0s. `src/components/initiative/`.

## Blocked / Not Verified (fold-gate ledger)

- Fog closed-DOOR occlusion + `hidden-item-ring` amber face — open since WK (PT1).
- DeathSavePromptModal resolved-id-guard RACE face — deterministic rig unknown; unit-pinned (carried).
- EB Update-overwrite NATIVE confirm firm leg + victory PLURAL live face + post-TB improve-tail trio — carried unchanged from WK.
- Two-tab CONCURRENT full-store write-behind boundary (last-writer-wins on `combatSummary`): witnessed once amid overlapping rides, not isolated into a deterministic rig; solo-tab lanes verified safe. Watch-list, not filed (existing §77/§103 law covers the family).
