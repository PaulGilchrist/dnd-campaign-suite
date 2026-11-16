import { describe, it, expect } from 'vitest';
import { spellNameSlug, castableRowTestId } from './castableRowTestId.js';

describe('spellNameSlug', () => {
    it('lowercases single words', () => {
        expect(spellNameSlug('Revivify')).toBe('revivify');
    });

    it('joins words with a single dash', () => {
        expect(spellNameSlug('Enhance Ability')).toBe('enhance-ability');
        expect(spellNameSlug('Wall of Fire')).toBe('wall-of-fire');
    });

    it('collapses runs of non-alphanumerics into one dash and trims edges', () => {
        expect(spellNameSlug("Hunter's  Mark!")).toBe('hunter-s-mark');
        expect(spellNameSlug('  -- Circle of Power --')).toBe('circle-of-power');
    });

    it('keeps digits adjacent to letters in the same word', () => {
        expect(spellNameSlug('Bigby 10 Hands')).toBe('bigby-10-hands');
    });

    it('is deterministic: the same name always yields the same slug', () => {
        expect(spellNameSlug('Stone Skin')).toBe(spellNameSlug('Stone Skin'));
    });
});

describe('castableRowTestId', () => {
    it('prefixes the slug with castable-row-', () => {
        expect(castableRowTestId('Revivify')).toBe('castable-row-revivify');
        expect(castableRowTestId('Enhance Ability')).toBe('castable-row-enhance-ability');
        expect(castableRowTestId('Stone Skin')).toBe('castable-row-stone-skin');
    });

    it('gives the SAME value for the same spell name in every lane (name-derived only)', () => {
        // No slot level, index, ruleset, or session components can leak in —
        // the value is a pure function of the display name.
        const a = castableRowTestId('Shield');
        const b = castableRowTestId('Shield');
        expect(a).toBe(b);
        expect(a).toBe('castable-row-shield');
    });

    it('produces distinct values for distinct spell names', () => {
        const ids = new Set(['Fire Bolt', 'Fireball', 'Cure Wounds', 'Healing Word', 'Guiding Bolt']
            .map(castableRowTestId));
        expect(ids.size).toBe(5);
    });
});
