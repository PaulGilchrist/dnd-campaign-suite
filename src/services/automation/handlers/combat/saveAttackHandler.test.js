// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks BEFORE imports ───────────────────────────────────────

vi.mock('../../../dice/diceRoller.js', () => ({
  rollExpression: vi.fn(),
}));

vi.mock('../../common/savePrompt.js', () => ({
  buildSaveDc: vi.fn(),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../maps/mapsService.js', () => ({
  loadMapData: vi.fn(),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
}));

vi.mock('../../../rules/combat/rangeValidation.js', () => ({
  rangeToFeet: vi.fn(),
}));

vi.mock('../../../rules/effects/expirations.js', () => ({
  addExpiration: vi.fn(),
}));

vi.mock('../../../combat/automation/automationExpressions.js', () => ({
  resolveUses: vi.fn(),
}));

// ── Imports ────────────────────────────────────────────────────

import { handle, isExhausted } from './saveAttackHandler.js';
import * as diceRoller from '../../../dice/diceRoller.js';
import * as savePrompt from '../../common/savePrompt.js';
import * as runtimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as mapsService from '../../../maps/mapsService.js';
import * as damageUtils from '../../../rules/combat/damageUtils.js';
import * as rangeValidation from '../../../rules/combat/rangeValidation.js';
import * as expirations from '../../../rules/effects/expirations.js';
import * as automationExpressions from '../../../combat/automation/automationExpressions.js';

// ── Helpers ────────────────────────────────────────────────────

const campaignName = 'TestCampaign';

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestCaster',
    level: 5,
    ...overrides,
  };
}

function makeAction(automation = {}) {
  return {
    name: 'Breath Weapon',
    automation: {
      type: 'save_attack',
      ...automation,
    },
  };
}

// ── Tests ──────────────────────────────────────────────────────

describe('saveAttackHandler', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    savePrompt.buildSaveDc.mockReturnValue(13);
    rangeValidation.rangeToFeet.mockReturnValue(30);
    damageUtils.getCombatContext.mockResolvedValue({});
    runtimeState.getRuntimeValue.mockReturnValue(null);
    automationExpressions.resolveUses.mockReturnValue(undefined);
  });

  describe('isExhausted', () => {
    it('should return false when action has no automation', () => {
      const result = isExhausted({ name: 'Test' }, makePlayerStats(), campaignName);
      expect(result).toBe(false);
    });

    it('should return false when automation exists but has no resource constraints', () => {
      const action = makeAction({ damage: '1d6' });
      const result = isExhausted(action, makePlayerStats(), campaignName);
      expect(result).toBe(false);
    });

    describe('channel divinity resource cost', () => {
      it('should return true when charges are depleted to 0', () => {
        runtimeState.getRuntimeValue.mockReturnValue(0);
        const ps = makePlayerStats({
          class: { class_levels: [{ level: 5, channel_divinity: 2 }] },
        });
        const action = makeAction({ resourceCost: 'channel_divinity' });

        expect(isExhausted(action, ps, campaignName)).toBe(true);
      });

      it('should return true when charges are negative', () => {
        runtimeState.getRuntimeValue.mockReturnValue(-1);
        const ps = makePlayerStats({
          class: { class_levels: [{ level: 5, channel_divinity: 2 }] },
        });
        const action = makeAction({ resourceCost: 'channel_divinity' });

        expect(isExhausted(action, ps, campaignName)).toBe(true);
      });

      it('should return false when charges are available', () => {
        runtimeState.getRuntimeValue.mockReturnValue(1);
        const ps = makePlayerStats({
          class: { class_levels: [{ level: 5, channel_divinity: 2 }] },
        });
        const action = makeAction({ resourceCost: 'channel_divinity' });

        expect(isExhausted(action, ps, campaignName)).toBe(false);
      });

      it('should default to max charges when no runtime value is set', () => {
        runtimeState.getRuntimeValue.mockReturnValue(null);
        const ps = makePlayerStats({
          class: { class_levels: [{ level: 5, channel_divinity: 2 }] },
        });
        const action = makeAction({ resourceCost: 'channel_divinity' });

        expect(isExhausted(action, ps, campaignName)).toBe(false);
      });

      it('should use class_specific channel_divinity_charges fallback', () => {
        runtimeState.getRuntimeValue.mockReturnValue(null);
        const ps = makePlayerStats({
          class: { class_levels: [{ level: 5, class_specific: { channel_divinity_charges: 3 } }] },
        });
        const action = makeAction({ resourceCost: 'channel_divinity' });

        expect(isExhausted(action, ps, campaignName)).toBe(false);
      });

      it('should default to 2 charges when no class data exists', () => {
        runtimeState.getRuntimeValue.mockReturnValue(null);
        const ps = makePlayerStats({ class: {} });
        const action = makeAction({ resourceCost: 'channel_divinity' });

        expect(isExhausted(action, ps, campaignName)).toBe(false);
      });
    });

    describe('wild shape resource cost', () => {
      it('should return true when uses are depleted', () => {
        runtimeState.getRuntimeValue.mockReturnValue(0);
        const ps = makePlayerStats({
          class: { class_levels: [{ level: 5, wild_shape: 2 }] },
        });
        const action = makeAction({ resourceCost: 'wild_shape' });

        expect(isExhausted(action, ps, campaignName)).toBe(true);
      });

      it('should return true when uses are negative', () => {
        runtimeState.getRuntimeValue.mockReturnValue(-1);
        const ps = makePlayerStats({
          class: { class_levels: [{ level: 5, wild_shape: 2 }] },
        });
        const action = makeAction({ resourceCost: 'wild_shape' });

        expect(isExhausted(action, ps, campaignName)).toBe(true);
      });

      it('should return false when uses are available', () => {
        runtimeState.getRuntimeValue.mockReturnValue(2);
        const ps = makePlayerStats({
          class: { class_levels: [{ level: 5, wild_shape: 2 }] },
        });
        const action = makeAction({ resourceCost: 'wild_shape' });

        expect(isExhausted(action, ps, campaignName)).toBe(false);
      });

      it('should default to max wild_shape when no runtime value is set', () => {
        runtimeState.getRuntimeValue.mockReturnValue(null);
        const ps = makePlayerStats({
          class: { class_levels: [{ level: 5, wild_shape: 2 }] },
        });
        const action = makeAction({ resourceCost: 'wild_shape' });

        expect(isExhausted(action, ps, campaignName)).toBe(false);
      });

      it('should return true when wild_shape max is 0', () => {
        runtimeState.getRuntimeValue.mockReturnValue(null);
        const ps = makePlayerStats({
          class: { class_levels: [{ level: 5, wild_shape: 0 }] },
        });
        const action = makeAction({ resourceCost: 'wild_shape' });

        expect(isExhausted(action, ps, campaignName)).toBe(true);
      });
    });

    describe('uses / usesMax resource cost', () => {
      it('should return true when current uses are 0', () => {
        runtimeState.getRuntimeValue.mockReturnValue(0);
        const action = makeAction({ usesMax: 1 });

        expect(isExhausted(action, makePlayerStats(), campaignName)).toBe(true);
      });

      it('should return false when uses are available', () => {
        runtimeState.getRuntimeValue.mockReturnValue(1);
        const action = makeAction({ usesMax: 1 });

        expect(isExhausted(action, makePlayerStats(), campaignName)).toBe(false);
      });

      it('should use resolveUses fallback when usesMax is undefined', () => {
        automationExpressions.resolveUses.mockReturnValue(3);
        runtimeState.getRuntimeValue.mockReturnValue(2);
        const action = makeAction({ uses: '1_per_long_rest' });

        expect(isExhausted(action, makePlayerStats(), campaignName)).toBe(false);
      });

      it('should return false when both uses and usesMax are undefined', () => {
        const action = makeAction({});

        expect(isExhausted(action, makePlayerStats(), campaignName)).toBe(false);
      });

      it('should use custom resourceKey for the uses key', () => {
        runtimeState.getRuntimeValue.mockReturnValue(0);
        const action = makeAction({ usesMax: 1, resourceKey: 'specialAbilityUses' });

        isExhausted(action, makePlayerStats(), campaignName);

        expect(runtimeState.getRuntimeValue).toHaveBeenCalledWith(
          'TestCaster',
          'specialAbilityUses',
          campaignName,
        );
      });

      it('should generate uses key from action name when no resourceKey', () => {
        runtimeState.getRuntimeValue.mockReturnValue(0);
        const action = { name: 'Fire Breath', automation: { usesMax: 1 } };

        isExhausted(action, makePlayerStats(), campaignName);

        expect(runtimeState.getRuntimeValue).toHaveBeenCalledWith(
          'TestCaster',
          'firebreathUses',
          campaignName,
        );
      });
    });
  });

  describe('handle - variable damage type', () => {
    it('should resolve variable damage type from subrace damage_resistance', async () => {
      diceRoller.rollExpression.mockReturnValue({ total: 10, rolls: [5, 5], modifier: 0 });
      runtimeState.getRuntimeValue.mockReturnValue(null);

      const ps = makePlayerStats({
        race: { subrace: { damage_resistance: 'fire' } },
      });
      const action = makeAction({ damageType: 'variable', damage: '2d6' });

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('roll');
      expect(result.payload.contextConfig.damageType).toBe('fire');
    });

    it('should keep explicit damageType when not variable', async () => {
      diceRoller.rollExpression.mockReturnValue({ total: 8, rolls: [8], modifier: 0 });
      runtimeState.getRuntimeValue.mockReturnValue(null);

      const ps = makePlayerStats({
        race: { subrace: { damage_resistance: 'fire' } },
      });
      const action = makeAction({ damageType: 'lightning', damage: '2d6' });

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.contextConfig.damageType).toBe('lightning');
    });

    it('should keep variable damageType when no subrace damage_resistance', async () => {
      diceRoller.rollExpression.mockReturnValue({ total: 6, rolls: [6], modifier: 0 });
      runtimeState.getRuntimeValue.mockReturnValueOnce(null);

      const ps = makePlayerStats();
      const action = makeAction({ damageType: 'variable', damage: '1d6' });

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.contextConfig.damageType).toBe('variable');
    });
  });

  describe('handle - variable shape resolution', () => {
    it('should return breathWeaponShape modal when shape is variable with options and no choice made', async () => {
      runtimeState.getRuntimeValue.mockReturnValue(null);

      const action = makeAction({
        shape: 'variable',
        hasOptions: true,
        optionDetails: {
          cone: { shape: 'cone' },
          line: { shape: 'line' },
        },
      });

      const result = await handle(action, makePlayerStats(), campaignName, null);

      expect(result.type).toBe('modal');
      expect(result.modalName).toBe('breathWeaponShape');
      expect(result.payload.options).toEqual(['cone', 'line']);
    });

    it('should resolve shape to cone fallback when variable but no optionDetails', async () => {
      diceRoller.rollExpression.mockReturnValue({ total: 10, rolls: [10], modifier: 0 });
      runtimeState.getRuntimeValue.mockReturnValue(null);

      const action = makeAction({ shape: 'variable', damage: '1d8' });

      const result = await handle(action, makePlayerStats(), campaignName, null);

      expect(result.payload.contextConfig.shape).toBe('cone');
    });

    it('should resolve shape from optionDetails when option has been chosen', async () => {
      diceRoller.rollExpression.mockReturnValue({ total: 10, rolls: [10], modifier: 0 });
      runtimeState.getRuntimeValue.mockReturnValueOnce('line'); // optionKey
      runtimeState.getRuntimeValue.mockReturnValue(null); // uses key

      const action = makeAction({
        shape: 'variable',
        hasOptions: true,
        optionDetails: {
          cone: { shape: 'cone' },
          line: { shape: 'line' },
        },
        damage: '1d8',
      });

      const result = await handle(action, makePlayerStats(), campaignName, null);

      expect(result.payload.contextConfig.shape).toBe('line');
    });
  });

  describe('handle - hasOptions option resolution', () => {
    it('should merge optionDetails into automation when option is chosen', async () => {
      diceRoller.rollExpression.mockReturnValue({ total: 10, rolls: [10], modifier: 0 });
      runtimeState.getRuntimeValue.mockReturnValueOnce('cone_option');
      runtimeState.getRuntimeValue.mockReturnValue(null);

      const action = makeAction({
        hasOptions: true,
        optionDetails: {
          cone_option: { shape: 'cone', damage: '4d6' },
        },
      });

      const result = await handle(action, makePlayerStats(), campaignName, null);

      expect(result.type).toBe('roll');
      expect(result.payload.formula).toBe('4d6');
    });
  });

  describe('handle - channel divinity cost', () => {
    it('should return popup when channel divinity charges are depleted', async () => {
      runtimeState.getRuntimeValue.mockReturnValueOnce(0);

      const ps = makePlayerStats({
        class: { class_levels: [{ level: 5, channel_divinity: 2 }] },
      });
      const action = makeAction({ resourceCost: 'channel_divinity' });

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.name).toBe('Breath Weapon');
      expect(result.payload.description).toBe('No Channel Divinity charges remaining.');
      expect(result.payload.automation).toEqual(action.automation);
    });

    it('should decrement channel divinity charges on use', async () => {
      runtimeState.getRuntimeValue.mockReturnValueOnce(2);

      const ps = makePlayerStats({
        class: { class_levels: [{ level: 5, channel_divinity: 2 }] },
      });
      const action = makeAction({ resourceCost: 'channel_divinity' });

      await handle(action, ps, campaignName, null);

      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        'TestCaster',
        'channelDivinityCharges',
        1,
        campaignName,
      );
    });

    it('should decrement to 0 when single charge remains', async () => {
      runtimeState.getRuntimeValue.mockReturnValueOnce(1);

      const ps = makePlayerStats({
        class: { class_levels: [{ level: 5, channel_divinity: 2 }] },
      });
      const action = makeAction({ resourceCost: 'channel_divinity' });

      await handle(action, ps, campaignName, null);

      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        'TestCaster',
        'channelDivinityCharges',
        0,
        campaignName,
      );
    });
  });

  describe('handle - wild shape cost', () => {
    it('should return popup when wild shape uses are insufficient', async () => {
      runtimeState.getRuntimeValue.mockReturnValueOnce(0);

      const ps = makePlayerStats({
        class: { class_levels: [{ level: 5, wild_shape: 1 }] },
      });
      const action = makeAction({ resourceCost: 'wild_shape' });

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toBe(
        'Breath Weapon: Not enough Wild Shape uses remaining. 1 use required.',
      );
    });

    it('should return popup with plural when doubleEmanation requires 2 uses', async () => {
      runtimeState.getRuntimeValue.mockReturnValueOnce(1);

      const ps = makePlayerStats({
        class: { class_levels: [{ level: 5, wild_shape: 2 }] },
      });
      const action = makeAction({ resourceCost: 'wild_shape', doubleEmanation: true });

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toBe(
        'Breath Weapon: Not enough Wild Shape uses remaining. 2 uses required.',
      );
    });

    it('should decrement wild shape uses on use', async () => {
      runtimeState.getRuntimeValue.mockReturnValueOnce(2);
      diceRoller.rollExpression.mockReturnValue({ total: 5, rolls: [5], modifier: 0 });

      const ps = makePlayerStats({
        class: { class_levels: [{ level: 5, wild_shape: 2 }] },
      });
      const action = makeAction({ resourceCost: 'wild_shape' });

      await handle(action, ps, campaignName, null);

      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        'TestCaster',
        'wildShapeUses',
        1,
        campaignName,
      );
    });

    it('should decrement by 2 when doubleEmanation is set', async () => {
      runtimeState.getRuntimeValue.mockReturnValueOnce(3);
      diceRoller.rollExpression.mockReturnValue({ total: 5, rolls: [5], modifier: 0 });

      const ps = makePlayerStats({
        class: { class_levels: [{ level: 5, wild_shape: 3 }] },
      });
      const action = makeAction({ resourceCost: 'wild_shape', doubleEmanation: true });

      await handle(action, ps, campaignName, null);

      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        'TestCaster',
        'wildShapeUses',
        1,
        campaignName,
      );
    });

    it('should set expiration for area effects with 1 minute duration', async () => {
      runtimeState.getRuntimeValue.mockReturnValueOnce(2);
      diceRoller.rollExpression.mockReturnValue({ total: 5, rolls: [5], modifier: 0 });

      const ps = makePlayerStats({
        class: { class_levels: [{ level: 5, wild_shape: 2 }] },
      });
      const action = makeAction({
        resourceCost: 'wild_shape',
        shape: 'cone',
        duration: '1_minute_rounds',
      });

      await handle(action, ps, campaignName, null);

      expect(expirations.addExpiration).toHaveBeenCalledWith(
        'TestCaster',
        'TestCaster',
        [{ type: 'remove_active_buff', buffName: 'Breath Weapon' }],
        campaignName,
        10,
      );
    });

    it('should set expiration with correct rounds for N_round duration', async () => {
      runtimeState.getRuntimeValue.mockReturnValueOnce(2);
      diceRoller.rollExpression.mockReturnValue({ total: 5, rolls: [5], modifier: 0 });

      const ps = makePlayerStats({
        class: { class_levels: [{ level: 5, wild_shape: 2 }] },
      });
      const action = makeAction({
        resourceCost: 'wild_shape',
        shape: 'cone',
        duration: '3_rounds',
      });

      await handle(action, ps, campaignName, null);

      expect(expirations.addExpiration).toHaveBeenCalledWith(
        'TestCaster',
        'TestCaster',
        [{ type: 'remove_active_buff', buffName: 'Breath Weapon' }],
        campaignName,
        3,
      );
    });

    it('should not set expiration for non-area shape', async () => {
      runtimeState.getRuntimeValue.mockReturnValueOnce(2);
      diceRoller.rollExpression.mockReturnValue({ total: 5, rolls: [5], modifier: 0 });

      const ps = makePlayerStats({
        class: { class_levels: [{ level: 5, wild_shape: 2 }] },
      });
      const action = makeAction({
        resourceCost: 'wild_shape',
        shape: 'single_target',
        duration: '1_minute_rounds',
      });

      await handle(action, ps, campaignName, null);

      expect(expirations.addExpiration).not.toHaveBeenCalled();
    });

    it('should not set expiration when duration cannot be parsed', async () => {
      runtimeState.getRuntimeValue.mockReturnValueOnce(2);
      diceRoller.rollExpression.mockReturnValue({ total: 5, rolls: [5], modifier: 0 });

      const ps = makePlayerStats({
        class: { class_levels: [{ level: 5, wild_shape: 2 }] },
      });
      const action = makeAction({
        resourceCost: 'wild_shape',
        shape: 'cone',
        duration: 'invalid',
      });

      await handle(action, ps, campaignName, null);

      expect(expirations.addExpiration).not.toHaveBeenCalled();
    });
  });

  describe('handle - uses cost', () => {
    it('should return popup when uses are 0', async () => {
      runtimeState.getRuntimeValue.mockReturnValueOnce(0);
      diceRoller.rollExpression.mockReturnValue({ total: 5, rolls: [5], modifier: 0 });

      const action = makeAction({ usesMax: 1 });

      const result = await handle(action, makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toBe(
        'Breath Weapon has been used and cannot be used again until a long rest.',
      );
    });

    it('should include recharge message when recharge flag is set', async () => {
      runtimeState.getRuntimeValue.mockReturnValueOnce(0);
      diceRoller.rollExpression.mockReturnValue({ total: 5, rolls: [5], modifier: 0 });

      const action = makeAction({ usesMax: 1, recharge: 'long_rest_or_expend_rage' });

      const result = await handle(action, makePlayerStats(), campaignName, null);

      expect(result.payload.description).toBe(
        'Breath Weapon has been used and cannot be used again until a long rest. You may expend one use of Rage to restore it.',
      );
    });

    it('should decrement uses on successful use', async () => {
      runtimeState.getRuntimeValue.mockReturnValueOnce(1);
      diceRoller.rollExpression.mockReturnValue({ total: 5, rolls: [5], modifier: 0 });

      const action = makeAction({ usesMax: 1 });

      await handle(action, makePlayerStats(), campaignName, null);

      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        'TestCaster',
        'breathweaponUses',
        0,
        campaignName,
      );
    });

    it('should proceed to damage roll when maxUses is 0', async () => {
      runtimeState.getRuntimeValue.mockReturnValueOnce(0);
      diceRoller.rollExpression.mockReturnValue({ total: 5, rolls: [5], modifier: 0 });

      const action = makeAction({ usesMax: 0, damage: '1d6' });

      const result = await handle(action, makePlayerStats(), campaignName, null);

      expect(result.type).toBe('roll');
      expect(result.payload.total).toBe(5);
      expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
    });
  });

  describe('handle - area + healing', () => {
    it('should return saveAttackHeal modal when healExpression and area shape present', async () => {
      diceRoller.rollExpression.mockReturnValue({ total: 5, rolls: [5], modifier: 0 });
      runtimeState.getRuntimeValue.mockReturnValue(null);
      mapsService.loadMapData.mockResolvedValue(null);

      const action = makeAction({
        shape: 'cone',
        healExpression: '2d4',
        damage: '1d6',
      });

      const result = await handle(action, makePlayerStats(), campaignName, 'test-map');

      expect(result.type).toBe('modal');
      expect(result.modalName).toBe('saveAttackHeal');
      expect(result.payload.saveType).toBe('CON');
      expect(result.payload.featureName).toBe('Breath Weapon');
      expect(result.payload.saveDc).toBe(13);
      expect(result.payload.damageExpression).toBe('1d6');
      expect(result.payload.healExpression).toBe('2d4');
      expect(result.payload.rangeFeet).toBe(30);
    });

    it('should use custom saveType when provided', async () => {
      diceRoller.rollExpression.mockReturnValue({ total: 5, rolls: [5], modifier: 0 });
      runtimeState.getRuntimeValue.mockReturnValueOnce(null);

      const action = makeAction({
        shape: 'cone',
        healExpression: '2d4',
        saveType: 'WIS',
      });

      const result = await handle(action, makePlayerStats(), campaignName, null);

      expect(result.payload.saveType).toBe('WIS');
    });

    it('should not return modal for healing without area shape', async () => {
      diceRoller.rollExpression.mockReturnValue({ total: 5, rolls: [5], modifier: 0 });
      runtimeState.getRuntimeValue.mockReturnValueOnce(null);

      const action = makeAction({
        healExpression: '2d4',
        damage: '1d6',
      });

      const result = await handle(action, makePlayerStats(), campaignName, null);

      expect(result.type).toBe('roll');
      expect(result.modalName).toBeUndefined();
    });

    it('should include attacker position when map data is available', async () => {
      diceRoller.rollExpression.mockReturnValue({ total: 5, rolls: [5], modifier: 0 });
      runtimeState.getRuntimeValue.mockReturnValueOnce(null);

      mapsService.loadMapData.mockResolvedValue({
        players: [{ name: 'TestCaster', gridX: 5, gridY: 10 }],
      });

      const action = makeAction({
        shape: 'cone',
        healExpression: '2d4',
      });

      const result = await handle(action, makePlayerStats(), campaignName, 'test-map');

      expect(result.payload.attackerPos).toEqual({ gridX: 5, gridY: 10 });
    });

    it('should handle missing map data gracefully', async () => {
      diceRoller.rollExpression.mockReturnValue({ total: 5, rolls: [5], modifier: 0 });
      runtimeState.getRuntimeValue.mockReturnValueOnce(null);

      mapsService.loadMapData.mockResolvedValue(null);

      const action = makeAction({
        shape: 'cone',
        healExpression: '2d4',
      });

      const result = await handle(action, makePlayerStats(), campaignName, 'test-map');

      expect(result.payload.attackerPos).toBeNull();
    });

    it('should handle map data load error gracefully', async () => {
      diceRoller.rollExpression.mockReturnValue({ total: 5, rolls: [5], modifier: 0 });
      runtimeState.getRuntimeValue.mockReturnValueOnce(null);

      mapsService.loadMapData.mockRejectedValue(new Error('not found'));

      const action = makeAction({
        shape: 'cone',
        healExpression: '2d4',
      });

      const result = await handle(action, makePlayerStats(), campaignName, 'test-map');

      expect(result.payload.attackerPos).toBeNull();
    });

    it('should handle missing attacker in map data', async () => {
      diceRoller.rollExpression.mockReturnValue({ total: 5, rolls: [5], modifier: 0 });
      runtimeState.getRuntimeValue.mockReturnValueOnce(null);

      mapsService.loadMapData.mockResolvedValue({
        players: [{ name: 'OtherPlayer', gridX: 1, gridY: 2 }],
      });

      const action = makeAction({
        shape: 'cone',
        healExpression: '2d4',
      });

      const result = await handle(action, makePlayerStats(), campaignName, 'test-map');

      expect(result.payload.attackerPos).toBeNull();
    });
  });

  describe('handle - condition inflicted', () => {
    it('should return setCondition modal for condition + area shape', async () => {
      diceRoller.rollExpression.mockReturnValue({ total: 5, rolls: [5], modifier: 0 });
      runtimeState.getRuntimeValue.mockReturnValueOnce(null);

      const action = makeAction({
        shape: 'cone',
        conditionInflicted: 'Poisoned',
      });

      const result = await handle(action, makePlayerStats(), campaignName, 'test-map');

      expect(result.type).toBe('modal');
      expect(result.modalName).toBe('setCondition');
      expect(result.payload.conditionName).toBe('poisoned');
      expect(result.payload.saveType).toBe('WIS');
      expect(result.payload.featureName).toBe('Breath Weapon');
      expect(result.payload.saveDc).toBe(13);
    });

    it('should use custom saveType for condition modal', async () => {
      diceRoller.rollExpression.mockReturnValue({ total: 5, rolls: [5], modifier: 0 });
      runtimeState.getRuntimeValue.mockReturnValueOnce(null);

      const action = makeAction({
        shape: 'cone',
        conditionInflicted: 'Stunned',
        saveType: 'CON',
      });

      const result = await handle(action, makePlayerStats(), campaignName, null);

      expect(result.payload.saveType).toBe('CON');
    });

    it('should return popup for condition without area shape', async () => {
      const action = makeAction({ conditionInflicted: 'Poisoned' });

      const result = await handle(action, makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toBe(
        'Breath Weapon — WIS save DC 13. On a failed save, target has the Poisoned condition.',
      );
    });

    it('should return popup with custom saveType for condition without area shape', async () => {
      const action = makeAction({ conditionInflicted: 'Blinded', saveType: 'INT' });

      const result = await handle(action, makePlayerStats(), campaignName, null);

      expect(result.payload.description).toBe(
        'Breath Weapon — INT save DC 13. On a failed save, target has the Blinded condition.',
      );
    });

    it('should not return modal when conditionInflicted is present with damage', async () => {
      diceRoller.rollExpression.mockReturnValue({ total: 5, rolls: [5], modifier: 0 });
      runtimeState.getRuntimeValue.mockReturnValueOnce(null);

      const action = makeAction({
        shape: 'cone',
        conditionInflicted: 'Poisoned',
        damage: '1d6',
      });

      const result = await handle(action, makePlayerStats(), campaignName, null);

      expect(result.type).toBe('roll');
      expect(result.payload.contextConfig.conditionInflicted).toBe('Poisoned');
    });
  });

  describe('handle - effect only (no damage)', () => {
    it('should return popup for effect without damage', async () => {
      const action = makeAction({ effect: 'speed_reduction', effectValue: '15_ft' });

      const result = await handle(action, makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toBe(
        'Breath Weapon — DEX save DC 13. On a failed save, the target\'s Speed is reduced by 15 ft.',
      );
    });

    it('should use custom saveType for effect popup', async () => {
      const action = makeAction({ effect: 'push', effectValue: '10_ft', saveType: 'STR' });

      const result = await handle(action, makePlayerStats(), campaignName, null);

      expect(result.payload.description).toBe(
        'Breath Weapon — STR save DC 13. On a failed save, the target is pushed 10 ft.',
      );
    });

    it('should use default 10 ft when effectValue is missing for push', async () => {
      const action = makeAction({ effect: 'push' });

      const result = await handle(action, makePlayerStats(), campaignName, null);

      expect(result.payload.description).toBe(
        'Breath Weapon — DEX save DC 13. On a failed save, the target is pushed 10 ft.',
      );
    });

    it('should use default 15 ft when effectValue is missing for speed_reduction', async () => {
      const action = makeAction({ effect: 'speed_reduction' });

      const result = await handle(action, makePlayerStats(), campaignName, null);

      expect(result.payload.description).toBe(
        'Breath Weapon — DEX save DC 13. On a failed save, the target\'s Speed is reduced by 15 ft.',
      );
    });

    it('should return raw effect string for unknown effect types', async () => {
      const action = makeAction({ effect: 'custom_effect' });

      const result = await handle(action, makePlayerStats(), campaignName, null);

      expect(result.payload.description).toBe(
        'Breath Weapon — DEX save DC 13. On a failed save, custom_effect.',
      );
    });
  });

  describe('handle - damage roll', () => {
    it('should return roll payload with correct damage values', async () => {
      diceRoller.rollExpression.mockReturnValue({ total: 12, rolls: [7, 5], modifier: 0 });
      runtimeState.getRuntimeValue.mockReturnValueOnce(null);

      const action = makeAction({ damage: '2d6' });

      const result = await handle(action, makePlayerStats(), campaignName, null);

      expect(result.type).toBe('roll');
      expect(result.payload.rollType).toBe('damage');
      expect(result.payload.name).toBe('Breath Weapon');
      expect(result.payload.total).toBe(12);
      expect(result.payload.formula).toBe('2d6');
      expect(result.payload.rolls).toEqual([7, 5]);
      expect(result.payload.modifier).toBe(0);
    });

    it('should include rider description in notes for push effect', async () => {
      diceRoller.rollExpression.mockReturnValue({ total: 10, rolls: [10], modifier: 0 });
      runtimeState.getRuntimeValue.mockReturnValueOnce(null);

      const action = makeAction({ damage: '1d8', effect: 'push', effectValue: '10_ft' });

      const result = await handle(action, makePlayerStats(), campaignName, null);

      expect(result.payload.notes).toBe(
        'the target is pushed 10 ft',
      );
    });

    it('should include darkness dispelled note for area shapes', async () => {
      diceRoller.rollExpression.mockReturnValue({ total: 10, rolls: [10], modifier: 0 });
      runtimeState.getRuntimeValue.mockReturnValueOnce(null);

      const action = makeAction({ damage: '1d8', shape: 'cone' });

      const result = await handle(action, makePlayerStats(), campaignName, null);

      expect(result.payload.notes).toBe(
        'Magical Darkness in the area is dispelled.',
      );
    });

    it('should include both darkness dispelled and rider notes for area with effect', async () => {
      diceRoller.rollExpression.mockReturnValue({ total: 10, rolls: [10], modifier: 0 });
      runtimeState.getRuntimeValue.mockReturnValueOnce(null);

      const action = makeAction({ damage: '1d8', shape: 'cone', effect: 'push', effectValue: '5_ft' });

      const result = await handle(action, makePlayerStats(), campaignName, null);

      expect(result.payload.notes).toBe(
        'Magical Darkness in the area is dispelled. the target is pushed 5 ft',
      );
    });

    it('should return null when rollExpression returns null', async () => {
      diceRoller.rollExpression.mockReturnValue(null);
      runtimeState.getRuntimeValue.mockReturnValueOnce(null);

      const action = makeAction({ damage: '2d6' });

      const result = await handle(action, makePlayerStats(), campaignName, null);

      expect(result).toBeNull();
    });

    it('should set contextConfig with correct defaults', async () => {
      diceRoller.rollExpression.mockReturnValue({ total: 10, rolls: [10], modifier: 0 });
      runtimeState.getRuntimeValue.mockReturnValueOnce(null);

      const action = makeAction({ damage: '1d8' });

      const result = await handle(action, makePlayerStats(), campaignName, null);

      expect(result.payload.contextConfig).toEqual({
        damageType: '',
        saveDc: 13,
        saveType: 'DEX',
        dcSuccess: 'none',
        attackerName: 'TestCaster',
        conditionInflicted: null,
        shape: '',
      });
    });

    it('should set dcSuccess to half for cone shape', async () => {
      diceRoller.rollExpression.mockReturnValue({ total: 10, rolls: [10], modifier: 0 });
      runtimeState.getRuntimeValue.mockReturnValueOnce(null);

      const action = makeAction({ damage: '1d8', shape: 'cone' });

      const result = await handle(action, makePlayerStats(), campaignName, null);

      expect(result.payload.contextConfig.dcSuccess).toBe('half');
    });

    it('should set dcSuccess to none for non-cone shapes', async () => {
      diceRoller.rollExpression.mockReturnValue({ total: 10, rolls: [10], modifier: 0 });
      runtimeState.getRuntimeValue.mockReturnValueOnce(null);

      const action = makeAction({ damage: '1d8', shape: 'line' });

      const result = await handle(action, makePlayerStats(), campaignName, null);

      expect(result.payload.contextConfig.dcSuccess).toBe('none');
    });

    it('should respect explicit dcSuccess value', async () => {
      diceRoller.rollExpression.mockReturnValue({ total: 10, rolls: [10], modifier: 0 });
      runtimeState.getRuntimeValue.mockReturnValueOnce(null);

      const action = makeAction({ damage: '1d8', dcSuccess: 1 });

      const result = await handle(action, makePlayerStats(), campaignName, null);

      expect(result.payload.contextConfig.dcSuccess).toBe(1);
    });

    it('should include custom saveType in contextConfig', async () => {
      diceRoller.rollExpression.mockReturnValue({ total: 10, rolls: [10], modifier: 0 });
      runtimeState.getRuntimeValue.mockReturnValueOnce(null);

      const action = makeAction({ damage: '1d8', saveType: 'CON' });

      const result = await handle(action, makePlayerStats(), campaignName, null);

      expect(result.payload.contextConfig.saveType).toBe('CON');
    });
  });

  describe('handle - pushEffect normalization', () => {
    it('should set effect from pushEffect when effect is missing', async () => {
      diceRoller.rollExpression.mockReturnValue({ total: 10, rolls: [10], modifier: 0 });
      runtimeState.getRuntimeValue.mockReturnValueOnce(null);

      const action = makeAction({ damage: '1d8', pushEffect: 'push', effectValue: '10_ft' });

      const result = await handle(action, makePlayerStats(), campaignName, null);

      expect(result.payload.notes).toBe('the target is pushed 10 ft');
    });

    it('should not override existing effect with pushEffect', async () => {
      diceRoller.rollExpression.mockReturnValue({ total: 10, rolls: [10], modifier: 0 });
      runtimeState.getRuntimeValue.mockReturnValueOnce(null);

      const action = makeAction({ damage: '1d8', pushEffect: 'push', effect: 'speed_reduction', effectValue: '20_ft' });

      const result = await handle(action, makePlayerStats(), campaignName, null);

      expect(result.payload.notes).toBe("the target's Speed is reduced by 20 ft");
    });
  });
});
