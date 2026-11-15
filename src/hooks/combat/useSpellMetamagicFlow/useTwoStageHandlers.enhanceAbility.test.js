// @maintained-by-ai: 2026-10-15
// Enhance Ability handler internals for useTwoStageHandlers (per-handler owner —
// flow orchestration / stage-machine seam lives in ../useSpellMetamagicFlow.gate-two-stage.test.js).
// Pins the SP-039/CLA-113 call shape: handleEnhanceAbilityConfirm passes a SINGLE object
// keyed to enhanceAbilityHandler.applyEnhanceAbility({action, playerStats, campaignName,
// targetNames, ability}) — the old positional call sent targetNames/ability as undefined,
// the handler silently returned null and the targetEffect was never stamped.
// Also owns: confirm target normalization, ability-guard parking, the EA pay-at-confirm
// seam (slot-owe fix: prepareSpellCast at FINAL confirm only + pending.slotConsumed
// stamp, CLA-312 effective-level gate, PFEG SP-093 twin), skip pay-state gate
// (unpaid ⇒ zero-write dismiss, paid ⇒ byte-identical lv2 rollback), popup pass-through.
import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useTwoStageHandlers } from './useTwoStageHandlers.js'
import { rollbackSpellSlot } from '../useConfirmableFlow.js'
import { addEntry } from '../../../services/ui/logService.js'
import { applyEnhanceAbilityEffect } from '../../../services/automation/index.js'
import { prepareSpellCast, isFreeCastAuthorized } from '../../../services/rules/spells/spellPreparationService.js'

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

vi.mock('../../../services/rules/spells/spellPreparationService.js', () => ({
  prepareSpellCast: vi.fn(() => Promise.resolve({ slotConsumed: true, modifiedSpell: {} })),
  isFreeCastAuthorized: vi.fn(() => false),
  isWizardRitualAdeptSpell: vi.fn(() => false),
}))

const CAMPAIGN = 'test-campaign'
const CASTER = 'Wild_Sage_Druid'
const TARGET = 'Wild_Sage_Druid'

// Mirrors public/data/spells.json Enhance Ability (lv2 Transmutation, Touch,
// concentration, 1 action) plus the automation fallback from triggerSpells.js.
const eaSpell = {
  name: 'Enhance Ability',
  level: 2,
  concentration: true,
  casting_time: '1 action',
  range: 'Touch',
  automation: { type: 'enhance_ability', range: 'Touch' },
}

function makePending() {
  return {
    spell: eaSpell,
    spellName: eaSpell.name,
    spellLevel: eaSpell.level,
    castingTime: eaSpell.casting_time,
    range: eaSpell.range,
    creatureTargets: [CASTER, 'HexWarlock'],
  }
}

function renderEA() {
  const playerStats = { name: CASTER, class: { name: 'Druid' }, level: 20, spellAbilities: { saveDc: 17, spell_slots_level_2: 4 } }
  let cleared = false
  const cfClearPending = vi.fn(() => { cleared = true })
  const getPending = (type) => (type === 'enhanceAbility' && !cleared ? makePending() : null)
  const setPopupHtml = vi.fn()
  const { result } = renderHook(() =>
    useTwoStageHandlers({ playerStats, campaignName: CAMPAIGN, cfClearPending, getPending, setPopupHtml })
  )
  return { result, playerStats, cfClearPending, setPopupHtml }
}

// Paid-rig twin: same lane with a pending stamped slotConsumed (the money-state
// flag createConfirmHandler's pay seam produces) — the skip refund must survive.
function renderEAPaid() {
  const playerStats = { name: CASTER, class: { name: 'Druid' }, level: 20, spellAbilities: { saveDc: 17, spell_slots_level_2: 4 } }
  let cleared = false
  const cfClearPending = vi.fn(() => { cleared = true })
  const getPending = (type) => (type === 'enhanceAbility' && !cleared ? { ...makePending(), slotConsumed: true } : null)
  const setPopupHtml = vi.fn()
  const { result } = renderHook(() =>
    useTwoStageHandlers({ playerStats, campaignName: CAMPAIGN, cfClearPending, getPending, setPopupHtml })
  )
  return { result, playerStats, cfClearPending, setPopupHtml }
}

// Confirm normalizes its modal result into targetNames (array | {targetName} | bare
// string) and always calls applyEnhanceAbilityEffect with ONE object argument —
// never positional args (SP-039/CLA-113).
const confirmCases = [
  { name: 'array confirm result', ability: 'CHA', confirmResult: [TARGET], targetNames: [TARGET] },
  { name: 'object confirm result', ability: 'STR', confirmResult: { targetName: 'HexWarlock' }, targetNames: ['HexWarlock'] },
  { name: 'bare-string confirm result', ability: 'DEX', confirmResult: 'HexWarlock', targetNames: ['HexWarlock'] },
]

describe('handleEnhanceAbilityConfirm — object call-shape into applyEnhanceAbilityEffect', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  for (const testCase of confirmCases) {
    it(`normalizes ${testCase.name} and applies once with a signature-shaped object`, async () => {
      const { result, playerStats, cfClearPending } = renderEA()

      await act(async () => {
        result.current.handleEnhanceAbilityAbilitySelect(testCase.ability)
      })
      await act(async () => {
        await result.current.handleEnhanceAbilityConfirm(testCase.confirmResult)
      })

      expect(applyEnhanceAbilityEffect).toHaveBeenCalledTimes(1)
      expect(applyEnhanceAbilityEffect.mock.calls[0].length).toBe(1)
      const arg = applyEnhanceAbilityEffect.mock.calls[0][0]
      expect(typeof arg).toBe('object')
      expect(arg.targetNames).toEqual(testCase.targetNames)
      expect(arg.ability).toBe(testCase.ability)
      expect(arg.playerStats).toBe(playerStats)
      expect(arg.campaignName).toBe(CAMPAIGN)
      expect(arg.action.name).toBe('Enhance Ability')
      expect(arg.action.spell).toBe(eaSpell)
      expect(arg.action.automation).toEqual({ type: 'enhance_ability', range: 'Touch' })

      expect(cfClearPending).toHaveBeenCalledWith('enhanceAbility')
      expect(result.current.enhanceAbilityStage).toBeNull()
      expect(result.current.enhanceAbilitySelectedAbility).toBeNull()
      expect(rollbackSpellSlot).not.toHaveBeenCalled()
    })
  }

  it('surfaces the apply result popup via setPopupHtml', async () => {
    const { result, setPopupHtml } = renderEA()
    const popup = { type: 'popup', payload: { type: 'automation_info', name: 'Enhance Ability' } }
    applyEnhanceAbilityEffect.mockResolvedValueOnce(popup)

    await act(async () => {
      result.current.handleEnhanceAbilityAbilitySelect('WIS')
    })
    await act(async () => {
      await result.current.handleEnhanceAbilityConfirm([TARGET])
    })

    expect(setPopupHtml).toHaveBeenCalledWith(popup.payload)
  })

  it('confirms without a selected ability are guarded — nothing applied, stage stays parked', async () => {
    const { result, cfClearPending } = renderEA()

    await act(async () => {
      await result.current.handleEnhanceAbilityConfirm([TARGET])
    })

    expect(applyEnhanceAbilityEffect).not.toHaveBeenCalled()
    expect(cfClearPending).not.toHaveBeenCalled()
    expect(rollbackSpellSlot).not.toHaveBeenCalled()
    expect(result.current.enhanceAbilityStage).toBe('ability')
  })

  it('skip on an UNPAID pending dismisses with zero writes — clears pending, no rollback (2026-11-15 pay-state gate)', () => {
    // The old pin title read "rolls back the unspent slot" — that WAS the bug
    // (bug-revivify-chooser-skip-rollback-inflates-unspent-slot): the gate arms
    // this pending unpaid, so the unconditional rollback credited lv2 above max.
    const { result, cfClearPending } = renderEA()

    act(() => {
      result.current.handleEnhanceAbilitySkip()
    })

    expect(rollbackSpellSlot).not.toHaveBeenCalled()
    expect(cfClearPending).toHaveBeenCalledWith('enhanceAbility')
    expect(applyEnhanceAbilityEffect).not.toHaveBeenCalled()
    expect(result.current.enhanceAbilityStage).toBeNull()
  })

  it('skip on a PAID pending keeps the byte-identical lv2 rollback', () => {
    // laneScope for genuinely paid pendings: the refund pair survives behind the
    // slotConsumed stamp (pinned producer: useConfirmableFlow pay seam).
    const { result, playerStats, cfClearPending } = renderEAPaid()

    act(() => {
      result.current.handleEnhanceAbilitySkip()
    })

    expect(rollbackSpellSlot).toHaveBeenCalledWith(CASTER, 'Enhance Ability', 2, playerStats, CAMPAIGN)
    expect(cfClearPending).toHaveBeenCalledWith('enhanceAbility')
    expect(applyEnhanceAbilityEffect).not.toHaveBeenCalled()
    expect(result.current.enhanceAbilityStage).toBeNull()
  })
})

// ─── Slot-owe fix (bug-enhance-ability-stone-skin-confirms-never-pay, owner ruling
// 2026-11-15): the EA confirm previously consumed NOTHING — a lv2 concentration
// spell castable unbounded per rest. Payment now rides the canonical seam at the
// FINAL confirm only, mirroring the SP-093 PFEG leg (same options shape, CLA-312
// effective-level free-cast gate) + createConfirmHandler's pending.slotConsumed
// stamp. Numeric slot bytes (correct key / −1 / repeat / floor) run against the
// REAL prepareSpellCast in ./useTwoStageHandlers.enhanceAbility.pay.test.js.

// Rig with a STABLE pending object so the slotConsumed stamp is observable.
function renderEACaptured(spell = eaSpell) {
  const playerStats = { name: CASTER, class: { name: 'Druid' }, level: 20, spellAbilities: { saveDc: 17, spell_slots_level_2: 4 } }
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
  return { result, playerStats, pending, cfClearPending }
}

describe('handleEnhanceAbilityConfirm — pay-at-final-confirm canonical seam (2026-11-15 slot-owe fix)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('pays EXACTLY ONE cast via prepareSpellCast with the PFEG/createConfirmHandler options shape, stamps slotConsumed, adds no accompanying row', async () => {
    const { result, playerStats, pending } = renderEACaptured()

    await act(async () => {
      result.current.handleEnhanceAbilityAbilitySelect('CHA')
    })
    await act(async () => {
      await result.current.handleEnhanceAbilityConfirm([TARGET])
    })

    // CLA-312: authorization consulted at the EFFECTIVE level — never hardcoded around.
    expect(isFreeCastAuthorized).toHaveBeenCalledTimes(1)
    expect(isFreeCastAuthorized).toHaveBeenCalledWith(CASTER, 'Enhance Ability', 2, playerStats, CAMPAIGN)
    expect(prepareSpellCast).toHaveBeenCalledTimes(1)
    expect(prepareSpellCast).toHaveBeenCalledWith(eaSpell, {}, {
      playerName: CASTER,
      playerStats,
      campaignName: CAMPAIGN,
      isUpcast: false,
      upcastLevel: undefined,
      freeCastAuthorized: false,
    })

    // Money-flag law (73bc0c5e7): the paid stamp lands on the confirmed pending.
    expect(pending.slotConsumed).toBe(true)

    // Ordering + byte-identity: cast row → pay → apply (PFEG precedent ordering);
    // EA adds NO ability_use twin (PFEG leg and createConfirmHandler log none).
    expect(addEntry).toHaveBeenCalledTimes(1)
    expect(addEntry).toHaveBeenCalledWith(CAMPAIGN, {
      type: 'spell',
      characterName: CASTER,
      targetName: TARGET,
      targets: [TARGET],
      spellName: 'Enhance Ability',
      spellLevel: 2,
      castingTime: '1 action',
      timestamp: expect.any(Number),
    })
    expect(addEntry.mock.invocationCallOrder[0]).toBeLessThan(prepareSpellCast.mock.invocationCallOrder[0])
    expect(prepareSpellCast.mock.invocationCallOrder[0]).toBeLessThan(applyEnhanceAbilityEffect.mock.invocationCallOrder[0])
    expect(applyEnhanceAbilityEffect).toHaveBeenCalledTimes(1)
  })

  it('the ABILITY-select stage pays nothing — payment is confirm-only (criterion 1)', async () => {
    const { result, pending } = renderEACaptured()

    await act(async () => {
      result.current.handleEnhanceAbilityAbilitySelect('STR')
    })

    expect(prepareSpellCast).not.toHaveBeenCalled()
    expect(isFreeCastAuthorized).not.toHaveBeenCalled()
    expect(addEntry).not.toHaveBeenCalled()
    expect(applyEnhanceAbilityEffect).not.toHaveBeenCalled()
    expect(pending.slotConsumed).toBeUndefined()
  })

  it('skip BEFORE confirm stays the zero-write unpaid dismiss (73bc0c5e7 survives the pay fix)', () => {
    const { result, cfClearPending, pending } = renderEACaptured()

    act(() => {
      result.current.handleEnhanceAbilitySkip()
    })

    expect(prepareSpellCast).not.toHaveBeenCalled()
    expect(addEntry).not.toHaveBeenCalled()
    expect(rollbackSpellSlot).not.toHaveBeenCalled()
    expect(pending.slotConsumed).toBeUndefined()
    expect(cfClearPending).toHaveBeenCalledWith('enhanceAbility')
  })

  const levelCases = [
    {
      name: 'upcast pays the upcast level and gates authorization at the EFFECTIVE level (CLA-312/CLA-086)',
      spell: { ...eaSpell, upcastLevel: 3 },
      gateLevel: 3,
      options: { isUpcast: true, upcastLevel: 3, freeCastAuthorized: false },
    },
    {
      name: 'an upcastLevel equal to the spell level is not an upcast',
      spell: { ...eaSpell, upcastLevel: 2 },
      gateLevel: 2,
      options: { isUpcast: false, upcastLevel: 2, freeCastAuthorized: false },
    },
  ]
  for (const testCase of levelCases) {
    it(testCase.name, async () => {
      const { result, playerStats } = renderEACaptured(testCase.spell)

      await act(async () => {
        result.current.handleEnhanceAbilityAbilitySelect('DEX')
      })
      await act(async () => {
        await result.current.handleEnhanceAbilityConfirm([TARGET])
      })

      expect(isFreeCastAuthorized).toHaveBeenCalledWith(CASTER, 'Enhance Ability', testCase.gateLevel, playerStats, CAMPAIGN)
      expect(prepareSpellCast).toHaveBeenCalledWith(testCase.spell, {}, {
        playerName: CASTER,
        playerStats,
        campaignName: CAMPAIGN,
        ...testCase.options,
      })
    })
  }

  it('a genuine free-cast authorization is honored (threaded true, not hardcoded around)', async () => {
    isFreeCastAuthorized.mockReturnValueOnce(true)
    const { result, playerStats } = renderEACaptured()

    await act(async () => {
      result.current.handleEnhanceAbilityAbilitySelect('WIS')
    })
    await act(async () => {
      await result.current.handleEnhanceAbilityConfirm([TARGET])
    })

    expect(prepareSpellCast).toHaveBeenCalledWith(eaSpell, {}, {
      playerName: CASTER,
      playerStats,
      campaignName: CAMPAIGN,
      isUpcast: false,
      upcastLevel: undefined,
      freeCastAuthorized: true,
    })
  })

  it('a cantrip-level pending pays nothing but still applies (PFEG cantrip mirror)', async () => {
    const { result } = renderEACaptured({ ...eaSpell, level: 0, spellLevel: 0 })

    await act(async () => {
      result.current.handleEnhanceAbilityAbilitySelect('INT')
    })
    await act(async () => {
      await result.current.handleEnhanceAbilityConfirm([TARGET])
    })

    expect(prepareSpellCast).not.toHaveBeenCalled()
    expect(isFreeCastAuthorized).not.toHaveBeenCalled()
    expect(applyEnhanceAbilityEffect).toHaveBeenCalledTimes(1)
  })

  it('confirm without pending is a pure no-op — zero pay, zero log, zero apply (criterion 4)', async () => {
    const playerStats = { name: CASTER, class: { name: 'Druid' }, level: 20 }
    const cfClearPending = vi.fn()
    const { result } = renderHook(() =>
      useTwoStageHandlers({ playerStats, campaignName: CAMPAIGN, cfClearPending, getPending: () => null, setPopupHtml: vi.fn() })
    )

    await act(async () => {
      await result.current.handleEnhanceAbilityConfirm([TARGET])
    })

    expect(prepareSpellCast).not.toHaveBeenCalled()
    expect(addEntry).not.toHaveBeenCalled()
    expect(applyEnhanceAbilityEffect).not.toHaveBeenCalled()
    expect(cfClearPending).not.toHaveBeenCalled()
  })

  it('a zero-slot cast answers like the PFEG/createConfirmHandler precedent — no invented refusal, lane bytes unchanged (numeric zero-write proof: consumeBaseSlot/consumeUpcastSlot floor, pinned numerically in the .pay real-rig)', async () => {
    prepareSpellCast.mockResolvedValueOnce({ slotConsumed: false, freeCastUsed: false, modifiedSpell: {}, metaCtx: {} })
    const { result, pending } = renderEACaptured()

    await act(async () => {
      result.current.handleEnhanceAbilityAbilitySelect('CON')
    })
    await act(async () => {
      await result.current.handleEnhanceAbilityConfirm([TARGET])
    })

    // Precedent verdict: the out-of-resources refusal face lives in SpellDetailPopup
    // canCast ("No spell slots available for this level.") at CAST time; the confirm
    // lanes never branch on slotResult — the seam wrote zero slot bytes on its own.
    expect(prepareSpellCast).toHaveBeenCalledTimes(1)
    expect(addEntry).toHaveBeenCalledTimes(1)
    expect(applyEnhanceAbilityEffect).toHaveBeenCalledTimes(1)
    expect(pending.slotConsumed).toBe(true) // canonical unconditional stamp (createConfirmHandler twin)
  })
})
