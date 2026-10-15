// @maintained-by-ai: 2026-10-15
// SP-013: Barkskin cast resolved to ZERO effect — handleBarkskinConfirm called
// applyBarkskinEffect with POSITIONAL args while the function destructures a
// SINGLE object (targetNames always undefined → early return null). This file is
// the custom-handler confirm lane seam: gate→confirm wiring lives in
// confirm-payloads.test.js, AC-floor internals in the barkskinHandler feature
// lane. Here we pin the object-call contract, the lv2 slot payment (SP-085
// confirm-lane family), the 2024 no-concentration semantics, and skip-lane inertness.
import { readFileSync } from 'fs'
import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useCustomHandlers } from './useCustomHandlers.js'
import { applyBarkskinEffect as mockedApply } from '../../../services/automation/index.js'
import { setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js'
import { addEntry } from '../../../services/ui/logService.js'
import { addConcentration } from '../../../services/combat/concentration/concentrationService.js'
import { getCombatSummary } from '../../../services/encounters/combatData.js'

const CAMPAIGN = 'test-campaign'
const CASTER = 'Wild_Sage_Druid'
const TARGETS = [CASTER, 'Goblin 1']
const CHARACTERS = [{ name: CASTER, computedStats: { armorClass: 9 } }]

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

// 2024 barkskin byte-shape (pinned to public/data/2024/spells.json below):
// Bonus Action, NOT concentration, 1 hour.
const barkskinSpell = {
  name: 'Barkskin',
  level: 2,
  concentration: false,
  casting_time: 'Bonus Action',
  range: 'Touch',
  duration: '1 hour',
}

function renderBarkskin() {
  const playerStats = { name: CASTER, class: { name: 'Druid' }, level: 20, spellAbilities: { spell_slots_level_2: 3 } }
  const cfClearPending = vi.fn()
  const setPopupHtml = vi.fn()
  const pending = {
    spell: barkskinSpell,
    spellName: 'Barkskin',
    spellLevel: 2,
    castingTime: 'Bonus Action',
    range: 'Touch',
    creatureTargets: TARGETS,
  }
  const { result } = renderHook(() =>
    useCustomHandlers({ playerStats, campaignName: CAMPAIGN, cfClearPending, getPending: () => pending, setPopupHtml, characters: CHARACTERS })
  )
  return { result, cfClearPending, setPopupHtml }
}

const getByPath = (obj, path) => path.split('.').reduce((o, k) => o?.[k], obj)

describe('SP-013 handleBarkskinConfirm — object-call contract + slot payment', () => {
  let ctx, arg

  beforeEach(async () => {
    vi.clearAllMocks()
    for (const k of Object.keys(store)) delete store[k]
    store.spell_slots_level_2 = 3
    sharedCombatSummary.creatures[0].concentration = null
    ctx = renderBarkskin()

    await act(async () => {
      await ctx.result.current.handleBarkskinConfirm(TARGETS)
    })

    expect(mockedApply).toHaveBeenCalledTimes(1)
    arg = mockedApply.mock.calls[0][0]
  })

  it('applies with a SINGLE object arg (the positional call that caused SP-013 fails this)', () => {
    expect(mockedApply.mock.calls[0].length).toBe(1)
    expect(arg.action.spell).toBe(barkskinSpell)
  })

  // One row per field applyBarkskinEffect destructures from its object arg.
  it.each([
    ['targetNames', TARGETS],
    ['campaignName', CAMPAIGN],
    ['playerStats.name', CASTER],
    ['characters', CHARACTERS],
    ['action.name', 'Barkskin'],
    ['action.automation', { type: 'barkskin', range: 'Touch' }],
  ])('apply arg %s carries the lane context', (path, expected) => {
    expect(getByPath(arg, path)).toEqual(expected)
  })

  it('pays exactly ONE lv2 spell slot via prepareSpellCast', () => {
    const slotWrites = setRuntimeValue.mock.calls.filter(c => String(c[1]).startsWith('spell_slots_'))
    expect(slotWrites).toEqual([[CASTER, 'spell_slots_level_2', 2, CAMPAIGN]])
    expect(store.spell_slots_level_2).toBe(2)
  })

  it('does NOT register concentration for the 2024 non-concentration spell', () => {
    expect(addConcentration).not.toHaveBeenCalled()
    expect(getCombatSummary(CAMPAIGN).creatures.find(c => c.name === CASTER).concentration).toBeNull()
  })

  it('logs the spell cast to the campaign log', () => {
    expect(addEntry).toHaveBeenCalledWith(CAMPAIGN, expect.objectContaining({
      type: 'spell',
      characterName: CASTER,
      spellName: 'Barkskin',
      targetName: TARGETS[0],
      targets: TARGETS,
    }))
  })

  it('resolves the lane: clears pending and shows the apply popup payload', () => {
    expect(ctx.cfClearPending).toHaveBeenCalledWith('barkskin')
    expect(ctx.setPopupHtml).toHaveBeenCalledWith('barkskin-popup')
  })
})

describe('handleBarkskinSkip — inert lane', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    for (const k of Object.keys(store)) delete store[k]
    store.spell_slots_level_2 = 3
  })

  it('clears pending without applying, paying, or logging a cast', () => {
    const { result, cfClearPending, setPopupHtml } = renderBarkskin()
    result.current.handleBarkskinSkip()

    expect(cfClearPending).toHaveBeenCalledWith('barkskin')
    expect(mockedApply).not.toHaveBeenCalled()
    expect(setRuntimeValue).not.toHaveBeenCalled()
    expect(setPopupHtml).not.toHaveBeenCalled()
  })
})

describe('barkskin fixture vs published data', () => {
  it('fixture byte-shape matches public/data/2024/spells.json Barkskin', () => {
    const spells = JSON.parse(readFileSync('public/data/2024/spells.json', 'utf8'))
    const data = spells.find(s => s.index === 'barkskin')
    expect({
      level: barkskinSpell.level,
      concentration: barkskinSpell.concentration,
      casting_time: barkskinSpell.casting_time,
      range: barkskinSpell.range,
      duration: barkskinSpell.duration,
    }).toEqual({
      level: data.level,
      concentration: data.concentration,
      casting_time: data.casting_time,
      range: data.range,
      duration: data.duration,
    })
  })
})
