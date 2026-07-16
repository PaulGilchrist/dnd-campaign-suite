import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
}))

vi.mock('../../rules/combat/rangeCheck.js', () => ({
  isWithinRange: vi.fn(),
}))

import { getDuplicityAdvantageAgainst } from './duplicityAuraUtils.js'
import { getRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js'
import { isWithinRange } from '../../rules/combat/rangeCheck.js'

function makePlayer(name, gridX = 0, gridY = 0) {
  return { name, gridX, gridY }
}

function makeMapData(players, placedItems = []) {
  return { players, placedItems }
}

function makeDuplicityBuff() {
  return { effect: 'create_illusion', isImprovedDuplicity: true }
}

describe('getDuplicityAdvantageAgainst', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getRuntimeValue.mockReset()
    isWithinRange.mockReset()
    getRuntimeValue.mockImplementation(() => [])
    isWithinRange.mockResolvedValue(false)
  })

  it('returns false when mapData is undefined', async () => {
    const result = await getDuplicityAdvantageAgainst({ attackerName: 'A', mapData: undefined })
    expect(result).toEqual({ advantage: false })
  })

  it('returns false when mapData is null', async () => {
    const result = await getDuplicityAdvantageAgainst({ attackerName: 'A', mapData: null })
    expect(result).toEqual({ advantage: false })
  })

  it('returns false when mapData.players is missing or empty', async () => {
    expect(await getDuplicityAdvantageAgainst({ attackerName: 'A', mapData: {} })).toEqual({ advantage: false })
    expect(await getDuplicityAdvantageAgainst({ attackerName: 'A', mapData: makeMapData([]) })).toEqual({ advantage: false })
  })

  it('returns false when no player has Improved Duplicity', async () => {
    getRuntimeValue.mockImplementation(() => [])

    const result = await getDuplicityAdvantageAgainst({
      attackerName: 'Attacker',
      mapData: makeMapData([makePlayer('Attacker'), makePlayer('Barbarian')]),
    })
    expect(result).toEqual({ advantage: false })
  })

  it('returns advantage when a non-attacker player has Improved Duplicity and is in range', async () => {
    getRuntimeValue.mockImplementation((name) => name === 'Cleric' ? [makeDuplicityBuff()] : [])
    isWithinRange.mockResolvedValue(true)

    const result = await getDuplicityAdvantageAgainst({
      attackerName: 'Attacker',
      mapData: makeMapData([makePlayer('Attacker'), makePlayer('Cleric')]),
    })
    expect(result).toEqual({ advantage: true, source: 'Cleric' })
  })

  it('skips the attacker even if they have Improved Duplicity', async () => {
    getRuntimeValue.mockImplementation(() => [makeDuplicityBuff()])
    isWithinRange.mockResolvedValue(true)

    const result = await getDuplicityAdvantageAgainst({
      attackerName: 'Attacker',
      mapData: makeMapData([makePlayer('Attacker')]),
    })
    expect(result).toEqual({ advantage: false })
  })

  it('ignores a buff that has create_illusion but NOT isImprovedDuplicity', async () => {
    getRuntimeValue.mockImplementation(() => [{ effect: 'create_illusion' }])

    const result = await getDuplicityAdvantageAgainst({
      attackerName: 'Attacker',
      mapData: makeMapData([makePlayer('Attacker'), makePlayer('Cleric')]),
    })
    expect(result).toEqual({ advantage: false })
  })

  it('handles invalid buff types gracefully', async () => {
    getRuntimeValue
      .mockReturnValueOnce(null)
      .mockReturnValueOnce(undefined)
      .mockReturnValueOnce('not-an-array')
      .mockReturnValueOnce(42)
      .mockReturnValueOnce([makeDuplicityBuff()])

    const result = await getDuplicityAdvantageAgainst({
      attackerName: 'Attacker',
      mapData: makeMapData([
        makePlayer('P1'), makePlayer('P2'), makePlayer('P3'), makePlayer('P4'), makePlayer('P5'),
      ]),
    })
    expect(result).toEqual({ advantage: false })
  })

  it('returns false when Improved Duplicity is out of range', async () => {
    getRuntimeValue.mockImplementation(() => [makeDuplicityBuff()])
    isWithinRange.mockResolvedValue(false)

    const result = await getDuplicityAdvantageAgainst({
      attackerName: 'Attacker',
      mapData: makeMapData([makePlayer('Attacker'), makePlayer('Cleric')]),
    })
    expect(result).toEqual({ advantage: false })
  })

  it('iterates players until finding one with Improved Duplicity in range', async () => {
    getRuntimeValue.mockImplementation((name) => name === 'Cleric1' ? [] : name === 'Cleric2' ? [makeDuplicityBuff()] : [])
    isWithinRange.mockResolvedValue(true)

    const result = await getDuplicityAdvantageAgainst({
      attackerName: 'Attacker',
      campaignName: 'C',
      mapData: makeMapData([makePlayer('Cleric1'), makePlayer('Cleric2'), makePlayer('Attacker')]),
    })
    expect(result).toEqual({ advantage: true, source: 'Cleric2' })
  })

  it('calls isWithinRange with 5 ft range', async () => {
    getRuntimeValue.mockImplementation((name) => name === 'Cleric' ? [makeDuplicityBuff()] : [])
    isWithinRange.mockResolvedValue(true)

    await getDuplicityAdvantageAgainst({
      attackerName: 'Attacker',
      campaignName: 'MyCampaign',
      activeMapName: 'MyMap',
      mapData: makeMapData([makePlayer('Attacker'), makePlayer('Cleric')]),
    })
    expect(isWithinRange).toHaveBeenCalledWith('Cleric', 'Attacker', 5)
  })

  it('returns false when only the attacker exists in mapData', async () => {
    const result = await getDuplicityAdvantageAgainst({
      attackerName: 'Attacker',
      mapData: makeMapData([makePlayer('Attacker')]),
    })
    expect(result).toEqual({ advantage: false })
  })

  it('combines players and placedItems into allCreatures', async () => {
    getRuntimeValue.mockImplementation((name) => name === 'Illusion' ? [makeDuplicityBuff()] : [])
    isWithinRange.mockResolvedValue(true)

    const result = await getDuplicityAdvantageAgainst({
      attackerName: 'Attacker',
      mapData: makeMapData([], [
        { name: 'Illusion', gridX: 3, gridY: 4 },
      ]),
    })
    expect(result).toEqual({ advantage: true, source: 'Illusion' })
  })
})
