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

describe('useSpellMetamagicFlow — handleMultiTarget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCombatSummary.mockReturnValue({
      creatures: [{ name: 'Goblin A' }, { name: 'Goblin B' }],
    });
  });

  function setupMultiTarget() {
    getMultiTargetSpreadForSpell.mockReturnValueOnce({ range: '20 ft' });
    const onExecute = vi.fn();
    const { result } = renderHook(() =>
      useSpellMetamagicFlow(makePlayerStats(), 'TestCampaign', onExecute)
    );
    const spell = makeSpell({ name: 'Word of Radiance' });
    act(() => {
      result.current.gateMetamagic(spell);
    });
    return { result, onExecute, spell };
  }

  it('handleMultiTargetConfirm logs entry and calls onExecute with multiTarget', () => {
    const { result, onExecute, spell } = setupMultiTarget();

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

  it('handleMultiTargetConfirm calls onExecute with empty metaCtx when no secondTarget', () => {
    const { result, onExecute, spell } = setupMultiTarget();

    act(() => {
      result.current.handleMultiTargetConfirm({});
    });

    expect(onExecute).toHaveBeenCalledWith(spell, {});
  });

  it('handleMultiTargetConfirm does nothing when no pending', () => {
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

  it('handleMultiTargetSkip logs entry and calls onExecute with empty context', () => {
    const { result, onExecute, spell } = setupMultiTarget();

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

  it('handleMultiTargetSkip does nothing when no pending', () => {
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

describe('useSpellMetamagicFlow — handleAid', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function setupAid() {
    const onExecute = vi.fn();
    const { result } = renderHook(() =>
      useSpellMetamagicFlow(makePlayerStats(), 'TestCampaign', onExecute)
    );
    const spell = makeSpell({ name: 'Aid', level: 2 });
    act(() => {
      result.current.gateMetamagic(spell);
    });
    return { result, onExecute, spell };
  }

  it('handleAidConfirm applies aid effect and logs entry', async () => {
    const { result } = setupAid();
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
    expect(result.current.pendingAid).toBeNull();
  });

  it('handleAidConfirm does nothing when no pending', async () => {
    const onExecute = vi.fn();
    const { result } = renderHook(() =>
      useSpellMetamagicFlow(makePlayerStats(), 'TestCampaign', onExecute)
    );

    await act(async () => {
      await result.current.handleAidConfirm({ targets: ['Goblin A'] });
    });

    expect(addEntry).not.toHaveBeenCalled();
  });

  it('handleAidConfirm handles error gracefully', async () => {
    const { result } = setupAid();
    const automation = await import('../../services/automation/index.js');
    automation.applyAidEffect.mockRejectedValueOnce(new Error('boom'));

    await act(async () => {
      await result.current.handleAidConfirm({ targets: ['Goblin A'] });
    });

    expect(result.current.pendingAid).toBeNull();
    expect(addEntry).toHaveBeenCalled();
  });

  it('handleAidSkip logs entry and clears pending', () => {
    const { result } = setupAid();

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

  it('handleAidSkip does nothing when no pending', () => {
    const onExecute = vi.fn();
    const { result } = renderHook(() =>
      useSpellMetamagicFlow(makePlayerStats(), 'TestCampaign', onExecute)
    );

    act(() => {
      result.current.handleAidSkip();
    });

    expect(addEntry).not.toHaveBeenCalled();
  });
});

describe('useSpellMetamagicFlow — handleHeroesFeast', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function setupHeroesFeast() {
    const onExecute = vi.fn();
    const { result } = renderHook(() =>
      useSpellMetamagicFlow(makePlayerStats(), 'TestCampaign', onExecute)
    );
    const spell = makeSpell({ name: "Heroes' Feast", level: 6 });
    act(() => {
      result.current.gateMetamagic(spell);
    });
    return { result, onExecute, spell };
  }

  it('handleHeroesFeastConfirm applies effect and logs entry', async () => {
    const { result } = setupHeroesFeast();
    const automation = await import('../../services/automation/index.js');

    await act(async () => {
      await result.current.handleHeroesFeastConfirm({ targets: ['Goblin A', 'Goblin B'] });
    });

    expect(addEntry).toHaveBeenCalledWith('TestCampaign', expect.objectContaining({
      spellName: "Heroes' Feast",
    }));
    expect(automation.applyHeroesFeastEffect).toHaveBeenCalled();
    expect(result.current.pendingHeroesFeast).toBeNull();
  });

  it('handleHeroesFeastConfirm does nothing when no pending', async () => {
    const onExecute = vi.fn();
    const { result } = renderHook(() =>
      useSpellMetamagicFlow(makePlayerStats(), 'TestCampaign', onExecute)
    );

    await act(async () => {
      await result.current.handleHeroesFeastConfirm({ targets: [] });
    });

    expect(addEntry).not.toHaveBeenCalled();
  });

  it('handleHeroesFeastConfirm handles error gracefully', async () => {
    const { result } = setupHeroesFeast();
    const automation = await import('../../services/automation/index.js');
    automation.applyHeroesFeastEffect.mockRejectedValueOnce(new Error('boom'));

    await act(async () => {
      await result.current.handleHeroesFeastConfirm({ targets: ['Goblin A'] });
    });

    expect(result.current.pendingHeroesFeast).toBeNull();
  });

  it('handleHeroesFeastSkip logs entry and clears pending', () => {
    const { result } = setupHeroesFeast();

    act(() => {
      result.current.handleHeroesFeastSkip();
    });

    expect(addEntry).toHaveBeenCalledWith('TestCampaign', expect.objectContaining({
      spellName: "Heroes' Feast",
    }));
    expect(result.current.pendingHeroesFeast).toBeNull();
  });

  it('handleHeroesFeastSkip does nothing when no pending', () => {
    const onExecute = vi.fn();
    const { result } = renderHook(() =>
      useSpellMetamagicFlow(makePlayerStats(), 'TestCampaign', onExecute)
    );

    act(() => {
      result.current.handleHeroesFeastSkip();
    });

    expect(addEntry).not.toHaveBeenCalled();
  });
});

describe('useSpellMetamagicFlow — handleGreaterRestoration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function setupGreaterRestoration() {
    const onExecute = vi.fn();
    const { result } = renderHook(() =>
      useSpellMetamagicFlow(makePlayerStats(), 'TestCampaign', onExecute)
    );
    const spell = makeSpell({ name: 'Greater Restoration', level: 5 });
    act(() => {
      result.current.gateMetamagic(spell);
    });
    return { result, onExecute, spell };
  }

  it('handleGreaterRestorationConfirm applies effect and logs entry', async () => {
    const { result } = setupGreaterRestoration();
    const restorationService = await import('../../services/rules/features/greaterRestorationService.js');

    await act(async () => {
      await result.current.handleGreaterRestorationConfirm({ targetName: 'Goblin A' });
    });

    expect(addEntry).toHaveBeenCalledWith('TestCampaign', expect.objectContaining({
      spellName: 'Greater Restoration',
    }));
    expect(restorationService.confirmGreaterRestoration).toHaveBeenCalled();
    expect(result.current.pendingGreaterRestoration).toBeNull();
  });

  it('handleGreaterRestorationConfirm does nothing when no pending', async () => {
    const onExecute = vi.fn();
    const { result } = renderHook(() =>
      useSpellMetamagicFlow(makePlayerStats(), 'TestCampaign', onExecute)
    );

    await act(async () => {
      await result.current.handleGreaterRestorationConfirm({ targetName: 'Goblin A' });
    });

    expect(addEntry).not.toHaveBeenCalled();
  });

  it('handleGreaterRestorationConfirm handles error gracefully', async () => {
    const { result } = setupGreaterRestoration();
    const restorationService = await import('../../services/rules/features/greaterRestorationService.js');
    restorationService.confirmGreaterRestoration.mockRejectedValueOnce(new Error('boom'));

    await act(async () => {
      await result.current.handleGreaterRestorationConfirm({ targetName: 'Goblin A' });
    });

    expect(result.current.pendingGreaterRestoration).toBeNull();
  });

  it('handleGreaterRestorationSkip logs entry and clears pending', () => {
    const { result } = setupGreaterRestoration();

    act(() => {
      result.current.handleGreaterRestorationSkip();
    });

    expect(addEntry).toHaveBeenCalledWith('TestCampaign', expect.objectContaining({
      spellName: 'Greater Restoration',
    }));
    expect(result.current.pendingGreaterRestoration).toBeNull();
  });

  it('handleGreaterRestorationSkip does nothing when no pending', () => {
    const onExecute = vi.fn();
    const { result } = renderHook(() =>
      useSpellMetamagicFlow(makePlayerStats(), 'TestCampaign', onExecute)
    );

    act(() => {
      result.current.handleGreaterRestorationSkip();
    });

    expect(addEntry).not.toHaveBeenCalled();
  });
});

describe('useSpellMetamagicFlow — handleLesserRestoration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function setupLesserRestoration() {
    const onExecute = vi.fn();
    const { result } = renderHook(() =>
      useSpellMetamagicFlow(makePlayerStats(), 'TestCampaign', onExecute)
    );
    const spell = makeSpell({ name: 'Lesser Restoration', level: 2 });
    act(() => {
      result.current.gateMetamagic(spell);
    });
    return { result, onExecute, spell };
  }

  it('handleLesserRestorationConfirm applies effect and logs entry', async () => {
    const { result } = setupLesserRestoration();
    const automation = await import('../../services/automation/index.js');

    await act(async () => {
      await result.current.handleLesserRestorationConfirm({ targetName: 'Goblin A' });
    });

    expect(addEntry).toHaveBeenCalledWith('TestCampaign', expect.objectContaining({
      spellName: 'Lesser Restoration',
    }));
    expect(automation.applyLesserRestorationEffect).toHaveBeenCalled();
    expect(result.current.pendingLesserRestoration).toBeNull();
  });

  it('handleLesserRestorationConfirm does nothing when no pending', async () => {
    const onExecute = vi.fn();
    const { result } = renderHook(() =>
      useSpellMetamagicFlow(makePlayerStats(), 'TestCampaign', onExecute)
    );

    await act(async () => {
      await result.current.handleLesserRestorationConfirm({ targetName: 'Goblin A' });
    });

    expect(addEntry).not.toHaveBeenCalled();
  });

  it('handleLesserRestorationConfirm handles error gracefully', async () => {
    const { result } = setupLesserRestoration();
    const automation = await import('../../services/automation/index.js');
    automation.applyLesserRestorationEffect.mockRejectedValueOnce(new Error('boom'));

    await act(async () => {
      await result.current.handleLesserRestorationConfirm({ targetName: 'Goblin A' });
    });

    expect(result.current.pendingLesserRestoration).toBeNull();
  });

  it('handleLesserRestorationSkip logs entry and clears pending', () => {
    const { result } = setupLesserRestoration();

    act(() => {
      result.current.handleLesserRestorationSkip();
    });

    expect(addEntry).toHaveBeenCalledWith('TestCampaign', expect.objectContaining({
      spellName: 'Lesser Restoration',
    }));
    expect(result.current.pendingLesserRestoration).toBeNull();
  });

  it('handleLesserRestorationSkip does nothing when no pending', () => {
    const onExecute = vi.fn();
    const { result } = renderHook(() =>
      useSpellMetamagicFlow(makePlayerStats(), 'TestCampaign', onExecute)
    );

    act(() => {
      result.current.handleLesserRestorationSkip();
    });

    expect(addEntry).not.toHaveBeenCalled();
  });
});

describe('useSpellMetamagicFlow — handleRemoveCurse', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function setupRemoveCurse() {
    const onExecute = vi.fn();
    const { result } = renderHook(() =>
      useSpellMetamagicFlow(makePlayerStats(), 'TestCampaign', onExecute)
    );
    const spell = makeSpell({ name: 'Remove Curse', level: 3 });
    act(() => {
      result.current.gateMetamagic(spell);
    });
    return { result, onExecute, spell };
  }

  it('handleRemoveCurseConfirm applies effect and logs entry', async () => {
    const { result } = setupRemoveCurse();

    await act(async () => {
      await result.current.handleRemoveCurseConfirm({ targetName: 'Goblin A' });
    });

    expect(addEntry).toHaveBeenCalledWith('TestCampaign', expect.objectContaining({
      spellName: 'Remove Curse',
    }));
    expect(confirmRemoveCurse).toHaveBeenCalled();
    expect(result.current.pendingRemoveCurse).toBeNull();
  });

  it('handleRemoveCurseConfirm does nothing when no pending', async () => {
    const onExecute = vi.fn();
    const { result } = renderHook(() =>
      useSpellMetamagicFlow(makePlayerStats(), 'TestCampaign', onExecute)
    );

    await act(async () => {
      await result.current.handleRemoveCurseConfirm({ targetName: 'Goblin A' });
    });

    expect(addEntry).not.toHaveBeenCalled();
  });

  it('handleRemoveCurseConfirm handles error gracefully', async () => {
    const { result } = setupRemoveCurse();
    confirmRemoveCurse.mockRejectedValueOnce(new Error('boom'));

    await act(async () => {
      await result.current.handleRemoveCurseConfirm({ targetName: 'Goblin A' });
    });

    expect(result.current.pendingRemoveCurse).toBeNull();
  });

  it('handleRemoveCurseSkip logs entry and clears pending', () => {
    const { result } = setupRemoveCurse();

    act(() => {
      result.current.handleRemoveCurseSkip();
    });

    expect(addEntry).toHaveBeenCalledWith('TestCampaign', expect.objectContaining({
      spellName: 'Remove Curse',
    }));
    expect(result.current.pendingRemoveCurse).toBeNull();
  });

  it('handleRemoveCurseSkip does nothing when no pending', () => {
    const onExecute = vi.fn();
    const { result } = renderHook(() =>
      useSpellMetamagicFlow(makePlayerStats(), 'TestCampaign', onExecute)
    );

    act(() => {
      result.current.handleRemoveCurseSkip();
    });

    expect(addEntry).not.toHaveBeenCalled();
  });
});

describe('useSpellMetamagicFlow — handleMageArmor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function setupMageArmor() {
    const onExecute = vi.fn();
    const { result } = renderHook(() =>
      useSpellMetamagicFlow(makePlayerStats(), 'TestCampaign', onExecute)
    );
    const spell = makeSpell({ name: 'Mage Armor', level: 1 });
    act(() => {
      result.current.gateMetamagic(spell);
    });
    return { result, onExecute, spell };
  }

  it('handleMageArmorConfirm applies effect and logs entry', async () => {
    const { result } = setupMageArmor();
    const automation = await import('../../services/automation/index.js');

    await act(async () => {
      await result.current.handleMageArmorConfirm({ targetName: 'Goblin A' });
    });

    expect(addEntry).toHaveBeenCalledWith('TestCampaign', expect.objectContaining({
      spellName: 'Mage Armor',
    }));
    expect(automation.applyMageArmorEffect).toHaveBeenCalled();
    expect(result.current.pendingMageArmor).toBeNull();
  });

  it('handleMageArmorConfirm does nothing when no pending', async () => {
    const onExecute = vi.fn();
    const { result } = renderHook(() =>
      useSpellMetamagicFlow(makePlayerStats(), 'TestCampaign', onExecute)
    );

    await act(async () => {
      await result.current.handleMageArmorConfirm({ targetName: 'Goblin A' });
    });

    expect(addEntry).not.toHaveBeenCalled();
  });

  it('handleMageArmorConfirm handles error gracefully', async () => {
    const { result } = setupMageArmor();
    const automation = await import('../../services/automation/index.js');
    automation.applyMageArmorEffect.mockRejectedValueOnce(new Error('boom'));

    await act(async () => {
      await result.current.handleMageArmorConfirm({ targetName: 'Goblin A' });
    });

    expect(result.current.pendingMageArmor).toBeNull();
  });

  it('handleMageArmorSkip logs entry and clears pending', () => {
    const { result } = setupMageArmor();

    act(() => {
      result.current.handleMageArmorSkip();
    });

    expect(addEntry).toHaveBeenCalledWith('TestCampaign', expect.objectContaining({
      spellName: 'Mage Armor',
    }));
    expect(result.current.pendingMageArmor).toBeNull();
  });

  it('handleMageArmorSkip does nothing when no pending', () => {
    const onExecute = vi.fn();
    const { result } = renderHook(() =>
      useSpellMetamagicFlow(makePlayerStats(), 'TestCampaign', onExecute)
    );

    act(() => {
      result.current.handleMageArmorSkip();
    });

    expect(addEntry).not.toHaveBeenCalled();
  });
});

describe('useSpellMetamagicFlow — handleShieldOfFaith', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function setupShieldOfFaith() {
    const onExecute = vi.fn();
    const { result } = renderHook(() =>
      useSpellMetamagicFlow(makePlayerStats(), 'TestCampaign', onExecute)
    );
    const spell = makeSpell({ name: 'Shield of Faith', level: 1 });
    act(() => {
      result.current.gateMetamagic(spell);
    });
    return { result, onExecute, spell };
  }

  it('handleShieldOfFaithConfirm applies effect and logs entry', async () => {
    const { result } = setupShieldOfFaith();
    const automation = await import('../../services/automation/index.js');

    await act(async () => {
      await result.current.handleShieldOfFaithConfirm({ targetName: 'Goblin A' });
    });

    expect(addEntry).toHaveBeenCalledWith('TestCampaign', expect.objectContaining({
      spellName: 'Shield of Faith',
    }));
    expect(automation.applyShieldOfFaithEffect).toHaveBeenCalled();
    expect(result.current.pendingShieldOfFaith).toBeNull();
  });

  it('handleShieldOfFaithConfirm does nothing when no pending', async () => {
    const onExecute = vi.fn();
    const { result } = renderHook(() =>
      useSpellMetamagicFlow(makePlayerStats(), 'TestCampaign', onExecute)
    );

    await act(async () => {
      await result.current.handleShieldOfFaithConfirm({ targetName: 'Goblin A' });
    });

    expect(addEntry).not.toHaveBeenCalled();
  });

  it('handleShieldOfFaithConfirm handles error gracefully', async () => {
    const { result } = setupShieldOfFaith();
    const automation = await import('../../services/automation/index.js');
    automation.applyShieldOfFaithEffect.mockRejectedValueOnce(new Error('boom'));

    await act(async () => {
      await result.current.handleShieldOfFaithConfirm({ targetName: 'Goblin A' });
    });

    expect(result.current.pendingShieldOfFaith).toBeNull();
  });

  it('handleShieldOfFaithSkip logs entry and clears pending', () => {
    const { result } = setupShieldOfFaith();

    act(() => {
      result.current.handleShieldOfFaithSkip();
    });

    expect(addEntry).toHaveBeenCalledWith('TestCampaign', expect.objectContaining({
      spellName: 'Shield of Faith',
    }));
    expect(result.current.pendingShieldOfFaith).toBeNull();
  });

  it('handleShieldOfFaithSkip does nothing when no pending', () => {
    const onExecute = vi.fn();
    const { result } = renderHook(() =>
      useSpellMetamagicFlow(makePlayerStats(), 'TestCampaign', onExecute)
    );

    act(() => {
      result.current.handleShieldOfFaithSkip();
    });

    expect(addEntry).not.toHaveBeenCalled();
  });
});

describe('useSpellMetamagicFlow — handleProtectionFromEnergy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function setupProtectionFromEnergy() {
    const onExecute = vi.fn();
    const { result } = renderHook(() =>
      useSpellMetamagicFlow(makePlayerStats(), 'TestCampaign', onExecute)
    );
    const spell = makeSpell({ name: 'Protection from Energy', level: 3 });
    act(() => {
      result.current.gateMetamagic(spell);
    });
    return { result, onExecute, spell };
  }

  it('handleProtectionFromEnergyConfirm applies effect and logs entry', async () => {
    const { result } = setupProtectionFromEnergy();
    const automation = await import('../../services/automation/index.js');

    await act(async () => {
      await result.current.handleProtectionFromEnergyConfirm({ targetName: 'Goblin A', damageType: 'Fire' });
    });

    expect(addEntry).toHaveBeenCalledWith('TestCampaign', expect.objectContaining({
      spellName: 'Protection from Energy',
    }));
    expect(automation.applyProtectionFromEnergyHandler).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Protection from Energy' }),
      expect.any(Object),
      'TestCampaign',
      'Goblin A',
      'Fire'
    );
    expect(result.current.pendingProtectionFromEnergy).toBeNull();
  });

  it('handleProtectionFromEnergyConfirm does nothing when no pending', async () => {
    const onExecute = vi.fn();
    const { result } = renderHook(() =>
      useSpellMetamagicFlow(makePlayerStats(), 'TestCampaign', onExecute)
    );

    await act(async () => {
      await result.current.handleProtectionFromEnergyConfirm({ targetName: 'Goblin A', damageType: 'Fire' });
    });

    expect(addEntry).not.toHaveBeenCalled();
  });

  it('handleProtectionFromEnergyConfirm handles error gracefully', async () => {
    const { result } = setupProtectionFromEnergy();
    const automation = await import('../../services/automation/index.js');
    automation.applyProtectionFromEnergyHandler.mockRejectedValueOnce(new Error('boom'));

    await act(async () => {
      await result.current.handleProtectionFromEnergyConfirm({ targetName: 'Goblin A', damageType: 'Fire' });
    });

    expect(result.current.pendingProtectionFromEnergy).toBeNull();
  });

  it('handleProtectionFromEnergySkip logs entry and clears pending', () => {
    const { result } = setupProtectionFromEnergy();

    act(() => {
      result.current.handleProtectionFromEnergySkip();
    });

    expect(addEntry).toHaveBeenCalledWith('TestCampaign', expect.objectContaining({
      spellName: 'Protection from Energy',
    }));
    expect(result.current.pendingProtectionFromEnergy).toBeNull();
  });

  it('handleProtectionFromEnergySkip does nothing when no pending', () => {
    const onExecute = vi.fn();
    const { result } = renderHook(() =>
      useSpellMetamagicFlow(makePlayerStats(), 'TestCampaign', onExecute)
    );

    act(() => {
      result.current.handleProtectionFromEnergySkip();
    });

    expect(addEntry).not.toHaveBeenCalled();
  });
});

describe('useSpellMetamagicFlow — handleResistance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function setupResistance() {
    const onExecute = vi.fn();
    const { result } = renderHook(() =>
      useSpellMetamagicFlow(makePlayerStats(), 'TestCampaign', onExecute)
    );
    const spell = makeSpell({ name: 'Resistance', level: 0 });
    act(() => {
      result.current.gateMetamagic(spell);
    });
    return { result, onExecute, spell };
  }

  it('handleResistanceConfirm applies effect and logs entry', async () => {
    const { result } = setupResistance();
    const automation = await import('../../services/automation/index.js');

    await act(async () => {
      await result.current.handleResistanceConfirm({ targetName: 'Goblin A', damageType: 'Fire' });
    });

    expect(addEntry).toHaveBeenCalledWith('TestCampaign', expect.objectContaining({
      spellName: 'Resistance',
    }));
    expect(automation.applyResistanceEffect).toHaveBeenCalled();
    expect(result.current.pendingResistance).toBeNull();
  });

  it('handleResistanceConfirm does nothing when no pending', async () => {
    const onExecute = vi.fn();
    const { result } = renderHook(() =>
      useSpellMetamagicFlow(makePlayerStats(), 'TestCampaign', onExecute)
    );

    await act(async () => {
      await result.current.handleResistanceConfirm({ targetName: 'Goblin A', damageType: 'Fire' });
    });

    expect(addEntry).not.toHaveBeenCalled();
  });

  it('handleResistanceConfirm handles error gracefully', async () => {
    const { result } = setupResistance();
    const automation = await import('../../services/automation/index.js');
    automation.applyResistanceEffect.mockRejectedValueOnce(new Error('boom'));

    await act(async () => {
      await result.current.handleResistanceConfirm({ targetName: 'Goblin A', damageType: 'Fire' });
    });

    expect(result.current.pendingResistance).toBeNull();
  });

  it('handleResistanceSkip logs entry and clears pending', () => {
    const { result } = setupResistance();

    act(() => {
      result.current.handleResistanceSkip();
    });

    expect(addEntry).toHaveBeenCalledWith('TestCampaign', expect.objectContaining({
      spellName: 'Resistance',
    }));
    expect(result.current.pendingResistance).toBeNull();
  });

  it('handleResistanceSkip does nothing when no pending', () => {
    const onExecute = vi.fn();
    const { result } = renderHook(() =>
      useSpellMetamagicFlow(makePlayerStats(), 'TestCampaign', onExecute)
    );

    act(() => {
      result.current.handleResistanceSkip();
    });

    expect(addEntry).not.toHaveBeenCalled();
  });
});

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
    expect(addEntry).toHaveBeenCalledWith('TestCampaign', expect.objectContaining({
      spCost: 3,
      metamagic: ['Empowered Spell', 'Psionic Sorcery'],
    }));
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
    expect(addEntry).toHaveBeenCalledWith('TestCampaign', expect.objectContaining({
      spCost: 1,
    }));
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

    expect(addEntry).toHaveBeenCalledWith('TestCampaign', expect.objectContaining({
      metamagic: ['Empowered Spell'],
    }));
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
