// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

let testPendingSaves = {};
let _pendingSaveRegistry = {};

// ── Mocks BEFORE imports ───────────────────────────────────────

vi.mock('../../../dice/diceRoller.js', () => ({
  rollExpression: vi.fn(),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => {
  const mockFn = vi.fn();
  return {
    getRuntimeValue: mockFn,
    setRuntimeValue: vi.fn(async () => {}),
  };
});

vi.mock('../../../combat/auras/pendingSaveRegistry.js', () => ({
  registerPendingSavePrompt: vi.fn((id, data) => { _pendingSaveRegistry[id] = data; }),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn(async () => {}),
}));

vi.mock('../../../encounters/combatData.js', () => ({
  loadCombatSummary: vi.fn(async () => null),
  getCombatSummary: vi.fn(() => null),
}));

vi.mock('../../../rules/combat/applyDamage.js', () => ({
  applyDamageToTarget: vi.fn(() => ({ finalDamage: 0, newHp: 0 })),
}));

vi.mock('../../../combat/automation/automationService.js', () => ({
  hasIgnoreResistance: vi.fn(() => false),
}));

vi.mock('../../../rules/features/invisibilityService.js', () => ({
  endInvisibilityOnHostileAction: vi.fn(),
}));

// ── Imports ────────────────────────────────────────────────────

import { handle, confirmRadianceOfDawn } from './radianceOfDawnHandler.js';
import * as diceRoller from '../../../dice/diceRoller.js';
import * as useRuntimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as logService from '../../../ui/logService.js';
import * as combatData from '../../../encounters/combatData.js';
import * as applyDamage from '../../../rules/combat/applyDamage.js';
import * as automationService from '../../../combat/automation/automationService.js';
import * as invisibilityService from '../../../rules/features/invisibilityService.js';

// ── Helpers ────────────────────────────────────────────────────

const campaignName = 'TestCampaign';

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestCleric',
    level: 5,
    proficiency_bonus: 3,
    ability_scores: { WIS: { bonus: 2 } },
    class: {
      class_levels: [
        undefined,
        undefined,
        { channel_divinity: 2 },
        undefined,
        undefined,
      ],
    },
    ...overrides,
  };
}

function makeAction(automation = {}) {
  return {
    name: 'Radiance of the Dawn',
    automation: {
      saveDc: 13,
      saveType: 'CON',
      damage: '6d10 + cleric level',
      damageType: 'Radiant',
      shape: 'burst_20ft',
      ...automation,
    },
  };
}

function makeCreature(name, type = 'npc', overrides = {}) {
  return {
    name,
    type,
    currentHp: 30,
    maxHp: 60,
    saveBonuses: { con: 2 },
    ...overrides,
  };
}

function mockCombatSummary(creatureNames) {
  const creatures = creatureNames.map((n) => makeCreature(n));
  const summary = { creatures };
  combatData.loadCombatSummary.mockResolvedValue(summary);
  combatData.getCombatSummary.mockReturnValue(summary);
  return summary;
}

// ── Tests ──────────────────────────────────────────────────────

describe('radianceOfDawnHandler.handle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('charge validation', () => {
    it('returns no-charges popup when stored charges is 0', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(0);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.name).toBe('Radiance of the Dawn');
      expect(result.payload.description).toBe('No Channel Divinity charges remaining.');
      expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
    });


  });

  describe('charge consumption', () => {
    it('consumes one charge and proceeds to modal', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(2);
      mockCombatSummary(['Goblin']);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'TestCleric',
        'channelDivinityCharges',
        1,
        campaignName,
      );
      expect(result.type).toBe('modal');
    });

    it('falls back to class_specific.channel_divinity_charges when channel_divinity is 0', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(null);
      mockCombatSummary(['Goblin']);

      const ps = makePlayerStats({
        level: 3,
        class: {
          class_levels: [
            undefined,
            undefined,
            { channel_divinity: 0, class_specific: { channel_divinity_charges: 4 } },
          ],
        },
      });

      const result = await handle(makeAction(), ps, campaignName, null);

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'TestCleric',
        'channelDivinityCharges',
        3,
        campaignName,
      );
      expect(result.type).toBe('modal');
    });
  });

  describe('combat summary check', () => {
    it('returns modal with empty targets when no combat is active', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(2);
      combatData.loadCombatSummary.mockResolvedValue(null);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('modal');
      expect(result.payload.creatureTargets).toEqual([]);
    });
  });

  describe('creature target filtering', () => {
    it('excludes the player from creature targets', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(2);
      const cs = { creatures: [makeCreature('TestCleric'), makeCreature('Goblin')] };
      combatData.loadCombatSummary.mockResolvedValue(cs);
      combatData.getCombatSummary.mockReturnValue(cs);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('modal');
      expect(result.payload.creatureTargets).toEqual([expect.objectContaining({ name: 'Goblin' })]);
    });

    it('returns modal with empty targets when only the player is in combat', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(2);
      const cs = { creatures: [makeCreature('TestCleric')] };
      combatData.loadCombatSummary.mockResolvedValue(cs);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('modal');
      expect(result.payload.creatureTargets).toEqual([]);
    });
  });

  describe('modal payload', () => {
    it('returns a modal with modalName, action references, and creatureTargets', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(2);
      const cs = { creatures: [makeCreature('Goblin'), makeCreature('Orc')] };
      combatData.loadCombatSummary.mockResolvedValue(cs);
      combatData.getCombatSummary.mockReturnValue(cs);

      const action = makeAction();
      const ps = makePlayerStats();
      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('modal');
      expect(result.modalName).toBe('radianceOfDawn');
      expect(result.payload.action).toBe(action);
      expect(result.payload.playerStats).toBe(ps);
      expect(result.payload.campaignName).toBe(campaignName);
      expect(result.payload.creatureTargets).toHaveLength(2);
    });

    it('uses auto values when provided for saveDc, saveType, damage, and damageType', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(2);
      mockCombatSummary(['Goblin']);

      const result = await handle(
        makeAction({ saveDc: 15, saveType: 'DEX', damage: '4d10', damageType: 'Fire' }),
        makePlayerStats(),
        campaignName,
        null,
      );

      expect(result.payload.saveDc).toBe(15);
      expect(result.payload.saveType).toBe('DEX');
      expect(result.payload.damageExpression).toBe('4d10');
      expect(result.payload.damageType).toBe('Fire');
      expect(result.payload.featureName).toBe('Radiance of the Dawn');
    });

    it('falls back to computed saveDc, CON, empty damage, and Radiant when auto values are missing', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(2);
      mockCombatSummary(['Goblin']);

      const action = makeAction({ saveDc: undefined, saveType: undefined, damage: undefined, damageType: undefined });
      const result = await handle(action, makePlayerStats(), campaignName, null);

      expect(result.payload.saveDc).toBe(13);
      expect(result.payload.saveType).toBe('CON');
      expect(result.payload.damageExpression).toBe('');
      expect(result.payload.damageType).toBe('Radiant');
    });

    it('uses 30ft for emanation shape and 10ft otherwise', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(2);
      mockCombatSummary(['Goblin']);

      const emanationResult = await handle(makeAction({ shape: 'emanation_30ft' }), makePlayerStats(), campaignName, null);
      expect(emanationResult.payload.rangeFeet).toBe(30);

      const burstResult = await handle(makeAction({ shape: 'burst_20ft' }), makePlayerStats(), campaignName, null);
      expect(burstResult.payload.rangeFeet).toBe(10);

      const missingResult = await handle(makeAction({ shape: undefined }), makePlayerStats(), campaignName, null);
      expect(missingResult.payload.rangeFeet).toBe(10);
    });
  });
});

describe('radianceOfDawnHandler.confirmRadianceOfDawn', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    testPendingSaves = {};
    _pendingSaveRegistry = {};
    useRuntimeState.getRuntimeValue.mockImplementation((key, prop) => {
      if (prop === 'pendingSavePrompts') return testPendingSaves;
      return null;
    });
  });

  describe('damage resolution', () => {
    it('rolls damage using the resolved expression and returns popup', async () => {
      diceRoller.rollExpression.mockReturnValue({ total: 23, rolls: [6, 5, 4, 3, 2, 3], modifier: 5 });
      mockCombatSummary(['Goblin']);

      const action = makeAction();
      const result = await confirmRadianceOfDawn(action, makePlayerStats(), campaignName, ['Goblin']);

      expect(diceRoller.rollExpression).toHaveBeenCalledWith('6d10+5');
      expect(result.type).toBe('popup');
    });

    it('returns popup when rollExpression fails', async () => {
      diceRoller.rollExpression.mockReturnValue(null);
      mockCombatSummary(['Goblin']);

      const action = makeAction();
      const result = await confirmRadianceOfDawn(action, makePlayerStats(), campaignName, ['Goblin']);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toContain('Failed to roll damage');
    });
  });

  describe('combat summary check', () => {
    it('returns popup when getCombatSummary returns null', async () => {
      diceRoller.rollExpression.mockReturnValue({ total: 10, rolls: [10], modifier: 0 });
      combatData.getCombatSummary.mockReturnValue(null);

      const action = makeAction();
      const result = await confirmRadianceOfDawn(action, makePlayerStats(), campaignName, ['Goblin']);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('No active combat');
    });
  });

  describe('NPC target processing', () => {
    it('rolls a save for NPC targets and applies damage', async () => {
      diceRoller.rollExpression.mockReturnValue({ total: 20, rolls: [10, 10], modifier: 0 });
      const cs = { creatures: [makeCreature('Goblin', 'npc', { saveBonuses: { con: 2 } })] };
      combatData.getCombatSummary.mockReturnValue(cs);
      applyDamage.applyDamageToTarget.mockReturnValue({ finalDamage: 20, newHp: 10 });

      const action = makeAction();
      const result = await confirmRadianceOfDawn(action, makePlayerStats(), campaignName, ['Goblin']);

      expect(result.type).toBe('popup');
      expect(applyDamage.applyDamageToTarget).toHaveBeenCalled();
    });

    it('applies half damage on save success and full damage on save failure', async () => {
      diceRoller.rollExpression.mockReturnValue({ total: 20, rolls: [10, 10], modifier: 0 });
      applyDamage.applyDamageToTarget.mockReturnValue({ finalDamage: 10, newHp: 20 });
      const passSpy = vi.spyOn(Math, 'random').mockReturnValue(0.99);

      const csPass = { creatures: [makeCreature('Goblin', 'npc', { saveBonuses: { con: 5 } })] };
      combatData.getCombatSummary.mockReturnValue(csPass);
      const action = makeAction({ saveDc: 13 });
      const result = await confirmRadianceOfDawn(action, makePlayerStats(), campaignName, ['Goblin']);
      expect(result.payload.results[0].success).toBe(true);
      expect(result.payload.results[0].damage).toBe(10);
      passSpy.mockRestore();

      vi.clearAllMocks();
      diceRoller.rollExpression.mockReturnValue({ total: 20, rolls: [10, 10], modifier: 0 });
      applyDamage.applyDamageToTarget.mockReturnValue({ finalDamage: 20, newHp: 10 });
      const failSpy = vi.spyOn(Math, 'random').mockReturnValue(0.01);

      const csFail = { creatures: [makeCreature('Goblin', 'npc', { saveBonuses: { con: 0 } })] };
      combatData.getCombatSummary.mockReturnValue(csFail);
      const result2 = await confirmRadianceOfDawn(action, makePlayerStats(), campaignName, ['Goblin']);
      expect(result2.payload.results[0].success).toBe(false);
      expect(result2.payload.results[0].damage).toBe(20);
      failSpy.mockRestore();
    });

    it('skips targets not found in combat summary', async () => {
      diceRoller.rollExpression.mockReturnValue({ total: 20, rolls: [10, 10], modifier: 0 });
      const cs = { creatures: [makeCreature('Goblin')] };
      combatData.getCombatSummary.mockReturnValue(cs);

      const action = makeAction();
      const result = await confirmRadianceOfDawn(action, makePlayerStats(), campaignName, ['UnknownCreature']);

      expect(result.payload.results).toHaveLength(0);
    });
  });

  describe('player target processing', () => {
    it('sends a save prompt for player targets via SSE with correct damage info', async () => {
      diceRoller.rollExpression.mockReturnValue({ total: 25, rolls: [8, 7, 5, 5], modifier: 0 });
      const cs = { creatures: [makeCreature('player-1', 'player')] };
      combatData.getCombatSummary.mockReturnValue(cs);

      const action = makeAction({ saveDc: 15, damageType: 'Fire' });
      await confirmRadianceOfDawn(action, makePlayerStats(), campaignName, ['player-1']);

      expect(_pendingSaveRegistry).toBeDefined();
      const pendingSave = Object.values(_pendingSaveRegistry)[0];
      expect(pendingSave.targetName).toBe('player-1');
      expect(pendingSave.saveDc).toBe(15);
      expect(pendingSave.damageType).toBe('Fire');
      expect(pendingSave.rawDamage).toBe(25);
      expect(pendingSave.attackerName).toBe('TestCleric');
      expect(pendingSave.saveType).toBe('CON');
    });
  });

  describe('invisibility handling', () => {
    it('calls endInvisibilityOnHostileAction when NPC takes damage > 0', async () => {
      diceRoller.rollExpression.mockReturnValue({ total: 20, rolls: [10, 10], modifier: 0 });
      const cs = { creatures: [makeCreature('Goblin')] };
      combatData.getCombatSummary.mockReturnValue(cs);
      applyDamage.applyDamageToTarget.mockReturnValue({ finalDamage: 20, newHp: 10 });

      const action = makeAction();
      await confirmRadianceOfDawn(action, makePlayerStats(), campaignName, ['Goblin']);

      expect(invisibilityService.endInvisibilityOnHostileAction).toHaveBeenCalledWith(
        'TestCleric',
        campaignName,
      );
    });

    it('does not call endInvisibilityOnHostileAction when damage is 0', async () => {
      diceRoller.rollExpression.mockReturnValue({ total: 0, rolls: [0], modifier: 0 });
      const cs = { creatures: [makeCreature('Goblin')] };
      combatData.getCombatSummary.mockReturnValue(cs);
      applyDamage.applyDamageToTarget.mockReturnValue({ finalDamage: 0, newHp: 30 });

      const action = makeAction();
      await confirmRadianceOfDawn(action, makePlayerStats(), campaignName, ['Goblin']);

      expect(invisibilityService.endInvisibilityOnHostileAction).not.toHaveBeenCalled();
    });
  });

  describe('resistance handling', () => {
    it('passes ignoreResistance to applyDamageToTarget', async () => {
      diceRoller.rollExpression.mockReturnValue({ total: 20, rolls: [10, 10], modifier: 0 });
      const cs = { creatures: [makeCreature('Goblin')] };
      combatData.getCombatSummary.mockReturnValue(cs);
      applyDamage.applyDamageToTarget.mockReturnValue({ finalDamage: 20, newHp: 10 });
      automationService.hasIgnoreResistance.mockReturnValue(true);

      const action = makeAction();
      await confirmRadianceOfDawn(action, makePlayerStats(), campaignName, ['Goblin']);

      expect(automationService.hasIgnoreResistance).toHaveBeenCalledWith(
        makePlayerStats(),
        'Radiant',
      );
      expect(applyDamage.applyDamageToTarget).toHaveBeenCalledWith(
        expect.any(Object),
        'Goblin',
        expect.any(Number),
        ['Radiant'],
        campaignName,
        expect.any(Array),
        true,
        'TestCleric',
        true,
      );
    });
  });

  describe('logging', () => {
    it('logs save-damage entries for NPC targets and save-prompt entries for player targets', async () => {
      diceRoller.rollExpression.mockReturnValue({ total: 20, rolls: [10, 10], modifier: 5 });
      const cs = { creatures: [makeCreature('Goblin'), makeCreature('player-1', 'player')] };
      combatData.getCombatSummary.mockReturnValue(cs);
      applyDamage.applyDamageToTarget.mockReturnValue({ finalDamage: 20, newHp: 10 });

      const action = makeAction();
      await confirmRadianceOfDawn(action, makePlayerStats(), campaignName, ['Goblin', 'player-1']);

      const npcLogCalls = logService.addEntry.mock.calls.filter(
        (call) => call[1]?.type === 'roll' && call[1]?.rollType === 'save-damage',
      );
      expect(npcLogCalls.length).toBeGreaterThan(0);
      expect(npcLogCalls[0][1]).toMatchObject({
        characterName: 'TestCleric',
        rollType: 'save-damage',
        name: 'Radiance of the Dawn',
        targetName: 'Goblin',
        saveType: 'CON',
        saveDc: 13,
        finalDamage: 20,
        damageType: 'Radiant',
      });

      const playerLogCalls = logService.addEntry.mock.calls.filter(
        (call) => call[1]?.type === 'roll' && call[1]?.rollType === 'save-prompt',
      );
      expect(playerLogCalls.length).toBeGreaterThan(0);
      expect(playerLogCalls[0][1]).toMatchObject({
        characterName: 'TestCleric',
        rollType: 'save-prompt',
        name: 'Radiance of the Dawn',
        targetName: 'player-1',
        saveType: 'CON',
      });
    });
  });

  describe('combat summary persistence', () => {
    it('dispatches combat-summary-updated event', async () => {
      diceRoller.rollExpression.mockReturnValue({ total: 15, rolls: [15], modifier: 0 });
      const cs = { creatures: [makeCreature('Goblin')] };
      combatData.getCombatSummary.mockReturnValue(cs);
      applyDamage.applyDamageToTarget.mockReturnValue({ finalDamage: 15, newHp: 15 });

      const dispatchSpy = vi.spyOn(window, 'dispatchEvent');

      const action = makeAction();
      await confirmRadianceOfDawn(action, makePlayerStats(), campaignName, ['Goblin']);

      expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'combat-summary-updated' }));
      dispatchSpy.mockRestore();
    });
  });

  describe('popup results HTML', () => {
    it('includes feature name, save DC, damage, and pass/fail results in HTML', async () => {
      diceRoller.rollExpression.mockReturnValue({ total: 20, rolls: [10, 10], modifier: 0 });
      const cs = { creatures: [makeCreature('Goblin', 'npc', { saveBonuses: { con: 5 } })] };
      combatData.getCombatSummary.mockReturnValue(cs);
      applyDamage.applyDamageToTarget.mockReturnValue({ finalDamage: 10, newHp: 20 });
      const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.99);

      const action = makeAction({ saveDc: 15 });
      const result = await confirmRadianceOfDawn(action, makePlayerStats(), campaignName, ['Goblin']);

      expect(result.payload.description).toContain('Radiance of the Dawn used!');
      expect(result.payload.description).toContain('DC 15');
      expect(result.payload.description).toContain('20 Radiant damage');
      expect(result.payload.description).toContain('Goblin');
      expect(result.payload.description).toContain('half damage');
      randomSpy.mockRestore();
    });
  });

  describe('multiple targets', () => {
    it('processes multiple NPC targets and returns results for each', async () => {
      diceRoller.rollExpression.mockReturnValue({ total: 20, rolls: [10, 10], modifier: 0 });
      const cs = {
        creatures: [
          makeCreature('Goblin'),
          makeCreature('Orc', 'npc', { saveBonuses: { con: 4 } }),
        ],
      };
      combatData.getCombatSummary.mockReturnValue(cs);
      applyDamage.applyDamageToTarget
        .mockReturnValueOnce({ finalDamage: 20, newHp: 10 })
        .mockReturnValueOnce({ finalDamage: 10, newHp: 25 });

      const action = makeAction({ saveDc: 13 });
      const result = await confirmRadianceOfDawn(action, makePlayerStats(), campaignName, ['Goblin', 'Orc']);

      expect(result.payload.results).toHaveLength(2);
      expect(result.payload.results[0].targetName).toBe('Goblin');
      expect(result.payload.results[1].targetName).toBe('Orc');
    });

    it('mixes NPC and player targets correctly', async () => {
      diceRoller.rollExpression.mockReturnValue({ total: 15, rolls: [15], modifier: 0 });
      const cs = {
        creatures: [
          makeCreature('Goblin'),
          makeCreature('player-1', 'player'),
        ],
      };
      combatData.getCombatSummary.mockReturnValue(cs);
      applyDamage.applyDamageToTarget.mockReturnValue({ finalDamage: 15, newHp: 15 });

      const action = makeAction();
      const result = await confirmRadianceOfDawn(action, makePlayerStats(), campaignName, ['Goblin', 'player-1']);

      expect(result.payload.results).toHaveLength(1);
      expect(result.payload.description).toContain('1 player rolling saves...');
    });

    it('shows correct player count for multiple player targets', async () => {
      diceRoller.rollExpression.mockReturnValue({ total: 15, rolls: [15], modifier: 0 });
      const cs = {
        creatures: [
          makeCreature('player-1', 'player'),
          makeCreature('player-2', 'player'),
        ],
      };
      combatData.getCombatSummary.mockReturnValue(cs);

      const action = makeAction();
      const result = await confirmRadianceOfDawn(action, makePlayerStats(), campaignName, ['player-1', 'player-2']);

      expect(result.payload.description).toContain('2 players rolling saves...');
    });
  });

  describe('edge cases', () => {
    it('handles empty selectedTargets array', async () => {
      diceRoller.rollExpression.mockReturnValue({ total: 20, rolls: [10, 10], modifier: 0 });
      const cs = { creatures: [makeCreature('Goblin')] };
      combatData.getCombatSummary.mockReturnValue(cs);

      const action = makeAction();
      const result = await confirmRadianceOfDawn(action, makePlayerStats(), campaignName, []);

      expect(result.type).toBe('popup');
      expect(result.payload.results).toHaveLength(0);
    });
  });
});
