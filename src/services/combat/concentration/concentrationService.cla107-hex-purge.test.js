// @maintained-by-ai
// CLA-107 lane: hex te purge only (concentrationService.js clearHexEffects).
// Hex tes stamp duration:'hex_duration' so the generic duration==='concentration'
// sweep misses them — the purge must remove hex_ability_check_disadvantage +
// hex_save_disadvantage by CASTER on every concentration-break lane
// (CLA-005/SP-035 purge precedent), logging once with deduped targets.
// Twin-split: the Expeditious Retreat purge lives in concentrationService.sp128-er-purge.test.js
// (#949); generic break/roll/popup + the removeTargetEffectsByEffect factory
// key-lanes live in concentrationService.test.js (#990); REST/consumer cleanup
// and its pinned filter defects live in cleanupConcentrationEffects.test.js (#990).
// This file owns only the hex-triggered purge: armed exact-write/exact-log leg
// + unarmed zero-write control (#932 canon).
// #990 filter audit of THIS purge: clearHexEffects filters effect-key +
// te.source (concentrationService.js:97-98) — not name-only; honest, pinned
// by the FOREIGN_HEX falsifier below. No source bug to report on this lane.
// Old->new: 4 tests -> 2. Former "purges both caster-owned, keeps foreign"
// + "logs the purge once" + "purges when spell is not Hex" fold into the
// armed leg (exact single campaign write, exact log bytes, spell-name
// irrellevance via 'Charm Person'); former "zero hex tes" control absorbs
// falsifier tes (foreign hex, caster non-hex) so guard/source/effect-clause
// removal all fail the control (#921/#948).
import { describe, it, expect, vi, beforeEach } from 'vitest'

const campaignStore = new Map()
const campaignWrites = []

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn((storeKey, key) => {
    if (storeKey === 'campaign' && key === 'targetEffects') return campaignStore.get('targetEffects') || []
    return null
  }),
  setRuntimeValue: vi.fn((storeKey, key, value, campaignName) => {
    if (storeKey === 'campaign' && key === 'targetEffects') {
      campaignStore.set('targetEffects', value)
      campaignWrites.push([storeKey, key, value, campaignName])
    }
  }),
  getAllStoreKeys: vi.fn(() => []),
}))

vi.mock('./concentrationRules.js', () => ({
  rollConcentrationSave: vi.fn(() => ({ roll: 10, success: true })),
  breakConcentration: vi.fn(() => null),
  computeConcentrationDc: vi.fn(),
}))

vi.mock('../auras/auraOfProtection.js', () => ({
  computeAuraBonus: vi.fn(),
}))

vi.mock('../conditions/conditionSaveService.js', () => ({
  getCreatureSaveBonus: vi.fn(),
}))

vi.mock('../starryFormConstellation.js', () => ({
  hasStarryDragonConstellation: vi.fn(() => false),
}))

vi.mock('../../ui/storage.js', () => ({
  default: { set: vi.fn() },
}))

vi.mock('../../encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(() => ({ creatures: [] })),
}))

vi.mock('../../rules/effects/expirations.js', () => ({
  clearExpirationEffects: vi.fn(),
}))

vi.mock('../../encounters/combatLoggingService.js', () => ({
  logConditionEvent: vi.fn(),
}))

vi.mock('../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}))

vi.mock('../conditions/savePromptService.js', () => ({
  clearFleshToStonePrompt: vi.fn(),
}))

vi.mock('../../rules/features/heroismService.js', () => ({
  removeHeroismBuff: vi.fn(),
}))

vi.mock('../summons/summonedCreatureService.js', () => ({
  removeSummonedCreatures: vi.fn(),
}))

vi.mock('../../automation/handlers/spells/truePolymorphService.js', () => ({
  revertTruePolymorph: vi.fn(),
}))

import { cleanupConcentrationEffects } from './concentrationService.js'
import { addEntry } from '../../ui/logService.js'

const CAMPAIGN = 'test-campaign'
const CASTER = 'HexWarlock'

// Caster-owned hex tes (the purge targets), spanning both keys and two targets.
const HEX_ABILITY = { target: 'Bandit 1', effect: 'hex_ability_check_disadvantage', source: CASTER, ability: 'DEX', duration: 'hex_duration' }
const HEX_SAVE = { target: 'Bandit 1', effect: 'hex_save_disadvantage', source: CASTER, ability: 'DEX', duration: 'hex_duration' }
const HEX_SAVE_2 = { target: 'Goblin 4', effect: 'hex_save_disadvantage', source: CASTER, ability: 'DEX', duration: 'hex_duration' }
// Falsifiers — must all survive the purge:
const FOREIGN_HEX = { target: 'Bandit 1', effect: 'hex_save_disadvantage', source: 'OtherWarlock', ability: 'STR', duration: 'hex_duration' } // same effect+target, other caster
const CASTER_NON_HEX = { target: 'Bandit 1', effect: 'bless_bonus', source: CASTER, duration: 'minute' } // same caster, other effect and duration
const UNRELATED = { target: 'Bandit 1', effect: 'faerie_fire', source: 'ElderPaladin', duration: 'concentration' } // other caster, concentration duration

function setTargetEffects(list) {
  campaignStore.set('targetEffects', [...list])
}

function campaignPurgeWrites() {
  return campaignWrites.filter(([storeKey, key]) => storeKey === 'campaign' && key === 'targetEffects')
}

function hexPurgeLogs() {
  return addEntry.mock.calls.filter(([, entry]) => entry && entry.automationType === 'hex_effects_cleared')
}

describe('CLA-107 cleanupConcentrationEffects — hex te purge', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    campaignStore.clear()
    campaignWrites.length = 0
  })

  it('armed: one exact filtered write and one exact log, even when the broken spell is not Hex', async () => {
    setTargetEffects([HEX_ABILITY, HEX_SAVE, HEX_SAVE_2, FOREIGN_HEX, CASTER_NON_HEX, UNRELATED])

    // Charm Person, not Hex: the purge is caster-scoped, not spell-scoped.
    await cleanupConcentrationEffects(CASTER, 'Charm Person', CAMPAIGN)

    // Exactly one campaign targetEffects write, payload byte-exact survivors, campaign pinned (#825/#934).
    const writes = campaignPurgeWrites()
    expect(writes).toHaveLength(1)
    expect(writes[0][2]).toEqual([FOREIGN_HEX, CASTER_NON_HEX, UNRELATED])
    expect(writes[0][3]).toBe(CAMPAIGN)
    expect(campaignStore.get('targetEffects')).toEqual([FOREIGN_HEX, CASTER_NON_HEX, UNRELATED])

    // Purge logged once with deduped target list in seed order; exact bytes (#829).
    const logs = hexPurgeLogs()
    expect(logs).toHaveLength(1)
    expect(logs[0][0]).toBe(CAMPAIGN)
    expect(logs[0][1]).toEqual({
      type: 'automation',
      automationType: 'hex_effects_cleared',
      characterName: CASTER,
      description: 'Hex ends (concentration lost) — check/save disadvantage cleared on Bandit 1, Goblin 4.',
      timestamp: expect.any(Number),
    })
  })

  it('unarmed: foreign hex, caster non-hex and unrelated tes survive with zero writes and zero hex log', async () => {
    setTargetEffects([FOREIGN_HEX, CASTER_NON_HEX, UNRELATED])

    await cleanupConcentrationEffects(CASTER, 'Hex', CAMPAIGN)

    // Dropping the zero-match guard would write + log here and fail this control (#921).
    expect(campaignPurgeWrites()).toHaveLength(0)
    expect(hexPurgeLogs()).toHaveLength(0)
    expect(campaignStore.get('targetEffects')).toEqual([FOREIGN_HEX, CASTER_NON_HEX, UNRELATED])
  })
})
