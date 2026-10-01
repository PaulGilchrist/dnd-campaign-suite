# Analysis Report — `src/`

Scope: 3,624 `*.js|jsx` files (~910k lines incl. 2,399 tests). ts/tsx: none.

## Duplication

1. **Area-effect save modals** — `src/components/char-sheet/modals/shared/`
   - `FearModal.jsx` (397 L), `HypnoticPatternModal.jsx` (403 L), `TashasLaughterModal.jsx` (381 L), `CalmEmotionsModal.jsx` (375 L).
   - Measured identical non-blank lines: Fear vs HypnoticPattern **84%** of the smaller file; vs Tashas 63%; vs CalmEmotions 56%. All four already import `AreaEffectTargetModalBase.utils.jsx` (persistAndNotify, saveResultLogging, CreatureSelectionModal) — yet the save-prompt loop bodies remain near-identical, i.e. the base wasn't carried to completion.

2. **"Identity refusal" probes** — `src/components/encounter/MonsterCardHelpers.js:1518, :1570, :1622` — `hellishRebukeIdentityRefusal`, `mindCorrosionIdentityRefusal`, `reflexiveAntennaeIdentityRefusal` are the same event-identity gate with per-feature refusal-message maps; the in-file comments literally say *"mirrors hellishRebukeIdentityRefusal"* (L1564, L1617-18).

3. **Monster reaction service family** — `src/services/encounters/monster{Jinx,RedirectAttack,GrantReaction,LairActions,GuardianProtection,ShapeShift,SelfBuff,SelfAura,SpellReflection,UtilitySpellCast,Summon}.js` — each repeats the same scaffolding: exported `handle()` + `buildXRefusalPopup` + `buildXSpendLog`/`buildXRefusalLog` builders + round/uses latch checks (same pattern of exported-but-never-imported builders; see Unused Symbols).

4. **Two Savage Attacker implementations** — `src/services/rules/core/savageAttacker.js` (94 L) and `src/services/combat/steps/features/savageAttacker.js` (43 L) both implement "roll damage twice, keep higher" + the identical passive predicate `passives.some(p => p.type === 'passive_rule' && p.effect === 'reroll_damage_once_per_turn')`. **Neither is imported by any production file** — the live logic is inline in `handlePlainDamage.js`/`DiceRollResult.*`. RESOLVED: both files deleted in 234d56073.

5. **Two `beguilingTwistHandler.js`** — `automation/handlers/class-ranger/` (105 L, registered at `automation/index.js:121`) vs `class-warlock/` (175 L, orphaned, diverged implementation, 3 test files). Beguiling Twist is a Ranger (Gloom Stalker) feature; the warlock copy is an unreferenced fork. RESOLVED: warlock copy deleted in 234d56073.

## Dead Code

Verified: no importer anywhere (imports resolved incl. case-insensitive; only one `import.meta.glob` exists, in `map3dAssets.js`; no lazy imports; namespace imports checked). Removing these strands also orphans their co-located tests.

- ~~Deleted (234d56073)~~: `rules/core/savageAttacker.js`, `combat/steps/features/savageAttacker.js`, warlock `beguilingTwistHandler.js`, `rageUtils.js`, `calmEmotionsCleanup.js`, `shared/{getClassLevelData,injectSpecialActions}.js`, `automation/common/conditionEventStore.js`, `ui/syncStoreValue.js`, `popups/PsionicChoicePopup.jsx`, `initiative/{ConcentrationPicker,ConditionPicker}.jsx`, `character-creation/WizardStepRaceClass.jsx` + stranded tests.
- **CORRECTION**: `src/encounters/combatData.js` is NOT an orphan — `../../../encounters/combatData.js` imports from `src/services/combat/steps/*.js` resolve to it. Keep.
- **`vi.mock`-referenced UI components** (no production importers; kept because surviving CharSpells/CharActionModals tests mock these paths): `popups/{MultiTargetCountPopup,SingleTargetPopup,TargetWithCheckboxesPopup,TargetWithTypePopup}.jsx`, `modals/shared/{ChoiceListModal,HealingIllusionModal}.jsx`.
- ~~DONE (1bcbf83df)~~: deleted orphan `rules/features/{aid,antimagicField,calmEmotions,feignDeath,massHeal,powerWordFortify}Service.js` + stranded tests. `fearService.js` KEPT — live `vi.mock` paths in 9 surviving spellCastService tests reference it.
- **Unreferenced module** with caveat: `src/routes/config.js` — only its test imports it, but AGENTS.md calls it "canonical view config"; App.jsx hardcodes views. Document drift, not automatic removal.

## Unused Symbols

Exports whose names appear **nowhere outside their defining file** (and dynamic-dispatch via namespace import ruled out):

- ~~DONE (d546738f6)~~: deleted all top-tier zero-referenced exports in savePromptService (…Prompt variants), magicSpells, attackCalc, sleepService, travelService, race-sources, cunningStrikeUtils.
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

1. ~~DONE~~ (63deb3844 Subscriber.jsx, 88f1ebb23 Initiative.jsx).
2. ~~DONE~~ (234d56073 — 13 sources + 17 stranded tests/CSS removed, −5,002 L; `src/encounters/combatData.js` re-verified LIVE — not deleted).
3. ~~DONE~~ (d546738f6 — 16 zero-referenced exports deleted).
4. ~~DONE~~ (1bcbf83df — 6 orphan services + 9 tests removed; `fearService.js` kept: live `vi.mock` refs).
5. ~~DONE (985e517f2)~~: extracted `AreaEffectSaveFlow.utils.js` (hooks: useCarefulSpellSelection, usePendingPromptsCleanup, useSaveResultListener, rollNpcSave, issuePlayerSavePrompt, …) shared by the 4 area-effect modals; net −192 lines; full suite green.
6. Cosmetic backlog (deferred, not zero-risk / architectural): camelCase dirs → kebab-case, inline styles (89 files), `!important` usages, dice rolls → `diceRoller.js` (changes RNG call order), hooks-layer imports in initiative components.
