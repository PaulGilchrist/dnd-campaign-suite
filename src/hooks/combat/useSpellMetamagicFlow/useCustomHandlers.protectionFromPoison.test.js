// @maintained-by-ai: 2026-10-15
// SP-095: Protection from Poison confirm previously bypassed prepareSpellCast — no
// slot spent. This file is the PFP custom-handler CONFIRM seam: it runs the REAL
// prepareSpellCast (slot payment + spend log) and pins the FIVE-POSITIONAL-arg
// contract of applyProtectionFromPoisonHandler (spell, playerStats, campaignName,
// mapName, result) plus the RAW 2024 no-concentration rule.
// Skip-lane money semantics and the guard-before-log empty-payload edges live in
// ../useSpellMetamagicFlow.special-paths.rollback.test.js; popup payload authority
// lives in ./confirm-payloads.test.js — not re-pinned here.
import { readFileSync } from 'fs'
import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useCustomHandlers } from './useCustomHandlers.js'
import { applyProtectionFromPoisonHandler as mockedApply } from '../../../services/automation/index.js'
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

// 2024 PFP byte-shape (pinned to public/data/2024/spells.json below):
// lv2, concentration:false, Action, Touch, 1 hour.
const pfpSpell = {
  name: 'Protection from Poison',
  level: 2,
  concentration: false,
  casting_time: 'Action',
  range: 'Touch',
  duration: '1 hour',
  automation: { type: 'protection_from_poison', duration: '1 hour', casting_time: '1 action', range: 'Touch' },
}

const pending = {
  spell: pfpSpell,
  spellName: 'Protection from Poison',
  spellLevel: 2,
  castingTime: 'Action',
  range: 'Touch',
  creatureTargets: [TARGET, CASTER],
}

function renderPfp() {
  const playerStats = { name: CASTER, class: { name: 'Cleric' }, level: 17, spellAbilities: { spell_slots_level_2: 3, saveDc: 17 } }
  const cfClearPending = vi.fn()
  const setPopupHtml = vi.fn()
  const { result } = renderHook(() =>
    useCustomHandlers({ playerStats, campaignName: CAMPAIGN, cfClearPending, getPending: () => pending, setPopupHtml, characters: [] })
  )
  return { result, cfClearPending, setPopupHtml }
}

const getByPath = (obj, path) => path.split('.').reduce((o, k) => o?.[k], obj)

describe('SP-095 handleProtectionFromPoisonConfirm — pay-at-confirm + apply seam', () => {
  let ctx, arg

  beforeEach(async () => {
    vi.clearAllMocks()
    for (const k of Object.keys(store)) delete store[k]
    store.spell_slots_level_2 = 3
    sharedCombatSummary.creatures[0].concentration = null
    ctx = renderPfp()

    await act(async () => {
      await ctx.result.current.handleProtectionFromPoisonConfirm([TARGET])
    })

    expect(mockedApply).toHaveBeenCalledTimes(1)
    arg = mockedApply.mock.calls[0]
  })

  it('applies with FIVE positional args, spell passed by reference inside the action wrapper (converting to barkskin\'s single-object contract fails this)', () => {
    expect(arg.length).toBe(5)
    expect(arg[0].spell).toBe(pfpSpell)
  })

  // One row per positional slot of applyProtectionFromPoisonHandler(action, playerStats, campaignName, mapName, result).
  it.each([
    ['0.name', 'Protection from Poison'],
    ['0.automation.type', 'protection_from_poison'],
    ['1.name', CASTER],
    ['2', CAMPAIGN],
    ['3', null],
    ['4', { targetName: TARGET }],
  ])('apply arg %s carries the lane context', (path, expected) => {
    expect(getByPath(arg, path)).toEqual(expected)
  })

  it('pays exactly ONE lv2 spell slot via the real prepareSpellCast', () => {
    const slotWrites = setRuntimeValue.mock.calls.filter(c => String(c[1]).startsWith('spell_slots_'))
    expect(slotWrites).toEqual([[CASTER, 'spell_slots_level_2', 2, CAMPAIGN]])
    expect(store.spell_slots_level_2).toBe(2)
  })

  it('logs the spell cast and the slot-spend ability_use entry', () => {
    expect(addEntry).toHaveBeenCalledWith(CAMPAIGN, expect.objectContaining({
      type: 'spell',
      characterName: CASTER,
      targetName: TARGET,
      spellName: 'Protection from Poison',
      spellLevel: 2,
      castingTime: 'Action',
    }))
    const spendLog = addEntry.mock.calls
      .map(c => c[1])
      .find(e => e && e.type === 'ability_use' && /Expended a level 2 spell slot/.test(e.description))
    expect(spendLog).toBeTruthy()
    expect(spendLog.characterName).toBe(CASTER)
  })

  it('imposes NO caster concentration (spell data concentration:false, RAW 2024)', () => {
    expect(addConcentration).not.toHaveBeenCalled()
    const caster = getCombatSummary(CAMPAIGN).creatures.find(c => c.name === CASTER)
    expect(caster.concentration).toBeNull()
  })

  it('resolves the lane: clears pending', () => {
    expect(ctx.cfClearPending).toHaveBeenCalledWith('protectionFromPoison')
  })

  it('skip AFTER confirm still nets exactly one slot spent (paid slot is never rolled back)', () => {
    act(() => {
      ctx.result.current.handleProtectionFromPoisonSkip()
    })

    expect(store.spell_slots_level_2).toBe(2)
    expect(rollbackSpellSlot).not.toHaveBeenCalled()
  })
})

describe('PFP fixture vs published data', () => {
  it('fixture byte-shape matches public/data/2024/spells.json Protection from Poison', () => {
    const spells = JSON.parse(readFileSync('public/data/2024/spells.json', 'utf8'))
    const data = spells.find(s => s.index === 'protection-from-poison' || s.name === 'Protection from Poison')
    expect({
      level: pfpSpell.level,
      concentration: pfpSpell.concentration,
      casting_time: pfpSpell.casting_time,
      range: pfpSpell.range,
      duration: pfpSpell.duration,
      automationType: pfpSpell.automation.type,
    }).toEqual({
      level: data.level,
      concentration: data.concentration,
      casting_time: data.casting_time,
      range: data.range,
      duration: data.duration,
      automationType: data.automation.type,
    })
  })
})
