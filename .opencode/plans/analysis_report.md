# Analysis Report — `src/`

Scope: 3,624 `*.js|jsx` files (~910k lines incl. 2,399 tests). ts/tsx: none.

## Duplication

1. **Area-effect save modals** — `src/components/char-sheet/modals/shared/`
   - `FearModal.jsx` (397 L), `HypnoticPatternModal.jsx` (403 L), `TashasLaughterModal.jsx` (381 L), `CalmEmotionsModal.jsx` (375 L).
   - Measured identical non-blank lines: Fear vs HypnoticPattern **84%** of the smaller file; vs Tashas 63%; vs CalmEmotions 56%. All four already import `AreaEffectTargetModalBase.utils.jsx` (persistAndNotify, saveResultLogging, CreatureSelectionModal) — yet the save-prompt loop bodies remain near-identical, i.e. the base wasn't carried to completion.

2. **"Identity refusal" probes** — `src/components/encounter/MonsterCardHelpers.js:1518, :1570, :1622` — `hellishRebukeIdentityRefusal`, `mindCorrosionIdentityRefusal`, `reflexiveAntennaeIdentityRefusal` are the same event-identity gate with per-feature refusal-message maps; the in-file comments literally say *"mirrors hellishRebukeIdentityRefusal"* (L1564, L1617-18).

3. **Monster reaction service family** — `src/services/encounters/monster{Jinx,RedirectAttack,GrantReaction,LairActions,GuardianProtection,ShapeShift,SelfBuff,SelfAura,SpellReflection,UtilitySpellCast,Summon}.js` — each repeats the same scaffolding: exported `handle()` + `buildXRefusalPopup` + `buildXSpendLog`/`buildXRefusalLog` builders + round/uses latch checks (same pattern of exported-but-never-imported builders; see Unused Symbols).

4. **Two Savage Attacker implementations** — `src/services/rules/core/savageAttacker.js` (94 L) and `src/services/combat/steps/features/savageAttacker.js` (43 L) both implement "roll damage twice, keep higher" + the identical passive predicate `passives.some(p => p.type === 'passive_rule' && p.effect === 'reroll_damage_once_per_turn')`. **Neither is imported by any production file** — the live logic is inline in `handlePlainDamage.js`/`DiceRollResult.*`.

5. **Two `beguilingTwistHandler.js`** — `automation/handlers/class-ranger/` (105 L, registered at `automation/index.js:121`) vs `class-warlock/` (175 L, orphaned, diverged implementation, 3 test files). Beguiling Twist is a Ranger (Gloom Stalker) feature; the warlock copy is an unreferenced fork.

## Dead Code

Verified: no importer anywhere (imports resolved incl. case-insensitive; only one `import.meta.glob` exists, in `map3dAssets.js`; no lazy imports; namespace imports checked). Removing these strands also orphans their co-located tests.

- **Unreferenced modules (production)**:
  - `src/encounters/combatData.js` — one-line `export *` shim over `services/encounters/combatData.js`; only its own test imports it.
  - `src/services/rules/core/savageAttacker.js` + `src/services/combat/steps/features/savageAttacker.js` (see Duplication 4).
  - `src/services/automation/handlers/class-warlock/beguilingTwistHandler.js` (see Duplication 5).
  - `src/services/character/rageUtils.js` (15 L) — zero mentions repo-wide outside itself/tests.
  - `src/services/combat/effects/calmEmotionsCleanup.js` (59 L) — zero production mentions.
  - `src/services/rules/features/{aid,antimagicField,fear,feignDeath,massHeal,powerWordFortify}Service.js` — only tests import these.
  - `src/services/shared/{getClassLevelData.js (5 L), injectSpecialActions.js (20 L)}`, `src/services/automation/common/conditionEventStore.js` (11 L), `src/services/ui/syncStoreValue.js` (127 L).
- **Unreferenced UI components** (only 1 test imports each): `popups/{MultiTargetCountPopup,SingleTargetPopup,PsionicChoicePopup,TargetWithCheckboxesPopup,TargetWithTypePopup}.jsx`, `modals/shared/{ChoiceListModal,HealingIllusionModal}.jsx`, `initiative/{ConcentrationPicker,ConditionPicker}.jsx`, `character-creation/WizardStepRaceClass.jsx`.
- **Unreferenced module** with caveat: `src/routes/config.js` — only its test imports it, but AGENTS.md calls it "canonical view config"; App.jsx hardcodes views. Document drift, not automatic removal.

## Unused Symbols

Exports whose names appear **nowhere outside their defining file** (and dynamic-dispatch via namespace import ruled out):

- `savePromptService.js:105,114,132,141` — `sendPrismaticSprayIndigoPrompt`, `clearPrismaticSprayIndigoPrompt`, `sendPrismaticSprayVioletPrompt`, `clearPrismaticSprayVioletPrompt` (the `…Result` variants are live; the `…Prompt` variants are dead).
- `magicSpells.js` — `addFeyTouchedSpell`, `addMagicInitiateSpells`, `addShadowTouchedSpell` (definition-only).
- `attackCalc.js` — `getSpellActionType`, `isSpellAttack`; `sleepService.js:27` — `getSleepEffect`; `travelService.js` — `isTerrainPassable`, `MAX_FORCED_MARCH_HOURS`; `race-sources.js` — `buildFeatSkillLimitsDetails`; `cunningStrikeUtils.js` — `setGetCombatContextSyncOverride`, `clearGetCombatContextSyncOverride` (safest fix: drop `export`, or remove if internal mentions also 1).
- Lower-confidence tier (used in-file once, never imported): ~40 `build*Popup/RefusalPopup/SpendLog/…Log` helpers across the `monster*.js` services listed above — safe to drop the `export` keyword only.

## Complexity

Brace-nesting depth / function-length scan of the largest production files:

- `components/char-sheet/CharReactions.jsx` — component body **474 lines** (L404+), max nesting depth **6** (L254).
- `components/char-sheet/modals/shared/SaveAttackAoeModal.jsx` — component body **591 lines** (L1208+), depth 4.
- `components/encounter/MonsterCardModal.jsx` — 2,635 L file; `buildAbilitySaveRollContext` **132 L, cyclomatic ≈ 24** (L1564); depth 5.
- `services/rules/combat/applyDamage.js` — depth **5** (L246), 1,083 L.
- `hooks/combat/handlers/handlePlainDamage.js` — 1,128 L, depth 4; `saveProcessing.js` 1,502 L; `MonsterCardHelpers.js` 3,403 L (mitigated: many small helpers).

## Inconsistency

1. ~~**Filename-case mismatches**~~ — FIXED (63deb3844 `Subscriber.jsx`, 88f1ebb23 `Initiative.jsx`).
2. **Inline styles**: `style={{…}}` in **89 non-test JSX files** (max 15 in `CombatSuperiorityModal.jsx`), vs the "no inline styles" rule.
3. **`!important`**: 15 in `EncounterBuilder.css`, 11 in `Initiative.css`, etc. — vs "never use !important".
4. **Folder naming**: `automationInfoBuilder/`, `skillValidation/`, `spellCastService/`, `useSpellMetamagicFlow/` are camelCase dirs vs the kebab-case convention.
5. **Dice rolls bypassing the dice utility**: `services/dice/diceRoller.js` exists, yet raw `Math.floor(Math.random()*n)+1` appears in ~60 places (WeatherOverlay.jsx ×27, npcGenerator.js ×13, DiceRollResult.handlers.js ×9…). One instance (`rules/core/savageAttacker.js`) even rolls with the wrong die bounds (`Math.random()*roll`) with an admitted *"placeholder"* comment — dead code, so no runtime impact.
6. **Layering drift**: initiative components (`initiative.jsx`, `npcClickFormHandlers.js`) import `getRuntimeValue/setRuntimeValue` from `hooks/runtime/` — services/components reaching into the hooks layer.
7. **Test-utility naming drift**: `*.test-utils.js|jsx` (35 files) vs `log-test-utils.jsx` (hyphen) and `CharSpecialActions.modalMocks.jsx` / `__mocks__/`.

## Prioritized Low-Risk Opportunities

1. **Rename `initiative.jsx` → `Initiative.jsx`** and fix remaining case-mismatched imports (`subscriber.jsx` done: commit 63deb3844).
2. **Delete verified orphan modules + their stranded tests** (Dead Code list; ~1,000 L): `rageUtils.js`, `calmEmotionsCleanup.js`, the two `savageAttacker.js`, warlock `beguilingTwistHandler.js`, `src/encounters/combatData.js` shim, `getClassLevelData.js`, `injectSpecialActions.js`, `conditionEventStore.js`, and the 7 unreferenced popups/modals/pickers — each has zero production importers.
3. **Strip `export` from the ~20 truly-unused exports** (Unused Symbols, top tier) — no call sites, no dispatch risk.
4. **Delete the 6 `rules/features/*Service.js` orphans** after a one-time GM smoke check that Aid/Antimagic Field/etc. flows route through the live handlers (they already do — services unreferenced).
5. **Consolidate the 4 area-effect modals** into `AreaEffectTargetModalBase` — biggest duplication win (up to 400 L saved) but needs the most review; do last.
6. Cosmetic backlog: camelCase dirs → kebab-case, reduce inline styles/`!important`, route dice rolls through `diceRoller.js` (changes RNG call order — NOT zero-risk; deprioritize).
