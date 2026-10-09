// @improved-by-ai
// SP-039: handleEnhanceAbilityConfirm previously called applyEnhanceAbilityEffect
// with 6 POSITIONAL args against an object-destructure handler signature
// (enhanceAbilityHandler.applyEnhanceAbility({action, playerStats, campaignName,
// targetNames, ability})) → targetNames/ability undefined → silent null, te never
// stamped. CLA-113 call-shape pin: the host MUST pass a single object keyed to the
// handler signature.
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

const eaSpell = {
  name: 'Enhance Ability',
  level: 2,
  concentration: true,
  casting_time: 'Action',
  range: 'Touch',
  automation: { type: 'enhance_ability', range: 'Touch' },
}

function makePending() {
  return {
    spell: eaSpell,
    spellName: 'Enhance Ability',
    spellLevel: 2,
    castingTime: 'Action',
    range: 'Touch',
    creatureTargets: [CASTER, 'HexWarlock'],
  }
}

function renderEA() {
  const playerStats = { name: CASTER, class: { name: 'Druid' }, level: 20, spellAbilities: { saveDc: 17, spell_slots_level_2: 4 } }
  let cleared = false
  const cfClearPending = vi.fn(() => { cleared = true })
  const getPending = (type) => (type === 'enhanceAbility' && !cleared ? makePending() : null)
  const { result } = renderHook(() =>
    useTwoStageHandlers({ playerStats: playerStats, campaignName: CAMPAIGN, cfClearPending: cfClearPending, getPending: getPending, setPopupHtml: vi.fn() })
  )
  return { result, playerStats, cfClearPending }
}

describe('SP-039 handleEnhanceAbilityConfirm — object call-shape into applyEnhanceAbilityEffect', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calls applyEnhanceAbilityEffect once with a single object matching the handler signature', async () => {
    const { result, playerStats, cfClearPending } = renderEA()

    await act(async () => {
      result.current.handleEnhanceAbilityAbilitySelect('CHA')
    })
    await act(async () => {
      await result.current.handleEnhanceAbilityConfirm([TARGET])
    })

    expect(applyEnhanceAbilityEffect).toHaveBeenCalledTimes(1)
    const arg = applyEnhanceAbilityEffect.mock.calls[0][0]
    expect(typeof arg).toBe('object')
    expect(applyEnhanceAbilityEffect.mock.calls[0].length).toBe(1)
    expect(arg.targetNames).toEqual([TARGET])
    expect(arg.ability).toBe('CHA')
    expect(arg.playerStats).toBe(playerStats)
    expect(arg.campaignName).toBe(CAMPAIGN)
    expect(arg.action.name).toBe('Enhance Ability')
    expect(arg.action.automation.type).toBe('enhance_ability')
    expect(cfClearPending).toHaveBeenCalledWith('enhanceAbility')
    expect(rollbackSpellSlot).not.toHaveBeenCalled()
  })

  it('normalizes a non-array confirm result into targetNames', async () => {
    const { result } = renderEA()

    await act(async () => {
      result.current.handleEnhanceAbilityAbilitySelect('STR')
    })
    await act(async () => {
      await result.current.handleEnhanceAbilityConfirm({ targetName: 'HexWarlock' })
    })

    expect(applyEnhanceAbilityEffect.mock.calls[0][0].targetNames).toEqual(['HexWarlock'])
    expect(applyEnhanceAbilityEffect.mock.calls[0][0].ability).toBe('STR')
  })

  it('does not apply when no ability was selected', async () => {
    const { result } = renderEA()

    await act(async () => {
      await result.current.handleEnhanceAbilityConfirm([TARGET])
    })

    expect(applyEnhanceAbilityEffect).not.toHaveBeenCalled()
  })

  it('skip rolls back the unspent slot and never applies', () => {
    const { result, cfClearPending } = renderEA()

    act(() => {
      result.current.handleEnhanceAbilitySkip()
    })

    expect(applyEnhanceAbilityEffect).not.toHaveBeenCalled()
    expect(rollbackSpellSlot).toHaveBeenCalled()
    expect(cfClearPending).toHaveBeenCalledWith('enhanceAbility')
    expect(result.current.enhanceAbilityStage).toBeNull()
  })
})
