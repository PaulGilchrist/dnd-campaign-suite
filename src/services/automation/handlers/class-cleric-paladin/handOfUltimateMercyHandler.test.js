// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks BEFORE imports ───────────────────────────────────────

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

// ── Imports ────────────────────────────────────────────────────

import { handle } from './handOfUltimateMercyHandler.js';
import * as useRuntimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as diceRoller from '../../../dice/diceRoller.js';
import * as damageUtils from '../../../rules/combat/damageUtils.js';
import * as logPoster from '../../../shared/logPoster.js';
import storage from '../../../ui/storage.js';
import { resolveTarget } from '../../common/targetResolver.js';

// ── Helpers ────────────────────────────────────────────────────

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

function setupSuccessPath(healAmount = 12, targetName = 'DownedAlly') {
  useRuntimeState.getRuntimeValue.mockImplementation((_name, key) => {
    if (key === 'focusPoints') return 5;
    if (key === 'currentHitPoints') return 0;
    if (key === 'activeConditions') return [];
    return null;
  });
  diceRoller.rollExpression.mockReturnValue({ total: healAmount, rolls: [healAmount] });
  resolveTarget.mockResolvedValue({ target: { name: targetName, type: 'player' } });
}

// ── Tests ──────────────────────────────────────────────────────

describe('handOfUltimateMercyHandler.handle', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('Focus point validation', () => {
    it('should return popup when not enough focus points', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(2);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toContain('Not enough Focus Points');
      expect(result.payload.description).toContain('Need 5, have 2');
    });

    it('should fallback through storedFP->trackedResources->maxFP when focus points unavailable', async () => {
      useRuntimeState.getRuntimeValue.mockImplementation((_name, key) => {
        if (key === 'focusPoints') return null;
        return null;
      });
      // _trackedResources fallback
      const ps = makePlayerStats({
        class: { class_levels: [] },
        _trackedResources: { focusPoints: { current: 3 } },
      });

      const result = await handle(makeAction(), ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('have 3');
    });

    it('should use custom resourceCostAmount from automation', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(4);
      const action = makeAction({ resourceCostAmount: 7 });

      const result = await handle(action, makePlayerStats(), campaignName, null);

      expect(result.payload.description).toContain('Need 7, have 4');
    });

    it('should default costAmount to 5 when resourceCostAmount is missing', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(4);
      const action = { name: 'Hand of Ultimate Mercy', automation: {} };

      const result = await handle(action, makePlayerStats(), campaignName, null);

      expect(result.payload.description).toContain('Need 5, have 4');
    });

    it('should return popup when no target selected', async () => {
      useRuntimeState.getRuntimeValue.mockImplementation((_name, key) => {
        if (key === 'focusPoints') return 5;
        return null;
      });
      resolveTarget.mockResolvedValue(null);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('Select a target in combat first');
    });
  });

  describe('Target HP validation', () => {
    it('should return popup when player target is not at 0 HP', async () => {
      useRuntimeState.getRuntimeValue.mockImplementation((_name, key) => {
        if (key === 'focusPoints') return 5;
        if (key === 'currentHitPoints') return 5;
        return null;
      });
      resolveTarget.mockResolvedValue({ target: { name: 'DownedAlly', type: 'player' } });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('DownedAlly is not at 0 Hit Points');
    });

    it('should return popup when npc target is not at 0 HP', async () => {
      useRuntimeState.getRuntimeValue.mockImplementation((_name, key) => {
        if (key === 'focusPoints') return 5;
        return null;
      });
      resolveTarget.mockResolvedValue({ target: { name: 'Goblin', type: 'npc', currentHp: 3 } });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('Goblin is not at 0 Hit Points');
    });

    it('should treat null targetHp as 0 for player targets', async () => {
      useRuntimeState.getRuntimeValue.mockImplementation((_name, key) => {
        if (key === 'focusPoints') return 5;
        if (key === 'currentHitPoints') return null;
        return null;
      });
      diceRoller.rollExpression.mockReturnValue({ total: 10, rolls: [10] });
      resolveTarget.mockResolvedValue({ target: { name: 'DownedAlly', type: 'player' } });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('Returns to life with 10 HP');
    });

    it('should treat null targetHp as 0 for npc targets', async () => {
      useRuntimeState.getRuntimeValue.mockImplementation((_name, key) => {
        if (key === 'focusPoints') return 5;
        return null;
      });
      diceRoller.rollExpression.mockReturnValue({ total: 10, rolls: [10] });
      resolveTarget.mockResolvedValue({ target: { name: 'Goblin', type: 'npc', currentHp: null } });
      damageUtils.getCombatContext.mockResolvedValue({ creatures: [] });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('Returns to life with 10 HP');
    });
  });

  describe('Dice rolling', () => {
    it('should return popup when rollExpression returns null', async () => {
      useRuntimeState.getRuntimeValue.mockImplementation((_name, key) => {
        if (key === 'focusPoints') return 5;
        if (key === 'currentHitPoints') return 0;
        return null;
      });
      resolveTarget.mockResolvedValue({ target: { name: 'DownedAlly', type: 'player' } });
      diceRoller.rollExpression.mockReturnValue(null);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('Failed to roll healing dice');
    });

    it('should use custom healExpression from automation', async () => {
      setupSuccessPath(20);
      const action = makeAction({ healExpression: '6d8' });

      await handle(action, makePlayerStats(), campaignName, null);

      expect(diceRoller.rollExpression).toHaveBeenCalledWith('6d8');
    });

    it('should use default healExpression of 4d10 when not specified', async () => {
      useRuntimeState.getRuntimeValue.mockImplementation((_name, key) => {
        if (key === 'focusPoints') return 5;
        if (key === 'currentHitPoints') return 0;
        return null;
      });
      diceRoller.rollExpression.mockReturnValue({ total: 15, rolls: [15] });
      resolveTarget.mockResolvedValue({ target: { name: 'DownedAlly', type: 'player' } });

      const noExpressionAction = { name: 'Hand of Ultimate Mercy', automation: { resourceCostAmount: 5 } };

      await handle(noExpressionAction, makePlayerStats(), campaignName, null);

      expect(diceRoller.rollExpression).toHaveBeenCalledWith('4d10');
    });
  });

  describe('Player target healing', () => {
    it('should deduct focus points from caster', async () => {
      setupSuccessPath(12);

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith('TestCleric', 'focusPoints', 0, campaignName);
    });

    it('should set target HP to heal amount via setRuntimeValue', async () => {
      setupSuccessPath(12);

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith('DownedAlly', 'currentHitPoints', 12, campaignName);
    });

    it('should dispatch focus-points-updated and combat-summary-updated events', async () => {
      setupSuccessPath(12);

      const dispatchEventSpy = vi.spyOn(window, 'dispatchEvent');

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(dispatchEventSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'focus-points-updated' }));
      expect(dispatchEventSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'combat-summary-updated' }));
      dispatchEventSpy.mockRestore();
    });

    it('should return success popup with correct description', async () => {
      setupSuccessPath(12);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toContain('TestCleric uses Hand of Ultimate Mercy on DownedAlly');
      expect(result.payload.description).toContain('Returns to life with 12 HP');
      expect(result.payload.description).toContain('Expended 5 Focus Points');
    });
  });

  describe('NPC target healing', () => {
    it('should save combatSummary to storage when healing NPC', async () => {
      useRuntimeState.getRuntimeValue.mockImplementation((_name, key) => {
        if (key === 'focusPoints') return 5;
        if (key === 'activeConditions') return [];
        return null;
      });
      diceRoller.rollExpression.mockReturnValue({ total: 8, rolls: [2, 2, 2, 2] });
      const target = { name: 'Goblin', type: 'npc', currentHp: 0 };
      resolveTarget.mockResolvedValue({ target });
      damageUtils.getCombatContext.mockResolvedValue({ creatures: [target] });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(storage.set).toHaveBeenCalledWith('combatSummary', { creatures: [target] }, campaignName);
    });

    it('should deduct focus points for NPC healing', async () => {
      useRuntimeState.getRuntimeValue.mockImplementation((_name, key) => {
        if (key === 'focusPoints') return 5;
        if (key === 'activeConditions') return [];
        return null;
      });
      diceRoller.rollExpression.mockReturnValue({ total: 8, rolls: [2, 2, 2, 2] });
      const target = { name: 'Goblin', type: 'npc', currentHp: 0 };
      resolveTarget.mockResolvedValue({ target });
      damageUtils.getCombatContext.mockResolvedValue({ creatures: [target] });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith('TestCleric', 'focusPoints', 0, campaignName);
    });
  });

  describe('Condition curing', () => {
    it('should cure matching conditions from player target by default', async () => {
      useRuntimeState.getRuntimeValue.mockImplementation((_name, key) => {
        if (key === 'focusPoints') return 5;
        if (key === 'currentHitPoints') return 0;
        if (key === 'activeConditions') return ['Blinded', 'Poisoned', 'Frightened'];
        return null;
      });
      diceRoller.rollExpression.mockReturnValue({ total: 5, rolls: [5] });
      resolveTarget.mockResolvedValue({ target: { name: 'DownedAlly', type: 'player' } });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith('DownedAlly', 'activeConditions', ['Frightened'], campaignName);
    });

    it('should use custom cureConditions from automation', async () => {
      useRuntimeState.getRuntimeValue.mockImplementation((_name, key) => {
        if (key === 'focusPoints') return 5;
        if (key === 'currentHitPoints') return 0;
        if (key === 'activeConditions') return ['Blinded', 'Deafened', 'Frightened'];
        return null;
      });
      diceRoller.rollExpression.mockReturnValue({ total: 5, rolls: [5] });
      resolveTarget.mockResolvedValue({ target: { name: 'DownedAlly', type: 'player' } });

      const customAction = makeAction({ cureConditions: ['Blinded'] });
      await handle(customAction, makePlayerStats(), campaignName, null);

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith('DownedAlly', 'activeConditions', ['Deafened', 'Frightened'], campaignName);
    });

    it('should handle case-insensitive condition matching', async () => {
      useRuntimeState.getRuntimeValue.mockImplementation((_name, key) => {
        if (key === 'focusPoints') return 5;
        if (key === 'currentHitPoints') return 0;
        if (key === 'activeConditions') return ['blinded', 'POISONED'];
        return null;
      });
      diceRoller.rollExpression.mockReturnValue({ total: 5, rolls: [5] });
      resolveTarget.mockResolvedValue({ target: { name: 'DownedAlly', type: 'player' } });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith('DownedAlly', 'activeConditions', [], campaignName);
    });

    it('should include cured conditions in description', async () => {
      useRuntimeState.getRuntimeValue.mockImplementation((_name, key) => {
        if (key === 'focusPoints') return 5;
        if (key === 'currentHitPoints') return 0;
        if (key === 'activeConditions') return ['Blinded', 'Poisoned'];
        return null;
      });
      diceRoller.rollExpression.mockReturnValue({ total: 5, rolls: [5] });
      resolveTarget.mockResolvedValue({ target: { name: 'DownedAlly', type: 'player' } });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.payload.description).toContain('Also removed: Blinded, Poisoned');
    });

    it('should handle non-array and null activeConditions gracefully', async () => {
      useRuntimeState.getRuntimeValue.mockImplementation((_name, key) => {
        if (key === 'focusPoints') return 5;
        if (key === 'currentHitPoints') return 0;
        if (key === 'activeConditions') return null;
        return null;
      });
      diceRoller.rollExpression.mockReturnValue({ total: 5, rolls: [5] });
      resolveTarget.mockResolvedValue({ target: { name: 'DownedAlly', type: 'player' } });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).not.toContain('Also removed');
    });

    it('should attempt to cure conditions on NPC targets too', async () => {
      useRuntimeState.getRuntimeValue.mockImplementation((_name, key) => {
        if (key === 'focusPoints') return 5;
        if (key === 'activeConditions') return ['Blinded', 'Poisoned'];
        return null;
      });
      diceRoller.rollExpression.mockReturnValue({ total: 5, rolls: [5] });
      resolveTarget.mockResolvedValue({ target: { name: 'Goblin', type: 'npc', currentHp: 0 } });
      damageUtils.getCombatContext.mockResolvedValue({ creatures: [] });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Goblin',
        'activeConditions',
        [],
        campaignName
      );
    });
  });

  describe('Logging', () => {
    it('should call postLogEntry with correct heal data on success', async () => {
      setupSuccessPath(7);

      const now = Date.now();
      const dateSpy = vi.spyOn(Date, 'now').mockReturnValue(now);

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(logPoster.postLogEntry).toHaveBeenCalledWith(campaignName, {
        type: 'heal',
        characterName: 'TestCleric',
        targetName: 'DownedAlly',
        amount: 7,
        abilityName: 'Hand of Ultimate Mercy',
        timestamp: now,
      });
      dateSpy.mockRestore();
    });

    it('should not call postLogEntry on early returns', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(2);
      await handle(makeAction(), makePlayerStats(), campaignName, null);
      expect(logPoster.postLogEntry).not.toHaveBeenCalled();

      vi.resetAllMocks();

      useRuntimeState.getRuntimeValue.mockImplementation((_name, key) => {
        if (key === 'focusPoints') return 5;
        return null;
      });
      resolveTarget.mockResolvedValue(null);
      await handle(makeAction(), makePlayerStats(), campaignName, null);
      expect(logPoster.postLogEntry).not.toHaveBeenCalled();
    });
  });
});
