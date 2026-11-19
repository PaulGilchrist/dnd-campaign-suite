// @maintained-by-ai
// Pure-derivation contract for the GM Screen party rows: every formatter
// reads exactly the PlayerStats fields the rules engine computes (abilities
// with save/skills, skillProficiencies/expertise, race speed).
import { describe, it, expect } from 'vitest';
import {
    formatBonus,
    deriveSaves,
    deriveProficientSkills,
    deriveClassLabel,
} from './partyRowData.js';
import { makeStats } from './gm-test-utils.jsx';

describe('partyRowData', () => {
    it('formatBonus signs every value and folds non-numbers to +0', () => {
        expect(formatBonus(5)).toBe('+5');
        expect(formatBonus(0)).toBe('+0');
        expect(formatBonus(-2)).toBe('−2');
        expect(formatBonus(undefined)).toBe('+0');
    });

    it('deriveSaves keeps fixed ability order, uses the computed save, flags proficiency', () => {
        const saves = deriveSaves(makeStats());
        expect(saves.map(s => s.abbr)).toEqual(['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA']);
        expect(saves[0]).toMatchObject({ bonus: 5, proficient: true });
        expect(saves[5]).toMatchObject({ bonus: -1, proficient: false });
        // An ability missing its save falls back to the flat modifier.
        const fallback = deriveSaves({ abilities: [{ name: 'Strength', bonus: 2, proficient: false }] });
        expect(fallback[0].bonus).toBe(2);
    });

    it('deriveSaves drops abilities the character does not have', () => {
        expect(deriveSaves({ abilities: [] })).toEqual([]);
        expect(deriveSaves({})).toHaveLength(0);
    });

    it('deriveProficientSkills keeps only proficient skills, sorted, expertise flagged', () => {
        const skills = deriveProficientSkills(
            makeStats({ skillProficiencies: ['Perception', 'Athletics'], expertise: ['Athletics'] })
        );
        expect(skills.map(s => s.name)).toEqual(['Athletics', 'Perception']);
        expect(skills[0]).toMatchObject({ bonus: 5, expert: true });
        expect(skills[1]).toMatchObject({ bonus: 4, expert: false });
    });

    it('deriveClassLabel joins class name and level', () => {
        expect(deriveClassLabel(makeStats())).toBe('Fighter 3');
        expect(deriveClassLabel({ level: 1 })).toBe('1');
        expect(deriveClassLabel({ class: { name: 'Rogue' } })).toBe('Rogue');
    });
});

// conditionLabel / normalizeConditionKeys moved with roadmap Item 6 to
// services/combat/conditions/conditionDisplay.js — their tests ride the
// canon in conditionDisplay.test.js now.
