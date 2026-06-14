import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks BEFORE imports ───────────────────────────────────────

vi.mock('../../../hooks/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
  getTargetFromAttacker: vi.fn(),
}));

vi.mock('../../shared/logPoster.js', () => ({
  postLogEntry: vi.fn(),
}));

vi.mock('../../ui/storage.js', () => ({
  default: {
    set: vi.fn(),
  },
}));

// ── Imports ────────────────────────────────────────────────────

import { handle } from './revivificationHandler.js';
import * as useRuntimeState from '../../../hooks/useRuntimeState.js';
import * as damageUtils from '../../rules/combat/damageUtils.js';
import * as logPoster from '../../shared/logPoster.js';
import storage from '../../ui/storage.js';

// ── Helpers ────────────────────────────────────────────────────

const campaignName = 'TestCampaign';

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestHero',
    level: 5,
    ...overrides,
  };
}

function makeAction(automation = {}) {
  return {
    name: 'Revivification',
    automation,
  };
}

// ── Tests ──────────────────────────────────────────────────────

describe('revivificationHandler.handle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rage checks', () => {
    it('should return "no rage" popup when rage is 0', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(0);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toBe('No Rage remaining to power Revivification.');
    });

    it('should return "no rage" popup when rage is negative', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(-2);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toBe('No Rage remaining to power Revivification.');
    });

    it('should return "no rage" popup when storedRage is null (defaults to 0)', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(null);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toBe('No Rage remaining to power Revivification.');
    });
  });

  describe('Combat context checks', () => {
    it('should return "no combat" popup when getCombatContext returns null', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(1);
      damageUtils.getCombatContext.mockResolvedValue(null);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toBe('No combat active.');
    });
  });

  describe('Target selection checks', () => {
    it('should return "select target" popup when getTargetFromAttacker returns null', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(1);
      damageUtils.getCombatContext.mockResolvedValue({});
      damageUtils.getTargetFromAttacker.mockReturnValue(null);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toBe('Select a target in the combat tracker first.');
    });
  });

  describe('Target HP checks', () => {
    it('should get targetHp from getRuntimeValue for player-type targets', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue((key) => {
        if (key === 'currentHitPoints') return 0;
        return null;
      });
      damageUtils.getCombatContext.mockResolvedValue({});
      damageUtils.getTargetFromAttacker.mockReturnValue({ name: 'Ally', type: 'player' });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(useRuntimeState.getRuntimeValue).toHaveBeenCalledWith('Ally', 'currentHitPoints', campaignName);
    });

    it('should get targetHp from target.currentHp for NPC-type targets', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(1); // rage
      damageUtils.getCombatContext.mockResolvedValue({});
      damageUtils.getTargetFromAttacker.mockReturnValue({ name: 'Goblin', type: 'npc', currentHp: 0 });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(useRuntimeState.getRuntimeValue).not.toHaveBeenCalledWith('Goblin', 'currentHitPoints', campaignName);
    });

    it('should return "not at 0 HP" popup when targetHp > 0 for player targets', async () => {
      useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'ragePoints') return 2;
        if (key === 'currentHitPoints') return 5;
        return null;
      });
      damageUtils.getCombatContext.mockResolvedValue({});
      damageUtils.getTargetFromAttacker.mockReturnValue({ name: 'Ally', type: 'player' });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toBe('Ally is not at 0 Hit Points.');
    });

    it('should return "not at 0 HP" popup when targetHp > 0 for NPC targets', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(1); // rage
      damageUtils.getCombatContext.mockResolvedValue({});
      damageUtils.getTargetFromAttacker.mockReturnValue({ name: 'Goblin', type: 'npc', currentHp: 3 });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toBe('Goblin is not at 0 Hit Points.');
    });
  });

  describe('Healing logic', () => {
    it('should heal player target via setRuntimeValue for currentHitPoints', async () => {
      useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'ragePoints') return 2;
        if (key === 'currentHitPoints') return 0;
        return null;
      });
      damageUtils.getCombatContext.mockResolvedValue({});
      damageUtils.getTargetFromAttacker.mockReturnValue({ name: 'Ally', type: 'player' });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith('Ally', 'currentHitPoints', 5, campaignName);
    });

    it('should heal NPC target by setting target.currentHp directly', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(2); // rage
      damageUtils.getCombatContext.mockResolvedValue({});
      const target = { name: 'Goblin', type: 'npc', currentHp: 0 };
      damageUtils.getTargetFromAttacker.mockReturnValue(target);

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(target.currentHp).toBe(5);
    });

    it('should save combatSummary to storage when healing NPC', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(2); // rage
      damageUtils.getCombatContext.mockResolvedValue({ combatData: true });
      const target = { name: 'Goblin', type: 'npc', currentHp: 0 };
      damageUtils.getTargetFromAttacker.mockReturnValue(target);

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(storage.set).toHaveBeenCalledWith('combatSummary', { combatData: true }, campaignName);
    });

    it('should NOT call storage.set when healing player target', async () => {
      useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'ragePoints') return 2;
        if (key === 'currentHitPoints') return 0;
        return null;
      });
      damageUtils.getCombatContext.mockResolvedValue({});
      damageUtils.getTargetFromAttacker.mockReturnValue({ name: 'Ally', type: 'player' });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(storage.set).not.toHaveBeenCalled();
    });
  });

  describe('Event dispatching', () => {
    it('should dispatch combat-summary-updated event on window', async () => {
      useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'ragePoints') return 2;
        if (key === 'currentHitPoints') return 0;
        return null;
      });
      damageUtils.getCombatContext.mockResolvedValue({});
      damageUtils.getTargetFromAttacker.mockReturnValue({ name: 'Ally', type: 'player' });

      const dispatchEventSpy = vi.spyOn(window, 'dispatchEvent');

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(dispatchEventSpy).toHaveBeenCalledWith(expect.objectContaining({
        type: 'combat-summary-updated',
      }));
      dispatchEventSpy.mockRestore();
    });
  });

  describe('Logging', () => {
    it('should call postLogEntry with correct heal data', async () => {
      useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'ragePoints') return 2;
        if (key === 'currentHitPoints') return 0;
        return null;
      });
      damageUtils.getCombatContext.mockResolvedValue({});
      damageUtils.getTargetFromAttacker.mockReturnValue({ name: 'Ally', type: 'player' });

      const now = Date.now();
      vi.spyOn(Date, 'now').mockReturnValue(now);

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(logPoster.postLogEntry).toHaveBeenCalledWith(campaignName, {
        type: 'heal',
        characterName: 'TestHero',
        targetName: 'Ally',
        amount: 5,
        abilityName: 'Revivification',
        timestamp: now,
      });
    });
  });

  describe('Heal amount', () => {
    it('should use playerStats.level as healAmount', async () => {
      const ps = makePlayerStats({ level: 7 });
      useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'ragePoints') return 2;
        if (key === 'currentHitPoints') return 0;
        return null;
      });
      damageUtils.getCombatContext.mockResolvedValue({});
      damageUtils.getTargetFromAttacker.mockReturnValue({ name: 'Ally', type: 'player' });

      await handle(makeAction(), ps, campaignName, null);

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith('Ally', 'currentHitPoints', 7, campaignName);
    });

    it('should use default healAmount of 1 when level is falsy', async () => {
      const ps = makePlayerStats({ level: 0 });
      useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'ragePoints') return 2;
        if (key === 'currentHitPoints') return 0;
        return null;
      });
      damageUtils.getCombatContext.mockResolvedValue({});
      damageUtils.getTargetFromAttacker.mockReturnValue({ name: 'Ally', type: 'player' });

      await handle(makeAction(), ps, campaignName, null);

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith('Ally', 'currentHitPoints', 1, campaignName);
    });
  });

  describe('Rage decrement', () => {
    it('should decrement ragePoints by 1', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(3); // rage
      damageUtils.getCombatContext.mockResolvedValue({});
      damageUtils.getTargetFromAttacker.mockReturnValue({ name: 'Goblin', type: 'npc', currentHp: 0 });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith('TestHero', 'ragePoints', 2, campaignName);
    });
  });

  describe('Success popup', () => {
    it('should return success popup with correct description', async () => {
      useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'ragePoints') return 2;
        if (key === 'currentHitPoints') return 0;
        return null;
      });
      damageUtils.getCombatContext.mockResolvedValue({});
      damageUtils.getTargetFromAttacker.mockReturnValue({ name: 'Ally', type: 'player' });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toBe(
        'TestHero uses Revivification to save Ally, setting their Hit Points to 5 and expending 1 Rage.'
      );
    });
  });
});
