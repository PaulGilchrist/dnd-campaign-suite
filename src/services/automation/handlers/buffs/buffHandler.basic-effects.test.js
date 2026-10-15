// @maintained-by-ai
// Basic-effect lanes of buffHandler.handle: the bonus_action_dash delegate
// (Adrenaline Rush uses resolution + temp-HP bonus), effect delegation
// (teleport / vow_of_enmity), the FT-105 dash_action speed_boost grant,
// and the generic requiredLevel / long_rest gates. Fully mocked and
// deterministic. Generic toggle popup copy is pinned in
// buffHandler.advanced-effects.test.js; level-gate refusal copy for the
// flight lane is pinned in buffHandler.draconic-flight.test.js.
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
import * as expirations from '../../../rules/effects/expirations.js';

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
      // No bonusEffect declared — dash alone, no temp HP.
      expect(tempHpService.setTempHp).not.toHaveBeenCalled();
      expect(logService.addEntry).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({
          characterName: ps.name,
          abilityName: 'Test Buff',
          description: expect.stringContaining('Dash as a Bonus Action'),
        }),
      );
    });

    it('blocks when stored uses are exhausted', async () => {
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

    it('blocks when proficiency_bonus resolves to 0 uses', async () => {
      const ps = makePlayerStats({ proficiency: 0 });
      const action = makeAction({ effect: 'bonus_action_dash', uses: 'proficiency_bonus' });

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.description).toContain('no uses remaining');
      expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
    });

    // resolveAdrenalineUsesMax branches, all with no stored value.
    it.each([
      ['explicit number', { uses: 2 }, 1],
      ['usesMax override for unrecognizable uses', { uses: 'half', usesMax: 3 }, 2],
      ['default 1 when uses unrecognizable and usesMax absent', { uses: 'half' }, 0],
      ['proficiency_bonus', { uses: 'proficiency_bonus' }, 2],
    ])('resolves max uses from %s', async (_label, automation, expectedWritten) => {
      const ps = makePlayerStats({ proficiency: 3 });
      const action = makeAction({ effect: 'bonus_action_dash', ...automation });
      runtimeState.getRuntimeValue.mockReturnValue(null);

      const result = await handle(action, ps, campaignName, null);

      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        ps.name,
        'adrenalineRushUses',
        expectedWritten,
        campaignName,
      );
      expect(result.payload.description).toContain(`${expectedWritten} use${expectedWritten !== 1 ? 's' : ''} remaining`);
    });

    it('grants temp HP when bonusEffect is temp_hp and expression is positive', async () => {
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

    it.each([
      ['zero', 0],
      ['a negative number', -3],
    ])('skips temp HP when expression evaluates to %s', async (_label, value) => {
      const ps = makePlayerStats({ proficiency: 3 });
      const action = makeAction({ effect: 'bonus_action_dash', uses: 1, bonusEffect: 'temp_hp', bonusExpression: '1d1' });
      runtimeState.getRuntimeValue.mockReturnValue(1);
      automationService.evaluateAutoExpression.mockReturnValue(value);

      const result = await handle(action, ps, campaignName, null);

      expect(tempHpService.setTempHp).not.toHaveBeenCalled();
      expect(result.payload.description).not.toContain('temporary hit points');
      // The dash use is still consumed even when the bonus grants nothing.
      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        ps.name,
        'adrenalineRushUses',
        0,
        campaignName,
      );
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
      // FT-105: stamp must carry effect:'speed_boost' so charSummaryCalc's
      // buffSpeedBonus fold displays the +10 (CLA-067 shape).
      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        ps.name,
        'activeBuffs',
        expect.arrayContaining([
          expect.objectContaining({ name: 'Swift Step', effect: 'speed_boost', speedBonus: 10 }),
        ]),
        campaignName,
      );
      // FT-105: ONE name-scoped remove_active_buff anchor — fires at the
      // character's next turn-start (same-round expiry never fires, §38).
      expect(expirations.addExpiration).toHaveBeenCalledTimes(1);
      expect(expirations.addExpiration).toHaveBeenCalledWith({
        attackerName: ps.name,
        targetName: ps.name,
        effects: [{ type: 'remove_active_buff', buffName: 'Swift Step' }],
        campaignName,
        rounds: undefined,
        expireOnCreatureName: ps.name,
      });
      // FT-105: the grant is logged with the +10 ft event details.
      expect(logService.addEntry).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({
          type: 'ability_use',
          characterName: ps.name,
          abilityName: 'Swift Step',
          description: expect.stringContaining('+10 ft Speed'),
        }),
      );
    });

    // Generic-lane fall-through: the exact 'activated on yourself (10 min)'
    // copy is pinned in buffHandler.advanced-effects.test.js — these only
    // prove the dash shortcut does NOT capture these shapes.
    it.each([
      ['zero bonus', { effect: 'speed_bonus', bonus: '0 ft' }],
      ['non-speed effect', { effect: 'some_other_effect', bonus: '20 ft' }],
    ])('falls through to the normal buff flow with %s', async (_label, automation) => {
      const ps = makePlayerStats();
      const action = {
        name: 'Dash Fallthrough',
        automation: { type: 'buff', trigger: 'dash_action', ...automation },
      };
      buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

      const result = await handle(action, ps, campaignName, null);

      expect(buffToggle.toggleBuff).toHaveBeenCalled();
      expect(result.payload.description).toContain('activated on yourself');
    });

    it('replaces any existing stamp with ONE upgraded speed_boost entry', async () => {
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
      const legacyBuff = { name: 'Swift Step', tempBuff: true, speedBonus: 10, duration: 'same_action' };
      const stampedBuff = { name: 'Swift Step', effect: 'speed_boost', speedBonus: 10, duration: 'same_action' };
      runtimeState.getRuntimeValue.mockReturnValue([legacyBuff, stampedBuff, { name: 'Other Buff' }]);

      const result = await handle(action, ps, campaignName, null);

      // FT-105 (§216 pin inversion): re-click replaces the stale stamp with
      // ONE upgraded speed_boost entry — never a second duplicate.
      expect(runtimeState.setRuntimeValue).toHaveBeenCalledTimes(1);
      const written = runtimeState.setRuntimeValue.mock.calls.find(c => c[1] === 'activeBuffs')[2];
      expect(written.filter(b => b.name === 'Swift Step')).toHaveLength(1);
      expect(written).toEqual(expect.arrayContaining([
        expect.objectContaining({ name: 'Swift Step', effect: 'speed_boost', speedBonus: 10 }),
        { name: 'Other Buff' },
      ]));
      expect(written.some(b => b.tempBuff)).toBe(false);
      expect(result.payload.description).toBe('Swift Step: +10 ft Speed for this Dash action.');
    });
  });

  describe('Required level guard', () => {
    // The level < requiredLevel refusal branch (same checkBuffGates lines)
    // is pinned by buffHandler.draconic-flight.test.js — this pins the
    // inclusive boundary: level === requiredLevel activates.
    it('allows activation at exactly requiredLevel', async () => {
      const ps = makePlayerStats({ level: 5 });
      const action = makeAction({ requiredLevel: 5 });
      buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

      const result = await handle(action, ps, campaignName, null);

      expect(buffToggle.toggleBuff).toHaveBeenCalled();
      expect(result.payload.description).toContain('activated on yourself');
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
