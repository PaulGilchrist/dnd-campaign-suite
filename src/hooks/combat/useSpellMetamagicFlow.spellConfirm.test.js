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
import { isPsionicSpell, hasPsionicSorcery } from '../../services/rules/spells/metamagicRules.js';
import { confirmRemoveCurse } from '../../services/rules/features/removeCurseService.js';
import { spendSorceryPoints } from './useMetamagic.js';
import { getCombatSummary } from '../../services/encounters/combatData.js';

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

vi.mock('../../services/encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(() => ({
    creatures: [
      { name: 'Goblin A' },
      { name: 'Goblin B' },
      { name: 'Goblin C' },
    ],
  })),
  getCurrentCombatRound: vi.fn(() => 1),
}));

vi.mock('../../services/rules/spells/metamagicRules.js', () => ({
  isPsionicSpell: vi.fn(() => false),
  hasPsionicSorcery: vi.fn(() => false),
}));

vi.mock('../../services/rules/features/removeCurseService.js', () => ({
  confirmRemoveCurse: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('../../services/rules/spells/materialComponents.js', () => ({
  getConsumedMaterial: vi.fn(() => null),
  hasMaterial: vi.fn(() => true),
  consumeMaterial: vi.fn(() => Promise.resolve(true)),
  getMaterialRequirementMessage: vi.fn(() => null),
}));

// CLA-271: passthrough prepareSpellCast mock so options (usePsionicPayment) are assertable
vi.mock('../../services/rules/spells/spellPreparationService.js', async (importOriginal) => ({
  ...(await importOriginal()),
  prepareSpellCast: vi.fn(async (spell, metaCtx) => ({
    modifiedSpell: spell,
    metaCtx: { ...metaCtx },
    slotConsumed: false,
    freeCastUsed: false,
  })),
  isFreeCastAuthorized: vi.fn(() => false),
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

// ── Multi-target flow ────────────────────────────────────────────────────────

describe('useSpellMetamagicFlow — multi-target flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCombatSummary.mockReturnValue({
      creatures: [{ name: 'Goblin A' }, { name: 'Goblin B' }],
    });
  });

  it('logs entry, calls onExecute with multiTarget, and clears pending on confirm', () => {
    getMultiTargetSpreadForSpell.mockReturnValueOnce({ range: '20 ft' });
    const onExecute = vi.fn();
    const { result } = renderHook(() =>
      useSpellMetamagicFlow(makePlayerStats(), 'TestCampaign', onExecute)
    );
    const spell = makeSpell({ name: 'Word of Radiance' });
    act(() => {
      result.current.gateMetamagic(spell);
    });

    act(() => {
      result.current.handleMultiTargetConfirm({ secondTarget: 'Goblin B' });
    });

    expect(addEntry).toHaveBeenCalledWith('TestCampaign', expect.objectContaining({
      type: 'spell',
      characterName: 'TestSorcerer',
      targetName: 'Goblin A',
      targets: ['Goblin A', 'Goblin B'],
      spellName: 'Word of Radiance',
      spellLevel: 3,
      castingTime: '1 Action',
      timestamp: expect.any(Number),
    }));
    expect(onExecute).toHaveBeenCalledWith(spell, { multiTarget: 'Goblin B' });
    expect(result.current.pendingMultiTarget).toBeNull();
  });

  it('logs entry, calls onExecute with empty context, and clears pending when secondTarget is omitted', () => {
    getMultiTargetSpreadForSpell.mockReturnValueOnce({ range: '20 ft' });
    const onExecute = vi.fn();
    const { result } = renderHook(() =>
      useSpellMetamagicFlow(makePlayerStats(), 'TestCampaign', onExecute)
    );
    const spell = makeSpell({ name: 'Word of Radiance' });
    act(() => {
      result.current.gateMetamagic(spell);
    });

    act(() => {
      result.current.handleMultiTargetConfirm({});
    });

    expect(onExecute).toHaveBeenCalledWith(spell, {});
    expect(addEntry).toHaveBeenCalledWith('TestCampaign', expect.objectContaining({
      spellName: 'Word of Radiance',
      targets: ['Goblin A', 'Goblin B'],
    }));
    expect(result.current.pendingMultiTarget).toBeNull();
  });

  it('logs entry, calls onExecute with empty context, and clears pending on skip', () => {
    getMultiTargetSpreadForSpell.mockReturnValueOnce({ range: '20 ft' });
    const onExecute = vi.fn();
    const { result } = renderHook(() =>
      useSpellMetamagicFlow(makePlayerStats(), 'TestCampaign', onExecute)
    );
    const spell = makeSpell({ name: 'Word of Radiance' });
    act(() => {
      result.current.gateMetamagic(spell);
    });

    act(() => {
      result.current.handleMultiTargetSkip();
    });

    expect(onExecute).toHaveBeenCalledWith(spell, {});
    expect(addEntry).toHaveBeenCalledWith('TestCampaign', expect.objectContaining({
      spellName: 'Word of Radiance',
    }));
    expect(result.current.pendingMultiTarget).toBeNull();
  });

  it('does nothing when multi-target handler is called without pending state', () => {
    const onExecute = vi.fn();
    const { result } = renderHook(() =>
      useSpellMetamagicFlow(makePlayerStats(), 'TestCampaign', onExecute)
    );

    act(() => {
      result.current.handleMultiTargetConfirm({ secondTarget: 'Goblin B' });
    });

    expect(onExecute).not.toHaveBeenCalled();
    expect(addEntry).not.toHaveBeenCalled();
  });

  it('does nothing when multi-target skip is called without pending state', () => {
    const onExecute = vi.fn();
    const { result } = renderHook(() =>
      useSpellMetamagicFlow(makePlayerStats(), 'TestCampaign', onExecute)
    );

    act(() => {
      result.current.handleMultiTargetSkip();
    });

    expect(onExecute).not.toHaveBeenCalled();
    expect(addEntry).not.toHaveBeenCalled();
  });
});

// ── Spell-specific confirm handlers (behavioral) ─────────────────────────────

describe('useSpellMetamagicFlow — spell confirm handlers verify behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('clears pending state and logs entry for Resistance two-stage confirm flow', async () => {
    const { result, onExecute } = renderHookWithSpell(
      (onExec) => useSpellMetamagicFlow(makePlayerStats(), 'TestCampaign', onExec),
      'Resistance',
      { level: 0 },
    );

    await act(async () => {
      await result.current.handleResistanceTargetSelect('Goblin A');
    });

    expect(result.current.resistanceStage).toBe('type');

    await act(async () => {
      await result.current.handleResistanceTypeSelect('Fire');
    });

    expect(onExecute).not.toHaveBeenCalled();
    expect(result.current.pendingResistance).toBeNull();
    expect(result.current.resistanceStage).toBeNull();
    expect(addEntry).toHaveBeenCalledWith('TestCampaign', expect.objectContaining({
      spellName: 'Resistance',
      targetName: 'Goblin A',
      targets: ['Goblin A'],
    }));
  });

  it('clears pending state and logs entry for Remove Curse confirm', async () => {
    const { result, onExecute } = renderHookWithSpell(
      (onExec) => useSpellMetamagicFlow(makePlayerStats(), 'TestCampaign', onExec),
      'Remove Curse',
      { level: 3 },
    );

    await act(async () => {
      await result.current.handleRemoveCurseConfirm({ targetName: 'Goblin A' });
    });

    expect(confirmRemoveCurse).toHaveBeenCalled();
    expect(onExecute).not.toHaveBeenCalled();
    expect(result.current.pendingRemoveCurse).toBeNull();
    expect(addEntry).toHaveBeenCalledWith('TestCampaign', expect.objectContaining({
      spellName: 'Remove Curse',
    }));
  });

  it('clears pending state and logs entry for Magic Missile confirm with distribution', async () => {
    const { result, onExecute, spell } = renderHookWithSpell(
      (onExec) => useSpellMetamagicFlow(makePlayerStats(), 'TestCampaign', onExec),
      'Magic Missile',
      { level: 1 },
    );

    await act(async () => {
      await result.current.handleMagicMissileConfirm({
        distribution: { 'Goblin A': 2, 'Goblin B': 1 },
      });
    });

    expect(onExecute).toHaveBeenCalledWith(spell, expect.objectContaining({
      magicMissileDistribution: { 'Goblin A': 2, 'Goblin B': 1 },
      slotLevel: 1,
    }));
    expect(result.current.pendingMagicMissile).toBeNull();
    expect(addEntry).not.toHaveBeenCalled();
  });

  it('does not execute or log when Magic Missile distribution is all zeros', async () => {
    const { result, onExecute } = renderHookWithSpell(
      (onExec) => useSpellMetamagicFlow(makePlayerStats(), 'TestCampaign', onExec),
      'Magic Missile',
      { level: 1 },
    );

    await act(async () => {
      await result.current.handleMagicMissileConfirm({
        distribution: { 'Goblin A': 0, 'Goblin B': 0 },
      });
    });

    expect(onExecute).not.toHaveBeenCalled();
    expect(addEntry).not.toHaveBeenCalled();
    expect(result.current.pendingMagicMissile).toBeNull();
  });
});

// ── Spell-specific skip handlers (behavioral) ────────────────────────────────

describe('useSpellMetamagicFlow — spell skip handlers verify behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('clears pending state on Magic Missile skip without logging', () => {
    const { result } = renderHookWithSpell(
      (onExec) => useSpellMetamagicFlow(makePlayerStats(), 'TestCampaign', onExec),
      'Magic Missile',
      { level: 1 },
    );

    act(() => {
      result.current.handleMagicMissileSkip();
    });

    expect(result.current.pendingMagicMissile).toBeNull();
    expect(addEntry).not.toHaveBeenCalled();
  });

  it('clears pending state and logs entry for Resistance skip', () => {
    const { result } = renderHookWithSpell(
      (onExec) => useSpellMetamagicFlow(makePlayerStats(), 'TestCampaign', onExec),
      'Resistance',
      { level: 0 },
    );

    act(() => {
      result.current.handleResistanceSkip();
    });

    expect(result.current.pendingResistance).toBeNull();
    expect(result.current.resistanceStage).toBeNull();
    expect(addEntry).toHaveBeenCalledWith('TestCampaign', expect.objectContaining({
      spellName: 'Resistance',
      targetName: null,
    }));
  });
});

// ── Psionic Sorcery confirm flow ─────────────────────────────────────────────

describe('useSpellMetamagicFlow — psionic sorcery confirm flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function setupPsionic() {
    isPsionicSpell.mockReturnValue(true);
    hasPsionicSorcery.mockReturnValue(true);

    const onExecute = vi.fn();
    const { result } = renderHook(() =>
      useSpellMetamagicFlow(makePlayerStats(), 'TestCampaign', onExecute)
    );

    act(() => {
      result.current.gateMetamagic(makeSpell({ name: 'Mind Sliver', level: 1 }));
    });

    return { result, onExecute };
  }

  it('counts metamagic cost once and forwards psionic payment when Psionic Sorcery selected', async () => {
    const { result, onExecute } = setupPsionic();

    // CLA-271: popup confirms metamagic-options cost only; psionic SP payment is
    // paid by prepareSpellCast (usePsionicPayment forwarded), not re-added here.
    act(() => {
      result.current.handleConfirm({ totalCost: 1, options: ['Empowered Spell'], psionicActive: true });
    });

    await new Promise(r => setTimeout(r, 0));

    expect(spendSorceryPoints).toHaveBeenCalledWith(
      'TestSorcerer', 1, 'TestCampaign', expect.any(Number)
    );

    expect(addEntry).toHaveBeenCalledWith('TestCampaign', expect.objectContaining({
      metamagic: expect.arrayContaining(['Psionic Sorcery', 'Empowered Spell']),
      spCost: 2,
    }));
    expect(onExecute).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ psionicSpell: true })
    );
  });

  it('forwards usePsionicPayment from the spell detail opt-in even without popup checkbox', async () => {
    const onExecute = vi.fn();
    const { prepareSpellCast } = await import('../../services/rules/spells/spellPreparationService.js');
    const { result } = renderHook(() =>
      useSpellMetamagicFlow(makePlayerStats(), 'TestCampaign', onExecute)
    );

    isPsionicSpell.mockReturnValue(true);
    hasPsionicSorcery.mockReturnValue(true);

    act(() => {
      result.current.gateMetamagic(makeSpell({ name: 'Mind Sliver', level: 1, usePsionicPayment: true }));
    });

    await act(async () => {
      await result.current.handleConfirm({ totalCost: 0, options: [], psionicActive: false });
    });

    expect(spendSorceryPoints).not.toHaveBeenCalled();
    expect(prepareSpellCast).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ psionicSpell: true }),
      expect.objectContaining({ usePsionicPayment: true })
    );
  });

  it('does not add psionic cost or Psionic Sorcery when Subtle Spell is selected', async () => {
    const { result, onExecute } = setupPsionic();

    act(() => {
      result.current.handleConfirm({ totalCost: 1, options: ['Subtle Spell'] });
    });

    await new Promise(r => setTimeout(r, 0));

    expect(spendSorceryPoints).toHaveBeenCalledWith(
      'TestSorcerer', 1, 'TestCampaign', expect.any(Number)
    );
    expect(addEntry).toHaveBeenCalledWith('TestCampaign', expect.objectContaining({
      metamagic: ['Subtle Spell'],
      spCost: 1,
    }));
    expect(onExecute).not.toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ psionicSpell: true })
    );
  });

  it('does not add psionic cost when psionic cost is 0', async () => {
    isPsionicSpell.mockReturnValue(false);

    const onExecute = vi.fn();
    const { result } = renderHook(() =>
      useSpellMetamagicFlow(makePlayerStats(), 'TestCampaign', onExecute)
    );

    act(() => {
      result.current.gateMetamagic(makeSpell({ name: 'Fireball', level: 3 }));
    });

    act(() => {
      result.current.handleConfirm({ totalCost: 2, options: ['Empowered Spell'] });
    });

    await new Promise(r => setTimeout(r, 0));

    expect(addEntry).toHaveBeenCalledWith('TestCampaign', expect.objectContaining({
      metamagic: ['Empowered Spell'],
      spCost: 2,
    }));
    expect(onExecute).toHaveBeenCalledWith(
      expect.any(Object),
      expect.not.objectContaining({ psionicSpell: true })
    );
  });

  it('handles confirm with null options gracefully', async () => {
    const { result } = setupPsionic();

    act(() => {
      result.current.handleConfirm({ totalCost: 0 });
    });

    await new Promise(r => setTimeout(r, 0));

    // CLA-271: psionic payment requires an explicit selection — no re-add.
    expect(addEntry).toHaveBeenCalledWith('TestCampaign', expect.objectContaining({
      metamagic: [],
      spCost: 0,
    }));
  });

  it('handles confirm with zero total cost and no psionic', async () => {
    isPsionicSpell.mockReturnValue(false);

    const onExecute = vi.fn();
    const { result } = renderHook(() =>
      useSpellMetamagicFlow(makePlayerStats(), 'TestCampaign', onExecute)
    );

    act(() => {
      result.current.gateMetamagic(makeSpell({ name: 'Fireball', level: 3 }));
    });

    act(() => {
      result.current.handleConfirm({ totalCost: 0, options: [] });
    });

    await new Promise(r => setTimeout(r, 0));

    expect(onExecute).toHaveBeenCalledWith(
      expect.any(Object),
      expect.not.objectContaining({ psionicSpell: true })
    );
  });
});

// ── General handleConfirm / handleSkip (metamagic flow) ──────────────────────

describe('useSpellMetamagicFlow — general confirm/skip handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('handleConfirm does nothing when no pending metamagic', async () => {
    const onExecute = vi.fn();
    const { result } = renderHook(() =>
      useSpellMetamagicFlow(makePlayerStats(), 'TestCampaign', onExecute)
    );

    act(() => {
      result.current.handleConfirm({ totalCost: 1, options: ['Empowered Spell'] });
    });

    await new Promise(r => setTimeout(r, 0));

    expect(onExecute).not.toHaveBeenCalled();
  });

  it('handleSkip does nothing when no pending metamagic', async () => {
    const onExecute = vi.fn();
    const { result } = renderHook(() =>
      useSpellMetamagicFlow(makePlayerStats(), 'TestCampaign', onExecute)
    );

    act(() => {
      result.current.handleSkip();
    });

    await new Promise(r => setTimeout(r, 0));

    expect(onExecute).not.toHaveBeenCalled();
  });
});
