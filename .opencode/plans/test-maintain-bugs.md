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
