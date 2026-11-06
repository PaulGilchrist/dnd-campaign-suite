# App Exploration Map

**DESCENT RUN CZ — 2026-11-05 (PT1 CLOSED: DivineSparkModal sync face fully ridden live — the "owed JSON-PUT feature rig" premise was WRONG: the Divine Spark row is AUTO-DERIVED from `public/data/2024/classes.json` Cleric lv2 for any 2024 Cleric ≥lv2, zero fixture edits needed. 7 faces driven on War_Cleric (corona async-lane measurement 60 ft TRUE / 65 ft FALSE / damage-type gate FALSE / zero-charge popup / 30 ft range-refusal / heal lane / self-target defect). 2 BUGS FILED: dismiss-softlock + no-target self-harm.)**

Live facts (all re-derived THIS run, test-campaign, dev pair `CAMPAIGN_LOCK='test-campaign,qa-arena,qa-starter' node server.js` :80 + `npx vite --host` :5173):

1. **PT1 CLOSED — DivineSparkModal harm lane measures the corona aura.** The harm branch awaits `getCoronaSaveDisadvantage` (DivineSparkModal.jsx:164) and threads `disadvantage` into the `createSaveListener` prompt payload. Faces (bearer ElderPaladin `sunlight_aura` Radiant/60, victim EvasiveFighter): bearer at EXACTLY 60 ft → prompt header "…must make a CON saving throw. **(Disadvantage)**" + roll `d20 (4, 20)` keep-low + result view; bearer re-tokened to 65 ft → header clean, single `d20 (1)`; **damage-type gate**: Necrotic cast at 60 ft with a Radiant-only aura → header clean (honest-inert). Failed save dealt full damage via `applyDamageToTarget` (save_result + `hp_change` + `roll/save-damage` rows, finalDamage==rawDamage 6 then 11; EF runtime `currentHitPoints` 30→24→13, cs placeholder stale at 30 = PC runtime-is-truth, not a bug). Prompt machine truth for THIS lane = bucket `campaign.pendingSavePrompts` + SSE (no per-target `savePrompt-<T>-<ts>` keys — those are the SaveAttackAoeModal lane; the two prompt channels coexist).
2. **BUG (filed, reproduced live, code root confirmed): `bug-divine-spark-dismiss-softlocks-modal.md`.** Dismissing the UN-ROLLED save prompt (branch `handleDismiss` SavePromptModal.jsx:897) never dispatches `save-result`; `savePrompt.js:176` doctrine comment states by design "a DISMISSED save never resolves". DivineSparkModal's only result setter IS that event, and the footer hides Done AND Cancel while `rolling===true && !result` → modal stuck "Rolling…" with ZERO buttons, backdrop click inert, CD charge silently lost, no refusal log row. Only escape = reload. Blast radius (grep `addEventListener('save-result'`): CharReactions.jsx, StepsOfTheFeyTauntModal, AreaEffectTargetModalBase, MassSuggestionModal + every `createSaveListener().promise` consumer.
3. **BUG (filed, live-proven end-to-end): `bug-divine-spark-no-target-self-harms.md`.** cs `targetName:null` → handler fallback `targetInfo?.target?.name || playerStats.name` (divineSparkHandler.js:44) silently SELF-targets: modal opened "Channel divine energy at War_Cleric", charge spent, Harm forced a CON save vs own DC 15 and dealt **7 Radiant to self**. RAW (disk row): "another creature … within 30 feet of yourself". Same fallback at `saveOnlyHandler.js:29` (census: only these two handlers). Refusal/zero-spend expected instead.
4. **Divine Spark economy faces (all honest):** charge max = 3 for lv8 (no disk `class_levels` on War_Cleric → CLA-092 fallback table lv6-17:3, or class-table lookup — either = 3); row-click SPENDS before the modal opens (decrement observed on `ability_use` "Divine Spark activated"); `channelDivinityCharges:0` → popup "Divine Spark / No Channel Divinity charges remaining. / Done", zero modal, zero spend; 30 ft gate is INSIDE the modal branches (Harm/Heal both gate): refusal renders honest result view "…is out of range for Divine Spark (30 ft)." + Done + `automation/divine_spark_refused` log row + zero prompt — but the row-click charge is KEPT (accepted §9 pay-early leak family). Heal lane: `applyHealingToTarget` canonical (roll 1d8+4=5, "Current HP: 18 / 50 (healed 5)", `hp_change` row with maxHp — CLA-092 NaN fix holds). Radiant radio must be picked (default checked = damageTypes[0] Necrotic); Harm button label re-renders with the picked type before click.
5. **Owner-residual 13-PC placeholder combatSummary re-surfaced at entry (7th consecutive campaign entry) and was again sufficient as an arming board** — scoped PATCH merge by name (`{value:{creatures:[{name,targetName|maxHp…}]}}`, reply `{applied:2,skipped:[]}`); unarming = PATCH `targetName:null` (`applied:1`). New-bucket law re-observed: scoped PATCH on an absent bucket 404s "no object stored under this key" — creation needs full-store POST (EP/EF buckets created that way, `{hitPoints,currentHitPoints}` for the PC damage/heal lane).
6. **Session health:** 0 console errors/0 warnings, lock grep 0 lines, no throwaways created (seeded lanes event-clear — `git log --since CV` shows only aoe/picker/docs commits; quick-create labels re-observed "New Arena Battle"/"New Starter Adventure" on selection screen). No fixture character written; War_Cleric.json md5 `1a4c9643…` byte-identical at exit.

**Freshness for the NEXT run:** CZ entered/re-derived: Divine Spark full lane (incl. corona async seam — the LAST un-proven aura measurement face), map create/activate/full-doc-PUT/re-token lane, scoped-PATCH arm/unarm, new-bucket POST law, prompt-queue Roll→Done drain on the single-target createSaveListener channel (no evasion chooser on CON saves — the Leading-Evasion stacker is Dex/AoE lanes only). CY rows demoted only if new commits touch: `divineSparkHandler.js DivineSparkModal.jsx savePrompt.js SavePromptModal.jsx` (CZ bugs land fixes here) — plus CY's own demote list (corona/AoE family files, CY row 15). Untouched-and-event-clear: everything else (re-checked at CZ start).

## Live-Claims Folded History

<details><summary>CY row (corona picker-route fix 6-face verified + PT2 producer census OVERTURNED live) + CX/CW/CQ/CR/CU/CV/CS records (folded, full text in git log of this file)</summary>

**CY** (post-CX fix batch): PT1 corona picker-route fix 3e3113213 verified ALL faces both seams (picker pre-check EXACTLY overlay tokens, payload disadvantage true/false by 60/65 ft, damage-type gate honest-inert, KB inline `mode` rows); PT2 "second orphan lane" claim WRONG — `useLoggedDiceRollDamage→handleAoeDamage 'overlay-'` branch has a LIVE PC-cast producer (non-AoE damage-save spell with armed `overlay-<id>` target), lane KEPT; AI-Dress pre-disable (29e362837) + hex orphan-branch delete (5f995d5c6) + spell-wand affordance (d0e559d7e) all PASS; 0 bugs.

**CX** (post-CW improve pair): ghost Rotate hidden + deactivated-map advisory live-confirmed; PT4 cross-tab adoption CLOSED; PT3 hex `character:` drop matrix → orphan-lane finding (since deleted); PT1 descended → bug-corona-aura-inert-in-aoe-picker-route filed (since resolved); AI-Dress no-config honest (POST-then-403 face, since replaced by pre-disable).

**CW** (post-CV improve batch): all seven post-CV commits live-verified (ghost-item fix, burst-PATCH coalescing 3 faces, map self-heal, PT4 never-hijack, hex3d labels, skeleton row, wizard close); parentHex indoor-arm drop lane CLOSED.

**CS** (post-CR): stale-sheet fix 3-face PASS; scoped-PATCH arming PASS; PT1 corona 60 ft bug filed → fixed 13dd98cc4. **CQ**: f1deeb510/f07304b66/efa2d311a/da76fc38d PASS; corona-on-attack-roll filed (fixed+verified); PT2 OA denied-on-sticky CLOSED. **CR**: corona attack-lane twins, map-deactivate 6-face, friendly-fire, id-normalize, 400-copy all PASS; stale-sheet ghost-write filed (fixed b1ca01152). **CU**: cross-client HP adopt CLOSED; two-tab PATCH races clean. **CV**: full sprite lanes (2D/3D/LAN), throwaway seeded lanes deep (quick-create, wizard gate, ×11 checklist, FULL regen ride, typed-name deletes), ghost-item bug filed (fixed af07dd67e).

</details>

## Priority Targets (next descent)

1. **Fix-verify the two CZ bug files** when their fixes land (`divineSparkHandler.js` / `DivineSparkModal.jsx` / `SavePromptModal.jsx handleDismiss` / savePrompt.js doctrine) + run the blast-radius census: does Dismiss strand CharReactions/StepsOfTheFeyTaunt/AreaEffectTargetModalBase/MassSuggestion producers too?
2. **AI-Dress LIVE invention face** — still owed a model rig (no-config face verified honest twice, pre-disable face CY).
3. **`saveOnlyHandler.js:29` self-target fallback audit** — is its feature's rules text also "another creature"? (cheap fixture read + one live click).
4. Deferred low-value list unchanged (3D per-mesh, hex-travel-3D, indoor wand-drag, Lion "another Barbarian" exemption).

## Depth Seeds (live 2026-11-05 CZ unless noted)

- **Divine Spark rig (CZ):** auto-row: 2024 Cleric ≥lv2 → sheet Actions `b.clickable "Divine Spark:"` (no fixture edit). Board: owner-residual placeholder cs + scoped PATCH arm/unarm. Map: create-with-tokens one-shot `POST /maps {name,type:'indoor',players:[{id,name,gridX,gridY}]}` → activate PUT …/maps/:slug/activate; re-token via whole-doc PUT UNWRAPPED (GET map → mutate players → PUT). Bearer aura ONE-POST bucket: full-store POST (PATCH 404s if bucket absent) `{value:{activeBuffs:[{effect:'sunlight_aura',distance:60,enemiesDisadvantageSaves:['Radiant']}]}}`. Victim PC runtime HP must exist before damage/heal: full-store POST `{hitPoints:50,currentHitPoints:30}`. Drain single-target prompt: Roll Save → (Indomitable offered, cosmetic) → Done; CON saves skip the evasion chooser.
- **Overlay-arm rig:** unchanged (no touching commits beyond 591e1f621 picker `dispatched` latch — playbook §4 records confirm-disables-at-dispatch, double-cast hazard CLOSED). `POST /spell-overlay?campaign=<c> {action:'add',overlays:[{id,shape:'sphere',startGridX,startGridY,radiusFt,color,label}]}`; PC cards list `overlay-<id>`, monster cards suppress (f4cca8f96).
- **Corona geometry:** FEET_PER_CELL 5 — (2,8)→(14,8)=exactly 60 ft (inside), 65 ft outside; async lane (Divine Spark) loads the ACTIVE map itself via `__map__.activeMapName` (no mapData threading needed); gridless/unpositioned pairs stay lenient-TRUE.
- **Card anchoring / arming law:** unchanged (CY seeds) — NEVER `.creature-card`+hasText; nth + `[class*=name]` exact text, or `:has(input[aria-label="<Name> current HP"])`.
- **Prompt machine truth (two channels):** Save-AoE lane → per-target `savePrompt-<Target>-<ts>` keys under target bucket (payload disadvantage/saveDc/saveType/sourceName). Single-target createSaveListener lane (Divine Spark family) → `campaign.pendingSavePrompts` bucket row + SSE; resolution rows identical (`roll/save-damage` + `save_result`). Check BOTH when auditing a prompt.
- **Context menu / deactivated-map advisory / ItemContextMenu faces:** unchanged (no touching commits) — CW/CX-era seeds.
- **Two-tab PT rig / maps API bodies / allies+regen rigs:** unchanged (no touching commits) — CV/CW-era seeds + playbook §162-171.

## Coverage

| Feature/Flow | Depth | Notes |
|---|---|---|
| Divine Spark lane (row-click spend → modal → harm/heal → prompt drain → corona async 60/65/type-gate → refusals → self-target defect) | **deep (CZ — PT1 CLOSED; 2 bugs filed)** | `divineSparkHandler.js DivineSparkModal.jsx classes.json(Cleric lv2) savePrompt.js SavePromptModal.jsx coronaAuraUtils.js` |
| Corona async-lane measurement (awaited util, active-map self-load, exact-60 inside) | **deep (CZ)** — family now COMPLETE across all seams (picker CY, sync CV-era, attack-lane CQ/CR, async CZ) | `coronaAuraUtils.js getCoronaSaveDisadvantage` |
| SavePromptModal single-target drain + Dismiss doctrine ("dismissed never resolves") | **deep (CZ — producer soft-lock bug filed)** | `SavePromptModal.jsx:897 savePrompt.js:176` |
| Channel Divinity economy on feature-modal handlers (max fallback table, spend-at-confirm, zero popup) | deep (CZ; pay-at-confirm improve 2026-11-05) | `divineSparkHandler.js DivineSparkModal.jsx CLA-092 fallback` |
| Corona family (picker route BOTH seams + prompt payload + inline mode + damage-type gate + range 60/65) | carried — event-clear (CY live-verified, CZ re-rode async twin) | `SaveAttackAoeModal.jsx coronaAuraUtils.js aoeService.js` |
| Save-AoE prompt queue UX (header (Disadvantage), evasion stack, Results close, Evasion halves) | carried — event-clear (CY; 591e1f621 dispatch-latch in playbook §4) | `SavePromptModal.jsx LeadingEvasion UI in sp-overlay family` |
| handleAoeDamage overlay branch reachability | carried — event-clear (improve aoe-overlay-lane-disposition, live-proved) | `useLoggedDiceRollDamage.js handleAoeDamage.js savePath.js MonsterCardModal.jsx:getTarget` |
| AI-Dress no-config face (pre-disable pair) | deep (CY) — live-invention face still **blocked** (no model rig) | `maps-manager/AiDressButton.jsx` |
| Hex drop handler (POI lane post-orphan-delete; bounds + dup guards) | deep (CY head-read) | `hex-map/HexMap.jsx` |
| Spell-row cast affordance (wand icon + title) | deep (CY) | `char-sheet/CharActions.jsx` |
| EB join → 14-combatant board → overlay-target arming | deep (CY re-ride) | `Initiative.jsx createCreatureHandlers.js storage.js` |
| Overlay transport (/spell-overlay add/clear) + map create-with-tokens + activate + whole-doc PUT + re-token | deep (CZ re-ride — PUT→PUT→PUT re-token thrice, all adopted live) | `server/routes/spell-overlay.js server/routes/maps.js` |
| Ghost-type context menu + deleted-map 404s | carried — event-clear (live-proved CX; cz-spark DELETE 200+404-consistent re-observed CZ) | `map/ItemContextMenu.jsx PlacedItems.jsx` |
| Map activate/deactivate matrix incl. player-open ADVISORY | carried — event-clear (fix 878939872 live-proved CX) | `App.jsx MapToolbar.jsx MapDeactivatedHint` |
| Coalesced-burst cross-tab adoption + same-tab coalescing | carried — event-clear (merged shape live-proved CX twice) | `storage.js campaigns-changedata.js` |
| Admin regen a11y pair + regen cascade + typed-name delete + quick-create flavors + wizard gate | carried — event-clear (CV same-day; CZ git-log re-check + labels re-observed) | `CampaignAdmin.jsx RegenerateAdventureModal FirstSessionChecklist CampaignSelection.jsx` |
| Throwaway seeded lanes (arena/starter) | carried — event-clear (CV; CZ re-check) | `CampaignSelection.jsx campaigns-starter-seed.js campaigns-arena*` |
| TV / victory / delegation / allies editor / friendly-fire | carried — event-clear (CQ/CR/CV rows; CZ git-log re-check clean) | `initiative/` |
| Hex 3D diorama labels; ItemsPanel arms; fog-math; NPC/quest/faction CRUD; PowW/save-prompt/cover/OA/wolf+lion; LAN combat; inventory/music/rules-tray | carried — event-clear at CQ/CR/CV/CW/CX | rows as dated |

## Baseline Fingerprints (canonical test-campaign state at CZ exit — verified 2026-11-05)

- change-data `{}` + log `[]` — browser tab closed FIRST (quiet), API two-pass (12 s settle between), no rehydration surfaced either pass.
- maps = the 4 owner fixtures [battle-arena(false, md5 **94fcd0bf** VERIFIED), item-showcase(false), poi-showcase(false), test-map(false)]; cz-spark DELETED (absent from list, file gone); spell-overlay store `{overlays:[]}`; combatSummary gone.
- npcs [Marta Copperkettle]; 13 char files byte-untouched (`git status --porcelain public/campaigns/` EMPTY; War_Cleric.json md5 1a4c9643… = entry value); campaigns/ = 5 baseline folders, no throwaways.
- Lock grep = 0 lines; console 0 errors/0 warnings; bug files this run: **2** (divine-spark dismiss soft-lock, divine-spark no-target self-harm).

## Improvement Backlog

<!-- Open items only. e2e-explore appends dated bullets here; e2e-improve consumes and REMOVES them. -->


## Blocked / Deepen Targets (fold-gate ledger)

- CLOSED at CZ 2026-11-05: PT1 DivineSparkModal sync face (7 faces, corona async seam measured — last un-proven aura seam); the "JSON-PUT feature rig needed" premise retired (auto-derivation proven).
- CLOSED earlier: PT1 corona picker-route (CY), PT2 aoe-overlay-lane census (CY, overturned+kept), CW backlog pair, PT3 hex drop matrix, PT4 coalescing cross-tab, CU PT2/PT3, stale-sheet fix, corona range+attack lanes, allies re-entry, regen ride, quick-create flavors, map activate matrix.
- OPEN: fix-verify the 2 CZ divine-spark bugs + save-result blast radius (PT1 next run); AI-Dress LIVE invention face (model rig — infra); llama.cpp-style refusing backend for jsonSchema:true (infra, unchanged).
- NOT VERIFIED this run (honest scope): Divine Spark save-SUCCESS face (didn't draw a nat-high vs DC 15 — full-damage + header faces only; success path = code-read zero-damage); save-advantage twins (Blessed Strike era, unchanged); throwaway seeded lanes not re-entered (event-clear CV); 3D faces untouched (deferred list); monster-damage-chip-with-overlay arm still not clicked live (CY carry).
- DEFERRED (low value): 3D per-mesh geometry; hex travel-in-3D; indoor overlay wand-drag; Lion "another Barbarian with this option" exemption.
