import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
}))

vi.mock('../../rules/combat/rangeCheck.js', () => ({
  isWithinRange: vi.fn(),
}))

import { getLionDisadvantageAgainst } from './lionAuraUtils.js'
import { getRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js'
import { isWithinRange } from '../../rules/combat/rangeCheck.js'

function makePlayer(name, gridX = 0, gridY = 0) {
  return { name, gridX, gridY }
}

function makeMapData(players) {
  return { players }
}

function makeLionBuff(range) {
  const buff = { optionName: 'Lion' }
  if (range !== undefined) buff.range = range
  return buff
}

describe('getLionDisadvantageAgainst', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getRuntimeValue.mockReset()
    isWithinRange.mockReset()
    getRuntimeValue.mockImplementation(() => [])
    isWithinRange.mockResolvedValue(false)
  })

  it('returns false when mapData is undefined', async () => {
    const result = await getLionDisadvantageAgainst({ attackerName: 'A', mapData: undefined })
    expect(result).toEqual({ disadvantage: false })
  })

  it('returns false when mapData is null', async () => {
    const result = await getLionDisadvantageAgainst({ attackerName: 'A', mapData: null })
    expect(result).toEqual({ disadvantage: false })
  })

  it('returns false when mapData.players is missing or empty', async () => {
    expect(await getLionDisadvantageAgainst({ attackerName: 'A', mapData: {} })).toEqual({ disadvantage: false })
    expect(await getLionDisadvantageAgainst({ attackerName: 'A', mapData: makeMapData([]) })).toEqual({ disadvantage: false })
  })

  it('returns disadvantage when a non-attacker player has Lion buff and is in range', async () => {
    getRuntimeValue.mockImplementation((name) => name === 'Barbarian' ? [makeLionBuff()] : [])
    isWithinRange.mockResolvedValue(true)

    const result = await getLionDisadvantageAgainst({
      attackerName: 'Attacker',
      mapData: makeMapData([makePlayer('Attacker'), makePlayer('Barbarian')]),
    })
    expect(result).toEqual({ disadvantage: true, source: 'Barbarian' })
  })

  it('skips the attacker even if they have Lion buff', async () => {
    getRuntimeValue.mockImplementation(() => [makeLionBuff()])
    isWithinRange.mockResolvedValue(true)

    const result = await getLionDisadvantageAgainst({
      attackerName: 'Attacker',
      mapData: makeMapData([makePlayer('Attacker')]),
    })
    expect(result).toEqual({ disadvantage: false })
  })

  it('returns false when no player has Lion buff', async () => {
    getRuntimeValue.mockImplementation(() => [])

    const result = await getLionDisadvantageAgainst({
      attackerName: 'Attacker',
      mapData: makeMapData([makePlayer('Attacker'), makePlayer('Barbarian')]),
    })
    expect(result).toEqual({ disadvantage: false })
  })

  it('skips non-Lion buffs and finds Lion among mixed buffs', async () => {
    getRuntimeValue.mockImplementation(() => [
      { optionName: 'Bear' },
      makeLionBuff(),
    ])
    isWithinRange.mockResolvedValue(true)

    const result = await getLionDisadvantageAgainst({
      attackerName: 'Attacker',
      mapData: makeMapData([makePlayer('Attacker'), makePlayer('Barbarian')]),
    })
    expect(result).toEqual({ disadvantage: true, source: 'Barbarian' })
  })

  it('handles invalid buff types gracefully (null, undefined, non-array)', async () => {
    getRuntimeValue
      .mockReturnValueOnce(null)
      .mockReturnValueOnce(undefined)
      .mockReturnValueOnce('not-an-array')
      .mockReturnValueOnce(42)
      .mockReturnValueOnce([makeLionBuff()])

    const result = await getLionDisadvantageAgainst({
      attackerName: 'Attacker',
      mapData: makeMapData([
        makePlayer('P1'), makePlayer('P2'), makePlayer('P3'), makePlayer('P4'), makePlayer('P5'),
      ]),
    })
    expect(result).toEqual({ disadvantage: false })
  })

  it('returns false when Lion buff is out of range', async () => {
    getRuntimeValue.mockImplementation(() => [makeLionBuff()])
    isWithinRange.mockResolvedValue(false)

    const result = await getLionDisadvantageAgainst({
      attackerName: 'Attacker',
      mapData: makeMapData([makePlayer('Attacker'), makePlayer('Barbarian')]),
    })
    expect(result).toEqual({ disadvantage: false })
  })

  it('uses custom range from lionBuff.range', async () => {
    getRuntimeValue.mockImplementation(() => [makeLionBuff('10 ft')])
    isWithinRange.mockResolvedValue(true)

    await getLionDisadvantageAgainst({
      attackerName: 'Attacker',
      mapData: makeMapData([makePlayer('Attacker'), makePlayer('Barbarian')]),
    })
    expect(isWithinRange).toHaveBeenCalledWith('Barbarian', 'Attacker', 10)
  })

  it('iterates players until finding one with Lion buff in range', async () => {
    getRuntimeValue.mockImplementation((name) => name === 'Player1' ? [] : name === 'Player2' ? [makeLionBuff()] : [])
    isWithinRange.mockResolvedValue(true)

    const result = await getLionDisadvantageAgainst({
      attackerName: 'Attacker',
      campaignName: 'C',
      mapData: makeMapData([makePlayer('Player1'), makePlayer('Player2'), makePlayer('Attacker')]),
    })
    expect(result).toEqual({ disadvantage: true, source: 'Player2' })
  })

  it('returns false when multiple Lion buffs are all out of range', async () => {
    getRuntimeValue.mockImplementation(() => [makeLionBuff()])
    isWithinRange.mockResolvedValue(false)

    const result = await getLionDisadvantageAgainst({
      attackerName: 'Attacker',
      mapData: makeMapData([makePlayer('Barbarian1'), makePlayer('Barbarian2'), makePlayer('Attacker')]),
    })
    expect(result).toEqual({ disadvantage: false })
  })

  it('calls isWithinRange with correct parameters', async () => {
    getRuntimeValue.mockImplementation((name) => name === 'Barbarian' ? [makeLionBuff()] : [])
    isWithinRange.mockResolvedValue(true)

    await getLionDisadvantageAgainst({
      attackerName: 'Attacker',
      campaignName: 'MyCampaign',
      activeMapName: 'MyMap',
      mapData: makeMapData([makePlayer('Attacker'), makePlayer('Barbarian')]),
    })
    expect(isWithinRange).toHaveBeenCalledWith('Barbarian', 'Attacker', 5)
  })

  it('calls getRuntimeValue with correct arguments', async () => {
    getRuntimeValue.mockImplementation((name) => name === '__campaign__' ? 'MyCampaign' : name === '__map__' ? 'MyMap' : [])

    await getLionDisadvantageAgainst({
      attackerName: 'Attacker',
      campaignName: 'MyCampaign',
      mapData: makeMapData([makePlayer('Attacker'), makePlayer('Barbarian')]),
    })
    expect(getRuntimeValue).toHaveBeenCalledWith('Barbarian', 'activeBuffs')
  })

  it('returns false when only the attacker exists in mapData', async () => {
    const result = await getLionDisadvantageAgainst({
      attackerName: 'Attacker',
      mapData: makeMapData([makePlayer('Attacker')]),
    })
    expect(result).toEqual({ disadvantage: false })
  })
})
