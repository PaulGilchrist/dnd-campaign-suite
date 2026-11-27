// @maintained-by-ai 2026-11-26
import { describe, it, expect } from 'vitest';
import { spellNameSlug, castableRowTestId } from './castableRowTestId.js';

// Rendered data-testid wiring is covered by the lane components' own tests
// (CharActions.spellRendering, CharBonusActions.spellCasting,
// CharReactions.spells, CharSpells.Rendering). This file pins the pure
// id-derivation rules that those probes depend on.

describe('spellNameSlug', () => {
    it('lowercases names and joins words with a single dash, keeping digits as words', () => {
        expect(spellNameSlug('Revivify')).toBe('revivify');
        expect(spellNameSlug('Enhance Ability')).toBe('enhance-ability');
        expect(spellNameSlug('Bigby 10 Hands')).toBe('bigby-10-hands');
    });

    it('collapses runs of non-alphanumerics into one dash and trims edges', () => {
        expect(spellNameSlug("Hunter's  Mark!")).toBe('hunter-s-mark');
        expect(spellNameSlug('  -- Circle of Power --')).toBe('circle-of-power');
    });
});

describe('castableRowTestId', () => {
    it('prefixes the slug with castable-row- so probes are name-derived only', () => {
        expect(castableRowTestId('Revivify')).toBe('castable-row-revivify');
        expect(castableRowTestId('Enhance Ability')).toBe('castable-row-enhance-ability');
    });

    it('keeps distinct spell names distinct, including names differing only by word breaks', () => {
        // "Fire Bolt" vs "Fireball" must not slug to the same id, or a probe
        // would click the wrong row.
        const ids = new Set(['Fire Bolt', 'Fireball', 'Cure Wounds', 'Healing Word']
            .map(castableRowTestId));
        expect(ids.size).toBe(4);
    });
});
