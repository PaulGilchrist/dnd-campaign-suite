# Source Bugs & Deferred Fixes (from test-maintain pass)

Companion to `test-maintain-ledger.md` (full per-file log). The test-maintain
orchestrator may not edit source, so every real defect found while maintaining
tests is recorded here. This file is the work queue for a dedicated
`/bugs-fix`-style pass: one fresh subagent per bug, minimal fix, scoped tests.

Triage key: 🔴 = confirmed live production defect · ⚠ = suspected/needs a
repro decision · 🗑 = dead code / dead export cleanup · 📌 = deferred tidy-up
(cite ledger for exact evidence; tests currently PIN the broken behavior
honestly — after a fix, the pinning test must be updated in the same commit).

## 🔴 Confirmed production defects (fix + update the pinning test)

1. **abilities stored as ARRAY (CON bonus lost)** — `holdMonster` abilities-shape
   bug; same class at `polymorphService.js:60` and `truePolymorphService.js:88`
   (recast-clobber variants too). Corroborated by LIVE campaign data during the
   truePolymorph heptad lanes. Tests honest-pin current behavior; fix = read
   object-shape (or normalize), then flip pins.
2. **Assassin lv9 `Infiltration Expertise` phantom +2** —
   `skillValidation/expertise.js` `countExpertiseFromFeature` name-branch credits
   +2 to any disk row whose name contains "Expertise" even with no
   `proficiency_choices` (passive_rule automation only). Pinned lv8=4→lv9=6→lv20=6
   in `skillValidation/expertise.test.js` (#2059).
3. **`fireEvent` async-confirm race class** — fixed instance in
   `AOEConditionModal.expiry.test.js` (deterministic flush() idiom); watch for the
   pattern recurring in other modal lanes (component fine, tests brittle).
4. **battleMedic PROD BUG** and **Healer-feat string-amount HP bug** — string
   amounts used where numbers expected (`healAmount` shape; see healing lane #2106
   honest string-vs-number pins).
5. **`resolveGrantedSources` runs race RESISTANCE extractor under immunity
   category** — `resistancesValidation` source quirk (#2051 flag).
6. **Subrace-ancestry structured `damage_resistance` NEVER read** —
   extractors ignore `Gold Dragonborn`-style structured rows; disk gap flag #2052.
7. **travelService 6× rate-contradiction** — conflicting travel-rate constants
   pinned honestly in travel lanes (#2007 block).
8. **Moon-name-mismatch** — 2024 Moon class name vs consumer lookup mismatch
   (classRules pair lanes).
9. **600-round legacy clocks** — `WARDING_BOND_ROUNDS=600`,
   `shapechangeService expiryRounds:600`, `webAreaSaveHandler.js:80` consumed at
   `expirationQueue.js:47`. Policy: ≥1-min durations are combat-scoped; these
   should collapse to seam-clearing, not giant counters.
10. **wardingBond RAW damage-split UNIMPLEMENTED** — popup text promises a split
    the code doesn't do (# wardingBond lane, 17→maintained).
11. **Wizard-UI pre-select regex capture bugs** — Elf+HighElf pre-selects literal
    `'one'`; MagicInitiate-2024 `'two'`; Tiefling lowercase `'thaumaturgy'`
    (getPreSelectedSpells family; #2030 phantom-purge lane).
12. **Barbarian/Bard 'Choose any N' → 0 uncounted** — proficiencyUtils '2024
    Choose any N' regex misses the phrase; proficiency counts under-report.
13. **resilientSphere toggle-off defect**; **stuck-listener rollback leak**;
    **weight-leak**; **rangeMultiplier dormant**; **fa-statue icon missing**;
    **double-encode `%252F` class** (campaign block fixed one instance —
    campaignService/jsonEntityCrud envelope-truth lane).
14. **`survive_and_heal` dead dispatch key** — disk routes `auto_effect`; the
    builder's `survive_and_heal` dispatch key unreachable (registry-insurance
    ⚠, #2102). Same class: **`hills_tumble` default `effect:'prone'` not in
    `targetEffectDefinitions`** + unreachable (#2105);
    **`automationRouter.js:130-132` `bonusActionManeuvers` spread dead** — no
    builder emits it (#2089).
- 🔴 **`CharActions.jsx:449` + `CharBonusActions.jsx:848` double-`.name`** — call
  sites pass `playerStats.name` (string) into `useSimpleDamageRoll`, which re-reads
  `.name` → every simple damage log gets `characterName: undefined` (run2 #12).

## ⚠ Suspected / needs adjudication

- 2024.js:87-100 `selectedLineage` dead lineage branch (zero `sub_traits` on
  disk) — delete then retire test residue (#2036).
- `feature.feature_specific?.expertise` feature-level `.skills` branch dead vs
  disk shape (#2059 correction recorded).
- `multi_target_spread` / `spell_breaker` / `sentinel` builder exports — no type
  dispatches them; kept as registry insurance ⚠ (#2101).
- Parser-fabricated-minor-telekinesis class; SPA-cache-mutation
  2024-guard-disarm; guild-name/NPC-desc divergence (campaign block).
- >150-HP stun heuristic + `durationRounds` minutes×N legacy recipes —
  flag-not-replicate class.
- PFEG charm-immunity `applicable[0]`-only ward suppression (`it.fails` canon).
- steps-config languageWarnings drop (`CharacterCreationWizard.jsx:61`) and
  `Players.jsx:41` `dragging?.creatureId` should be `playerId` — the two hard
  FIXME canon failures; fixing these two retires the canon exceptions.
- ⚠ useCharActionsEventListeners.js:41-64 — damage-type-choice/skip window listeners registered without effect cleanup; stale listeners survive dismissal/unmount and re-register on reopen; :64 choice handler fires post-setPopupHtml(null). Maintained pass run2 #5 (CharActions.events); deletion of prior post-unmount brittleness test corroborates.
- ⚠ CharBonusActions.jsx:221 — bonus-attack hit-cell onClick fires even when cannotAct (row only visually disabled), unlike damage cell guard :253; SAME pattern at CharActions.jsx:69 (spell hit cell) vs guarded :169 — looks like house convention where parent onAttackClick self-guards via assertCanAct denial popup; needs owner ruling. Run2 #22.
- ⚠ CharCharacterAdvancement.jsx:44 — object options never highlight: `opt === currentOption` compares object vs string fallback `options[0].name` (:32) → all object options render dim with no runtime pin; fix = compare resolved names. Run2 #32.
- ⚠ CharInventory.jsx:14 zero-handling asymmetry — `if (item.weight)` drops genuine weight:0 disk rows (equipment.json:127/167/467) while cost:{quantity:0} renders 'Cost: 0 gp' in same function; needs owner ruling. Run2 #35.
- ⚠ CharReactions.jsx:144 — guards `spellAbilities` but dereferences `.spells.length` unguarded; `{ spells: null }` character JSON crashes reactions section. Run2 #43.
- ⚠ CharReactions.jsx:336-343 — ReactionSpellRow hit/damage chips dispatch rollAttack/gateMetamagic WITHOUT isSlowed() guard (only name cell :331 gated) — slowed creature bypasses SP-109 block via chip. Run2 #50.
- ⚠ CharSheet.handlers.js:537 — psionicEnergy 0 + success logs 'Succeeded, energy expended' though nothing was expended (misleading prose); honestly pinned by handlers4 zero-energy test. Run2 #60.
- 🗑 CharReactions.jsx:407/417 — comment claims modalState/setModalState passed as props; signature ignores them (local useState) — caller-supplied props silently dropped; stale-doc + dead-prop cleanup. Run2 #43.
- ⚠ CharBonusActions.jsx:216 — hit cell renders literal 'NaN' when exhaustionPenalty prop undefined (confirmed live in test until :0 passed; real Intl.NumberFormat emits 'NaN'); :280 same class for saveDc+displaySaveDcBonus (lower confidence, current data always carries saveDc). Fix: default props. Run2 #27.

## 🗑 Dead exports / zero-consumer code (delete + retire pins)
- 🗑 CharSpecialActions.jsx:428 'Short Rest' restMessage ternary arm unreachable — ranger choice-lanes early-return :404-419 (run2 #73; tests pin not.toContain).
- 🗑 CharSpecialActions family mock bloat: handlers.test.jsx (52 inline mocks) + modalsInline.test.jsx (49) redeclare shared modalMocks.jsx — consolidation rec (run2 #68).
- 🗑 useAttackDamageResolution.js:361,366 leftover `[sw-debug]` console.log statements in production damage-resolution path (run2 #68).
- 🗑 CharSheet.test-utils.jsx:80-88 `export default` object — zero default-importers; all 12 consumers use named imports (run2 #66).

Full list grows in the ledger; headline entries: rollHealingForAction,
useActionPopup.loadBackgrounds, handle*Confirm trio, setUnerringStrikeUsed,
isLargeFormActive, restoreUses family, applyTelekineticLeap, isPsychicSpellsActive,
arcaneWardHandler 4/5, illusoryReality pair, magicalCunning isMagicalCunningUsed,
overchannel ×4, portent trio, massFear.handle, multiTarget selection flow,
applyFastHands, saveAttackHandler.isExhausted, boonOfRecovery pair,
animalFriendship pair, trapped-predicates ×4 (+twin export removals),
isCompelledDuelActive, commandHalt, globe ×4, isRegenerateActive,
applyEndOfTurnConfusionSave/removeConfusionEffect, processGreaseAreaSave,
rayOfEnfeeblementActive, truePolymorph 4-queries + summonCreatureFromObject,
loadFaction/loadNote/loadSettlement/saveSettlements, featBuff apply+clear
writer pair, featValidation getFeatTypeInfo + normalizeBackgroundFeatName,
matchesExtraReachCondition, druid getters ×3, applyExhaustionSpeedPenalty /
getTotalTravelTime, moveLinkBetweenSessions (+ Sessions.jsx inline-reimpl
refactor rec), tashas_laughter_damageTrigger write-only key,
computeSkilledToolUsage (dupe of skilled-pool.js math, #2064),
useActionGate (#2066), applyRaceBuffsToPlayerData + Trance re-push dead
branch (#2048), BASE_FEATURE/createMockAutomationExpressions/normalizeAbilityName
test-utils (#2092), infoBuilder elemental dead builders ×3,
useLoggedDiceRollEventHandlers:45-47 fake-registry rec (#2078).

## 📌 Deferred tidy-ups (post-queue)
- CharCharacterAdvancement.jsx:37-44 inline styles on Choice rows/highlight — violates no-inline-styles convention (behavior correct; run2 #31).

contextBuilder-cover deletion; grease wiring ticket; conditionMatches
extraction; Fast Hands dupes; relentless latch; massCureWounds spellAbilities
pin; prayerOfHealing:288 dupe; reactionBonusHandler.helpers inline-and-delete;
6-dead-predicates-one-commit; Sessions.jsx handleMoveLink→util refactor;
rulesFactory.test.js:436 + rules.getPlayerStats.test.js:305 toBeDefined()→
value-pins; reaction.test.js interception-pair shed (rec #2108);
infoBuilder.test-utils stale-fabricated alignment if it re-surfaces.

## Protocol for the fix pass

- One fresh subagent per bug (never batched), quoting this file's item +
  ledger section as evidence.
- Subagent scope: the named source file(s) + any test file whose honest pin
  must flip with the fix. Nothing else.
- Verify: scoped `npx vitest run --bail=1 <affected>` + `npx eslint`.
  Orchestrator runs `npm run lint && npm run test:run` once per ~5 fixes.
- Respect: no game timers, server-first state, registry-first effect keys,
  target-campaign lockdown, git read-only unless user grants commit rights.
- Campaign lockdown still applies; production campaigns untouched.
## Pass run2#136 (HurlThroughHellModal.resultScreen.test.jsx)
- 📌 rec->branches.test.jsx:517-593 — trim resultText assertions + Done-click now owned by resultScreen lane; keep ledger/popup pins only.
- 🗑 saveResults.test.jsx:111-114 — dead `4d10-custom` rollExpression arm — ✅ APPLIED run2#137 (deleted with redundant beforeEach re-arm block); phantom rec retracted@#137
- 📌 rec->HurlThroughHellModal.test.jsx:117-148 — 3 info-screen note tests overlap branches-lane exact note pins; consolidate to one when that file's turn comes.
## Pass run2#138 (HurlThroughHellModal.test.jsx)
- 📌 rec->HurlThroughHellModal-branches.test.jsx:294-312 — note-presence asserts duplicate base it.each arm matrix (base owns arm rendering); branches keeps inline-style flag + inert-seam pins only.
- 📌 rec->HurlThroughHellModal-branches.test.jsx:413-427 — uses-stamp re-pin (hurlThroughHellUses===1) duplicates base-owned stamp; trim to pact-ledger-unwritten + createSaveListener contract.
- 📌 flake watch: one unreproducible waitFor timeout in modals folder run under parallel load (not Hurl); monitor at next batch check.
## Pass run2#139 (InspiringSmiteModal.test.jsx)
- ⚠ InspiringSmiteModal.jsx:30 — updateAllocation clamps each target to tempHp individually, not to remaining pool; two targets can each take full 18-HP pool (sum 28>18) and handleConfirm submits it. 2024 rules: distribution must sum ≤ pool. Confirmed by test run (per-target clamp only). Source fix needed: clamp to remaining + guard confirm.
## Batch #134 flush (runs #141-#150)
- 📌 MassHealModal.jsx:21 — totalAllocated sums ALL allocations incl deselected; header "Allocated" can mislead vs confirmed payload (handleConfirm :64 iterates selected only). Cosmetic. (pass #143)
- 🗑 MoonlightStepResourceModal.jsx:35-44 — automation.conversionRate 'all_levels' branch dead: JSX hardcodes rows [2..9], any conversionRate renders identically. (pass #145)
- 📌 MoonlightStepResourceModal.jsx:28-31 — currentUses unclamped from runtime; stale value renders "Current uses: 5/2". (pass #145)
- 📌 OpenHandTechniqueModal.jsx:25 — handler resolving null silently re-renders selection UI, no error feedback (pinned honestly). (pass #149)
- 🔴 PolymorphSelectionModal.jsx:20-25 — filterBeastSpeeds gates on limitations.includes('fly'/'swim'); matches NEGATED default "walk only (no swim or fly)" so swim/climb/burrow render under walk-only limits (Wolf shows Swim 20). (pass #150)
- 🔴 PolymorphSelectionModal.jsx:24-25 — climb/burrow gated on hasSwim instead of own limitation keywords. (pass #150)
- 📌 rec PolymorphSelectionModal.test.jsx — mockMonsters copy-pasted from features lane (drifted); extract shared fixture module. (pass #150)
## Pass run2#152 (PolymorphSelectionModal.test.jsx)
- 📌 rec: features lane 'Walk 20' speed-display assertion + local fixture duplication in both Polymorph lanes — revisit when 🔴 PolymorphSelectionModal.jsx:20-25 fix lands; extract shared fixture then (new helper file needed — deferred).
- ⚠ flake watch: CampaignAdmin.data-management.test.jsx URL-encoding test fails under full-suite parallel load (green 3/3 isolated, batches #134). Not load-adjacent to maintained lanes; watch at batch #135.
## Batch #135 flush (runs #152-#165)
- 🔴 ResourcePoolModal.jsx:215-223 — handleArchdruidConvert never calls addEntry; Nature Magician conversions invisible in campaign log (violates every-automation-logs rule). Honestly pinned in test. (pass #161)
- 🗑 AOEConditionModal.advanced.test.jsx — vacuous expect(true) placeholder; DELETE on its turn (queued line 29). (pass #164)
- 📌 AOEConditionModal.test.jsx + advanced.test.jsx headers cite integration.test.jsx for coverage now owned by save-flow.test.jsx — fix pointers when those lanes are processed. (pass #164)
- 📌 PrimalCompanionSummonModal.jsx:59 — renders literal "AC undefined" if companion type lacks acFormula (real data always supplies). (pass #156)
- 📌 PrimalCompanionBonusActionModal.jsx — inline styles contrary to no-inline-styles convention. (pass #155)
- 📌 rec SearingVengeance: VitalityOfTheTreeModal.test.jsx + (done#140) MantleOfInspirationModal.test.jsx could adopt real-render pattern (no shared-modal mock) per ZealousPresence precedent. (pass #163)
## Pass run2#167 (AOEConditionModal.overlay.test.jsx)
- 🗑 AOEConditionModal.jsx:542-569 — handleSaveResultOverride near-verbatim clone of handleSaveResult (:378-414), differs only ctx-vs-state storage; source consolidation opportunity.
- 📌 AOEConditionModal.jsx:501,:596 — inline style={{...}} (project bans inline styles).
## Batch #136 flush (runs #171-#180)
- 🗑 AreaEffectTargetModalBase.utils.jsx:8 — heighten-radio deselect path unreachable (browsers don't fire change on selected radio; verified empirically). (pass #174)
- 📌 SecondaryTargetModal.jsx:140 — `!hideConfirm || targets.length>0` always-true when hideConfirm falsy; effectively dead conditional. (pass #176)
- 🗑 BonusActionChoiceModal.jsx:49-55 — useEffect cleanup setStates are post-unmount no-ops (React 18+); effect removable. (pass #177)
- 🗑 AreaEffectSaveFlow.utils.js — exports usePendingPromptsCleanup/mapCreatureTargets/buildCarefulPlayerSaveResult/resolveNpcCarefulSave/resolveNpcSaveSuccess/resolveNpcSaveFailure/resolveAllSavesPreamble: CalmEmotions reimplements inline; run dead-export audit. (pass #178)
- 📌 SaveAttackAoeModal.blocking-effects.test.jsx:144-147 — mocks AreaEffectTargetModalBase w/ hand-written eligibleTargets; verifies the mock, not base. Revisit on its turn. (pass #173)
- 📌 SetConditionModal.turnUndead.test.jsx:176 — CLA-303 partially overlaps base filter coverage; slim to wrapper-specific. (pass #173)
- 🗑 AreaEffectTargetModalBase.jsx:73-143 — four structurally identical get*Blocked callbacks; parameterize to one helper. (pass #171)
## Pass run2#185 (FearModal.player-saves.test.jsx) — URGENT cross-file bugs (recorded immediately, apply at owning turns)
- 🔴 FearModal.jsx:146-147 — careful-protected PLAYER targets: buildCarefulPlayerSaveResult pushed to results but addTargetResult/logSaveResultEntry never called; auto-success unrecorded (NPC leg logs fine via resolveNpcCarefulSave).
- 🔴 FearModal.jsx:229-234 — confirm with zero resulting prompts (all targets careful-protected) leaves modal stuck open: setPendingPrompts([]) never triggers dropPendingPrompt, no onClose path.
- 🔴 HealingIllusionModal.jsx:20-21 — custom-target maxHp silent-fallback to 0 when runtime hitPoints unset; Math.min(0, currentHp+heal) sets currentHitPoints to 0 (heal becomes damage). Violates no-fallbacks convention. (pass #189)
## Pass run2#191 (HypnoticPatternModal.metamagic.test.jsx)
- 🔴 HypnoticPatternModal.jsx:112-113 — careful-protected PLAYER target leaves no audit trail (in-memory result only; no addEntry/addTargetResult), NPC careful leg logs properly. Same defect family as FearModal.jsx:146-147 (#185). Honestly pinned (saveEntriesFor('PlayerAlly')=0).
- 📌 rec SaveAttackAoeModal.* family — ~100-line CreatureSelectionModal row-markup mock copy-pasted verbatim in >=6 test files (blocking-effects, damage-edge-cases, overlay, creature-selection, damage-resolution...); extract shared test-util (precedent: SaveAttackHealModal.test-utils.js) when those lanes are processed.
## Batch #137 flush (runs #181-#194)
- 🔴 CreatureSelectionModal.jsx:57 — heighten toggle-to-null unreachable (browsers no change event on checked radio); dead branch, deselect impossible via UI. (pass #182)
- 🔴 HandOfHealingModal.jsx:82 — sourceName template unclosed paren -> "Monk1 (Monk" in campaign log (only pin = test #188). (pass #187/#188)
- 📌 CombatStanceModal.jsx — inline style props violate no-inline-styles convention. (pass #181)
- 📌 HealingIllusionModal.jsx — description literal vs spell-data (design note only). (pass #194)
- 🔴 HypnoticPatternShakeModal.jsx:33-39 — executeHandler rejection: catch rethrows before setProcessing(false)/onClose(); modal stuck "Shaking target free..." + unhandled rejection. Deliberately unpinned. (pass #195)
## Pass run2#196 (MassSuggestionModal.pay-at-confirm.test.jsx)
- 📌 rec MassSuggestionModal.test.jsx — 6x hand-rolled select→confirm snippets -> shared helper; merge charmed-on-fail + persistAndNotify + storeSpellLastAttack (one path); merge pending-prompts vs save-prompt pair. 6->~3-4. (pass #196)
- 📌 rec MassSuggestionModal.saveResults.test.jsx — null/empty-detail + unknown-promptId guard rows -> parameterize. (pass #196)
- ⚠ MassSuggestionModal.jsx:202 vs :204 — pendingSaveListenerPrompts read omits campaignName arg while write passes it (symmetric signature mismatch; harmless under store defaults). (pass #198)
## Pass run2#199 (RecklessAttackModal.test.jsx)
- 🗑 RecklessAttackModal.jsx:82 — unreachable deselect ternary (radio change never refires when already checked); single-select cannot be unselected via UI — same defect family as CreatureSelectionModal.jsx:57 (#182).
- 📌 RecklessAttackModal.jsx:14,22,48-49,113,140 — inline style={{...}} throughout (no-inline-styles convention violation).
## Pass run2#200 (SaveAttackAoeModal.ac-penalty.test.jsx)
- ✅ TECHNIQUE PROVEN (updates #191 rec): SaveAttackAoeModal family ~100-line CreatureSelectionModal mock copies are REMOVABLE — real modal renders deterministically here (no campaignName/attackerName passed, overlay effect early-returns). Apply mock-removal at each sibling's own turn: blocking-effects, damage-edge-cases, overlay, creature-selection, damage-resolution.
## Pass run2#201 (SaveAttackAoeModal.blocking-effects.test.jsx)
- 🗑 SaveAttackAoeModal:60-line AreaEffectTargetModalBase mock was DEAD here (component never renders base without targetName). Same dead stub in damage-edge-cases:132, damage-resolution:133, overlay:132 (overlay lane may legitimately render base — verify per file at their turns).
- ⚠ SaveAttackAoeModal.creature-selection.test.jsx — asserts .careful-flag class invented by its local CreatureSelectionModal mock; real modal never renders it → test verifies mock, not app. Rework with real modal on its turn.
## Pass run2#206 (SaveAttackAoeModal.cold-gale.test.jsx) — 🔴 SYSTEMIC saveBonuses key-mismatch
- 🔴 encounterToInitiative.js:12-16 writes saveBonuses with ABBREV keys (dex/s Wis etc); full-name readers get silent +0: SaveAttackAoeModal.jsx:47, SavePromptModal.jsx:73, MassSuggestionModal.jsx:93, AOEConditionModal.jsx:113, SaveAttackHealModal.jsx:150, SetConditionModal.jsx:88, ElementalAttunementModal.jsx:397, radianceOfDawnHandler.js:69. applyDamage.js:135-136 falls back BOTH ways (canonical normalizer exists!). Probe evidence: Guard saveBonuses.dex=7 → saveBonus:0 logged. Fix at producer (write full keys) or normalize once at read. Tests pass because they pin raw rolls — real gameplay affected.
## Pass run2#208 (SaveAttackAoeModal.creature-selection.test.jsx)
- ✅ .careful-flag mock-artifact rec (#201) APPLIED — file reworked onto real CreatureSelectionModal; dead base stub + 7 unused mocks removed.
- 🗑 SaveAttackAoeModal.test.jsx — pure expect(true) placeholder w/ stale pointer comment; DELETE on its turn.
- 📌 rec shared kit: SaveAttackAoeModal.test-utils.js mock/config kit (precedents AttackRiderModal.test-utils.js / SaveAttackHealModal.test-utils.js) to collapse ~130-line boilerplate replicated across ~30 sibling lanes.
## Batch #138 flush (runs #197-#209)
- 📌 rec kraken-toxic-ink.test.jsx:189 null-clause twin weaker than :170 SUCCESS test — trim at its turn. (pass #207)
- 📌 rec damage-resolution.test.jsx:403 disadvantage weak (teeth live at :420 consume-test) — merge/strengthen there; :319 subsumed by :331. (pass #209)
## Pass run2#210 (SaveAttackAoeModal.damage-resolution.test.jsx)
- 📌 rec SaveAttackAoeModal.overlay.test.jsx — carries dishonest computeDamageAfterEvasion (halves even on failed saves) + unused computeDamageAfterSave export; honest-mock pass at its turn.
- 🔴 SaveAttackAoeModal.jsx:595 — ma0610TeDescriptors spreads recurringDie: zoneTe.recurringDie||undefined AFTER :610 derives recurringDie from zoneTe.damage → clobbers to undefined. Verified live: armed lair_insect_cloud tes lack recurringDie despite repeatTurnEnd+damage:'3d6'. Turn-end consumers see nothing. (pass #217)
- 📌 rec saveProcessing.ma0875-thp-grant.test.js:137-148 — standing-pool stacking re-tests tempHpBuffHandler.bolsteringTreats.test.js:146 owner semantics; trim to clause-channel proof at its turn. (pass #218)
- 🔴 AreaEffectTargetModalBase.jsx:173+214 / SaveAttackAoeModal.jsx:1934-1938 — overlay apply race: base allResolved reads its own selected (shadowed by extraState.selected → always empty), setSummary fires with ctx.results still empty one microtask before setResults lands; results panel renders header with ZERO rows. Reproduced live (pass #226, now non-vacuously pinned). Also triggers setState-during-render warning.
## Pass run2#234 (SaveAttackAoeModal.staged-petrify.test.jsx)
- ⚠ SaveAttackAoeModal.jsx:1298,:1995 — buildPickerCopy never receives stagedPetrify; armed Gorgon picker shows MA-0063 flat "Petrified, Restrained." copy (:1313) contradicting ladder fail#1=Restrained-only enforced on store. Copy-cosmetic.
- ⚠ SaveAttackAoeModal.jsx:1189 — resultRowText lacks staged-petrify branch; damageless staged fail renders generic "Failed the save" prose (sleep/paralysis have theirs at :1197).
## Batch #140 flush (runs #227-#239 addenda)
- 📌 rec cold-gale.test.jsx — abbrev saveBonuses { dex: N } mocks fold to 0 at :47; re-key full-lowercase at its next touch (pattern fixed #228/#233/#235/#237). (pass #228)
- 📌 rec sleepService.staged-breath.test.js:125 — lane uses abbreviated .con key naming; audit key convention vs modal family (full keys). (pass #235)
- 📌 SaveAttackHealModal.jsx:275,286 — inline style={{marginTop}} convention violations. (pass #239)
- ⚠ SaveAttackHealModal.jsx:197-200 — computes+displays half damage on player save SUCCESS but damage only ever applied via logFailedSaveDamage on failure (player HP adjudicated by separate prompt pipeline — likely intentional display-only; owner glance). Non-blocking. (pass #241)
- 📌 rec SaveAttackHealModal.test.jsx:33-36 — dead applyHealingDirectly mock (no consumer in import graph; verified fixed in saveFlows #241); trim at its turn. (pass #241)
## Pass run2#244 (SetConditionModal.sideEffects.test.jsx)
- 🔴 SetConditionModal.jsx:144-147 — failed player save WITH immunity: addConditionToCreature (immunity-checked internally) + logCondition + addExpiration called unconditionally → immune player logged "applied Frightened" + phantom expiration clock, no condition. Phantom visible in T1 control diff.
- 🔴 SetConditionModal.jsx:149 — player log formula saveBonus !== 0 check renders '1d20+undefined' when saveBonus absent (other fields coalesce ?? but formula doesn't).
- 📌 rec SetConditionModal.test.jsx — drop 2nd-render Roll:10+2=12 display dup (T3 #244 owns math); weak 'renders npc/player labels' getAllByText(/npc/)≥1 near-vacuous — strengthen or remove at its turn.
## Pass run2#247 (StealthAttackModal.test.jsx)
- 🗑 StealthAttackModal.jsx:32 — near-dead branch: sneak_attack_dice_value absent from all public/data → non-6 path unreachable; modal always renders d6 (harmless defensive fallback).
- 📌 StealthAttackModal.jsx:41 — cost hardcoded '{costD6}d6' vs derived d{value} available: cosmetic inconsistency if per-level key ever materializes (handler also hardcodes d6).
## Pass run2#249 (TashasLaughterModal.player-saves.test.jsx)
- 🔴 TashasLaughterModal.jsx:40 — buildLaughterSaveResultEntry guards saveBonus !== 0 only; undefined bonus leaks "rolled 0 + undefined = 0" into logged description (honestly pinned in sparse-detail test).
- ⚠ TashasLaughterModal.jsx:91 — Math.max(1, undefined)=NaN when spellSlotLevel missing → selection unlimited via NaN-tolerant guards; harmless with current callers, fragile.
## Pass run2#251 (ShieldBashChoiceModal.test.jsx)
- 📌 ShieldBashChoiceModal.jsx:50-66 — inline styles (no-inline-styles rule); "Push 5 feet" copy hardcoded, ignores caller action.options values (component hardcodes options, forwards action verbatim :15/:76).
## Pass run2#252 (SilenceModal.test.jsx)
- ⚠ SilenceModal.jsx:163 — description hardcodes "20-foot-radius sphere" while zone/log use aoeRadius prop (30 passed → writes 30 displays 20). Cosmetic copy/behavior mismatch.
- 🗑 SilenceModal.jsx:56-62 — empty-selection reset branch unreachable via real picker (confirm disabled at 0, shared handleConfirm guards length 0); defensive dead code.
## Pass run2#253 (SingleResistanceSelectionModal.test.jsx)
- 📌 SingleResistanceSelectionModal.jsx:30,36,39,77 — inline styles (no-inline-styles rule). (pass #253)
## Pass run2#254 (StepsOfTheFeyTauntModal.bewitching.test.jsx)
- 🗑 rec StepsOfTheFeyTauntModal.choiceStep.test.jsx + StepsOfTheFeyTauntModal.tauntingStep.test.jsx — vacuous placeholders ("all behavioral tests removed as redundant"); DELETE at their turns. (pass #254)
- 📌 StepsOfTheFeyTauntModal.jsx:368-395 — inline styles in renderChoiceStep. (pass #254)
## Pass run2#257 (StepsOfTheFeyTauntModal.dreadfulStep.test.jsx)
- 🔴 StepsOfTheFeyTauntModal.jsx:129 — handleSkip modeLabel from mode not choice: skipping Dreadful Step in normal mode logs "<b>Taunting Step:</b> No targets selected." wrong label.
- ⚠ StepsOfTheFeyTauntModal.jsx:278-289 (+taunt twin :176-187) — save-result window listeners removed only on event arrival; closing modal with pending saves leaks listeners + resolves against unmounted state (cross-modal clobber class).
- 📌 rec noUses/refreshingStep tests — same dishonest createSaveListener arg-destructure + shared prompt-<name> ids latent collision; honest-mock treatment at their turns. (pass #257)
## Pass run2#258 (StepsOfTheFeyTauntModal.integration.test.jsx)
- ⚠ COVERAGE GAP: taunting confirm lane (handleTauntConfirm: save dispatch, taunting_step targetEffects upsert, expiration, save_result logs) covered NOWHERE after tauntingStep vacuous-deletion. RESTORE step-lane file mirroring dreadfulStep #257 when tauntingStep.test.jsx is processed. (pass #258)
- 📌 cosmetic: freeCastCountKey null → result text renders (newCount-1) remaining but writes no decrement (defensive branch only). (pass #258)
## Pass run2#259 addenda
- 📌 rec StepsOfTheFeyTauntModal.render.test.jsx:73-78 + :114-118 header-title dupes consolidate; :101-112 skip-label merge. (pass #259)
## Pass run2#260 (StepsOfTheFeyTauntModal.refreshingStep.test.jsx)
- 🔴 StepsOfTheFeyTauntModal.jsx:99-108 — applyRefreshingStep never addEntry: refreshing free-cast resolution unlogged (app rule "every automation must log"); same gap :110-126 disappearing lane. Not pinned to avoid cementing.
- 📌 rec render.test.jsx — dishonest createSaveListener arg-0 mock (uninvoked there) + 7 single-assert tests consolidate to ~3. (pass #260)
## Pass run2#262 (StepsOfTheFeyTauntModal.tauntingStep.test.jsx)
- ✅ COVERAGE GAP CLOSED (flagged #258): taunting confirm lane rebuilt as 2 real tests (upsert/save_result/expiration/indefinite-wait pins). Gap entry resolved.
## Pass run2#265 (TacticalMasterModal.test.jsx)
- 📌 rec ~10 CharActions.*.test.jsx identical vi.mock('./modals/TacticalMasterModal.jsx') boilerplate — extract shared test-helpers factory (maintenance, not coverage). (pass #265)
## Pass run2#271 (WarMagicSpellModal.test.jsx)
- ⚠ warMagicSpellHandler.js:31 — options filtered by level only, no casting_time check: reaction spells (Shield) offered though modal prompt hardcodes "(casting time: action)" + 2024 Improved War Magic requires 1 action.
- 📌 WarMagicSpellModal.jsx:41-71 — inline styles; option rows plain divs (no roles) forcing text queries. (pass #271)
## Batch #142 flush (runs #261-#274 addenda)
- 🗑 rec WeaponKindMasteryModalResult.test.jsx:116 — dangerouslySetInnerHTML test matches plain text, proves nothing; assert <strong> or delete. WeaponKindMasteryModalWeaponList.test.jsx:154 + Selection.test.jsx:58 renderWithWeapons(props-as-overrides) signature normalize. (pass #273)
- 📌 rec integration.test.jsx:76-78 click on non-interactive <p> is no-op — simplify to assertion. (pass #261)
- 📌 rec AnimalShapesSelectionModal.test.jsx + .behavior.test.jsx coexist — audit consolidation when processed. (pass #267)
## Pass run2#277 (WeaponKindMasteryModalWeaponList.test.jsx)
- 📌 rec WeaponKindMasteryModalResult.test.jsx — missing resetWeaponsCache() in beforeEach; module fetch-cache bleed risk across file order (#276/#277 lesson). File already marked; queue re-touch for this nit. (pass #277)
## Pass run2#278 (WeaponMasteryChoiceModal.test.jsx)
- 📌 WeaponMasteryChoiceModal.jsx — inline styles throughout (convention). (pass #278)
## Pass run2#279 (WeaponMasteryModal.test.jsx)
- 🔴 WeaponMasteryModal.jsx:78 — selection body <p> interpolates `against <b>${targetName}</b>` as plain JSX text (no dangerouslySetInnerHTML) → UI shows literal <b> markup. Cosmetic; honestly tolerated in tests.
## Pass run2#282 (ZealousPresenceModal.test.jsx)
- 📌 SearingVengeanceModal.test.jsx:6 cites now-nonexistent "ZealousPresenceModal precedent" real-modal rendering — stale comment; reword at its turn. (pass #282)
## Pass run2#283 (normalizeAutoDamage.test.js)
- 🗑 rec useAttackDamageResolution.standalone.test.js:288-481 — describe('normalizeAutoDamage') block duplicates canon now in normalizeAutoDamage.test.js (weaker per-property); delete block at its turn, keep :1-286 pipeline-ctx unique. (pass #283)
- ⚠ useAttackDamageResolution.js:136 — empowered evocation guarded intMod > 0: negative INT contributes 0 instead of subtracting (benign/likely deliberate clamp). (pass #283)
## Pass run2#287 (MultiTargetCountPopup.test.jsx)
- 🗑 MultiTargetCountPopup.jsx — dead export: zero importers app-wide (hosts use MultiTargetPopup.jsx); candidate deletion along with its test.
- 🗑 MultiTargetCountPopup.jsx:43-57 — inline styles + legacy metamagic-twin-target class.
- 📌 TargetPopupBase.jsx has NO own spec — base subtitle/fallback/Escape re-pinned through 4+ child popups; consider creating base spec then trim child dupes (SingleTargetPopup.test.jsx:109, TargetWithCheckboxesPopup.test.jsx:308). (pass #287)
## Pass run2#288 (MultiTargetPopup.test.jsx)
- 🗑 MultiTargetPopup.jsx:4 — _playerStats dead destructure (call site passes playerStats; component ignores). Cosmetic.
- 📌 base-fallback 'Spell' now pinned in exactly 3 consumer specs (SingleTarget:49, MagicMissile:44-45, TargetWithCheckboxes:309) — consolidate into dedicated TargetPopupBase.test.jsx when created (also absorb Escape-guard dupes). (pass #288)
## Pass run2#289 (SingleTargetPopup.test.jsx)
- 🗑 SingleTargetPopup.jsx — dead export: zero production importers repo-wide (orphan awaiting rewire/deletion); :37-51 inline styles too. (pass #289)
- 📌 base-fallback consolidation plan: keep MagicMissile :44-45 exact-line as sole 'Spell' owner at popups-lane level; drop TargetWithCheckboxes:309 + remaining Escape-guard dupes (:297/:135, MultiTargetCount:106, Flurry:116) when dedicated TargetPopupBase.test.jsx created. (pass #289)
## Pass run2#290 (TargetWithCheckboxesPopup.test.jsx)
- ⚠ COVERAGE GAP (base): TargetPopupBase.jsx spell?.name||'Spell' fallback + keydown guard now have NO direct pin via any consumer (MagicMissile :44-45 covers its OWN expression, not base; Single/Multi dropped theirs). CREATE TargetPopupBase.test.jsx; then update stale header notes MultiTargetPopup.test.jsx:8-11 + SingleTargetPopup.test.jsx:9-11. Priority raised.
- 📌 a11y design debt: base + TargetWithCheckboxes render clickable <div> rows (no button/checkbox role) — family forced to getByText; role pass would simplify. (pass #290)
## Pass run2#291 (TargetWithTypePopup.test.jsx)
- 🗑 unattributable cancelLabel||'Cancel' default pin pattern (base TargetPopupBase.jsx:7 re-supplies): deleted here; recommend same cut at TargetWithCheckboxesPopup.test.jsx:69. TargetWithTypePopup.jsx:43-83 inline styles. (pass #291)
## Pass run2#292 (ShortRestButton.test.jsx)
- 📌 CharSummary host mocks inconsistent: ~20 siblings mock ShortRestButton as non-clickable <div data-testid> vs CharSummary-Prerequisites real <button onClick> — standardize on <button> so click-path hosts can't pass vs non-clickable div. (pass #292)
## Pass run2#293 (ShortRestModal.celestialResilience.test.jsx)
- ⚠ ShortRestModal.jsx:900 — picker description hardcodes "up to 5 allies" while maxTargets is a separate prop; copy drifts if maxTargets!=5. (pass #293)
## Pass run2#294 (ShortRestModal.completionFlow.test.jsx)
- 🗑 rec ShortRestModal.coverage.test.jsx:414 — "completing without Natural Recovery selections" asserts only modal mounted (vacuous); fold refusal into naturalRecovery lane at its turn.
- 📌 rec ShortRestModal.test.jsx:399 — "restores sorcery points" asserts only spCalls.length>0; strengthen exact writes ('sorceryPoints',5 + sorcerousRestorationUses:0) at its turn. (pass #294)
## Pass run2#295 (ShortRestModal.coverage.test.jsx)
- 📌 rename candidate ShortRestModal.coverage.test.jsx -> ShortRestModal.memorizeSwap.test.jsx (contents now CLA-226-only). rec base ShortRestModal.test.jsx:26 unimported rollExpression mock cleanup. ✅ coverage:414 vacuous removed (rec #294 consumed). (pass #295)
## Pass run2#296 (ShortRestModal.naturalRecovery.test.jsx)
- 🔴 ShortRestModal.jsx:175-179 — collectRestoredResources resourceLabels.find(r => r.key === key) but getShortRestResourceLabels returns STRINGS (restRules-constants.js:41 .map(e=>e.label)) → never matches; base-class restored-resource labels silently absent from short-rest log/UI. Dead branch, masked by string-array mock in tests.
## Pass run2#297 (ShortRestModal.test.jsx)
- ⚠ ShortRestModal.jsx:688 vs :788 — replenishingMeals decremented at roll time AND again at completion from fresh runtime value; possible double-decrement. Probe in completionFlow lane (already marked; needs re-touch for probe) or restRules lane.
- 📌 rec completionFlow: plain-cleric getShortRestResourceLabels:()=>[] mocks hide :175-179; add one producer-shaped ['Channel Divinity'] completion test pinning missing log-label at message layer. (pass #297)
## Pass run2#298 (useAttackDamageResolution.advancedAutomations.test.js)
- 📌 cantripBonuses.js grantCantripTempHp modal-interrupt branch pinned by NO lane (step-internal); candidate for dedicated steps/features/cantripBonuses.test.js. (pass #298)
## Pass run2#299 (useAttackDamageResolution.automationDamage.test.js)
- 🔴 useAttackDamageResolution.js:361,366 — leftover [sw-debug] console.log in production source, fires every damage pass (debug litter, removal candidate).
- 🗑 attackRollBonuses.js:85-86 — silently drops non-canonical flat frenzy expressions ('rage_damage'); harmless (registry canon rage_damage_d6) but silent-zero class. (pass #299)
## Pass run2#300 (useAttackDamageResolution.automations.test.jsx)
- 📌 attackRollDamageSteps-automationBonuses.test.js heavily duplicates -weaponHitBonuses + -natural20-celestial + colossusSlayer step tests (~40 redundant step-level its) — queue merge consideration. (pass #300)
## Pass run2#301 (useAttackDamageResolution.classFeatures.test.js)
- 🔴 superiorHuntersPrey.js:74-79 — async applyDamageToTarget NOT awaited: damage log finalDamage=undefined + popup spreadFinalDamage/spreadTargetCurrentHp=undefined (honestly pinned in hook lane).
## Pass run2#306 (useAttackDamageResolution.maneuvers.test.js)
- 🗑 rec useAttackDamageResolution.skipManeuver.test.js:111-121 — weak legs superseded by maneuvers skip fold here; candidates for deletion at its turn (verify mock-pipeline setup serves no other purpose). ✅ :439-456 drop consumed (#305 rec).
## Pass run2#307 (useAttackDamageResolution.mn014.test.js)
- ⚠ handleAttackRiderManeuverUse gates precision miss on mounted popupHtml prop not popupHtmlData arg: miss w/ null mount-popup silently routes hit post-resolution path (by-design-ish, damage lands safely). (pass #307)
## Pass run2#309 (useAttackDamageResolution.opportunity-transport.test.js)
- 🔴 useAttackDamageResolution.js:371-383 — hook-path proceedWithDamage minimalCtx omits isOpportunityAttack while standalone twin includes it (:57): OA marker dropped if OA resolves w/o buildCtxSync → Charger/Sentinel gates mis-fire. Reachability unverified; review.
- 🗑 rec standalone.test.js:168-285 proceedWithDamage/ctx-defaults twin describes near-identical — fold it.each at its turn (alongside existing 🗑 :288-481).
## Pass run2#310 (useAttackDamageResolution.optionSelect.test.js)
- 🔴 useAttackDamageResolution.js:555-562 — validation-after-mutation: maneuver-less payload closes modal + latches _brutalStrikeActive/_brutalStrikeEffects BEFORE rejecting → stuck latch (unreachable from InlineChoiceModals which always supplies maneuver; honest pin in lane).
- ⚠ useAttackDamageResolution.js:588 — speed-reduction log hardcodes "15 feet" ignoring option.value distance (cosmetic log).
- 🗑 rec skipManeuver.test.js:124-152 — describe('handleAttackRiderOptionSelect') block strictly weaker dups of optionSelect core lane; delete block at its turn. (pass #310)
## Pass run2#316 (useAttackDamageResolution.tacticalMaster.test.js)
- 🔴 attackRollPostDamage.js:713-714 — masteryDone marker step subscribes 'cleave:check' but sits after toppleMastery (emits 'mastery:done'); fires early, pipeline:complete precedes mastery resolution. Harmless today, latent ordering defect.
## Pass run2#318 (useCharActionModals.additional.test.js)
- 📌 rec useCharActionModals.maneuverHandlers.test.js — 3 typeof+callable smokes subsumed by own identity test; collapse to 1. integration.test.js — :183 typeof->toBe identity, fold objectContaining args byte-exact. modalState.test.js — falsy-clear it.each fold candidate. (pass #318)
## Pass run2#319 (useCharActionModals.integration.test.js)
- 🗑 rec useCharActionModals.maneuverHandlers.test.js DELETE outright (all tests vacuous/typeof/identity-superseded by integration #319 24-key loop). modalState.test.js:112-115 typeof droppable. (pass #319)
## Pass run2#322 (useCharActionsAttackHandlers-2.test.js)
- 🗑 rec useCharActionsAttackHandlers.brutalGate.test.js — arms-on-confirm + cancel-clear tests now subsets of -2 lane (byte-exact stronger); delete those 2, keep 4 chooser-gate tests.
- 🗑 rec useCharActionsAttackHandlers.test.js:2 — strip legacy @improved-by-ai marker.
- ⚠ useCharActionsAttackHandlers.js:248,283 — offered-latch stamp hardcodes round:1 (decorative today; misreports if ever round-consumed). (pass #322)
## Pass run2#324 (useCharActionsAttackHandlers.cla143-stamp.test.js)
- 📌 unowned write seam: _bonusActionAttackRound FT-036 (useCharActionsAttackHandlers.js:109) — no dedicated write test anywhere (only read stubs grappler.test.js); pinned incidentally as positive leg here; candidate FT-036 lane. (pass #324)
## Pass run2#326 (useCharActionsAttackHandlers.improvedBrutalStrike.test.js)
- 📌 gap: effectChoices.join(' + ') || 'no effect' empty-choice branch unpinned anywhere (candidate -2 lane touch). (pass #326)
## Pass run2#328 (useCharActionsAutomation.cla143-gate.test.js)
- 📌 rec useCharActionsAutomation.test.js:713 toBe byte-exact (absorbs #5 strength); :320-419 for..of twin loops -> it.each fold at own pass; setup.js:2 legacy @improved-by-ai marker replace at own pass. (pass #328)
## Pass run2#330 (useCharActionsAutomation.stunning-strike.test.js)
- 🗑 rec useCharActionsAutomation.test.early-returns.js — duplicates base FP-spend/_trackedResources/dispatch-event tests (:250-636); whole-file delete/trim candidate at its turn.
## Pass run2#333 (useCharActionsBaseActions.grapple-contest-math.test.js)
- 📌 rec useCharActionsGrappleAction.test.js — :524-566 sign-format weak near-dups consolidate; :197 JoAT + :516 exhaustion vacuous toHaveBeenCalled only (now pinned exact here); :401 smelly two-same-name-fixture rewrite. (pass #333)
- 📌 design note useCharActionsBaseActions.js:473 — contest tie = defender-win (PHB DM-discretion, adjudication choice). (pass #333)
## Pass run2#334 (useCharActionsCleave.test.js)
- ⚠ useCharActionsCleave.js — cleave attack roll uses raw Math.random() (not diceRoller d20 path): opaque to global dice-seeding infra. (pass #334)
## Pass run2#336 (useCharActionsGrappleAction.test.js)
- 🗑 rec CharActions.grapple.test.jsx:6 — stale header cites nonexistent useCharActionsBaseActions.test.js; should name useCharActionsGrappleAction.test.js. (pass #336)
## Pass run2#337 (useCharActionsHideAction.naturallyStealthy.test.js)
- 📌 computeStealthBonus :52 stealthSkill?.bonus ?? 0 - exhaustionPenalty precedence smell (benign today); :53 constant-false includes('Stealth') oddity (outside lane). (pass #337)
## Pass run2#338 (useCharActionsHideAction.test.js)
- 🔴 useCharActionsBaseActions.js:52 — `bonus ?? (0 - penalty)` precedence: listed Stealth bonus silently skips exhaustion subtraction.
- 🗑 useCharActionsBaseActions.js:53-58 — statically-false includes('Stealth') (wisCheckReplace unreachable for Hide) + tautology 'Stealth'==='Stealth' — vestigial generic conditions. (pass #338)
## Pass run2#340 (useCharActionsModalHandlers.buffs.test.js)
- 📌 rec useCharActionsModalHandlers.inspiration.test.js — same bloat pattern: 14 mocks -> routed trio, triples fold 3->2 per handler (mirror #339/#340). healing/combatSuperiority siblings — audit mock preambles at own turns. (pass #340)
## Pass run2#341 (useCharActionsModalHandlers.combatSuperiority.test.js)
- 🔴 useCharActionsModalHandlers.js:65-80 — handleCommanderStrikeChoiceConfirm never flushes result.logEntries (commander_superiority grant log from combatSuperiorityUtils.js:298 silently dropped — same class as fixed MN-002). Add flush table row when fixed.
## Pass run2#343 (useCharActionsModalHandlers.inspiration.test.js)
- 📌 rec useCharActionsModalHandlers.test.js base — bardic/reactionBonus mock block redundant overlap (never routes them); trim at own turn. rec oceanicGift lane mirror #339-#343 canon when queued. (pass #343)
## Pass run2#346 (useInitiativeEffects.activeStateClearing.test.js)
- 🔴 useInitiativeEffects.js:324,330 — clearLivingLegend invoked twice same handler (doubled writes/SSE churn, dead dup).
- ⚠ useInitiativeEffects.js:152 — vow lane re-writes target activeBuffs unconditionally (no only-if-changed guard like clearActiveBuffsWhere) — SSE echo churn.
## Pass run2#347 (useInitiativeEffects.batchResets.test.js)
- 🗑 useInitiativeEffects.js:410 — dead guard Object.keys(updates).length>0 always true (builder unconditionally sets >=8 keys).
- 🗑 rec useInitiativeEffects.edgeCases.test.js:406-423 weak FT-007 find-in-updates (subsumed byte-exact here); buffClearing:444-456 guard restatement. (pass #347)
## Pass run2#348 (useInitiativeEffects.buffClearing.test.js)
- 🔴 useInitiativeEffects.js:111 — setRuntimeValue called with 5th skipSync arg; signature takes 4 (useRuntimeState.js:78) — silently ignored, writes always POST (misleading vs AGENTS.md skipSync guidance).
- 🗑 rec useInitiativeEffects.initiativeRolled.test.js:636-658 superior-defense restatement (weaker, no final-state). (pass #348)
## Pass run2#350 (useInitiativeEffects.concentrationClearing.test.js)
- 🗑 rec useInitiativeEffects.edgeCases.test.js:426-453 + :324 — same concentration guard/undefined-spell paths now covered here with seeded-store tables; consolidate at edgeCases turn. (pass #350)
## Pass run2#351 (useInitiativeEffects.concentrationClearing2.test.js)
- 🔴 useInitiativeEffects.js:163-171 — restoreCalmEmotions captures conditions once per effect: multi-suppressedConditions (['Frightened','Charmed']) second write clobbers first restore (fake-store reproduced).
- 🗑 rec edgeCases.test.js:244,274,297 Calm guard dups (weaker than guard table here); :324 overlap. (pass #351)
## Pass run2#357 (useModalHandlers-damage.test.js)
- 🔴 useModalHandlers.js:102 — damageType formula bracket rewrite runs unconditionally: annotation replaced even when _damageTypeModifier absent (label altered, resource unspent). Latent; UI likely always supplies.
## Pass run2#358 (useModalHandlers-features.test.js)
- 🗑 rec useModalHandlers.test.js:70 — fold ref-passthrough twin into test 1 (same path). useModalHandlers-simple.test.js:47 — fold mastery-name no-op into clear-modal test. (pass #358)
## Pass run2#359 (useModalHandlers-flurry.test.js)
- 📌 design: useModalHandlers.js — CLA-144 confirm-flow triplicates result-handling (differ only in healingTarget arg); refactor candidate. (pass #359)
## Pass run2#362 (CascadingSelect.test.jsx)
- 📌 CascadingSelect.jsx — zero production importers (orphan component candidate; only consumer of its own test). (pass #362)
## Pass run2#366 (FeyTouchedModal.test.jsx)
- 🗑 rec MagicInitiateModal.test.* — overlay/modal-body 'does not close' twins vacuous if .mi-overlay handlerless (same pattern as FeyTouched); trim at own turns. (pass #366)
## Pass run2#367 (MagicInitiateModal-SpellDetails.test.jsx)
- 🗑 rec MagicInitiateModal.test.core.test.jsx:217,:226 — overlay/modal 'does not close' vacuous (.mi-overlay handlerless, confirmed MagicInitiateModal.jsx). (pass #367)
## Pass run2#368 (MagicInitiateModal-validation.test.jsx)
- 🗑 rec (confirmed) MagicInitiateModal.test.core :217/:226 vacuous overlay clicks; MagicInitiateModal.test.save:106 error-text shrink candidate. (pass #368)
## Pass run2#369 (MagicInitiateModal.test.core.test.jsx)
- 🗑 rec MagicInitiateModal.test.summary:91 fold Save-All-presence into :25; .test.save:11-58 consolidate nth-call twins into one sequence test. (pass #369)
## Pass run2#372 (SelectableList.test.jsx)
- 🗑 SelectableList.jsx:198-204 — isRepeatable toggle branch byte-identical to non-repeatable (dead ternary, simplification candidate). (pass #372)
## Pass run2#377 (WizardStepAbilities.point-buy.test.jsx)
- 🗑 rec WizardStepAbilities.test.js[x]:174 trim base-score half (shadowed by point-buy refund pins); stale mock total_points:24 vs disk rules-validation.json:27 — align at own turn. (pass #377)
## Pass run2#379 (WizardStepBackground.test.jsx)
- 📌 public/data/2024/backgrounds.json — OCR typos in descriptions (modicu1n/poweer/me1nories); cosmetic, report-only. (pass #379)
## Pass run2#380 (WizardStepBasic.test.jsx)
- 📌 WizardStepBasic.jsx:8-10 — fetch never checks response.ok before .json() (404 HTML -> misleading parse-error in catch; handled). (pass #380)
## Pass run2#381 (WizardStepClass.test.jsx)
- 🔴 ClassDetailCard.jsx:13 — 5e proficiencies (includes Armor/Shields disk data) rendered under label 'Weapon Proficiencies' — mislabel on 5e cards.
- 🗑 WizardStepClass accepts+ignores classSubtypes prop (dead surface; wizard passes it down generically). (pass #381)
## Pass run2#382 (WizardStepFeats.test.jsx)
- 🔴 WizardStepFeats.jsx:16 — 'Add Another' calls onToggle → SelectableList toggle removes ALL instances of repeatable feat instead of adding (pinned honest-flip test in lane).
- 📌 FeatItemDetails.jsx:13 — dict prerequisites render raw JSON (cosmetic). (pass #382)
## Pass run2#387 (WizardStepRace.test.jsx)
- 🗑 sign-off candidate: CascadingSelect.jsx + .test.jsx orphan pair confirmed (wizard renders plain select) — recommend delete pair.
- 📌 CharacterCreationWizard.integration.test.jsx:33-35 fake race fixtures (strings vs disk objects) — disk-import upgrade when lane touched. (pass #387)
## Pass run2#390 (WizardStepSkills.skill-cap.test.jsx)
- 🗑 rec WizardStepSkills.test.jsx:340 mislabeled non-feedback test (dup of :168-181); double-render splits :79-85/:100-105/:548 split scenarios. (pass #390)
## Pass run2#391 (WizardStepSkills.test.jsx)
- 🔴 WizardStepSkills.jsx:255-257 — 'select proficient first' feedback unreachable: Elevate disabled :352 blocks click reaching guard (dead branch). (pass #391)
## Pass run2#392 (WizardStepSpecial.test.jsx)
- 📌 WizardStepSpecial.jsx:29 — comment claims duplicate-name check; none exists (misleading, unimplemented intent). (pass #392)
## Pass run2#393 (WizardStepSpells.feature-touched.test.jsx)
- 📌 WizardStepSpells.jsx:41 vs :215/228/240 — banner gate (featNameMatches, object feats) wider than auto-open gate (string/f.index only): index-less object feat shows banner, never auto-opens.
- 🗑 rec WizardStepSpells.test.jsx summary-header test subsumed by breakdown test — trim at own turn. (pass #393)
## Pass run2#394 (WizardStepSpells.ritual-master.test.jsx)
- 🔴 WizardStepSpells.jsx:105 — ritualMasterChosenCount .length on non-array (string 'Alarm' -> bogus 'Edit Ritual Spells (5)' banner post-close; live-verified).
- 📌 RitualMasterModal.jsx — NO test lane exists (save contract :37 + ritual filter uncovered) — queue dedicated lane when surfaced. (pass #394)
## Pass run2#397 (WizardStepSubrace.test.jsx)
- 🔴 WizardStepSubrace.jsx:11 — array damage_resistance interpolates join-less ('Bludgeoning,Piercing,Slashing damage.'); real disk Genasi data, cosmetic misformat. (pass #397)
## Pass run2#398 (WizardStepTools.test.jsx)
- 🗑 computeSkilledToolUsage (toolValidation.services.js) dead export (local dup in skilled-pool.js) — wire or delete; WizardStepTools.jsx:46-64 toolsFromSkilled computed-never-rendered. (pass #398)
## Pass run2#399 (EncounterBuilder.additional-interactions.test.jsx)
- 🗑 rec DELETE-outright x4: EncounterBuilder.{interactions,modal-flows,modal-interactions,gameplay-flows}.test.jsx all vacuous expect(true) zero-importer placeholders; .rendering.test.jsx dup-candidate. (pass #399)
## Pass run2#401 (EncounterBuilder.helpers.test.jsx)
- 🔴 EncounterFilterPanel.jsx:7 — onEnvironmentChange received, no control rendered (_alias): filter.environment unreachable from UI (legacy localStorage only).
- 📌 encounterConfig.js:39 — stale comment '/ multiplier' vs builder '*' at EncounterBuilder.jsx:246. (pass #401)
## Pass run2#403 (EncounterBuilder.load-encounter.test.jsx)
- 📌 Encounters test utils: createManagement/renderWithLoadEncounter verbatim-cloned across reset-encounter:377-427/panel-interactions/remaining/rendering/uncovered-handlers — extract shared encounterTestUtils.js candidate.
- 📌 EncounterBuilder.jsx:376-377 — mutates caller's loaded data object pre-updateEncounter (observable shared-object mutation). (pass #403)
## Pass run2#406 (EncounterBuilder.panel-interactions.test.jsx)
- 🗑 rec remaining.test.jsx:452-479 + :513-542 weaker dups of panel-interactions byte-pins — delete at remaining turn; EncounterBuilder.test-utils.jsx now ORPHAN (sole consumer dropped it) — delete; rendering.test.jsx ~340L mock bloat rewrite candidate. (pass #406)
## Pass run2#407 (EncounterBuilder.remaining.test.jsx)
- 🗑 EncounterBuilder.test-utils.jsx ORPHANCONFIRMED (remaining also off it) — delete candidate; reset-encounter/rendering/uncovered-handlers carry replica-mock blocks (#406 rebuild pattern); additional-interactions header stale claims (retired @#407). (pass #407)
## Pass run2#410 (EncounterBuilder.uncovered-handlers.test.jsx)
- 🔴 EncounterModal.jsx:55 + EncounterBuilder.jsx:416 — double delete-confirm dialogs per user delete.
- 🔴 EncounterModal.jsx:145 vs :95 — rename UI unreachable: pen sets modal-local renameTarget but form renders only prop mode==='rename'; builder passes only save|load — handleRenameEncounter dead in prod UI. (pass #410)
## Pass run2#412 (EncounterGeneratorModal.test.jsx)
- 🗑 EncounterGeneratorModal.jsx:49-61 — generating flag set true/false around SYNCHRONOUS call in one handler: spinner branch (:128) dead UI. (pass #412)
## Pass run2#416 (EncounterSummaryPanel.test.jsx)
- 📌 EncounterSummaryPanel.jsx:51 — inline style textAlign:'center' violates no-inline-styles convention. (pass #416)
## Pass run2#417 (MonsterAction.gated-reaction.test.jsx)
- 🗑 rec MonsterCardHelpers.gated-reaction.test.js — getGatedMonsterReaction null-negative repeated verbatim x3 (MA-0341:360, MA-0681:640, :62); one suffices. (pass #417)
## Pass run2#419 (MonsterAction.ma0286-slam-suppression.test.jsx)
- 🗑 rec: attackRowMissingToHit(toBe(false)) guards duplicated ~40x across MA-#### consumer files — trim to helper-truth-table owner only; unrollable-damage.test.jsx:90 Club 'MA-0286 flip' weaker twin of ON leg. (pass #419)
## Pass run2#421 (MonsterAction.ma0300-arcanaloth-chip.test.jsx)
- 🗑 rec: ma0305-arch-hag-chip + ma1120-mage-chip are byte-twins of ma0300 (disk-verified; chip label from registry) — fold to one it.each over 3 disk rows, retire both files at own turns. (pass #421)
## Pass run2#487 (MonsterAction.ma1680-warrior-commander-longbow-hit-target-effect.test.jsx)
- 📌 cosmetic: stale cross-ref ma0995:19 points at ma1680's now-deleted twin tests :58-63 — relabel at ma0995 own turn. (pass #487)
## Pass run2#496 (MonsterCard.ma1971-wing-defense.test.jsx)
- 📌 stale xref: ma1071-pincer-staff-dc0-gate.test.jsx:12 cites ma1971-wing-defense :95 — assertion moved to :71; relabel at ma1071 own turn. (pass #496)
## Pass run2#497 (MonsterCardHelpers.ac-penalty.test.js)
- 🗑 rec: saveProcessing.ac-penalty.test.js:69,87 + SaveAttackAoeModal.ac-penalty.test.jsx:70,82,146 call parseAcPenaltyClause directly — pin literal bytes + cite new owner at own turns. (pass #497)
## Pass run2#499 (MonsterCardHelpers.banish-transport.test.js)
- 🗑 rec: monsterLairActions.test.js:1075/:2787 duplicate parseBanishTransportClause→null legs — fold to one at own turn. (pass #499)
## Pass run2#500 (MonsterCardHelpers.berserk-lashing.test.js)
- 🔴 MonsterCardHelpers.js:2529-2532 — attackReactionFoldCheck Number(attack_bonus) maps null→0 (finite!), attack_bonus:null + rollable dice slips isFinite guard, folds false +0 auto-hit (violates MA-0286 :521 promise). Pinned as labeled TRIPWIRE row in fold table; test-only, source unfixed.
- 🗑 rec: monsterLairActions.test.js:1075/:2787 duplicate parseBanishTransportClause→null legs fold to one. (pass #500)
## Pass run2#501 (MonsterCardHelpers.both-outcomes.test.js)
- 🗑 rec: legendary-arcane-prowl-sphinx:205-206 + valor:197-198 + monsterLairActions:4442-4444 re-assert parseBothOutcomesClause→null — subsumed by guardrail scan; drop at own turns. (pass #501)
## Pass run2#502 (MonsterCardHelpers.cataclysm-rays.test.js)
- 🗑 rec: spectator-eye-rays:99-108 + gazer-eye-rays:71-79 duplicate reroll/exhaust guard of eye-rays:196-226 — collapse to seam lines; eye-rays:124-130 upgrade 4x toMatch→toBe. (pass #502)
## Pass run2#504 (MonsterCardHelpers.damageless-spell-save-leg.test.js)
- 🗑 rec: MonsterCardModal.ma0536:225 Mass-Suggestion-null dup of :484 row; barlgura:199-202 guard dup already pinned x2 — trim at own turns. (pass #504)
## Pass run2#507 (MonsterCardHelpers.flat-hit-damage.test.js)
- 🗑 rec: ma0885-goat-ram-charge:201 authored-dp JSON-echo trim; ma0747-composite-damage:52-64 crit-invariance half overlap diceRoller owner — fold at own turns. (pass #507)
## Pass run2#508 (MonsterCardHelpers.gated-reaction.test.js)
- 🗑 rec: gated-reaction owner trimmed 76->32; redundant null-negative legs at split:62, hellish-rebuke:87, ma1354:88, ma0853/57/61 (fold to 1), ma1203:205/:272 accept + :134/:208/:275 melee re-pins — trim at own turns. (pass #508)
## Pass run2#509 (MonsterCardHelpers.gaze-immunity.test.js)
- 🗑 rec: FP-family targetEffects:[]→null echo x5 (ancient-black-fp:118, adult-white-fp:116, ma1577:240, ma1997-smaug:57, ma2026-tiamat:198) — fold; saveProcessing.chilling-gaze-immunity:72 hand-mirror→import disk; yeti-dc-success:45-49 drop parse echo. (pass #509)
## Pass run2#511 (MonsterCardHelpers.grapple-ongoing-damage.test.js)
- 🗑 rec: handlePlainDamage.constrict-grapple:92-101 hand-transcribed APEP mirror→disk BY-name; ma1939-ladon:45-47 redundant parse re-verify drop. (pass #511)
## Pass run2#515 (MonsterCardHelpers.infernal-wound.test.js)
- 🗑 rec: saveProcessing.infernal-wound:92 + useLoggedDiceRollEventHandlers.infernal-wound:101 hand-transcribed parser fixtures→build via helper (#505); consider collapsing saveProcessing lane into infernalWoundService. (pass #515)
## Pass run2#515 follow-up (batch #158 flake)
- ⚠ FLAKE: ElementalAttunementModal.player-save 'Lightning failure' exact-roll-row failed in full-suite run but PASSES 21/21 isolated — suspect unseeded RNG or cross-file state leak. Diagnose at own turn. (pass #515 boundary)
## Pass run2#517 (MonsterCardHelpers.ma0300-arcanaloth-counterspell.test.js)
- 🗑 rec: ma0305-counterspell helper:93-96 + ma1120 helper:76-79/:125-131 999-sentinel twins fold to gated-reaction owner; usage-less 1/Day-fabrication leg relocate to counterspell owner.
- 📌 cosmetic: buildCounterspellMessage MonsterCardHelpers.js:3022-3027 renders '999/Day' for At-Will sentinel rows in spend logs. (pass #517)
## Pass run2#518 (MonsterCardHelpers.ma0305-arch-hag-counterspell.test.js)
- 📌 stale xref: ma0300 helper header cites ma0305 ':79-91' — seam now ~:56-67; refresh at ma0300 own turn. Relocate sole-pinned usage-less 1/Day-fabrication seam leg to gated-reaction counterspell owner. (pass #518)
## Pass run2#520 (MonsterCardHelpers.ma0853-githzerai-psionic-defense.test.js)
- 🗑 rec: ma0857:58 + ma0861:60 plain-null delete (owner :66); ma0857:121-128 + ma0861:112-119 no-falling byte-copies delete; ma0861:63-66/:85-96 twin-fold to ma0853 sequential shape. (pass #520)
## Pass run2#523 (MonsterCardHelpers.ma0871-gnoll-spear.test.js)
- 🗑 rec: ma0989/ma0965/ma1267 identical offer-shape+select-log presses shrink to disk-lock+derived wiring (twins of two-handed.test.js:46-53). (pass #523)

## Batch #164 flush (run2#679-#692, 2026-10-18)
- 📌 DATA public/data/monsters.json sphinx-of-valor roar_stages[1]: prose says Paralyzed repeats save at end of each turn but repeat_save:null (Androsphinx stage2 authors repeat_save) — prose/field inconsistency (#692)
- 📌 REC cross-file: 14 swarm lane siblings (ma1552/1553/1554/1555/1557/1558/1559/1561/1562/1564/1565/1566/1568/1571) re-pin foreign quaggoth-claw label 'Bloodied: +2d6 Slashing?' — cut at each swarm file's own turn (#689)
- 📌 REC cross-file: MonsterCardModal.giant-snake-save-leg.test.js:34-35 predicate-slice dup of secondary-save-transport.test.js:111-128 owner — trim at its turn (#690)
- 📌 REC cross-file: AttackResultPopup.ma1363 twin disk-lock accepted, no action (#689)
- ✅ CONFIRMED owners stable this window: charge-bonus :210-250, applyDamage.save-full :22-25, monsterRecharge :59-60/:152-165, MA-1890 parse, targetEffectDefinitions :124 — all re-run green as cite-targets
- ACTIVE REC carried: ElementalAttunementModal.player-save flake (3x under parallel load) — root-cause at that lane's audit turn

## Batch #165 flush (run2#693-#707, 2026-10-18)
- 📌 REC cross-file: ma1570 (venomous-snakes) — cut foreign piranhas pins (:122 const, :197 key-order, :226 cd, :248 label) (#701) + foreign label loop cross-pins bats/piranhas/claws/stirges (:246-250) (#707) — apply at ma1570's turn
- 📌 REC cross-file: ma1573-tarrasque-bite-grapple:195-197 cross-pins stirges row hit_conditions/escape_dc/hit_target_effect — owned by maintained ma1569; cut at ma1573's turn (#707)
- 📌 REC cross-file: ma1571 (wasps) 6→2 template + foreign-centipedes const cut (#695/#706) — pending, its turn upcoming
- ✅ Family census locked (no action): swarm cd twins documented — spiders⊂beetles FULL byte-twin (#706), rats cd≡bats (#704), centipedes cd≡beetles (#695); distinct-byte owners: quippers only-2d6 half-HP (#703), ravens +4/1d6+2 (#705), insects/larves/lemures/piranhas/dretches census-unique (#697-#701)
- ✅ CONFIRMED stable cite-targets this window: charge-bonus :210-250 + :51, AttackResultPopup.ma1363 :105-120, MonsterAction.ma0286 :89-113, secondary-save-transport, applyDamage.save-full :22-25, handlePlainDamage.ma1555/:841→854, ma1578 disk lane :150-165 — all re-run green as owners

## Batch #166 window (run2#708-, 2026-10-18)
- ⚠ DATA public/data/monsters.json tarrasque Swallow: no dc_success authored -> MV-20 default 'half' (MonsterCardModal.jsx:286 -> applyDamage.js:93): successful DC 20 save pays ~(8d6+6)/2 damage despite "Failure:" wording; RAW success = no damage/not swallowed. Needs dc_success:'none' (MA-0030 precedent). Canary pinned honestly in maintained ma1578 (#712) — flips red when fixed.
- 📌 REC cross-file: frightfulPresenceService.test.js :144-221 MA-0147/0163 row-mirror arms collapse to data-shape asserts (dracolich canonical :70-142 covers legs) (#711)
- 📌 REC future: MA-0647 drow-mage Staff precedent (cd absence + 1d6 poison secondary) has no owner file — propose owner if that lane is ever touched (#708)
- 📌 REC cross-file: add tiger Rend to handlePlainDamage.hitClause.test.js HIT_CLAUSE_ROWS (:224-282) — tiger landing unpinned in owner lane (#715)
- 📌 REC cross-file: repeatSaveService.test.js vs saveProcessing.save-margin-rider.test.js deep-fail/strip-keep cycle overlap — consolidate roller branches into repeatSaveService at their turns (#713)
- 📌 REC cross-file: monsterRecharge.test.js:203-207 + :231-236 (MA-0663/MA-1843) near-identical fresh/spent gate triples — one instance + :50-56 suffices (#736)
- 📌 REC cross-file: ma1872-cthulhu-madness-whisper:238 word-identical exhausted-refusal twin of legendary-uses.test.jsx:1236 — cut at ma1872's turn (#737)
- ⚠ DATA public/data/monsters.json Orcus Spellcasting row: save_type:"Wisdom" contradicts own prose "Charisma ... (spell save DC 23)" — WIS+5=>21!=23, CHA+7=>23; honest pin in maintained ma1958 (#749). Needs adjudication on Orcus ability scores at data-fix turn
- 📌 REC cross-file latch-fold (#751/#752): fold same-boundary latch re-pins at ma1881-gaze:162, legendary-blinking-gaze-solar:244, pounce-shadow-dragon:251, ma2012-wukong:222, ma1991-simurgh:221, legendary-uses-unicorn:187 -> canonical legendary-uses.test.jsx:304-326 at each file's own turn; also ma1991 :227-233 shortfall + chip fold (:181-186); pounce-ancient-gold:203 weaker own-turn twin of pounce-shadow-dragon:300-305
- ⚠ POLICY MonsterCardModal.jsx:307 stores paralyzed_minutes:1 as paralyzedRounds:10 — minutes x10 recipe retired by no-timers duration policy (combat-scoped >=1min); matures at initiative seams only, predates policy (CLA-334). Adjudicate at modal duration-owner turn (#755)
- 📌 REC cross-file: legendary-uses.test.jsx duplicate turn-latch tests :747 + :996 vs canonical :309-316 — collapse at its own turn (#753)
- 📌 REC: ma1990 header cite drift (points at pre-trim ma1991 :138-148, now :143-153) — refresh at ma1990 re-touch (#753)
- 📌 REC suite-wide: 40+ sibling boilerplate mocks getAbilitySaveModifier:()=>0 — real leaf pure+mock-free proven at #765; unmock candidates
- 📌 REC: spell-attack.test.jsx (MA-0033) ~100-line mock template duplicate of scorching-ray — shared mock factory in MonsterCardModal.test-utils.js dedupe candidate (#767)
- 📌 Cite drift due: MonsterAction.ma1071:13/ma1212:18 + ma1783:13/:104 + ma0963-half-dragon-breath:15 point at pre-marker line numbers of save-variant-shape (now cone~:47, DC0~:51, WoT :66-73, half-dragon :46) (#766)
- 📌 CITE MAP post-#777 spellcasting.test.jsx (old->new): :184->185, :192->193, :195->196, :212->213, :226-241->227-242, :245->246, :275->276, :281-302->282-303, :317->318, :327->328, :333/340->334/341, :403->377, :419->393, :518->508, :522-548->512-540, :552->542, :561->551, :639->601, :604->489; barlgura upcast :185-187->146-148 (#776). Refresh drift cites at siblings' own turns.
- 📌 NOTE MonsterCardHelpers computeShieldOfFaithBonus hardcodes +2, ignores buff acBonus field (display correct today) (#769)
- 📌 REC cross-file: pounce-dracolich.test.jsx:104-105 header name/uses droppable (FP-owner = terrifying-presence :120-122) (#779)
- 📌 REC cross-file: applyDamage.save-full:18-19 vs applyDamage.helpers:92-93 half-math dup — one owner cite (#779)
- 📌 REC cross-file: legendary-uses.test.jsx:256-263 thunderclap-subsume droppable post-#782 full-row lock; also still pending :747+:996 latch dups (#753)
- 📌 Cite drift: terrifying-presence-dracolich:18 points thunderclap :183 -> now :197 (#782)
- 🔴 BUG src/components/hex-map/EventDialog.jsx:60 event.encounter.monsters.map unguarded — encounter object without monsters array crashes dialog render (#790)
- 🔴 BUG useMapLoader.js:161 isInitialized.current guard never resets -> mapName prop change never reloads (deps :186 dead); Map.jsx:351 renders <HexMap> with NO key -> outdoor->outdoor switch shows stale map (VERIFIED by orchestrator). Fix at source-owner turn: key={mapName} at Map.jsx OR reset guard. Canary exists useMapLoader.api.test.jsx (unmount late-resolve) (#798-run)
- ⚠ BUG useMapLoader.js:210 save guard compares hexMapNameRef.current (:151, never updated) -> saves silently stop forever if mapName changes in place (#798-run)
- ⚠ BUG useMapLoader.js:178 silent catch(_err) swallows load errors, no console.error — violates no-silent-fallback convention (#798-run)
- 📌 REC: useMapLoader.init.test.js:60-71 default-config mostly raw useState defaults — trim to ref-seeding :83-90 at its own turn (#798-run)
- 🔴 BUG useMapLoader.js:188-210 mount-save scheduling race: await seam before hasLoaded.current=true -> persistence effect flushes once-or-not-at-all (observed both orderings same run; old objectContaining masked it; save count now race-tolerant with comment) (#800)
- ⚠ BUG useTravelToolSync.js:21 dead ternary TOOL_TRAVEL===tool?'none':tool inside guard tool===TOOL_TRAVEL -> always 'none' (misleading, likely wrong var intended) (#806)
- 📌 FRAGILITY useTravelToolSync.js:20-24 branches B/C lack activation guard A has -> dep-churn re-fires setTool/cancelTravel; self-limiting today (effects flip condition; HexMap.jsx:128 memoizes weather handler) (#806)
- 📌 REC cross-file: RoadLayer.test.jsx:7-94/:140-155 wholesale vi.mock(hexMapUtils) + descriptor-null cases + memoization call-count tests — same oracle/zero-mock + memo-identity cuts per #813/#791/#796 discipline at its own turn (#813)
- 🔴 BUG ConditionEffectBadges.jsx:142 buildProtectionFromPoisonBadge reads ctx.te.dc lazily inside onClick but ctx.te reassigned per spec-loop -> TypeError on ANY click of Protection from Poison badge (caught live #820; click-pin withheld pending eager-capture fix — restore at source-owner turn)
- 📌 REC: common/CreatureBadge/ has NO tests — span-vs-button + 'Remove effect' title mechanics need a leaf home (zero-mock precedent) (#820)
- 📌 REC cross-file: ConditionEffectBadges.test.jsx:94-113 Save Disadv row (riderSaveDisadvantage) droppable — common lane #822 owns stronger surviving-badge version
- 📌 REC batch cleanup: storage.js dead mock (not imported by render chain, verified x4 #820-#823) in spell-effects/no-oa-speedy/pass-without-trace/ma1012-frozen-grip/target-effect-removal/disadvantage-next-attack/effect-removal/save-ability badges files — delete at each own turn (#823)
- 📌 CITE MAP control-spells post-#823: banishment golden :107-113->:59-65; wrong-target :115-121->:67-73; click-save :124-158->:75-109; Banishment badge :180-195->:139-154
- 📌 REC cross-file: target-effect-removal.test.jsx:104-119 14-effect it.each all traverse identical removeTargetEffect predicate — trim to ~4 reps (sanctuary/banishment/forcecage findResolved/slasher_enhanced_critical compute-override) at its own turn (#825)
- ⚠ CONVENTION src/components/common/CreatureBadge.jsx:8 wrapper <div style={{position:'relative',display:'inline-block'}}> inline styles — violates NEVER-inline-styles; rendered by every badge app-wide (#826)
- 📌 CITE drift: common #822 cites ma1012-frozen-grip :47-63 -> now :57-73 (refresh at common's re-touch) (#826)
- 📌 REC cross-file: target-effect-removal.test.jsx ~:110 removableTargetEffects it.each — add 'pass_without_trace_bonus' (only unenumerated generic-path key, renders find-based like protection_from_poison entry) (#828)
- 🔴 BUG ConditionEffectBadges.jsx:100-101 buildAbilityCheckAdvantageAllBadge double-wrapped parens: reasonText=` (${reasons})` then tooltip appends ' (' + reasonText + ')' -> title 'Advantage on all ability checks ( (Foresight))' (old regexes masked; exact-byte test now catches) (#829)
- 📌 REC cross-file: createConcentrationHandlers.test.jsx:269-340 advantageSources mega-test flatten to it.each; :216-254 two disadvantage:false twins collapse (#833)
- 📌 REC cross-file: initiative.test.jsx clear-combat tests fire REAL unmocked sessionService/autoRewardService/zoneDurationClock fetches in jsdom — add boundary mocks (#837); cancelled-clear test duplicates factory declined-row weaker, shrink post-mock
- ⚠ LATENT createNpcClickHandler.js:22 name-match returns true when roster entry lacks name AND clicked name null (undefined===undefined) -> wrong-NPC popup (UI clicks always carry name; current bytes pinned test 3 npc-path) (#843)
- 📌 CITE drift: CreatureCard.conditions canonical breaks #848/#849 cited :126/:153 -> now :121/:149 (byte-identical) (#850)
- ⚠ BUG CreatureHp.jsx:45-49 MaxHpInput mutates creature prop directly (creature.maxHp/currentHp = ...) instead of reporting via onChange — works only because card host reads the mutated object (prop mutation anti-pattern) (#854)
- 📌 REC cross-file: EffectAdder.effects-config.test.jsx :47-55 creature-name census superseded by creatures byte-exact census (#857); ability field toContain('wis') could upgrade to toEqual per #856 census
- 📌 REC cross-file: EffectAdder.effects-config.test.jsx :66-71 extend No-Opportunity-Attacks test asserting absence of Value:/Save DC: fields (browsing #859 cut its face) (#859)
- ⚠ Initiative.jsx:154 clearDominatedExpirations redundant identical write: re-writes pendingExpirations even when nothing cleared (#864)
- 📌 REC cross-file: initiative.overlays.test.jsx 'shows no overlay options when the server has none' near-vacuous post-#865 container census — shrink at its own turn (#865); navigation lanes must claim keydown/prev/next seams (forward-cited container #865 cut)
- 📌 NOTE Initiative.jsx:533-535 combat-summary-updated adopts cache roster verbatim (no mergeCombatSummaryWithCharacters) — pinned as-authored T2 #865
- ⚠ navigationHandlers.js:338 rewind at round 1 with roundDecrement:true total no-op (active creature stays; arguably should step back within round) — pinned as-authored (#868)
- 📌 REC cross-file: keydown->Prev/Next wiring (Initiative.jsx:564 window listener) UNOWNED app-wide — claim in initiative-callbacks.test.jsx at its re-touch (#868)
- 📌 CITE drift: nav base post-#868: majesty :203->:191, gate :235->:211 (:158/:163 unchanged)
- 📌 REC: common/AvatarImage.test.jsx:2 stale legacy '@improved-by-ai' line beneath @maintained-by-ai — delete that line at its turn (#870)
- 🔴 saveResultHandlers.js:298 violet banishment filter over-removes: OR-clause (te.target===name && te.source===caster) drops ALL same-caster effects on target, not just banishment (e.g. hunter's mark silently dropped) — unpinned, reported (#871)
- ⚠ useLootHandlers.js:25 lootResult.lootEntries.join unguarded deref (line 24 has || fallback, :25 lacks it) — null resolve throws, lands in catch incidentally; pinned honest (#875)
- 🔴 createRollConditionSaveHandler.js:226 emits action:'kept' -> LogConditionEntry.jsx:12 any-non-applied renders 'Condition Broken' label (mislabeled entries for kept conditions) (#876)
- 🔴 LogDeathSaveEntry.jsx:10 result:'removed' renders 'Death Save Failure' mislabel (:41 '()' ghost die, :43 stable-red-class from omitted success) — 3 defects, revive leg pinned honestly as-authored (#877)
- 🔴 LogEncounterEntry.jsx:4 isStart only 'started'; EncounterBuilder.jsx:307 emits 'joined' -> renders 'Encounter Completed'+trophy (pinned row2 #878). REC forward: LogEntryRendering pass must NOT re-pin encounter legs, dispatch seam only (#878)
- ⚠ LogHpHealingEntry.jsx:73 zero-delta labeled 'Healed' (isDamage=delta<0); :22-23 damage entries swallow authored sourceName/note (multiTargetHandler.js:129-130 bytes never render) (#880)
- 📌 REC cross-file: LogHpHealing.test.jsx:12-30 damage-breakdown REMOVE (relocated to LogHpChange #880); #880 must claim 'Healed'/source-paren/note/maximize bytes (gap between lanes flagged)
- 🔴 LogLootEntry.jsx:12 xpPerChar&&>0 short-circuits literal 0 into details when xpPerChar===0 (React renders '0') — stray byte '0Gold coins' pinned honest; fix is >0-only guard (source-side, reported) (#882)
- 📌 REC cross-file: LogNotes.test.jsx absorb retained NoteEntry byte check from LogEntryRendering #879 (lane now exists); LogEntryRendering can then drop retained note test (#884)
- 📌 REC cross-file: LogEntryRendering.test.jsx:140-147 retained NoteEntry content test superseded by LogNotes census #885 — drop at re-touch, keep :100 routing, update header migration note
- ⚠ LogRollEntry.jsx:52 MISS renders trailing space ('MISS ') — cosmetic, pinned with trim (#886)
- 📌 REC cross-file: Map.test.jsx:410-421 fog-cell roles subsumed by FogOverlay exact-bytes #901 — collapse to one mount-smoke at Map's own turn (optional, harmless)
- 📌 REC cross-file: map.test-utils.test.js:711-716 useFogOfWar shape assert vacuous (tests the mock at map.test-utils.js:195) — delete block at its turn; canonical owner useFogOfWar.test.js #904
- 🔴 useItemDragging.js:28-38 setPointerCapture fires before ctm-null/item-not-found early returns; up-handler bails when itemDragging null (:96) -> pointer capture NEVER released on failed drag start (#905)
- ⚠ useMapDrops.js:13 whitespace-only dragData passes !dragData guard -> furniture item type:'   '; :10-11 no numeric guard -> NaN-cell placement (both formerly pinned 'as expected' — vacuous pins removed #906, real guards belong source-side)
- 📌 CITE refresh useMapLoader post-#907: :161->:37 mapName-only staleness; :188-210->:78-92 mount-save race; :178->:60-62 silent-catch-empty-overwrite; :210->:50-57 load-time characters capture. ALL FOUR now pinned honestly with FIXME-style comments in useMapLoader.test.js
- 📌 usePlacedItems #909 recs adjudicated: (a) useNpcImageCache folder-red claim DISMISSED — orchestrator rerun 4/4 green standalone; (b) PlacedItems-event-handlers overlap rec FORWARDED to its own turn
- 🔴 usePlayerDragging.js:124 setPointerCapture-before-guards stranding capture on failed down + :257 release-after-guards stranding capture on guarded up — SAME class as useItemDragging :28-38 (#905/#910); drag-capture-leak class CONFIRMED systemic across both drag lanes
- ⚠ useSpellHandlers.js:51 e.button!==0 guard inside hit-test loop -> right-click pointerdown on EMPTY grid with active placement tool creates overlay (quirk unpinned deliberately, source-side guard fix belongs: hoist button check) (#913)
- ⚠ useSpellOverlay.js:59 updateOverlay debounce timer never cleared on unmount (cleanup :35 cancelled-flag only) -> pending POST fires post-unmount (#914)
- ⚠ useSSESync.js:28 revealed uses !==undefined while :26 players uses || -> revealed:null overwrites prev with null (asymmetric non-array risk); unpinned, owner review (#915). REC: map.test-utils.test.js:565-582 shape/identity trivia + ~:707 no-arg real useSSESync call — drop at its turn
- 📌 REC map.test-utils.test.js:675-676 useWallDrawing() outside renderHook + painting!==null mock assert (tests mocks); merge with :565-582/:707 blocks — delete all at its own turn (#915/#916)
- 🔴 useZoomPan.js:79 handlePanEnd releases capture never acquired in handlePanStart -> browser NotFoundError (mock hides); + :103-107 factor-1 wheel redundant writes (#917)
- 📌 REC cross-file: Map-handlers.test.jsx :346 vacuous closes-context-menu (never opens menu first — strengthen open-then-close or remove, real path pinned #920); :280/:294 menu-content negatives duplicate #918 census — delete at Map-handlers' turn (#920)
- 📌 CITE drift: #915's :419 combined-handler routing face now Map-tool-handlers.test.jsx:489-491 (#922). REC: Map.test.jsx:304/:309 near-duplicate null-mapData merge at its turn; map.test-utils.test.js ~50 shape meta-tests prune to smoke at its turn (#922)
- 📌 NOTE Map3D.jsx:45-48 double-dispose race if unmount during init (idempotent/harmless, unpinned) (#925)
- 🔴 MapToolbar.jsx:42-48 Spell click with spellOverlayState:null throws (undefined destructure); ⚠ :127 falsy-divergence spellMode '' mounts controls inactive (#928)
- 📌 REC cross-file: useLoggedDiceRollAttack.potent-cantrip.test.js school/zero-INT non-fold it.each legs duplicate #931 t3 owner — consolidate at its turn (#931)
- 📌 REC: consumeGuardianProtectionAcBonus MA-1463 (attackPostProcessing) has NO unit lane — its own ticket lane when queued (#932); REC PlacedItems-localhost-rendering-2.test.jsx:50 redundant w/ #930 localhost legs (#930)
- 📌 REC cross-file: weakening-breath lane trim keep-low byte (base owns #938) at ITS turn [now queued NEXT]; useLoggedDiceRollAttack.misc-effects 'no lucky when forcedMode set' dupes feats-of-chaos #936 rows 4/5 — feats cited owner, trim misc-effects at its turn (#938)
- 🔴 handlePlainDamage.js:556 multi-target apply passes characters:null (twin :518 passes characters) — player context lost on multi-hit; :523-531/:558-566 twin/multi share twinTarget* popup fields, multi overwrites twin (#941 pinned as-authored)
- 📌 REC cross-file: automationPopup:59 + modalRouting:111 fallback near-dupes -> merge into modalRouting key-map owner at ITS turn (#945); returnValue:64 clear-case defer here (#945)
- 🔴 useSpellPositionResolver.js:26-34 attacker matched name-only, missing-gridX entry writes half-coord cache consumed by executor (:946 pinned honest) — needs coord-validity guard source-side
- 🔴 summonSpiritHandler.js:366 Instantaneous summons (Find Steed) hit summonDurationRounds(...) || 10 fallback -> 10-round despawn clock kills steed RAW-'until dismissed' violation; :304 duration:'1_minute' te mislabel cosmetic — both pinned honest w/ FLAGGED comment C1 (#951)
- 📌 REC: save.test-utils.js makeSaveDcTests ORPHANED (only consumer save.test.js #958 now loops) — delete in scoped pass; save.js:299 prismatic raw-damage no token-resolve (pinned as-authored, leaks if token data ships) (#958)
- 📌 suspect spell.js:82 dragon_companion hardcodes noConcentration:false while free_spell:22 reads auto.noConcentration — pinned as-is drop-pin #960; summonSpiritHandler.js:366 ||10 despawn-clock + :304 1_minute mislabel confirmed earlier #951
- 📌 REC cross-file: restoreBalance.test.js:49-57 collectSaveModifiers null/undefined legs dup automationModifiers guard (#964) — trim at ITS turn keeping 3 restore_balance legs
- 🔴 automationPassives.js:173 vs :229 — read lane accepts legacy max_hp_increase bytes but markFortifiedHealthUsedIfGranted ownership matches only fortified_health: legacy-holder heals every time, once-per-turn latch never engages (pinned honest #966)
- 📌 CITE map: #969 kind-gate×replace precedence face owned wm008-kindgate.test.js:66-80 (#970 quote-refresh; base cites by filename — valid)
- 📌 REC cross-file: automationService.core.test.js:31-48 describe('getAutomationInfo') fully subsumed by buildAttackInfo facade lane guard-battery+transparency (#971) — delete block at core.test.js ITS turn, keep hasAutomation + expression lanes
- 📌 REC cross-file: automationCollector.types.test.js:216-217 arcane_apotheosis empties subsumable by full-envelope fingerprint — low-prio at ITS turn (#972); collection CITED-OWNER categorization faces PRESERVED (old:66-:280 folded into 21-feature golden #3)
- 📌 REC: automationService.modifiers.test.js unmarked lane — mark+trim at ITS turn (#973); automationExpressions.js:257→:273 double warn+error on unresolvable token (noise, behavior correct) (#973)
- ⚠ FLAKE-watch: ElementalAttunementModal.player-save.test.jsx + WizardStepSpells.feature-touched.test.jsx parallel-load fails, pass standalone x1 (#183) — stabilize on 2nd occurrence
- 📌 REC cross-file: interactive.twinkling test 3 + useMagicDevice bare-type test dup generic mechanics #976 — fold to verbatim-row shape at ITS turns (#976)
- 🔴 automationService.js:132-133 getEvasionEffects iterates automation array entries without null guard (auto.type throws on [null]); sibling isInteractiveAutomation guards if(!auto) at :118 — latent crash on sparse automation arrays (#979)
- 🔴 2024/spells.json Aura of Vitality missing casting_time (PHB: Bonus Action) — classifier defaults chargeable action; pinned tripwire #983. ⚠ feats.json 'special' not a ROW_BUCKET lane token (harmless w/ casting_time passive) (#983)
- 📌 REC cross-file: assertCanAct.charge.test.js:120-122 bucketForAction classification examples dup base-lane #984 behind pure delegation — trim to one delegation example at ITS turn (#984)
- 📌 REC cross-file: steps/attackRollBonuses-brutalStrike.test.js t3 ordering dupe #986 — fold into t1 keeping dice-application at ITS turn; improvedBrutalStrike clean keep-as-is
- 📌 NOTE buffService.js:29 idempotent re-activate writes unchanged array → redundant SSE broadcast (efficiency nit, correct) (#987)
- ⚠ chargeEconomy.js:11-12 doc claims off-mode refunds allowed at GM-correction seams but refundSlot:47 returns false zero-writes when enforcement off — doc/impl divergence, honest-pin #989
- 🔴 concentrationService.js:213-217 restoreSuppressedConditions splices per-loop, last write drops earlier restore (multi-missing case) — pinned honest #990 T6; :483 cleanupBuffsByName name-only no-source check (cross-caster strip) — pinned honest #990 T9; :225-227 removeCalmEmotionsBuffs strips ANY creature's Calm regardless of caster — pinned honest #990 T9; minor :450-451/:469 unconditional writes — pinned #990 T13/T12
