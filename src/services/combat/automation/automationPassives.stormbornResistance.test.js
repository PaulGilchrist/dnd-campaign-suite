// @improved-by-ai
// CLA-336 regression: getDamageResistances must resolve the Stormborn
// type:'resistance' passive LIVE, gated on the wrathOfTheSeaActive runtime key.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getDamageResistances } from './automationPassives.js'

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
}))

vi.mock('../../automation/common/choiceStorage.js', () => ({
  getChosenRuntimeValue: vi.fn(() => null),
}))

vi.mock('../../rules/core/attackCalc.js', () => ({
  parseMagicItemName: vi.fn(),
}))

vi.mock('../../../shared/abilityLookup.js', () => ({
  getAbilityModifier: vi.fn(() => 0),
}))

vi.mock('./automationExpressions.js', () => ({
  evaluateAutoExpression: vi.fn(),
}))

vi.mock('../../rules/core/greatWeaponFighting.js', () => ({
  applyGreatWeaponFighting: vi.fn(),
}))

import { getRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js'

const STORMBORN_PASSIVE = {
  type: 'resistance',
  name: 'Stormborn',
  damageTypes: ['Cold', 'Lightning', 'Thunder'],
  casting_time: 'passive',
}

const druidStats = () => ({
  name: 'Wild_Sage_Druid',
  automation: { passives: [STORMBORN_PASSIVE] },
})

describe('getDamageResistances Stormborn resistance (CLA-336)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('emits Cold/Lightning/Thunder while wrathOfTheSeaActive is true', () => {
    getRuntimeValue.mockImplementation((_name, key) =>
      key === 'wrathOfTheSeaActive' ? true : null)
    expect(getDamageResistances(druidStats())).toEqual(['Cold', 'Lightning', 'Thunder'])
  })

  it('emits nothing while wrathOfTheSeaActive is false', () => {
    getRuntimeValue.mockImplementation((_name, key) =>
      key === 'wrathOfTheSeaActive' ? false : null)
    expect(getDamageResistances(druidStats())).toEqual([])
  })

  it('emits nothing while wrathOfTheSeaActive is unset', () => {
    getRuntimeValue.mockReturnValue(null)
    expect(getDamageResistances(druidStats())).toEqual([])
  })

  it('never emits Bludgeoning from the Stormborn passive', () => {
    getRuntimeValue.mockImplementation((_name, key) =>
      key === 'wrathOfTheSeaActive' ? true : null)
    expect(getDamageResistances(druidStats())).not.toContain('Bludgeoning')
  })

  it('keeps Full of Stars gated on activeBuffs Starry Form (rulesFactory parity)', () => {
    const stats = {
      name: 'Wild_Sage_Druid',
      automation: { passives: [{ type: 'resistance', name: 'Full of Stars', damageTypes: ['Bludgeoning', 'Piercing', 'Slashing'] }] },
    }
    getRuntimeValue.mockImplementation((_name, key) => {
      if (key === 'activeBuffs') return [{ name: 'Starry Form' }]
      return null
    })
    expect(getDamageResistances(stats)).toEqual(['Bludgeoning', 'Piercing', 'Slashing'])

    getRuntimeValue.mockImplementation((_name, key) => {
      if (key === 'activeBuffs') return []
      return null
    })
    expect(getDamageResistances(stats)).toEqual([])
  })

  it('emits always-on type:resistance passives without any gate', () => {
    getRuntimeValue.mockReturnValue(null)
    const stats = {
      name: 'IronBarbarian',
      automation: { passives: [{ type: 'resistance', name: 'Avatar of Battle', damageTypes: ['Bludgeoning', 'Piercing', 'Slashing'] }] },
    }
    expect(getDamageResistances(stats)).toEqual(['Bludgeoning', 'Piercing', 'Slashing'])
  })
})
