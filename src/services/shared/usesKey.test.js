// @maintained-by-ai 2026-11-26
// 2026-11-15 uses-key convention convergence: getRuntimeUsesKey is the ONE exported
// derivation for persisted uses-latch keys (camelCase stem + 'Uses'). The table below
// pins each casing rule once (multi-word camel, single-word lowercase, whitespace
// collapse, apostrophe stripping); the disk cross-check re-derives every data-declared
// *Uses resourceKey in public/data/2024/classes.json so derivation and disk law can
// never drift casing again (the all-lowercase Relentless Rage stem vs the camelCase
// rageOfTheGodsUses declared-key family was the split this closed).
import { describe, it, expect } from 'vitest';
import { getRuntimeUsesKey } from './usesKey.js';
import classes2024 from '../../../public/data/2024/classes.json';

describe('getRuntimeUsesKey — casing rules', () => {
    const table = [
        // Multi-word features become camelCase.
        ['Second Wind', 'secondWindUses'],
        // Single-word features stay all-lowercase (first letter lowered only).
        ['Stonecunning', 'stonecunningUses'],
        // Surrounding/interior whitespace collapses.
        ['  Flurry  ', 'flurryUses'],
        // Apostrophes are stripped — straight (classes.json "Nature's Veil") and
        // curly (giant-ancestry option keys "Cloud\u2019s Jaunt" pre-dated the helper).
        ['Nature\'s Veil', 'naturesVeilUses'],
        ['Cloud\u2019s Jaunt', 'cloudsJauntUses'],
        // Contract pin: shared-pool aliases (Evergreen Wild Shape, Land's Aid) reuse
        // this canonical latch key, which is not itself declared on disk.
        ['Wild Shape', 'wildShapeUses'],
    ];
    it.each(table)('%s -> %s', (featureName, expectedKey) => {
        expect(getRuntimeUsesKey(featureName)).toBe(expectedKey);
    });

    it('throws TypeError on non-string input', () => {
        expect(() => getRuntimeUsesKey(null)).toThrow(TypeError);
        expect(() => getRuntimeUsesKey(undefined)).toThrow(TypeError);
    });
});

describe('getRuntimeUsesKey — cross-check vs data-declared resourceKey (classes.json 2024)', () => {
    // Shared-pool aliases deliberately reuse ANOTHER feature's latch key and are
    // exempt: they point at the canonical Wild Shape pool on purpose.
    const SHARED_POOL_ALIASES = new Set(['Evergreen Wild Shape', 'Land\'s Aid']);

    /** Collect every {name, automation.resourceKey} pair in the 2024 class data. */
    function collectDeclaredPairs(node, pairs) {
        if (Array.isArray(node)) {
            node.forEach(item => collectDeclaredPairs(item, pairs));
        } else if (node && typeof node === 'object') {
            if (typeof node.name === 'string' && node.automation && typeof node.automation.resourceKey === 'string') {
                pairs.push({ name: node.name, resourceKey: node.automation.resourceKey });
            }
            Object.values(node).forEach(child => collectDeclaredPairs(child, pairs));
        }
        return pairs;
    }

    const usesPairs = collectDeclaredPairs(classes2024, [])
        .filter(p => p.resourceKey.endsWith('Uses') && !SHARED_POOL_ALIASES.has(p.name));

    it('scan finds the family features (guard against a vacuous cross-check)', () => {
        const names = new Set(usesPairs.map(p => p.name));
        const expected = ['Zealous Presence', 'Rage of the Gods', 'Second Wind',
            'Nature\'s Veil', 'Tireless', 'Intimidating Presence'];
        expect(expected.filter(name => !names.has(name))).toEqual([]);
    });

    it('derived key === declared resourceKey for every *Uses resourceKey on disk', () => {
        const mismatches = usesPairs
            .filter(p => getRuntimeUsesKey(p.name) !== p.resourceKey)
            .map(p => `${p.name} -> derived ${getRuntimeUsesKey(p.name)} vs declared ${p.resourceKey}`);
        expect(mismatches).toEqual([]);
    });
});
