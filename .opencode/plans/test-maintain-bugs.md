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
  **FIXED fix#1 2026-10-22**: hook contract kept (derefs `.name`, param named playerStats, 2 callers both wrong); both call sites now pass the OBJECT; weak objectContaining pin flipped to exact `characterName:'TestCharacter'` + call-site regression added to BonusActions lane; bite-verified cp-revert 3-fail then cmp-restored; scoped 18/18 + eslint clean.

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
  **FIXED fix#51 2026-10-22 CANON-2 RETIRED**: _languageWarnings discard-alias was the drop (destructure captured, getProps never forwarded); one shorthand line restored mid-order per step-13 sibling pattern; producer chain fully wired (useWizardLanguages:8->:256->:469, consumer :82 undefined-safe); retiring lane 22/22 FIRST full green, 688 adjacent, FIXME comment flipped guard-note only.**
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
  **FIXED fix#2 2026-10-22 (with next item)**: isSpeedAllowed parses prose law (no-clause forbids, '...only' clause restricts, else allowed); disk contract cited classRules.js:124/126/128 + 2024:293; climb/burrow now own keywords; fixtures disk-derived drift-throw (hand-copies retired); mutants old-gate 4-fail + polarity-flip 6-fail, cmp-restored; 21/21 + eslint clean. NOTE ledger claim 'Wolf shows Swim 20' came from drifted fixture — live defect surfaced Crocodile Swim/Climb instead, now pinned on real rows.
- 🔴 PolymorphSelectionModal.jsx:24-25 — climb/burrow gated on hasSwim instead of own limitation keywords. (pass #150)
  **FIXED fix#2** (same pass — MOVEMENT_MODES loop, per-mode keyword gate).
- 📌 rec PolymorphSelectionModal.test.jsx — mockMonsters copy-pasted from features lane (drifted); extract shared fixture module. (pass #150)
## Pass run2#152 (PolymorphSelectionModal.test.jsx)
- 📌 rec: features lane 'Walk 20' speed-display assertion + local fixture duplication in both Polymorph lanes — revisit when 🔴 PolymorphSelectionModal.jsx:20-25 fix lands; extract shared fixture then (new helper file needed — deferred).
- ⚠ flake watch: CampaignAdmin.data-management.test.jsx URL-encoding test fails under full-suite parallel load (green 3/3 isolated, batches #134). Not load-adjacent to maintained lanes; watch at batch #135.
## Batch #135 flush (runs #152-#165)
- 🔴 ResourcePoolModal.jsx:215-223 — handleArchdruidConvert never calls addEntry; Nature Magician conversions invisible in campaign log (violates every-automation-logs rule). Honestly pinned in test. (pass #161)
  **FIXED fix#3 2026-10-22**: addEntry inserted at seam matching handleForward/handleReverse pattern (:184-190/:202-208, ability_use + .catch console); honest not.toHaveBeenCalled pin flipped to exact-payload toHaveBeenCalledWith + plural-uses added + blocked-guard negative kept; mutant-kill 1-fail restored cmp; 16/16 + eslint clean. Follow-on (untouched): clearAllExpirationEffects.js:164 logs unnamed 'effects end.' opposite-polarity same-class.
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
  **FIXED fix#4 2026-10-22 (with :229-234)**: mirrored resolveNpcCarefulSave pair (AreaEffectSaveFlow.utils.js:126-168) inline :147-162; honest zero-length pin flipped to exact save_result object + addTargetResult tuple; revert-mutant RED-verified. SAME-CLASS queue (untouched): HypnoticPatternModal:112, CalmEmotionsModal:78-81, SaveAttackAoeModal:274-277.
- 🔴 FearModal.jsx:229-234 — confirm with zero resulting prompts (all targets careful-protected) leaves modal stuck open: setPendingPrompts([]) never triggers dropPendingPrompt, no onClose path.
  **FIXED fix#4**: onClose() after setPendingPrompts when prompts empty (skip-path mechanism :235-237), deps updated; new onClose-times-1 regression; remove-mutant RED-verified; 22/22 across 4 files + eslint clean. SAME-CLASS queue (untouched): AOEConditionModal:459/538, HypnoticPatternModal:198, TashasLaughterModal:303, SaveAttackAoeModal:1818/1870, CalmEmotionsModal:231, MassSuggestionModal:339.
- 🔴 HealingIllusionModal.jsx:20-21 — custom-target maxHp silent-fallback to 0 when runtime hitPoints unset; Math.min(0, currentHp+heal) sets currentHitPoints to 0 (heal becomes damage). Violates no-fallbacks convention. (pass #189)
  **FIXED fix#5 2026-10-22**: parseHp() null-for-unset; unresolved -> console.error + ZERO write/log/close (refuse path); canonical clamp reused healingRoll.js:58; defect confirmed live pre-fix (wrote 0 / negative actualHeal); 3 pins added incl genuine-0-HP guard; mutant re-plant RED, cmp-restored; 14/14 + 10/10 consumer + eslint clean. SAME-CLASS queue (untouched): hpModifier.js:34 ??0, healingRoll.js:49-52 at-full fabricate, beguilingDefenses:48/searingVengeance:188 benign-display.
## Pass run2#191 (HypnoticPatternModal.metamagic.test.jsx)
- 🔴 HypnoticPatternModal.jsx:112-113 — careful-protected PLAYER target leaves no audit trail (in-memory result only; no addEntry/addTargetResult), NPC careful leg logs properly. Same defect family as FearModal.jsx:146-147 (#185). Honestly pinned (saveEntriesFor('PlayerAlly')=0).
  **FIXED fix#6 2026-10-22**: mirrored fixed FearModal :147-164 pair (logCarefulSpellProtectedSave + addTargetResult, roll:null->0 file convention, import position identical); honest zero-length pin flipped exact-entry + exact tuple; mutant RED, cmp-restored; 15/15 + eslint clean. Residual same-class: SaveAttackAoeModal:274-277 still open (queued); CalmEmotions cited span drifted — its careful leg appears to log now, owner verdict pending.
- 📌 rec SaveAttackAoeModal.* family — ~100-line CreatureSelectionModal row-markup mock copy-pasted verbatim in >=6 test files (blocking-effects, damage-edge-cases, overlay, creature-selection, damage-resolution...); extract shared test-util (precedent: SaveAttackHealModal.test-utils.js) when those lanes are processed.
## Batch #137 flush (runs #181-#194)
- 🔴 CreatureSelectionModal.jsx:57 — heighten toggle-to-null unreachable (browsers no change event on checked radio); dead branch, deselect impossible via UI. (pass #182)
  **FIXED fix#7 2026-10-22**: onPointerDown checked-snapshot + gated onClick -> existing handleHeightenSelect (onChange untouched for fresh selects); pre-fix jsdom probe zero-calls reproduced; 3 pins added (null-tuple, controlled-parent null render, single-select guard); mutant RED both deselect pins, cmp-restored; 99/99 + eslint clean. SAME-CLASS queue: RecklessAttackModal:82 (:204 below) + AreaEffectTargetModalBase.utils:8 + AOEConditionModal.subcomponents:77 (newly sighted).
- 🔴 HandOfHealingModal.jsx:82 — sourceName template unclosed paren -> "Monk1 (Monk" in campaign log (only pin = test #188). (pass #187/#188)
  **FIXED fix#8 2026-10-22**: closer restored per blame e6bfd0f82 (authored dropped paren, no lost interpolation) + sibling convention cites; pin flipped exact 'Monk1 (Monk)' pre-fix-39-pass then 44/44 post + eslint clean; same-class grep: sole instance repo-wide.
- 📌 CombatStanceModal.jsx — inline style props violate no-inline-styles convention. (pass #181)
- 📌 HealingIllusionModal.jsx — description literal vs spell-data (design note only). (pass #194)
- 🔴 HypnoticPatternShakeModal.jsx:33-39 — executeHandler rejection: catch rethrows before setProcessing(false)/onClose(); modal stuck "Shaking target free..." + unhandled rejection. Deliberately unpinned. (pass #195)
  **FIXED fix#9 2026-10-22**: throw e removed (house idiom HandOfHealing:180/CombatStance:38 + own intent bc17510c0 'log but don't throw'); caller-catch proven absent (onClick void, SecondaryModals:480 supplies onClose only); new 9th pin pre-fix RED stuck+escape then GREEN 9/9 + unhandledrejection probe + exact console bytes; success path bytes unchanged; eslint clean.
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
  **REGRESSION+REPAIR fix#10r 2026-10-22**: new applyDamage imports broke 9 lanes (7 EA partial-mock Proxy holes + CalmEmotions transitive automation/index->calmEmotionsHandler.handle eval-time throw). Repair: importOriginal spread 2 lines/lane, overrides byte-preserved zero-weakened; fix#10 pins intact; full suite 30,198 exact CANON pair again. WARNING: lanes fully-mocking applyDamage + saveBonuses fixtures, or handler-mocks under transitive automation/index, need same proactively (EA elemental-data+base short-circuit-lucky today).
  **FIXED fix#10 2026-10-22 (read-side arm — producer-full REJECTED by census: CLA-303 lowercase contract + 16+ legit abbrev consumers + round-trip)**: 9 reader files/10 lines normalizeSaveType (sanctioned one-expression-each) + producer input-hardened (found+fixed second bug: full-name-keyed saving_throws rows fell to ability-modifier, Dracolich dex +6->2); probes pre 0 post 7; pins added 2 lanes + mock-accommodations zero-weakened; 143/143 final + eslint 14 files clean. FOLLOW-ONS (owner lanes): truePolymorphService:345 duplicate private getMonsterSaveBonuses; SaveAttackAoeModal:52 dex-gate full-name miss; npcClickFormHandlers:192 round-trip abbrev-only vs 16 full-name rows.
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
  **FIXED fix#11 2026-10-22**: clobber lived one level up (armZoneTargets :595 unconditional recurringDie AFTER :610 derived spread — authored-wins spread now conditional-key ...(zoneTe.recurringDie?{...}:{})); consumer census authoritative (zoneRepeatTurnEndService:48-55 te-carrier canon, whirlwind authored still wins); full-set armed-te pins incl recurringDie 3d6 pre-fix RED undefined + negative no-fabrication pin; 5 lanes 17 green eslint clean.**
- 📌 rec saveProcessing.ma0875-thp-grant.test.js:137-148 — standing-pool stacking re-tests tempHpBuffHandler.bolsteringTreats.test.js:146 owner semantics; trim to clause-channel proof at its turn. (pass #218)
- 🔴 AreaEffectTargetModalBase.jsx:173+214 / SaveAttackAoeModal.jsx:1934-1938 — overlay apply race: base allResolved reads its own selected (shadowed by extraState.selected → always empty), setSummary fires with ctx.results still empty one microtask before setResults lands; results panel renders header with ZERO rows. Reproduced live (pass #226, now non-vacuously pinned). Also triggers setState-during-render warning.
  **FIXED fix#12 2026-10-22**: base reads effectiveSelected ("selected" in extraState merged expr, no new state); in-render setSummary branch replaced by handleAllResolved post-commit effect (functional prev===null guard); overlay pin flipped header-only->exact-rows+zero-warnings, NEW interactions one-microtask pin; 59 files/276 green, eslint 4 clean. ADJACENT report: SaveAttackAoeModal:1733 handleSaveResultOverride reads consumer pendingPrompts while overlay stores in BASE ctx — overlay-lane PC replies early-return (two-homes-for-state family, owner pass); consumer:1939 inline-style debt untouched.
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
  **FIXED fix#13 2026-10-22**: applyConditionToCreature returns applied|immune|missing (consumes addCondition {suppressed} contract conditionSaveService.js:127-157); expiration+applied-log gated on landed subset; honest immunity advisory per saveProcessing:801-809 + charmSpellUtils:98 template (condition_immune_advisory via automation type — renders); pre-fix phantom captured then pinned away; 26/26 lanes + eslint clean. SAME-CLASS QUEUED: BlindnessDeafnessModal.jsx:40-62 identical unconditional trio (player immune logs applied + phantom expiration + phantom effectKey :44).**
- 🔴 SetConditionModal.jsx:149 — player log formula saveBonus !== 0 check renders '1d20+undefined' when saveBonus absent (other fields coalesce ?? but formula doesn't).
- 📌 rec SetConditionModal.test.jsx — drop 2nd-render Roll:10+2=12 display dup (T3 #244 owns math); weak 'renders npc/player labels' getAllByText(/npc/)≥1 near-vacuous — strengthen or remove at its turn.
## Pass run2#247 (StealthAttackModal.test.jsx)
- 🗑 StealthAttackModal.jsx:32 — near-dead branch: sneak_attack_dice_value absent from all public/data → non-6 path unreachable; modal always renders d6 (harmless defensive fallback).
- 📌 StealthAttackModal.jsx:41 — cost hardcoded '{costD6}d6' vs derived d{value} available: cosmetic inconsistency if per-level key ever materializes (handler also hardcodes d6).
## Pass run2#249 (TashasLaughterModal.player-saves.test.jsx)
- 🔴 TashasLaughterModal.jsx:40 — buildLaughterSaveResultEntry guards saveBonus !== 0 only; undefined bonus leaks "rolled 0 + undefined = 0" into logged description (honestly pinned in sparse-detail test).
  **FIXED fix#14 2026-10-22**: guard (detail.saveBonus ?? 0) !== 0 — undefined never interpolates; house omit-plus form per savePrompt.js:148/66; honest pin flipped to exact fixed bytes (old pin fails new code = strong); 27/27 3 lanes + eslint clean. SAME-GUARD-FAMILY QUEUE: BlindnessDeafnessModal:139, SaveAttackHealModal:195, SetConditionModal:181 (ledger :149 sibling), DivineSparkModal:204 — all raw !==0 with sparse-payload +undefined leak risk.**
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
  **FIXED fix#15 2026-10-22**: modeLabel from choice (in-scope, always taunting|dreadful at skip site); mirror-defect also fixed (Taunting-in-mistyEscape said Dreadful); pins upgraded toExact full-string, pre-fix RED ledger bytes; :99-108 deliberately untouched (fix#16); 8 lanes 24 green + eslint clean.**
- ⚠ StepsOfTheFeyTauntModal.jsx:278-289 (+taunt twin :176-187) — save-result window listeners removed only on event arrival; closing modal with pending saves leaks listeners + resolves against unmounted state (cross-modal clobber class).
- 📌 rec noUses/refreshingStep tests — same dishonest createSaveListener arg-destructure + shared prompt-<name> ids latent collision; honest-mock treatment at their turns. (pass #257)
## Pass run2#258 (StepsOfTheFeyTauntModal.integration.test.jsx)
- ⚠ COVERAGE GAP: taunting confirm lane (handleTauntConfirm: save dispatch, taunting_step targetEffects upsert, expiration, save_result logs) covered NOWHERE after tauntingStep vacuous-deletion. RESTORE step-lane file mirroring dreadfulStep #257 when tauntingStep.test.jsx is processed. (pass #258)
- 📌 cosmetic: freeCastCountKey null → result text renders (newCount-1) remaining but writes no decrement (defensive branch only). (pass #258)
## Pass run2#259 addenda
- 📌 rec StepsOfTheFeyTauntModal.render.test.jsx:73-78 + :114-118 header-title dupes consolidate; :101-112 skip-label merge. (pass #259)
## Pass run2#260 (StepsOfTheFeyTauntModal.refreshingStep.test.jsx)
- 🔴 StepsOfTheFeyTauntModal.jsx:99-108 — applyRefreshingStep never addEntry: refreshing free-cast resolution unlogged (app rule "every automation must log"); same gap :110-126 disappearing lane. Not pinned to avoid cementing.
  **FIXED fix#16 2026-10-22 (with :110-126 disappearing)**: ability_use entries at resolution seams per handleFreeCastSkip/logFreeCast template (:25-35/:138-151), names disk-verified classes.json:12167/:12181, writes-before-log order pinned, exact-entry + inert-cancel tests added both lanes, composes clean on fix#15; 8/24 green eslint clean.**
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
  **FIXED fix#17 2026-10-22**: JSX fragment children (no DSI per #1545 law); regex-tolerant pin flipped exact-textContent + not.toContain('<b>') + real b-element assert; DOM proof before/after captured; 12/12 + eslint clean. Same-class grep: ~40 sites ALL sanctioned HTML sinks (verified) — sole plain-text instance repo-wide was this one.
  **FIXED fix#16 2026-10-22 (with :110-126 disappearing)**: ability_use entries at resolution seams per handleFreeCastSkip/logFreeCast template (:25-35/:138-151), names disk-verified classes.json:12167/:12181, writes-before-log order pinned, exact-entry + inert-cancel tests added both lanes, zero count-extensions needed, composes clean on fix#15; 8/24 green + eslint clean.**
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
  **FIXED fix#18 2026-10-22**: no keyed sibling exists (constants private, consumer census forbids shape change) -> modal consumes producer class-filtered strings minus the three dedicated-collector labels (byte-verified equivalence per class); dead SHORT_REST_RESOURCES import dropped; FIVE lying canned mocks replaced REAL-constants passthrough; absence-pins upgraded to exact-content; pre-fix RED = missing-export unmask + length-0; 97 lane + 441 blast-radius green + eslint clean.**
## Pass run2#297 (ShortRestModal.test.jsx)
- ⚠ ShortRestModal.jsx:688 vs :788 — replenishingMeals decremented at roll time AND again at completion from fresh runtime value; possible double-decrement. Probe in completionFlow lane (already marked; needs re-touch for probe) or restRules lane.
- 📌 rec completionFlow: plain-cleric getShortRestResourceLabels:()=>[] mocks hide :175-179; add one producer-shaped ['Channel Divinity'] completion test pinning missing log-label at message layer. (pass #297)
## Pass run2#298 (useAttackDamageResolution.advancedAutomations.test.js)
- 📌 cantripBonuses.js grantCantripTempHp modal-interrupt branch pinned by NO lane (step-internal); candidate for dedicated steps/features/cantripBonuses.test.js. (pass #298)
## Pass run2#299 (useAttackDamageResolution.automationDamage.test.js)
- 🔴 useAttackDamageResolution.js:361,366 — leftover [sw-debug] console.log in production source, fires every damage pass (debug litter, removal candidate).
  **FIXED fix#20 2026-10-22**: sites :361/:366 deleted (args pure-read verified, byte-diff 2-deletions); no liveness pins existed to flip; NEW absence pin at hook seam (seam-liveness via rollDamage + zero sw-debug bytes); 20 lanes/158 green eslint clean. SAME-TOKEN REPORT: sacredWeapon.js:11/16/18 three unconditional per-invocation [sw-debug] litter, ledger-scope-forced untouched - NEW queue entry warranted.**
- 🗑 attackRollBonuses.js:85-86 — silently drops non-canonical flat frenzy expressions ('rage_damage'); harmless (registry canon rage_damage_d6) but silent-zero class. (pass #299)
## Pass run2#300 (useAttackDamageResolution.automations.test.jsx)
- 📌 attackRollDamageSteps-automationBonuses.test.js heavily duplicates -weaponHitBonuses + -natural20-celestial + colossusSlayer step tests (~40 redundant step-level its) — queue merge consideration. (pass #300)
## Pass run2#301 (useAttackDamageResolution.classFeatures.test.js)
- 🔴 superiorHuntersPrey.js:74-79 — async applyDamageToTarget NOT awaited: damage log finalDamage=undefined + popup spreadFinalDamage/spreadTargetCurrentHp=undefined (honestly pinned in hook lane).
  **FIXED fix#19 2026-10-22**: one-token await (enclosing already async, zero caller edits, contract applyDamage.js:991/1052 cited); root-cause-green-mask was SYNC-mocked applyDamageToTarget contradicting real async -> faithful-async mocks fix#10r-compliant; pre-fix RED captured 3 lanes, pins exact-bytes flipped; 46 scoped + 5,288 collateral sweep green; eslint clean.**
## Pass run2#306 (useAttackDamageResolution.maneuvers.test.js)
- 🗑 rec useAttackDamageResolution.skipManeuver.test.js:111-121 — weak legs superseded by maneuvers skip fold here; candidates for deletion at its turn (verify mock-pipeline setup serves no other purpose). ✅ :439-456 drop consumed (#305 rec).
## Pass run2#307 (useAttackDamageResolution.mn014.test.js)
- ⚠ handleAttackRiderManeuverUse gates precision miss on mounted popupHtml prop not popupHtmlData arg: miss w/ null mount-popup silently routes hit post-resolution path (by-design-ish, damage lands safely). (pass #307)
## Pass run2#309 (useAttackDamageResolution.opportunity-transport.test.js)
- 🔴 useAttackDamageResolution.js:371-383 — hook-path proceedWithDamage minimalCtx omits isOpportunityAttack while standalone twin includes it (:57): OA marker dropped if OA resolves w/o buildCtxSync → Charger/Sentinel gates mis-fire. Reachability unverified; review.
  **FIXED fix#21 2026-10-22**: reachability LATENT-proven (single production mount, buildCtxSync always truthy CharActions:221; falsy-branch test-mount-only today) — parity key added anyway mirroring twin :57 byte-exact (FT-101 comment cites handlePlainDamage:379 Halt gate); NEW 4-test transport lane incl. cross-path equality + merge-branch ride; mutant-drop RED cmp-restored; else-branch full-set pins x3 extended isOpportunityAttack:false; 162+216 green eslint clean. Fold note standalone:168-285 deliberately untouched.**
- 🗑 rec standalone.test.js:168-285 proceedWithDamage/ctx-defaults twin describes near-identical — fold it.each at its turn (alongside existing 🗑 :288-481).
## Pass run2#310 (useAttackDamageResolution.optionSelect.test.js)
- 🔴 useAttackDamageResolution.js:555-562 — validation-after-mutation: maneuver-less payload closes modal + latches _brutalStrikeActive/_brutalStrikeEffects BEFORE rejecting → stuck latch (unreachable from InlineChoiceModals which always supplies maneuver; honest pin in lane).
  **FIXED fix#22 2026-10-22**: option lookup hoisted before close+latch (house order resumeAttackPipeline:511-514 + own null-branch precedent; validate-before-mutate, no-console pattern); stuck-latch honest pin flipped 3-branch faithful-store exact negatives + new partial-maneuver branch; mutant-drop RED cmp-restored; fix#10r spreads applied (combatSuperiorityHandler hole); 20 lanes/163 green eslint clean.**
- ⚠ useAttackDamageResolution.js:588 — speed-reduction log hardcodes "15 feet" ignoring option.value distance (cosmetic log).
- 🗑 rec skipManeuver.test.js:124-152 — describe('handleAttackRiderOptionSelect') block strictly weaker dups of optionSelect core lane; delete block at its turn. (pass #310)
## Pass run2#316 (useAttackDamageResolution.tacticalMaster.test.js)
- 🔴 attackRollPostDamage.js:713-714 — masteryDone marker step subscribes 'cleave:check' but sits after toppleMastery (emits 'mastery:done'); fires early, pipeline:complete precedes mastery resolution. Harmless today, latent ordering defect.
  **FIXED fix#23 2026-10-22**: event-chain model proven (run() steps.find single-path) -- defect WORSE: marker NEVER fired (cleave:check consumed by cleaveMastery :520; mastery:done subscriberless; pipeline:complete dead). subscribe mastery:done (toppleMastery :667 guarantee); NEW terminal lane invocationCallOrder + cleave-less kill-probe 4-fail; golden census row updated; 16 files/136 green eslint clean.**
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
  **FIXED fix#24 2026-10-22**: (stealthSkill?.bonus ?? 0) - exhaustionPenalty; rule law disk conditions.json:26 d20-test reduction + producer chain cited; sibling computeGrappleCheckBonus:171 -= form mirrored; pre-fix repro eval 5 + lane RED row; 8-row matrix 5-row-RED-then-green, sign-interpolation bytes intact, old bonus-absent rows byte-preserved; 57/57 5 lanes eslint clean; same-class grep: no other ?? - arithmetic sites.**
- 🗑 useCharActionsBaseActions.js:53-58 — statically-false includes('Stealth') (wisCheckReplace unreachable for Hide) + tautology 'Stealth'==='Stealth' — vestigial generic conditions. (pass #338)
## Pass run2#340 (useCharActionsModalHandlers.buffs.test.js)
- 📌 rec useCharActionsModalHandlers.inspiration.test.js — same bloat pattern: 14 mocks -> routed trio, triples fold 3->2 per handler (mirror #339/#340). healing/combatSuperiority siblings — audit mock preambles at own turns. (pass #340)
## Pass run2#341 (useCharActionsModalHandlers.combatSuperiority.test.js)
- 🔴 useCharActionsModalHandlers.js:65-80 — handleCommanderStrikeChoiceConfirm never flushes result.logEntries (commander_superiority grant log from combatSuperiorityUtils.js:298 silently dropped — same class as fixed MN-002). Add flush table row when fixed.
  **FIXED fix#28 2026-10-22**: MN-002 = direct helper flush (ce88d90f5, mirror handleRallyChoiceConfirm:99-101; ledger flush-table = test lane it.each); +5-line flush at correct seam order (util-await->popup->flush->modal-clear); test table row byte-exact per util :284-289 + times(1) strengthening all rows; pre-fix silence captured 0-calls RED; 41+ lanes green eslint clean.**
## Pass run2#343 (useCharActionsModalHandlers.inspiration.test.js)
- 📌 rec useCharActionsModalHandlers.test.js base — bardic/reactionBonus mock block redundant overlap (never routes them); trim at own turn. rec oceanicGift lane mirror #339-#343 canon when queued. (pass #343)
## Pass run2#346 (useInitiativeEffects.activeStateClearing.test.js)
- 🔴 useInitiativeEffects.js:324,330 — clearLivingLegend invoked twice same handler (doubled writes/SSE churn, dead dup).
  **FIXED fix#25 2026-10-22**: dup proven byte-identical same straight-line pass (arrival: 1c54eb4f2 copy-paste, preserved-fold 0bf564099); 4 redundant writes/SSE per roll eliminated; helper idempotent-value confirmed so single call final-state identical; new times(1)+write-bytes pin pre-fix doubled capture; 108/108 11 lanes eslint clean.**
- ⚠ useInitiativeEffects.js:152 — vow lane re-writes target activeBuffs unconditionally (no only-if-changed guard like clearActiveBuffsWhere) — SSE echo churn.
## Pass run2#347 (useInitiativeEffects.batchResets.test.js)
- 🗑 useInitiativeEffects.js:410 — dead guard Object.keys(updates).length>0 always true (builder unconditionally sets >=8 keys).
- 🗑 rec useInitiativeEffects.edgeCases.test.js:406-423 weak FT-007 find-in-updates (subsumed byte-exact here); buffClearing:444-456 guard restatement. (pass #347)
## Pass run2#348 (useInitiativeEffects.buffClearing.test.js)
- 🔴 useInitiativeEffects.js:111 — setRuntimeValue called with 5th skipSync arg; signature takes 4 (useRuntimeState.js:78) — silently ignored, writes always POST (misleading vs AGENTS.md skipSync guidance).
  **FIXED fix#26 2026-10-22**: arm(a) verdict — callee store setRuntimeValue arity-4 runtime-pinned, 5th arg never honored since 20d9582ac; local-origin owner-gated clear SHOULD POST -> dead arg deleted BOTH sites (:111+:175) + forbid-re-add comments; 12 tuple pins flipped exact-4arg (length-enforced); NEW live-store POST lane byte-exact single-fetch + zero-POST guards; 112 green. SAME-PATTERN REPORT: turnEndConditionRemoval:36, combatSuperiorityUtils:312-314, restRules-family sites — owner lanes.**
- 🗑 rec useInitiativeEffects.initiativeRolled.test.js:636-658 superior-defense restatement (weaker, no final-state). (pass #348)
## Pass run2#350 (useInitiativeEffects.concentrationClearing.test.js)
- 🗑 rec useInitiativeEffects.edgeCases.test.js:426-453 + :324 — same concentration guard/undefined-spell paths now covered here with seeded-store tables; consolidate at edgeCases turn. (pass #350)
## Pass run2#351 (useInitiativeEffects.concentrationClearing2.test.js)
- 🔴 useInitiativeEffects.js:163-171 — restoreCalmEmotions captures conditions once per effect: multi-suppressedConditions (['Frightened','Charmed']) second write clobbers first restore (fake-store reproduced).
  **FIXED fix#27 2026-10-22**: root = per-effect stale snapshot not store latency; producer-normal multi-item arrays (calmEmotionsHandler:170-172); ONE merged write per target per producer §39 canon + filter-write-once helpers; restore-sibling reuse REFUTED (conditionSaveService channel corrupts raw-restore bytes); pre-fix clobber byte-capture; 3-row it.each merged-write pins; 12 lanes/115 green. SAME-CLASS FOUND: concentrationService.js:207-218 verbatim stale loop (owner follow-on lane).**
- 🗑 rec edgeCases.test.js:244,274,297 Calm guard dups (weaker than guard table here); :324 overlap. (pass #351)
## Pass run2#357 (useModalHandlers-damage.test.js)
- 🔴 useModalHandlers.js:102 — damageType formula bracket rewrite runs unconditionally: annotation replaced even when _damageTypeModifier absent (label altered, resource unspent). Latent; UI likely always supplies.
  **FIXED fix#29 2026-10-22**: ternary guard on _damageTypeModifier (producer attackRollPostDamage:99-101 stamps only when spent; label-mutation now atomically coupled to guarded spend block :97-101); pre-fix repro absent-modifier bracket-mutate captured RED; kill-pair #1348 identical-input presence-differing-output; only bracket-rewrite site repo-wide (grep-clean); 5 lanes/59 green eslint clean.**
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
  **FIXED fix#30 2026-10-22**: disk truth 5e proficiencies = mixed container 12/12, 2024 split-fields keys absent-5e; flat relabel Proficiencies per CharSummary:275/FeatItemDetails:50 house precedent (no house splitter exists); pre-fix Fighter armor-under-Weapon-header captured; disk-import it.each byte-pins + absent-guards, all old assertions retained; 17/17 eslint clean. Label family scan: sole mislabel repo-wide.**
- 🗑 WizardStepClass accepts+ignores classSubtypes prop (dead surface; wizard passes it down generically). (pass #381)
## Pass run2#382 (WizardStepFeats.test.jsx)
- 🔴 WizardStepFeats.jsx:16 — 'Add Another' calls onToggle → SelectableList toggle removes ALL instances of repeatable feat instead of adding (pinned honest-flip test in lane).
  **FIXED fix#31 2026-10-22**: SelectableList has NO add API (read full) -> wizard-level append mirroring its own first-add expr (:201/:205) via existing local onArrayFieldChange (no server writes); onToggle->onAdd prop rename, checkbox lane untouched; repeat-rule disk feats.json:28/:79 + gate :44/:82/:224 cited; honest-flip pinned removal pre-fix then flipped 4-test never-destructive matrix; 37/37 incl SelectableList lane intact.**
- 📌 FeatItemDetails.jsx:13 — dict prerequisites render raw JSON (cosmetic). (pass #382)
## Pass run2#387 (WizardStepRace.test.jsx)
- 🗑 sign-off candidate: CascadingSelect.jsx + .test.jsx orphan pair confirmed (wizard renders plain select) — recommend delete pair.
- 📌 CharacterCreationWizard.integration.test.jsx:33-35 fake race fixtures (strings vs disk objects) — disk-import upgrade when lane touched. (pass #387)
## Pass run2#390 (WizardStepSkills.skill-cap.test.jsx)
- 🗑 rec WizardStepSkills.test.jsx:340 mislabeled non-feedback test (dup of :168-181); double-render splits :79-85/:100-105/:548 split scenarios. (pass #390)
## Pass run2#391 (WizardStepSkills.test.jsx)
- 🔴 WizardStepSkills.jsx:255-257 — 'select proficient first' feedback unreachable: Elevate disabled :352 blocks click reaching guard (dead branch). (pass #391)
  **FIXED fix#33 2026-10-22 verdict(b)-by-removal**: guard+disabled+tooltip born SAME commit c45bdf94e (disable never broke guard); narrowed-by-design cf74986e7 kept proficient clause; RAW elevation-requires-proficiency = hard-disable correct, tooltip IS the feedback; guard boolean-complement of disabled structurally dead removed -5 per orphan-code rule; disabled-click inert pins + proficiency-journey + mutual-pair live path 32 tests; identical-clause audit elsewhere: sole occurrence.**
## Pass run2#392 (WizardStepSpecial.test.jsx)
- 📌 WizardStepSpecial.jsx:29 — comment claims duplicate-name check; none exists (misleading, unimplemented intent). (pass #392)
## Pass run2#393 (WizardStepSpells.feature-touched.test.jsx)
- 📌 WizardStepSpells.jsx:41 vs :215/228/240 — banner gate (featNameMatches, object feats) wider than auto-open gate (string/f.index only): index-less object feat shows banner, never auto-opens.
- 🗑 rec WizardStepSpells.test.jsx summary-header test subsumed by breakdown test — trim at own turn. (pass #393)
## Pass run2#394 (WizardStepSpells.ritual-master.test.jsx)
- 🔴 WizardStepSpells.jsx:105 — ritualMasterChosenCount .length on non-array (string 'Alarm' -> bogus 'Edit Ritual Spells (5)' banner post-close; live-verified).
  **FIXED fix#34 2026-10-22**: cardinality array-law (producer RitualMasterModal:37 always-array, disk array rows, zero string-writer repo-wide -> string=legacy single); pre-fix bogus (5) captured live-sequence RED; house Array.isArray ternary (spellCalc2024:407/488 form); falsy-triple complete, multi (2) exact; 41/41 eslint clean. FAMILY REPORT: WizardStepSpells:260 auto-open inconsistent w string, RitualMasterModal:11 reopen-empty, spellCalc2024 string->silent-empty (owner lanes).**
- 📌 RitualMasterModal.jsx — NO test lane exists (save contract :37 + ritual filter uncovered) — queue dedicated lane when surfaced. (pass #394)
## Pass run2#397 (WizardStepSubrace.test.jsx)
- 🔴 WizardStepSubrace.jsx:11 — array damage_resistance interpolates join-less ('Bludgeoning,Piercing,Slashing damage.'); real disk Genasi data, cosmetic misformat. (pass #397)
  **FIXED fix#35 2026-10-22**: shape census Genasi mixed (Earth/Water arrays :495/:567, Fire/Air strings) -> Array.isArray join-comma-space ternary w string passthrough; house dominant join idiom 6-site cited no conjunction form; pre-fix byte captures both Genasis; disk-import pins + period-placement exact + not.toContain negative + string-shape guard intact; 15/15 eslint clean; sole join-less site repo-wide.**
## Pass run2#398 (WizardStepTools.test.jsx)
- 🗑 computeSkilledToolUsage (toolValidation.services.js) dead export (local dup in skilled-pool.js) — wire or delete; WizardStepTools.jsx:46-64 toolsFromSkilled computed-never-rendered. (pass #398)
## Pass run2#399 (EncounterBuilder.additional-interactions.test.jsx)
- 🗑 rec DELETE-outright x4: EncounterBuilder.{interactions,modal-flows,modal-interactions,gameplay-flows}.test.jsx all vacuous expect(true) zero-importer placeholders; .rendering.test.jsx dup-candidate. (pass #399)
## Pass run2#401 (EncounterBuilder.helpers.test.jsx)
- 🔴 EncounterFilterPanel.jsx:7 — onEnvironmentChange received, no control rendered (_alias): filter.environment unreachable from UI (legacy localStorage only).
  **FIXED fix#32 2026-10-22**: RESTORE verdict (added 2d54ff265, lost in-flight b0b431903 migration with alias-suppression fingerprint); Environment select mirrors Difficulty sibling block; options RUNTIME-derived from mounted bestiary (disk 12 unique + fixture-added proves non-hardcode; retired list was stale missing planar); props contract half-wired fixed w additive environmentOptions consumer line; 13-option exact matrix + controlled-reflection + builder-narrowing e2e; zero new CSS house classes; 49/49 lanes eslint clean.**
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
  **FIXED fix#36 2026-10-22**: stack = modal :55 formatted-name + builder raw-name (both b0cab1579, blame non-attributing -> 8-sibling leaf-ownership canon + rename/load straight-dispatcher parity); builder guard removed, modal byte-intact owner; NEW real-builder+modal lane pre-fix captured times(2) real double-fire, post times(1)+raw-name-negative; retired-stub pins moved passthrough honest; 51/51 10 lanes clean. NEW QUEUE: CharSummary:626 + useCharacterManagement:78 character-delete double-confirm (appended below).**
- 🔴 EncounterModal.jsx:145 vs :95 — rename UI unreachable: pen sets modal-local renameTarget but form renders only prop mode==='rename'; builder passes only save|load — handleRenameEncounter dead in prod UI. (pass #410)
  **FIXED fix#38 2026-10-22**: 4-gate local-state arm added (seed/header/form/list mutual-exclusion), prop arm preserved verbatim, pen trio born-unit b0cab1579 broken-link-from-birth verdict, mode-rename never-passed archaeology, builder untouched, NEW full-stack rename-flow lane + discriminating pre/post capture, zero-confirm parity held; 11 files 61 green eslint clean.**
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
  **FIXED fix#39 2026-10-22**: strict-presence-before-coercion (String(raw??).trim()!=="" guard, house idioms npcStatBlockUtils:23/monsterLegendaryUses:161/saveProcessing:869); MA-0286 three-quote verdict refuse-does-not-fold; disk census null-x41 authored-zero-x75 preserved byte-exact; tripwire hinge flipped + 5-arm distinguishable table; pre-fix +0-autohit captured; 910 tests 114 files clean. SAME-CLASS Number() report with per-site risk: :377/:2227/:623 LOW-risk latent, rest SAFE.**
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
  **FIXED fix#40 2026-10-22**: legal-shape verdict (runtime-restored state + sanctioned monsters-less accept lane HexMap:283/its tests) -> silent guard w house omit-block idiom no console.error; one-token ?.map populated-path byte-identical; pre-fix TypeError exact-site capture; absent/null/[] arms empty-bytes-identical pins + populated rows pin; 68 green; hex-map chain census clean.**
- 🔴 BUG useMapLoader.js:161 isInitialized.current guard never resets -> mapName prop change never reloads (deps :186 dead); Map.jsx:351 renders <HexMap> with NO key -> outdoor->outdoor switch shows stale map (VERIFIED by orchestrator). Fix at source-owner turn: key={mapName} at Map.jsx OR reset guard. Canary exists useMapLoader.api.test.jsx (unmount late-resolve) (#798-run)
  **FIXED fix#41 2026-10-22 ARM-KEY**: key={mapName} sole-mount remount; RESET arm refuted with evidence (hexMapNameRef :151 never-updated compounds silently dropping new-map edits even after load-guard reset); census all map content server-round-tripped, local state ephemeral = remount-correct UX; late-resolve handled by instance identity (no gen counter needed); 3 deep-pin lane RED-pre/GREEN-post incl generation + single-mount unchanged; canary green untouched; pre-fix zero-reload captured.**
- ⚠ BUG useMapLoader.js:210 save guard compares hexMapNameRef.current (:151, never updated) -> saves silently stop forever if mapName changes in place (#798-run)
- ⚠ BUG useMapLoader.js:178 silent catch(_err) swallows load errors, no console.error — violates no-silent-fallback convention (#798-run)
- 📌 REC: useMapLoader.init.test.js:60-71 default-config mostly raw useState defaults — trim to ref-seeding :83-90 at its own turn (#798-run)
- 🔴 BUG useMapLoader.js:188-210 mount-save scheduling race: await seam before hasLoaded.current=true -> persistence effect flushes once-or-not-at-all (observed both orderings same run; old objectContaining masked it; save count now race-tolerant with comment) (#800)
  **FIXED fix#45 2026-10-22**: deterministic-LATE verdict (guard on-purpose, pre-load flush = server clobber); loading-state guard replaces split-timing ref (same-batch flip => exactly-one flush w loaded snapshot); dead hasLoaded ref removed whole; race masks tightened exact-bytes x3 lanes + x5 mount loops; both arms pre-captured (deferred-save not-at-all arm proven); 53x3 byte-identical + 334 folder green. SAME-SITE REPORT: map/hooks/useMapLoader.js svgLoadInProgressRef :84/:75 sibling shape + its pinned FIXME(#800) zero-edit re-save residue -- sibling lane owns.**
- ⚠ BUG useTravelToolSync.js:21 dead ternary TOOL_TRAVEL===tool?'none':tool inside guard tool===TOOL_TRAVEL -> always 'none' (misleading, likely wrong var intended) (#806)
- 📌 FRAGILITY useTravelToolSync.js:20-24 branches B/C lack activation guard A has -> dep-churn re-fires setTool/cancelTravel; self-limiting today (effects flip condition; HexMap.jsx:128 memoizes weather handler) (#806)
- 📌 REC cross-file: RoadLayer.test.jsx:7-94/:140-155 wholesale vi.mock(hexMapUtils) + descriptor-null cases + memoization call-count tests — same oracle/zero-mock + memo-identity cuts per #813/#791/#796 discipline at its own turn (#813)
- 🔴 BUG ConditionEffectBadges.jsx:142 buildProtectionFromPoisonBadge reads ctx.te.dc lazily inside onClick but ctx.te reassigned per spec-loop -> TypeError on ANY click of Protection from Poison badge (caught live #820; click-pin withheld pending eager-capture fix — restore at source-owner turn)
  **FIXED fix#42 2026-10-22**: eager poisonDc const per file canonical idiom (:146/:151/:156/:161/:166/:137 — :142 sole lazy offender, path initiative/ not char-sheet/ ticket-drift); pre-fix TypeError + mutant stale-dc:19-leak captures; BOTH withheld pins restored (auras payload + removal path-rep); 85/85 13 lanes clean; same-class repo grep empty.**
- 📌 REC: common/CreatureBadge/ has NO tests — span-vs-button + 'Remove effect' title mechanics need a leaf home (zero-mock precedent) (#820)
- 📌 REC cross-file: ConditionEffectBadges.test.jsx:94-113 Save Disadv row (riderSaveDisadvantage) droppable — common lane #822 owns stronger surviving-badge version
- 📌 REC batch cleanup: storage.js dead mock (not imported by render chain, verified x4 #820-#823) in spell-effects/no-oa-speedy/pass-without-trace/ma1012-frozen-grip/target-effect-removal/disadvantage-next-attack/effect-removal/save-ability badges files — delete at each own turn (#823)
- 📌 CITE MAP control-spells post-#823: banishment golden :107-113->:59-65; wrong-target :115-121->:67-73; click-save :124-158->:75-109; Banishment badge :180-195->:139-154
- 📌 REC cross-file: target-effect-removal.test.jsx:104-119 14-effect it.each all traverse identical removeTargetEffect predicate — trim to ~4 reps (sanctuary/banishment/forcecage findResolved/slasher_enhanced_critical compute-override) at its own turn (#825)
- ⚠ CONVENTION src/components/common/CreatureBadge.jsx:8 wrapper <div style={{position:'relative',display:'inline-block'}}> inline styles — violates NEVER-inline-styles; rendered by every badge app-wide (#826)
- 📌 CITE drift: common #822 cites ma1012-frozen-grip :47-63 -> now :57-73 (refresh at common's re-touch) (#826)
- 📌 REC cross-file: target-effect-removal.test.jsx ~:110 removableTargetEffects it.each — add 'pass_without_trace_bonus' (only unenumerated generic-path key, renders find-based like protection_from_poison entry) (#828)
- 🔴 BUG ConditionEffectBadges.jsx:100-101 buildAbilityCheckAdvantageAllBadge double-wrapped parens: reasonText=` (${reasons})` then tooltip appends ' (' + reasonText + ')' -> title 'Advantage on all ability checks ( (Foresight))' (old regexes masked; exact-byte test now catches) (#829)
  **FIXED fix#43 2026-10-22**: assembler-paren ownership per :69/:85 direct siblings (bare reasons in, assembler wraps); sole double-wrapper of 3 tooltip assemblers, family census clean; KNOWN-DEFECT exact-byte pin flipped + multi-join/no-reason arms pinned; 13 lanes 87 green w fix#42 intact; parallel poisonDc hunk correctly identified-and-respected.**
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
  **FIXED fix#44 2026-10-22**: OR->AND triple (effect&&target&&source) matching banishmentHandler:108/sibling 7-site discriminator house style; registry key :609 cited, no companion keys per disk violet text (blinded rides conditions-channel not te); HM survival + other-pair over-removal pre-captured then byte-intact green; 297 tests clean. SAME-CLASS: clearAllExpirationEffects:226 Otto source-arm triage (benign-likely), concentrationService:66 intentional alias, repeatSave:36 intentional wildcard.**
- ⚠ useLootHandlers.js:25 lootResult.lootEntries.join unguarded deref (line 24 has || fallback, :25 lacks it) — null resolve throws, lands in catch incidentally; pinned honest (#875)
- 🔴 createRollConditionSaveHandler.js:226 emits action:'kept' -> LogConditionEntry.jsx:12 any-non-applied renders 'Condition Broken' label (mislabeled entries for kept conditions) (#876)
  **FIXED fix#46 2026-10-22**: 9-value producer census (6 collapsed to Broken pre-fix); map+neutral-unknown+console.error per no-fallbacks; kept/maintained->Maintained fa-link per sibling-voice canon; enum-cover full-byte pin table; removed=deliberate #862 fallthrough kept; 185 green; all existing pins intact. NEW QUEUE: LogBuffEntry:11 same binary-ternary shape (future buff-actions silently Added) - sibling lane.**
- 🔴 LogDeathSaveEntry.jsx:10 result:'removed' renders 'Death Save Failure' mislabel (:41 '()' ghost die, :43 stable-red-class from omitted success) — 3 defects, revive leg pinned honestly as-authored (#877)
  **FIXED fix#47 2026-10-22 (a)(b)(c)**: presentation-map mirroring #876 structure (arms stable/dead/removed, UNKNOWN+console.error); producer census proves removed=rescue-good (button title Resurrect); ghost-die via showRolls-map + roll!=null guard; tri-state polarity cls (===true/false/neutral); honest revive pin flipped; enum-cover 8-row distinguishable table; 159+69 green. SAME-FAMILY REPORT: LogRollEntry:102/:270 truthiness-red, LogHpHealing:108 + LogRollEntry:276 ghost-parens producible (triage lanes).**
- 🔴 LogEncounterEntry.jsx:4 isStart only 'started'; EncounterBuilder.jsx:307 emits 'joined' -> renders 'Encounter Completed'+trophy (pinned row2 #878). REC forward: LogEntryRendering pass must NOT re-pin encounter legs, dispatch seam only (#878)
  **FIXED fix#48 2026-10-22**: census live-producers joined(:315 drifted cite)+loot_awarded(x2) both collapsed to Completed+trophy pre-fix, started/completed legacy-vocab byte-intact; ENCOUNTER_PRESENTATION map + joined fa-right-to-bracket/rewards fa-coins/UNKNOWN+console.error per #876/#877 mirror; body showMonsters/showRewards flag-gating replaces binary; enum-cover 5-arm #1348; honest row2/row4 flipped #878; dispatch seam honest Log.jsx:30; 2014 green eslint clean.**
  **FIXED fix#50 2026-10-22 CANON-1 RETIRED**: gate playerId straight-swap (census: zero creatureId producers, sibling drag-invalid gate already keyed playerId, archaeology 63316979d rename holdout); lane 45/45 first-full-green, Map 8/8, eslint clean, CSS confirmed present-but-unreachable-pre-fix.**
- ⚠ LogHpHealingEntry.jsx:73 zero-delta labeled 'Healed' (isDamage=delta<0); :22-23 damage entries swallow authored sourceName/note (multiTargetHandler.js:129-130 bytes never render) (#880)
  **FIXED fix#49 2026-10-22 (#880 a/b/c)**: zero-delta honest fourth-arm No HP Change neutral fa-circle-info (producers clamped-overheal legit x9 sites census incl -0 full-resistance); damage/zero source-paren + unguarded-note restores multiTarget bytes; rollInfo-guards kept heal-only-vocab; REC gap closed row-by-row owner-map (breakdown->LogHpChange sole, Healed/zero-context->#880 claimed, dispatch seam only); 169 log folder + 4 multiTarget green eslint x3 clean.**
- 📌 REC cross-file: LogHpHealing.test.jsx:12-30 damage-breakdown REMOVE (relocated to LogHpChange #880); #880 must claim 'Healed'/source-paren/note/maximize bytes (gap between lanes flagged)
- 🔴 LogLootEntry.jsx:12 xpPerChar&&>0 short-circuits literal 0 into details when xpPerChar===0 (React renders '0') — stray byte '0Gold coins' pinned honest; fix is >0-only guard (source-side, reported) (#882)
  **FIXED fix#52 2026-10-22 (#882)**: >0-only guard canonical per LogEncounterEntry:61; zero-XP legit-reachable census (floor-dilution useLootHandlers:38/autoReward:47, default-factory leak log-test-utils:39); same-file audit lootItems safe boolean-trailing; honest 0Gold-coins flipped exact-innerHTML no-text-node + null/undefined silent arms; 172 log folder green. CROSS-REPORT: LogConditionEntry:48 dc&& numeric-0 ghost-arm low-reachability (future >0 lane).**
- 📌 REC cross-file: LogNotes.test.jsx absorb retained NoteEntry byte check from LogEntryRendering #879 (lane now exists); LogEntryRendering can then drop retained note test (#884)
- 📌 REC cross-file: LogEntryRendering.test.jsx:140-147 retained NoteEntry content test superseded by LogNotes census #885 — drop at re-touch, keep :100 routing, update header migration note
- ⚠ LogRollEntry.jsx:52 MISS renders trailing space ('MISS ') — cosmetic, pinned with trim (#886)
- 📌 REC cross-file: Map.test.jsx:410-421 fog-cell roles subsumed by FogOverlay exact-bytes #901 — collapse to one mount-smoke at Map's own turn (optional, harmless)
- 📌 REC cross-file: map.test-utils.test.js:711-716 useFogOfWar shape assert vacuous (tests the mock at map.test-utils.js:195) — delete block at its turn; canonical owner useFogOfWar.test.js #904
- 🔴 useItemDragging.js:28-38 setPointerCapture fires before ctm-null/item-not-found early returns; up-handler bails when itemDragging null (:96) -> pointer capture NEVER released on failed drag start (#905)
  **FIXED fix#53 2026-10-22 (#883)**: capture moved after guards+geometry, last-before-setState (invariant: state-non-null strictly implies captured, early-returns pre-capture, up/leave mirror = zero-strand closed); one-line move house-canon useRuler:22-27 validate-capture-commit; 5-fail pre-fix strand capture incl order-ledger; paired-capture/release #1348 arms + terminals-silent; 157+23 green. FIX#54 PRIME INTEL: usePlayerDragging capture :124 before :127/:130 guards IDENTICAL shape, #905 honest-pin comment at test:185-188 flip-condition, same one-line move. ALSO SAME-CLASS FOUND: useWallDrawing:12 + useSelectMove:110 capture-before-guard (queue lanes).**
- ⚠ useMapDrops.js:13 whitespace-only dragData passes !dragData guard -> furniture item type:'   '; :10-11 no numeric guard -> NaN-cell placement (both formerly pinned 'as expected' — vacuous pins removed #906, real guards belong source-side)
- 📌 CITE refresh useMapLoader post-#907: :161->:37 mapName-only staleness; :188-210->:78-92 mount-save race; :178->:60-62 silent-catch-empty-overwrite; :210->:50-57 load-time characters capture. ALL FOUR now pinned honestly with FIXME-style comments in useMapLoader.test.js
- 📌 usePlacedItems #909 recs adjudicated: (a) useNpcImageCache folder-red claim DISMISSED — orchestrator rerun 4/4 green standalone; (b) PlacedItems-event-handlers overlap rec FORWARDED to its own turn
- 🔴 usePlayerDragging.js:124 setPointerCapture-before-guards stranding capture on failed down + :257 release-after-guards stranding capture on guarded up — SAME class as useItemDragging :28-38 (#905/#910); drag-capture-leak class CONFIRMED systemic across both drag lanes
  **FIXED fix#54 2026-10-22 (#905/#910 systemic class CLOSED both drag lanes)**: down capture last-before-setState invariant, up release-first-after-null-bail mirroring fix#53 useItemDragging:101-104 exactly (no try/catch — capture-routing semantics documented, mismatched-id up unreachable), late :257 release removed; honest strand pins (:189-192/:344-362) flipped per stored #905 conditions, order-ledger + guarded-up pair + success pair NEW; 506 map folder incl fix#53 lane md5-stable green eslint clean. Remaining same-class queue: useWallDrawing:12+useSelectMove:110 (appended entry).**
- ⚠ useSpellHandlers.js:51 e.button!==0 guard inside hit-test loop -> right-click pointerdown on EMPTY grid with active placement tool creates overlay (quirk unpinned deliberately, source-side guard fix belongs: hoist button check) (#913)
- ⚠ useSpellOverlay.js:59 updateOverlay debounce timer never cleared on unmount (cleanup :35 cancelled-flag only) -> pending POST fires post-unmount (#914)
- ⚠ useSSESync.js:28 revealed uses !==undefined while :26 players uses || -> revealed:null overwrites prev with null (asymmetric non-array risk); unpinned, owner review (#915). REC: map.test-utils.test.js:565-582 shape/identity trivia + ~:707 no-arg real useSSESync call — drop at its turn
- 📌 REC map.test-utils.test.js:675-676 useWallDrawing() outside renderHook + painting!==null mock assert (tests mocks); merge with :565-582/:707 blocks — delete all at its own turn (#915/#916)
- 🔴 useZoomPan.js:79 handlePanEnd releases capture never acquired in handlePanStart -> browser NotFoundError (mock hides); + :103-107 factor-1 wheel redundant writes (#917)
  **FIXED fix#55 2026-10-22 (#917)**: A1 symmetric capture-pairing (pan-drag sibling census all capture, A2 would strand svg-exit stall bug); invariant state-non-null-implies-captured mirrors fix#53/#54 exact shape; factor-1 guard before writes (threshold tick proved churn -19.9->-19.900000000000006 lossy round-trip); FAITHFUL capture-tracking mock w NotFoundError DOMException replaces never-throwing vi.fn (mock-hid defect class treated at root); paired-ledger + failed-start-zero + factor-arms #1348; 600 map folder green eslint clean.**
- 📌 REC cross-file: Map-handlers.test.jsx :346 vacuous closes-context-menu (never opens menu first — strengthen open-then-close or remove, real path pinned #920); :280/:294 menu-content negatives duplicate #918 census — delete at Map-handlers' turn (#920)
- 📌 CITE drift: #915's :419 combined-handler routing face now Map-tool-handlers.test.jsx:489-491 (#922). REC: Map.test.jsx:304/:309 near-duplicate null-mapData merge at its turn; map.test-utils.test.js ~50 shape meta-tests prune to smoke at its turn (#922)
- 📌 NOTE Map3D.jsx:45-48 double-dispose race if unmount during init (idempotent/harmless, unpinned) (#925)
- 🔴 MapToolbar.jsx:42-48 Spell click with spellOverlayState:null throws (undefined destructure); ⚠ :127 falsy-divergence spellMode '' mounts controls inactive (#928)
  **FIXED fix#56 2026-10-22 (#928)**: evidence-refutation half-kept (destructure already ||-guarded; live throw was toggleSpellMode:47 setter-missing, pre-fix 4 uncaught captured); inert-guard beats noop-defaults (half-action deselected paint w/o arming); census spellMode value-space null-union-enums, NEVER produced -> truthy-unify verdict per all-consumers-truthy, ghost-controls-panel :127 retired; missing-state 4-arm + falsy-mode 3-arm matrices + byte-intact legit pins; 73 green eslint clean. onSelectShape unguarded honest (unreachable falsy).**
- 📌 REC cross-file: useLoggedDiceRollAttack.potent-cantrip.test.js school/zero-INT non-fold it.each legs duplicate #931 t3 owner — consolidate at its turn (#931)
- 📌 REC: consumeGuardianProtectionAcBonus MA-1463 (attackPostProcessing) has NO unit lane — its own ticket lane when queued (#932); REC PlacedItems-localhost-rendering-2.test.jsx:50 redundant w/ #930 localhost legs (#930)
- 📌 REC cross-file: weakening-breath lane trim keep-low byte (base owns #938) at ITS turn [now queued NEXT]; useLoggedDiceRollAttack.misc-effects 'no lucky when forcedMode set' dupes feats-of-chaos #936 rows 4/5 — feats cited owner, trim misc-effects at its turn (#938)
- 🔴 handlePlainDamage.js:556 multi-target apply passes characters:null (twin :518 passes characters) — player context lost on multi-hit; :523-531/:558-566 twin/multi share twinTarget* popup fields, multi overwrites twin (#941 pinned as-authored)
  **FIXED fix#57 2026-10-22 (#941)**: characters threaded same-value in-scope (dropped-one-frame-away); (b) twinTarget* Venn EMPTY-intersection vs renderer -> multi publishes NOTHING (whole namespace dead payload incl twins: RENDERER TICKET REPORTED); resistance-THROUGH pin derives-from-characters-only fidelity pre-fix 10 post-fix 5; players-null TypeError-prone arm now live-safe; 723 pass. MIRROR-QUEUED: handleNpcSaveDamage:387/:440 multi-null-characters + :354 intentional-share, handlePlayerSaveDamage:304 null into applyForcedSuccessSave.**
- 📌 REC cross-file: automationPopup:59 + modalRouting:111 fallback near-dupes -> merge into modalRouting key-map owner at ITS turn (#945); returnValue:64 clear-case defer here (#945)
- 🔴 useSpellPositionResolver.js:26-34 attacker matched name-only, missing-gridX entry writes half-coord cache consumed by executor (:946 pinned honest) — needs coord-validity guard source-side
  **FIXED fix#58 2026-10-22 (#946)**: half-coord NaN-auto-miss chain fully documented live-verified damageCalc:16->rangeValidation->miss(NaN ft); hasGridPos Number.isFinite both-ends gate, string-coercion leak (gridX:"5") fixed too (5 arms pre-captured); cache-MISS graceful arm proves skip honest, name-only KEPT house-convention (lineOfSightGate sibling parity); multi-match-positive adjudication caught+kept valid-resolves; 73 green (5 defect-arms RED pre-fix).**
- 🔴 summonSpiritHandler.js:366 Instantaneous summons (Find Steed) hit summonDurationRounds(...) || 10 fallback -> 10-round despawn clock kills steed RAW-'until dismissed' violation; :304 duration:'1_minute' te mislabel cosmetic — both pinned honest w/ FLAGGED comment C1 (#951)
- 📌 REC: save.test-utils.js makeSaveDcTests ORPHANED (only consumer save.test.js #958 now loops) — delete in scoped pass; save.js:299 prismatic raw-damage no token-resolve (pinned as-authored, leaks if token data ships) (#958)
- 📌 suspect spell.js:82 dragon_companion hardcodes noConcentration:false while free_spell:22 reads auto.noConcentration — pinned as-is drop-pin #960; summonSpiritHandler.js:366 ||10 despawn-clock + :304 1_minute mislabel confirmed earlier #951
- 📌 REC cross-file: restoreBalance.test.js:49-57 collectSaveModifiers null/undefined legs dup automationModifiers guard (#964) — trim at ITS turn keeping 3 restore_balance legs
- 🔴 automationPassives.js:173 vs :229 — read lane accepts legacy max_hp_increase bytes but markFortifiedHealthUsedIfGranted ownership matches only fortified_health: legacy-holder heals every time, once-per-turn latch never engages (pinned honest #966)
  **FIXED fix#60 2026-10-22 (#966)**: ownership predicate dual-literal alias per inline house idiom (carryingCapacity:173 parity, no canonical const exists); census legacy LIVE-on-disk both rulesets Tough rows but no selfHealing companion today -> structural-live via collector raw-passthrough (passive.js:38-48 verbatim-bytes, name-gate lanes already agnostic); pre-fix unbounded double-heal latch-dark captured; latch bytes exact mark/refuse/round-wrap re-arm turn-seam NO-CLOCK compliant; 324 green 25 files eslint clean.**
- 📌 CITE map: #969 kind-gate×replace precedence face owned wm008-kindgate.test.js:66-80 (#970 quote-refresh; base cites by filename — valid)
- 📌 REC cross-file: automationService.core.test.js:31-48 describe('getAutomationInfo') fully subsumed by buildAttackInfo facade lane guard-battery+transparency (#971) — delete block at core.test.js ITS turn, keep hasAutomation + expression lanes
- 📌 REC cross-file: automationCollector.types.test.js:216-217 arcane_apotheosis empties subsumable by full-envelope fingerprint — low-prio at ITS turn (#972); collection CITED-OWNER categorization faces PRESERVED (old:66-:280 folded into 21-feature golden #3)
- 📌 REC: automationService.modifiers.test.js unmarked lane — mark+trim at ITS turn (#973); automationExpressions.js:257→:273 double warn+error on unresolvable token (noise, behavior correct) (#973)
- ⚠ FLAKE-watch: ElementalAttunementModal.player-save.test.jsx + WizardStepSpells.feature-touched.test.jsx parallel-load fails, pass standalone x1 (#183) — stabilize on 2nd occurrence
- 📌 REC cross-file: interactive.twinkling test 3 + useMagicDevice bare-type test dup generic mechanics #976 — fold to verbatim-row shape at ITS turns (#976)
- 🔴 automationService.js:132-133 getEvasionEffects iterates automation array entries without null guard (auto.type throws on [null]); sibling isInteractiveAutomation guards if(!auto) at :118 — latent crash on sparse automation arrays (#979)
  **FIXED fix#59 2026-10-22 (#979)**: if(!auto)continue sibling-idiom +1 line, throw pre-captured exact bytes; reachability defensive-only (disk scan clean) justified defense-in-depth w automation-index:718 anticipated-contract parity; 8 same-gap crash-sites enumerated with delegation-safe distinctions (allSaveProficiencies:190/immunities:10,36,184/passives:473/modifiers:259/collector:123 crash-class, 3 safe-by-delegation); 179 green eslint clean.**
- 🔴 2024/spells.json Aura of Vitality missing casting_time (PHB: Bonus Action) — classifier defaults chargeable action; pinned tripwire #983. ⚠ feats.json 'special' not a ROW_BUCKET lane token (harmless w/ casting_time passive) (#983)
- 📌 REC cross-file: assertCanAct.charge.test.js:120-122 bucketForAction classification examples dup base-lane #984 behind pure delegation — trim to one delegation example at ITS turn (#984)
- 📌 REC cross-file: steps/attackRollBonuses-brutalStrike.test.js t3 ordering dupe #986 — fold into t1 keeping dice-application at ITS turn; improvedBrutalStrike clean keep-as-is
- 📌 NOTE buffService.js:29 idempotent re-activate writes unchanged array → redundant SSE broadcast (efficiency nit, correct) (#987)
- ⚠ chargeEconomy.js:11-12 doc claims off-mode refunds allowed at GM-correction seams but refundSlot:47 returns false zero-writes when enforcement off — doc/impl divergence, honest-pin #989
  **FIXED fix#62 2026-10-22 (#989)**: DOC lost, IMPL authoritative — git order proves it: birth commit 2e9934d47 shipped refundSlot off-mode `return false` WITH commit-message "enforcement off => zero-write" for the bridge, and the only later touch b6643e6fe "Admin Referee role logic removed" was a doc-only scrub that mangled "enforcement.referee/off-mode refunds allowed" into an unqualified "off-mode refunds allowed" claim never wired in code. Rule applied: enforcement-off = system never charged, so this bridge has nothing to refund — refundSlot:47 is the exact symmetry twin of chargeSlot:35 (and chargeMovement:59); turnState.refund has NO production importer outside this bridge and refundSlot has ZERO production callers (census: tests only), so a force/correctionReason param would be speculative churn on a dead wire — rejected. Fix = doc converge: header :9-16 rewritten (zero-write no-op now explicitly refunds-included; GM-correction un-charge honored only while actionEconomy ON) + refundSlot fn-doc states the false/zero-write off-mode contract; "referee" role residue scrubbed from fn doc. Test lane UNTOUCHED — #989 off-mode arms (refundSlot->false, zero writes, state survives) flip honest->canonical doc-conform exact bytes; on-mode charge/refund pairing arms #744 byte-intact; turnState.js:107 refund() fn-doc reads enforcement-agnostic (pure math, no flag) — no cross-file divergence remains; 0 caller edits.**
- 🔴 concentrationService.js:213-217 restoreSuppressedConditions splices per-loop, last write drops earlier restore (multi-missing case) — pinned honest #990 T6; :483 cleanupBuffsByName name-only no-source check (cross-caster strip) — pinned honest #990 T9; :225-227 removeCalmEmotionsBuffs strips ANY creature's Calm regardless of caster — pinned honest #990 T9; minor :450-451/:469 unconditional writes — pinned #990 T13/T12
  **FIXED fix#61 2026-10-22 (#990 a-d all four)**: (a) fix#27 exact twin merged-write + length-guard; (b) casterName param caller-passed-but-ignored now threaded, unattributed-still-struck producer-forced (spellPrep:801 no-stamp rows), 4-stamped-producers census cited; (c) sourceCharacter scoping verbatim house-mirror clearExpiration:322/producer:182-188; (d) dirty-guarded par88 parity + churn arms; 4 pre-fix captures via flipped-pins-RED; caller-edit-free proven 87 external green; 757+ pass total.**
- ⚠ conditionEffects.js:483 foresight ASSIGNS abilityCheckAdvantageReasons=[...] (not addUniqueReason like bolster:501) — can clobber co-existing bolster reasons on same target; foresight lane owns face — pin at ITS turn (#996)
- 📌 REC cross-file: conditionEffects.test.js:330-337 clairvoyant-half dupes compute canon :263-272 (#997) — drop clairvoyant legs keep crusher at ITS turn; foresight :483 assign-vs-addUnique pending ITS lane face (#996)
- 📌 REC cross-file: conditionEffectsCompute.test.js :242-248 dup :308, :250-255 dup :210, :257-261 dup :228 — drop first-cited at ITS turn (#998); restoreBalance (1,0)/(0,1) rows merge candidate :156/:176 (#998); foresight clobber APPLIED-pinned #998
rec #997 APPLIED #998 (clairvoyant-half dropped); rec #996 APPLIED #998 (foresight pinned)
- 📌 REC cross-file: restoreBalance.test.js:132/:144/:149 absent-false trio fold to one (#1000); conditionEffects.test.js:191 dodge-fold + :130-131 plain counts now duped by compute census — delete at base ITS turn w/ forwarding cite; :134/:135 fiend_undead byte-identical fixtures delete one (#1000)
rec #998 x3 APPLIED #1000 (:242/:250/:257 dropped verified-both-blocks)
- 📌 REC cross-file: npcFormUtils.test.js ABILITY_LABELS golden low-value (#1006); CharConditions.condition-saves.test.jsx re-implements getAbilityLabel in mock — shrink to vi.fn(abbr=>abbr), behavior owned conditionUtils #1006. NOTE conditionUtils.js CONDITION_SAVE_DC dead-but-exported (#1006)
- 📌 REC cross-file: travelService.test.js:42 EXHAUSTION_LEVELS re-pin removable at ITS turn unless import-surface pin needed (#1008); CharConditions exhaustion/condition-saves/rendering/logging/slow 5x hand-mirrored formula mocks — consolidate to shared factory at their turns (#1008)
- 📌 MA-1463 FORWARD: consumeGuardianProtection face belongs to attackPostProcessing lane (#932 -> adjudicated NOT restoreBalance #1009; guard-stamps at attackPostProcessing.js:261)
- 📌 CITE-refresh owed: conditionEffects :44/:46, compute :13/:26/:112, combine :23-24 point at old restoreBalance ranges — refresh at their turns (#1009 rec #964/#998/#1000 APPLIED)
- 📌 REC cross-file: monsterGrantReaction.test.js:84 + monsterSelfBuff.test.js:83/:226 registration-exists checks subsumed by te golden census #1012 — trim to producer-contract assertions at ITS turns
- ⚠ movementBudget.js:125 clampSelectionOffset minBudgetFeet:'x' -> NaN outputs (Math.max(0,NaN) no floor guard); unreachable via real consumers (remainingMovement finite) — pinned untested not NaN #1017
- 📌 REC cross-file: attackRollDamageSteps-automationBonuses.test.js brutal-strike legs subsumed by steps/bs t1 exact bytes — keep inactive-guard only at ITS turn (#1022); cla048 sibling: add speed_reduction te + addExpiration clock gap on pipeline lane (#1022)
rec #986 APPLIED #1022 (t3 dupe vs #986 CANON verified, folded)
- 📌 REC cross-file: attackRollDamageSteps-natural20-celestial dupes automationBonuses steps[14] block (~6 legs incl :533/:715 range-only #973) — consolidate one owner at ITS turns (#1023); steps/bs Hamstring Blow speed_reduction+addExpiration(rounds:undefined) leg unexercised — add at attackRollBonuses-brutalStrike ITS-next touch or automationBonuses ITS turn (#1023); rec #1022 cla048-speed_reduction gap CLOSED-WRONG-BRANCH (CLA-048 stamps nothing, branch :426-471 evidence) (#1023)
- 🔴 attackRollBonuses.js:91 _frenzyUsedRound stamps unconditionally post-loop even when every rollExpression returned null (:86 continue) — frenzy burned for round, zero rider applied; unreachable with valid 4d6 data, latch-honesty defect (#1026)
  **FIXED fix#63 2026-10-22 (#1026)**: applied-flag gate frenzy :91 + co-located same-shape divineFury :120 if(r) twin both fixed; sibling guard-cites epitome:22/weaponMastery:258 flow-parity; pre-fix zero-rider-burns-round captured exact-bytes; #1348 arms all-null/not-burned + one-of-two + multi-land-once + divine-null; 1143 pass across 66 files eslint x3 clean. BURN-VARIANT QUEUED: psionicStrikeHandler:71 telekineticThrust latch-stamps-before-uses<=0-refuse (refusal burns latch).**
- 🔴 attackRollDamageCalc.js:37-46 markRadiantSoulUsed gates passive+type-match only, not chaMod>0 — zero-CHA attack burns once-per-turn latch with zero bonus applied; pinned honest zero-CHA leg (#1028)
- 📌 REC cross-file: attackRollDamageSteps-weaponHitBonuses.test.js ENTIRE file dupes whb fold CANON #1029 — delete-or-stub at ITS turn; natural20-celestial byte-identical 1d6 legs fold + celestial-guard dupes trim (#1029); steps/bs:18 stale header clause refresh (#1029)
recs #1022/#1023/#1027 APPLIED #1029 (bs weak dice legs cut, Hamstring clock NEW, generic arms CANON confirmed)
- 🗑 attackRollDamageCalc... correction: attackRollPostDamage.js:380-384 resolveCleaveCreatureHp player-branch dead code — players excluded earlier by cleaveCandidateEligible; harmless, owner may delete (#1031)
- 📌 CITE refresh: #1027 mod-append/skip CANON now @ attackRollDamageSteps-damageRolling.test.js:152-165/:168-185 (#1032); :237-255 cite drift closed
- 📌 REC cross-file: attackRollDamageSteps.test.js structural lane may add one-shot subscribe/emit chain assert (dmg_type:modified→damage:ready→damage:applied, steps 17/18) at ITS turn (#1033)
- 🔴 attackRollBonuses.js:374-385/:411 buildNatural20BonusesStep never consumes extraDamageType — same_as_attack/force/missing all no-ops, dead authoring metadata on natural_20_attack_roll actions (#1035)
  **FIXED fix#64 2026-10-22 (#1035)**: sole-disk-row Boon Irresistible Offense same_as_attack string-shape census; consumption natural20DamageLabel byte-mirrors frenzyDamageLabel:71-74 + append family; dead [name]-labels -> authored-type tags, 3-shape semantics table incl missing-gate console-loud per celestial:467; real-row imported fixture pre-fix zero-consume byte-captured then +4[slashing]; zero-normalization collector verified; 5154-charSheet-sweep green.**
- 🔴 attackRollBonuses.js:405-419 natural20 step has NO oncePerTurn/latch guard (vs celestial :449/:467) — stacks every nat20, no consumption stamp (#1035)
- ⚠ attackRollDamageSteps-automationBonuses.test.js:436-457 celestial guard suite all omit targetName — short-circuit :433, pass wrong-reason (falsifiability failure); :458-468 app dupe — remove at ITS touch; keep :422 Math.max leg unique (#1035)
rec #1029 APPLIED #1035 (1d6 byte-identical fold verified :374-385, guards trimmed, #973 legs eliminated)
- 🔴 attackRollPostDamage.js:677-679 hasTopple consults extra/choiceMasteries but next line returns unless baseMastery==='Topple' — choice/extra-granted Topple (Battering Roots) never prompts; hasTopple dead unless base; pinned refusal leg #1037
  **FIXED fix#68 (#1037)**: union gate per cleave :527-530 shape + collectTacticalMasteries :575 Topple-exclusion proves prompt-intent; extra-granted arm was TRULY dead (no prompt site at all); tactical-pending dedup avoids double-prompt on modal-picked choice (one-line deviation flagged owner-review, useCharActionsCleave:170 byte-pin evidence); choiceMasteries/extraMasteries producer liveness both pinned automationPassives:239/:251; t2b flips+guards F base-never-weakened; NO-CLOCK verified.**
- 📌 rec #1029 weaponHitBonuses ADJUDICATED #1038: not wholesale-dup — 11 arms folded to #1029, 2 repo-unique option-APPLY positives KEPT (:277 polarity + :274 upgrades||name key derivation, fold negative-only cannot catch '_undefined_option' silent loss); file now 2-test lane
- 🔴 attackRollRiders.js:174 BI handler returns bare null vs {data:{}} siblings :168/:204 — shape-inconsistent pipeline result no-die/no-uses paths (#1041)
  **FIXED fix#69 (#1041)**: null = pipeline ABORT-token (actionPipeline:10/:35-36) -> BI-exhausted bard hits rolled ZERO base damage LIVE-bug not cosmetic; real createPipeline trace aborted-before-rollBaseDamage captured; {data:{}} parity restores continue-semantics prompt-decline-arm parity proves intent; 8-row shape-census + relay pins; born-inconsistent 33a8ba4f9^. NEW QUEUED FROM CENSUS: attackRollRiders:167 passes string ctx.playerStats.name into hasBardicInspirationOffense(playerStats) object-contract reader (arg-shape mismatch, rarely-reachable mask).**
- 📌 CITE refresh: useAttackDamageResolution.maneuvers.test.js:8-9 delegation stale since #1039 zero-body attackRollDamageSteps.test.js — retarget to attackRollRiders.test.js ITS turn (#1041)
- 📌 REC cross-file: radiantSoul.test.js:91-101 spellRollDamage consumption-flag leg sits in wrong lane — consolidate into directSpellDamageSteps-rolling.test.js at ITS turn (#1042)
- 📌 REC cross-file: directSpellDamageSteps-rolling.test.js:101-115 spellRollDamage condition trio fold (#1043); directSpellDamageSteps-overchannel.test.js:126-148 useCount >1 rows fold (#1043)
- 🔴 directSpellDamageSteps.js:189-205 roll-null → step still emits spell:ready {data:{}} — Overchannel self-damage silently skipped, unlogged free ride (#1044)
  **FIXED fix#70 (#1044)**: maximized-bonus strip-and-flag on cost-roll-null (max 48 -> base 30 stripped-proof), crit keeps doubled dice base, refusal addEntry overchannel_refused per grappler §5 precedent + console loud-reject celestial-parity, null=abort-token only double-failure arm, zero-latch-burn cost-model verified (Wizard lv14 escalating per-LR not points), success bytes verbatim #829/#1007, retired defect-pinning test, 531 sweep green. SIBLING QUEUED: attackRollPostDamage buildOverchannelStep :157-175 same shape.**
- 📌 REC cross-file: steps/index.test.js:37-47 spell-pipeline toContain subsumed by structure golden #1048; :5-35 four run-toBeDefined smokes assert nothing — collapse at ITS turn (#1048)
- 🔴 colossusSlayer.js:17/:29 getCurrentCombatRound() missing campaignName (signature combatData.js:79 requires; siblings assassinate:28/eldritchStrikes:27 pass it) — multi-campaign round pins 1, latch once-per-rest; pinned honest (#1050). Same-arity: crusher.js:33, epitomeEmpoweredStrikes.js:14 (#1050)
  **FIXED fix#71 (#1050 trio+1)**: 4 sites now pass ctx.campaignName (combatData:79-82 undefined-campaign->constant-1 quoted); importActual-delegate lanes prime round 7/5 cross-campaign decoys (pre-fix 6-RED live captures, not mock-arguments); NEW crusher.test.js lane 5 tests born-fixed; two zero-arg pins flipped honest; 1773 green 149 files. CENSUS QUEUE (10 sites no-arg in-scope campaignName + crusher:38 campaign-key-report + CharBonusActions:450 helper-plumbing): executeManeuver:235/executeActionManeuvers:105/dispatchers:79/housekeeping:54/:65/weaponMastery:139/:148/attackCalc:362/CharBonusActions:455-456.**
- 🔴 colossusSlayer step + dispatcher attackRollPostDamage.js:35-45 never addEntry/log — app logging mandate violated on trigger, 11 siblings self-log (#1050)
  **FIXED fix#72 (#1050-log)**: step-side self-log per 11-sibling dispatcher-pure pattern (epitome byte-nearest: ability_use sideEffects after-latch-stamp), disk law both rulesets quoted no-fabricated-type (+1d8 weapon-rides), rolled-values-through-seam per tavernBrawler; silence pre-capture 4-leg RED 0-calls; exact-payload + callJournal order + roll-null no-log + other-campaign lands; dispatcher cp-cmp byte-identical; 140 green eslint clean.**
- 🔴 epitomeEmpoweredStrikes.js:14 no-arg getCurrentCombatRound ESCALATED: getCombatSummary(undefined)->null->round const 1 (combatData.js:48/:81) — latch stamps 1, feature once-per-rest NEVER re-arms; old re-arm test was mock-fiction, pinned false (#1052 vs #1050 class)
  **ALREADY-FIXED by fix#71 (same site, same class): live bytes :14 now getCurrentCombatRound(ctx.campaignName); fix#71 lane flipped the mock-fiction re-arm pin (headless 'only because the mock moves it' removed), live-cache round-7 stamp + campaign-pinned arms green. Verified 2026-10-22 by orchestrator read.**
- ⚠ sacredWeapon.js:11/:16/:18 leftover [sw-debug] console.log noise in prod step (app logging mandate); :7 ctx.playerStats unguarded deref TypeError when weapon-byte passes w/ null stats — both pinned honest tests (#1056)
- 📌 REC cross-file: superiorHuntersPrey.test.js condition block 4->2 fold + round-0-latch case dupes same-round byte-path — fold at ITS turn (#1059)
- ⚠ tavernBrawler.js:42 dead ternary 'showing'/'showing' identical branches + 'damage die' never pluralizes multi-reroll — cosmetic log text, tests pin current bytes (#1061)
- 📌 REC cross-file: tavernBrawlerPush.test.js:111 weak find(includes)+any(Object) strengthen exact; :105 campaignName-threaded subsumed by te-write tests removable (#1061)
- 📌 REC cross-file: useAttackDamageResolution.feats.test.js:533-541 seam latch-tuples soften to presence (byte-exactness @tavernBrawlerPush #1062) at ITS turn; ⚠ tavernBrawlerPush.js:11 null-playerStats TypeError unguarded pinned honest (#1062)
- 🔴 steps/index.js:47 buildGenericSteps DEAD via router (:39 routes all non-spell damage->attack, :45 captures spell-first); generic lane #1063 unreachable producer from this router (#1064)
  **FIXED fix#74 (#1064) VERDICT-(b) dead-code-removal**: born-unreachable same-day ac0eb18ce/9447923a2 empty-set predicate algebra + second layer chain-start-vs-run-event deadness (housekeeping:do runs zero generic:do steps), no unique capability (contract verbatim in attack:62-67/spell:126 lanes), autoFormulaOverride ctx-not-action field census; probe misroute-absorb captured; 168 lines removed 2 files router-arm+builder+golden, routing-table-12 kept as permanent absorption census-pin; 690 green eslint clean. CO-FINDING QUEUED: spell lane spell:do-start vs housekeeping:do-run unreachable-via-router-production-seam (potential zero-step on spell actions there).**
- 📌 REC cross-file: sseObservers.test.js 'array of observer objects'+'wildcard observer' subsumed by 'two wildcard observers' census — trim ITS turn (#1064); rec #1048 APPLIED #1064 ✓
- 🔴 observers.js:40/:57 raw ${ctx.playerStats?.name} interpolation no 'unknown' fallback — "undefined applied Sneak Attack" log text for anonymous ctx; pinned honest (#1065); sseObservers 13->~8 census-fold rec reaffirmed (#1065/#1064)
  **FIXED fix#76 (#1065)**: utils.getName canon both sites (import-clean depth-pattern cited, getName(string)-not-object arity caught pre-mistake), defensive-not-live honest verdict (ctxOverrides-spread constructible), Unknown-prose flipped, lowercase structured-field bytes kept, fold-rec already-satisfied no-op (6<8 census).**
- 🗑 summonedCreatureService.js:8-10 isSpellSummon DEAD export zero callers repo-wide (service uses inline checks) — delete source+test describe coordinated source pass (#1067)
  **FIXED fix#82 (#1067)**: fresh census 0 non-test callers (11 hits all docs/tests/def), inline checks semantically broader/stricter superset proves never-canonical, -16 lines two files zero-behavior, 16-lane import-clean matrix.
- 📌 REC cross-file: psychicTeleportationHandler.test.js:159-186 + tempTeleportHandler.test.js:620-633 semantics re-derivation via mocked applyTeleportTokenMove soften to toHaveBeenCalledWith+prose at ITS turns (#1068)
- 📌 turnState.js:58-61 defense-in-depth: negative numeric *Used passes unclamped (Number(-5)||0=-5) forged-store over-grant vector — Math.max(0,..) close on source pass; deliberately unpinned (#1070)
- 🔴 diceRoller.js:42 regex accepts d0/0dN -> parse('d0')={count:1,sides:0} phantom die always rolls 1 (#1072)
  **FIXED fix#75 (#1072)**: sides-tighten [1-9]\d* zero-producer-census-verdict (TrueStrike 0d6 disk-legit silent-zero KEPT legal, d0-Nd0 zero-hits garbage-reject null per house-speculative-probe-silent class no-console canRoll/or-chain fan-out reasoning); phantom pre-capture rollDie(0)=1 mechanism quoted, ticket 0dN-leg self-corrected; zero-twin optional-count parsers src verified (10 sibling parsers count-required), phantom-immune ledger + RNG-zero ledgers, 379/379 green.**
- 🔴 diceRoller.js:88 vs :73 case mismatch: canRollExpression('1d8 PLUS 2d6') true (case-insensitive split) but rollExpression case-sensitive includes(' plus ') -> null (#1072)
- 📌 REC cross-file: six duplicate NdM stub parses (bonuses-basic/featureDamage/weaponHitBonuses/automationBonuses/frenzy/genericSteps) -> shared diceStub.js helper at their turns; fidelity pinned @diceRoller #1072
- 🔴 combatData.js:29/:59 passes campaignName 3rd arg to getRuntimeValue (signature arity-2 useRuntimeState.js:63) — campaign ignored, runtime fallback reads current-context store cross-campaign; root of #1052 chain, decoy-pinned here (#1074)
  **FIXED fix#77 (#1074 ARM-B)**: both runtime-fallback legs rerouted via campaign-keyed getActiveCreatureName/getCombatSummary (stores=Map characterKey-only quoted, campaign-scoped SSE cache exists cache:7), file-length-83 cite-stability discipline, 7 REAL-store RED bleed captures incl cache-persisted OFF_CAMPAIGN poisoning, decoy-never-crossed every row, abstinence pins, loadActiveCreatureName zero-prod-callers blast-containment, systemic-arity stays deferred-infra #1520 cited, 1473 sweep green.**
- 🔴 combatLoggingService.js:45 Concentration log `Concentration: ${spellName}` no fallback — literal 'Concentration: undefined' on callers omitting spellName (#1075)
- 📌 initiativeService.js:135 parseInt(initiative_details) vs :7 stricter regex parseInitBonus — latent divergence ('4 up'->4 vs 0), behaviorally consistent at 0, owner awareness (#1079)
- 📌 monsterAbilityUses family recs (#1080): dretch-fetid-cloud :33-44 route-through-spend; vrock :37-51 gate-overlap trim + :54-82 strongest ticket-cycle keep; succubus :74 + imp :102 synthetic unlimited-null trim to cites. FRAMEWORK OWNER = monsterAbilityUses.test.js (MA-0020) generics — tickets cite-only.
- 📌 vrock-stunning-scream :28-35 dupes framework strip/maxUses + tautological not.toBeInstanceOf — fold row-lock citing MA-0020 ITS turn; :37- hand-built gate same #1080 anti-pattern route-through-spend (#1081)
- 📌 vrock recs UPDATED (#1082): :45-51 hand-built refusal dupes #829 pin delete; :54-82 generic cycle superseded folded->framework, keep tests 1-2 (NaN-string data-fix); MonsterCardModal.ability-save-uses.test.jsx:8-9 stale cites refresh ITS turn. rec #1081 vrock :28-35 supersede-consolidated into strip ladder HERE.
- 📌 monsters.json vrock Stunning Scream: damage_dice_primary 3d6 but NO damage_type_primary (Thunder in prose only; banshee carries field) — consumers reading field get undefined (#1083)
recs #1080/#1081/#1082 vrock ALL APPLIED #1083 (refusal+cycle deleted->framework, row-lock+NaN-fix kept core)
- 📌 advisory family (#1084): ma1285-uncanny-dodge MA-1290/1309/1313 blocks re-run byte-identical generic machinery (refire 4th-6th copies) consolidate to ticket-table ITS turn; base :TELEPORT/ETHEREAL_STRIDE/BATTLE_CRY one-press x3 collapse it.each ITS turn. FRAMEWORK OWNER = monsterActionAdvisory.test.js.
- 📌 advisory tickets queue (#1085): ma1851-archlich/ma2018-thunderbird/ma2068-ziz/ma1450-seahorse each carry refire+builder+press copies — delete citing base :61-108 + reaction-fold @ma1285 #1085 at ITS turns
- 📌 monsters.json:54339 quetzalcoatl 'Wing Defense' reaction: name/trigger/description-only twin of ziz Wing Shield, NO advisory fix applied — same §60 no-affordance class the MA tickets remediate; future data ticket (#1089)
- 🗑 monsterBurstOfIngenuity.js:104-105 REFUSAL_MESSAGES.round/.uses unreachable dead branches (economy refusals take gate's own messages :168); ⚠ :54 bonus||2 fallback would silently upgrade authored bonus:0 row (WATCH, none exists) (#1091)
- 📌 monsterRecharge.ma1932-thunder-roar :56-58 incidental grab sibling pins shadowed by ma1931 full-row lock (#1093) — trim to name-only optional, cheap guard keep-if-preferred
- 📌 MonsterCardHelpers.grapple-ongoing-damage.test.js header note re:Apep/Ladon disk-fingerprints owned-by ma1939 now stale (ma1939 no longer re-locks Apep; MA-1842 sole Apep owner) — header tweak ITS lane (#1097)
- ⚠ monsterJinx.js:49-52 doc/code drift: comment claims save_type top-level fallback but jinxSaveSpec falls back only save_dc; saveType defaults 'WIS' unconditional (latent, RAW-correct by coincidence) (#1098)
- 📌 hellish-rebuke + berserk-lashing legacy-row echoes may drop re-citing monsterJinx old->new map ITS turns (#1098)
- 📌 lair chip/modal suites (MonsterCardModal.lair-sand-cloud/darkness/insect-cloud + 4 SaveAttackAoeModal.lair-*) repeat zone-arm/picker shape per monster — collapse to one-representative-per-affordance + data-driven ITS turns (#1099)
- 📌 ma1927:90 capsize.save_dc dupes ma1928 canonical save-core — soften ITS touch; ma1952 :108-110 uses:3 header pin trivial-null #1082 class — trim ITS pass (#1100)
- 📌 tarrasque header uses:3 re-pinned x3 (ma1579/ma1580/ma1581/ma1582) + ma1944 :154 in-file dupe of :109 — collapse to one uses-lane owner face per CANON #1082 ITS turns (#1101)
- 📌 ma1581 :127-133 gate-fingerprint transitive dup MA-0021 + :137-147 Attack/Chomp re-pins fully owned ma1580/ma1582 — delete-cite ITS lane (NEXT); ma1582:81-94 Move overlap shrink-cite optional (#1103)
- 📌 ma2002-smaug-detection :71-81 garuda-half dupes garuda owner — drop garuda leg keep quetzal ITS turn; ma2054-yamata :66-78 garuda loop-legs dupes — drop entries ITS turn (#1108)
- 📌 advisory-ticket cost-floor/exhausted refuse dupes: ma1944 :132-142 + ma1962 :137-147 generic gate vocab @MA-0021+MA-1883:215 — delete-cite pattern ITS turns (#1109 + rec #1101)
- 📌 #1089 note SUPERSEDED: quetzalcoatl Wing Defense ships structured save_dc:25/dc_success:'none' on disk (not name/desc-only) — honest two-byte lock @ma1974 t3, no data ticket needed (#1112)
- 📌 ma1981-scylla :66-70 key-order lock drop candidate (#1100 class) + :136-139 weakest Blood Tide re-lock of ma1978 owner — trim ITS turns; ma2002 :71-81 + ma2054 :65-78 twin-row dups garuda/quetzal owners delete-cite ITS turns (#1112/#1113 reaffirmed)
- 🔴 monsterLegendaryUses.js:228 Number(entry?.modifier ?? entry) — dict skill {} w/o modifier collapses silently to 0 (finite-check masks); edge only, all disk rows carry field (#1116). 📌 base refreshed cite-table @test:12-27 — family tickets retarget stale cites ITS turns (#1116)
  **FIXED fix#78 (#1116)**: explicit type-branch (dict->validated .modifier ONLY, primitive->trim-presence-guarded Number fix#39-mirror), 807-row disk census zero invalid shapes -> LOUD-null verdict, consumer-refusal-better-than-spend-then-roll-0 cited MonsterCardModal:913, honest modifier:0 arms kept, 6 pre-fix RED captures + 148->155 base lane, cite-table 10-row refresh comment-only, family-report clean (jinx guards/SP:80 authored-defaults honest).**
- 📌 recharge family folds (#1117): ma1970 :40-44 + ma1978 :38-42 generic spent/fresh truth-table re-drives @base :50-58/:231-237 — fold keep one-shot gate-arm ITS turns; family-wide purge extractConditionsFromSaveEffect(undefined)->[] legs (canonical @conditions-extraction)
- 📌 ma1931 :96-98 re-pins Thunder Roar DC23/Wisdom shadowed by ma1932 owned-core (#1119) — reduce to not-grappled leg ITS touch; rec #1093's :56-58 CONSUMED #1119 ✓; recharge folds ma1970/ma1978 still pending (#1117)
- 📌 ma1952 :111-116 Corpse Wind save-quartet+recharge decoy now owned by ma1948 (#1121) — trim to name-presence ITS touch; Ziz Solar Flare DC24/5-6 twin noted @ma1948 header, owner ma2067 (#1121)
- 📌 ma2067-ziz-solar-flare :43-47 generic gate truth-table + brittle actions[3] :23 — fold/rec #1117 shape ITS pass; Behemoth Earthshaker DC25/5-6 twin decoy noted @ma1970 header (#1122)
- 📌 ma1981-scylla :136-139 Blood Tide + :125-127 Shriek save-core dupes shadowed by ma1978/ma1982 canonicals (#1123 reaffirm #1113) — trim to absence-only prerequisite ITS turn
- ⚠ INCIDENT #1125: subagent returned a fully FABRICATED pass (monsterRecharge.ma1995-great-wyrm-soul-sight — path never in queue, zero matching file, no such monster in monsters.json; real head ma1996-smaug verified untouched, marker-free). Voided; re-dispatched as #1125R. Standing recs unaffected: ma2067-ziz generic-table+brittle-index fold ITS pass (#1117/#1122) (#1125)
- 📌 ma1948/ma1916/ma1924/ma1932/ma1940/ma1970 pre-template truth-table recheck flagged @ma1996 (#1125R) — all already folded #1118-#1122, verify-only on any touch; DC24+"5-6" 9-row twin pool documented @ma1996 header
- 📌 saveProcessing.ma2022-thunderbird-storm-call :63-72 Thunderstrike key/spent-arithmetic re-drive shadowed by ma2017 canonical (#1126) — trim to delegates_to/decoupling legs ITS turn
- 📌 ma2081-zmey :90-92 refusal surface (.mc-recharge-refusal + log) generic re-drive @base :75-81 + modal owners — delete-cite ITS pass (#1129)
- 📌 recharge base CANON cite-table REFRESHED — new ranges: strip/parse :78-93, truth-table :96-106, ungated-null :108-119, spend-stamp :122-157, refusal-vocab :159-180, d6-ladder :182-203 (+multi-entry :205-222), apep-twin :282-288. Lanes w/ stale old ranges (godzilla :12-21, zmey :33-40, all ticket headers citing :50-58/:75-81/:84-122/:231-237) retarget ITS next touch (#1132)
- 📌 monsterSelfAura.ink-cloud :77-83 gate fresh/spent byte-clone base + :117-134 refusal machinery clone — fold-cite ITS pass (NEXT) (#1134); 🗑 monsterSelfAura.resolveSelfAuraRow:77 stamps duration:'concentration' on non-concentrating ink rows — inert advisory metadata, honesty note only (#1134)
- 📌 giant-squid header family-map stale credit (uses-gate shape @:16-18) → retarget CANON #1082 ITS touch (#1135)
- 🔴 monsterSelfAura.js:71 mid-flight double-spend guard logs refusal but never setPopupHtml (popup only on gate-exhausted :62) — raced 2nd click refused silently in UI; pinned honest @base guard test (#1136)
  **FIXED fix#79 (#1136)**: Already-Armed refusal popup (mc-prerequisite-refusal family, reason-distinct words vs #1082 Uses-Exhausted, not.to-contain guard), tuple unchanged all lanes, honest not.toHaveBeenCalled flipped exact-payload, falsifier pre-fix 0-calls captured, exhausted+accept arms byte-intact, 76 green. SIBLING QUEUE APPENDED below (#1136-class x4 incl utility advisory-after-refused).**
- 📌 selfBuff.bolster #1137: mock-behavior-theater class (mock-side Math.max instead of production tempHpService) purged — audit remaining selfBuff lanes for same class on their turns; Empyrean uses:1/§165 disk shape UNOWNED — add to legendaryUses lane if touched
- 📌 selfBuff trims (#1138): sea-hag-illusory-appearance :196-216 twin mirrors → bleed-checks only ITS pass; succubus-incubus :88-95 registry mirror → linkage line only ITS pass
- 📌 invisibility-twin lanes recs bundle (#1139): imp:105/quasit:111/sprite:113/wisp:108 byte-identical-twin mirrors delete (transitive via own pins + owner :216); SAME FOUR ender describes delete-citing monsterSelfBuff.test.js:371-417 (~8 tests); owner :289/:311 absorb into one double-press ITS pass; ⚠ monsterSelfBuff.js:70/:108 else-copy says 'Enlarge' for green hag (no Enlarge) — owner-lane copy quirk
- 📌 #1144 forwards: will-o-wisp :108-109 twin mirror del-cite ITS pass; MonsterAction.ma1520-sprite-enchanting-bow.test.jsx:31 stale cite 'sprite-invisibility:127' → retarget disk[1] discriminator ITS touch
- 🔴 monsterSelfBuff.js:67 shared ethereal grant-log branch hardcodes 'the ghost enters the Border Ethereal' + promises ethereality_refused slug for ALL ethereal grants — succubus/incubus actually emits etherealness_refused (proven @succubus press-2 #1145); misleading log text, pinned verbatim honest
  **FIXED fix#80 (#1145)**: shared branch derives subject-noun/boundary/origin/slug from granting row via etherealGrantNote+selfBuffRefusalSlug extraction (promise-vs-emitted divergence structurally impossible now); slug census: both derived same-way, no hardcoded consumer -> producer-specific kept (renderer keys effect); succubus pre-fix ghost-copy pin flipped, ghost-lane zero-flips-legit-regen, registry:848 + popup boundary residuals owner-noted; 90 green 3 files eslint clean.**
- 📌 selfBuff base cite refresh — new ranges: enders :322-368, duergar disks :102-112, enlarged twin :168-177+flow :195-282, refusal wording :179-192, invisible clauses :141-151. Card-lane headers stale :371-417/:216/:419 retarget ITS next touch; green-hag :151 simulated ender delete-citing base :322-368 ITS touch; ⚠ monsterAbilityUses.js:55 getRV campaign-less read vs :63 campaign write — owner glance (#1146)
- 📌 shapeShift family VERDICT #1148: NO base file — ma1020-imp IS origin lane (generics live there); lizardfolk :175-181 self-dup optional fold ITS pass
- 📌 monsterSummon.test.js :600-612 'MA-0648 twin byte-unchanged' re-drives drow-mage press owned :104-134 — delete ITS base pass (#1154)
- 📌 summon base CANON refreshed #1156 — new cites: admission :132-138, coin-flip census :140-157, exhausted :193-205, count-after-flip :333-360, constant-count zero-dice :420-476, MA-1215 advisory :541-546, MA-1729 advisory :633-640. orcus+wukong lane headers stale old-ranges retarget ITS next touch ✓rec #1154 consumed
- 📌 ma1016-fog-cloud :103-111 duplicate not-utility press (MA-1014 pin) delete-citing origin lane ITS pass; utilitySpellCast family origin = ma1014 recharge-gated, no base — generics live there (#1157)
- ⚠ npcStatBlockUtils.js:135 '||' passive-perc fallback + :127-128 hitPoints||'' HP-0-empty (guarded upstream, pinned honest); 🗑 findNPCByName zero production consumers — inline dupes in monsterUtils.getMonsterData + createNpcClickHandler, source dedupe candidate (#1159)
- 📌 lootGenerator-private.test.js — 7 normalizeCurrency rounding rows near-dupe lootGenerator.test.js rounding legs; fold one it.each there + DELETE -private file ITS pass (#1162); dead-hp-filter lives in autoRewardService kills-forwarding, NOT lootFromCombatSummary (#1162 bridge map)
- 📌 CENSUS FIX #1163: master list regenerated 2684→2693 — 9 new unmaintained test files appeared mid-cycle (char-sheet/useCharActionsAutomation.test.class-feature-modals / condition-modals / * etc — family lane split); completed 2298 / remaining 395 honest recount (was invisibly stale via old all_tests.txt)
- 📌 giantAncestry.test.setup.js sidecar (vitest.config.js:50 EXCLUDES *.test.setup.js — fixture-only) #1164: cloudsJaunt :72-84 local fixture del-dup→import sidecar; firesBurn/hillsTumble .regression adopt sidecar fixtures; 8-consumer 8-module mock boilerplate = setupFiles dedupe candidate (own adjudicated lane); CENSUS RULE UPDATED: marker sweep must use find *.test.* + xargs grep (irregular .test.<topic>.js names)
- 🗑 lootGenerator.js:367 getTreasureFrequency cr<0.5→0 branch dead via public entry (tier 'none' short-circuits first) (#1166); 📌 stale header refs to deleted lootGenerator-private in lootFromCombatSummary:8 + lootGenerator:7-8 scrub ITS touch (#1166)
- 📌 adjacentDungeonGenerator.js:668-675 top/entrance forced onto wall ring (stairs unreachable by design), :334-337 torch-below-floor cosmetic byte, :524 unseeded top-of-file RNG outside seed-stream — byte pins honest per findings (#1167); lootSuggestions #1166 4 stale-ref scrubs still pending ITS lanes
- ⚠ hexMapUtils.js hexRound dq/ds strict-greater tie leaks non-cube-consistent {q,r} on exact ties e.g. (-2.6,1.2) — pinned-row avoidance honest, fix candidate (#1170); 📌 hexTerrainGenerator allRiversAreValidHexKeys regex helper could cite hexMapUtils T1 key bytes (#1170)
- 🗑 hexTerrainGenerator.js:151-152 elevation>0.70 moisture-branch returns 'mountains' both ways — dead condition (#1171)
- 🔴 mapsService.js:2 vs server/routes/maps.js:11 toKebabCase drift — client strips trailing .json, server does not (comment claims mirror): 'Cave.json' → client 'cave' vs server 'cavejson' filename divergence; pinned honest @mapsService #1173; 📌 map.test-utils.test.js:97 weak formatMapName echo drop-citing table ITS touch (#1173)
  **FIXED fix#81 (#1173)**: server mirrors client regex-byte-exact (cmp-proven), lying comment honored as contract, disk 21-file census zero-migration, 12-row live-import parity drift-alarm NEW lane, double-suffix + case-suffix honesty rows, server .json-strip arm, identity-echo pin dropped-with-cite (tested mock not helper, owner mapsService:70-82), third-fork dungeon-generator.mjs offline-noted. 6
files/166.**
- 📌 effectiveWalls.test.js:7 stale reachability refs :57,64 drifted #1174 — comment refresh ITS touch (#1174)
- 📌 maps domain CLOSED (#1167-#1175): effectiveWalls :9 stale spellOverlay refs :190/204 retarget T12 ITS touch; spellOverlayService.js:23 silent [] vs :25 logged throw inconsistent diagnostics (convention note) (#1175)
- 🗑 findNPCByName-not-exported clarified #1177 (#1159 dedupe rec REFINED): inline matcher lives in getMonsterData/getMonsterImageUrl only — source dedupe candidate open; ⚠ monsterUtils.js:35 vs :66 cache-guard asymmetry empty-array refetch-vs-permanent (harmless w/ real loadMonsters, pinned honest) (#1177)
- ⚠ npcGenerator.js:293 empty-pool [] gender => pick(undefined) name-hole (absent-key only guard, unreachable current data); :205 ranged 'ft..' double-period + dropped ability mod pinned verbatim (#1180)
- 🔴 contextBuilder-map.js:286 npcs?.find on wrapped {npcs:[...]} envelope TypeError (mock hid it); 🔴 damageRoll.js:135 same envelope-vs-array defect collectHostileThreats; 🗑 npcsService.js:55 loadNPC no prod caller — dead-code candidate; teardown leaked global fetch stub pre-fix (#1181); npcs domain CLOSED #1176-#1181
  **FIXED fix#84 (#1181 pair+dead+hygiene)**: jsonEntityCrud:49 wrapper-envelope quoted never-bare, both consumers unwrap at arrival ??-degraded-edge-documented catch-swallow-hidden (5 RED captures incl proximity-0-calls), correct-unwrap consumers cited untouched x4, loadNPC fresh-census-deleted +test-trim, envelope-honesty conversions 4 lanes, teardown pairing audited clean, domain CLOSED re-proven 770+107 green.**
- 🔴 CLA-023 rules-text vs impl mismatch: 'nonmagical weapons' prose but lane halves ALL B/P/S ungated (classes.json:3676/applyDamage.js:47, adjudicated automationPassives.js:327) — pinned as current behavior (#1182)
- 🗑 applyDamage.js:563-567 preserveInvisibleOnStealthAttack no-op doc-stub — vacuous tests deleted, real impl or delete by owner (#1184)
- ✅ FIXED (#1185, fix per ARM A): applyDamage.js:451 now passes campaignName — CONSISTENCY ONLY: getRuntimeValue is arity-2 (useRuntimeState.js:63), 3rd arg structurally discarded at ALL sites (:432/:443/:753 included) so prior omission was byte-inconsistency, behavior-identical; shadow-read risk is store-wide, true campaign-scoping is deferred infra #1520; arg-shape pinned auraWarding T1b exact toHaveBeenCalledWith + campaign-guarded revert-catch (2-arg revert => throw :463, verified RED then GREEN)
- ⚠ applyDamage.darkOnesBlessingService.js:9 mislabeled 'characterAdvancement' message reads specialActions; :23-24 resolveWarlockLevel fallback observably-dead; :50 finalDamage>0 operand defensively-redundant (#1188)
- 📌 rec#1139 dominateRepeat verdict NOT-APPLICABLE verified: domination-end mechanism (:1097-1128) owned only here, distinct from selfBuff enders :322-368 (#1189); dominateRepeat 10→4/12 closed
- 📌 chooser-pair CLOSED: FT-009 multi-slot owner #1192, CLA-110 stamp-REPLACE owner #1191; choiceStorage.makeKey ignores playerName param (separation via store player-axis, honest note not defect) (#1192)
- 📌 #1050-class RESOLVED for epitome fold #1193: no latch/no arity defect — only real latch epitomeEmpoweredUsedRound epitomeEmpoweredStrikes.js:15/:31 (different lane, verify ITS pass); store 3rd campaign-arg quirk ignored-by-design (#1193)

## Batch #196 flush (run2#1196-#1210, 2026-10-20)
- 🔴 applyDamage.js:552-557 frightened+charmed coexist: charmed-filter write resurrects Frightened in activeConditions (both removals filter same single-read snapshot; charmed-write lands last) — found live by falsifier, commented not pinned (#1207)
  **FIXED fix#86 (#1207)**: merged-write canon double-applied (fix#27 twin + #990a lineage), helper returns-not-writes refactor, dirty-guard #1512 parity, comment-to-pin conversion w pre-fix resurrection tuple-capture, domination-guard coexist arm distinct merge-result pinned, per-condition logs kept distinct-facts, 304 green.**
- 🗑 applyDamage.js:1189 resolveHpThreshold 'recovering' branch unreachable via applyDamageToTarget (damage never raises HP) — dead-code candidate (#1207)
- 🗑 boonOfRecoveryHandler isLastStandAvailable/getLastStandUsed grep-zero production callers — dead exports (#1198)
- ✅ FIXED, dup of #1185 entry above (same fix covers both — single site, fixed once): applyDamage.js:451 campaignName omission (#1185, re-verified #1207) resolved via ARM A consistency fix, see Batch #195 entry
- 📌 applyDamage.test.js :252-262 + :264-274 weak NPC concentration legs REMOVED per #1200 rec, canon npcConcentrationAdvanced :259-303 (#1207 recs consumed)
- 📌 legacy intercept scaffolding rec #1198 CONSUMED by relentlessEndurance #1201 + undyingSentinel #1209 (monkey-patch/key-only stubs/split legs gone from all three lanes)
- 📌 saveProcessing.infernal-wound.test.js:51-54 byte-mirrors BOTH compute helpers as mocks — save-full #1203 confirmed sole real-helper driver; keep mirror flagged in case of mock-theater review (#1203)
- 📌 applyDamage.js:1200 delta-0 hp_change suppression + immunity-entry sole record canon pinned at silence lane (#1204)

## Batch #197 flush (run2#1211-#1225, 2026-10-20)
- ⚠ damageUtils.js:126-128 shield-only AC: !hasArmor fallback recomputes 10+dex silently discarding +2 (currently pinned 13) (#1213)
- ⚠ damageUtils.js:94 armor-class item missing armor_class: base||0 + hasArmor=true suppresses fallback -> computePlayerAc returns AC 0 (honestly pinned) (#1213)
- 📌 damageUtils.js:69-71 findCreatureByName miss returns undefined (raw Array#find) vs guarded null paths — benign, inconsistent (#1213)
- 📌 evasionUtils.js:60-62 matchesSaveType byte-identical clone of applyDamage.js:118-122 hasEvasionForSave — reuse candidate (#1214)
- ⚠ rangeValidation.js:37 mile regex unanchored (feet regex anchored): '1 mile extra' parses 5280, '120 feet extra' null — asymmetric, unexercised by real data (#1224)
- 📌 computeEffectiveSpellRange promotes 'Touch'->30 but numeric 8+Distant->16 (string-literal match only) — harmless if callers pass authored strings (#1224)
- 🗑 prayerOfHealingService*/celestialResilienceHandler.* import getDistanceFeet/rangeToFeet but never call — mock-hoist leftovers (#1224)
- 📌 teleportService.test.js:180 self-compares distanceFeet vs getDistanceFeet — literal expected rec (#1224)
- 📌 featRangeService.test.js:307-311/:321-325 keep strictly integration, don't extend computeRangeEffect re-drive (#1224)
- 📌 un-folded dc-success siblings: yeti-chilling-gaze (:35/:67), sphinx-of-lore (:43), vrock-spores (:58/:122/:190 detached leak-guards), + sphinx-of-secrets, solar-slaying-bow pending own turns — apply #1215 fold (#1215/#1225)

## Batch #198 flush (run2#1226-#1238, 2026-10-20)
- 🔴 attackCalc.js:306 buildThrownShortSwordAttacks matches 'Short Sword' (space) — production equipment.json has 'Shortsword'; thrown-Shortsword row unreachable on real data. Fix candidate: match 'Shortsword' (#1233, reconfirmed #1234)
  **FIXED fix#87 (#1233)**: sole-src-drift closed vs disk-legal, magic-prefix arm resolveWeapon-parity pinned, full-file literals-vs-equipment census zero-other-drifts, legacy space-name honest-reject.**
- ⚠ attackCalc.js parseMagicItemName: '+ Longsword' -> baseName 'ongsword' — unconditional substring(3) eats char on '+ <digit-less>' inputs (pinned verbatim) (#1234)
- ⚠ attackCalc.js buildRangedActionAttack omits weaponType — ranged MAIN-HAND rows ship weaponType:'' while off-hand gets 'ranged'; automation filtering weaponType==='ranged' misses main-hand (pinned w/ comment) (#1234)
- ⚠ abilityCalc.js:29-31 + abilityCalc2024.js:34-36 expertise adds double proficiency WITHOUT proficiency flag (RAW requires proficient first) — twins, pinned honestly (#1231/#1232)
- ⚠ abilityCalc2024.js:72/:78 throws on missing Constitution where 5e silently defaults 0 — divergence pinned at :329, arguably intentional strictness (#1232)
- ⚠ attackCalc2024.js:541 playerStats.abilities.find unguarded — absent abilities key would throw ([] safe today); latent (#1236)
- 📌 attackWeaponUtils.js (parseDamageDice/pickHighestDamageWeapon/buildFallbackUnarmedAttacks) no dedicated lane — transitive only; cheap insurance candidate (#1234)
- 📌 GAP: 2024 Blessed/Druidic Warrior on WEAPON rows (buildMeleeMainHandAttack extraHit/extraDamage) has no byte pin anywhere after #1238 deletes (2024 cov fallback-unarmed only) — add Dagger row per style on #1235's next touch (#1238)
- 📌 stub-echo wholesale stubs remain in attackCalc2024.test.js (:331 combo) + attackCalc2024-special-attacks.test.js (invalid equipment_category 'Ranged' fixtures harmless only via stubbed finder) + light-ranged :174-206 Archery dup — cla225 conversion on own lanes (#1236/#1237/#1238)
- 📌 nick-dual-wielder vs wm003-nick near-dup latch scenarios — table-fold (#1233/#1235)
- 📌 dc-success family CLOSED x12 (#1215 origin, #1216-#1222/#1225-#1230); byte-slot taxonomy: after damage_type_primary (ghost/constrictor/banshee-lineage) vs after save_effect (piercer/poltergeist/ooze/shambling/vrock-whelm) vs after save_type (gladiator/sphinx-of-secrets/sphinx-of-lore/vrock-spores/yeti-scream) — read disk, never assume
- 📌 rec abilityCalc2024.test.js same bespoke-shape table fold (DONE #1232 ✓); default-STR/×1.5 rows live in abilityCalc twin, move if carryingCapacity audited (#1231)

## Batch #199 flush (run2#1239-#1253, 2026-10-20) — rules/core mega-lane (2024 attackCalc CLOSED + rules facade family)
- 🔴 rules.js:394-399 getCarryingCapacity delegates to abilityCalc.getHitPoints on BOTH ternary branches — every character's carryingCapacity IS their HP (rules.js:553). Suite-wide blind spot: all other lanes mock abilityCalc. Pinned honestly at rules-core.test.js (#1251); fix needs bundle extension (rules-core.js:23 omits getCarryingCapacity)
  **FIXED fix#88 (#1251)**: drift-found-first — honest impl core/carryingCapacity.js:3-9 existed, defect = bundle omission :23 + facade double-getHitPoints :394-399 only, no-new-impl-needed verdict documented; law bytes disk-imported ability-scores.json (x15/size), 2024 Goliath :668 shared-formula dual-delegate, push-arm-absent-reported; consumer live-impact HexWarlock 73===hitPoints persisted vs law-120; NEW real-graph lane + mock-completions x2-lane-4-factories, 3567 rules-tree green.**
- 🔴 rules-armorClass.js :174-181 Barbarian 2024 UD (+ :138-141 5e twin shape) overwrites AC AFTER shield +2 applied (:241) — shielded Barbarian 15, RAW 17; same-shape Draconic :166-173/:143-149 (5e Draconic no !armor gate: armored Leather 15 vs RAW 13) (#1249/#1250)
- 🔴 rules-armorClass.js:82/:158 College of Dance missing EARLY !shield gate (:241 stacks shield first) — Dance+Shield=18, disk says 14 (#1249)
  **FIXED fix#89 (#1249)**: dual-census single-file is2024-dispatch, :158 already-gated (drift), :82 gate added shield-hoisted-threaded-per-sibling-exact-shape, disk law Dazzling-Footwork:1857 quoted, pre-fix 18-live-capture 54-pin-pass, flipped-quirk-to-14-falls-to-shield-AC-arm + magic-shield-15 new face, full AC matrix byte-intact x8 arms, 3568 rules-tree green.**
- 🔴 attackCalc2024.js:428 findSwiftQuiverBow checks weapon.weapon_category==='Ranged' — disk weapon_category is Simple/Martial; isBow never true, lane survives only via :429 name list which itself contains non-disk names 'Crossbow, Heavy'/'Crossbow, Light' (disk: Heavy/Light Crossbow) — dead entries (#1241, confirmed #1243)
- 🔴 equipment.json Heavy Crossbow carries 'Light' property vs 2024 PHB — makes it eligible for light dual-wield seam (#1239 disk finding)
  **FIXED fix#90 (#1239) ARM-A-disk**: typo-at-birth proven (0d345d264 SRD word Heavy transcribed Light, never-H ever), 1-element cmp-exact removal, 5-consumer mis-grant chain cited (off-hand TWF + DualWielder eligibility illegal), 37-row full law census sole-violator, lie-mask lane converted disk-import, campaigns self-heal report-only, parse-proof, 423 green. FOLLOW-UPS: Heavy-crossbow lacks Heavy-prop (scope-split), Shortsword Light 2024-collision owner-review.**
- ⚠ attackCalc2024.js:241-242 ctx.strength.bonus/ctx.dexterity.bonus read unguarded for equipped melee — empty-abilities character throws (#1243)
- ⚠ rules-armorClass.js:94 MAM Dex-16 prereq applied in 2024 lane (2024 MAM has no prereq) + mathematically inert for cap-2; shared helper pinned by 5e twin (#1249/#1250)
- ⚠ greatWeaponFighting.js:36 tolerates missing automation but throws playerStats undefined (no current caller) (#1246)
- 🗑 greatWeaponFighting.js:33 greatWeaponFightingApplies dead export (no production callers, tree grep) (#1246)
- 🗑 rules-core.js:33-78 coreRules default export dead (all consumers use named getSubModules) (#1251)
- 📌 REC rules.test.js: huge accumulated queue: :247-296 dup merge/sort (#1248); :295/:312/:328/:350/:360/:400/:420/:447 dup 5e AC rows citing armorClass 5e twin (#1250); :372/:386 BROKEN fixtures (armor mocks lack equipment_category Armor -> silently unarmored path) (#1250); :495 false-pin College of Dance armored (same missing-category defect) (#1249); :147-152 stub-echo getSpellMaxLevel + :179-219 vacuous type-smokes delete citing rules-core #1251 identity pins
- 📌 REC rules.helpers.test.js:225-270 four 5e getActions not-array dupes fold to error-handling owner :38-61 (#1252); :203-223 fold to rules-actions #1248
- 📌 CITED-RANGE SHIFTS: wm003-nick :87-97->:88-104 (#1244); carryingCapacity :14-63->:15-59, stale cite lives abilityCalc2024.test.js:342 (already-marked file — fix on any future touch) (#1245); attackCalc2024 base: edge :20/:108->:121-131, lr :12->:133-146, ec name-preserved :194-216 (#1243)
- 📌 2024 attackCalc FAMILY FULLY CLOSED #1235-#1244 (base + all 8 topic lanes, zero wholesale stubs remain in family)

## Batch #200 flush (run2#1254-#1268, 2026-10-20) — getPlayerStats family + spellCalc family (5e+2024) CLOSED
- 🔴 spellCalc2024.js:208 Wizard-host `spells_known += levelSpellCount` yields NaN — disk wizard tables carry no spells_known key; masked in UI by CharSpells.jsx:79 fallback-to-'All'. Honestly pinned via comment in lineage sweep (#1268)
  **FIXED fix#91 (#1268 ARM-B)**: bumpCounterIfTracked key-presence split (existing-container-gate mirror), NaN structurally-impossible all arms, defect-ONE-CLASS-WIDER found+fixed (Ranger/Paladin cantrips_known same seedless NaN), Barbarian disk-seed-contrast live (0+2=2 never-shout), loud-drop console.error only-when-grant-real per no-fallbacks, honest-comment-to-assertion conversion + Number.isFinite ledgers, UI-mask defense-kept report-only. 5e-TWIN QUEUED: spellCalc.js:132 identical latent (Wizard/Druid/Paladin 3/160 disk tables absent spells_known, Tiefling lv3+).**
- 🔴 races.json(2024) Gnome `gnomish_lineage` offers 'Deep Gnome' but no matching subrace entry -> Magic Stone/Nondetection/Passwall ladder unreachable; Magic Stone additionally absent from BOTH spells.json files (would render levelless row if ever selectable) (#1268)
- ⚠ rules.js:379-391 getAbilities/getHitPoints wrappers identical true/false ternary branches — ruleset routing no-op (vestigial) (#1256); confirmed by dead-stub archaeology #1255/#1259/#1261 (getCarryingCapacity stubs deleted family-wide, 2024 lane was mocking 5e getHitPoints #1259)
- ⚠ spellCalc.js:68-71 applyClassSpellListAndSubclassBonus early-return on null playerStats.spells silently skips AT/Light/Nature bonus-cantrip grants pre-population (#1263 owner-review flag)
- 🗑 spellCalc.js:90-117 buildFallbackSpellAbilities returns spells:[] — feat/race caster rows dropped (slots only); honestly pinned #1263
- ⚠ spellCalc2024-wildheart-rituals.test.js:26-30 fixture-vs-disk drift: claims major.spells level 5, disk classes.json says 10 — fix on next touch of that file (#1264)
- ⚠ spellCalc2024.js:547 Mage Hand grant push overwritten by :822 rebuild — renders via persisted-spells path; grant-count covered spellCalc2024.test.js:194; by-design note pinned (#1266)
- 📌 FAKE-TEST HARVEST this batch (all fixed at source file): self-compare sort + unreachable dedupe (#1257), vacuous arcanums override clobber (#1265), trivially-empty filter test (#1266), wrong-path useRuntimeState mock w/ spy leak masking tests (#1259), non-falsifying base pin (#1260), outer-gate-only level prereq (#1262), no-op land circle (#1262), disk-inaccurate Barbarian fixture (#1264), invented-spell fixtures 5/9 (#1268)
- 📌 rules-playerStats-fightingStyles-feats preserved-owner ranges: all_skills exact-9-expansion + invalid-entry skip exact-array (#1257); initiative numeric lane dread_ambush row (#1258 cited-by dreadAmbushHandler:6); cla118 base cited-by handler:21 / cla201 cited-by cla118:10+pounce:8 (#1260/#1261); CotL cited-by upcastFlow.cla050 (#1267)
- CANON REINFORCED: hand-transcribed tables banned (filler rows assert nothing #1264; drift found #1264/#1267/#1268) — read disk; overrides must not clobber class/race objects (#1263/#1265); resetAllMocks can neutralize own mock impls — verify beforeEach order (#1265)

## Batch #201 flush (run2#1269-#1283, 2026-10-20) — spellCalc2024 topic lanes + effects lane opened
- 🔴 spellCalc2024.js:348-356 Improved Illusions '1 bonus action' override DEAD in output: stamped pre-remap, wiped by remapSpellRow :775->:697 DB clone (known Minor Illusion lands '1 action'); grant-when-absent branch :343-347 also never applies upgrade — feature benefit never reaches sheet. Honest pin lives spellCalc2024-runtime.test.js (#1272) — fix fails loudly there
  **FIXED fix#92 (#1272)**: stamp-last pattern REUSED (CLA-308/FT-068 family remap-survival proven) remap stays generic, TWO defects closed (dead inverted-guard upgrade branch deleted + absent-arm override added, new stampImprovedIllusionsCastingTime post-remap), override token app-canonical castingTimeUtils:4 pinned, pre-fix wipe diff-captured, sibling-row isolation arm. 1487 green.**
- 🔴 starryFormDamage.js:17 range:'120_ft' contradicts disk 2024/classes.json "within 60 feet" — double-pinned (starryFormDamage.test.js + special-attacks:171); owner decision needed, then both pins update (#1279)
- ⚠ spellDamageUtils.js:146 resolveHealExpression derefs heal_at_slot_level without null guard siblings have (:91? pattern x3) — no reachable caller today (#1278)
- ⚠ spellCalc2024.js:642-645 SpellMastery runtime reads ungated on spell_mastery passive — any store entry grants to any automation-bearing character (tolerance? flagged #1272)
- ⚠ psiWarrior.spells records Telekinesis level:0 on disk; remap resolves to DB lv5 correctly — data oddity pinned (#1274)
- 📌 DISK DATA deviations: classes.json Warlock lv11-16 spell_slots_level_5:3 vs PHB 2 (tests pin disk-as-truth per project rule, #1270); FT-068 declares no spellCastingAbility (ASI pass-through documented, #1270)
- 📌 FAKE/STALE-TEST HARVEST (all fixed at file): vacuous psionic gate (#1269), pre-stamp-wipe trap avoided + lv1-slotless invisibility in base fixtures (#1277 spell_slots {'1':n} non-disk shape!), vacuous early-returns + any() matcher (#1283), stale map-semantics x2 (#1282), stale wildheart level-5 FIX LANDED (#1275), tautology casting_time (#1272), trivial survival dup (#1273)
- 📌 FIXTURE DRIFT fixed vs disk: Arms of Hadar lv2->lv1 (#1269), Fire Bolt tier17 4d6->4d10 + Burning Hands ladder (#1278), Rogue cantrips_known wizard-stamp (#1277), school 'conjuration'->'Conjuration' (#1276), hand-transcribed lineage/spell names purged (#1268/#1273/#1275)
- 📌 REC expirations_applyAuraDamage.test.js TRIPLE: delete :455-485 (direct applyAuraDamage dup of tick lanes #1282/#1283), strengthen-or-fold :355-385 not.toThrow, delete :517-545 regenerate dup (owner applyTurnStartEffects L250-264) (#1282/#1283)
- 📌 CITED-RANGE: applyTurnStartEffects regenerate lane cite L241->L250-264 (fix at regenerateHandler.test.js:13 + .active:52 on their touch); spellCalc2024 base cite-shift map per #1277 (:60->:71/:86->:93/:120->:117/:194->:173/:235->:205/:251->:215); starryForm cited-by special-attacks now maps :41-53
- 🔁 spellCalc2024 FULLY CLOSED (#1264-#1277): base + 11 topic lanes, disk-discipline canon applied throughout; effects domain opened #1280-#1283 (ba001 queue-write owner, barrel face, aura damage owner, turn-start orchestration owner)

## Batch #202 flush (run2#1284-#1298, 2026-10-20) — effects domain CLOSED (15 lanes)
- 🔴 clearExpirationEffects.js:482 weakening-breath expiry filter matches effectKey+target, never te.source (payload carries source per weakeningBreathService.js:49) — two dragons weakening same target: one clock's expiry collateral-strips the other's te. Pinned honestly flip-if-fixed (#1295)
  **FIXED fix#93 (#1295)**: AND-triple strict-source (banishmentHandler:108/handleRemoveTargetEffect:255 house-mirror, registerTargetEffect:1495 dedup proves collision), disk-census zero-legacy-null -> strict verdict, both-null-identity/survival arms #1517, pre-fix collateral-strip GREEN-capture-then-RED-proof, survivor-pin flipped #1295, SAME-CLASS REPORT 5-filters-in-file + 3-outside-pinned (:85-barkskin-bleakest, faerie-fire, paralyzing-breath #1390, sleep #1415).**
- 🔴 clearAllExpirationEffects.js:164 Prismatic log unconditional on every rest ('effects end.' vs SP-012 no-name-no-log :101 principle; masked today only because SP-012 regex ends\\.$ misses it) (#1285/#1286); :118 Flesh-to-Stone unconditional campaign targetEffects write inside loop (#1285)
- ⚠ expirationQueue.js:48 missing appliedRound -> NaN expirationRound -> entry retained forever silently (no warning); :47 null list entry TypeErrors + outer catch starves all later entries in that store (#1298)
- ⚠ applyRegenerateTurnStartHeal + buff tick double-write currentHitPoints per invocation (buff overwrites expression heal) — by-design-per-comments, owner glance (#1296)
- 📌 FAKE/WEAK HARVEST (fixed at files): vacuous GTE(0) x2 + not.toThrow async (#1298), indistinguishable +1 regenerate tick (#1296), order-dependent caster-mismatch leaks x2 (#1286), never-asserted buff strip (#1291), bare some()/length>0 waves (#1290/#1294/#1295), clearAll-masked dispatch 4 vacuous toHaveBeenCalled (#1287), trivially-empty gates (#1297)
- 📌 REC turnStartEffects_additional:675 grapple_damage placeholder assert (#1296) + :600/:625 topple dupes fold into expireStale table (#1298)
- 📌 STALE CITES to fix on touch: regenerateHandler.active.test.js:53 L524 -> owner now applyTurnStartEffects L251-264 / expirations_additional :247/:268 (#1297 deleted 3rd pin); applyTurnStartEffects cite L241->L250-264 (#1283/#1286 pending at regenerateHandler.test.js:13)
- 🔁 effects domain FULLY CLOSED #1280-#1298: maturity-arithmetic owner expireStale, queue ba001, wrapper base, 11 per-type/per-consumer lanes; direct-vs-wrapper discipline canon

## Batch #203 flush (run2#1299-#1313, 2026-10-20) — restRules long-rest family CLOSED (15 lanes)
- 🔴 restRules-longRest.js:648-654 resetNaturalRecoveryTracking mutates charData AFTER setRuntimeBatch :623 fired — gated reset reaches no server/SSE, keys survive only via registration nulls; dead call, log flag live (#1312)
  **FIXED fix#94 (#1312) redundant-removal verdict**: LONG_REST_RESOURCES registration nulls proven sole-carrier (builder forEach bytes cited), flush-snapshot equal-bytes prove null-to-null no-op post-batch, dead function+call deleted comment-pointed, log flag + resources-line consumers kept live, 4-pin regression describe incl no-double-write + order-ledger, 445/445 effects-tree green.**
- 🔴 restRules-longRest.js:287 endWildShapesOnLongRest persists via storageService.set but never setCombatSummaryCache (:101-102/:120-121 siblings do) — in-memory cache serves stale beast-form data until reload (#1312)
- 🗑 restRules-longRest.js:747-748 duplicate ["Hunter's_Prey_choice",null] in resetFlags — confirmed x4 (#1307/#1308/#1311/#1313)
- ⚠ spellPreparationService.js:730 quickRitual consume stamps Date.now() (flagged #1309 via reader :861-864 gate) — wall-clock stamp on a latch; benign under no-timers policy (never auto-expires) but noteworthy
- 📌 CANON NEW (folder-wide, from #1312): vitest 4 clearAllMocks RETAINS mockImplementation — every multi-run it must re-seed store baselines explicitly; adopted by subsequent lanes
- 📌 TEMPLATE CANON (claNN constant lanes, x6 #1301-#1306): constant re-echo -> disk-canon pin + SR zero-write-budget + LR exact-null-byte; generic null-everything batch is the single membership proof (base :136)
- 📌 REC wildCompanion.test.js BOTH its strictly weaker than base full-set — queue deletion at its turn (#1312); REC turnStartEffects_additional :675 placeholder + :600/:625 topple fold (#1296/#1298)
- 📌 STALE CITES after #1312: neighbor headers numeric :489-511/:171/:547/:430-439 shifted -> new :446-466/:201-216/:538-557/:381-410 (fix at those files' turns); regenerateHandler :13/:52 pending since #1283/#1297

## Batch #204 flush (run2#1314-#1328, 2026-10-20) — shortRest family CLOSED + turnStart seam consolidated; 1 file DELETED (#1321)
- 🔴 turnStartEffects.js:446 applySurvivorTurnStartHeal `if (survivorUsedThisTurn) return` DEAD — :242 clearFlagIfSet runs BEFORE handler loop (real store sync), Survivor heals every bloodied turn-start regardless of latch. Fake :357 test (mock didn't reflect write) deleted exposing it (#1324)
  **FIXED fix#95 (#1324) PREMISE-DISPROVEN hybrid**: law-fabrication caught (Survivor=CLA-350 Champion Fighter L18 both rulesets quoted, no Aasimar disk row), every-bloodied-turn heal LAWFUL + host-PASS parity :6692 x2-sanctioned, guard confirmed dead-structural (ops-ledger clear-before-consult captured) -> vestigial clear+guard+stamp trio deleted per orphan-code rule, heal bytes behavior-identical, wasted-per-turn double-POSTs eliminated, faithful-store 8-row law matrix NEW, latch-key repo-zero census post-fix, 222 green.**
- 🔴 trackedResources.js:80-83 5e Battle Master superiority fallback tiers 7->5/15->6 vs PHB 11->5/17->6 — off-bracket lv7-10/15-16; live source for 5e BMs (no structured disk field) (#1318)
- 📌 restRules-shortRest.js:332-335 unconditional campaign targetEffects write+broadcast every short rest even when filter matched nothing — honest-pinned (#1319); collector turnStartEffects.js:52-61 forwards damageExpression/type/range overrides that consumer :147-152 hardcodes-ignores — canonical matches, latent asymmetry (#1325); :598 grapple_damage dispatchEvent in service code (observable, #1324-owned) (#1326 note)
- 🗑 restRules.test.js DELETED #1321 (12-face dup-map -> utilities owner; barrel re-exports never tested there, zero citations; folder 52/447 green post-delete)
- 📌 ACCIDENTAL-PASS MOCK-SURFACE CLASS x2 found+fixed: 4 real modules running unmocked in draconic-incapacitated (#1327), REAL dice roller transitively live in dread-ambush via unmocked constrictGrappleService (#1328) — canon: mock surface = real import set 1:1, verify against source imports
- 📌 FAKE/CONFUSION FIXES: round-2-gate conflated-with-latch (#1328), proficiency-vs-evaluator both-5 hid source (#1325), leak-dependent round=3 fixture (#1324), grapple 'fire-and-forget untestable' premise FALSE (#1324)
- 🔁 shortRest family CLOSED: base #1319 + cla145/226/ft046/fs010 twins (template canon); turnStart seam map: _additional 13its #1324, innerRadiance owner #1325, constrict pre-guard #1326, draconic tick #1327, dread CLA-100 #1328, grapple_damage real tests #1324, topple owner=expireStale #1298

## Batch #205 flush (run2#1329-#1342, 2026-10-20) — turnStart seams closed + features/ folder OPENED (first 10 lanes)
- 🔴 useSimpleSpellHandlers.js:288 bless spec omits level:metaCtx.slotLevel||spellLevel that bane :287 forwards (SP-11) — metamagic-upcast Bless stamps slotLevel:1 te row + logs lv1 (#1340)
  **FIXED fix#96 (#1340)**: byte-mirror key insert cmp-proof 288c288, real-service end-to-end consumption proven (blessService:38 spell.level->te:49+logs:70/:82, fix-live-not-inert), te-readers-static-match audit-truthfulness verdict honest, disk-law both-upcast-clause-checked incl 2024-duration-negative, casting_time twin-diff report-only, new SP-11 twin lane +pre-fix 4-arm RED capture, 624 green.**
- 🔴 blurService.js:46 log hardcodes spellLevel:2 (bane pattern :10) — upcast Blur logs lv2 (log-only impact, no scaling); :8 honors metaCtx.targetName though disk range:'Self' — non-caster landing possible if pipeline carries targetName (#1341)
- 🗑 beaconOfHopeService confirmBeaconOfHope DEAD export (picker -> applyBeaconOfHopeEffect direct, useSimpleSpellHandlers.js:299); handler header claim stale (#1338)
- 📌 boonOfCombatProwess.js stamp ??0 vs consult ??1 asymmetry (unreachable — round never 0; noted #1342)
- 📌 ACCIDENTAL-PASS CLASS now 5 fixed: constrict+diceRoller real (#1329), whirlwind+constrict real (#1330), whirlwind+constrict real again (#1330 dup-lane), constrictService real diceRoller transit (#1328 pre-batch), 4 unmocked modules (#1327); + test-the-mock SWEEP class (#1332); + mock theater buildSaveDc (#1336); + VACUOUS replace #1340; features canon: mock 1:1 real imports mandatory — audit method copied per lane, conclusions not
- 📌 rec contextBuilder-sync.passives:418/:431 near-dup arrays placement (#1342); rec bane base prune (sp011 twin owns composed #1335) — DONE via #1336 sentinels
- 🔁 turnStart seam map COMPLETE: base #1283, _additional #1324, innerRadiance #1325, constrict-pre-guard #1326, draconic-tick #1327, dread CLA-100 #1328, expeditious #1329, infernal #1330, resistance-PRODUCER #1331, zone clock #1332

## Batch #206 flush (run2#1343-#1355, 2026-10-20) — enchantment/dominion family mapped+closed (13 lanes)
- 🔴 compulsionService.js :26 triggerCompulsion DEAD export (live lane gateCompulsion->handleCompulsionConfirm->applyCompulsionEffect; compulsionHandler header claim 'live in-repo producer' STALE); :11/:36 getCombatContext double-fetch per trigger; :37 advantage:true app-fabricated (disk prose grants none — auto-succeed only) (#1348)
  **FIXED fix#97 (#1348 trio)**: dead trigger-path excised wholesale (export+2 helpers+its fake-lane, fix#82 precedent, fresh census zero live), double-fetch halved (ops-ledger 2->1 captured pre-fix), fabricated-advantage deleted-vs-rewritten verdict (disk BOTH rulesets advantage-absent, conditional-immunity clause downstream-not-restamped, autoFail-precedent-refuted-honest), live-envelope disk-honest-false-pair pins, stale-header-comments-corrected 3 sites, crown-of-madness-adjacent flagged triage. 231 green.**
- ⚑ app-invented injury-advantage proxy currentHp<maxHp vs RAW 'you or allies fighting it' — pinned-as-is in charmMonster/dominateBeast/dominateMonster copies (#1343/#1354/#1355)
- ⚑ advantage:undefined leak (target missing from initiative rows -> envelope carries undefined not false) dominateBeast service:21 + dominateMonster same shape (#1354/#1355); refund popup lies when runtime slot null & guard skips (beast only) (#1354)
- 📌 constrictGrappleService.js:165 roll fires before :169 dead-victim guard (die consumed, nothing paid — reorder candidate) (#1350); confusion d12->d10 RAW simplification (handler-owned, noted) (#1349); crownOfMadness getCombatContext x2 (#1351); applyDamage Death-Ward interceptor ordinal untested (rec to applyDamage lane) (#1353)
- 📌 DOMINATE-PERSON pending same consolidation ~12->7 (#1354 rec) — NEXT queue head
- 🗑 dead mocks purged: crownOfMadness helpers base? no — dominateMonster logService + charmPerson default-branch accidents + deathWard shared-creature + confusion blanket-console (5 lanes' over-mock scaffolding)
- 🔁 enchantment family SEAM MAP complete: trigger(s)/handler(s)/utils/confirm split recorded per-lane in headers (compulsion x3, charm x2, dominate x3 + cockatrice ladder + compelledDuel + deathWard interceptor + confusion producer)

## Batch #207 flush (run2#1356-#1369, 2026-10-20) — features/ protection/domination cluster closed (14 lanes); 1 marker incident fixed
- 🔴 forcecageService.js:9-19 ruleset-hardcode: 2024 concentration+'1 hour' block stamped for ALL rulesets over 5e disk row (non-concentrated) — RAW divergence, parity test guards drift (#1365)
  **FIXED fix#98 (#1365)**: ruleset-branch canonical playerStats.rules idiom (3-site sibling-cite, rulesFactory-default-5e honored), disk-law self-corrected-ticket (5e-duration-1hour-not-instant, disk-wins), phantom-concentration-killed, combat-scoped-label-verdict, parity-test-flipped-to-lawful-divergence, pre-fix 10-RED-capture, handler:181-unconditional-concentration RESIDUAL REPORTED its-lane.**
- 🔴 draconicFlightService 'one chokepoint' FICTION: endDraconicFlightBuff expired/incapacitated rows ZERO production callers; turnStart+clearExpiration inline-duplicate with ALREADY-DIFFERING copy text; recommend delegate + delete dupes (#1357; dragonWings twin SAME pattern #1358)
- 🔴 frightfulPresenceService: repeat-save prompt hardcodes saveType:'WIS' over Charisma te (RAW repeats CHA); resolveFrightfulPresenceRepeatSave saveBonuses?.wis silent cross-ability fallback; trackFrightfulPresence no re-arm dedup -> duplicate clocks/immunity grants (mitigated upstream) (#1368)
  **FIXED fix#99 (#1368 trio)**: WORSE-than-ledger—disk save_type VARIES (Wisdom dracolich/Tarrasque/Smaug vs Charisma White-Dragon rows), hardcoding-either-wrong verdict, prompt+bonus now te-derived (repeatSaveService-family abbrev form, applyDamage-import-avoided-strict-mock-lane reasoning), cross-ability ??wis deleted, killer-pin wis:99-cha:2->bonus-2 (pre-fix 100 captured), re-arm source-scoped guards (addExpiration-appends-unconditionally proof, upstream-te-dedup-masked-clocks confirmed), twin-report paralyzingBreath-consistent-CON/weakeningBreath-already-te-correct. 467 green.**
- ⚑ friendsService: recordFriendsCast BEFORE executeHandler — failed casts burn 24h cooldown; concentrationDc verbatim-dup of expeditiousRetreatService.js:27; double-dot log :76+:81; cross-ruleset gate applies 2024-only checks to lv1 5e (#1367)
- ⚑ fleshToStoneService.js:7 terminal DC omits casting-ability modifier (near-dead: triggerSpells supplies spellSaveDc); faerieFire disk save:null vs hardcoded DEX parity rec; expeditiousRetreat prof||2 coerces real prof 0 (benign lv1); fearService prof-chain; dominance quirk trio person-vs-beast divergence (injury-proxy retired person-side only) (#1360/59/62/56)
- 🗑 dead exports: triggerFear (modalSpells direct), isStepOfTheWindTrigger, ER_* constants (consumers inline literals — constant-equals-literal catch pinned) (#1362/63/59)
- 📌 MARKER INCIDENT #1361: subagent stamped '// AUDITED...' variant — orchestrator corrected to canonical '// @maintained-by-ai' line 1, re-verified green. Canon re-stated in every future prompt: ANY variant stamp voids the pass.
- 📌 NEW determinism bar canon: argument-keyed strict store fakes THROWING unknown read keys (#1366/67/68 adopted); explicit re-seed not Once-chains; spies afterEach-restored
- 🔁 disk-parity GOLD method: read BOTH rulesets' rows every lane — 4 findings/this batch (forcecage divergence REAL, foresight parity holds, globe rename FALSE alarm, falseLife fallback drift)

## Batch #208 flush (run2#1370-#1383, 2026-10-21) — features/ restorative+holy cluster CLOSED (14 lanes)
- 🔴 holyAuraDamageService.js:33 ability_score_modifiers.CON uppercase read vs disk lowercase 'con' — fiend/undead attackers ALWAYS take bleed save at +0 (producer-side verified innocent #1376, consumer bug); ?.constitution fallback speculative no-producer grep-evidence
  **FIXED fix#100 (#1376)**: both dead-arms deleted (CON AND speculative constitution, producer-less census vindicated ledger), 636-row unanimous-lowercase straight-read verdict (two-way rejected-no-mixed-shape justification), -1-penalty-was-+0 capture + spurious-Blinded-fail-path bail-catch, 7-arm pin table no-producer-fixtures, 11-abilities.XXX-family QUEUED suspect-lane (different-producer-shape-flag-honest).**
- 🔴 healService.js:8 hardcoded remove-list 'poisoned' vs 5e disk 'diseases' — 5e Heal clears Poisoned never Disease; :32-33 over-log never-stored conditions; NO construct/undead type gate though disk forbids; :52 vs :148 top-tier heals 100 but formula reports '70' (#1372)
- 🔴 heroismService.js:48-60 re-cast pushes new te pair onto UNFILTERED array after filtered write -> stale-pair resurrection 2x te; :43/:158 filters match 'heroism' only -> wisdom_save_advantage te LEAKS permanently + absent from targetEffectDefinitions (registry-rule violation, GM adder blind); :28-38 turnStart dedup reads CASTER playerStats array writes onto TARGET key (clobber pinned) (#1373)
- 🔴 invisibilityService.js:25/:68 throw-on-null-conditions aborts AFTER activeBuffs committed — partial removal latch stays armed (no retry-capable callers); :89 endGreaterInvisibilityOnHostileAction DEAD export; :5/:6 vs :28/:71 buffs-exact/conditions-case-insensitive asymmetry latent leak (#1382)
- 🗑 dead exports found: triggerGreaterRestoration (handler routes direct), endGreaterInvisibilityOnHostileAction; rec export-keyword-drop: resolveCurrentHp+markFortifiedHealthIfApplied (#1371), getInspiringSmitePassives (#1381)
- ⚑ quirk ledger adds: proficiency||2 x2 more data-points (heal :74-class, holdMonster :9, inspiringSmite-free, hypnotic throws-not-coerces spectrum now: bane||2 / heal||2 / holdMonster||2 / imprisonment||2 / holyAura-NaN / hypnotic-THROW — six-way coercion census now pinned); :0-chains hypnotic :70 + mageArmor n/a + imprison 2-row; chokepoint inline-dup #1357: cloakOfShadowsHandler+turnStartEffects inline-strip vs invisibility export, inspiringSmite :19 inline-dups usesSpellSlot (3 live importers), mageArmor header-claim behavioral-not-literal
- 📌 NEW-DISK-FACT x2: automation.type SHARING class (hypnotic_pattern<->Symbol #1378, mage_armor_ends vs mage_armor_refused single-producer PASS #1383); mageArmor disk 8h non-concentration IDENTICAL both rulesets; holyAura disk 1 minute overrides steering 10min (#1376); hold-monster lv5 WIS both (#1374)
- 📌 PHANTOM INCIDENT #1383-recovery: orchestrator dispatched a memory-restated nonexistent path (journeymanService) — exact-path guard caught, zero damage, verbatim-head rule re-committed (#1125 hardening works). Cited-range adds: MonsterCardHelpers.infernal-wound:10 ':75'->':127'; applyDamage.hypnotic-break ':281-333'->':287-380' (#1380/#1378)
- 📌 accidental-pass tally this batch: REAL addCondition graph (#1375), concentrationService was #1367 — mock-1:1 canon continues earning its keep in save/consume lanes

## Batch #209 flush (run2#1384-#1397, 2026-10-21) — features/ mass/heal/companion cluster closed (14 lanes)
- 🔴 AoE-heal selection class x2 (massCureWounds :141-142 + massHealingWord :129-130): first-6 array-order affiliation-blind, disk 30/60ft range NEVER enforced — hostiles get healed; identical twin bugs (#1384/#1385)
- 🔴 te-source collision class CONFIRMED ×2nd member: paralyzingBreathService.js:45/91 filters effect+target never te.source — second same-named dragon silently takes over staged ladder (#1390, weakening-breath #1295 twin)
- 🔴 prayerOfHealingService.js:121 maxHp fallback to CASTER hitPoints — low-HP caster silently caps party member's heal; :129 negative actualHeal flows to log/totalHealed (#1393/94 pins flips-if-fixed)
- 🔴 mountService.js:102-124 rider never validated off-board — summary POST aborts yet ok:true + success log (advantage/redirect lanes silently degrade); :50/117 size stamped verbatim unnormalized kills consumer SIZE_ORDER match (#1388)
- 🔴 primalCompanionSpellShareService.js:17 three 'self (...)' range strings match ZERO disk rows dead-guards; :38+66 level:undefined passes cantrip gate slotLevel:0 dispatch; :52 alive-gate ===false -> unknown-alive treated alive; getShareSpellsFeature/hasShareSpells dead exports (#1396)
- 🔴 massHealingWord/massCureWounds case-gate class x2: service strict-lowercase vs triggerSpells lowercase caller -> case-drift silent-null (#1384/85); + ottoDance no-trim gate same class (#1389)
- ⚑ rayOfEnfeeblementService.js:6-14 STRUCTURAL: metaCtx never attached -> handler :29 metamagicHeighten permanently falsy via this forwarder (#1397)
- ⚑ disk-parity facts ledger: PW stun CON-150 both rulesets (steering WIS/60 rejected x2 #1392); mass suggest lv6 WIS 24hr non-conc both, 5e-only higher_level key (#1386); prayer lv2 6-vs-5 caps divergent ladders (#1393); MCW ladders diverge 3d8-vs-5d8 old-fixture-matched-neither (#1384); MHWD old 2d4@3 mis-modelled 5e 1d4 (#1385); shadow-arts PWT disk identical both rulesets (#1391); maze parity clean single-model (#1387)
- 🗑 dead-code census: triggerGreaterRestoration(#1370), endGreaterInvisibilityOnHostileAction(#1382), getInspiringSmitePassives/rec-drop resolveCurrentHp+markFortifiedHealthIfApplied(#1371/81), primalCompanion helpers x2(#1396), paralyzingBreath targetOf array-branch zero-writers(#1390); mount constants export-dead-literals(#1388); triggerPrayerOfHealing LIVE-verified(#1393)
- 📌 FAKE-CENSUS #1389: 3 vacuous it.each rows (ignored case-objects, re-ran hardcoded name) — guard untested; repaired. Claimed-pin audit method active: #1394/#1396 verified claimed pins EXIST (method working both directions)
- 📌 coercion census spectrum updated (||2: heal?/holdMonster/rayOfEnfeeblement+imprisonment; :0-honored==null-throw: massSuggestion/hypnotic; NaN-absent: holyAura; ||0: massCure '0->10') — six-family map complete in headers

## Batch #210 flush (run2#1398-#1411, 2026-10-21) — features/ regen+relentlessRage+revivify+roar clusters CLOSED (14 lanes)
- 🔴 relentlessRage data+engine stack: classes.json 5e healExpression '2*barbarian_level' vs 'drop to 1' text (#1399); save raw-overwrite no-clamp writes HP-from-0 clears death-saves alive-at-0 (#1403); unguarded-await :101/:194 rejects strand save-result listener + unhandled rejections (#1401); :186 log-success-vs-branch-fail divergence (#1400); truthy-non-array deathSaves store silently kills slot machine (#1400); listener leak mismatched promptIds (#1400)
- 🔴 roarService.js:121 ?? passes NaN string-uses -> 'Roar N of NaN' never exhausts (MA-1502 class RESIDUAL on generic path, needs Number.isFinite) (#1411); :101-102 asymmetric unguarded damage_dice deref (#1411)
- 🔴 revivifyService.js:59 post-consume unguarded playerStats deref loses log (diamond spent) (#1407); :50 ternary swallows ??0 -> maxHp:undefined (#1407); :48-50 dead fallback ternaries (#1409); :39 hardcoded 'Revivify' name in refusal text (#1409)
- 🔴 triggerSpells.js:447 handleRemoveCurse discards trigger popup unlike sibling shapes (:0-swallow, gate-backstopped) (#1404); removeCurse metaCtx unattached #1397-class dormant seam (#1404)
- 🗑 dead-export census: triggerRegenerate DORMANT-retire-pending (#1398); clearDeathSavePrompt DEAD-mock (#1403); STAGED_ROAR_MAX_DEFAULT + evaluateHealExpression/getRuntimeUsesKey export-drops (#1402/11); resilientSphere handler dup-exports isResilientSphereActive/getResilientSphereSource vs automationPassives flagged (#1406); saveResults dead hitPoints-seed FIXED (#1403)
- ⚑ house-quirks new members: 5-arity inert skipSync repeatSave:38 (+targetEffectDefinitions:1510 consistent pattern) (#1405); unanchored-regex swallow class (helpers :33) (#1402); dual-producer death-keys race modal-vs-service (#1400); saveResults ONE-writer reconciliation (:194) corrects earlier two-writer maps (#1403)
- ⚑ chokepoint: regenerate turnStart inline-computes ALL regen ticks, service never imported = chokepoint-FICTION reconfirmed (#1398); roaring modal inline ctx cited (#1410/11)
- 📌 disk-facts: revivify consume-key matches NEITHER disk verbatim app-normalization (#1407); resilient-sphere name-split across rulesets same type (#1406); valor-only roar_stages producer, zero 2024 monster corpus single shared monsters.json (#1410/11); remove-curse disk denies blessing-clause (#1404); Thri-Kreen sole effect-key repeat_save row + Djinni zone STR-17 (#1405)
- 📌 tool-integrity: phantom fabricated tool output (logService.js ~140ln invented) observed #1408 audit, disk truth verified by shell, no test depended on it; deterministic pins unaffected

## Batch #211 flush (run2#1412-#1425, 2026-10-21) — features/ spell-queue cluster CLOSED (14 lanes, s->w alphabetical span)
- 🔴 silenceService.js numeric-.match crash on RAW 5e disk (size:20 NUMBER->TypeError lane-rejects real rows :25-26); plural-feet regex silent-drop->120 :15; unguarded JSON.parse center :94; campaign-blind combatSummary :165 (#1413)
- 🔴 wardingBondService.js:47-49 concentration dc mutates live store ref, NO setRuntimeValue->no persist/no SSE broadcast; no RAW max-30 cap (100->dc50) (#1425)
- 🔴 spiritualWeaponService.js:90 ||-swallows documented encounter-scope 0 -> rounds:10 stamped every cast (no-clock policy tension); :179 mutates store-read buff object pre-clone (#1420)
- 🔴 soulTomeTrapService.js:103 PC save prompt hardcodes saveType 'CHA' ignores te.saveType (divergence live WIS); :78 'DC undefined' interpolation when caller omits (#1419)
- 🔴 tashas gate/NAME mismatch: 5e disk 'Hideous Laughter' fails triggerSpells:387 'tasha's hideous laughter' -> spell can NEVER open its modal lane (SERVICE_HANDLED :53 inert); 2024 index byte-mangling hIDEOUS (#1423)
- 🔴 te-source collision class 3rd+ members: sleepService readers :24/:128/:217/:269 (dragon ladder takeover) (#1414); silent sparse-te spell-shape leak onto CON breath ladders :98-99
- 🔴 DUAL-PRODUCER last-writer races: type 'slow' runSlow:82 inline bypass loses metaCtx.targets (#1417); deathSaves/deathFailures service-vs-DeathSavePromptModal:101-102 (#1400 carried); relentlessRage raw-overwrite alive-at-0 (#1403 carried)
- 🗑 dead-export census: triggerSilence+getSilencedTargets (#1413), triggerRegenerate retire-pending (#1398), clearDeathSavePrompt (#1403), sleepStageSpec+getSmiteOfProtectionPassives+getInspiringSmitePassives (#1420/18/81), STAGED_ROAR_MAX_DEFAULT+evaluateHealExpression/getRuntimeUsesKey (#1411/02)
- ⚑ #1378 chokepoint inline-dup new members: useAreaEffectHandlers.js:110 byte-identical stinking-cloud envelope (#1421); core-handlers UI info-builder smite shape (#1418 benign); modalSpells.js:231 silence-cast dup (#1413 drift-pinned)
- 📌 disk-facts: concentration-flag vs text contradictions x3 (see-inv FALSE '1 hour' #1412; sleep 5e FALSE SRD-style #1415; spiritual-weapon 5e FALSE/2024 TRUE #1420); slow lv3 both rulesets steering-lv6-refuted (#1417); silence 2024 size STRING vs 5e NUMBER (#1421 disk-type drift); suggestion 8-hour automation 'up to 1 minute'-text (#1422); viscous-mockery WIS-save not attack-roll (#1424); save-lane no-damage sleet damage:null (#1416)
- 📌 caller-boundary GAP: noSavePath.js:51 activateSpiritualWeaponIfNeeded zero test-coverage in execution/*.test.js (#1420) — flagged for owner
- 📌 coercion census complete-spectrum now: ||2 (bane/heal/holdMonster/ray/imprisoning/slow/suggestion/spiritual) / ==null-THROW (massSuggestion/hypnotic) / NaN-pass (holyAura) / ||0 (massCure) / ||'Touch' (removeCurse) / ||'' + numeric (see-inv) / ??-chains (silence/spiritual:??1 0-honor mix) — six+ families mapped, per-lane member verdicts in headers

## Batch #212 flush (run2#1426-#1439, 2026-10-21) — wardingBond x6 CLOSED + zone-engine quad mapped + rules-root ticket trio (MN-020/FT-046/Hunter's-Prey) CLOSED
- 🔴 zoneRepeatTurnEndService stale-cs snapshot: multi-te ticks clone SAME start-HP -> later te OVERWRITES earlier's write (13 not sequential-10); PC lane immune re-read (#1434)
- 🔴 weakeningBreath producer-half LANDMARK COMPLETE: te.source carried every envelope (pos#4 + expiration :49) => #1295-class collisions PURELY reader-side: find :26/strip :105 source-blind, second-dragon ladder adjudication + collateral strip (#1431)
- 🔴 negative-damage mirror: wardingBondService.js:23/:25 shares negative heals-caster UNCAPPED (5+-10->15/max10) + :40/:43 isHealing:false with positive delta contradiction + NaN-poison no-validation :25/:40 (#1427)
- 🔴 fire-and-forget setRuntimeValue no-catch (store-rejects silent unhandled, optimistic log-vs-stranded-store divergence) wardingBondService.js:27/:9/:12 (#1428); carried: relentlessRage unguarded-await strand, roar NaN-hole, triggerSpells:447 popup-discard
- 🔴 wild-magic: 2014 disk classes.json:11353 trigger 'roll_1_on_wild_magic_d20' NEVER matches type-filter -> disk-dead raw bytes; non-sorcerer casting sorcerer-listed spell surges (RAW 'by a Sorcerer' violated) service:9; spell:null dispatch golden trio :98 (#1433)
- 🔴 rules-actions.js:48/:55 2024 ternary passes truthy-non-arrays (guard-hole, dies downstream localeCompare unguarded) vs 5e Array.isArray-throw (#1435); dup-precedence INVERSION 2024-feature-wins documented-pinned
- 🔴 silenceService 5-bug cluster carried from #1413 (numeric-.match crash on RAW-5e-size:20, plural-feet-drop->120, JSON.parse center, campaign-blind, case-split)
- 🗑 dead/unowned census: tests-only-getters x4 wildMagic (#1433 rec drop exports); applyFeyShadowTouchedSpells/applyRulesType ZERO test-lanes app-wide (#1438); addFightingStyleFeatFeatures/addBackgroundFeatures ZERO callers (#1437); whirlwind/constrict engine twins mapped no-dead
- ⚑ quirk-class NEW members: te-source-blind arrival-order tes[0]-wins (whirlwind #1432, joins #1295/90/31); curly-vs-straight apostrophe gate decoy class (hunterPrey #1439 + tashas #1423); tie->Strength >= silent-precedence (hunterPrey :19); optimistic-log-vs-stranded-store (#1428 joins #1382); fake-thenable-mis-model stub class retired x3 files (#1428/29/30)
- 📌 dead-path-mock accident-fix: ../../../rules/... nonexistent path silently UN-mocked -> real jsdom fetch per latch-check (wildMagic #1433) — mock-path-verification added to accidental-pass canon
- 📌 disk-facts: repeat_turn_end snake EXACTLY 3 Black-Dragon lairs camelCase-zero (#1434); weakening=4 gold dragons all STR save_dc-bearing (#1431); whirlwind recurring Thunder 6d6 turn-START not-bludgeoning (#1432); mage-armor key-vs-label no-normalization (#1436); Superior Technique straight-0x27 xxd (#1437); Inspiring-Leader/Bolstering-Performance disk pair (#1438); hunterPrey both-rulesets unconditional-facade (#1439)
- 📌 flake WATCH #3 registered: ElementalAttunementModal.phase-flow DC-11 phase-race (stable isolated, untouched-window, /tmp/batch211.log)

## Batch #213 flush (run2#1440-#1453, 2026-10-21) — rules-root + rules/spells/ clusters CLOSED (14 lanes incl MEGA rules.test.js discharged)
- 🔴 empoweredSpellService.js:159 MISSING-AWAIT applyDamageToTarget(async@applyDamage.js:991) -> :162 endInvisibilityOnHostileAction NEVER-FIRES prod (#1382-cited interplay DEAD, sync-mocks masked) + targetCurrentHp always undefined; :109 chaMod=0 spends-1-SP-reroll-ZERO-dice violates-disk 'minimum of one' classes.json:10280; :13 arity-0 findLastAttack campaignName-unscoped (#1449)
- 🔴 rulesFactory.js:122/:128/:162 arity-3 getRuntimeValue vs real-arity-2 -> campaignName SILENTLY DROPPED (prod-scoping claim of naturesWard-triple-mock NOT reality); :103 getClass(summary)-vs-getRace(built) arg asymmetry (#1448); 7-dormant-wrapper-exports + getSenses chokepoint-dup rec-trim
- 🔴 metamagicRules.js:110 Arcane-Apotheosis waives per-CAST vs disk-2024 per-TURN model; :115 unknown-option ||0 SILENTLY-FREE cost; :97 isPreCastOption dead (#1451)
- 🔴 materialComponents registry drift x2: :37 'Stone Skin' never-matches 5e-disk 'Stoneskin' (5e-backpack-gate-miss, regex-safety-net only); :19 GentleRepose 'consumes'-text 2024-canoned vs 5e 'remain for duration' (#1450); x4 callers hardcode dust-literals vs getConsumedMaterial read (#1450)
- 🔴 rules-actions.js:47-52 uniqBy-string-rows -> 2nd+-string-bonusActions SILENT-DROP zero-console (joined localeCompare family #1435) (#1455-helpers-lane); rules-helpers.js:46 applyRulesType summary-clobbers-stats-side-rules asymmetric (pinned #1455)
- 🔴 multi_target_spread disk-nesting-mismatch: 2024 Words-of-Creation nests INSIDE passive_rule automation, :52 type-filter never-matches, zero flattener prod-wide -> custom-data-only lane (#1453); postCastHeal :197 ??-tail-missing-vs-NPC-sibling :198 (#1452)
- ⚑ MOCK-QA CANONS EARNED KEEPING-THIS-BATCH: getCachedBackgroundData-factory-gap FOUND×3 (helpers #1440/trunk #1444/factory #1448... +ft047 #1443) = systemic silent-catch-path; fixture-masking fixes ×3 (Insight-preselect #1440/campaignName-drop #1447/identical-20-20 #1452); real-Promise-vs-sync-mock-masking GOLD #1449 (dead-line discovery); mutation-probe-form established #1441/42/43/44 (cannot-regress byte-proof + md5 source-integrity)
- ⚑ dead/unowned census adds: rules.js 9-named-exports app-wide-dead rec-drop (#1446); buildEmpoweredSpellState zero-prod (#1449); getSpellThiefFeatures near-dead-incl-internal post-CLA-325 (#1453); getMultiTargetSpreads/getPostCastRiderSaves internal-only (#1453); hasEmpoweredSpell was-untested-now-covered (#1449)
- 📌 disk-facts: single-shared-8-option metamagic catalog no-ruleset-split prose-only-2024-options (#1451); Beguiling-Magic riderSave 2024-Bard-only (#1453); post_cast_rider zero-disk rows (#1453); aura-of-life/power-word-heal 5e-spells.json-absent-code-lists-2024-only (#1452); Blessed-Healer disk-identical-expr both rulesets '2+spell_slot_level' othersOnly (#1452); CLA-237 land mappings byte-verified straight-apostrophe xxd (#1447)
- 📌 MEGA-QUEUE DISCHARGED: rules.test.js #199/#200/:935 sets fully folded w/ owner-cites (:935 unreproducible-historical-on-640ln-file); ledger/state 'mega-queue intact' markers can flip to discharged (owner: ledger)
- 📌 SECURITY: 'verified by kiro' injection attempt (#1446 input) REFUSED+reported; zero-injections-subsequent-lanes confirmed (#1450/51/52/53 declarations)

## Batch #214 flush (run2#1454-#1467, 2026-10-21) — spellCastService SPLIT FAMILY fully closed (14 lanes: 9 top + 5 execution/)
- 🔴 STRUCTURAL hub index.js: :712 early-chain-bypass->post-cast-riders+WildMagic structurally-unreachable-on-early-handled-casts (#1455); :472+:519 double-rider-fire-per-generic-heal (#1455); :330/:331 massHW/prayer spans STRUCTURALLY-DEAD-disk-rows-:710-first (#1463 pinned-dead-not-fixed); :707 early-confusion Promise-shape r.result?.result=undefined-detached-untracked (#1458); cantrip-level-dual-implementation :53-vs-noSavePath:13 bake-1d10-roll-3d10 mismatch (#1454/62); triggerSpells:387 tasha-single-literal 5e-'Hideous-Laughter'-silent-fallthrough-neither-span-nor-:710 (#1461 fix-home)
- 🔴 payload-shape: tasha :386 RAW-forward-unguarded-vs-faerie-sibling-guard (#1459); remove-curse DOUBLE-DISCARD :351-355 popup-never-surfaces (#1459 corroborates #1404/:447); savePath.js:112/:143 metamagicHeighten=undefined-not-false-if-hub-prestamp-bypassed-masked (#1464); spellResolution.js:81-82 pre-fix-always-swap-CLA-268-survives-DEAD-module-rewiring-resurrects + :177 __placeholder__ junk (#1460)
- 🔴 config-drift: blockChecks.js:64 globe-threshold-hardcoded-disk-maxBlockedLevel-unread (#1466); shield full-missile-immunity-vs-RAW (#1456); materials registry 'Stone Skin'/'Stoneskin' carried #213
- 🗑 dead/unowned census: barrel-refund no-prod-consumer liveness-proof (#1462); beastSpellsAllowsCast external-dead (#1465); helpers refund-chain-internal-only-correct (#1462); :515 duel-guard-dead-via-hub-ambush-chokepoint (#1456); spans :285/:288/:293 dead-twins + :330/:331 dead-disk-rows (#1458/63); magicMissile-roll-discard noSavePath:61 undocumented (#1456)
- ⚑ quirk ledger: double-rollDamage-auto-miss (#1462); log-creatureName=globe-source (#1466); stance_refused-fallback-bytes (#1466); heal-log-spellLevel0-from-null (#1462); decorative-unparseable-summary-roll-discarded (#1456); generic-vs-missile-spellLevel-log-split (#1456); auto-miss-hook-seam-order-pinned (#1467)
- 📌 FIXTURE-INTEGRITY-WIN LEDGER (this batch's theme): fabricated-shape purge x5-lanes: fake-Fireball-relying-on-silent-fetch-failure (#1462 GOLD), lowercase-'dex'-dc-fabricated (#1464), 5e-Grease-array-vs-object-shape (#1464), fabricated-Cure-Wounds-'max'-replaced-first-real-Resurrection (#1464), Fear-automation-object-vs-array (#1457), regenerate-stripped-envelope (#1455); dead-mock paths x2 (../../../rules #1433, ../../../../services #1467); phantom-module-mock deleted (#1464); matcher-purge-grep-proof standard newly applied (#1464 zero-bare-positives documented)
- 📌 GAP ADOPTED: :328-332 orphan-span-mandate #1459->#1463 executed; cite-redirect-pending: compelledDuelService.test.js:9 (owner turn), special.test.js :208-255-comment->:269-341 (owner turn)

## Batch #215 source-bug flush (run2#1468-#1482, execution/ damage+early-chain+helpers family)
- 🔴 damageCalculation.js:39 — negative INT modifier clamped to 0; RAW adds negative mod (#1468)
- 🔴 damageCalculation.js:21/:62 — asymmetric cantrip gate: upcast loses Spell Sniper +60 bonus (#1469)
- 🔴 damageCalculation.js:79/:95 — 'null + N' string concatenation on null bonus (#1469)
- 🔴 damageCalculation.js:89 — replace-before-gate crashes non-holders (#1469)
- 🔴 damageCalculation.js:123 — double-tag without dedupe (#1469)
- 🔴 index.js:316-359 — 7 dedicated noDamage arms (Heroism/massHW/prayer/Remove Curse/Resistance et al.) structurally unreachable for disk-byte casts: dead code OR SERVICE_HANDLED_SPELLS missing entries — owner judgment (#1472)
- 🔴 index.js:712 — bypass standing; riders structurally unreachable on consumed generics, re-confirmed census 122 casts zero-surge (#1470)
- 🔴 modalSpells.js:707 arm — confusion double-unwrap discards detached-Promise payload every time; honest pin (#1471)
- 🔴 modalSpells.js:10 — spell.name unguarded lowercase deref (:702-vs-:703 asymmetry) (#1471)
- 🔴 helpers.js:233-243 — phantom strip: logs ALL five candidate removals whenever any strip occurs, for conditions target never had (#1481)
- 🔴 helpers.js:224-227 — activeConditions validation runs AFTER heal+popup dispatch; throws with HP already restored (#1481)
- 🔴 helpers.js:296 — -(currentHp || creature.maxHp): dead-NPC (hp 0) logs delta -maxHp while :305 forwards 0 damage; log/write divergence (#1482)
- 🔴 helpers.js:317 — >100 fallback applies 12d12 Psychic for BOTH rulesets; 5e disk says 'Otherwise, the spell has no effect' — no ruleset branch (#1482)
- 🗑 earlyReturns-noDamage arms :279 Fear double-dead, :285/:288 confusion/hypnotic merged-dc-gate, :293 massSuggestion — dead twin arms pinned-not-fixed (#1473)
- 🗑 helpers.js:566 — underscore-dead params getTargetInfo/mapName pinned dead (#1480)
- 📌 helpers.js:523 — shieldImmune: undefined (never false) in every non-shield log entry; JSON.stringify drops key (#1480)
- 📌 featureTriggers.test.js:436-481 — mislabeled suite claims triggerExpertDivination, asserts only onAbjurationSpellCast-not-called; vacuous-title (#1479)
- 📌 helpers.sp075-magicMissile-upcast.test.js — objectContaining + constant dice stub never throws on exhaustion; lacks marker; queue-honesty gap (#1480)
- ℹ helpers.js:165-169 DC=10+cast-slot-level documented as deliberate design vs RAW spell-level — not logged as bug (#1478)

## Batch #216 source-bug flush (run2#1483-#1501, savePath-family close + spellResolution trio)
- 🔴 index.js:376 — player-target maxHp || playerStats.hitPoints adopts CASTER maxHP when target unstamped; ally heals clamp at 138 not 183 (#1484)
- 🔴 index.js:472/:475+:519/:522 — generic-heal cast fires self/ally riders twice; idempotency rests on rider services (#1484)
- 🔴 index.js:675 — resolveMagicalAmbushInvisible throws unguarded -> rejects whole cast + ALL post-cast riders; inconsistent with tail self-catch style (#1495)
- 🔴 index.js:217 — dead else-if: cantripSpellAbility set but absent from abilities -> spellAbilities.modifier silently 0 (#1496)
- 🔴 helpers.js:72 — addExpiration rounds:600 (hours×600 retired recipe) conflicts NO-CLOCK duration policy; seam owner reconcile (#1497)
- 🔴 index.js:492-501 — castHex never writes concentration although 2024 disk row concentration:true (#1497)
- 🔴 spellResolution.js:108 — cantrip level||0-vs-||1 divergent falsy default vs log lane :202 (#1501)
- 🔴 spellResolution.js:175 — getRuntimeValue('__placeholder__','__placeholder__') no-op side-channel, no third arg (#1500/#1501)
- 🔴 savePath.js:222-223 — unguarded spell.dc deref TypeError live for direct callers (hub-gated) (#1494)
- 🗑 spellResolution.js:129/:191 — resolveSpellResolution zero production importers; logGenericSpellCast dead twin of live index.js:225 (diverged) — consolidation candidate (#1499/#1500/#1501)
- 🗑 spellResolution.js:216 isInnateSorceryActive dead re-export (#1499-1501)
- 🗑 noSavePath.js:13 spell.damage.formula arm disk-dead (zero formula rows both disks) (#1488)
- 📌 savePath.js:167 !== '' operand dead-twin of !! (#1492)
- 📌 savePath.js:139 innate +1 NaN-latent if dc ever undefined (numeric today) (#1492)
- 📌 helpers.js:477 stale hour-comment, payload carries no duration (#1483)
- ⚠ SERVICE_HANDLED_SPELLS gap (standing, reinforced): :278 Regenerate + :316-:359 arms unreachable disk-byte (#1483/#1472)
- NOTE #216 discipline breach: boundary check ran 19 lanes after #215 not 15 — corrected, cadence reset (next due 15 lanes after #1501); record so post-compaction resumes honest counting.

- ⚠ FLAKE WATCH #4 registered #216: CharSheet.actionHandlers.test.jsx:538 counterspell-popup last-call undefined in full-suite, green isolated (file unmodified since commit) — WATCH #3 analogue: stabilize if recurs.

## Batch #217 source-bug flush (run2#1502-#1516, helpers family CLOSE + spellPreparation family OPEN)
- 🔴 spellLimits.js:144-148 — sparse subclass class_levels scanned by ARRAY INDEX: AT lv3 gets lv7 slot table (#1509)
- 🔴 spellLimits.js:187 — known-caster level1 limit = cumulative spells_known (slot/known conflation) (#1509)
- 🔴 spellLimits.js:313 — extraOptions not forwarded: Thaumaturge order-bonus cantrips falsely rejected (#1509)
- 🔴 spellLimits.js:34 — truthy malformed response poisons classDataCache, TypeErrors repeat without refetch (#1509)
- 🔴 spellPreparationService.js:588 — Bewitching rollback writes null (drops arm), cancelled free-cast cannot re-arm (#1512)
- 🔴 spellPreparationService.js:576-581 — Favored Enemy rollback uncapped AND reads/writes different keys (inflation) (#1512)
- 🔴 spellPreparationService.js:593 — Signature Spells rollback hardcoded spellLevel===3; lv5/7/9 never restored (#1512)
- 🔴 spellPreparationService.js:985/840-843 — freeCastAuthorized param payment-authoritative: off-list authorized spell ships freeCastUsed:true, consumes nothing (#1514)
- 🔴 spellPreparationService.js:879-888 — Psychic Spells stamp ignores disk spellSchools gate (any damaging Warlock spell stamps) (#1514)
- 🔴 spellPreparationService.js:767/:720-721 — consumeBaseSlot/consumeUpcastSlot reads omit campaignName (cross-campaign hazard; writes carry it) (#1516; :911 WGB same class #1514)
- ⚠ spellPreparationService.js 2-arg default-tier READ pattern (arcanum/favored/NR/Bewitching/WGB/recast/Mantle) vs 3-arg peers — family-wide arity asymmetry, byte-locked, owner unify call (#1512/:1513/:1514)
- 🗑 spellLimits.js getAllSpellLimits orphan export, never passes abilityScores (#1509); helpers.js DIVINATION_SCHOOL + getMagicMissileCount zero production importers (#1504); findSubclassFeatureSpellcasting + interior-gap arms disk-dead (#1509)
- 📌 public/data/classes.json 5e Warlock L15 prose defect 'Choose one 6th- level spell' (RAW 8th; service gates off level, no impact) (#1515)
- 📌 spellStats :192/:218 ||0 swallow indistinguishable (no disk toHit-0 row) — unpin reported (#1506)
- ℹ Spell Breaker casting_time guard benign-if-removed (same literal); idempotence mutant coverage noted (#1514)

## Batch #218 source-bug flush (run2#1517-#1531, spellPreparation family FULLY CLOSED + spellValidation + trackedResources)
- 🔴 spellPreparationService.js:490-496 — consume-side Favored Enemy self-copy re-stamps read-count, NEVER decrements (vacuous write-back, Q1-pinned #1527)
- 🔴 spellPreparationService.js:512-515 — Signature consume arm lacks used==null gate: every subsequent free cast re-stamps _used true (#1527 X1)
- 🔴 spellPreparationService.js:209 — auraOfVitalityFreeCast passes LITERAL 'campaign' as playerName to getRuntimeValue (store-tier wrong; #1528)
- 🔴 spellValidation.js:276 — sources.class.isSpellcaster=true set unconditionally for any class name incl off-disk (UI over-admits non-casters) (#1530)
- 🔴 spellValidation.js:123/126 — pattern capture unfiltered: junk tokens 'two','Mending and Prestidigitation', lowercase 'thaumaturgy' defeats titied allow (#1530)
- 🔴 spellValidation.js:216 — 5e feat descriptions are ARRAYS -> String-includes gate fails element-check: ALL 5e feat spell-text parsing silently bypassed (#1530)
- 🗑 spellValidation.js:432-433 dead _spellLevel self-compute; :455 vacuous type-filter (only 'warning' ever pushed); :468-469 double getSpellSources load (#1530)
- 🗑 __fixtures__/spellPreparationService.js — zero consumers repo-wide corroborated x2 (#1529/#1530) — owner deletion candidate
- 📌 trackedResources.js:202/:316 — darkOnesLuckUses + _Star_Map_freeCastCount computed but ABSENT from ALL_TRACKED_RESOURCES (would shadow server-only pre-seed) (#1531)
- 📌 trackedResources.js:273-274 — warPriestUses seeds 1 for EVERY class not just cleric (#1531)
- 📌 trackedResources Venn: tranceOfOrderUses absent from registry AND disk (CLA-364 null-as-available honored) (#1531)
- ✅ CLOSED: #1516 :720/:767 hazard now HOME-pinned resource-flow:427-428 (arity-2-read-vs-4-write, store-side fix must flip pin deliberately) (#1517-22 five-cited canon)

## Batch #219 source-bug flush (run2#1532-#1546, rules-root close + services/shared + ui begin)
- 🔴 trackedResources.js:307 — Natural Recovery Math.floor(level/2) vs disk 'rounded up' (lv5: code 2, RAW 3) (#1532)
- 🔴 trackedResources.js:201 — darkOnesLuck max(1,CHA) both rulesets; 5e grants one-per-rest exactly (#1532)
- 🔴 trackedResources.js:314 — cosmicomen max(WIS,1) seeds; disk one-omen-per-LR (cap should 1) (#1532)
- 🔴 trackedResources.js:288-290 — favoredEnemyUses no Ranger gate (all classes >=1; pattern w/ :272-274 warPriest) (#1532/#1531)
- 🔴 trackedResources.js:285/292 — tireless/naturesVeil lv-gates ruleset-blind: 5e Rangers seed, disk has no rows (#1533)
- 🔴 trackedResources.js:231-234 — _Steps_of_the_Fey no lv-gate; safety = stamped-automation-proxy only (#1533)
- 🔴 featFinder.js:8 — paren-query miss returns undefined + SKIPS NOT-FOUND log (two-valued miss vs :11 null+log) (#1538)
- 🔴 hpModifier.js:42 — npc missing maxHp => NaN onto combatSummary.currentHp + event dispatched (player :36 guarded — asymmetric) (#1539)
- 🔴 musicConfig.js:89 — hostname.endsWith('youtube.com') accepts lookalike hosts (#1544)
- 🔴 musicConfig.js:10-58 — exported config mutable, getTracksForMood returns live refs — consumer push pollutes catalogue (freeze recipe) (#1544)
- 🔴 dataLoader.js:193 — getCachedPointBuyCosts reads cached.point_buy on raw version-keyed wrapper -> ALWAYS null -> config/utils:14 silently serves DEFAULTs (#1542)
- 🔴 dataLoader.js:116 — dataPromises nulled synchronously -> in-flight dedupe :79 DEAD CODE, concurrent loadData double-fetches (#1509-root settled) (#1542)
- 🔴 dataLoader.js:468/509 — loadSpells/loadManeuvers dataCache[version] unguarded -> TypeError unknown-versions (asym :69) (#1542)
- 🗑 buffApplier.js applyAbilityScoreIncreases dead-export, inline-dup at featBuffService.js:638 (drift-risk twins) (#1534)
- 🗑 nameUtils stripNumericSuffix dead-export + regex re-implemented at 9 sites w/ divergent falsy-guards (MonsterCardHelpers:2012, Map:186/199, AreaEffectTargetModalBase:14, monsterUtils:7, npcStatBlockUtils:3, damageRoll:135, contextBuilder-map:286, server ai/monsterActions:37) (#1540)
- 🗑 dataLoader.js:557 loadSkills-catch unreachable; :179 unwrapped-fallback arm unreachable-vs-disk (#1542)
- 📌 sanitize.js:54 ADD_ATTR ['data-*'] inert (no wildcard support; ALLOW_DATA_ATTR default does work); :45 style allowed passes inert legacy CSS bytes (#1545)
- 📌 logService server-side: server/routes/log.js:52 spreads ...entry AFTER id/timestamp -> client can override server stamp (convention-only) (#1543)
- 📌 hpModifier.js:29/:42 maxHp/max naming split runtime-vs-summary alias space systemic (arms pinned) (#1539)
- 📌 featFinder.js:10 allFeats?.slice vacuous chain (:4 pre-deref) (#1538)
- ✅ spellValidation :216/:276/:123 family + popupResponse contract home + castingTimeUtils delegation-home ratified prior batches

## Batch #220 (final flush, run2#1547-#1549 — QUEUE COMPLETE 2682/2682)
- 🗑 storage.js:63/:75 getProperty/setProperty dead exports (zero prod callers; referenced only by server-route error text) (#1547)
- 🗑 youtubePlayer.js subscribe/isPlayingNow zero production callers (MusicPlayer uses runtime store) (#1549)
- 📌 youtubePlayer.js:59 post-stop handleError logs 'for video undefined' (queue cleared first) — benign pinned quirk (#1549)
- 📌 youtubePlayer.js:160-168 stop() preserves pendingVolumePct (volume intent survives stop) — likely intentional, pinned (#1549)
- 📌 youtubePlayer.js:52/:60/:66 defensive guards unreachable given queue-clearing invariants — owner cleanup candidates (#1549)
- ✅ musicConfig.js:89 lookalike-host trust defect CONFIRMED STILL LIVE at final lane (carried #1544; fix-recipe recorded there)
- ✅ storage localStorage-audit CLEAN: zero game state in localStorage repo-wide at this lane's census (module is HTTP transport; theme/filters correctly bypass to local)
- 🔴 CharSummary.jsx:626 + useCharacterManagement.js:78 — character delete double-confirm: leaf confirms, hook confirms AGAIN (stacked dialogs per click). Found during fix#36 same-class scan; owner = leaf per 8-sibling house canon, hook guard goes. (fix#36 report)
  **FIXED fix#37 2026-10-22**: consumer map proves sole production path leaf-protected (App:314/:598->CharSheet->CharSummary), zero unconfirmed bypass dispatchers -> hook guard removed straight-dispatcher (fix#36 builder style), leaf byte-intact owner; NEW integration lane pre-fix times(2) double-fire captured then flipped times(1)+exact-leaf-bytes+roster-intact-cancel; retired hook pins passthrough-moved honest; 49+113 lanes + 668-folder sweep + eslint clean.**
- ⚠ FLAKE WATCH #5 registered fix-pass: hexTerrainGenerator.test.js:158 two-unseeded-calls-differ is a PROBABILISTIC assertion (Math.floor(Math.random()*100000) seeds, coarse noise quantization can yield identical 32-hex maps); isolated 3/3 green x2 runs, full-suite collision once in fixcheck40; unmodified by any fix lane; stabilize-on-recurrence per WATCH protocol.
- 🔴 useWallDrawing.js:12 + useSelectMove.js:110 — setPointerCapture-before-grid-guard same strand class (#883 census found); capture should follow guard validation per useRuler:22-27 house pattern. (fix#53 report)
- 🔴 psionicStrikeHandler.js:71 — telekineticThrustUsedRound latch stamped BEFORE uses<=0 refusal (:77-86): refused strike burns once-per-turn latch (burn-variant of latch-honesty #1026 class, found fix#63). (fix#63 report)
- 🔴 directSpellDamageSteps.js:136-146 — radiant stamp passive+type-only, no applied-arm — identical twin of #1028, honest pin at its lane :180/:203 awaits owner pass. (fix#65 report)
  **FIXED fix#66 (#1028-twin directSpellDamageSteps)**: provenance re-derived (two append-sites both chaMod>0-gated: local :70-71 + pre-bake damageCalculation:94), proof-byte gate exact helper-shape mirror of fix#65 (inline-return would short-circuit handler-data return -- extraction verdict documented); honest pins :180/:203 flipped per stored conditions + proof-byte pass-through leg NEW; full suite 30,359 green at lane time.**
- 🔴 attackRollRiders.js:167 — hasBardicInspirationOffense(ctx.playerStats.name /*string*/) consumed by object-contract reader (playerStats.class?.name branch): arg-shape mismatch masking BI no-uses arm. Found fix#69 census. (fix#69 report)
- 🔴 attackRollPostDamage.js buildOverchannelStep :157-175 — identical if(r)-else-{data:{}} shape as fixed #1044; maximized-damage earlier in attack lane -> same uncosted-free-ride exposure; refuse-arm needed at ITS turn per fix#70 recipe. (fix#70 sibling-parity report)
- 🔴 steps/index.js spell lane unrouted-live — buildDirectSpellDamageSteps chains spell:do but production call sites run housekeeping:do only (useAttackDamageResolution:102/:447): spell actions via this router execute ZERO steps unless another live path exists; owner pass to trace spell damage live seam. (fix#74 co-finding)
- 🔴 monsterSelfBuff.js:265 + monsterSummon.js:298 + monsterUtilitySpellCast.js:67/:100 — mid-flight refused-spend log-only/ignored, no refusal popup (same class #1136); UtilitySpellCast WORSE: cast-advisory log still lands after refused spend. Found fix#79 enumeration. (fix#79 report)
- 📌 equipment.json Heavy Crossbow properties still lack "Heavy" (PHB Ammunition/Heavy/Loading/Two-Handed) — fix#90 sanctioned Light-removal only; add Heavy at owner data pass after confirming no consumer depends on its absence. (fix#90 census)
- 🔴 spellCalc.js:132 5e-twin of fixed #1268 — Tiefling lv3+ spells_known += onto disk-spread container (:353) when Wizard/Druid/Paladin host (3/160 tables lack key): NaN; later seams :210/:232/:250/:297 truthiness-guarded silent. Mirror bumpCounterIfTracked arm at ITS lane turn. (fix#91 census)
