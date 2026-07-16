import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
}))

vi.mock('../../rules/combat/rangeCheck.js', () => ({
  isWithinRange: vi.fn(),
}))

import { getCoronaSaveDisadvantage } from './coronaAuraUtils.js'
import { getRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js'
import { isWithinRange } from '../../rules/combat/rangeCheck.js'

function makePlayer(name, gridX = 0, gridY = 0) {
  return { name, gridX, gridY }
}

function makeMapData(players) {
  return { players }
}

function makeCoronaBuff(distance, enemiesDisadvantageSaves = ['Fire', 'Radiant']) {
  const buff = { effect: 'sunlight_aura', enemiesDisadvantageSaves }
  if (distance !== undefined) buff.distance = distance
  return buff
}

describe('getCoronaSaveDisadvantage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getRuntimeValue.mockReset()
    isWithinRange.mockReset()
    getRuntimeValue.mockImplementation((_name, key) => {
      if (key === 'coronaOfLightEnemies') return []
      return []
    })
    isWithinRange.mockResolvedValue(false)
  })

  it('returns false when mapData is undefined', async () => {
    const result = await getCoronaSaveDisadvantage({ targetName: 'Target', mapData: undefined })
    expect(result).toEqual({ disadvantage: false })
  })

  it('returns false when mapData is null', async () => {
    const result = await getCoronaSaveDisadvantage({ targetName: 'Target', mapData: null })
    expect(result).toEqual({ disadvantage: false })
  })

  it('returns false when mapData.players is missing or empty', async () => {
    expect(await getCoronaSaveDisadvantage({ targetName: 'Target', mapData: {} })).toEqual({ disadvantage: false })
    expect(await getCoronaSaveDisadvantage({ targetName: 'Target', mapData: makeMapData([]) })).toEqual({ disadvantage: false })
  })

  it('returns false when no player has corona aura buff', async () => {
    getRuntimeValue.mockImplementation(() => [])

    const result = await getCoronaSaveDisadvantage({
      targetName: 'Target',
      mapData: makeMapData([makePlayer('Target'), makePlayer('Paladin')]),
      damageType: 'Fire',
    })
    expect(result).toEqual({ disadvantage: false })
  })

  it('skips the target itself even if they have corona aura buff', async () => {
    getRuntimeValue.mockReturnValue([makeCoronaBuff()])

    const result = await getCoronaSaveDisadvantage({
      targetName: 'Target',
      mapData: makeMapData([makePlayer('Target')]),
      damageType: 'Fire',
    })
    expect(result).toEqual({ disadvantage: false })
  })

  it('returns disadvantage with source when a non-target player has corona buff and is in range', async () => {
    getRuntimeValue.mockImplementation((name) => name === 'Paladin' ? [makeCoronaBuff()] : [])
    isWithinRange.mockResolvedValue(true)

    const result = await getCoronaSaveDisadvantage({
      targetName: 'Target',
      mapData: makeMapData([makePlayer('Target'), makePlayer('Paladin')]),
      damageType: 'Fire',
    })
    expect(result).toEqual({ disadvantage: true, source: 'Paladin' })
  })

  it('returns the first non-target player with corona buff', async () => {
    getRuntimeValue.mockImplementation((name) =>
      name === 'Paladin1' || name === 'Paladin2' ? [makeCoronaBuff()] : [],
    )
    isWithinRange.mockResolvedValueOnce(false).mockResolvedValueOnce(true)

    const result = await getCoronaSaveDisadvantage({
      targetName: 'Target',
      mapData: makeMapData([makePlayer('Target'), makePlayer('Paladin1'), makePlayer('Paladin2')]),
      damageType: 'Fire',
    })
    expect(result).toEqual({ disadvantage: true, source: 'Paladin2' })
  })

  it('handles invalid buff types gracefully', async () => {
    getRuntimeValue
      .mockReturnValueOnce(null)
      .mockReturnValueOnce(undefined)
      .mockReturnValueOnce('not-an-array')
      .mockReturnValueOnce(42)
      .mockReturnValueOnce([makeCoronaBuff()])

    const result = await getCoronaSaveDisadvantage({
      targetName: 'Target',
      mapData: makeMapData([
        makePlayer('Target'), makePlayer('P1'), makePlayer('P2'), makePlayer('P3'), makePlayer('P4'), makePlayer('P5'),
      ]),
      damageType: 'Fire',
    })
    expect(result).toEqual({ disadvantage: false })
  })

  it('returns false when corona buff is out of range', async () => {
    getRuntimeValue.mockImplementation(() => [makeCoronaBuff()])
    isWithinRange.mockResolvedValue(false)

    const result = await getCoronaSaveDisadvantage({
      targetName: 'Target',
      mapData: makeMapData([makePlayer('Target'), makePlayer('Paladin')]),
      damageType: 'Fire',
    })
    expect(result).toEqual({ disadvantage: false })
  })

  it('respects enemiesDisadvantageSaves filter for damage type', async () => {
    getRuntimeValue.mockImplementation((name) => name === 'Paladin' ? [makeCoronaBuff(undefined, ['Radiant'])] : [])
    isWithinRange.mockResolvedValue(true)

    const result = await getCoronaSaveDisadvantage({
      targetName: 'Target',
      mapData: makeMapData([makePlayer('Target'), makePlayer('Paladin')]),
      damageType: 'Fire',
    })
    expect(result).toEqual({ disadvantage: false })
  })

  it('passes correct parameters to isWithinRange', async () => {
    getRuntimeValue.mockImplementation((name) => name === 'Paladin' ? [makeCoronaBuff('60 ft')] : [])
    isWithinRange.mockResolvedValue(true)

    await getCoronaSaveDisadvantage({
      targetName: 'Target',
      campaignName: 'MyCampaign',
      activeMapName: 'MyMap',
      mapData: makeMapData([makePlayer('Target'), makePlayer('Paladin')]),
      damageType: 'Fire',
    })
    expect(isWithinRange).toHaveBeenCalledWith('Paladin', 'Target', 60)
  })

  it('respects coronaOfLightEnemies list', async () => {
    getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'coronaOfLightEnemies' && name === 'Paladin') return ['Target']
      if (key === 'activeBuffs' && name === 'Paladin') return [makeCoronaBuff()]
      return []
    })
    isWithinRange.mockResolvedValue(true)

    const result = await getCoronaSaveDisadvantage({
      targetName: 'Target',
      mapData: makeMapData([makePlayer('Target'), makePlayer('Paladin')]),
      damageType: 'Fire',
    })
    expect(result).toEqual({ disadvantage: true, source: 'Paladin' })
  })

  it('returns false when target not in coronaOfLightEnemies list', async () => {
    getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'coronaOfLightEnemies' && name === 'Paladin') return ['Other']
      if (key === 'activeBuffs' && name === 'Paladin') return [makeCoronaBuff()]
      return []
    })

    const result = await getCoronaSaveDisadvantage({
      targetName: 'Target',
      mapData: makeMapData([makePlayer('Target'), makePlayer('Paladin')]),
      damageType: 'Fire',
    })
    expect(result).toEqual({ disadvantage: false })
  })
})
