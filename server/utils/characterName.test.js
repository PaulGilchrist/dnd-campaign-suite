// @maintained-by-ai
// Pins for the 2026-10-28-P name-normalization backlog item: the server owns
// ONE display-name normalizer + filename recipe (server/utils/characterName.js)
// consumed by both character lanes in campaigns-character.js. The client
// mirror (src/services/campaign/characterFileName.js — Vite cannot import
// from server/) MUST stay byte-identical; this file is the equivalence
// contract for a shared nasty-name fixture list.
import { describe, expect, it } from 'vitest';
import { normalizeCharacterName, characterFileName } from './characterName.js';
import { normalizeCharacterName as clientNormalize, characterFileName as clientFileName } from '../../src/services/campaign/characterFileName.js';

describe('normalizeCharacterName (server-boundary display name)', () => {
    it('trims edges and collapses internal whitespace runs', () => {
        expect(normalizeCharacterName(' QA Trim Probe ')).toBe('QA Trim Probe');
        expect(normalizeCharacterName('QA  Trim  Probe')).toBe('QA Trim Probe');
        expect(normalizeCharacterName('\tSir Basil\n')).toBe('Sir Basil');
        expect(normalizeCharacterName('a\tb   c')).toBe('a b c');
    });

    it('is a no-op for clean names (12-fixture contract)', () => {
        for (const name of ['AasimarTest', 'Disciplined_Monk', 'War_Cleric', 'Sir Basil', "Marta O'Neil"]) {
            expect(normalizeCharacterName(name)).toBe(name);
        }
    });

    it('normalizes absent/blank/non-string names to "" (route 400s on that)', () => {
        expect(normalizeCharacterName('')).toBe('');
        expect(normalizeCharacterName('   ')).toBe('');
        expect(normalizeCharacterName(undefined)).toBe('');
        expect(normalizeCharacterName(null)).toBe('');
        expect(normalizeCharacterName(123)).toBe('');
    });
});

describe('characterFileName (canonical sanitize recipe)', () => {
    it('preserves case and maps every non-alphanumeric char to "_"', () => {
        expect(characterFileName('QA Trim Probe')).toBe('QA_Trim_Probe.json');
        expect(characterFileName("Marta O'Neil")).toBe('Marta_O_Neil.json');
        expect(characterFileName('Thorin Oakenshield!')).toBe('Thorin_Oakenshield_.json');
        expect(characterFileName('War_Cleric')).toBe('War_Cleric.json');
    });
});

describe('server === client mirror (equivalence contract)', () => {
    // Shared fixture list: spaces, unicode, punctuation, mixed case.
    const NASTY_NAMES = [
        'QA RunV Wizard', ' X ', 'X  Y', "Marta O'Neil", 'Jean-Luc Picard',
        'Dr. Strange  Love', 'AasimarTest', 'War_Cleric', 'Æthelflæd Bright',
        'Ωmega Σigma', 'Sir! Basil? ', 'a-b.c d', "Tippy 'the Cat'",
        'Ünïcödé  spàce', 'tab\there', 'MIXED case NAME', '  ', '',
    ];

    it('filename recipes agree for every nasty name', () => {
        for (const name of NASTY_NAMES) {
            expect(characterFileName(name)).toBe(clientFileName(name));
        }
    });

    it('normalizers agree for every nasty name', () => {
        for (const name of NASTY_NAMES) {
            expect(normalizeCharacterName(name)).toBe(clientNormalize(name));
        }
    });

    it('normalize-then-filename makes padded spellings collide (dupe guard contract)', () => {
        expect(characterFileName(normalizeCharacterName(' QA Trim Probe ')))
            .toBe(characterFileName(normalizeCharacterName('QA Trim Probe')));
        expect(characterFileName(normalizeCharacterName('QA  Trim  Probe')))
            .toBe(characterFileName(normalizeCharacterName('QA Trim Probe')));
    });
});
