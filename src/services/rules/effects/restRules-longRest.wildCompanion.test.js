// CLA-388: a paid-but-unspent Wild Companion Find Familiar grant must not survive a
// Long Rest ("the familiar disappears when you finish a Long Rest") — the key is
// registered in LONG_REST_RESOURCES and nulled in the rest batch.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { applyLongRest } from './restRules.js'
import { getLongRestResources } from './restRules-constants.js'

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

vi.mock('../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve({})),
}))

vi.mock('../../encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(() => null),
  setCombatSummaryCache: vi.fn(),
}))

vi.mock('../../combat/concentration/concentrationService.js', () => ({
  clearAllConcentrations: vi.fn(),
}))

vi.mock('../../automation/handlers/class-warlock/celestialResilienceHandler.js', () => ({
  grantCelestialResilience: vi.fn(() => null),
}))

vi.mock('../../automation/handlers/buffs/tempHpService.js', () => ({
  setTempHp: vi.fn((name, amount) => amount),
}))

vi.mock('../features/invisibilityService.js', () => ({
  endInvisibility: vi.fn(),
  endGreaterInvisibility: vi.fn(),
}))

vi.mock('../../ui/storage.js', () => ({
  default: { set: vi.fn() },
}))

import { setRuntimeBatch } from '../../../hooks/runtime/useRuntimeState.js'

const CAMPAIGN = 'test-campaign'

function makeDruid() {
  return {
    name: 'Wild_Sage_Druid',
    hitPoints: 90,
    level: 20,
    proficiency: 6,
    class: { name: 'Druid', hit_point_die: 'd8', class_levels: [{ level: 2, wild_shape: 2 }] },
    abilities: [{ name: 'Wisdom', bonus: 5 }],
  }
}

describe('CLA-388 Wild Companion Long Rest reset', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('registers _Wild_Companion_freeCast in LONG_REST_RESOURCES', () => {
    expect(getLongRestResources()).toContain('_Wild_Companion_freeCast')
  })

  it('nulls a paid-but-unspent Wild Companion grant in the long rest batch', async () => {
    await applyLongRest(makeDruid(), CAMPAIGN)
    const batch = vi.mocked(setRuntimeBatch).mock.calls[0][1]
    expect(batch._Wild_Companion_freeCast).toBeNull()
  })
});
