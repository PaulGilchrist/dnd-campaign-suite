// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ───────────────────────────────────────────────────────

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => {
  const getRuntimeValue = vi.fn();
  const setRuntimeValue = vi.fn();
  return { getRuntimeValue, setRuntimeValue };
});

// ── Imports ─────────────────────────────────────────────────────

import {
  hasBardicInspiration,
  hasBardicInspirationDefense,
  hasBardicInspirationOffense,
  getBardicInspirationDieSize,
  getBardicInspirationDieSizeFromClass,
  getBardicInspirationGrantedBy,
  clearBardicInspiration,
} from './bardicInspirationState.js';

import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';

// ── Helpers ─────────────────────────────────────────────────────

function makeBardStats(extra = {}) {
  return {
    class: { name: 'Bard' },
    level: 1,
    class_levels: [],
    _trackedResources: extra._trackedResources ?? null,
    name: 'BardPlayer',
    ...extra,
  };
}

// ── hasBardicInspiration ────────────────────────────────────────

describe('hasBardicInspiration', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns true when bardicInspirationDie is set to a truthy value', () => {
    getRuntimeValue.mockReturnValue('d6');
    expect(hasBardicInspiration('BardPlayer', 'Campaign')).toBe(true);

    getRuntimeValue.mockReturnValue(6);
    expect(hasBardicInspiration('BardPlayer', 'Campaign')).toBe(true);
  });

  it('returns false when bardicInspirationDie is null', () => {
    getRuntimeValue.mockReturnValue(null);
    expect(hasBardicInspiration('BardPlayer', 'Campaign')).toBe(false);
  });

  it('returns false when bardicInspirationDie is undefined', () => {
    getRuntimeValue.mockReturnValue(undefined);
    expect(hasBardicInspiration('BardPlayer', 'Campaign')).toBe(false);
  });

  it('returns false when bardicInspirationDie is an empty string', () => {
    getRuntimeValue.mockReturnValue('');
    expect(hasBardicInspiration('BardPlayer', 'Campaign')).toBe(false);
  });

  it('passes name and campaignName to getRuntimeValue', () => {
    getRuntimeValue.mockReturnValue('d6');
    hasBardicInspiration('TestBard', 'TestCampaign');
    expect(getRuntimeValue).toHaveBeenCalledWith('TestBard', 'bardicInspirationDie', 'TestCampaign');
  });
});

// ── hasBardicInspirationDefense ─────────────────────────────────

describe('hasBardicInspirationDefense', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns false when hasBardicInspiration returns false and playerStats is null', () => {
    // hasBardicInspiration calls getRuntimeValue once, then defense path checks bardicInspirationUses
    getRuntimeValue
      .mockReturnValueOnce(null)   // hasBardicInspiration check (die = null => false)
      .mockReturnValueOnce(null);  // bardicInspirationUses
    expect(hasBardicInspirationDefense('BardPlayer', 'Campaign', null)).toBe(false);
  });

  it('returns false when hasBardicInspiration returns false and playerStats has no class', () => {
    getRuntimeValue
      .mockReturnValueOnce(null)   // hasBardicInspiration check
      .mockReturnValueOnce(2);    // bardicInspirationUses
    const stats = { class: null };
    expect(hasBardicInspirationDefense('BardPlayer', 'Campaign', stats)).toBe(false);
  });

  it('returns false when hasBardicInspiration returns false and playerStats class is not Bard', () => {
    getRuntimeValue
      .mockReturnValueOnce(null)   // hasBardicInspiration check
      .mockReturnValueOnce(2);    // bardicInspirationUses
    const stats = { class: { name: 'Fighter' } };
    expect(hasBardicInspirationDefense('BardPlayer', 'Campaign', stats)).toBe(false);
  });

  it('returns false when hasBardicInspiration returns false, is Bard, but uses are 0', () => {
    getRuntimeValue
      .mockReturnValueOnce(null)   // hasBardicInspiration check
      .mockReturnValueOnce(0);    // bardicInspirationUses
    const stats = makeBardStats();
    expect(hasBardicInspirationDefense('BardPlayer', 'Campaign', stats)).toBe(false);
  });

  it('returns true when hasBardicInspiration returns false, is Bard, and uses > 0 (number)', () => {
    getRuntimeValue
      .mockReturnValueOnce(null)   // hasBardicInspiration check
      .mockReturnValueOnce(3);    // bardicInspirationUses
    const stats = makeBardStats();
    expect(hasBardicInspirationDefense('BardPlayer', 'Campaign', stats)).toBe(true);
  });

  it('returns true when hasBardicInspiration returns false, is Bard, and uses > 0 (object with current)', () => {
    getRuntimeValue
      .mockReturnValueOnce(null)   // hasBardicInspiration check
      .mockReturnValueOnce({ current: 2 });  // bardicInspirationUses
    const stats = makeBardStats();
    expect(hasBardicInspirationDefense('BardPlayer', 'Campaign', stats)).toBe(true);
  });

  it('falls back to _trackedResources when bardicInspirationUses is null', () => {
    getRuntimeValue
      .mockReturnValueOnce(null)   // hasBardicInspiration check
      .mockReturnValueOnce(null);  // bardicInspirationUses
    const stats = makeBardStats({
      _trackedResources: { bardicInspirationUses: { current: 1 } },
    });
    expect(hasBardicInspirationDefense('BardPlayer', 'Campaign', stats)).toBe(true);
  });

  it('returns false when hasBardicInspiration returns false, is Bard, but _trackedResources has 0 uses', () => {
    getRuntimeValue
      .mockReturnValueOnce(null)   // hasBardicInspiration check
      .mockReturnValueOnce(null);  // bardicInspirationUses
    const stats = makeBardStats({
      _trackedResources: { bardicInspirationUses: { current: 0 } },
    });
    expect(hasBardicInspirationDefense('BardPlayer', 'Campaign', stats)).toBe(false);
  });

  it('returns true when bardicInspirationDie exists and combatOptions includes defense_add_to_ac', () => {
    getRuntimeValue
      .mockReturnValueOnce('d6')       // hasBardicInspiration check (die exists => true)
      .mockReturnValueOnce(JSON.stringify(['defense_add_to_ac']));  // combatOptions
    expect(hasBardicInspirationDefense('BardPlayer', 'Campaign', null)).toBe(true);
  });

  it('returns false when bardicInspirationDie exists but combatOptions does not include defense_add_to_ac', () => {
    getRuntimeValue
      .mockReturnValueOnce('d6')       // hasBardicInspiration check
      .mockReturnValueOnce(JSON.stringify(['offense_add_to_damage']));  // combatOptions
    expect(hasBardicInspirationDefense('BardPlayer', 'Campaign', null)).toBe(false);
  });

  it('returns false when bardicInspirationDie exists but combatOptions is empty array', () => {
    getRuntimeValue
      .mockReturnValueOnce('d6')       // hasBardicInspiration check
      .mockReturnValueOnce(JSON.stringify([]));  // combatOptions
    expect(hasBardicInspirationDefense('BardPlayer', 'Campaign', null)).toBe(false);
  });

  it('handles invalid JSON in combatOptions gracefully', () => {
    getRuntimeValue
      .mockReturnValueOnce('d6')       // hasBardicInspiration check
      .mockReturnValueOnce('not valid json');  // combatOptions
    expect(hasBardicInspirationDefense('BardPlayer', 'Campaign', null)).toBe(false);
  });

  it('passes name and campaignName to getRuntimeValue', () => {
    getRuntimeValue
      .mockReturnValueOnce('d6')
      .mockReturnValueOnce(JSON.stringify(['defense_add_to_ac']));
    hasBardicInspirationDefense('TestBard', 'TestCampaign', null);
    expect(getRuntimeValue).toHaveBeenCalledWith('TestBard', 'bardicInspirationDie', 'TestCampaign');
  });
});

// ── hasBardicInspirationOffense ─────────────────────────────────

describe('hasBardicInspirationOffense', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns true when runtimeDie exists and combatOptions includes offense_add_to_damage', () => {
    getRuntimeValue
      .mockReturnValueOnce('d6')                    // bardicInspirationDie
      .mockReturnValueOnce(JSON.stringify(['offense_add_to_damage']))  // bardicInspirationCombatOptions
      .mockReturnValueOnce(2);                      // bardicInspirationUses
    const stats = makeBardStats();
    expect(hasBardicInspirationOffense(stats, 'Campaign')).toBe(true);
  });

  it('returns true when is Bard and biUsesNum > 0 even without runtime offense', () => {
    getRuntimeValue
      .mockReturnValueOnce('d6')                    // bardicInspirationDie
      .mockReturnValueOnce(JSON.stringify([]))      // bardicInspirationCombatOptions (no offense)
      .mockReturnValueOnce(3);                      // bardicInspirationUses
    const stats = makeBardStats();
    expect(hasBardicInspirationOffense(stats, 'Campaign')).toBe(true);
  });

  it('returns true when is Bard and biUsesNum > 0 with object format', () => {
    getRuntimeValue
      .mockReturnValueOnce(null)                    // bardicInspirationDie (null)
      .mockReturnValueOnce(JSON.stringify([]))      // bardicInspirationCombatOptions
      .mockReturnValueOnce({ current: 2 });         // bardicInspirationUses
    const stats = makeBardStats();
    expect(hasBardicInspirationOffense(stats, 'Campaign')).toBe(true);
  });

  it('returns false when runtimeDie is missing and combatOptions lacks offense_add_to_damage', () => {
    getRuntimeValue
      .mockReturnValueOnce(null)                    // bardicInspirationDie
      .mockReturnValueOnce(JSON.stringify([]))      // bardicInspirationCombatOptions
      .mockReturnValueOnce(0);                      // bardicInspirationUses
    const stats = makeBardStats();
    expect(hasBardicInspirationOffense(stats, 'Campaign')).toBe(false);
  });

  it('returns false when playerStats class is not Bard and no runtime offense', () => {
    getRuntimeValue
      .mockReturnValueOnce(null)                    // bardicInspirationDie
      .mockReturnValueOnce(JSON.stringify([]))      // bardicInspirationCombatOptions
      .mockReturnValueOnce(5);                      // bardicInspirationUses
    const stats = { class: { name: 'Fighter' }, name: 'FighterPlayer' };
    expect(hasBardicInspirationOffense(stats, 'Campaign')).toBe(false);
  });

  it('returns false when both runtime offense and bard uses are absent/zero', () => {
    getRuntimeValue
      .mockReturnValueOnce(null)                    // bardicInspirationDie
      .mockReturnValueOnce(JSON.stringify([]))      // bardicInspirationCombatOptions
      .mockReturnValueOnce(0);                      // bardicInspirationUses
    const stats = makeBardStats();
    expect(hasBardicInspirationOffense(stats, 'Campaign')).toBe(false);
  });

  it('handles invalid JSON in combatOptions gracefully', () => {
    getRuntimeValue
      .mockReturnValueOnce('d6')                    // bardicInspirationDie
      .mockReturnValueOnce('invalid json')          // bardicInspirationCombatOptions
      .mockReturnValueOnce(0);                      // bardicInspirationUses
    const stats = makeBardStats();
    expect(hasBardicInspirationOffense(stats, 'Campaign')).toBe(false);
  });

  it('passes playerStats.name and campaignName to getRuntimeValue', () => {
    getRuntimeValue
      .mockReturnValueOnce('d6')
      .mockReturnValueOnce(JSON.stringify(['offense_add_to_damage']))
      .mockReturnValueOnce(1);
    const stats = makeBardStats();
    hasBardicInspirationOffense(stats, 'TestCampaign');
    expect(getRuntimeValue).toHaveBeenCalledWith('BardPlayer', 'bardicInspirationDie', 'TestCampaign');
  });
});

// ── getBardicInspirationDieSize ─────────────────────────────────

describe('getBardicInspirationDieSize', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns null when die is null', () => {
    getRuntimeValue.mockReturnValue(null);
    expect(getBardicInspirationDieSize('BardPlayer', 'Campaign')).toBe(null);
  });

  it('returns null when die is undefined', () => {
    getRuntimeValue.mockReturnValue(undefined);
    expect(getBardicInspirationDieSize('BardPlayer', 'Campaign')).toBe(null);
  });

  it('returns the numeric value when die is a number string like "d6"', () => {
    getRuntimeValue.mockReturnValue('d6');
    expect(getBardicInspirationDieSize('BardPlayer', 'Campaign')).toBe(6);
  });

  it('returns the numeric value when die is a number string like "d20"', () => {
    getRuntimeValue.mockReturnValue('d20');
    expect(getBardicInspirationDieSize('BardPlayer', 'Campaign')).toBe(20);
  });

  it('returns the numeric value when die is a plain number', () => {
    getRuntimeValue.mockReturnValue(8);
    expect(getBardicInspirationDieSize('BardPlayer', 'Campaign')).toBe(8);
  });

  it('returns null when die string does not match d{number} pattern and is not a plain number', () => {
    getRuntimeValue.mockReturnValue('invalid');
    expect(getBardicInspirationDieSize('BardPlayer', 'Campaign')).toBe(null);
  });

  it('extracts the number from "1d6" via regex match returning 6', () => {
    getRuntimeValue.mockReturnValue('1d6');
    expect(getBardicInspirationDieSize('BardPlayer', 'Campaign')).toBe(6);
  });

  it('returns null when numeric die is 0 or negative', () => {
    getRuntimeValue.mockReturnValue(0);
    expect(getBardicInspirationDieSize('BardPlayer', 'Campaign')).toBe(null);

    getRuntimeValue.mockReturnValue(-4);
    expect(getBardicInspirationDieSize('BardPlayer', 'Campaign')).toBe(null);
  });

  it('converts die string "d4" to 4, "d8" to 8, "d10" to 10, "d12" to 12', () => {
    getRuntimeValue.mockReturnValue('d4');
    expect(getBardicInspirationDieSize('BardPlayer', 'Campaign')).toBe(4);

    getRuntimeValue.mockReturnValue('d8');
    expect(getBardicInspirationDieSize('BardPlayer', 'Campaign')).toBe(8);

    getRuntimeValue.mockReturnValue('d10');
    expect(getBardicInspirationDieSize('BardPlayer', 'Campaign')).toBe(10);

    getRuntimeValue.mockReturnValue('d12');
    expect(getBardicInspirationDieSize('BardPlayer', 'Campaign')).toBe(12);
  });

  it('passes name and campaignName to getRuntimeValue', () => {
    getRuntimeValue.mockReturnValue('d6');
    getBardicInspirationDieSize('TestBard', 'TestCampaign');
    expect(getRuntimeValue).toHaveBeenCalledWith('TestBard', 'bardicInspirationDie', 'TestCampaign');
  });
});

// ── getBardicInspirationDieSizeFromClass ────────────────────────

describe('getBardicInspirationDieSizeFromClass', () => {
  it('returns null when playerStats is null', () => {
    expect(getBardicInspirationDieSizeFromClass(null)).toBe(null);
  });

  it('returns null when playerStats is undefined', () => {
    expect(getBardicInspirationDieSizeFromClass(undefined)).toBe(null);
  });

  it('returns null when playerStats.class is missing', () => {
    expect(getBardicInspirationDieSizeFromClass({})).toBe(null);
  });

  it('returns null when playerStats.class.class_levels is missing', () => {
    expect(getBardicInspirationDieSizeFromClass({ class: {} })).toBe(null);
  });

  it('returns null when no class_level matches the player level', () => {
    const stats = {
      class: { class_levels: [{ level: 2, bardic_die: 6 }] },
      level: 5,
    };
    expect(getBardicInspirationDieSizeFromClass(stats)).toBe(null);
  });

  it('returns bardic_die when a matching class_level exists', () => {
    const stats = {
      class: { class_levels: [{ level: 1, bardic_die: 4 }, { level: 2, bardic_die: 6 }] },
      level: 1,
    };
    expect(getBardicInspirationDieSizeFromClass(stats)).toBe(4);
  });

  it('returns the die size for level 2', () => {
    const stats = {
      class: { class_levels: [{ level: 1, bardic_die: 4 }, { level: 2, bardic_die: 6 }] },
      level: 2,
    };
    expect(getBardicInspirationDieSizeFromClass(stats)).toBe(6);
  });

  it('returns class_specific.bardic_inspiration_die when bardic_die is missing', () => {
    const stats = {
      class: {
        class_levels: [
          { level: 1, class_specific: { bardic_inspiration_die: 6 } },
        ],
      },
      level: 1,
    };
    expect(getBardicInspirationDieSizeFromClass(stats)).toBe(6);
  });

  it('prefers bardic_die over class_specific.bardic_inspiration_die', () => {
    const stats = {
      class: {
        class_levels: [
          { level: 1, bardic_die: 4, class_specific: { bardic_inspiration_die: 6 } },
        ],
      },
      level: 1,
    };
    expect(getBardicInspirationDieSizeFromClass(stats)).toBe(4);
  });

  it('returns null when bardic_die is 0', () => {
    const stats = {
      class: { class_levels: [{ level: 1, bardic_die: 0 }] },
      level: 1,
    };
    expect(getBardicInspirationDieSizeFromClass(stats)).toBe(null);
  });

  it('returns null when class_specific.bardic_inspiration_die is 0', () => {
    const stats = {
      class: {
        class_levels: [
          { level: 1, class_specific: { bardic_inspiration_die: 0 } },
        ],
      },
      level: 1,
    };
    expect(getBardicInspirationDieSizeFromClass(stats)).toBe(null);
  });
});

// ── getBardicInspirationGrantedBy ───────────────────────────────

describe('getBardicInspirationGrantedBy', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns the grantedBy value from runtime when present', () => {
    getRuntimeValue.mockReturnValue('AllyBard');
    expect(getBardicInspirationGrantedBy('BardPlayer', 'Campaign')).toBe('AllyBard');
  });

  it('returns "unknown" when grantedBy is null', () => {
    getRuntimeValue.mockReturnValue(null);
    expect(getBardicInspirationGrantedBy('BardPlayer', 'Campaign')).toBe('unknown');
  });

  it('returns "unknown" when grantedBy is undefined', () => {
    getRuntimeValue.mockReturnValue(undefined);
    expect(getBardicInspirationGrantedBy('BardPlayer', 'Campaign')).toBe('unknown');
  });

  it('passes name and campaignName to getRuntimeValue', () => {
    getRuntimeValue.mockReturnValue('TestGiver');
    getBardicInspirationGrantedBy('TestPlayer', 'TestCampaign');
    expect(getRuntimeValue).toHaveBeenCalledWith('TestPlayer', 'bardicInspirationGrantedBy', 'TestCampaign');
  });
});

// ── clearBardicInspiration ──────────────────────────────────────

describe('clearBardicInspiration', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('calls setRuntimeValue three times with null for all bardic inspiration keys', () => {
    clearBardicInspiration('BardPlayer', 'Campaign');

    expect(setRuntimeValue).toHaveBeenCalledWith('BardPlayer', 'bardicInspirationDie', null, 'Campaign');
    expect(setRuntimeValue).toHaveBeenCalledWith('BardPlayer', 'bardicInspirationGrantedBy', null, 'Campaign');
    expect(setRuntimeValue).toHaveBeenCalledWith('BardPlayer', 'bardicInspirationCombatOptions', null, 'Campaign');
  });

  it('passes name and campaignName to setRuntimeValue', () => {
    clearBardicInspiration('TestBard', 'TestCampaign');
    expect(setRuntimeValue).toHaveBeenCalledWith('TestBard', 'bardicInspirationDie', null, 'TestCampaign');
  });
});
