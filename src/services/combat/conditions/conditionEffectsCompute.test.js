// @maintained-by-ai
// Compute-canon lane: per-te and per-modifier fold math of computeConditionEffects,
// pinned as EXACT changed-fields diffs vs the engine defaults (folded() — the
// #998 helper). Any byte a fixture moves beyond DEFAULTS must appear in the row;
// {} proves inertness. Zero-leak falsifier built into every assertion.
//
// Family ownership (verified, nothing re-driven here):
//   dispatch order + condition-handler census + combine matrix + readers
//     → conditionEffects.test.js (base :155 crusher early+generic fold,
//        :176 topple late-over-generic, :191 dodge, :230 combine matrix)
//   attacksOther consumer gate (:864) → conditionEffectsCombine.test.js
//     (its header :10 forwards the producer-side te→field folds back HERE)
//   restoreBalance (incl. CLA-295 never-passive) → restoreBalance.test.js :105
//   roles: marked_as_prey/pesky_swarm → animal-spirit.test.js · bolster
//     → bolster.test.js · clairvoyant combine roles → clairvoyant.test.js
//   clairvoyant COMPUTE fold (CLA-053 defender-leg) stays HERE (compute rows
//     :263-272 are this file's per #997/#998) — the old :263 test is kept,
//     restated as an exact diff.
//
// #998 applied recs (3 deletes, both blocks read + verified dupes):
//   old :242 topple+CON ⊂ :308 topple (kept — exact diff, adds saveAbility+duration)
//   old :250 mass_fear+WIS ⊂ :210 mass_fear (kept — now pins massFearRange bytes)
//   old :257 incapacitated+saveType ⊂ :228 hurlThroughHell (kept — exact diff)
// Other cuts: old :373 foresight ⊂ :274 (subset assertion); old :205
// repeatingSave vacuous (asserts undefined on a field the engine never has);
// old :571 restore_balance → restoreBalance.test.js :106 owns the identical
// fixture. banishment/forcecage/prismatic/bane/bless/... one-field its → registry
// census below (golden-once #820: iterate the REAL registry, never hand-type).
// old→new: all single-field toContain/toBe its → exact folded rows below.
import { describe, it, expect } from 'vitest';
import { computeConditionEffects } from './conditionEffects.js';
import { TARGET_EFFECT_DEFINITIONS } from './targetEffectDefinitions.js';

// Engine default byte-shape — the census baseline (same pattern as base :72).
const DEFAULTS = computeConditionEffects();
const folded = (options) => {
  const result = computeConditionEffects(options);
  return Object.fromEntries(
    Object.entries(result).filter(([k, v]) => JSON.stringify(v) !== JSON.stringify(DEFAULTS[k])),
  );
};

// ---------------------------------------------------------------------------
// saveModifier folds — applyConditionSaveModifier keyword channel +
// applySaveModifiers/applyTargetModifiers fold math (per #998: reroll /
// lucky_point / specialEffects tables are owned HERE, preserved as a census).
// ---------------------------------------------------------------------------

describe('computeConditionEffects — saveModifier folds (exact diff vs defaults)', () => {
  const adv = (o = {}) => ({ target: 'saving_throw', effect: 'advantage', ...o });
  const dis = (o = {}) => ({ target: 'saving_throw', effect: 'disadvantage', ...o });
  it.each([
    // Keyword channel (:134): the label rides the bucket; applySaveModifiers
    // is suppressed for CONDITION_KEYWORDS so counts stay untouched.
    ['charmed + advantage (condition leg folds too)', { conditions: ['charmed'], saveModifiers: [adv({ condition: 'charmed' })] }, { attackDisadvantageCount: 1, saveAdvantage: ['charmed'], saveDisadvantage: ['dex'] }],
    ['charmed + disadvantage', { conditions: ['charmed'], saveModifiers: [dis({ condition: 'charmed' })] }, { attackDisadvantageCount: 1, saveDisadvantage: ['charmed', 'dex'] }],
    ['frightened + disadvantage', { conditions: ['frightened'], saveModifiers: [dis({ condition: 'frightened' })] }, { attackDisadvantageCount: 1, abilityCheckDisadvantage: true, saveDisadvantage: ['frightened'] }],
    ['poison label maps to poisoned', { conditions: ['poisoned'], saveModifiers: [adv({ condition: 'poison' })] }, { attackDisadvantageCount: 1, abilityCheckDisadvantage: true, saveAdvantage: ['poisoned'] }],
    ['poison label + disadvantage', { conditions: ['poisoned'], saveModifiers: [dis({ condition: 'poison' })] }, { attackDisadvantageCount: 1, abilityCheckDisadvantage: true, saveDisadvantage: ['poisoned'] }],
    ['against_spell labels the bucket but never bumps the count', { saveModifiers: [adv({ condition: 'against_spell' })] }, { saveAdvantage: ['against_spell'] }],
    ['against_spell disadvantage — same count guard', { saveModifiers: [dis({ condition: 'against_spell' })] }, { saveDisadvantage: ['against_spell'] }],
    ['magic + abilities tracks per-ability, not count', { saveModifiers: [adv({ condition: 'magic', abilities: ['DEX'] })] }, { saveAdvantageAbilities: ['DEX'] }],
    ['magic + abilities disadvantage', { saveModifiers: [dis({ condition: 'magic', abilities: ['CON', 'WIS'] })] }, { saveDisadvantageAbilities: ['CON', 'WIS'] }],
    // visible_effect suppression (Danger Sense): dropped only while an
    // action-stealing condition is active; siblings still fold (:71).
    ['visible_effect suppressed when incapacitated, sibling survives', { conditions: ['incapacitated'], saveModifiers: [adv({ condition: 'visible_effect' }), adv()] }, { cannotAct: true, concentrationBroken: true, saveAdvantageCount: 1 }],
    ['visible_effect applies when not incapacitated', { saveModifiers: [adv({ condition: 'visible_effect' })] }, { saveAdvantageCount: 1 }],
    // Plain + attack-target counts
    ['plain save advantage bumps count only', { saveModifiers: [adv()] }, { saveAdvantageCount: 1 }],
    ['plain save disadvantage bumps count only', { saveModifiers: [dis()] }, { saveDisadvantageCount: 1 }],
    ['ability-tagged save disadvantage tracks abilities, not count', { saveModifiers: [dis({ abilities: ['CON', 'WIS'] })] }, { saveDisadvantageAbilities: ['CON', 'WIS'] }],
    ['attack_rolls advantage', { saveModifiers: [{ target: 'attack_rolls', effect: 'advantage' }] }, { attackAdvantageCount: 1 }],
    ['attack_rolls disadvantage', { saveModifiers: [{ target: 'attack_rolls', effect: 'disadvantage' }] }, { attackDisadvantageCount: 1 }],
    // Reroll family
    ['reroll on saving_throw arms saves only, stamps condition + bonus', { saveModifiers: [{ target: 'saving_throw', effect: 'reroll', condition: 'favored_enemy', bonusExpression: '+5' }] }, { autoRerollForSaves: true, autoRerollCondition: 'favored_enemy', autoRerollBonus: '+5' }],
    ['CLA-216: d20 reroll on roll_equals_1 arms attacks + checks + saves', { saveModifiers: [{ target: 'd20', effect: 'reroll', condition: 'roll_equals_1' }] }, { autoRerollForChecks: true, autoRerollForSaves: true, autoRerollForAttack: true, autoRerollCondition: 'roll_equals_1' }],
    ['CLA-216: d20 reroll with another condition leaves attack unarmed', { saveModifiers: [{ target: 'd20', effect: 'reroll', condition: 'convert_miss_to_hit' }] }, { autoRerollForChecks: true, autoRerollForSaves: true, autoRerollCondition: 'convert_miss_to_hit' }],
    // STR replacement routes by target (:358 gate on saveType STR)
    ['STR replacement on saving_throw sets strSaveReplace only', { saveModifiers: [{ target: 'saving_throw', effect: 'replacement', saveType: 'STR' }] }, { strSaveReplace: true }],
    ['STR replacement on check sets strCheckReplace only', { saveModifiers: [{ target: 'check', effect: 'replacement', saveType: 'STR' }] }, { strCheckReplace: true }],
    ['wis_replacement stamps flag + abilities', { saveModifiers: [{ target: 'check', effect: 'wis_replacement', abilities: ['CHA'] }] }, { wisCheckReplace: true, wisCheckReplaceAbilities: ['CHA'] }],
    ['tactical_mind carries its bonus expression', { saveModifiers: [{ target: 'saving_throw', effect: 'tactical_mind', bonusExpression: 'int_level' }] }, { tacticalMind: true, tacticalMindBonus: 'int_level' }],
    // lucky_point rides its own effectType channel — the adv/dis counters
    // never move (honest exact diff replaces the old single-field toBe).
    ['lucky_point effectType advantage arms luckyAdvantage only', { saveModifiers: [{ target: 'saving_throw', effect: 'lucky_point', effectType: 'advantage' }] }, { luckyAdvantage: true }],
    ['lucky_point effectType disadvantage arms luckyDisadvantage only', { saveModifiers: [{ target: 'saving_throw', effect: 'lucky_point', effectType: 'disadvantage' }] }, { luckyDisadvantage: true }],
    ['modify_d20_roll with explicit dice', { saveModifiers: [{ target: 'saving_throw', effect: 'modify_d20_roll', diceExpression: '2d6', canBeBonusOrPenalty: true }] }, { modifyD20Roll: true, modifyD20RollDice: '2d6', modifyD20RollCanBeBonusOrPenalty: true }],
    ['modify_d20_roll defaults to 2d4', { saveModifiers: [{ target: 'saving_throw', effect: 'modify_d20_roll' }] }, { modifyD20Roll: true, modifyD20RollDice: '2d4' }],
    ['pass_without_trace default bonus 10', { saveModifiers: [{ target: 'saving_throw', effect: 'pass_without_trace' }] }, { passWithoutTraceBonus: '10' }],
    ['pass_without_trace explicit bonus', { saveModifiers: [{ target: 'saving_throw', effect: 'pass_without_trace', bonusExpression: '+5' }] }, { passWithoutTraceBonus: '+5' }],
    ['str_check_disadvantage', { saveModifiers: [{ target: 'check', effect: 'str_check_disadvantage' }] }, { strCheckDisadvantage: true }],
    ['ray_of_enfeeble_damage_reduction', { saveModifiers: [{ target: 'saving_throw', effect: 'ray_of_enfeeble_damage_reduction' }] }, { rayOfEnfeebleDamageReduction: true }],
    // Single-flag specialEffects table (owned here per #998) — one row each
    ['reliable_talent', { saveModifiers: [{ target: 'saving_throw', effect: 'reliable_talent' }] }, { reliableTalent: true }],
    ['stroke_of_luck', { saveModifiers: [{ target: 'saving_throw', effect: 'stroke_of_luck' }] }, { strokeOfLuck: true }],
    ['d20_floor_10', { saveModifiers: [{ target: 'saving_throw', effect: 'd20_floor_10' }] }, { d20Floor10: true }],
    ['no_advantage_against', { saveModifiers: [{ target: 'saving_throw', effect: 'no_advantage_against' }] }, { noAdvantageAgainst: true }],
    ['dark_ones_luck', { saveModifiers: [{ target: 'saving_throw', effect: 'dark_ones_luck' }] }, { darkOnesLuck: true }],
    ['portent', { saveModifiers: [{ target: 'saving_throw', effect: 'portent' }] }, { portent: true }],
    ['improved_illusions', { saveModifiers: [{ target: 'saving_throw', effect: 'improved_illusions' }] }, { improvedIllusions: true }],
    ['illusory_reality', { saveModifiers: [{ target: 'saving_throw', effect: 'illusory_reality' }] }, { illusoryReality: true }],
    ['potent_cantrip', { saveModifiers: [{ target: 'saving_throw', effect: 'potent_cantrip' }] }, { potentCantrip: true }],
    ['soulstitch_spells', { saveModifiers: [{ target: 'saving_throw', effect: 'soulstitch_spells' }] }, { soulstitchSpells: true }],
    // Peerless Athlete: skills route to the skill list; abilities are NOT
    // promoted to abilityCheckAdvantageAbilities (stays null → exact diff).
    ['peerless_athlete skills route, abilities suppressed', { saveModifiers: [
      { target: 'ability_check', condition: 'peerless_athlete', effect: 'advantage', abilities: ['STR'], skills: ['Athletics'] },
      { target: 'ability_check', condition: 'peerless_athlete', effect: 'advantage', abilities: ['DEX'], skills: ['Acrobatics'] },
    ], isPeerlessAthlete: true }, { peerlessAthleteAdvantageSkills: ['Athletics', 'Acrobatics'] }],
    ['deception_performance_checks stores both skills', { saveModifiers: [{ target: 'deception_performance_checks', condition: 'disguised', effect: 'advantage', ability: 'Charisma' }] }, { abilityCheckAdvantageSkills: ['Deception', 'Performance'] }],
    // CLA-295 restore_balance row dropped: identical fixture + pin lives in
    // restoreBalance.test.js :105-130 (never-passive is that file's lane).
  ])('%s', (_name, options, expected) => {
    expect(folded(options)).toEqual(expected);
  });
});

// ---------------------------------------------------------------------------
// Registry te census (#820): every GM-addable te key, granted bare
// ({ effect }), must fold EXACTLY the documented bytes (OVERRIDE) or nothing
// (default {}). Golden-once — iterate TARGET_EFFECT_DEFINITIONS, never
// hand-type. Unregistered keys have no handler at all: inertness pinned
// below (kept per #998, old :235).
// ---------------------------------------------------------------------------

describe('computeConditionEffects — registry te census (bare te, exact diff)', () => {
  // Bare-te folds that non-trivially stamp fields (handlers with fallbacks).
  const OVERRIDE = {
    slasher_enhanced_critical: { targetAttackDisadvantageCount: 1 },
    disadvantage_next_attack: { attackDisadvantageCount: 1 },
    next_attack_bonus: { riderAttackBonus: 5 },
    next_attack_advantage: { attackAdvantageCount: 1, attackAdvantageReasons: ['Next Attack Advantage'] },
    distracting_strike_advantage: { targetAdvantageCount: 1, targetAdvantageReasons: ['Next Attack Adv vs Target'] },
    disadvantage_attack_rolls: { attackDisadvantageCount: 1 },
    reckless_attack: { targetAdvantageCount: 1, targetAdvantageReasons: ['Reckless Attack'] },
    dodge: { targetDisadvantageCount: 1, saveAdvantage: ['dex'] }, // consumer matrix in base :191/:230; fold bytes pinned here
    escape_the_horde: { targetDisadvantageCount: 1 },
    multiattack_defense: { targetDisadvantageCount: 1 },
    no_opportunity_attacks: { riderCannotOpportunityAttack: true },
    no_reactions: { riderNoReactions: true },
    protection: { targetDisadvantageCount: 1 },
    advantage_abilities: { abilityCheckAdvantage: true },
    advantage_attacks: { attackAdvantageCount: 1 },
    advantage_saves: { saveAdvantageCount: 1 },
    bane_penalty: { banePenalty: true },
    bless_bonus: { blessBonus: true },
    // Footgun byte kept honest: handler creates the empty Disadvantage list
    // but addUniqueReason skips the undefined ability.
    hex_ability_check_disadvantage: { abilityCheckDisadvantageAbilities: [] },
    dex_save_disadvantage: { slowDexSaveDisadvantage: true, saveDisadvantage: ['dex'] },
    // #1373(b): newly registered Heroism companion te — bare fold pushes WIS +
    // count, reason falls back to 'Heroism' when the te carries no source.
    wisdom_save_advantage: { saveAdvantageAbilities: ['WIS'], saveAdvantageCount: 1, saveAdvantageReasons: ['Heroism'] },
    disadvantage_perception_checks: { abilityCheckDisadvantage: true },
    // Same empty-list footgun as the hex sibling (:528 creates before guard).
    enhance_ability: { abilityCheckAdvantageAbilities: [] },
    disadvantage_on_next_save: { riderSaveDisadvantage: true, saveDisadvantageCount: 1 },
    holy_aura: { targetDisadvantageCount: 1, saveAdvantageCount: 1, saveAdvantageReasons: ['Holy Aura'] },
    circle_of_power: { saveAdvantage: ['against_spell'], saveAdvantageReasons: ['Circle of Power'] },
    death_strike: { saveType: 'CON' },
    foresight: { attackAdvantageCount: 1, attackAdvantageReasons: ['Foresight'], saveAdvantageCount: 1, saveAdvantageReasons: ['Foresight'], abilityCheckAdvantage: true, abilityCheckAdvantageReasons: ['Foresight'], targetDisadvantageCount: 1 },
    blur: { targetDisadvantageCount: 1 },
    faerie_fire: { targetAdvantageCount: 1, noAdvantageAgainstInvisible: true },
    resistance_damage_reduction: { resistanceDamageReduction: true },
    beacon_of_hope: { beaconOfHope: true, saveAdvantageAbilities: ['WIS'], saveAdvantageReasons: ['Beacon of Hope'] },
    pass_without_trace_bonus: { passWithoutTraceBonus: '10' },
    ac_penalty: { acPenalty: 2 },
    // MA-0995: the passthrough writes NO value — consumer default 10 must
    // equal Hobgoblin Warlord Javelin RAW "−10 ft".
    speed_reduction: { speedReduction: 10 },
    // MA-1012: frozen_grip = speed_reduction numeric leg + no_reactions.
    frozen_grip: { speedReduction: 10, riderNoReactions: true },
    push: { pushEffect: true, pushDistance: 10 },
    speed_half: { speedHalved: true },
    attached: { attachedBy: 'Attacher' },
  };
  // Bare folds with the same shape are pinned in the owner file — skipped,
  // not weakened: marked_as_prey/pesky_swarm → animal-spirit.test.js :39/:48;
  // bolster_advantage → bolster.test.js :37; hex_save_disadvantage bare pushes
  // [undefined] (te always carries ability in production) — the CON face is
  // pinned in the parameterized-te table below.
  const COVERED_ELSEWHERE = ['marked_as_prey', 'pesky_swarm', 'bolster_advantage', 'hex_save_disadvantage'];
  const CENSUS = TARGET_EFFECT_DEFINITIONS.map(d => d.effect).filter(e => !COVERED_ELSEWHERE.includes(e));

  it.each(CENSUS)('%s', (effect) => {
    expect(folded({ targetEffects: [{ effect }] })).toEqual(OVERRIDE[effect] || {});
  });

  it('unregistered unknown te keys are inert — no crash, no byte moves (kept per #998)', () => {
    expect(folded({ targetEffects: [{ effect: 'unknown_repeat_save' }] })).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// Parameterized tes — folds that only appear when the te carries fields
// (source/value/saveType/vexTarget/senses) or hits a registry-skipped key.
// Exact diffs; MA tickets cited inline.
// ---------------------------------------------------------------------------

describe('computeConditionEffects — parameterized te folds (exact diff)', () => {
  it.each([
    ['next_attack_advantage with vexTarget routes to the vex channel', { targetEffects: [{ effect: 'next_attack_advantage', vexTarget: 'Goblin' }] }, { vexAdvantageTargets: ['Goblin'] }],
    ['taunting_step stamps attacksOtherDisadvantageSource (gate in combine file)', { targetEffects: [{ effect: 'taunting_step', source: 'Paladin' }] }, { attacksOtherDisadvantageSource: 'Paladin' }],
    ['compelled_duel stamps attacksOtherDisadvantageSource', { targetEffects: [{ effect: 'compelled_duel', source: 'Paladin' }] }, { attacksOtherDisadvantageSource: 'Paladin' }],
    ['damage_bonus stamps bonus + expression + type', { targetEffects: [{ effect: 'damage_bonus', value: 5, damageExpression: '2d6', damageType: 'fire' }] }, { riderAttackBonus: 5, riderDamageExpression: '2d6', riderDamageType: 'fire' }],
    ['prone_and_push folds push + prone', { targetEffects: [{ effect: 'prone_and_push', value: 5 }] }, { pushEffect: true, pushDistance: 5, proneEffect: true }],
    ['topple CON save (kept :308 per #998)', { targetEffects: [{ effect: 'topple', saveType: 'CON', saveDc: 14 }] }, { toppleEffect: true, saveType: 'CON', saveDc: 14, saveAbility: 'CON', conditionToApply: 'prone', conditionDuration: 'until_start_of_next_turn' }],
    ['generic saveType+condition stamps the five-slot bundle', { targetEffects: [{ saveType: 'DEX', condition: 'prone', saveDc: 15, saveAbility: 'DEX' }] }, { saveType: 'DEX', saveDc: 15, saveAbility: 'DEX', conditionToApply: 'prone', conditionDuration: 'until_start_of_next_turn' }],
    ['mass_fear carries range + frightened (kept :210 per #998)', { targetEffects: [{ effect: 'mass_fear', saveType: 'WIS', saveDc: 13, condition: 'frightened', range: '30_ft' }] }, { saveType: 'WIS', saveDc: 13, conditionToApply: 'frightened', conditionDuration: 'until_start_of_next_turn', massFearRange: '30_ft' }],
    ['mass_fear defaults frightened + 10_ft range', { targetEffects: [{ effect: 'mass_fear', saveType: 'WIS', saveDc: 13, condition: 'frightened' }] }, { saveType: 'WIS', saveDc: 13, conditionToApply: 'frightened', conditionDuration: 'until_start_of_next_turn', massFearRange: '10_ft' }],
    ['death_strike damageDoubled legs (CON default)', { targetEffects: [{ effect: 'death_strike', damageDoubled: true }] }, { saveType: 'CON', damageDoubled: true }],
    ['incapacitated+saveType = Hurl Through Hell (kept :228 per #998)', { targetEffects: [{ effect: 'incapacitated', saveType: 'WIS', saveDc: 15 }] }, { saveType: 'WIS', saveDc: 15, conditionToApply: 'incapacitated', conditionDuration: 'until_end_of_next_turn', hurlThroughHell: true }],
    ['CLA-053 clairvoyant both legs: attacker adv + attacker-side defender disadv (compute rows are ours per #997)', { targetEffects: [{ effect: 'clairvoyant_combatant', attackerAdvantage: true, defenderDisadvantage: true }] }, { targetAdvantageCount: 1, targetAdvantageReasons: ['Clairvoyant Combatant'], targetAttackDisadvantageCount: 1 }],
    // Senses guards: Blindsight/Truesight suppress the defender-disadv leg.
    ['foresight + blindsight → no target disadvantage leg', { targetEffects: [{ effect: 'foresight' }], attackerSenses: [{ name: 'Blindsight' }] }, { attackAdvantageCount: 1, attackAdvantageReasons: ['Foresight'], saveAdvantageCount: 1, saveAdvantageReasons: ['Foresight'], abilityCheckAdvantage: true, abilityCheckAdvantageReasons: ['Foresight'] }],
    ['blur + truesight → fully inert', { targetEffects: [{ effect: 'blur' }], attackerSenses: [{ name: 'Truesight' }] }, {}],
    ['MA-1012 frozen_grip honors explicit value', { targetEffects: [{ effect: 'frozen_grip', value: 15 }] }, { speedReduction: 15, riderNoReactions: true }],
    ['speed_reduction honors explicit value', { targetEffects: [{ effect: 'speed_reduction', value: 15 }] }, { speedReduction: 15 }],
    ['ac_penalty honors explicit value', { targetEffects: [{ effect: 'ac_penalty', value: 3 }] }, { acPenalty: 3 }],
    ['enhance_ability upper-cases the chosen ability', { targetEffects: [{ effect: 'enhance_ability', ability: 'stealth' }] }, { abilityCheckAdvantageAbilities: ['STEALTH'] }],
    ['hex_save_disadvantage lower-cases the chosen ability', { targetEffects: [{ effect: 'hex_save_disadvantage', ability: 'CON' }] }, { saveDisadvantage: ['con'], saveDisadvantageCount: 1 }],
    ['hex_ability_check_disadvantage passes the ability through', { targetEffects: [{ effect: 'hex_ability_check_disadvantage', ability: 'CON' }] }, { abilityCheckDisadvantageAbilities: ['CON'] }],
    ['advantage_attacks attributes the source (attribution exemplar)', { targetEffects: [{ effect: 'advantage_attacks', source: 'Bard' }] }, { attackAdvantageCount: 1, attackAdvantageReasons: ['Bard'] }],
    ['faerie_fire attributes the source', { targetEffects: [{ effect: 'faerie_fire', source: 'Cleric' }] }, { targetAdvantageCount: 1, targetAdvantageReasons: ['Cleric'], noAdvantageAgainstInvisible: true }],
    ['MA-1531 attached stamps attachedBy from source (darkmantle/stirge twin)', { targetEffects: [{ target: 'Bandit 1', effect: 'attached', source: 'Darkmantle 1' }] }, { attachedBy: 'Darkmantle 1' }],
    ['MA-1531 attached byte-identical consumer for Stirge', { targetEffects: [{ target: 'Bandit 1', effect: 'attached', source: 'Stirge 1' }] }, { attachedBy: 'Stirge 1' }],
  ])('%s', (_name, options, expected) => {
    expect(folded(options)).toEqual(expected);
  });
});
