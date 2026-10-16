// @maintained-by-ai
//
// LANE: public/data rows the animalShapes family runs on (#1861 — third of the
// animalShapes trio, trio closes here). Pure data-contract lane over checked-in
// JSON: the unique animal-shapes spell row in each ruleset's spells.json, the
// exact `automation` object (animalShapesHandler.js forwards `automation: auto`
// verbatim into the animal_shapes_target_selection popup payload), the shared core
// row contract plus the INTENTIONAL dual-ruleset divergence (5e concentration /
// "Up to 24 hours" vs 2024 non-concentration / "24 hours" — the 2024 THP-vanish
// rule is implemented, and pinned behaviourally, in the service lane), and the
// monsters.json beast supply behind the RAW gates (type beast case-insensitive,
// CR <= 4, size Tiny–Large — constants mirrored from animalShapesHandler.js
// ANIMAL_SHAPES_MAX_CR/ALLOWED_SIZES and AnimalShapesSelectionModal's filter).
// Handler lane builds its action inline and never reads JSON; service lane mocks
// every dep — only this file touches the real datasets. No mocks, no timers, no
// runtime state; deterministic.
//
// TRIO MAP:
// - animalShapesHandler.test.js: dispatch entry, read-only already-transformed
//   guard, popup composition (synthetic actions, no JSON reads).
// - animalShapesService.test.js (#1860): mutation lane — confirm-transform
//   targetEffects MERGE canon, pendingExpirations exact arrays, THP /
//   polymorphOriginal writes (all deps mocked).
// Near-name siblings, distinct modules, not dupes: useSpellMetamagicFlow.special-
// paths.animal-polymorph.test.js owns the metamagic gate seam (service mocked);
// AnimalShapesSelectionModal*.test.js own the modal UI over synthetic monster
// fixtures (loadMonsters mocked); targetEffectDefinitions.test.js owns the
// 'animal_shapes' te-registry key. Only this lane pins real public/data values.

import { describe, it, expect } from 'vitest';
import spells5e from '../../../../../public/data/spells.json' with { type: 'json' };
import spells2024 from '../../../../../public/data/2024/spells.json' with { type: 'json' };
import monsters from '../../../../../public/data/monsters.json' with { type: 'json' };

const ANIMAL_SHAPES_INDEX = 'animal-shapes';
// Mirrors animalShapesHandler.js ANIMAL_SHAPES_MAX_CR / ALLOWED_SIZES and the
// modal's filters (RAW: "Large or smaller beast with CR 4 or lower").
const MAX_CR = 4;
const ALLOWED_SIZES = ['Tiny', 'Small', 'Medium', 'Large'];
// Mirrors AnimalShapesSelectionModal.js's module-local parseChallengeRating
// (monsters.json stores challenge_rating as strings, fractions included).
const parseCR = cr =>
    (typeof cr === 'string' && cr.includes('/'))
        ? Number(cr.split('/')[0]) / Number(cr.split('/')[1])
        : Number(cr);

describe('animalShapesSpellData — spells.json rows', () => {
    describe.each([['5e', spells5e], ['2024', spells2024]])('%s dataset', (_label, spells) => {
        it('contains exactly one animal-shapes row (shadow-duplicate guard)', () => {
            expect(spells.filter(s => s.index === ANIMAL_SHAPES_INDEX)).toHaveLength(1);
        });

        it('automation is exactly { type: "animal_shapes" } (dispatch key, forwarded verbatim into popup)', () => {
            const entry = spells.find(s => s.index === ANIMAL_SHAPES_INDEX);
            expect(entry).toBeDefined();
            expect(entry.automation).toEqual({ type: 'animal_shapes' });
        });

        it('core row contract: lv8 Transmutation, 30 feet, V/S, non-ritual, Druid-only', () => {
            const entry = spells.find(s => s.index === ANIMAL_SHAPES_INDEX);
            expect(entry.name).toBe('Animal Shapes');
            expect(entry.level).toBe(8);
            expect(entry.school).toBe('Transmutation');
            expect(entry.range).toBe('30 feet');
            expect(entry.components).toEqual(['V', 'S']);
            expect(entry.ritual).toBe(false);
            expect(entry.classes).toContain('Druid');
        });
    });

    it('5e row: concentration, "Up to 24 hours", "1 action"', () => {
        const entry = spells5e.find(s => s.index === ANIMAL_SHAPES_INDEX);
        expect(entry.concentration).toBe(true);
        expect(entry.duration).toBe('Up to 24 hours');
        expect(entry.casting_time).toBe('1 action');
    });

    it('2024 row: NOT concentration, "24 hours", "Action" — intentional divergence the service lane implements (THP, turn-based expiry)', () => {
        const entry = spells2024.find(s => s.index === ANIMAL_SHAPES_INDEX);
        expect(entry.concentration).toBe(false);
        expect(entry.duration).toBe('24 hours');
        expect(entry.casting_time).toBe('Action');
    });
});

describe('animalShapesSpellData — monsters.json beast supply', () => {
    const pool = monsters.filter(m =>
        (m.type || '').toLowerCase() === 'beast'
        && parseCR(m.challenge_rating) <= MAX_CR
        && ALLOWED_SIZES.some(s => s.toLowerCase() === (m.size || '').toLowerCase()));

    it('selectable pool is non-empty and covers all four allowed sizes', () => {
        expect(pool.length).toBeGreaterThan(0);
        const sizes = new Set(pool.map(m => m.size.toLowerCase()));
        ALLOWED_SIZES.forEach(s => expect(sizes.has(s.toLowerCase())).toBe(true));
    });

    it('every pool row has the exact shape confirmAnimalShapesTransform consumes', () => {
        monsters.filter(m => (m.type || '').toLowerCase() === 'beast').forEach(m => {
            expect(typeof m.name).toBe('string');
            expect(typeof m.index).toBe('string');
            expect(typeof m.challenge_rating).toBe('string');
        });
        pool.forEach(m => {
            expect(Number.isInteger(m.hit_points)).toBe(true);
            expect(Number.isInteger(m.armor_class)).toBe(true);
            expect(Object.values(m.speed).some(v => typeof v === 'string' && v !== ''))
                .toBe(true); // at least one movement mode (swim-only Quipper/Sea Horse included)
        });
    });

    it('canonical RAW forms supply the exact stats the service writes onto creatures', () => {
        const shape = name => {
            const m = monsters.find(x => x.name === name);
            expect(m).toBeDefined();
            const { index, size, challenge_rating, hit_points, armor_class, speed } = m;
            return { index, size, challenge_rating, hit_points, armor_class, speed };
        };
        expect(shape('Wolf')).toEqual({
            index: 'wolf', size: 'Medium', challenge_rating: '0.25',
            hit_points: 11, armor_class: 12, speed: { walk: '40 ft.' },
        });
        expect(shape('Brown Bear')).toEqual({
            index: 'brown-bear', size: 'Large', challenge_rating: '1',
            hit_points: 22, armor_class: 11, speed: { walk: '40 ft.', climb: '30 ft.' },
        });
        expect(shape('Crocodile')).toEqual({
            index: 'crocodile', size: 'Large', challenge_rating: '0.5',
            hit_points: 13, armor_class: 12, speed: { walk: '20 ft.', swim: '30 ft.' },
        });
    });

    it('Giant Ape is excluded — CR 7 and Huge each independently fail the RAW gate', () => {
        const ape = monsters.find(m => m.name === 'Giant Ape');
        expect(ape.type.toLowerCase()).toBe('beast');
        expect(parseCR(ape.challenge_rating)).toBeGreaterThan(MAX_CR);
        expect(ALLOWED_SIZES.map(s => s.toLowerCase())).not.toContain(ape.size.toLowerCase());
        expect(pool.some(m => m.index === ape.index)).toBe(false);
    });

    it('dataset spells type both "Beast" and "beast" — the modal case-insensitive filter is load-bearing', () => {
        expect(monsters.some(m => m.type === 'Beast')).toBe(true);
        expect(monsters.some(m => m.type === 'beast')).toBe(true);
    });
});
