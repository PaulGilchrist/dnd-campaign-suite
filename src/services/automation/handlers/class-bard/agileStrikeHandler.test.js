// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
  getTargetFromAttacker: vi.fn(),
}));

vi.mock('../../../rules/combat/applyDamage.js', () => ({
  applyDamageToTarget: vi.fn(),
}));

vi.mock('../../../dice/diceRoller.js', () => ({
  rollD20: vi.fn(),
  rollExpression: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

import { handle } from './agileStrikeHandler.js';
import * as damageUtils from '../../../rules/combat/damageUtils.js';
import * as applyDamage from '../../../rules/combat/applyDamage.js';
import * as diceRoller from '../../../dice/diceRoller.js';
import * as logService from '../../../ui/logService.js';
import * as runtimeState from '../../../../hooks/runtime/useRuntimeState.js';

const campaignName = 'TestCampaign';

const defaultPlayerStats = {
  name: 'Bard',
  proficiency: 2,
  abilities: [
    { name: 'Dexterity', bonus: 3 },
  ],
};

const defaultAction = {
  name: 'Agile Strikes',
  automation: {
    type: 'agile_strike',
    bardicDie: 8,
  },
};

function makePlayerStats(overrides = {}) {
  return { ...defaultPlayerStats, ...overrides };
}

function makeAction(overrides = {}) {
  return { ...defaultAction, ...overrides };
}

function makeTarget(overrides = {}) {
  return { name: 'Goblin', ac: 15, currentHp: 7, maxHp: 7, ...overrides };
}

// ── Tests ──────────────────────────────────────────────────────

describe('agileStrikeHandler.handle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('error handling', () => {
    it('returns popup when combat context is null', async () => {
      damageUtils.getCombatContext.mockResolvedValue(null);

      const result = await handle(makeAction(), makePlayerStats(), campaignName);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.name).toBe('Agile Strikes');
      expect(result.payload.description).toContain('No combat context available');
      expect(damageUtils.getTargetFromAttacker).not.toHaveBeenCalled();
      expect(diceRoller.rollD20).not.toHaveBeenCalled();
      expect(logService.addEntry).not.toHaveBeenCalled();
    });

    it('returns popup when there is no target selected', async () => {
      damageUtils.getCombatContext.mockResolvedValue({ creatures: [] });
      damageUtils.getTargetFromAttacker.mockReturnValue(null);

      const result = await handle(makeAction(), makePlayerStats(), campaignName);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toContain('No target selected');
      expect(diceRoller.rollD20).not.toHaveBeenCalled();
      expect(logService.addEntry).not.toHaveBeenCalled();
    });

    it('returns popup when target has no name property', async () => {
      damageUtils.getCombatContext.mockResolvedValue({ creatures: [{}] });
      damageUtils.getTargetFromAttacker.mockReturnValue({ ac: 12 });

      const result = await handle(makeAction(), makePlayerStats(), campaignName);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('No target selected');
    });
  });

  describe('attack resolution', () => {
    it('hits and applies damage when total meets AC', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      const target = makeTarget({ ac: 15 });

      damageUtils.getCombatContext.mockResolvedValue({ creatures: [target] });
      damageUtils.getTargetFromAttacker.mockReturnValue(target);
      diceRoller.rollD20.mockReturnValue(12);
      diceRoller.rollExpression.mockReturnValue({ total: 7, rolls: [7] });
      runtimeState.getRuntimeValue.mockReturnValue([]);

      await handle(action, ps, campaignName);

      // DEX(3) + PROF(2) = 5 hit bonus, d20(12) + 5 = 17 >= 15 = HIT
      expect(diceRoller.rollD20).toHaveBeenCalledTimes(1);
      expect(diceRoller.rollExpression).toHaveBeenCalledWith('1d8');
      expect(applyDamage.applyDamageToTarget).toHaveBeenCalledWith(expect.any(Object), 'Goblin', 10, ['Bludgeoning'], campaignName, [], { ignoreResistance: false, attackerName: 'Bard' },);
      expect(logService.addEntry).toHaveBeenCalled();
    });

    it('misses and skips damage when total is below AC', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      const target = makeTarget({ ac: 18 });

      damageUtils.getCombatContext.mockResolvedValue({ creatures: [target] });
      damageUtils.getTargetFromAttacker.mockReturnValue(target);
      diceRoller.rollD20.mockReturnValue(8);
      diceRoller.rollExpression.mockReturnValue({ total: 5, rolls: [5] });
      runtimeState.getRuntimeValue.mockReturnValue([]);

      const result = await handle(action, ps, campaignName);

      // DEX(3) + PROF(2) = 5, d20(8) + 5 = 13 < 18 = MISS
      expect(result.payload.description).toContain('MISS');
      expect(result.payload.description).toContain('missed');
      expect(result.payload.description).toContain('no damage');
      expect(applyDamage.applyDamageToTarget).not.toHaveBeenCalled();
    });

    it('uses default AC of 15 when target has no ac property', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      const target = makeTarget({ ac: undefined });

      damageUtils.getCombatContext.mockResolvedValue({ creatures: [target] });
      damageUtils.getTargetFromAttacker.mockReturnValue(target);
      diceRoller.rollD20.mockReturnValue(12);
      diceRoller.rollExpression.mockReturnValue({ total: 7, rolls: [7] });
      runtimeState.getRuntimeValue.mockReturnValue([]);

      await handle(action, ps, campaignName);

      // d20(12) + 5 = 17 >= 15 (default) = HIT
      expect(applyDamage.applyDamageToTarget).toHaveBeenCalled();
    });
  });

  describe('popup description', () => {
    it('includes roll details in popup description on a hit', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      const target = makeTarget({ ac: 14 });

      damageUtils.getCombatContext.mockResolvedValue({ creatures: [target] });
      damageUtils.getTargetFromAttacker.mockReturnValue(target);
      diceRoller.rollD20.mockReturnValue(9);
      diceRoller.rollExpression.mockReturnValue({ total: 3, rolls: [3] });
      runtimeState.getRuntimeValue.mockReturnValue([]);

      const result = await handle(action, ps, campaignName);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.name).toBe('Agile Strikes');
      expect(result.payload.description).toContain('d20(9)');
      expect(result.payload.description).toContain('+ 5');
      expect(result.payload.description).toContain('14');
      expect(result.payload.description).toContain('1d8');
      expect(result.payload.description).toContain('+ 3');
      expect(result.payload.description).toContain('HIT');
    });

    it('includes roll details in popup description on a miss', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      const target = makeTarget({ ac: 20 });

      damageUtils.getCombatContext.mockResolvedValue({ creatures: [target] });
      damageUtils.getTargetFromAttacker.mockReturnValue(target);
      diceRoller.rollD20.mockReturnValue(5);
      diceRoller.rollExpression.mockReturnValue({ total: 2, rolls: [2] });
      runtimeState.getRuntimeValue.mockReturnValue([]);

      const result = await handle(action, ps, campaignName);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('d20(5)');
      expect(result.payload.description).toContain('+ 5');
      expect(result.payload.description).toContain('20');
      expect(result.payload.description).toContain('MISS');
    });

    it('includes target name in popup description', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      const target = makeTarget({ name: 'Ogre' });

      damageUtils.getCombatContext.mockResolvedValue({ creatures: [target] });
      damageUtils.getTargetFromAttacker.mockReturnValue(target);
      diceRoller.rollD20.mockReturnValue(10);
      diceRoller.rollExpression.mockReturnValue({ total: 5, rolls: [5] });
      runtimeState.getRuntimeValue.mockReturnValue([]);

      const result = await handle(action, ps, campaignName);

      expect(result.payload.description).toContain('Ogre');
      expect(result.payload.description).toContain('Unarmed Strike');
    });
  });

  describe('bardic die size', () => {
    it('uses d6 when bardicDie is not specified', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ automation: { type: 'agile_strike' } });
      const target = makeTarget({ ac: 12 });

      damageUtils.getCombatContext.mockResolvedValue({ creatures: [target] });
      damageUtils.getTargetFromAttacker.mockReturnValue(target);
      diceRoller.rollD20.mockReturnValue(10);
      diceRoller.rollExpression.mockReturnValue({ total: 4, rolls: [4] });
      runtimeState.getRuntimeValue.mockReturnValue([]);

      await handle(action, ps, campaignName);

      expect(diceRoller.rollExpression).toHaveBeenCalledWith('1d6');
      const logEntry = logService.addEntry.mock.calls[0][1];
      expect(logEntry.description).toContain('1d6');
    });

    it('uses d10 when bardicDie is 10', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ automation: { bardicDie: 10 } });
      const target = makeTarget({ ac: 10 });

      damageUtils.getCombatContext.mockResolvedValue({ creatures: [target] });
      damageUtils.getTargetFromAttacker.mockReturnValue(target);
      diceRoller.rollD20.mockReturnValue(10);
      diceRoller.rollExpression.mockReturnValue({ total: 6, rolls: [6] });
      runtimeState.getRuntimeValue.mockReturnValue([]);

      await handle(action, ps, campaignName);

      expect(diceRoller.rollExpression).toHaveBeenCalledWith('1d10');
    });

    it('uses d12 when bardicDie is 12', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ automation: { bardicDie: 12 } });
      const target = makeTarget({ ac: 10 });

      damageUtils.getCombatContext.mockResolvedValue({ creatures: [target] });
      damageUtils.getTargetFromAttacker.mockReturnValue(target);
      diceRoller.rollD20.mockReturnValue(10);
      diceRoller.rollExpression.mockReturnValue({ total: 8, rolls: [8] });
      runtimeState.getRuntimeValue.mockReturnValue([]);

      await handle(action, ps, campaignName);

      expect(diceRoller.rollExpression).toHaveBeenCalledWith('1d12');
    });
  });

  describe('damage calculation', () => {
    it('adds Dexterity modifier to damage roll', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      const target = makeTarget({ ac: 10 });

      damageUtils.getCombatContext.mockResolvedValue({ creatures: [target] });
      damageUtils.getTargetFromAttacker.mockReturnValue(target);
      diceRoller.rollD20.mockReturnValue(10);
      diceRoller.rollExpression.mockReturnValue({ total: 4, rolls: [4] });
      runtimeState.getRuntimeValue.mockReturnValue([]);

      await handle(action, ps, campaignName);

      // roll 4 + dex 3 = 7 total damage
      expect(applyDamage.applyDamageToTarget).toHaveBeenCalledWith(expect.any(Object), 'Goblin', 7, ['Bludgeoning'], expect.any(String), expect.any(Array), { ignoreResistance: expect.any(Boolean), attackerName: 'Bard' },);
    });

    it('uses 0 when Dexterity ability is missing', async () => {
      const ps = makePlayerStats({ abilities: [] });
      const action = makeAction();
      const target = makeTarget({ ac: 10 });

      damageUtils.getCombatContext.mockResolvedValue({ creatures: [target] });
      damageUtils.getTargetFromAttacker.mockReturnValue(target);
      diceRoller.rollD20.mockReturnValue(10);
      diceRoller.rollExpression.mockReturnValue({ total: 4, rolls: [4] });
      runtimeState.getRuntimeValue.mockReturnValue([]);

      await handle(action, ps, campaignName);

      // roll 4 + dex 0 = 4 total damage
      expect(applyDamage.applyDamageToTarget).toHaveBeenCalledWith(expect.any(Object), 'Goblin', 4, ['Bludgeoning'], expect.any(String), expect.any(Array), { ignoreResistance: expect.any(Boolean), attackerName: 'Bard' },);
    });

    it('uses 0 when proficiency is missing', async () => {
      const ps = makePlayerStats({ proficiency: undefined });
      const action = makeAction();
      const target = makeTarget({ ac: 15 });

      damageUtils.getCombatContext.mockResolvedValue({ creatures: [target] });
      damageUtils.getTargetFromAttacker.mockReturnValue(target);
      diceRoller.rollD20.mockReturnValue(12);
      diceRoller.rollExpression.mockReturnValue({ total: 7, rolls: [7] });
      runtimeState.getRuntimeValue.mockReturnValue([]);

      await handle(action, ps, campaignName);

      // hit bonus = 3 + 0 = 3, d20(12) + 3 = 15 = HIT
      expect(applyDamage.applyDamageToTarget).toHaveBeenCalled();
    });

    it('handles null damage roll result', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      const target = makeTarget({ ac: 10 });

      damageUtils.getCombatContext.mockResolvedValue({ creatures: [target] });
      damageUtils.getTargetFromAttacker.mockReturnValue(target);
      diceRoller.rollD20.mockReturnValue(10);
      diceRoller.rollExpression.mockReturnValue(null);
      runtimeState.getRuntimeValue.mockReturnValue([]);

      await handle(action, ps, campaignName);

      // rollExpression returns null, so damageTotal = 0 + 3 = 3
      expect(applyDamage.applyDamageToTarget).toHaveBeenCalledWith(expect.any(Object), 'Goblin', 3, ['Bludgeoning'], expect.any(String), expect.any(Array), { ignoreResistance: expect.any(Boolean), attackerName: 'Bard' },);
    });
  });

  describe('logging', () => {
    it('logs ability_use entry with full details', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      const target = makeTarget({ ac: 16 });

      damageUtils.getCombatContext.mockResolvedValue({ creatures: [target] });
      damageUtils.getTargetFromAttacker.mockReturnValue(target);
      diceRoller.rollD20.mockReturnValue(14);
      diceRoller.rollExpression.mockReturnValue({ total: 6, rolls: [6] });
      runtimeState.getRuntimeValue.mockReturnValue([]);

      await handle(action, ps, campaignName);

      expect(logService.addEntry).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({
          type: 'ability_use',
          characterName: 'Bard',
          abilityName: 'Agile Strikes',
          description: expect.stringContaining('Goblin'),
          timestamp: expect.any(Number),
        }),
      );
    });

    it('includes hit/miss and damage info in log description', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      const target = makeTarget({ ac: 14 });

      damageUtils.getCombatContext.mockResolvedValue({ creatures: [target] });
      damageUtils.getTargetFromAttacker.mockReturnValue(target);
      diceRoller.rollD20.mockReturnValue(9);
      diceRoller.rollExpression.mockReturnValue({ total: 3, rolls: [3] });
      runtimeState.getRuntimeValue.mockReturnValue([]);

      await handle(action, ps, campaignName);

      const logEntry = logService.addEntry.mock.calls[0][1];
      expect(logEntry.description).toContain('d20(9) + 5 = 14 vs AC 14');
      expect(logEntry.description).toContain('HIT');
      expect(logEntry.description).toContain('Bludgeoning damage');
    });

    it('handles addEntry failure gracefully', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      const target = makeTarget({ ac: 14 });

      damageUtils.getCombatContext.mockResolvedValue({ creatures: [target] });
      damageUtils.getTargetFromAttacker.mockReturnValue(target);
      diceRoller.rollD20.mockReturnValue(10);
      diceRoller.rollExpression.mockReturnValue({ total: 5, rolls: [5] });
      runtimeState.getRuntimeValue.mockReturnValue([]);
      logService.addEntry.mockRejectedValue(new Error('Log service error'));

      const result = await handle(action, ps, campaignName);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('HIT');
    });
  });

  describe('result structure', () => {
    it('returns popup with correct payload shape', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      const target = makeTarget({ ac: 12 });

      damageUtils.getCombatContext.mockResolvedValue({ creatures: [target] });
      damageUtils.getTargetFromAttacker.mockReturnValue(target);
      diceRoller.rollD20.mockReturnValue(10);
      diceRoller.rollExpression.mockReturnValue({ total: 5, rolls: [5] });
      runtimeState.getRuntimeValue.mockReturnValue([]);

      const result = await handle(action, ps, campaignName);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.name).toBe('Agile Strikes');
      expect(typeof result.payload.description).toBe('string');
      expect(result.payload.automation).toEqual(action.automation);
    });
  });

  describe('action shape flexibility', () => {
    it('uses action object directly when automation field is missing', async () => {
      const ps = makePlayerStats();
      const action = { name: 'Agile Strikes' };
      const target = makeTarget({ ac: 12 });

      damageUtils.getCombatContext.mockResolvedValue({ creatures: [target] });
      damageUtils.getTargetFromAttacker.mockReturnValue(target);
      diceRoller.rollD20.mockReturnValue(10);
      diceRoller.rollExpression.mockReturnValue({ total: 5, rolls: [5] });
      runtimeState.getRuntimeValue.mockReturnValue([]);

      await handle(action, ps, campaignName);

      // action.automation is undefined, so auto = action, bardicDie defaults to 6
      expect(diceRoller.rollExpression).toHaveBeenCalledWith('1d6');
    });
  });
});
