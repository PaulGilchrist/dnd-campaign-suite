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

function makePlayerStats(overrides = {}) {
  return {
    name: 'Bard',
    proficiency: 2,
    abilities: [
      { name: 'Dexterity', bonus: 3 },
    ],
    ...overrides,
  };
}

function makeAction(overrides = {}) {
  return {
    name: 'Agile Strikes',
    automation: {
      type: 'agile_strike',
      bardicDie: 8,
      ...overrides.automation,
    },
    ...overrides,
  };
}

function makeTarget(ac = 15) {
  return { name: 'Goblin', ac, currentHp: 7, maxHp: 7 };
}

// ── Tests ──────────────────────────────────────────────────────

describe('agileStrikeHandler.handle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('error handling', () => {
    it('returns popup when combat context is null', async () => {
      damageUtils.getCombatContext.mockResolvedValue(null);
      damageUtils.getTargetFromAttacker.mockReturnValue(null);

      const ps = makePlayerStats();
      const action = makeAction();

      const result = await handle(action, ps, campaignName);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('No combat context available');
    });

    it('returns popup when there is no target selected', async () => {
      damageUtils.getCombatContext.mockResolvedValue({ creatures: [] });
      damageUtils.getTargetFromAttacker.mockReturnValue(null);

      const ps = makePlayerStats();
      const action = makeAction();

      const result = await handle(action, ps, campaignName);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('No target selected');
    });
  });

  describe('attack resolution', () => {
    it('hits and applies damage when total meets AC', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      const target = makeTarget(15);

      damageUtils.getCombatContext.mockResolvedValue({ creatures: [target] });
      damageUtils.getTargetFromAttacker.mockReturnValue(target);
      diceRoller.rollD20.mockReturnValue(12);
      diceRoller.rollExpression.mockReturnValue({ total: 7, rolls: [7] });
      runtimeState.getRuntimeValue.mockReturnValue([]);

      await handle(action, ps, campaignName);

      // DEX(3) + PROF(2) = 5 hit bonus, d20(12) + 5 = 17 >= 15 = HIT
      expect(applyDamage.applyDamageToTarget).toHaveBeenCalled();
      expect(logService.addEntry).toHaveBeenCalled();
    });

    it('misses and skips damage when total is below AC', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      const target = makeTarget(18);

      damageUtils.getCombatContext.mockResolvedValue({ creatures: [target] });
      damageUtils.getTargetFromAttacker.mockReturnValue(target);
      diceRoller.rollD20.mockReturnValue(8);
      diceRoller.rollExpression.mockReturnValue({ total: 5, rolls: [5] });
      runtimeState.getRuntimeValue.mockReturnValue([]);

      const result = await handle(action, ps, campaignName);

      // DEX(3) + PROF(2) = 5, d20(8) + 5 = 13 < 18 = MISS
      expect(result.payload.description).toContain('MISS');
      expect(result.payload.description).toContain('missed');
      expect(applyDamage.applyDamageToTarget).not.toHaveBeenCalled();
    });
  });

  describe('popup description', () => {
    it('includes roll details in popup description', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      const target = makeTarget(14);

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
    });
  });

  describe('bardic die size', () => {
    it('uses d6 when bardicDie is not specified', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ automation: { type: 'agile_strike' } });
      const target = makeTarget(12);

      damageUtils.getCombatContext.mockResolvedValue({ creatures: [target] });
      damageUtils.getTargetFromAttacker.mockReturnValue(target);
      diceRoller.rollD20.mockReturnValue(10);
      diceRoller.rollExpression.mockReturnValue({ total: 4, rolls: [4] });
      runtimeState.getRuntimeValue.mockReturnValue([]);

      await handle(action, ps, campaignName);

      const logEntry = logService.addEntry.mock.calls[0][1];
      expect(logEntry.description).toContain('1d6');
    });
  });

  describe('logging', () => {
    it('logs ability_use entry with full details', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      const target = makeTarget(16);

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
  });
});
