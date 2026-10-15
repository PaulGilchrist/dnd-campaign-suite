// @maintained-by-ai: 2026-10-15
// Enhance Ability handler internals for useTwoStageHandlers (per-handler owner —
// flow orchestration / stage-machine seam lives in ../useSpellMetamagicFlow.gate-two-stage.test.js).
// Pins the SP-039/CLA-113 call shape: handleEnhanceAbilityConfirm passes a SINGLE object
// keyed to enhanceAbilityHandler.applyEnhanceAbility({action, playerStats, campaignName,
// targetNames, ability}) — the old positional call sent targetNames/ability as undefined,
// the handler silently returned null and the targetEffect was never stamped.
// Also owns: confirm target normalization, ability-guard parking, skip slot rollback, popup pass-through.
import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useTwoStageHandlers } from './useTwoStageHandlers.js'
import { rollbackSpellSlot } from '../useConfirmableFlow.js'
import { applyEnhanceAbilityEffect } from '../../../services/automation/index.js'

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

  it('skip rolls back the unspent slot, clears pending, and never applies', () => {
    const { result, playerStats, cfClearPending } = renderEA()

    act(() => {
      result.current.handleEnhanceAbilitySkip()
    })

    expect(rollbackSpellSlot).toHaveBeenCalledWith(CASTER, 'Enhance Ability', 2, playerStats, CAMPAIGN)
    expect(cfClearPending).toHaveBeenCalledWith('enhanceAbility')
    expect(applyEnhanceAbilityEffect).not.toHaveBeenCalled()
    expect(result.current.enhanceAbilityStage).toBeNull()
  })
})
