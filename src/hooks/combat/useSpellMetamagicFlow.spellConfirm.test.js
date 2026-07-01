// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSpellMetamagicFlow } from './useSpellMetamagicFlow.js';
import { addEntry } from '../../services/ui/logService.js';
import { getCombatSummary } from '../../services/encounters/combatData.js';
import { getMultiTargetSpreadForSpell } from '../../services/rules/spells/postCastRiderService.js';
import { isPsionicSpell, hasPsionicSorcery } from '../../services/rules/spells/metamagicRules.js';
import { confirmRemoveCurse } from '../../services/rules/features/removeCurseService.js';
import { spendSorceryPoints } from './useMetamagic.js';

vi.mock('./useMetamagic.js', () => ({
  getCurrentSorceryPoints: vi.fn(() => 5),
  getMaxSorceryPoints: vi.fn(() => 10),
  spendSorceryPoints: vi.fn(),
}));

vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn(),
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
  applyProtectionFromEnergyHandler: vi.fn(),
  applyResistanceEffect: vi.fn(),
}));

vi.mock('../../services/rules/features/greaterRestorationService.js', () => ({
  confirmGreaterRestoration: vi.fn(),
}));

vi.mock('../../services/rules/features/removeCurseService.js', () => ({
  confirmRemoveCurse: vi.fn(),
}));

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

// ── Helpers ──────────────────────────────────────────────────────────────────

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

// ── Multi-target ─────────────────────────────────────────────────────────────

describe('useSpellMetamagicFlow — handleMultiTarget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCombatSummary.mockReturnValue({
      creatures: [{ name: 'Goblin A' }, { name: 'Goblin B' }],
    });
  });

  it('logs entry with Words of Creation metamagic and calls onExecute with multiTarget', () => {
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

    expect(addEntry).toHaveBeenCalledWith('TestCampaign', {
      type: 'spell',
      characterName: 'TestSorcerer',
      spellName: 'Word of Radiance',
      spellLevel: 3,
      castingTime: '1 Action',
      metamagic: ['Words of Creation'],
      spCost: 0,
      timestamp: expect.any(Number),
    });
    expect(onExecute).toHaveBeenCalledWith(spell, { multiTarget: 'Goblin B' });
    expect(result.current.pendingMultiTarget).toBeNull();
  });

  it('calls onExecute with empty context when no secondTarget is provided', () => {
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
  });

  it('does nothing when there is no pending multi-target', () => {
    const onExecute = vi.fn();
    const { result } = renderHook(() =>
      useSpellMetamagicFlow(makePlayerStats(), 'TestCampaign', onExecute)
    );

    act(() => {
      result.current.handleMultiTargetConfirm({ secondTarget: 'Goblin B' });
    });

    expect(addEntry).not.toHaveBeenCalled();
    expect(onExecute).not.toHaveBeenCalled();
  });

  it('logs entry with empty metamagic and calls onExecute with empty context on skip', () => {
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

    expect(addEntry).toHaveBeenCalledWith('TestCampaign', {
      type: 'spell',
      characterName: 'TestSorcerer',
      spellName: 'Word of Radiance',
      spellLevel: 3,
      castingTime: '1 Action',
      metamagic: [],
      spCost: 0,
      timestamp: expect.any(Number),
    });
    expect(onExecute).toHaveBeenCalledWith(spell, {});
    expect(result.current.pendingMultiTarget).toBeNull();
  });

  it('does nothing on skip when there is no pending multi-target', () => {
    const onExecute = vi.fn();
    const { result } = renderHook(() =>
      useSpellMetamagicFlow(makePlayerStats(), 'TestCampaign', onExecute)
    );

    act(() => {
      result.current.handleMultiTargetSkip();
    });

    expect(addEntry).not.toHaveBeenCalled();
    expect(onExecute).not.toHaveBeenCalled();
  });
});

// ── Spell-specific handlers ──────────────────────────────────────────────────

describe('useSpellMetamagicFlow — handleAid', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const setup = () => renderHookWithSpell(
    (onExecute) => useSpellMetamagicFlow(makePlayerStats(), 'TestCampaign', onExecute),
    'Aid',
    { level: 2 },
  );

  it('applies aid effect, logs entry, and clears pending on confirm', async () => {
    const { result, onExecute } = setup();
    const automation = await import('../../services/automation/index.js');

    await act(async () => {
      await result.current.handleAidConfirm({ targets: ['Goblin A', 'Goblin B'] });
    });

    expect(addEntry).toHaveBeenCalledWith('TestCampaign', {
      type: 'spell',
      characterName: 'TestSorcerer',
      spellName: 'Aid',
      spellLevel: 2,
      castingTime: '1 Action',
      metamagic: [],
      spCost: 0,
      timestamp: expect.any(Number),
    });
    expect(automation.applyAidEffect).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Aid' }),
      expect.any(Object),
      'TestCampaign',
      null,
      { targets: ['Goblin A', 'Goblin B'] }
    );
    expect(onExecute).not.toHaveBeenCalled();
    expect(result.current.pendingAid).toBeNull();
  });

  it('does nothing when there is no pending aid', async () => {
    const onExecute = vi.fn();
    const { result } = renderHook(() =>
      useSpellMetamagicFlow(makePlayerStats(), 'TestCampaign', onExecute)
    );

    await act(async () => {
      await result.current.handleAidConfirm({ targets: ['Goblin A'] });
    });

    expect(addEntry).not.toHaveBeenCalled();
    expect(onExecute).not.toHaveBeenCalled();
  });

  it('re-throws when applyAidEffect rejects', async () => {
    const { result } = setup();
    const automation = await import('../../services/automation/index.js');
    automation.applyAidEffect.mockRejectedValueOnce(new Error('boom'));

    await expect(
      act(async () => {
        await result.current.handleAidConfirm({ targets: ['Goblin A'] });
      })
    ).rejects.toThrow('boom');
  });

  it('logs entry and clears pending on skip', () => {
    const { result } = setup();

    act(() => {
      result.current.handleAidSkip();
    });

    expect(addEntry).toHaveBeenCalledWith('TestCampaign', {
      type: 'spell',
      characterName: 'TestSorcerer',
      spellName: 'Aid',
      spellLevel: 2,
      castingTime: '1 Action',
      metamagic: [],
      spCost: 0,
      timestamp: expect.any(Number),
    });
    expect(result.current.pendingAid).toBeNull();
  });

  it('does nothing on skip when there is no pending aid', () => {
    const onExecute = vi.fn();
    const { result } = renderHook(() =>
      useSpellMetamagicFlow(makePlayerStats(), 'TestCampaign', onExecute)
    );

    act(() => {
      result.current.handleAidSkip();
    });

    expect(addEntry).not.toHaveBeenCalled();
    expect(onExecute).not.toHaveBeenCalled();
  });
});

describe('useSpellMetamagicFlow — handleHeroesFeast', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const setup = () => renderHookWithSpell(
    (onExecute) => useSpellMetamagicFlow(makePlayerStats(), 'TestCampaign', onExecute),
    "Heroes' Feast",
    { level: 6 },
  );

  it('applies heroes feast effect, logs entry, and clears pending on confirm', async () => {
    const { result, onExecute } = setup();
    const automation = await import('../../services/automation/index.js');

    await act(async () => {
      await result.current.handleHeroesFeastConfirm({ targets: ['Goblin A', 'Goblin B'] });
    });

    expect(addEntry).toHaveBeenCalledWith('TestCampaign', {
      type: 'spell',
      characterName: 'TestSorcerer',
      spellName: "Heroes' Feast",
      spellLevel: 6,
      castingTime: '1 Action',
      metamagic: [],
      spCost: 0,
      timestamp: expect.any(Number),
    });
    expect(automation.applyHeroesFeastEffect).toHaveBeenCalled();
    expect(onExecute).not.toHaveBeenCalled();
    expect(result.current.pendingHeroesFeast).toBeNull();
  });

  it('does nothing when there is no pending heroes feast', async () => {
    const onExecute = vi.fn();
    const { result } = renderHook(() =>
      useSpellMetamagicFlow(makePlayerStats(), 'TestCampaign', onExecute)
    );

    await act(async () => {
      await result.current.handleHeroesFeastConfirm({ targets: [] });
    });

    expect(addEntry).not.toHaveBeenCalled();
    expect(onExecute).not.toHaveBeenCalled();
  });

  it('re-throws when applyHeroesFeastEffect rejects', async () => {
    const { result } = setup();
    const automation = await import('../../services/automation/index.js');
    automation.applyHeroesFeastEffect.mockRejectedValueOnce(new Error('boom'));

    await expect(
      act(async () => {
        await result.current.handleHeroesFeastConfirm({ targets: ['Goblin A'] });
      })
    ).rejects.toThrow('boom');
  });

  it('logs entry and clears pending on skip', () => {
    const { result } = setup();

    act(() => {
      result.current.handleHeroesFeastSkip();
    });

    expect(addEntry).toHaveBeenCalledWith('TestCampaign', {
      type: 'spell',
      characterName: 'TestSorcerer',
      spellName: "Heroes' Feast",
      spellLevel: 6,
      castingTime: '1 Action',
      metamagic: [],
      spCost: 0,
      timestamp: expect.any(Number),
    });
    expect(result.current.pendingHeroesFeast).toBeNull();
  });

  it('does nothing on skip when there is no pending heroes feast', () => {
    const onExecute = vi.fn();
    const { result } = renderHook(() =>
      useSpellMetamagicFlow(makePlayerStats(), 'TestCampaign', onExecute)
    );

    act(() => {
      result.current.handleHeroesFeastSkip();
    });

    expect(addEntry).not.toHaveBeenCalled();
    expect(onExecute).not.toHaveBeenCalled();
  });
});

describe('useSpellMetamagicFlow — handleGreaterRestoration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const setup = () => renderHookWithSpell(
    (onExecute) => useSpellMetamagicFlow(makePlayerStats(), 'TestCampaign', onExecute),
    'Greater Restoration',
    { level: 5 },
  );

  it('applies greater restoration effect, logs entry, and clears pending on confirm', async () => {
    const { result, onExecute } = setup();
    const restorationService = await import('../../services/rules/features/greaterRestorationService.js');

    await act(async () => {
      await result.current.handleGreaterRestorationConfirm({ targetName: 'Goblin A' });
    });

    expect(addEntry).toHaveBeenCalledWith('TestCampaign', {
      type: 'spell',
      characterName: 'TestSorcerer',
      spellName: 'Greater Restoration',
      spellLevel: 5,
      castingTime: '1 Action',
      metamagic: [],
      spCost: 0,
      timestamp: expect.any(Number),
    });
    expect(restorationService.confirmGreaterRestoration).toHaveBeenCalled();
    expect(onExecute).not.toHaveBeenCalled();
    expect(result.current.pendingGreaterRestoration).toBeNull();
  });

  it('does nothing when there is no pending greater restoration', async () => {
    const onExecute = vi.fn();
    const { result } = renderHook(() =>
      useSpellMetamagicFlow(makePlayerStats(), 'TestCampaign', onExecute)
    );

    await act(async () => {
      await result.current.handleGreaterRestorationConfirm({ targetName: 'Goblin A' });
    });

    expect(addEntry).not.toHaveBeenCalled();
    expect(onExecute).not.toHaveBeenCalled();
  });

  it('re-throws when confirmGreaterRestoration rejects', async () => {
    const { result } = setup();
    const restorationService = await import('../../services/rules/features/greaterRestorationService.js');
    restorationService.confirmGreaterRestoration.mockRejectedValueOnce(new Error('boom'));

    await expect(
      act(async () => {
        await result.current.handleGreaterRestorationConfirm({ targetName: 'Goblin A' });
      })
    ).rejects.toThrow('boom');
  });

  it('logs entry and clears pending on skip', () => {
    const { result } = setup();

    act(() => {
      result.current.handleGreaterRestorationSkip();
    });

    expect(addEntry).toHaveBeenCalledWith('TestCampaign', {
      type: 'spell',
      characterName: 'TestSorcerer',
      spellName: 'Greater Restoration',
      spellLevel: 5,
      castingTime: '1 Action',
      metamagic: [],
      spCost: 0,
      timestamp: expect.any(Number),
    });
    expect(result.current.pendingGreaterRestoration).toBeNull();
  });

  it('does nothing on skip when there is no pending greater restoration', () => {
    const onExecute = vi.fn();
    const { result } = renderHook(() =>
      useSpellMetamagicFlow(makePlayerStats(), 'TestCampaign', onExecute)
    );

    act(() => {
      result.current.handleGreaterRestorationSkip();
    });

    expect(addEntry).not.toHaveBeenCalled();
    expect(onExecute).not.toHaveBeenCalled();
  });
});

describe('useSpellMetamagicFlow — handleLesserRestoration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const setup = () => renderHookWithSpell(
    (onExecute) => useSpellMetamagicFlow(makePlayerStats(), 'TestCampaign', onExecute),
    'Lesser Restoration',
    { level: 2 },
  );

  it('applies lesser restoration effect, logs entry, and clears pending on confirm', async () => {
    const { result, onExecute } = setup();
    const automation = await import('../../services/automation/index.js');

    await act(async () => {
      await result.current.handleLesserRestorationConfirm({ targetName: 'Goblin A' });
    });

    expect(addEntry).toHaveBeenCalledWith('TestCampaign', {
      type: 'spell',
      characterName: 'TestSorcerer',
      spellName: 'Lesser Restoration',
      spellLevel: 2,
      castingTime: '1 Action',
      metamagic: [],
      spCost: 0,
      timestamp: expect.any(Number),
    });
    expect(automation.applyLesserRestorationEffect).toHaveBeenCalled();
    expect(onExecute).not.toHaveBeenCalled();
    expect(result.current.pendingLesserRestoration).toBeNull();
  });

  it('does nothing when there is no pending lesser restoration', async () => {
    const onExecute = vi.fn();
    const { result } = renderHook(() =>
      useSpellMetamagicFlow(makePlayerStats(), 'TestCampaign', onExecute)
    );

    await act(async () => {
      await result.current.handleLesserRestorationConfirm({ targetName: 'Goblin A' });
    });

    expect(addEntry).not.toHaveBeenCalled();
    expect(onExecute).not.toHaveBeenCalled();
  });

  it('re-throws when applyLesserRestorationEffect rejects', async () => {
    const { result } = setup();
    const automation = await import('../../services/automation/index.js');
    automation.applyLesserRestorationEffect.mockRejectedValueOnce(new Error('boom'));

    await expect(
      act(async () => {
        await result.current.handleLesserRestorationConfirm({ targetName: 'Goblin A' });
      })
    ).rejects.toThrow('boom');
  });

  it('logs entry and clears pending on skip', () => {
    const { result } = setup();

    act(() => {
      result.current.handleLesserRestorationSkip();
    });

    expect(addEntry).toHaveBeenCalledWith('TestCampaign', {
      type: 'spell',
      characterName: 'TestSorcerer',
      spellName: 'Lesser Restoration',
      spellLevel: 2,
      castingTime: '1 Action',
      metamagic: [],
      spCost: 0,
      timestamp: expect.any(Number),
    });
    expect(result.current.pendingLesserRestoration).toBeNull();
  });

  it('does nothing on skip when there is no pending lesser restoration', () => {
    const onExecute = vi.fn();
    const { result } = renderHook(() =>
      useSpellMetamagicFlow(makePlayerStats(), 'TestCampaign', onExecute)
    );

    act(() => {
      result.current.handleLesserRestorationSkip();
    });

    expect(addEntry).not.toHaveBeenCalled();
    expect(onExecute).not.toHaveBeenCalled();
  });
});

describe('useSpellMetamagicFlow — handleRemoveCurse', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const setup = () => renderHookWithSpell(
    (onExecute) => useSpellMetamagicFlow(makePlayerStats(), 'TestCampaign', onExecute),
    'Remove Curse',
    { level: 3 },
  );

  it('applies remove curse effect, logs entry, and clears pending on confirm', async () => {
    const { result, onExecute } = setup();

    await act(async () => {
      await result.current.handleRemoveCurseConfirm({ targetName: 'Goblin A' });
    });

    expect(addEntry).toHaveBeenCalledWith('TestCampaign', {
      type: 'spell',
      characterName: 'TestSorcerer',
      spellName: 'Remove Curse',
      spellLevel: 3,
      castingTime: '1 Action',
      metamagic: [],
      spCost: 0,
      timestamp: expect.any(Number),
    });
    expect(confirmRemoveCurse).toHaveBeenCalled();
    expect(onExecute).not.toHaveBeenCalled();
    expect(result.current.pendingRemoveCurse).toBeNull();
  });

  it('does nothing when there is no pending remove curse', async () => {
    const onExecute = vi.fn();
    const { result } = renderHook(() =>
      useSpellMetamagicFlow(makePlayerStats(), 'TestCampaign', onExecute)
    );

    await act(async () => {
      await result.current.handleRemoveCurseConfirm({ targetName: 'Goblin A' });
    });

    expect(addEntry).not.toHaveBeenCalled();
    expect(onExecute).not.toHaveBeenCalled();
  });

  it('re-throws when confirmRemoveCurse rejects', async () => {
    const { result } = setup();
    confirmRemoveCurse.mockRejectedValueOnce(new Error('boom'));

    await expect(
      act(async () => {
        await result.current.handleRemoveCurseConfirm({ targetName: 'Goblin A' });
      })
    ).rejects.toThrow('boom');
  });

  it('logs entry and clears pending on skip', () => {
    const { result } = setup();

    act(() => {
      result.current.handleRemoveCurseSkip();
    });

    expect(addEntry).toHaveBeenCalledWith('TestCampaign', {
      type: 'spell',
      characterName: 'TestSorcerer',
      spellName: 'Remove Curse',
      spellLevel: 3,
      castingTime: '1 Action',
      metamagic: [],
      spCost: 0,
      timestamp: expect.any(Number),
    });
    expect(result.current.pendingRemoveCurse).toBeNull();
  });

  it('does nothing on skip when there is no pending remove curse', () => {
    const onExecute = vi.fn();
    const { result } = renderHook(() =>
      useSpellMetamagicFlow(makePlayerStats(), 'TestCampaign', onExecute)
    );

    act(() => {
      result.current.handleRemoveCurseSkip();
    });

    expect(addEntry).not.toHaveBeenCalled();
    expect(onExecute).not.toHaveBeenCalled();
  });
});

describe('useSpellMetamagicFlow — handleMageArmor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const setup = () => renderHookWithSpell(
    (onExecute) => useSpellMetamagicFlow(makePlayerStats(), 'TestCampaign', onExecute),
    'Mage Armor',
    { level: 1 },
  );

  it('applies mage armor effect, logs entry, and clears pending on confirm', async () => {
    const { result, onExecute } = setup();
    const automation = await import('../../services/automation/index.js');

    await act(async () => {
      await result.current.handleMageArmorConfirm({ targetName: 'Goblin A' });
    });

    expect(addEntry).toHaveBeenCalledWith('TestCampaign', {
      type: 'spell',
      characterName: 'TestSorcerer',
      spellName: 'Mage Armor',
      spellLevel: 1,
      castingTime: '1 Action',
      metamagic: [],
      spCost: 0,
      timestamp: expect.any(Number),
    });
    expect(automation.applyMageArmorEffect).toHaveBeenCalled();
    expect(onExecute).not.toHaveBeenCalled();
    expect(result.current.pendingMageArmor).toBeNull();
  });

  it('does nothing when there is no pending mage armor', async () => {
    const onExecute = vi.fn();
    const { result } = renderHook(() =>
      useSpellMetamagicFlow(makePlayerStats(), 'TestCampaign', onExecute)
    );

    await act(async () => {
      await result.current.handleMageArmorConfirm({ targetName: 'Goblin A' });
    });

    expect(addEntry).not.toHaveBeenCalled();
    expect(onExecute).not.toHaveBeenCalled();
  });

  it('re-throws when applyMageArmorEffect rejects', async () => {
    const { result } = setup();
    const automation = await import('../../services/automation/index.js');
    automation.applyMageArmorEffect.mockRejectedValueOnce(new Error('boom'));

    await expect(
      act(async () => {
        await result.current.handleMageArmorConfirm({ targetName: 'Goblin A' });
      })
    ).rejects.toThrow('boom');
  });

  it('logs entry and clears pending on skip', () => {
    const { result } = setup();

    act(() => {
      result.current.handleMageArmorSkip();
    });

    expect(addEntry).toHaveBeenCalledWith('TestCampaign', {
      type: 'spell',
      characterName: 'TestSorcerer',
      spellName: 'Mage Armor',
      spellLevel: 1,
      castingTime: '1 Action',
      metamagic: [],
      spCost: 0,
      timestamp: expect.any(Number),
    });
    expect(result.current.pendingMageArmor).toBeNull();
  });

  it('does nothing on skip when there is no pending mage armor', () => {
    const onExecute = vi.fn();
    const { result } = renderHook(() =>
      useSpellMetamagicFlow(makePlayerStats(), 'TestCampaign', onExecute)
    );

    act(() => {
      result.current.handleMageArmorSkip();
    });

    expect(addEntry).not.toHaveBeenCalled();
    expect(onExecute).not.toHaveBeenCalled();
  });
});

describe('useSpellMetamagicFlow — handleProtectionFromEnergy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const setup = () => renderHookWithSpell(
    (onExecute) => useSpellMetamagicFlow(makePlayerStats(), 'TestCampaign', onExecute),
    'Protection from Energy',
    { level: 3 },
  );

  it('applies protection from energy effect, logs entry, and clears pending on confirm', async () => {
    const { result, onExecute } = setup();
    const automation = await import('../../services/automation/index.js');

    await act(async () => {
      await result.current.handleProtectionFromEnergyConfirm({ targetName: 'Goblin A', damageType: 'Fire' });
    });

    expect(addEntry).toHaveBeenCalledWith('TestCampaign', {
      type: 'spell',
      characterName: 'TestSorcerer',
      spellName: 'Protection from Energy',
      spellLevel: 3,
      castingTime: '1 Action',
      metamagic: [],
      spCost: 0,
      timestamp: expect.any(Number),
    });
    expect(automation.applyProtectionFromEnergyHandler).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Protection from Energy' }),
      expect.any(Object),
      'TestCampaign',
      'Goblin A',
      'Fire'
    );
    expect(onExecute).not.toHaveBeenCalled();
    expect(result.current.pendingProtectionFromEnergy).toBeNull();
  });

  it('does nothing when there is no pending protection from energy', async () => {
    const onExecute = vi.fn();
    const { result } = renderHook(() =>
      useSpellMetamagicFlow(makePlayerStats(), 'TestCampaign', onExecute)
    );

    await act(async () => {
      await result.current.handleProtectionFromEnergyConfirm({ targetName: 'Goblin A', damageType: 'Fire' });
    });

    expect(addEntry).not.toHaveBeenCalled();
    expect(onExecute).not.toHaveBeenCalled();
  });

  it('re-throws when applyProtectionFromEnergyHandler rejects', async () => {
    const { result } = setup();
    const automation = await import('../../services/automation/index.js');
    automation.applyProtectionFromEnergyHandler.mockRejectedValueOnce(new Error('boom'));

    await expect(
      act(async () => {
        await result.current.handleProtectionFromEnergyConfirm({ targetName: 'Goblin A', damageType: 'Fire' });
      })
    ).rejects.toThrow('boom');
  });

  it('logs entry and clears pending on skip', () => {
    const { result } = setup();

    act(() => {
      result.current.handleProtectionFromEnergySkip();
    });

    expect(addEntry).toHaveBeenCalledWith('TestCampaign', {
      type: 'spell',
      characterName: 'TestSorcerer',
      spellName: 'Protection from Energy',
      spellLevel: 3,
      castingTime: '1 Action',
      metamagic: [],
      spCost: 0,
      timestamp: expect.any(Number),
    });
    expect(result.current.pendingProtectionFromEnergy).toBeNull();
  });

  it('does nothing on skip when there is no pending protection from energy', () => {
    const onExecute = vi.fn();
    const { result } = renderHook(() =>
      useSpellMetamagicFlow(makePlayerStats(), 'TestCampaign', onExecute)
    );

    act(() => {
      result.current.handleProtectionFromEnergySkip();
    });

    expect(addEntry).not.toHaveBeenCalled();
    expect(onExecute).not.toHaveBeenCalled();
  });
});

describe('useSpellMetamagicFlow — handleResistance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const setup = () => renderHookWithSpell(
    (onExecute) => useSpellMetamagicFlow(makePlayerStats(), 'TestCampaign', onExecute),
    'Resistance',
    { level: 0 },
  );

  it('applies resistance effect, logs entry, and clears pending on confirm', async () => {
    const { result, onExecute } = setup();
    const automation = await import('../../services/automation/index.js');

    await act(async () => {
      await result.current.handleResistanceConfirm({ targetName: 'Goblin A', damageType: 'Fire' });
    });

    expect(addEntry).toHaveBeenCalledWith('TestCampaign', {
      type: 'spell',
      characterName: 'TestSorcerer',
      spellName: 'Resistance',
      spellLevel: 0,
      castingTime: '1 Action',
      metamagic: [],
      spCost: 0,
      timestamp: expect.any(Number),
    });
    expect(automation.applyResistanceEffect).toHaveBeenCalled();
    expect(onExecute).not.toHaveBeenCalled();
    expect(result.current.pendingResistance).toBeNull();
  });

  it('does nothing when there is no pending resistance', async () => {
    const onExecute = vi.fn();
    const { result } = renderHook(() =>
      useSpellMetamagicFlow(makePlayerStats(), 'TestCampaign', onExecute)
    );

    await act(async () => {
      await result.current.handleResistanceConfirm({ targetName: 'Goblin A', damageType: 'Fire' });
    });

    expect(addEntry).not.toHaveBeenCalled();
    expect(onExecute).not.toHaveBeenCalled();
  });

  it('re-throws when applyResistanceEffect rejects', async () => {
    const { result } = setup();
    const automation = await import('../../services/automation/index.js');
    automation.applyResistanceEffect.mockRejectedValueOnce(new Error('boom'));

    await expect(
      act(async () => {
        await result.current.handleResistanceConfirm({ targetName: 'Goblin A', damageType: 'Fire' });
      })
    ).rejects.toThrow('boom');
  });

  it('logs entry and clears pending on skip', () => {
    const { result } = setup();

    act(() => {
      result.current.handleResistanceSkip();
    });

    expect(addEntry).toHaveBeenCalledWith('TestCampaign', {
      type: 'spell',
      characterName: 'TestSorcerer',
      spellName: 'Resistance',
      spellLevel: 0,
      castingTime: '1 Action',
      metamagic: [],
      spCost: 0,
      timestamp: expect.any(Number),
    });
    expect(result.current.pendingResistance).toBeNull();
  });

  it('does nothing on skip when there is no pending resistance', () => {
    const onExecute = vi.fn();
    const { result } = renderHook(() =>
      useSpellMetamagicFlow(makePlayerStats(), 'TestCampaign', onExecute)
    );

    act(() => {
      result.current.handleResistanceSkip();
    });

    expect(addEntry).not.toHaveBeenCalled();
    expect(onExecute).not.toHaveBeenCalled();
  });
});

describe('useSpellMetamagicFlow — handleMagicMissile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const setup = () => renderHookWithSpell(
    (onExecute) => useSpellMetamagicFlow(makePlayerStats(), 'TestCampaign', onExecute),
    'Magic Missile',
    { level: 1 },
  );

  it('calls onExecute with magicMissileDistribution and slotLevel on confirm with targets', () => {
    const { result, onExecute, spell } = setup();

    act(() => {
      result.current.handleMagicMissileConfirm({
        distribution: { 'Goblin A': 2, 'Goblin B': 1 },
      });
    });

    expect(onExecute).toHaveBeenCalledWith(spell, {
      magicMissileDistribution: { 'Goblin A': 2, 'Goblin B': 1 },
      slotLevel: 1,
    });
    expect(addEntry).not.toHaveBeenCalled();
    expect(result.current.pendingMagicMissile).toBeNull();
  });

  it('does nothing when all distribution values are zero', () => {
    const { result, onExecute } = setup();

    act(() => {
      result.current.handleMagicMissileConfirm({
        distribution: { 'Goblin A': 0, 'Goblin B': 0 },
      });
    });

    expect(onExecute).not.toHaveBeenCalled();
    expect(addEntry).not.toHaveBeenCalled();
    expect(result.current.pendingMagicMissile).toBeNull();
  });

  it('does nothing when there is no pending magic missile', () => {
    const onExecute = vi.fn();
    const { result } = renderHook(() =>
      useSpellMetamagicFlow(makePlayerStats(), 'TestCampaign', onExecute)
    );

    act(() => {
      result.current.handleMagicMissileConfirm({
        distribution: { 'Goblin A': 1 },
      });
    });

    expect(onExecute).not.toHaveBeenCalled();
    expect(addEntry).not.toHaveBeenCalled();
  });

  it('clears pendingMagicMissile on skip', () => {
    const { result } = setup();

    act(() => {
      result.current.handleMagicMissileSkip();
    });

    expect(result.current.pendingMagicMissile).toBeNull();
  });

  it('does nothing on skip when there is no pending magic missile', () => {
    const onExecute = vi.fn();
    const { result } = renderHook(() =>
      useSpellMetamagicFlow(makePlayerStats(), 'TestCampaign', onExecute)
    );

    act(() => {
      result.current.handleMagicMissileSkip();
    });

    expect(onExecute).not.toHaveBeenCalled();
    expect(addEntry).not.toHaveBeenCalled();
  });
});

// ── Psionic sorcery confirm ──────────────────────────────────────────────────

describe('useSpellMetamagicFlow — handleConfirm with psionic sorcery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function setupPsionicPending() {
    isPsionicSpell.mockReturnValueOnce(true);
    hasPsionicSorcery.mockReturnValueOnce(true);

    const onExecute = vi.fn();
    const { result } = renderHook(() =>
      useSpellMetamagicFlow(makePlayerStats(), 'TestCampaign', onExecute)
    );

    act(() => {
      result.current.gateMetamagic(makeSpell({ name: 'Mind Sliver', level: 2 }));
    });

    return { result, onExecute };
  }

  it('adds psionic cost to total cost when psionic and no Subtle Spell', () => {
    const { result, onExecute } = setupPsionicPending();

    act(() => {
      result.current.handleConfirm({ totalCost: 1, options: ['Empowered Spell'] });
    });

    expect(spendSorceryPoints).toHaveBeenCalledWith(
      'TestSorcerer', 3, 'TestCampaign', expect.any(Number)
    );
    expect(addEntry).toHaveBeenCalledWith('TestCampaign', {
      type: 'spell',
      characterName: 'TestSorcerer',
      spellName: 'Mind Sliver',
      spellLevel: 2,
      castingTime: '1 Action',
      metamagic: ['Empowered Spell', 'Psionic Sorcery'],
      spCost: 3,
      timestamp: expect.any(Number),
    });
    expect(onExecute).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ psionicSpell: true })
    );
  });

  it('does not add psionic cost when Subtle Spell is used', () => {
    const { result } = setupPsionicPending();

    act(() => {
      result.current.handleConfirm({ totalCost: 1, options: ['Subtle Spell'] });
    });

    expect(spendSorceryPoints).toHaveBeenCalledWith(
      'TestSorcerer', 1, 'TestCampaign', expect.any(Number)
    );
    expect(addEntry).toHaveBeenCalledWith('TestCampaign', {
      type: 'spell',
      characterName: 'TestSorcerer',
      spellName: 'Mind Sliver',
      spellLevel: 2,
      castingTime: '1 Action',
      metamagic: ['Subtle Spell'],
      spCost: 1,
      timestamp: expect.any(Number),
    });
  });

  it('does not add Psionic Sorcery to options when psionicCost is 0', () => {
    isPsionicSpell.mockReturnValueOnce(false);

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

    expect(addEntry).toHaveBeenCalledWith('TestCampaign', {
      type: 'spell',
      characterName: 'TestSorcerer',
      spellName: 'Fireball',
      spellLevel: 3,
      castingTime: '1 Action',
      metamagic: ['Empowered Spell'],
      spCost: 2,
      timestamp: expect.any(Number),
    });
  });

  it('does not include psionicSpell in metaCtx when psionicCost is 0', () => {
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

    expect(onExecute).toHaveBeenCalledWith(
      expect.any(Object),
      expect.not.objectContaining({ psionicSpell: true })
    );
  });
});
