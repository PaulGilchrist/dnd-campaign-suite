// @maintained-by-ai
// rules-initiative apex-guard lane (#204-class half-guarded apex at computeInitiative's
// :10-era `?? []` site): the file is automation-TOLERANT (:10 `?? []` survives) but the
// playerStats apex was bare. Posture: LOUD — this function's entire contract is WRITING
// initiative onto playerStats and returning undefined; silent return would fake success on a
// data hole (fix#191 handler-loud split; initiative is core combat state). Consumer gate:
// sole prod caller rules.js:562 passes the object getPlayerStats constructed in-function —
// pre-gated, so the guard arm is a direct-misuse tripwire only.
// Golden pins preserved (owned elsewhere, never moved): the console-untouched dexAbility.bonus
// TypeError quirk lives in rules.ft047-keenMind.test.js:408 and rules.getPlayerStats.test.js —
// replicated here ONLY to prove the new apex guard does NOT intercept apex-present crashes.
// evaluateAutoExpression is REAL (unmocked): pure-arithmetic '1' resolves deterministically,
// no dice, no clocks, no store.
import { describe, it, expect, vi } from 'vitest';

import { computeInitiative } from './rules-initiative.js';

describe('computeInitiative apex guard (#204-class, loud)', () => {
    it('nullish playerStats throws readable error with exact console byte — no silent undefined', () => {
        const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
        expect(() => computeInitiative(undefined)).toThrow('Missing playerStats: computeInitiative');
        expect(() => computeInitiative(null)).toThrow('Missing playerStats: computeInitiative');
        expect(spy.mock.calls).toEqual([
            ['rules: missing playerStats for computeInitiative'],
            ['rules: missing playerStats for computeInitiative'],
        ]);
        spy.mockRestore();
    });

    it('apex-present crash boundary stays RAW and console-untouched (golden quirk preservation, ft047 family)', () => {
        // The apex guard must not launder the deliberate :17-18 dexAbility.bonus crash boundary:
        // empty/absent abilities still die natively, with ZERO console output.
        const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
        expect(() => computeInitiative({ abilities: [] })).toThrow(TypeError); // dexAbility.bonus
        expect(() => computeInitiative({})).toThrow(TypeError); // .abilities.find
        expect(spy).not.toHaveBeenCalled();
        spy.mockRestore();
    });

    it('full-stats fold is byte-intact: dex base + dread ambush WIS + Alert expression, flags stamped', () => {
        const stats = {
            abilities: [
                { name: 'Dexterity', bonus: 3 },
                { name: 'Wisdom', bonus: 2 },
            ],
            automation: { passives: [
                { type: 'passive_rule', effect: 'dread_ambush_initiative' },
                { type: 'passive_buff', effect: 'initiative_bonus', bonusExpression: '1' },
                { type: 'passive_rule', effect: 'initiative_advantage' },
                { type: 'passive_buff', effect: 'no_surprise' },
                { type: 'passive_buff', effect: 'unseen_attacker_advantage_negate' },
            ] },
        };
        computeInitiative(stats);
        expect(stats.initiative).toBe(6); // 3 dex + 2 wis (dread ambush) + 1 (Alert, real evaluator)
        expect(stats.initiativeAdvantage).toBe(true);
        expect(stats.noSurprise).toBe(true);
        expect(stats.unseenAttackerAdvantageNegate).toBe(true);
    });

    it('automation-absent apex survives tolerant at :20 (`?? []`): initiative is pure dex, flags false', () => {
        const stats = { abilities: [{ name: 'Dexterity', bonus: -1 }] };
        computeInitiative(stats);
        expect(stats.initiative).toBe(-1);
        expect(stats.initiativeAdvantage).toBe(false);
        expect(stats.noSurprise).toBe(false);
        expect(stats.unseenAttackerAdvantageNegate).toBe(false);
    });
});
