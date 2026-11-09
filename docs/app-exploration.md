# App Exploration Map

**DESCENT RUN FX — 2026-11-09 (post-FW fix/improve batch 4dc24883b..d564c3b0e; ALL THREE shipped items fix-verified live + the two FW-owed never-ridden faces CLOSED + PT2 repeat-save-across-seam CLOSED + PT3 join-rollback CLOSED on first successful attempt — ZERO new bugs).**

Fix-verify results (all PASS, live, this run):

1. **4dc24883b (ST×economy seam) — full matrix closed in ONE session:** pre-seam spent-holder DENIES honestly (control); holder→twin seam RE-ARMS the holder (actionsUsed 1→0 AND movement 30→0 from a REAL drag charge, hasMoved false) with zero synthetic turnState keys and zero synthetic char buckets; post-seam holder attack under twin-active ROLLS with the whole chain honest (rider chooser → rider STR prompt → stage-2 → `damage` row + `hp_change −29` crit math exact — dice double, flat doesn't); re-arm ≠ bypass (post-seam second press honestly denies, 2nd `enforcement_denied` row, roll count frozen); twin→X seam CLOSES the holder (turnActive:false, spent face kept) and opens next fresh; **Prev→twin rewind (markRewoundTurnActive, never ridden before FW)** re-opens the HOLDER key without refund, zero synthetic keys (hoisted expireStaleEffects guard holds); **echo-lane half under a genuine second client** — LAN-origin (`isolatedContext:'lan'`, :5173) tab mounted on Initiative through two twin walks: zero `*Second Turn*` keys materialized, visitor wrote ZERO POSTs, console 0 errors.
2. **f08d5c3e2 (mount-merge pointer fidelity):** curl-seeded `combatSummary.activeCreatureName:'ElderPaladin'` BEFORE campaign-select → fresh mount highlights ElderPaladin (seeded pointer beats the fallback chain; FW's "mount wipes + localStorage wins" law is DEAD — corrected in the playbook) and the mount write-back PRESERVES the pointer server-side (GET mirror still ElderPaladin, 14 rows, twin survived per 7e5ffc2b9).
3. **243cddea6 (board-order walk parity):** full-store cs POST in scrambled array order [AS, twin, EP, EF] onto the settled tab → card row re-renders the WALKER's DESC order [EF, twin, EP, AS] at adoption (FW's DOM-vs-walker divergence CLOSED; replacement-eviction law held 14→4).
4. **PT2 repeat-save across the ST seam:** te `{target:EF, source:QaFixture, effect:poisoned, repeatSave:{CON,15}}` + EF activeConditions + warding_bond −19 dial → prompt fires EXACTLY ONCE at the holder seam ("save-repeat", c:QaFixture, honest "rolled 4 + −13 = −9 — remains under poisoned", te+cond byte-kept) and ZERO at the twin outgoing seam and the EP seam; producer has no round latch (fires every genuine turn-end seam) so once-per-round == seam-skip-honesty — no full-wrap walk needed.
5. **PT3 join-write-failure rollback (blocked 3 prior runs — CLOSED):** method-gated `page.route` abort of POST `/combatSummary` during EB Join → `storage.set` false → strict throw at encounterToInitiative.js:329 BEFORE any log write → error toast `Failed to join encounter` (2.5s auto-hide) → board byte-identical, zero new log rows, 3/3 deterministic.
6. **movementBudget (never ridden app-wide before FX):** ON + twin-active → dragging the EF token (sandbox map fx-move, created→dragged→deactivated→DELETED) charges `movementUsedFeet:10` then clamp-total 30 on the HOLDER key, `hasMoved:true`, zero phantoms; over-budget drag CLAMPS silently at the budget edge (token stops short; snap toast NOT observed on the clamp leg).

Live facts (FX, dev pair `npm run dev` :80 + :5173 CAMPAIGN_LOCK='test-campaign,qa-arena,qa-starter', test-campaign header-verified; start state clean `{}`/`[]`/`[]`):

7. **Session health:** GM console zero app errors (all error entries were my own route-abort rigs); visitor consoles 0/0; overlays never placed ([]); maps back to the 4 owner fixtures, battle-arena md5 94fcd0bf untouched; 13 char files canonical, EF md5 0df29ff3 byte-exact (NO fixture surgery this run); campaigns/ = 5 baseline folders, no throwaways created (seeded lanes event-clear: campaign-starter/selection untouched by this batch — git re-checked); exit: browsers closed → API two-pass clears GET-verified `{}`/`[]` with NO rehydration (turnState incl. EP entry, enforcement blob, boards, te row, warding_bond dial, EF/EP buckets, 27-row log churn all evicted); servers KILLED.
8. **Quick-create labels re-witnessed:** `New Arena Battle` / `New Starter Adventure` on campaign selection.
9. **Sheet-attack drain doctrine (sharpened, playbook §255):** a popup-only drain loop misdiagnosed HIT→zero-damage TWICE before the real cause surfaced — the 2024 Battle Master auto-offers a post-hit maneuver chooser (`.sp-overlay`, no pre-hit arming, not even after admin clear) that parks the damage stage. The app was honest end-to-end; the harness violated §85.

## Live-Claims Folded History

<details><summary>FW-era + earlier records (full text in git log of this file)</summary>

**FW** (11-09): ST×turn-economy seam ride — FILED the economy-starvation + phantom-turnState bug (fixed 4dc24883b, FX-verified closed above); its facts #2/#3 (mount wipes pointer / DOM-vs-walker two orders) were the two improves' inputs, both fixed + FX-verified; 3f2acaa9f + 219985867 improve re-rides PASSed. **FV** (11-09): ST click-lane fix cycle — 4 shipped fixes fix-verified; 3 bugs filed same day all shipped. **FU** (11-09): c5883e4a4/dc5ecd25d/fc1592ef6/451974602 fix-verifies; ST-board curl-seed twin law; overlay manipulate boundary-grab trap; EB join churn; the 2 ST phantom-bucket bugs. **FT** (11-09): ST remount survival + full WALK face; EffectAdder PT2 tabs; EB whole-series renumber; TV secondTurn up-next. **ER** (11-09): overlay chip labels + per-chip remove + cross-tab adoption; EffectAdder conditions APPLY; Thief's-Reflexes grant + mount-eviction bug. **EQ** (11-08): away-initiative guard, Clear honesty, victory-banner architecture, delegation double-apply + split×join CLOSED. **EP**: split-party presence 12-face. **EO**: turn-start double-fire fix-verify, floater-on-delegated-roll, LAN fog parity. **EN**: TV zoom/floaters/bloodied/up-next first rides, delegation/LAN first rides, allies+friendly-fire cycles. **EM**: rider-log honesty, music trio. **EL**: attribution, custom-items, AI-refine. **DJ**: overlay-suppression, Obscure clock, KO repeat, first AI Designer cycle. **DI–CQ**: crit ledger, sneak cycle, boons, aura trio, modal family, throwaway seeded lanes, fog first rides, CRUD eras. **EK**: TV tracker/delegation/music/identity/victory-banner first rides.

</details>

## Priority Targets (next descent)

1. **Second-turn × repeat-save round-2 face (cheap remaining half of PT2):** the once-per-round claim rode round 1 (10-click wrap skipped because the producer has no latch — every genuine holder turn-end seam prompts). Next run can ride the round-wrap seam re-prompt with the small board + fresh campaign to close the wrap-walk face honestly (also re-witnesses `rearmReactions` at the wrap).
2. **Repeat-save on a NON-holder twin-adjacent victim:** te on EP while holder/twin/EP walk — confirm the victim's own turn-end seam prompts normally (twin rows must never prompt AS the victim: an ST-active Prev/Next over a te-bearing victim must not double or synthetic-name the audit).
3. **movementBudget partial-charge + opportunity-attack legs:** the §8.4 `onTokenMoveLanded` OA trigger with enforcement.opportunityAttacks ON has never been ridden app-wide (movement legs now closed); also the snap-back toast leg vs clamp-drop leg discriminator.
4. **TV up-next × ST seam after 243cddea6:** board-order sorting now runs at adoption — verify the TV strip ordering matches (it reads displayCreatures, should be free, but the seam is fresh).
5. Deferred unchanged: 3D per-mesh; hex-travel-3D; indoor wand-drag; Lion exemption; YT audibility.

## Depth Seeds (live 2026-11-09 FX unless noted)

- **Economy/ST matrix recipe:** see playbook "Economy-on ST matrix" bullet (FX-updated) — full-face list with exact POST bodies order.
- **Rider-aware drain:** loop polling `.sp-overlay` FIRST (act on `[...sp][-1]`, button regex `^(Cancel|Skip|Done|Dismiss|Roll Save)`), THEN `[data-testid="popup-overlay"]` Done-by-text, until both queries empty.
- **Movement ride:** `POST /maps {name,type:'indoor',gridSize:20,players:[{id,name:'EvasiveFighter',gridX,gridY}]}` keeps tokens (FX); activate → Maps-manager Open → `getScreenCTM` px → trusted mouse.down/steps/up; charge lands immediately (GET turnState within ~2s); EF speed 30 ft.
- **Join rollback rig:** method-gated route abort (playbook §202 FX text); toast `Failed to join encounter` dies at 2500 ms.
- **No-surgery ST twin (carried FV, held through FX):** curl-seed cs full-store with `{name:'<H> (Second Turn)', secondTurn:true, holderName:'<H>'}`; survives reload + re-select + mount merge.
- **dc-gate DOM fact (carried, dad80f67b):** blank-DC badges are inert `span.creature-badge`; deterministic save-success = §7 warding_bond ±19 dial with a real DC.

## Coverage

| Feature/Flow | Depth | Notes |
|---|---|---|
| Turn-state economy seam vs ST rows (re-arm/close/rewind faces, phantom eviction, companion stamp) | **deep (FX 2026-11-09 — 4dc24883b fix-verified FULL matrix live: pre-seam deny, seam re-arm incl. real-movement zero, post-seam roll w/ honest damage chain, re-arm≠bypass, twin→X close, Prev→twin rewind, zero phantoms all legs)** | `initiative/navigationHandlers.js applyTurnStateTransition/economyNameFor/markRewoundTurnActive`, `combat/turnState.js`, `combat/chargeEconomy.js` |
| movementBudget token-drag lane (charge/clamp/holder-keying under twin-active) | **deep (FX — first app-wide ride: 10 ft charge, 30 ft clamp-total, silent clamp-drop face, seam zeroing from a REAL charge; OA trigger leg still owed)** | `map/hooks/usePlayerDragging.js finalizePlayerMove`, `combat/movementBudget.js`, `combat/chargeEconomy.js chargeMovement` |
| SSE echo-lane ST guard under a second client (visitor twin echo ≠ phantom bucket) | **deep (FX — LAN tab mounted through 2 twin walks, zero phantoms, zero visitor POSTs, clean console)** | `initiative/sseHandlers.js applyEchoBoundaryPasses` |
| Repeat-save across the ST seam (holder-seam prompt, twin-seam skip, save-repeat ledger) | **deep (FX PT2 CLOSED: once-at-holder-seam + zero-at-twin/EP-seam, fail keeps te+cond byte, honest −13 breakdown copy; round-2 wrap face deferred)** | `initiative/navigationHandlers.js applyOutgoingTurnEndPasses`, `rules/features/repeatSaveService.js` |
| EB Join (aria-exact, series renumber, controller carry, auto-navigate, WRITE-FAILURE ROLLBACK) | **deep (FX: PT3 CLOSED — abort-POST rig → strict throw pre-log → error toast → board byte-identical, 3/3)** | `encounter/EncounterBuilder.jsx`, `services/encounters/encounterToInitiative.js:327-329` |
| Initiative mount/unmount board law (pointer fidelity + survivor/evict legs) | **deep (FX re-rode post-f08d5c3e2: seeded pointer adopted fresh mount, mirror keeps pointer, twin survives, 13-PC append intact)** | `initiative/Initiative.jsx:730-744`, `initiativeService.mergeCombatSummaryWithCharacters` |
| Board-order walk parity (adoption sorts to walker order) | **deep (FX 243cddea6 fix-verified: scrambled POST → DOM renders DESC walk order; replacement-eviction held)** | `initiative/sseHandlers.js handleCombatSummaryChange`, `combat/creaturePresence.js sortCreaturesForBoard` |
| Enforcement gates (turnLock/economy) vs ST rows | deep (FV/FW-era faces + FX re-rides: control deny + post-seam roll + re-arm≠bypass deny) | `combat/canTakeAction.js`, `combat/assertCanAct.js readActiveCreature` |
| ST-row lane authority matrix (add / × / click / allies / conc / delegation) | carried — event-clear (batch 4dc24883b..d564c3b0e touches navigationHandlers/sseHandlers/Initiative.jsx/initiativeService ONLY; FX git re-check) | see playbook ST bullet |
| TV presentation | carried — event-clear (FV-era law; Tv* files untouched by the batch) | `initiative/useTvPresentation.js` |
| Spell-overlay indoor lane | carried — event-clear (FV/ER-era; zero map/overlay files in the batch — FX git re-check; overlays [] at both ends) | `map/SpellOverlayRenderer.jsx`, `useSpellHandlers.js` |
| Conditions badge click lane · EffectAdder tabs · victory banner · split-party · delegation · allies/friendly-fire · fog parity · music lanes · AI lanes · wizard · custom items · CRUD eras | deep (EQ/EP/EO/EN/EK–FV eras; none of those lanes' producers touched by the verified batch) | see folded history + playbook |
| Spell-overlay write authority | ratified OWNER 2026-11-08 (AGENTS.md matrix); FX exit clear GET [] | `server/routes/spell-overlay.js` |
| Throwaway seeded lanes (quick-create/checklist/regen/typed-delete) | carried — event-clear (campaign-starter/selection git log empty since 2026-11-05; FX re-check of this batch = initiative/economy only; quick-create labels re-witnessed FX: `New Arena Battle`/`New Starter Adventure`) | `campaign-starter/`, `campaign-selection/` |
| NPC-quest-faction CRUD · sprite-art tokens · hex-travel | CRUD carried deep (CK–CV eras, event-clear); sprite/hex not explored (DEFERRED) | `settlements/`, Blender-era lanes |

## Baseline Fingerprints (canonical test-campaign state at FX exit — verified 2026-11-09)

- change-data `{}` + log `[]` + overlays `[]` — closed-browser API clears GET-verified twice, no rehydration (enforcement blob, turnState incl. EF+EP entries, seeded boards, activeCreatureName key, repeat-save te row, EF activeConditions+warding_bond dial, EP runtime bucket (224→195 churn), lastAttack + 9 attack/2 damage/2 hp_change/2 denial/3 save_result churn all evicted).
- maps = 4 owner fixtures (sandbox fx-move created/activated/dragged/deactivated/DELETED, GET-verified absent), battle-arena md5 94fcd0bfe9e4cf6e1118f736b920e7a2 untouched; 13 char files canonical, EvasiveFighter md5 0df29ff3 byte-exact (NO fixture surgery this run); campaigns/ = 5 baseline folders, no throwaways; servers KILLED; `git status --porcelain` at exit = docs only, zero bug files (zero new bugs filed).

## Improvement Backlog

<!-- Open items only. e2e-explore appends dated bullets here; e2e-improve consumes and REMOVES them. -->

- **(FX 2026-11-09)** movementBudget over-budget token drags CLAMP SILENTLY: the ghost/token stops at the budget edge and lands there with no toast and no remaining-budget readout (the `showSnapToast("<name> snapped back to N ft")` lane exists but wasn't reached on the clamp-drop leg) — the GM can't tell an absorbed 40-ft drag from a 20-ft move without opening devtools and reading turnState. Suggest: fire the snap notice whenever `clampMovementDrop` reduced the requested distance. Files: `src/components/map/hooks/usePlayerDragging.js` (clamp leg + finalizePlayerMove), `services/combat/movementBudget.js`.
- **(FX 2026-11-09)** the Level-5 economy has no GM-visible budget face: denial popups ("No action left this turn.") name the bucket but nothing on the initiative card shows actionsUsed/bonus/movementUsedFeet or lets the GM refund a mis-charge (`refundSlot` seam exists at the modal-cancel/referee layer, UI grep-zero consumer). A compact per-card economy chip (3 pips + movement meter, enforcement-ON only) would make the whole L5 feature inspectable mid-fight. Files: `initiative/CreatureCard.jsx`, `combat/turnState.js` (read-only projection), enforcement-gated render like the HP-inline inputs.

## Blocked / Not Verified (fold-gate ledger)

- NOT VERIFIED this run (honest scope): round-wrap re-prompt face of the repeat-save (once-per-round proven structurally via seam-skip + producer no-latch census, the 10-click wrap walk deliberately skipped — the mount-merge re-adds 10 PCs making wraps expensive; playbook recipe unchanged); movement OA trigger leg (`onTokenMoveLanded`, never ridden app-wide); TV up-next ordering under the new adoption sort; snap-back-toast vs clamp-drop discriminator leg (the toast never fired on any observed leg).
- DEFERRED (low value, unchanged): 3D per-mesh geometry; hex travel-in-3D; indoor overlay wand-drag vs grid-cell collision; Lion "another Barbarian" exemption; YT audibility (headless).
- OWNER QUESTION (inherited from ER, unchanged): GM applying conditions to AWAY creatures stays visible+audited by design.
