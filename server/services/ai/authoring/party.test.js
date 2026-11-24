import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { readParty, partyLevelRange } from './party.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const TEST_CAMPAIGN_ROOT = path.resolve(here, '..', '..', '..', '..', 'public', 'campaigns', 'test-campaign');

describe('readParty / partyLevelRange (test-campaign fixtures)', () => {
    const party = readParty('test-campaign', { root: TEST_CAMPAIGN_ROOT });

    it('reads every character file with class identity', () => {
        // Campaign baseline: every root *.json is a character file (readParty
        // skips none). 15 since the permanent FixtureLandDruid zone-immunity
        // fixture landed (bug-zone-save-computedstats-bucket-has-no-producer
        // fix-run, 2026-11-23) — was 14 from the FixtureFighter5e era
        // (d709198ef); the pin sits here, re-run it when the roster moves.
        const charFiles = fs.readdirSync(TEST_CAMPAIGN_ROOT).filter(f => f.endsWith('.json'));
        expect(party.length).toBe(charFiles.length);
        expect(party.length).toBe(15);
        const marta = party.find(p => p.name === 'FeyRanger');
        expect(marta).toMatchObject({ level: 17, class: 'Ranger', subclass: 'Gloom Stalker' });
        expect(party.every(p => typeof p.level === 'number' && p.level >= 1)).toBe(true);
    });

    it('names and orders the roster deterministically', () => {
        const names = party.map(p => p.name);
        expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
    });

    it('summarizes levels for arc CR budgeting', () => {
        const range = partyLevelRange(party);
        expect(range.size).toBe(party.length);
        expect(range.min).toBeLessThanOrEqual(range.max);
        expect(range.max).toBe(20);
    });

    it('an empty/absent campaign yields an empty party', () => {
        expect(readParty('nope', { root: path.join(here, 'no-such-dir') })).toEqual([]);
        expect(partyLevelRange([])).toEqual({ min: 1, max: 1, size: 0 });
    });
});
