// @maintained-by-ai 2026-11-15: 2026-11-15
// Numeric slot-legality twin for the EA pay-at-confirm seam (slot-owe fix,
// bug-enhance-ability-stone-skin-confirms-never-pay, owner ruling 2026-11-15):
// unlike ./useTwoStageHandlers.enhanceAbility.test.js (mocked seam — call shape,
// CLA-312 gate, slotConsumed stamp, ordering), this file runs the REAL
// prepareSpellCast against a store-backed useRuntimeState mock, in the exact
// SP-095 template of ./useCustomHandlers.protectionFromPoison.test.js. Pins:
// one confirm decrements the correct spell_slots_level_2 key by EXACTLY 1 (one
// merged write, no double-spend); a repeat cast decrements AGAIN (no floor-skip);
// an upcast pays the UPCAST key and leaves the base bucket untouched (CLA-086);
// a zero-slot caster sees ZERO slot bytes written (consumeBaseSlot floor guard —
// the lane takes the precedent's no-invented-refusal answer, resource refusal
// face lives in SpellDetailPopup canCast); pre-confirm Skip stays zero-write
// (the 73bc0c5e7 unpaid-skip law survives the pay fix).
import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useTwoStageHandlers } from './useTwoStageHandlers.js'
import { applyEnhanceAbilityEffect } from '../../../services/automation/index.js'
import { addEntry } from '../../../services/ui/logService.js'
import { setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js'

const CAMPAIGN = 'test-campaign'
const CASTER = 'Wild_Sage_Druid'
const TARGET = 'Wild_Sage_Druid'

const store = {}

vi.mock('../../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}))

vi.mock('../useConfirmableFlow.js', () => ({
  rollbackSpellSlot: vi.fn(),
}))

vi.mock('../../../services/automation/index.js', () => ({
  applyProtectionFromEnergyHandler: vi.fn(() => Promise.resolve(null)),
  applyResistanceEffect: vi.fn(() => Promise.resolve(null)),
  applyEnhanceAbilityEffect: vi.fn(() => Promise.resolve(null)),
}))

// REAL prepareSpellCast runs (no vi.mock of spellPreparationService).

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

// Mirrors public/data/spells.json Enhance Ability: lv2, concentration, 1 action, Touch.
function makeSpell(overrides = {}) {
  return {
    name: 'Enhance Ability',
    level: 2,
    concentration: true,
    casting_time: '1 action',
    range: 'Touch',
    automation: { type: 'enhance_ability', range: 'Touch' },
    ...overrides,
  }
}

function renderEA(spell = makeSpell()) {
  const playerStats = { name: CASTER, class: { name: 'Druid' }, level: 20, spellAbilities: { saveDc: 17, spell_slots_level_2: 3, spell_slots_level_3: 1 } }
  const pending = {
    spell,
    spellName: spell.name,
    spellLevel: spell.level,
    castingTime: spell.casting_time,
    range: spell.range,
    creatureTargets: [CASTER, 'HexWarlock'],
  }
  let cleared = false
  const cfClearPending = vi.fn(() => { cleared = true })
  const getPending = (type) => (type === 'enhanceAbility' && !cleared ? pending : null)
  const { result } = renderHook(() =>
    useTwoStageHandlers({ playerStats, campaignName: CAMPAIGN, cfClearPending, getPending, setPopupHtml: vi.fn() })
  )
  return { result, pending, cfClearPending }
}

const slotWrites = () => setRuntimeValue.mock.calls.filter(c => String(c[1]).startsWith('spell_slots_'))

async function selectAndConfirm(result, spellArg = [TARGET]) {
  await act(async () => {
    result.current.handleEnhanceAbilityAbilitySelect('CHA')
  })
  await act(async () => {
    await result.current.handleEnhanceAbilityConfirm(spellArg)
  })
}

describe('EA pay-at-confirm — real prepareSpellCast slot math (2026-11-15 slot-owe fix)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    for (const k of Object.keys(store)) delete store[k]
    store.spell_slots_level_2 = 3
    store.spell_slots_level_3 = 1
    sharedCombatSummary.creatures[0].concentration = null
  })

  it('one successful confirm pays EXACTLY ONE lv2 slot (single −1 write) and stamps slotConsumed', async () => {
    const { result, pending } = renderEA()

    await selectAndConfirm(result)

    expect(slotWrites()).toEqual([[CASTER, 'spell_slots_level_2', 2, CAMPAIGN]])
    expect(store.spell_slots_level_2).toBe(2)
    expect(pending.slotConsumed).toBe(true)
    expect(applyEnhanceAbilityEffect).toHaveBeenCalledTimes(1)
    // EA lane adds no ability_use twin (PFEG-leg/createConfirmHandler precedent):
    // exactly the one byte-identical type:'spell' cast row.
    const rowTypes = addEntry.mock.calls.map(c => c[1].type)
    expect(rowTypes).toEqual(['spell'])
  })

  it('a repeat second cast decrements AGAIN (3→2→1, no floor-skip, no double-spend)', async () => {
    const first = renderEA()
    await selectAndConfirm(first.result)
    expect(store.spell_slots_level_2).toBe(2)

    const second = renderEA()
    await selectAndConfirm(second.result)

    expect(store.spell_slots_level_2).toBe(1)
    expect(slotWrites()).toEqual([
      [CASTER, 'spell_slots_level_2', 2, CAMPAIGN],
      [CASTER, 'spell_slots_level_2', 1, CAMPAIGN],
    ])
  })

  it('an upcast pays the UPCAST key only (CLA-086) — the base lv2 bucket stays byte-untouched', async () => {
    const { result } = renderEA(makeSpell({ upcastLevel: 3 }))

    await selectAndConfirm(result)

    expect(slotWrites()).toEqual([[CASTER, 'spell_slots_level_3', 0, CAMPAIGN]])
    expect(store.spell_slots_level_3).toBe(0)
    expect(store.spell_slots_level_2).toBe(3)
  })

  it('a zero-lv2-slot caster writes ZERO slot bytes (consumeBaseSlot floor guard) and the lane takes the precedent answer — no invented refusal', async () => {
    store.spell_slots_level_2 = 0
    const { result, pending } = renderEA()

    await selectAndConfirm(result)

    // No write at all on the slot lane — never a negative byte, never a clobber.
    expect(slotWrites()).toHaveLength(0)
    expect(store.spell_slots_level_2).toBe(0)
    // PFEG/createConfirmHandler precedent: the confirm never branches on the pay
    // result — cast row + effect ride unchanged (resource refusal is the
    // SpellDetailPopup canCast face, upstream of this lane).
    expect(addEntry).toHaveBeenCalledTimes(1)
    expect(applyEnhanceAbilityEffect).toHaveBeenCalledTimes(1)
    expect(pending.slotConsumed).toBe(true) // canonical stamp twin (unconditional at the pay seam)
  })

  it('skip BEFORE confirm writes nothing at all — slots untouched, no rows, no apply (unpaid-skip law survive-check)', () => {
    const { result, pending, cfClearPending } = renderEA()

    act(() => {
      result.current.handleEnhanceAbilitySkip()
    })

    expect(slotWrites()).toHaveLength(0)
    expect(store.spell_slots_level_2).toBe(3)
    expect(addEntry).not.toHaveBeenCalled()
    expect(applyEnhanceAbilityEffect).not.toHaveBeenCalled()
    expect(pending.slotConsumed).toBeUndefined()
    expect(cfClearPending).toHaveBeenCalledWith('enhanceAbility')
  })

  it('skip AFTER confirm nets exactly one slot spent (paid slot is never rolled back)', async () => {
    const { result } = renderEA()
    await selectAndConfirm(result)
    expect(store.spell_slots_level_2).toBe(2)

    act(() => {
      result.current.handleEnhanceAbilitySkip()
    })

    expect(store.spell_slots_level_2).toBe(2)
  })
})
