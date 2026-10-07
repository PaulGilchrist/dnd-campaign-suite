// FT-046: Inspiring Leader (Bolstering Performance) once-per-rest latch re-arm.
// confirmBolsteringPerformance stamps inspiringLeaderUsedSinceRest=true (merged
// into the bard's single store write); SHORT_REST_NULL_FLAG_KEYS nulls it in the
// applyShortRest batch (modal lane uses skipAutoRecovery:true) and
// LONG_REST_RESOURCES covers the long rest (CLA-226 memorizeSpellUsedSinceRest
// precedent), so the row re-arms only when a rest actually finishes.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { applyShortRest } from './restRules.js'
import { LONG_REST_RESOURCES } from './restRules-constants.js'

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => undefined),
  setRuntimeBatch: vi.fn(),
  setRuntimeValue: vi.fn(),
  getAllStoreKeys: vi.fn(() => []),
}))

vi.mock('./expirations.js', () => ({
  clearAllExpirationEffects: vi.fn(),
}))

vi.mock('../../combat/conditions/exhaustionRules.js', () => ({
  getLevelAfterLongRest: vi.fn((level) => Math.max(0, level - 1)),
}))

vi.mock('../../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve({})),
}))

vi.mock('../../../services/encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(() => null),
  setCombatSummaryCache: vi.fn(),
}))

vi.mock('../../../services/combat/concentration/concentrationService.js', () => ({
  clearAllConcentrations: vi.fn(),
}))

vi.mock('../../../services/automation/handlers/class-warlock/celestialResilienceHandler.js', () => ({
  grantCelestialResilience: vi.fn(() => null),
}))

vi.mock('../features/invisibilityService.js', () => ({
  endInvisibility: vi.fn(),
  endGreaterInvisibility: vi.fn(),
}))

vi.mock('../../../services/ui/storage.js', () => ({
  default: { set: vi.fn() },
}))

import { getRuntimeValue, setRuntimeBatch } from '../../../hooks/runtime/useRuntimeState.js'

const CAMPAIGN = 'test-campaign'

function makeBard(overrides = {}) {
  return {
    name: 'HeroesFeastBard',
    hitPoints: 158,
    level: 20,
    proficiency: 6,
    rules: '2024',
    class: { name: 'Bard', hit_point_die: 'd8', major: { name: 'College of Valour' } },
    abilities: [
      { name: 'Charisma', bonus: 5 },
      { name: 'Wisdom', bonus: 0 },
    ],
    automation: {
      specialActions: [{
        type: 'temp_hp_buff',
        name: 'Bolstering Performance',
        featName: 'Inspiring Leader',
        multiTargetAlly: true,
        casting_time: 'passive',
      }],
    },
    ...overrides,
  }
}

function getBatchUpdates() {
  return vi.mocked(setRuntimeBatch).mock.calls[0][1]
}

describe('FT-046 applyShortRest — Inspiring Leader latch re-arm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getRuntimeValue).mockImplementation(() => undefined)
  })

  it('nulls inspiringLeaderUsedSinceRest in the short-rest batch (modal lane, skipAutoRecovery)', async () => {
    const stats = makeBard()
    await applyShortRest(stats, CAMPAIGN, { skipAutoRecovery: true })

    const updates = getBatchUpdates()
    expect(updates.inspiringLeaderUsedSinceRest).toBeNull()
  })

  it('nulls inspiringLeaderUsedSinceRest on the non-modal lane too', async () => {
    const stats = makeBard()
    await applyShortRest(stats, CAMPAIGN)

    const updates = getBatchUpdates()
    expect(updates.inspiringLeaderUsedSinceRest).toBeNull()
  })

  it('registers inspiringLeaderUsedSinceRest in LONG_REST_RESOURCES (long-rest superset)', () => {
    expect(LONG_REST_RESOURCES).toContain('inspiringLeaderUsedSinceRest')
  })
})
