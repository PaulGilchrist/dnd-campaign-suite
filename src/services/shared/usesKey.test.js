// 2026-11-15 uses-key convention convergence: getRuntimeUsesKey is the ONE exported
// derivation for persisted uses-latch keys (camelCase stem + 'Uses'). These pins lock
// the casing table and cross-check the derived key against the data-declared
// resourceKey values in public/data/2024/classes.json so derivation and disk law
// can never drift casing again (the all-lowercase Relentless Rage stem vs the
// camelCase rageOfTheGodsUses declared-key family was the split this closed).
import { describe, it, expect } from 'vitest';
import { getRuntimeUsesKey } from './usesKey.js';
import classes2024 from '../../../public/data/2024/classes.json';

describe('getRuntimeUsesKey — casing table', () => {
    const table = [
        ['Relentless Rage', 'relentlessRageUses'],
        ['Second Wind', 'secondWindUses'],
        ['Wholeness of Body', 'wholenessOfBodyUses'],
        ['Uncanny Metabolism', 'uncannyMetabolismUses'],
        ['Action Surge', 'actionSurgeUses'],
        ['Cosmic Omen', 'cosmicOmenUses'],
        ['Dread Ambush', 'dreadAmbushUses'],
        ['Encouraging Song', 'encouragingSongUses'],
        ['Healing Hands', 'healingHandsUses'],
        ['Spell Thief', 'spellThiefUses'],
        ['Searing Vengeance', 'searingVengeanceUses'],
        ['Psychic Veil', 'psychicVeilUses'],
        ['Warding Flare', 'wardingFlareUses'],
        ['Breath Weapon', 'breathWeaponUses'],
        ['Warping Implosion', 'warpingImplosionUses'],
        ['Restore Balance', 'restoreBalanceUses'],
        // Single-word features stay all-lowercase (first letter lowered only),
        // and surrounding/interior whitespace collapses.
        ['Stonecunning', 'stonecunningUses'],
        ['Tireless', 'tirelessUses'],
        ['  Flurry  ', 'flurryUses'],
        // Apostrophes are stripped — matches the data-declared camel stems
        // (classes.json "Nature's Veil" -> naturesVeilUses) and the giant-ancestry
        // option keys (Cloud's Jaunt -> cloudsJauntUses) that pre-dated the helper.
        ['Nature\'s Veil', 'naturesVeilUses'],
        ['Cloud\'s Jaunt', 'cloudsJauntUses'],
        ['Thief\'s Reflexes', 'thiefsReflexesUses'],
    ];
    it.each(table)('%s -> %s', (featureName, expectedKey) => {
        expect(getRuntimeUsesKey(featureName)).toBe(expectedKey);
    });

    it('throws on non-string input (mirrors the legacy inline derivations)', () => {
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

    it('finds the named family features (guard against silent drift of the scan)', () => {
        const names = new Set(usesPairs.map(p => p.name));
        expect(names.has('Zealous Presence')).toBe(true);
        expect(names.has('Rage of the Gods')).toBe(true);
        expect(names.has('Second Wind')).toBe(true);
        expect(names.has('Nature\'s Veil')).toBe(true);
        expect(names.has('Tireless')).toBe(true);
        expect(names.has('Intimidating Presence')).toBe(true);
    });

    it('derived key === declared resourceKey for every *Uses resourceKey on disk', () => {
        const mismatches = usesPairs
            .filter(p => getRuntimeUsesKey(p.name) !== p.resourceKey)
            .map(p => `${p.name} -> derived ${getRuntimeUsesKey(p.name)} vs declared ${p.resourceKey}`);
        expect(mismatches).toEqual([]);
    });

    it('explicit pins for the named family features', () => {
        expect(getRuntimeUsesKey('Zealous Presence')).toBe('zealousPresenceUses');
        expect(getRuntimeUsesKey('Rage of the Gods')).toBe('rageOfTheGodsUses');
        expect(getRuntimeUsesKey('Intimidating Presence')).toBe('intimidatingPresenceUses');
        expect(getRuntimeUsesKey('Wild Shape')).toBe('wildShapeUses');
    });
});
