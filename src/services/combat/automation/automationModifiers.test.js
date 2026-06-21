// @improved-by-ai
import { describe, it, expect } from 'vitest'
import { collectSaveModifiers } from './automationModifiers.js'

describe('collectSaveModifiers', () => {
  describe('null/empty handling', () => {
    it('returns empty array when features is null, undefined, or empty', () => {
      expect(collectSaveModifiers(null)).toEqual([])
      expect(collectSaveModifiers(undefined)).toEqual([])
      expect(collectSaveModifiers([])).toEqual([])
    })

    it('returns empty array when all features are null/undefined', () => {
      const features = [null, undefined, null]
      expect(collectSaveModifiers(features)).toEqual([])
    })

    it('returns empty array when features have no automation property', () => {
      const features = [
        { name: 'Rage', damageBonus: 2 },
        { name: 'Another' }
      ]
      expect(collectSaveModifiers(features)).toEqual([])
    })

    it('returns empty array when automation is null', () => {
      const features = [{ name: 'Some Feature', automation: null }]
      expect(collectSaveModifiers(features)).toEqual([])
    })
  })

  describe('conditional_advantage type', () => {
    it('extracts modifier from feature with abilities array', () => {
      const features = [{
        name: 'Danger Sense',
        automation: {
          type: 'conditional_advantage',
          abilities: ['DEX'],
          target: 'saving_throw',
          condition: 'invisible',
          effect: 'advantage'
        }
      }]
      const result = collectSaveModifiers(features)
      expect(result).toEqual([{
        source: 'Danger Sense',
        target: 'saving_throw',
        condition: 'invisible',
        effect: 'advantage',
        abilities: ['DEX']
      }])
    })

    it('extracts modifier from feature with saveType', () => {
      const features = [{
        name: 'Evasion',
        automation: {
          type: 'conditional_advantage',
          saveType: 'dex',
          target: 'saving_throw',
          condition: 'area_effect',
          effect: 'advantage'
        }
      }]
      const result = collectSaveModifiers(features)
      expect(result[0].abilities).toEqual(['DEX'])
      expect(result[0].source).toBe('Evasion')
      expect(result[0].target).toBe('saving_throw')
      expect(result[0].condition).toBe('area_effect')
      expect(result[0].effect).toBe('advantage')
    })

    it('extracts modifier with no abilities and no saveType', () => {
      const features = [{
        name: 'Some Feature',
        automation: {
          type: 'conditional_advantage',
          target: 'saving_throw',
          condition: 'frightened',
          effect: 'advantage'
        }
      }]
      const result = collectSaveModifiers(features)
      expect(result[0].abilities).toEqual([])
    })

    it('only extracts conditional_advantage, not other types in same array', () => {
      const features = [
        { name: 'Damage', automation: { type: 'damage', damage: '1d6' } }
      ]
      expect(collectSaveModifiers(features)).toEqual([])
    })
  })

  describe('conditional_disadvantage type', () => {
    it('extracts disadvantage for saving_throw target', () => {
      const features = [{
        name: 'Curse',
        automation: {
          type: 'conditional_disadvantage',
          target: 'saving_throw',
          condition: 'hex',
          abilities: ['CON']
        }
      }]
      const result = collectSaveModifiers(features)
      expect(result).toEqual([{
        source: 'Curse',
        target: 'saving_throw',
        condition: 'hex',
        effect: 'disadvantage',
        abilities: ['CON']
      }])
    })

    it('extracts disadvantage for save target alias', () => {
      const features = [{
        name: 'Curse',
        automation: {
          type: 'conditional_disadvantage',
          target: 'save',
          condition: 'hex',
          abilities: ['WIS']
        }
      }]
      const result = collectSaveModifiers(features)
      expect(result[0].target).toBe('saving_throw')
    })

    it('extracts disadvantage for non-save target', () => {
      const features = [{
        name: 'Hex',
        automation: {
          type: 'conditional_disadvantage',
          target: 'attack_roll',
          condition: 'hex_on_target',
          abilities: []
        }
      }]
      const result = collectSaveModifiers(features)
      expect(result[0].target).toBe('attack_roll')
      expect(result[0].effect).toBe('disadvantage')
    })

    it('uses default target of attack_roll when unspecified', () => {
      const features = [{
        name: 'Hex',
        automation: {
          type: 'conditional_disadvantage',
          condition: 'always'
        }
      }]
      const result = collectSaveModifiers(features)
      expect(result[0].target).toBe('attack_roll')
    })

    it('converts saveType to uppercase abilities', () => {
      const features = [{
        name: 'Hex',
        automation: {
          type: 'conditional_disadvantage',
          saveType: 'wis',
          target: 'saving_throw'
        }
      }]
      const result = collectSaveModifiers(features)
      expect(result[0].abilities).toEqual(['WIS'])
    })

    it('skips when no automation', () => {
      expect(collectSaveModifiers([{ name: 'Feature' }])).toEqual([])
    })
  })

  describe('combat_stance type', () => {
    it('extracts save advantage modifiers from stance advantages', () => {
      const features = [{
        name: 'Berserker Stance',
        automation: {
          type: 'combat_stance',
          advantages: ['DEX saves', 'WIS saves']
        }
      }]
      const result = collectSaveModifiers(features)
      expect(result).toHaveLength(2)
      expect(result[0]).toEqual({
        source: 'Berserker Stance',
        target: 'saving_throw',
        condition: 'stance_active',
        effect: 'advantage',
        abilities: ['DEX']
      })
      expect(result[1]).toEqual({
        source: 'Berserker Stance',
        target: 'saving_throw',
        condition: 'stance_active',
        effect: 'advantage',
        abilities: ['WIS']
      })
    })

    it('skips stance advantages that are not saves', () => {
      const features = [{
        name: 'Stance',
        automation: {
          type: 'combat_stance',
          advantages: ['STR checks', 'melee attacks', 'rage damage']
        }
      }]
      expect(collectSaveModifiers(features)).toEqual([])
    })

    it('skips stance without advantages property', () => {
      const features = [{
        name: 'Stance',
        automation: { type: 'combat_stance' }
      }]
      expect(collectSaveModifiers(features)).toEqual([])
    })

    it('filters mixed stance advantages to only save entries', () => {
      const features = [{
        name: 'Stance',
        automation: {
          type: 'combat_stance',
          advantages: ['CON saves', 'melee attacks', 'WIS saves']
        }
      }]
      const result = collectSaveModifiers(features)
      expect(result).toHaveLength(2)
      expect(result[0].abilities).toEqual(['CON'])
      expect(result[1].abilities).toEqual(['WIS'])
    })

    it('handles lowercase saves entries', () => {
      const features = [{
        name: 'Stance',
        automation: {
          type: 'combat_stance',
          advantages: ['cha saves']
        }
      }]
      const result = collectSaveModifiers(features)
      expect(result).toHaveLength(1)
      expect(result[0].abilities).toEqual(['CHA'])
    })

    it('does not match partial ability codes shorter than 3 letters', () => {
      const features = [{
        name: 'Stance',
        automation: {
          type: 'combat_stance',
          advantages: ['ST saves']
        }
      }]
      expect(collectSaveModifiers(features)).toEqual([])
    })
  })

  describe('auto_reroll type', () => {
    it('extracts basic auto_reroll modifier', () => {
      const features = [{
        name: 'Relentless Endurance',
        automation: {
          type: 'auto_reroll',
          target: 'death_saving_throws',
          condition: 'below_half_hp'
        }
      }]
      const result = collectSaveModifiers(features)
      expect(result).toEqual([{
        source: 'Relentless Endurance',
        target: 'death_saving_throws',
        condition: 'below_half_hp',
        effect: 'reroll',
        bonusExpression: '',
        oncePerRage: false
      }])
    })

    it('extracts auto_reroll with bonusExpression', () => {
      const features = [{
        name: 'Guidance',
        automation: {
          type: 'auto_reroll',
          target: 'ability_check',
          condition: 'action_used',
          bonusExpression: '1d4'
        }
      }]
      const result = collectSaveModifiers(features)
      expect(result[0].bonusExpression).toBe('1d4')
    })

    it('extracts auto_reroll with oncePerRage', () => {
      const features = [{
        name: 'Relentless Endurance',
        automation: {
          type: 'auto_reroll',
          target: 'death_saving_throws',
          condition: 'below_half_hp',
          oncePerRage: true
        }
      }]
      const result = collectSaveModifiers(features)
      expect(result[0].oncePerRage).toBe(true)
    })

    it('uses disciplined_survivor condition for feature named Disciplined Survivor', () => {
      const features = [{
        name: 'Disciplined Survivor',
        automation: {
          type: 'auto_reroll',
          target: 'saving_throw'
        }
      }]
      const result = collectSaveModifiers(features)
      expect(result[0].condition).toBe('disciplined_survivor')
    })

    it('uses empty condition when feature is not Disciplined Survivor and no condition provided', () => {
      const features = [{
        name: 'Other Feature',
        automation: {
          type: 'auto_reroll',
          target: 'saving_throw'
        }
      }]
      const result = collectSaveModifiers(features)
      expect(result[0].condition).toBe('')
    })
  })

  describe('living_legend type', () => {
    it('produces two modifiers: save reroll and ability check advantage', () => {
      const features = [{
        name: 'Living Legend',
        automation: { type: 'living_legend' }
      }]
      const result = collectSaveModifiers(features)
      expect(result).toHaveLength(2)
      expect(result[0]).toEqual({
        source: 'Living Legend',
        target: 'saving_throw',
        condition: 'living_legend_active',
        effect: 'reroll',
        bonusExpression: ''
      })
      expect(result[1]).toEqual({
        source: 'Living Legend',
        target: 'ability_check',
        condition: 'living_legend_active',
        effect: 'advantage',
        abilities: ['CHA']
      })
    })
  })

  describe('conditional_replacement type', () => {
    it('extracts conditional_replacement with saveType and replacementAbility', () => {
      const features = [{
        name: 'Fey Ancestry',
        automation: {
          type: 'conditional_replacement',
          target: 'saving_throw',
          condition: 'charmed_or_frightened',
          saveType: 'con',
          replacementAbility: 'wis'
        }
      }]
      const result = collectSaveModifiers(features)
      expect(result).toEqual([{
        source: 'Fey Ancestry',
        target: 'saving_throw',
        condition: 'charmed_or_frightened',
        effect: 'replacement',
        saveType: 'con',
        replacementAbility: 'wis'
      }])
    })

    it('defaults saveType and replacementAbility to empty string', () => {
      const features = [{
        name: 'Some Feature',
        automation: {
          type: 'conditional_replacement',
          target: 'saving_throw',
          condition: 'always'
        }
      }]
      const result = collectSaveModifiers(features)
      expect(result[0].saveType).toBe('')
      expect(result[0].replacementAbility).toBe('')
    })
  })

  describe('tactical_mind type', () => {
    it('extracts tactical_mind modifier with defaults', () => {
      const features = [{
        name: 'Tactical Mind',
        automation: {
          type: 'tactical_mind',
          target: 'ability_check',
          condition: 'expended_advantage'
        }
      }]
      const result = collectSaveModifiers(features)
      expect(result).toEqual([{
        source: 'Tactical Mind',
        target: 'ability_check',
        condition: 'expended_advantage',
        effect: 'tactical_mind',
        bonusExpression: ''
      }])
    })

    it('defaults target to ability_check when unspecified', () => {
      const features = [{
        name: 'Tactical Mind',
        automation: { type: 'tactical_mind' }
      }]
      const result = collectSaveModifiers(features)
      expect(result[0].target).toBe('ability_check')
    })
  })

  describe('elder_champion type', () => {
    it('extracts elder_champion disadvantage modifier', () => {
      const features = [{
        name: 'Elder Champion',
        automation: { type: 'elder_champion' }
      }]
      const result = collectSaveModifiers(features)
      expect(result).toEqual([{
        source: 'Elder Champion',
        target: 'saving_throw',
        condition: 'elder_champion_active',
        effect: 'disadvantage'
      }])
    })
  })

  describe('large_form type', () => {
    it('extracts large_form advantage on STR ability checks', () => {
      const features = [{
        name: 'Large Form',
        automation: { type: 'large_form' }
      }]
      const result = collectSaveModifiers(features)
      expect(result).toEqual([{
        source: 'Large Form',
        target: 'ability_check',
        condition: 'large_form_active',
        effect: 'advantage',
        abilities: ['STR']
      }])
    })
  })

  describe('otherworldly_glamour type', () => {
    it('extracts otherworldly_glamour wis_replacement on ability checks', () => {
      const features = [{
        name: 'Otherworldly Glamour',
        automation: { type: 'otherworldly_glamour' }
      }]
      const result = collectSaveModifiers(features)
      expect(result).toEqual([{
        source: 'Otherworldly Glamour',
        target: 'ability_check',
        condition: 'otherworldly_glamour',
        effect: 'wis_replacement',
        abilities: ['CHA']
      }])
    })
  })

  describe('reliable_talent type', () => {
    it('extracts reliable_talent modifier', () => {
      const features = [{
        name: 'Reliable Talent',
        automation: { type: 'reliable_talent' }
      }]
      const result = collectSaveModifiers(features)
      expect(result).toEqual([{
        source: 'Reliable Talent',
        target: 'ability_check',
        condition: '',
        effect: 'reliable_talent'
      }])
    })
  })

  describe('second_storywork type', () => {
    it('extracts second_storywork dex_jump modifier', () => {
      const features = [{
        name: 'Second Storywork',
        automation: { type: 'second_storywork' }
      }]
      const result = collectSaveModifiers(features)
      expect(result).toEqual([{
        source: 'Second Storywork',
        target: 'ability_check',
        condition: '',
        effect: 'dex_jump'
      }])
    })
  })

  describe('stroke_of_luck type', () => {
    it('extracts stroke_of_luck with default target', () => {
      const features = [{
        name: 'Stroke of Luck',
        automation: { type: 'stroke_of_luck' }
      }]
      const result = collectSaveModifiers(features)
      expect(result).toEqual([{
        source: 'Stroke of Luck',
        target: 'd20',
        condition: '',
        effect: 'stroke_of_luck'
      }])
    })

    it('uses custom target when provided', () => {
      const features = [{
        name: 'Stroke of Luck',
        automation: { type: 'stroke_of_luck', target: 'attack_roll' }
      }]
      const result = collectSaveModifiers(features)
      expect(result[0].target).toBe('attack_roll')
    })
  })

  describe('modify_d20_roll type', () => {
    it('extracts modify_d20_roll with defaults', () => {
      const features = [{
        name: 'Luck',
        automation: { type: 'modify_d20_roll' }
      }]
      const result = collectSaveModifiers(features)
      expect(result).toEqual([{
        source: 'Luck',
        target: 'd20',
        condition: '',
        effect: 'modify_d20_roll',
        diceExpression: '2d4',
        canBeBonusOrPenalty: false
      }])
    })

    it('uses custom modifier expression', () => {
      const features = [{
        name: 'Expertise',
        automation: { type: 'modify_d20_roll', modifier: '2d6' }
      }]
      const result = collectSaveModifiers(features)
      expect(result[0].diceExpression).toBe('2d6')
    })

    it('respects canBeBonusOrPenalty flag', () => {
      const features = [{
        name: 'Feature',
        automation: { type: 'modify_d20_roll', canBeBonusOrPenalty: true }
      }]
      const result = collectSaveModifiers(features)
      expect(result[0].canBeBonusOrPenalty).toBe(true)
    })
  })

  describe('use_magic_device type', () => {
    it('extracts use_magic_device advantage on INT ability checks', () => {
      const features = [{
        name: 'Use Magic Device',
        automation: { type: 'use_magic_device' }
      }]
      const result = collectSaveModifiers(features)
      expect(result).toEqual([{
        source: 'Use Magic Device',
        target: 'ability_check',
        condition: '',
        effect: 'advantage',
        abilities: ['INT']
      }])
    })
  })

  describe('passive_immunity type', () => {
    it('extracts save advantages from saveAdvantage array', () => {
      const features = [{
        name: 'Passive Immunity',
        automation: {
          type: 'passive_immunity',
          saveAdvantage: [
            { saveType: 'wis', condition: 'charmed' },
            { saveType: 'cha', condition: 'frightened' }
          ]
        }
      }]
      const result = collectSaveModifiers(features)
      expect(result).toHaveLength(2)
      expect(result[0]).toEqual({
        source: 'Passive Immunity',
        target: 'saving_throw',
        condition: 'charmed',
        effect: 'advantage',
        saveType: 'wis'
      })
      expect(result[1]).toEqual({
        source: 'Passive Immunity',
        target: 'saving_throw',
        condition: 'frightened',
        effect: 'advantage',
        saveType: 'cha'
      })
    })

    it('skips when saveAdvantage is absent', () => {
      const features = [{
        name: 'Passive Immunity',
        automation: { type: 'passive_immunity' }
      }]
      expect(collectSaveModifiers(features)).toEqual([])
    })

    it('defaults condition to empty string when not provided', () => {
      const features = [{
        name: 'Passive Immunity',
        automation: {
          type: 'passive_immunity',
          saveAdvantage: [{ saveType: 'con' }]
        }
      }]
      const result = collectSaveModifiers(features)
      expect(result[0].condition).toBe('')
    })
  })

  describe('restore_balance type', () => {
    it('extracts restore_balance with default target', () => {
      const features = [{
        name: 'Restore Balance',
        automation: { type: 'restore_balance' }
      }]
      const result = collectSaveModifiers(features)
      expect(result).toEqual([{
        source: 'Restore Balance',
        target: 'd20',
        condition: '',
        effect: 'restore_balance'
      }])
    })

    it('uses custom target when provided', () => {
      const features = [{
        name: 'Restore Balance',
        automation: { type: 'restore_balance', target: 'attack_roll' }
      }]
      const result = collectSaveModifiers(features)
      expect(result[0].target).toBe('attack_roll')
    })
  })

  describe('transe_of_order type', () => {
    it('produces two modifiers: attack_roll and d20', () => {
      const features = [{
        name: 'Transe of Order',
        automation: { type: 'transe_of_order' }
      }]
      const result = collectSaveModifiers(features)
      expect(result).toHaveLength(2)
      expect(result[0]).toEqual({
        source: 'Transe of Order',
        target: 'attack_roll',
        condition: 'transe_of_order_active',
        effect: 'no_advantage_against'
      })
      expect(result[1]).toEqual({
        source: 'Transe of Order',
        target: 'd20',
        condition: '',
        effect: 'd20_floor_10'
      })
    })
  })

  describe('dark_ones_look type', () => {
    it('produces two modifiers for saving_throw and ability_check', () => {
      const features = [{
        name: "Dark One's Look",
        automation: { type: 'dark_ones_look' }
      }]
      const result = collectSaveModifiers(features)
      expect(result).toHaveLength(2)
      expect(result[0].target).toBe('saving_throw')
      expect(result[0].effect).toBe('dark_ones_look')
      expect(result[1].target).toBe('ability_check')
      expect(result[1].effect).toBe('dark_ones_look')
    })
  })

  describe('clairvoyant_combatant type', () => {
    it('extracts clairvoyant_combatant disadvantage on attack_roll', () => {
      const features = [{
        name: 'Clairvoyant Combatant',
        automation: { type: 'clairvoyant_combatant' }
      }]
      const result = collectSaveModifiers(features)
      expect(result).toEqual([{
        source: 'Clairvoyant Combatant',
        target: 'attack_roll',
        condition: 'clairvoyant_combatant_active',
        effect: 'disadvantage'
      }])
    })
  })

  describe('potent_cantrip type', () => {
    it('extracts potent_cantrip on saving_throw', () => {
      const features = [{
        name: 'Potent Cantrip',
        automation: { type: 'potent_cantrip' }
      }]
      const result = collectSaveModifiers(features)
      expect(result).toEqual([{
        source: 'Potent Cantrip',
        target: 'saving_throw',
        condition: '',
        effect: 'potent_cantrip'
      }])
    })
  })

  describe('soulstitch_spells type', () => {
    it('extracts soulstitch_spells on saving_throw', () => {
      const features = [{
        name: 'Souls Stitch Spells',
        automation: { type: 'soulstitch_spells' }
      }]
      const result = collectSaveModifiers(features)
      expect(result).toEqual([{
        source: 'Souls Stitch Spells',
        target: 'saving_throw',
        condition: '',
        effect: 'soulstitch_spells'
      }])
    })
  })

  describe('pass_without_trace type', () => {
    it('extracts pass_without_trace with bonusExpression', () => {
      const features = [{
        name: 'Pass Without Trace',
        automation: { type: 'pass_without_trace' }
      }]
      const result = collectSaveModifiers(features)
      expect(result).toEqual([{
        source: 'Pass Without Trace',
        target: 'ability_check',
        condition: 'pass_without_trace_active',
        effect: 'pass_without_trace',
        bonusExpression: '10'
      }])
    })
  })

  describe('empowered_evocation type', () => {
    it('extracts empowered_evocation on damage', () => {
      const features = [{
        name: 'Empowered Evocation',
        automation: { type: 'empowered_evocation' }
      }]
      const result = collectSaveModifiers(features)
      expect(result).toEqual([{
        source: 'Empowered Evocation',
        target: 'damage',
        condition: '',
        effect: 'empowered_evocation'
      }])
    })
  })

  describe('overchannel type', () => {
    it('extracts overchannel on damage', () => {
      const features = [{
        name: 'Overchannel',
        automation: { type: 'overchannel' }
      }]
      const result = collectSaveModifiers(features)
      expect(result).toEqual([{
        source: 'Overchannel',
        target: 'damage',
        condition: '',
        effect: 'overchannel'
      }])
    })
  })

  describe('passive_rule type', () => {
    it('does not produce spell_breaker_dispel_bonus modifier (bonus handled in SpellDetailPopup)', () => {
      const features = [{
        name: 'Spell Breaker',
        automation: {
          type: 'passive_rule',
          effect: 'spell_breaker',
          dispelAbilityCheckBonus: 'proficiency_bonus'
        }
      }]
      const result = collectSaveModifiers(features)
      expect(result).toEqual([])
    })

    it('skips when effect is not spell_breaker', () => {
      const features = [{
        name: 'Feature',
        automation: {
          type: 'passive_rule',
          effect: 'something_else'
        }
      }]
      expect(collectSaveModifiers(features)).toEqual([])
    })

    it('extracts concentration_disadvantage_on_damage_dealt', () => {
      const features = [{
        name: 'Concentration Breaker',
        automation: {
          type: 'passive_rule',
          effect: 'concentration_disadvantage_on_damage_dealt'
        }
      }]
      const result = collectSaveModifiers(features)
      expect(result).toEqual([{
        source: 'Concentration Breaker',
        target: 'saving_throw',
        condition: 'concentration_breaker',
        effect: 'disadvantage',
        abilities: ['CON']
      }])
    })
  })

  describe('holy_aura type', () => {
    it('produces two modifiers: attack_roll disadvantage and saving_throw advantage', () => {
      const features = [{
        name: 'Holy Aura',
        automation: { type: 'holy_aura' }
      }]
      const result = collectSaveModifiers(features)
      expect(result).toHaveLength(2)
      expect(result[0]).toEqual({
        source: 'Holy Aura',
        target: 'attack_roll',
        condition: 'holy_aura_active',
        effect: 'disadvantage'
      })
      expect(result[1]).toEqual({
        source: 'Holy Aura',
        target: 'saving_throw',
        condition: 'holy_aura_active',
        effect: 'advantage'
      })
    })
  })

  describe('portent type', () => {
    it('extracts portent on d20', () => {
      const features = [{
        name: 'Portent',
        automation: { type: 'portent' }
      }]
      const result = collectSaveModifiers(features)
      expect(result).toEqual([{
        source: 'Portent',
        target: 'd20',
        condition: '',
        effect: 'portent'
      }])
    })
  })

  describe('improved_illusions type', () => {
    it('extracts improved_illusions on spell_component', () => {
      const features = [{
        name: 'Improved Illusions',
        automation: { type: 'improved_illusions' }
      }]
      const result = collectSaveModifiers(features)
      expect(result).toEqual([{
        source: 'Improved Illusions',
        target: 'spell_component',
        condition: '',
        effect: 'improved_illusions'
      }])
    })
  })

  describe('illusory_reality type', () => {
    it('extracts illusory_reality on spell_component', () => {
      const features = [{
        name: 'Illusory Reality',
        automation: { type: 'illusory_reality' }
      }]
      const result = collectSaveModifiers(features)
      expect(result).toEqual([{
        source: 'Illusory Reality',
        target: 'spell_component',
        condition: '',
        effect: 'illusory_reality'
      }])
    })
  })

  describe('protection_from_poison type', () => {
    it('extracts protection_from_poison advantage on saving_throw', () => {
      const features = [{
        name: 'Protection From Poison',
        automation: { type: 'protection_from_poison' }
      }]
      const result = collectSaveModifiers(features)
      expect(result).toEqual([{
        source: 'Protection From Poison',
        target: 'saving_throw',
        condition: 'protection_from_poison_active',
        effect: 'advantage'
      }])
    })
  })

  describe('multiple features', () => {
    it('collects modifiers from multiple features', () => {
      const features = [
        {
          name: 'Danger Sense',
          automation: {
            type: 'conditional_advantage',
            abilities: ['DEX'],
            target: 'saving_throw',
            condition: 'invisible',
            effect: 'advantage'
          }
        },
        {
          name: 'Relentless Endurance',
          automation: {
            type: 'auto_reroll',
            target: 'death_saving_throws',
            condition: 'below_half_hp',
            oncePerRage: true
          }
        }
      ]
      const result = collectSaveModifiers(features)
      expect(result).toHaveLength(2)
      expect(result[0].source).toBe('Danger Sense')
      expect(result[1].source).toBe('Relentless Endurance')
    })

    it('collects stance modifiers alongside other modifiers', () => {
      const features = [
        {
          name: 'Berserker Stance',
          automation: {
            type: 'combat_stance',
            advantages: ['CON saves']
          }
        },
        {
          name: 'Danger Sense',
          automation: {
            type: 'conditional_advantage',
            abilities: ['DEX'],
            target: 'saving_throw',
            condition: 'invisible',
            effect: 'advantage'
          }
        }
      ]
      const result = collectSaveModifiers(features)
      expect(result).toHaveLength(2)
      expect(result[0].source).toBe('Berserker Stance')
      expect(result[0].effect).toBe('advantage')
      expect(result[0].abilities).toEqual(['CON'])
      expect(result[1].source).toBe('Danger Sense')
      expect(result[1].abilities).toEqual(['DEX'])
    })

    it('collects all conditional_advantage entries from multiple features', () => {
      const features = [
        {
          name: 'Feature A',
          automation: {
            type: 'conditional_advantage',
            saveType: 'con',
            target: 'saving_throw',
            condition: 'poison',
            effect: 'advantage'
          }
        },
        {
          name: 'Feature B',
          automation: {
            type: 'conditional_advantage',
            saveType: 'dex',
            target: 'saving_throw',
            condition: 'poison',
            effect: 'advantage'
          }
        }
      ]
      const result = collectSaveModifiers(features)
      expect(result).toHaveLength(2)
      expect(result[0].abilities).toEqual(['CON'])
      expect(result[1].abilities).toEqual(['DEX'])
    })

    it('aggregates modifiers from a single feature with array of automations', () => {
      const features = [{
        name: 'Multi Power',
        automation: [
          { type: 'conditional_advantage', saveType: 'wis', target: 'saving_throw', condition: 'frightened', effect: 'advantage' },
          { type: 'auto_reroll', target: 'death_saving_throws', condition: 'below_half_hp' }
        ]
      }]
      const result = collectSaveModifiers(features)
      expect(result).toHaveLength(2)
      expect(result[0].source).toBe('Multi Power')
      expect(result[1].source).toBe('Multi Power')
      expect(result[0].effect).toBe('advantage')
      expect(result[1].effect).toBe('reroll')
    })

    it('skips null and undefined features in array', () => {
      const features = [
        null,
        undefined,
        {
          name: 'Valid Feature',
          automation: {
            type: 'conditional_advantage',
            saveType: 'con',
            target: 'saving_throw',
            condition: 'poison',
            effect: 'advantage'
          }
        }
      ]
      const result = collectSaveModifiers(features)
      expect(result).toHaveLength(1)
      expect(result[0].source).toBe('Valid Feature')
    })
  })
})
