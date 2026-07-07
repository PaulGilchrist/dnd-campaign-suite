// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handle, hasGloriousDefenseActive } from './gloriousDefenseHandler.js';
import * as runtimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as logService from '../../../ui/logService.js';
import * as damageUtils from '../../../rules/combat/damageUtils.js';
import * as baseCombatActions from '../../../combat/baseCombatActions.js';

const campaignName = 'test-campaign';
const playerName = 'Test Paladin';

function makePlayerStats(overrides = {}) {
  return {
    name: playerName,
    abilities: [{ name: 'Charisma', bonus: 3 }],
    attacks: [
      { name: 'Longsword', type: 'Action', range: baseCombatActions.MELEE_REACH_FEET, hitBonus: 7, damage: '1d8+3' },
    ],
    ...overrides,
  };
}

function makeAction(overrides = {}) {
  return {
    name: 'Glorious Defense',
    automation: {
      type: 'glorious_defense',
      effect: 'ac_bonus',
      range: '10_ft',
      casting_time: '1 reaction',
      ...overrides.automation,
    },
    ...overrides,
  };
}

function counterAction(overrides = {}) {
  return makeAction({
    automation: { ...makeAction().automation, effect: 'counter_attack', ...overrides.automation },
    ...overrides,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(runtimeState, 'getRuntimeValue').mockImplementation((_name, key) => {
    if (key === 'gloriousDefenseUses') return 4;
    return null;
  });
  vi.spyOn(runtimeState, 'setRuntimeValue').mockResolvedValue(undefined);
  vi.spyOn(logService, 'addEntry').mockResolvedValue(undefined);
  vi.spyOn(damageUtils, 'getCombatContext').mockResolvedValue(null);
  vi.spyOn(damageUtils, 'getTargetFromAttacker').mockReturnValue(null);
});

describe('gloriousDefenseHandler.handle — ac_bonus', () => {
  it('should activate AC bonus and consume a use', async () => {
    const result = await handle(makeAction(), makePlayerStats(), campaignName, undefined);

    expect(result.type).toBe('popup');
    expect(result.payload.type).toBe('automation_info');
    expect(result.payload.name).toBe('Glorious Defense');
    expect(result.payload.description).toContain('activated');
    expect(result.payload.description).toContain('Charisma modifier');

    expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(playerName, 'gloriousDefenseUses', 3, campaignName);
    expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(playerName, 'gloriousDefenseActive', true, campaignName);
    expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(playerName, 'gloriousDefenseBonus', 3, campaignName);
  });

  it('should deny when no uses remaining', async () => {
    runtimeState.getRuntimeValue.mockImplementation((_name, key) => {
      if (key === 'gloriousDefenseUses') return 0;
      return null;
    });

    const result = await handle(makeAction(), makePlayerStats(), campaignName, undefined);

    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('no uses remaining');
    expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
  });

  it('should use CHA bonus when positive as AC bonus', async () => {
    const stats = makePlayerStats({ abilities: [{ name: 'Charisma', bonus: 5 }] });

    await handle(makeAction(), stats, campaignName, undefined);

    expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(playerName, 'gloriousDefenseBonus', 5, campaignName);
  });

  it('should use minimum 1 when CHA modifier is negative or zero', async () => {
    const negativeStats = makePlayerStats({ abilities: [{ name: 'Charisma', bonus: -2 }] });
    const zeroStats = makePlayerStats({ abilities: [{ name: 'Charisma', bonus: 0 }] });

    await handle(makeAction(), negativeStats, campaignName, undefined);
    expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(playerName, 'gloriousDefenseBonus', 1, campaignName);

    await handle(makeAction(), zeroStats, campaignName, undefined);
    expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(playerName, 'gloriousDefenseBonus', 1, campaignName);
  });

  it('should default usesMax when CHA bonus is 0 or no Charisma ability', async () => {
    runtimeState.getRuntimeValue.mockImplementation((_name, key) => {
      if (key === 'gloriousDefenseUses') return null;
      return null;
    });

    const zeroChaStats = makePlayerStats({ abilities: [{ name: 'Charisma', bonus: 0 }] });
    await handle(makeAction(), zeroChaStats, campaignName, undefined);
    expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(playerName, 'gloriousDefenseUses', 0, campaignName);

    const noChaStats = makePlayerStats({ abilities: [] });
    await handle(makeAction(), noChaStats, campaignName, undefined);
    expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(playerName, 'gloriousDefenseUses', 0, campaignName);
  });
});

describe('gloriousDefenseHandler.handle — counter_attack', () => {
  it('should return attack_roll when melee attack available', async () => {
    damageUtils.getCombatContext.mockResolvedValue({});
    damageUtils.getTargetFromAttacker.mockReturnValue({ name: 'Orc' });

    const result = await handle(counterAction(), makePlayerStats(), campaignName, undefined);

    expect(result.type).toBe('attack_roll');
    expect(result.payload.attack.name).toBe('Longsword');
    expect(result.payload.targetName).toBe('Orc');
    expect(result.payload.sourceName).toBe('Glorious Defense');
  });

  it('should consume a use on counter_attack', async () => {
    damageUtils.getCombatContext.mockResolvedValue({});
    damageUtils.getTargetFromAttacker.mockReturnValue({ name: 'Orc' });

    await handle(counterAction(), makePlayerStats(), campaignName, undefined);

    expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(playerName, 'gloriousDefenseUses', 3, campaignName);
  });

  it('should fall back to first attack when no melee attacks', async () => {
    damageUtils.getCombatContext.mockResolvedValue({});
    damageUtils.getTargetFromAttacker.mockReturnValue({ name: 'Orc' });

    const stats = makePlayerStats({
      attacks: [{ name: 'Longbow', type: 'Action', range: 150, hitBonus: 7, damage: '1d8+3' }],
    });

    const result = await handle(counterAction(), stats, campaignName, undefined);

    expect(result.type).toBe('attack_roll');
    expect(result.payload.attack.name).toBe('Longbow');
  });

  it('should return popup when no attacks at all', async () => {
    damageUtils.getCombatContext.mockResolvedValue({});
    damageUtils.getTargetFromAttacker.mockReturnValue({ name: 'Orc' });

    const stats = makePlayerStats({ attacks: [] });

    const result = await handle(counterAction(), stats, campaignName, undefined);

    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('No melee attack available');
  });

  it('should return null targetName when no attacker in combat context', async () => {
    damageUtils.getCombatContext.mockResolvedValue({});
    damageUtils.getTargetFromAttacker.mockReturnValue(null);

    const result = await handle(counterAction(), makePlayerStats(), campaignName, undefined);

    expect(result.type).toBe('attack_roll');
    expect(result.payload.targetName).toBeNull();
  });

  it('should use CHA-based uses for counter_attack', async () => {
    runtimeState.getRuntimeValue.mockImplementation((_name, key) => {
      if (key === 'gloriousDefenseUses') return null;
      return null;
    });
    const stats = makePlayerStats({ abilities: [{ name: 'Charisma', bonus: 5 }] });
    damageUtils.getCombatContext.mockResolvedValue({});
    damageUtils.getTargetFromAttacker.mockReturnValue({ name: 'Orc' });

    await handle(counterAction(), stats, campaignName, undefined);

    expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(playerName, 'gloriousDefenseUses', 4, campaignName);
  });

  it('should use minimum 1 uses when CHA is negative for counter_attack', async () => {
    runtimeState.getRuntimeValue.mockImplementation((_name, key) => {
      if (key === 'gloriousDefenseUses') return null;
      return null;
    });
    const stats = makePlayerStats({ abilities: [{ name: 'Charisma', bonus: -2 }] });
    damageUtils.getCombatContext.mockResolvedValue({});
    damageUtils.getTargetFromAttacker.mockReturnValue({ name: 'Orc' });

    await handle(counterAction(), stats, campaignName, undefined);

    expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(playerName, 'gloriousDefenseUses', 0, campaignName);
  });
});

describe('gloriousDefenseHandler.handle — unknown effect', () => {
  it('should default to ac_bonus behavior when effect is unknown', async () => {
    const unknownAction = makeAction({ automation: { ...makeAction().automation, effect: 'some_unknown_effect' } });

    const result = await handle(unknownAction, makePlayerStats(), campaignName, undefined);

    expect(result.type).toBe('popup');
    expect(result.payload.name).toBe('Glorious Defense');
    expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(playerName, 'gloriousDefenseActive', true, campaignName);
  });
});

describe('gloriousDefenseHandler.hasGloriousDefenseActive', () => {
  it('should return true when passive matches name and effect, false otherwise', () => {
    const stats = {
      automation: {
        passives: [
          { name: 'Glorious Defense', effect: 'glorious_defense_ac' },
          { name: 'Other', effect: 'other' },
        ],
      },
    };
    expect(hasGloriousDefenseActive(stats)).toBe(true);

    const wrongEffect = {
      automation: {
        passives: [{ name: 'Glorious Defense', effect: 'wrong_effect' }],
      },
    };
    expect(hasGloriousDefenseActive(wrongEffect)).toBe(false);

    expect(hasGloriousDefenseActive(null)).toBe(false);
    expect(hasGloriousDefenseActive(undefined)).toBe(false);
    expect(hasGloriousDefenseActive({})).toBe(false);
    expect(hasGloriousDefenseActive({ automation: {} })).toBe(false);
    expect(hasGloriousDefenseActive({ automation: { passives: null } })).toBe(false);
  });
});
