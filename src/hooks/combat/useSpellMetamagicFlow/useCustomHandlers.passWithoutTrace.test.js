import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useCustomHandlers } from './useCustomHandlers.js'
import { applyPassWithoutTraceEffect as mockedApply } from '../../../services/automation/index.js'
import { applyPassWithoutTraceEffect } from '../../../services/rules/features/passWithoutTraceService.js'
import { setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js'
import { addConcentration } from '../../../services/combat/concentration/concentrationService.js'
import { getCombatSummary } from '../../../services/encounters/combatData.js'
import * as storageService from '../../../services/ui/storage.js'

const CAMPAIGN = 'test-campaign'
const CASTER = 'FeyRanger'

const store = {}

vi.mock('../../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}))

vi.mock('../../../services/automation/index.js', () => ({
  applyPassWithoutTraceEffect: vi.fn(() => Promise.resolve(null)),
  applyBarkskinEffect: vi.fn(() => Promise.resolve(null)),
  applyProtectionFromPoisonHandler: vi.fn(() => Promise.resolve(null)),
  applyStoneSkinHandler: vi.fn(() => Promise.resolve(null)),
}))

vi.mock('../../../services/rules/spells/materialComponents.js', () => ({
  consumeMaterial: vi.fn(() => Promise.resolve(true)),
}))

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn((name, key) => store[key]),
  setRuntimeValue: vi.fn((name, key, value) => { store[key] = value }),
}))

const sharedCombatSummary = { creatures: [{ name: 'FeyRanger', concentration: null }] }

vi.mock('../../../services/encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(() => sharedCombatSummary),
}))

vi.mock('../../../services/combat/concentration/concentrationService.js', () => ({
  addConcentration: vi.fn((cs, name, spell, dc, target) => {
    const creature = cs?.creatures?.find(c => c.name === name)
    if (creature) creature.concentration = { spell, dc, target: target || null }
  }),
  breakConcentration: vi.fn(),
  cleanupConcentrationEffects: vi.fn(),
}))

vi.mock('../../../services/ui/storage.js', () => ({
  default: { set: vi.fn() },
}))

vi.mock('../../../services/rules/spells/metamagicRules.js', () => ({
  isPsionicSpell: vi.fn(() => false),
  hasPsionicSorcery: vi.fn(() => false),
}))

const pwtSpell = {
  name: 'Pass Without Trace',
  level: 2,
  concentration: true,
  casting_time: 'Action',
  range: 'Self',
  automation: { type: 'pass_without_trace', auraRange: 30 },
}

function makePending() {
  return {
    spell: pwtSpell,
    spellName: 'Pass Without Trace',
    spellLevel: 2,
    castingTime: 'Action',
    range: 'Self',
    creatureTargets: ['FeyRanger', 'HeroesFeastBard'],
  }
}

function renderPWT() {
  const playerStats = { name: CASTER, class: { name: 'Ranger' }, level: 15, spellAbilities: { spell_slots_level_2: 3 } }
  const cfClearPending = vi.fn()
  const setPopupHtml = vi.fn()
  const { result } = renderHook(() =>
    useCustomHandlers({ playerStats: playerStats, campaignName: CAMPAIGN, cfClearPending: cfClearPending, getPending: () => makePending(), setPopupHtml: setPopupHtml, characters: [] })
  )
  return { result, playerStats, setPopupHtml }
}

describe('SP-085 handlePassWithoutTraceConfirm — prepareSpellCast integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    for (const k of Object.keys(store)) delete store[k]
    store.spell_slots_level_2 = 3
    sharedCombatSummary.creatures[0].concentration = null
  })

  it('consumes exactly ONE lv2 spell slot', async () => {
    const { result } = renderPWT()

    await act(async () => {
      await result.current.handlePassWithoutTraceConfirm(['FeyRanger', 'HeroesFeastBard'])
    })

    expect(setRuntimeValue).toHaveBeenCalledWith(CASTER, 'spell_slots_level_2', 2, CAMPAIGN)
    expect(store.spell_slots_level_2).toBe(2)
  })

  it('registers caster concentration in combatSummary', async () => {
    const { result } = renderPWT()

    await act(async () => {
      await result.current.handlePassWithoutTraceConfirm(['FeyRanger', 'HeroesFeastBard'])
    })

    expect(addConcentration).toHaveBeenCalledWith(expect.anything(), CASTER, 'Pass Without Trace', 10, null)
    expect(storageService.default.set).toHaveBeenCalledWith('combatSummary', expect.anything(), CAMPAIGN)
    expect(getCombatSummary(CAMPAIGN).creatures.find(c => c.name === CASTER).concentration.spell).toBe('Pass Without Trace')
  })

  it('passes the real spell object (level 2) to applyPassWithoutTraceEffect, not a wrapper', async () => {
    const { result } = renderPWT()

    await act(async () => {
      await result.current.handlePassWithoutTraceConfirm(['FeyRanger', 'HeroesFeastBard'])
    })

    expect(mockedApply).toHaveBeenCalledTimes(1)
    expect(mockedApply.mock.calls[0][0].level).toBe(2)
  })

  it('records te slotLevel 2 (not 1) and preserves the +10 targetEffect', async () => {
    await applyPassWithoutTraceEffect(pwtSpell, { name: CASTER }, CAMPAIGN, null, ['FeyRanger', 'HeroesFeastBard'])

    const written = setRuntimeValue.mock.calls.find(c => c[1] === 'targetEffects')[2]
    expect(written).toHaveLength(2)
    expect(written.every(te => te.effect === 'pass_without_trace_bonus' && te.slotLevel === 2 && te.bonusExpression === '+10')).toBe(true)
    expect(written.every(te => te.duration === 'concentration')).toBe(true)
  })
})
