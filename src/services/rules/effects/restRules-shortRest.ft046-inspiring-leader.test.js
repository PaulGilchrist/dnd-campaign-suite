// @maintained-by-ai
// FT-046: Inspiring Leader (Bolstering Performance) once-per-rest latch re-arm seam
// (restRules-shortRest.js). Mechanism: UNGATED generic null-latch — SHORT_REST_NULL_FLAG_KEYS
// (:81) is applied by addShortRestFlagResets (:485), OUTSIDE the skipAutoRecovery gate (:453,
// which guards only Arcane Recovery), so the identical null byte rides the single atomic
// 3-arg setRuntimeBatch on BOTH the ShortRestModal lane (skipAutoRecovery:true) and the
// plain lane. Disk canon (2024 feats.json): "When you finish a Short or Long Rest..." —
// LONG_REST_RESOURCES covers the LR superset (CLA-130 rule: a latch missing from every reset
// list dies permanently). CLA-226 memorizeSpellUsedSinceRest twin. The consume side —
// handle() refuse-while-latched and confirmBolsteringPerformance stamping
// { inspiringLeaderUsedSinceRest: true, tempHp? } — is owned by
// tempHpBuffHandler.multiTargetAlly.test.js and is not re-run here.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
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

const CAMPAIGN = 'test-campaign'
const BARD = 'HeroesFeastBard'

function makeBard(overrides = {}) {
  return {
    name: BARD,
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

describe('FT-046 applyShortRest — Inspiring Leader latch re-arm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getRuntimeValue).mockImplementation(() => undefined)
  })

  it('disk canon: 2024 feats.json Bolstering Performance is once per Short or Long Rest, and LONG_REST_RESOURCES covers the LR superset', () => {
    const feats = JSON.parse(readFileSync(resolve(process.cwd(), 'public/data/2024/feats.json'), 'utf8'))
    const feat = (Array.isArray(feats) ? feats : feats.feats || []).find(f => f?.name === 'Inspiring Leader')
    const benefit = (feat?.benefits || []).find(b => b?.name === 'Bolstering Performance')

    // The rest clause on disk is what makes null re-arm on EVERY rest the correct
    // registration — if the text narrows (e.g. to long rest only), this pin forces
    // the SHORT_REST_NULL_FLAG_KEYS lane to be re-adjudicated.
    expect(benefit?.description).toMatch(/finish a Short or Long Rest/i)
    expect(benefit?.automation?.type).toBe('temp_hp_buff')
    expect(benefit?.automation?.targets).toBe(6)
    expect(benefit?.automation?.includesSelf).toBe(true)

    // LR superset (CLA-130 family rule: a latch missing from every reset list dies
    // permanently). The SR re-arm is the null-flag batch lane pinned below.
    expect(LONG_REST_RESOURCES).toContain('inspiringLeaderUsedSinceRest')
  })

  it.each([
    ['modal lane (skipAutoRecovery:true)', { skipAutoRecovery: true }],
    ['plain lane', undefined],
  ])('re-arm is ungated: %s nulls the latch in the ONE atomic batch without retracting the granted temp HP', async (_desc, options) => {
    await applyShortRest(makeBard(), CAMPAIGN, options)

    // One atomic write carrying both the HP update and the latch null —
    // re-posting via a second batch would SSE-echo against itself.
    expect(setRuntimeBatch).toHaveBeenCalledTimes(1)
    expect(setRuntimeBatch).toHaveBeenCalledWith(
      BARD,
      expect.objectContaining({ currentHitPoints: 158, inspiringLeaderUsedSinceRest: null }),
      CAMPAIGN,
    )
    // Branch bait: the rest rolls the latch back, NEVER the benefit it granted —
    // confirmBolsteringPerformance's self-grant lives on tempHp (replace-if-larger),
    // and adding it to the null-flag lane would silently wipe inspired temp HP at
    // every short rest. (This College of Valour bard gets no Celestial tempHp either.)
    expect(vi.mocked(setRuntimeBatch).mock.calls[0][1]).not.toHaveProperty('tempHp')
  })
})
