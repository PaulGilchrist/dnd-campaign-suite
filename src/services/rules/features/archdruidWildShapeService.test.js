// @maintained-by-ai
// CLA-013 input-truth lane for hasUnlimitedWildShape (cited by
// buffHandler.wild-shape.test.js as the canonical pin for this predicate's
// inputs; consumer wiring lives there, max-uses 2/Infinity in
// classRules.test.js, decrement-skip in wildShapeCreatureBuilder.test.js).
//
// The unlimited tier is keyed off rules "5e" AND the lv20 Archdruid feature
// row. Verified against disk canon 2026-10-20: BOTH public/data/classes.json
// (5e) and public/data/2024/classes.json lv20 Druid rows carry a feature
// named "Archdruid" (2024 additionally wild_shape: 4, finite) — so the
// feature name alone must NOT grant unlimited; the rules gate is what
// discriminates. Rows below are pulled from disk programmatically, never
// transcribed.
import { describe, it, expect } from 'vitest';
import { hasUnlimitedWildShape } from './archdruidWildShapeService.js';
import classes5e from '../../../../public/data/classes.json';
import classes2024 from '../../../../public/data/2024/classes.json';

const disk5eDruidLevels = classes5e.find(c => c.name === 'Druid').class_levels;
const disk2024Druid = classes2024.find(c => c.name === 'Druid' || (c.major || {}).name === 'Druid');

describe('hasUnlimitedWildShape (CLA-013)', () => {
    it('true for lv20 5e Druid on disk class data; false for the same-shaped 2024 disk host', () => {
        // 5e disk: lv20 row's only feature is "Archdruid" → unlimited.
        expect(hasUnlimitedWildShape({
            name: 'Wild_Sage_Druid', level: 20, rules: '5e',
            class: { name: 'Druid', class_levels: disk5eDruidLevels },
        })).toBe(true);

        // 2024 disk lv20 ALSO names the feature "Archdruid" (with finite
        // wild_shape: 4) — the rules gate alone must keep it false.
        const lv20_2024 = disk2024Druid.class_levels.find(cl => cl.level === 20);
        expect(lv20_2024.features.some(f => f.name === 'Archdruid')).toBe(true);
        expect(hasUnlimitedWildShape({
            name: 'Wild_Sage_Druid', level: 20, rules: '2024',
            class: { ...disk2024Druid, class_levels: disk2024Druid.class_levels },
        })).toBe(false);
    });

    // fullStats: lv20 5e Druid on disk rows with per-case surgical overrides —
    // each row isolates exactly one gate of the predicate.
    const fullStats = (overrides = {}) => ({
        name: 'Wild_Sage_Druid',
        level: 20,
        rules: '5e',
        class: { name: 'Druid', class_levels: disk5eDruidLevels },
        ...overrides,
    });

    it.each([
        ['rules omitted defaults to 5e', (() => { const s = fullStats(); delete s.rules; return s; })(), true],
        ['2024-style major-name host once flipped to rules "5e"',
            fullStats({ class: { major: { name: 'Druid' }, class_levels: [{ level: 20, features: [{ name: 'Archdruid' }] }] } }), true],
        ['lv19 even though class_levels contains the lv20 Archdruid row',
            fullStats({ level: 19 }), false],
        ['lv20 row names a different feature (name check, not row presence)',
            fullStats({ class: { name: 'Druid', class_levels: [{ level: 20, features: [{ name: 'Booming Blade' }] }] } }), false],
        ['class_levels has no lv20 row',
            fullStats({ class: { name: 'Druid', class_levels: [{ level: 19, features: [] }] } }), false],
        ['non-Druid lv20 host even with the Archdruid row',
            fullStats({ class: { name: 'Wizard', class_levels: [{ level: 20, features: [{ name: 'Archdruid' }] }] } }), false],
        ['undefined stats', undefined, false],
        ['stats with no class at all', { name: 'Nobody' }, false],
    ])('%s → %s', (_label, stats, expected) => {
        expect(hasUnlimitedWildShape(stats)).toBe(expected);
    });
});
