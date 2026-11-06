# App Exploration Map

**DESCENT RUN CY — 2026-11-05 (post-CX fix batch: PT1 corona picker-route fix 3e3113213 LIVE-VERIFIED 6-face; PT2 CLOSED by code census — aoe overlay lane = second orphan (→ backlog); all 3 post-CX improves PASS live (AI-Dress pre-disable, hex orphan branch deleted, spell-cast wand affordance). ZERO bugs filed, 0 console errors.)**

Live facts (all re-derived THIS run, test-campaign, dev pair `CAMPAIGN_LOCK='test-campaign,qa-arena,qa-starter' node server.js` :80 + `npx vite --host` :5173):

1. **PT1 CLOSED — corona picker-route fix (3e3113213) verified on ALL faces, both adjudication seams.** Rig re-ridden: cy-corona-fix map (EP bearer (2,8) + EF (14,8 = exactly 60 ft) + FR (15,8 = 65 ft) + KB npc token (14,8), tokens BAKED at POST /maps create (201) — no editor round-trip needed; PUT …/maps/:slug/activate), EP bucket sunlight_aura Fire/60, EB Winged Kobold join (14-combatant), `cy-corona-60` sphere overlay (center (15,8) r10 ft) armed on AS Initiative card. Cast 1 (Fire aura): picker pre-checked EXACTLY the 3 overlay tokens (EP excluded); `savePrompt-EvasiveFighter-*` payload `disadvantage:true` + prompt header "EvasiveFighter must make a DEX saving throw. **(Disadvantage)**" + resolved log `mode:"disadvantage"` raws[2,16]→2 FAIL; `savePrompt-FeyRanger-*` `false`, no header suffix, `mode:"normal"` success half-dmg 5; KB inline `mode:"disadvantage"` raws[3,2]→min 2 FAIL dmg 10. Cast 2 (damage-type gate — EP bucket re-stamped **Cold**-only, Fire spell recast): payloads BOTH false, KB inline `mode:"normal"` raws[3,16]→3 — aura honest-inert. Evasion half-on-success rode FR correctly. `normal`-mode `saveRawRolls` may carry 2 entries (both dice logged, one kept) — machine truth = `mode`+`saveRoll`, never dice-count.
2. **PT2 CLOSED (code census) — the `useLoggedDiceRollDamage` → `handleAoeDamage` `'overlay-'` branch has ZERO live UI producers.** Every cast surface funnels save-AoE into `SaveAttackAoeModal` (sheet row AND automation route `saveAttackHandler.buildAoeModal` → `modalName:'saveAttackAoe'`); the two non-modal `contextConfig` producers (`saveAttackHandler.buildSaveAttackRollResult`, `spellCastHandler.buildSpellDamageRoll`) OMIT targetName; monster lane dead at source (`MonsterCardModal.getTarget()` name-lookup can't match `overlay-<id>` → `context.targetName:undefined` → plain-damage); cleave/Turn-Undead/damage_type_choice/superiority lanes carry resolved names. ⇒ `handleAoeDamage` + its corona-sync `mapData` threading + `aoeService.processAoeNpcs/sendAoePlayerSaves` = second orphan lane (companion to CX's hex `character:` orphan, now itself deleted by 5f995d5c6). → backlog.
3. **AI-Dress pre-disable (29e362837) CONFIRMED live.** aiConfig `{value:null}`: list-row "AI Dress" triggers stay ENABLED (by design — the gate is inside the ask modal); docked ask form shows `p.ai-instruction-hint[role=status]` "AI is not enabled for this campaign — configure it in Campaign Admin → AI Referee…" and "Dress map" submit stays disabled even with typed instruction; ZERO dress POST fired, **0 console errors** (CX's by-design-403 noise is retired).
4. **Hex `character:` orphan deleted (5f995d5c6) — clean.** Zero `character:` literals in HexMap.jsx; handleDrop is POI-lane-only (bounds-check, dup-hex guard intact); dead unit pin removed.
5. **Spell-cast affordance (d0e559d7e) CONFIRMED live** on the AS Actions row: `<i class="fa-solid fa-wand-magic-sparkles spell-cast-icon">` + `title="Open spell details to cast"` on spell name cells; picker lane unchanged (Actions row → `.popup-overlay` → Cast Spell → metamagic popup "Cast Without Metamagic" → picker → "Burning Hands (3)").
6. **Arming law re-observed the hard way:** `page.locator('.creature-card').filter({hasText:'<Name>'})` matches EVERY card (target-select `<option>` text counts in has-text) — first mis-arm honestly wrote `{creatures:[{name:'Winged Kobold',targetName:'overlay-…'}]}` via one scoped PATCH `applied:1` (wrong card, faithful write — the PATCH lane is innocent). Re-anchored by `.creature-card` nth + `[class*=name]` exact text; KB reset honestly. Drain z-order: Leading-Evasion chooser stacks ABOVE the save prompt and intercepts its Roll Save click (30s tool timeout bite) — Skip evasion FIRST.
7. **Session health:** 0 console errors, 0 lock denials (grep 0), zero non-2xx. No throwaways created (seeded lanes event-clear CV; quick-create buttons render as **"New Arena Battle"/"New Starter Adventure"** since ae69946f2-era — instruction-text naming drift only). Post-CX commits = 4 app (all verified above) + 2 Cleanups (docs/untracked assets; only src touch = nameUtils.test.js). Dev pair left running; logs /tmp/dnd-api-cy.log, /tmp/dnd-vite-cy.log.

**Freshness for the NEXT run:** CY entered/re-derived: corona picker-route BOTH seams + damage-type gate (fix 3e3113213 verified), SaveAttackAoeModal prompt-queue drain surfaces (evasion stacking order, Results modal close, 2-entries-normal raws nuance), AI-Dress ask-modal no-config face (post-29e362837), spell-row cast affordance DOM (post-d0e559d7e), hex drop handler head (post-5f995d5c6), scoped-PATCH arming law cross-checked (per-creature faithful write). Untouched-and-event-clear (git log re-checked at CY start, Cleanups are docs/assets): throwaway seeded lanes + admin regen pair, allies editor/friendly-fire, TV/victory/delegation, fog-math-walled cases, PlacedItems ghost render, ItemsPanel, hex3dScene labels, NPC-quest-faction CRUD, PowW/save-prompt/cover/OA/wolf+lion measured, LAN combat, deactivated-map advisory (CW/CX-era rows, fixes live-proved). Demote CY rows on commits touching: `SaveAttackAoeModal.jsx coronaAuraUtils.js aoeService.js useLoggedDiceRollDamage.js handleAoeDamage.js saveAttackHandler.js spellCastHandler.js AiDressButton.jsx HexMap.jsx CharActions.jsx createCreatureHandlers.js`.

## Live-Claims Folded History

<details><summary>CX/CW row (2026-11-05; CX's filed corona picker-route bug now FIXED+VERIFIED at 3e3113213 (CY); CW fix faces live-proved at CX) + CQ/CR/CU/CV/CS records (folded, full text in git log of this file)</summary>

**CX** (post-CW improve pair): ghost Rotate hidden + deactivated-map advisory both live-confirmed; PT4 merged-batch cross-tab adoption CLOSED; PT3 hex `character:` drop matrix complete → orphan-lane finding (since deleted 5f995d5c6); PT1 descended → bug-corona-aura-inert-in-aoe-picker-route filed (since resolved); AI-Dress no-config honest (POST-then-403 face, since replaced by pre-disable).

**CW** (post-CV improve batch): all seven post-CV commits live-verified (ghost-item fix, burst-PATCH coalescing 3 faces, map self-heal, PT4 never-hijack, hex3d labels, skeleton row, wizard close); parentHex indoor-arm drop lane CLOSED.

**CS** (post-CR): stale-sheet fix 3-face PASS; scoped-PATCH arming PASS; PT1 corona 60 ft bug filed → fixed 13dd98cc4. **CQ**: f1deeb510/f07304b66/efa2d311a/da76fc38d PASS; corona-on-attack-roll filed (fixed+verified); PT2 OA denied-on-sticky CLOSED. **CR**: corona attack-lane twins, map-deactivate 6-face, friendly-fire, id-normalize, 400-copy all PASS; stale-sheet ghost-write filed (fixed b1ca01152). **CU**: cross-client HP adopt CLOSED; two-tab PATCH races clean. **CV**: full sprite lanes (2D/3D/LAN), throwaway seeded lanes deep (quick-create, wizard gate, ×11 checklist, FULL regen ride, typed-name deletes), ghost-item bug filed (fixed af07dd67e).

</details>

## Priority Targets (next descent)

1. **DivineSparkModal sync face** — still the one genuinely un-provisioned rig: needs a sanctioned JSON-PUT feature row (channel_divinity automation on War_Cleric + RESTORE discipline); harnesses the corona measurement via async lane (handlePlayerSaveDamage-family :164). Fixture grep "divine spark" = 0 confirmed at CX.
2. **AI-Dress LIVE invention face** — still owed a model rig (no-config face now verified honest twice, pre-disable face CY).
3. **Orphan-lane disposition** (backlog 2026-11-05 CY): if `handleAoeDamage` overlay lane gets deleted or wired, re-derive the aoeService corona-sync claim (CX live-proved the SYNC util healthy; the caller chain is the orphan).
4. Deferred low-value list unchanged (3D per-mesh, hex-travel-3D, indoor wand-drag, Lion "another Barbarian" exemption).

## Depth Seeds (live 2026-11-05 CY unless noted)

- **Overlay-arm rig:** `POST /spell-overlay?campaign=<c> {action:'add',overlays:[{id,shape:'sphere',startGridX,startGridY,radiusFt,color,label}]}` (QUERY campaign param mandatory); every Initiative card select then lists `overlay-<id>`; `action:'clear'` sweeps. **Map-with-tokens one-shot:** `POST /maps {name,type:'indoor',players:[{id,name,gridX,gridY}],placedItems:[{id,type:'npc',name,gridX,gridY}]}` → 201 tokens PERSIST (real-character names only, §338 prune law); activate `PUT /api/campaigns/:c/maps/:slug/activate`.
- **Corona geometry:** FEET_PER_CELL 5 — bearer (2,8)→victim (14,8) = exactly 60 ft (inside), (15,8) = 65 ft (outside). Buff stamp (ONE-POST): `{activeBuffs:[{effect:'sunlight_aura',distance:60,enemiesDisadvantageSaves:['Fire'],sourceName:…}]}`; `coronaOfLightEnemies` key absent/empty = everyone.
- **PC save-AoE cast pipeline (post-d0e559d7e):** Actions spell cell now renders `i.spell-cast-icon` (wand) + title "Open spell details to cast" — row selector `.attacks .left.clickable` with name text unchanged; popup → `Cast Spell` → `Cast Without Metamagic` → picker `.sp-overlay` (overlay pre-checks EXACT tokens) → `"Burning Hands (3)"`.
- **Prompt queue drain (z-order):** dismiss `.sp-overlay--evasion` Skip BEFORE clicking Roll Save (its full-viewport .sp-modal intercepts); sequence evasion→Roll→Next→Done→Results Close; picker stays mounted with live confirm until Results closes (double-cast hazard window — see backlog).
- **Card anchoring:** NEVER `.creature-card` + hasText/name-contains (option text matches every card). PCs: nth-index in cs order + `[class*=name]` exact, or `.creature-card:has(input[aria-label="<Name> current HP"])`. Scoped-PATCH arming is per-creature faithful (`{value:{creatures:[{name,targetName}]}}`, reply `{applied,skipped}`).
- **Prompt machine truth:** `savePrompt-<Target>-<ts>` change-data keys, payload `disadvantage/saveDc/saveType/sourceName`; resolution `roll/save-damage` rows with `mode` + `saveRawRolls` (2 entries possible even in normal) + `saveResult`.
- **Context menu / deactivated-map advisory / ItemContextMenu faces:** unchanged (no touching commits) — CW/CX-era seeds.
- **Two-tab PT rig / maps API bodies / allies+regen rigs:** unchanged (no touching commits) — CV/CW-era seeds + playbook §162-171.

## Coverage

| Feature/Flow | Depth | Notes |
|---|---|---|
| Corona family (picker route BOTH seams + prompt payload + inline mode + damage-type gate + range 60/65) | **deep (CY — fix 3e3113213 VERIFIED, family fully green live)** | `SaveAttackAoeModal.jsx coronaAuraUtils.js aoeService.js` — picker-route orphan-of-fix-lineage CLOSED |
| Save-AoE prompt queue UX (header (Disadvantage), evasion stack, Results close, Evasion halves) | **deep (CY)** | `SavePromptModal.jsx LeadingEvasion UI in sp-overlay family` |
| handleAoeDamage overlay branch reachability | **deep (CY — code census: NO live producer, orphan)** | `useLoggedDiceRollDamage.js handleAoeDamage.js saveAttackHandler.js spellCastHandler.js MonsterCardModal.jsx getTarget` → backlog |
| AI-Dress no-config face (pre-disable pair: role=status notice + disabled submit, zero POST) | **deep (CY)** | `maps-manager/AiDressButton.jsx` — 29e362837 VERIFIED; live-invention face still **blocked** (no model rig) |
| Hex drop handler (POI lane post-orphan-delete; bounds + dup guards) | **deep (CY head-read)** | `hex-map/HexMap.jsx` — 5f995d5c6 VERIFIED |
| Spell-row cast affordance (wand icon + title) | deep (CY) | `char-sheet/CharActions.jsx` — d0e559d7e VERIFIED |
| EB join → 14-combatant board → overlay-target arming (scoped PATCH faithful per-creature) | deep (CY re-ride) | `Initiative.jsx createCreatureHandlers.js storage.js` |
| Overlay transport (/spell-overlay add/clear, shape validator) + map create-with-tokens API lane | deep (CY re-ride) | `server/routes/spell-overlay.js server/routes/maps.js` |
| Ghost-type context menu + deleted-map 404s | carried — event-clear (git log: no touching commits since 32e02248c, live-proved CX) | `map/ItemContextMenu.jsx PlacedItems.jsx` |
| Map activate/deactivate matrix incl. player-open ADVISORY | carried — event-clear (fix 878939872 live-proved CX) | `App.jsx MapToolbar.jsx MapDeactivatedHint` |
| Coalesced-burst cross-tab adoption + same-tab coalescing | carried — event-clear (merged shape live-proved CX twice) | `storage.js campaigns-changedata.js` |
| Admin regen a11y pair + regen cascade + typed-name delete + quick-create flavors + wizard gate | carried — event-clear (CV same-day; CY git-log re-check) | `CampaignAdmin.jsx RegenerateAdventureModal FirstSessionChecklist CampaignSelection.jsx` — labels: New Arena Battle/New Starter Adventure |
| Throwaway seeded lanes (arena/starter) | carried — event-clear (CV; CY re-check) | `CampaignSelection.jsx campaigns-starter-seed.js campaigns-arena*` |
| TV / victory / delegation / allies editor / friendly-fire | carried — event-clear (CQ/CR/CV rows) | `initiative/` |
| Hex 3D diorama labels; ItemsPanel arms; fog-math; NPC/quest/faction CRUD; PowW/save-prompt/cover/OA/wolf+lion; LAN combat; inventory/music/rules-tray | carried — event-clear at CQ/CR/CV/CW/CX | rows as dated |

## Baseline Fingerprints (canonical test-campaign state at CY exit — verified 2026-11-05)

- change-data `{}` + log `[]` — browser tab closed FIRST (quiet), closed-API two-pass, no rehydration surfaced either pass.
- maps [Battle Arena(false, md5 94fcd0bf VERIFIED), Item Showcase(false), POI Showcase(false), Test Map(false)]; cy-corona-fix DELETED (GET 404 honest); spell-overlay store cleared; KB board wiped with cs bucket.
- npcs [Marta Copperkettle]; 13 char files byte-untouched (`git status --porcelain public/campaigns/` EMPTY); campaigns/ = 5 baseline folders, no throwaways.
- Lock grep = 0 lines; console 0 errors/0 warnings; 0 non-2xx network.
- Bug files this run: 0 (PT1 fix verified; no new breakage found).

## Improvement Backlog

<!-- Open items only. e2e-explore appends dated bullets here; e2e-improve consumes and REMOVES them. -->

- **[2026-11-05 CY] picker-confirm-live-while-prompts-stack:** after confirming "Burning Hands (N)" the picker `.sp-overlay` stays mounted with its confirm button live until the Results modal closes, while save-prompt + Leading-Evasion overlays stack above it; my first drain loop burned a 30s tool timeout clicking an intercepted button beneath the evasion chooser. Suggest: disable/unmount the picker confirm at dispatch (results modal already summarizes) so stacked-overlay geometry can't strand clicks and no double-cast path exists. Non-blocking UX.

## Blocked / Deepen Targets (fold-gate ledger)

- CLOSED at CY 2026-11-05: PT1 corona picker-route fix verification (6 faces, both casts); PT2 handleAoeDamage producer census (answer: none — orphan → backlog); AI-Dress no-config pre-disable face; hex orphan-branch deletion; spell-cast affordance.
- CLOSED earlier: CW backlog pair, PT3 hex drop matrix, PT4 coalescing cross-tab, CU PT2/PT3, stale-sheet fix, corona range+attack lanes, allies re-entry, regen ride, quick-create flavors, map activate matrix.
- OPEN: DivineSparkModal face (JSON-PUT feature rig — last un-provisioned aura seam); AI-Dress LIVE invention face (model rig); llama.cpp-style refusing backend for jsonSchema:true (infra, unchanged).
- NOT VERIFIED this run (honest scope): monster damage-chip-with-overlay-arm live behavior (code census says plain-damage untargeted; not clicked live); throwaway seeded lanes not re-entered (event-clear CV); 3D faces untouched (deferred list).
- DEFERRED (low value): 3D per-mesh geometry; hex travel-in-3D; indoor overlay wand-drag; Lion "another Barbarian with this option" exemption.
