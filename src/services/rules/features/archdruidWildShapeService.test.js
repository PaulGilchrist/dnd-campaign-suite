// @improved-by-ai
// CLA-013: 2014 Archdruid (lv20 Druid, rules "5e") gets unlimited Wild Shape
// uses; the 2024 lv20 capstone stays finite (wild_shape: 4).
import { describe, it, expect } from 'vitest';
import { hasUnlimitedWildShape } from './archdruidWildShapeService.js';

function archdruidStats(overrides = {}) {
    return {
        name: 'Wild_Sage_Druid',
        level: 20,
        rules: '5e',
        class: {
            name: 'Druid',
            class_levels: [{ level: 20, features: [{ name: 'Archdruid' }] }],
        },
        ...overrides,
    };
}

describe('hasUnlimitedWildShape (CLA-013)', () => {
    it('true for lv20 5e Druid with the lv20 Archdruid feature row', () => {
        expect(hasUnlimitedWildShape(archdruidStats())).toBe(true);
    });

    it('true when rules is omitted (defaults to 5e)', () => {
        const stats = archdruidStats();
        delete stats.rules;
        expect(hasUnlimitedWildShape(stats)).toBe(true);
    });

    it('true for 2024-style major-name hosts once flipped to rules "5e"', () => {
        const stats = archdruidStats({
            class: { major: { name: 'Druid' }, class_levels: [{ level: 20, features: [{ name: 'Archdruid' }] }] },
        });
        expect(hasUnlimitedWildShape(stats)).toBe(true);
    });

    it('false at lv19 even with Archdruid data on disk', () => {
        expect(hasUnlimitedWildShape(archdruidStats({ level: 19 }))).toBe(false);
    });

    it('false when the lv20 row carries no features', () => {
        const stats = archdruidStats({ class: { name: 'Druid', class_levels: [{ level: 20, features: [] }] } });
        expect(hasUnlimitedWildShape(stats)).toBe(false);
    });

    it('false when class_levels has no lv20 row', () => {
        const stats = archdruidStats({ level: 20, class: { name: 'Druid', class_levels: [{ level: 19, features: [] }] } });
        expect(hasUnlimitedWildShape(stats)).toBe(false);
    });

    it('false for 2024 lv20 hosts even when the capstone is named Archdruid (finite wild_shape: 4)', () => {
        const stats = archdruidStats({
            rules: '2024',
            class: { major: { name: 'Druid' }, class_levels: [{ level: 20, wild_shape: 4, features: [{ name: 'Archdruid' }] }] },
        });
        expect(hasUnlimitedWildShape(stats)).toBe(false);
    });

    it('false for non-Druid lv20 5e hosts', () => {
        const stats = archdruidStats({ class: { name: 'Wizard', class_levels: [{ level: 20, features: [{ name: 'Archdruid' }] }] } });
        expect(hasUnlimitedWildShape(stats)).toBe(false);
    });

    it('handles undefined playerStats gracefully', () => {
        expect(hasUnlimitedWildShape(undefined)).toBe(false);
        expect(hasUnlimitedWildShape({})).toBe(false);
    });
});
