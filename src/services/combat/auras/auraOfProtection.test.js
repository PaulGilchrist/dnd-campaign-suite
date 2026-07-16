import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../rules/combat/rangeCheck.js', () => ({
  isWithinRange: vi.fn(),
}));

import {
  CANNOT_ACT_CONDITIONS,
  DEFAULT_AURA_RANGE_FT,
  EXPANDED_AURA_RANGE_FT,
  hasAura,
  hasAuraOfProtection,
  getAuraRangeFromStats,
  getChaModifier,
  hasCannotActCondition,
  computeAuraBonus,
} from './auraOfProtection.js';

import { getRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { isWithinRange } from '../../rules/combat/rangeCheck.js';

function makeStats(extra = {}) {
  return { automation: extra.automation ?? null };
}

function makePassive(name) {
  return { name };
}

function makeSourceEntry(name, computedStats) {
  return { name, computedStats };
}

describe('constants', () => {
  it('exports CANNOT_ACT_CONDITIONS with the five incapacitating conditions', () => {
    expect(CANNOT_ACT_CONDITIONS).toEqual([
      'incapacitated', 'paralyzed', 'petrified', 'stunned', 'unconscious',
    ]);
  });

  it('exports DEFAULT_AURA_RANGE_FT as 10 and EXPANDED_AURA_RANGE_FT as 30', () => {
    expect(DEFAULT_AURA_RANGE_FT).toBe(10);
    expect(EXPANDED_AURA_RANGE_FT).toBe(30);
  });
});

describe('hasAura', () => {
  it('returns true when a passive with the matching name exists', () => {
    const stats = makeStats({ automation: { passives: [makePassive('Aura of Protection')] } });
    expect(hasAura(stats, 'Aura of Protection')).toBe(true);
  });

  it('returns false when no passive matches the given name', () => {
    const stats = makeStats({ automation: { passives: [makePassive('Divine Smite')] } });
    expect(hasAura(stats, 'Aura of Protection')).toBe(false);
  });

  it('returns false when playerStats is null or undefined', () => {
    expect(hasAura(null, 'Aura of Protection')).toBe(false);
    expect(hasAura(undefined, 'Aura of Protection')).toBe(false);
  });

  it('returns false when automation or passives is missing', () => {
    expect(hasAura(makeStats(), 'Aura of Protection')).toBe(false);
    expect(hasAura({ automation: {} }, 'Aura of Protection')).toBe(false);
    expect(hasAura({ automation: { passives: null } }, 'Aura of Protection')).toBe(false);
  });
});

describe('hasAuraOfProtection', () => {
  it('returns true when the character has the Aura of Protection passive', () => {
    const stats = makeStats({ automation: { passives: [makePassive('Aura of Protection')] } });
    expect(hasAuraOfProtection(stats)).toBe(true);
  });

  it('returns false when the character lacks the passive or stats is null', () => {
    const stats = makeStats({ automation: { passives: [makePassive('Other Aura')] } });
    expect(hasAuraOfProtection(stats)).toBe(false);
    expect(hasAuraOfProtection(null)).toBe(false);
  });
});

describe('getAuraRangeFromStats', () => {
  it('returns expanded range when Aura Expansion is present', () => {
    const stats = makeStats({
      automation: { passives: [makePassive('Aura of Protection'), makePassive('Aura Expansion')] },
    });
    expect(getAuraRangeFromStats(stats)).toBe(EXPANDED_AURA_RANGE_FT);
  });

  it('returns expanded range even without Aura of Protection', () => {
    const stats = makeStats({ automation: { passives: [makePassive('Aura Expansion')] } });
    expect(getAuraRangeFromStats(stats)).toBe(EXPANDED_AURA_RANGE_FT);
  });

  it('returns default range when Aura Expansion is absent', () => {
    const stats = makeStats({ automation: { passives: [makePassive('Some Other Feature')] } });
    expect(getAuraRangeFromStats(stats)).toBe(DEFAULT_AURA_RANGE_FT);
  });
});

describe('getChaModifier', () => {
  it('returns cha.bonus when present (including zero and negative)', () => {
    expect(getChaModifier({ abilities: [{ name: 'Charisma', bonus: 5 }] })).toBe(5);
    expect(getChaModifier({ abilities: [{ name: 'Charisma', bonus: 0 }] })).toBe(0);
    expect(getChaModifier({ abilities: [{ name: 'Charisma', bonus: -2 }] })).toBe(-2);
  });

  it('prefers cha.bonus over the computed formula', () => {
    const stats = {
      abilities: [{ name: 'Charisma', baseScore: 10, featIncrease: 0, miscIncrease: 0, bonus: 7 }],
    };
    expect(getChaModifier(stats)).toBe(7);
  });

  it('computes mod from baseScore + increases when bonus is absent', () => {
    const stats = {
      abilities: [{ name: 'Charisma', baseScore: 16, featIncrease: 0, miscIncrease: 0 }],
    };
    expect(getChaModifier(stats)).toBe(3);
  });

  it('includes featIncrease and miscIncrease in the formula and floors odd results', () => {
    const stats = {
      abilities: [{ name: 'Charisma', baseScore: 14, featIncrease: 2, miscIncrease: 2 }],
    };
    expect(getChaModifier(stats)).toBe(4);

    const statsFloored = {
      abilities: [{ name: 'Charisma', baseScore: 15, featIncrease: 0, miscIncrease: 0 }],
    };
    expect(getChaModifier(statsFloored)).toBe(2);
  });

  it('returns 0 when Charisma ability is not found or abilities is missing', () => {
    expect(getChaModifier({ abilities: [{ name: 'Strength' }] })).toBe(0);
    expect(getChaModifier({ abilities: [] })).toBe(0);
    expect(getChaModifier({})).toBe(0);
  });

  it('throws when playerStats is null', () => {
    expect(() => getChaModifier(null)).toThrow();
  });
});

describe('hasCannotActCondition', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns true for any of the incapacitating conditions', () => {
    for (const condition of CANNOT_ACT_CONDITIONS) {
      getRuntimeValue.mockReturnValue([condition]);
      expect(hasCannotActCondition('Paladin', 'Campaign')).toBe(true);
    }
  });

  it('returns false when none of the conditions match or array is empty', () => {
    getRuntimeValue.mockReturnValue(['blinded', 'poisoned']);
    expect(hasCannotActCondition('Paladin', 'Campaign')).toBe(false);
    getRuntimeValue.mockReturnValue([]);
    expect(hasCannotActCondition('Paladin', 'Campaign')).toBe(false);
  });

  it('returns false when activeConditions is not an array or getRuntimeValue throws', () => {
    getRuntimeValue.mockReturnValue(null);
    expect(hasCannotActCondition('Paladin', 'Campaign')).toBe(false);
    getRuntimeValue.mockImplementation(() => { throw new Error('runtime unavailable'); });
    expect(hasCannotActCondition('Paladin', 'Campaign')).toBe(false);
  });

  it('passes the sourceName to getRuntimeValue', () => {
    getRuntimeValue.mockReturnValue([]);
    hasCannotActCondition('Gallant', 'Quest');
    expect(getRuntimeValue).toHaveBeenCalledWith('Gallant', 'activeConditions');
  });
});

describe('computeAuraBonus', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns { bonus: 0, sourceName: null } when there are no characters or no valid aura bearers', async () => {
    expect(await computeAuraBonus({ targetName: 'Cleric', characters: [], campaignName: 'C', activeMapName: '' }))
      .toEqual({ bonus: 0, sourceName: null });

    expect(await computeAuraBonus({ targetName: 'Cleric', characters: [makeSourceEntry('', {}), makeSourceEntry('Paladin', null)], campaignName: 'C', activeMapName: '' }))
      .toEqual({ bonus: 0, sourceName: null });

    expect(await computeAuraBonus({ targetName: 'Cleric', characters: [makeSourceEntry('Wizard', { automation: { passives: [makePassive('Spell Sniper')] } })], campaignName: 'C', activeMapName: '' }))
      .toEqual({ bonus: 0, sourceName: null });
  });

  it('skips sources with a cannot-act condition', async () => {
    getRuntimeValue.mockReturnValue(['stunned']);
    const paladin = makeSourceEntry('Paladin', {
      automation: { passives: [makePassive('Aura of Protection')] },
      abilities: [{ name: 'Charisma', bonus: 5 }],
    });
    const result = await computeAuraBonus({ targetName: 'Cleric', characters: [paladin], campaignName: 'C', activeMapName: '' });
    expect(result).toEqual({ bonus: 0, sourceName: null });
  });

  it('skips sources that are out of range', async () => {
    getRuntimeValue.mockReturnValue([]);
    isWithinRange.mockResolvedValue(false);

    const paladin = makeSourceEntry('Paladin', {
      automation: { passives: [makePassive('Aura of Protection')] },
      abilities: [{ name: 'Charisma', bonus: 5 }],
    });
    const result = await computeAuraBonus({ targetName: 'Cleric', characters: [paladin], campaignName: 'C', activeMapName: 'Map' });
    expect(result).toEqual({ bonus: 0, sourceName: null });
  });

  it('returns the cha bonus from the first valid aura bearer', async () => {
    isWithinRange.mockResolvedValue(true);
    const paladin = makeSourceEntry('Paladin', {
      automation: { passives: [makePassive('Aura of Protection')] },
      abilities: [{ name: 'Charisma', bonus: 3 }],
    });
    const result = await computeAuraBonus({ targetName: 'Cleric', characters: [paladin], campaignName: 'C', activeMapName: '' });
    expect(result).toEqual({ bonus: 3, sourceName: 'Paladin' });
  });

  it('clamps negative and zero modifiers to a minimum bonus of 1', async () => {
    isWithinRange.mockResolvedValue(true);
    const negativePaladin = makeSourceEntry('Paladin', {
      automation: { passives: [makePassive('Aura of Protection')] },
      abilities: [{ name: 'Charisma', bonus: -2 }],
    });
    expect(await computeAuraBonus({ targetName: 'Cleric', characters: [negativePaladin], campaignName: 'C', activeMapName: '' }))
      .toEqual({ bonus: 1, sourceName: 'Paladin' });

    const zeroPaladin = makeSourceEntry('Paladin', {
      automation: { passives: [makePassive('Aura of Protection')] },
      abilities: [{ name: 'Charisma', bonus: 0 }],
    });
    expect(await computeAuraBonus({ targetName: 'Cleric', characters: [zeroPaladin], campaignName: 'C', activeMapName: '' }))
      .toEqual({ bonus: 1, sourceName: 'Paladin' });
  });

  it('selects the source with the highest bonus, skipping disabled or out-of-range ones', async () => {
    isWithinRange.mockResolvedValue(true);
    const p1 = makeSourceEntry('Paladin1', {
      automation: { passives: [makePassive('Aura of Protection')] },
      abilities: [{ name: 'Charisma', bonus: 2 }],
    });
    const p2 = makeSourceEntry('Paladin2', {
      automation: { passives: [makePassive('Aura of Protection')] },
      abilities: [{ name: 'Charisma', bonus: 5 }],
    });
    expect(await computeAuraBonus({ targetName: 'Cleric', characters: [p1, p2], campaignName: 'C', activeMapName: '' }))
      .toEqual({ bonus: 5, sourceName: 'Paladin2' });

    getRuntimeValue.mockReturnValueOnce(['petrified']);
    const p3 = makeSourceEntry('Paladin1', {
      automation: { passives: [makePassive('Aura of Protection')] },
      abilities: [{ name: 'Charisma', bonus: 5 }],
    });
    const p4 = makeSourceEntry('Paladin2', {
      automation: { passives: [makePassive('Aura of Protection')] },
      abilities: [{ name: 'Charisma', bonus: 8 }],
    });
    expect(await computeAuraBonus({ targetName: 'Cleric', characters: [p3, p4], campaignName: 'C', activeMapName: '' }))
      .toEqual({ bonus: 8, sourceName: 'Paladin2' });
  });

  it('computes bonus from baseScore when cha.bonus is absent', async () => {
    isWithinRange.mockResolvedValue(true);
    const paladin = makeSourceEntry('Paladin', {
      automation: { passives: [makePassive('Aura of Protection')] },
      abilities: [{ name: 'Charisma', baseScore: 18, featIncrease: 0, miscIncrease: 0 }],
    });
    const result = await computeAuraBonus({ targetName: 'Cleric', characters: [paladin], campaignName: 'C', activeMapName: '' });
    expect(result).toEqual({ bonus: 4, sourceName: 'Paladin' });
  });

  it('uses expanded aura range when source has Aura Expansion', async () => {
    getRuntimeValue.mockReturnValue([]);
    isWithinRange.mockResolvedValue(true);
    const paladin = makeSourceEntry('Paladin', {
      automation: { passives: [makePassive('Aura of Protection'), makePassive('Aura Expansion')] },
      abilities: [{ name: 'Charisma', bonus: 3 }],
    });
    const result = await computeAuraBonus({ targetName: 'Cleric', characters: [paladin], campaignName: 'C', activeMapName: 'Map' });
    expect(result).toEqual({ bonus: 3, sourceName: 'Paladin' });
    expect(isWithinRange).toHaveBeenCalledWith('Paladin', 'Cleric', 30);
  });

  it('does not call isWithinRange for characters without aura', async () => {
    const wizard = makeSourceEntry('Wizard', {
      automation: { passives: [makePassive('Spell Sniper')] },
    });
    await computeAuraBonus({ targetName: 'Cleric', characters: [wizard], campaignName: 'C', activeMapName: 'Map' });
    expect(isWithinRange).not.toHaveBeenCalled();
  });

  describe('ally filtering', () => {
    beforeEach(() => { vi.clearAllMocks(); getRuntimeValue.mockReturnValue([]); });

    it('returns { bonus: 0, sourceName: null } when selectedAllies excludes the target', async () => {
      getRuntimeValue.mockReturnValue(['OtherPlayer']);
      const paladin = makeSourceEntry('Paladin', {
        automation: { passives: [makePassive('Aura of Protection')] },
        abilities: [{ name: 'Charisma', bonus: 5 }],
      });
      const result = await computeAuraBonus({ targetName: 'Cleric', characters: [paladin], campaignName: 'C', activeMapName: '' });
      expect(result).toEqual({ bonus: 0, sourceName: null });
    });

    it('returns the bonus when selectedAllies includes the target', async () => {
      getRuntimeValue.mockReturnValue(['Cleric']);
      isWithinRange.mockResolvedValue(true);
      const paladin = makeSourceEntry('Paladin', {
        automation: { passives: [makePassive('Aura of Protection')] },
        abilities: [{ name: 'Charisma', bonus: 5 }],
      });
      const result = await computeAuraBonus({ targetName: 'Cleric', characters: [paladin], campaignName: 'C', activeMapName: '' });
      expect(result).toEqual({ bonus: 5, sourceName: 'Paladin' });
    });

    it('selects the highest bonus source whose allies include the target', async () => {
      getRuntimeValue.mockReturnValue(['Cleric']).mockReturnValue(['Cleric']);
      isWithinRange.mockResolvedValue(true);
      const p1 = makeSourceEntry('Paladin1', {
        automation: { passives: [makePassive('Aura of Protection')] },
        abilities: [{ name: 'Charisma', bonus: 2 }],
      });
      const p2 = makeSourceEntry('Paladin2', {
        automation: { passives: [makePassive('Aura of Protection')] },
        abilities: [{ name: 'Charisma', bonus: 5 }],
      });
      const result = await computeAuraBonus({ targetName: 'Cleric', characters: [p1, p2], campaignName: 'C', activeMapName: '' });
      expect(result).toEqual({ bonus: 5, sourceName: 'Paladin2' });
    });

    it('skips sources where allies list excludes the target but includes others', async () => {
      getRuntimeValue.mockImplementation((name, key) => {
        if (name === 'Paladin1' && key === 'selectedAllies') return ['Wizard'];
        if (name === 'Paladin2' && key === 'selectedAllies') return ['Cleric'];
        return undefined;
      });
      isWithinRange.mockResolvedValue(true);
      const p1 = makeSourceEntry('Paladin1', {
        automation: { passives: [makePassive('Aura of Protection')] },
        abilities: [{ name: 'Charisma', bonus: 5 }],
      });
      const p2 = makeSourceEntry('Paladin2', {
        automation: { passives: [makePassive('Aura of Protection')] },
        abilities: [{ name: 'Charisma', bonus: 3 }],
      });
      const result = await computeAuraBonus({ targetName: 'Cleric', characters: [p1, p2], campaignName: 'C', activeMapName: '' });
      expect(result).toEqual({ bonus: 3, sourceName: 'Paladin2' });
    });

    it('falls back to no ally filtering when selectedAllies is null', async () => {
      getRuntimeValue.mockReturnValue(null);
      isWithinRange.mockResolvedValue(true);
      const paladin = makeSourceEntry('Paladin', {
        automation: { passives: [makePassive('Aura of Protection')] },
        abilities: [{ name: 'Charisma', bonus: 5 }],
      });
      const result = await computeAuraBonus({ targetName: 'Cleric', characters: [paladin], campaignName: 'C', activeMapName: '' });
      expect(result).toEqual({ bonus: 5, sourceName: 'Paladin' });
    });

    it('falls back to no ally filtering when selectedAllies is empty', async () => {
      getRuntimeValue.mockReturnValue([]);
      isWithinRange.mockResolvedValue(true);
      const paladin = makeSourceEntry('Paladin', {
        automation: { passives: [makePassive('Aura of Protection')] },
        abilities: [{ name: 'Charisma', bonus: 5 }],
      });
      const result = await computeAuraBonus({ targetName: 'Cleric', characters: [paladin], campaignName: 'C', activeMapName: '' });
      expect(result).toEqual({ bonus: 5, sourceName: 'Paladin' });
    });
  });
});
