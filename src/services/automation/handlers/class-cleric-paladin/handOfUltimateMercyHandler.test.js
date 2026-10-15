// @maintained-by-ai: 2026-10-15
// Deterministic unit coverage for handOfUltimateMercyHandler.handle — all external
// services mocked; pins focus-point cost/fallback chain, 0-HP gate, dice expression
// selection (default/custom/maximized), runtime + storage writes, condition curing,
// popup/log strings. Update only when the handler's contract changes deliberately.
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks BEFORE imports ───────────────────────────────────────

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../dice/diceRoller.js', () => ({
  rollExpression: vi.fn(),
  rollExpressionMaximized: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../ui/storage.js', () => ({
  default: {
    set: vi.fn(),
  },
}));

vi.mock('../../common/targetResolver.js', () => ({
  resolveTarget: vi.fn(),
}));

vi.mock('../../../combat/automation/automationService.js', () => ({
  hasHealingMaximization: vi.fn(),
  resolveDiceExpression: vi.fn((expr) => expr),
}));

// ── Imports ────────────────────────────────────────────────────

import { handle } from './handOfUltimateMercyHandler.js';
import * as useRuntimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as diceRoller from '../../../dice/diceRoller.js';
import * as logPoster from '../../../ui/logService.js';
import storage from '../../../ui/storage.js';
import { resolveTarget } from '../../common/targetResolver.js';
import * as automationService from '../../../combat/automation/automationService.js';

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

// Runtime-store router: FP on caster, HP + conditions on any target name.
function mockRuntime({ fp = 5, hp = 0, conditions = [] } = {}) {
  useRuntimeState.getRuntimeValue.mockImplementation((_name, key) => {
    if (key === 'focusPoints') return fp;
    if (key === 'currentHitPoints') return hp;
    if (key === 'activeConditions') return conditions;
    return null;
  });
}

function mockRoll(total) {
  diceRoller.rollExpression.mockReturnValue({ total, rolls: [total] });
}

function mockPlayerTarget(name = 'DownedAlly') {
  resolveTarget.mockResolvedValue({ target: { name, type: 'player' } });
}

function setupSuccessPath(healAmount = 12, targetName = 'DownedAlly') {
  mockRuntime();
  mockRoll(healAmount);
  mockPlayerTarget(targetName);
}

function setupNpcTarget(name = 'Goblin', conditions = []) {
  const cs = { creatures: [{ name, type: 'npc', currentHp: 0 }] };
  mockRuntime({ conditions });
  resolveTarget.mockResolvedValue({ target: cs.creatures[0], cs });
  return cs;
}

// ── Tests ──────────────────────────────────────────────────────

describe('handOfUltimateMercyHandler.handle', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('Focus point validation', () => {
    it('should return popup when not enough focus points', async () => {
      mockRuntime({ fp: 2 });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toBe('Not enough Focus Points. Need 5, have 2.');
    });

    it('should fall back to _trackedResources.focusPoints when stored FP is null', async () => {
      mockRuntime({ fp: null });
      const ps = makePlayerStats({
        class: { class_levels: [] },
        _trackedResources: { focusPoints: { current: 3 } },
      });

      const result = await handle(makeAction(), ps, campaignName, null);

      expect(result.payload.description).toBe('Not enough Focus Points. Need 5, have 3.');
    });

    it('should fall back to class-level focus_points when stored FP and _trackedResources are absent', async () => {
      mockRuntime({ fp: null });
      const ps = makePlayerStats({ _trackedResources: undefined });

      const result = await handle(makeAction({ resourceCostAmount: 12 }), ps, campaignName, null);

      expect(result.payload.description).toBe('Not enough Focus Points. Need 12, have 10.');
    });

    it('should use custom resourceCostAmount from automation', async () => {
      mockRuntime({ fp: 4 });

      const result = await handle(makeAction({ resourceCostAmount: 7 }), makePlayerStats(), campaignName, null);

      expect(result.payload.description).toBe('Not enough Focus Points. Need 7, have 4.');
    });

    it('should default costAmount to 5 when resourceCostAmount is missing', async () => {
      mockRuntime({ fp: 4 });
      const action = { name: 'Hand of Ultimate Mercy', automation: {} };

      const result = await handle(action, makePlayerStats(), campaignName, null);

      expect(result.payload.description).toBe('Not enough Focus Points. Need 5, have 4.');
    });
  });

  describe('Target resolution', () => {
    it('should return popup when no target selected', async () => {
      mockRuntime();
      resolveTarget.mockResolvedValue(null);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toBe('Select a target in combat first.');
    });
  });

  describe('Target HP validation', () => {
    it('should return popup when player target is not at 0 HP', async () => {
      mockRuntime({ hp: 5 });
      mockPlayerTarget();

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toBe('DownedAlly is not at 0 Hit Points.');
    });

    it('should return popup when npc target is not at 0 HP', async () => {
      mockRuntime();
      resolveTarget.mockResolvedValue({ target: { name: 'Goblin', type: 'npc', currentHp: 3 } });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toBe('Goblin is not at 0 Hit Points.');
    });

    it('should treat null targetHp as 0 for player targets', async () => {
      mockRuntime({ hp: null });
      mockRoll(10);
      mockPlayerTarget();

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toBe('TestCleric uses Hand of Ultimate Mercy on DownedAlly. Returns to life with 10 HP. Expended 5 Focus Points.');
    });

    it('should treat null targetHp as 0 for npc targets', async () => {
      mockRuntime();
      mockRoll(10);
      resolveTarget.mockResolvedValue({ target: { name: 'Goblin', type: 'npc', currentHp: null }, cs: { creatures: [] } });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toBe('TestCleric uses Hand of Ultimate Mercy on Goblin. Returns to life with 10 HP. Expended 5 Focus Points.');
    });
  });

  describe('Dice rolling', () => {
    it('should return popup when rollExpression returns null', async () => {
      mockRuntime();
      mockPlayerTarget();
      diceRoller.rollExpression.mockReturnValue(null);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toBe('Failed to roll healing dice.');
    });

    it('should use custom healExpression from automation', async () => {
      setupSuccessPath(20);

      await handle(makeAction({ healExpression: '6d8' }), makePlayerStats(), campaignName, null);

      expect(diceRoller.rollExpression).toHaveBeenCalledWith('6d8');
    });

    it('should use default healExpression of 4d10 when not specified', async () => {
      setupSuccessPath(15);
      const noExpressionAction = { name: 'Hand of Ultimate Mercy', automation: { resourceCostAmount: 5 } };

      await handle(noExpressionAction, makePlayerStats(), campaignName, null);

      expect(diceRoller.rollExpression).toHaveBeenCalledWith('4d10');
    });

    it('should roll maximized via rollExpressionMaximized when caster has healing maximization', async () => {
      setupSuccessPath();
      automationService.hasHealingMaximization.mockReturnValue(true);
      diceRoller.rollExpressionMaximized.mockReturnValue({ total: 40, rolls: [10, 10, 10, 10] });

      const result = await handle(makeAction({ healExpression: '4d10' }), makePlayerStats(), campaignName, null);

      expect(automationService.hasHealingMaximization).toHaveBeenCalled();
      expect(diceRoller.rollExpressionMaximized).toHaveBeenCalledWith('4d10');
      expect(diceRoller.rollExpression).not.toHaveBeenCalled();
      expect(result.payload.description).toBe('TestCleric uses Hand of Ultimate Mercy on DownedAlly. Returns to life with 40 HP. Expended 5 Focus Points.');
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
      expect(result.payload.description).toBe('TestCleric uses Hand of Ultimate Mercy on DownedAlly. Returns to life with 12 HP. Expended 5 Focus Points.');
    });
  });

  describe('NPC target healing', () => {
    it('should persist resurrected HP in the mutated combatSummary (CLA-160 regression)', async () => {
      mockRuntime();
      mockRoll(24);
      const cs = { creatures: [{ name: 'Animated Rug of Smothering 1', type: 'npc', currentHp: 0 }] };
      resolveTarget.mockResolvedValue({ target: cs.creatures[0], cs });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.payload.description).toContain('Returns to life with 24 HP');
      expect(storage.set).toHaveBeenCalledTimes(1);
      const [key, savedCs, savedCampaign] = storage.set.mock.calls[0];
      expect(key).toBe('combatSummary');
      expect(savedCs.creatures.find(c => c.name === 'Animated Rug of Smothering 1').currentHp).toBe(24);
      expect(savedCampaign).toBe(campaignName);
    });

    it('should not write storage when npc target has no combatSummary', async () => {
      mockRuntime();
      mockRoll(8);
      resolveTarget.mockResolvedValue({ target: { name: 'Goblin', type: 'npc', currentHp: 0 } });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(storage.set).not.toHaveBeenCalled();
    });
  });

  describe('Condition curing', () => {
    it('should cure matching conditions from player target by default', async () => {
      mockRuntime({ conditions: ['Blinded', 'Poisoned', 'Frightened'] });
      mockRoll(5);
      mockPlayerTarget();

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith('DownedAlly', 'activeConditions', ['Frightened'], campaignName);
    });

    it('should use custom cureConditions from automation', async () => {
      mockRuntime({ conditions: ['Blinded', 'Deafened', 'Frightened'] });
      mockRoll(5);
      mockPlayerTarget();

      await handle(makeAction({ cureConditions: ['Blinded'] }), makePlayerStats(), campaignName, null);

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith('DownedAlly', 'activeConditions', ['Deafened', 'Frightened'], campaignName);
    });

    it('should handle case-insensitive condition matching', async () => {
      mockRuntime({ conditions: ['blinded', 'POISONED'] });
      mockRoll(5);
      mockPlayerTarget();

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith('DownedAlly', 'activeConditions', [], campaignName);
    });

    it('should include cured conditions in description', async () => {
      mockRuntime({ conditions: ['Blinded', 'Poisoned'] });
      mockRoll(5);
      mockPlayerTarget();

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.payload.description).toBe('TestCleric uses Hand of Ultimate Mercy on DownedAlly. Returns to life with 5 HP. Expended 5 Focus Points. Also removed: Blinded, Poisoned.');
    });

    it('should handle null activeConditions gracefully', async () => {
      mockRuntime({ conditions: null });
      mockRoll(5);
      mockPlayerTarget();

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).not.toContain('Also removed');
      expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalledWith('DownedAlly', 'activeConditions', expect.anything(), campaignName);
    });

    it('should attempt to cure conditions on NPC targets too', async () => {
      mockRoll(5);
      setupNpcTarget('Goblin', ['Blinded', 'Poisoned']);

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith('Goblin', 'activeConditions', [], campaignName);
    });
  });

  describe('Logging', () => {
    it('should call addEntry with correct heal data on success', async () => {
      setupSuccessPath(7);

      const now = Date.now();
      const dateSpy = vi.spyOn(Date, 'now').mockReturnValue(now);

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(logPoster.addEntry).toHaveBeenCalledWith(campaignName, {
        type: 'healing',
        characterName: 'TestCleric',
        targetName: 'DownedAlly',
        amount: 7,
        sourceName: 'Hand of Ultimate Mercy',
        abilityName: 'Hand of Ultimate Mercy',
        resurrection: true,
        timestamp: now,
      });
      dateSpy.mockRestore();
    });

    it('should not call addEntry on early returns', async () => {
      mockRuntime({ fp: 2 });
      await handle(makeAction(), makePlayerStats(), campaignName, null);
      expect(logPoster.addEntry).not.toHaveBeenCalled();

      vi.resetAllMocks();

      mockRuntime();
      resolveTarget.mockResolvedValue(null);
      await handle(makeAction(), makePlayerStats(), campaignName, null);
      expect(logPoster.addEntry).not.toHaveBeenCalled();
    });
  });
});
