import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  getHitDieSize,
  computeHitDieRecovery,
  computeShortRestHpNewCurrent,
  SHORT_REST_RESOURCES,
  getShortRestResources,
  LONG_REST_RESOURCES,
  getLongRestResources,
  spellSlotLevels,
  applyShortRest,
  applyLongRest
} from './restRules.js'

// Mock useRuntimeState before importing restRules
vi.mock('../hooks/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
  setRuntimeBatch: vi.fn(),
}))

import { getRuntimeValue, setRuntimeBatch } from '../hooks/useRuntimeState.js'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('getHitDieSize', () => {
  it('returns class hit die when class_levels exists', () => {
    const playerStats = {
      level: 3,
      class: {
        class_levels: [{ hit_die: 6 }, { hit_die: 6 }, { hit_die: 8 }]
      }
    }
    expect(getHitDieSize(playerStats)).toBe(8)
  })

  it('returns default 8 when no class data', () => {
    expect(getHitDieSize({ level: 1 })).toBe(8)
  })

  it('returns default 8 when class_levels is missing', () => {
    const playerStats = { level: 1, class: {} }
    expect(getHitDieSize(playerStats)).toBe(8)
  })

  it('returns d4 for caster at level 1', () => {
    const playerStats = {
      level: 1,
      class: {
        class_levels: [{ hit_die: 6 }]
      }
    }
    expect(getHitDieSize(playerStats)).toBe(6)
  })

  it('returns d8 for martial class at level 1', () => {
    const playerStats = {
      level: 1,
      class: {
        class_levels: [{ hit_die: 8 }]
      }
    }
    expect(getHitDieSize(playerStats)).toBe(8)
  })
})

describe('computeHitDieRecovery', () => {
  it('returns roll + con bonus when positive', () => {
    expect(computeHitDieRecovery(5, 2)).toBe(7)
  })

  it('returns 1 when total is zero or negative', () => {
    expect(computeHitDieRecovery(1, -2)).toBe(1)
    expect(computeHitDieRecovery(3, -3)).toBe(1)
  })

  it('returns roll when con bonus is zero', () => {
    expect(computeHitDieRecovery(4, 0)).toBe(4)
  })

  it('handles negative roll edge case', () => {
    expect(computeHitDieRecovery(-10, -5)).toBe(1)
  })
})

describe('computeShortRestHpNewCurrent', () => {
  it('caps at max hp when recovery exceeds remaining', () => {
    expect(computeShortRestHpNewCurrent(20, 30, 25)).toBe(30)
  })

  it('adds recovery to current hp normally', () => {
    expect(computeShortRestHpNewCurrent(20, 30, 5)).toBe(25)
  })

  it('uses max hp as base when current is null', () => {
    expect(computeShortRestHpNewCurrent(null, 30, 5)).toBe(30)
  })

  it('uses max hp as base when current is empty string', () => {
    expect(computeShortRestHpNewCurrent('', 30, 5)).toBe(30)
  })

  it('handles zero recovery amount', () => {
    expect(computeShortRestHpNewCurrent(20, 30, 0)).toBe(20)
  })

  it('handles undefined recovery amount as zero', () => {
    expect(computeShortRestHpNewCurrent(15, 30, undefined)).toBe(15)
  })
})

describe('SHORT_REST_RESOURCES', () => {
  it('contains expected resource keys', () => {
    expect(SHORT_REST_RESOURCES).toContain('channelDivinityCharges')
    expect(SHORT_REST_RESOURCES).toContain('wildShapeUses')
    expect(SHORT_REST_RESOURCES).toContain('secondwindUses')
    expect(SHORT_REST_RESOURCES).toContain('psionicEnergy')
    expect(SHORT_REST_RESOURCES).toContain('focusPoints')
  })

  it('has at least 5 entries', () => {
    expect(SHORT_REST_RESOURCES.length).toBeGreaterThanOrEqual(5)
  })
})

describe('getShortRestResources', () => {
  it('returns array matching SHORT_REST_RESOURCES', () => {
    expect(getShortRestResources()).toEqual(SHORT_REST_RESOURCES)
  })

  it('returns a new array each call', () => {
    const a = getShortRestResources()
    const b = getShortRestResources()
    expect(a).not.toBe(b)
  })
})

describe('LONG_REST_RESOURCES', () => {
  it('contains expected resource keys', () => {
    expect(LONG_REST_RESOURCES).toContain('ragePoints')
    expect(LONG_REST_RESOURCES).toContain('bardicInspirationUses')
    expect(LONG_REST_RESOURCES).toContain('channelDivinityCharges')
    expect(LONG_REST_RESOURCES).toContain('wildShapeUses')
    expect(LONG_REST_RESOURCES).toContain('secondwindUses')
    expect(LONG_REST_RESOURCES).toContain('psionicEnergy')
    expect(LONG_REST_RESOURCES).toContain('focusPoints')
    expect(LONG_REST_RESOURCES).toContain('sorceryPoints')
    expect(LONG_REST_RESOURCES).toContain('arcaneRecoveryLevels')
  })

  it('has at least 9 entries', () => {
    expect(LONG_REST_RESOURCES.length).toBeGreaterThanOrEqual(9)
  })
})

describe('getLongRestResources', () => {
  it('returns array matching LONG_REST_RESOURCES', () => {
    expect(getLongRestResources()).toEqual(LONG_REST_RESOURCES)
  })

  it('returns a new array each call', () => {
    const a = getLongRestResources()
    const b = getLongRestResources()
    expect(a).not.toBe(b)
  })
})

describe('spellSlotLevels', () => {
  it('returns levels 1 through 9', () => {
    expect(spellSlotLevels()).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9])
  })
})

describe('applyShortRest', () => {
  it('resets short rest resources to null via setRuntimeBatch', () => {
    const playerStats = { name: 'Frog', hitPoints: 30, level: 5 }
    getRuntimeValue.mockReturnValue(20)
    applyShortRest(playerStats, 'Campaign1')

    expect(getRuntimeValue).toHaveBeenCalledWith('Frog', 'currentHitPoints')
    expect(setRuntimeBatch).toHaveBeenCalledTimes(1)
    const data = setRuntimeBatch.mock.calls[0][1]
    SHORT_REST_RESOURCES.forEach((key) => {
      expect(data[key]).toBeNull()
    })
  })

  it('preserves current hp when no recovery passed', () => {
    const playerStats = { name: 'Frog', hitPoints: 30 }
    getRuntimeValue.mockReturnValue(20)
    applyShortRest(playerStats, 'Campaign1')
    
    const data = setRuntimeBatch.mock.calls[0][1]
    expect(data.currentHitPoints).toBe(20)
    expect(setRuntimeBatch.mock.calls[0][2]).toBe('Campaign1')
  })

  it('uses campaign name in all storage calls', () => {
    const playerStats = { name: 'Grog', hitPoints: 40 }
    getRuntimeValue.mockReturnValue(30)
    applyShortRest(playerStats, 'MyCampaign')

    expect(setRuntimeBatch).toHaveBeenCalledWith('Grog', expect.any(Object), 'MyCampaign')
  })
})

describe('applyLongRest', () => {
  it('performs a single atomic setRuntimeBatch with all changes', () => {
    const playerStats = { name: 'Frog', hitPoints: 50, level: 10 }
    getRuntimeValue.mockReturnValue(null)
    applyLongRest(playerStats, 'C1')

    expect(setRuntimeBatch).toHaveBeenCalledTimes(1)
    const callArgs = setRuntimeBatch.mock.calls[0]
    expect(callArgs[0]).toBe('Frog')
    expect(callArgs[1].currentHitPoints).toBe(50)
    expect(callArgs[1].shortRestHitDice).toBe(10)
    expect(callArgs[2]).toBe('C1')
  })

  it('restores spell slots to max when spellAbilities exists', () => {
    const playerStats = {
      name: 'Frog',
      hitPoints: 50,
      level: 5,
      spellAbilities: {
        spell_slots_level_1: 4,
        spell_slots_level_2: 3,
        spell_slots_level_3: 0
      }
    }
    getRuntimeValue.mockReturnValue(null)
    applyLongRest(playerStats, 'C1')

    const data = setRuntimeBatch.mock.calls[0][1]
    expect(data.spell_slots_level_1).toBe(4)
    expect(data.spell_slots_level_2).toBe(3)
    expect(data.spell_slots_level_3).toBe(0)
  })

  it('does not set spell slots when no spellAbilities', () => {
    const playerStats = { name: 'Barb', hitPoints: 60, level: 8 }
    getRuntimeValue.mockReturnValue(null)
    applyLongRest(playerStats, 'C1')

    const data = setRuntimeBatch.mock.calls[0][1]
    expect(data.spell_slots_level_1).toBeUndefined()
  })

  it('resets long rest resources to null', () => {
    const playerStats = { name: 'Frog', hitPoints: 50, level: 5 }
    getRuntimeValue.mockReturnValue(null)
    applyLongRest(playerStats, 'C1')

    const data = setRuntimeBatch.mock.calls[0][1]
    LONG_REST_RESOURCES.forEach((key) => {
      expect(data[key]).toBeNull()
    })
  })

  it('reduces exhaustion by one', () => {
    const playerStats = { name: 'Frog', hitPoints: 50, level: 5 }
    getRuntimeValue.mockReturnValue(3)
    applyLongRest(playerStats, 'C1')

    const data = setRuntimeBatch.mock.calls[0][1]
    expect(data.exhaustionLevel).toBe(2)
  })

  it('keeps exhaustion at 0 when already at 0', () => {
    const playerStats = { name: 'Frog', hitPoints: 50, level: 5 }
    getRuntimeValue.mockReturnValue(0)
    applyLongRest(playerStats, 'C1')

    // When exhaustion is 0, the key should not be in the data
    const data = setRuntimeBatch.mock.calls[0][1]
    expect(data.exhaustionLevel).toBeUndefined()
  })

  it('skips exhaustion update when value is null', () => {
    const playerStats = { name: 'Frog', hitPoints: 50, level: 5 }
    getRuntimeValue.mockReturnValue(null)
    applyLongRest(playerStats, 'C1')

    const data = setRuntimeBatch.mock.calls[0][1]
    expect(data.exhaustionLevel).toBeUndefined()
  })

  it('reduces exhaustion from level 1 to 0', () => {
    const playerStats = { name: 'Frog', hitPoints: 50, level: 5 }
    getRuntimeValue.mockReturnValue(1)
    applyLongRest(playerStats, 'C1')

    const data = setRuntimeBatch.mock.calls[0][1]
    expect(data.exhaustionLevel).toBe(0)
  })

  it('sets hasInspiration when character has Resourceful trait', () => {
    const playerStats = {
      name: 'Frog',
      hitPoints: 50,
      level: 5,
      characterAdvancement: [
        { name: 'Resourceful', description: 'Heroic Inspiration on Long Rest' }
      ]
    }
    getRuntimeValue.mockReturnValue(null)
    applyLongRest(playerStats, 'C1')

    const data = setRuntimeBatch.mock.calls[0][1]
    expect(data.hasInspiration).toBe(true)
  })

  it('does not set hasInspiration when character lacks Resourceful trait', () => {
    const playerStats = {
      name: 'Frog',
      hitPoints: 50,
      level: 5,
      characterAdvancement: [
        { name: 'Brave', description: 'Advantage vs frightened' }
      ]
    }
    getRuntimeValue.mockReturnValue(null)
    applyLongRest(playerStats, 'C1')

    const data = setRuntimeBatch.mock.calls[0][1]
    expect(data.hasInspiration).toBeUndefined()
  })

  it('does not set hasInspiration when characterAdvancement is missing', () => {
    const playerStats = { name: 'Frog', hitPoints: 50, level: 5 }
    getRuntimeValue.mockReturnValue(null)
    applyLongRest(playerStats, 'C1')

    const data = setRuntimeBatch.mock.calls[0][1]
    expect(data.hasInspiration).toBeUndefined()
  })
})
