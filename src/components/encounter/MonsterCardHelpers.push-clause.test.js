// MA-0079: parsePushFeetClause — Adult Bronze Dragon Repulsion Breath
// authored "pushed up to 60 feet" clause parse (MA-0073 parse shape). Feeds
// the picker push marker te grant; null for every clauseless row (inert).
import { describe, it, expect } from 'vitest';
import { parsePushFeetClause } from './MonsterCardHelpers.js';

describe('MA-0079 parsePushFeetClause', () => {
    it('parses the Repulsion Breath feet value', () => {
        expect(parsePushFeetClause('The target is pushed up to 60 feet straight away from the dragon and has the Prone condition.')).toEqual({ feet: 60 });
    });

    it('parses 30-foot wyrmling wording', () => {
        expect(parsePushFeetClause('The target is pushed up to 30 feet straight away from the dragon and has the Prone condition.')).toEqual({ feet: 30 });
    });

    it('is case-insensitive and accepts push/pushed', () => {
        expect(parsePushFeetClause('Push up to 15 feet by the gale')).toEqual({ feet: 15 });
    });

    it('returns null for clauseless save effects', () => {
        expect(parsePushFeetClause('10 (3d6) Fire damage')).toBeNull();
        expect(parsePushFeetClause('the target has the Prone condition')).toBeNull();
        expect(parsePushFeetClause(null)).toBeNull();
        expect(parsePushFeetClause(undefined)).toBeNull();
    });
});
