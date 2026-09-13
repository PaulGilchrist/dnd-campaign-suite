import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useTwoStageHandlers } from './useTwoStageHandlers.js'
import { rollbackSpellSlot } from '../useConfirmableFlow.js'
import { applyProtectionFromEnergyHandler } from '../../../services/automation/index.js'
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
}))

const CAMPAIGN = 'test-campaign'
const CASTER = 'DivinationWizard'
const TARGET = 'HexWarlock'

const pfSpell = {
  name: 'Protection from Energy',
  level: 3,
  concentration: true,
  casting_time: 'Action',
  range: 'Touch',
  automation: { type: 'protection_from_energy', damageTypes: ['Acid', 'Cold', 'Fire', 'Lightning', 'Thunder'] },
}

function makePending() {
  return {
    spell: pfSpell,
    spellName: 'Protection from Energy',
    spellLevel: 3,
    castingTime: 'Action',
    range: 'Touch',
    creatureTargets: [CASTER, TARGET],
    damageTypes: ['Acid', 'Cold', 'Fire', 'Lightning', 'Thunder'],
  }
}

function renderPfE() {
  const playerStats = { name: CASTER, class: { name: 'Wizard' }, level: 20, spellAbilities: { saveDc: 18, spell_slots_level_3: 3 } }
  let cleared = false
  const cfClearPending = vi.fn(() => { cleared = true })
  const getPending = (type) => (type === 'protectionFromEnergy' && !cleared ? makePending() : null)
  const { result } = renderHook(() =>
    useTwoStageHandlers({ playerStats: playerStats, campaignName: CAMPAIGN, cfClearPending: cfClearPending, getPending: getPending, setPopupHtml: vi.fn() })
  )
  return { result, playerStats, cfClearPending }
}

describe('SP-093 handleProtectionFromEnergyTypeSelect — slot consumption at type-select confirm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calls prepareSpellCast exactly once, before applying the effect', async () => {
    const { result, playerStats } = renderPfE()

    await act(async () => {
      result.current.handleProtectionFromEnergyTargetSelect(TARGET)
    })
    await act(async () => {
      await result.current.handleProtectionFromEnergyTypeSelect('Lightning')
    })

    expect(isFreeCastAuthorized).toHaveBeenCalledWith(CASTER, 'Protection from Energy', 3, playerStats, CAMPAIGN)
    expect(prepareSpellCast).toHaveBeenCalledTimes(1)
    expect(prepareSpellCast).toHaveBeenCalledWith(pfSpell, {}, {
      playerName: CASTER,
      playerStats,
      campaignName: CAMPAIGN,
      isUpcast: false,
      upcastLevel: undefined,
      freeCastAuthorized: false,
    })
    expect(prepareSpellCast.mock.invocationCallOrder[0]).toBeLessThan(applyProtectionFromEnergyHandler.mock.invocationCallOrder[0])
    expect(applyProtectionFromEnergyHandler).toHaveBeenCalledTimes(1)
    expect(applyProtectionFromEnergyHandler.mock.calls[0][3]).toBe(TARGET)
    expect(rollbackSpellSlot).not.toHaveBeenCalled()
  })

  it('does not consume a slot when type select runs without a prior target selection', async () => {
    const { result } = renderPfE()

    await act(async () => {
      await result.current.handleProtectionFromEnergyTypeSelect('Lightning')
    })

    expect(prepareSpellCast).not.toHaveBeenCalled()
    expect(applyProtectionFromEnergyHandler).not.toHaveBeenCalled()
  })
})

describe('SP-093 handleProtectionFromEnergySkip — no rollback of an unspent slot', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('never calls rollbackSpellSlot or prepareSpellCast on skip', () => {
    const { result, cfClearPending } = renderPfE()

    act(() => {
      result.current.handleProtectionFromEnergySkip()
    })

    expect(rollbackSpellSlot).not.toHaveBeenCalled()
    expect(prepareSpellCast).not.toHaveBeenCalled()
    expect(cfClearPending).toHaveBeenCalledWith('protectionFromEnergy')
    expect(result.current.protectionFromEnergyStage).toBeNull()
  })

  it('still does not roll back when skipping after a target was selected but before type confirm', async () => {
    const { result } = renderPfE()

    await act(async () => {
      result.current.handleProtectionFromEnergyTargetSelect(TARGET)
    })
    act(() => {
      result.current.handleProtectionFromEnergySkip()
    })

    expect(rollbackSpellSlot).not.toHaveBeenCalled()
    expect(prepareSpellCast).not.toHaveBeenCalled()
  })
})
