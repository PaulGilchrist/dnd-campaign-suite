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
import * as runtimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as damageUtils from '../../../rules/combat/damageUtils.js';
import * as rangeValidation from '../../../rules/combat/rangeValidation.js';
import * as expirations from '../../../rules/effects/expirations.js';

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
    vi.clearAllMocks();
    rangeValidation.rangeToFeet.mockReturnValue(30);
  });

  describe('isExhausted', () => {
    it('should return false when auto is missing', () => {
      const result = isExhausted({ name: 'Test' }, makePlayerStats(), campaignName);
      expect(result).toBe(false);
    });

    it('should return true when channel divinity charges are 0', () => {
      runtimeState.getRuntimeValue.mockReturnValue(0);
      const ps = makePlayerStats({
        class: { class_levels: [{ level: 5, channel_divinity: 2 }] },
      });
      const action = makeAction({ resourceCost: 'channel_divinity' });

      const result = isExhausted(action, ps, campaignName);

      expect(result).toBe(true);
    });

    it('should return false when channel divinity charges available', () => {
      runtimeState.getRuntimeValue.mockReturnValue(1);
      const ps = makePlayerStats({
        class: { class_levels: [{ level: 5, channel_divinity: 2 }] },
      });
      const action = makeAction({ resourceCost: 'channel_divinity' });

      const result = isExhausted(action, ps, campaignName);

      expect(result).toBe(false);
    });

    it('should return true when wild shape uses are 0', () => {
      runtimeState.getRuntimeValue.mockReturnValue(0);
      const ps = makePlayerStats({
        class: { class_levels: [{ level: 5, wild_shape: 2 }] },
      });
      const action = makeAction({ resourceCost: 'wild_shape' });

      const result = isExhausted(action, ps, campaignName);

      expect(result).toBe(true);
    });

    it('should return true when uses are 0', () => {
      runtimeState.getRuntimeValue.mockReturnValue(0);
      const ps = makePlayerStats();
      const action = makeAction({ usesMax: 1 });

      const result = isExhausted(action, ps, campaignName);

      expect(result).toBe(true);
    });

    it('should return false when uses are available', () => {
      runtimeState.getRuntimeValue.mockReturnValue(1);
      const ps = makePlayerStats();
      const action = makeAction({ usesMax: 1 });

      const result = isExhausted(action, ps, campaignName);

      expect(result).toBe(false);
    });
  });



  describe('handle - variable damage type', () => {
    it('should resolve variable damage type from subrace', async () => {
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
  });

  describe('handle - channel divinity cost', () => {
    it('should return no charges popup when channel divinity depleted', async () => {
      runtimeState.getRuntimeValue.mockReturnValueOnce(0);

      const ps = makePlayerStats({
        class: { class_levels: [{ level: 5, channel_divinity: 2 }] },
      });
      const action = makeAction({ resourceCost: 'channel_divinity' });

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toBe('No Channel Divinity charges remaining.');
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
  });

  describe('handle - wild shape cost', () => {
    it('should return popup when wild shape uses insufficient', async () => {
      runtimeState.getRuntimeValue.mockReturnValueOnce(0);

      const ps = makePlayerStats({
        class: { class_levels: [{ level: 5, wild_shape: 1 }] },
      });
      const action = makeAction({ resourceCost: 'wild_shape' });

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('Not enough Wild Shape uses');
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

    it('should set expiration for area effects with duration', async () => {
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
  });

  describe('handle - uses cost', () => {
    it('should return popup when uses are 0', async () => {
      runtimeState.getRuntimeValue.mockReturnValueOnce(0);
      diceRoller.rollExpression.mockReturnValue({ total: 5, rolls: [5], modifier: 0 });

      const action = makeAction({ usesMax: 1 });

      const result = await handle(action, makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('cannot be used again until a long rest');
    });

    it('should decrement uses on use', async () => {
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
  });

  describe('handle - area + healing', () => {
    it('should return saveAttackHeal modal when healExpression and area shape', async () => {
      diceRoller.rollExpression.mockReturnValue({ total: 5, rolls: [5], modifier: 0 });
      runtimeState.getRuntimeValue.mockReturnValueOnce(null);
      damageUtils.getCombatContext.mockResolvedValue({});

      const action = makeAction({
        shape: 'cone',
        healExpression: '2d4',
        damage: '1d6',
      });

      const result = await handle(action, makePlayerStats(), campaignName, 'test-map');

      expect(result.type).toBe('modal');
      expect(result.modalName).toBe('saveAttackHeal');
      expect(result.payload.saveType).toBe('CON');
    });
  });

  describe('handle - condition inflicted', () => {
    it('should return setCondition modal for condition + area shape', async () => {
      diceRoller.rollExpression.mockReturnValue({ total: 5, rolls: [5], modifier: 0 });
      runtimeState.getRuntimeValue.mockReturnValueOnce(null);
      damageUtils.getCombatContext.mockResolvedValue({});

      const action = makeAction({
        shape: 'cone',
        conditionInflicted: 'Poisoned',
      });

      const result = await handle(action, makePlayerStats(), campaignName, 'test-map');

      expect(result.type).toBe('modal');
      expect(result.modalName).toBe('setCondition');
      expect(result.payload.conditionName).toBe('poisoned');
      expect(result.payload.saveType).toBe('WIS');
    });

    it('should return popup for condition without area shape', async () => {
      const action = makeAction({ conditionInflicted: 'Poisoned' });

      const result = await handle(action, makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('WIS save DC');
    });
  });

  describe('handle - effect only', () => {
    it('should return popup for effect without damage', async () => {
      const action = makeAction({ effect: 'speed_reduction', effectValue: '15_ft' });

      const result = await handle(action, makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain("the target's Speed is reduced");
    });
  });

  describe('handle - damage roll', () => {
    it('should return roll payload with damage result', async () => {
      diceRoller.rollExpression.mockReturnValue({ total: 12, rolls: [7, 5], modifier: 0 });
      runtimeState.getRuntimeValue.mockReturnValueOnce(null);

      const action = makeAction({ damage: '2d6' });

      const result = await handle(action, makePlayerStats(), campaignName, null);

      expect(result.type).toBe('roll');
      expect(result.payload.rollType).toBe('damage');
      expect(result.payload.name).toBe('Breath Weapon');
      expect(result.payload.total).toBe(12);
      expect(result.payload.formula).toBe('2d6');
    });

    it('should include rider description in notes', async () => {
      diceRoller.rollExpression.mockReturnValue({ total: 10, rolls: [10], modifier: 0 });
      runtimeState.getRuntimeValue.mockReturnValueOnce(null);

      const action = makeAction({ damage: '1d8', effect: 'push', effectValue: '10_ft' });

      const result = await handle(action, makePlayerStats(), campaignName, null);

      expect(result.payload.notes).toContain('the target is pushed 10 ft');
    });

    it('should include darkness dispelled note for area shapes', async () => {
      diceRoller.rollExpression.mockReturnValue({ total: 10, rolls: [10], modifier: 0 });
      runtimeState.getRuntimeValue.mockReturnValueOnce(null);

      const action = makeAction({ damage: '1d8', shape: 'cone' });

      const result = await handle(action, makePlayerStats(), campaignName, null);

      expect(result.payload.notes).toContain('Magical Darkness in the area is dispelled');
    });

    it('should return null when rollExpression returns null', async () => {
      diceRoller.rollExpression.mockReturnValue(null);
      runtimeState.getRuntimeValue.mockReturnValueOnce(null);

      const action = makeAction({ damage: '2d6' });

      const result = await handle(action, makePlayerStats(), campaignName, null);

      expect(result).toBeNull();
    });
  });

  describe('pushEffect normalization', () => {
    it('should set effect from pushEffect when effect is missing', async () => {
      diceRoller.rollExpression.mockReturnValue({ total: 10, rolls: [10], modifier: 0 });
      runtimeState.getRuntimeValue.mockReturnValueOnce(null);

      const action = makeAction({ damage: '1d8', pushEffect: 'push' });

      const result = await handle(action, makePlayerStats(), campaignName, null);

      expect(result.payload.notes).toContain('the target is pushed');
    });
  });
});
