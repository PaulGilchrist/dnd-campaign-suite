// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../dice/diceRoller.js', () => ({
  rollExpression: vi.fn(),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
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

function makeLastAttack(attackerName, targetName, timestamp) {
  return {
    attackEvent: { timestamp: timestamp || Date.now(), targetName },
    attackerName: attackerName || null,
    targetName: targetName || null,
    primaryDamage: 0,
    secondaryDamage: 0,
    totalDamage: 0,
    damageTypes: [],
  };
}

describe('bardicInspirationOffenseHandler.handle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mock implementations so persistent mockReturnValue from prior tests doesn't leak
    useRuntimeState.getRuntimeValue.mockReset();
    diceRoller.rollExpression.mockReset();
    damageRollback.findLastAttack.mockReset();
  });

  describe('no bardic inspiration die', () => {
    it('returns popup with info type when die is null', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(null);

      const result = await handle(makeAction(), makePlayerStats(), campaignName);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.name).toBe('Offensive Inspiration');
      expect(result.payload.description).toBe('You do not have a Bardic Inspiration die.');
    });

    it('returns popup when die is undefined', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(undefined);

      const result = await handle(makeAction(), makePlayerStats(), campaignName);

      expect(result.payload.description).toBe('You do not have a Bardic Inspiration die.');
    });

    it('returns popup when die is zero', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(0);

      const result = await handle(makeAction(), makePlayerStats(), campaignName);

      expect(result.payload.description).toBe('You do not have a Bardic Inspiration die.');
    });

    it('does not roll dice, clear state, or log when no die', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(null);

      await handle(makeAction(), makePlayerStats(), campaignName);

      expect(diceRoller.rollExpression).not.toHaveBeenCalled();
      expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
      expect(logService.addEntry).not.toHaveBeenCalled();
      expect(damageRollback.findLastAttack).not.toHaveBeenCalled();
    });
  });

  describe('roll failure', () => {
    it('returns popup with "Roll failed." when rollExpression returns null', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(8);
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(undefined);
      diceRoller.rollExpression.mockReturnValue(null);

      const result = await handle(makeAction(), makePlayerStats(), campaignName);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toBe('Roll failed.');
    });

    it('returns popup when rollExpression returns undefined', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(8);
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(undefined);
      diceRoller.rollExpression.mockReturnValue(undefined);

      const result = await handle(makeAction(), makePlayerStats(), campaignName);

      expect(result.payload.description).toBe('Roll failed.');
    });

    it('does not clear state or log when roll fails', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(8);
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(undefined);
      diceRoller.rollExpression.mockReturnValue(null);

      await handle(makeAction(), makePlayerStats(), campaignName);

      expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
      expect(logService.addEntry).not.toHaveBeenCalled();
      expect(damageRollback.findLastAttack).not.toHaveBeenCalled();
    });
  });

  describe('successful invocation', () => {
    it('rolls the correct die expression for d8', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(8);
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(undefined);
      diceRoller.rollExpression.mockReturnValue({ total: 5, rolls: [5] });
      damageRollback.findLastAttack.mockResolvedValue(null);

      await handle(makeAction(), makePlayerStats(), campaignName);

      expect(diceRoller.rollExpression).toHaveBeenCalledWith('1d8');
    });

    it('rolls the correct die expression for d12', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(12);
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(undefined);
      diceRoller.rollExpression.mockReturnValue({ total: 7, rolls: [7] });
      damageRollback.findLastAttack.mockResolvedValue(null);

      await handle(makeAction(), makePlayerStats(), campaignName);

      expect(diceRoller.rollExpression).toHaveBeenCalledWith('1d12');
    });

    it('clears all bardic inspiration runtime state on success', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(8);
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(undefined);
      diceRoller.rollExpression.mockReturnValue({ total: 5, rolls: [5] });
      damageRollback.findLastAttack.mockResolvedValue(null);

      await handle(makeAction(), makePlayerStats(), campaignName);

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith('Bard', 'bardicInspirationDie', null, campaignName);
      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith('Bard', 'bardicInspirationGrantedBy', null, campaignName);
      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith('Bard', 'bardicInspirationCombatOptions', null, campaignName);
    });

    it('logs ability_use with die size, roll total, and no-damage message', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(8);
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(undefined);
      diceRoller.rollExpression.mockReturnValue({ total: 5, rolls: [5] });
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

    it('returns popup with roll details and manual instruction', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(8);
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(undefined);
      diceRoller.rollExpression.mockReturnValue({ total: 5, rolls: [5] });
      damageRollback.findLastAttack.mockResolvedValue(null);

      const result = await handle(makeAction(), makePlayerStats(), campaignName);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toContain('1d8');
      expect(result.payload.description).toContain('**5**');
      expect(result.payload.description).toContain('Add this to your attack\'s damage');
      expect(result.payload.description).toContain('Die granted by unknown');
      expect(result.payload.description).toContain('No recent damage event found');
      expect(result.payload.description).not.toContain('HP:');
    });

    it('includes individual roll components in popup description', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(8);
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(undefined);
      diceRoller.rollExpression.mockReturnValue({ total: 5, rolls: [3, 2] });
      damageRollback.findLastAttack.mockResolvedValue(null);

      const result = await handle(makeAction(), makePlayerStats(), campaignName);

      expect(result.payload.description).toContain('**5**');
      expect(result.payload.description).toContain('3, 2');
    });

    it('includes grantedBy in popup description', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(8);
      useRuntimeState.getRuntimeValue.mockReturnValueOnce('Goblin');
      diceRoller.rollExpression.mockReturnValue({ total: 5, rolls: [5] });
      damageRollback.findLastAttack.mockResolvedValue(null);

      const result = await handle(makeAction(), makePlayerStats(), campaignName);

      expect(result.payload.description).toContain('Die granted by Goblin');
    });

    it('uses "unknown" as grantedBy when not set', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(8);
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(undefined);
      diceRoller.rollExpression.mockReturnValue({ total: 5, rolls: [5] });
      damageRollback.findLastAttack.mockResolvedValue(null);

      const result = await handle(makeAction(), makePlayerStats(), campaignName);

      expect(result.payload.description).toContain('Die granted by unknown');
    });

    it('includes action.automation in returned payload', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(8);
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(undefined);
      diceRoller.rollExpression.mockReturnValue({ total: 5, rolls: [5] });
      damageRollback.findLastAttack.mockResolvedValue(null);

      const result = await handle(makeAction(), makePlayerStats(), campaignName);

      expect(result.payload.automation).toEqual({ type: 'bardic_inspiration_offense' });
    });
  });

  describe('damage application to matching attacker', () => {
    it('applies bonus damage message when attacker matches player', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(8);
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(undefined);
      diceRoller.rollExpression.mockReturnValue({ total: 5, rolls: [5] });
      damageRollback.findLastAttack.mockResolvedValue(makeLastAttack('Bard', 'Goblin', Date.now()));

      await handle(makeAction(), makePlayerStats(), campaignName);

      const logDescription = logService.addEntry.mock.calls[0][1].description;
      expect(logDescription).toContain('Bonus damage applied to Goblin');
    });

    it('returns popup with bonus damage message', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(8);
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(undefined);
      diceRoller.rollExpression.mockReturnValue({ total: 5, rolls: [5] });
      damageRollback.findLastAttack.mockResolvedValue(makeLastAttack('Bard', 'Goblin', Date.now()));

      const result = await handle(makeAction(), makePlayerStats(), campaignName);

      expect(result.payload.description).toContain('Bonus damage applied to Goblin');
      expect(result.payload.description).not.toContain('No recent damage event found');
    });

    it('does not include defender HP in description', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(8);
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(undefined);
      diceRoller.rollExpression.mockReturnValue({ total: 5, rolls: [5] });
      damageRollback.findLastAttack.mockResolvedValue(makeLastAttack('Bard', 'Goblin', Date.now()));

      const result = await handle(makeAction(), makePlayerStats(), campaignName);

      expect(result.payload.description).not.toContain('HP:');
    });
  });

  describe('no bonus when attacker differs', () => {
    it('treats different attacker as no recent damage event', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(8);
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(undefined);
      diceRoller.rollExpression.mockReturnValue({ total: 4, rolls: [4] });
      damageRollback.findLastAttack.mockResolvedValue(makeLastAttack('Goblin', 'Bard', Date.now()));

      const result = await handle(makeAction(), makePlayerStats(), campaignName);

      expect(result.payload.description).toContain('No recent damage event found');
      expect(result.payload.description).toContain('Add 4 damage');
      expect(result.payload.description).not.toContain('Bonus damage');
    });
  });

  describe('no bonus when targetName is empty', () => {
    it('treats empty string targetName as no recent damage event', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(8);
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(undefined);
      diceRoller.rollExpression.mockReturnValue({ total: 4, rolls: [4] });
      damageRollback.findLastAttack.mockResolvedValue(makeLastAttack('Bard', '', Date.now()));

      const result = await handle(makeAction(), makePlayerStats(), campaignName);

      expect(result.payload.description).toContain('No recent damage event found');
      expect(result.payload.description).not.toContain('Bonus damage');
    });
  });

  describe('uses playerStats.name throughout', () => {
    it('uses custom character name for runtime state clearing', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(6);
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(undefined);
      diceRoller.rollExpression.mockReturnValue({ total: 2, rolls: [2] });
      damageRollback.findLastAttack.mockResolvedValue(null);

      await handle(makeAction(), makePlayerStats({ name: 'Valeria' }), campaignName);

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith('Valeria', 'bardicInspirationDie', null, campaignName);
      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith('Valeria', 'bardicInspirationGrantedBy', null, campaignName);
      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith('Valeria', 'bardicInspirationCombatOptions', null, campaignName);
    });

    it('uses custom character name in log entry', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(8);
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(undefined);
      diceRoller.rollExpression.mockReturnValue({ total: 3, rolls: [3] });
      damageRollback.findLastAttack.mockResolvedValue(null);

      await handle(makeAction(), makePlayerStats({ name: 'Valeria' }), campaignName);

      expect(logService.addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
        characterName: 'Valeria',
        description: expect.stringContaining('Valeria used Offensive Inspiration'),
      }));
    });
  });

  describe('error resilience', () => {
    it('does not block popup return when addEntry rejects (fire-and-forget)', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(8);
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(undefined);
      diceRoller.rollExpression.mockReturnValue({ total: 5, rolls: [5] });
      damageRollback.findLastAttack.mockResolvedValue(null);
      logService.addEntry.mockImplementation(() => Promise.reject(new Error('log service failed')).catch(() => {}));

      const result = await handle(makeAction(), makePlayerStats(), campaignName);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('rolled **5**');
    });
  });
});
