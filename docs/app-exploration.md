# App Exploration Map

**DESCENT RUN DB — 2026-11-06 (post-DA fix trio fully descended live: c9ae24fc7 boon hit-flag fix verified 5/5 (PT1 CLOSED), f526147ac Divine-Spark header decrement verified both branches, 8b2dd5c78 aura caveat descended 4 faces — 3 PASS + 1 NEW BUG filed: the board-member exemption lies for a bearer who IS on the combat board because its guard reads a cache only the Initiative lane refreshes.)**

Live facts (all re-derived THIS run, test-campaign, dev pair `CAMPAIGN_LOCK='test-campaign,qa-arena,qa-starter' node server.js` :80 + `npx vite --host` :5173):

1. **c9ae24fc7 live — Boon of Combat Prowess conversion fix 5/5.** Natural-1 miss (12 vs AC 18) → convert button → popup "✓ HIT (12 vs AC 18) Boon of Combat Prowess: Miss converted to Hit" and AT CONVERSION (before Done) top-level `lastAttack` = `{hit:true, missConverted:true, convertedBy:'Boon of Combat Prowess', d20:1, d20Rolls:[1,20], total:12, targetAc:18}` + `Disciplined_Monk.lastAttackRoll` twin flipped identically. Done → damage merge PRESERVED the flags (`damageApplied:true, actualDamage:1` — EF's Heavy Armor Master feat ate 7→1, honest). Stunning Strike then ADMITTED: automation_info popup + `.sp-overlay` prompt both channels, FP 20→19, latch `{round:1, activeCreature:'Disciplined_Monk'}`; Dismiss drained clean (`stunning_strike_refused — save_dismissed` row, prompt bucket evicted, zero stranded overlays). Log attack row stays `hit:false` = the resolution's known-accepted residual (ability_use conversion row is the honest companion). Unit ledger 7/7 re-run green. Stroke-of-Luck sibling: helper hit-guard + async conversion code-audited + covered by the ledger (no live feat holder in fixtures — honestly un-clicked). `lastAttack` is a TOP-LEVEL change-data key (not inside `__campaign__` — that bucket carries only `campaignName`).
2. **f526147ac live both branches — header tracks the confirm-spend.** Heal confirm: result view shows "2 charges remaining" + hp_change +11 + ONE ability_use "Divine Spark (Heal) — … Channel Divinity: 2 remaining." + charge write 3→2, atomically at confirm (PT4 heal pay-at-confirm CLOSED — face proven, previously CZ-era pre-move). Harm: reopen header shows stored "2", confirm → header "1 charge remaining" THROUGH the "Rolling..." view and the result view, zero second decrement.
3. **Harm save-SUCCESS face re-ridden:** prompt CON +6 +5 (phantom EP aura) = +11 → SAVE SUCCESS 20 vs DC 15 → result "Target saved and takes no damage. Damage roll: 1d8 + 4 Necrotic = 8" → Done drains, bucket evicts, EF HP unchanged (41), zero overlays, console clean.
4. **8b2dd5c78 descended 4 faces.** A (poi-showcase active, zero positioned tokens, EP phantom): caveat renders PRE-ROLL badge title AND post-roll breakdown badge — "Aura of Protection from ElderPaladin — assumed co-present (no token)". D (no active map): plain tooltip, no caveat (gridless fail-open). C (sandbox map where EP HAS a token): caveat correctly gone — but the aura chip itself drops ENTIRELY ("CON +6 = +6"): a tokened bearer still can't pad an UNPLACED target (rangeCheck kills either unplaced leg once the map is positioned) — honest mechanic, UX note in backlog. B (bearer on the SERVER board, sheet-lane tab): caveat WRONGLY persists — guard's `allCreatures` comes from combatData `cachedCombatSummaries`, SSE-refreshed only by the Initiative lane; 8s settle does not fix it → **BUG FILED: `bug-aura-caveat-asserts-for-on-board-bearer-stale-cache.md`** (control: same-rig faces C/D show zero false caveat; console clean).
5. **Rig laws re-observed:** scoped-PATCH cs arm adopted live by the sheet tab (applied:1/2); char-bucket PATCH 404s until sheet-open seeds it (EF patch failed → opened sheet → re-PATCH 200); API full-store board POST + campaign reselect → App re-seed fan-out grows the 4-creature board to the full 13-PC party (resurrect law §33/§178); `/MISS/i` matched "click to dismiss" on the first probe — glyph-only miss judgement re-confirmed (§228); Code Mode has no `setTimeout` (§226 — re-bitten, side effects had landed before the throw).
6. **Session health:** 0 console errors / 0 warnings across the whole run; 0 lock-denial lines; sandbox map db-aura-sandbox created → activated → DELETED (maps back to the 4 owner fixtures, all inactive); battle-arena md5 94fcd0bf byte-untouched; 13 char files clean (`git status --porcelain public/campaigns/` EMPTY); no throwaways created (seeded lanes event-clear; quick-create labels "New Arena Battle"/"New Starter Adventure" re-observed on selection); final closed-tab two-pass API clears → change-data `{}` + log `[]` GET-verified, no rehydration.

**Freshness for the NEXT run:** DB entered/re-derived: boon conversion + SS-admit lane, Divine Spark heal+harm full economy incl. header-through-3-views, aura-caveat display lane (4 faces), direct savePrompt-injection rig (5 prompts, all drained/evicted). Rows demote only if new commits touch: `CharSheet.handlers.js AttackResultPopup.jsx useCharActionsAutomation.js DivineSparkModal.jsx SavePromptModal.jsx auraOfProtection.js combatData.js initiative/sseHandlers.js rangeCheck.js` (the DB bug lands its fix in the aura/combatData lane) — plus DA carry lists (savePrompt/save-dismiss family). Untouched-and-event-clear: everything else (corona family, EB join, overlay transport, maps lanes, throwaway seeded lanes, TV/delegation/allies, hex, sprites, allies editor).

## Live-Claims Folded History

<details><summary>CZ/CY/CX/CW/CQ/CR/CU/CV/CS/CJ-CP/DA records (folded, full text in git log of this file)</summary>

**DA** (2026-11-06 same-day, pre-DB): post-CZ batch (fa7a628ff/1db06ea1f/142ebd0c0/8d21f5a4c/0d7303fbe) all live-verified — both CZ divine-spark bugs DEAD, SS zero-cost pre-gate PASS, pay-at-confirm atomicity PASS; 1 bug filed (boon hit-flag not persisted — SINCE FIXED c9ae24fc7 + DB-verified dead); phantom-board aura attribution recorded as doctrine + backlog question (DB answered it with the caveat improve + one display bug); DA rigs: hand-rolled full-store cs board, sheet-open resource seeding, popup-flush loop law.

**CZ** (pre-DA): PT1 DivineSparkModal 7 faces — dismiss-softlock + no-target self-harm bugs filed (both FIXED + DA-verified dead); corona async 60/65 ft measured TRUE/EXACT-60 inside, type-gate honest-inert; heal lane canonical; pay-early leak family (since fixed by 8d21f5a4c); scoped-PATCH arm/unarm law; new-bucket full-store POST law (PATCH 404s on absent bucket).

**CY** (post-CX fix batch): corona picker-route fix 3e3113213 verified ALL faces both seams; PT2 "second orphan lane" claim WRONG — live PC-cast producer found, lane KEPT; AI-Dress pre-disable + hex orphan-delete + spell-wand affordance all PASS; 0 bugs.

**CX**: ghost Rotate hidden + deactivated-map advisory confirmed; PT4 cross-tab adoption CLOSED; hex `character:` drop → orphan-lane (deleted); corona picker-route bug filed (fixed).

**CW**: seven post-CV commits live-verified (ghost-item fix, burst-PATCH coalescing, map self-heal, never-hijack, hex3d labels, skeleton row, wizard close); parentHex indoor-arm CLOSED.

**CS**: stale-sheet fix 3-face PASS; scoped-PATCH arming PASS; corona 60 ft bug filed → fixed 13dd98cc4. **CQ**: f1deeb510/f07304b66/efa2d311a/da76fc38d PASS; corona-on-attack-roll filed (fixed+verified); PT2 OA denied-on-sticky CLOSED. **CR**: corona attack-lane twins, map-deactivate 6-face, friendly-fire, id-normalize, 400-copy all PASS; stale-sheet ghost-write filed (fixed b1ca01152). **CU**: cross-client HP adopt CLOSED; two-tab PATCH races clean. **CV**: full sprite lanes (2D/3D/LAN), throwaway seeded lanes deep (quick-create, wizard gate, ×11 checklist, FULL regen ride, typed-name deletes), ghost-item bug filed (fixed af07dd67e). **CJ-CP**: aura family (AoP edits, PowW Lion/Wolf matrices, monster-lane aura consult, wolf gridless fix), stale-sheet origin, allies betrayal flips, friendly-fire modal — all filed/fixed/verified cycles; see git log.

</details>

## Priority Targets (next descent)

1. **Fix-verify `bug-aura-caveat-asserts-for-on-board-bearer-stale-cache.md`** when the fix lands (faces: bearer on board + sheet-lane tab → plain tooltip pre-roll AND post-roll; zero-token phantom still caveats; tokened-bearer and gridless faces byte-unchanged; UI-lane repro variant — bearer joins via EB in a second GM tab while a sheet-only first tab prompts).
2. **AI-Dress LIVE invention face** — still owed a model rig (no-config face verified honest twice, pre-disable face CY).
3. **save-dismissed census live spot-checks beyond the proven families**: DA proved DivineSparkModal + saveOnly lanes; DB re-rode the SS dismiss face. Modal-family sites (StepsOfTheFeyTaunt, MassSuggestion, Eyebite, HurlThroughHell, ClairvoyantCombatant, BlindnessDeafness, ElementalAttunement) STILL have no live face — census shows NO fixture host carries any of them (FeyRanger = Gloom Stalker, not Fey Wanderer; no feature rows auto-derive). Rig requires a sanctioned temporary subclass/spellbook edit + restore (wizard-swap pattern) or a new fixture character owning one swept spell.
4. **Divine Spark zero-charge + Cancel + refusals** — DA-proven, event-clear; only re-ride if `divineSparkHandler.js`/`DivineSparkModal.jsx` see new commits.
5. Deferred low-value list unchanged (3D per-mesh, hex-travel-3D, indoor wand-drag, Lion "another Barbarian" exemption).

## Depth Seeds (live 2026-11-06 DB unless noted)

- **Boon conversion rig (DB):** hand-rolled cs board (WC/EF/DM `type:player` + sheet-truth `ac`) via full-store POST; DM sheet-open seeds `focusPoints:20`; arm via scoped cs PATCH (adopted live). Quarterstaff name-row click + glyph-only MISS detection (never /MISS/i — matches "click to dismiss"). `lastAttack` is a TOP-LEVEL change-data bucket. EF feat truth: **Heavy Armor Master** — Bludgeoning 7→1 through it (don't read the shrink as a bug); use a non-B physical rider or necrotic for clean damage ledgers vs EF.
- **Divine Spark economy rig (DB):** modal radios Necrotic-checked/Radiant, buttons "Heal (1d8 + 4)" / "Harm (1d8 + 4 <type>, CON save)" / "Cancel" in `.sp-modal`; header chip `.sp-resource-info`; heal clamps at bucket `hitPoints` (stage `{hitPoints:50,currentHitPoints:30}` via scoped PATCH once sheet-open seeded the bucket — PATCH 404s before seeding, law re-observed).
- **Aura-caveat rig (DB):** direct savePrompt injection (playbook §7) is the whole rig — pre-roll badge `title` + post-roll breakdown badge share the compute; caveat only observable active-map + zero positioned tokens (poi-showcase); sandbox-map creation `POST /maps {name,type:'indoor',gridSize,players:[{id,name,gridX,gridY}],placedItems:[]}` → 201, DELETE by slug.
- **Popup flush upgrade (DA):** flush loop clicks root AND descendants of every `[data-testid="popup-overlay"]` until empty; NEVER `.remove()`. SS double-channel (DA): legit SS emits automation_info popup AND `.sp-overlay` prompt together.
- **Overlay-arm rig / corona geometry / card anchoring / prompt-machine two channels / context-menu / maps API bodies / allies+regen rigs:** unchanged (no touching commits) — CZ/CY/CV/CW-era seeds.
- **Divine Spark auto-derivation (CZ, re-observed DB):** 2024 Cleric ≥lv2 sheet `b.clickable "Divine Spark:"` row from classes.json — zero fixture edits; DC 15 from `spellAbilities.saveDc`; harm needs no map (gridless-lenient).

## Coverage

| Feature/Flow | Depth | Notes |
|---|---|---|
| Boon of Combat Prowess conversion lane (convert-time flag rewrite both records, merge-preserve, SS admit, dismiss drain) | **deep (DB — c9ae24fc7 fix live-verified 5/5; DA bug live-verified DEAD)** | `CharSheet.handlers.js AttackResultPopup.jsx useCharActionsAutomation.js` |
| Divine Spark lane economy (heal pay-at-confirm, harm pay-at-confirm, header decrement through Rolling/result views, reopen-stored-count, save-success drain) | **deep (DB — f526147ac + PT4 both branches PASS)** | `divineSparkHandler.js DivineSparkModal.jsx savePrompt.js classes.json` |
| Aura co-present caveat display lane (phantom caveat pre+post-roll, tokened-bearer drop, gridless fail-open, board-member guard face) | **deep (DB — 3 faces PASS, 1 bug filed)** | `auraOfProtection.js SavePromptModal.jsx combatData.js initiative/sseHandlers.js` |
| save-dismissed hygiene — live faces on DivineSparkModal + saveOnly/StunningStrike lanes | **deep (DB re-rode SS dismiss)**; 13 modal sites remain census-only AND host-less (see Blocked) | `savePrompt.js AttackResultPopup saveOnlyHandler.js CharReactions.jsx AreaEffectSaveFlow.utils.js` |
| Stroke-of-Luck conversion lanes (attack face flip, check-face write-free) | shallow (DB — code audit + unit ledger only; no live feat holder in fixtures) | `CharSheet.handlers.js CharSheet.handlers.miss-conversion.test.jsx` |
| Stunning Strike gate (once-per-turn, lastAttack legs, zero-cost refusals, legit spend, save_dismissed) | carried — event-clear (DA; DB re-rode the admit + dismiss legs) | `useCharActionsAutomation.js saveOnlyHandler.js` |
| PC melee attack popup flow (row click → Done → damage → HP apply; HAM feat reduction) | carried — event-clear (DA; DB re-rode ~5 attacks clean) | `DiceRollResult.jsx useLoggedDiceRollAttack.js applyDamage.js` |
| Char-bucket scoped-PATCH seeding (404-before-seed, adopt-live) | carried — event-clear (DA; DB re-observed both legs) | `server/routes/campaigns-changedata.js storage.js` |
| Direct savePrompt-injection rig (5 prompts, drain+evict faithful) | deep (DB) | `server/routes/campaigns-changedata.js SavePromptModal.jsx` |
| Corona family (picker BOTH seams + sync + attack-lane + async 60/65/type-gate) | carried — event-clear (CY/CZ; DB git-log re-check clean) | `SaveAttackAoeModal.jsx coronaAuraUtils.js aoeService.js` |
| Save-AoE prompt queue UX (evasion stack, dispatch-latch) | carried — event-clear (CY; 591e1f621 in playbook §4) | `SavePromptModal.jsx LeadingEvasion` |
| AI-Dress no-config face | deep (CY) — live-invention face still **blocked** (no model rig) | `maps-manager/AiDressButton.jsx` |
| EB join → board → overlay arming | carried — event-clear (CY) | `Initiative.jsx createCreatureHandlers.js storage.js` |
| Overlay transport + map create/activate/whole-doc PUT | carried — event-clear (CZ; DB re-rode create/activate/DELETE sandbox) | `server/routes/spell-overlay.js server/routes/maps.js` |
| Ghost context menu / map activate matrix / coalesced-burst adoption | carried — event-clear (CX/CW) | rows as dated |
| Admin regen + quick-create flavors + throwaway seeded lanes | carried — event-clear (CV; DB re-observed labels on selection) | `CampaignAdmin.jsx RegenerateAdventureModal FirstSessionChecklist CampaignSelection.jsx` |
| TV / victory / delegation / allies editor / friendly-fire | carried — event-clear (CQ/CR/CV; DB git-log re-check clean) | `initiative/` |
| Hex 3D labels; ItemsPanel arms; fog-math; NPC/quest/faction CRUD; PowW/cover/OA/wolf+lion; LAN combat; inventory/music/rules-tray | carried — event-clear at CQ-CX | rows as dated |

## Baseline Fingerprints (canonical test-campaign state at DB exit — verified 2026-11-06)

- change-data `{}` + log `[]` — closed-tab two-pass API clears, no rehydration either pass.
- maps = the 4 owner fixtures [battle-arena(false, md5 **94fcd0bf** re-verified untouched), item-showcase, poi-showcase, test-map]; sandbox db-aura-sandbox created+deleted; spell-overlay not exercised; no monsters joined; no throwaways; campaigns/ = 5 baseline folders.
- npcs [Marta Copperkettle]; 13 char files byte-untouched (`git status --porcelain public/campaigns/` EMPTY). No registry additions needed (rig used fixtures + change-data only).
- Lock grep = 0 lines; console 0 errors/0 warnings; bug files this run: **1** (aura-caveat stale-cache).

## Improvement Backlog

<!-- Open items only. e2e-explore appends dated bullets here; e2e-improve consumes and REMOVES them. -->

- **[DB 2026-11-06] Tokened aura bearer silently loses the whole aura vs unpositioned targets.** Once the active map has ANY positioned tokens, an aura bearer WITH a token still fails rangeCheck against a board target with no token — the save breakdown drops the aura chip entirely ("CON +6 = +6", no bonus, no explanation), which reads as the feature vanishing. Consider a breakdown note ("target not positioned — aura unmeasured") or measuring gridless-lenient when only the TARGET is unplaced. Files: `auraOfProtection.js rangeCheck.js SavePromptModal.jsx`.
- **[DB 2026-11-06] Heavy Armor Master reduction is log-invisible on the hp ledger.** 7→1 applied damage printed only as an `automation` row ("reduces this Bludgeoning") while the `hp_change` delta (1) carried no reduction breakdown entry (`damageBreakdown` absent) — popup copy was the only place the shrink was explained end-to-end. Consider folding feat-reduction into `damageBreakdown:[{…,status:'reduced'}]` like resistance does. Files: `applyDamage.js CharSheet.handlers.js`.

## Blocked / Deepen Targets (fold-gate ledger)

- CLOSED at DB 2026-11-06: PT1 boon hit-flag fix-verify (5/5); PT4 Divine Spark heal pay-at-confirm face; 8b2dd5c78 caveat descent (3 faces + bug); f526147ac header-decrement verify (both branches).
- CLOSED earlier: PT1 corona picker-route (CY), PT2 aoe-overlay-lane census (CY), CW backlog pair, PT3 hex drop matrix, PT4 coalescing cross-tab, CU PT2/PT3, stale-sheet fix, corona range+attack lanes, allies re-entry, regen ride, quick-create flavors, map activate matrix, both CZ divine-spark bugs + SS pre-gate (DA).
- OPEN: fix-verify aura-caveat stale-cache bug (new PT1); AI-Dress LIVE invention face (model rig — infra); llama.cpp-style refusing backend for jsonSchema:true (infra); modal-family save-dismissed live face — **host-blocked**: no fixture character owns any swept modal spell (verified: subclasses = Arcane Trickster/Aberrant Sorcery/Celestial/Open Hand/Evoker/Berserker/Vengeance/Battle Master/Gloom Stalker/College of Dance/Archfey/Light/Stars), rig needs a sanctioned temporary subclass or spellbook edit + restore.
- NOT VERIFIED this run (honest scope): Stroke-of-Luck live face (no feat holder); 5e-ruleset SS/boon lanes (fix is ruleset-shared code, 2024 host only ridden — DA carry); non-Monk save_only consumers' refusal faces (DA carry); zero-charge/Cancel/refusal Divine Spark faces NOT re-clicked (DA-proven, event-clear); throwaway seeded lanes not re-entered (event-clear CV); 3D faces untouched (deferred list); monster-damage-chip-with-overlay arm still not clicked live (CY carry).
- DEFERRED (low value): 3D per-mesh geometry; hex travel-in-3D; indoor overlay wand-drag; Lion "another Barbarian with this option" exemption.
