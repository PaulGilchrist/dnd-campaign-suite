// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mock BEFORE imports (hoisted by vitest) ───────────────────────
vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}))

import {
  getActiveBuffs,
  isInnateSorceryActive,
  getInnateSorceryBonus,
  setInnateSorceryActive,
} from './buffService.js'

import {
  getRuntimeValue,
  setRuntimeValue,
} from '../../../hooks/runtime/useRuntimeState.js'

const PLAYER = 'Grog the Barbarian'
const CAMPAIGN = 'Forgotten Realms'

describe('getActiveBuffs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns the buffs array from runtime state when valid', () => {
    const buffs = [{ name: 'Darkness' }, { name: 'Haste' }]
    getRuntimeValue.mockReturnValue(buffs)

    const result = getActiveBuffs(PLAYER, CAMPAIGN)

    expect(result).toBe(buffs)
    expect(getRuntimeValue).toHaveBeenCalledWith(PLAYER, 'activeBuffs')
  })

  it('returns empty array when runtime state has no buffs (null)', () => {
    getRuntimeValue.mockReturnValue(null)
    expect(getActiveBuffs(PLAYER, CAMPAIGN)).toEqual([])
  })

  it('returns empty array when runtime state has no buffs (undefined)', () => {
    getRuntimeValue.mockReturnValue(undefined)
    expect(getActiveBuffs(PLAYER, CAMPAIGN)).toEqual([])
  })

  it('returns empty array when runtime state holds a non-array value', () => {
    getRuntimeValue.mockReturnValue('not-an-array')
    expect(getActiveBuffs(PLAYER, CAMPAIGN)).toEqual([])
  })

  it('does not write to runtime state', () => {
    getRuntimeValue.mockReturnValue([])
    getActiveBuffs(PLAYER, CAMPAIGN)
    expect(setRuntimeValue).not.toHaveBeenCalled()
  })
})

describe('isInnateSorceryActive', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns true when Innate Sorcery buff is present by exact name', () => {
    getRuntimeValue.mockReturnValue([{ name: 'Innate Sorcery' }])
    expect(isInnateSorceryActive(PLAYER, CAMPAIGN)).toBe(true)
  })

  it('returns true when Innate Sorcery is among other buffs', () => {
    getRuntimeValue.mockReturnValue([
      { name: 'Darkness' },
      { name: 'Innate Sorcery', effect: 'innate_sorcery_active' },
    ])
    expect(isInnateSorceryActive(PLAYER, CAMPAIGN)).toBe(true)
  })

  it('returns false when no buffs exist', () => {
    getRuntimeValue.mockReturnValue([])
    expect(isInnateSorceryActive(PLAYER, CAMPAIGN)).toBe(false)
  })

  it('returns false when runtime state is null', () => {
    getRuntimeValue.mockReturnValue(null)
    expect(isInnateSorceryActive(PLAYER, CAMPAIGN)).toBe(false)
  })

  it('does not match partial names', () => {
    getRuntimeValue.mockReturnValue([{ name: 'Innate' }])
    expect(isInnateSorceryActive(PLAYER, CAMPAIGN)).toBe(false)
  })

  it('does not match a name that only contains the keyword', () => {
    getRuntimeValue.mockReturnValue([{ name: 'Sorcery' }])
    expect(isInnateSorceryActive(PLAYER, CAMPAIGN)).toBe(false)
  })

  it('reads from the activeBuffs key in runtime state', () => {
    getRuntimeValue.mockReturnValue([])
    isInnateSorceryActive(PLAYER, CAMPAIGN)
    expect(getRuntimeValue).toHaveBeenCalledWith(PLAYER, 'activeBuffs')
  })
})

describe('getInnateSorceryBonus', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns saveDcBonus of 1 and spellAdvantage true when Innate Sorcery is active', () => {
    getRuntimeValue.mockReturnValue([{ name: 'Innate Sorcery' }])
    expect(getInnateSorceryBonus(PLAYER, CAMPAIGN)).toEqual({
      saveDcBonus: 1,
      spellAdvantage: true,
    })
  })

  it('returns saveDcBonus of 0 and spellAdvantage false when Innate Sorcery is inactive', () => {
    getRuntimeValue.mockReturnValue([])
    expect(getInnateSorceryBonus(PLAYER, CAMPAIGN)).toEqual({
      saveDcBonus: 0,
      spellAdvantage: false,
    })
  })

  it('returns zeroed bonus when runtime state is null', () => {
    getRuntimeValue.mockReturnValue(null)
    expect(getInnateSorceryBonus(PLAYER, CAMPAIGN)).toEqual({
      saveDcBonus: 0,
      spellAdvantage: false,
    })
  })

  it('reads from the activeBuffs key in runtime state', () => {
    getRuntimeValue.mockReturnValue([])
    getInnateSorceryBonus(PLAYER, CAMPAIGN)
    expect(getRuntimeValue).toHaveBeenCalledWith(PLAYER, 'activeBuffs')
  })
})

describe('setInnateSorceryActive', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('activating', () => {
    it('adds Innate Sorcery buff when not already present', () => {
      getRuntimeValue.mockReturnValue([{ name: 'Darkness' }])
      setInnateSorceryActive(PLAYER, true, CAMPAIGN)

      expect(setRuntimeValue).toHaveBeenCalledWith(
        PLAYER,
        'activeBuffs',
        [
          { name: 'Darkness' },
          { name: 'Innate Sorcery', effect: 'innate_sorcery_active', duration: '1 minute' },
        ],
        CAMPAIGN,
      )
    })

    it('wraps Innate Sorcery in a new array when adding', () => {
      const originalBuffs = [{ name: 'Darkness' }]
      getRuntimeValue.mockReturnValue(originalBuffs)
      setInnateSorceryActive(PLAYER, true, CAMPAIGN)

      const [, , newBuffs] = setRuntimeValue.mock.calls[0]
      expect(newBuffs).not.toBe(originalBuffs)
    })

    it('creates a new array starting from empty when no buffs exist', () => {
      const originalBuffs = []
      getRuntimeValue.mockReturnValue(originalBuffs)
      setInnateSorceryActive(PLAYER, true, CAMPAIGN)

      const [, , newBuffs] = setRuntimeValue.mock.calls[0]
      expect(newBuffs).not.toBe(originalBuffs)
      expect(newBuffs).toEqual([{ name: 'Innate Sorcery', effect: 'innate_sorcery_active', duration: '1 minute' }])
    })

    it('does not add a duplicate when Innate Sorcery already exists', () => {
      const existingBuffs = [
        { name: 'Innate Sorcery', effect: 'innate_sorcery_active', duration: '1 minute' },
      ]
      getRuntimeValue.mockReturnValue(existingBuffs)
      setInnateSorceryActive(PLAYER, true, CAMPAIGN)

      expect(setRuntimeValue).toHaveBeenCalledWith(
        PLAYER,
        'activeBuffs',
        existingBuffs,
        CAMPAIGN,
      )
    })

    it('treats null runtime state as empty and adds Innate Sorcery', () => {
      getRuntimeValue.mockReturnValue(null)
      setInnateSorceryActive(PLAYER, true, CAMPAIGN)

      expect(setRuntimeValue).toHaveBeenCalledWith(
        PLAYER,
        'activeBuffs',
        [{ name: 'Innate Sorcery', effect: 'innate_sorcery_active', duration: '1 minute' }],
        CAMPAIGN,
      )
    })
  })

  describe('deactivating', () => {
    it('removes Innate Sorcery when present among other buffs', () => {
      getRuntimeValue.mockReturnValue([
        { name: 'Darkness' },
        { name: 'Innate Sorcery', effect: 'innate_sorcery_active', duration: '1 minute' },
      ])
      setInnateSorceryActive(PLAYER, false, CAMPAIGN)

      expect(setRuntimeValue).toHaveBeenCalledWith(
        PLAYER,
        'activeBuffs',
        [{ name: 'Darkness' }],
        CAMPAIGN,
      )
    })

    it('clears the array when Innate Sorcery is the only buff', () => {
      getRuntimeValue.mockReturnValue([
        { name: 'Innate Sorcery', effect: 'innate_sorcery_active', duration: '1 minute' },
      ])
      setInnateSorceryActive(PLAYER, false, CAMPAIGN)

      expect(setRuntimeValue).toHaveBeenCalledWith(
        PLAYER,
        'activeBuffs',
        [],
        CAMPAIGN,
      )
    })

    it('leaves other buffs unchanged when Innate Sorcery is not present', () => {
      const buffs = [{ name: 'Darkness' }, { name: 'Haste' }]
      getRuntimeValue.mockReturnValue(buffs)
      setInnateSorceryActive(PLAYER, false, CAMPAIGN)

      const [, , filteredBuffs] = setRuntimeValue.mock.calls[0]
      expect(filteredBuffs).toEqual([{ name: 'Darkness' }, { name: 'Haste' }])
    })

    it('writes an empty array when deactivating with no buffs', () => {
      getRuntimeValue.mockReturnValue([])
      setInnateSorceryActive(PLAYER, false, CAMPAIGN)

      expect(setRuntimeValue).toHaveBeenCalledWith(
        PLAYER,
        'activeBuffs',
        [],
        CAMPAIGN,
      )
    })
  })

  describe('general behavior', () => {
    it('reads activeBuffs before writing', () => {
      getRuntimeValue.mockReturnValue([])
      setInnateSorceryActive(PLAYER, true, CAMPAIGN)

      expect(getRuntimeValue).toHaveBeenCalledWith(PLAYER, 'activeBuffs')
    })

    it('passes arguments to setRuntimeValue in the correct order', () => {
      getRuntimeValue.mockReturnValue([])
      setInnateSorceryActive(PLAYER, true, CAMPAIGN)

      const [arg0, arg1, arg2, arg3] = setRuntimeValue.mock.calls[0]
      expect(arg0).toBe(PLAYER)
      expect(arg1).toBe('activeBuffs')
      expect(Array.isArray(arg2)).toBe(true)
      expect(arg3).toBe(CAMPAIGN)
    })
  })
})
