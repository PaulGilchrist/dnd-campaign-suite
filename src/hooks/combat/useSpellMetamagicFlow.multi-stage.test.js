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

// ── Minimal mocks (only what this file's tests actually exercise) ──────────────

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
  getMonsterData: vi.fn().mockResolvedValue({ type: 'beast' }),
}));

vi.mock('../../services/rules/spells/postCastRiderService.js', () => ({
  getMultiTargetSpreadForSpell: vi.fn().mockReturnValue(null),
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
  applyShieldOfFaithEffect: vi.fn(() => Promise.resolve({ payload: 'shieldOfFaith-popup' })),
  applyProtectionFromEnergyHandler: vi.fn(),
  applyProtectionFromPoisonHandler: vi.fn(() => Promise.resolve({ payload: 'protectionFromPoison-popup' })),
  applyResistanceEffect: vi.fn(),
  executeHandler: vi.fn(() => Promise.resolve(null)),
  confirmGreaterRestoration: vi.fn(),
  applyHolyAuraEffect: vi.fn(() => Promise.resolve(null)),
  applyBaneEffect: vi.fn(),
  applyBlessEffect: vi.fn(),
  applyFaerieFire: vi.fn(() => Promise.resolve(null)),
  applyHaste: vi.fn(),
  applyEnhanceAbilityEffect: vi.fn(() => Promise.resolve(null)),
  applyBarkskinEffect: vi.fn(() => Promise.resolve({ payload: 'barkskin-popup' })),
  applyInvisibility: vi.fn(),
  applyGreaterInvisibility: vi.fn(),
  applyFeignDeath: vi.fn(() => Promise.resolve(null)),
  applyLongstriderEffect: vi.fn(() => Promise.resolve(null)),
  applySpareTheDyingEffect: vi.fn(() => Promise.resolve(null)),
  applyPassWithoutTraceEffect: vi.fn(() => Promise.resolve(null)),
  applyBeaconOfHopeEffect: vi.fn(() => Promise.resolve(null)),
  applyAuraOfLifeEffect: vi.fn(),
  applyAuraOfPurityEffect: vi.fn(),
  applyCircleOfPowerEffect: vi.fn(() => Promise.resolve({ payload: 'circleOfPower-popup' })),
  applyCompulsionEffect: vi.fn(() => Promise.resolve(null)),
  applyAuraOfVitalityEffect: vi.fn(() => Promise.resolve({ payload: 'auraOfVitality-popup' })),
  applyDeathWardEffect: vi.fn(() => Promise.resolve({ payload: 'deathWard-popup' })),
  applyHeroism: vi.fn(() => Promise.resolve({ payload: 'heroism-popup' })),
  applyProtectionFromEvilAndGood: vi.fn(),
  applyStoneSkinHandler: vi.fn(() => Promise.resolve({ payload: 'stoneSkin-popup' })),
  handleSanctuary: vi.fn(() => Promise.resolve({ payload: 'sanctuary-popup' })),
}));

vi.mock('../../services/rules/features/greaterRestorationService.js', () => ({
  confirmGreaterRestoration: vi.fn(),
}));

vi.mock('../../services/rules/features/removeCurseService.js', () => ({
  confirmRemoveCurse: vi.fn(() => Promise.resolve({ payload: 'removeCurse-popup' })),
}));

vi.mock('../../services/rules/features/regenerateService.js', () => ({
  confirmRegenerate: vi.fn(() => Promise.resolve({ payload: 'regenerate-popup' })),
}));

vi.mock('../../services/rules/features/foresightService.js', () => ({
  triggerForesight: vi.fn(() => Promise.resolve({ payload: 'foresight-popup' })),
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
  triggerBanishment: vi.fn(() => Promise.resolve({ payload: 'banishment-popup' })),
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
  triggerRevivify: vi.fn(() => Promise.resolve({ payload: 'revivify-popup' })),
}));

vi.mock('../../services/automation/handlers/spells/polymorphService.js', () => ({
  applyPolymorph: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('../../services/automation/handlers/spells/animalShapesService.js', () => ({
  applyAnimalShapes: vi.fn(() => Promise.resolve({ ok: false })),
}));

vi.mock('../../services/automation/handlers/spells/truePolymorphService.js', () => ({
  applyTruePolymorph: vi.fn(() => Promise.resolve({ payload: 'true-polymorph-popup' })),
}));

vi.mock('../../services/rules/spells/materialComponents.js', () => ({
  getConsumedMaterial: vi.fn(() => null),
  hasMaterial: vi.fn(() => true),
  consumeMaterial: vi.fn(() => Promise.resolve(true)),
  getMaterialRequirementMessage: vi.fn(() => null),
}));

vi.mock('../../services/rules/spells/spellPreparationService.js', () => ({
  prepareSpellCast: vi.fn(async (spell, metaCtx) => ({
    modifiedSpell: spell,
    metaCtx: { ...metaCtx },
    slotConsumed: false,
    freeCastUsed: false,
  })),
  isFreeCastAuthorized: vi.fn(() => false),
  incrementFreeCastResource: vi.fn(),
}));

vi.mock('../runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => 3),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../useAllySelection.js', () => ({
  getAllyList: vi.fn((casterName) => [casterName.toLowerCase(), 'goblin a', 'goblin b']),
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

// ── handleMagicMissileConfirm with distribution ──────────────────────────────

describe('useSpellMetamagicFlow — handleMagicMissileConfirm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getMultiTargetSpreadForSpell.mockReturnValue(null);
  });

  it('calls onExecute with magicMissileDistribution when targets selected', async () => {
    const onExecute = vi.fn();
    const { result } = renderHook(() =>
      useSpellMetamagicFlow(makePlayerStats(), 'test-campaign', onExecute)
    );

    await act(async () => {
      await result.current.gateMetamagic(makeSpell({ name: 'Magic Missile', level: 1 }));
    });

    await act(async () => {
      await result.current.handleMagicMissileConfirm({ distribution: { 'Goblin A': 1, 'Goblin B': 1 } });
    });

    expect(onExecute).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ magicMissileDistribution: { 'Goblin A': 1, 'Goblin B': 1 } })
    );
    expect(result.current.pendingMagicMissile).toBeNull();
  });

  it('passes slotLevel derived from spell level in distribution', async () => {
    const onExecute = vi.fn();
    const { result } = renderHook(() =>
      useSpellMetamagicFlow(makePlayerStats(), 'test-campaign', onExecute)
    );

    await act(async () => {
      await result.current.gateMetamagic(makeSpell({ name: 'Magic Missile', level: 2 }));
    });

    await act(async () => {
      await result.current.handleMagicMissileConfirm({ distribution: { 'Goblin A': 2 } });
    });

    expect(onExecute).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ slotLevel: 2 })
    );
  });

  it('pays the spell slot via prepareSpellCast before executing', async () => {
    const { prepareSpellCast, isFreeCastAuthorized } = await import('../../services/rules/spells/spellPreparationService.js');
    const onExecute = vi.fn();
    const { result } = renderHook(() =>
      useSpellMetamagicFlow(makePlayerStats(), 'test-campaign', onExecute)
    );

    await act(async () => {
      await result.current.gateMetamagic(makeSpell({ name: 'Magic Missile', level: 1 }));
    });

    await act(async () => {
      await result.current.handleMagicMissileConfirm({ distribution: { 'Goblin A': 3 } });
    });

    expect(isFreeCastAuthorized).toHaveBeenCalledWith('TestSorcerer', 'Magic Missile', 1, expect.any(Object), 'test-campaign');
    expect(prepareSpellCast).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Magic Missile', level: 1 }),
      expect.objectContaining({ magicMissileDistribution: { 'Goblin A': 3 }, slotLevel: 1 }),
      expect.objectContaining({ playerName: 'TestSorcerer', campaignName: 'test-campaign' })
    );
    expect(onExecute).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Magic Missile' }),
      expect.objectContaining({ magicMissileDistribution: { 'Goblin A': 3 }, slotLevel: 1 })
    );
  });

  it('does nothing when all distribution values are 0', async () => {
    const onExecute = vi.fn();
    const { prepareSpellCast } = await import('../../services/rules/spells/spellPreparationService.js');
    const { result } = renderHook(() =>
      useSpellMetamagicFlow(makePlayerStats(), 'test-campaign', onExecute)
    );

    await act(async () => {
      await result.current.gateMetamagic(makeSpell({ name: 'Magic Missile', level: 1 }));
    });

    await act(async () => {
      await result.current.handleMagicMissileConfirm({ distribution: { 'Goblin A': 0, 'Goblin B': 0 } });
    });

    expect(onExecute).not.toHaveBeenCalled();
    expect(prepareSpellCast).not.toHaveBeenCalled();
    expect(result.current.pendingMagicMissile).toBeNull();
  });

  it('does nothing when there is no pending magicMissile', async () => {
    const onExecute = vi.fn();
    const { result } = renderHook(() =>
      useSpellMetamagicFlow(makePlayerStats(), 'test-campaign', onExecute)
    );

    await act(async () => {
      await result.current.handleMagicMissileConfirm({ distribution: { 'Goblin A': 1 } });
    });

    expect(onExecute).not.toHaveBeenCalled();
  });
});

// ── handleEnhanceAbilityAbilitySelect ───────────────────────────────────────

describe('useSpellMetamagicFlow — handleEnhanceAbilityAbilitySelect', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getMultiTargetSpreadForSpell.mockReturnValue(null);
  });

  it('sets enhanceAbilityStage to target and stores the selected ability', () => {
    const { result } = renderHook(() =>
      useSpellMetamagicFlow(makePlayerStats(), 'test-campaign', vi.fn())
    );

    act(() => {
      result.current.handleEnhanceAbilityAbilitySelect('Strength');
    });

    expect(result.current.enhanceAbilityStage).toBe('target');
  });

  it('updates stored ability on subsequent calls', () => {
    const { result } = renderHook(() =>
      useSpellMetamagicFlow(makePlayerStats(), 'test-campaign', vi.fn())
    );

    act(() => {
      result.current.handleEnhanceAbilityAbilitySelect('Strength');
    });
    expect(result.current.enhanceAbilityStage).toBe('target');

    act(() => {
      result.current.handleEnhanceAbilityAbilitySelect('Dexterity');
    });
    expect(result.current.enhanceAbilityStage).toBe('target');
  });
});

// ── handleProtectionFromEnergyTargetSelect ──────────────────────────────────

describe('useSpellMetamagicFlow — handleProtectionFromEnergyTargetSelect', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getMultiTargetSpreadForSpell.mockReturnValue(null);
  });

  it('sets protectionFromEnergyStage to type and stores the selected target', () => {
    const { result } = renderHook(() =>
      useSpellMetamagicFlow(makePlayerStats(), 'test-campaign', vi.fn())
    );

    act(() => {
      result.current.handleProtectionFromEnergyTargetSelect('Goblin A');
    });

    expect(result.current.protectionFromEnergyStage).toBe('type');
  });
});

// ── handleProtectionFromEnergyTypeSelect ────────────────────────────────────

describe('useSpellMetamagicFlow — handleProtectionFromEnergyTypeSelect', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getMultiTargetSpreadForSpell.mockReturnValue(null);
  });

  it('clears pending and applies effect on type select after target select', async () => {
    const setPopupHtml = vi.fn();
    const { result } = renderHook(() =>
      useSpellMetamagicFlow(makePlayerStats(), 'test-campaign', vi.fn(), null, [], setPopupHtml)
    );

    act(() => {
      result.current.gateMetamagic(makeSpell({ name: 'Protection from Energy', level: 3 }));
    });

    act(() => {
      result.current.handleProtectionFromEnergyTargetSelect('Goblin A');
    });

    expect(result.current.protectionFromEnergyStage).toBe('type');

    await act(async () => {
      await result.current.handleProtectionFromEnergyTypeSelect('fire');
    });

    expect(result.current.pendingProtectionFromEnergy).toBeNull();
    expect(result.current.protectionFromEnergyStage).toBeNull();
  });

  it('does nothing when there is no pending protectionFromEnergy', () => {
    const { result } = renderHook(() =>
      useSpellMetamagicFlow(makePlayerStats(), 'test-campaign', vi.fn())
    );

    act(() => {
      result.current.handleProtectionFromEnergyTypeSelect('fire');
    });

    expect(result.current.protectionFromEnergyStage).toBeNull();
  });
});

// ── handleResistanceTargetSelect ────────────────────────────────────────────

describe('useSpellMetamagicFlow — handleResistanceTargetSelect', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getMultiTargetSpreadForSpell.mockReturnValue(null);
  });

  it('sets resistanceStage to type and stores the selected target', () => {
    const { result } = renderHook(() =>
      useSpellMetamagicFlow(makePlayerStats(), 'test-campaign', vi.fn())
    );

    act(() => {
      result.current.handleResistanceTargetSelect('Goblin A');
    });

    expect(result.current.resistanceStage).toBe('type');
  });
});

// ── handleResistanceTypeSelect ──────────────────────────────────────────────

describe('useSpellMetamagicFlow — handleResistanceTypeSelect', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getMultiTargetSpreadForSpell.mockReturnValue(null);
  });

  it('clears pending and applies effect on type select after target select', async () => {
    const { result } = renderHook(() =>
      useSpellMetamagicFlow(makePlayerStats(), 'test-campaign', vi.fn())
    );

    act(() => {
      result.current.gateMetamagic(makeSpell({ name: 'Resistance', level: 0 }));
    });

    act(() => {
      result.current.handleResistanceTargetSelect('Goblin A');
    });

    expect(result.current.resistanceStage).toBe('type');

    await act(async () => {
      await result.current.handleResistanceTypeSelect('fire');
    });

    expect(result.current.pendingResistance).toBeNull();
    expect(result.current.resistanceStage).toBeNull();
  });

  it('does nothing when there is no pending resistance', () => {
    const { result } = renderHook(() =>
      useSpellMetamagicFlow(makePlayerStats(), 'test-campaign', vi.fn())
    );

    act(() => {
      result.current.handleResistanceTypeSelect('fire');
    });

    expect(result.current.resistanceStage).toBeNull();
  });
});

// ── handleGreaterRestorationNoEffects ───────────────────────────────────────

describe('useSpellMetamagicFlow — handleGreaterRestorationNoEffects', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getMultiTargetSpreadForSpell.mockReturnValue(null);
  });

  it('logs entry when no effects to remove', () => {
    const { result } = renderHook(() =>
      useSpellMetamagicFlow(makePlayerStats(), 'test-campaign', vi.fn())
    );

    act(() => {
      result.current.gateMetamagic(makeSpell({ name: 'Greater Restoration', level: 5 }));
    });

    act(() => {
      result.current.handleGreaterRestorationNoEffects();
    });

    expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
      type: 'spell',
      characterName: 'TestSorcerer',
      spellName: 'Greater Restoration',
      targetName: null,
      targets: [],
    }));
  });

  it('does nothing when there is no pending greaterRestoration', () => {
    const { result } = renderHook(() =>
      useSpellMetamagicFlow(makePlayerStats(), 'test-campaign', vi.fn())
    );

    act(() => {
      result.current.handleGreaterRestorationNoEffects();
    });

    expect(result.current.pendingGreaterRestoration).toBeNull();
  });
});

// ── handleTruePolymorphPathSelect object_into_creature ──────────────────────

describe('useSpellMetamagicFlow — handleTruePolymorphPathSelect object_into_creature', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getMultiTargetSpreadForSpell.mockReturnValue(null);
  });

  it('clears pending and applies true polymorph when path is object_into_creature', async () => {
    const setPopupHtml = vi.fn();
    const { result } = renderHook(() =>
      useSpellMetamagicFlow(makePlayerStats(), 'test-campaign', vi.fn(), null, [], setPopupHtml)
    );

    act(() => {
      result.current.gateMetamagic(makeSpell({ name: 'True Polymorph', level: 9 }));
    });

    await act(async () => {
      await result.current.handleTruePolymorphPathSelect('object_into_creature');
    });

    expect(result.current.pendingTruePolymorph).toBeNull();
  });

  it('sets path on pending when path is not object_into_creature', () => {
    const { result } = renderHook(() =>
      useSpellMetamagicFlow(makePlayerStats(), 'test-campaign', vi.fn())
    );

    act(() => {
      result.current.gateMetamagic(makeSpell({ name: 'True Polymorph', level: 9 }));
    });

    act(() => {
      result.current.handleTruePolymorphPathSelect('creature_to_creature');
    });

    expect(result.current.pendingTruePolymorph).not.toBeNull();
    expect(result.current.pendingTruePolymorph.path).toBe('creature_to_creature');
  });

  it('does nothing when there is no pending truePolymorph', () => {
    const { result } = renderHook(() =>
      useSpellMetamagicFlow(makePlayerStats(), 'test-campaign', vi.fn())
    );

    act(() => {
      result.current.handleTruePolymorphPathSelect('creature_to_creature');
    });

    expect(result.current.pendingTruePolymorph).toBeNull();
  });
});

// ── handleAnimalShapesBeastConfirm ──────────────────────────────────────────

describe('useSpellMetamagicFlow — handleAnimalShapesBeastConfirm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getMultiTargetSpreadForSpell.mockReturnValue(null);
  });

  it('clears popup and sets concentration state when result.ok is true and caster is in combat', async () => {
    const automation = await import('../../services/automation/handlers/spells/animalShapesService.js');
    automation.applyAnimalShapes.mockResolvedValueOnce({ ok: true });

    const setPopupHtml = vi.fn();
    const { result } = renderHook(() =>
      useSpellMetamagicFlow(makePlayerStats(), 'test-campaign', vi.fn(), null, [], setPopupHtml)
    );

    act(() => {
      result.current.gateMetamagic(makeSpell({ name: 'Animal Shapes', level: 8 }));
    });

    await act(async () => {
      await result.current.handleAnimalShapesTargetConfirm(['Goblin A']);
    });

    await act(async () => {
      await result.current.handleAnimalShapesBeastConfirm({ 'Goblin A': 'Wolf' });
    });

    expect(setPopupHtml).toHaveBeenCalledWith(null);
  });

  it('clears popup when result.ok is false', async () => {
    const automation = await import('../../services/automation/handlers/spells/animalShapesService.js');
    automation.applyAnimalShapes.mockResolvedValueOnce({ ok: false });

    const setPopupHtml = vi.fn();
    const { result } = renderHook(() =>
      useSpellMetamagicFlow(makePlayerStats(), 'test-campaign', vi.fn(), null, [], setPopupHtml)
    );

    act(() => {
      result.current.gateMetamagic(makeSpell({ name: 'Animal Shapes', level: 8 }));
    });

    await act(async () => {
      await result.current.handleAnimalShapesTargetConfirm(['Goblin A']);
    });

    await act(async () => {
      await result.current.handleAnimalShapesBeastConfirm({ 'Goblin A': 'Wolf' });
    });

    expect(setPopupHtml).toHaveBeenCalledWith(null);
  });

  it('does nothing when there is no pending animalShapes', async () => {
    const automation = await import('../../services/automation/handlers/spells/animalShapesService.js');
    automation.applyAnimalShapes.mockResolvedValueOnce({ ok: false });

    const setPopupHtml = vi.fn();
    const { result } = renderHook(() =>
      useSpellMetamagicFlow(makePlayerStats(), 'test-campaign', vi.fn(), null, [], setPopupHtml)
    );

    await act(async () => {
      await result.current.handleAnimalShapesBeastConfirm({});
    });

    expect(result.current.pendingAnimalShapes).toBeNull();
  });
});

// ── handleAnimalShapesBeastConfirm concentration state (caster in combat) ─

describe('useSpellMetamagicFlow — handleAnimalShapesBeastConfirm concentration caster', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getMultiTargetSpreadForSpell.mockReturnValue(null);
  });

  it('sets concentration runtime values when caster name matches a creature in combat summary', async () => {
    const automation = await import('../../services/automation/handlers/spells/animalShapesService.js');
    automation.applyAnimalShapes.mockResolvedValueOnce({ ok: true });

    const setPopupHtml = vi.fn();
    const { result } = renderHook(() =>
      useSpellMetamagicFlow({ ...makePlayerStats(), name: 'Goblin A', abilities: { CON: { bonus: 2 } } }, 'test-campaign', vi.fn(), null, [], setPopupHtml)
    );

    act(() => {
      result.current.gateMetamagic(makeSpell({ name: 'Animal Shapes', level: 8 }));
    });

    await act(async () => {
      await result.current.handleAnimalShapesTargetConfirm(['Goblin A']);
    });

    await act(async () => {
      await result.current.handleAnimalShapesBeastConfirm({ 'Goblin A': 'Wolf' });
    });

    expect(setPopupHtml).toHaveBeenCalledWith(null);
  });
});
