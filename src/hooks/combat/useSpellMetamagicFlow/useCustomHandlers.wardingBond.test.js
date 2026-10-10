// SP-125: Warding Bond confirm lane — pay-at-confirm (SP-013 barkskin template)
// and thread the CHOSEN target name onto the handler metaCtx (the production
// producer for metaCtx.wardingBondTargetName, previously set only in tests).
// Pins: zero spend on skip, exactly one lv2 slot burned on confirm, refusal-free
// dispatch, and the linked buff byte-shape (target acBonus/saveBonus/resistance×12,
// caster bondTarget, no concentration).
import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useCustomHandlers } from './useCustomHandlers.js'
import { executeHandler } from '../../../services/automation/index.js'
import { setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js'
import { addConcentration } from '../../../services/combat/concentration/concentrationService.js'
import { addEntry } from '../../../services/ui/logService.js'
import { handle as realWardingBondHandle } from '../../../services/automation/handlers/spells/wardingBondHandler.js'

const CAMPAIGN = 'test-campaign'
const CASTER = 'War_Cleric'
const TARGET = 'AasimarTest'

const store = {}
const keyOf = (name, key) => `${name}.${key}`

vi.mock('../../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}))

vi.mock('../../../services/automation/index.js', () => ({
  applyBarkskinEffect: vi.fn(() => Promise.resolve(null)),
  applyPassWithoutTraceEffect: vi.fn(() => Promise.resolve(null)),
  applyProtectionFromPoisonHandler: vi.fn(() => Promise.resolve(null)),
  applyStoneSkinHandler: vi.fn(() => Promise.resolve(null)),
  executeHandler: vi.fn(),
}))

vi.mock('../../../services/rules/spells/materialComponents.js', () => ({
  consumeMaterial: vi.fn(() => Promise.resolve(true)),
}))

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn((name, key) => store[keyOf(name, key)]),
  setRuntimeValue: vi.fn((name, key, value) => { store[keyOf(name, key)] = value }),
}))

const sharedCombatSummary = { creatures: [{ name: CASTER, concentration: null }, { name: TARGET, concentration: null }] }

vi.mock('../../../services/encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(() => sharedCombatSummary),
  getCurrentCombatRound: vi.fn(() => 1),
}))

vi.mock('../../../services/rules/combat/damageUtils.js', () => ({
  getTargetFromAttacker: vi.fn(() => null),
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

vi.mock('../../../services/rules/features/primalCompanionSpellShareService.js', () => ({
  triggerPrimalCompanionSpellShare: vi.fn(),
}))

// 2024 Warding Bond byte-shape: Action, NOT concentration, 1 hour, lv2.
const wardingBondSpell = {
  name: 'Warding Bond',
  level: 2,
  concentration: false,
  casting_time: 'Action',
  range: 'Touch',
  duration: '1 hour',
  automation: { type: 'warding_bond', duration: '1 hour', target: 'willing_creature', casting_time: '1 action' },
}

function makePending() {
  return {
    spell: wardingBondSpell,
    spellName: 'Warding Bond',
    spellLevel: 2,
    castingTime: 'Action',
    range: 'Touch',
    creatureTargets: [TARGET, 'ElderPaladin'],
  }
}

function renderWardingBond() {
  const playerStats = { name: CASTER, class: { name: 'Cleric' }, level: 8, spellAbilities: { spell_slots_level_2: 3 } }
  const cfClearPending = vi.fn()
  const setPopupHtml = vi.fn()
  const characters = [{ name: CASTER }, { name: TARGET }]
  const { result } = renderHook(() =>
    useCustomHandlers({ playerStats, campaignName: CAMPAIGN, cfClearPending, getPending: () => makePending(), setPopupHtml, characters })
  )
  return { result, setPopupHtml, cfClearPending }
}

describe('SP-125 handleWardingBondConfirm — pay-at-confirm + metaCtx threading', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    for (const k of Object.keys(store)) delete store[k]
    store[keyOf(CASTER, 'spell_slots_level_2')] = 3
    sharedCombatSummary.creatures.forEach(c => { c.concentration = null })
    executeHandler.mockImplementation((action, ps, cn) => realWardingBondHandle(action, ps, cn))
  })

  it('confirms with the chosen target threaded onto metaCtx.wardingBondTargetName (production producer)', async () => {
    const { result } = renderWardingBond()

    await act(async () => {
      await result.current.handleWardingBondConfirm(TARGET)
    })

    expect(executeHandler).toHaveBeenCalledTimes(1)
    const action = executeHandler.mock.calls[0][0]
    expect(action.metaCtx.wardingBondTargetName).toBe(TARGET)
    expect(action.automation.type).toBe('warding_bond')
    expect(action.name).toBe('Warding Bond')
  })

  it('burns exactly ONE lv2 spell slot on confirm (3→2)', async () => {
    const { result } = renderWardingBond()

    await act(async () => {
      await result.current.handleWardingBondConfirm(TARGET)
    })

    expect(setRuntimeValue).toHaveBeenCalledWith(CASTER, 'spell_slots_level_2', 2, CAMPAIGN)
    expect(store[keyOf(CASTER, 'spell_slots_level_2')]).toBe(2)
  })

  it('linked buff byte-shape: target +1 AC/+1 saves/resistance×12, caster bondTarget', async () => {
    const { result } = renderWardingBond()

    await act(async () => {
      await result.current.handleWardingBondConfirm(TARGET)
    })

    const targetBuffs = store[keyOf(TARGET, 'activeBuffs')]
    const targetBuff = targetBuffs.find(b => b.effect === 'warding_bond')
    expect(targetBuff.acBonus).toBe(1)
    expect(targetBuff.saveBonus).toBe(1)
    expect(targetBuff.resistanceTypes).toHaveLength(12)
    expect(targetBuff.sourceCharacter).toBe(CASTER)

    const casterBuffs = store[keyOf(CASTER, 'activeBuffs')]
    const casterBuff = casterBuffs.find(b => b.effect === 'warding_bond')
    expect(casterBuff.bondTarget).toBe(TARGET)
    expect(casterBuff.acBonus).toBeUndefined()
  })

  it('2024 concentration:false — no concentration ever registered (conc stays null)', async () => {
    const { result } = renderWardingBond()

    await act(async () => {
      await result.current.handleWardingBondConfirm(TARGET)
    })

    expect(addConcentration).not.toHaveBeenCalled()
    expect(sharedCombatSummary.creatures.find(c => c.name === CASTER).concentration).toBeNull()
  })

  it('logs the spell cast once stamped with the chosen target', async () => {
    const { result } = renderWardingBond()

    await act(async () => {
      await result.current.handleWardingBondConfirm(TARGET)
    })

    const spellLogs = addEntry.mock.calls.map(c => c[1]).filter(e => e?.type === 'spell')
    expect(spellLogs).toHaveLength(1)
    expect(spellLogs[0].targetName).toBe(TARGET)
    expect(spellLogs[0].spellName).toBe('Warding Bond')
  })

  it('skip spends NOTHING: no slot payment, no handler dispatch, pending cleared', async () => {
    const { result, cfClearPending } = renderWardingBond()

    await act(async () => {
      await result.current.handleWardingBondSkip()
    })

    expect(store[keyOf(CASTER, 'spell_slots_level_2')]).toBe(3)
    expect(executeHandler).not.toHaveBeenCalled()
    expect(addEntry).not.toHaveBeenCalled()
    expect(cfClearPending).toHaveBeenCalledWith('wardingBond')
  })

  it('popup payload from the handler reaches setPopupHtml', async () => {
    executeHandler.mockResolvedValue({ payload: 'warding-bond-popup' })
    const { result, setPopupHtml } = renderWardingBond()

    await act(async () => {
      await result.current.handleWardingBondConfirm(TARGET)
    })

    expect(setPopupHtml).toHaveBeenCalledWith('warding-bond-popup')
  })
})
