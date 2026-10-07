// FT-046 featName threading seam: the originating feat name must survive
// automation collection + special-action merge so tempHpBuffHandler can
// resolve featAbilityChoices keys ("<Feat>-<idx>") with the real feat name.
import { describe, it, expect, vi } from 'vitest'
import { mergeAutomationSpecialActions } from './rules-helpers.js'
import { tempHandlers } from '../combat/automation/automationInfoBuilder/temp.js'

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => undefined),
}))

describe('FT-046 featName threading', () => {
  it('temp_hp_buff info carries featName from the feat feature', () => {
    const info = tempHandlers.temp_hp_buff({
      name: 'Bolstering Performance',
      featName: 'Inspiring Leader',
      automation: { type: 'temp_hp_buff', multiTargetAlly: true },
    }, {})
    expect(info.featName).toBe('Inspiring Leader')
  })

  it('temp_hp_buff info defaults featName to empty string when absent', () => {
    const info = tempHandlers.temp_hp_buff({
      name: 'Some Benefit',
      automation: { type: 'temp_hp_buff' },
    }, {})
    expect(info.featName).toBe('')
  })

  it('mergeAutomationSpecialActions preserves featName on merged rows', () => {
    const playerStats = {
      name: 'HeroesFeastBard',
      specialActions: [],
      automation: {
        specialActions: [{
          name: 'Bolstering Performance',
          featName: 'Inspiring Leader',
          type: 'temp_hp_buff',
          multiTargetAlly: true,
        }],
      },
    }
    mergeAutomationSpecialActions(playerStats)
    const row = playerStats.specialActions.find(s => s.name === 'Bolstering Performance')
    expect(row).toBeDefined()
    expect(row.featName).toBe('Inspiring Leader')
  })
})
