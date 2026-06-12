import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks BEFORE imports ───────────────────────────────────────

vi.mock('../../dice/diceRoller.js', () => ({
  rollExpression: vi.fn(),
}));

vi.mock('../common/savePrompt.js', () => ({
  buildSaveDc: vi.fn(),
}));

vi.mock('../../../hooks/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../maps/mapsService.js', () => ({
  loadMapData: vi.fn(),
}));

vi.mock('../../rules/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
}));

vi.mock('../../rules/rangeValidation.js', () => ({
  rangeToFeet: vi.fn(),
}));

vi.mock('../../rules/expirations.js', () => ({
  addExpiration: vi.fn(),
}));

// ── Imports ────────────────────────────────────────────────────

import { handle, isExhausted } from './saveAttackHandler.js';
import * as diceRoller from '../../dice/diceRoller.js';
import * as savePrompt from '../common/savePrompt.js';
import * as runtimeState from '../../../hooks/useRuntimeState.js';
import * as mapsService from '../../maps/mapsService.js';
import * as damageUtils from '../../rules/damageUtils.js';

// ── Helpers ────────────────────────────────────────────────────

const campaignName = 'TestCampaign';

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestHero',
    level: 3,
    proficiency: 2,
    class: {
      class_levels: [
        {},
        {},
        { channel_divinity: 3 },
      ],
    },
    abilities: [
      { name: 'CON', modifier: 2 },
      { name: 'CHA', modifier: 3 },
    ],
    ...overrides,
  };
}

function makeAction(automation = {}) {
  return {
    name: 'Radiance Attack',
    automation: {
      ...automation,
    },
  };
}

// ── Tests: isExhausted ─────────────────────────────────────────

describe('saveAttackHandler.isExhausted', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns false when action.automation is missing', () => {
    const action = { name: 'Test' };
    const ps = makePlayerStats();

    expect(isExhausted(action, ps, campaignName)).toBe(false);
  });

  it('returns false when auto.uses and auto.usesMax are both undefined', () => {
    const action = makeAction({});
    const ps = makePlayerStats();

    expect(isExhausted(action, ps, campaignName)).toBe(false);
  });

  it('returns false when channel_divinity charges are available', () => {
    const action = makeAction({ resourceCost: 'channel_divinity' });
    const ps = makePlayerStats();

    runtimeState.getRuntimeValue.mockReturnValue(2);

    expect(isExhausted(action, ps, campaignName)).toBe(false);
  });

  it('returns true when channel_divinity charges are 0', () => {
    const action = makeAction({ resourceCost: 'channel_divinity' });
    const ps = makePlayerStats();

    runtimeState.getRuntimeValue.mockReturnValue(0);

    expect(isExhausted(action, ps, campaignName)).toBe(true);
  });

  it('uses maxCharges from class_levels when storedCharges is null', () => {
    const action = makeAction({ resourceCost: 'channel_divinity' });
    const ps = makePlayerStats();

    runtimeState.getRuntimeValue.mockReturnValue(null);

    // storedCharges = null => currentCharges = maxCharges = 3 (from class_levels)
    expect(isExhausted(action, ps, campaignName)).toBe(false);
  });

  it('returns true when currentUses <= 0 (exhausted)', () => {
    const action = makeAction({ usesMax: 3 });
    const ps = makePlayerStats();

    runtimeState.getRuntimeValue.mockReturnValue(0);

    expect(isExhausted(action, ps, campaignName)).toBe(true);
  });

  it('returns false when currentUses > 0 (has uses remaining)', () => {
    const action = makeAction({ usesMax: 3 });
    const ps = makePlayerStats();

    runtimeState.getRuntimeValue.mockReturnValue(1);

    expect(isExhausted(action, ps, campaignName)).toBe(false);
  });

  it('uses auto.uses as fallback when usesMax is undefined', () => {
    const action = makeAction({ uses: 2 });
    const ps = makePlayerStats();

    runtimeState.getRuntimeValue.mockReturnValue(0);

    expect(isExhausted(action, ps, campaignName)).toBe(true);
  });

  it('returns true when usesMax is 0 and usesUsed >= 0', () => {
    const action = makeAction({ usesMax: 0 });
    const ps = makePlayerStats();

    runtimeState.getRuntimeValue.mockReturnValue(0);

    // maxUses = 0, usesUsed = 0, 0 >= 0 is true
    expect(isExhausted(action, ps, campaignName)).toBe(true);
  });
});

// ── Tests: handle - Channel Divinity ───────────────────────────

describe('saveAttackHandler.handle - Channel Divinity', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns no-charges popup when channel_divinity charges are 0', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ resourceCost: 'channel_divinity' });

    runtimeState.getRuntimeValue.mockReturnValue(0);

    const result = await handle(action, ps, campaignName, null);

    expect(result.type).toBe('popup');
    expect(result.payload.type).toBe('automation_info');
    expect(result.payload.name).toBe(action.name);
    expect(result.payload.description).toBe('No Channel Divinity charges remaining.');
    expect(result.payload.automation).toBe(action.automation);
    expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
  });

  it('returns no-charges popup when storedCharges is negative', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ resourceCost: 'channel_divinity' });

    runtimeState.getRuntimeValue.mockReturnValue(-1);

    const result = await handle(action, ps, campaignName, null);

    expect(result.type).toBe('popup');
    expect(result.payload.description).toBe('No Channel Divinity charges remaining.');
  });

  it('decrements channelDivinityCharges when charges > 0 and proceeds to damage roll', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ resourceCost: 'channel_divinity', damage: '2d6' });

    runtimeState.getRuntimeValue.mockReturnValue(3);
    savePrompt.buildSaveDc.mockReturnValue(14);
    diceRoller.rollExpression.mockReturnValue({ total: 9, rolls: [4, 5], modifier: 0 });

    const result = await handle(action, ps, campaignName, null);

    expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
      'TestHero',
      'channelDivinityCharges',
      2,
      campaignName,
    );
    expect(result.type).toBe('roll');
  });

  it('uses maxCharges from class_levels when storedCharges is null', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ resourceCost: 'channel_divinity', damage: '2d6' });

    runtimeState.getRuntimeValue.mockReturnValue(null);
    savePrompt.buildSaveDc.mockReturnValue(14);
    diceRoller.rollExpression.mockReturnValue({ total: 9, rolls: [4, 5], modifier: 0 });

    const result = await handle(action, ps, campaignName, null);

    // storedCharges = null => currentCharges = maxCharges = 3, newCharges = 2
    expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
      'TestHero',
      'channelDivinityCharges',
      2,
      campaignName,
    );
    expect(result.type).toBe('roll');
  });

  it('uses class_specific.channel_divinity_charges as fallback', async () => {
    const ps = makePlayerStats({
      class: {
        class_levels: [
          {},
          {},
          { class_specific: { channel_divinity_charges: 4 } },
        ],
      },
    });
    const action = makeAction({ resourceCost: 'channel_divinity', damage: '2d6' });

    runtimeState.getRuntimeValue.mockReturnValue(null);
    savePrompt.buildSaveDc.mockReturnValue(14);
    diceRoller.rollExpression.mockReturnValue({ total: 9, rolls: [4, 5], modifier: 0 });

    const result = await handle(action, ps, campaignName, null);

    // maxCharges = 4 (from class_specific), newCharges = 3
    expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
      'TestHero',
      'channelDivinityCharges',
      3,
      campaignName,
    );
    expect(result.type).toBe('roll');
  });

  it('defaults to 2 max charges when class_levels data is missing', async () => {
    const ps = makePlayerStats({ class: undefined });
    const action = makeAction({ resourceCost: 'channel_divinity', damage: '2d6' });

    runtimeState.getRuntimeValue.mockReturnValue(null);
    savePrompt.buildSaveDc.mockReturnValue(14);
    diceRoller.rollExpression.mockReturnValue({ total: 9, rolls: [4, 5], modifier: 0 });

    const result = await handle(action, ps, campaignName, null);

    // maxCharges = 2 (default), newCharges = 1
    expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
      'TestHero',
      'channelDivinityCharges',
      1,
      campaignName,
    );
    expect(result.type).toBe('roll');
  });
});

// ── Tests: handle - Uses/UsesMax ───────────────────────────────

describe('saveAttackHandler.handle - Uses/UsesMax', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns exhausted popup when usesUsed >= maxUses', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ usesMax: 3 });

    runtimeState.getRuntimeValue.mockReturnValue(0);

    const result = await handle(action, ps, campaignName, null);

    expect(result.type).toBe('popup');
    expect(result.payload.description).toBe(
      'Radiance Attack has been used and cannot be used again until a long rest.',
    );
  });

  it('includes rage recharge note when recharge is long_rest_or_expend_rage', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ usesMax: 3, recharge: 'long_rest_or_expend_rage' });

    runtimeState.getRuntimeValue.mockReturnValue(0);

    const result = await handle(action, ps, campaignName, null);

    expect(result.payload.description).toContain('You may expend one use of Rage to restore it.');
  });

  it('omits rage recharge note when recharge is different', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ usesMax: 3, recharge: 'short_rest' });

    runtimeState.getRuntimeValue.mockReturnValue(0);

    const result = await handle(action, ps, campaignName, null);

    expect(result.payload.description).not.toContain('You may expend one use of Rage to restore it.');
  });

  it('increments uses when usesUsed < maxUses and proceeds to damage roll', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ usesMax: 3, damage: '2d6' });

    runtimeState.getRuntimeValue.mockReturnValue(1);
    savePrompt.buildSaveDc.mockReturnValue(14);
    diceRoller.rollExpression.mockReturnValue({ total: 9, rolls: [4, 5], modifier: 0 });

    const result = await handle(action, ps, campaignName, null);

    expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
      'TestHero',
      'radianceattackUses',
      0,
      campaignName,
    );
    expect(result.type).toBe('roll');
  });

  it('uses auto.resourceKey when provided', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ usesMax: 3, resourceKey: 'myCustomKey', damage: '2d6' });

    runtimeState.getRuntimeValue.mockReturnValue(1);
    savePrompt.buildSaveDc.mockReturnValue(14);
    diceRoller.rollExpression.mockReturnValue({ total: 9, rolls: [4, 5], modifier: 0 });

    const result = await handle(action, ps, campaignName, null);

    expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
      'TestHero',
      'myCustomKey',
      0,
      campaignName,
    );
    expect(result.type).toBe('roll');
  });

  it('skips use tracking when maxUses is 0', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ usesMax: 0, damage: '2d6' });

    savePrompt.buildSaveDc.mockReturnValue(14);
    diceRoller.rollExpression.mockReturnValue({ total: 9, rolls: [4, 5], modifier: 0 });

    const result = await handle(action, ps, campaignName, null);

    expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
    expect(result.type).toBe('roll');
  });

  it('skips use tracking when maxUses is negative', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ usesMax: -1, damage: '2d6' });

    savePrompt.buildSaveDc.mockReturnValue(14);
    diceRoller.rollExpression.mockReturnValue({ total: 9, rolls: [4, 5], modifier: 0 });

    const result = await handle(action, ps, campaignName, null);

    expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
    expect(result.type).toBe('roll');
  });
});

// ── Tests: handle - Condition Inflicted (no damage) ────────────

describe('saveAttackHandler.handle - Condition Inflicted (no damage)', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns popup with save info when conditionInflicted and no damage (non-area)', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ conditionInflicted: 'Stunned', saveType: 'WIS' });

    savePrompt.buildSaveDc.mockReturnValue(14);

    const result = await handle(action, ps, campaignName, null);

    expect(result.type).toBe('popup');
    expect(result.payload.description).toBe(
      'Radiance Attack — WIS save DC 14. On a failed save, target has the Stunned condition.',
    );
  });

  it('defaults to WIS saveType when not provided', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ conditionInflicted: 'Prone' });

    savePrompt.buildSaveDc.mockReturnValue(12);

    const result = await handle(action, ps, campaignName, null);

    expect(result.payload.description).toContain('WIS save DC 12');
  });

  it('returns modal for area shape with conditionInflicted', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ conditionInflicted: 'Stunned', shape: 'cone' });

    savePrompt.buildSaveDc.mockReturnValue(14);
    damageUtils.getCombatContext.mockResolvedValue({ targets: [] });

    const result = await handle(action, ps, campaignName, null);

    expect(result.type).toBe('modal');
    expect(result.modalName).toBe('setCondition');
    expect(result.payload.conditionName).toBe('stunned');
    expect(result.payload.saveDc).toBe(14);
    expect(result.payload.attackerName).toBe('TestHero');
  });

  it('returns modal for area shape with underscore-prefixed shape', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ conditionInflicted: 'Stunned', shape: 'emanation_30ft' });

    savePrompt.buildSaveDc.mockReturnValue(14);
    damageUtils.getCombatContext.mockResolvedValue({ targets: [] });

    const result = await handle(action, ps, campaignName, null);

    expect(result.type).toBe('modal');
    expect(result.modalName).toBe('setCondition');
  });

  it('includes attackerPos when mapName is provided and player found', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ conditionInflicted: 'Stunned', shape: 'cone' });

    savePrompt.buildSaveDc.mockReturnValue(14);
    damageUtils.getCombatContext.mockResolvedValue({ targets: [] });
    mapsService.loadMapData.mockResolvedValue({
      players: [{ name: 'TestHero', gridX: 5, gridY: 7 }],
    });

    const result = await handle(action, ps, campaignName, 'TestMap');

    expect(result.payload.attackerPos).toEqual({ gridX: 5, gridY: 7 });
    expect(result.payload.mapData).toEqual({
      players: [{ name: 'TestHero', gridX: 5, gridY: 7 }],
    });
  });

  it('sets attackerPos to null when mapName is provided but player not found', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ conditionInflicted: 'Stunned', shape: 'cone' });

    savePrompt.buildSaveDc.mockReturnValue(14);
    damageUtils.getCombatContext.mockResolvedValue({ targets: [] });
    mapsService.loadMapData.mockResolvedValue({
      players: [{ name: 'OtherHero', gridX: 5, gridY: 7 }],
    });

    const result = await handle(action, ps, campaignName, 'TestMap');

    expect(result.payload.attackerPos).toBeNull();
  });

  it('handles map load failure gracefully', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ conditionInflicted: 'Stunned', shape: 'cone' });

    savePrompt.buildSaveDc.mockReturnValue(14);
    damageUtils.getCombatContext.mockResolvedValue({ targets: [] });
    mapsService.loadMapData.mockRejectedValue(new Error('Network error'));

    const result = await handle(action, ps, campaignName, 'TestMap');

    expect(result.payload.attackerPos).toBeNull();
    expect(result.payload.mapData).toBeNull();
  });

  it('skips map loading when mapName is null', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ conditionInflicted: 'Stunned', shape: 'cone' });

    savePrompt.buildSaveDc.mockReturnValue(14);
    damageUtils.getCombatContext.mockResolvedValue({ targets: [] });

    const result = await handle(action, ps, campaignName, null);

    expect(result.payload.attackerPos).toBeNull();
    expect(result.payload.mapData).toBeNull();
    expect(mapsService.loadMapData).not.toHaveBeenCalled();
  });

  it('includes durationRounds when auto.duration is a round-based duration', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ conditionInflicted: 'Stunned', shape: 'cone', duration: '3_round' });

    savePrompt.buildSaveDc.mockReturnValue(14);
    damageUtils.getCombatContext.mockResolvedValue({ targets: [] });

    const result = await handle(action, ps, campaignName, null);

    expect(result.payload.durationRounds).toBe(3);
  });

  it('includes durationRounds of 10 when auto.duration is 1_minute', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ conditionInflicted: 'Stunned', shape: 'cone', duration: '1_minute' });

    savePrompt.buildSaveDc.mockReturnValue(14);
    damageUtils.getCombatContext.mockResolvedValue({ targets: [] });

    const result = await handle(action, ps, campaignName, null);

    expect(result.payload.durationRounds).toBe(10);
  });

  it('includes durationRounds as undefined when auto.duration does not match', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ conditionInflicted: 'Stunned', shape: 'cone', duration: 'concentration' });

    savePrompt.buildSaveDc.mockReturnValue(14);
    damageUtils.getCombatContext.mockResolvedValue({ targets: [] });

    const result = await handle(action, ps, campaignName, null);

    expect(result.payload.durationRounds).toBeUndefined();
  });

  it('includes durationRounds as undefined when auto.duration is missing', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ conditionInflicted: 'Stunned', shape: 'cone' });

    savePrompt.buildSaveDc.mockReturnValue(14);
    damageUtils.getCombatContext.mockResolvedValue({ targets: [] });

    const result = await handle(action, ps, campaignName, null);

    expect(result.payload.durationRounds).toBeUndefined();
  });

  it('defaults saveType to WIS in modal payload', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ conditionInflicted: 'Stunned', shape: 'cone' });

    savePrompt.buildSaveDc.mockReturnValue(14);
    damageUtils.getCombatContext.mockResolvedValue({ targets: [] });

    const result = await handle(action, ps, campaignName, null);

    expect(result.payload.saveType).toBe('WIS');
  });

  it('uses auto.saveType in modal payload when provided', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ conditionInflicted: 'Stunned', shape: 'cone', saveType: 'CON' });

    savePrompt.buildSaveDc.mockReturnValue(14);
    damageUtils.getCombatContext.mockResolvedValue({ targets: [] });

    const result = await handle(action, ps, campaignName, null);

    expect(result.payload.saveType).toBe('CON');
  });

  it('includes featureName in modal payload', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ conditionInflicted: 'Stunned', shape: 'cone' });

    savePrompt.buildSaveDc.mockReturnValue(14);
    damageUtils.getCombatContext.mockResolvedValue({ targets: [] });

    const result = await handle(action, ps, campaignName, null);

    expect(result.payload.featureName).toBe('Radiance Attack');
  });

  it('includes campaignName in modal payload', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ conditionInflicted: 'Stunned', shape: 'cone' });

    savePrompt.buildSaveDc.mockReturnValue(14);
    damageUtils.getCombatContext.mockResolvedValue({ targets: [] });

    const result = await handle(action, ps, campaignName, null);

    expect(result.payload.campaignName).toBe(campaignName);
  });
});

// ── Tests: handle - Damage Roll ────────────────────────────────

describe('saveAttackHandler.handle - Damage Roll', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns roll result with correct structure', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ damage: '2d6', damageType: 'Radiant' });

    savePrompt.buildSaveDc.mockReturnValue(14);
    diceRoller.rollExpression.mockReturnValue({ total: 9, rolls: [4, 5], modifier: 0 });

    const result = await handle(action, ps, campaignName, null);

    expect(result.type).toBe('roll');
    expect(result.payload.rollType).toBe('damage');
    expect(result.payload.name).toBe(action.name);
    expect(result.payload.formula).toBe('2d6');
    expect(result.payload.total).toBe(9);
    expect(result.payload.rolls).toEqual([4, 5]);
    expect(result.payload.modifier).toBe(0);
  });

  it('includes contextConfig with damageType', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ damage: '2d6', damageType: 'Radiant' });

    savePrompt.buildSaveDc.mockReturnValue(14);
    diceRoller.rollExpression.mockReturnValue({ total: 9, rolls: [4, 5], modifier: 0 });

    const result = await handle(action, ps, campaignName, null);

    expect(result.payload.contextConfig.damageType).toBe('Radiant');
  });

  it('defaults damageType to empty string when missing', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ damage: '2d6' });

    savePrompt.buildSaveDc.mockReturnValue(14);
    diceRoller.rollExpression.mockReturnValue({ total: 9, rolls: [4, 5], modifier: 0 });

    const result = await handle(action, ps, campaignName, null);

    expect(result.payload.contextConfig.damageType).toBe('');
  });

  it('defaults saveType to DEX in contextConfig', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ damage: '2d6' });

    savePrompt.buildSaveDc.mockReturnValue(14);
    diceRoller.rollExpression.mockReturnValue({ total: 9, rolls: [4, 5], modifier: 0 });

    const result = await handle(action, ps, campaignName, null);

    expect(result.payload.contextConfig.saveType).toBe('DEX');
  });

  it('uses auto.saveType in contextConfig when provided', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ damage: '2d6', saveType: 'WIS' });

    savePrompt.buildSaveDc.mockReturnValue(14);
    diceRoller.rollExpression.mockReturnValue({ total: 9, rolls: [4, 5], modifier: 0 });

    const result = await handle(action, ps, campaignName, null);

    expect(result.payload.contextConfig.saveType).toBe('WIS');
  });

  it('sets dcSuccess to "half" when shape is cone', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ damage: '2d6', shape: 'cone' });

    savePrompt.buildSaveDc.mockReturnValue(14);
    diceRoller.rollExpression.mockReturnValue({ total: 9, rolls: [4, 5], modifier: 0 });

    const result = await handle(action, ps, campaignName, null);

    expect(result.payload.contextConfig.dcSuccess).toBe('half');
  });

  it('sets dcSuccess to "none" when shape is not cone', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ damage: '2d6', shape: 'sphere' });

    savePrompt.buildSaveDc.mockReturnValue(14);
    diceRoller.rollExpression.mockReturnValue({ total: 9, rolls: [4, 5], modifier: 0 });

    const result = await handle(action, ps, campaignName, null);

    expect(result.payload.contextConfig.dcSuccess).toBe('none');
  });

  it('sets dcSuccess to "none" when shape is missing', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ damage: '2d6' });

    savePrompt.buildSaveDc.mockReturnValue(14);
    diceRoller.rollExpression.mockReturnValue({ total: 9, rolls: [4, 5], modifier: 0 });

    const result = await handle(action, ps, campaignName, null);

    expect(result.payload.contextConfig.dcSuccess).toBe('none');
  });

  it('includes attackerName in contextConfig', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ damage: '2d6' });

    savePrompt.buildSaveDc.mockReturnValue(14);
    diceRoller.rollExpression.mockReturnValue({ total: 9, rolls: [4, 5], modifier: 0 });

    const result = await handle(action, ps, campaignName, null);

    expect(result.payload.contextConfig.attackerName).toBe('TestHero');
  });

  it('includes conditionInflicted in contextConfig when provided', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ damage: '2d6', conditionInflicted: 'Blinded' });

    savePrompt.buildSaveDc.mockReturnValue(14);
    diceRoller.rollExpression.mockReturnValue({ total: 9, rolls: [4, 5], modifier: 0 });

    const result = await handle(action, ps, campaignName, null);

    expect(result.payload.contextConfig.conditionInflicted).toBe('Blinded');
  });

  it('defaults conditionInflicted to null in contextConfig', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ damage: '2d6' });

    savePrompt.buildSaveDc.mockReturnValue(14);
    diceRoller.rollExpression.mockReturnValue({ total: 9, rolls: [4, 5], modifier: 0 });

    const result = await handle(action, ps, campaignName, null);

    expect(result.payload.contextConfig.conditionInflicted).toBeNull();
  });

  it('includes shape in contextConfig', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ damage: '2d6', shape: 'cone' });

    savePrompt.buildSaveDc.mockReturnValue(14);
    diceRoller.rollExpression.mockReturnValue({ total: 9, rolls: [4, 5], modifier: 0 });

    const result = await handle(action, ps, campaignName, null);

    expect(result.payload.contextConfig.shape).toBe('cone');
  });

  it('defaults shape to empty string in contextConfig', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ damage: '2d6' });

    savePrompt.buildSaveDc.mockReturnValue(14);
    diceRoller.rollExpression.mockReturnValue({ total: 9, rolls: [4, 5], modifier: 0 });

    const result = await handle(action, ps, campaignName, null);

    expect(result.payload.contextConfig.shape).toBe('');
  });

  it('includes notes about Magical Darkness when shape is an area shape', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ damage: '2d6', shape: 'cone' });

    savePrompt.buildSaveDc.mockReturnValue(14);
    diceRoller.rollExpression.mockReturnValue({ total: 9, rolls: [4, 5], modifier: 0 });

    const result = await handle(action, ps, campaignName, null);

    expect(result.payload.notes).toBe('Magical Darkness in the area is dispelled.');
  });

  it('includes notes about Magical Darkness for underscore-prefixed area shapes', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ damage: '2d6', shape: 'emanation_30ft' });

    savePrompt.buildSaveDc.mockReturnValue(14);
    diceRoller.rollExpression.mockReturnValue({ total: 9, rolls: [4, 5], modifier: 0 });

    const result = await handle(action, ps, campaignName, null);

    expect(result.payload.notes).toBe('Magical Darkness in the area is dispelled.');
  });

  it('sets notes to undefined when shape is not an area shape', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ damage: '2d6', shape: 'ray' });

    savePrompt.buildSaveDc.mockReturnValue(14);
    diceRoller.rollExpression.mockReturnValue({ total: 9, rolls: [4, 5], modifier: 0 });

    const result = await handle(action, ps, campaignName, null);

    expect(result.payload.notes).toBeUndefined();
  });

  it('sets notes to undefined when shape is missing', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ damage: '2d6' });

    savePrompt.buildSaveDc.mockReturnValue(14);
    diceRoller.rollExpression.mockReturnValue({ total: 9, rolls: [4, 5], modifier: 0 });

    const result = await handle(action, ps, campaignName, null);

    expect(result.payload.notes).toBeUndefined();
  });

  it('returns null when rollExpression returns null', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ damage: '2d6' });

    savePrompt.buildSaveDc.mockReturnValue(14);
    diceRoller.rollExpression.mockReturnValue(null);

    const result = await handle(action, ps, campaignName, null);

    expect(result).toBeNull();
  });
});

// ── Tests: handle - Edge Cases ─────────────────────────────────

describe('saveAttackHandler.handle - Edge Cases', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('handles action with empty automation and no damage returns null', async () => {
    const ps = makePlayerStats();
    const action = makeAction({});

    savePrompt.buildSaveDc.mockReturnValue(10);
    diceRoller.rollExpression.mockReturnValue(null);

    const result = await handle(action, ps, campaignName, null);

    expect(result).toBeNull();
  });

  it('handles all area shapes for condition modal', async () => {
    const areaShapes = ['emanation', 'cone', 'line', 'sphere', 'cube', 'cylinder', 'square', 'circle', 'wall', 'cage', 'floor', 'area'];

    for (const shape of areaShapes) {
      const ps = makePlayerStats();
      const action = makeAction({ conditionInflicted: 'Stunned', shape });

      savePrompt.buildSaveDc.mockReturnValue(14);
      damageUtils.getCombatContext.mockResolvedValue({ targets: [] });

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('modal');
      expect(result.modalName).toBe('setCondition');
    }
  });

  it('handles non-area shapes for condition popup', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ conditionInflicted: 'Stunned', shape: 'ray' });

    savePrompt.buildSaveDc.mockReturnValue(14);

    const result = await handle(action, ps, campaignName, null);

    expect(result.type).toBe('popup');
  });

  it('handles non-area shapes for condition popup when shape is null', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ conditionInflicted: 'Stunned', shape: null });

    savePrompt.buildSaveDc.mockReturnValue(14);

    const result = await handle(action, ps, campaignName, null);

    expect(result.type).toBe('popup');
  });

  it('handles non-area shapes for condition popup when shape is undefined', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ conditionInflicted: 'Stunned' });

    savePrompt.buildSaveDc.mockReturnValue(14);

    const result = await handle(action, ps, campaignName, null);

    expect(result.type).toBe('popup');
  });

  it('handles uppercase shape for area detection', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ conditionInflicted: 'Stunned', shape: 'CONE' });

    savePrompt.buildSaveDc.mockReturnValue(14);
    damageUtils.getCombatContext.mockResolvedValue({ targets: [] });

    const result = await handle(action, ps, campaignName, null);

    expect(result.type).toBe('modal');
  });

  it('handles mixed-case shape for area detection', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ conditionInflicted: 'Stunned', shape: 'CoNe' });

    savePrompt.buildSaveDc.mockReturnValue(14);
    damageUtils.getCombatContext.mockResolvedValue({ targets: [] });

    const result = await handle(action, ps, campaignName, null);

    expect(result.type).toBe('modal');
  });

  it('handles uppercase shape for damage notes', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ damage: '2d6', shape: 'SPHERE' });

    savePrompt.buildSaveDc.mockReturnValue(14);
    diceRoller.rollExpression.mockReturnValue({ total: 9, rolls: [4, 5], modifier: 0 });

    const result = await handle(action, ps, campaignName, null);

    expect(result.payload.notes).toBe('Magical Darkness in the area is dispelled.');
  });

  it('handles underscore-prefixed shape for damage notes', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ damage: '2d6', shape: 'sphere_15ft' });

    savePrompt.buildSaveDc.mockReturnValue(14);
    diceRoller.rollExpression.mockReturnValue({ total: 9, rolls: [4, 5], modifier: 0 });

    const result = await handle(action, ps, campaignName, null);

    expect(result.payload.notes).toBe('Magical Darkness in the area is dispelled.');
  });

  it('handles mapData with no players array', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ conditionInflicted: 'Stunned', shape: 'cone' });

    savePrompt.buildSaveDc.mockReturnValue(14);
    damageUtils.getCombatContext.mockResolvedValue({ targets: [] });
    mapsService.loadMapData.mockResolvedValue({});

    const result = await handle(action, ps, campaignName, 'TestMap');

    expect(result.payload.attackerPos).toBeNull();
  });

  it('handles mapData being null', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ conditionInflicted: 'Stunned', shape: 'cone' });

    savePrompt.buildSaveDc.mockReturnValue(14);
    damageUtils.getCombatContext.mockResolvedValue({ targets: [] });
    mapsService.loadMapData.mockResolvedValue(null);

    const result = await handle(action, ps, campaignName, 'TestMap');

    expect(result.payload.attackerPos).toBeNull();
  });
});

// ── Tests: handle - Wild Shape resource cost ─────────────────────

describe('saveAttackHandler.handle - Wild Shape resource cost', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  function makeDruidStats(wildShapeUses = 3) {
    return {
      name: 'TestDruid',
      level: 14,
      proficiency: 5,
      class: {
        class_levels: [
          { level: 1 }, { level: 2 }, { level: 3 }, { level: 4 }, { level: 5 },
          { level: 6 }, { level: 7 }, { level: 8 }, { level: 9 }, { level: 10 },
          { level: 11 }, { level: 12 }, { level: 13 }, { level: 14, wild_shape: 4 }
        ],
      },
      abilities: [
        { name: 'WIS', modifier: 3 },
        { name: 'CON', modifier: 2 },
      ],
      ...({ _wildShapeUses: wildShapeUses }),
    };
  }

  it('returns error popup when wild_shape uses are 0', async () => {
    const ps = makeDruidStats(0);
    const action = makeAction({
      resourceCost: 'wild_shape',
      damage: '2d6',
      shape: 'emanation',
    });

    runtimeState.getRuntimeValue.mockReturnValue(0);

    const result = await handle(action, ps, campaignName, null);

    expect(result.type).toBe('popup');
    expect(result.payload.type).toBe('automation_info');
    expect(result.payload.description).toContain('Not enough Wild Shape uses remaining');
    expect(result.payload.description).toContain('1 use');
  });

  it('expend 1 wild_shape use and proceed to damage roll', async () => {
    const ps = makeDruidStats(3);
    const action = makeAction({
      resourceCost: 'wild_shape',
      damage: '2d6',
      shape: 'emanation',
    });

    runtimeState.getRuntimeValue.mockReturnValue(3);
    savePrompt.buildSaveDc.mockReturnValue(14);
    diceRoller.rollExpression.mockReturnValue({ total: 7, rolls: [3, 4], modifier: 0 });

    const result = await handle(action, ps, campaignName, null);

    expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
      'TestDruid',
      'wildShapeUses',
      2,
      campaignName,
    );
    expect(result.type).toBe('roll');
  });

  it('expend 2 wild_shape uses when doubleEmanation is true', async () => {
    const ps = makeDruidStats(3);
    const action = makeAction({
      resourceCost: 'wild_shape',
      damage: '2d6',
      shape: 'emanation',
      doubleEmanation: true,
    });

    runtimeState.getRuntimeValue.mockReturnValue(3);
    savePrompt.buildSaveDc.mockReturnValue(14);
    diceRoller.rollExpression.mockReturnValue({ total: 7, rolls: [3, 4], modifier: 0 });

    const result = await handle(action, ps, campaignName, null);

    expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
      'TestDruid',
      'wildShapeUses',
      1,
      campaignName,
    );
    expect(result.type).toBe('roll');
  });

  it('returns error when not enough wild_shape for doubleEmanation (only 1 left)', async () => {
    const ps = makeDruidStats(1);
    const action = makeAction({
      resourceCost: 'wild_shape',
      damage: '2d6',
      shape: 'emanation',
      doubleEmanation: true,
    });

    runtimeState.getRuntimeValue.mockReturnValue(1);

    const result = await handle(action, ps, campaignName, null);

    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('Not enough Wild Shape uses remaining');
    expect(result.payload.description).toContain('2 uses');
  });

  it('normalize pushEffect to effect for push-based effects', async () => {
    const ps = makeDruidStats(3);
    const action = makeAction({
      resourceCost: 'wild_shape',
      damage: 'WIS modifier d6',
      shape: 'emanation',
      pushEffect: 'push',
      effectValue: '15_ft',
    });

    runtimeState.getRuntimeValue.mockReturnValue(3);
    savePrompt.buildSaveDc.mockReturnValue(14);
    diceRoller.rollExpression.mockReturnValue({ total: 8, rolls: [5, 3], modifier: 0 });

    const result = await handle(action, ps, campaignName, null);

    expect(result.type).toBe('roll');
    expect(result.payload.contextConfig.damageType).toBe('');
  });

  it('uses WIS save DC when saveDc is ability and saveAbility is WIS', async () => {
    const ps = makeDruidStats(3);
    const action = makeAction({
      resourceCost: 'wild_shape',
      damage: 'WIS modifier d6',
      shape: 'emanation',
      saveDc: 'ability',
      saveAbility: 'WIS',
      saveType: 'CON',
    });

    runtimeState.getRuntimeValue.mockReturnValue(3);
    savePrompt.buildSaveDc.mockReturnValue(16);
    diceRoller.rollExpression.mockReturnValue({ total: 8, rolls: [5, 3], modifier: 0 });

    const result = await handle(action, ps, campaignName, null);

    expect(savePrompt.buildSaveDc).toHaveBeenCalled();
    expect(result.payload.contextConfig.saveDc).toBe(16);
    expect(result.payload.contextConfig.saveType).toBe('CON');
  });

  it('sets up duration expiration for 1_minute duration with emanation shape', async () => {
    const ps = makeDruidStats(3);
    const action = makeAction({
      resourceCost: 'wild_shape',
      damage: '2d6',
      shape: 'emanation',
      duration: '1_minute',
    });

    runtimeState.getRuntimeValue.mockReturnValue(3);
    savePrompt.buildSaveDc.mockReturnValue(14);
    diceRoller.rollExpression.mockReturnValue({ total: 7, rolls: [3, 4], modifier: 0 });

    const result = await handle(action, ps, campaignName, null);

    expect(result.type).toBe('roll');
  });
});

// ── Tests: isExhausted - Wild Shape ──────────────────────────────

describe('saveAttackHandler.isExhausted - Wild Shape', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  function makeDruidStats(wildShapeUses = 3) {
    return {
      name: 'TestDruid',
      level: 14,
      proficiency: 5,
      class: {
        class_levels: [
          { level: 1 }, { level: 2 }, { level: 3 }, { level: 4 }, { level: 5 },
          { level: 6 }, { level: 7 }, { level: 8 }, { level: 9 }, { level: 10 },
          { level: 11 }, { level: 12 }, { level: 13 }, { level: 14, wild_shape: 4 }
        ],
      },
      abilities: [],
      ...({ _wildShapeUses: wildShapeUses }),
    };
  }

  it('returns false when wild_shape charges are available', () => {
    const action = makeAction({ resourceCost: 'wild_shape' });
    const ps = makeDruidStats(3);

    runtimeState.getRuntimeValue.mockReturnValue(3);

    expect(isExhausted(action, ps, campaignName)).toBe(false);
  });

  it('returns true when wild_shape charges are 0', () => {
    const action = makeAction({ resourceCost: 'wild_shape' });
    const ps = makeDruidStats(0);

    runtimeState.getRuntimeValue.mockReturnValue(0);

    expect(isExhausted(action, ps, campaignName)).toBe(true);
  });

  it('returns false when storedCharges is null (defaults to max)', () => {
    const action = makeAction({ resourceCost: 'wild_shape' });
    const ps = makeDruidStats(4);

    runtimeState.getRuntimeValue.mockReturnValue(null);

    expect(isExhausted(action, ps, campaignName)).toBe(false);
  });
});
