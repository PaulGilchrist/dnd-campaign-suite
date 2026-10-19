// @maintained-by-ai
// ── Lane: buffService SERVICE lifecycle bytes — the ONLY test of the real
// implementation (consumers mock this module: sorceryHandler, CharBonusActions,
// charSummaryCalc consumption lanes #949/#932 keep their own call-shape lanes).
// buffs family map: buffService owns add/read/remove of the 'Innate Sorcery'
// entry on the activeBuffs runtime store. Expiry owners live elsewhere
// (expirationQueue/addExpiration #951) — this lane holds NO clock:
// duration '1 minute' is authored metadata, ≥1min stays combat-scoped,
// never minutes×10 (#app no-timers).
// old->new: 16→11 — passthrough+zero-write folded; presence true/false folded;
// empty/null activate folded; clear-to-empty folded; arg-order test removed
// (every write payload below pins args exactly).

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the runtime-store boundary (network edge; useRuntimeState has its own lane)
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
const INNATE = { name: 'Innate Sorcery', effect: 'innate_sorcery_active', duration: '1 minute' }

beforeEach(() => vi.clearAllMocks())

describe('getActiveBuffs', () => {
  it('passes the stored array through untouched, reads activeBuffs with exact args, and never writes', () => {
    const buffs = [{ name: 'Darkness' }, INNATE]
    getRuntimeValue.mockReturnValue(buffs)

    expect(getActiveBuffs(PLAYER, CAMPAIGN)).toBe(buffs)
    expect(getRuntimeValue).toHaveBeenCalledWith(PLAYER, 'activeBuffs', CAMPAIGN)
    expect(getRuntimeValue).toHaveBeenCalledTimes(1)
    expect(setRuntimeValue).not.toHaveBeenCalled()
  })

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['a non-array value', 'not-an-array'],
    ['an empty array', []],
  ])('normalizes %s in the store to a defensive empty array', (_label, val) => {
    getRuntimeValue.mockReturnValue(val)
    expect(getActiveBuffs(PLAYER, CAMPAIGN)).toEqual([])
  })
})

describe('isInnateSorceryActive', () => {
  it('is true when Innate Sorcery is present among other buffs', () => {
    getRuntimeValue.mockReturnValue([{ name: 'Darkness' }, INNATE])
    expect(isInnateSorceryActive(PLAYER, CAMPAIGN)).toBe(true)
  })

  it.each([
    ['no buffs', []],
    ['null store', null],
    ['only a partial name match', [{ name: 'Innate' }]],
  ])('is false with %s', (_label, val) => {
    getRuntimeValue.mockReturnValue(val)
    expect(isInnateSorceryActive(PLAYER, CAMPAIGN)).toBe(false)
  })
})

describe('getInnateSorceryBonus', () => {
  it('grants exactly +1 save DC and spell advantage when Innate Sorcery is active', () => {
    getRuntimeValue.mockReturnValue([INNATE])
    expect(getInnateSorceryBonus(PLAYER, CAMPAIGN)).toEqual({
      saveDcBonus: 1,
      spellAdvantage: true,
    })
  })

  it.each([
    ['no buffs', []],
    ['null store', null],
  ])('grants a zeroed bonus with %s', (_label, val) => {
    getRuntimeValue.mockReturnValue(val)
    expect(getInnateSorceryBonus(PLAYER, CAMPAIGN)).toEqual({
      saveDcBonus: 0,
      spellAdvantage: false,
    })
  })
})

describe('setInnateSorceryActive', () => {
  it('activating writes the buff appended after co-existing buffs — exact payload, read then one write, campaign pinned', () => {
    getRuntimeValue.mockReturnValue([{ name: 'Darkness' }])
    setInnateSorceryActive(PLAYER, true, CAMPAIGN)

    expect(getRuntimeValue).toHaveBeenCalledWith(PLAYER, 'activeBuffs', CAMPAIGN)
    expect(setRuntimeValue).toHaveBeenCalledTimes(1)
    expect(setRuntimeValue).toHaveBeenCalledWith(
      PLAYER,
      'activeBuffs',
      [{ name: 'Darkness' }, INNATE],
      CAMPAIGN,
    )
  })

  it.each([
    ['empty state', []],
    ['null state', null],
  ])('activating from %s writes exactly one Innate Sorcery entry', (_label, val) => {
    getRuntimeValue.mockReturnValue(val)
    setInnateSorceryActive(PLAYER, true, CAMPAIGN)

    expect(setRuntimeValue).toHaveBeenCalledWith(PLAYER, 'activeBuffs', [INNATE], CAMPAIGN)
  })

  it('activating again is idempotent — one write of the unchanged list, never stacked duplicates', () => {
    getRuntimeValue.mockReturnValue([INNATE])
    setInnateSorceryActive(PLAYER, true, CAMPAIGN)

    expect(setRuntimeValue).toHaveBeenCalledTimes(1)
    expect(setRuntimeValue).toHaveBeenCalledWith(PLAYER, 'activeBuffs', [INNATE], CAMPAIGN)
  })

  it('deactivating removes only Innate Sorcery — same-source different buffs survive exact', () => {
    getRuntimeValue.mockReturnValue([{ name: 'Darkness' }, INNATE, { name: 'Haste' }])
    setInnateSorceryActive(PLAYER, false, CAMPAIGN)

    expect(setRuntimeValue).toHaveBeenCalledTimes(1)
    expect(setRuntimeValue).toHaveBeenCalledWith(
      PLAYER,
      'activeBuffs',
      [{ name: 'Darkness' }, { name: 'Haste' }],
      CAMPAIGN,
    )
  })

  it.each([
    ['Innate Sorcery as the only buff', [INNATE]],
    ['no buffs at all', []],
  ])('deactivating with %s writes an empty array', (_label, val) => {
    getRuntimeValue.mockReturnValue(val)
    setInnateSorceryActive(PLAYER, false, CAMPAIGN)

    expect(setRuntimeValue).toHaveBeenCalledWith(PLAYER, 'activeBuffs', [], CAMPAIGN)
  })
})
