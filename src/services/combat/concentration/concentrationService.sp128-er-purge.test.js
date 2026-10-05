// SP-128: Expeditious Retreat concentration-break purge. The
// SPELL_RUNTIME_CLEANERS['Expeditious Retreat'] branch must clear the Dash
// grant state (flag + per-turn latch + turn-start re-offer entry + residual
// Dash speed_boost buff) on EVERY break lane, and be byte-inert for creatures
// that never held the grant (no stray writes across the roster loop).
import { describe, it, expect, vi, beforeEach } from 'vitest'

const h = vi.hoisted(() => {
  const store = new Map()
  return {
    store,
    storeKey: (name, key) => `${name}|${key}`,
    csRef: { creatures: [] },
  }
})

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn((name, key) => h.store.get(h.storeKey(name, key)) ?? null),
  setRuntimeValue: vi.fn((name, key, value) => { h.store.set(h.storeKey(name, key), value) }),
  getAllStoreKeys: vi.fn(() => []),
}))

vi.mock('./concentrationRules.js', () => ({
  rollConcentrationSave: vi.fn(() => ({ roll: 10, success: true })),
  breakConcentration: vi.fn(() => null),
  computeConcentrationDc: vi.fn(),
}))

vi.mock('../auras/auraOfProtection.js', () => ({ computeAuraBonus: vi.fn() }))
vi.mock('../conditions/conditionSaveService.js', () => ({ getCreatureSaveBonus: vi.fn() }))
vi.mock('../starryFormConstellation.js', () => ({ hasStarryDragonConstellation: vi.fn(() => false) }))
vi.mock('../../../services/ui/storage.js', () => ({ default: { set: vi.fn() } }))
vi.mock('../../encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(() => h.csRef),
}))
vi.mock('../../rules/effects/expirations.js', () => ({ clearExpirationEffects: vi.fn() }))
vi.mock('../../ui/utils.js', () => ({ default: { getName: vi.fn((v) => String(v)) } }))
vi.mock('../../encounters/combatLoggingService.js', () => ({ logConditionEvent: vi.fn() }))
vi.mock('../../ui/logService.js', () => ({ addEntry: vi.fn(() => Promise.resolve()) }))
vi.mock('../conditions/savePromptService.js', () => ({ clearFleshToStonePrompt: vi.fn() }))
vi.mock('../../rules/features/heroismService.js', () => ({ removeHeroismBuff: vi.fn() }))
vi.mock('../summons/summonedCreatureService.js', () => ({ removeSummonedCreatures: vi.fn() }))
vi.mock('../../automation/handlers/spells/truePolymorphService.js', () => ({ revertTruePolymorph: vi.fn() }))

import { cleanupConcentrationEffects } from './concentrationService.js'
import { setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js'

const CASTER = 'AberrantSorcerer'
const OTHER = 'Bandit 1'
const CAMPAIGN = 'test-campaign'

function seedGrant() {
  h.store.set(h.storeKey(CASTER, 'expeditiousRetreatActive'), true)
  h.store.set(h.storeKey(CASTER, '_Expeditious_Retreat_dash_usedRound'), 3)
  h.store.set(h.storeKey(CASTER, 'turnStartEffects'), [
    { type: 'expeditious_retreat_dash_offer' },
    { type: 'something_else' },
  ])
  h.store.set(h.storeKey(CASTER, 'activeBuffs'), [
    { name: 'Dash (Expeditious Retreat)', effect: 'speed_boost', speedBonus: 30 },
    { name: 'Haste', effect: 'speed_boost', speedBonus: 15 },
  ])
}

function callsFor(key) {
  return vi.mocked(setRuntimeValue).mock.calls.filter(c => c[1] === key)
}

describe('SP-128 Expeditious Retreat concentration-break purge', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    h.store.clear()
    h.csRef.creatures = [{ name: CASTER }, { name: OTHER }]
  })

  it('clears the grant flag, latch, re-offer entry and residual Dash buff', async () => {
    seedGrant()

    await cleanupConcentrationEffects(CASTER, 'Expeditious Retreat', CAMPAIGN)

    expect(h.store.get(h.storeKey(CASTER, 'expeditiousRetreatActive'))).toBeNull()
    expect(h.store.get(h.storeKey(CASTER, '_Expeditious_Retreat_dash_usedRound'))).toBeNull()
    expect(h.store.get(h.storeKey(CASTER, 'turnStartEffects')))
      .toEqual([{ type: 'something_else' }])
    expect(h.store.get(h.storeKey(CASTER, 'activeBuffs')))
      .toEqual([{ name: 'Haste', effect: 'speed_boost', speedBonus: 15 }])
  })

  it('leaves non-holder roster creatures untouched (no stray grants cleared)', async () => {
    seedGrant()
    // OTHER never held the grant — it must not get cleared writes.
    h.store.set(h.storeKey(OTHER, 'expeditiousRetreatActive'), undefined)

    await cleanupConcentrationEffects(CASTER, 'Expeditious Retreat', CAMPAIGN)

    expect(callsFor('expeditiousRetreatActive').some(c => c[0] === OTHER)).toBe(false)
    expect(callsFor('_Expeditious_Retreat_dash_usedRound').some(c => c[0] === OTHER)).toBe(false)
  })

  it('is byte-inert when the spell never granted (no matching keys set)', async () => {
    await cleanupConcentrationEffects(CASTER, 'Expeditious Retreat', CAMPAIGN)

    expect(callsFor('expeditiousRetreatActive')).toHaveLength(0)
    expect(callsFor('_Expeditious_Retreat_dash_usedRound')).toHaveLength(0)
    expect(callsFor('turnStartEffects')).toHaveLength(0)
    expect(callsFor('activeBuffs')).toHaveLength(0)
  })
})
