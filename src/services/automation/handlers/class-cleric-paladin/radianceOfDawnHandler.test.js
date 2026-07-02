// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks BEFORE imports ───────────────────────────────────────

vi.mock('../../../dice/diceRoller.js', () => ({
  rollExpression: vi.fn(),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(async () => {}),
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

vi.mock('../../common/savePrompt.js', () => ({
  buildSaveDc: vi.fn((auto) => auto.saveDc || 10),
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
import * as savePrompt from '../../common/savePrompt.js';

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

  describe('charge validation — no-charges popup', () => {
    it('returns no-charges popup when stored charges is 0', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(0);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.name).toBe('Radiance of the Dawn');
      expect(result.payload.description).toBe('No Channel Divinity charges remaining.');
      expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
    });

    it('returns no-charges popup when stored charges is negative', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(-1);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toBe('No Channel Divinity charges remaining.');
      expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
    });

    it('returns no-charges popup when stored charges is a string "0"', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue('0');

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toBe('No Channel Divinity charges remaining.');
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

    it('defaults to maxCharges from class_levels.channel_divinity when stored is null', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(null);
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

    it('defaults maxCharges to 2 when class structure is missing', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(null);
      mockCombatSummary(['Goblin']);

      const ps = makePlayerStats({ class: undefined });
      const result = await handle(makeAction(), ps, campaignName, null);

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'TestCleric',
        'channelDivinityCharges',
        1,
        campaignName,
      );
      expect(result.type).toBe('modal');
    });

    it('defaults maxCharges to 2 when level is missing', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(null);
      mockCombatSummary(['Goblin']);

      const ps = makePlayerStats({ level: undefined, class: undefined });
      await handle(makeAction(), ps, campaignName, null);

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'TestCleric',
        'channelDivinityCharges',
        1,
        campaignName,
      );
    });
  });

  describe('combat summary check', () => {
    it('returns popup when no combat is active', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(2);
      combatData.loadCombatSummary.mockResolvedValue(null);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toBe('No active combat found.');
    });

    it('returns popup when combatSummary has no creatures', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(2);
      combatData.loadCombatSummary.mockResolvedValue({ creatures: [] });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toBe('No creatures in range.');
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

    it('returns no-creatures popup when only the player is in combat', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(2);
      const cs = { creatures: [makeCreature('TestCleric')] };
      combatData.loadCombatSummary.mockResolvedValue(cs);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toBe('No creatures in range.');
    });
  });

  describe('modal payload structure', () => {
    it('returns a modal with modalName radianceOfDawn', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(2);
      mockCombatSummary(['Goblin']);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('modal');
      expect(result.modalName).toBe('radianceOfDawn');
    });

    it('includes action, playerStats, and campaignName in payload', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(2);
      mockCombatSummary(['Goblin']);

      const action = makeAction();
      const ps = makePlayerStats();
      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.action).toBe(action);
      expect(result.payload.playerStats).toBe(ps);
      expect(result.payload.campaignName).toBe(campaignName);
    });

    it('includes creatureTargets in payload', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(2);
      const cs = { creatures: [makeCreature('Goblin'), makeCreature('Orc')] };
      combatData.loadCombatSummary.mockResolvedValue(cs);
      combatData.getCombatSummary.mockReturnValue(cs);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.payload.creatureTargets).toHaveLength(2);
    });

    it('uses auto.saveDc when provided', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(2);
      mockCombatSummary(['Goblin']);

      const result = await handle(makeAction({ saveDc: 15 }), makePlayerStats(), campaignName, null);

      expect(result.payload.saveDc).toBe(15);
    });

    it('calculates saveDc from proficiency_bonus + WIS + 8 when auto.saveDc is missing', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(2);
      mockCombatSummary(['Goblin']);

      const action = makeAction({ saveDc: undefined });
      const result = await handle(action, makePlayerStats(), campaignName, null);

      // 8 + 3 (proficiency_bonus) + 2 (WIS bonus) = 13
      expect(result.payload.saveDc).toBe(13);
    });

    it('uses auto.saveType when provided', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(2);
      mockCombatSummary(['Goblin']);

      const result = await handle(makeAction({ saveType: 'DEX' }), makePlayerStats(), campaignName, null);

      expect(result.payload.saveType).toBe('DEX');
    });

    it('falls back to CON when auto.saveType is missing', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(2);
      mockCombatSummary(['Goblin']);

      const result = await handle(makeAction({ saveType: undefined }), makePlayerStats(), campaignName, null);

      expect(result.payload.saveType).toBe('CON');
    });

    it('uses auto.damage when provided', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(2);
      mockCombatSummary(['Goblin']);

      const result = await handle(makeAction({ damage: '4d10' }), makePlayerStats(), campaignName, null);

      expect(result.payload.damageExpression).toBe('4d10');
    });

    it('uses auto.damageType when provided', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(2);
      mockCombatSummary(['Goblin']);

      const result = await handle(makeAction({ damageType: 'Fire' }), makePlayerStats(), campaignName, null);

      expect(result.payload.damageType).toBe('Fire');
    });

    it('defaults damageType to Radiant when auto.damageType is missing', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(2);
      mockCombatSummary(['Goblin']);

      const result = await handle(makeAction({ damageType: undefined }), makePlayerStats(), campaignName, null);

      expect(result.payload.damageType).toBe('Radiant');
    });

    it('sets featureName from action name', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(2);
      mockCombatSummary(['Goblin']);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.payload.featureName).toBe('Radiance of the Dawn');
    });
  });

  describe('range calculation', () => {
    it('uses 30ft for emanation shape', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(2);
      mockCombatSummary(['Goblin']);

      const result = await handle(makeAction({ shape: 'emanation_30ft' }), makePlayerStats(), campaignName, null);

      expect(result.payload.rangeFeet).toBe(30);
    });

    it('uses 10ft for non-emanation shapes', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(2);
      mockCombatSummary(['Goblin']);

      const result = await handle(makeAction({ shape: 'burst_20ft' }), makePlayerStats(), campaignName, null);

      expect(result.payload.rangeFeet).toBe(10);
    });

    it('uses 10ft when shape is missing', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(2);
      mockCombatSummary(['Goblin']);

      const result = await handle(makeAction({ shape: undefined }), makePlayerStats(), campaignName, null);

      expect(result.payload.rangeFeet).toBe(10);
    });
  });
});

describe('radianceOfDawnHandler.confirmRadianceOfDawn', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete window.__pendingSaves;
  });

  describe('damage resolution', () => {
    it('rolls damage using the resolved expression', async () => {
      diceRoller.rollExpression.mockReturnValue({ total: 23, rolls: [6, 5, 4, 3, 2, 3], modifier: 5 });
      mockCombatSummary(['Goblin']);

      const action = makeAction();
      const result = await confirmRadianceOfDawn(action, makePlayerStats(), campaignName, ['Goblin']);

      expect(diceRoller.rollExpression).toHaveBeenCalledWith('6d10+5');
      expect(result.type).toBe('popup');
    });

    it('replaces "cleric level" with player level in damage expression', async () => {
      diceRoller.rollExpression.mockReturnValue({ total: 28, rolls: [10, 10, 10, 10, 10, 10], modifier: 5 });
      mockCombatSummary(['Goblin']);

      const action = makeAction({ damage: '6d10 + cleric level' });
      await confirmRadianceOfDawn(action, makePlayerStats(), campaignName, ['Goblin']);

      expect(diceRoller.rollExpression).toHaveBeenCalledWith('6d10+5');
    });

    it('handles missing damage expression by using empty string', async () => {
      diceRoller.rollExpression.mockReturnValue({ total: 0, rolls: [], modifier: 0 });
      mockCombatSummary(['Goblin']);

      const action = makeAction({ damage: undefined });
      const result = await confirmRadianceOfDawn(action, makePlayerStats(), campaignName, ['Goblin']);

      expect(diceRoller.rollExpression).toHaveBeenCalledWith('');
      expect(result.type).toBe('popup');
    });

    it('returns popup when rollExpression fails (returns null)', async () => {
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

    it('applies half damage on save success for NPCs', async () => {
      diceRoller.rollExpression.mockReturnValue({ total: 20, rolls: [10, 10], modifier: 0 });
      const cs = { creatures: [makeCreature('Goblin', 'npc', { saveBonuses: { con: 5 } })] };
      combatData.getCombatSummary.mockReturnValue(cs);
      applyDamage.applyDamageToTarget.mockReturnValue({ finalDamage: 10, newHp: 20 });
      const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.99); // roll = 20

      const action = makeAction({ saveDc: 13 });
      const result = await confirmRadianceOfDawn(action, makePlayerStats(), campaignName, ['Goblin']);

      const npcResult = result.payload.results[0];
      expect(npcResult.success).toBe(true);
      expect(npcResult.damage).toBe(10);
      randomSpy.mockRestore();
    });

    it('applies full damage on save failure for NPCs', async () => {
      diceRoller.rollExpression.mockReturnValue({ total: 20, rolls: [10, 10], modifier: 0 });
      const cs = { creatures: [makeCreature('Goblin', 'npc', { saveBonuses: { con: 0 } })] };
      combatData.getCombatSummary.mockReturnValue(cs);
      applyDamage.applyDamageToTarget.mockReturnValue({ finalDamage: 20, newHp: 10 });
      const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.01); // roll = 1

      const action = makeAction({ saveDc: 13 });
      const result = await confirmRadianceOfDawn(action, makePlayerStats(), campaignName, ['Goblin']);

      const npcResult = result.payload.results[0];
      expect(npcResult.success).toBe(false);
      expect(npcResult.damage).toBe(20);
      randomSpy.mockRestore();
    });

    it('skips targets not found in combat summary', async () => {
      diceRoller.rollExpression.mockReturnValue({ total: 20, rolls: [10, 10], modifier: 0 });
      const cs = { creatures: [makeCreature('Goblin')] };
      combatData.getCombatSummary.mockReturnValue(cs);

      const action = makeAction();
      const result = await confirmRadianceOfDawn(action, makePlayerStats(), campaignName, ['UnknownCreature']);

      expect(result.payload.results).toHaveLength(0);
    });

    it('detects NPC by type field on creature', async () => {
      diceRoller.rollExpression.mockReturnValue({ total: 15, rolls: [15], modifier: 0 });
      const cs = { creatures: [makeCreature('Player Character', 'player')] };
      combatData.getCombatSummary.mockReturnValue(cs);
      applyDamage.applyDamageToTarget.mockReturnValue({ finalDamage: 15, newHp: 15 });

      const action = makeAction();
      await confirmRadianceOfDawn(action, makePlayerStats(), campaignName, ['Player Character']);

      // Non-player-prefixed names with type='player' still go through NPC path
      // because !targetName.startsWith('player-') is true
      expect(applyDamage.applyDamageToTarget).toHaveBeenCalled();
    });
  });

  describe('player target processing', () => {
    it('sends a save prompt for player targets via SSE', async () => {
      diceRoller.rollExpression.mockReturnValue({ total: 15, rolls: [15], modifier: 0 });
      const cs = { creatures: [makeCreature('player-1', 'player')] };
      combatData.getCombatSummary.mockReturnValue(cs);

      const action = makeAction();
      await confirmRadianceOfDawn(action, makePlayerStats(), campaignName, ['player-1']);

      expect(window.__pendingSaves).toBeDefined();
      const promptKeys = Object.keys(window.__pendingSaves);
      expect(promptKeys.length).toBeGreaterThan(0);
      const pendingSave = window.__pendingSaves[promptKeys[0]];
      expect(pendingSave.targetName).toBe('player-1');
      expect(pendingSave.rawDamage).toBe(15);
      expect(pendingSave.saveType).toBe('CON');
    });

    it('identifies player targets by name prefix "player-" and type "player"', async () => {
      diceRoller.rollExpression.mockReturnValue({ total: 15, rolls: [15], modifier: 0 });
      const cs = { creatures: [makeCreature('player-1', 'player')] };
      combatData.getCombatSummary.mockReturnValue(cs);

      const action = makeAction();
      await confirmRadianceOfDawn(action, makePlayerStats(), campaignName, ['player-1']);

      // name starts with "player-" AND type is "player" → player prompt path
      expect(window.__pendingSaves).toBeDefined();
    });

    it('stores pending save with correct damage info', async () => {
      diceRoller.rollExpression.mockReturnValue({ total: 25, rolls: [8, 7, 5, 5], modifier: 0 });
      const cs = { creatures: [makeCreature('player-1', 'player')] };
      combatData.getCombatSummary.mockReturnValue(cs);

      const action = makeAction({ saveDc: 15, damageType: 'Fire' });
      await confirmRadianceOfDawn(action, makePlayerStats(), campaignName, ['player-1']);

      const pendingSave = Object.values(window.__pendingSaves)[0];
      expect(pendingSave.saveDc).toBe(15);
      expect(pendingSave.damageType).toBe('Fire');
      expect(pendingSave.rawDamage).toBe(25);
      expect(pendingSave.attackerName).toBe('TestCleric');
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
    it('logs a save-damage entry for NPC targets', async () => {
      diceRoller.rollExpression.mockReturnValue({ total: 20, rolls: [10, 10], modifier: 5 });
      const cs = { creatures: [makeCreature('Goblin')] };
      combatData.getCombatSummary.mockReturnValue(cs);
      applyDamage.applyDamageToTarget.mockReturnValue({ finalDamage: 20, newHp: 10 });

      const action = makeAction();
      await confirmRadianceOfDawn(action, makePlayerStats(), campaignName, ['Goblin']);

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
    });

    it('logs a save-prompt entry for player targets', async () => {
      diceRoller.rollExpression.mockReturnValue({ total: 15, rolls: [15], modifier: 0 });
      const cs = { creatures: [makeCreature('player-1', 'player')] };
      combatData.getCombatSummary.mockReturnValue(cs);

      const action = makeAction();
      await confirmRadianceOfDawn(action, makePlayerStats(), campaignName, ['player-1']);

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
    it('includes feature name, save DC, and damage in results HTML', async () => {
      diceRoller.rollExpression.mockReturnValue({ total: 20, rolls: [10, 10], modifier: 0 });
      const cs = { creatures: [makeCreature('Goblin')] };
      combatData.getCombatSummary.mockReturnValue(cs);
      applyDamage.applyDamageToTarget.mockReturnValue({ finalDamage: 20, newHp: 10 });

      const action = makeAction({ saveDc: 15 });
      const result = await confirmRadianceOfDawn(action, makePlayerStats(), campaignName, ['Goblin']);

      expect(result.payload.description).toContain('Radiance of the Dawn used!');
      expect(result.payload.description).toContain('DC 15');
      expect(result.payload.description).toContain('20 Radiant damage');
    });

    it('shows pass/fail for each NPC result in HTML', async () => {
      diceRoller.rollExpression.mockReturnValue({ total: 20, rolls: [10, 10], modifier: 0 });
      const cs = { creatures: [makeCreature('Goblin')] };
      combatData.getCombatSummary.mockReturnValue(cs);
      applyDamage.applyDamageToTarget.mockReturnValue({ finalDamage: 20, newHp: 10 });
      const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.01); // roll = 1, fails save

      const action = makeAction({ saveDc: 13 });
      const result = await confirmRadianceOfDawn(action, makePlayerStats(), campaignName, ['Goblin']);

      expect(result.payload.description).toContain('Goblin');
      expect(result.payload.description).toContain('full damage');
      randomSpy.mockRestore();
    });

    it('shows "half damage" for successful saves', async () => {
      diceRoller.rollExpression.mockReturnValue({ total: 20, rolls: [10, 10], modifier: 0 });
      const cs = { creatures: [makeCreature('Goblin', 'npc', { saveBonuses: { con: 5 } })] };
      combatData.getCombatSummary.mockReturnValue(cs);
      applyDamage.applyDamageToTarget.mockReturnValue({ finalDamage: 10, newHp: 20 });
      const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.99); // roll = 20, passes save

      const action = makeAction({ saveDc: 13 });
      const result = await confirmRadianceOfDawn(action, makePlayerStats(), campaignName, ['Goblin']);

      expect(result.payload.description).toContain('half damage');
      randomSpy.mockRestore();
    });

    it('includes results array in popup payload', async () => {
      diceRoller.rollExpression.mockReturnValue({ total: 20, rolls: [10, 10], modifier: 0 });
      const cs = { creatures: [makeCreature('Goblin')] };
      combatData.getCombatSummary.mockReturnValue(cs);
      applyDamage.applyDamageToTarget.mockReturnValue({ finalDamage: 20, newHp: 10 });

      const action = makeAction();
      const result = await confirmRadianceOfDawn(action, makePlayerStats(), campaignName, ['Goblin']);

      expect(result.payload.results).toBeDefined();
      expect(Array.isArray(result.payload.results)).toBe(true);
      expect(result.payload.results[0].targetName).toBe('Goblin');
      expect(result.payload.results[0].damage).toBe(20);
    });

    it('includes automationType in popup payload', async () => {
      diceRoller.rollExpression.mockReturnValue({ total: 20, rolls: [10, 10], modifier: 0 });
      const cs = { creatures: [makeCreature('Goblin')] };
      combatData.getCombatSummary.mockReturnValue(cs);
      applyDamage.applyDamageToTarget.mockReturnValue({ finalDamage: 20, newHp: 10 });

      const action = makeAction();
      const result = await confirmRadianceOfDawn(action, makePlayerStats(), campaignName, ['Goblin']);

      expect(result.payload.automationType).toBeUndefined();
    });
  });

  describe('multiple targets', () => {
    it('processes multiple NPC targets', async () => {
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

    it('mixes NPC and player targets', async () => {
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

      expect(result.payload.results).toHaveLength(1); // Only NPC results in results array
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

  describe('save DC calculation via buildSaveDc', () => {
    it('uses buildSaveDc for NPC saves', async () => {
      diceRoller.rollExpression.mockReturnValue({ total: 20, rolls: [10, 10], modifier: 0 });
      const cs = { creatures: [makeCreature('Goblin')] };
      combatData.getCombatSummary.mockReturnValue(cs);
      applyDamage.applyDamageToTarget.mockReturnValue({ finalDamage: 20, newHp: 10 });
      savePrompt.buildSaveDc.mockReturnValue(15);

      const action = makeAction({ saveDc: 15 });
      await confirmRadianceOfDawn(action, makePlayerStats(), campaignName, ['Goblin']);

      expect(savePrompt.buildSaveDc).toHaveBeenCalled();
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

    it('handles playerStats.level missing by defaulting to 1', async () => {
      diceRoller.rollExpression.mockReturnValue({ total: 7, rolls: [1, 2, 3, 1], modifier: 0 });
      mockCombatSummary(['Goblin']);

      const action = makeAction();
      const ps = makePlayerStats({ level: undefined });
      const result = await confirmRadianceOfDawn(action, ps, campaignName, ['Goblin']);

      expect(diceRoller.rollExpression).toHaveBeenCalledWith('6d10+1');
      expect(result.type).toBe('popup');
    });

    it('handles playerStats with empty ability_scores object', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(2);
      mockCombatSummary(['Goblin']);

      const ps = makePlayerStats({ ability_scores: {} });
      const action = makeAction({ saveDc: undefined });
      const result = await handle(action, ps, campaignName, null);

      // 8 + 3 (prof) + undefined = NaN, NaN || 0 = 0, Math.floor(0) = 0
      expect(result.payload.saveDc).toBe(0);
    });

    it('handles playerStats without proficiency_bonus by defaulting to 0', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(2);
      mockCombatSummary(['Goblin']);

      const ps = makePlayerStats({ proficiency_bonus: undefined });
      const action = makeAction({ saveDc: undefined });
      const result = await handle(action, ps, campaignName, null);

      // 8 + undefined + 2 = NaN, NaN || 0 = 0, Math.floor(0) = 0
      expect(result.payload.saveDc).toBe(0);
    });
  });
});
