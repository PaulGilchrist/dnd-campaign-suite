// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks BEFORE imports (hoisted by vitest) ───────────────────

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
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

import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js'
import { getCurrentCombatRound } from '../../encounters/combatData.js'

// ── Tests ───────────────────────────────────────────────────────

describe('isUnbreakableMajestyActive', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns true when runtime value is strictly true', () => {
    getRuntimeValue.mockReturnValue(true)
    expect(isUnbreakableMajestyActive('Paladin', 'Campaign')).toBe(true)
  })

  it('returns false when runtime value is false', () => {
    getRuntimeValue.mockReturnValue(false)
    expect(isUnbreakableMajestyActive('Paladin', 'Campaign')).toBe(false)
  })

  it('returns false when runtime value is null', () => {
    getRuntimeValue.mockReturnValue(null)
    expect(isUnbreakableMajestyActive('Paladin', 'Campaign')).toBe(false)
  })

  it('returns false when runtime value is undefined', () => {
    getRuntimeValue.mockReturnValue(undefined)
    expect(isUnbreakableMajestyActive('Paladin', 'Campaign')).toBe(false)
  })

  it('uses strict equality — does not treat truthy strings as true', () => {
    getRuntimeValue.mockReturnValue('true')
    expect(isUnbreakableMajestyActive('Paladin', 'Campaign')).toBe(false)
  })

  it('uses strict equality — does not treat 1 as true', () => {
    getRuntimeValue.mockReturnValue(1)
    expect(isUnbreakableMajestyActive('Paladin', 'Campaign')).toBe(false)
  })
})

describe('getUnbreakableMajestySaveDc', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns the numeric DC from runtime', () => {
    getRuntimeValue.mockReturnValue(15)
    expect(getUnbreakableMajestySaveDc('Paladin', 'Campaign')).toBe(15)
  })

  it('returns 0 when runtime value is null', () => {
    getRuntimeValue.mockReturnValue(null)
    expect(getUnbreakableMajestySaveDc('Paladin', 'Campaign')).toBe(0)
  })

  it('returns 0 when runtime value is undefined', () => {
    getRuntimeValue.mockReturnValue(undefined)
    expect(getUnbreakableMajestySaveDc('Paladin', 'Campaign')).toBe(0)
  })

  it('returns 0 when runtime value is an empty string', () => {
    getRuntimeValue.mockReturnValue('')
    expect(getUnbreakableMajestySaveDc('Paladin', 'Campaign')).toBe(0)
  })

  it('coerces a numeric string to its number', () => {
    getRuntimeValue.mockReturnValue('18')
    expect(getUnbreakableMajestySaveDc('Paladin', 'Campaign')).toBe(18)
  })

  it('returns NaN for a non-numeric string via Number coercion (|| 0 only catches nullish)', () => {
    getRuntimeValue.mockReturnValue('abc')
    expect(getUnbreakableMajestySaveDc('Paladin', 'Campaign')).toBeNaN()
  })
})

describe('clearUnbreakableMajesty', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('clears both the active flag and the save DC', () => {
    clearUnbreakableMajesty('Paladin', 'Campaign')

    expect(setRuntimeValue).toHaveBeenNthCalledWith(1, 'Paladin', 'unbreakableMajestyActive', null, 'Campaign')
    expect(setRuntimeValue).toHaveBeenNthCalledWith(2, 'Paladin', 'unbreakableMajestySaveDc', null, 'Campaign')
  })

  it('uses correct character and campaign names in calls', () => {
    clearUnbreakableMajesty('MyPaladin', 'MyCampaign')

    expect(setRuntimeValue).toHaveBeenNthCalledWith(1, 'MyPaladin', 'unbreakableMajestyActive', null, 'MyCampaign')
    expect(setRuntimeValue).toHaveBeenNthCalledWith(2, 'MyPaladin', 'unbreakableMajestySaveDc', null, 'MyCampaign')
  })
})

describe('hasAttackerTriggeredMajesty', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns true when attacker triggered in the current round', () => {
    getCurrentCombatRound.mockReturnValue(3)
    getRuntimeValue.mockReturnValue({ round: 3 })
    expect(hasAttackerTriggeredMajesty('Paladin', 'Goblin', 'Campaign')).toBe(true)
  })

  it('returns false when attacker triggered in a different round', () => {
    getCurrentCombatRound.mockReturnValue(4)
    getRuntimeValue.mockReturnValue({ round: 3 })
    expect(hasAttackerTriggeredMajesty('Paladin', 'Goblin', 'Campaign')).toBe(false)
  })

  it('returns false when attacker has not triggered yet (null stored value)', () => {
    getCurrentCombatRound.mockReturnValue(3)
    getRuntimeValue.mockReturnValue(null)
    expect(hasAttackerTriggeredMajesty('Paladin', 'Goblin', 'Campaign')).toBe(false)
  })

  it('returns false when stored value is undefined', () => {
    getCurrentCombatRound.mockReturnValue(3)
    getRuntimeValue.mockReturnValue(undefined)
    expect(hasAttackerTriggeredMajesty('Paladin', 'Goblin', 'Campaign')).toBe(false)
  })

  it('tracks attackers independently by name', () => {
    getCurrentCombatRound.mockReturnValue(3)
    getRuntimeValue.mockImplementation((_, key) =>
      key === 'unbreakableMajestyBlocked_Goblin' ? { round: 3 } : null,
    )

    expect(hasAttackerTriggeredMajesty('Paladin', 'Goblin', 'Campaign')).toBe(true)
    expect(hasAttackerTriggeredMajesty('Paladin', 'Orc', 'Campaign')).toBe(false)
  })

  it('returns false when stored value lacks a round property', () => {
    getCurrentCombatRound.mockReturnValue(3)
    getRuntimeValue.mockReturnValue({ other: 'data' })
    expect(hasAttackerTriggeredMajesty('Paladin', 'Goblin', 'Campaign')).toBe(false)
  })
})

describe('markAttackerTriggeredMajesty', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('marks the attacker with the current round', () => {
    getCurrentCombatRound.mockReturnValue(5)
    markAttackerTriggeredMajesty('Paladin', 'Goblin', 'Campaign')
    expect(setRuntimeValue).toHaveBeenCalledWith(
      'Paladin',
      'unbreakableMajestyBlocked_Goblin',
      { round: 5 },
      'Campaign',
    )
  })

  it('uses the attacker name in the storage key', () => {
    getCurrentCombatRound.mockReturnValue(3)
    markAttackerTriggeredMajesty('MyPaladin', 'Drake', 'MyCampaign')
    expect(setRuntimeValue).toHaveBeenCalledWith(
      'MyPaladin',
      'unbreakableMajestyBlocked_Drake',
      { round: 3 },
      'MyCampaign',
    )
  })

  it('uses the current round at call time, not a cached value', () => {
    getCurrentCombatRound.mockReturnValue(1)
    markAttackerTriggeredMajesty('Paladin', 'Goblin', 'Campaign')
    getCurrentCombatRound.mockReturnValue(99)
    // The stored value should be 1, not 99 — proving round is captured once
    expect(setRuntimeValue).toHaveBeenCalledWith(
      'Paladin',
      'unbreakableMajestyBlocked_Goblin',
      { round: 1 },
      'Campaign',
    )
  })
})

describe('clearPerRoundMajestyTrackers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.localStorage.clear()
  })

  it('clears trackers whose round does not match the current round', () => {
    getCurrentCombatRound.mockReturnValue(3)

    const keyFn = vi.fn((i) => (i === 0 ? '0' : '1'))
    Object.defineProperty(window.localStorage, 'length', { value: 2, writable: true, configurable: true })
    Object.defineProperty(window.localStorage, 'key', { value: keyFn, writable: true, configurable: true })
    localStorage.__store = {
      'runtime:Campaign:Paladin:unbreakableMajestyBlocked_Goblin': JSON.stringify({ round: 1 }),
      'runtime:Campaign:Paladin:unbreakableMajestyBlocked_Orc': JSON.stringify({ round: 3 }),
    }

    // Replace Object.keys to return our test keys
    const originalKeys = Object.keys
    Object.keys = (obj) => {
      if (obj === localStorage) return Object.keys(localStorage.__store)
      return originalKeys(obj)
    }

    getRuntimeValue.mockImplementation((_, key) => {
      const raw = localStorage.__store[`runtime:Campaign:Paladin:${key}`]
      return raw ? JSON.parse(raw) : null
    })

    clearPerRoundMajestyTrackers('Paladin', 'Campaign')

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

    Object.keys = originalKeys
  })

  it('keeps trackers whose round matches the current round', () => {
    getCurrentCombatRound.mockReturnValue(2)

    Object.defineProperty(window.localStorage, 'length', { value: 1, writable: true, configurable: true })
    const keyFn1 = vi.fn((i) => (i === 0 ? '0' : ''))
    Object.defineProperty(window.localStorage, 'key', { value: keyFn1, writable: true, configurable: true })
    localStorage.__store = {
      'runtime:Campaign:Paladin:unbreakableMajestyBlocked_Goblin': JSON.stringify({ round: 2 }),
    }

    const originalKeys = Object.keys
    Object.keys = (obj) => {
      if (obj === localStorage) return Object.keys(localStorage.__store)
      return originalKeys(obj)
    }

    getRuntimeValue.mockImplementation((_, key) => {
      const raw = localStorage.__store[`runtime:Campaign:Paladin:${key}`]
      return raw ? JSON.parse(raw) : null
    })

    clearPerRoundMajestyTrackers('Paladin', 'Campaign')
    expect(setRuntimeValue).not.toHaveBeenCalled()

    Object.keys = originalKeys
  })

  it('skips localStorage keys that do not match the expected prefix', () => {
    getCurrentCombatRound.mockReturnValue(1)

    Object.defineProperty(window.localStorage, 'length', { value: 3, writable: true, configurable: true })
    const keyFn2 = vi.fn((i) => (i < 3 ? String(i) : ''))
    Object.defineProperty(window.localStorage, 'key', { value: keyFn2, writable: true, configurable: true })
    localStorage.__store = {
      'someOtherKey': 'value',
      'runtime:Campaign:Paladin:someFeature': JSON.stringify({ round: 1 }),
      'runtime:OtherCampaign:Paladin:unbreakableMajestyBlocked_Goblin': JSON.stringify({ round: 1 }),
    }

    const originalKeys = Object.keys
    Object.keys = (obj) => {
      if (obj === localStorage) return Object.keys(localStorage.__store)
      return originalKeys(obj)
    }

    clearPerRoundMajestyTrackers('Paladin', 'Campaign')
    expect(getRuntimeValue).not.toHaveBeenCalled()
    expect(setRuntimeValue).not.toHaveBeenCalled()

    Object.keys = originalKeys
  })

  it('handles errors gracefully without throwing', () => {
    getCurrentCombatRound.mockReturnValue(1)

    const originalKeys = Object.keys
    Object.keys = () => {
      throw new Error('storage crash')
    }

    expect(() => clearPerRoundMajestyTrackers('Paladin', 'Campaign')).not.toThrow()

    Object.keys = originalKeys
  })

  it('handles empty localStorage without error', () => {
    getCurrentCombatRound.mockReturnValue(1)

    const originalKeys = Object.keys
    Object.keys = (obj) => {
      if (obj === localStorage) return []
      return originalKeys(obj)
    }

    clearPerRoundMajestyTrackers('Paladin', 'Campaign')
    expect(getRuntimeValue).not.toHaveBeenCalled()
    expect(setRuntimeValue).not.toHaveBeenCalled()

    Object.keys = originalKeys
  })

  it('clears only outdated trackers among many', () => {
    getCurrentCombatRound.mockReturnValue(4)

    Object.defineProperty(window.localStorage, 'length', { value: 3, writable: true, configurable: true })
    const keyFn3 = vi.fn((i) => String(i))
    Object.defineProperty(window.localStorage, 'key', { value: keyFn3, writable: true, configurable: true })
    localStorage.__store = {
      'runtime:Campaign:Paladin:unbreakableMajestyBlocked_A': JSON.stringify({ round: 3 }),
      'runtime:Campaign:Paladin:unbreakableMajestyBlocked_B': JSON.stringify({ round: 4 }),
      'runtime:Campaign:Paladin:unbreakableMajestyBlocked_C': JSON.stringify({ round: 2 }),
    }

    const originalKeys = Object.keys
    Object.keys = (obj) => {
      if (obj === localStorage) return Object.keys(localStorage.__store)
      return originalKeys(obj)
    }

    getRuntimeValue.mockImplementation((_, key) => {
      const raw = localStorage.__store[`runtime:Campaign:Paladin:${key}`]
      return raw ? JSON.parse(raw) : null
    })

    clearPerRoundMajestyTrackers('Paladin', 'Campaign')

    expect(setRuntimeValue).toHaveBeenCalledTimes(2)
    expect(setRuntimeValue).toHaveBeenCalledWith(
      'Paladin',
      'unbreakableMajestyBlocked_A',
      null,
      'Campaign',
    )
    expect(setRuntimeValue).toHaveBeenCalledWith(
      'Paladin',
      'unbreakableMajestyBlocked_C',
      null,
      'Campaign',
    )

    Object.keys = originalKeys
  })
})

describe('buildMajestyPromptData', () => {
  it('returns correct prompt data structure', () => {
    const result = buildMajestyPromptData('Paladin', 'Goblin', 15)
    expect(result).toEqual({
      targetName: 'Goblin',
      saveType: 'CHA',
      saveDc: 15,
      sourceName: 'Paladin',
    })
  })

  it('swaps defender and attacker names into sourceName and targetName', () => {
    const result = buildMajestyPromptData('My Paladin', 'Dragon', 20)
    expect(result.sourceName).toBe('My Paladin')
    expect(result.targetName).toBe('Dragon')
  })

  it('always uses CHA as the save type', () => {
    const result = buildMajestyPromptData('Paladin', 'Goblin', 10)
    expect(result.saveType).toBe('CHA')
  })

  it('passes the saveDc through unchanged', () => {
    const result = buildMajestyPromptData('Paladin', 'Goblin', 25)
    expect(result.saveDc).toBe(25)
  })
})
