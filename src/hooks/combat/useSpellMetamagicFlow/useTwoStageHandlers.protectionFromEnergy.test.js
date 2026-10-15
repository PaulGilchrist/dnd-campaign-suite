// @maintained-by-ai: 2026-10-15
// Protection from Energy lane internals for useTwoStageHandlers (per-handler owner —
// flow orchestration / stage-machine seam lives in ../useSpellMetamagicFlow.gate-two-stage.test.js;
// the apply-effect body itself lives in services/automation/handlers/buffs/protectionFromEnergyHandler.test.js).
// Pins the SP-093 contract: the slot is consumed by prepareSpellCast at TYPE-select confirm
// (exactly once, before applyProtectionFromEnergy) — target-select spends nothing and a skip
// never rolls back an unspent slot. CLA-312: free-cast authorization is gated on the EFFECTIVE
// cast level (upcast). Apply call is positional 5-arg: (action, playerStats, campaignName,
// targetName, chosenDamageType) per applyProtectionFromEnergy's signature.
// Data authority: public/data/2024/spells.json protection-from-energy — lv3 Abjuration,
// Action, Touch, concentration, damageTypes Acid/Cold/Fire/Lightning/Thunder.
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
  isWizardRitualAdeptSpell: vi.fn(() => false),
}))

const CAMPAIGN = 'test-campaign'
const CASTER = 'DivinationWizard'
const TARGET = 'HexWarlock'
const DAMAGE_TYPES = ['Acid', 'Cold', 'Fire', 'Lightning', 'Thunder']

function makeSpell(overrides = {}) {
  return {
    name: 'Protection from Energy',
    level: 3,
    concentration: true,
    casting_time: 'Action',
    range: 'Touch',
    automation: { type: 'protection_from_energy', damageTypes: DAMAGE_TYPES },
    ...overrides,
  }
}

function renderPfE(spell = makeSpell()) {
  const playerStats = { name: CASTER, class: { name: 'Wizard' }, level: 20, spellAbilities: { saveDc: 18, spell_slots_level_3: 3 } }
  let cleared = false
  const cfClearPending = vi.fn(() => { cleared = true })
  const getPending = (type) => (type === 'protectionFromEnergy' && !cleared ? {
    spell,
    spellName: spell.name,
    spellLevel: spell.level,
    castingTime: spell.casting_time,
    range: spell.range,
    creatureTargets: [CASTER, TARGET],
    damageTypes: DAMAGE_TYPES,
  } : null)
  const { result } = renderHook(() =>
    useTwoStageHandlers({ playerStats, campaignName: CAMPAIGN, cfClearPending, getPending, setPopupHtml: vi.fn() })
  )
  return { result, playerStats, cfClearPending }
}

async function selectTargetThenType(result, damageType) {
  await act(async () => {
    result.current.handleProtectionFromEnergyTargetSelect(TARGET)
  })
  expect(result.current.protectionFromEnergyStage).toBe('type')
  await act(async () => {
    await result.current.handleProtectionFromEnergyTypeSelect(damageType)
  })
}

// Type-select confirm table: slot consumption, CLA-312 gate level, upcast normalization,
// exact positional apply payload, and stage reset — one shared assertion body.
const castCases = [
  {
    name: 'base-level cast consumes a level-3 slot',
    spell: makeSpell(),
    damageType: 'Lightning',
    freeCastAuthorized: false,
    gateLevel: 3,
    slotOptions: { isUpcast: false, upcastLevel: undefined, freeCastAuthorized: false },
  },
  {
    name: 'upcast gates free-cast authorization on the upcast level (CLA-312)',
    spell: makeSpell({ upcastLevel: 5 }),
    damageType: 'Fire',
    freeCastAuthorized: false,
    gateLevel: 5,
    slotOptions: { isUpcast: true, upcastLevel: 5, freeCastAuthorized: false },
  },
  {
    name: 'an upcastLevel equal to the spell level is not an upcast',
    spell: makeSpell({ upcastLevel: 3 }),
    damageType: 'Cold',
    freeCastAuthorized: false,
    gateLevel: 3,
    slotOptions: { isUpcast: false, upcastLevel: 3, freeCastAuthorized: false },
  },
  {
    name: 'an authorized free cast is threaded through prepareSpellCast',
    spell: makeSpell(),
    damageType: 'Thunder',
    freeCastAuthorized: true,
    gateLevel: 3,
    slotOptions: { isUpcast: false, upcastLevel: undefined, freeCastAuthorized: true },
  },
]

describe('handleProtectionFromEnergyTypeSelect — SP-093 slot consumption at type-select confirm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  for (const testCase of castCases) {
    it(`${testCase.name} — prepares once before applying, exact 5-positional apply payload`, async () => {
      const { result, playerStats, cfClearPending } = renderPfE(testCase.spell)
      if (testCase.freeCastAuthorized) {
        isFreeCastAuthorized.mockReturnValueOnce(true)
      }

      await selectTargetThenType(result, testCase.damageType)

      expect(isFreeCastAuthorized).toHaveBeenCalledWith(CASTER, 'Protection from Energy', testCase.gateLevel, playerStats, CAMPAIGN)
      expect(prepareSpellCast).toHaveBeenCalledTimes(1)
      expect(prepareSpellCast).toHaveBeenCalledWith(testCase.spell, {}, {
        playerName: CASTER,
        playerStats,
        campaignName: CAMPAIGN,
        ...testCase.slotOptions,
      })
      expect(prepareSpellCast.mock.invocationCallOrder[0]).toBeLessThan(applyProtectionFromEnergyHandler.mock.invocationCallOrder[0])

      expect(applyProtectionFromEnergyHandler).toHaveBeenCalledTimes(1)
      expect(applyProtectionFromEnergyHandler.mock.calls[0].length).toBe(5)
      expect(applyProtectionFromEnergyHandler).toHaveBeenCalledWith(
        { name: 'Protection from Energy', spell: testCase.spell, automation: { type: 'protection_from_energy', damageTypes: DAMAGE_TYPES } },
        playerStats,
        CAMPAIGN,
        TARGET,
        testCase.damageType,
      )

      expect(cfClearPending).toHaveBeenCalledWith('protectionFromEnergy')
      expect(result.current.protectionFromEnergyStage).toBeNull()
      expect(result.current.protectionFromEnergySelectedTarget).toBeNull()
      expect(rollbackSpellSlot).not.toHaveBeenCalled()
    })
  }

  it('cantrip-level cast skips slot preparation but still applies the effect', async () => {
    const cantrip = makeSpell({ level: 0 })
    const { result } = renderPfE(cantrip)

    await selectTargetThenType(result, 'Acid')

    expect(prepareSpellCast).not.toHaveBeenCalled()
    expect(isFreeCastAuthorized).not.toHaveBeenCalled()
    expect(applyProtectionFromEnergyHandler).toHaveBeenCalledTimes(1)
    expect(applyProtectionFromEnergyHandler.mock.calls[0][0].spell).toBe(cantrip)
  })

  it('type select without a prior target selection spends nothing and stays parked on the target stage', async () => {
    const { result, cfClearPending } = renderPfE()
    expect(result.current.protectionFromEnergyStage).toBe('target')

    await act(async () => {
      await result.current.handleProtectionFromEnergyTypeSelect('Lightning')
    })

    expect(prepareSpellCast).not.toHaveBeenCalled()
    expect(applyProtectionFromEnergyHandler).not.toHaveBeenCalled()
    expect(cfClearPending).not.toHaveBeenCalled()
    expect(result.current.protectionFromEnergyStage).toBe('target')
  })
})

describe('handleProtectionFromEnergySkip — SP-093 no rollback of an unspent slot', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const skipCases = [
    { name: 'without any target selected', preSelect: false },
    { name: 'after target selection but before type confirm', preSelect: true },
  ]

  for (const testCase of skipCases) {
    it(`skipping ${testCase.name} never rolls back, never spends, and clears the lane`, async () => {
      const { result, cfClearPending } = renderPfE()
      if (testCase.preSelect) {
        await act(async () => {
          result.current.handleProtectionFromEnergyTargetSelect(TARGET)
        })
      }

      act(() => {
        result.current.handleProtectionFromEnergySkip()
      })

      expect(rollbackSpellSlot).not.toHaveBeenCalled()
      expect(prepareSpellCast).not.toHaveBeenCalled()
      expect(applyProtectionFromEnergyHandler).not.toHaveBeenCalled()
      expect(cfClearPending).toHaveBeenCalledWith('protectionFromEnergy')
      expect(result.current.protectionFromEnergyStage).toBeNull()
      expect(result.current.protectionFromEnergySelectedTarget).toBeNull()
    })
  }
})
