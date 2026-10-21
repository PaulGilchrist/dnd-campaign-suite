// @maintained-by-ai
// CLA-145: Font of Inspiration SHORT-rest re-arm lane (restRules-shortRest.js).
// Mechanism: disk canon (2024 classes.json Bard lv5) says "regain all expended
// uses ... when you finish a Short or Long Rest". 'bardicInspirationUses' is NOT
// in SHORT_REST_RESOURCES, so the short-rest re-arm is a gated-special:
// addFontOfInspirationUpdates runs OUTSIDE the skipAutoRecovery gate and writes
// the numeric CHA max into the same atomic batch ShortRestModal (skipAutoRecovery:
// true) relies on (the CLA-145 bug: modal logged "Resources restored" with no
// write). The honest label rides the return flag — fontOfInspirationRestored is
// true only when a below-max numeric pool was actually restored, never on the
// passive's presence or the null-key pin. LR contrast: LR DOES re-arm, but via
// the generic LONG_REST_RESOURCES null-reset lane (restRules-constants base lane),
// not this adder. Consume side (slot->use conversion) is owned by
// fontOfInspirationHandler.test.js; non-modal generic restore by
// restRules-shortRest.test.js — not duplicated here.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { applyShortRest } from './restRules.js'
import { SHORT_REST_RESOURCES, LONG_REST_RESOURCES } from './restRules-constants.js'

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
  // automation/index.js imports handle + confirm/skip statically — mock full surface
  handle: vi.fn(() => null),
  confirmCelestialResilience: vi.fn(() => null),
  skipCelestialResilience: vi.fn(() => null),
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
const BARD = 'HeroesFeastBard'

function makeBard(overrides = {}) {
  return {
    name: BARD,
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
  expect(setRuntimeBatch).toHaveBeenCalledTimes(1)
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

  it('disk canon: Bard lv5 feature drives the counter, and the SR lane is a gated-special', () => {
    const classes = JSON.parse(readFileSync(resolve(process.cwd(), 'public/data/2024/classes.json'), 'utf8'))
    const bard = classes.find(c => c.name === 'Bard')
    const font = (bard?.class_levels || [])
      .flatMap(lv => lv.features || [])
      .find(f => f?.automation?.type === 'font_of_inspiration')

    expect(font?.name).toBe('Font of Inspiration')
    expect(font?.level).toBe(5)
    expect(font?.description).toMatch(/Short or Long Rest/i)

    // The key is NOT in the generic short-rest batch — addFontOfInspirationUpdates
    // is the ONLY short-rest path for this counter, and it must stay ungated.
    expect(SHORT_REST_RESOURCES).not.toContain('bardicInspirationUses')
    // LR contrast: the long rest DOES re-arm, via the generic null-reset lane.
    expect(LONG_REST_RESOURCES).toContain('bardicInspirationUses')
  })

  it.each([
    ['empty pool refills to CHA max', 0, 5, true],
    ['mid-pool regains every expended use', 2, 5, true],
    ['already at max writes nothing and reports nothing', 5, undefined, false],
    ['unset key pins CHA max but nothing was expended to restore', undefined, 5, false],
  ])('modal lane (skipAutoRecovery:true): %s', async (_desc, storedBI, wantWrite, wantRestored) => {
    stubRuntime({ bardicInspirationUses: storedBI })
    const result = await applyShortRest(makeBard(), CAMPAIGN, { skipAutoRecovery: true })

    // Restore must ride the ONE atomic batch, alongside the HP write.
    const updates = getBatchUpdates()
    expect(setRuntimeBatch).toHaveBeenCalledWith(BARD, expect.objectContaining({ currentHitPoints: 163 }), CAMPAIGN)
    expect(updates.bardicInspirationUses).toBe(wantWrite)
    // Honest label: true only when a below-max pool was actually restored.
    expect(result.fontOfInspirationRestored).toBe(wantRestored)
  })

  it('branch bait: a Bard WITHOUT the passive keeps its spent pool (SR is not a RAW BI reset)', async () => {
    stubRuntime({ bardicInspirationUses: 1 })
    const nonHolder = makeBard({ automation: { passives: [] } })
    const result = await applyShortRest(nonHolder, CAMPAIGN, { skipAutoRecovery: true })

    // Batch still lands (absence of the key is meaningful, not a missing write).
    const updates = getBatchUpdates()
    expect(updates.currentHitPoints).toBe(163)
    expect(updates.bardicInspirationUses).toBeUndefined()
    expect(result.fontOfInspirationRestored).toBe(false)
  })

  it.each([
    ['modal lane skips Arcane Recovery', { skipAutoRecovery: true }, undefined, 0],
    ['ungated lane recovers slots and consumes the budget', undefined, 2, 1],
  ])('skipAutoRecovery gate boundary: %s', async (_desc, options, wantSlot, wantArcaneLogs) => {
    stubRuntime({ spell_slots_level_1: 0 })
    const wizard = makeBard({
      class: { name: 'Wizard' },
      level: 4,
      spellAbilities: { spell_slots_level_1: 4 },
      automation: { passives: [{ type: 'resource_restoration', resourceKey: 'arcaneRecoveryLevels' }] },
    })
    await applyShortRest(wizard, CAMPAIGN, options)

    const updates = getBatchUpdates()
    expect(updates.spell_slots_level_1).toBe(wantSlot)
    const arcaneLogs = vi.mocked(addEntry).mock.calls
      .map(c => c[1])
      .filter(e => e && /^arcane_recovery_/.test(e.automationType || ''))
    expect(arcaneLogs).toHaveLength(wantArcaneLogs)
    if (wantArcaneLogs) expect(arcaneLogs[0].automationType).toBe('arcane_recovery_applied')
  })
})
