import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../rules/combat/rangeValidation.js', () => ({
  getDistanceFeet: vi.fn(),
}))

vi.mock('../../../hooks/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
}))

import { getDuplicityAdvantageAgainst } from './duplicityAuraUtils.js'
import { getDistanceFeet } from '../../rules/combat/rangeValidation.js'
import { getRuntimeValue } from '../../../hooks/useRuntimeState.js'

function makePlayer(name, gridX = 0, gridY = 0) {
  return { name, gridX, gridY }
}

function makeMapData(players) {
  return { players }
}

function makeImprovedDuplicityBuff() {
  return { name: 'Invoke Duplicity', effect: 'create_illusion', isImprovedDuplicity: true }
}

function makeBasicIllusionBuff() {
  return { name: 'Invoke Duplicity', effect: 'create_illusion', isImprovedDuplicity: false }
}

describe('getDuplicityAdvantageAgainst', () => {
  beforeEach(() => {
    getRuntimeValue.mockReset()
    getDistanceFeet.mockReset()
  })

  describe('early return when mapData is invalid (skipRangeCheck false)', () => {
    it('returns advantage false when mapData is undefined', () => {
      const result = getDuplicityAdvantageAgainst({
        targetPos: { gridX: 1, gridY: 1 },
        attackerName: 'Attacker',
        campaignName: '',
        mapData: undefined,
        skipRangeCheck: false,
      })
      expect(result).toEqual({ advantage: false })
    })

    it('returns advantage false when mapData has no players', () => {
      const result = getDuplicityAdvantageAgainst({
        targetPos: { gridX: 1, gridY: 1 },
        attackerName: 'Attacker',
        campaignName: '',
        mapData: makeMapData([]),
        skipRangeCheck: false,
      })
      expect(result).toEqual({ advantage: false })
    })

    it('returns advantage false when targetPos is missing', () => {
      const result = getDuplicityAdvantageAgainst({
        targetPos: null,
        attackerName: 'Attacker',
        campaignName: '',
        mapData: makeMapData([makePlayer('Cleric')]),
        skipRangeCheck: false,
      })
      expect(result).toEqual({ advantage: false })
    })
  })

  describe('skipRangeCheck = false (distance check)', () => {
    it('returns advantage true when ally with Improved Duplicity is within 5 ft of target', () => {
      const players = [makePlayer('Cleric', 0, 0), makePlayer('Attacker', 10, 10)]
      getRuntimeValue.mockReturnValue([makeImprovedDuplicityBuff()])
      getDistanceFeet.mockReturnValue(5)

      const result = getDuplicityAdvantageAgainst({
        targetPos: { gridX: 3, gridY: 4 },
        attackerName: 'Attacker',
        campaignName: 'test',
        mapData: makeMapData(players),
        skipRangeCheck: false,
      })

      expect(result).toEqual({ advantage: true, source: 'Cleric' })
    })

    it('returns advantage false when distance > 5 ft', () => {
      const players = [makePlayer('Cleric', 0, 0), makePlayer('Attacker', 10, 10)]
      getRuntimeValue.mockReturnValue([makeImprovedDuplicityBuff()])
      getDistanceFeet.mockReturnValue(10)

      const result = getDuplicityAdvantageAgainst({
        targetPos: { gridX: 10, gridY: 10 },
        attackerName: 'Attacker',
        campaignName: 'test',
        mapData: makeMapData(players),
        skipRangeCheck: false,
      })

      expect(result).toEqual({ advantage: false })
    })

    it('returns advantage false when the illusion does not have isImprovedDuplicity', () => {
      const players = [makePlayer('Cleric', 0, 0), makePlayer('Attacker', 10, 10)]
      getRuntimeValue.mockReturnValue([makeBasicIllusionBuff()])
      getDistanceFeet.mockReturnValue(3)

      const result = getDuplicityAdvantageAgainst({
        targetPos: { gridX: 3, gridY: 4 },
        attackerName: 'Attacker',
        campaignName: 'test',
        mapData: makeMapData(players),
        skipRangeCheck: false,
      })

      expect(result).toEqual({ advantage: false })
    })

    it('skips the illusion creator (self) — ally gets advantage, not self', () => {
      const players = [makePlayer('Cleric', 0, 0)]
      getRuntimeValue.mockReturnValue([makeImprovedDuplicityBuff()])
      getDistanceFeet.mockReturnValue(3)

      const result = getDuplicityAdvantageAgainst({
        targetPos: { gridX: 3, gridY: 4 },
        attackerName: 'Cleric',
        campaignName: 'test',
        mapData: makeMapData(players),
        skipRangeCheck: false,
      })

      expect(result).toEqual({ advantage: false })
    })
  })

  describe('skipRangeCheck = true (no distance check)', () => {
    it('returns advantage true when an ally has Improved Duplicity active', () => {
      const players = [makePlayer('Cleric', 0, 0), makePlayer('Attacker', 10, 10)]
      getRuntimeValue.mockReturnValue([makeImprovedDuplicityBuff()])

      const result = getDuplicityAdvantageAgainst({
        attackerName: 'Attacker',
        campaignName: 'test',
        mapData: makeMapData(players),
        skipRangeCheck: true,
      })

      expect(result).toEqual({ advantage: true, source: 'Cleric' })
    })

    it('returns advantage false when no allies have Improved Duplicity', () => {
      const players = [makePlayer('Cleric', 0, 0), makePlayer('Attacker', 10, 10)]
      getRuntimeValue.mockReturnValue([])

      const result = getDuplicityAdvantageAgainst({
        attackerName: 'Attacker',
        campaignName: 'test',
        mapData: makeMapData(players),
        skipRangeCheck: true,
      })

      expect(result).toEqual({ advantage: false })
    })

    it('returns advantage false when mapData is undefined in skipRangeCheck mode', () => {
      getRuntimeValue.mockReturnValue([makeImprovedDuplicityBuff()])

      const result = getDuplicityAdvantageAgainst({
        attackerName: 'Attacker',
        campaignName: 'test',
        mapData: undefined,
        skipRangeCheck: true,
      })

      expect(result).toEqual({ advantage: false })
    })
  })
})
