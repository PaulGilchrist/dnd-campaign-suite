// @maintained-by-ai
// CLA-308 regression: Shadow Arts long-rest re-arm (re-arm policy lane — cited owner:
// automationShadowArts.route.test.js and spellCalc2024-shadow-arts.test.js both delegate
// "re-arm" here; consumption lives in spellPreparationService.shadowArts.test.js).
// For every freeCastSpells entry on a `shadow_arts` passive, the per-spell counter
// `_Shadow_Arts_<Spell>_freeCastCount` re-arms to null (= fresh/available) at long rest
// (restRules-longRest.js resetPerSpellFreeCastCounters :575-577; mirrors the verified
// CLA-252 Phantasmal reset shape). NOT subsumed by the cla130 LONG_REST_RESOURCES
// disk union: that scans feature-named keys only — these per-spell keys are dynamic and
// emitted solely by the shadow_arts-gated branch. Characters without the shadow_arts
// passive never write these keys, even when sibling free-cast features are present.
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
const CHAR = 'Disciplined_Monk'

// Mirrors disk 2024/classes.json Warrior of Shadow automation freeCastSpells
// (envelope forwarding pinned in core-handlers.test.js — here, "Pass Without Trace"
// additionally pins the space→underscore key transform).
const SHADOW_ARTS_SPELLS = ['Darkness', 'Darkvision', 'Pass Without Trace', 'Silence']

function shadowWrites() {
  return setRuntimeValue.mock.calls
    .filter(call => String(call[1]).includes('_Shadow_Arts_'))
    .map(call => [call[0], call[1], call[2], call[3], call[4]])
    .sort((a, b) => a[1].localeCompare(b[1]))
}

function makeStats(overrides = {}) {
  return {
    name: CHAR,
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
  it('re-arms exactly one null per-spell counter for every freeCastSpells entry, skipSync=true', async () => {
    await applyLongRest(makeShadowArtsStats(), CAMPAIGN)
    const expected = SHADOW_ARTS_SPELLS
      .map(spell => [CHAR, `_Shadow_Arts_${spell.replace(/\s+/g, '_')}_freeCastCount`, null, CAMPAIGN, true])
      .sort((a, b) => a[1].localeCompare(b[1]))
    // Full-set equality: pins key spelling, null (not 0), campaign + skipSync contract
    // args, one write per spell, and no surplus shadow writes.
    expect(shadowWrites()).toEqual(expected)
  })

  it('writes no Shadow Arts keys for non-holders, even with sibling per-spell free-cast features present', async () => {
    // Bait fixture: CLA-252 phantasmal passive + perSpellTracking free_spell action
    // exercise the ADJACENT branches of resetPerSpellFreeCastCounters (their positive
    // bytes are pinned in restRules-longRest.test.js) — proving the Shadow Arts re-arm
    // is gated on passive type === 'shadow_arts' specifically, not on free casts existing.
    const stats = makeStats({
      automation: {
        passives: [{
          type: 'phantasmal_creatures',
          name: 'Phantasmal Creatures',
          freeCastSpells: ['Minor Illusion'],
        }],
        specialActions: [{
          name: 'Shadow Magic',
          type: 'free_spell',
          perSpellTracking: true,
          spell: ['Invisibility'],
        }],
      },
    })
    await applyLongRest(stats, CAMPAIGN)
    expect(shadowWrites()).toHaveLength(0)
  })
})
