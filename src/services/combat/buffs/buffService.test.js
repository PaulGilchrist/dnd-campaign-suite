import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mock BEFORE imports (hoisted by vitest) ───────────────────────
vi.mock('../../../hooks/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}))

import {
  getActiveBuffs,
  isInnateSorceryActive,
  getInnateSorceryBonus,
  setInnateSorceryActive,
} from './buffService.js'

// Re-import mocked functions after mock is hoisted so we can control them
import {
  getRuntimeValue,
  setRuntimeValue,
} from '../../../hooks/useRuntimeState.js'

const PLAYER = 'Grog the Barbarian'
const CAMPAIGN = 'Forgotten Realms'

describe('getActiveBuffs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    })

  it('calls getRuntimeValue with playerName and activeBuffs key', () => {
    getRuntimeValue.mockReturnValue([])
    getActiveBuffs(PLAYER, CAMPAIGN)
    expect(getRuntimeValue).toHaveBeenCalledWith(PLAYER, 'activeBuffs')
    })

  it('returns the buffs array when getRuntimeValue returns an array', () => {
    const buffs = [{ name: 'Darkness' }, { name: 'Haste' }]
    getRuntimeValue.mockReturnValue(buffs)
    const result = getActiveBuffs(PLAYER, CAMPAIGN)
    expect(result).toBe(buffs)
    })

  it('returns empty array when getRuntimeValue returns null', () => {
    getRuntimeValue.mockReturnValue(null)
    const result = getActiveBuffs(PLAYER, CAMPAIGN)
    expect(result).toEqual([])
    })

  it('returns empty array when getRuntimeValue returns undefined', () => {
    getRuntimeValue.mockReturnValue(undefined)
    const result = getActiveBuffs(PLAYER, CAMPAIGN)
    expect(result).toEqual([])
    })

  it('returns empty array when getRuntimeValue returns a non-array primitive', () => {
    getRuntimeValue.mockReturnValue('not-an-array')
    const result = getActiveBuffs(PLAYER, CAMPAIGN)
    expect(result).toEqual([])
    })

  it('does not call setRuntimeValue (read-only)', () => {
    getRuntimeValue.mockReturnValue([])
    getActiveBuffs(PLAYER, CAMPAIGN)
    expect(setRuntimeValue).not.toHaveBeenCalled()
    })
})

describe('isInnateSorceryActive', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    })

  it('returns true when Innate Sorcery is in active buffs', () => {
    getRuntimeValue.mockReturnValue([
        { name: 'Darkness' },
        { name: 'Innate Sorcery', effect: 'innate_sorcery_active' },
      ])
    const result = isInnateSorceryActive(PLAYER, CAMPAIGN)
    expect(result).toBe(true)
    })

  it('returns false when Innate Sorcery is NOT in active buffs', () => {
    getRuntimeValue.mockReturnValue([
        { name: 'Darkness' },
        { name: 'Haste' },
      ])
    const result = isInnateSorceryActive(PLAYER, CAMPAIGN)
    expect(result).toBe(false)
    })

  it('returns false when active buffs array is empty', () => {
    getRuntimeValue.mockReturnValue([])
    const result = isInnateSorceryActive(PLAYER, CAMPAIGN)
    expect(result).toBe(false)
    })

  it('returns false when no buffs exist (null fallback)', () => {
    getRuntimeValue.mockReturnValue(null) // getActiveBuffs returns [] for null
    const result = isInnateSorceryActive(PLAYER, CAMPAIGN)
    expect(result).toBe(false)
    })

  it('delegates via getRuntimeValue with correct args', () => {
    getRuntimeValue.mockReturnValue([])
    isInnateSorceryActive(PLAYER, CAMPAIGN)
    expect(getRuntimeValue).toHaveBeenCalledWith(PLAYER, 'activeBuffs')
    })

  it('returns true for exactly named Innate Sorcery buff', () => {
    getRuntimeValue.mockReturnValue([{ name: 'Innate Sorcery' }])
    expect(isInnateSorceryActive(PLAYER, CAMPAIGN)).toBe(true)
    })

  it('does not match partial name "Innate"', () => {
    getRuntimeValue.mockReturnValue([{ name: 'Innate' }])
    const result = isInnateSorceryActive(PLAYER, CAMPAIGN)
    expect(result).toBe(false)
    })

  it('does not match partial name "Sorcery"', () => {
    getRuntimeValue.mockReturnValue([{ name: 'Sorcery' }])
    const result = isInnateSorceryActive(PLAYER, CAMPAIGN)
    expect(result).toBe(false)
    })
})

describe('getInnateSorceryBonus', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    })

  describe('when Innate Sorcery is active', () => {
    it('returns saveDcBonus of 1', () => {
      getRuntimeValue.mockReturnValue([{ name: 'Innate Sorcery' }])
      const bonus = getInnateSorceryBonus(PLAYER, CAMPAIGN)
      expect(bonus.saveDcBonus).toBe(1)
      })

    it('returns spellAdvantage true', () => {
      getRuntimeValue.mockReturnValue([{ name: 'Innate Sorcery' }])
      const bonus = getInnateSorceryBonus(PLAYER, CAMPAIGN)
      expect(bonus.spellAdvantage).toBe(true)
      })

    it('returns correct object shape', () => {
      getRuntimeValue.mockReturnValue([{ name: 'Innate Sorcery' }])
      const bonus = getInnateSorceryBonus(PLAYER, CAMPAIGN)
      expect(bonus).toEqual({ saveDcBonus: 1, spellAdvantage: true })
      })
    })

  describe('when Innate Sorcery is NOT active', () => {
    it('returns saveDcBonus of 0', () => {
      getRuntimeValue.mockReturnValue([])
      const bonus = getInnateSorceryBonus(PLAYER, CAMPAIGN)
      expect(bonus.saveDcBonus).toBe(0)
      })

    it('returns spellAdvantage false', () => {
      getRuntimeValue.mockReturnValue([])
      const bonus = getInnateSorceryBonus(PLAYER, CAMPAIGN)
      expect(bonus.spellAdvantage).toBe(false)
      })

    it('returns correct object shape when inactive', () => {
      getRuntimeValue.mockReturnValue([])
      const bonus = getInnateSorceryBonus(PLAYER, CAMPAIGN)
      expect(bonus).toEqual({ saveDcBonus: 0, spellAdvantage: false })
      })
    })

  it('delegates to isInnateSorceryActive by calling getRuntimeValue', () => {
    getRuntimeValue.mockReturnValue([])
    getInnateSorceryBonus(PLAYER, CAMPAIGN)
    expect(getRuntimeValue).toHaveBeenCalledWith(PLAYER, 'activeBuffs')
    })
})

describe('setInnateSorceryActive', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    })

  describe('activate (isActive = true)', () => {
    it('adds Innate Sorcery when not already present', () => {
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

    it('adds Innate Sorcery when buffs array is empty', () => {
      getRuntimeValue.mockReturnValue([])
      setInnateSorceryActive(PLAYER, true, CAMPAIGN)

      expect(setRuntimeValue).toHaveBeenCalledWith(
        PLAYER,
          'activeBuffs',
          [{ name: 'Innate Sorcery', effect: 'innate_sorcery_active', duration: '1 minute' }],
        CAMPAIGN,
        )
      })

    it('does NOT add duplicate when Innate Sorcery already exists', () => {
      const existingBuffs = [
          { name: 'Innate Sorcery', effect: 'innate_sorcery_active', duration: '1 minute' },
        ]
      getRuntimeValue.mockReturnValue(existingBuffs)
      setInnateSorceryActive(PLAYER, true, CAMPAIGN)

        // newBuffs === buffs (same reference when already exists)
      expect(setRuntimeValue).toHaveBeenCalledWith(
        PLAYER,
          'activeBuffs',
        existingBuffs, // same object — no new entry added
        CAMPAIGN,
        )
      })

    it('creates new array via spread when adding', () => {
      const originalBuffs = [{ name: 'Darkness' }]
      getRuntimeValue.mockReturnValue(originalBuffs)
      setInnateSorceryActive(PLAYER, true, CAMPAIGN)

      const [, , newBuffs] = setRuntimeValue.mock.calls[0]
      expect(newBuffs).not.toBe(originalBuffs) // spread creates new array
      })
    })

  describe('deactivate (isActive = false)', () => {
    it('removes Innate Sorcery when present', () => {
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

    it('returns empty array when Innate Sorcery was the only buff', () => {
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

    it('leaves buffs unchanged when Innate Sorcery is not present', () => {
      const buffs = [{ name: 'Darkness' }, { name: 'Haste' }]
      getRuntimeValue.mockReturnValue(buffs)
      setInnateSorceryActive(PLAYER, false, CAMPAIGN)

        // filter with no matches returns a new array with same contents
      expect(setRuntimeValue).toHaveBeenCalledOnce()
      const [, , filteredBuffs] = setRuntimeValue.mock.calls[0]
      expect(filteredBuffs).toEqual([{ name: 'Darkness' }, { name: 'Haste' }]) // same content
     })

    it('handles inactive with empty buffs array', () => {
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
    it('calls getRuntimeValue for activeBuffs before setting', () => {
      getRuntimeValue.mockReturnValue([])
      setInnateSorceryActive(PLAYER, true, CAMPAIGN)
      expect(getRuntimeValue).toHaveBeenCalledOnce()
      expect(getRuntimeValue).toHaveBeenCalledWith(PLAYER, 'activeBuffs')
      })

    it('calls setRuntimeValue with correct argument order', () => {
      getRuntimeValue.mockReturnValue([])
      setInnateSorceryActive(PLAYER, true, CAMPAIGN)
      expect(setRuntimeValue).toHaveBeenCalledOnce()

      const [arg0, arg1, arg2, arg3] = setRuntimeValue.mock.calls[0]
      expect(arg0).toBe(PLAYER)           // playerName (characterKey)
      expect(arg1).toBe('activeBuffs')    // propertyName
      expect(Array.isArray(arg2)).toBe(true) // newBuffs array
      expect(arg3).toBe(CAMPAIGN)         // campaignName
      })

    it('handles null active buffs (getRuntimeValue returns null — falls back to empty)', () => {
      getRuntimeValue.mockReturnValue(null) // getActiveBuffs -> []
      setInnateSorceryActive(PLAYER, true, CAMPAIGN)

      expect(setRuntimeValue).toHaveBeenCalledWith(
        PLAYER,
          'activeBuffs',
          [{ name: 'Innate Sorcery', effect: 'innate_sorcery_active', duration: '1 minute' }],
        CAMPAIGN,
        )
      })

    it('correctly toggles off when sorcery is mixed with other buffs', () => {
      const withSorcery = [
          { name: 'Innate Sorcery', effect: 'innate_sorcery_active', duration: '1 minute' },
          { name: 'Haste' },
        ]

      getRuntimeValue.mockReturnValue(withSorcery)
      setInnateSorceryActive(PLAYER, false, CAMPAIGN)

      expect(setRuntimeValue).toHaveBeenCalledWith(
        PLAYER,
          'activeBuffs',
          [{ name: 'Haste' }],
        CAMPAIGN,
        )
      })
    })
})
