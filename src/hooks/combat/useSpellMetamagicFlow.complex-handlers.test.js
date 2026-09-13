// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSpellMetamagicFlow } from './useSpellMetamagicFlow.js';
import { addEntry } from '../../services/ui/logService.js';
import { consumeMaterial } from '../../services/rules/spells/materialComponents.js';

// ─── Minimal mocks (only what the tested handlers need) ────────────────────────

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
  applyEnhanceAbilityEffect: vi.fn(() => Promise.resolve(null)),
  applyProtectionFromPoisonHandler: vi.fn(() => Promise.resolve(null)),
  applyStoneSkinHandler: vi.fn(() => Promise.resolve(null)),
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

// ─── Factories ────────────────────────────────────────────────────────────────

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

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('useSpellMetamagicFlow — Enhance Ability confirm/skip', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('applies enhance ability effect, logs entry, and clears state on confirm', async () => {
    const { result } = renderHookWithSpell(
      (onExec) => useSpellMetamagicFlow({ playerStats: makePlayerStats(), campaignName: 'TestCampaign', onExecute: onExec }),
      'Enhance Ability',
      { level: 2 },
    );

    act(() => {
      result.current.handleEnhanceAbilityAbilitySelect('Bull\'s Strength');
    });

    expect(result.current.enhanceAbilityStage).toBe('target');

    await act(async () => {
      await result.current.handleEnhanceAbilityConfirm({ targetName: 'Goblin A' });
    });

    expect(addEntry).toHaveBeenCalledWith('TestCampaign', {
      type: 'spell',
      characterName: 'TestSorcerer',
      targetName: 'Goblin A',
      targets: ['Goblin A'],
      spellName: 'Enhance Ability',
      spellLevel: 2,
      castingTime: '1 Action',
      timestamp: expect.any(Number),
    });

    expect(result.current.enhanceAbilityStage).toBeNull();
    expect(result.current.pendingEnhanceAbility).toBeNull();
  });

  it('clears two-stage state and pending on skip', () => {
    const { result } = renderHookWithSpell(
      (onExec) => useSpellMetamagicFlow({ playerStats: makePlayerStats(), campaignName: 'TestCampaign', onExecute: onExec }),
      'Enhance Ability',
      { level: 2 },
    );

    act(() => {
      result.current.handleEnhanceAbilityAbilitySelect('Bull\'s Strength');
    });

    expect(result.current.enhanceAbilityStage).toBe('target');

    act(() => {
      result.current.handleEnhanceAbilitySkip();
    });

    expect(result.current.enhanceAbilityStage).toBeNull();
    expect(result.current.pendingEnhanceAbility).toBeNull();
  });

  it('does nothing when confirming without selecting an ability first', async () => {
    const { result } = renderHookWithSpell(
      (onExec) => useSpellMetamagicFlow({ playerStats: makePlayerStats(), campaignName: 'TestCampaign', onExecute: onExec }),
      'Enhance Ability',
      { level: 2 },
    );

    // No ability select — stage stays null, no pending data
    await act(async () => {
      await result.current.handleEnhanceAbilityConfirm({ targetName: 'Goblin A' });
    });

    expect(addEntry).not.toHaveBeenCalled();
  });

  it('does nothing when confirming with no pending state', async () => {
    const onExecute = vi.fn();
    const { result } = renderHook(() =>
      useSpellMetamagicFlow({ playerStats: makePlayerStats(), campaignName: 'TestCampaign', onExecute: onExecute })
    );

    await act(async () => {
      await result.current.handleEnhanceAbilityConfirm({ targetName: 'Goblin A' });
    });

    expect(onExecute).not.toHaveBeenCalled();
  });
});

describe('useSpellMetamagicFlow — Protection from Poison confirm/skip', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('applies protection from poison handler, logs entry, and clears pending on confirm', async () => {
    const { result } = renderHookWithSpell(
      (onExec) => useSpellMetamagicFlow({ playerStats: makePlayerStats(), campaignName: 'TestCampaign', onExecute: onExec }),
      'Protection from Poison',
      { level: 2 },
    );

    await act(async () => {
      await result.current.handleProtectionFromPoisonConfirm(['Goblin A']);
    });

    expect(addEntry).toHaveBeenCalledWith('TestCampaign', {
      type: 'spell',
      characterName: 'TestSorcerer',
      targetName: 'Goblin A',
      targets: ['Goblin A'],
      spellName: 'Protection from Poison',
      spellLevel: 2,
      castingTime: '1 Action',
      timestamp: expect.any(Number),
    });

    expect(result.current.pendingProtectionFromPoison).toBeNull();
  });

  it('clears pending on skip', () => {
    const { result } = renderHookWithSpell(
      (onExec) => useSpellMetamagicFlow({ playerStats: makePlayerStats(), campaignName: 'TestCampaign', onExecute: onExec }),
      'Protection from Poison',
      { level: 2 },
    );

    act(() => {
      result.current.handleProtectionFromPoisonSkip();
    });

    expect(result.current.pendingProtectionFromPoison).toBeNull();
  });

  it('does nothing when confirming with no pending state', async () => {
    const onExecute = vi.fn();
    const { result } = renderHook(() =>
      useSpellMetamagicFlow({ playerStats: makePlayerStats(), campaignName: 'TestCampaign', onExecute: onExecute })
    );

    await act(async () => {
      await result.current.handleProtectionFromPoisonConfirm(['Goblin A']);
    });

    expect(onExecute).not.toHaveBeenCalled();
  });
});

describe('useSpellMetamagicFlow — Stone Skin confirm/skip', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('consumes material, applies handler, logs entry, and clears pending on confirm', async () => {
    const { result } = renderHookWithSpell(
      (onExec) => useSpellMetamagicFlow({ playerStats: makePlayerStats(), campaignName: 'TestCampaign', onExecute: onExec }),
      'Stone Skin',
      { level: 3 },
    );

    await act(async () => {
      await result.current.handleStoneSkinConfirm('Goblin A');
    });

    expect(consumeMaterial).toHaveBeenCalledWith(
      expect.any(Object),
      'Diamond Dust (100 gp)',
      'TestCampaign'
    );

    expect(addEntry).toHaveBeenCalledWith('TestCampaign', {
      type: 'spell',
      characterName: 'TestSorcerer',
      targetName: 'Goblin A',
      targets: ['Goblin A'],
      spellName: 'Stone Skin',
      spellLevel: 3,
      castingTime: '1 Action',
      timestamp: expect.any(Number),
    });

    expect(result.current.pendingStoneSkin).toBeNull();
  });

  it('clears pending on skip', () => {
    const { result } = renderHookWithSpell(
      (onExec) => useSpellMetamagicFlow({ playerStats: makePlayerStats(), campaignName: 'TestCampaign', onExecute: onExec }),
      'Stone Skin',
      { level: 3 },
    );

    act(() => {
      result.current.handleStoneSkinSkip();
    });

    expect(result.current.pendingStoneSkin).toBeNull();
  });

  it('does nothing when confirming with no pending state', async () => {
    const onExecute = vi.fn();
    const { result } = renderHook(() =>
      useSpellMetamagicFlow({ playerStats: makePlayerStats(), campaignName: 'TestCampaign', onExecute: onExecute })
    );

    await act(async () => {
      await result.current.handleStoneSkinConfirm('Goblin A');
    });

    expect(onExecute).not.toHaveBeenCalled();
  });
});
