// CLA-237 regression: getDamageResistances (applyDamage fallback merge) must
// resolve land_resistance from the runtime _circleOfTheLandType key.
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

const LAND_PASSIVE = {
  type: 'land_resistance',
  conditionImmunity: 'poisoned',
  landMappings: { arid: 'Fire', polar: 'Cold', temperate: 'Lightning', tropical: 'Poison' },
}

const druidStats = () => ({
  name: 'Wild_Sage_Druid',
  class: { name: 'Druid', major: { name: 'Circle of the Land' } },
  automation: { passives: [LAND_PASSIVE] },
})

describe('getDamageResistances land_resistance (CLA-237)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns lightning resistance from runtime _circleOfTheLandType when class has no type', () => {
    getRuntimeValue.mockImplementation((_name, key) =>
      key === '_circleOfTheLandType' ? 'Temperate' : null)
    expect(getDamageResistances(druidStats())).toEqual(['Lightning'])
  })

  it('returns fire resistance when runtime land type is Arid', () => {
    getRuntimeValue.mockImplementation((_name, key) =>
      key === '_circleOfTheLandType' ? 'Arid' : null)
    expect(getDamageResistances(druidStats())).toEqual(['Fire'])
  })

  it('falls back to class major type when runtime key unset', () => {
    getRuntimeValue.mockReturnValue(null)
    const stats = druidStats()
    stats.class.major.type = 'temperate'
    expect(getDamageResistances(stats)).toEqual(['Lightning'])
  })

  it('returns empty when no land type is known', () => {
    getRuntimeValue.mockReturnValue(null)
    expect(getDamageResistances(druidStats())).toEqual([])
  })
})
