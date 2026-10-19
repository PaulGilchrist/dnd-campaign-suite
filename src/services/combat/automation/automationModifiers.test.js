// @maintained-by-ai
// ── automationModifiers.test.js — collectSaveModifiers modifier-row lane ──
// Unit home for MODIFIER APPLICATION SEMANTICS of collectSaveModifiers
// (automationModifiers.js): roster normalization, SAVE_MODIFIER_BUILDERS
// registry dispatch, per-builder defaults/coercion at real operator sites
// (#959), and authored ordering. Modifier-row bytes are hand-derived
// literals, once — the collection loop is never re-run as oracle (#815/#710).
//
// Builder-vs-modifier split (#962): automationInfoBuilder/temp.test.js pins
// the INFO-envelope bytes for living_legend/holy_aura and cites THIS file as
// owner of their modifier rows; automationCollector.types.test.js owns
// type→rowType routing; conditions/conditionEffects*.test.js consume
// already-built rows. Emission of collectSaveModifiers rows lives HERE only.
//
// CLA-295 restore_balance is NOT tested here — it is covered more strongly
// (object, array, null, undefined) by conditions/restoreBalance.test.js.
// CLA-374 use_magic_device regression stays here as an unknown-type falsifier.
//
// Family map: d20 selection #938 · damage owners #940-#942 · popup piercer/
// savage modifier popups #942 · save envelope saveDc math #958 · coercion
// falsifiers on real operator sites only #959 · falsy survivors distinct #842.
//
// Old → new map (old file: 45 loose its → 4 its + 30-case exact table):
//   null/empty ×2 + 'skips null features' ×1 + 'only extracts type' ×1
//     + restore_balance ×2 + passive_rule misses ×2 + passive_immunity-absent
//     ×1 → one unbuildable-roster guard (1) · restore_balance legs REMOVED,
//     owned by conditions/restoreBalance.test.js ·
//   per-type default+custom its ×33 → one exact-bytes it.each per builder
//     type, default+custom passed as a 2-entry automation array (flattening
//     covered twice, no extra cases) ·
//   combat_stance ×4 → one mixed-list filter test pinning the \w{3}
//     regex guard, case-insensitive 'saves', and authored order ·
//   multiple-features ×4 → one composition test (order, flattening, skip) ·
//   NEW: 15 previously-uncovered builders (elder_champion … illusory_reality,
//     census-over-exists #781), abilities-beats-saveType precedence falsifier
//     at conditional_advantage/conditional_save_bonus, save→saving_throw alias.
import { describe, it, expect } from 'vitest'
import { collectSaveModifiers } from './automationModifiers.js'

const NAME = 'Test Feature'

describe('collectSaveModifiers', () => {
  it('returns [] for unbuildable rosters: nullish input, nullish features, missing automation, unknown types', () => {
    expect(collectSaveModifiers(null)).toEqual([])
    expect(collectSaveModifiers(undefined)).toEqual([])
    expect(collectSaveModifiers([])).toEqual([])
    expect(collectSaveModifiers([
      null,
      undefined,
      { name: 'No Automation' },
      { name: 'Null Auto', automation: null },
      { name: 'Damage', automation: { type: 'damage', damage: '1d6' } },
      { name: 'Use Magic Device', automation: { type: 'use_magic_device' } }, // CLA-374: stays dead
      { name: 'Bogus', automation: { type: 'totally_bogus_type' } },
    ])).toEqual([])
  })

  // One exact-byte case per SAVE_MODIFIER_BUILDERS type (#781 census).
  // Each automation array exercises the builder twice: bare (defaults/||/!!
  // legs) then fully-custom (pass-through legs), in authored order.
  it.each([
    ['conditional_advantage — abilities||saveType||[] precedence, skills||[] default',
      [
        { type: 'conditional_advantage', target: 'saving_throw', condition: 'frightened', effect: 'advantage' },
        { type: 'conditional_advantage', abilities: ['WIS'], saveType: 'dex', target: 'saving_throw', condition: 'invisible', effect: 'advantage', skills: ['perception'] },
      ],
      [
        { source: NAME, target: 'saving_throw', condition: 'frightened', effect: 'advantage', abilities: [], skills: [] },
        { source: NAME, target: 'saving_throw', condition: 'invisible', effect: 'advantage', abilities: ['WIS'], skills: ['perception'] },
      ]],
    ['conditional_disadvantage — default attack_roll target, save→saving_throw alias, abilities',
      [
        { type: 'conditional_disadvantage', condition: 'always' },
        { type: 'conditional_disadvantage', target: 'save', saveType: 'wis', condition: 'hex' },
        { type: 'conditional_disadvantage', target: 'attack_roll', abilities: ['DEX'], condition: 'prone' },
      ],
      [
        { source: NAME, target: 'attack_roll', condition: 'always', effect: 'disadvantage', abilities: [] },
        { source: NAME, target: 'saving_throw', condition: 'hex', effect: 'disadvantage', abilities: ['WIS'] },
        { source: NAME, target: 'attack_roll', condition: 'prone', effect: 'disadvantage', abilities: ['DEX'] },
      ]],
    ['auto_reroll — defaults then bonusExpression/oncePerRage pass-through',
      [
        { type: 'auto_reroll', target: 'death_saving_throws', condition: 'below_half_hp' },
        { type: 'auto_reroll', target: 'ability_check', condition: 'action_used', bonusExpression: '1d4', oncePerRage: true },
      ],
      [
        { source: NAME, target: 'death_saving_throws', condition: 'below_half_hp', effect: 'reroll', bonusExpression: '', oncePerRage: false },
        { source: NAME, target: 'ability_check', condition: 'action_used', effect: 'reroll', bonusExpression: '1d4', oncePerRage: true },
      ]],
    ['living_legend — save reroll row then CHA ability_check advantage row',
      { type: 'living_legend' },
      [
        { source: NAME, target: 'saving_throw', condition: 'living_legend_active', effect: 'reroll', bonusExpression: '' },
        { source: NAME, target: 'ability_check', condition: 'living_legend_active', effect: 'advantage', abilities: ['CHA'] },
      ]],
    ['conditional_replacement — saveType/replacementAbility || "" defaults then custom',
      [
        { type: 'conditional_replacement', target: 'saving_throw', condition: 'always' },
        { type: 'conditional_replacement', target: 'saving_throw', condition: 'charmed_or_frightened', saveType: 'con', replacementAbility: 'wis' },
      ],
      [
        { source: NAME, target: 'saving_throw', condition: 'always', effect: 'replacement', saveType: '', replacementAbility: '' },
        { source: NAME, target: 'saving_throw', condition: 'charmed_or_frightened', effect: 'replacement', saveType: 'con', replacementAbility: 'wis' },
      ]],
    ['tactical_mind — default ability_check then custom target',
      [
        { type: 'tactical_mind' },
        { type: 'tactical_mind', target: 'saving_throw', condition: 'expended_advantage', bonusExpression: '2' },
      ],
      [
        { source: NAME, target: 'ability_check', condition: '', effect: 'tactical_mind', bonusExpression: '' },
        { source: NAME, target: 'saving_throw', condition: 'expended_advantage', effect: 'tactical_mind', bonusExpression: '2' },
      ]],
    ['elder_champion', { type: 'elder_champion' },
      [{ source: NAME, target: 'saving_throw', condition: 'elder_champion_active', effect: 'disadvantage' }]],
    ['large_form', { type: 'large_form' },
      [{ source: NAME, target: 'ability_check', condition: 'large_form_active', effect: 'advantage', abilities: ['STR'] }]],
    ['otherworldly_glamour', { type: 'otherworldly_glamour' },
      [{ source: NAME, target: 'ability_check', condition: 'otherworldly_glamour', effect: 'wis_replacement', abilities: ['CHA'] }]],
    ['reliable_talent', { type: 'reliable_talent' },
      [{ source: NAME, target: 'ability_check', condition: '', effect: 'reliable_talent' }]],
    ['second_storywork', { type: 'second_storywork' },
      [{ source: NAME, target: 'ability_check', condition: '', effect: 'dex_jump' }]],
    ['stroke_of_luck — default d20 then custom target',
      [
        { type: 'stroke_of_luck' },
        { type: 'stroke_of_luck', target: 'attack_roll' },
      ],
      [
        { source: NAME, target: 'd20', condition: '', effect: 'stroke_of_luck' },
        { source: NAME, target: 'attack_roll', condition: '', effect: 'stroke_of_luck' },
      ]],
    ['bardic_inspiration_use — default d20 then custom target',
      [
        { type: 'bardic_inspiration_use' },
        { type: 'bardic_inspiration_use', target: 'saving_throw' },
      ],
      [
        { source: NAME, target: 'd20', condition: '', effect: 'bardic_inspiration' },
        { source: NAME, target: 'saving_throw', condition: '', effect: 'bardic_inspiration' },
      ]],
    ['modify_d20_roll — 2d4/||false defaults then modifier/!!true custom',
      [
        { type: 'modify_d20_roll' },
        { type: 'modify_d20_roll', target: 'ability_check', modifier: '2d6', canBeBonusOrPenalty: true },
      ],
      [
        { source: NAME, target: 'd20', condition: '', effect: 'modify_d20_roll', diceExpression: '2d4', canBeBonusOrPenalty: false },
        { source: NAME, target: 'ability_check', condition: '', effect: 'modify_d20_roll', diceExpression: '2d6', canBeBonusOrPenalty: true },
      ]],
    ['passive_immunity — absent guard, saveType/condition || "" defaults',
      [
        { type: 'passive_immunity' },
        { type: 'passive_immunity', save_advantage: [{ saveType: 'con' }, { saveType: 'cha', condition: 'frightened' }] },
      ],
      [
        { source: NAME, target: 'saving_throw', condition: '', effect: 'advantage', saveType: 'con' },
        { source: NAME, target: 'saving_throw', condition: 'frightened', effect: 'advantage', saveType: 'cha' },
      ]],
    ['trance_of_order — no_advantage_against row then d20_floor_10 row',
      { type: 'trance_of_order' },
      [
        { source: NAME, target: 'attack_roll', condition: 'trance_of_order_active', effect: 'no_advantage_against' },
        { source: NAME, target: 'd20', condition: 'trance_of_order_active', effect: 'd20_floor_10' },
      ]],
    ['dark_ones_luck — saving_throw row then ability_check row',
      { type: 'dark_ones_luck' },
      [
        { source: NAME, target: 'saving_throw', condition: '', effect: 'dark_ones_luck' },
        { source: NAME, target: 'ability_check', condition: '', effect: 'dark_ones_luck' },
      ]],
    ['clairvoyant_combatant', { type: 'clairvoyant_combatant' },
      [{ source: NAME, target: 'attack_roll', condition: 'clairvoyant_combatant_active', effect: 'disadvantage' }]],
    ['potent_cantrip', { type: 'potent_cantrip' },
      [{ source: NAME, target: 'saving_throw', condition: '', effect: 'potent_cantrip' }]],
    ['soulstitch_spells', { type: 'soulstitch_spells' },
      [{ source: NAME, target: 'saving_throw', condition: '', effect: 'soulstitch_spells' }]],
    ['empowered_evocation', { type: 'empowered_evocation' },
      [{ source: NAME, target: 'damage', condition: '', effect: 'empowered_evocation' }]],
    ['overchannel', { type: 'overchannel' },
      [{ source: NAME, target: 'damage', condition: '', effect: 'overchannel' }]],
    ['conditional_save_bonus — bonusExpression || "0" default, abilities beats saveType',
      [
        { type: 'conditional_save_bonus', target: 'saving_throw', condition: 'shape_shift' },
        { type: 'conditional_save_bonus', abilities: ['CON'], saveType: 'dex', target: 'saving_throw', condition: 'shape_shift', bonusExpression: 'wisdom_modifier' },
      ],
      [
        { source: NAME, target: 'saving_throw', condition: 'shape_shift', effect: 'save_bonus', abilities: [], bonusExpression: '0' },
        { source: NAME, target: 'saving_throw', condition: 'shape_shift', effect: 'save_bonus', abilities: ['CON'], bonusExpression: 'wisdom_modifier' },
      ]],
    ['protection_from_poison', { type: 'protection_from_poison' },
      [{ source: NAME, target: 'saving_throw', condition: 'protection_from_poison_active', effect: 'advantage' }]],
    ['holy_aura — attack_roll disadvantage first, then saving_throw advantage (push order, #962 split)',
      { type: 'holy_aura' },
      [
        { source: NAME, target: 'attack_roll', condition: 'holy_aura_active', effect: 'disadvantage' },
        { source: NAME, target: 'saving_throw', condition: 'holy_aura_active', effect: 'advantage' },
      ]],
    ['portent', { type: 'portent' },
      [{ source: NAME, target: 'd20', condition: '', effect: 'portent' }]],
    ['improved_illusions', { type: 'improved_illusions' },
      [{ source: NAME, target: 'spell_component', condition: '', effect: 'improved_illusions' }]],
    ['illusory_reality', { type: 'illusory_reality' },
      [{ source: NAME, target: 'spell_component', condition: '', effect: 'illusory_reality' }]],
    ['passive_rule — only concentration_disadvantage_on_damage_dealt emits',
      [
        { type: 'passive_rule', effect: 'spell_breaker', dispelAbilityCheckBonus: 'proficiency_bonus' },
        { type: 'passive_rule', effect: 'something_else' },
        { type: 'passive_rule', effect: 'concentration_disadvantage_on_damage_dealt' },
      ],
      [{ source: NAME, target: 'saving_throw', condition: 'concentration_breaker', effect: 'disadvantage', abilities: ['CON'] }]],
  ])('%s', (_label, automation, expected) => {
    expect(collectSaveModifiers([{ name: NAME, automation }])).toEqual(expected)
  })

  it('combat_stance keeps only "<ABC> saves" entries, in authored order', () => {
    const result = collectSaveModifiers([{
      name: NAME,
      automation: {
        type: 'combat_stance',
        advantages: ['CON saves', 'STR checks', 'melee attacks', 'ST saves', 'WIS saves', 'cha saves'],
      },
    }])
    expect(result).toEqual([
      { source: NAME, target: 'saving_throw', condition: 'stance_active', effect: 'advantage', abilities: ['CON'] },
      { source: NAME, target: 'saving_throw', condition: 'stance_active', effect: 'advantage', abilities: ['WIS'] },
      { source: NAME, target: 'saving_throw', condition: 'stance_active', effect: 'advantage', abilities: ['CHA'] },
    ])
  })

  it('auto_reroll on a feature named Disciplined Survivor derives its condition from the name', () => {
    const result = collectSaveModifiers([
      { name: 'Disciplined Survivor', automation: { type: 'auto_reroll', target: 'saving_throw' } },
    ])
    expect(result).toEqual([{
      source: 'Disciplined Survivor',
      target: 'saving_throw',
      condition: 'disciplined_survivor',
      effect: 'reroll',
      bonusExpression: '',
      oncePerRage: false,
    }])
  })

  it('composes multi-feature rosters in authored order, flattening automation arrays and skipping nullish features', () => {
    const result = collectSaveModifiers([
      null,
      { name: 'Danger Sense', automation: { type: 'conditional_advantage', abilities: ['DEX'], target: 'saving_throw', condition: 'invisible', effect: 'advantage' } },
      { name: 'Berserker Stance', automation: { type: 'combat_stance', advantages: ['CON saves'] } },
      { name: 'Multi Power', automation: [
        { type: 'auto_reroll', target: 'death_saving_throws', condition: 'below_half_hp' },
        { type: 'holy_aura' },
      ] },
      { name: 'Silent', automation: { type: 'damage', damage: '1d6' } },
    ])
    expect(result.map(m => `${m.source}:${m.target}:${m.effect}`)).toEqual([
      'Danger Sense:saving_throw:advantage',
      'Berserker Stance:saving_throw:advantage',
      'Multi Power:death_saving_throws:reroll',
      'Multi Power:attack_roll:disadvantage',
      'Multi Power:saving_throw:advantage',
    ])
  })
})
