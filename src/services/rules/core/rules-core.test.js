// @maintained-by-ai
// Composition-contract lane for the rules.js facade and rules-core.js module selection.
// This file pins ONLY wiring that sub-modules cannot see (bundle identity, passthrough
// identity, dispatch seams). Sub-module math is owned elsewhere and is NOT re-executed
// through the facade here:
//   - 5e ability math canon: abilityCalc.test.js (:76-86 skill attachment, :105-128 save
//     breakpoints, :130-147 Primal Champion lv20-only, :149-171 totalScore incl. racial,
//     :172-187 expertise, :188 missing saving_throws)
//   - 2024 ability math: abilityCalc2024.test.js; AC rows: rules-armorClass.test.js /
//     rules-armorClass-2024.test.js; action merge/sort: rules-actions.test.js
//   - ruleset precedence (playerStats.rules over playerSummary.rules, fallback, default):
//     rules.test.js:154-177 and rules.helpers.test.js — folded out of this file.
// No vi.mock here: rules.js transitively loads the whole graph anyway, and every mock in
// the old version of this file existed only to stub-echo internals back at themselves.
import { describe, it, expect } from 'vitest';

import rules from '../rules.js';
import utils from '../../ui/utils.js';
import { getSpellMaxLevel } from '../../shared/spell-utils.js';
import { getActions } from '../rules-actions.js';
import { getProficiencies } from '../rules-proficiencies.js';
import { getArmorClass } from '../rules-armorClass.js';
import { getLanguages } from '../rules-languages.js';
import { getMagicItems } from '../rules-magicItems.js';
import { getAbilities as getAbilities5e, getHitPoints as getHitPoints5e } from './abilityCalc.js';
import { getAbilities as getAbilities2024 } from './abilityCalc2024.js';
import { getSpellAbilities as getSpellAbilities5e } from './spellCalc.js';
import { getSpellAbilities as getSpellAbilities2024 } from './spellCalc2024.js';
import { getAttacks as getAttacks5e } from './attackCalc.js';
import { getAttacks as getAttacks2024 } from './attackCalc2024.js';
import * as proficiencyUtils from '../../character/proficiencyUtils.js';
import * as proficiencyUtils2024 from '../../character/proficiencyUtils2024.js';
import classRules from '../../character/classRules.js';
import classRules2024 from '../../character/classRules2024.js';
import { rules5e, rules2024 } from '../../character/race-rules/index.js';

describe('rules facade composition contract', () => {
  it('getSubModules wires the real 5e implementation bundle when rules is "5e"', () => {
    const m = rules.getSubModules({ rules: '5e' }, {});

    expect(m.use2024).toBe(false);
    expect(m.abilityCalc.getAbilities).toBe(getAbilities5e);
    expect(m.abilityCalc.getHitPoints).toBe(getHitPoints5e);
    expect(m.spellCalc.getSpellAbilities).toBe(getSpellAbilities5e);
    expect(m.attackCalc).toBe(getAttacks5e);
    expect(m.proficiencyUtils).toBe(proficiencyUtils);
    expect(m.classRules).toBe(classRules);
    expect(m.raceRules).toBe(rules5e);
    // Defect context (pinned below): the bundle omits getCarryingCapacity entirely.
    expect(m.abilityCalc.getCarryingCapacity).toBeUndefined();
  });

  it('getSubModules wires the real 2024 implementation bundle when rules is "2024"', () => {
    const m = rules.getSubModules({ rules: '2024' }, {});

    expect(m.use2024).toBe(true);
    expect(m.abilityCalc.getAbilities).toBe(getAbilities2024);
    expect(m.spellCalc.getSpellAbilities).toBe(getSpellAbilities2024);
    expect(m.attackCalc).toBe(getAttacks2024);
    expect(m.proficiencyUtils).toBe(proficiencyUtils2024);
    expect(m.classRules).toBe(classRules2024);
    expect(m.raceRules).toBe(rules2024);
  });

  it('exposes pure helpers and domain delegates as identity pass-throughs', () => {
    // rules.test.js mocks all of these collaborators, so reference identity through the
    // real graph is pinned only here.
    expect(rules.getSpellMaxLevel).toBe(getSpellMaxLevel);
    expect(rules.getAbilityLongName).toBe(utils.getAbilityLongName);
    expect(rules.getActions).toBe(getActions);
    expect(rules.getProficiencies).toBe(getProficiencies);
    expect(rules.getArmorClass).toBe(getArmorClass);
    expect(rules.getLanguages).toBe(getLanguages);
    expect(rules.getMagicItems).toBe(getMagicItems);
  });

  it('getSpellMaxLevel: highest non-zero slot level wins; non-slots and out-of-table levels are ignored', () => {
    // Canonical truth table for shared/spell-utils.js (no dedicated test file exists;
    // rules.test.js:147-152 stubs this function out, so only this pin is honest).
    const cases = [
      [null, null],
      [undefined, null],
      [{}, null],
      [{ spell_slots_level_1: 0, spell_slots_level_2: 0 }, null],
      [{ spell_slots_level_1: -1 }, null],
      [{ spell_slots_level_1: null, spell_slots_level_2: 2, spell_slots_level_3: null }, 2],
      [{ spell_slots_level_1: 4, spell_slots_level_3: 3, spell_slots_level_9: 1 }, 9],
      [{ spell_slots_level_1: 4, spell_slots_level_10: 5 }, 1],
    ];

    for (const [spellAbilities, expected] of cases) {
      expect(rules.getSpellMaxLevel(spellAbilities)).toBe(expected);
    }
  });

  it('DEFECT pin: rules.getCarryingCapacity returns hit points, not carrying capacity', () => {
    // rules.js:394-399 calls abilityCalc.getHitPoints(playerStats) on BOTH branches
    // instead of getCarryingCapacity — and getSubModules' abilityCalc bundle
    // (rules-core.js:23) never exposes getCarryingCapacity, so the intended call would
    // throw today. Consequence at rules.js:553: playerStats.carryingCapacity = HP.
    // Other suites mock abilityCalc entirely, so nothing else catches this.
    // Expected RAW: STR 15 x 15 = 225 (core/carryingCapacity.js). Flip this pin when
    // the facade is fixed; see SOURCE BUGS report of test-maint pass.
    const playerStats = {
      rules: '5e',
      level: 1,
      class: { name: 'Fighter', hit_die: 10 },
      abilities: [
        { name: 'Strength', totalScore: 15 },
        { name: 'Constitution', bonus: 1 },
      ],
    };

    expect(rules.getCarryingCapacity(playerStats)).toBe(11); // 10 + (10/2+1)*0 + 1*1 = HP, not 225
  });
});
