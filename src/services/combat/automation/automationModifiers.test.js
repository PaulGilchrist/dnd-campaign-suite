// @cleaned-by-ai
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

    it('returns empty array when all features are null/undefined or lack automation', () => {
      const features = [null, undefined, { name: 'No Automation' }, { name: 'Some Feature', automation: null }]
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
        abilities: ['DEX'],
        skills: [],
      }])
    })

    it('converts saveType to uppercase abilities', () => {
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

    it('normalizes save target alias to saving_throw', () => {
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
      expect(result[1].abilities).toEqual(['WIS'])
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

    it('extracts auto_reroll with bonusExpression and oncePerRage', () => {
      const features = [{
        name: 'Guidance',
        automation: {
          type: 'auto_reroll',
          target: 'ability_check',
          condition: 'action_used',
          bonusExpression: '1d4',
          oncePerRage: true
        }
      }]
      const result = collectSaveModifiers(features)
      expect(result[0].bonusExpression).toBe('1d4')
      expect(result[0].oncePerRage).toBe(true)
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

    it('uses custom modifier expression and canBeBonusOrPenalty flag', () => {
      const features = [{
        name: 'Expertise',
        automation: { type: 'modify_d20_roll', modifier: '2d6', canBeBonusOrPenalty: true }
      }]
      const result = collectSaveModifiers(features)
      expect(result[0].diceExpression).toBe('2d6')
      expect(result[0].canBeBonusOrPenalty).toBe(true)
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
      expect(result[1].condition).toBe('frightened')
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
    })
  })

  describe('passive_rule type', () => {
    it('does not produce spell_breaker_dispel_bonus modifier', () => {
      const features = [{
        name: 'Spell Breaker',
        automation: {
          type: 'passive_rule',
          effect: 'spell_breaker',
          dispelAbilityCheckBonus: 'proficiency_bonus'
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

    it('skips passive_rule with other effects', () => {
      const features = [{
        name: 'Feature',
        automation: {
          type: 'passive_rule',
          effect: 'something_else'
        }
      }]
      expect(collectSaveModifiers(features)).toEqual([])
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

  describe('conditional_save_bonus type', () => {
    it('extracts save bonus modifier from feature with abilities array', () => {
      const features = [{
        name: 'Increased Toughness',
        automation: {
          type: 'conditional_save_bonus',
          abilities: ['CON'],
          target: 'saving_throw',
          condition: 'shape_shift',
          bonusExpression: 'wisdom_modifier'
        }
      }]
      const result = collectSaveModifiers(features)
      expect(result).toEqual([{
        source: 'Increased Toughness',
        target: 'saving_throw',
        condition: 'shape_shift',
        effect: 'save_bonus',
        abilities: ['CON'],
        bonusExpression: 'wisdom_modifier'
      }])
    })

    it('converts saveType to uppercase abilities', () => {
      const features = [{
        name: 'Feature',
        automation: {
          type: 'conditional_save_bonus',
          saveType: 'con',
          target: 'saving_throw',
          condition: 'test',
          bonusExpression: '2'
        }
      }]
      const result = collectSaveModifiers(features)
      expect(result[0].abilities).toEqual(['CON'])
    })

    it('returns empty abilities when neither abilities nor saveType provided', () => {
      const features = [{
        name: 'Feature',
        automation: {
          type: 'conditional_save_bonus',
          target: 'saving_throw',
          condition: 'test',
          bonusExpression: '1'
        }
      }]
      const result = collectSaveModifiers(features)
      expect(result[0].abilities).toEqual([])
    })
  })
})
