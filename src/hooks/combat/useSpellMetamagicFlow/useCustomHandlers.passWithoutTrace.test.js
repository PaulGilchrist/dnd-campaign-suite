// @maintained-by-ai: 2026-10-15
// SP-085: Pass Without Trace confirm previously bypassed prepareSpellCast — no slot
// spent, no concentration tracked. This file is the PWT custom-handler confirm lane:
// it pins the FIVE-POSITIONAL-arg contract of applyPassWithoutTraceEffect (the
// opposite of barkskin's single-object contract — converting it breaks the service),
// the lv2 slot payment, concentration registration on the caster's save DC, the
// cast log, and lane resolution. Service internals (+10 bonus build, dedupe/
// rollback) live in passWithoutTraceService.test.js; skip-lane inertness lives in
// useSpellMetamagicFlow.skip.test.js.
import { readFileSync } from 'fs'
import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useCustomHandlers } from './useCustomHandlers.js'
import { applyPassWithoutTraceEffect as mockedApply } from '../../../services/automation/index.js'
import { setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js'
import { addEntry } from '../../../services/ui/logService.js'
import { addConcentration } from '../../../services/combat/concentration/concentrationService.js'
import { getCombatSummary } from '../../../services/encounters/combatData.js'
import * as storageService from '../../../services/ui/storage.js'

const CAMPAIGN = 'test-campaign'
const CASTER = 'FeyRanger'
const TARGETS = [CASTER, 'HeroesFeastBard']
const SAVE_DC = 16

const store = {}

vi.mock('../../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}))

vi.mock('../../../services/automation/index.js', () => ({
  applyPassWithoutTraceEffect: vi.fn(() => Promise.resolve({ payload: 'pwt-popup' })),
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

// 5e PWT byte-shape (pinned to public/data/spells.json below):
// 2nd level, concentration, self-range with a 30 ft shared area.
const pwtSpell = {
  name: 'Pass Without Trace',
  level: 2,
  concentration: true,
  casting_time: '1 action',
  range: 'Self',
  duration: 'Up to 1 hour',
  automation: {
    type: 'pass_without_trace',
    duration: 'Concentration, up to 1 hour',
    auraRange: 30,
  },
}

function renderPWT() {
  const playerStats = {
    name: CASTER,
    class: { name: 'Ranger' },
    level: 15,
    spellAbilities: { spell_slots_level_2: 3, saveDc: SAVE_DC },
    automation: { passives: [] },
  }
  const cfClearPending = vi.fn()
  const setPopupHtml = vi.fn()
  const pending = {
    spell: pwtSpell,
    spellName: 'Pass Without Trace',
    spellLevel: 2,
    castingTime: '1 action',
    range: 'Self',
    creatureTargets: TARGETS,
  }
  const { result } = renderHook(() =>
    useCustomHandlers({ playerStats, campaignName: CAMPAIGN, cfClearPending, getPending: () => pending, setPopupHtml, characters: [] })
  )
  return { result, cfClearPending, setPopupHtml }
}

const getByPath = (obj, path) => path.split('.').reduce((o, k) => o?.[k], obj)

describe('SP-085 handlePassWithoutTraceConfirm — positional apply + slot payment', () => {
  let ctx, arg

  beforeEach(async () => {
    vi.clearAllMocks()
    for (const k of Object.keys(store)) delete store[k]
    store.spell_slots_level_2 = 3
    sharedCombatSummary.creatures[0].concentration = null
    ctx = renderPWT()

    await act(async () => {
      await ctx.result.current.handlePassWithoutTraceConfirm(TARGETS)
    })

    expect(mockedApply).toHaveBeenCalledTimes(1)
    arg = mockedApply.mock.calls[0]
  })

  it('applies with FIVE positional args, spell passed by reference (converting to barkskin\'s single-object contract fails this)', () => {
    expect(arg.length).toBe(5)
    expect(arg[0]).toBe(pwtSpell)
  })

  // One row per positional slot of applyPassWithoutTraceEffect(spell, playerStats, campaignName, mapName, targetNames).
  it.each([
    ['0.name', 'Pass Without Trace'],
    ['0.level', 2],
    ['0.concentration', true],
    ['1.name', CASTER],
    ['2', CAMPAIGN],
    ['3', null],
    ['4', TARGETS],
  ])('apply arg %s carries the lane context', (path, expected) => {
    expect(getByPath(arg, path)).toEqual(expected)
  })

  it('pays exactly ONE lv2 spell slot via prepareSpellCast', () => {
    const slotWrites = setRuntimeValue.mock.calls.filter(c => String(c[1]).startsWith('spell_slots_'))
    expect(slotWrites).toEqual([[CASTER, 'spell_slots_level_2', 2, CAMPAIGN]])
    expect(store.spell_slots_level_2).toBe(2)
  })

  it('registers caster concentration on the caster save DC and persists combatSummary', () => {
    expect(addConcentration).toHaveBeenCalledWith(expect.anything(), CASTER, 'Pass Without Trace', SAVE_DC, null)
    expect(storageService.default.set).toHaveBeenCalledWith('combatSummary', expect.anything(), CAMPAIGN)
    expect(getCombatSummary(CAMPAIGN).creatures.find(c => c.name === CASTER).concentration.spell).toBe('Pass Without Trace')
  })

  it('logs the spell cast to the campaign log', () => {
    expect(addEntry).toHaveBeenCalledWith(CAMPAIGN, expect.objectContaining({
      type: 'spell',
      characterName: CASTER,
      spellName: 'Pass Without Trace',
      spellLevel: 2,
      targets: TARGETS,
    }))
  })

  it('resolves the lane: clears pending and shows the apply popup payload', () => {
    expect(ctx.cfClearPending).toHaveBeenCalledWith('passWithoutTrace')
    expect(ctx.setPopupHtml).toHaveBeenCalledWith('pwt-popup')
  })
})

describe('PWT fixture vs published data', () => {
  it('fixture byte-shape matches public/data/spells.json Pass Without Trace', () => {
    const spells = JSON.parse(readFileSync('public/data/spells.json', 'utf8'))
    const data = spells.find(s => s.index === 'pass-without-trace' || s.name === 'Pass Without Trace')
    expect({
      level: pwtSpell.level,
      concentration: pwtSpell.concentration,
      casting_time: pwtSpell.casting_time,
      range: pwtSpell.range,
      duration: pwtSpell.duration,
      auraRange: pwtSpell.automation.auraRange,
    }).toEqual({
      level: data.level,
      concentration: data.concentration,
      casting_time: data.casting_time,
      range: data.range,
      duration: data.duration,
      auraRange: data.automation.auraRange,
    })
  })
})
