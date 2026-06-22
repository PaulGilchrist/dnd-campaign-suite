import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../dice/diceRoller.js', () => ({
  rollExpression: vi.fn(),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn().mockImplementation(() => Promise.resolve()),
}));

vi.mock('../../common/damageRollback.js', () => ({
  findLastAttack: vi.fn(),
}));

import { handle } from './bardicInspirationOffenseHandler.js';

import * as diceRoller from '../../../dice/diceRoller.js';
import * as useRuntimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as logService from '../../../ui/logService.js';
import * as damageRollback from '../../common/damageRollback.js';

const campaignName = 'TestCampaign';

function makePlayerStats(overrides = {}) {
  return {
    name: 'Bard',
    ...overrides,
  };
}

function makeAction(overrides = {}) {
  return {
    name: 'Offensive Inspiration',
    automation: { type: 'bardic_inspiration_offense' },
    ...overrides,
  };
}

function makeRollResult(total, rolls = [total]) {
  return { total, rolls };
}

function makeLastAttack(attackerName, targetName, timestamp, stale = false) {
  return {
    attackEvent: stale ? { timestamp: Date.now() - 70000, targetName } : { timestamp: timestamp || Date.now(), targetName },
    attackerName: attackerName || null,
    targetName: targetName || null,
    primaryDamage: 0,
    secondaryDamage: 0,
    totalDamage: 0,
    damageTypes: [],
  };
}

describe('bardicInspirationOffenseHandler.handle', () => {
  function resetMocks() {
    diceRoller.rollExpression.mockClear().mockReturnValue(null);
    useRuntimeState.getRuntimeValue.mockClear().mockReset();
    useRuntimeState.setRuntimeValue.mockClear();
    logService.addEntry.mockClear();
    damageRollback.findLastAttack.mockClear().mockResolvedValue(null);
  }

  beforeEach(() => {
    resetMocks();
  });

  describe('no bardic inspiration die', () => {
    it('returns popup when bardicInspirationDie is null', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(null);

      const result = await handle(makeAction(), makePlayerStats(), campaignName);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toBe('You do not have a Bardic Inspiration die.');
    });

    it('returns popup when bardicInspirationDie is undefined', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(undefined);

      const result = await handle(makeAction(), makePlayerStats(), campaignName);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toBe('You do not have a Bardic Inspiration die.');
    });

    it('returns popup when bardicInspirationDie is 0', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(0);

      const result = await handle(makeAction(), makePlayerStats(), campaignName);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toBe('You do not have a Bardic Inspiration die.');
    });

    it('does not call rollExpression when there is no die', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(null);
      await handle(makeAction(), makePlayerStats(), campaignName);
      expect(diceRoller.rollExpression).not.toHaveBeenCalled();
    });

    it('does not call setRuntimeValue or addEntry when there is no die', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(null);
      await handle(makeAction(), makePlayerStats(), campaignName);
      expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
      expect(logService.addEntry).not.toHaveBeenCalled();
    });

    it('includes correct payload structure on no-die early exit', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(null);
      const result = await handle(makeAction(), makePlayerStats(), campaignName);
      expect(result).toEqual({
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: 'Offensive Inspiration',
          description: 'You do not have a Bardic Inspiration die.',
        },
      });
    });
  });

  describe('roll expression fails', () => {
    it('returns popup when rollExpression returns null', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(8);
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(undefined);
      diceRoller.rollExpression.mockReturnValue(null);

      const result = await handle(makeAction(), makePlayerStats(), campaignName);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toBe('Roll failed.');
    });

    it('returns popup when rollExpression returns undefined', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(8).mockReturnValueOnce(undefined);
      diceRoller.rollExpression.mockReturnValue(undefined);

      const result = await handle(makeAction(), makePlayerStats(), campaignName);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toBe('Roll failed.');
    });

    it('does not call setRuntimeValue or addEntry when roll fails', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(8);
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(undefined);
      diceRoller.rollExpression.mockReturnValue(null);

      await handle(makeAction(), makePlayerStats(), campaignName);

      expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
      expect(logService.addEntry).not.toHaveBeenCalled();
    });
  });

  describe('successful invocation without recent damage event', () => {
    it('rolls correct die expression', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(8).mockReturnValueOnce(undefined);
      diceRoller.rollExpression.mockReturnValue(makeRollResult(5, [5]));
      damageRollback.findLastAttack.mockResolvedValue(null);

      await handle(makeAction(), makePlayerStats(), campaignName);

      expect(diceRoller.rollExpression).toHaveBeenCalledWith('1d8');
    });

    it('rolls correct die expression for d12', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(12).mockReturnValueOnce(undefined);
      diceRoller.rollExpression.mockReturnValue(makeRollResult(7, [7]));
      damageRollback.findLastAttack.mockResolvedValue(null);

      await handle(makeAction(), makePlayerStats(), campaignName);

      expect(diceRoller.rollExpression).toHaveBeenCalledWith('1d12');
    });

    it('clears bardic inspiration runtime state on success', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(8);
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(undefined);
      diceRoller.rollExpression.mockReturnValue(makeRollResult(5, [5]));
      damageRollback.findLastAttack.mockResolvedValue(null);

      await handle(makeAction(), makePlayerStats(), campaignName);

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith('Bard', 'bardicInspirationDie', null, campaignName);
      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith('Bard', 'bardicInspirationGrantedBy', null, campaignName);
      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith('Bard', 'bardicInspirationCombatOptions', null, campaignName);
    });

    it('logs the ability use entry on success', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(8);
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(undefined);
      diceRoller.rollExpression.mockReturnValue(makeRollResult(5, [5]));
      damageRollback.findLastAttack.mockResolvedValue(null);

      await handle(makeAction(), makePlayerStats(), campaignName);

      expect(logService.addEntry).toHaveBeenCalledWith(campaignName, {
        type: 'ability_use',
        characterName: 'Bard',
        abilityName: 'Offensive Inspiration',
        description: 'Bard used Offensive Inspiration: rolled 1d8 (5). No recent damage event found. Add 5 damage to your last hit manually.',
        biDieRoll: 5,
        biDieSize: 8,
        timestamp: expect.any(Number),
      });
    });

    it('log entry description contains roll total and no-damage-event message', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(8);
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(undefined);
      diceRoller.rollExpression.mockReturnValue(makeRollResult(5, [5]));
      damageRollback.findLastAttack.mockResolvedValue(null);

      await handle(makeAction(), makePlayerStats(), campaignName);

      const logDescription = logService.addEntry.mock.calls[0][1].description;
      expect(logDescription).toContain('No recent damage event found');
      expect(logDescription).toContain('Add 5 damage');
    });

    it('returns popup with roll details on success', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(8);
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(undefined);
      diceRoller.rollExpression.mockReturnValue(makeRollResult(5, [5]));
      damageRollback.findLastAttack.mockResolvedValue(null);

      const result = await handle(makeAction(), makePlayerStats(), campaignName);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toContain('1d8');
      expect(result.payload.description).toContain('5');
    });

    it('includes roll values in success description', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(8);
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(undefined);
      diceRoller.rollExpression.mockReturnValue(makeRollResult(5, [3, 2]));
      damageRollback.findLastAttack.mockResolvedValue(null);

      const result = await handle(makeAction(), makePlayerStats(), campaignName);

      expect(result.payload.description).toContain('**5**');
      expect(result.payload.description).toContain('3, 2');
    });

    it('includes grantedBy in success description', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(8);
      useRuntimeState.getRuntimeValue.mockReturnValueOnce('Goblin');
      diceRoller.rollExpression.mockReturnValue(makeRollResult(5, [5]));
      damageRollback.findLastAttack.mockResolvedValue(null);

      const result = await handle(makeAction(), makePlayerStats(), campaignName);

      expect(result.payload.description).toContain('Die granted by Goblin');
    });

    it('uses "unknown" as grantedBy when not set', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(8);
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(undefined);
      diceRoller.rollExpression.mockReturnValue(makeRollResult(5, [5]));
      damageRollback.findLastAttack.mockResolvedValue(null);

      const result = await handle(makeAction(), makePlayerStats(), campaignName);

      expect(result.payload.description).toContain('Die granted by unknown');
    });

    it('includes action.automation in returned payload', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(8);
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(undefined);
      diceRoller.rollExpression.mockReturnValue(makeRollResult(5, [5]));
      damageRollback.findLastAttack.mockResolvedValue(null);

      const result = await handle(makeAction(), makePlayerStats(), campaignName);

      expect(result.payload.automation).toEqual({ type: 'bardic_inspiration_offense' });
    });

    it('does not call findLastAttack when die is missing', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(null);
      await handle(makeAction(), makePlayerStats(), campaignName);
      expect(damageRollback.findLastAttack).not.toHaveBeenCalled();
    });

    it('does not call findLastAttack when roll fails', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(8);
      diceRoller.rollExpression.mockReturnValue(null);
      await handle(makeAction(), makePlayerStats(), campaignName);
      expect(damageRollback.findLastAttack).not.toHaveBeenCalled();
    });

    it('does not include defender HP in description when no damage event', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(8);
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(undefined);
      diceRoller.rollExpression.mockReturnValue(makeRollResult(5, [5]));
      damageRollback.findLastAttack.mockResolvedValue(null);

      const result = await handle(makeAction(), makePlayerStats(), campaignName);

      expect(result.payload.description).not.toContain('HP:');
    });
  });



  describe('successful damage application to target', () => {
    it('applies bonus damage message when attacker matches player', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(8);
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(undefined);
      diceRoller.rollExpression.mockReturnValue(makeRollResult(5, [5]));
      damageRollback.findLastAttack.mockResolvedValue(makeLastAttack('Bard', 'Goblin', Date.now()));

      await handle(makeAction(), makePlayerStats(), campaignName);

      const logDescription = logService.addEntry.mock.calls[0][1].description;
      expect(logDescription).toContain('Bonus damage applied to Goblin');
    });

    it('includes target name in bonus description', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(8);
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(undefined);
      diceRoller.rollExpression.mockReturnValue(makeRollResult(5, [5]));
      damageRollback.findLastAttack.mockResolvedValue(makeLastAttack('Bard', 'Goblin', Date.now()));

      const result = await handle(makeAction(), makePlayerStats(), campaignName);

      expect(result.payload.description).toContain('Bonus damage applied to Goblin');
    });

    it('does not include defender HP in description (HP tracking removed)', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(8);
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(undefined);
      diceRoller.rollExpression.mockReturnValue(makeRollResult(5, [5]));
      damageRollback.findLastAttack.mockResolvedValue(makeLastAttack('Bard', 'Goblin', Date.now()));

      const result = await handle(makeAction(), makePlayerStats(), campaignName);

      expect(result.payload.description).not.toContain('HP:');
    });

    it('log entry description includes bonus damage message when applied', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(8);
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(undefined);
      diceRoller.rollExpression.mockReturnValue(makeRollResult(5, [5]));
      damageRollback.findLastAttack.mockResolvedValue(makeLastAttack('Bard', 'Goblin', Date.now()));

      await handle(makeAction(), makePlayerStats(), campaignName);

      const logDescription = logService.addEntry.mock.calls[0][1].description;
      expect(logDescription).toContain('Bonus damage applied to Goblin');
    });
  });

  describe('edge cases', () => {
    it('uses playerStats.name for runtime calls', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(6);
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(undefined);
      diceRoller.rollExpression.mockReturnValue(makeRollResult(2, [2]));
      damageRollback.findLastAttack.mockResolvedValue(null);

      await handle(makeAction(), makePlayerStats({ name: 'Valeria' }), campaignName);

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith('Valeria', 'bardicInspirationDie', null, campaignName);
      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith('Valeria', 'bardicInspirationGrantedBy', null, campaignName);
      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith('Valeria', 'bardicInspirationCombatOptions', null, campaignName);
    });

    it('does not propagate addEntry rejection', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(8);
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(undefined);
      diceRoller.rollExpression.mockReturnValue(makeRollResult(5, [5]));
      damageRollback.findLastAttack.mockResolvedValue(null);
      logService.addEntry.mockImplementation(() => Promise.reject(new Error('log service failed')).catch(() => {}));

      const result = await handle(makeAction(), makePlayerStats(), campaignName);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('rolled **5**');
    });

    it('calls getRuntimeValue with correct key for bardicInspirationDie', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(8);
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(undefined);
      diceRoller.rollExpression.mockReturnValue(makeRollResult(3, [3]));
      damageRollback.findLastAttack.mockResolvedValue(null);

      await handle(makeAction(), makePlayerStats(), campaignName);

      expect(useRuntimeState.getRuntimeValue).toHaveBeenNthCalledWith(1, 'Bard', 'bardicInspirationDie', campaignName);
    });

    it('calls getRuntimeValue with correct key for bardicInspirationGrantedBy', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(8);
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(undefined);
      diceRoller.rollExpression.mockReturnValue(makeRollResult(3, [3]));
      damageRollback.findLastAttack.mockResolvedValue(null);

      await handle(makeAction(), makePlayerStats(), campaignName);

      expect(useRuntimeState.getRuntimeValue).toHaveBeenNthCalledWith(2, 'Bard', 'bardicInspirationGrantedBy', campaignName);
    });

    it('does not call findLastAttack when die is missing', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(null);
      await handle(makeAction(), makePlayerStats(), campaignName);
      expect(damageRollback.findLastAttack).not.toHaveBeenCalled();
    });

    it('does not call findLastAttack when roll fails', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(8);
      diceRoller.rollExpression.mockReturnValue(null);
      await handle(makeAction(), makePlayerStats(), campaignName);
      expect(damageRollback.findLastAttack).not.toHaveBeenCalled();
    });

    it('handles damage event with empty string targetName as no bonus', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(8);
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(undefined);
      diceRoller.rollExpression.mockReturnValue(makeRollResult(4, [4]));
      damageRollback.findLastAttack.mockResolvedValue({
        attackEvent: { timestamp: Date.now(), targetName: '' },
        attackerName: 'Bard',
        targetName: '',
        primaryDamage: 0,
        secondaryDamage: 0,
        totalDamage: 0,
        damageTypes: [],
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName);

      expect(result.payload.description).toContain('No recent damage event found');
    });

    it('handles attack from different attacker as no bonus', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(8);
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(undefined);
      diceRoller.rollExpression.mockReturnValue(makeRollResult(4, [4]));
      damageRollback.findLastAttack.mockResolvedValue(makeLastAttack('Goblin', 'Bard', Date.now()));

      const result = await handle(makeAction(), makePlayerStats(), campaignName);

      expect(result.payload.description).toContain('No recent damage event found');
    });
  });
});
