// @maintained-by-ai 2026-11-26
// Enhance Ability handler internals for useTwoStageHandlers (per-handler owner).
// Owns: the SP-039/CLA-113 call shape — handleEnhanceAbilityConfirm passes a SINGLE
// object keyed to enhanceAbilityHandler.applyEnhanceAbility({action, playerStats,
// campaignName, targetNames, ability}); the old positional call sent
// targetNames/ability as undefined, the handler silently returned null and the
// targetEffect was never stamped. Also owns: confirm target normalization (array |
// {targetName} | bare string), the ability-guard park (guard runs BEFORE any
// clear/write and is non-destructive), the confirm pay seam's CALL SHAPE
// (prepareSpellCast options, CLA-312 effective-level gate, slotConsumed stamp,
// row→pay→apply ordering), the stage-internal PAID-skip refund, and popup
// pass-through.
// Deferred to stronger siblings: REAL-gate flow composition + armed-skip UNPAID
// zero-write dismissal census → ../useSpellMetamagicFlow.gate-two-stage.test.js;
// no-pending confirm/skip guards → useSpellMetamagicFlow.handler-guards.test.js;
// numeric slot bytes (correct key / −1 / repeat / floor) against the REAL
// prepareSpellCast → ./useTwoStageHandlers.enhanceAbility.pay.test.js.
// Dismissal is asserted OBSERVABLY (run2#1733: no cfClearPending prop-spy
// assertions): the rig wires the clear callback into getPending, so a handler that
// fails to clear pending lets the hook's arm effect re-arms the stage from null
// back to 'ability' — a stage that stays null after skip/confirm therefore PROVES
// the pending clear.
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

// ONE rig for the whole lane. The pending object is STABLE so the slotConsumed
// pay stamp is observable; `paid: true` pre-stamps the money flag the
// createConfirmHandler/consumeEnhanceAbilitySlot producers write (paid-skip
// refund twin). The clear callback drives getPending — see header for why that
// makes stage-null an observable pending-clear proof.
function renderEA({ spell = eaSpell, paid = false } = {}) {
  const playerStats = { name: CASTER, class: { name: 'Druid' }, level: 20, spellAbilities: { saveDc: 17, spell_slots_level_2: 4 } }
  const pending = {
    spell,
    spellName: spell.name,
    spellLevel: spell.level,
    castingTime: spell.casting_time,
    range: spell.range,
    creatureTargets: [CASTER, 'HexWarlock'],
  }
  if (paid) pending.slotConsumed = true
  let cleared = false
  const getPending = (type) => (type === 'enhanceAbility' && !cleared ? pending : null)
  const setPopupHtml = vi.fn()
  const { result } = renderHook(() =>
    useTwoStageHandlers({
      playerStats,
      campaignName: CAMPAIGN,
      cfClearPending: () => { cleared = true },
      getPending,
      setPopupHtml,
    })
  )
  return { result, playerStats, pending, setPopupHtml }
}

async function selectAndConfirm(result, ability, confirmResult) {
  await act(async () => {
    result.current.handleEnhanceAbilityAbilitySelect(ability)
  })
  await act(async () => {
    await result.current.handleEnhanceAbilityConfirm(confirmResult)
  })
}

// Confirm normalizes its modal result into targetNames and always calls
// applyEnhanceAbilityEffect with ONE object argument — never positional args
// (SP-039/CLA-113). toHaveBeenCalledWith asserts the FULL argument list, so a
// positional regression fails on arity as well as shape. The last row pins the
// no-target misfire honestly: `result?.targetName || result` wraps undefined into
// [undefined] and the lane still pays + applies — the same no-target defect shape
// as the filed Resistance bug (useTwoStageHandlers.js:78-79, targets=[[]]).
const confirmCases = [
  { name: 'array confirm result', ability: 'CHA', confirmResult: [TARGET], targetNames: [TARGET] },
  { name: 'object confirm result', ability: 'STR', confirmResult: { targetName: 'HexWarlock' }, targetNames: ['HexWarlock'] },
  { name: 'bare-string confirm result', ability: 'DEX', confirmResult: 'HexWarlock', targetNames: ['HexWarlock'] },
  { name: 'undefined confirm result (no-target misfire — [undefined] twin of the filed useTwoStageHandlers.js:78-79 defect)', ability: 'CON', confirmResult: undefined, targetNames: [undefined] },
]

describe('handleEnhanceAbilityConfirm — single-object call shape into applyEnhanceAbilityEffect (SP-039/CLA-113)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  for (const testCase of confirmCases) {
    it(`normalizes ${testCase.name} and applies once with a signature-shaped object`, async () => {
      const { result, playerStats, setPopupHtml } = renderEA()

      await selectAndConfirm(result, testCase.ability, testCase.confirmResult)

      expect(applyEnhanceAbilityEffect).toHaveBeenCalledTimes(1)
      expect(applyEnhanceAbilityEffect).toHaveBeenCalledWith({
        action: { name: 'Enhance Ability', spell: eaSpell, automation: { type: 'enhance_ability', range: 'Touch' } },
        playerStats,
        campaignName: CAMPAIGN,
        targetNames: testCase.targetNames,
        ability: testCase.ability,
      })

      // Observable dismissal: the arm effect could not leave the stage null while
      // pending still answers getPending — null + no re-arms ⇒ pending was cleared.
      expect(result.current.enhanceAbilityStage).toBeNull()
      expect(result.current.enhanceAbilitySelectedAbility).toBeNull()
      // A null apply result (default mock) pops nothing.
      expect(setPopupHtml).not.toHaveBeenCalled()
      // Confirm never refunds (the pay seam spends).
      expect(rollbackSpellSlot).not.toHaveBeenCalled()
    })
  }

  it('surfaces a non-null apply result via setPopupHtml(popup.payload)', async () => {
    const { result, setPopupHtml } = renderEA()
    const popup = { type: 'popup', payload: { type: 'automation_info', name: 'Enhance Ability' } }
    applyEnhanceAbilityEffect.mockResolvedValueOnce(popup)

    await selectAndConfirm(result, 'WIS', [TARGET])

    expect(setPopupHtml).toHaveBeenCalledWith(popup.payload)
  })

  it('a confirm with no ability selected is guarded zero-write, parks the stage, and stays recoverable', async () => {
    const { result } = renderEA()

    await act(async () => {
      await result.current.handleEnhanceAbilityConfirm([TARGET])
    })

    expect(applyEnhanceAbilityEffect).not.toHaveBeenCalled()
    expect(addEntry).not.toHaveBeenCalled()
    expect(prepareSpellCast).not.toHaveBeenCalled()
    expect(rollbackSpellSlot).not.toHaveBeenCalled()
    // Parked at 'ability': the guard returned before any clear.
    expect(result.current.enhanceAbilityStage).toBe('ability')
    expect(result.current.enhanceAbilitySelectedAbility).toBeNull()

    // Non-destructive: selecting the ability then confirming still completes once.
    await selectAndConfirm(result, 'CHA', [TARGET])
    expect(applyEnhanceAbilityEffect).toHaveBeenCalledTimes(1)
    expect(result.current.enhanceAbilityStage).toBeNull()
  })

  it('skip on a PAID pending keeps the byte-identical lv2 refund — rollback-only, no cast row', () => {
    // laneScope for genuinely paid pendings: the refund survives behind the
    // slotConsumed stamp (pinned producer: the pay seam). EA's paid skip branch
    // rolls back WITHOUT a log row (unlike the Resistance/PFEG skip lanes).
    // The UNPAID zero-write dismiss census is gate-owned:
    // gate-two-stage.test.js (real gate, real rollbackSpellSlot observed via
    // setRuntimeValue) + enhanceAbility.pay.test.js (real slot math).
    const { result, playerStats } = renderEA({ paid: true })

    act(() => {
      result.current.handleEnhanceAbilitySkip()
    })

    expect(rollbackSpellSlot).toHaveBeenCalledWith(CASTER, 'Enhance Ability', 2, playerStats, CAMPAIGN)
    expect(addEntry).not.toHaveBeenCalled()
    expect(applyEnhanceAbilityEffect).not.toHaveBeenCalled()
    // Observable dismissal without the prop spy: an uncleared skip would let the
    // arm effect re-arms the stage to 'ability'.
    expect(result.current.enhanceAbilityStage).toBeNull()
    expect(result.current.enhanceAbilitySelectedAbility).toBeNull()
  })
})

// Slot-owe fix (bug-enhance-ability-stone-skin-confirms-never-pay, owner ruling
// 2026-11-15): the EA confirm previously consumed NOTHING — a lv2 concentration
// spell castable unbounded per rest. Payment now rides the canonical seam at the
// FINAL confirm only, mirroring the SP-093 PFEG leg (same options shape, CLA-312
// effective-level free-cast gate) + createConfirmHandler's pending.slotConsumed
// stamp. This file owns the mocked-seam CALL SHAPE + ordering; numeric slot byte
// legality (correct key / −1 / repeat / floor, zero-slot no-write) is pinned
// against the REAL prepareSpellCast in ./useTwoStageHandlers.enhanceAbility.pay.test.js.
describe('handleEnhanceAbilityConfirm — pay-at-final-confirm canonical seam (2026-11-15 slot-owe fix)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('pays EXACTLY ONE cast via prepareSpellCast with the PFEG/createConfirmHandler options shape, stamps slotConsumed, adds no accompanying row', async () => {
    const { result, playerStats, pending } = renderEA()

    await selectAndConfirm(result, 'CHA', [TARGET])

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
  })

  it('the ABILITY-select stage pays nothing — payment is confirm-only (criterion 1)', async () => {
    const { result, pending } = renderEA()

    await act(async () => {
      result.current.handleEnhanceAbilityAbilitySelect('STR')
    })

    expect(prepareSpellCast).not.toHaveBeenCalled()
    expect(isFreeCastAuthorized).not.toHaveBeenCalled()
    expect(addEntry).not.toHaveBeenCalled()
    expect(applyEnhanceAbilityEffect).not.toHaveBeenCalled()
    expect(pending.slotConsumed).toBeUndefined()
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
      const { result, playerStats } = renderEA({ spell: testCase.spell })

      await selectAndConfirm(result, 'DEX', [TARGET])

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
    const { result, playerStats } = renderEA()

    await selectAndConfirm(result, 'WIS', [TARGET])

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
    const { result } = renderEA({ spell: { ...eaSpell, level: 0 } })

    await selectAndConfirm(result, 'INT', [TARGET])

    expect(prepareSpellCast).not.toHaveBeenCalled()
    expect(isFreeCastAuthorized).not.toHaveBeenCalled()
    expect(applyEnhanceAbilityEffect).toHaveBeenCalledTimes(1)
  })
})
