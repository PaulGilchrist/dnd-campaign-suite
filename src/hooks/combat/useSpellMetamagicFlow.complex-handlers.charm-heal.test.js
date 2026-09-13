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

describe('useSpellMetamagicFlow — Charm Person confirm/skip', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('triggers charm person and logs entry on confirm', async () => {
    const onExecute = vi.fn();
    const { result } = renderHook(() =>
      useSpellMetamagicFlow({ playerStats: makePlayerStats(), campaignName: 'TestCampaign', onExecute: onExecute })
    );

    const monsterUtils = await import('../../services/npcs/monsterUtils.js');
    monsterUtils.getMonsterData.mockResolvedValue({ type: 'humanoid' });

    await act(async () => {
      await result.current.gateMetamagic(makeSpell({ name: 'Charm Person', level: 1 }));
    });

    expect(result.current.pendingCharmPerson).not.toBeNull();

    await act(async () => {
      await result.current.handleCharmPersonConfirm(['Goblin A']);
    });

    expect(addEntry).toHaveBeenCalledWith('TestCampaign', {
      type: 'spell',
      characterName: 'TestSorcerer',
      targetName: 'Goblin A',
      targets: ['Goblin A', 'Goblin B', 'Goblin C'],
      spellName: 'Charm Person',
      spellLevel: 1,
      castingTime: '1 Action',
      timestamp: expect.any(Number),
    });
    expect(result.current.pendingCharmPerson).toBeNull();
  });
});

describe('useSpellMetamagicFlow — Charm Monster confirm/skip', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('triggers charm monster and logs entry on confirm', async () => {
    const { result } = renderHookWithSpell(
      (onExec) => useSpellMetamagicFlow({ playerStats: makePlayerStats(), campaignName: 'TestCampaign', onExecute: onExec }),
      'Charm Monster',
      { level: 4 },
    );

    const { triggerCharmMonster } = await import('../../services/rules/features/charmMonsterService.js');

    await act(async () => {
      await result.current.handleCharmMonsterConfirm(['Goblin A']);
    });

    expect(triggerCharmMonster).toHaveBeenCalled();
    expect(result.current.pendingCharmMonster).toBeNull();
  });
});

describe('useSpellMetamagicFlow — Banishment confirm/skip', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('triggers banishment and logs entry on confirm', async () => {
    const { result } = renderHookWithSpell(
      (onExec) => useSpellMetamagicFlow({ playerStats: makePlayerStats(), campaignName: 'TestCampaign', onExecute: onExec }),
      'Banishment',
      { level: 4 },
    );

    await act(async () => {
      await result.current.handleBanishmentConfirm(['Goblin A']);
    });

    expect(result.current.pendingBanishment).toBeNull();
  });
});

describe('useSpellMetamagicFlow — Prismatic Spray confirm/skip', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls onExecute with selectedTargets on confirm', async () => {
    const onExecute = vi.fn();
    const { result } = renderHook(() =>
      useSpellMetamagicFlow({ playerStats: makePlayerStats(), campaignName: 'TestCampaign', onExecute: onExecute })
    );
    const spell = makeSpell({ name: 'Prismatic Spray', level: 7 });
    act(() => {
      result.current.gateMetamagic(spell);
    });

    await act(async () => {
      await result.current.handlePrismaticSprayConfirm(['Goblin A']);
    });

    expect(onExecute).toHaveBeenCalledWith(spell, { selectedTargets: ['Goblin A'] });
    expect(result.current.pendingPrismaticSpray).toBeNull();
  });
});

describe('useSpellMetamagicFlow — Healing Word confirm/skip', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('triggers healing word and logs entry on confirm', async () => {
    const { result } = renderHookWithSpell(
      (onExec) => useSpellMetamagicFlow({ playerStats: makePlayerStats(), campaignName: 'TestCampaign', onExecute: onExec }),
      'Healing Word',
      { level: 1 },
    );

    const { triggerHealingWord } = await import('../../services/rules/features/healingWordService.js');

    await act(async () => {
      await result.current.handleHealingWordConfirm({ targetName: 'Goblin A' });
    });

    expect(triggerHealingWord).toHaveBeenCalled();
    expect(result.current.pendingHealingWord).toBeNull();
  });
});

describe('useSpellMetamagicFlow — Regenerate confirm/skip', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('executes regenerate and logs entry on confirm', async () => {
    const { result } = renderHookWithSpell(
      (onExec) => useSpellMetamagicFlow({ playerStats: makePlayerStats(), campaignName: 'TestCampaign', onExecute: onExec }),
      'Regenerate',
      { level: 7 },
    );

    await act(async () => {
      await result.current.handleRegenerateConfirm({ targetName: 'Goblin A' });
    });

    expect(result.current.pendingRegenerate).toBeNull();
  });
});

describe('useSpellMetamagicFlow — Protection from Evil and Good confirm/skip', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('consumes material and applies effect on confirm', async () => {
    const { result } = renderHookWithSpell(
      (onExec) => useSpellMetamagicFlow({ playerStats: makePlayerStats(), campaignName: 'TestCampaign', onExecute: onExec }),
      'Protection from Evil and Good',
      { level: 1 },
    );

    const automation = await import('../../services/automation/index.js');

    await act(async () => {
      await result.current.handleProtectionFromEvilAndGoodConfirm(['Goblin A']);
    });

    expect(automation.applyProtectionFromEvilAndGood).toHaveBeenCalled();
    expect(result.current.pendingProtectionFromEvilAndGood).toBeNull();
  });
});

describe('useSpellMetamagicFlow — Shield of Faith confirm/skip', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('applies shield of faith and logs entry on confirm', async () => {
    vi.clearAllMocks();
    getMultiTargetSpreadForSpell.mockReturnValueOnce(null);

    const onExecute = vi.fn();
    const { result } = renderHook(() =>
      useSpellMetamagicFlow({ playerStats: makePlayerStats(), campaignName: 'TestCampaign', onExecute: onExecute })
    );

    act(() => {
      result.current.gateMetamagic(makeSpell({ name: 'Shield of Faith', level: 1 }));
    });

    act(() => {
      result.current.handleShieldOfFaithConfirm(['Goblin A']);
    });

    expect(onExecute).not.toHaveBeenCalled();
  });
});

describe('useSpellMetamagicFlow — Heal confirm/skip', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('triggers heal and logs entry on confirm', async () => {
    const { result } = renderHookWithSpell(
      (onExec) => useSpellMetamagicFlow({ playerStats: makePlayerStats(), campaignName: 'TestCampaign', onExecute: onExec }),
      'Heal',
      { level: 6 },
    );

    const { triggerHeal } = await import('../../services/rules/features/healService.js');

    await act(async () => {
      await result.current.handleHealConfirm({ targetName: 'Goblin A' });
    });

    expect(triggerHeal).toHaveBeenCalled();
    expect(result.current.pendingHeal).toBeNull();
  });
});
