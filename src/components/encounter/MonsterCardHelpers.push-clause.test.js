// @maintained-by-ai
// MA-0079: parsePushFeetClause — Adult Bronze Dragon Repulsion Breath
// authored "pushed up to 60 feet" clause parse (MA-0073 parse shape). Feeds
// the picker push marker te grant; null for every clauseless row (inert).
// This lane is the parser-unit truth table ONLY: one assertion per branch of
// MonsterCardHelpers.js parsePushFeetClause (guard, "pushed" arm, base "push"
// arm + /i flag, regex-miss, numeric capture coercion). Other-monster push
// fingerprints live BY-name in their own data lanes (Cold Gale 30 →
// MonsterCardModal.legendary-uses-ancient-silver.test.jsx:216; Kraken 60 →
// monsterLairActions.test.js:4437). Modal threading seam (click → picker
// pushFeet 60) is owned by MonsterCardModal.repulsion-breath.test.jsx:154;
// picker te grant + logs by SaveAttackAoeModal.cold-gale.test.jsx:146.
import { describe, it, expect } from 'vitest';
import monstersData from '../../../public/data/monsters.json';
import { parsePushFeetClause } from './MonsterCardHelpers.js';

describe('MA-0079 parsePushFeetClause', () => {
    it('#387 BY-name disk fingerprint: Adult Bronze Dragon Repulsion Breath parses feet 60 (number)', () => {
        const repulsion = monstersData.find(m => m.name === 'Adult Bronze Dragon').actions.find(a => a.name === 'Repulsion Breath');
        expect(parsePushFeetClause(repulsion.save_effect)).toEqual({ feet: 60 });
    });

    it('distinct-branch truth table once per branch: base-form "push" arm + case-insensitive, regex-miss null, guard null', () => {
        expect(parsePushFeetClause('Push up to 15 feet by the gale')).toEqual({ feet: 15 }); // base "push" arm + /i + numeric coercion
        expect(parsePushFeetClause('the target has the Prone condition')).toBeNull(); // regex-miss arm
        expect(parsePushFeetClause(null)).toBeNull(); // falsy guard
        expect(parsePushFeetClause(42)).toBeNull(); // non-string typeof guard
    });
});
