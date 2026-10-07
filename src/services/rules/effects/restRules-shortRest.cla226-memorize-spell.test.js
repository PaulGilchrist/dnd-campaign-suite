// CLA-226: Memorize Spell once-per-Short-Rest latch re-arm seam.
// The swap stamps memorizeSpellUsedSinceRest=true (ShortRestModal merged batch);
// SHORT_REST_NULL_FLAG_KEYS nulls it in the applyShortRest batch (modal lane
// uses skipAutoRecovery:true) and LONG_REST_RESOURCES covers the long rest, so
// the feature re-arms only when a rest actually finishes.
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

function makeWizard(overrides = {}) {
  return {
    name: 'DivinationWizard',
    hitPoints: 157,
    level: 20,
    proficiency: 6,
    rules: '2024',
    class: { name: 'Wizard', hit_point_die: 'd6', major: { name: 'Guild Artisan' } },
    abilities: [{ name: 'Intelligence', bonus: 5 }],
    automation: { specialActions: [{ type: 'memorize_spell', casting_time: 'passive' }] },
    ...overrides,
  }
}

function getBatchUpdates() {
  return vi.mocked(setRuntimeBatch).mock.calls[0][1]
}

describe('CLA-226 applyShortRest — Memorize Spell latch re-arm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getRuntimeValue).mockImplementation(() => undefined)
  })

  it('nulls memorizeSpellUsedSinceRest in the short-rest batch (modal lane, skipAutoRecovery)', async () => {
    const stats = makeWizard()
    await applyShortRest(stats, CAMPAIGN, { skipAutoRecovery: true })

    const updates = getBatchUpdates()
    expect(updates.memorizeSpellUsedSinceRest).toBeNull()
  })

  it('nulls memorizeSpellUsedSinceRest on the non-modal lane too', async () => {
    const stats = makeWizard()
    await applyShortRest(stats, CAMPAIGN)

    const updates = getBatchUpdates()
    expect(updates.memorizeSpellUsedSinceRest).toBeNull()
  })

  it('registers memorizeSpellUsedSinceRest in LONG_REST_RESOURCES (long-rest superset)', () => {
    expect(LONG_REST_RESOURCES).toContain('memorizeSpellUsedSinceRest')
  })
})
