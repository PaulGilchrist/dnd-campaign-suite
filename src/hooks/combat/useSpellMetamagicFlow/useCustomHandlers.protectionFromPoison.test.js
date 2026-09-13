import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useCustomHandlers } from './useCustomHandlers.js'
import { applyProtectionFromPoisonHandler } from '../../../services/automation/index.js'
import { setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js'
import { addEntry } from '../../../services/ui/logService.js'
import { addConcentration } from '../../../services/combat/concentration/concentrationService.js'
import { getCombatSummary } from '../../../services/encounters/combatData.js'
import { rollbackSpellSlot } from '../useConfirmableFlow.js'

const CAMPAIGN = 'test-campaign'
const CASTER = 'Divine_Cleric'
const TARGET = 'AasimarTest'

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

vi.mock('../useConfirmableFlow.js', () => ({
  rollbackSpellSlot: vi.fn(),
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

// Ground truth from public/data/2024/spells.json: lv2, concentration:false, 1 hour.
const pfpSpell = {
  name: 'Protection from Poison',
  level: 2,
  concentration: false,
  casting_time: 'Action',
  range: 'Touch',
  duration: '1 hour',
  automation: { type: 'protection_from_poison', duration: '1 hour', casting_time: '1 action', range: 'Touch' },
}

function makePending() {
  return {
    spell: pfpSpell,
    spellName: 'Protection from Poison',
    spellLevel: 2,
    castingTime: 'Action',
    range: 'Touch',
    creatureTargets: [TARGET, CASTER],
  }
}

function renderPfp() {
  const playerStats = { name: CASTER, class: { name: 'Cleric' }, level: 17, spellAbilities: { spell_slots_level_2: 3, saveDc: 17 } }
  const cfClearPending = vi.fn()
  const setPopupHtml = vi.fn()
  const { result } = renderHook(() =>
    useCustomHandlers({ playerStats: playerStats, campaignName: CAMPAIGN, cfClearPending: cfClearPending, getPending: () => makePending(), setPopupHtml: setPopupHtml, characters: [] })
  )
  return { result, playerStats, setPopupHtml }
}

describe('SP-095 handleProtectionFromPoisonConfirm — prepareSpellCast slot consumption', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    for (const k of Object.keys(store)) delete store[k]
    store.spell_slots_level_2 = 3
    sharedCombatSummary.creatures[0].concentration = null
  })

  it('consumes exactly ONE lv2 spell slot on confirm', async () => {
    const { result } = renderPfp()

    await act(async () => {
      await result.current.handleProtectionFromPoisonConfirm([TARGET])
    })

    expect(setRuntimeValue).toHaveBeenCalledWith(CASTER, 'spell_slots_level_2', 2, CAMPAIGN)
    expect(store.spell_slots_level_2).toBe(2)
  })

  it('logs a slot-spend ability_use entry when the slot was consumed', async () => {
    const { result } = renderPfp()

    await act(async () => {
      await result.current.handleProtectionFromPoisonConfirm([TARGET])
    })

    const spendLog = addEntry.mock.calls
      .map(c => c[1])
      .find(e => e && e.type === 'ability_use' && /Expended a level 2 spell slot/.test(e.description))
    expect(spendLog).toBeTruthy()
    expect(spendLog.characterName).toBe(CASTER)
  })

  it('does NOT impose caster concentration (spell data concentration:false, RAW 2024)', async () => {
    const { result } = renderPfp()

    await act(async () => {
      await result.current.handleProtectionFromPoisonConfirm([TARGET])
    })

    expect(addConcentration).not.toHaveBeenCalled()
    const caster = getCombatSummary(CAMPAIGN).creatures.find(c => c.name === CASTER)
    expect(caster.concentration).toBeNull()
  })

  it('still applies the protection effect with the confirmed target', async () => {
    const { result } = renderPfp()

    await act(async () => {
      await result.current.handleProtectionFromPoisonConfirm([TARGET])
    })

    expect(applyProtectionFromPoisonHandler).toHaveBeenCalledTimes(1)
    expect(applyProtectionFromPoisonHandler.mock.calls[0][4]).toEqual({ targetName: TARGET })
  })
})

describe('SP-095 handleProtectionFromPoisonSkip — no rollback of an unconsumed slot', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    for (const k of Object.keys(store)) delete store[k]
    store.spell_slots_level_2 = 3
  })

  it('skip never rolls back (inflates) a slot that was never spent', async () => {
    const { result } = renderPfp()

    await act(async () => {
      result.current.handleProtectionFromPoisonSkip()
    })

    expect(rollbackSpellSlot).not.toHaveBeenCalled()
    expect(store.spell_slots_level_2).toBe(3)
  })

  it('confirm then skip sequence nets exactly one slot spent', async () => {
    const { result } = renderPfp()

    await act(async () => {
      await result.current.handleProtectionFromPoisonConfirm([TARGET])
    })
    await act(async () => {
      result.current.handleProtectionFromPoisonSkip()
    })

    expect(store.spell_slots_level_2).toBe(2)
    expect(rollbackSpellSlot).not.toHaveBeenCalled()
  })
})
