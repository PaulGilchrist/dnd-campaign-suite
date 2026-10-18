// @maintained-by-ai

// MA-0639: Drow Hand Crossbow fail-margin rider — parseSaveMarginClause unit
// contract (source: MonsterCardHelpers.js). STRUCTURED-KEY-ONLY arm
// (MA-0501/MA-0367 precedent, playbook §5): arms solely on the
// { save_margin: { fails_by, also } } dict — prose never arms it, so rows
// without the key stay byte-inert (null). Parser does NO clamping/band math:
// fails_by passes through as Number() un-bounded; the margin bands
// (fail-by-4 vs fail-by-5) live in the failed-save consumer
// (src/hooks/combat/saveProcessing.js, forwarded via buildSaveOptions at
// MonsterCardModal.jsx save seams) — pinned there by
// saveProcessing.save-margin-rider.test.js, saveProcessing.ma1351-...
// pseudodragon-sting-margin.test.js and the MA-1584 processSaveRoll lanes.
// Cross-lane cite-skips (never re-anchored here): Drow Elite Warrior Hand
// Crossbow + Pseudodragon Sting twins byte-locked in
// MonsterCardModal.ma1584-thri-kreen-bite-margin.test.jsx (siblings test)
// and the MA-1351 consumer disk anchor; extractConditionsFromSaveEffect
// covered by monsterLairActions.test.js + monsterRecharge.* save-lanes;
// Thri-Kreen/Homunculus margin rows by ma1584 / ma1000 lanes.
import { describe, it, expect } from 'vitest';
import { parseSaveMarginClause } from './MonsterCardHelpers.js';
import monstersData from '../../../public/data/monsters.json';

const handCrossbow = () =>
    monstersData.find(m => m.name === 'Drow').actions.find(a => a.name === 'Hand Crossbow');

describe('MA-0639 parseSaveMarginClause', () => {
    it('branch truth table: arms on structured {fails_by, also} with normalization, un-clamped numbers pass through, null on every other shape (prose included)', () => {
        // arms + normalization: also lowercased, numeric-string fails_by coerced
        expect(parseSaveMarginClause({ save_margin: { fails_by: 5, also: 'Unconscious' } })).toEqual({ failsBy: 5, also: 'unconscious' });
        expect(parseSaveMarginClause({ save_margin: { fails_by: '5', also: 'stunned' } })).toEqual({ failsBy: 5, also: 'stunned' });
        // no clamp / band math here: 0 and negatives forward untouched
        expect(parseSaveMarginClause({ save_margin: { fails_by: 0, also: 'prone' } })).toEqual({ failsBy: 0, also: 'prone' });
        expect(parseSaveMarginClause({ save_margin: { fails_by: -5, also: 'prone' } })).toEqual({ failsBy: -5, also: 'prone' });
        // never-arms guards
        expect(parseSaveMarginClause(null)).toBeNull(); // null-negative, once
        expect(parseSaveMarginClause({})).toBeNull();
        expect(parseSaveMarginClause({ save_margin: 'unconscious' })).toBeNull();
        expect(parseSaveMarginClause({ save_margin: {} })).toBeNull();
        expect(parseSaveMarginClause({ save_margin: { fails_by: 'x', also: 'unconscious' } })).toBeNull();
        expect(parseSaveMarginClause({ save_margin: { fails_by: 5 } })).toBeNull();
        expect(parseSaveMarginClause({ save_margin: { fails_by: 5, also: '' } })).toBeNull();
        // STRUCTURED-KEY-ONLY: the RAW clause in prose never arms it
        expect(parseSaveMarginClause({ name: 'Fake', description: 'If the saving throw fails by 5 or more, the target is also unconscious.' })).toBeNull();
        expect(parseSaveMarginClause({ name: 'Fake', save_effect: 'Failure: unconscious if failed by 5.' })).toBeNull();
    });

    it('MA-0639 disk anchor: Drow Hand Crossbow save_margin arms the parser, RAW clause byte-carries in description', () => {
        const row = handCrossbow();
        expect(row.save_margin).toEqual({ fails_by: 5, also: 'unconscious' });
        expect(row.save_effect).toBe('Failure: be poisoned for 1 hour.');
        expect(row.dc_success).toBeUndefined();
        expect(row.description).toContain('If the saving throw fails by 5 or more, the target is also unconscious while poisoned in this way.');
        expect(parseSaveMarginClause(row)).toEqual({ failsBy: 5, also: 'unconscious' });
    });
});
