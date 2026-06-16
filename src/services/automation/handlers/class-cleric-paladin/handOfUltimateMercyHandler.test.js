import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../dice/diceRoller.js', () => ({
  rollExpression: vi.fn(),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
}));

vi.mock('../../../shared/logPoster.js', () => ({
  postLogEntry: vi.fn(),
}));

vi.mock('../../../ui/storage.js', () => ({
  default: {
    set: vi.fn(),
  },
}));

vi.mock('../../common/targetResolver.js', () => ({
  resolveTarget: vi.fn(),
}));

import { handle } from './handOfUltimateMercyHandler.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { rollExpression } from '../../../dice/diceRoller.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { postLogEntry } from '../../../shared/logPoster.js';
import storage from '../../../ui/storage.js';
import { resolveTarget } from '../../common/targetResolver.js';

const campaignName = 'TestCampaign';

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestCleric',
    level: 5,
    class: { class_levels: [{ level: 5, focus_points: 10 }] },
    ...overrides,
  };
}

function makeAction(automation = {}) {
  return {
    name: 'Hand of Ultimate Mercy',
    automation: { resourceCostAmount: 5, healExpression: '4d10', ...automation },
  };
}

describe('handOfUltimateMercyHandler.handle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return popup when not enough focus points', async () => {
    getRuntimeValue.mockReturnValue(2);
    const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('Not enough Focus Points');
  });

  it('should use maxFP as default when storedFP is null', async () => {
    getRuntimeValue.mockReturnValue(null);
    const ps = makePlayerStats({ class: { class_levels: [{ level: 5, focus_points: 3 }] } });
    const result = await handle(makeAction(), ps, campaignName, null);

    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('have 3');
  });

  it('should use _trackedResources fallback when storedFP is null and no class level', async () => {
    getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'focusPoints') return null;
      return null;
    });
    const ps = makePlayerStats({
      class: { class_levels: [] },
      _trackedResources: { focusPoints: { current: 3 } },
    });
    const result = await handle(makeAction(), ps, campaignName, null);

    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('have 3');
  });

  it('should return popup when no target selected', async () => {
    getRuntimeValue.mockReturnValue(5);
    resolveTarget.mockResolvedValue(null);

    const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('Select a target in combat first');
  });

  it('should return popup when target is not at 0 HP (player type)', async () => {
    getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'focusPoints') return 5;
      if (key === 'currentHitPoints') return 5;
      return null;
    });
    resolveTarget.mockResolvedValue({ target: { name: 'DownedAlly', type: 'player' } });

    const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('DownedAlly is not at 0 Hit Points');
  });

  it('should return popup when target is not at 0 HP (npc type)', async () => {
    getRuntimeValue.mockReturnValue(5);
    resolveTarget.mockResolvedValue({ target: { name: 'Goblin', type: 'npc', currentHp: 3 } });

    const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('Goblin is not at 0 Hit Points');
  });

  it('should return popup when rollExpression fails', async () => {
    getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'focusPoints') return 5;
      if (key === 'currentHitPoints') return 0;
      return null;
    });
    resolveTarget.mockResolvedValue({ target: { name: 'DownedAlly', type: 'player' } });
    rollExpression.mockReturnValue(null);

    const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('Failed to roll healing dice');
  });

  it('should heal player target via setRuntimeValue', async () => {
    getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'focusPoints') return 5;
      if (key === 'currentHitPoints') return 0;
      if (key === 'activeConditions') return ['Blinded'];
      return null;
    });
    rollExpression.mockReturnValue({ total: 12, rolls: [3, 4, 3, 2] });
    resolveTarget.mockResolvedValue({ target: { name: 'DownedAlly', type: 'player' } });

    const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

    expect(result.type).toBe('popup');
    expect(setRuntimeValue).toHaveBeenCalledWith('TestCleric', 'focusPoints', 0, campaignName);
    expect(setRuntimeValue).toHaveBeenCalledWith('DownedAlly', 'currentHitPoints', 12, campaignName);
    expect(result.payload.description).toContain('Returns to life with 12 HP');
  });

  it('should heal NPC target by setting currentHp directly', async () => {
    getRuntimeValue.mockImplementation((key) => {
      if (key === 'focusPoints') return 5;
      if (key === 'activeConditions') return [];
      return null;
    });
    rollExpression.mockReturnValue({ total: 8, rolls: [2, 2, 2, 2] });
    const target = { name: 'Goblin', type: 'npc', currentHp: 0 };
    resolveTarget.mockResolvedValue({ target });
    getCombatContext.mockResolvedValue({ creatures: [target] });

    await handle(makeAction(), makePlayerStats(), campaignName, null);

    expect(target.currentHp).toBe(8);
    expect(storage.set).toHaveBeenCalledWith('combatSummary', { creatures: [target] }, campaignName);
  });

  it('should dispatch combat-summary-updated event', async () => {
    getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'focusPoints') return 5;
      if (key === 'currentHitPoints') return 0;
      if (key === 'activeConditions') return [];
      return null;
    });
    rollExpression.mockReturnValue({ total: 10, rolls: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1] });
    resolveTarget.mockResolvedValue({ target: { name: 'DownedAlly', type: 'player' } });

    const dispatchEventSpy = vi.spyOn(window, 'dispatchEvent');
    await handle(makeAction(), makePlayerStats(), campaignName, null);

    expect(dispatchEventSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'combat-summary-updated' }));
    dispatchEventSpy.mockRestore();
  });

  it('should cure matching conditions from target', async () => {
    getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'focusPoints') return 5;
      if (key === 'currentHitPoints') return 0;
      if (key === 'activeConditions') return ['Blinded', 'Poisoned', 'Frightened'];
      return null;
    });
    rollExpression.mockReturnValue({ total: 5, rolls: [5] });
    resolveTarget.mockResolvedValue({ target: { name: 'DownedAlly', type: 'player' } });

    await handle(makeAction(), makePlayerStats(), campaignName, null);

    expect(setRuntimeValue).toHaveBeenCalledWith('DownedAlly', 'activeConditions', ['Frightened'], campaignName);
  });

  it('should use custom cureConditions from automation', async () => {
    getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'focusPoints') return 5;
      if (key === 'currentHitPoints') return 0;
      if (key === 'activeConditions') return ['Blinded', 'Deafened', 'Frightened'];
      return null;
    });
    rollExpression.mockReturnValue({ total: 5, rolls: [5] });
    resolveTarget.mockResolvedValue({ target: { name: 'DownedAlly', type: 'player' } });

    const customAction = makeAction({ cureConditions: ['Blinded'] });
    await handle(customAction, makePlayerStats(), campaignName, null);

    expect(setRuntimeValue).toHaveBeenCalledWith('DownedAlly', 'activeConditions', ['Deafened', 'Frightened'], campaignName);
  });

  it('should post log entry on success', async () => {
    getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'focusPoints') return 5;
      if (key === 'currentHitPoints') return 0;
      if (key === 'activeConditions') return [];
      return null;
    });
    rollExpression.mockReturnValue({ total: 7, rolls: [7] });
    resolveTarget.mockResolvedValue({ target: { name: 'DownedAlly', type: 'player' } });

    const now = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(now);

    await handle(makeAction(), makePlayerStats(), campaignName, null);

    expect(postLogEntry).toHaveBeenCalledWith(campaignName, {
      type: 'heal',
      characterName: 'TestCleric',
      targetName: 'DownedAlly',
      amount: 7,
      abilityName: 'Hand of Ultimate Mercy',
      timestamp: now,
    });
  });

  it('should include cured conditions in description', async () => {
    getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'focusPoints') return 5;
      if (key === 'currentHitPoints') return 0;
      if (key === 'activeConditions') return ['Blinded', 'Poisoned'];
      return null;
    });
    rollExpression.mockReturnValue({ total: 5, rolls: [5] });
    resolveTarget.mockResolvedValue({ target: { name: 'DownedAlly', type: 'player' } });

    const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

    expect(result.payload.description).toContain('Also removed: Blinded, Poisoned');
  });

  it('should use default healExpression of 4d10', async () => {
    getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'focusPoints') return 5;
      if (key === 'currentHitPoints') return 0;
      if (key === 'activeConditions') return [];
      return null;
    });
    rollExpression.mockReturnValue({ total: 15, rolls: [15] });
    resolveTarget.mockResolvedValue({ target: { name: 'DownedAlly', type: 'player' } });

    const noExpressionAction = { name: 'Hand of Ultimate Mercy', automation: { resourceCostAmount: 5 } };
    await handle(noExpressionAction, makePlayerStats(), campaignName, null);

    expect(rollExpression).toHaveBeenCalledWith('4d10');
  });

  it('should use custom resourceCostAmount from automation', async () => {
    getRuntimeValue.mockReturnValue(4);
    const action = makeAction({ resourceCostAmount: 5 });
    const result = await handle(action, makePlayerStats(), campaignName, null);

    expect(result.payload.description).toContain('Need 5, have 4');
  });

  it('should handle case-insensitive condition matching', async () => {
    getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'focusPoints') return 5;
      if (key === 'currentHitPoints') return 0;
      if (key === 'activeConditions') return ['blinded', 'POISONED'];
      return null;
    });
    rollExpression.mockReturnValue({ total: 5, rolls: [5] });
    resolveTarget.mockResolvedValue({ target: { name: 'DownedAlly', type: 'player' } });

    await handle(makeAction(), makePlayerStats(), campaignName, null);

    expect(setRuntimeValue).toHaveBeenCalledWith('DownedAlly', 'activeConditions', [], campaignName);
  });

  it('should skip condition removal when no matching conditions', async () => {
    getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'focusPoints') return 5;
      if (key === 'currentHitPoints') return 0;
      if (key === 'activeConditions') return ['Frightened', 'Prone'];
      return null;
    });
    rollExpression.mockReturnValue({ total: 5, rolls: [5] });
    resolveTarget.mockResolvedValue({ target: { name: 'DownedAlly', type: 'player' } });

    await handle(makeAction(), makePlayerStats(), campaignName, null);

    expect(setRuntimeValue).not.toHaveBeenCalledWith('DownedAlly', 'activeConditions', expect.anything(), campaignName);
  });
});
