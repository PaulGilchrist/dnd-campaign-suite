import { describe, it, expect } from 'vitest';
import path from 'path';
import { fileURLToPath } from 'url';
import { readParty, partyLevelRange } from './party.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const TEST_CAMPAIGN_ROOT = path.resolve(here, '..', '..', '..', '..', 'public', 'campaigns', 'test-campaign');

describe('readParty / partyLevelRange (test-campaign fixtures)', () => {
    const party = readParty('test-campaign', { root: TEST_CAMPAIGN_ROOT });

    it('reads every character file with class identity', () => {
        expect(party.length).toBe(13); // campaign baseline: 13 character files incl. the permanent CelestialWarlock fixture
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
