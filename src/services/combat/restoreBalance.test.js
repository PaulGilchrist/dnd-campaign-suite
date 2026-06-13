import { collectSaveModifiers } from './automationModifiers.js'
import { collectAutomationFromFeatures } from './automationCollector.js'
import { computeConditionEffects, getNetAttackMode, hasSaveAdvantage } from './conditionEffects.js'

describe('restore_balance automation', () => {

  describe('collectSaveModifiers', () => {

    it('extracts restore_balance modifier from automation', () => {
      const features = [{
        name: 'Restore Balance',
        automation: {
          type: 'restore_balance',
          target: 'd20',
          range: '60_ft'
        }
      }]

      const result = collectSaveModifiers(features)

      expect(result).toHaveLength(1)
      expect(result[0].source).toBe('Restore Balance')
      expect(result[0].target).toBe('d20')
      expect(result[0].effect).toBe('restore_balance')
    })

    it('does not extract when automation type is not restore_balance', () => {
      const features = [{
        name: 'Some Other Feature',
        automation: {
          type: 'conditional_advantage',
          effect: 'advantage',
          target: 'saving_throw'
        }
      }]

      const result = collectSaveModifiers(features)

      const restoreMods = result.filter(m => m.effect === 'restore_balance')
      expect(restoreMods).toHaveLength(0)
    })

    it('collects restore_balance from multiple features', () => {
      const features = [
        {
          name: 'Restore Balance',
          automation: { type: 'restore_balance', target: 'd20' }
        },
        {
          name: 'Another Feature',
          automation: { type: 'restore_balance', target: 'd20' }
        }
      ]

      const result = collectSaveModifiers(features)

      expect(result).toHaveLength(2)
      expect(result.every(m => m.effect === 'restore_balance')).toBe(true)
    })
  })

  describe('collectAutomationFromFeatures', () => {

    it('categorizes restore_balance as a reaction', () => {
      const features = [{
        name: 'Restore Balance',
        automation: { type: 'restore_balance', target: 'd20', range: '60_ft' }
      }]

      const result = collectAutomationFromFeatures(features, {})

      expect(result.reactions).toHaveLength(1)
      expect(result.reactions[0].type).toBe('restore_balance')
      expect(result.reactions[0].name).toBe('Restore Balance')
    })

    it('does not add restore_balance to actions or bonusActions', () => {
      const features = [{
        name: 'Restore Balance',
        automation: { type: 'restore_balance', target: 'd20', range: '60_ft' }
      }]

      const result = collectAutomationFromFeatures(features, {})

      expect(result.actions.filter(a => a.type === 'restore_balance')).toHaveLength(0)
      expect(result.bonusActions.filter(a => a.type === 'restore_balance')).toHaveLength(0)
    })
  })

  describe('computeConditionEffects', () => {

    it('sets restoreBalance flag when restore_balance modifier present', () => {
      const saveModifiers = [{
        source: 'Restore Balance',
        target: 'd20',
        condition: '',
        effect: 'restore_balance'
      }]

      const effects = computeConditionEffects([], saveModifiers)

      expect(effects.restoreBalance).toBe(true)
    })

    it('does not set restoreBalance when no restore_balance modifier', () => {
      const saveModifiers = [{
        source: 'Some Feature',
        target: 'saving_throw',
        effect: 'advantage'
      }]

      const effects = computeConditionEffects([], saveModifiers)

      expect(effects.restoreBalance).toBe(false)
    })
  })

  describe('getNetAttackMode', () => {

    it('neutralizes one advantage when restoreBalance is true', () => {
      expect(getNetAttackMode(1, 0, true)).toBe('normal')
    })

    it('neutralizes one disadvantage when restoreBalance is true', () => {
      expect(getNetAttackMode(0, 1, true)).toBe('normal')
    })

    it('leaves excess advantage after neutralization', () => {
      expect(getNetAttackMode(2, 1, true)).toBe('advantage')
    })

    it('leaves excess disadvantage after neutralization', () => {
      expect(getNetAttackMode(1, 2, true)).toBe('disadvantage')
    })

    it('no change when no advantage or disadvantage', () => {
      expect(getNetAttackMode(0, 0, true)).toBe('normal')
    })

    it('no change when restoreBalance is false', () => {
      expect(getNetAttackMode(1, 0, false)).toBe('advantage')
      expect(getNetAttackMode(0, 1, false)).toBe('disadvantage')
    })

    it('balance still works when adv equals dis', () => {
      expect(getNetAttackMode(1, 1, true)).toBe('normal')
    })
  })

  describe('hasSaveAdvantage', () => {

    it('returns false when restoreBalance cancels single advantage count', () => {
      const effects = { saveAdvantageCount: 1, saveDisadvantageCount: 0 }
      expect(hasSaveAdvantage(effects, 'con', true)).toBe(false)
    })

    it('returns true when advantage count exceeds restoreBalance cancellation', () => {
      const effects = { saveAdvantageCount: 2, saveDisadvantageCount: 0 }
      expect(hasSaveAdvantage(effects, 'con', true)).toBe(true)
    })

    it('returns true when condition-specific advantage exists despite restoreBalance', () => {
      const effects = { saveAdvantageCount: 0, saveDisadvantageCount: 0, saveAdvantage: ['charmed'] }
      expect(hasSaveAdvantage(effects, 'charmed', true)).toBe(true)
    })

    it('returns false when no advantages and restoreBalance is true', () => {
      const effects = { saveAdvantageCount: 0, saveDisadvantageCount: 0 }
      expect(hasSaveAdvantage(effects, 'con', true)).toBe(false)
    })

    it('returns false when restoreBalance cancels disadvantage (no advantage to begin with)', () => {
      const effects = { saveAdvantageCount: 0, saveDisadvantageCount: 1 }
      expect(hasSaveAdvantage(effects, 'con', true)).toBe(false)
    })
  })
})
