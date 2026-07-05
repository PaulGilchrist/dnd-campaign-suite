// @cleaned-by-ai
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

  it('returns true only when runtime value is strictly true', () => {
    getRuntimeValue.mockReturnValue(true)
    expect(isUnbreakableMajestyActive('Paladin', 'Campaign')).toBe(true)

    getRuntimeValue.mockReturnValue(false)
    expect(isUnbreakableMajestyActive('Paladin', 'Campaign')).toBe(false)

    getRuntimeValue.mockReturnValue(null)
    expect(isUnbreakableMajestyActive('Paladin', 'Campaign')).toBe(false)

    getRuntimeValue.mockReturnValue(undefined)
    expect(isUnbreakableMajestyActive('Paladin', 'Campaign')).toBe(false)

    // Truthy strings and numbers should not be treated as true
    getRuntimeValue.mockReturnValue('true')
    expect(isUnbreakableMajestyActive('Paladin', 'Campaign')).toBe(false)

    getRuntimeValue.mockReturnValue(1)
    expect(isUnbreakableMajestyActive('Paladin', 'Campaign')).toBe(false)
  })
})

describe('getUnbreakableMajestySaveDc', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns the numeric DC from runtime or coerces numeric strings', () => {
    getRuntimeValue.mockReturnValue(15)
    expect(getUnbreakableMajestySaveDc('Paladin', 'Campaign')).toBe(15)

    getRuntimeValue.mockReturnValue('18')
    expect(getUnbreakableMajestySaveDc('Paladin', 'Campaign')).toBe(18)
  })

  it('returns 0 when runtime value is null, undefined, or empty string', () => {
    getRuntimeValue.mockReturnValue(null)
    expect(getUnbreakableMajestySaveDc('Paladin', 'Campaign')).toBe(0)

    getRuntimeValue.mockReturnValue(undefined)
    expect(getUnbreakableMajestySaveDc('Paladin', 'Campaign')).toBe(0)

    getRuntimeValue.mockReturnValue('')
    expect(getUnbreakableMajestySaveDc('Paladin', 'Campaign')).toBe(0)
  })

  it('returns NaN for a non-numeric string via Number coercion', () => {
    getRuntimeValue.mockReturnValue('abc')
    expect(getUnbreakableMajestySaveDc('Paladin', 'Campaign')).toBeNaN()
  })
})

describe('clearUnbreakableMajesty', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('clears both the active flag and the save DC with correct arguments', () => {
    clearUnbreakableMajesty('Paladin', 'Campaign')

    expect(setRuntimeValue).toHaveBeenNthCalledWith(1, 'Paladin', 'unbreakableMajestyActive', null, 'Campaign')
    expect(setRuntimeValue).toHaveBeenNthCalledWith(2, 'Paladin', 'unbreakableMajestySaveDc', null, 'Campaign')

    vi.clearAllMocks()
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

  it('returns false when attacker triggered in a different round or has not triggered yet', () => {
    getCurrentCombatRound.mockReturnValue(4)
    getRuntimeValue.mockReturnValue({ round: 3 })
    expect(hasAttackerTriggeredMajesty('Paladin', 'Goblin', 'Campaign')).toBe(false)

    getCurrentCombatRound.mockReturnValue(3)
    getRuntimeValue.mockReturnValue(null)
    expect(hasAttackerTriggeredMajesty('Paladin', 'Goblin', 'Campaign')).toBe(false)

    getRuntimeValue.mockReturnValue(undefined)
    expect(hasAttackerTriggeredMajesty('Paladin', 'Goblin', 'Campaign')).toBe(false)

    getRuntimeValue.mockReturnValue({ other: 'data' })
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
})

describe('markAttackerTriggeredMajesty', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('marks the attacker with the current round using the correct storage key', () => {
    getCurrentCombatRound.mockReturnValue(5)
    markAttackerTriggeredMajesty('Paladin', 'Goblin', 'Campaign')
    expect(setRuntimeValue).toHaveBeenCalledWith(
      'Paladin',
      'unbreakableMajestyBlocked_Goblin',
      { round: 5 },
      'Campaign',
    )

    vi.clearAllMocks()
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

  it('clears outdated trackers and keeps current ones', () => {
    getCurrentCombatRound.mockReturnValue(3)

    const keyFn = vi.fn((i) => (i === 0 ? '0' : '1'))
    Object.defineProperty(window.localStorage, 'length', { value: 2, writable: true, configurable: true })
    Object.defineProperty(window.localStorage, 'key', { value: keyFn, writable: true, configurable: true })
    localStorage.__store = {
      'runtime:Campaign:Paladin:unbreakableMajestyBlocked_Goblin': JSON.stringify({ round: 1 }),
      'runtime:Campaign:Paladin:unbreakableMajestyBlocked_Orc': JSON.stringify({ round: 3 }),
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
  it('returns correct prompt data structure with attacker as target and defender as source', () => {
    const result = buildMajestyPromptData('Paladin', 'Goblin', 15)
    expect(result).toEqual({
      targetName: 'Goblin',
      saveType: 'CHA',
      saveDc: 15,
      sourceName: 'Paladin',
    })

    // Verify name swapping
    const result2 = buildMajestyPromptData('My Paladin', 'Dragon', 20)
    expect(result2.sourceName).toBe('My Paladin')
    expect(result2.targetName).toBe('Dragon')

    // Verify saveType is always CHA
    const result3 = buildMajestyPromptData('Paladin', 'Goblin', 10)
    expect(result3.saveType).toBe('CHA')

    // Verify saveDc passes through unchanged
    const result4 = buildMajestyPromptData('Paladin', 'Goblin', 25)
    expect(result4.saveDc).toBe(25)
  })
})
