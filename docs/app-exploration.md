# App Exploration Map

**DESCENT RUN DA — 2026-11-06 (PT1 CLOSED: the two CZ divine-spark bugs are live-verified DEAD and the pay-at-confirm improvement rides clean; post-CZ fix batch (fa7a628ff, 1db06ea1f, 142ebd0c0, 8d21f5a4c, 0d7303fbe) fully descended live. 1 NEW BUG FILED: Boon-of-Combat-Prowess conversion never persists `lastAttack.hit:true` — hit-riders deny on an attack that dealt damage.)**

Live facts (all re-derived THIS run, test-campaign, dev pair `CAMPAIGN_LOCK='test-campaign,qa-arena,qa-starter' node server.js` :80 + `npx vite --host` :5173):

1. **CZ bug 1 DEAD — dismiss no longer soft-locks DivineSparkModal.** Harm-confirm arms the prompt; clicking Dismiss on the UN-ROLLED prompt routes the modal to refusal view "save was dismissed — no damage dealt" + working Done (DivineSparkModal `save-dismissed` companion, fa7a628ff). `pendingSavePrompts` bucket evicted on drain (drain-to-evict re-observed), `divine_spark_refused` row with that reason, target took zero damage, charge STAYED spent (§9 pay-early doctrine, correct).
2. **CZ bug 2 DEAD — no-target / self-target both refuse before any spend** (1db06ea1f). Unarmed (targetName null/absent): popup "No target selected — Divine Spark requires another creature within 30 feet." + `divine_spark_refused/no_target`, zero spend. Self-armed via cs PATCH: "You can't target yourself with Divine Spark — it requires another creature." + `cannot_target_self`. Row-click never opened the modal on either face. (Sheet-open seeds the char bucket with `channelDivinityCharges:3` = pool max — a seed, not a spend; judge spends by decrement + ability_use row.)
3. **8d21f5a4c live — pay-at-CONFIRM + header visibility.** Row-click on a VALID target: modal opens ("Channel divine energy at EvasiveFighter", header "3 charges remaining", radios Necrotic default-checked, Harm label re-renders with picked type) with **zero log rows** (CZ era: row-click spent). Cancel: zero spend, zero rows. Harm-confirm (gates passed): ONE `ability_use` row "Divine Spark (Harm) — targeting …, Channel Divinity: N remaining." + charge write max→max−1, atomically with prompt creation. Zero-charge face (`channelDivinityCharges:0` via scoped char-bucket PATCH — 200, adopted live): "No Channel Divinity charges remaining." popup, zero modal.
4. **Harm lane re-verified end-to-end incl. the CZ owed save-SUCCESS face:** prompt "Saving Throw Required / EvasiveFighter must make a CON saving throw / DC 15 / CON +6 +5 (Aura of Protection) = +11 / Source: Divine Spark" → Roll Save → "SAVE SUCCESS 23 vs DC 15, d20 (12) + 11 (+5 aura from ElderPaladin)" → Done drains → modal result view "CON save (DC 15): Success / Target saved and takes no damage / Damage roll: 1d8 + 4 Radiant = 11"; log `roll/save-damage` `saveResult:success finalDamage:0` + `save_result` row; EF HP unchanged; prompt bucket evicted. Second cast's header showed the stored "2 charges remaining" → confirm spent to 1.
5. **142ebd0c0 Stunning Strike zero-cost pre-gate live PASS (PT3 resolved).** After a qualifying melee HIT: target cleared → click SS → "No target selected — Stunning Strike requires another creature. Select a target in combat first." + exactly ONE `stunning_strike_refused/no_target` row, `focusPoints` UNCHANGED (20), `_StunningStrike_usedRound` UNSTAMPED; SECOND click same round repeats the SAME wording (the pre-fix "Once per turn — already used this turn." false-consume is gone). Self-armed → cannot_target_self face identical. Legit cast: FP 20→19, latch `{round:1, activeCreature:'Disciplined_Monk'}`, info popup "Target EvasiveFighter must make a CON saving throw (DC 21). / Done" THEN the `.sp-overlay` prompt; Dismiss on un-rolled prompt → `stunning_strike_refused/save_dismissed` row, prompt cleared + bucket evicted, FP stays spent (doctrine), zero stranded overlays, console clean.
6. **NEW BUG (filed, live-repro + code root): `bug-boon-combat-prowess-hit-flag-not-persisted.md`.** Boon of Combat Prowess convert button flips the popup to "✓ HIT … Miss converted to Hit" and Done dispatches `dice-roll-done {hit:true}` (damage rolls + applies, `hp_change` lands) — but persisted `campaign.lastAttack` keeps `hit:false` (observed `damageApplied:true, actualDamage:5, hit:false, d20Rolls:[4,20]`), as does `<attacker>.lastAttackRoll`. Stunning Strike then denies "Last melee attack did not hit." — proven by control: a NATURAL hit (nat20, `hit:true`) on the same board admits the SS cast immediately. Code: `handleMissToHit`/`handleDone` (AttackResultPopup.jsx:45/:59) keep the conversion popup-local; `handleBoonOfCombatProwess` (CharSheet.handlers.js:62) logs+latches but never rewrites lastAttack; contrast `handleBiDefenseCombatSummary` (:119) which DOES persist lastAttack mutations.
7. **Aura attribution is honest but party-wide:** the CON prompt showed "+5 (Aura of Protection)" tooltip "Aura of Protection from ElderPaladin" while ElderPaladin was NOT on the combat board (cs had only WC/EF/DM). Per accepted gridless-lenient doctrine (party tokens co-present by default, `computeAuraBonus` iterates the whole character roster, `isWithinRange` consults-and-passes with no map/tokens) this is BY DESIGN — kept as observation + backlog question, not a bug.
8. **Session health:** 0 console errors/0 warnings; 0 lock-denial lines; no throwaways created (seeded lanes event-clear — post-CZ commits touched only save-prompt/divine-spark/monk lanes + docs; quick-create labels "New Arena Battle"/"New Starter Adventure" re-observed on selection). Zero character-file writes (git porcelain public/campaigns EMPTY; battle-arena md5 94fcd0bf byte-untouched). Final closed-tab two-pass API clears: change-data `{}` + log `[]` + combatSummary null, GET-verified.

**Freshness for the NEXT run:** DA entered/re-derived: Divine Spark full lane (refusals/economy/pay-at-confirm/dismiss/save-success damage lane), Stunning Strike gate all faces, saveOnlyHandler refusal lanes, save-dismissed hygiene live on TWO producer families (modal + save_only), Boon-of-Combat-Prowess conversion lane, melee-hit popup flow incl. Boon convert + Done damage stages, scoped-PATCH char-bucket seeding. Rows demoted only if new commits touch: `divineSparkHandler.js DivineSparkModal.jsx SavePromptModal.jsx savePrompt.js saveOnlyHandler.js useCharActionsAutomation.js CharReactions.jsx AttackResultPopup.jsx CharSheet.handlers.js boonOfCombatProwess.js` (DA bug lands a fix in the boon lane) — plus CZ/CY carry lists (corona/AoE family files). Untouched-and-event-clear: everything else.

## Live-Claims Folded History

<details><summary>CZ/CY/CX/CW/CQ/CR/CU/CV/CS/CJ-CP records (folded, full text in git log of this file)</summary>

**CZ** (pre-DA): PT1 DivineSparkModal 7 faces — dismiss-softlock + no-target self-harm bugs filed (both FIXED + DA-verified dead); corona async 60/65 ft measured TRUE/EXACT-60 inside, type-gate honest-inert; heal lane canonical; pay-early leak family (since fixed by 8d21f5a4c); scoped-PATCH arm/unarm law; new-bucket full-store POST law (PATCH 404s on absent bucket).

**CY** (post-CX fix batch): corona picker-route fix 3e3113213 verified ALL faces both seams; PT2 "second orphan lane" claim WRONG — live PC-cast producer found, lane KEPT; AI-Dress pre-disable + hex orphan-delete + spell-wand affordance all PASS; 0 bugs.

**CX**: ghost Rotate hidden + deactivated-map advisory confirmed; PT4 cross-tab adoption CLOSED; hex `character:` drop → orphan-lane (deleted); corona picker-route bug filed (fixed).

**CW**: seven post-CV commits live-verified (ghost-item fix, burst-PATCH coalescing, map self-heal, never-hijack, hex3d labels, skeleton row, wizard close); parentHex indoor-arm CLOSED.

**CS**: stale-sheet fix 3-face PASS; scoped-PATCH arming PASS; corona 60 ft bug filed → fixed 13dd98cc4. **CQ**: f1deeb510/f07304b66/efa2d311a/da76fc38d PASS; corona-on-attack-roll filed (fixed+verified); PT2 OA denied-on-sticky CLOSED. **CR**: corona attack-lane twins, map-deactivate 6-face, friendly-fire, id-normalize, 400-copy all PASS; stale-sheet ghost-write filed (fixed b1ca01152). **CU**: cross-client HP adopt CLOSED; two-tab PATCH races clean. **CV**: full sprite lanes (2D/3D/LAN), throwaway seeded lanes deep (quick-create, wizard gate, ×11 checklist, FULL regen ride, typed-name deletes), ghost-item bug filed (fixed af07dd67e). **CJ-CP**: aura family (AoP edits, PowW Lion/Wolf matrices, monster-lane aura consult, wolf gridless fix), stale-sheet origin, allies betrayal flips, friendly-fire modal — all filed/fixed/verified cycles; see git log.

</details>

## Priority Targets (next descent)

1. **Fix-verify `bug-boon-combat-prowess-hit-flag-not-persisted.md`** when the fix lands (faces: convert → `campaign.lastAttack.hit:true` + `lastAttackRoll` twin + SS admits; log attack row no longer mislabels a converted hit; Stroke-of-Luck attack-rolling sibling audited same pass).
2. **AI-Dress LIVE invention face** — still owed a model rig (no-config face verified honest twice, pre-disable face CY).
3. **save-dismissed census live spot-checks beyond the two proven families**: §5 census swept 15 modal-parking sites with per-site ledgers; DA proved DivineSparkModal + saveOnlyHandler live. A modal-family site (e.g. StepsOfTheFeyTauntModal or MassSuggestion) still has no live face.
4. **Divine Spark heal lane re-ride on changed file** (8d21f5a4c touched the heal branch's spend call-site order — CZ verified heal pre-move; DA verified harm post-move; heal-confirm spend face un-proven).
5. Deferred low-value list unchanged (3D per-mesh, hex-travel-3D, indoor wand-drag, Lion "another Barbarian" exemption).

## Depth Seeds (live 2026-11-06 DA unless noted)

- **Divine Spark rig (DA):** fresh campaign: full-store POST `/combatSummary` `{value:{creatures:[{name,type:'player',initiative,ac},…], round:1, activeCreatureName:null}}` creates the board (scoped PATCH 404s on absent bucket — CZ law holds); scoped PATCH `{value:{creatures:[{name:'<A>',targetName:'<T>'}]}}` merges + is adopted LIVE by the loaded tab (no reload needed, DA). Char bucket absent → `PATCH /:campaign/<Char> {value:{channelDivinityCharges:N}}` seeds a key into an existing sheet-seeded bucket (200, adopted live). Opening a char sheet seeds its full tracked-resources bucket (channelDivinityCharges = pool max — a SEED, not a spend).
- **Monk SS rig (DA):** Disciplined_Monk sheet-open seeds `focusPoints:20` (lv20 fixture — registry's "2024 Monk lv7" note is stale). Attack = click weapon NAME row in Actions table (opens attack popup; the "+N" chip click is intercepted once the popup is up). Gate needs lastAttack from the SAME tab's roll lane; `Boon of Combat Prowess` convert button lands a hit VISUALLY but poisons lastAttack.hit (DA bug) — use a NATURAL hit for SS testing (+11 vs AC 18 lands ~70%).
- **Popup flush upgrade (DA):** a stack of lingering `popup-overlay` nodes (each backdrop-click can re-surface the next) — one `el.click()` per layer is not enough when Playwright's blocked retries queued layers; flush loop: click root AND all descendants of every `[data-testid="popup-overlay"]` until `querySelectorAll` is empty. NEVER `.remove()` (§4 holds).
- **SS prompt double-channel (DA):** legit SS click emits BOTH an automation_info popup ("Target X must make a CON saving throw (DC 21). / Done") AND the queued `.sp-overlay` prompt — close the popup (Done) to reach the prompt's Roll Save/Dismiss.
- **Overlay-arm rig / corona geometry / card anchoring / prompt-machine two channels / context-menu / maps API bodies / allies+regen rigs:** unchanged (no touching commits) — CZ/CY/CV/CW-era seeds.
- **Divine Spark auto-derivation (CZ, re-observed DA):** 2024 Cleric ≥lv2 gets the sheet `b.clickable "Divine Spark:"` row from classes.json — zero fixture edits. Harm lane needs NO map for the 30 ft gate (gridless-lenient); DC from `spellAbilities.saveDc` (WC = 15); EF save shows +11 with phantom-board EP aura (§DA fact 7).

## Coverage

| Feature/Flow | Depth | Notes |
|---|---|---|
| Divine Spark lane post-fix (no-target/self refusals, pay-at-confirm atomicity, header charges, Cancel zero-cost, dismiss refusal view, save-SUCCESS face, zero-charge popup) | **deep (DA — both CZ bugs live-verified DEAD; 8/8 faces PASS)** | `divineSparkHandler.js DivineSparkModal.jsx SavePromptModal.jsx savePrompt.js classes.json` |
| save-dismissed hygiene — live faces on DivineSparkModal + saveOnly/StunningStrike lanes (row drains, bucket evicts, no strand) | **deep (DA)**; 13 modal sites remain census-only (per-site test ledgers exist) | `savePrompt.js AttackResultPopup saveOnlyHandler.js CharReactions.jsx AreaEffectSaveFlow.utils.js` |
| Stunning Strike gate (once-per-turn, lastAttack legs, zero-cost refusal ×2 faces, legit spend 20→19 + latch, save_dismissed) | **deep (DA — 142ebd0c0 fix live-verified 4 faces)** | `useCharActionsAutomation.js saveOnlyHandler.js` |
| Boon of Combat Prowess conversion lane (popup convert, damage applies, lastAttack flag) | **deep (DA — 1 bug filed: hit flag never persisted)** | `AttackResultPopup.jsx CharSheet.handlers.js boonOfCombatProwess.js hitResolution.js` |
| PC melee attack popup flow (row click → adv/dis stage → Done → damage stage → HP apply; resistance halving "(reduced from 11)") | deep (DA) | `DiceRollResult.jsx useLoggedDiceRollAttack.js applyDamage.js` |
| Char-bucket scoped-PATCH key seeding (absent→present via PATCH merge on sheet-seeded bucket, live-adopted) | deep (DA) | `server/routes/campaigns-changedata.js storage.js` |
| Corona family (picker BOTH seams + sync + attack-lane + async 60/65/type-gate) | carried — event-clear (CY/CZ; DA git-log re-check clean) | `SaveAttackAoeModal.jsx coronaAuraUtils.js aoeService.js` |
| Save-AoE prompt queue UX (evasion stack, dispatch-latch) | carried — event-clear (CY; 591e1f621 in playbook §4) | `SavePromptModal.jsx LeadingEvasion` |
| AI-Dress no-config face | deep (CY) — live-invention face still **blocked** (no model rig) | `maps-manager/AiDressButton.jsx` |
| EB join → board → overlay arming | carried — event-clear (CY) | `Initiative.jsx createCreatureHandlers.js storage.js` |
| Overlay transport + map create/activate/whole-doc PUT | carried — event-clear (CZ) | `server/routes/spell-overlay.js server/routes/maps.js` |
| Ghost context menu / map activate matrix / coalesced-burst adoption | carried — event-clear (CX/CW) | rows as dated |
| Admin regen + quick-create flavors + throwaway seeded lanes | carried — event-clear (CV; DA re-checked git log + labels re-observed on selection screen) | `CampaignAdmin.jsx RegenerateAdventureModal FirstSessionChecklist CampaignSelection.jsx` |
| TV / victory / delegation / allies editor / friendly-fire | carried — event-clear (CQ/CR/CV; DA git-log re-check clean) | `initiative/` |
| Hex 3D labels; ItemsPanel arms; fog-math; NPC/quest/faction CRUD; PowW/cover/OA/wolf+lion; LAN combat; inventory/music/rules-tray | carried — event-clear at CQ-CX | rows as dated |

## Baseline Fingerprints (canonical test-campaign state at DA exit — verified 2026-11-06)

- change-data `{}` + log `[]` + combatSummary null — closed-tab two-pass API clears, no rehydration either pass.
- maps = the 4 owner fixtures [battle-arena(false, md5 **94fcd0bf** re-verified untouched), item-showcase, poi-showcase, test-map]; spell-overlay not exercised; no monsters joined; no throwaways; campaigns/ = 5 baseline folders.
- npcs [Marta Copperkettle]; 13 char files byte-untouched (`git status --porcelain public/campaigns/` EMPTY). No registry additions needed (rig used fixtures + change-data only).
- Lock grep = 0 lines; console 0 errors/0 warnings; only non-200 network = SSE ERR_ABORTED (normal); bug files this run: **1** (boon-combat-prowess-hit-flag).

## Improvement Backlog

<!-- Open items only. e2e-explore appends dated bullets here; e2e-improve consumes and REMOVES them. -->

(no open items)

## Blocked / Deepen Targets (fold-gate ledger)

- CLOSED at DA 2026-11-06: PT1 both CZ divine-spark bug fix-verifies + pay-at-confirm; PT3 saveOnlyHandler rules-text audit (code comment enumerates consumers — all "another creature" — + 2 refusal faces live); save-dismissed live spot-checks ×2 families.
- CLOSED earlier: PT1 corona picker-route (CY), PT2 aoe-overlay-lane census (CY), CW backlog pair, PT3 hex drop matrix, PT4 coalescing cross-tab, CU PT2/PT3, stale-sheet fix, corona range+attack lanes, allies re-entry, regen ride, quick-create flavors, map activate matrix.
- OPEN: fix-verify boon-combat-prowess hit-flag bug (new PT1); AI-Dress LIVE invention face (model rig — infra); llama.cpp-style refusing backend for jsonSchema:true (infra); one modal-family save-dismissed live face (PT3).
- NOT VERIFIED this run (honest scope): Divine Spark HEAL pay-at-confirm face (8d21f5a4c touched the heal spend call-site; CZ heal was pre-move); 5e-ruleset Stunning Strike pre-gate face (fix claims tests cover both rulesets; only 2024 Disciplined_Monk ridden live); non-Monk save_only consumers (Color Spray etc.) refusal faces (handler-level, shared code path, un-clicked); Stroke-of-Luck D20-test conversion persistence (sibling lane of the DA bug — audit owed); throwaway seeded lanes not re-entered (event-clear CV); 3D faces untouched (deferred list); monster-damage-chip-with-overlay arm still not clicked live (CY carry).
- DEFERRED (low value): 3D per-mesh geometry; hex travel-in-3D; indoor overlay wand-drag; Lion "another Barbarian with this option" exemption.
