import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
}))

vi.mock('../../rules/combat/rangeCheck.js', () => ({
  isWithinRange: vi.fn(),
}))

import { getWolfAdvantageAgainst } from './wolfAuraUtils.js'
import { getRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js'
import { isWithinRange } from '../../rules/combat/rangeCheck.js'

function makePlayer(name, gridX = 0, gridY = 0) {
  return { name, gridX, gridY }
}

function makeMapData(players) {
  return { players }
}

function makeWolfBuff() {
  return { name: 'Rage of the Wilds', optionName: 'Wolf' }
}

describe('getWolfAdvantageAgainst', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getRuntimeValue.mockReset()
    isWithinRange.mockReset()
    getRuntimeValue.mockImplementation(() => [])
    isWithinRange.mockResolvedValue(false)
  })

  it('returns false when mapData is undefined', async () => {
    const result = await getWolfAdvantageAgainst({ attackerName: 'A', mapData: undefined })
    expect(result).toEqual({ advantage: false })
  })

  it('returns false when mapData is null', async () => {
    const result = await getWolfAdvantageAgainst({ attackerName: 'A', mapData: null })
    expect(result).toEqual({ advantage: false })
  })

  it('returns false when mapData.players is missing or empty', async () => {
    expect(await getWolfAdvantageAgainst({ attackerName: 'A', mapData: {} })).toEqual({ advantage: false })
    expect(await getWolfAdvantageAgainst({ attackerName: 'A', mapData: makeMapData([]) })).toEqual({ advantage: false })
  })

  it('returns advantage when a non-attacker player has Wolf buff and is in range', async () => {
    getRuntimeValue.mockImplementation((name) => name === 'Barbarian' ? [makeWolfBuff()] : [])
    isWithinRange.mockResolvedValue(true)

    const result = await getWolfAdvantageAgainst({
      attackerName: 'Attacker',
      mapData: makeMapData([makePlayer('Attacker'), makePlayer('Barbarian')]),
    })
    expect(result).toEqual({ advantage: true, source: 'Barbarian' })
  })

  it('skips the attacker even if they have Wolf buff', async () => {
    getRuntimeValue.mockImplementation(() => [makeWolfBuff()])
    isWithinRange.mockResolvedValue(true)

    const result = await getWolfAdvantageAgainst({
      attackerName: 'Attacker',
      mapData: makeMapData([makePlayer('Attacker')]),
    })
    expect(result).toEqual({ advantage: false })
  })

  it('returns false when no player has Wolf buff', async () => {
    getRuntimeValue.mockImplementation(() => [])

    const result = await getWolfAdvantageAgainst({
      attackerName: 'Attacker',
      mapData: makeMapData([makePlayer('Attacker'), makePlayer('Barbarian')]),
    })
    expect(result).toEqual({ advantage: false })
  })

  it('handles invalid buff types gracefully', async () => {
    getRuntimeValue
      .mockReturnValueOnce(null)
      .mockReturnValueOnce(undefined)
      .mockReturnValueOnce('not-an-array')
      .mockReturnValueOnce(42)
      .mockReturnValueOnce([makeWolfBuff()])

    const result = await getWolfAdvantageAgainst({
      attackerName: 'Attacker',
      mapData: makeMapData([
        makePlayer('P1'), makePlayer('P2'), makePlayer('P3'), makePlayer('P4'), makePlayer('P5'),
      ]),
    })
    expect(result).toEqual({ advantage: false })
  })

  it('returns false when Wolf buff is out of range', async () => {
    getRuntimeValue.mockImplementation(() => [makeWolfBuff()])
    isWithinRange.mockResolvedValue(false)

    const result = await getWolfAdvantageAgainst({
      attackerName: 'Attacker',
      mapData: makeMapData([makePlayer('Attacker'), makePlayer('Barbarian')]),
    })
    expect(result).toEqual({ advantage: false })
  })

  it('calls isWithinRange with 5 ft range', async () => {
    getRuntimeValue.mockImplementation((name) => name === 'Barbarian' ? [makeWolfBuff()] : [])
    isWithinRange.mockResolvedValue(true)

    await getWolfAdvantageAgainst({
      attackerName: 'Attacker',
      campaignName: 'MyCampaign',
      activeMapName: 'MyMap',
      mapData: makeMapData([makePlayer('Attacker'), makePlayer('Barbarian')]),
    })
    expect(isWithinRange).toHaveBeenCalledWith('Barbarian', 'Attacker', 5)
  })

  it('iterates players until finding one with Wolf buff in range', async () => {
    getRuntimeValue.mockImplementation((name) => name === 'Player1' ? [] : name === 'Player2' ? [makeWolfBuff()] : [])
    isWithinRange.mockResolvedValue(true)

    const result = await getWolfAdvantageAgainst({
      attackerName: 'Attacker',
      campaignName: 'C',
      mapData: makeMapData([makePlayer('Player1'), makePlayer('Player2'), makePlayer('Attacker')]),
    })
    expect(result).toEqual({ advantage: true, source: 'Player2' })
  })

  it('returns false when only the attacker exists in mapData', async () => {
    const result = await getWolfAdvantageAgainst({
      attackerName: 'Attacker',
      mapData: makeMapData([makePlayer('Attacker')]),
    })
    expect(result).toEqual({ advantage: false })
  })

  it('does not match Wolf buff without Rage of the Wilds name', async () => {
    getRuntimeValue.mockImplementation(() => [{ optionName: 'Wolf' }])
    isWithinRange.mockResolvedValue(true)

    const result = await getWolfAdvantageAgainst({
      attackerName: 'Attacker',
      mapData: makeMapData([makePlayer('Attacker'), makePlayer('Barbarian')]),
    })
    expect(result).toEqual({ advantage: false })
  })
})
