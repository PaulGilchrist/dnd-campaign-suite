// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks ───────────────────────────────────────────────────────

vi.mock('../../rules/combat/rangeValidation.js', () => ({
  getDistanceFeet: vi.fn(),
}))

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
}))

// ── Imports ─────────────────────────────────────────────────────

import { getDuplicityAdvantageAgainst } from './duplicityAuraUtils.js'
import { getDistanceFeet } from '../../rules/combat/rangeValidation.js'
import { getRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js'

// ── Helpers ─────────────────────────────────────────────────────

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

// ── Tests ───────────────────────────────────────────────────────

describe('getDuplicityAdvantageAgainst', () => {
  beforeEach(() => {
    getRuntimeValue.mockReset()
    getDistanceFeet.mockReset()
    getRuntimeValue.mockReturnValue([])
  })

  // ── Early returns: invalid inputs ─────────────────────────────

  describe('early returns when mapData or targetPos is invalid', () => {
    it.each([
      [undefined, false],
      [undefined, true],
      [null, false],
      [null, true],
    ])('returns { advantage: false } when mapData is %s (skipRangeCheck=%s)', (mapData, skipRangeCheck) => {
      const result = getDuplicityAdvantageAgainst({
        targetPos: { gridX: 1, gridY: 1 },
        attackerName: 'Attacker',
        campaignName: '',
        mapData,
        skipRangeCheck,
      })
      expect(result).toEqual({ advantage: false })
    })

    it('returns false when mapData.players is missing or empty', () => {
      const result = getDuplicityAdvantageAgainst({
        targetPos: { gridX: 1, gridY: 1 },
        attackerName: 'Attacker',
        campaignName: '',
        mapData: {},
        skipRangeCheck: false,
      })
      expect(result).toEqual({ advantage: false })

      const result2 = getDuplicityAdvantageAgainst({
        targetPos: { gridX: 1, gridY: 1 },
        attackerName: 'Attacker',
        campaignName: '',
        mapData: makeMapData([]),
        skipRangeCheck: false,
      })
      expect(result2).toEqual({ advantage: false })
    })

    it.each([null, undefined])('returns false when targetPos is %s', (targetPos) => {
      const result = getDuplicityAdvantageAgainst({
        targetPos,
        attackerName: 'Attacker',
        campaignName: '',
        mapData: makeMapData([makePlayer('Cleric')]),
        skipRangeCheck: false,
      })
      expect(result).toEqual({ advantage: false })
    })
  })

  // ── skipRangeCheck = true (no range checking) ────────────────

  describe('skipRangeCheck is true', () => {
    it('returns false when no player has Improved Duplicity', () => {
      const result = getDuplicityAdvantageAgainst({
        targetPos: { gridX: 1, gridY: 1 },
        attackerName: 'Attacker',
        campaignName: '',
        mapData: makeMapData([makePlayer('Attacker'), makePlayer('Cleric')]),
        skipRangeCheck: true,
      })
      expect(result).toEqual({ advantage: false })
    })

    it('returns false when getRuntimeValue returns null, undefined, or a non-array', () => {
      getRuntimeValue.mockReturnValue('not-an-array')

      const result = getDuplicityAdvantageAgainst({
        targetPos: { gridX: 1, gridY: 1 },
        attackerName: 'Attacker',
        campaignName: '',
        mapData: makeMapData([makePlayer('Attacker'), makePlayer('Cleric')]),
        skipRangeCheck: true,
      })
      expect(result).toEqual({ advantage: false })
    })

    it('skips the attacker even if they have Improved Duplicity', () => {
      getRuntimeValue.mockImplementation((name) =>
        name === 'Attacker' ? [makeImprovedDuplicityBuff()] : [],
      )

      const result = getDuplicityAdvantageAgainst({
        targetPos: { gridX: 1, gridY: 1 },
        attackerName: 'Attacker',
        campaignName: '',
        mapData: makeMapData([makePlayer('Attacker')]),
        skipRangeCheck: true,
      })
      expect(result).toEqual({ advantage: false })
    })

    it('returns true with source when a non-attacker player has Improved Duplicity', () => {
      getRuntimeValue.mockImplementation((name) =>
        name === 'Cleric' ? [makeImprovedDuplicityBuff()] : [],
      )

      const result = getDuplicityAdvantageAgainst({
        targetPos: { gridX: 1, gridY: 1 },
        attackerName: 'Attacker',
        campaignName: '',
        mapData: makeMapData([makePlayer('Attacker'), makePlayer('Cleric')]),
        skipRangeCheck: true,
      })
      expect(result).toEqual({ advantage: true, source: 'Cleric' })
    })

    it('returns the first non-attacker player with Improved Duplicity', () => {
      getRuntimeValue.mockImplementation((name) =>
        name === 'Cleric1' || name === 'Cleric2' ? [makeImprovedDuplicityBuff()] : [],
      )

      const result = getDuplicityAdvantageAgainst({
        targetPos: { gridX: 1, gridY: 1 },
        attackerName: 'Attacker',
        campaignName: '',
        mapData: makeMapData([
          makePlayer('Attacker'),
          makePlayer('Cleric1'),
          makePlayer('Cleric2'),
        ]),
        skipRangeCheck: true,
      })
      expect(result).toEqual({ advantage: true, source: 'Cleric1' })
    })

    it('finds Improved Duplicity among other buff entries', () => {
      getRuntimeValue.mockReturnValue([
        { name: 'Other Buff', effect: 'some_effect' },
        makeImprovedDuplicityBuff(),
      ])

      const result = getDuplicityAdvantageAgainst({
        targetPos: { gridX: 1, gridY: 1 },
        attackerName: 'Attacker',
        campaignName: '',
        mapData: makeMapData([makePlayer('Attacker'), makePlayer('Cleric')]),
        skipRangeCheck: true,
      })
      expect(result).toEqual({ advantage: true, source: 'Cleric' })
    })

    it('ignores a buff that has create_illusion but NOT isImprovedDuplicity', () => {
      getRuntimeValue.mockReturnValue([makeBasicIllusionBuff()])

      const result = getDuplicityAdvantageAgainst({
        targetPos: { gridX: 1, gridY: 1 },
        attackerName: 'Attacker',
        campaignName: '',
        mapData: makeMapData([makePlayer('Attacker'), makePlayer('Cleric')]),
        skipRangeCheck: true,
      })
      expect(result).toEqual({ advantage: false })
    })

    it('does not call getDistanceFeet', () => {
      getRuntimeValue.mockImplementation((name) =>
        name === 'Cleric' ? [makeImprovedDuplicityBuff()] : [],
      )

      getDuplicityAdvantageAgainst({
        targetPos: { gridX: 1, gridY: 1 },
        attackerName: 'Attacker',
        campaignName: '',
        mapData: makeMapData([makePlayer('Attacker'), makePlayer('Cleric')]),
        skipRangeCheck: true,
      })
      expect(getDistanceFeet).not.toHaveBeenCalled()
    })

    it('calls getRuntimeValue with correct campaignName', () => {
      getRuntimeValue.mockImplementation((name) =>
        name === 'Cleric' ? [makeImprovedDuplicityBuff()] : [],
      )

      getDuplicityAdvantageAgainst({
        targetPos: { gridX: 1, gridY: 1 },
        attackerName: 'Attacker',
        campaignName: 'MyCampaign',
        mapData: makeMapData([makePlayer('Attacker'), makePlayer('Cleric')]),
        skipRangeCheck: true,
      })

      expect(getRuntimeValue).toHaveBeenCalledWith(
        'Cleric',
        'activeBuffs',
        'MyCampaign',
      )
    })
  })

  // ── skipRangeCheck = false (range checking) ──────────────────

  describe('skipRangeCheck is false', () => {
    it('returns false when no other player has Improved Duplicity', () => {
      const result = getDuplicityAdvantageAgainst({
        targetPos: { gridX: 1, gridY: 1 },
        attackerName: 'Attacker',
        campaignName: '',
        mapData: makeMapData([
          makePlayer('Attacker', 0, 0),
          makePlayer('Cleric', 3, 0),
        ]),
        skipRangeCheck: false,
      })
      expect(result).toEqual({ advantage: false })
    })

    it('skips the attacker even if they have Improved Duplicity', () => {
      getRuntimeValue.mockImplementation((name) =>
        name === 'Attacker' ? [makeImprovedDuplicityBuff()] : [],
      )

      const result = getDuplicityAdvantageAgainst({
        targetPos: { gridX: 1, gridY: 1 },
        attackerName: 'Attacker',
        campaignName: '',
        mapData: makeMapData([makePlayer('Attacker')]),
        skipRangeCheck: false,
      })
      expect(result).toEqual({ advantage: false })
    })

    it('returns true when a player with Improved Duplicity is within 5ft (inclusive)', () => {
      getRuntimeValue.mockImplementation((name) =>
        name === 'Cleric' ? [makeImprovedDuplicityBuff()] : [],
      )
      getDistanceFeet.mockReturnValue(5)

      const result = getDuplicityAdvantageAgainst({
        targetPos: { gridX: 1, gridY: 1 },
        attackerName: 'Attacker',
        campaignName: '',
        mapData: makeMapData([
          makePlayer('Attacker', 0, 0),
          makePlayer('Cleric', 1, 0),
        ]),
        skipRangeCheck: false,
      })
      expect(result).toEqual({ advantage: true, source: 'Cleric' })
    })

    it('returns true when distance is under 5ft or zero (same square)', () => {
      getRuntimeValue.mockImplementation((name) =>
        name === 'Cleric' ? [makeImprovedDuplicityBuff()] : [],
      )

      getDistanceFeet.mockReturnValue(3)
      const result1 = getDuplicityAdvantageAgainst({
        targetPos: { gridX: 1, gridY: 1 },
        attackerName: 'Attacker',
        campaignName: '',
        mapData: makeMapData([
          makePlayer('Attacker', 0, 0),
          makePlayer('Cleric', 1, 0),
        ]),
        skipRangeCheck: false,
      })
      expect(result1).toEqual({ advantage: true, source: 'Cleric' })

      getDistanceFeet.mockReturnValue(0)
      const result2 = getDuplicityAdvantageAgainst({
        targetPos: { gridX: 1, gridY: 1 },
        attackerName: 'Attacker',
        campaignName: '',
        mapData: makeMapData([
          makePlayer('Cleric', 0, 0),
          makePlayer('Attacker', 0, 0),
        ]),
        skipRangeCheck: false,
      })
      expect(result2).toEqual({ advantage: true, source: 'Cleric' })
    })

    it('returns false when distance is over 5ft or just over (5.5)', () => {
      getRuntimeValue.mockImplementation((name) =>
        name === 'Cleric' ? [makeImprovedDuplicityBuff()] : [],
      )

      getDistanceFeet.mockReturnValue(10)
      const result1 = getDuplicityAdvantageAgainst({
        targetPos: { gridX: 1, gridY: 1 },
        attackerName: 'Attacker',
        campaignName: '',
        mapData: makeMapData([
          makePlayer('Attacker', 0, 0),
          makePlayer('Cleric', 3, 0),
        ]),
        skipRangeCheck: false,
      })
      expect(result1).toEqual({ advantage: false })

      getDistanceFeet.mockReturnValue(5.5)
      const result2 = getDuplicityAdvantageAgainst({
        targetPos: { gridX: 1, gridY: 1 },
        attackerName: 'Attacker',
        campaignName: '',
        mapData: makeMapData([
          makePlayer('Attacker', 0, 0),
          makePlayer('Cleric', 2, 0),
        ]),
        skipRangeCheck: false,
      })
      expect(result2).toEqual({ advantage: false })
    })

    it('returns false when getDistanceFeet returns null', () => {
      getRuntimeValue.mockImplementation((name) =>
        name === 'Cleric' ? [makeImprovedDuplicityBuff()] : [],
      )
      getDistanceFeet.mockReturnValue(null)

      const result = getDuplicityAdvantageAgainst({
        targetPos: { gridX: 1, gridY: 1 },
        attackerName: 'Attacker',
        campaignName: '',
        mapData: makeMapData([
          makePlayer('Attacker', 0, 0),
          makePlayer('Cleric', null, null),
        ]),
        skipRangeCheck: false,
      })
      expect(result).toEqual({ advantage: false })
    })

    it('ignores non-Improved Duplicity buffs on other players', () => {
      getRuntimeValue.mockReturnValue([makeBasicIllusionBuff()])

      const result = getDuplicityAdvantageAgainst({
        targetPos: { gridX: 1, gridY: 1 },
        attackerName: 'Attacker',
        campaignName: '',
        mapData: makeMapData([
          makePlayer('Attacker', 0, 0),
          makePlayer('Cleric', 1, 0),
        ]),
        skipRangeCheck: false,
      })
      expect(result).toEqual({ advantage: false })
    })

    it('finds Improved Duplicity among other buff entries', () => {
      getRuntimeValue.mockReturnValue([
        { name: 'Other Buff', effect: 'some_effect' },
        makeImprovedDuplicityBuff(),
      ])
      getDistanceFeet.mockReturnValue(3)

      const result = getDuplicityAdvantageAgainst({
        targetPos: { gridX: 1, gridY: 1 },
        attackerName: 'Attacker',
        campaignName: '',
        mapData: makeMapData([
          makePlayer('Cleric', 1, 0),
          makePlayer('Attacker', 2, 0),
        ]),
        skipRangeCheck: false,
      })
      expect(result).toEqual({ advantage: true, source: 'Cleric' })
    })

    it('skips players without the buff and checks the next one', () => {
      getRuntimeValue.mockImplementation((name) =>
        name === 'Player2' ? [makeImprovedDuplicityBuff()] : [],
      )
      getDistanceFeet.mockReturnValue(3)

      const result = getDuplicityAdvantageAgainst({
        targetPos: { gridX: 1, gridY: 1 },
        attackerName: 'Attacker',
        campaignName: '',
        mapData: makeMapData([
          makePlayer('Player1'),
          makePlayer('Player2'),
          makePlayer('Attacker'),
        ]),
        skipRangeCheck: false,
      })
      expect(result).toEqual({ advantage: true, source: 'Player2' })
    })

    it('skips players that are out of range and checks the next one', () => {
      getRuntimeValue.mockImplementation((name) =>
        name === 'Cleric1' || name === 'Cleric2' ? [makeImprovedDuplicityBuff()] : [],
      )
      getDistanceFeet.mockReturnValueOnce(15) // Cleric1 out of range
      getDistanceFeet.mockReturnValueOnce(3) // Cleric2 in range

      const result = getDuplicityAdvantageAgainst({
        targetPos: { gridX: 1, gridY: 1 },
        attackerName: 'Attacker',
        campaignName: '',
        mapData: makeMapData([
          makePlayer('Cleric1'),
          makePlayer('Cleric2'),
          makePlayer('Attacker'),
        ]),
        skipRangeCheck: false,
      })
      expect(result).toEqual({ advantage: true, source: 'Cleric2' })
    })

    it('returns false when all buffed players are out of range', () => {
      getRuntimeValue.mockImplementation((name) =>
        name === 'Cleric1' || name === 'Cleric2' ? [makeImprovedDuplicityBuff()] : [],
      )
      getDistanceFeet.mockReturnValue(15)

      const result = getDuplicityAdvantageAgainst({
        targetPos: { gridX: 1, gridY: 1 },
        attackerName: 'Attacker',
        campaignName: '',
        mapData: makeMapData([
          makePlayer('Cleric1'),
          makePlayer('Cleric2'),
          makePlayer('Attacker'),
        ]),
        skipRangeCheck: false,
      })
      expect(result).toEqual({ advantage: false })
    })

    it('does not call getDistanceFeet when no player has the buff', () => {
      const result = getDuplicityAdvantageAgainst({
        targetPos: { gridX: 1, gridY: 1 },
        attackerName: 'Attacker',
        campaignName: '',
        mapData: makeMapData([
          makePlayer('Attacker', 0, 0),
          makePlayer('Cleric', 1, 0),
        ]),
        skipRangeCheck: false,
      })
      expect(result).toEqual({ advantage: false })
      expect(getDistanceFeet).not.toHaveBeenCalled()
    })

    it('passes the correct positions to getDistanceFeet', () => {
      getRuntimeValue.mockImplementation((name) =>
        name === 'Cleric' ? [makeImprovedDuplicityBuff()] : [],
      )
      getDistanceFeet.mockReturnValue(5)

      getDuplicityAdvantageAgainst({
        targetPos: { gridX: 7, gridY: 11 },
        attackerName: 'Attacker',
        campaignName: '',
        mapData: makeMapData([
          makePlayer('Cleric', 2, 3),
          makePlayer('Attacker', 0, 0),
        ]),
        skipRangeCheck: false,
      })

      expect(getDistanceFeet).toHaveBeenCalledWith(
        { gridX: 2, gridY: 3 },
        { gridX: 7, gridY: 11 },
      )
    })

    it('calls getRuntimeValue with correct campaignName', () => {
      getRuntimeValue.mockReturnValue([])

      getDuplicityAdvantageAgainst({
        targetPos: { gridX: 1, gridY: 1 },
        attackerName: 'Attacker',
        campaignName: 'MyCampaign',
        mapData: makeMapData([
          makePlayer('Attacker', 0, 0),
          makePlayer('Cleric', 1, 0),
        ]),
        skipRangeCheck: false,
      })

      expect(getRuntimeValue).toHaveBeenCalledWith(
        'Cleric',
        'activeBuffs',
        'MyCampaign',
      )
    })
  })

  // ── skipRangeCheck edge cases ─────────────────────────────────

  describe('skipRangeCheck edge cases', () => {
    it('treats undefined skipRangeCheck as false (uses range checking)', () => {
      getRuntimeValue.mockImplementation((name) =>
        name === 'Cleric' ? [makeImprovedDuplicityBuff()] : [],
      )
      getDistanceFeet.mockReturnValue(3)

      const result = getDuplicityAdvantageAgainst({
        targetPos: { gridX: 1, gridY: 1 },
        attackerName: 'Attacker',
        campaignName: '',
        mapData: makeMapData([
          makePlayer('Attacker', 0, 0),
          makePlayer('Cleric', 1, 0),
        ]),
      })

      expect(result).toEqual({ advantage: true, source: 'Cleric' })
    })
  })
})
