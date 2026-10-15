// @maintained-by-ai: 2026-10-15
// SP-125: Warding Bond confirm lane — pay-at-confirm (SP-013 barkskin template)
// and thread the CHOSEN target name onto the handler metaCtx (the production
// producer for metaCtx.wardingBondTargetName, previously set only in tests).
// This is the custom-handler confirm seam: gate wiring lives in
// spellGates.wardingBond / useSpellMetamagicGates tests; the buff byte-shape
// (+1 AC/+1 saves/resistance×12, bondTarget/sourceCharacter), recast-break,
// and 600-round clocks are pinned in the heavily-maintained wardingBondHandler
// lane — here we only verify the CHOSEN target survives the hook→handler→store
// round trip. Pins: one executeHandler dispatch, one lv2 slot burned, refusal-free
// dispatch, cast logged once, popup handoff, and skip-lane inertness.
import { readFileSync } from 'fs'
import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useCustomHandlers } from './useCustomHandlers.js'
import { executeHandler } from '../../../services/automation/index.js'
import { setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js'
import { addEntry } from '../../../services/ui/logService.js'
import { addConcentration } from '../../../services/combat/concentration/concentrationService.js'
import { handle as realWardingBondHandle } from '../../../services/automation/handlers/spells/wardingBondHandler.js'

const CAMPAIGN = 'test-campaign'
const CASTER = 'War_Cleric'
const TARGET = 'AasimarTest'
const ALT_TARGET = 'ElderPaladin'

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

// 2024 Warding Bond byte-shape (pinned to public/data/2024/spells.json below):
// Action, NOT concentration, 1 hour, lv2.
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
    creatureTargets: [TARGET, ALT_TARGET],
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

const getByPath = (obj, path) => path.split('.').reduce((o, k) => o?.[k], obj)

describe('SP-125 handleWardingBondConfirm — pay-at-confirm + metaCtx threading', () => {
  let ctx, action

  beforeEach(async () => {
    vi.clearAllMocks()
    for (const k of Object.keys(store)) delete store[k]
    store[keyOf(CASTER, 'spell_slots_level_2')] = 3
    sharedCombatSummary.creatures.forEach(c => { c.concentration = null })
    executeHandler.mockImplementation((action, ps, cn) => realWardingBondHandle(action, ps, cn))
    ctx = renderWardingBond()

    await act(async () => {
      await ctx.result.current.handleWardingBondConfirm(TARGET)
    })

    // Refusal-free dispatch: exactly one executeHandler call, no second chance.
    expect(executeHandler).toHaveBeenCalledTimes(1)
    action = executeHandler.mock.calls[0][0]
  })

  // One row per field the wardingBondHandler reads off the dispatched action.
  it.each([
    ['name', 'Warding Bond'],
    ['spell', wardingBondSpell],
    ['automation.type', 'warding_bond'],
    ['metaCtx.wardingBondTargetName', TARGET],
  ])('dispatched action %s carries the lane context', (path, expected) => {
    expect(getByPath(action, path)).toEqual(expected)
  })

  it('burns exactly ONE lv2 spell slot via prepareSpellCast (3→2)', () => {
    const slotWrites = setRuntimeValue.mock.calls.filter(c => String(c[1]).startsWith('spell_slots_'))
    expect(slotWrites).toEqual([[CASTER, 'spell_slots_level_2', 2, CAMPAIGN]])
    expect(store[keyOf(CASTER, 'spell_slots_level_2')]).toBe(2)
  })

  it('2024 concentration:false — no concentration ever registered (conc stays null)', () => {
    expect(addConcentration).not.toHaveBeenCalled()
    expect(sharedCombatSummary.creatures.find(c => c.name === CASTER).concentration).toBeNull()
  })

  it('logs the spell cast once stamped with the chosen target', () => {
    const spellLogs = addEntry.mock.calls.map(c => c[1]).filter(e => e?.type === 'spell')
    expect(spellLogs).toHaveLength(1)
    expect(spellLogs[0]).toMatchObject({ targetName: TARGET, spellName: 'Warding Bond', characterName: CASTER })
  })

  it('the CHOSEN target survives the hook→handler→store round trip', () => {
    // Byte-shape of the buff is pinned in the wardingBondHandler lane; here we
    // only pin that the confirm-threaded name (not combat context, not pending)
    // is who got bonded.
    const targetBuff = (store[keyOf(TARGET, 'activeBuffs')] || []).find(b => b.effect === 'warding_bond')
    expect(targetBuff).toBeDefined()
    const casterBuff = (store[keyOf(CASTER, 'activeBuffs')] || []).find(b => b.effect === 'warding_bond')
    expect(casterBuff.bondTarget).toBe(TARGET)
  })

  it('resolves the lane: clears pending and shows the handler popup payload', () => {
    expect(ctx.cfClearPending).toHaveBeenCalledWith('wardingBond')
    expect(ctx.setPopupHtml).toHaveBeenCalledWith(expect.objectContaining({
      type: 'automation_info',
      name: 'Warding Bond',
    }))
  })
})

describe('handleWardingBondConfirm — chosen target beats the pending candidate list', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    for (const k of Object.keys(store)) delete store[k]
    store[keyOf(CASTER, 'spell_slots_level_2')] = 3
    executeHandler.mockImplementation((action, ps, cn) => realWardingBondHandle(action, ps, cn))
  })

  it('array result flattens to result[0] and the bond follows it, not pending.creatureTargets[0]', async () => {
    const { result } = renderWardingBond()

    await act(async () => {
      await result.current.handleWardingBondConfirm([ALT_TARGET, TARGET])
    })

    expect(executeHandler.mock.calls[0][0].metaCtx.wardingBondTargetName).toBe(ALT_TARGET)
    const altBuff = (store[keyOf(ALT_TARGET, 'activeBuffs')] || []).find(b => b.effect === 'warding_bond')
    expect(altBuff).toBeDefined()
    const casterBuff = (store[keyOf(CASTER, 'activeBuffs')] || []).find(b => b.effect === 'warding_bond')
    expect(casterBuff.bondTarget).toBe(ALT_TARGET)
  })
})

describe('handleWardingBondSkip — inert lane', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    for (const k of Object.keys(store)) delete store[k]
    store[keyOf(CASTER, 'spell_slots_level_2')] = 3
  })

  it('spends NOTHING: no slot payment, no handler dispatch, no cast log; clears pending', () => {
    const { result, cfClearPending, setPopupHtml } = renderWardingBond()
    result.current.handleWardingBondSkip()

    expect(cfClearPending).toHaveBeenCalledWith('wardingBond')
    expect(store[keyOf(CASTER, 'spell_slots_level_2')]).toBe(3)
    expect(setRuntimeValue).not.toHaveBeenCalled()
    expect(executeHandler).not.toHaveBeenCalled()
    expect(addEntry).not.toHaveBeenCalled()
    expect(setPopupHtml).not.toHaveBeenCalled()
  })
})

describe('wardingBond fixture vs published data', () => {
  it('fixture byte-shape matches public/data/2024/spells.json Warding Bond', () => {
    const spells = JSON.parse(readFileSync('public/data/2024/spells.json', 'utf8'))
    const data = spells.find(s => s.index === 'warding-bond')
    const pick = s => ({
      level: s.level,
      concentration: s.concentration,
      casting_time: s.casting_time,
      range: s.range,
      duration: s.duration,
      automation: s.automation,
    })
    expect(pick(wardingBondSpell)).toEqual(pick(data))
  })
})
