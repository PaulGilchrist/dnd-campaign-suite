// CLA-107: hex tes stamp duration:'hex_duration' so the generic
// duration==='concentration' sweep misses them — cleanupConcentrationEffects
// must purge hex_ability_check_disadvantage + hex_save_disadvantage by caster
// on every concentration-break lane (CLA-005/SP-035 purge precedent).
import { describe, it, expect, vi, beforeEach } from 'vitest'

const campaignStore = new Map()

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn((storeKey, key) => {
    if (storeKey === 'campaign' && key === 'targetEffects') return campaignStore.get('targetEffects') || []
    return null
  }),
  setRuntimeValue: vi.fn((storeKey, key, value) => {
    if (storeKey === 'campaign' && key === 'targetEffects') campaignStore.set('targetEffects', value)
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

const HEX_TE_1 = { target: 'Bandit 1', effect: 'hex_ability_check_disadvantage', source: 'HexWarlock', ability: 'DEX', duration: 'hex_duration' }
const HEX_TE_2 = { target: 'Bandit 1', effect: 'hex_save_disadvantage', source: 'HexWarlock', ability: 'DEX', duration: 'hex_duration' }
const FOREIGN_HEX = { target: 'Bandit 1', effect: 'hex_save_disadvantage', source: 'OtherWarlock', ability: 'STR', duration: 'hex_duration' }
const UNRELATED = { target: 'Bandit 1', effect: 'faerie_fire', source: 'ElderPaladin', duration: 'concentration' }

function setTargetEffects(list) {
  campaignStore.set('targetEffects', [...list])
}

describe('CLA-107 cleanupConcentrationEffects — hex te purge', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    campaignStore.clear()
  })

  it('purges both caster-owned hex tes, keeps foreign + unrelated tes', async () => {
    setTargetEffects([HEX_TE_1, HEX_TE_2, FOREIGN_HEX, UNRELATED])

    await cleanupConcentrationEffects('HexWarlock', 'Hex', 'test-campaign')

    const remaining = campaignStore.get('targetEffects')
    expect(remaining).toEqual([FOREIGN_HEX, UNRELATED])
    expect(remaining.some(te => te.source === 'HexWarlock' && /hex_/.test(te.effect))).toBe(false)
  })

  it('logs the purge once with targets', async () => {
    setTargetEffects([HEX_TE_1, HEX_TE_2])

    await cleanupConcentrationEffects('HexWarlock', 'Hex', 'test-campaign')

    const purgeLog = vi.mocked(addEntry).mock.calls
      .map(c => c[1])
      .find(e => e && e.automationType === 'hex_effects_cleared')
    expect(purgeLog).toBeDefined()
    expect(purgeLog.characterName).toBe('HexWarlock')
    expect(purgeLog.description).toContain('Bandit 1')
  })

  it('zero hex tes = zero write, zero purge log (byte-inert for other break lanes)', async () => {
    setTargetEffects([UNRELATED])

    await cleanupConcentrationEffects('HexWarlock', 'Hold Person', 'test-campaign')

    expect(campaignStore.get('targetEffects')).toEqual([UNRELATED])
    const purgeLog = vi.mocked(addEntry).mock.calls
      .map(c => c[1])
      .find(e => e && e.automationType === 'hex_effects_cleared')
    expect(purgeLog).toBeUndefined()
  })

  it('purges even when the broken concentration spell is not Hex (same caster owns the hex)', async () => {
    setTargetEffects([HEX_TE_1, HEX_TE_2])

    await cleanupConcentrationEffects('HexWarlock', 'Charm Person', 'test-campaign')

    expect(campaignStore.get('targetEffects')).toEqual([])
  })
})
