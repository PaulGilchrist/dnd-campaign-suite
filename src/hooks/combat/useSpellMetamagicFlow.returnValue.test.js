// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSpellMetamagicFlow } from './useSpellMetamagicFlow.js';
import { getMultiTargetSpreadForSpell } from '../../services/rules/spells/postCastRiderService.js';
import { addEntry } from '../../services/ui/logService.js';
import { setRuntimeValue } from '../runtime/useRuntimeState.js';

// ── Shared minimal mocks ──────────────────────────────────────────────────────

vi.mock('./useMetamagic.js', () => ({
  getCurrentSorceryPoints: vi.fn(() => 5),
  getMaxSorceryPoints: vi.fn(() => 10),
  spendSorceryPoints: vi.fn(),
  logMetamagicUse: vi.fn(),
}));

vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../services/rules/spells/postCastRiderService.js', () => ({
  getMultiTargetSpreadForSpell: vi.fn(() => null),
}));

vi.mock('../../services/npcs/monsterUtils.js', () => ({
  getMonsterData: vi.fn(() => Promise.resolve({ type: 'humanoid' })),
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
  applyProtectionFromEnergyHandler: vi.fn(),
  applyProtectionFromEvilAndGood: vi.fn(),
  applyProtectionFromPoisonHandler: vi.fn(() => Promise.resolve(null)),
  applyResistanceEffect: vi.fn(),
  executeHandler: vi.fn(() => Promise.resolve(null)),
  confirmGreaterRestoration: vi.fn(),
  applyHolyAuraEffect: vi.fn(() => Promise.resolve(null)),
  applyBaneEffect: vi.fn(),
  applyBlessEffect: vi.fn(),
  applyFaerieFire: vi.fn(() => Promise.resolve(null)),
  applyHaste: vi.fn(),
  applyEnhanceAbilityEffect: vi.fn(() => Promise.resolve(null)),
  applyBarkskinEffect: vi.fn(() => Promise.resolve(null)),
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
  applyStoneSkinHandler: vi.fn(() => Promise.resolve(null)),
  handleSanctuary: vi.fn(() => Promise.resolve(null)),
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

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('useSpellMetamagicFlow — return value shape', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getMultiTargetSpreadForSpell.mockReturnValue(null);
  });

  it('returns gateMetamagic, handleConfirm, handleSkip, and handler functions', () => {
    const onExecute = vi.fn();
    const { result } = renderHook(() =>
      useSpellMetamagicFlow({ playerStats: makePlayerStats(), campaignName: 'TestCampaign', onExecute: onExecute })
    );

    const ret = result.current;

    // Core entry points
    expect(ret).toHaveProperty('gateMetamagic');
    expect(typeof ret.gateMetamagic).toBe('function');
    expect(ret).toHaveProperty('handleConfirm');
    expect(typeof ret.handleConfirm).toBe('function');
    expect(ret).toHaveProperty('handleSkip');
    expect(typeof ret.handleSkip).toBe('function');
    expect(ret).toHaveProperty('handleMultiTargetConfirm');
    expect(typeof ret.handleMultiTargetConfirm).toBe('function');
    expect(ret).toHaveProperty('handleMultiTargetSkip');
    expect(typeof ret.handleMultiTargetSkip).toBe('function');
    expect(ret).toHaveProperty('cfClearPending');
    expect(typeof ret.cfClearPending).toBe('function');
  });

  it('returns pending state getters for all supported spells', () => {
    const { result } = renderHook(() =>
      useSpellMetamagicFlow({ playerStats: makePlayerStats(), campaignName: 'TestCampaign', onExecute: vi.fn() })
    );

    const pendingKeys = [
      'pendingMetamagic', 'pendingMultiTarget', 'pendingAid', 'pendingBane',
      'pendingBless', 'pendingFaerieFire', 'pendingHolyAura', 'pendingBeaconOfHope',
      'pendingSlow', 'pendingHaste', 'pendingEnhanceAbility', 'pendingBarkskin',
      'pendingInvisibility', 'pendingGreaterInvisibility', 'pendingFeignDeath',
      'pendingHeal', 'pendingHeroesFeast', 'pendingGreaterRestoration',
      'pendingLesserRestoration', 'pendingMageArmor', 'pendingShieldOfFaith',
      'pendingProtectionFromEvilAndGood', 'pendingProtectionFromPoison',
      'pendingStoneSkin', 'pendingProtectionFromEnergy', 'pendingResistance',
      'pendingRemoveCurse', 'pendingMagicMissile', 'pendingPassWithoutTrace',
      'pendingGlobe', 'pendingForcecage', 'pendingAntimagicField',
      'pendingRegenerate', 'pendingHealingWord', 'pendingCureWounds',
      'pendingStinkingCloud', 'pendingWeb', 'pendingAnimalFriendship',
      'pendingAuraOfLife', 'pendingAuraOfPurity', 'pendingCircleOfPower',
      'pendingCompulsion', 'pendingAuraOfVitality', 'pendingForesight',
      'pendingLongstrider', 'pendingSpareTheDying', 'pendingPrismaticSpray',
      'pendingConfusion', 'pendingRevivify', 'pendingSanctuary',
      'pendingSleetStorm', 'pendingHoldMonster', 'pendingHoldPerson',
      'pendingPolymorph', 'pendingShapechange', 'pendingAnimalShapes',
      'pendingTruePolymorph', 'pendingCharmPerson', 'pendingCharmMonster',
      'pendingBanishment', 'pendingDeathWard', 'pendingHeroism',
    ];

    for (const key of pendingKeys) {
      expect(result.current).toHaveProperty(key);
    }
  });

  it('returns stage state for two-stage handlers', () => {
    const { result } = renderHook(() =>
      useSpellMetamagicFlow({ playerStats: makePlayerStats(), campaignName: 'TestCampaign', onExecute: vi.fn() })
    );

    expect(result.current).toHaveProperty('resistanceStage');
    expect(result.current).toHaveProperty('enhanceAbilityStage');
    expect(result.current).toHaveProperty('protectionFromEnergyStage');
    expect(result.current.resistanceStage).toBeNull();
    expect(result.current.enhanceAbilityStage).toBeNull();
    expect(result.current.protectionFromEnergyStage).toBeNull();
  });

  it('returns all handler functions for simple spells', () => {
    const { result } = renderHook(() =>
      useSpellMetamagicFlow({ playerStats: makePlayerStats(), campaignName: 'TestCampaign', onExecute: vi.fn() })
    );

    const handlers = [
      'handleAidConfirm', 'handleAidSkip',
      'handleBaneConfirm', 'handleBaneSkip',
      'handleBlessConfirm', 'handleBlessSkip',
      'handleFaerieFireConfirm', 'handleFaerieFireSkip',
      'handleHolyAuraConfirm', 'handleHolyAuraSkip',
      'handleBeaconOfHopeConfirm', 'handleBeaconOfHopeSkip',
      'handleSlowConfirm', 'handleSlowSkip',
      'handleHasteConfirm', 'handleHasteSkip',
      'handleInvisibilityConfirm', 'handleInvisibilitySkip',
      'handleGreaterInvisibilityConfirm', 'handleGreaterInvisibilitySkip',
      'handleFeignDeathConfirm', 'handleFeignDeathSkip',
      'handleHealConfirm', 'handleHealSkip',
      'handleHeroesFeastConfirm', 'handleHeroesFeastSkip',
      'handleLongstriderConfirm', 'handleLongstriderSkip',
      'handleSpareTheDyingConfirm', 'handleSpareTheDyingSkip',
      'handleAuraOfLifeConfirm', 'handleAuraOfLifeSkip',
      'handleAuraOfPurityConfirm', 'handleAuraOfPuritySkip',
      'handleCircleOfPowerConfirm', 'handleCircleOfPowerSkip',
      'handleCompulsionConfirm', 'handleCompulsionSkip',
      'handleAuraOfVitalityConfirm', 'handleAuraOfVitalitySkip',
      'handleDeathWardConfirm', 'handleDeathWardSkip',
      'handleHeroismConfirm', 'handleHeroismSkip',
      'handleGreaterRestorationConfirm', 'handleGreaterRestorationSkip',
      'handleGreaterRestorationNoEffects',
      'handleLesserRestorationConfirm', 'handleLesserRestorationSkip',
      'handleCureWoundsConfirm', 'handleCureWoundsSkip',
      'handleStinkingCloudConfirm', 'handleStinkingCloudSkip',
      'handleWebConfirm', 'handleWebSkip',
      'handleConfusionConfirm', 'handleConfusionSkip',
      'handleAnimalFriendshipConfirm', 'handleAnimalFriendshipSkip',
      'handleRegenerateConfirm', 'handleRegenerateSkip',
      'handleHealingWordConfirm', 'handleHealingWordSkip',
      'handleHoldMonsterConfirm', 'handleHoldMonsterSkip',
      'handleHoldPersonConfirm', 'handleHoldPersonSkip',
      'handlePolymorphConfirm', 'handlePolymorphSkip',
      'handleCharmPersonConfirm', 'handleCharmPersonSkip',
      'handleCharmMonsterConfirm', 'handleCharmMonsterSkip',
      'handleBanishmentConfirm', 'handleBanishmentSkip',
      'handlePrismaticSprayConfirm', 'handlePrismaticSpraySkip',
      'handleRevivifyConfirm', 'handleRevivifySkip',
      'handleSanctuaryConfirm', 'handleSanctuarySkip',
      'handleSleetStormConfirm', 'handleSleetStormSkip',
      'handleMagicMissileConfirm', 'handleMagicMissileSkip',
      'handleForesightConfirm', 'handleForesightSkip',
      'handleProtectionFromEvilAndGoodConfirm', 'handleProtectionFromEvilAndGoodSkip',
      'handleShieldOfFaithConfirm', 'handleShieldOfFaithSkip',
      'handleBarkskinConfirm', 'handleBarkskinSkip',
      'handlePassWithoutTraceConfirm', 'handlePassWithoutTraceSkip',
      'handleProtectionFromPoisonConfirm', 'handleProtectionFromPoisonSkip',
      'handleStoneSkinConfirm', 'handleStoneSkinSkip',
      'handleMageArmorConfirm', 'handleMageArmorSkip',
      'handleGlobeConfirm', 'handleGlobeSkip',
      'handleForcecageConfirm', 'handleForcecageSkip',
      'handleAntimagicFieldConfirm', 'handleAntimagicFieldSkip',
    ];

    for (const handler of handlers) {
      expect(result.current).toHaveProperty(handler);
      expect(typeof result.current[handler]).toBe('function');
    }
  });

  it('returns two-stage and complex handler functions', () => {
    const { result } = renderHook(() =>
      useSpellMetamagicFlow({ playerStats: makePlayerStats(), campaignName: 'TestCampaign', onExecute: vi.fn() })
    );

    const handlers = [
      'handleResistanceTargetSelect', 'handleResistanceTypeSelect', 'handleResistanceSkip',
      'handleProtectionFromEnergyTargetSelect', 'handleProtectionFromEnergyTypeSelect', 'handleProtectionFromEnergySkip',
      'handleEnhanceAbilityAbilitySelect', 'handleEnhanceAbilityConfirm', 'handleEnhanceAbilitySkip',
      'handleTruePolymorphPathSelect', 'handleTruePolymorphTargetConfirm', 'handleTruePolymorphSkip',
      'handleAnimalShapesTargetConfirm', 'handleAnimalShapesBeastConfirm', 'handleAnimalShapesSkip',
    ];

    for (const handler of handlers) {
      expect(result.current).toHaveProperty(handler);
      expect(typeof result.current[handler]).toBe('function');
    }
  });
});

// ── gateMetamagic behavior ────────────────────────────────────────────────────

describe('useSpellMetamagicFlow — gateMetamagic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getMultiTargetSpreadForSpell.mockReturnValue(null);
  });

  it('sets pending state for metamagic-enabled spells', () => {
    const { result } = renderHook(() =>
      useSpellMetamagicFlow({ playerStats: makePlayerStats(), campaignName: 'TestCampaign', onExecute: vi.fn() })
    );

    act(() => {
      result.current.gateMetamagic(makeSpell({ name: 'Bane', level: 0 }));
    });

    expect(result.current.pendingBane).not.toBeNull();
    expect(result.current.pendingBane.spellName).toBe('Bane');
  });

  it('sets pendingMetamagic for any spell passed through gateMetamagic', () => {
    const { result } = renderHook(() =>
      useSpellMetamagicFlow({ playerStats: makePlayerStats(), campaignName: 'TestCampaign', onExecute: vi.fn() })
    );

    act(() => {
      result.current.gateMetamagic(makeSpell({ name: 'Fireball', level: 3 }));
    });

    // gateMetamagic always sets pendingMetamagic regardless of spell type
    expect(result.current.pendingMetamagic).not.toBeNull();
    expect(result.current.pendingMetamagic.spellName).toBe('Fireball');
  });

  it('clears pending after confirm handler runs', async () => {
    const { result } = renderHook(() =>
      useSpellMetamagicFlow({ playerStats: makePlayerStats(), campaignName: 'TestCampaign', onExecute: vi.fn() })
    );

    act(() => {
      result.current.gateMetamagic(makeSpell({ name: 'Bane', level: 0 }));
    });

    expect(result.current.pendingBane).not.toBeNull();

    await act(async () => {
      await result.current.handleBaneConfirm(['Goblin A']);
    });

    expect(result.current.pendingBane).toBeNull();
  });

  it('clears pending after skip handler runs', () => {
    const { result } = renderHook(() =>
      useSpellMetamagicFlow({ playerStats: makePlayerStats(), campaignName: 'TestCampaign', onExecute: vi.fn() })
    );

    act(() => {
      result.current.gateMetamagic(makeSpell({ name: 'Bane', level: 0 }));
    });

    expect(result.current.pendingBane).not.toBeNull();

    act(() => {
      result.current.handleBaneSkip();
    });

    expect(result.current.pendingBane).toBeNull();
  });
});

// ── Handler guards — no-op when no pending ────────────────────────────────────

describe('useSpellMetamagicFlow — handler guards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getMultiTargetSpreadForSpell.mockReturnValue(null);
  });

  it('handleBaneConfirm does nothing when no pending bane', async () => {
    const { result } = renderHook(() =>
      useSpellMetamagicFlow({ playerStats: makePlayerStats(), campaignName: 'TestCampaign', onExecute: vi.fn() })
    );

    await act(async () => {
      await result.current.handleBaneConfirm(['Goblin A']);
    });

    expect(addEntry).not.toHaveBeenCalled();
  });

  it('handleBaneSkip does nothing when no pending bane', () => {
    const { result } = renderHook(() =>
      useSpellMetamagicFlow({ playerStats: makePlayerStats(), campaignName: 'TestCampaign', onExecute: vi.fn() })
    );

    act(() => {
      result.current.handleBaneSkip();
    });

    expect(addEntry).not.toHaveBeenCalled();
  });

  it('handleMagicMissileConfirm does nothing when no pending magicMissile', () => {
    const onExecute = vi.fn();
    const { result } = renderHook(() =>
      useSpellMetamagicFlow({ playerStats: makePlayerStats(), campaignName: 'TestCampaign', onExecute: onExecute })
    );

    act(() => {
      result.current.handleMagicMissileConfirm({ distribution: { 'Goblin A': 1 } });
    });

    expect(onExecute).not.toHaveBeenCalled();
  });

  it('handleResistanceTypeSelect does nothing when no pending resistance', () => {
    const { result } = renderHook(() =>
      useSpellMetamagicFlow({ playerStats: makePlayerStats(), campaignName: 'TestCampaign', onExecute: vi.fn() })
    );

    act(() => {
      result.current.handleResistanceTypeSelect('fire');
    });

    expect(setRuntimeValue).not.toHaveBeenCalled();
  });

  it('handleProtectionFromEnergyTypeSelect does nothing when no pending protectionFromEnergy', () => {
    const { result } = renderHook(() =>
      useSpellMetamagicFlow({ playerStats: makePlayerStats(), campaignName: 'TestCampaign', onExecute: vi.fn() })
    );

    act(() => {
      result.current.handleProtectionFromEnergyTypeSelect('fire');
    });

    expect(setRuntimeValue).not.toHaveBeenCalled();
  });

  it('handleGreaterRestorationNoEffects does nothing when no pending greaterRestoration', () => {
    const { result } = renderHook(() =>
      useSpellMetamagicFlow({ playerStats: makePlayerStats(), campaignName: 'TestCampaign', onExecute: vi.fn() })
    );

    act(() => {
      result.current.handleGreaterRestorationNoEffects();
    });

    expect(addEntry).not.toHaveBeenCalled();
  });

  it('handleTruePolymorphPathSelect does nothing when no pending truePolymorph', () => {
    const { result } = renderHook(() =>
      useSpellMetamagicFlow({ playerStats: makePlayerStats(), campaignName: 'TestCampaign', onExecute: vi.fn() })
    );

    act(() => {
      result.current.handleTruePolymorphPathSelect('object_into_creature');
    });

    expect(addEntry).not.toHaveBeenCalled();
  });

  it('handleAnimalShapesBeastConfirm calls setPopupHtml(null) even when no pending animalShapes', async () => {
    const setPopupHtml = vi.fn();
    const { result } = renderHook(() =>
      useSpellMetamagicFlow({ playerStats: makePlayerStats(), campaignName: 'TestCampaign', onExecute: vi.fn(), setSecondaryTargetModal: null, characters: [], setPopupHtml: setPopupHtml })
    );

    await act(async () => {
      await result.current.handleAnimalShapesBeastConfirm({});
    });

    expect(setPopupHtml).toHaveBeenCalledWith(null);
  });
});

// ── cfClearPending ────────────────────────────────────────────────────────────

describe('useSpellMetamagicFlow — cfClearPending', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getMultiTargetSpreadForSpell.mockReturnValue(null);
  });

  it('clears pending state for a given type', () => {
    const { result } = renderHook(() =>
      useSpellMetamagicFlow({ playerStats: makePlayerStats(), campaignName: 'TestCampaign', onExecute: vi.fn() })
    );

    act(() => {
      result.current.gateMetamagic(makeSpell({ name: 'Bane', level: 0 }));
    });

    expect(result.current.pendingBane).not.toBeNull();

    act(() => {
      result.current.cfClearPending('bane');
    });

    expect(result.current.pendingBane).toBeNull();
  });

  it('is a no-op when type has no pending state', () => {
    const { result } = renderHook(() =>
      useSpellMetamagicFlow({ playerStats: makePlayerStats(), campaignName: 'TestCampaign', onExecute: vi.fn() })
    );

    // Should not throw
    act(() => {
      result.current.cfClearPending('nonexistent');
    });

    expect(result.current.pendingBane).toBeNull();
  });
});

// ── Two-stage handler state transitions ───────────────────────────────────────

describe('useSpellMetamagicFlow — two-stage handler state transitions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getMultiTargetSpreadForSpell.mockReturnValue(null);
  });

  it('resistance: target select transitions stage to "type"', () => {
    const { result } = renderHook(() =>
      useSpellMetamagicFlow({ playerStats: makePlayerStats(), campaignName: 'TestCampaign', onExecute: vi.fn() })
    );

    act(() => {
      result.current.gateMetamagic(makeSpell({ name: 'Resistance', level: 0 }));
    });

    // useEffect in useTwoStageHandlers auto-sets stage to 'target' when pending exists
    expect(result.current.resistanceStage).toBe('target');

    act(() => {
      result.current.handleResistanceTargetSelect('Goblin A');
    });

    expect(result.current.resistanceStage).toBe('type');
  });

  it('enhanceAbility: ability select transitions stage to "target"', () => {
    const { result } = renderHook(() =>
      useSpellMetamagicFlow({ playerStats: makePlayerStats(), campaignName: 'TestCampaign', onExecute: vi.fn() })
    );

    act(() => {
      result.current.gateMetamagic(makeSpell({ name: 'Enhance Ability', level: 2 }));
    });

    // useEffect in useTwoStageHandlers auto-sets stage to 'ability' when pending exists
    expect(result.current.enhanceAbilityStage).toBe('ability');

    act(() => {
      result.current.handleEnhanceAbilityAbilitySelect('Strength');
    });

    expect(result.current.enhanceAbilityStage).toBe('target');
  });

  it('protectionFromEnergy: target select transitions stage to "type"', () => {
    const { result } = renderHook(() =>
      useSpellMetamagicFlow({ playerStats: makePlayerStats(), campaignName: 'TestCampaign', onExecute: vi.fn() })
    );

    act(() => {
      result.current.gateMetamagic(makeSpell({ name: 'Protection from Energy', level: 3 }));
    });

    // useEffect in useTwoStageHandlers auto-sets stage to 'target' when pending exists
    expect(result.current.protectionFromEnergyStage).toBe('target');

    act(() => {
      result.current.handleProtectionFromEnergyTargetSelect('Goblin A');
    });

    expect(result.current.protectionFromEnergyStage).toBe('type');
  });
});

// ── Logging on confirm/skip ──────────────────────────────────────────────────

describe('useSpellMetamagicFlow — logging on confirm/skip', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getMultiTargetSpreadForSpell.mockReturnValue(null);
  });

  it('logs a spell entry on confirm handler execution', async () => {
    const { result } = renderHook(() =>
      useSpellMetamagicFlow({ playerStats: makePlayerStats(), campaignName: 'TestCampaign', onExecute: vi.fn() })
    );

    act(() => {
      result.current.gateMetamagic(makeSpell({ name: 'Bane', level: 0 }));
    });

    await act(async () => {
      await result.current.handleBaneConfirm(['Goblin A']);
    });

    expect(addEntry).toHaveBeenCalledWith('TestCampaign', expect.objectContaining({
      type: 'spell',
      characterName: 'TestSorcerer',
      spellName: 'Bane',
    }));
  });

  it('logs a spell entry on skip handler execution', () => {
    const { result } = renderHook(() =>
      useSpellMetamagicFlow({ playerStats: makePlayerStats(), campaignName: 'TestCampaign', onExecute: vi.fn() })
    );

    act(() => {
      result.current.gateMetamagic(makeSpell({ name: 'Bane', level: 0 }));
    });

    act(() => {
      result.current.handleBaneSkip();
    });

    expect(addEntry).toHaveBeenCalledWith('TestCampaign', expect.objectContaining({
      type: 'spell',
      characterName: 'TestSorcerer',
      spellName: 'Bane',
    }));
  });
});
