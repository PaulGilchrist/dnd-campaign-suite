// @improved-by-ai
// BUG CLA-096 locks: activation registers the 10-minute rounds clock + LR use
// flag + logs; re-click while used-and-active RETRACTS (no refusal); used-and-
// inactive refuses (with log); the verified no-flag buff-active refusal stays
// byte-identical (Celestial Revelation lane).
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

vi.mock('../class-cleric-paladin/sacredWeaponHandler.js', () => ({
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
  const evaluateAutoExpression = vi.fn();
  return {
    evaluateAutoExpression,
    resolveNumericExpression: (...args) => evaluateAutoExpression(...args),
  };
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

vi.mock('../../../rules/features/draconicFlightService.js', () => ({
  endDraconicFlightBuff: vi.fn(() => true),
  isDraconicFlightBuff: vi.fn(b => b?.effect === 'fly_speed_equals_walk_speed' && b?.name === 'Draconic Flight'),
}));

import { handle } from './buffHandler.js';
import * as buffToggle from '../../common/buffToggle.js';
import * as runtimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as logService from '../../../ui/logService.js';
import * as expirations from '../../../rules/effects/expirations.js';
import * as draconicFlightService from '../../../rules/features/draconicFlightService.js';

const campaignName = 'test-campaign';

const FLY_BUFF = { name: 'Draconic Flight', effect: 'fly_speed_equals_walk_speed', duration: '10_minutes' };

function makePlayerStats(overrides = {}) {
  return { name: 'DragonbornTest', level: 5, proficiency: 3, ...overrides };
}

function makeDraconicFlightAction(automation = {}) {
  return {
    name: 'Draconic Flight',
    automation: {
      type: 'temp_buff',
      effect: 'fly_speed_equals_walk_speed',
      duration: '10_minutes',
      recharge: 'long_rest',
      requiredLevel: 5,
      casting_time: '1 bonus action',
      ...automation,
    },
  };
}

function stubRuntime({ buffs = [], flag = null } = {}) {
  runtimeState.getRuntimeValue.mockImplementation((name, key) => {
    if (key === 'activeBuffs') return buffs;
    if (key === 'draconicFlightUsed') return flag;
    return null;
  });
}

describe('CLA-096 buffHandler — Draconic Flight (fly_speed_equals_walk_speed + long_rest)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    buffToggle.toggleBuff.mockReturnValue({ wasActive: false, buffs: [FLY_BUFF] });
    buffToggle.isBuffActive.mockReturnValue(false);
  });

  it('activation stamps the LR use flag, registers ONE 100-round clock, and logs ability_use', async () => {
    stubRuntime({ buffs: [], flag: null });

    const result = await handle(makeDraconicFlightAction(), makePlayerStats(), campaignName, null);

    expect(result.payload.description).toContain('activated on yourself (10_minutes)');
    expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith('DragonbornTest', 'draconicFlightUsed', true, campaignName);
    expect(expirations.addExpiration).toHaveBeenCalledTimes(1);
    expect(expirations.addExpiration).toHaveBeenCalledWith({
      attackerName: 'DragonbornTest',
      targetName: 'DragonbornTest',
      effects: [{ type: 'fly_speed_equals_walk_speed' }],
      campaignName,
      rounds: 100,
    });
    expect(logService.addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
      type: 'ability_use',
      characterName: 'DragonbornTest',
      abilityName: 'Draconic Flight',
      description: expect.stringContaining('spectral wings sprout'),
    }));
  });

  it('converts hour durations ×600 rounds generically (JSON duration is truth)', async () => {
    stubRuntime({ buffs: [], flag: null });

    await handle(makeDraconicFlightAction({ duration: '2_hours' }), makePlayerStats(), campaignName, null);

    expect(expirations.addExpiration).toHaveBeenCalledWith(expect.objectContaining({ rounds: 1200 }));
  });

  it('re-click while buff active retracts (no refusal, no new clock, no second toggle-on)', async () => {
    stubRuntime({ buffs: [FLY_BUFF], flag: true });
    buffToggle.isBuffActive.mockReturnValue(true);

    const result = await handle(makeDraconicFlightAction(), makePlayerStats(), campaignName, null);

    expect(result.payload.description).toBe('Draconic Flight toggled OFF');
    expect(draconicFlightService.endDraconicFlightBuff).toHaveBeenCalledWith('DragonbornTest', campaignName, 'retracted');
    expect(buffToggle.toggleBuff).not.toHaveBeenCalled();
    expect(expirations.addExpiration).not.toHaveBeenCalled();
    const refusal = logService.addEntry.mock.calls.find(c => String(c[1]?.automationType).endsWith('_refused'));
    expect(refusal).toBeUndefined();
  });

  it('used flag outliving the buff (expired/retracted) refuses activation AND logs the refusal', async () => {
    stubRuntime({ buffs: [], flag: true });

    const result = await handle(makeDraconicFlightAction(), makePlayerStats(), campaignName, null);

    expect(result.payload.description).toBe('Draconic Flight has been used and cannot be used again until a Long Rest.');
    expect(buffToggle.toggleBuff).not.toHaveBeenCalled();
    expect(expirations.addExpiration).not.toHaveBeenCalled();
    expect(logService.addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
      type: 'automation',
      automationType: 'draconic_flight_refused',
      automationDetail: 'long_rest',
      characterName: 'DragonbornTest',
    }));
  });

  it('keeps the verified no-flag buff-active refusal byte-identical (Celestial Revelation lane)', async () => {
    stubRuntime({ buffs: [{ name: 'Heavenly Wings', effect: 'fly_speed_equals_walk_speed' }], flag: null });
    buffToggle.isBuffActive.mockImplementation((n, buffName) => buffName === 'Heavenly Wings');

    const action = { name: 'Heavenly Wings', automation: { type: 'temp_buff', effect: 'fly_speed_equals_walk_speed', duration: '1_minute', recharge: 'long_rest', casting_time: '1 bonus action' } };
    const result = await handle(action, makePlayerStats(), campaignName, null);

    expect(result.payload.description).toBe('Heavenly Wings has been used and cannot be used again until a Long Rest.');
    expect(draconicFlightService.endDraconicFlightBuff).not.toHaveBeenCalled();
    expect(buffToggle.toggleBuff).not.toHaveBeenCalled();
    expect(expirations.addExpiration).not.toHaveBeenCalled();
  });

  it('requiredLevel gate stays in front: no flag stamp, no clock, no activation log', async () => {
    stubRuntime({ buffs: [], flag: null });

    const result = await handle(makeDraconicFlightAction(), makePlayerStats({ level: 1 }), campaignName, null);

    expect(result.payload.description).toContain('requires character level 5');
    expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
    expect(expirations.addExpiration).not.toHaveBeenCalled();
    expect(logService.addEntry).not.toHaveBeenCalled();
  });
});
