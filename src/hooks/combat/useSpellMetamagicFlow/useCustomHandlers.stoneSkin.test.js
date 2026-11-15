// @maintained-by-ai: 2026-11-15
// Stone Skin confirm payment seam (slot-owe fix, bug-enhance-ability-stone-skin-
// confirms-never-pay, owner ruling 2026-11-15: pay BOTH lanes through the canonical
// seam — RAW is slot AND diamond dust). Same template as
// ./useCustomHandlers.protectionFromPoison.test.js (SP-095): the REAL
// prepareSpellCast runs against a store-backed useRuntimeState mock. Pins:
// one confirm consumes the Diamond Dust leg UNCHANGED (byte-identical call) AND
// pays exactly one lv4 slot via prepareSpellCast with the consumeBarkskinSlot
// options shape (CLA-312 effective-level free-cast gate) + the family's
// ability_use audit row when slotConsumed; the type:'spell' cast row bytes stay
// identical; a repeat cast decrements AGAIN (3→2, no double-spend); an upcast
// pays the upcast key only (CLA-086); zero-slot caster = ZERO slot bytes with
// the precedent's no-invented-refusal answer; pre-confirm Skip stays the
// zero-write unpaid dismiss (73bc0c5e7 law survives — no dust, no slot, no row);
// skip AFTER confirm nets exactly one spend (no refund of a paid slot).
import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useCustomHandlers } from './useCustomHandlers.js'
import { applyStoneSkinHandler } from '../../../services/automation/index.js'
import { consumeMaterial } from '../../../services/rules/spells/materialComponents.js'
import { addEntry } from '../../../services/ui/logService.js'
import { setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js'

const CAMPAIGN = 'test-campaign'
const CASTER = 'Wild_Sage_Druid'
const TARGET = 'AasimarTest'

const store = {}

vi.mock('../../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}))

vi.mock('../../../services/automation/index.js', () => ({
  applyBarkskinEffect: vi.fn(() => Promise.resolve(null)),
  applyPassWithoutTraceEffect: vi.fn(() => Promise.resolve(null)),
  applyProtectionFromPoisonHandler: vi.fn(() => Promise.resolve(null)),
  applyStoneSkinHandler: vi.fn(() => Promise.resolve(null)),
  executeHandler: vi.fn(() => Promise.resolve(null)),
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

// Mirrors public/data/2024/spells.json Stone Skin: lv4, concentration, Action,
// Touch (Stone Skin is 2024-data-only — no 5e spells.json row).
function makeSpell(overrides = {}) {
  return {
    name: 'Stone Skin',
    level: 4,
    concentration: true,
    casting_time: 'Action',
    range: 'Touch',
    automation: { type: 'stone_skin', range: 'Touch' },
    ...overrides,
  }
}

function renderSS(spell = makeSpell()) {
  const playerStats = { name: CASTER, class: { name: 'Druid' }, level: 20, spellAbilities: { saveDc: 17, spell_slots_level_4: 3, spell_slots_level_5: 1 } }
  const pending = {
    spell,
    spellName: spell.name,
    spellLevel: spell.level,
    castingTime: spell.casting_time,
    range: spell.range,
    creatureTargets: [TARGET],
  }
  let cleared = false
  const cfClearPending = vi.fn(() => { cleared = true })
  const getPending = (type) => (type === 'stoneSkin' && !cleared ? pending : null)
  const { result } = renderHook(() =>
    useCustomHandlers({ playerStats, campaignName: CAMPAIGN, cfClearPending, getPending, setPopupHtml: vi.fn(), characters: [] })
  )
  return { result, playerStats, pending, cfClearPending }
}

const slotWrites = () => setRuntimeValue.mock.calls.filter(c => String(c[1]).startsWith('spell_slots_'))

describe('handleStoneSkinConfirm — slot AND dust pay-at-confirm (2026-11-15 slot-owe fix)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    for (const k of Object.keys(store)) delete store[k]
    store.spell_slots_level_4 = 3
    store.spell_slots_level_5 = 1
    sharedCombatSummary.creatures[0].concentration = null
  })

  it('pays its lv4 slot via the canonical seam AND keeps the Diamond Dust leg — slot AND dust, audit rows intact', async () => {
    const { result, playerStats, pending } = renderSS()

    await act(async () => {
      await result.current.handleStoneSkinConfirm(TARGET)
    })

    // Material leg byte-identical (unchanged position/args).
    expect(consumeMaterial).toHaveBeenCalledTimes(1)
    expect(consumeMaterial).toHaveBeenCalledWith(playerStats, 'Diamond Dust (100 gp)', CAMPAIGN)

    // Canonical seam: exactly one lv4 slot write, 3→2.
    expect(slotWrites()).toEqual([[CASTER, 'spell_slots_level_4', 2, CAMPAIGN]])
    expect(store.spell_slots_level_4).toBe(2)

    // Money-flag law (73bc0c5e7): paid stamp lands at the confirm seam.
    expect(pending.slotConsumed).toBe(true)

    // Rows: byte-identical type:'spell' cast row + the consumeBarkskinSlot-family
    // ability_use audit twin (the file's paying lanes all log one).
    expect(addEntry).toHaveBeenCalledWith(CAMPAIGN, expect.objectContaining({
      type: 'spell',
      characterName: CASTER,
      targetName: TARGET,
      targets: [TARGET],
      spellName: 'Stone Skin',
      spellLevel: 4,
      castingTime: 'Action',
    }))
    const spendLog = addEntry.mock.calls
      .map(c => c[1])
      .find(e => e && e.type === 'ability_use' && /Expended a level 4 spell slot/.test(e.description))
    expect(spendLog).toBeTruthy()
    expect(spendLog.characterName).toBe(CASTER)

    expect(applyStoneSkinHandler).toHaveBeenCalledTimes(1)
  })

  it('a repeat second cast decrements AGAIN (3→2→1, no floor-skip, no double-spend)', async () => {
    const first = renderSS()
    await act(async () => {
      await first.result.current.handleStoneSkinConfirm(TARGET)
    })
    expect(store.spell_slots_level_4).toBe(2)

    const second = renderSS()
    await act(async () => {
      await second.result.current.handleStoneSkinConfirm(TARGET)
    })

    expect(store.spell_slots_level_4).toBe(1)
    expect(slotWrites()).toEqual([
      [CASTER, 'spell_slots_level_4', 2, CAMPAIGN],
      [CASTER, 'spell_slots_level_4', 1, CAMPAIGN],
    ])
  })

  it('an upcast pays the UPCAST key only (CLA-086) — the base lv4 bucket stays byte-untouched', async () => {
    const { result } = renderSS(makeSpell({ upcastLevel: 5 }))

    await act(async () => {
      await result.current.handleStoneSkinConfirm(TARGET)
    })

    expect(slotWrites()).toEqual([[CASTER, 'spell_slots_level_5', 0, CAMPAIGN]])
    expect(store.spell_slots_level_4).toBe(3)
  })

  it('a zero-lv4-slot caster writes ZERO slot bytes (floor guard); the lane takes the precedent answer (no invented refusal) — dust and effect legs ride unchanged', async () => {
    store.spell_slots_level_4 = 0
    const { result, pending } = renderSS()

    await act(async () => {
      await result.current.handleStoneSkinConfirm(TARGET)
    })

    expect(slotWrites()).toHaveLength(0)
    expect(store.spell_slots_level_4).toBe(0)
    // Resource refusal lives in SpellDetailPopup canCast upstream ("No spell slots
    // available for this level."); the confirm lanes never branch on the pay result
    // (PFEG/createConfirmHandler/consumeBarkskinSlot precedent).
    expect(consumeMaterial).toHaveBeenCalledTimes(1)
    expect(applyStoneSkinHandler).toHaveBeenCalledTimes(1)
    expect(pending.slotConsumed).toBe(true) // canonical unconditional stamp twin
    // The ability_use audit twin is gated on slotConsumed — nothing spent, nothing claimed.
    const spendLog = addEntry.mock.calls
      .map(c => c[1])
      .find(e => e && e.type === 'ability_use')
    expect(spendLog).toBeUndefined()
  })

  it('confirm on an unarmed lane (no pending) is a pure no-op — no dust, no slot, no row (criterion 4)', async () => {
    const playerStats = { name: CASTER, class: { name: 'Druid' }, level: 20 }
    const cfClearPending = vi.fn()
    const { result } = renderHook(() =>
      useCustomHandlers({ playerStats, campaignName: CAMPAIGN, cfClearPending, getPending: () => null, setPopupHtml: vi.fn(), characters: [] })
    )

    await act(async () => {
      await result.current.handleStoneSkinConfirm(TARGET)
    })

    expect(consumeMaterial).not.toHaveBeenCalled()
    expect(slotWrites()).toHaveLength(0)
    expect(addEntry).not.toHaveBeenCalled()
    expect(applyStoneSkinHandler).not.toHaveBeenCalled()
    expect(cfClearPending).not.toHaveBeenCalled()
  })

  it('skip BEFORE confirm stays the zero-write unpaid dismiss — no dust, no slot, no row (73bc0c5e7 survive-check)', () => {
    const { result, pending, cfClearPending } = renderSS()

    act(() => {
      result.current.handleStoneSkinSkip()
    })

    expect(consumeMaterial).not.toHaveBeenCalled()
    expect(slotWrites()).toHaveLength(0)
    expect(store.spell_slots_level_4).toBe(3)
    expect(addEntry).not.toHaveBeenCalled()
    expect(applyStoneSkinHandler).not.toHaveBeenCalled()
    expect(pending.slotConsumed).toBeUndefined()
    expect(cfClearPending).toHaveBeenCalledWith('stoneSkin')
  })

  it('skip AFTER confirm nets exactly one slot spent (paid slot is never rolled back)', async () => {
    const { result } = renderSS()
    await act(async () => {
      await result.current.handleStoneSkinConfirm(TARGET)
    })
    expect(store.spell_slots_level_4).toBe(2)

    act(() => {
      result.current.handleStoneSkinSkip()
    })

    expect(store.spell_slots_level_4).toBe(2)
  })
})
