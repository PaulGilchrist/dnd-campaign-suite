import { describe, it, expect } from 'vitest'
import { collectSaveModifiers } from './automationModifiers.js'

describe('collectSaveModifiers', () => {
  describe('null/empty handling', () => {
    it('returns empty array when features is null', () => {
      const result = collectSaveModifiers(null)
      expect(result).toEqual([])
    })

    it('returns empty array when features is undefined', () => {
      const result = collectSaveModifiers(undefined)
      expect(result).toEqual([])
    })

    it('returns empty array when features is empty', () => {
      const result = collectSaveModifiers([])
      expect(result).toEqual([])
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
      expect(result).toHaveLength(1)
      expect(result[0]).toEqual({
        source: 'Danger Sense',
        target: 'saving_throw',
        condition: 'invisible',
        effect: 'advantage',
        abilities: ['DEX']
      })
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
      expect(result).toHaveLength(1)
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
      expect(result).toHaveLength(1)
      expect(result[0].abilities).toEqual([])
    })

    it('does not extract when automation type is not conditional_advantage', () => {
      const features = [{
        name: 'Some Feature',
        automation: {
          type: 'damage',
          damage: '1d6'
        }
      }]
      const result = collectSaveModifiers(features)
      expect(result).toEqual([])
    })

    it('skips feature with no automation property', () => {
      const features = [{
        name: 'Rage',
        damageBonus: 2
      }]
      const result = collectSaveModifiers(features)
      expect(result).toEqual([])
    })

    it('skips feature with null automation', () => {
      const features = [{
        name: 'Some Feature',
        automation: null
      }]
      const result = collectSaveModifiers(features)
      expect(result).toEqual([])
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

    it('extracts ability check advantage from stance (non-save)', () => {
      const features = [{
        name: 'Stance',
        automation: {
          type: 'combat_stance',
          advantages: ['STR checks']
        }
      }]
      const result = collectSaveModifiers(features)
      expect(result).toHaveLength(0)
    })

    it('skips stance without advantages property', () => {
      const features = [{
        name: 'Stance',
        automation: {
          type: 'combat_stance'
        }
      }]
      const result = collectSaveModifiers(features)
      expect(result).toEqual([])
    })

    it('skips stance with advantages but no save entries', () => {
      const features = [{
        name: 'Stance',
        automation: {
          type: 'combat_stance',
          advantages: ['melee attacks', 'rage damage']
        }
      }]
      const result = collectSaveModifiers(features)
      expect(result).toEqual([])
    })

    it('handles mixed stance advantages (saves and non-saves)', () => {
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

    it('handles abilities with different casing (lowercase "saves")', () => {
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

    it('matches three-letter ability code followed by saves', () => {
      const features = [{
        name: 'Stance',
        automation: {
          type: 'combat_stance',
          advantages: ['STR saves']
        }
      }]
      const result = collectSaveModifiers(features)
      expect(result).toHaveLength(1)
      expect(result[0].abilities).toEqual(['STR'])
    })

    it('does not match partial ability codes (2 letters)', () => {
      const features = [{
        name: 'Stance',
        automation: {
          type: 'combat_stance',
          advantages: ['ST saves']
        }
      }]
      const result = collectSaveModifiers(features)
      expect(result).toHaveLength(0)
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
      expect(result).toHaveLength(1)
      expect(result[0]).toEqual({
        source: 'Relentless Endurance',
        target: 'death_saving_throws',
        condition: 'below_half_hp',
        effect: 'reroll',
        bonusExpression: '',
        oncePerRage: false
      })
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
      expect(result).toHaveLength(1)
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
      expect(result).toHaveLength(1)
      expect(result[0].oncePerRage).toBe(true)
    })

    it('does not extract when type is not auto_reroll', () => {
      const features = [{
        name: 'Some Feature',
        automation: {
          type: 'damage',
          damage: '1d6'
        }
      }]
      const result = collectSaveModifiers(features)
      expect(result).toEqual([])
    })
  })

  describe('conditional_replacement type', () => {
    it('extracts basic conditional_replacement modifier', () => {
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
      expect(result).toHaveLength(1)
      expect(result[0]).toEqual({
        source: 'Fey Ancestry',
        target: 'saving_throw',
        condition: 'charmed_or_frightened',
        effect: 'replacement',
        saveType: 'con',
        replacementAbility: 'wis'
      })
    })

    it('handles missing saveType and replacementAbility', () => {
      const features = [{
        name: 'Some Feature',
        automation: {
          type: 'conditional_replacement',
          target: 'saving_throw',
          condition: 'always'
        }
      }]
      const result = collectSaveModifiers(features)
      expect(result).toHaveLength(1)
      expect(result[0].saveType).toBe('')
      expect(result[0].replacementAbility).toBe('')
    })

    it('does not extract when type is not conditional_replacement', () => {
      const features = [{
        name: 'Some Feature',
        automation: {
          type: 'damage',
          damage: '1d6'
        }
      }]
      const result = collectSaveModifiers(features)
      expect(result).toEqual([])
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

    it('collects modifiers from same feature with multiple automation types', () => {
      const features = [{
        name: 'Multi-Ability Feature',
        automation: {
          type: 'conditional_advantage',
          saveType: 'wis',
          target: 'saving_throw',
          condition: 'frightened',
          effect: 'advantage'
        }
      }]
      // A single feature has one automation object, so only one modifier type applies
      const result = collectSaveModifiers(features)
      expect(result).toHaveLength(1)
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
  })

  describe('feature null safety', () => {
    it('skips null feature in array', () => {
      const features = [null, {
        name: 'Valid Feature',
        automation: {
          type: 'conditional_advantage',
          saveType: 'con',
          target: 'saving_throw',
          condition: 'poison',
          effect: 'advantage'
        }
      }]
      const result = collectSaveModifiers(features)
      expect(result).toHaveLength(1)
      expect(result[0].source).toBe('Valid Feature')
    })

    it('skips undefined feature in array', () => {
      const features = [undefined, {
        name: 'Valid Feature',
        automation: {
          type: 'conditional_advantage',
          saveType: 'dex',
          target: 'saving_throw',
          condition: 'area_effect',
          effect: 'advantage'
        }
      }]
      const result = collectSaveModifiers(features)
      expect(result).toHaveLength(1)
      expect(result[0].source).toBe('Valid Feature')
    })
  })
})
