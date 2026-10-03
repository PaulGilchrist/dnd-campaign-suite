import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  resolveHealingBonuses,
  resolveHealingBonusesWithDetails,
  markFortifiedHealthUsedIfGranted,
} from './automationPassives.js'

// ── Mocks ──────────────────────────────────────────────────────────

vi.mock('./automationExpressions.js', () => ({
  evaluateAutoExpression: vi.fn(),
}))

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}))

vi.mock('../../encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(() => null),
}))

vi.mock('../../automation/common/oncePerTurn.js', () => ({
  markOncePerTurn: vi.fn(async (featureName, usedKey, playerStats) => ({ round: 1, activeCreature: playerStats?.name })),
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
import { getCombatSummary } from '../../encounters/combatData.js'
import { markOncePerTurn } from '../../automation/common/oncePerTurn.js'

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

// ── FT-012: round-scoped latch + owner-store marking ─────────────

describe('Fortified Health round-scoped latch (FT-012)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    evaluateAutoExpression.mockReturnValue(2)
  })

  it('blocks within the stored round', () => {
    getCombatSummary.mockReturnValue({ round: 4 })
    getRuntimeValue.mockImplementation((charKey) => {
      if (charKey === 'TestChar') return { round: 4, activeCreature: 'TestChar' }
      return null
    })
    const playerStats = makePlayerStatsWithFortifiedHealth()
    expect(resolveHealingBonuses(playerStats, 5, 3, 3, CAMPAIGN_NAME)).toBe(0)
  })

  it('re-arms once round exceeds stored round', () => {
    getCombatSummary.mockReturnValue({ round: 4 })
    getRuntimeValue.mockImplementation((charKey) => {
      if (charKey === 'TestChar') return { round: 4, activeCreature: 'TestChar' }
      return null
    })
    const playerStats = makePlayerStatsWithFortifiedHealth()
    expect(resolveHealingBonuses(playerStats, 5, 3, 3, CAMPAIGN_NAME)).toBe(0)
    getCombatSummary.mockReturnValue({ round: 5 })
    expect(resolveHealingBonuses(playerStats, 5, 3, 3, CAMPAIGN_NAME)).toBe(2)
  })

  it('legacy numeric stamp blocks only on exact round match', () => {
    getRuntimeValue.mockReturnValue(3)
    getCombatSummary.mockReturnValue({ round: 3 })
    const playerStats = makePlayerStatsWithFortifiedHealth()
    expect(resolveHealingBonuses(playerStats, 5, 3, 3, CAMPAIGN_NAME)).toBe(0)
    getCombatSummary.mockReturnValue({ round: 4 })
    expect(resolveHealingBonuses(playerStats, 5, 3, 3, CAMPAIGN_NAME)).toBe(2)
  })
})

function makeFortifiedHolder(name) {
  return makePlayerStatsWithFortifiedHealth({
    name,
    automation: {
      passives: [{
        type: 'passive_rule',
        effect: 'fortified_health',
        name: 'Fortified Health',
        amount: 40,
        alsoSelfHealing: { extraHealingExpression: 'CON modifier', oncePerTurn: true },
      }],
    },
  })
}

describe('markFortifiedHealthUsedIfGranted (FT-012)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getCombatSummary.mockReturnValue({ round: 2 })
    getRuntimeValue.mockReturnValue(null)
  })

  const fortifiedDetails = [{ name: 'Fortified Health', amount: 2 }]

  it('marks the target (passive owner) store, not the caster', async () => {
    const caster = { name: 'Wild_Sage_Druid', automation: { passives: [] } }
    const target = makeFortifiedHolder('Disciplined_Monk')
    await markFortifiedHealthUsedIfGranted(fortifiedDetails, caster, target, CAMPAIGN_NAME)
    expect(markOncePerTurn).toHaveBeenCalledTimes(1)
    expect(markOncePerTurn.mock.calls[0][1]).toBe('_fortifiedHealth_usedRound')
    expect(markOncePerTurn.mock.calls[0][2].name).toBe('Disciplined_Monk')
  })

  it('marks the caster store when the caster owns the passive', async () => {
    const caster = makeFortifiedHolder('Disciplined_Monk')
    const target = { name: 'Ally', automation: { passives: [] } }
    await markFortifiedHealthUsedIfGranted(fortifiedDetails, caster, target, CAMPAIGN_NAME)
    expect(markOncePerTurn).toHaveBeenCalledTimes(1)
    expect(markOncePerTurn.mock.calls[0][2].name).toBe('Disciplined_Monk')
  })

  it('skips marking when details carry no Fortified Health', async () => {
    const target = makeFortifiedHolder('Disciplined_Monk')
    await markFortifiedHealthUsedIfGranted([{ name: 'Other', amount: 1 }], null, target, CAMPAIGN_NAME)
    expect(markOncePerTurn).not.toHaveBeenCalled()
  })

  it('skips marking when the owner latch is already set this round', async () => {
    getRuntimeValue.mockImplementation((charKey) => {
      if (charKey === 'Disciplined_Monk') return { round: 2, activeCreature: 'Disciplined_Monk' }
      return null
    })
    const target = makeFortifiedHolder('Disciplined_Monk')
    await markFortifiedHealthUsedIfGranted(fortifiedDetails, null, target, CAMPAIGN_NAME)
    expect(markOncePerTurn).not.toHaveBeenCalled()
  })

  it('marks both owners once each when both contributed', async () => {
    const caster = makeFortifiedHolder('CasterHolder')
    const target = makeFortifiedHolder('TargetHolder')
    await markFortifiedHealthUsedIfGranted([{ name: 'Fortified Health', amount: 4 }], caster, target, CAMPAIGN_NAME)
    expect(markOncePerTurn).toHaveBeenCalledTimes(2)
    const names = markOncePerTurn.mock.calls.map(c => c[2].name)
    expect(names).toEqual(expect.arrayContaining(['CasterHolder', 'TargetHolder']))
  })
})
