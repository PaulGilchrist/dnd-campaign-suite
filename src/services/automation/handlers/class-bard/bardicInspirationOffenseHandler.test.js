// @cleaned-by-ai
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
    useRuntimeState.getRuntimeValue.mockReset();
    diceRoller.rollExpression.mockReset();
    damageRollback.findLastAttack.mockReset();
  });

  describe('no bardic inspiration die', () => {
    it('returns popup with info type when die is falsy', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(null);

      const result = await handle(makeAction(), makePlayerStats(), campaignName);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.name).toBe('Offensive Inspiration');
      expect(result.payload.description).toBe('You do not have a Bardic Inspiration die.');
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
  });

  describe('successful invocation', () => {
    it('rolls the correct die expression for the die size', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(8);
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(undefined);
      diceRoller.rollExpression.mockReturnValue({ total: 5, rolls: [5] });
      damageRollback.findLastAttack.mockResolvedValue(null);

      await handle(makeAction(), makePlayerStats(), campaignName);

      expect(diceRoller.rollExpression).toHaveBeenCalledWith('1d8');
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

    it('includes grantedBy in popup description when set', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(8);
      useRuntimeState.getRuntimeValue.mockReturnValueOnce('Goblin');
      diceRoller.rollExpression.mockReturnValue({ total: 5, rolls: [5] });
      damageRollback.findLastAttack.mockResolvedValue(null);

      const result = await handle(makeAction(), makePlayerStats(), campaignName);

      expect(result.payload.description).toContain('Die granted by Goblin');
    });
  });

  describe('damage application to matching attacker', () => {
    it('returns popup with bonus damage message when attacker matches player', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(8);
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(undefined);
      diceRoller.rollExpression.mockReturnValue({ total: 5, rolls: [5] });
      damageRollback.findLastAttack.mockResolvedValue(makeLastAttack('Bard', 'Goblin', Date.now()));

      const result = await handle(makeAction(), makePlayerStats(), campaignName);

      expect(result.payload.description).toContain('Bonus damage applied to Goblin');
      expect(result.payload.description).not.toContain('No recent damage event found');
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
