// CLA-308 regression: Shadow Arts long-rest re-arm. Each per-spell counter
// `_Shadow_Arts_<Spell>_freeCastCount` resets to null (= fresh/available) for every
// freeCastSpells entry when the Warrior of Shadow finishes a Long Rest (mirrors the
// verified CLA-252 Phantasmal Creatures reset shape). Characters without the
// shadow_arts passive never touch these keys.
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
  // automation/index.js imports handle + confirm/skip statically — mock full surface
  handle: vi.fn(() => null),
  confirmCelestialResilience: vi.fn(() => null),
  skipCelestialResilience: vi.fn(() => null),
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

const SHADOW_ARTS_SPELLS = ['Darkness', 'Darkvision', 'Pass Without Trace', 'Silence']

function makeStats(overrides = {}) {
  return {
    name: 'Disciplined_Monk',
    hitPoints: 100,
    level: 17,
    proficiency: 6,
    abilities: [{ name: 'Wisdom', bonus: 4 }],
    automation: { passives: [] },
    ...overrides,
  }
}

function makeShadowArtsStats() {
  return makeStats({
    automation: {
      passives: [{
        type: 'shadow_arts',
        name: 'Shadow Arts',
        effect: 'shadow_arts',
        freeCastSpells: SHADOW_ARTS_SPELLS,
        usesMax: 1,
        recharge: 'long_rest',
        saveAbility: 'WIS',
      }],
    },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('applyLongRest — CLA-308 Shadow Arts re-arm', () => {
  it('resets every per-spell Shadow Arts counter to null on long rest', async () => {
    await applyLongRest(makeShadowArtsStats(), CAMPAIGN)
    for (const spellName of SHADOW_ARTS_SPELLS) {
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Disciplined_Monk', `_Shadow_Arts_${spellName.replace(/\s+/g, '_')}_freeCastCount`, null, CAMPAIGN, true,
      )
    }
  })

  it('does not touch Shadow Arts keys without the shadow_arts passive', async () => {
    await applyLongRest(makeStats(), CAMPAIGN)
    const shadowWrites = setRuntimeValue.mock.calls.filter(call => String(call[1]).includes('_Shadow_Arts_'))
    expect(shadowWrites).toHaveLength(0)
  })
})
