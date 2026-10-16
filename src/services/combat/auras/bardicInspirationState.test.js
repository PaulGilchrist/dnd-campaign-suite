// @maintained-by-ai
// bardicInspirationState lane — unit home for the granted-inspiration runtime
// readers (consumers: BardicInspirationReactionModal, useLoggedDiceRollAttack/
// Damage hooks, which mock this module in their own lanes).
// Constitution pins:
// - No wall-clock anywhere in this module (grep-verified: no Date.now /
//   setTimeout / setInterval). Inspiration offers wait indefinitely; state only
//   moves at explicit seams (grant → runtime keys, consume → clearBardicInspiration
//   from the reaction modal). Purity test below proves readers never mutate state.
// - Runtime keys are the envelope: bardicInspirationDie / GrantedBy /
//   CombatOptions / Uses. Per-key mockImplementation pins them by name, so
//   tests survive call-order refactors that positional Once-chains would not.
// - Die-size ladder verified against disk, not fabricated: 5e Bard stores the
//   die in class_specific.bardic_inspiration_die, 2024 Bard in bardic_die —
//   one dataset exercises each branch (d6 → d8@5 → d10@10 → d12@15).
// - Uses envelope is dual-shape: plain number or { current }; _trackedResources
//   is the last-resort fallback when the runtime uses key is null.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

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

import classes5e from '../../../../public/data/classes.json';
import classes2024 from '../../../../public/data/2024/classes.json';

// Runtime store stand-in: mutable per-key map, read by exact key.
let runtime;
let warnSpy;

beforeEach(() => {
  vi.resetAllMocks();
  runtime = {};
  getRuntimeValue.mockImplementation((_name, key) => runtime[key]);
  warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  warnSpy.mockRestore();
});

const bard = (extra = {}) => ({
  name: 'BardPlayer',
  class: { name: 'Bard' },
  level: 1,
  ...extra,
});

describe('hasBardicInspiration', () => {
  it('is true iff the bardicInspirationDie key holds a truthy value', () => {
    for (const [die, expected] of [['d6', true], [6, true], [null, false], [undefined, false], ['', false]]) {
      runtime.bardicInspirationDie = die;
      expect(hasBardicInspiration('BardPlayer', 'Campaign')).toBe(expected);
    }
    expect(getRuntimeValue).toHaveBeenCalledWith('BardPlayer', 'bardicInspirationDie', 'Campaign');
  });
});

describe('hasBardicInspirationDefense', () => {
  it('grants defense when a granted die carries the defense_add_to_ac option', () => {
    Object.assign(runtime, {
      bardicInspirationDie: 'd6',
      bardicInspirationCombatOptions: JSON.stringify(['defense_add_to_ac']),
    });
    expect(hasBardicInspirationDefense('BardPlayer', 'Campaign', null)).toBe(true);
    // options key + campaign pinned on the granted path
    expect(getRuntimeValue).toHaveBeenCalledWith('BardPlayer', 'bardicInspirationCombatOptions', 'Campaign');
  });

  it('denies defense when the granted die options lack defense_add_to_ac', () => {
    runtime.bardicInspirationDie = 'd6';
    for (const options of [JSON.stringify(['offense_add_to_damage']), JSON.stringify([])]) {
      runtime.bardicInspirationCombatOptions = options;
      expect(hasBardicInspirationDefense('BardPlayer', 'Campaign', null)).toBe(false);
    }
  });

  it('unparseable combatOptions fail closed (no defense) with a warning, never a throw', () => {
    Object.assign(runtime, {
      bardicInspirationDie: 'd6',
      bardicInspirationCombatOptions: 'not valid json',
    });
    expect(hasBardicInspirationDefense('BardPlayer', 'Campaign', null)).toBe(false);
    expect(warnSpy).toHaveBeenCalled();
  });

  it('without a granted die, a Bard with uses left qualifies — number or { current } envelope, zero never', () => {
    const cases = [[3, true], [0, false], [{ current: 2 }, true], [{ current: 0 }, false]];
    for (const [uses, expected] of cases) {
      runtime.bardicInspirationUses = uses;
      expect(hasBardicInspirationDefense('BardPlayer', 'Campaign', bard())).toBe(expected);
    }
    expect(getRuntimeValue).toHaveBeenCalledWith('BardPlayer', 'bardicInspirationUses', 'Campaign');
  });

  it('falls back to _trackedResources only when the runtime uses key is null', () => {
    runtime.bardicInspirationUses = null;
    for (const [current, expected] of [[1, true], [0, false]]) {
      const stats = bard({ _trackedResources: { bardicInspirationUses: { current } } });
      expect(hasBardicInspirationDefense('BardPlayer', 'Campaign', stats)).toBe(expected);
    }
  });

  it('without a granted die, non-Bards and missing stats never qualify — even with uses on the key', () => {
    runtime.bardicInspirationUses = 5;
    expect(hasBardicInspirationDefense('BardPlayer', 'Campaign', null)).toBe(false);
    expect(hasBardicInspirationDefense('Fighter', 'Campaign', { name: 'Fighter', class: { name: 'Fighter' } })).toBe(false);
  });
});

describe('hasBardicInspirationOffense', () => {
  it('grants offense from runtime die + offense_add_to_damage, reading all three keys exactly', () => {
    Object.assign(runtime, {
      bardicInspirationDie: 'd6',
      bardicInspirationCombatOptions: JSON.stringify(['offense_add_to_damage']),
      bardicInspirationUses: 2,
    });
    expect(hasBardicInspirationOffense(bard(), 'Campaign')).toBe(true);
    for (const key of ['bardicInspirationDie', 'bardicInspirationCombatOptions', 'bardicInspirationUses']) {
      expect(getRuntimeValue).toHaveBeenCalledWith('BardPlayer', key, 'Campaign');
    }
  });

  it('without runtime offense, Bard uses qualify above zero and not at zero', () => {
    runtime.bardicInspirationCombatOptions = JSON.stringify([]);
    for (const [uses, expected] of [[{ current: 2 }, true], [3, true], [0, false]]) {
      runtime.bardicInspirationUses = uses;
      expect(hasBardicInspirationOffense(bard(), 'Campaign')).toBe(expected);
    }
  });

  it('non-Bard uses never grant offense (class gate, not just the uses count)', () => {
    Object.assign(runtime, {
      bardicInspirationCombatOptions: JSON.stringify([]),
      bardicInspirationUses: 5,
    });
    expect(hasBardicInspirationOffense({ name: 'Fighter', class: { name: 'Fighter' } }, 'Campaign')).toBe(false);
  });

  it('unparseable combatOptions fail closed when there are no Bard uses', () => {
    Object.assign(runtime, {
      bardicInspirationDie: 'd6',
      bardicInspirationCombatOptions: 'invalid json',
      bardicInspirationUses: 0,
    });
    expect(hasBardicInspirationOffense(bard(), 'Campaign')).toBe(false);
    expect(warnSpy).toHaveBeenCalled();
  });
});

describe('getBardicInspirationDieSize', () => {
  it('parses dX/number-string/plain-number dice to their numeric size; everything else is null', () => {
    const cases = [
      ['d4', 4], ['d6', 6], ['d8', 8], ['d10', 10], ['d12', 12], ['d20', 20],
      ['1d6', 6], [8, 8],
      [null, null], [undefined, null], ['', null], [0, null], [-4, null], ['invalid', null],
    ];
    for (const [die, expected] of cases) {
      runtime.bardicInspirationDie = die;
      expect(getBardicInspirationDieSize('BardPlayer', 'Campaign')).toBe(expected);
    }
    expect(getRuntimeValue).toHaveBeenCalledWith('BardPlayer', 'bardicInspirationDie', 'Campaign');
  });
});

describe('getBardicInspirationDieSizeFromClass', () => {
  const bard5e = classes5e.find((c) => c.name === 'Bard');
  const bard2024 = classes2024.find((c) => c.name === 'Bard');

  it('walks the disk Bard ladder d6 → d8@5 → d10@10 → d12@15 on both rulesets', () => {
    // 5e disk stores the die in class_specific.bardic_inspiration_die...
    expect(bard5e.class_levels.find((cl) => cl.level === 1).bardic_die).toBeUndefined();
    // ...2024 disk stores it in bardic_die — one dataset per source branch.
    expect(bard2024.class_levels.find((cl) => cl.level === 1).bardic_die).toBeDefined();

    for (const [level, die] of [[1, 6], [4, 6], [5, 8], [9, 8], [10, 10], [14, 10], [15, 12], [20, 12]]) {
      expect(getBardicInspirationDieSizeFromClass({ class: bard5e, level })).toBe(die);
      expect(getBardicInspirationDieSizeFromClass({ class: bard2024, level })).toBe(die);
    }
  });

  it('returns null for missing stats, missing class data, or no class_level matching the level', () => {
    for (const stats of [null, undefined, {}, { class: {} }, { class: { class_levels: [{ level: 2, bardic_die: 6 }] }, level: 5 }]) {
      expect(getBardicInspirationDieSizeFromClass(stats)).toBe(null);
    }
  });

  it('prefers bardic_die over class_specific, and treats a zero die on either key as none', () => {
    expect(getBardicInspirationDieSizeFromClass({
      class: { class_levels: [{ level: 1, bardic_die: 4, class_specific: { bardic_inspiration_die: 6 } }] },
      level: 1,
    })).toBe(4);
    // bardic_die 0 falls through to class_specific...
    expect(getBardicInspirationDieSizeFromClass({
      class: { class_levels: [{ level: 1, bardic_die: 0, class_specific: { bardic_inspiration_die: 6 } }] },
      level: 1,
    })).toBe(6);
    // ...and if both are zero/absent, there is no die.
    expect(getBardicInspirationDieSizeFromClass({
      class: { class_levels: [{ level: 1, bardic_die: 0, class_specific: { bardic_inspiration_die: 0 } }] },
      level: 1,
    })).toBe(null);
  });
});

describe('getBardicInspirationGrantedBy', () => {
  it('reports the granting bard from the grantedBy key, "unknown" when nothing is recorded', () => {
    for (const [grantedBy, expected] of [['AllyBard', 'AllyBard'], [null, 'unknown'], [undefined, 'unknown'], ['', 'unknown']]) {
      runtime.bardicInspirationGrantedBy = grantedBy;
      expect(getBardicInspirationGrantedBy('BardPlayer', 'Campaign')).toBe(expected);
    }
    expect(getRuntimeValue).toHaveBeenCalledWith('BardPlayer', 'bardicInspirationGrantedBy', 'Campaign');
  });
});

describe('clearBardicInspiration', () => {
  it('nulls the full granted-inspiration envelope — exactly three writes, no more', () => {
    clearBardicInspiration('BardPlayer', 'Campaign');
    expect(setRuntimeValue.mock.calls).toEqual([
      ['BardPlayer', 'bardicInspirationDie', null, 'Campaign'],
      ['BardPlayer', 'bardicInspirationGrantedBy', null, 'Campaign'],
      ['BardPlayer', 'bardicInspirationCombatOptions', null, 'Campaign'],
    ]);
  });
});

describe('purity of inspiration queries', () => {
  it('status readers never write to the runtime store — offers wait indefinitely, consumption is the modal\'s explicit clear', () => {
    Object.assign(runtime, { bardicInspirationDie: 'd8', bardicInspirationUses: 2 });
    hasBardicInspiration('BardPlayer', 'Campaign');
    hasBardicInspirationDefense('BardPlayer', 'Campaign', bard());
    hasBardicInspirationOffense(bard(), 'Campaign');
    getBardicInspirationDieSize('BardPlayer', 'Campaign');
    getBardicInspirationGrantedBy('BardPlayer', 'Campaign');
    expect(setRuntimeValue).not.toHaveBeenCalled();
  });
});
