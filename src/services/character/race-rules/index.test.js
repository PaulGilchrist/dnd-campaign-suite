// @maintained-by-ai
// Lane: race-rules/index barrel contract only. index.js is a pure forwarding
// barrel (export { rules5e, rules2024 }); every aspect behavior is pinned
// verbatim in its owning aspect file — see FAMILY SEAM MAP in
// 2024-immunities.test.js. Ruleset selection (character.rules → rules5e /
// rules2024) lives in rulesFactory.js and is covered by rulesFactory.test.js;
// there is no dispatch or fallback logic in this barrel to re-test here.
import { describe, it, expect } from 'vitest';
import * as raceRulesModule from './index.js';
import rules5e from './5e.js';
import rules2024 from './2024.js';

describe('race-rules/index barrel', () => {
  it('exposes exactly rules5e and rules2024, identity-pinned to live aspect modules', () => {
    // Export surface: consumers (rulesFactory, rules-core, abilityCalc) name-import these two.
    expect(Object.keys(raceRulesModule)).toEqual(['rules5e', 'rules2024']);

    // Identity: the barrel forwards the real module defaults, unchanged.
    expect(raceRulesModule.rules5e).toBe(rules5e);
    expect(raceRulesModule.rules2024).toBe(rules2024);

    // Liveness pin: if a module's default export were broken, both sides of
    // toBe would be undefined === undefined and pass silently — verify the
    // forwarded objects actually carry the six aspect methods consumers call.
    const aspectNames = ['getImmunities', 'getRace', 'getRacialBonus', 'getResistances', 'getSenses', 'getTraits'];
    for (const rules of [raceRulesModule.rules5e, raceRulesModule.rules2024]) {
      expect(rules).toBeTruthy();
      aspectNames.forEach((name) => expect(typeof rules[name]).toBe('function'));
    }
  });
});
