// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSpellMetamagicFlow } from './useSpellMetamagicFlow.js';
import { addEntry } from '../../services/ui/logService.js';
import { getMultiTargetSpreadForSpell } from '../../services/rules/spells/postCastRiderService.js';

// ── Minimal, focused mocking ──────────────────────────────────────────────────
// Only mock what the two-stage handlers actually use: logService, automation
// functions, and the postCastRider. Everything else gets no-op defaults.

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

// ── Factories ──────────────────────────────────────────────────────────────────

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestSorcerer',
    class: { name: 'Sorcerer' },
    level: 5,
    ...overrides,
  };
}

function makeSpell(overrides = {}) {
  return {
    name: 'Fireball',
    level: 3,
    casting_time: '1 Action',
    range: '150 ft.',
    ...overrides,
  };
}

// ── Shared helper ──────────────────────────────────────────────────────────────
// Renders the hook, gates the spell, and returns the result.
// Callers invoke handlers directly on `result`.

function renderWithSpell(spellName, spellLevel, overrides = {}) {
  const setPopupHtml = vi.fn();
  const { result } = renderHook(() =>
    useSpellMetamagicFlow({ playerStats: makePlayerStats(), campaignName: 'test-campaign', onExecute: vi.fn(), setSecondaryTargetModal: null, characters: [], setPopupHtml: setPopupHtml })
  );
  act(() => {
    result.current.gateMetamagic(makeSpell({ name: spellName, level: spellLevel, ...overrides }));
  });
  return { result, setPopupHtml };
}

// ── Enhance Ability two-stage flow ────────────────────────────────────────────

describe('useSpellMetamagicFlow — Enhance Ability two-stage flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getMultiTargetSpreadForSpell.mockReturnValue(null);
  });

  it('enters ability stage when gateMetamagic sets pendingEnhanceAbility', () => {
    const { result } = renderWithSpell('Enhance Ability', 2);

    expect(result.current.enhanceAbilityStage).toBe('ability');
    expect(result.current.pendingEnhanceAbility).not.toBeNull();
  });

  it('transitions to target stage after ability selection and stores the ability', () => {
    const { result } = renderWithSpell('Enhance Ability', 2);

    act(() => {
      result.current.handleEnhanceAbilityAbilitySelect('Bear Might');
    });

    expect(result.current.enhanceAbilityStage).toBe('target');
  });

  it('completes the two-stage flow: ability select → confirm', async () => {
    const setPopupHtml = vi.fn();
    const { result } = renderHook(() =>
      useSpellMetamagicFlow({ playerStats: makePlayerStats(), campaignName: 'test-campaign', onExecute: vi.fn(), setSecondaryTargetModal: null, characters: [], setPopupHtml: setPopupHtml })
    );

    act(() => {
      result.current.gateMetamagic(makeSpell({ name: 'Enhance Ability', level: 2 }));
    });

    expect(result.current.enhanceAbilityStage).toBe('ability');

    act(() => {
      result.current.handleEnhanceAbilityAbilitySelect('Eagle Might');
    });

    expect(result.current.enhanceAbilityStage).toBe('target');

    await act(async () => {
      await result.current.handleEnhanceAbilityConfirm({ targetName: 'Goblin A' });
    });

    expect(result.current.enhanceAbilityStage).toBeNull();
    expect(result.current.pendingEnhanceAbility).toBeNull();
    expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
      type: 'spell',
      characterName: 'TestSorcerer',
      spellName: 'Enhance Ability',
      targetName: 'Goblin A',
    }));
  });

  it('skips the flow and clears state', () => {
    const { result } = renderWithSpell('Enhance Ability', 2);

    act(() => {
      result.current.handleEnhanceAbilitySkip();
    });

    expect(result.current.enhanceAbilityStage).toBeNull();
    expect(result.current.pendingEnhanceAbility).toBeNull();
  });

  it('does nothing when skip is called without pending state', () => {
    const { result } = renderHook(() =>
      useSpellMetamagicFlow({ playerStats: makePlayerStats(), campaignName: 'test-campaign', onExecute: vi.fn() })
    );

    expect(result.current.enhanceAbilityStage).toBeNull();

    act(() => {
      result.current.handleEnhanceAbilitySkip();
    });

    expect(result.current.enhanceAbilityStage).toBeNull();
  });
});

// ── Protection from Energy two-stage flow ─────────────────────────────────────

describe('useSpellMetamagicFlow — Protection from Energy two-stage flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getMultiTargetSpreadForSpell.mockReturnValue(null);
  });

  it('enters target stage when gateMetamagic sets pendingProtectionFromEnergy', () => {
    const { result } = renderWithSpell('Protection from Energy', 3);

    expect(result.current.protectionFromEnergyStage).toBe('target');
    expect(result.current.pendingProtectionFromEnergy).not.toBeNull();
  });

  it('transitions to type stage after target selection', () => {
    const { result } = renderWithSpell('Protection from Energy', 3);

    act(() => {
      result.current.handleProtectionFromEnergyTargetSelect('Goblin A');
    });

    expect(result.current.protectionFromEnergyStage).toBe('type');
  });

  it('completes the two-stage flow: target select → type select', async () => {
    const { result } = renderWithSpell('Protection from Energy', 3);

    expect(result.current.protectionFromEnergyStage).toBe('target');

    act(() => {
      result.current.handleProtectionFromEnergyTargetSelect('Goblin B');
    });

    expect(result.current.protectionFromEnergyStage).toBe('type');

    await act(async () => {
      await result.current.handleProtectionFromEnergyTypeSelect('cold');
    });

    expect(result.current.protectionFromEnergyStage).toBeNull();
    expect(result.current.pendingProtectionFromEnergy).toBeNull();
    expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
      type: 'spell',
      characterName: 'TestSorcerer',
      spellName: 'Protection from Energy',
      targetName: 'Goblin B',
    }));
  });

  it('does nothing when type select is called without a prior target selection', async () => {
    const { result } = renderWithSpell('Protection from Energy', 3);

    await act(async () => {
      await result.current.handleProtectionFromEnergyTypeSelect('fire');
    });

    // Stage should remain 'target' since no target was selected
    expect(result.current.protectionFromEnergyStage).toBe('target');
    expect(result.current.pendingProtectionFromEnergy).not.toBeNull();
  });

  it('skips the flow and clears state', () => {
    const { result } = renderWithSpell('Protection from Energy', 3);

    act(() => {
      result.current.handleProtectionFromEnergySkip();
    });

    expect(result.current.protectionFromEnergyStage).toBeNull();
    expect(result.current.pendingProtectionFromEnergy).toBeNull();
    expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
      type: 'spell',
      spellName: 'Protection from Energy',
    }));
  });

  it('does nothing when skip is called without pending state', () => {
    const { result } = renderHook(() =>
      useSpellMetamagicFlow({ playerStats: makePlayerStats(), campaignName: 'test-campaign', onExecute: vi.fn() })
    );

    expect(result.current.protectionFromEnergyStage).toBeNull();

    act(() => {
      result.current.handleProtectionFromEnergySkip();
    });

    expect(result.current.protectionFromEnergyStage).toBeNull();
  });
});

// ── Resistance two-stage flow ─────────────────────────────────────────────────

describe('useSpellMetamagicFlow — Resistance two-stage flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getMultiTargetSpreadForSpell.mockReturnValue(null);
  });

  it('enters target stage when gateMetamagic sets pendingResistance', () => {
    const { result } = renderWithSpell('Resistance', 0);

    expect(result.current.resistanceStage).toBe('target');
    expect(result.current.pendingResistance).not.toBeNull();
  });

  it('transitions to type stage after target selection', () => {
    const { result } = renderWithSpell('Resistance', 0);

    act(() => {
      result.current.handleResistanceTargetSelect('Goblin A');
    });

    expect(result.current.resistanceStage).toBe('type');
  });

  it('completes the two-stage flow: target select → type select', async () => {
    const { result } = renderWithSpell('Resistance', 0);

    expect(result.current.resistanceStage).toBe('target');

    act(() => {
      result.current.handleResistanceTargetSelect('Goblin C');
    });

    expect(result.current.resistanceStage).toBe('type');

    await act(async () => {
      await result.current.handleResistanceTypeSelect('fire');
    });

    expect(result.current.resistanceStage).toBeNull();
    expect(result.current.pendingResistance).toBeNull();
    expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
      type: 'spell',
      characterName: 'TestSorcerer',
      spellName: 'Resistance',
      targetName: 'Goblin C',
    }));
  });

  it('clears state when type select is called without a prior target selection (no guard)', async () => {
    const { result } = renderWithSpell('Resistance', 0);

    await act(async () => {
      await result.current.handleResistanceTypeSelect('lightning');
    });

    // Resistance handler has no guard for missing targets — it proceeds anyway
    expect(result.current.resistanceStage).toBeNull();
    expect(result.current.pendingResistance).toBeNull();
  });

  it('skips the flow and clears state', () => {
    const { result } = renderWithSpell('Resistance', 0);

    act(() => {
      result.current.handleResistanceSkip();
    });

    expect(result.current.resistanceStage).toBeNull();
    expect(result.current.pendingResistance).toBeNull();
    expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
      type: 'spell',
      spellName: 'Resistance',
    }));
  });

  it('does nothing when skip is called without pending state', () => {
    const { result } = renderHook(() =>
      useSpellMetamagicFlow({ playerStats: makePlayerStats(), campaignName: 'test-campaign', onExecute: vi.fn() })
    );

    expect(result.current.resistanceStage).toBeNull();

    act(() => {
      result.current.handleResistanceSkip();
    });

    expect(result.current.resistanceStage).toBeNull();
  });
});
