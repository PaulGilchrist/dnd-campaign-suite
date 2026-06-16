import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks BEFORE imports (hoisted by vitest) ───────────────────

vi.mock('../../../hooks/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}))

vi.mock('../../encounters/combatData.js', () => ({
  getCurrentCombatRound: vi.fn(),
}))

// ── Imports (Vite returns mocked versions) ─────────────────────

import {
  isUnbreakableMajestyActive,
  getUnbreakableMajestySaveDc,
  clearUnbreakableMajesty,
  hasAttackerTriggeredMajesty,
  markAttackerTriggeredMajesty,
  clearPerRoundMajestyTrackers,
  buildMajestyPromptData,
} from './unbreakableMajesty.js'

import { getRuntimeValue, setRuntimeValue } from '../../../hooks/useRuntimeState.js'
import { getCurrentCombatRound } from '../../encounters/combatData.js'

// ── Tests ───────────────────────────────────────────────────────

describe('isUnbreakableMajestyActive', () => {
  beforeEach(() => {
    getRuntimeValue.mockReset()
  })

  it('returns true when majesty key is set to true', () => {
    getRuntimeValue.mockReturnValue(true)
    expect(isUnbreakableMajestyActive('Paladin', 'Campaign')).toBe(true)
  })

  it('returns false when majesty key is false', () => {
    getRuntimeValue.mockReturnValue(false)
    expect(isUnbreakableMajestyActive('Paladin', 'Campaign')).toBe(false)
  })

  it('returns false when majesty key is null', () => {
    getRuntimeValue.mockReturnValue(null)
    expect(isUnbreakableMajestyActive('Paladin', 'Campaign')).toBe(false)
  })

  it('returns false when majesty key is undefined', () => {
    getRuntimeValue.mockReturnValue(undefined)
    expect(isUnbreakableMajestyActive('Paladin', 'Campaign')).toBe(false)
  })

  it('calls getRuntimeValue with correct arguments', () => {
    getRuntimeValue.mockReturnValue(false)
    isUnbreakableMajestyActive('MyPaladin', 'MyCampaign')
    expect(getRuntimeValue).toHaveBeenCalledWith(
      'MyPaladin',
      'unbreakableMajestyActive',
      'MyCampaign',
    )
  })
})

describe('getUnbreakableMajestySaveDc', () => {
  beforeEach(() => {
    getRuntimeValue.mockReset()
  })

  it('returns the number when value is set', () => {
    getRuntimeValue.mockReturnValue(15)
    expect(getUnbreakableMajestySaveDc('Paladin', 'Campaign')).toBe(15)
  })

  it('returns 0 when value is null', () => {
    getRuntimeValue.mockReturnValue(null)
    expect(getUnbreakableMajestySaveDc('Paladin', 'Campaign')).toBe(0)
  })

  it('returns 0 when value is undefined', () => {
    getRuntimeValue.mockReturnValue(undefined)
    expect(getUnbreakableMajestySaveDc('Paladin', 'Campaign')).toBe(0)
  })

  it('returns 0 when value is an empty string', () => {
    getRuntimeValue.mockReturnValue('')
    expect(getUnbreakableMajestySaveDc('Paladin', 'Campaign')).toBe(0)
  })

  it('coerces a truthy string to its numeric value', () => {
    getRuntimeValue.mockReturnValue('18')
    expect(getUnbreakableMajestySaveDc('Paladin', 'Campaign')).toBe(18)
  })

  it('calls getRuntimeValue with the correct key and arguments', () => {
    getRuntimeValue.mockReturnValue(null)
    getUnbreakableMajestySaveDc('MyPaladin', 'MyCampaign')
    expect(getRuntimeValue).toHaveBeenCalledWith(
      'MyPaladin',
      'unbreakableMajestySaveDc',
      'MyCampaign',
    )
  })
})

describe('clearUnbreakableMajesty', () => {
  beforeEach(() => {
    setRuntimeValue.mockReset()
  })

  it('calls setRuntimeValue for both majesty keys with null', () => {
    clearUnbreakableMajesty('Paladin', 'Campaign')

    expect(setRuntimeValue).toHaveBeenNthCalledWith(1, 'Paladin', 'unbreakableMajestyActive', null, 'Campaign')
    expect(setRuntimeValue).toHaveBeenNthCalledWith(2, 'Paladin', 'unbreakableMajestySaveDc', null, 'Campaign')
  })

  it('calls setRuntimeValue twice', () => {
    clearUnbreakableMajesty('MyPaladin', 'MyCampaign')
    expect(setRuntimeValue).toHaveBeenCalledTimes(2)
  })
})

describe('hasAttackerTriggeredMajesty', () => {
  beforeEach(() => {
    getRuntimeValue.mockReset()
    getCurrentCombatRound.mockReset()
  })

  it('returns true when stored round matches current combat round', () => {
    getCurrentCombatRound.mockReturnValue(3)
    getRuntimeValue.mockReturnValue({ round: 3 })
    expect(hasAttackerTriggeredMajesty('Paladin', 'Goblin', 'Campaign')).toBe(true)
  })

  it('returns false when stored round does not match current combat round', () => {
    getCurrentCombatRound.mockReturnValue(4)
    getRuntimeValue.mockReturnValue({ round: 3 })
    expect(hasAttackerTriggeredMajesty('Paladin', 'Goblin', 'Campaign')).toBe(false)
  })

  it('returns false when stored value is null (not triggered yet)', () => {
    getCurrentCombatRound.mockReturnValue(3)
    getRuntimeValue.mockReturnValue(null)
    expect(hasAttackerTriggeredMajesty('Paladin', 'Goblin', 'Campaign')).toBe(false)
  })

  it('returns false when stored value is undefined', () => {
    getCurrentCombatRound.mockReturnValue(3)
    getRuntimeValue.mockReturnValue(undefined)
    expect(hasAttackerTriggeredMajesty('Paladin', 'Goblin', 'Campaign')).toBe(false)
  })

  it('calls getCurrentCombatRound exactly once', () => {
    getCurrentCombatRound.mockReturnValue(1)
    getRuntimeValue.mockReturnValue(null)
    hasAttackerTriggeredMajesty('Paladin', 'Orc', 'Campaign')
    expect(getCurrentCombatRound).toHaveBeenCalledTimes(1)
  })

  it('calls getRuntimeValue with the prefixed key for the attacker', () => {
    getCurrentCombatRound.mockReturnValue(1)
    getRuntimeValue.mockReturnValue(null)
    hasAttackerTriggeredMajesty('Paladin', 'Orc', 'Campaign')
    expect(getRuntimeValue).toHaveBeenCalledWith(
      'Paladin',
      'unbreakableMajestyBlocked_Orc',
      'Campaign',
    )
  })

  it('uses attacker-specific key (different attackers have separate trackers)', () => {
    getCurrentCombatRound.mockReturnValue(3)
    getRuntimeValue.mockImplementation((_, key) =>
      key === 'unbreakableMajestyBlocked_Goblin' ? { round: 3 } : null,
    )

    expect(hasAttackerTriggeredMajesty('Paladin', 'Goblin', 'Campaign')).toBe(true)
    getRuntimeValue.mockClear()

    getCurrentCombatRound.mockReturnValue(3)
    expect(hasAttackerTriggeredMajesty('Paladin', 'Orc', 'Campaign')).toBe(false)
  })
})

describe('markAttackerTriggeredMajesty', () => {
  beforeEach(() => {
    setRuntimeValue.mockReset()
    getCurrentCombatRound.mockReset()
  })

  it('marks the attacker with current round data', () => {
    getCurrentCombatRound.mockReturnValue(5)
    markAttackerTriggeredMajesty('Paladin', 'Goblin', 'Campaign')
    expect(setRuntimeValue).toHaveBeenCalledWith(
      'Paladin',
      'unbreakableMajestyBlocked_Goblin',
      { round: 5 },
      'Campaign',
    )
  })

  it('calls getCurrentCombatRound exactly once', () => {
    getCurrentCombatRound.mockReturnValue(2)
    markAttackerTriggeredMajesty('Paladin', 'Goblin', 'Campaign')
    expect(getCurrentCombatRound).toHaveBeenCalledTimes(1)
  })

  it('calls setRuntimeValue exactly once', () => {
    getCurrentCombatRound.mockReturnValue(1)
    markAttackerTriggeredMajesty('Paladin', 'Orc', 'Campaign')
    expect(setRuntimeValue).toHaveBeenCalledTimes(1)
  })

  it('uses correct key for given attacker name', () => {
    getCurrentCombatRound.mockReturnValue(3)
    markAttackerTriggeredMajesty('MyPaladin', 'Drake', 'MyCampaign')
    expect(setRuntimeValue).toHaveBeenCalledWith(
      'MyPaladin',
      'unbreakableMajestyBlocked_Drake',
      { round: 3 },
      'MyCampaign',
    )
  })
})

describe('clearPerRoundMajestyTrackers', () => {
  beforeEach(() => {
    getRuntimeValue.mockReset()
    setRuntimeValue.mockReset()
    getCurrentCombatRound.mockReset()
    window.localStorage.clear()
   })

  it('clears trailers whose stored round does not match current round', () => {
    getCurrentCombatRound.mockReturnValue(3)

    const fakeKeys = [
        'runtime:Campaign:Paladin:unbreakableMajestyBlocked_Goblin',
        'runtime:Campaign:Paladin:unbreakableMajestyBlocked_Orc',
      ]
    vi.spyOn(Object, 'keys').mockReturnValue(fakeKeys)

      // simulate old round 1 for Goblin, current match for Orc
    getRuntimeValue.mockImplementation((_, key) => {
      if (key === 'unbreakableMajestyBlocked_Goblin') return { round: 1 }
      if (key === 'unbreakableMajestyBlocked_Orc') return { round: 3 }
      return null
      })

    clearPerRoundMajestyTrackers('Paladin', 'Campaign')

      // Only Goblin should be cleared (round mismatch)
    expect(setRuntimeValue).toHaveBeenCalledWith(
        'Paladin',
        'unbreakableMajestyBlocked_Goblin',
      null,
        'Campaign',
      )
    expect(setRuntimeValue).not.toHaveBeenCalledWith(
        'Paladin',
        'unbreakableMajestyBlocked_Orc',
      null,
        'Campaign',
      )
    })

  it('does nothing when all stored rounds match current round', () => {
    getCurrentCombatRound.mockReturnValue(2)

    const fakeKeys = [
         'runtime:Campaign:Paladin:unbreakableMajestyBlocked_Goblin',
       ]
    vi.spyOn(Object, 'keys').mockReturnValue(fakeKeys)

    getRuntimeValue.mockImplementation(() => ({ round: 2 }))

    clearPerRoundMajestyTrackers('Paladin', 'Campaign')
    expect(setRuntimeValue).not.toHaveBeenCalled()
    })

  it('does not clear when stored value is null or falsy', () => {
    getCurrentCombatRound.mockReturnValue(3)

    const fakeKeys = [
         'runtime:Campaign:Paladin:unbreakableMajestyBlocked_Goblin',
       ]
    vi.spyOn(Object, 'keys').mockReturnValue(fakeKeys)

    getRuntimeValue.mockImplementation(() => null)

    clearPerRoundMajestyTrackers('Paladin', 'Campaign')
    expect(setRuntimeValue).not.toHaveBeenCalled()
    })

  it('skips localStorage keys that do not match the expected prefix', () => {
    getCurrentCombatRound.mockReturnValue(1)

    const fakeKeys = [
         'someOtherKey',
         'runtime:Campaign:Paladin:someFeature',
         'runtime:OtherCampaign:Paladin:unbreakableMajestyBlocked_Goblin',
       ]
    vi.spyOn(Object, 'keys').mockReturnValue(fakeKeys)

    clearPerRoundMajestyTrackers('Paladin', 'Campaign')
    expect(getRuntimeValue).not.toHaveBeenCalled()
    expect(setRuntimeValue).not.toHaveBeenCalled()
    })

  it('swallows and ignores errors gracefully', () => {
    getCurrentCombatRound.mockReturnValue(1)
    vi.spyOn(Object, 'keys').mockImplementation(() => {
      throw new Error('storage crash')
     })

     // Should not re-throw
    expect(() => clearPerRoundMajestyTrackers('Paladin', 'Campaign')).not.toThrow()
   })

  it('handles empty localStorage (no matching keys)', () => {
    getCurrentCombatRound.mockReturnValue(1)
    vi.spyOn(Object, 'keys').mockReturnValue([])

    clearPerRoundMajestyTrackers('Paladin', 'Campaign')
    expect(getRuntimeValue).not.toHaveBeenCalled()
    expect(setRuntimeValue).not.toHaveBeenCalled()
     })

  it('calls getCurrentCombatRound exactly once', () => {
    getCurrentCombatRound.mockReturnValue(1)
    vi.spyOn(Object, 'keys').mockReturnValue([])

    clearPerRoundMajestyTrackers('Paladin', 'Campaign')
    expect(getCurrentCombatRound).toHaveBeenCalledTimes(1)
     })

  it('handles multiple keys with mixed matching rounds', () => {
    getCurrentCombatRound.mockReturnValue(4)

    const fakeKeys = [
          'runtime:Campaign:Paladin:unbreakableMajestyBlocked_A',
          'runtime:Campaign:Paladin:unbreakableMajestyBlocked_B',
          'runtime:Campaign:Paladin:unbreakableMajestyBlocked_C',
        ]
    vi.spyOn(Object, 'keys').mockReturnValue(fakeKeys)

    getRuntimeValue.mockImplementation((_, key) => {
      if (key === 'unbreakableMajestyBlocked_A') return { round: 3 } // outdated → clear
      if (key === 'unbreakableMajestyBlocked_B') return { round: 4 } // current → keep
      if (key === 'unbreakableMajestyBlocked_C') return null          // falsy → skip
      return null
       })

    clearPerRoundMajestyTrackers('Paladin', 'Campaign')
    expect(setRuntimeValue).toHaveBeenCalledTimes(1)
    expect(setRuntimeValue).toHaveBeenCalledWith(
          'Paladin',
          'unbreakableMajestyBlocked_A',
        null,
          'Campaign',
        )
     })
})

describe('buildMajestyPromptData', () => {
  it('returns an object with targetName, saveType CHA, saveDc, and sourceName', () => {
    const result = buildMajestyPromptData('Paladin', 'Goblin', 15)
    expect(result).toEqual({
      targetName: 'Goblin',
      saveType: 'CHA',
      saveDc: 15,
      sourceName: 'Paladin',
    })
  })

  it('uses defenderName as sourceName and attackerName as targetName', () => {
    const result = buildMajestyPromptData('My Paladin', 'Dragon', 20)
    expect(result.sourceName).toBe('My Paladin')
    expect(result.targetName).toBe('Dragon')
  })

  it('sets saveType to CHA regardless of inputs', () => {
    const result = buildMajestyPromptData('Paladin', 'Goblin', 10)
    expect(result.saveType).toBe('CHA')
  })

  it('passes through the saveDc value unchanged', () => {
    const result = buildMajestyPromptData('Paladin', 'Goblin', 25)
    expect(result.saveDc).toBe(25)
  })
})
