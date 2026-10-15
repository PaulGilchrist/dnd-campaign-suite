// @maintained-by-ai: 2026-10-15
// Two-stage flow-orchestration seam for useSpellMetamagicFlow.
// Owns: gateMetamagic → stage-machine entry, select→advance→confirm→clear+log,
// and skip semantics for the three two-stage handlers (Enhance Ability:
// ability→target; Protection from Energy / Resistance: target→type).
// Per-handler internals (payloads, SP-093 slot pay-at-confirm, popup shape)
// live in useTwoStageHandlers.* tests. Gate routing → gate.test.js; Sorcerer
// payment → gate-sorcerer; material gate → gate-material.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSpellMetamagicFlow } from './useSpellMetamagicFlow.js';
import { addEntry } from '../../services/ui/logService.js';

// ── Mocks (module-graph boilerplate shared by the lane; keep complete for
// every named import the flow's handler factories evaluate) ─────────────────

vi.mock('./useMetamagic.js', () => ({
  getCurrentSorceryPoints: vi.fn(() => 5),
  getMaxSorceryPoints: vi.fn(() => 10),
  spendSorceryPoints: vi.fn(),
  logMetamagicUse: vi.fn(),
}));

vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../services/npcs/monsterUtils.js', () => ({
  getMonsterData: vi.fn(() => Promise.resolve({ type: 'beast' })),
}));

vi.mock('../../services/rules/spells/postCastRiderService.js', () => ({
  getMultiTargetSpreadForSpell: vi.fn(() => null),
}));

vi.mock('../../services/encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(() => ({
    creatures: [
      { name: 'Goblin A' },
      { name: 'Goblin B' },
      { name: 'Goblin C' },
    ],
  })),
}));

vi.mock('../../services/rules/spells/metamagicRules.js', () => ({
  isPsionicSpell: vi.fn(() => false),
  hasPsionicSorcery: vi.fn(() => false),
}));

vi.mock('../../services/automation/index.js', () => ({
  applyAidEffect: vi.fn(),
  applyHeroesFeastEffect: vi.fn(),
  applyLesserRestorationEffect: vi.fn(),
  applyMageArmorEffect: vi.fn(),
  applyShieldOfFaithEffect: vi.fn(),
  applyProtectionFromEnergyHandler: vi.fn(() => Promise.resolve(null)),
  applyProtectionFromPoisonHandler: vi.fn(),
  applyResistanceEffect: vi.fn(() => Promise.resolve(null)),
  executeHandler: vi.fn(),
  confirmGreaterRestoration: vi.fn(),
  applyHolyAuraEffect: vi.fn(),
  applyBaneEffect: vi.fn(),
  applyBlessEffect: vi.fn(),
  applyFaerieFire: vi.fn(() => Promise.resolve(null)),
  applyHaste: vi.fn(),
  applyEnhanceAbilityEffect: vi.fn(() => Promise.resolve(null)),
  applyBarkskinEffect: vi.fn(),
  applyInvisibility: vi.fn(),
  applyGreaterInvisibility: vi.fn(),
  applyFeignDeath: vi.fn(() => Promise.resolve(null)),
  applyLongstriderEffect: vi.fn(() => Promise.resolve(null)),
  applySpareTheDyingEffect: vi.fn(() => Promise.resolve(null)),
  applyPassWithoutTraceEffect: vi.fn(() => Promise.resolve(null)),
  applyBeaconOfHopeEffect: vi.fn(() => Promise.resolve(null)),
  applyAuraOfLifeEffect: vi.fn(),
  applyAuraOfPurityEffect: vi.fn(),
  applyCircleOfPowerEffect: vi.fn(() => Promise.resolve(null)),
  applyCompulsionEffect: vi.fn(() => Promise.resolve(null)),
  applyAuraOfVitalityEffect: vi.fn(() => Promise.resolve(null)),
  applyDeathWardEffect: vi.fn(() => Promise.resolve(null)),
  applyHeroism: vi.fn(() => Promise.resolve(null)),
  applyProtectionFromEvilAndGood: vi.fn(),
  applyStoneSkinHandler: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('../../services/rules/features/greaterRestorationService.js', () => ({
  confirmGreaterRestoration: vi.fn(),
}));

vi.mock('../../services/rules/features/removeCurseService.js', () => ({
  confirmRemoveCurse: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('../../services/rules/features/regenerateService.js', () => ({
  confirmRegenerate: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('../../services/rules/features/foresightService.js', () => ({
  triggerForesight: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('../../services/rules/features/holdMonsterService.js', () => ({
  triggerHoldMonster: vi.fn(),
}));

vi.mock('../../services/rules/features/charmPersonService.js', () => ({
  triggerCharmPerson: vi.fn(),
}));

vi.mock('../../services/rules/features/charmMonsterService.js', () => ({
  triggerCharmMonster: vi.fn(),
}));

vi.mock('../../services/rules/features/banishmentService.js', () => ({
  triggerBanishment: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('../../services/rules/features/faerieFireService.js', () => ({
  triggerFaerieFire: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('../../services/rules/features/healService.js', () => ({
  triggerHeal: vi.fn(),
}));

vi.mock('../../services/rules/features/healingWordService.js', () => ({
  triggerHealingWord: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('../../services/rules/features/revivifyService.js', () => ({
  triggerRevivify: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('../../services/automation/handlers/spells/polymorphService.js', () => ({
  applyPolymorph: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('../../services/automation/handlers/spells/animalShapesService.js', () => ({
  applyAnimalShapes: vi.fn(() => Promise.resolve({ ok: false })),
}));

vi.mock('../../services/automation/handlers/spells/truePolymorphService.js', () => ({
  applyTruePolymorph: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('../../services/rules/spells/materialComponents.js', () => ({
  getConsumedMaterial: vi.fn(() => null),
  hasMaterial: vi.fn(() => true),
  consumeMaterial: vi.fn(() => Promise.resolve(true)),
  getMaterialRequirementMessage: vi.fn(() => null),
}));

vi.mock('../../services/rules/spells/spellPreparationService.js', () => ({
  prepareSpellCast: vi.fn(() => Promise.resolve({ modifiedSpell: {}, metaCtx: {} })),
  isFreeCastAuthorized: vi.fn(() => false),
  isWizardRitualAdeptSpell: vi.fn(() => false),
  incrementFreeCastResource: vi.fn(),
}));

vi.mock('../runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => 3),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../useAllySelection.js', () => ({
  getAllyList: vi.fn((casterName) => [casterName.toLowerCase()]),
}));

global.fetch = vi.fn((url) => {
  if (url && url.includes('combat-summary')) {
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ creatures: [] }),
    });
  }
  return Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve({}),
    text: () => Promise.resolve(''),
  });
});

Object.defineProperty(window, 'dispatchEvent', {
  value: vi.fn(),
  writable: true,
});

// ── Fixtures & helper ─────────────────────────────────────────────────────────

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestSorcerer',
    class: { name: 'Sorcerer' },
    level: 5,
    ...overrides,
  };
}

// Renders the hook and gates a spell, returning the hook result.
function renderWithSpell(spellName, spellLevel) {
  const { result } = renderHook(() =>
    useSpellMetamagicFlow({
      playerStats: makePlayerStats(),
      campaignName: 'test-campaign',
      onExecute: vi.fn(),
      setSecondaryTargetModal: null,
      characters: [],
      setPopupHtml: vi.fn(),
    })
  );
  act(() => {
    result.current.gateMetamagic({
      name: spellName,
      level: spellLevel,
      casting_time: '1 Action',
      range: '150 ft.',
    });
  });
  return result;
}

// The three two-stage lanes share one orchestration shape: gate opens the
// stage machine at firstStage, a mid select advances to secondStage, and the
// confirm clears stage + pending and logs the cast cast. Levels/spell names
// mirror public/data/spells.json (Enhance Ability lv2, Protection From Energy
// lv3, Resistance cantrip).
const twoStageFlows = [
  {
    spell: 'Enhance Ability',
    level: 2,
    pendingKey: 'pendingEnhanceAbility',
    stageKey: 'enhanceAbilityStage',
    firstStage: 'ability',
    secondStage: 'target',
    midSelect: 'handleEnhanceAbilityAbilitySelect',
    midSelectArg: 'Bear Might',
    confirm: 'handleEnhanceAbilityConfirm',
    confirmArg: { targetName: 'Goblin A' },
    target: 'Goblin A',
    skip: 'handleEnhanceAbilitySkip',
    skipLogs: false, // Enhance Ability skip rolls back the slot silently —
                    // unlike PfE/Resistance it emits no cast log
  },
  {
    spell: 'Protection from Energy',
    level: 3,
    pendingKey: 'pendingProtectionFromEnergy',
    stageKey: 'protectionFromEnergyStage',
    firstStage: 'target',
    secondStage: 'type',
    midSelect: 'handleProtectionFromEnergyTargetSelect',
    midSelectArg: 'Goblin B',
    confirm: 'handleProtectionFromEnergyTypeSelect',
    confirmArg: 'cold',
    target: 'Goblin B',
    skip: 'handleProtectionFromEnergySkip',
    skipLogs: true,
  },
  {
    spell: 'Resistance',
    level: 0,
    pendingKey: 'pendingResistance',
    stageKey: 'resistanceStage',
    firstStage: 'target',
    secondStage: 'type',
    midSelect: 'handleResistanceTargetSelect',
    midSelectArg: 'Goblin C',
    confirm: 'handleResistanceTypeSelect',
    confirmArg: 'fire',
    target: 'Goblin C',
    skip: 'handleResistanceSkip',
    skipLogs: true,
  },
];

describe('useSpellMetamagicFlow — two-stage gate flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  for (const flow of twoStageFlows) {
    it(`${flow.spell}: gate opens the stage machine at '${flow.firstStage}' with pending state`, () => {
      const result = renderWithSpell(flow.spell, flow.level);

      expect(result.current[flow.stageKey]).toBe(flow.firstStage);
      expect(result.current[flow.pendingKey]).not.toBeNull();
    });

    it(`${flow.spell}: ${flow.firstStage} → ${flow.secondStage} → confirm clears state and logs the cast`, async () => {
      const result = renderWithSpell(flow.spell, flow.level);

      act(() => {
        result.current[flow.midSelect](flow.midSelectArg);
      });
      expect(result.current[flow.stageKey]).toBe(flow.secondStage);

      await act(async () => {
        await result.current[flow.confirm](flow.confirmArg);
      });

      expect(result.current[flow.stageKey]).toBeNull();
      expect(result.current[flow.pendingKey]).toBeNull();
      expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
        type: 'spell',
        characterName: 'TestSorcerer',
        spellName: flow.spell,
        targetName: flow.target,
      }));
    });

    it(`${flow.spell}: skip clears stage and pending${flow.skipLogs ? ' and logs' : ' without a cast log'}`, () => {
      const result = renderWithSpell(flow.spell, flow.level);

      act(() => {
        result.current[flow.skip]();
      });

      expect(result.current[flow.stageKey]).toBeNull();
      expect(result.current[flow.pendingKey]).toBeNull();
      if (flow.skipLogs) {
        expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
          type: 'spell',
          spellName: flow.spell,
        }));
      } else {
        expect(addEntry).not.toHaveBeenCalled();
      }
    });
  }

  it('skip without pending state is a no-op for every two-stage handler', () => {
    const { result } = renderHook(() =>
      useSpellMetamagicFlow({
        playerStats: makePlayerStats(),
        campaignName: 'test-campaign',
        onExecute: vi.fn(),
        setSecondaryTargetModal: null,
        characters: [],
        setPopupHtml: vi.fn(),
      })
    );

    expect(result.current.enhanceAbilityStage).toBeNull();
    expect(result.current.protectionFromEnergyStage).toBeNull();
    expect(result.current.resistanceStage).toBeNull();

    act(() => {
      result.current.handleEnhanceAbilitySkip();
      result.current.handleProtectionFromEnergySkip();
      result.current.handleResistanceSkip();
    });

    expect(result.current.enhanceAbilityStage).toBeNull();
    expect(result.current.protectionFromEnergyStage).toBeNull();
    expect(result.current.resistanceStage).toBeNull();
    expect(addEntry).not.toHaveBeenCalled();
  });

  it('Protection from Energy guards type-select without a prior target selection', async () => {
    const result = renderWithSpell('Protection from Energy', 3);

    await act(async () => {
      await result.current.handleProtectionFromEnergyTypeSelect('fire');
    });

    // Guarded: stage machine stays parked at 'target' until a target is chosen
    expect(result.current.protectionFromEnergyStage).toBe('target');
    expect(result.current.pendingProtectionFromEnergy).not.toBeNull();
    expect(addEntry).not.toHaveBeenCalled();
  });

  it('Resistance has no target guard — type-select without a target proceeds and clears', async () => {
    const result = renderWithSpell('Resistance', 0);

    await act(async () => {
      await result.current.handleResistanceTypeSelect('lightning');
    });

    expect(result.current.resistanceStage).toBeNull();
    expect(result.current.pendingResistance).toBeNull();
  });
});
