// BUG CLA-140 lock: Fiendish Resilience re-chooses when you finish a Short
// OR Long Rest (classes.json Fiend Patron lv10). The used-latch must be nulled
// by BOTH rest lanes; only the re-choose gate clears — the chosen type
// (_Fiendish_Resilience_chosenType) persists "until you choose a different one",
// so it must appear in NEITHER reset lane.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getShortRestResources, getLongRestResources } from './restRules-constants.js'
import { applyShortRest } from './restRules.js'

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

vi.mock('../features/invisibilityService.js', () => ({
  endInvisibility: vi.fn(),
  endGreaterInvisibility: vi.fn(),
}))

vi.mock('../../../services/ui/storage.js', () => ({
  default: { set: vi.fn() },
}))

import { getRuntimeValue, setRuntimeBatch } from '../../../hooks/runtime/useRuntimeState.js'

const CAMPAIGN = 'test-campaign'

function makeStats() {
  return {
    name: 'HexWarlock',
    hitPoints: 100,
    level: 20,
    proficiency: 6,
    class: { name: 'Warlock', hit_point_die: 'd10' },
    abilities: [{ name: 'Charisma', bonus: 5 }],
  }
}

describe('CLA-140 Fiendish Resilience short-rest re-arm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getRuntimeValue).mockReturnValue(undefined)
  })

  it('clears the _fiendishResilienceUsed latch on a Short Rest', () => {
    expect(getShortRestResources()).toContain('_fiendishResilienceUsed')
  })

  it('keeps the Long Rest re-arm lane for _fiendishResilienceUsed', () => {
    expect(getLongRestResources()).toContain('_fiendishResilienceUsed')
  })

  it('applyShortRest nulls _fiendishResilienceUsed but never the chosen type', async () => {
    await applyShortRest(makeStats(), CAMPAIGN)

    const updates = vi.mocked(setRuntimeBatch).mock.calls[0][1]
    expect(updates._fiendishResilienceUsed).toBeNull()
    expect(updates).not.toHaveProperty('_Fiendish_Resilience_chosenType')
  })
})
