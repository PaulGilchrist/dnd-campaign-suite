// @improved-by-ai
import { describe, it, expect } from 'vitest'

import {
  collectSaveModifiers,
  getEvasionEffects,
  getAllSaveProficiencies,
} from './automationService.js'
import { makeFeature, makePlayerStats } from './automationService.fixtures.js'

// ── collectSaveModifiers ──────────────────────────────────────────
describe('collectSaveModifiers', () => {
  describe('null/undefined/empty handling', () => {
    it('returns empty array when features is null', () => {
      expect(collectSaveModifiers(null)).toEqual([])
    })

    it('returns empty array when features is undefined', () => {
      expect(collectSaveModifiers(undefined)).toEqual([])
    })

    it('returns empty array when features is an empty array', () => {
      expect(collectSaveModifiers([])).toEqual([])
    })
  })

  describe('null/undefined feature safety', () => {
    it('skips null feature in features array', () => {
      const features = [
        null,
        makeFeature({ type: 'conditional_advantage', abilities: ['DEX'] }, 'Valid'),
      ]
      const result = collectSaveModifiers(features)
      expect(result).toHaveLength(1)
      expect(result[0].source).toBe('Valid')
    })

    it('skips undefined feature in features array', () => {
      const features = [
        undefined,
        makeFeature({ type: 'conditional_advantage', abilities: ['DEX'] }, 'Valid'),
      ]
      const result = collectSaveModifiers(features)
      expect(result).toHaveLength(1)
      expect(result[0].source).toBe('Valid')
    })

    it('skips feature with null automation', () => {
      const features = [makeFeature(null, 'No Auto')]
      expect(collectSaveModifiers(features)).toEqual([])
    })

    it('skips feature with undefined automation', () => {
      const features = [makeFeature(undefined, 'No Auto')]
      expect(collectSaveModifiers(features)).toEqual([])
    })
  })

  describe('conditional_advantage', () => {
    it('extracts modifier with explicit abilities array', () => {
      const features = [makeFeature({
        type: 'conditional_advantage',
        abilities: ['STR', 'DEX'],
        condition: 'rage_active',
        effect: 'advantage',
      }, 'Danger Sense')]
      const result = collectSaveModifiers(features)
      expect(result).toEqual([{
        source: 'Danger Sense',
        target: undefined,
        condition: 'rage_active',
        effect: 'advantage',
        abilities: ['STR', 'DEX'],
      }])
    })

    it('derives abilities from saveType when abilities not provided', () => {
      const features = [makeFeature({
        type: 'conditional_advantage',
        saveType: 'DEX',
      }, 'Evasion')]
      const result = collectSaveModifiers(features)
      expect(result[0].abilities).toEqual(['DEX'])
    })

    it('uppercases saveType when deriving abilities', () => {
      const features = [makeFeature({
        type: 'conditional_advantage',
        saveType: 'dex',
      }, 'Evasion')]
      const result = collectSaveModifiers(features)
      expect(result[0].abilities).toEqual(['DEX'])
    })

    it('uses empty abilities when neither abilities nor saveType provided', () => {
      const features = [makeFeature({
        type: 'conditional_advantage',
        condition: 'always',
      }, 'Generic')]
      const result = collectSaveModifiers(features)
      expect(result[0].abilities).toEqual([])
    })

    it('extracts from automation array with mixed types', () => {
      const features = [makeFeature([{
        type: 'conditional_advantage',
        abilities: ['WIS'],
        effect: 'advantage',
      }, {
        type: 'damage',
        damage: '1d6',
      }], 'Multi')]
      const result = collectSaveModifiers(features)
      expect(result).toHaveLength(1)
      expect(result[0].abilities).toEqual(['WIS'])
    })
  })

  describe('conditional_disadvantage', () => {
    it('extracts saving_throw disadvantage when target is saving_throw', () => {
      const features = [makeFeature({
        type: 'conditional_disadvantage',
        target: 'saving_throw',
        abilities: ['CON'],
        condition: 'frightened',
      }, 'Frightened Saves')]
      const result = collectSaveModifiers(features)
      expect(result).toHaveLength(1)
      expect(result[0].target).toBe('saving_throw')
      expect(result[0].effect).toBe('disadvantage')
      expect(result[0].abilities).toEqual(['CON'])
    })

    it('extracts non-save disadvantage when target is not saving_throw', () => {
      const features = [makeFeature({
        type: 'conditional_disadvantage',
        target: 'attack_roll',
        abilities: ['DEX'],
        condition: 'invisible',
      }, 'Blind Attackers')]
      const result = collectSaveModifiers(features)
      expect(result).toHaveLength(1)
      expect(result[0].target).toBe('attack_roll')
      expect(result[0].effect).toBe('disadvantage')
    })

    it('defaults target to attack_roll when not specified', () => {
      const features = [makeFeature({
        type: 'conditional_disadvantage',
        condition: 'always',
      }, 'Default Target')]
      const result = collectSaveModifiers(features)
      expect(result[0].target).toBe('attack_roll')
    })

    it('derives abilities from saveType for saving_throw target', () => {
      const features = [makeFeature({
        type: 'conditional_disadvantage',
        saveType: 'INT',
      }, 'Int Saves')]
      const result = collectSaveModifiers(features)
      expect(result[0].abilities).toEqual(['INT'])
      expect(result[0].target).toBe('attack_roll')
    })
  })

  describe('combat_stance', () => {
    it('extracts save advantage from single stance advantage entry', () => {
      const features = [makeFeature({
        type: 'combat_stance',
        advantages: ['STR saves'],
      }, 'Berserker Stance')]
      const result = collectSaveModifiers(features)
      expect(result).toEqual([{
        source: 'Berserker Stance',
        target: 'saving_throw',
        condition: 'stance_active',
        effect: 'advantage',
        abilities: ['STR'],
      }])
    })

    it('extracts save advantages from multiple stance entries', () => {
      const features = [makeFeature({
        type: 'combat_stance',
        advantages: ['CON saves', 'WIS saves'],
      }, 'Dual Stance')]
      const result = collectSaveModifiers(features)
      expect(result).toHaveLength(2)
      expect(result[0].abilities).toEqual(['CON'])
      expect(result[1].abilities).toEqual(['WIS'])
    })

    it('skips non-save stance entries (checks)', () => {
      const features = [makeFeature({
        type: 'combat_stance',
        advantages: ['STR checks', 'DEX checks'],
      }, 'Check Stance')]
      expect(collectSaveModifiers(features)).toEqual([])
    })

    it('skips stance without advantages property', () => {
      const features = [makeFeature({
        type: 'combat_stance',
      }, 'Empty Stance')]
      expect(collectSaveModifiers(features)).toEqual([])
    })

    it('extracts only save entries from mixed stance advantages', () => {
      const features = [makeFeature({
        type: 'combat_stance',
        advantages: ['CON saves', 'melee attacks', 'WIS saves'],
      }, 'Mixed Stance')]
      const result = collectSaveModifiers(features)
      expect(result).toHaveLength(2)
      expect(result[0].abilities).toEqual(['CON'])
      expect(result[1].abilities).toEqual(['WIS'])
    })

    it('handles lowercase ability codes in stance advantages', () => {
      const features = [makeFeature({
        type: 'combat_stance',
        advantages: ['cha saves'],
      }, 'Lowercase Stance')]
      const result = collectSaveModifiers(features)
      expect(result[0].abilities).toEqual(['CHA'])
    })

    it('rejects two-letter ability codes', () => {
      const features = [makeFeature({
        type: 'combat_stance',
        advantages: ['ST saves'],
      }, 'Short Code')]
      expect(collectSaveModifiers(features)).toEqual([])
    })
  })

  describe('auto_reroll', () => {
    it('extracts basic auto_reroll modifier', () => {
      const features = [makeFeature({
        type: 'auto_reroll',
        condition: 'nat1',
        bonusExpression: '!d20',
      }, 'Reroll Master')]
      const result = collectSaveModifiers(features)
      expect(result).toEqual([{
        source: 'Reroll Master',
        target: undefined,
        condition: 'nat1',
        effect: 'reroll',
        bonusExpression: '!d20',
        oncePerRage: false,
      }])
    })

    it('extracts auto_reroll with oncePerRage flag', () => {
      const features = [makeFeature({
        type: 'auto_reroll',
        oncePerRage: true,
      }, 'Rage Reroll')]
      const result = collectSaveModifiers(features)
      expect(result[0].oncePerRage).toBe(true)
    })

    it('uses feature name condition for Disciplined Survivor', () => {
      const features = [makeFeature({
        type: 'auto_reroll',
      }, 'Disciplined Survivor')]
      const result = collectSaveModifiers(features)
      expect(result[0].condition).toBe('disciplined_survivor')
    })

    it('uses explicit condition over feature name for non-Disciplined Survivor', () => {
      const features = [makeFeature({
        type: 'auto_reroll',
        condition: 'custom',
      }, 'Other Feature')]
      const result = collectSaveModifiers(features)
      expect(result[0].condition).toBe('custom')
    })
  })

  describe('living_legend', () => {
    it('produces both saving_throw reroll and ability_check advantage modifiers', () => {
      const features = [makeFeature({
        type: 'living_legend',
      }, 'Living Legend')]
      const result = collectSaveModifiers(features)
      expect(result).toHaveLength(2)
      expect(result[0]).toEqual({
        source: 'Living Legend',
        target: 'saving_throw',
        condition: 'living_legend_active',
        effect: 'reroll',
        bonusExpression: '',
      })
      expect(result[1]).toEqual({
        source: 'Living Legend',
        target: 'ability_check',
        condition: 'living_legend_active',
        effect: 'advantage',
        abilities: ['CHA'],
      })
    })
  })

  describe('conditional_replacement', () => {
    it('extracts basic replacement modifier', () => {
      const features = [makeFeature({
        type: 'conditional_replacement',
        target: 'saving_throw',
        condition: 'charmed',
        saveType: 'con',
        replacementAbility: 'wis',
      }, 'Fey Ancestry')]
      const result = collectSaveModifiers(features)
      expect(result).toEqual([{
        source: 'Fey Ancestry',
        target: 'saving_throw',
        condition: 'charmed',
        effect: 'replacement',
        saveType: 'con',
        replacementAbility: 'wis',
      }])
    })

    it('defaults saveType and replacementAbility to empty strings', () => {
      const features = [makeFeature({
        type: 'conditional_replacement',
        target: 'saving_throw',
      }, 'Minimal')]
      const result = collectSaveModifiers(features)
      expect(result[0].saveType).toBe('')
      expect(result[0].replacementAbility).toBe('')
    })
  })

  describe('tactical_mind', () => {
    it('extracts tactical_mind modifier with defaults', () => {
      const features = [makeFeature({
        type: 'tactical_mind',
      }, 'Tactical Mind')]
      const result = collectSaveModifiers(features)
      expect(result).toEqual([{
        source: 'Tactical Mind',
        target: 'ability_check',
        condition: '',
        effect: 'tactical_mind',
        bonusExpression: '',
      }])
    })

    it('uses provided target and bonusExpression', () => {
      const features = [makeFeature({
        type: 'tactical_mind',
        target: 'd20',
        bonusExpression: '2d6',
        condition: 'focus_active',
      }, 'Tactical Mind')]
      const result = collectSaveModifiers(features)
      expect(result[0].target).toBe('d20')
      expect(result[0].bonusExpression).toBe('2d6')
      expect(result[0].condition).toBe('focus_active')
    })
  })

  describe('elder_champion', () => {
    it('produces saving_throw disadvantage modifier', () => {
      const features = [makeFeature({
        type: 'elder_champion',
      }, 'Elder Champion')]
      const result = collectSaveModifiers(features)
      expect(result).toEqual([{
        source: 'Elder Champion',
        target: 'saving_throw',
        condition: 'elder_champion_active',
        effect: 'disadvantage',
      }])
    })
  })

  describe('large_form', () => {
    it('produces STR ability_check advantage modifier', () => {
      const features = [makeFeature({
        type: 'large_form',
      }, 'Polymorph')]
      const result = collectSaveModifiers(features)
      expect(result).toEqual([{
        source: 'Polymorph',
        target: 'ability_check',
        condition: 'large_form_active',
        effect: 'advantage',
        abilities: ['STR'],
      }])
    })
  })

  describe('otherworldly_glamour', () => {
    it('produces CHA wis_replacement modifier for ability_check', () => {
      const features = [makeFeature({
        type: 'otherworldly_glamour',
      }, 'Otherworldly Glamour')]
      const result = collectSaveModifiers(features)
      expect(result).toEqual([{
        source: 'Otherworldly Glamour',
        target: 'ability_check',
        condition: 'otherworldly_glamour',
        effect: 'wis_replacement',
        abilities: ['CHA'],
      }])
    })
  })

  describe('reliable_talent', () => {
    it('produces ability_check reliable_talent modifier', () => {
      const features = [makeFeature({
        type: 'reliable_talent',
      }, 'Reliable Talent')]
      const result = collectSaveModifiers(features)
      expect(result).toEqual([{
        source: 'Reliable Talent',
        target: 'ability_check',
        condition: '',
        effect: 'reliable_talent',
      }])
    })
  })

  describe('second_storywork', () => {
    it('produces ability_check dex_jump modifier', () => {
      const features = [makeFeature({
        type: 'second_storywork',
      }, 'Second Storywork')]
      const result = collectSaveModifiers(features)
      expect(result).toEqual([{
        source: 'Second Storywork',
        target: 'ability_check',
        condition: '',
        effect: 'dex_jump',
      }])
    })
  })

  describe('stroke_of_luck', () => {
    it('produces d20 stroke_of_luck modifier with default target', () => {
      const features = [makeFeature({
        type: 'stroke_of_luck',
      }, 'Stroke of Luck')]
      const result = collectSaveModifiers(features)
      expect(result).toEqual([{
        source: 'Stroke of Luck',
        target: 'd20',
        condition: '',
        effect: 'stroke_of_luck',
      }])
    })

    it('uses custom target when provided', () => {
      const features = [makeFeature({
        type: 'stroke_of_luck',
        target: 'attack_roll',
      }, 'Stroke of Luck')]
      const result = collectSaveModifiers(features)
      expect(result[0].target).toBe('attack_roll')
    })
  })

  describe('modify_d20_roll', () => {
    it('produces modify_d20_roll modifier with default diceExpression', () => {
      const features = [makeFeature({
        type: 'modify_d20_roll',
      }, 'Modify Roll')]
      const result = collectSaveModifiers(features)
      expect(result).toEqual([{
        source: 'Modify Roll',
        target: 'd20',
        condition: '',
        effect: 'modify_d20_roll',
        diceExpression: '2d4',
        canBeBonusOrPenalty: false,
      }])
    })

    it('uses provided modifier and canBeBonusOrPenalty', () => {
      const features = [makeFeature({
        type: 'modify_d20_roll',
        modifier: '1d8',
        canBeBonusOrPenalty: true,
      }, 'Modify Roll')]
      const result = collectSaveModifiers(features)
      expect(result[0].diceExpression).toBe('1d8')
      expect(result[0].canBeBonusOrPenalty).toBe(true)
    })
  })

  describe('use_magic_device', () => {
    it('produces INT ability_check advantage modifier', () => {
      const features = [makeFeature({
        type: 'use_magic_device',
      }, 'Use Magic Device')]
      const result = collectSaveModifiers(features)
      expect(result).toEqual([{
        source: 'Use Magic Device',
        target: 'ability_check',
        condition: '',
        effect: 'advantage',
        abilities: ['INT'],
      }])
    })
  })

  describe('passive_immunity', () => {
    it('produces advantage modifiers for each saveAdvantage entry', () => {
      const features = [makeFeature({
        type: 'passive_immunity',
        saveAdvantage: [
          { saveType: 'POISON', condition: 'always' },
          { saveType: 'PSYCHIC' },
        ],
      }, 'Immune')]
      const result = collectSaveModifiers(features)
      expect(result).toHaveLength(2)
      expect(result[0]).toEqual({
        source: 'Immune',
        target: 'saving_throw',
        condition: 'always',
        effect: 'advantage',
        saveType: 'POISON',
      })
      expect(result[1]).toEqual({
        source: 'Immune',
        target: 'saving_throw',
        condition: '',
        effect: 'advantage',
        saveType: 'PSYCHIC',
      })
    })

    it('returns empty array when saveAdvantage is not present', () => {
      const features = [makeFeature({
        type: 'passive_immunity',
      }, 'Immune')]
      expect(collectSaveModifiers(features)).toEqual([])
    })
  })

  describe('restore_balance', () => {
    it('produces d20 restore_balance modifier with default target', () => {
      const features = [makeFeature({
        type: 'restore_balance',
      }, 'Restore Balance')]
      const result = collectSaveModifiers(features)
      expect(result).toEqual([{
        source: 'Restore Balance',
        target: 'd20',
        condition: '',
        effect: 'restore_balance',
      }])
    })
  })

  describe('transe_of_order', () => {
    it('produces attack_roll and d20 modifiers', () => {
      const features = [makeFeature({
        type: 'transe_of_order',
      }, 'Transe')]
      const result = collectSaveModifiers(features)
      expect(result).toHaveLength(2)
      expect(result[0]).toEqual({
        source: 'Transe',
        target: 'attack_roll',
        condition: 'transe_of_order_active',
        effect: 'no_advantage_against',
      })
      expect(result[1]).toEqual({
        source: 'Transe',
        target: 'd20',
        condition: '',
        effect: 'd20_floor_10',
      })
    })
  })

  describe('dark_ones_look', () => {
    it('produces saving_throw and ability_check modifiers', () => {
      const features = [makeFeature({
        type: 'dark_ones_look',
      }, 'Dark One\'s Look')]
      const result = collectSaveModifiers(features)
      expect(result).toHaveLength(2)
      expect(result[0].target).toBe('saving_throw')
      expect(result[1].target).toBe('ability_check')
    })
  })

  describe('clairvoyant_combatant', () => {
    it('produces attack_roll disadvantage modifier', () => {
      const features = [makeFeature({
        type: 'clairvoyant_combatant',
      }, 'Clairvoyant')]
      const result = collectSaveModifiers(features)
      expect(result).toEqual([{
        source: 'Clairvoyant',
        target: 'attack_roll',
        condition: 'clairvoyant_combatant_active',
        effect: 'disadvantage',
      }])
    })
  })

  describe('potent_cantrip', () => {
    it('produces saving_throw potent_cantrip modifier', () => {
      const features = [makeFeature({
        type: 'potent_cantrip',
      }, 'Potent Cantrip')]
      const result = collectSaveModifiers(features)
      expect(result).toEqual([{
        source: 'Potent Cantrip',
        target: 'saving_throw',
        condition: '',
        effect: 'potent_cantrip',
      }])
    })
  })

  describe('soulstitch_spells', () => {
    it('produces saving_throw soulstitch_spells modifier', () => {
      const features = [makeFeature({
        type: 'soulstitch_spells',
      }, 'Souls Stitch')]
      const result = collectSaveModifiers(features)
      expect(result).toEqual([{
        source: 'Souls Stitch',
        target: 'saving_throw',
        condition: '',
        effect: 'soulstitch_spells',
      }])
    })
  })

  describe('pass_without_trace', () => {
    it('produces ability_check pass_without_trace modifier with bonusExpression', () => {
      const features = [makeFeature({
        type: 'pass_without_trace',
      }, 'Pass Without Trace')]
      const result = collectSaveModifiers(features)
      expect(result).toEqual([{
        source: 'Pass Without Trace',
        target: 'ability_check',
        condition: 'pass_without_trace_active',
        effect: 'pass_without_trace',
        bonusExpression: '10',
      }])
    })
  })

  describe('empowered_evocation', () => {
    it('produces damage empowered_evocation modifier', () => {
      const features = [makeFeature({
        type: 'empowered_evocation',
      }, 'Empowered')]
      const result = collectSaveModifiers(features)
      expect(result).toEqual([{
        source: 'Empowered',
        target: 'damage',
        condition: '',
        effect: 'empowered_evocation',
      }])
    })
  })

  describe('overchannel', () => {
    it('produces damage overchannel modifier', () => {
      const features = [makeFeature({
        type: 'overchannel',
      }, 'Overchannel')]
      const result = collectSaveModifiers(features)
      expect(result).toEqual([{
        source: 'Overchannel',
        target: 'damage',
        condition: '',
        effect: 'overchannel',
      }])
    })
  })

  describe('spell_breaker', () => {
    it('does not produce ability_check modifier (bonus handled in SpellDetailPopup)', () => {
      const features = [makeFeature({
        type: 'passive_rule',
        effect: 'spell_breaker',
        dispelAbilityCheckBonus: 'proficiency_bonus',
      }, 'Spell Breaker')]
      const result = collectSaveModifiers(features)
      expect(result).toEqual([])
    })

    it('does not produce modifier when effect is not spell_breaker', () => {
      const features = [makeFeature({
        type: 'passive_rule',
        effect: 'something_else',
      }, 'Not Breaker')]
      expect(collectSaveModifiers(features)).toEqual([])
    })
  })

  describe('concentration_disadvantage_on_damage_dealt', () => {
    it('produces CON saving_throw disadvantage modifier', () => {
      const features = [makeFeature({
        type: 'passive_rule',
        effect: 'concentration_disadvantage_on_damage_dealt',
      }, 'Concentration Focus')]
      const result = collectSaveModifiers(features)
      expect(result).toEqual([{
        source: 'Concentration Focus',
        target: 'saving_throw',
        condition: 'concentration_breaker',
        effect: 'disadvantage',
        abilities: ['CON'],
      }])
    })

    it('does not produce modifier when effect is different', () => {
      const features = [makeFeature({
        type: 'passive_rule',
        effect: 'other',
      }, 'Other')]
      expect(collectSaveModifiers(features)).toEqual([])
    })
  })

  describe('holy_aura', () => {
    it('produces attack_roll disadvantage and saving_throw advantage modifiers', () => {
      const features = [makeFeature({
        type: 'holy_aura',
      }, 'Holy Aura')]
      const result = collectSaveModifiers(features)
      expect(result).toHaveLength(2)
      expect(result[0]).toEqual({
        source: 'Holy Aura',
        target: 'attack_roll',
        condition: 'holy_aura_active',
        effect: 'disadvantage',
      })
      expect(result[1]).toEqual({
        source: 'Holy Aura',
        target: 'saving_throw',
        condition: 'holy_aura_active',
        effect: 'advantage',
      })
    })
  })

  describe('portent', () => {
    it('produces d20 portent modifier', () => {
      const features = [makeFeature({
        type: 'portent',
      }, 'Portent')]
      const result = collectSaveModifiers(features)
      expect(result).toEqual([{
        source: 'Portent',
        target: 'd20',
        condition: '',
        effect: 'portent',
      }])
    })
  })

  describe('improved_illusions', () => {
    it('produces spell_component improved_illusions modifier', () => {
      const features = [makeFeature({
        type: 'improved_illusions',
      }, 'Improved Illusions')]
      const result = collectSaveModifiers(features)
      expect(result).toEqual([{
        source: 'Improved Illusions',
        target: 'spell_component',
        condition: '',
        effect: 'improved_illusions',
      }])
    })
  })

  describe('illusory_reality', () => {
    it('produces spell_component illusory_reality modifier', () => {
      const features = [makeFeature({
        type: 'illusory_reality',
      }, 'Illusory Reality')]
      const result = collectSaveModifiers(features)
      expect(result).toEqual([{
        source: 'Illusory Reality',
        target: 'spell_component',
        condition: '',
        effect: 'illusory_reality',
      }])
    })
  })

  describe('protection_from_poison', () => {
    it('produces saving_throw advantage modifier with condition', () => {
      const features = [makeFeature({
        type: 'protection_from_poison',
      }, 'Protection From Poison')]
      const result = collectSaveModifiers(features)
      expect(result).toEqual([{
        source: 'Protection From Poison',
        target: 'saving_throw',
        condition: 'protection_from_poison_active',
        effect: 'advantage',
      }])
    })
  })

  describe('multiple features interaction', () => {
    it('collects modifiers from multiple features', () => {
      const features = [
        makeFeature({ type: 'conditional_advantage', abilities: ['DEX'] }, 'Danger Sense'),
        makeFeature({ type: 'auto_reroll', condition: 'nat1' }, 'Reroll Master'),
      ]
      const result = collectSaveModifiers(features)
      expect(result).toHaveLength(2)
      expect(result[0].source).toBe('Danger Sense')
      expect(result[1].source).toBe('Reroll Master')
    })

    it('collects multiple modifiers from a single feature with array of automations', () => {
      const features = [makeFeature([{
        type: 'conditional_advantage',
        abilities: ['DEX'],
        effect: 'advantage',
      }, {
        type: 'auto_reroll',
        condition: 'nat1',
      }], 'Multi Action')]
      const result = collectSaveModifiers(features)
      expect(result).toHaveLength(2)
      expect(result[0].effect).toBe('advantage')
      expect(result[1].effect).toBe('reroll')
    })

    it('collects from features with mixed valid and invalid automation types', () => {
      const features = [
        makeFeature({ type: 'conditional_advantage', abilities: ['STR'] }, 'Valid1'),
        makeFeature({ type: 'damage', damage: '1d6' }, 'Ignored'),
        makeFeature({ type: 'auto_reroll', condition: 'always' }, 'Valid2'),
      ]
      const result = collectSaveModifiers(features)
      expect(result).toHaveLength(2)
      expect(result[0].source).toBe('Valid1')
      expect(result[1].source).toBe('Valid2')
    })
  })
})

// ── getEvasionEffects ─────────────────────────────────────────────
describe('getEvasionEffects', () => {
  describe('null/empty handling', () => {
    it('returns empty array when features is null', () => {
      expect(getEvasionEffects(null)).toEqual([])
    })

    it('returns empty array when features is undefined', () => {
      expect(getEvasionEffects(undefined)).toEqual([])
    })

    it('returns empty array when features is empty', () => {
      expect(getEvasionEffects([])).toEqual([])
    })
  })

  describe('non-evasion feature filtering', () => {
    it('skips features without automation', () => {
      const features = [{ name: 'Passive', damageBonus: 2 }]
      expect(getEvasionEffects(features)).toEqual([])
    })

    it('skips features with non-evasion automation type', () => {
      const features = [makeFeature({ type: 'damage_bonus' }, 'Damage')]
      expect(getEvasionEffects(features)).toEqual([])
    })

    it('skips features with automation that is not evasion', () => {
      const features = [makeFeature({ type: 'conditional_advantage' }, 'Advantage')]
      expect(getEvasionEffects(features)).toEqual([])
    })
  })

  describe('basic evasion extraction', () => {
    it('returns evasion effect with default saveType DEX', () => {
      const features = [makeFeature({ type: 'evasion' }, 'Uncanny')]
      const result = getEvasionEffects(features)
      expect(result).toEqual([{
        source: 'Uncanny',
        saveType: 'DEX',
        shareable: false,
        shareRange: 0,
      }])
    })

    it('uses custom saveType when provided', () => {
      const features = [makeFeature({ type: 'evasion', saveType: 'CON' }, 'Evasion')]
      const result = getEvasionEffects(features)
      expect(result[0].saveType).toBe('CON')
    })

    it('uppercases saveType', () => {
      const features = [makeFeature({ type: 'evasion', saveType: 'wisdom' }, 'Evasion')]
      const result = getEvasionEffects(features)
      expect(result[0].saveType).toBe('WISDOM')
    })

    it('defaults shareable to false and shareRange to 0', () => {
      const features = [makeFeature({ type: 'evasion' }, 'Basic')]
      const result = getEvasionEffects(features)
      expect(result[0].shareable).toBe(false)
      expect(result[0].shareRange).toBe(0)
    })
  })

  describe('shareable evasion', () => {
    it('recognizes shareable evasion with range', () => {
      const features = [makeFeature({ type: 'evasion', shareable: true, shareRange: 30 }, 'Group Evasion')]
      const result = getEvasionEffects(features)
      expect(result).toEqual([{
        source: 'Group Evasion',
        saveType: 'DEX',
        shareable: true,
        shareRange: 30,
      }])
    })

    it('defaults shareRange to 0 when shareable is true but range not provided', () => {
      const features = [makeFeature({ type: 'evasion', shareable: true }, 'Share Only')]
      const result = getEvasionEffects(features)
      expect(result[0].shareRange).toBe(0)
    })
  })

  describe('multiple evasion effects', () => {
    it('collects evasion effects from different features', () => {
      const features = [
        makeFeature({ type: 'evasion', saveType: 'DEX' }, 'Evasion1'),
        makeFeature({ type: 'passive_rule' }, 'Not Evasion'),
        makeFeature({ type: 'evasion', saveType: 'WIS' }, 'Evasion2'),
      ]
      const result = getEvasionEffects(features)
      expect(result).toHaveLength(2)
      expect(result[0].source).toBe('Evasion1')
      expect(result[1].source).toBe('Evasion2')
    })

    it('collects multiple evasion automations from a single feature array', () => {
      const features = [makeFeature([
        { type: 'evasion', saveType: 'DEX' },
        { type: 'evasion', saveType: 'CON' },
      ], 'Double Evasion')]
      const result = getEvasionEffects(features)
      expect(result).toHaveLength(2)
      expect(result[0].saveType).toBe('DEX')
      expect(result[1].saveType).toBe('CON')
    })
  })
})

// ── getAllSaveProficiencies with save_proficiency ─────────────────
describe('getAllSaveProficiencies', () => {
  describe('null handling', () => {
    it('returns all six save types when features is null', () => {
      const result = getAllSaveProficiencies(null)
      expect(result).toEqual(['Strength', 'Dexterity', 'Constitution', 'Intelligence', 'Wisdom', 'Charisma'])
    })

    it('returns all six save types when features is undefined', () => {
      const result = getAllSaveProficiencies(undefined)
      expect(result).toEqual(['Strength', 'Dexterity', 'Constitution', 'Intelligence', 'Wisdom', 'Charisma'])
    })

    it('returns empty array when features is empty', () => {
      const result = getAllSaveProficiencies([])
      expect(result).toEqual([])
    })
  })

  describe('auto_reroll targeting saving_throw', () => {
    it('grants all save proficiencies when auto_reroll targets saving_throw', () => {
      const features = [makeFeature({
        type: 'auto_reroll',
        target: 'saving_throw',
      }, 'Reroll All Saves')]
      const result = getAllSaveProficiencies(features)
      expect(result).toEqual(['Strength', 'Dexterity', 'Constitution', 'Intelligence', 'Wisdom', 'Charisma'])
    })

    it('does not grant all saves when auto_reroll targets something else', () => {
      const features = [makeFeature({
        type: 'auto_reroll',
        target: 'd20',
      }, 'Reroll D20')]
      const result = getAllSaveProficiencies(features)
      expect(result).toEqual([])
    })
  })

  describe('save_proficiency primary', () => {
    it('grants the primary save proficiency', () => {
      const features = [
        makeFeature(
          { type: 'save_proficiency', saveType: 'Wisdom', fallbackTypes: ['Intelligence', 'Charisma'] },
          'Iron Mind',
        ),
      ]
      const result = getAllSaveProficiencies(features)
      expect(result).toEqual(['Wisdom'])
    })

    it('normalizes saveType casing', () => {
      const features = [
        makeFeature(
          { type: 'save_proficiency', saveType: 'wisdom' },
          'Iron Mind',
        ),
      ]
      const result = getAllSaveProficiencies(features)
      expect(result).toEqual(['Wisdom'])
    })

    it('handles saveType with all lowercase', () => {
      const features = [
        makeFeature(
          { type: 'save_proficiency', saveType: 'strength' },
          'Strong Mind',
        ),
      ]
      const result = getAllSaveProficiencies(features)
      expect(result).toEqual(['Strength'])
    })

    it('handles saveType with mixed case', () => {
      const features = [
        makeFeature(
          { type: 'save_proficiency', saveType: 'cHaRiSmA' },
          'Charisma Save',
        ),
      ]
      const result = getAllSaveProficiencies(features)
      expect(result).toEqual(['Charisma'])
    })
  })

  describe('save_proficiency fallback logic', () => {
    it('falls back to first available fallback when primary already has proficiency', () => {
      const playerStats = makePlayerStats({
        class: { name: 'Ranger', saving_throw_proficiencies: ['Dexterity', 'Wisdom'] },
      })
      const features = [
        makeFeature(
          { type: 'save_proficiency', saveType: 'Wisdom', fallbackTypes: ['Intelligence', 'Charisma'] },
          'Iron Mind',
        ),
      ]
      const result = getAllSaveProficiencies(features, playerStats)
      expect(result).toEqual(['Intelligence'])
    })

    it('falls through multiple fallbacks until finding one not already proficient', () => {
      const playerStats = makePlayerStats({
        class: { name: 'Ranger', saving_throw_proficiencies: ['Dexterity', 'Wisdom', 'Intelligence'] },
      })
      const features = [
        makeFeature(
          { type: 'save_proficiency', saveType: 'Wisdom', fallbackTypes: ['Intelligence', 'Charisma'] },
          'Iron Mind',
        ),
      ]
      const result = getAllSaveProficiencies(features, playerStats)
      expect(result).toEqual(['Charisma'])
    })

    it('uses result-set proficiency to avoid duplicates within same feature', () => {
      const features = [
        makeFeature(
          { type: 'save_proficiency', saveType: 'Wisdom', fallbackTypes: ['Wisdom', 'Charisma'] },
          'Duplicate Fallback',
        ),
      ]
      const result = getAllSaveProficiencies(features)
      expect(result).toEqual(['Wisdom'])
    })

    it('returns empty array when all options are already proficient', () => {
      const playerStats = makePlayerStats({
        class: { name: 'Paladin', saving_throw_proficiencies: ['Wisdom', 'Charisma'] },
      })
      const features = [
        makeFeature(
          { type: 'save_proficiency', saveType: 'Wisdom', fallbackTypes: ['Charisma'] },
          'No Fallback Left',
        ),
      ]
      const result = getAllSaveProficiencies(features, playerStats)
      expect(result).toEqual([])
    })
  })

  describe('multiple save_proficiency features', () => {
    it('combines proficiencies from multiple save_proficiency features', () => {
      const features = [
        makeFeature(
          { type: 'save_proficiency', saveType: 'Wisdom' },
          'Iron Mind',
        ),
        makeFeature(
          { type: 'save_proficiency', saveType: 'Charisma' },
          'Charm Mind',
        ),
      ]
      const result = getAllSaveProficiencies(features)
      expect(result).toEqual(['Wisdom', 'Charisma'])
    })

    it('deduplicates when same save appears in multiple features', () => {
      const features = [
        makeFeature(
          { type: 'save_proficiency', saveType: 'Wisdom' },
          'Iron Mind',
        ),
        makeFeature(
          { type: 'save_proficiency', saveType: 'wisdom' },
          'Second Iron Mind',
        ),
      ]
      const result = getAllSaveProficiencies(features)
      expect(result).toEqual(['Wisdom'])
    })
  })

  describe('mixed auto_reroll and save_proficiency', () => {
    it('combines auto_reroll all-saves with save_proficiency fallback', () => {
      const playerStats = makePlayerStats({
        class: { name: 'Ranger', saving_throw_proficiencies: ['Dexterity'] },
      })
      const features = [
        makeFeature({
          type: 'auto_reroll',
          target: 'saving_throw',
        }, 'Reroll All'),
        makeFeature(
          { type: 'save_proficiency', saveType: 'Wisdom', fallbackTypes: ['Charisma'] },
          'Iron Mind',
        ),
      ]
      const result = getAllSaveProficiencies(features, playerStats)
      expect(result).toEqual(['Strength', 'Dexterity', 'Constitution', 'Intelligence', 'Wisdom', 'Charisma'])
    })
  })
})
