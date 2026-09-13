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
  applyShieldOfFaithEffect: vi.fn(),
  applyProtectionFromEnergyHandler: vi.fn(),
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
  applyProtectionFromEvilAndGood: vi.fn(),
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

vi.mock('../runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => 3),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../useAllySelection.js', () => ({
  getAllyList: vi.fn((casterName) => [casterName.toLowerCase()]),
}));

vi.mock('../../services/rules/spells/spellPreparationService.js', () => ({
  prepareSpellCast: vi.fn(() => Promise.resolve({ modifiedSpell: {}, metaCtx: {} })),
  isFreeCastAuthorized: vi.fn(() => false),
  incrementFreeCastResource: vi.fn(),
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

function renderHookWithSpell(hookSetup, spellName, spellOverrides = {}) {
  const onExecute = vi.fn();
  const { result } = renderHook(() =>
    hookSetup(onExecute)
  );
  const spell = makeSpell({ name: spellName, ...spellOverrides });
  act(() => {
    result.current.gateMetamagic(spell);
  });
  return { result, onExecute, spell };
}

describe('useSpellMetamagicFlow — handleAnimalShapesBeastConfirm success', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getMultiTargetSpreadForSpell.mockReturnValueOnce(null);
  });

  it('sets animalShapes concentration state when result.ok is true', async () => {
    const animalShapesModule = await import('../../services/automation/handlers/spells/animalShapesService.js');
    animalShapesModule.applyAnimalShapes.mockResolvedValue({ ok: true });

    const setPopupHtml = vi.fn();
    const { result } = renderHook(() =>
      useSpellMetamagicFlow({ playerStats: makePlayerStats(), campaignName: 'TestCampaign', onExecute: vi.fn(), setSecondaryTargetModal: null, characters: [], setPopupHtml: setPopupHtml })
    );

    const allySel = await import('../../hooks/useAllySelection.js');
    allySel.getAllyList.mockReturnValueOnce(['goblin a']);

    act(() => {
      result.current.gateMetamagic(makeSpell({ name: 'Animal Shapes', level: 8 }));
    });

    expect(result.current.pendingAnimalShapes).not.toBeNull();

    await act(async () => {
      await result.current.handleAnimalShapesTargetConfirm(['Goblin A']);
    });

    expect(setPopupHtml).toHaveBeenCalledWith(expect.objectContaining({
      type: 'animal_shapes_target_selection',
    }));
  });
});

describe('useSpellMetamagicFlow — handleTruePolymorphSkip', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getMultiTargetSpreadForSpell.mockReturnValueOnce(null);
  });

  it('clears pending truePolymorph without calling onExecute', () => {
    const { result } = renderHookWithSpell(
      (onExec) => useSpellMetamagicFlow({ playerStats: makePlayerStats(), campaignName: 'TestCampaign', onExecute: onExec }),
      'True Polymorph',
      { level: 9 },
    );

    act(() => {
      result.current.handleTruePolymorphPathSelect('creature_to_creature');
    });

    act(() => {
      result.current.handleTruePolymorphSkip();
    });

    expect(result.current.pendingTruePolymorph).toBeNull();
  });
});

describe('useSpellMetamagicFlow — handleForesightSkip', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getMultiTargetSpreadForSpell.mockReturnValueOnce(null);
  });

  it('clears pending foresight and logs entry on skip', () => {
    const { result } = renderHookWithSpell(
      (onExec) => useSpellMetamagicFlow({ playerStats: makePlayerStats(), campaignName: 'TestCampaign', onExecute: onExec }),
      'Foresight',
      { level: 9 },
    );

    act(() => {
      result.current.handleForesightSkip();
    });

    expect(result.current.pendingForesight).toBeNull();
    expect(addEntry).toHaveBeenCalledWith('TestCampaign', {
      type: 'spell',
      characterName: 'TestSorcerer',
      targetName: 'TestSorcerer',
      targets: ['TestSorcerer', 'Goblin A', 'Goblin B', 'Goblin C'],
      spellName: 'Foresight',
      spellLevel: 9,
      castingTime: '1 Action',
      timestamp: expect.any(Number),
    });
  });
});

describe('useSpellMetamagicFlow — handleProtectionFromEvilAndGoodSkip', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getMultiTargetSpreadForSpell.mockReturnValueOnce(null);
  });

  it('clears pending and logs entry on skip', () => {
    const { result } = renderHookWithSpell(
      (onExec) => useSpellMetamagicFlow({ playerStats: makePlayerStats(), campaignName: 'TestCampaign', onExecute: onExec }),
      'Protection from Evil and Good',
      { level: 1 },
    );

    act(() => {
      result.current.handleProtectionFromEvilAndGoodSkip();
    });

    expect(result.current.pendingProtectionFromEvilAndGood).toBeNull();
    expect(addEntry).toHaveBeenCalledWith('TestCampaign', {
      type: 'spell',
      characterName: 'TestSorcerer',
      targetName: 'TestSorcerer',
      targets: ['TestSorcerer'],
      spellName: 'Protection from Evil and Good',
      spellLevel: 1,
      castingTime: '1 Action',
      timestamp: expect.any(Number),
    });
  });
});

describe('useSpellMetamagicFlow — Shield of Faith Sorcerer flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getMultiTargetSpreadForSpell.mockReturnValueOnce(null);
  });

  it('sets pendingMetamagic for Shield of Faith (no gate)', () => {
    const { result } = renderHookWithSpell(
      (onExec) => useSpellMetamagicFlow({ playerStats: makePlayerStats(), campaignName: 'TestCampaign', onExecute: onExec }),
      'Shield of Faith',
      { level: 1 },
    );

    expect(result.current.pendingMetamagic).not.toBeNull();
    expect(result.current.pendingShieldOfFaith).toBeNull();
  });

  it('handleShieldOfFaithConfirm does nothing without pendingShieldOfFaith', () => {
    const onExecute = vi.fn();
    const { result } = renderHook(() =>
      useSpellMetamagicFlow({ playerStats: makePlayerStats(), campaignName: 'TestCampaign', onExecute: onExecute })
    );

    act(() => {
      result.current.handleShieldOfFaithConfirm(['Goblin A']);
    });

    expect(onExecute).not.toHaveBeenCalled();
  });

  it('handleShieldOfFaithSkip does nothing without pendingShieldOfFaith', () => {
    const onExecute = vi.fn();
    const { result } = renderHook(() =>
      useSpellMetamagicFlow({ playerStats: makePlayerStats(), campaignName: 'TestCampaign', onExecute: onExecute })
    );

    act(() => {
      result.current.handleShieldOfFaithSkip();
    });

    expect(onExecute).not.toHaveBeenCalled();
  });
});
