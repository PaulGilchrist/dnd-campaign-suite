// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../common/buffToggle.js', () => ({
  toggleBuff: vi.fn(),
  isBuffActive: vi.fn(),
}));

vi.mock('../class-warlock/tempTeleportHandler.js', () => ({
  handle: vi.fn(),
}));

vi.mock('../class-cleric-paladin/vowOfEnmityHandler.js', () => ({
  handle: vi.fn(),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getTargetFromAttacker: vi.fn(),
}));

vi.mock('../../../encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(),
  loadCombatSummary: vi.fn(),
}));

vi.mock('../../../combat/automation/automationService.js', () => {
  const evaluateAutoExpression = vi.fn()
  return {
    evaluateAutoExpression,
    resolveNumericExpression: (...args) => evaluateAutoExpression(...args),
  }
});

vi.mock('../../../rules/effects/expirations.js', () => ({
  addExpiration: vi.fn(),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../../services/shared/abilityLookup.js', () => ({
  getAbilityModifier: vi.fn(),
}));

vi.mock('../class-druid/wildShapeCreatureBuilder.js', () => ({
  cleanupWildShape: vi.fn(),
}));

vi.mock('./tempHpService.js', () => ({
  setTempHp: vi.fn(),
}));

import { handle } from './buffHandler.js';
import * as buffToggle from '../../common/buffToggle.js';
import * as runtimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as automationService from '../../../combat/automation/automationService.js';
import * as logService from '../../../ui/logService.js';
import * as tempTeleportHandler from '../class-warlock/tempTeleportHandler.js';
import * as vowOfEnmityHandler from '../class-cleric-paladin/vowOfEnmityHandler.js';
import * as tempHpService from './tempHpService.js';

const campaignName = 'test-campaign';

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestHero',
    level: 5,
    proficiency: 3,
    ...overrides,
  };
}

function makeAction(automation = {}) {
  return {
    name: 'Test Buff',
    automation: {
      type: 'buff',
      ...automation,
    },
  };
}

describe('buffHandler.handle - basic effects', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    buffToggle.toggleBuff.mockReturnValue({ wasActive: false });
    runtimeState.getRuntimeValue.mockReturnValue(undefined);
  });

  describe('bonus_action_dash effect', () => {
    it('grants dash uses and decrements when uses are available', async () => {
      const ps = makePlayerStats({ proficiency: 3 });
      const action = makeAction({ effect: 'bonus_action_dash', uses: 'proficiency_bonus' });
      runtimeState.getRuntimeValue.mockReturnValue(4);

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toContain('Dash action as a Bonus Action');
      expect(result.payload.description).toContain('3 uses remaining');
      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        ps.name,
        'adrenalineRushUses',
        3,
        campaignName,
      );
      expect(logService.addEntry).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({
          characterName: ps.name,
          abilityName: 'Test Buff',
          description: expect.stringContaining('Dash as a Bonus Action'),
        }),
      );
    });

    it('blocks when uses are exhausted', async () => {
      const ps = makePlayerStats({ proficiency: 3 });
      const action = makeAction({ effect: 'bonus_action_dash', uses: 'proficiency_bonus' });
      runtimeState.getRuntimeValue.mockReturnValue(0);

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toContain('no uses remaining');
      expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
      expect(logService.addEntry).not.toHaveBeenCalled();
    });

    it('grants temp HP when bonusEffect is temp_hp and expression exists', async () => {
      const ps = makePlayerStats({ proficiency: 3 });
      const action = makeAction({ effect: 'bonus_action_dash', uses: 1, bonusEffect: 'temp_hp', bonusExpression: '2d6+2' });
      runtimeState.getRuntimeValue.mockReturnValue(1);
      automationService.evaluateAutoExpression.mockReturnValue(9);

      const result = await handle(action, ps, campaignName, null);

      expect(automationService.evaluateAutoExpression).toHaveBeenCalledWith('2d6+2', ps);
      expect(tempHpService.setTempHp).toHaveBeenCalledWith(ps.name, 9, campaignName);
      expect(result.payload.description).toContain('Gained 9 temporary hit points');
      expect(result.payload.description).toContain('0 uses remaining');
      expect(logService.addEntry).toHaveBeenCalled();
    });

    it('skips temp HP when expression evaluates to zero', async () => {
      const ps = makePlayerStats({ proficiency: 3 });
      const action = makeAction({ effect: 'bonus_action_dash', uses: 1, bonusEffect: 'temp_hp', bonusExpression: '1d1' });
      runtimeState.getRuntimeValue.mockReturnValue(1);
      automationService.evaluateAutoExpression.mockReturnValue(0);

      const result = await handle(action, ps, campaignName, null);

      expect(tempHpService.setTempHp).not.toHaveBeenCalled();
      expect(result.payload.description).not.toContain('temporary hit points');
      expect(result.payload.description).toContain('0 uses remaining');
      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        ps.name,
        'adrenalineRushUses',
        0,
        campaignName,
      );
    });

    it('skips temp HP when expression evaluates to a negative number', async () => {
      const ps = makePlayerStats({ proficiency: 3 });
      const action = makeAction({ effect: 'bonus_action_dash', uses: 1, bonusEffect: 'temp_hp', bonusExpression: '-5' });
      runtimeState.getRuntimeValue.mockReturnValue(1);
      automationService.evaluateAutoExpression.mockReturnValue(-3);

      const result = await handle(action, ps, campaignName, null);

      expect(tempHpService.setTempHp).not.toHaveBeenCalled();
      expect(result.payload.description).not.toContain('temporary hit points');
    });

    it('uses explicit uses number', async () => {
      const ps = makePlayerStats({ proficiency: 5 });
      const action = makeAction({ effect: 'bonus_action_dash', uses: 2 });
      runtimeState.getRuntimeValue.mockReturnValue(2);

      const result = await handle(action, ps, campaignName, null);

      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(ps.name, 'adrenalineRushUses', 1, campaignName);
      expect(result.payload.description).toContain('1 use remaining');
    });

    it('uses usesMax override when uses is unrecognizable', async () => {
      const ps = makePlayerStats({ proficiency: 5 });
      const action = makeAction({ effect: 'bonus_action_dash', uses: 'half', usesMax: 3 });
      runtimeState.getRuntimeValue.mockReturnValue(null);

      const result = await handle(action, ps, campaignName, null);

      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(ps.name, 'adrenalineRushUses', 2, campaignName);
      expect(result.payload.description).toContain('2 uses remaining');
    });

    it('defaults to 1 use when uses field is unrecognizable and usesMax is absent', async () => {
      const ps = makePlayerStats({ proficiency: 5 });
      const action = makeAction({ effect: 'bonus_action_dash', uses: 'half' });
      runtimeState.getRuntimeValue.mockReturnValue(null);

      const result = await handle(action, ps, campaignName, null);

      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(ps.name, 'adrenalineRushUses', 0, campaignName);
      expect(result.payload.description).toContain('0 uses remaining');
    });

    it('uses stored uses value when available instead of computed max', async () => {
      const ps = makePlayerStats({ proficiency: 3 });
      const action = makeAction({ effect: 'bonus_action_dash', uses: 'proficiency_bonus' });
      runtimeState.getRuntimeValue.mockReturnValue(10);

      const result = await handle(action, ps, campaignName, null);

      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(ps.name, 'adrenalineRushUses', 9, campaignName);
      expect(result.payload.description).toContain('9 uses remaining');
    });

    it('grants dash without temp HP when bonusEffect is absent', async () => {
      const ps = makePlayerStats({ proficiency: 3 });
      const action = makeAction({ effect: 'bonus_action_dash', uses: 1 });
      runtimeState.getRuntimeValue.mockReturnValue(1);

      const result = await handle(action, ps, campaignName, null);

      expect(tempHpService.setTempHp).not.toHaveBeenCalled();
      expect(result.payload.description).not.toContain('temporary hit points');
      expect(result.payload.description).toContain('0 uses remaining');
    });

    it('blocks when proficiency_bonus is 0 resulting in 0 uses', async () => {
      const ps = makePlayerStats({ proficiency: 0 });
      const action = makeAction({ effect: 'bonus_action_dash', uses: 'proficiency_bonus' });

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.description).toContain('no uses remaining');
      expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
    });
  });

  describe('delegation', () => {
    it('delegates teleport effects to tempTeleportHandler', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ effect: 'teleport_on_rage' });
      tempTeleportHandler.handle.mockReturnValue({ type: 'popup', payload: {} });

      const result = await handle(action, ps, campaignName, null);

      expect(tempTeleportHandler.handle).toHaveBeenCalledWith(action, ps, campaignName, null);
      expect(result).toEqual({ type: 'popup', payload: {} });
    });

    it('delegates vow_of_enmity to vowOfEnmityHandler', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ effect: 'vow_of_enmity' });
      vowOfEnmityHandler.handle.mockReturnValue({ type: 'popup', payload: {} });

      const result = await handle(action, ps, campaignName, null);

      expect(vowOfEnmityHandler.handle).toHaveBeenCalledWith(action, ps, campaignName, null);
      expect(result).toEqual({ type: 'popup', payload: {} });
    });
  });

  describe('Dash action trigger', () => {
    it('adds a temp buff to activeBuffs when trigger === dash_action and bonusAmount > 0', async () => {
      const ps = makePlayerStats();
      const action = {
        name: 'Swift Step',
        automation: {
          type: 'buff',
          trigger: 'dash_action',
          effect: 'speed_bonus',
          bonus: '10 ft',
          duration: '1 round',
        },
      };
      runtimeState.getRuntimeValue.mockReturnValue(null);

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toBe('Swift Step: +10 ft Speed for this Dash action.');
      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        ps.name,
        'activeBuffs',
        expect.arrayContaining([
          expect.objectContaining({ name: 'Swift Step', tempBuff: true, speedBonus: 10 }),
        ]),
        campaignName,
      );
    });

    it('falls through to normal buff flow when bonusAmount is 0', async () => {
      const ps = makePlayerStats();
      const action = {
        name: 'Empty Buff',
        automation: {
          type: 'buff',
          trigger: 'dash_action',
          effect: 'speed_bonus',
          bonus: '0 ft',
        },
      };
      buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

      const result = await handle(action, ps, campaignName, null);

      expect(buffToggle.toggleBuff).toHaveBeenCalled();
      expect(result.payload.description).toBe('Empty Buff activated on yourself (10 min)');
    });

    it('does not add duplicate temp buff if one already exists', async () => {
      const ps = makePlayerStats();
      const action = {
        name: 'Swift Step',
        automation: {
          type: 'buff',
          trigger: 'dash_action',
          effect: 'speed_bonus',
          bonus: '10 ft',
        },
      };
      const existingBuff = { name: 'Swift Step', tempBuff: true, speedBonus: 10, duration: 'same_action' };
      runtimeState.getRuntimeValue.mockReturnValue([existingBuff]);

      const result = await handle(action, ps, campaignName, null);

      expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
      expect(result.payload.description).toBe('Swift Step: +10 ft Speed for this Dash action.');
    });

    it('falls through when trigger is dash_action but effect is not speed_bonus', async () => {
      const ps = makePlayerStats();
      const action = {
        name: 'Dash Buff',
        automation: {
          type: 'buff',
          trigger: 'dash_action',
          effect: 'some_other_effect',
          bonus: '20 ft',
        },
      };
      buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

      const result = await handle(action, ps, campaignName, null);

      expect(buffToggle.toggleBuff).toHaveBeenCalled();
      expect(result.payload.description).toBe('Dash Buff activated on yourself (10 min)');
    });
  });

  describe('Required level guard', () => {
    it.each([
      [3, 5, true],
      [5, 5, false],
      [7, 5, false],
    ])('blocks when level %s < requiredLevel %s, allows otherwise', async (level, requiredLevel, shouldBlock) => {
      const ps = makePlayerStats({ level });
      const action = makeAction({ requiredLevel });
      buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

      const result = await handle(action, ps, campaignName, null);

      if (shouldBlock) {
        expect(result.payload.description).toContain(`requires character level ${requiredLevel}`);
        expect(buffToggle.toggleBuff).not.toHaveBeenCalled();
      } else {
        expect(buffToggle.toggleBuff).toHaveBeenCalled();
        expect(result.payload.description).toContain('activated on yourself');
      }
    });
  });

  describe('Long rest recharge guard', () => {
    it('blocks when recharge is long_rest and buff is already active', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ recharge: 'long_rest' });
      runtimeState.getRuntimeValue.mockReturnValue([{ name: 'Test Buff' }]);

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.description).toContain('cannot be used again until a Long Rest');
      expect(buffToggle.toggleBuff).not.toHaveBeenCalled();
    });

    it('allows activation when buff is not active or recharge is not long_rest', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ recharge: 'long_rest' });
      runtimeState.getRuntimeValue.mockReturnValue([]);
      buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

      const result = await handle(action, ps, campaignName, null);

      expect(buffToggle.toggleBuff).toHaveBeenCalled();
      expect(result.payload.description).toContain('activated on yourself');
    });

    it('does not apply long_rest guard when uses field is present', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ recharge: 'long_rest', uses: 3 });
      buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

      const result = await handle(action, ps, campaignName, null);

      expect(buffToggle.toggleBuff).toHaveBeenCalled();
      expect(result.payload.description).toContain('activated on yourself');
    });
  });
});
