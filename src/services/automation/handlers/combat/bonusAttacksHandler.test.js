// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks BEFORE imports ───────────────────────────────────────

vi.mock('../../../encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../dice/diceRoller.js', () => ({
  rollD20: vi.fn(),
  rollExpression: vi.fn(),
  rollExpressionDoubled: vi.fn(),
}));

vi.mock('../../../rules/combat/applyDamage.js', () => ({
  applyDamageToTarget: vi.fn(),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getTargetFromAttacker: vi.fn(),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../rules/features/invisibilityService.js', () => ({
  endInvisibilityOnHostileAction: vi.fn(),
}));

vi.mock('../../../ui/utils.js', () => ({
  DEBUG_FORCE_CRIT: false,
}));

vi.mock('../../common/healingRoll.js', () => ({
  applyHealingDirectly: vi.fn(),
}));

vi.mock('../../common/savePrompt.js', () => ({
  createSaveListener: vi.fn(),
  buildSaveDc: vi.fn(),
}));

vi.mock('../../../combat/automation/automationService.js', () => ({
  evaluateAutoExpression: vi.fn(),
}));

// ── Imports ────────────────────────────────────────────────────

import { handle, applyFlurryOfBlows } from './bonusAttacksHandler.js';
import { getCombatSummary } from '../../../encounters/combatData.js';
import { addEntry } from '../../../ui/logService.js';
import { rollD20, rollExpression, rollExpressionDoubled } from '../../../dice/diceRoller.js';
import { applyDamageToTarget } from '../../../rules/combat/applyDamage.js';
import { getTargetFromAttacker } from '../../../rules/combat/damageUtils.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { endInvisibilityOnHostileAction } from '../../../rules/features/invisibilityService.js';
import { applyHealingDirectly } from '../../common/healingRoll.js';
import { createSaveListener, buildSaveDc } from '../../common/savePrompt.js';

// ── Helpers ────────────────────────────────────────────────────

const campaignName = 'test-campaign';
const mapName = 'test-map';

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestMonk',
    attacks: [{ hitBonus: 6, damage: '1d6+3', damageType: 'Bludgeoning' }],
    ...overrides,
  };
}

function makeCreature(name, hp = 10, ac = 12) {
  return { name, currentHp: hp, maxHp: hp, ac };
}

function makeCombatSummary(creatures) {
  return { creatures };
}

function mockDefaultDamageResult() {
  applyDamageToTarget.mockReturnValue({ finalDamage: 4, newHp: 6 });
  rollExpression.mockReturnValue({ total: 5, rolls: [3, 2], modifier: 0 });
  rollExpressionDoubled.mockReturnValue({ total: 10, rolls: [3, 2, 3, 2], modifier: 0 });
}

// ── Tests ──────────────────────────────────────────────────────

describe('bonusAttacksHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCombatSummary.mockReturnValue(null);
    getTargetFromAttacker.mockReturnValue(null);
    getRuntimeValue.mockReturnValue(null);
    mockDefaultDamageResult();
  });

  describe('handle', () => {
    const action = {
      name: 'Heightened Flurry of Blows',
      automation: {
        type: 'bonus_attacks',
        attacks: 3,
        attackType: 'unarmed_strike',
      },
    };

    it('returns popup with automation_info type when no combat context', async () => {
      const result = await handle(action, makePlayerStats(), campaignName, mapName);
      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.name).toBe(action.name);
      expect(result.payload.description).toContain('No combat context found');
      expect(result.payload.description).toContain(action.name);
      expect(result.payload.automation).toBe(action.automation);
    });

    it('returns popup with "No valid targets found" when combat has no creatures or only the player', async () => {
      getCombatSummary.mockReturnValue(makeCombatSummary([]));
      let result = await handle(action, makePlayerStats(), campaignName, mapName);
      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('No valid targets found');

      getCombatSummary.mockReturnValue(makeCombatSummary([makeCreature('TestMonk', 20, 12)]));
      result = await handle(action, makePlayerStats(), campaignName, mapName);
      expect(result.payload.description).toContain('No valid targets found');
    });

    it('returns modal with creature targets excluding the player', async () => {
      getCombatSummary.mockReturnValue(makeCombatSummary([
        makeCreature('TestMonk', 20, 12),
        makeCreature('Goblin', 7, 15),
        makeCreature('Orc', 15, 13),
      ]));

      const result = await handle(action, makePlayerStats(), campaignName, mapName);
      expect(result.type).toBe('modal');
      expect(result.modalName).toBe('flurryOfBlows');
      expect(result.payload.creatureTargets).toEqual(['Goblin', 'Orc']);
      expect(result.payload.numAttacks).toBe(3);
      expect(result.payload.attackBonus).toBe(6);
      expect(result.payload.damageFormula).toBe('1d6+3');
      expect(result.payload.damageType).toBe('Bludgeoning');
      expect(result.payload.currentTargetName).toBeNull();
      expect(result.payload.campaignName).toBe(campaignName);
      expect(result.payload.mapName).toBe(mapName);
    });

    it('uses default attack values when playerStats.attacks is undefined or first entry is undefined', async () => {
      getCombatSummary.mockReturnValue(makeCombatSummary([makeCreature('Goblin', 7, 15)]));

      let playerStats = makePlayerStats({ attacks: undefined });
      let result = await handle(action, playerStats, campaignName, mapName);
      expect(result.payload.attackBonus).toBe(0);
      expect(result.payload.damageFormula).toBe('1d4+0');
      expect(result.payload.damageType).toBe('Bludgeoning');

      playerStats = makePlayerStats({ attacks: [undefined] });
      result = await handle(action, playerStats, campaignName, mapName);
      expect(result.payload.attackBonus).toBe(0);
      expect(result.payload.damageFormula).toBe('1d4+0');
      expect(result.payload.damageType).toBe('Bludgeoning');
    });

    it('passes action and playerStats through in modal payload', async () => {
      getCombatSummary.mockReturnValue(makeCombatSummary([makeCreature('Goblin', 7, 15)]));
      const playerStats = makePlayerStats();
      const result = await handle(action, playerStats, campaignName, mapName);
      expect(result.payload.action).toBe(action);
      expect(result.payload.playerStats).toBe(playerStats);
    });
  });

  describe('applyFlurryOfBlows', () => {
    const action = {
      name: 'Heightened Flurry of Blows',
      automation: {
        type: 'bonus_attacks',
        attacks: 3,
      },
    };

    const combatSummary = makeCombatSummary([
      makeCreature('TestMonk', 20, 12),
      makeCreature('Goblin', 7, 15),
      makeCreature('Orc', 15, 13),
    ]);

    it('returns null when distribution is falsy or combat summary is unavailable', async () => {
      getCombatSummary.mockReturnValue(combatSummary);
      let result = await applyFlurryOfBlows({ action: action, playerStats: makePlayerStats(), campaignName, _mapName: mapName, distribution: null, numAttacks: 3 });
      expect(result).toBeNull();

      getCombatSummary.mockReturnValue(null);
      result = await applyFlurryOfBlows({ action: action, playerStats: makePlayerStats(), campaignName, _mapName: mapName, distribution: { Goblin: 1 }, numAttacks: 1 });
      expect(result).toBeNull();
    });

    it('skips targets with 0 attacks and logs ability use', async () => {
      getCombatSummary.mockReturnValue(combatSummary);
      const result = await applyFlurryOfBlows({ action: action, playerStats: makePlayerStats(), campaignName, _mapName: mapName, distribution: { Goblin: 0, Orc: 3 }, numAttacks: 3 });
      expect(result.type).toBe('popup');
      expect(addEntry).toHaveBeenCalled();
      const abilityUseEntry = addEntry.mock.calls.find(
        call => call[1].type === 'ability_use'
      );
      expect(abilityUseEntry).toBeDefined();
      expect(abilityUseEntry[1].description).toContain('making 3 unarmed strikes');
      expect(abilityUseEntry[1].description).toContain('Total damage dealt: 0');
    });

    it('performs correct number of attacks per target', async () => {
      getCombatSummary.mockReturnValue(combatSummary);
      vi.mocked(rollD20)
        .mockReturnValueOnce(18)
        .mockReturnValueOnce(12)
        .mockReturnValueOnce(20);

      const result = await applyFlurryOfBlows({ action: action, playerStats: makePlayerStats(), campaignName, _mapName: mapName, distribution: { Goblin: 2, Orc: 1 }, numAttacks: 3 });

      expect(rollD20).toHaveBeenCalledTimes(3);
      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toContain('3/3 hits');
      expect(result.payload.description).toContain('1 critical');
    });

    it('includes detailed attack results for hits, misses, and crits', async () => {
      getCombatSummary.mockReturnValue(combatSummary);
      vi.mocked(rollD20)
        .mockReturnValueOnce(1)   // natural 1 → auto miss
        .mockReturnValueOnce(20)  // natural 20 → crit
        .mockReturnValueOnce(10); // normal hit (6+10=16 >= 15)

      const result = await applyFlurryOfBlows({ action: action, playerStats: makePlayerStats(), campaignName, _mapName: mapName, distribution: { Goblin: 1, Orc: 2 }, numAttacks: 3 });

      const desc = result.payload.description;
      expect(desc).toContain('Miss');
      expect(desc).toContain('CRIT');
      expect(desc).toContain('Hit');
      expect(desc).toContain('AC 15');
      expect(desc).toContain('AC 13');
      expect(desc).toContain('doubled dice');
      expect(desc).toContain('Bludgeoning');
      expect(desc).toContain('d20: 1 + 6 = 7');
      expect(desc).toContain('d20: 20 + 6 = 26');
    });

    it('does not deal damage on natural 1 (auto miss)', async () => {
      getCombatSummary.mockReturnValue(combatSummary);
      vi.mocked(rollD20).mockReturnValue(1);

      await applyFlurryOfBlows({ action: action, playerStats: makePlayerStats(), campaignName, _mapName: mapName, distribution: { Goblin: 1 }, numAttacks: 1 });

      expect(applyDamageToTarget).not.toHaveBeenCalled();
    });

    it('uses doubled damage dice on crit and normal dice on non-crit hit', async () => {
      getCombatSummary.mockReturnValue(combatSummary);

      vi.mocked(rollD20).mockReturnValue(20);
      await applyFlurryOfBlows({ action: action, playerStats: makePlayerStats(), campaignName, _mapName: mapName, distribution: { Goblin: 1 }, numAttacks: 1 });
      expect(rollExpressionDoubled).toHaveBeenCalledWith('1d6+3');
      expect(rollExpression).not.toHaveBeenCalled();

      vi.clearAllMocks();
      getCombatSummary.mockReturnValue(combatSummary);
      mockDefaultDamageResult();
      vi.mocked(rollD20).mockReturnValue(15);
      await applyFlurryOfBlows({ action: action, playerStats: makePlayerStats(), campaignName, _mapName: mapName, distribution: { Goblin: 1 }, numAttacks: 1 });
      expect(rollExpression).toHaveBeenCalledWith('1d6+3');
      expect(rollExpressionDoubled).not.toHaveBeenCalled();
    });

    it('includes openHandTargets when player has open_hand_technique and hits, and excludes it when missing, missing, or attack misses', async () => {
      getCombatSummary.mockReturnValue(combatSummary);
      vi.mocked(rollD20).mockReturnValue(18);
      applyDamageToTarget.mockReturnValue({ finalDamage: 4, newHp: 6 });

      const actionWithOpenHand = {
        name: 'Flurry of Blows',
        automation: {
          type: 'bonus_attacks',
          attacks: 1,
        },
      };

      const playerStatsWithOpenHand = makePlayerStats({
        automation: {
          actions: [
            { type: 'open_hand_technique', name: 'Open Hand Technique' },
          ],
        },
      });

      // Has feature and hits → includes openHandTargets
      let result = await applyFlurryOfBlows({ action: actionWithOpenHand, playerStats: playerStatsWithOpenHand, campaignName, _mapName: mapName, distribution: { Goblin: 1 }, numAttacks: 1 });
      expect(result.openHandTargets).toEqual([
        {
          targetName: 'Goblin',
          action: { type: 'open_hand_technique', name: 'Open Hand Technique' },
          playerStats: playerStatsWithOpenHand,
          campaignName,
          mapName,
        },
      ]);

      // No feature → no openHandTargets
      vi.clearAllMocks();
      getCombatSummary.mockReturnValue(combatSummary);
      mockDefaultDamageResult();
      vi.mocked(rollD20).mockReturnValue(18);
      result = await applyFlurryOfBlows({ action: action, playerStats: makePlayerStats(), campaignName, _mapName: mapName, distribution: { Goblin: 1 }, numAttacks: 1 });
      expect(result.openHandTargets).toBeUndefined();

      // Miss → no openHandTargets
      vi.clearAllMocks();
      getCombatSummary.mockReturnValue(combatSummary);
      vi.mocked(rollD20).mockReturnValue(1);
      result = await applyFlurryOfBlows({ action: actionWithOpenHand, playerStats: playerStatsWithOpenHand, campaignName, _mapName: mapName, distribution: { Goblin: 1 }, numAttacks: 1 });
      expect(result.openHandTargets).toBeUndefined();

      // Hits but 0 damage → still includes openHandTargets
      vi.clearAllMocks();
      getCombatSummary.mockReturnValue(combatSummary);
      vi.mocked(rollD20).mockReturnValue(18);
      applyDamageToTarget.mockReturnValue({ finalDamage: 0, newHp: 7 });
      result = await applyFlurryOfBlows({ action: actionWithOpenHand, playerStats: playerStatsWithOpenHand, campaignName, _mapName: mapName, distribution: { Goblin: 1 }, numAttacks: 1 });
      expect(result.openHandTargets).toEqual([
        {
          targetName: 'Goblin',
          action: { type: 'open_hand_technique', name: 'Open Hand Technique' },
          playerStats: playerStatsWithOpenHand,
          campaignName,
          mapName,
        },
      ]);
    });

    it('only includes openHandTargets once per target even with multiple hits', async () => {
      getCombatSummary.mockReturnValue(combatSummary);
      vi.mocked(rollD20).mockReturnValue(18);
      applyDamageToTarget.mockReturnValue({ finalDamage: 4, newHp: 6 });

      const actionWithOpenHand = {
        name: 'Flurry of Blows',
        automation: {
          type: 'bonus_attacks',
          attacks: 3,
        },
      };

      const playerStatsWithOpenHand = makePlayerStats({
        automation: {
          actions: [
            { type: 'open_hand_technique', name: 'Open Hand Technique' },
          ],
        },
      });

      const result = await applyFlurryOfBlows({ action: actionWithOpenHand, playerStats: playerStatsWithOpenHand, campaignName, _mapName: mapName, distribution: { Goblin: 3 }, numAttacks: 3 });

      expect(result.openHandTargets).toHaveLength(1);
      expect(result.openHandTargets[0].targetName).toBe('Goblin');
    });

    it('skips targets not in combat or self when they appear in distribution', async () => {
      getCombatSummary.mockReturnValue(combatSummary);
      vi.mocked(rollD20).mockReturnValue(18);

      let result = await applyFlurryOfBlows({ action: action, playerStats: makePlayerStats(), campaignName, _mapName: mapName, distribution: { UnknownEnemy: 2, Goblin: 1 }, numAttacks: 3 });
      expect(rollD20).toHaveBeenCalledTimes(1);
      expect(result.type).toBe('popup');

      vi.clearAllMocks();
      getCombatSummary.mockReturnValue(combatSummary);
      vi.mocked(rollD20).mockReturnValue(18);
      result = await applyFlurryOfBlows({ action: action, playerStats: makePlayerStats(), campaignName, _mapName: mapName, distribution: { TestMonk: 2, Goblin: 1 }, numAttacks: 3 });
      expect(rollD20).toHaveBeenCalledTimes(1);
      expect(result.type).toBe('popup');
    });

    it('logs attack roll, damage, and hp_change entries on hit but not on miss', async () => {
      getCombatSummary.mockReturnValue(combatSummary);
      vi.mocked(rollD20).mockReturnValue(18);

      await applyFlurryOfBlows({ action: action, playerStats: makePlayerStats(), campaignName, _mapName: mapName, distribution: { Goblin: 1 }, numAttacks: 1 });

      let attackEntries = addEntry.mock.calls.filter(
        call => call[1].rollType === 'attack'
      );
      expect(attackEntries.length).toBe(1);
      expect(attackEntries[0][1].characterName).toBe('TestMonk');
      expect(attackEntries[0][1].targetName).toBe('Goblin');
      expect(attackEntries[0][1].targetAc).toBe(15);
      expect(attackEntries[0][1].hit).toBe(true);

      let damageEntries = addEntry.mock.calls.filter(
        call => call[1].rollType === 'damage'
      );
      expect(damageEntries.length).toBe(1);

      let hpEntries = addEntry.mock.calls.filter(
        call => call[1].type === 'hp_change'
      );
      expect(hpEntries.length).toBe(1);
      expect(hpEntries[0][1].delta).toBe(-4);
      expect(hpEntries[0][1].sourceName).toBe('TestMonk');

      // Now test miss path
      vi.clearAllMocks();
      getCombatSummary.mockReturnValue(combatSummary);
      vi.mocked(rollD20).mockReturnValue(1);

      await applyFlurryOfBlows({ action: action, playerStats: makePlayerStats(), campaignName, _mapName: mapName, distribution: { Goblin: 1 }, numAttacks: 1 });

      attackEntries = addEntry.mock.calls.filter(
        call => call[1].rollType === 'attack'
      );
      expect(attackEntries.length).toBe(1);
      expect(attackEntries[0][1].hit).toBe(false);

      damageEntries = addEntry.mock.calls.filter(
        call => call[1].rollType === 'damage'
      );
      expect(damageEntries.length).toBe(0);

      hpEntries = addEntry.mock.calls.filter(
        call => call[1].type === 'hp_change'
      );
      expect(hpEntries.length).toBe(0);
    });

    it('handles creatures with missing ac/defaulting to 10', async () => {
      getCombatSummary.mockReturnValue(makeCombatSummary([
        makeCreature('TestMonk', 20, 12),
        { name: 'Mystery', currentHp: 5, maxHp: 5 },
      ]));
      vi.mocked(rollD20).mockReturnValue(12);

      const result = await applyFlurryOfBlows({ action: action, playerStats: makePlayerStats(), campaignName, _mapName: mapName, distribution: { Mystery: 1 }, numAttacks: 1 });

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('AC 10');
    });

    it('handles null/undefined applyDamageToTarget or rollExpression results gracefully', async () => {
      getCombatSummary.mockReturnValue(combatSummary);
      vi.mocked(rollD20).mockReturnValue(18);
      applyDamageToTarget.mockReturnValue(null);

      let result = await applyFlurryOfBlows({ action: action, playerStats: makePlayerStats(), campaignName, _mapName: mapName, distribution: { Goblin: 1 }, numAttacks: 1 });
      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('0 damage');

      vi.clearAllMocks();
      getCombatSummary.mockReturnValue(combatSummary);
      vi.mocked(rollD20).mockReturnValue(18);
      rollExpression.mockReturnValue(null);
      applyDamageToTarget.mockReturnValue({ finalDamage: 0, newHp: 7 });

      result = await applyFlurryOfBlows({ action: action, playerStats: makePlayerStats(), campaignName, _mapName: mapName, distribution: { Goblin: 1 }, numAttacks: 1 });
      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('0 damage');
    });

    it('ends invisibility when dealing damage > 0 but not when damage is 0', async () => {
      getCombatSummary.mockReturnValue(combatSummary);
      vi.mocked(rollD20).mockReturnValue(18);
      applyDamageToTarget.mockReturnValue({ finalDamage: 4, newHp: 6 });

      await applyFlurryOfBlows({ action: action, playerStats: makePlayerStats(), campaignName, _mapName: mapName, distribution: { Goblin: 1 }, numAttacks: 1 });
      expect(endInvisibilityOnHostileAction).toHaveBeenCalledWith(
        'TestMonk',
        campaignName
      );

      vi.clearAllMocks();
      getCombatSummary.mockReturnValue(combatSummary);
      vi.mocked(rollD20).mockReturnValue(18);
      applyDamageToTarget.mockReturnValue({ finalDamage: 0, newHp: 7 });

      await applyFlurryOfBlows({ action: action, playerStats: makePlayerStats(), campaignName, _mapName: mapName, distribution: { Goblin: 1 }, numAttacks: 1 });
      expect(endInvisibilityOnHostileAction).not.toHaveBeenCalled();
    });

    it('handles playerStats.automation being undefined or missing actions array', async () => {
      getCombatSummary.mockReturnValue(combatSummary);
      vi.mocked(rollD20).mockReturnValue(18);
      applyDamageToTarget.mockReturnValue({ finalDamage: 4, newHp: 6 });

      let playerStats = makePlayerStats({ automation: undefined });
      let result = await applyFlurryOfBlows({ action: action, playerStats: playerStats, campaignName, _mapName: mapName, distribution: { Goblin: 1 }, numAttacks: 1 });
      expect(result.openHandTargets).toBeUndefined();

      vi.clearAllMocks();
      getCombatSummary.mockReturnValue(combatSummary);
      vi.mocked(rollD20).mockReturnValue(18);
      applyDamageToTarget.mockReturnValue({ finalDamage: 4, newHp: 6 });

      playerStats = makePlayerStats({ automation: {} });
      result = await applyFlurryOfBlows({ action: action, playerStats: playerStats, campaignName, _mapName: mapName, distribution: { Goblin: 1 }, numAttacks: 1 });
      expect(result.openHandTargets).toBeUndefined();
    });

    it('reports correct pluralization for crit count: "1 critical" vs "X criticals"', async () => {
      getCombatSummary.mockReturnValue(combatSummary);
      vi.mocked(rollD20).mockReturnValue(20);

      let result = await applyFlurryOfBlows({ action: action, playerStats: makePlayerStats(), campaignName, _mapName: mapName, distribution: { Goblin: 1 }, numAttacks: 1 });
      expect(result.payload.description).toContain('1 critical');

      vi.clearAllMocks();
      getCombatSummary.mockReturnValue(combatSummary);
      vi.mocked(rollD20).mockReturnValue(20);

      result = await applyFlurryOfBlows({ action: action, playerStats: makePlayerStats(), campaignName, _mapName: mapName, distribution: { Goblin: 2 }, numAttacks: 2 });
      expect(result.payload.description).toContain('2 criticals');

      vi.clearAllMocks();
      getCombatSummary.mockReturnValue(combatSummary);
      vi.mocked(rollD20).mockReturnValue(10);

      result = await applyFlurryOfBlows({ action: action, playerStats: makePlayerStats(), campaignName, _mapName: mapName, distribution: { Goblin: 1 }, numAttacks: 1 });
      expect(result.payload.description).toContain('0 criticals');
    });

    it('accumulates total damage across multiple targets and logs ability_use entry', async () => {
      getCombatSummary.mockReturnValue(combatSummary);
      vi.mocked(rollD20).mockReturnValue(18);
      applyDamageToTarget.mockReturnValue({ finalDamage: 4, newHp: 6 });

      await applyFlurryOfBlows({ action: action, playerStats: makePlayerStats(), campaignName, _mapName: mapName, distribution: { Goblin: 2 }, numAttacks: 2 });

      const abilityEntries = addEntry.mock.calls.filter(
        call => call[1].type === 'ability_use'
      );
      expect(abilityEntries.length).toBe(1);
      expect(abilityEntries[0][1].abilityName).toBe(action.name);
      expect(abilityEntries[0][1].description).toContain('2 unarmed strikes');
      expect(abilityEntries[0][1].description).toContain('Total damage dealt: 8');
    });

    describe('Flurry of Healing and Harm integration', () => {
      const actionWithFlurry = {
        name: 'Heightened Flurry of Blows',
        automation: {
          type: 'bonus_attacks',
          attacks: 3,
        },
      };

      function makeWarriorOfMercyMonk(overrides = {}) {
        return makePlayerStats({
          level: 11,
          abilities: [{ name: 'Wisdom', bonus: 3 }],
          class: { class_levels: [{ level: 11, martial_arts_die: 6 }] },
          specialActions: [
            { name: 'Flurry of Healing and Harm' },
            {
              name: 'Hand of Harm',
              automation: {
                type: 'reaction_damage',
                damageExpression: '2d6',
                damageType: 'Necrotic',
                saveType: 'CON',
                saveDc: 14,
                scaling: { 11: '2d6', 17: '3d6' },
                alsoInflicts: 'disadvantage_next_attack',
              },
            },
          ],
          ...overrides,
        });
      }

      beforeEach(() => {
        applyHealingDirectly.mockReturnValue({ newHp: 15, actualHeal: 5, maxHp: 20 });
        createSaveListener.mockReturnValue({ promptId: 'test-prompt', promise: Promise.resolve({ success: false }) });
        buildSaveDc.mockReturnValue(14);
      });

      it('applies Hand of Healing when flurryHealingHarmUses > 0 and healingTarget is provided', async () => {
        getCombatSummary.mockReturnValue(combatSummary);
        vi.mocked(rollD20).mockReturnValue(18);
        vi.mocked(rollExpression).mockReturnValue({ total: 9, rolls: [6, 3], modifier: 0 });
        getRuntimeValue.mockImplementation((key, field, _cn) => {
          if (key === 'TestMonk' && field === 'flurryHealingHarmUses') return 3;
          return null;
        });

        const playerStats = makeWarriorOfMercyMonk();

        await applyFlurryOfBlows({ action: actionWithFlurry, playerStats: playerStats, campaignName, _mapName: mapName, distribution: { Goblin: 1 }, numAttacks: 1, healingTarget: 'Goblin' });

        expect(applyHealingDirectly).toHaveBeenCalledWith(
          expect.any(Object),
          'Goblin',
          expect.any(Number),
          campaignName
        );
        expect(setRuntimeValue).toHaveBeenCalledWith('TestMonk', 'flurryHealingHarmUses', 2, campaignName);
      });

      it('decrements flurryHealingHarmUses for each healing strike', async () => {
        getCombatSummary.mockReturnValue(combatSummary);
        vi.mocked(rollD20).mockReturnValue(18);
        vi.mocked(rollExpression).mockReturnValue({ total: 9, rolls: [6, 3], modifier: 0 });
        getRuntimeValue.mockImplementation((key, field, _cn) => {
          if (key === 'TestMonk' && field === 'flurryHealingHarmUses') return 2;
          return null;
        });

        const playerStats = makeWarriorOfMercyMonk();

        await applyFlurryOfBlows({ action: actionWithFlurry, playerStats: playerStats, campaignName, _mapName: mapName, distribution: { Goblin: 2 }, numAttacks: 2, healingTarget: 'Goblin' });

        expect(setRuntimeValue).toHaveBeenCalledTimes(2);
        expect(setRuntimeValue).toHaveBeenNthCalledWith(1, 'TestMonk', 'flurryHealingHarmUses', 1, campaignName);
        expect(setRuntimeValue).toHaveBeenNthCalledWith(2, 'TestMonk', 'flurryHealingHarmUses', 0, campaignName);
      });

      it('switches to Hand of Harm after healing uses exhausted', async () => {
        getCombatSummary.mockReturnValue(combatSummary);
        vi.mocked(rollD20).mockReturnValue(18);
        vi.mocked(rollExpression).mockReturnValue({ total: 5, rolls: [3, 2], modifier: 0 });
        applyDamageToTarget.mockReturnValue({ finalDamage: 4, newHp: 6 });
        getRuntimeValue.mockImplementation((key, field, _cn) => {
          if (key === 'TestMonk' && field === 'flurryHealingHarmUses') return 1;
          return null;
        });

        const playerStats = makeWarriorOfMercyMonk();

        await applyFlurryOfBlows({ action: actionWithFlurry, playerStats: playerStats, campaignName, _mapName: mapName, distribution: { Goblin: 2 }, numAttacks: 2, healingTarget: 'Goblin' });

        expect(applyHealingDirectly).toHaveBeenCalledTimes(1);
        expect(createSaveListener).toHaveBeenCalledTimes(1);
      });

      it('triggers CON save for Hand of Harm strikes on hit', async () => {
        getCombatSummary.mockReturnValue(combatSummary);
        vi.mocked(rollD20).mockReturnValue(18);
        vi.mocked(rollExpression).mockReturnValue({ total: 5, rolls: [3, 2], modifier: 0 });
        applyDamageToTarget.mockReturnValue({ finalDamage: 4, newHp: 6 });
        getRuntimeValue.mockImplementation((key, field, _cn) => {
          if (key === 'TestMonk' && field === 'flurryHealingHarmUses') return 0;
          return null;
        });

        const playerStats = makeWarriorOfMercyMonk();

        await applyFlurryOfBlows({ action: actionWithFlurry, playerStats: playerStats, campaignName, _mapName: mapName, distribution: { Goblin: 1 }, numAttacks: 1, healingTarget: 'Ally' });

        expect(createSaveListener).toHaveBeenCalledWith(campaignName, expect.objectContaining({
          targetName: 'Goblin',
          saveType: 'CON',
          saveDc: 14,
        }));
      });

      it('does not apply Flurry of Healing and Harm when player lacks the feature', async () => {
        getCombatSummary.mockReturnValue(combatSummary);
        vi.mocked(rollD20).mockReturnValue(18);
        applyDamageToTarget.mockReturnValue({ finalDamage: 4, newHp: 6 });
        getRuntimeValue.mockReturnValue(null);

        const playerStats = makePlayerStats();

        const result = await applyFlurryOfBlows({ action: actionWithFlurry, playerStats: playerStats, campaignName, _mapName: mapName, distribution: { Goblin: 1 }, numAttacks: 1, healingTarget: 'Goblin' });

        expect(applyHealingDirectly).not.toHaveBeenCalled();
        expect(createSaveListener).not.toHaveBeenCalled();
        expect(result.handOfHarmSavePromises).toBeUndefined();
      });

      it('does not apply Hand of Harm when hit but finalDamage is 0', async () => {
        getCombatSummary.mockReturnValue(combatSummary);
        vi.mocked(rollD20).mockReturnValue(18);
        vi.mocked(rollExpression).mockReturnValue({ total: 5, rolls: [3, 2], modifier: 0 });
        applyDamageToTarget.mockReturnValue({ finalDamage: 0, newHp: 7 });
        getRuntimeValue.mockImplementation((key, field, _cn) => {
          if (key === 'TestMonk' && field === 'flurryHealingHarmUses') return 0;
          return null;
        });

        const playerStats = makeWarriorOfMercyMonk();

        await applyFlurryOfBlows({ action: actionWithFlurry, playerStats: playerStats, campaignName, _mapName: mapName, distribution: { Goblin: 1 }, numAttacks: 1, healingTarget: 'Ally' });

        expect(createSaveListener).not.toHaveBeenCalled();
      });

      it('logs hp_change entry with isHealing: true for Hand of Healing strikes', async () => {
        getCombatSummary.mockReturnValue(combatSummary);
        vi.mocked(rollD20).mockReturnValue(18);
        vi.mocked(rollExpression).mockReturnValue({ total: 9, rolls: [6, 3], modifier: 0 });
        getRuntimeValue.mockImplementation((key, field, _cn) => {
          if (key === 'TestMonk' && field === 'flurryHealingHarmUses') return 1;
          return null;
        });

        const playerStats = makeWarriorOfMercyMonk();

        await applyFlurryOfBlows({ action: actionWithFlurry, playerStats: playerStats, campaignName, _mapName: mapName, distribution: { Goblin: 1 }, numAttacks: 1, healingTarget: 'Goblin' });

        const hpEntries = addEntry.mock.calls.filter(
          call => call[1].type === 'hp_change'
        );
        const healingEntry = hpEntries.find(entry => entry[1].isHealing === true);
        expect(healingEntry).toBeDefined();
        expect(healingEntry[1].targetName).toBe('Goblin');
        expect(healingEntry[1].note).toContain('Hand of Healing');
      });
    });
  });
});
