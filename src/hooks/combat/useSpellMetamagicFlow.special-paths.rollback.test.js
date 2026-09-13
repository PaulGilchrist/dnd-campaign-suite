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
import { setRuntimeValue } from '../runtime/useRuntimeState.js';
import { applyProtectionFromPoisonHandler } from '../../services/automation/index.js';

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
      // Dead so the SP-100 Revivify dead-target gate arms pending.
      { name: 'Goblin C', type: 'monster', currentHp: 0 },
    ],
  })),
}));

vi.mock('../../services/rules/spells/metamagicRules.js', () => ({
  isPsionicSpell: vi.fn(() => false),
  hasPsionicSorcery: vi.fn(() => false),
}));

vi.mock('../../services/automation/index.js', () => ({
  applyProtectionFromPoisonHandler: vi.fn(() => Promise.resolve(null)),
  applyStoneSkinHandler: vi.fn(() => Promise.resolve(null)),
  handleSanctuary: vi.fn(() => Promise.resolve(null)),
  executeHandler: vi.fn(() => Promise.resolve(null)),
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

// ── Two-stage handler stage-setting ──────────────────────────────────────────

describe('useSpellMetamagicFlow — two-stage handler initial stages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getMultiTargetSpreadForSpell.mockReturnValue(null);
  });

  const stageCases = [
    { spell: 'Resistance', level: 0, stageKey: 'resistanceStage', expected: 'target' },
    { spell: 'Protection from Energy', level: 3, stageKey: 'protectionFromEnergyStage', expected: 'target' },
    { spell: 'Enhance Ability', level: 2, stageKey: 'enhanceAbilityStage', expected: 'ability' },
  ];

  for (const tc of stageCases) {
    it(`sets ${tc.stageKey} to "${tc.expected}" when ${tc.spell} gates`, () => {
      const { result } = renderHook(() =>
        useSpellMetamagicFlow({ playerStats: makePlayerStats(), campaignName: 'TestCampaign', onExecute: vi.fn() })
      );

      act(() => {
        result.current.gateMetamagic(makeSpell({ name: tc.spell, level: tc.level }));
      });

      expect(result.current[tc.stageKey]).toBe(tc.expected);
    });
  }
});

// ── Skip handlers: rollback + logging ────────────────────────────────────────

describe('useSpellMetamagicFlow — skip handler rollback behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getMultiTargetSpreadForSpell.mockReturnValue(null);
  });

  it('handlesProtectionFromPoisonSkip: clears pending and logs, but does NOT roll back an unconsumed slot (SP-095)', async () => {
    const { result } = renderHook(() =>
      useSpellMetamagicFlow({ playerStats: makePlayerStats(), campaignName: 'TestCampaign', onExecute: vi.fn() })
    );

    act(() => {
      result.current.gateMetamagic(makeSpell({ name: 'Protection from Poison', level: 2 }));
    });

    expect(result.current.pendingProtectionFromPoison).not.toBeNull();

    act(() => {
      result.current.handleProtectionFromPoisonSkip();
    });

    expect(result.current.pendingProtectionFromPoison).toBeNull();
    expect(addEntry).toHaveBeenCalledWith('TestCampaign', expect.objectContaining({
      type: 'spell',
      characterName: 'TestSorcerer',
      spellName: 'Protection from Poison',
      spellLevel: 2,
      castingTime: '1 Action',
    }));
    // SP-095: the gate never spends the slot (it is spent at confirm), so skip
    // must not write any spell_slots rollback (that inflated slots above max).
    const slotWrites = setRuntimeValue.mock.calls.filter(c => String(c[1]).includes('spell_slots'));
    expect(slotWrites).toHaveLength(0);
  });

  it('handleStoneSkinSkip: clears pending, logs entry, and rolls back spell slot', async () => {
    const { result } = renderHook(() =>
      useSpellMetamagicFlow({ playerStats: makePlayerStats(), campaignName: 'TestCampaign', onExecute: vi.fn() })
    );

    act(() => {
      result.current.gateMetamagic(makeSpell({ name: 'Stone Skin', level: 3 }));
    });

    expect(result.current.pendingStoneSkin).not.toBeNull();

    act(() => {
      result.current.handleStoneSkinSkip();
    });

    expect(result.current.pendingStoneSkin).toBeNull();
    expect(addEntry).toHaveBeenCalledWith('TestCampaign', expect.objectContaining({
      type: 'spell',
      characterName: 'TestSorcerer',
      spellName: 'Stone Skin',
      spellLevel: 3,
      castingTime: '1 Action',
    }));
    expect(setRuntimeValue).toHaveBeenCalledWith('TestSorcerer', expect.stringContaining('spell_slots'), expect.any(Number), 'TestCampaign');
  });

  it('handleSanctuarySkip: clears pending and logs entry', () => {
    const { result } = renderHook(() =>
      useSpellMetamagicFlow({ playerStats: makePlayerStats(), campaignName: 'TestCampaign', onExecute: vi.fn() })
    );

    act(() => {
      result.current.gateMetamagic(makeSpell({ name: 'Sanctuary', level: 1 }));
    });

    act(() => {
      result.current.handleSanctuarySkip();
    });

    expect(result.current.pendingSanctuary).toBeNull();
    expect(addEntry).toHaveBeenCalledWith('TestCampaign', expect.objectContaining({
      type: 'spell',
      characterName: 'TestSorcerer',
      spellName: 'Sanctuary',
    }));
  });

  it('handleSleetStormSkip: clears pending and logs entry', () => {
    const { result } = renderHook(() =>
      useSpellMetamagicFlow({ playerStats: makePlayerStats(), campaignName: 'TestCampaign', onExecute: vi.fn() })
    );

    act(() => {
      result.current.gateMetamagic(makeSpell({ name: 'Sleet Storm', level: 3 }));
    });

    act(() => {
      result.current.handleSleetStormSkip();
    });

    expect(result.current.pendingSleetStorm).toBeNull();
    expect(addEntry).toHaveBeenCalledWith('TestCampaign', expect.objectContaining({
      type: 'spell',
      characterName: 'TestSorcerer',
      spellName: 'Sleet Storm',
    }));
  });
});

// ── Confirm handlers: guard behavior ─────────────────────────────────────────

describe('useSpellMetamagicFlow — confirm handler guards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getMultiTargetSpreadForSpell.mockReturnValue(null);
  });

  it('handleEnhanceAbilityConfirm: no-op when ability not selected', () => {
    const onExecute = vi.fn();
    const { result } = renderHook(() =>
      useSpellMetamagicFlow({ playerStats: makePlayerStats(), campaignName: 'TestCampaign', onExecute: onExecute })
    );

    act(() => {
      result.current.gateMetamagic(makeSpell({ name: 'Enhance Ability', level: 2 }));
    });

    act(() => {
      result.current.handleEnhanceAbilityConfirm({ targetName: 'Goblin A' });
    });

    expect(onExecute).not.toHaveBeenCalled();
    expect(addEntry).not.toHaveBeenCalled();
    expect(result.current.pendingEnhanceAbility).not.toBeNull();
  });

  it('handleProtectionFromPoisonConfirm: does not apply spell when result has no targetName', async () => {
    const onExecute = vi.fn();
    const { result } = renderHook(() =>
      useSpellMetamagicFlow({ playerStats: makePlayerStats(), campaignName: 'TestCampaign', onExecute: onExecute })
    );

    act(() => {
      result.current.gateMetamagic(makeSpell({ name: 'Protection from Poison', level: 2 }));
    });

    await act(async () => {
      await result.current.handleProtectionFromPoisonConfirm({});
    });

    expect(onExecute).not.toHaveBeenCalled();
    // Handler clears pending before checking targetName, so no log entry
    expect(addEntry).not.toHaveBeenCalled();
    // Actual spell handler NOT called (guard returns early after clearing pending)
    expect(applyProtectionFromPoisonHandler).not.toHaveBeenCalled();
    expect(result.current.pendingProtectionFromPoison).toBeNull();
  });

  it('handleRevivifyConfirm: does not apply spell when result has no targetName', async () => {
    const onExecute = vi.fn();
    const { result } = renderHook(() =>
      useSpellMetamagicFlow({ playerStats: makePlayerStats(), campaignName: 'TestCampaign', onExecute: onExecute })
    );

    act(() => {
      result.current.gateMetamagic(makeSpell({ name: 'Revivify', level: 5 }));
    });

    await act(async () => {
      await result.current.handleRevivifyConfirm({});
    });

    expect(onExecute).not.toHaveBeenCalled();
    // createConfirmHandler wrapper logs before inner guard check
    expect(addEntry).toHaveBeenCalled();
    // createConfirmHandler clears pending before calling inner handler
    expect(result.current.pendingRevivify).toBeNull();
  });
});

// ── Confirm handlers: successful execution ───────────────────────────────────

describe('useSpellMetamagicFlow — confirm handler execution', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getMultiTargetSpreadForSpell.mockReturnValue(null);
  });

  it('handleSanctuaryConfirm: applies sanctuary and clears pending', async () => {
    const automation = await import('../../services/automation/index.js');

    const { result } = renderHook(() =>
      useSpellMetamagicFlow({ playerStats: makePlayerStats(), campaignName: 'TestCampaign', onExecute: vi.fn() })
    );

    act(() => {
      result.current.gateMetamagic(makeSpell({ name: 'Sanctuary', level: 1 }));
    });

    expect(result.current.pendingSanctuary).not.toBeNull();

    await act(async () => {
      await result.current.handleSanctuaryConfirm('Goblin A');
    });

    expect(automation.handleSanctuary).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Sanctuary', automation: expect.objectContaining({ type: 'sanctuary' }) }),
      expect.any(Object),
      'TestCampaign',
      null
    );
    expect(result.current.pendingSanctuary).toBeNull();
  });

  it('handleSleetStormConfirm: executes handler and clears pending', async () => {
    const automation = await import('../../services/automation/index.js');

    const { result } = renderHook(() =>
      useSpellMetamagicFlow({ playerStats: makePlayerStats(), campaignName: 'TestCampaign', onExecute: vi.fn() })
    );

    act(() => {
      result.current.gateMetamagic(makeSpell({ name: 'Sleet Storm', level: 3 }));
    });

    expect(result.current.pendingSleetStorm).not.toBeNull();

    await act(async () => {
      await result.current.handleSleetStormConfirm(['Goblin A']);
    });

    expect(automation.executeHandler).toHaveBeenCalled();
    expect(result.current.pendingSleetStorm).toBeNull();
  });
});
