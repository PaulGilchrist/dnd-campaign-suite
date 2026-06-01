import { describe, it, expect, vi } from 'vitest'
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
    expect(SHORT_REST_RESOURCES).toContain('secondWindUses')
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
    expect(LONG_REST_RESOURCES).toContain('secondWindUses')
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

function createMockStorage() {
  const store = {}
  return {
    getProperty: vi.fn((name, key) => store[name]?.[key]),
    setProperty: vi.fn((name, key, value) => {
      if (!store[name]) store[name] = {}
      store[name][key] = value
    })
  }
}

describe('applyShortRest', () => {
  it('resets short rest resources to null', () => {
    const playerStats = { name: 'Frog', hitPoints: 30, level: 5 }
    const storage = createMockStorage()
    applyShortRest(playerStats, 'Campaign1', storage)

    SHORT_REST_RESOURCES.forEach((key) => {
      expect(storage.setProperty).toHaveBeenCalledWith('Frog', key, null, 'Campaign1')
    })
  })

  it('preserves current hp when no recovery passed', () => {
    const playerStats = { name: 'Frog', hitPoints: 30 }
    const store = { Frog: { currentHitPoints: 20 } }
    const storage = {
      getProperty: vi.fn((name, key) => store[name]?.[key]),
      setProperty: vi.fn((name, key, value) => {
        if (!store[name]) store[name] = {}
        store[name][key] = value
       })
     }
    applyShortRest(playerStats, 'Campaign1', storage)
    expect(storage.setProperty).toHaveBeenCalledWith('Frog', 'currentHitPoints', 20, 'Campaign1')
    })

  it('uses campaign name in all storage calls', () => {
    const playerStats = { name: 'Grog', hitPoints: 40 }
    const storage = createMockStorage()
    applyShortRest(playerStats, 'MyCampaign', storage)

    expect(storage.setProperty).toHaveBeenCalledWith('Grog', expect.any(String), expect.anything(), 'MyCampaign')
  })
})

describe('applyLongRest', () => {
  it('restores currentHitPoints to max', () => {
    const playerStats = { name: 'Frog', hitPoints: 50, level: 10 }
    const storage = createMockStorage()
    applyLongRest(playerStats, 'C1', storage)

    expect(storage.setProperty).toHaveBeenCalledWith('Frog', 'currentHitPoints', 50, 'C1')
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
    const storage = createMockStorage()
    applyLongRest(playerStats, 'C1', storage)

    expect(storage.setProperty).toHaveBeenCalledWith('Frog', 'spell_slots_level_1', 4, 'C1')
    expect(storage.setProperty).toHaveBeenCalledWith('Frog', 'spell_slots_level_2', 3, 'C1')
    expect(storage.setProperty).toHaveBeenCalledWith('Frog', 'spell_slots_level_3', 0, 'C1')
     })

  it('skips spell slots when no spellAbilities', () => {
    const playerStats = { name: 'Barb', hitPoints: 60, level: 8 }
    const storage = createMockStorage()
    applyLongRest(playerStats, 'C1', storage)

    expect(storage.setProperty).not.toHaveBeenCalledWith('Barb', expect.stringMatching(/spell_slots/), expect.anything(), expect.anything())
  })

  it('restores hit dice to level', () => {
    const playerStats = { name: 'Frog', hitPoints: 50, level: 10 }
    const storage = createMockStorage()
    applyLongRest(playerStats, 'C1', storage)

    expect(storage.setProperty).toHaveBeenCalledWith('Frog', 'shortRestHitDice', 10, 'C1')
  })

  it('resets long rest resources to null', () => {
    const playerStats = { name: 'Frog', hitPoints: 50, level: 5 }
    const storage = createMockStorage()
    applyLongRest(playerStats, 'C1', storage)

    LONG_REST_RESOURCES.forEach((key) => {
      expect(storage.setProperty).toHaveBeenCalledWith('Frog', key, null, 'C1')
    })
  })

  it('reduces exhaustion by one', () => {
    const playerStats = { name: 'Frog', hitPoints: 50, level: 5 }
    const storage = createMockStorage()
    storage.getProperty.mockReturnValue(3)
    applyLongRest(playerStats, 'C1', storage)

    expect(storage.setProperty).toHaveBeenCalledWith('Frog', 'exhaustionLevel', 2, 'C1')
  })

  it('keeps exhaustion at 0 when already at 0', () => {
    const playerStats = { name: 'Frog', hitPoints: 50, level: 5 }
    const storage = createMockStorage()
    storage.getProperty.mockReturnValue(0)
    applyLongRest(playerStats, 'C1', storage)

    expect(storage.setProperty).not.toHaveBeenCalledWith('Frog', 'exhaustionLevel', expect.anything(), expect.anything())
  })

  it('skips exhaustion update when value is null', () => {
    const playerStats = { name: 'Frog', hitPoints: 50, level: 5 }
    const storage = createMockStorage()
    storage.getProperty.mockReturnValue(null)
    applyLongRest(playerStats, 'C1', storage)

    expect(storage.setProperty).not.toHaveBeenCalledWith('Frog', 'exhaustionLevel', expect.anything(), expect.anything())
  })

  it('reduces exhaustion from level 1 to 0', () => {
    const playerStats = { name: 'Frog', hitPoints: 50, level: 5 }
    const storage = createMockStorage()
    storage.getProperty.mockReturnValue(1)
    applyLongRest(playerStats, 'C1', storage)

    expect(storage.setProperty).toHaveBeenCalledWith('Frog', 'exhaustionLevel', 0, 'C1')
  })
})
