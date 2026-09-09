// CLA-372 regression: Long Rest remains the ONLY legitimate reset of the
// Uncanny Metabolism once-per-Long-Rest latch (initiativeProcessing.js no
// longer clears it on initiative rolls).
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { applyLongRest } from './restRules.js'

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => undefined),
  setRuntimeBatch: vi.fn(),
  setRuntimeValue: vi.fn(),
  getAllStoreKeys: vi.fn(() => []),
}))

vi.mock('../../../services/dice/diceRoller.js', () => ({
  rollD20: vi.fn(() => 10),
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

vi.mock('../../../services/automation/handlers/buffs/tempHpService.js', () => ({
  setTempHp: vi.fn((name, amount) => amount),
}))

vi.mock('../features/invisibilityService.js', () => ({
  endInvisibility: vi.fn(),
  endGreaterInvisibility: vi.fn(),
}))

vi.mock('../../../services/ui/storage.js', () => ({
  default: { set: vi.fn() },
}))

import { setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js'

const CAMPAIGN = 'test-campaign'

function makeMonkStats(overrides = {}) {
  return {
    name: 'Disciplined_Monk',
    hitPoints: 129,
    level: 18,
    proficiency: 6,
    abilities: [{ name: 'Wisdom', bonus: 4 }],
    automation: { passives: [] },
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('applyLongRest — CLA-372 Uncanny Metabolism re-arm', () => {
  it('resets uncannyMetabolismUsed to false on long rest', async () => {
    await applyLongRest(makeMonkStats(), CAMPAIGN)

    expect(setRuntimeValue).toHaveBeenCalledWith(
      'Disciplined_Monk', 'uncannyMetabolismUsed', false, CAMPAIGN, true,
    )
  })
})
