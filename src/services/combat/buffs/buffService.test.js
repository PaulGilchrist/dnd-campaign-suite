// @cleaned-by-ai
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
  beforeEach(() => vi.clearAllMocks())

  it('returns the buffs array from runtime state when valid', () => {
    const buffs = [{ name: 'Darkness' }, { name: 'Haste' }]
    getRuntimeValue.mockReturnValue(buffs)

    const result = getActiveBuffs(PLAYER, CAMPAIGN)

    expect(result).toBe(buffs)
    expect(getRuntimeValue).toHaveBeenCalledWith(PLAYER, 'activeBuffs')
  })

  it('returns empty array when runtime state has no buffs or a non-array value', () => {
    for (const val of [null, undefined, 'not-an-array', []]) {
      vi.clearAllMocks()
      getRuntimeValue.mockReturnValue(val)
      expect(getActiveBuffs(PLAYER, CAMPAIGN)).toEqual([])
    }
  })

  it('does not write to runtime state', () => {
    getRuntimeValue.mockReturnValue([])
    getActiveBuffs(PLAYER, CAMPAIGN)
    expect(setRuntimeValue).not.toHaveBeenCalled()
  })
})

describe('isInnateSorceryActive', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns true when Innate Sorcery buff is present', () => {
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

  it('returns false when no buffs exist or runtime state is null', () => {
    for (const val of [[], null]) {
      vi.clearAllMocks()
      getRuntimeValue.mockReturnValue(val)
      expect(isInnateSorceryActive(PLAYER, CAMPAIGN)).toBe(false)
    }
  })

  it('does not match partial names', () => {
    getRuntimeValue.mockReturnValue([{ name: 'Innate' }])
    expect(isInnateSorceryActive(PLAYER, CAMPAIGN)).toBe(false)
  })
})

describe('getInnateSorceryBonus', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns saveDcBonus of 1 and spellAdvantage true when Innate Sorcery is active', () => {
    getRuntimeValue.mockReturnValue([{ name: 'Innate Sorcery' }])
    expect(getInnateSorceryBonus(PLAYER, CAMPAIGN)).toEqual({
      saveDcBonus: 1,
      spellAdvantage: true,
    })
  })

  it('returns zeroed bonus when Innate Sorcery is inactive or runtime state is null', () => {
    for (const val of [[], null]) {
      vi.clearAllMocks()
      getRuntimeValue.mockReturnValue(val)
      expect(getInnateSorceryBonus(PLAYER, CAMPAIGN)).toEqual({
        saveDcBonus: 0,
        spellAdvantage: false,
      })
    }
  })
})

describe('setInnateSorceryActive', () => {
  beforeEach(() => vi.clearAllMocks())

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

    it('creates a new array when adding to empty or null state', () => {
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
    it('reads activeBuffs before writing and passes arguments in correct order', () => {
      getRuntimeValue.mockReturnValue([])
      setInnateSorceryActive(PLAYER, true, CAMPAIGN)

      expect(getRuntimeValue).toHaveBeenCalledWith(PLAYER, 'activeBuffs')

      const [arg0, arg1, arg2, arg3] = setRuntimeValue.mock.calls[0]
      expect(arg0).toBe(PLAYER)
      expect(arg1).toBe('activeBuffs')
      expect(Array.isArray(arg2)).toBe(true)
      expect(arg3).toBe(CAMPAIGN)
    })
  })
})
