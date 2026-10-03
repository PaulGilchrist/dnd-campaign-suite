// SP-013: Barkskin cast resolved to ZERO effect — handleBarkskinConfirm called
// applyBarkskinEffect with POSITIONAL args while the function destructures a
// SINGLE object (targetNames always undefined → early return null). These tests
// pin the object-call contract, the lv2 slot payment (SP-085 confirm-lane family),
// and the 2024 no-concentration semantics.
import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useCustomHandlers } from './useCustomHandlers.js'
import { applyBarkskinEffect as mockedApply } from '../../../services/automation/index.js'
import { setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js'
import { addConcentration } from '../../../services/combat/concentration/concentrationService.js'
import { getCombatSummary } from '../../../services/encounters/combatData.js'

const CAMPAIGN = 'test-campaign'
const CASTER = 'Wild_Sage_Druid'

const store = {}

vi.mock('../../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}))

vi.mock('../../../services/automation/index.js', () => ({
  applyBarkskinEffect: vi.fn(() => Promise.resolve({ payload: 'barkskin-popup' })),
  applyPassWithoutTraceEffect: vi.fn(() => Promise.resolve(null)),
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

const sharedCombatSummary = { creatures: [{ name: CASTER, concentration: null }] }

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

// 2024 barkskin byte-shape: Bonus Action, NOT concentration, 1 hour.
const barkskinSpell = {
  name: 'Barkskin',
  level: 2,
  concentration: false,
  casting_time: 'Bonus Action',
  range: 'Touch',
  duration: '1 hour',
}

function makePending() {
  return {
    spell: barkskinSpell,
    spellName: 'Barkskin',
    spellLevel: 2,
    castingTime: 'Bonus Action',
    range: 'Touch',
    creatureTargets: [CASTER, 'Goblin 1'],
  }
}

function renderBarkskin() {
  const playerStats = { name: CASTER, class: { name: 'Druid' }, level: 20, spellAbilities: { spell_slots_level_2: 3 } }
  const cfClearPending = vi.fn()
  const setPopupHtml = vi.fn()
  const characters = [{ name: CASTER, computedStats: { armorClass: 9 } }]
  const { result } = renderHook(() =>
    useCustomHandlers({ playerStats, campaignName: CAMPAIGN, cfClearPending, getPending: () => makePending(), setPopupHtml, characters })
  )
  return { result, setPopupHtml }
}

describe('SP-013 handleBarkskinConfirm — object-call contract + slot payment', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    for (const k of Object.keys(store)) delete store[k]
    store.spell_slots_level_2 = 3
    sharedCombatSummary.creatures[0].concentration = null
    mockedApply.mockResolvedValue({ payload: 'barkskin-popup' })
  })

  it('calls applyBarkskinEffect with a SINGLE object carrying targetNames (positional call would fail this pin)', async () => {
    const { result } = renderBarkskin()

    await act(async () => {
      await result.current.handleBarkskinConfirm([CASTER])
    })

    expect(mockedApply).toHaveBeenCalledTimes(1)
    const callArg = mockedApply.mock.calls[0][0]
    expect(mockedApply.mock.calls[0].length).toBe(1)
    expect(callArg.targetNames).toEqual([CASTER])
    expect(callArg.campaignName).toBe(CAMPAIGN)
    expect(callArg.playerStats.name).toBe(CASTER)
    expect(callArg.characters).toEqual([{ name: CASTER, computedStats: { armorClass: 9 } }])
    expect(callArg.action.name).toBe('Barkskin')
    expect(callArg.action.spell).toBe(barkskinSpell)
    expect(callArg.action.automation.type).toBe('barkskin')
  })

  it('consumes exactly ONE lv2 spell slot on confirm', async () => {
    const { result } = renderBarkskin()

    await act(async () => {
      await result.current.handleBarkskinConfirm([CASTER])
    })

    expect(setRuntimeValue).toHaveBeenCalledWith(CASTER, 'spell_slots_level_2', 2, CAMPAIGN)
    expect(store.spell_slots_level_2).toBe(2)
  })

  it('does NOT register concentration for the 2024 non-concentration spell', async () => {
    const { result } = renderBarkskin()

    await act(async () => {
      await result.current.handleBarkskinConfirm([CASTER])
    })

    expect(addConcentration).not.toHaveBeenCalled()
    expect(getCombatSummary(CAMPAIGN).creatures.find(c => c.name === CASTER).concentration).toBeNull()
  })

  it('sets the popup html from the apply result', async () => {
    const { result, setPopupHtml } = renderBarkskin()

    await act(async () => {
      await result.current.handleBarkskinConfirm([CASTER])
    })

    expect(setPopupHtml).toHaveBeenCalledWith('barkskin-popup')
  })
})
