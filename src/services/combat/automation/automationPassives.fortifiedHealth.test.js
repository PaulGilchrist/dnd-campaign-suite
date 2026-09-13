import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  resolveHealingBonuses,
  resolveHealingBonusesWithDetails,
} from './automationPassives.js'

// ── Mocks ──────────────────────────────────────────────────────────

vi.mock('./automationExpressions.js', () => ({
  evaluateAutoExpression: vi.fn(),
}))

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
}))

vi.mock('../../../shared/abilityLookup.js', () => ({
  getAbilityModifier: vi.fn((_abilities, abilityName) => {
    const map = { constitution: 2 }
    return map[abilityName?.toLowerCase()] ?? 0
  }),
}))

// ── Imports for mocked modules ─────────────────────────────────────

import { evaluateAutoExpression } from './automationExpressions.js'
import { getRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js'

// ── Helpers ────────────────────────────────────────────────────────

const CAMPAIGN_NAME = 'test-campaign'

function makePlayerStatsWithFortifiedHealth(overrides = {}) {
  return {
    name: 'TestChar',
    abilities: [{ name: 'Constitution', bonus: 14 }],
    automation: {
      passives: [
        {
          type: 'passive_rule',
          effect: 'max_hp_increase',
          alsoSelfHealing: {
            extraHealingExpression: 'CON modifier',
            oncePerTurn: true,
          },
        },
      ],
    },
    ...overrides,
  }
}

// ── Tests ──────────────────────────────────────────────────────────

describe('resolveHealingBonuses - Fortified Health once-per-turn', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    evaluateAutoExpression.mockReturnValue(2)
  })

  it('applies bonus when flag is not set', () => {
    getRuntimeValue.mockReturnValue(null)
    const playerStats = makePlayerStatsWithFortifiedHealth()
    const result = resolveHealingBonuses(playerStats, 5, 3, 3, CAMPAIGN_NAME)
    expect(result).toBe(2)
  })

  it('skips bonus when flag is already set (same store as markFortifiedHealthUsed)', () => {
    // markFortifiedHealthUsed writes to playerStats.name store via markOncePerTurn
    getRuntimeValue.mockImplementation((charKey) => {
      if (charKey === 'TestChar') return { round: 1, activeCreature: 'TestChar' }
      return null
    })
    const playerStats = makePlayerStatsWithFortifiedHealth()
    const result = resolveHealingBonuses(playerStats, 5, 3, 3, CAMPAIGN_NAME)
    expect(result).toBe(0)
  })

  it('reads from character store (null store returns null, character store returns flag)', () => {
    // Verify that reading from null (wrong store) would return null
    // but reading from playerStats.name (correct store) returns the flag
    getRuntimeValue.mockImplementation((charKey) => {
      if (charKey === null) return null
      if (charKey === 'TestChar') return { round: 1, activeCreature: 'TestChar' }
      return null
    })
    const playerStats = makePlayerStatsWithFortifiedHealth()
    const result = resolveHealingBonuses(playerStats, 5, 3, 3, CAMPAIGN_NAME)
    expect(result).toBe(0)
  })
})

describe('resolveHealingBonusesWithDetails - Fortified Health once-per-turn', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    evaluateAutoExpression.mockReturnValue(2)
  })

  it('applies bonus when flag is not set for self', () => {
    getRuntimeValue.mockReturnValue(null)
    const playerStats = makePlayerStatsWithFortifiedHealth()
    const result = resolveHealingBonusesWithDetails(playerStats, { prof: 5, level: 3, slotLevel: 3, campaignName: CAMPAIGN_NAME })
    expect(result.totalBonus).toBe(2)
    expect(result.details).toEqual([{ amount: 2 }])
  })

  it('skips bonus when flag is already set for self', () => {
    getRuntimeValue.mockImplementation((charKey) => {
      if (charKey === 'TestChar') return { round: 1, activeCreature: 'TestChar' }
      return null
    })
    const playerStats = makePlayerStatsWithFortifiedHealth()
    const result = resolveHealingBonusesWithDetails(playerStats, { prof: 5, level: 3, slotLevel: 3, campaignName: CAMPAIGN_NAME })
    expect(result.totalBonus).toBe(0)
    expect(result.details).toEqual([])
  })

  it('checks separate stores for self vs target', () => {
    // Self flag is set, target flag is not set
    getRuntimeValue.mockImplementation((charKey) => {
      if (charKey === 'TestChar') return { round: 1, activeCreature: 'TestChar' }
      if (charKey === 'Ally') return null
      return null
    })
    const playerStats = makePlayerStatsWithFortifiedHealth({ name: 'TestChar' })
    const targetStats = makePlayerStatsWithFortifiedHealth({ name: 'Ally' })
    const result = resolveHealingBonusesWithDetails(playerStats, { prof: 5, level: 3, slotLevel: 3, campaignName: CAMPAIGN_NAME, targetStats })
    // Self bonus skipped, target bonus applied
    expect(result.totalBonus).toBe(2)
  })

  it('skips both self and target when both flags are set', () => {
    getRuntimeValue.mockImplementation((charKey) => {
      if (charKey === 'TestChar') return { round: 1, activeCreature: 'TestChar' }
      if (charKey === 'Ally') return { round: 1, activeCreature: 'Ally' }
      return null
    })
    const playerStats = makePlayerStatsWithFortifiedHealth({ name: 'TestChar' })
    const targetStats = makePlayerStatsWithFortifiedHealth({ name: 'Ally' })
    const result = resolveHealingBonusesWithDetails(playerStats, { prof: 5, level: 3, slotLevel: 3, campaignName: CAMPAIGN_NAME, targetStats })
    expect(result.totalBonus).toBe(0)
    expect(result.details).toEqual([])
  })
})
