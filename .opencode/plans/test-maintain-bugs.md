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
