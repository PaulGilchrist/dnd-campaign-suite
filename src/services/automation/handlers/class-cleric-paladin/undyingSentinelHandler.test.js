import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
  getTargetFromAttacker: vi.fn(),
}));

vi.mock('../../../shared/logPoster.js', () => ({
  postLogEntry: vi.fn(),
}));

vi.mock('../../../ui/storage.js', () => ({
  default: {
    set: vi.fn(),
  },
}));

import { handle, isUndyingSentinelUsed, setUndyingSentinelUsed } from './undyingSentinelHandler.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { getCombatContext, getTargetFromAttacker } from '../../../rules/combat/damageUtils.js';
import { postLogEntry } from '../../../shared/logPoster.js';
import storage from '../../../ui/storage.js';

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
    name: 'Undying Sentinel',
    automation: { type: 'undying_sentinel', ...automation },
  };
}

describe('undyingSentinelHandler.handle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return popup when already used this long rest', async () => {
    getRuntimeValue.mockReturnValue(true);

    const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('already been used');
  });

  it('should return popup when no combat context', async () => {
    getRuntimeValue.mockReturnValue(null);
    getCombatContext.mockResolvedValue(null);

    const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

    expect(result.type).toBe('popup');
    expect(result.payload.description).toBe('No combat active.');
  });

  it('should return popup when no target selected', async () => {
    getRuntimeValue.mockReturnValue(null);
    getCombatContext.mockResolvedValue({});
    getTargetFromAttacker.mockReturnValue(null);

    const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

    expect(result.type).toBe('popup');
    expect(result.payload.description).toBe('Select a target in the combat tracker first.');
  });

  it('should return popup when target is not at 0 HP', async () => {
    getRuntimeValue.mockReturnValue(null);
    getCombatContext.mockResolvedValue({});
    getTargetFromAttacker.mockReturnValue({ name: 'DownedAlly', type: 'player' });
    getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'currentHitPoints') return 5;
      return null;
    });

    const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

    expect(result.type).toBe('popup');
    expect(result.payload.description).toBe('DownedAlly is not at 0 Hit Points.');
  });

  it('should heal player target and return success', async () => {
    getRuntimeValue.mockReturnValue(null);
    getCombatContext.mockResolvedValue({});
    getTargetFromAttacker.mockReturnValue({ name: 'DownedAlly', type: 'player' });
    getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'currentHitPoints') return 0;
      if (key === 'hitPoints') return 50;
      return null;
    });

    const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

    expect(result.type).toBe('popup');
    expect(setRuntimeValue).toHaveBeenCalledWith('TestCleric', 'undyingSentinelUsed', true, campaignName);
    expect(setRuntimeValue).toHaveBeenCalledWith('DownedAlly', 'currentHitPoints', 16, campaignName);
    expect(result.payload.description).toContain('survive');
    expect(result.payload.description).toContain('16 HP');
  });

  it('should heal NPC target by setting currentHp directly', async () => {
    getRuntimeValue.mockReturnValue(null);
    getCombatContext.mockResolvedValue({ creatures: [] });
    const target = { name: 'Goblin', type: 'npc', currentHp: 0 };
    getTargetFromAttacker.mockReturnValue(target);

    await handle(makeAction(), makePlayerStats(), campaignName, null);

    expect(target.currentHp).toBe(16);
  });

  it('should save combatSummary to storage when healing NPC', async () => {
    getRuntimeValue.mockReturnValue(null);
    getCombatContext.mockResolvedValue({ creatures: [] });
    const target = { name: 'Goblin', type: 'npc', currentHp: 0 };
    getTargetFromAttacker.mockReturnValue(target);

    await handle(makeAction(), makePlayerStats(), campaignName, null);

    expect(storage.set).toHaveBeenCalledWith('combatSummary', { creatures: [] }, campaignName);
  });

  it('should dispatch combat-summary-updated event', async () => {
    getRuntimeValue.mockReturnValue(null);
    getCombatContext.mockResolvedValue({});
    getTargetFromAttacker.mockReturnValue({ name: 'DownedAlly', type: 'player' });
    getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'currentHitPoints') return 0;
      if (key === 'hitPoints') return 50;
      return null;
    });

    const dispatchEventSpy = vi.spyOn(window, 'dispatchEvent');
    await handle(makeAction(), makePlayerStats(), campaignName, null);

    expect(dispatchEventSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'combat-summary-updated' }));
    dispatchEventSpy.mockRestore();
  });

  it('should post log entry on success', async () => {
    getRuntimeValue.mockReturnValue(null);
    getCombatContext.mockResolvedValue({});
    getTargetFromAttacker.mockReturnValue({ name: 'DownedAlly', type: 'player' });
    getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'currentHitPoints') return 0;
      if (key === 'hitPoints') return 50;
      return null;
    });

    const now = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(now);

    await handle(makeAction(), makePlayerStats(), campaignName, null);

    expect(postLogEntry).toHaveBeenCalledWith(campaignName, {
      type: 'heal',
      characterName: 'TestCleric',
      targetName: 'DownedAlly',
      amount: 16,
      abilityName: 'Undying Sentinel',
      timestamp: now,
    });
  });

  it('should cap heal at max HP', async () => {
    getRuntimeValue.mockReturnValue(null);
    getCombatContext.mockResolvedValue({});
    getTargetFromAttacker.mockReturnValue({ name: 'DownedAlly', type: 'player' });
    getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'currentHitPoints') return 0;
      if (key === 'hitPoints') return 10;
      return null;
    });

    await handle(makeAction(), makePlayerStats(), campaignName, null);

    expect(setRuntimeValue).toHaveBeenCalledWith('DownedAlly', 'currentHitPoints', 10, campaignName);
  });

  it('should calculate heal amount as paladinLevel * 3', async () => {
    getRuntimeValue.mockReturnValue(null);
    getCombatContext.mockResolvedValue({});
    getTargetFromAttacker.mockReturnValue({ name: 'DownedAlly', type: 'player' });
    getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'currentHitPoints') return 0;
      if (key === 'hitPoints') return 100;
      return null;
    });
    const ps = makePlayerStats({ level: 7 });

    await handle(makeAction(), ps, campaignName, null);

    expect(setRuntimeValue).toHaveBeenCalledWith('DownedAlly', 'currentHitPoints', 22, campaignName);
  });

  it('should use playerStats.level as fallback for paladinLevel', async () => {
    getRuntimeValue.mockReturnValue(null);
    getCombatContext.mockResolvedValue({});
    getTargetFromAttacker.mockReturnValue({ name: 'DownedAlly', type: 'player' });
    getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'currentHitPoints') return 0;
      if (key === 'hitPoints') return 100;
      return null;
    });
    const ps = makePlayerStats({
      level: 5,
      class: { class_levels: [{ level: 10 }] },
    });

    await handle(makeAction(), ps, campaignName, null);

    expect(setRuntimeValue).toHaveBeenCalledWith('DownedAlly', 'currentHitPoints', 16, campaignName);
  });

  it('should handle undefined hitPoints with default of 100', async () => {
    getRuntimeValue.mockReturnValue(null);
    getCombatContext.mockResolvedValue({});
    getTargetFromAttacker.mockReturnValue({ name: 'DownedAlly', type: 'player' });
    getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'currentHitPoints') return 0;
      return null;
    });

    await handle(makeAction(), makePlayerStats(), campaignName, null);

    expect(setRuntimeValue).toHaveBeenCalledWith('DownedAlly', 'currentHitPoints', 16, campaignName);
  });
});

describe('undyingSentinelHandler.isUndyingSentinelUsed', () => {
  it('should return true when used', () => {
    getRuntimeValue.mockReturnValue(true);

    expect(isUndyingSentinelUsed('TestCleric', campaignName)).toBe(true);
  });

  it('should return false when not used', () => {
    getRuntimeValue.mockReturnValue(null);

    expect(isUndyingSentinelUsed('TestCleric', campaignName)).toBe(false);
  });

  it('should return false when used is false', () => {
    getRuntimeValue.mockReturnValue(false);

    expect(isUndyingSentinelUsed('TestCleric', campaignName)).toBe(false);
  });
});

describe('undyingSentinelHandler.setUndyingSentinelUsed', () => {
  it('should set used to true', async () => {
    await setUndyingSentinelUsed('TestCleric', campaignName, true);

    expect(setRuntimeValue).toHaveBeenCalledWith('TestCleric', 'undyingSentinelUsed', true, campaignName);
  });

  it('should set used to false', async () => {
    await setUndyingSentinelUsed('TestCleric', campaignName, false);

    expect(setRuntimeValue).toHaveBeenCalledWith('TestCleric', 'undyingSentinelUsed', false, campaignName);
  });
});
