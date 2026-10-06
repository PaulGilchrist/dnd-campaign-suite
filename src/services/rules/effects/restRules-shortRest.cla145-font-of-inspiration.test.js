// CLA-145: Font of Inspiration short-rest restore lane.
// The ShortRestModal calls applyShortRest with skipAutoRecovery:true; BI restore
// must still land in the atomic batch, and the honest log label must ride the
// actual write (fontOfInspirationRestored), never the passive's presence.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { applyShortRest } from './restRules.js'

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
import { addEntry } from '../../../services/ui/logService.js'

const CAMPAIGN = 'test-campaign'

function makeBard(overrides = {}) {
  return {
    name: 'HeroesFeastBard',
    hitPoints: 163,
    level: 20,
    proficiency: 6,
    rules: '2024',
    class: { name: 'Bard', hit_point_die: 'd8', major: { name: 'College of Glamour' } },
    abilities: [{ name: 'Charisma', bonus: 5 }],
    automation: { passives: [{ type: 'font_of_inspiration' }] },
    ...overrides,
  }
}

function getBatchUpdates() {
  return vi.mocked(setRuntimeBatch).mock.calls[0][1]
}

function stubRuntime(returns) {
  vi.mocked(getRuntimeValue).mockImplementation((_name, key) => {
    if (key in returns) return returns[key]
    return undefined
  })
}

describe('CLA-145 applyShortRest — Font of Inspiration restore lane', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    stubRuntime({})
  })

  it('restores bardicInspirationUses to CHA max on the modal lane (skipAutoRecovery:true)', async () => {
    stubRuntime({ bardicInspirationUses: 0 })
    const result = await applyShortRest(makeBard(), CAMPAIGN, { skipAutoRecovery: true })

    expect(getBatchUpdates().bardicInspirationUses).toBe(5)
    expect(result.fontOfInspirationRestored).toBe(true)
  })

  it('restores expended uses mid-pool (2 -> 5) and reports restored', async () => {
    stubRuntime({ bardicInspirationUses: 2 })
    const result = await applyShortRest(makeBard(), CAMPAIGN, { skipAutoRecovery: true })

    expect(getBatchUpdates().bardicInspirationUses).toBe(5)
    expect(result.fontOfInspirationRestored).toBe(true)
  })

  it('does not report restored when the numeric pool is already at max', async () => {
    stubRuntime({ bardicInspirationUses: 5 })
    const result = await applyShortRest(makeBard(), CAMPAIGN, { skipAutoRecovery: true })

    expect(getBatchUpdates().bardicInspirationUses).toBeUndefined()
    expect(result.fontOfInspirationRestored).toBe(false)
  })

  it('null key (long-rest re-arm) pins max but reports nothing restored', async () => {
    stubRuntime({})
    const result = await applyShortRest(makeBard(), CAMPAIGN, { skipAutoRecovery: true })

    expect(getBatchUpdates().bardicInspirationUses).toBe(5)
    expect(result.fontOfInspirationRestored).toBe(false)
  })

  it('non-holder bards keep their spent pool untouched (short rest is not a RAW BI reset)', async () => {
    stubRuntime({ bardicInspirationUses: 1 })
    const nonHolder = makeBard({ automation: { passives: [] } })
    const result = await applyShortRest(nonHolder, CAMPAIGN, { skipAutoRecovery: true })

    expect(getBatchUpdates().bardicInspirationUses).toBeUndefined()
    expect(result.fontOfInspirationRestored).toBe(false)
  })

  it('keeps other auto-recoveries behind the skipAutoRecovery gate', async () => {
    stubRuntime({ spell_slots_level_1: 0 })
    const wizard = makeBard({
      class: { name: 'Wizard' },
      level: 4,
      spellAbilities: { spell_slots_level_1: 4 },
      automation: { passives: [{ type: 'resource_restoration', resourceKey: 'arcaneRecoveryLevels' }] },
    })
    await applyShortRest(wizard, CAMPAIGN, { skipAutoRecovery: true })

    const updates = getBatchUpdates()
    expect(updates.spell_slots_level_1).toBeUndefined()
    const arcaneLogs = vi.mocked(addEntry).mock.calls
      .map(c => c[1])
      .filter(e => e && /^arcane_recovery_/.test(e.automationType || ''))
    expect(arcaneLogs).toHaveLength(0)
  })

  it('non-modal lane stays byte-identical (skipAutoRecovery absent)', async () => {
    stubRuntime({ bardicInspirationUses: 0 })
    const result = await applyShortRest(makeBard(), CAMPAIGN)

    expect(getBatchUpdates().bardicInspirationUses).toBe(5)
    expect(result.fontOfInspirationRestored).toBe(true)
  })
})
