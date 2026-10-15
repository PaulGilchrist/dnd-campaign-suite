// @maintained-by-ai
// Deterministic: every external dependency (combat context, dice, damage, log,
// runtime store) is mocked, so this suite pins the handler's contract —
// early-return popups, hit/miss resolution, die-size selection, attribute
// fallbacks, log/popup formats — without touching moving app parts.
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

// Wire the happy-path mocks: combat context, target resolution, both rolls,
// and an empty runtime character list. Returns the target for assertions.
function mockAttack({ target = makeTarget(), d20 = 10, damageRoll = { total: 5, rolls: [5] } } = {}) {
  damageUtils.getCombatContext.mockResolvedValue({ creatures: [target] });
  damageUtils.getTargetFromAttacker.mockReturnValue(target);
  diceRoller.rollD20.mockReturnValue(d20);
  diceRoller.rollExpression.mockReturnValue(damageRoll);
  runtimeState.getRuntimeValue.mockReturnValue([]);
  return target;
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

    it.each([
      ['no target resolved', null],
      ['target has no name property', { ac: 12 }],
    ])('returns popup when %s', async (_label, target) => {
      damageUtils.getCombatContext.mockResolvedValue({ creatures: [] });
      damageUtils.getTargetFromAttacker.mockReturnValue(target);

      const result = await handle(makeAction(), makePlayerStats(), campaignName);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toContain('No target selected');
      expect(diceRoller.rollD20).not.toHaveBeenCalled();
      expect(logService.addEntry).not.toHaveBeenCalled();
    });
  });

  describe('attack resolution', () => {
    it('hits when total meets AC: rolls once, applies DEX+die bludgeoning damage, returns popup with full details', async () => {
      // DEX(3) + PROF(2) = 5 hit bonus; d20(9) + 5 = 14 >= AC 14 = HIT (exact boundary)
      const action = makeAction();
      mockAttack({ target: makeTarget({ name: 'Ogre', ac: 14 }), d20: 9, damageRoll: { total: 3, rolls: [3] } });

      const result = await handle(action, makePlayerStats(), campaignName);

      expect(diceRoller.rollD20).toHaveBeenCalledTimes(1);
      expect(diceRoller.rollExpression).toHaveBeenCalledWith('1d8');
      // damage = die(3) + DEX(3) = 6
      expect(applyDamage.applyDamageToTarget).toHaveBeenCalledWith(
        expect.any(Object),
        'Ogre',
        6,
        ['Bludgeoning'],
        { campaignName, characters: expect.any(Array), ignoreResistance: false, attackerName: 'Bard' },
      );
      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.name).toBe('Agile Strikes');
      expect(result.payload.automation).toEqual(action.automation);
      expect(result.payload.description).toContain('Ogre');
      expect(result.payload.description).toContain('Unarmed Strike');
      expect(result.payload.description).toContain('d20(9) + 5 = 14 vs AC 14');
      expect(result.payload.description).toContain('1d8');
      expect(result.payload.description).toContain('HIT');
      expect(logService.addEntry).toHaveBeenCalled();
    });

    it('misses and skips damage when total is below AC', async () => {
      // DEX(3) + PROF(2) = 5; d20(8) + 5 = 13 < AC 18 = MISS
      mockAttack({ target: makeTarget({ ac: 18 }), d20: 8 });

      const result = await handle(makeAction(), makePlayerStats(), campaignName);

      expect(result.payload.description).toContain('d20(8) + 5 = 13 vs AC 18');
      expect(result.payload.description).toContain('MISS');
      expect(result.payload.description).toContain('missed');
      expect(result.payload.description).toContain('no damage');
      expect(applyDamage.applyDamageToTarget).not.toHaveBeenCalled();
      // A miss is still logged to the campaign log
      expect(logService.addEntry).toHaveBeenCalledTimes(1);
    });

    it('uses default AC of 15 when target has no ac property', async () => {
      // d20(12) + 5 = 17 >= 15 (default) = HIT; damage = die(7) + DEX(3) = 10
      mockAttack({ target: makeTarget({ ac: undefined }), d20: 12, damageRoll: { total: 7, rolls: [7] } });

      await handle(makeAction(), makePlayerStats(), campaignName);

      expect(applyDamage.applyDamageToTarget).toHaveBeenCalledWith(
        expect.any(Object),
        'Goblin',
        10,
        ['Bludgeoning'],
        expect.any(Object),
      );
    });
  });

  describe('bardic die size', () => {
    it.each([
      ['1d6', undefined],
      ['1d10', 10],
      ['1d12', 12],
    ])('rolls %s when bardicDie is %s', async (expected, bardicDie) => {
      const automation = { type: 'agile_strike' };
      if (bardicDie !== undefined) automation.bardicDie = bardicDie;
      const action = makeAction({ automation });
      mockAttack({ target: makeTarget({ ac: 10 }) });

      await handle(action, makePlayerStats(), campaignName);

      expect(diceRoller.rollExpression).toHaveBeenCalledWith(expected);
      const logEntry = logService.addEntry.mock.calls[0][1];
      expect(logEntry.description).toContain(expected);
    });
  });

  describe('attribute fallbacks', () => {
    it('uses 0 DEX modifier when Dexterity ability is missing', async () => {
      // hit bonus = 0 + PROF(2) = 2; d20(10) + 2 = 12 >= AC 10 = HIT
      // damage = die(4) + DEX(0) = 4
      mockAttack({ target: makeTarget({ ac: 10 }), damageRoll: { total: 4, rolls: [4] } });

      await handle(makeAction(), makePlayerStats({ abilities: [] }), campaignName);

      expect(applyDamage.applyDamageToTarget).toHaveBeenCalledWith(
        expect.any(Object),
        'Goblin',
        4,
        ['Bludgeoning'],
        expect.any(Object),
      );
    });

    it('uses 0 proficiency when proficiency is missing', async () => {
      // hit bonus = DEX(3) + 0 = 3; d20(12) + 3 = 15 vs AC 15 = HIT
      mockAttack({ target: makeTarget({ ac: 15 }), d20: 12 });

      const result = await handle(makeAction(), makePlayerStats({ proficiency: undefined }), campaignName);

      expect(result.payload.description).toContain('+ 3 = 15 vs AC 15');
      expect(applyDamage.applyDamageToTarget).toHaveBeenCalled();
    });

    it('treats a null damage roll as 0 when adding DEX modifier', async () => {
      mockAttack({ target: makeTarget({ ac: 10 }), damageRoll: null });

      await handle(makeAction(), makePlayerStats(), campaignName);

      // rollExpression returns null, so damageTotal = 0 + DEX(3) = 3
      expect(applyDamage.applyDamageToTarget).toHaveBeenCalledWith(
        expect.any(Object),
        'Goblin',
        3,
        ['Bludgeoning'],
        expect.any(Object),
      );
    });
  });

  describe('logging', () => {
    it('logs an ability_use entry with hit/miss and damage details', async () => {
      mockAttack({ target: makeTarget({ ac: 14 }), d20: 9, damageRoll: { total: 3, rolls: [3] } });

      await handle(makeAction(), makePlayerStats(), campaignName);

      expect(logService.addEntry).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({
          type: 'ability_use',
          characterName: 'Bard',
          abilityName: 'Agile Strikes',
          timestamp: expect.any(Number),
        }),
      );
      const logEntry = logService.addEntry.mock.calls[0][1];
      expect(logEntry.description).toContain('d20(9) + 5 = 14 vs AC 14');
      expect(logEntry.description).toContain('HIT');
      expect(logEntry.description).toContain('Bludgeoning damage');
    });

    it('handles addEntry failure gracefully', async () => {
      mockAttack({ target: makeTarget({ ac: 14 }), d20: 10, damageRoll: { total: 5, rolls: [5] } });
      logService.addEntry.mockRejectedValue(new Error('Log service error'));

      const result = await handle(makeAction(), makePlayerStats(), campaignName);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('HIT');
    });
  });

  describe('action shape flexibility', () => {
    it('uses action object directly when automation field is missing', async () => {
      const action = { name: 'Agile Strikes' };
      mockAttack({ target: makeTarget({ ac: 12 }) });

      const result = await handle(action, makePlayerStats(), campaignName);

      // action.automation is undefined, so auto = action, bardicDie defaults to 6
      expect(diceRoller.rollExpression).toHaveBeenCalledWith('1d6');
      expect(result.payload.name).toBe('Agile Strikes');
    });
  });
});
