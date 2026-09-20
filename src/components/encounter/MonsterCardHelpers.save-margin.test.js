// MA-0639: Drow Hand Crossbow fail-margin rider — structured save_margin
// key parse. STRUCTURED-KEY-ONLY arm (MA-0501/MA-0367 precedent): the parser
// never touches description prose, so byte-inert for every row without the
// save_margin dict. The margin clause ("If the saving throw fails by 5 or
// more, the target is also unconscious while poisoned") stays prose-only.
import { describe, it, expect } from 'vitest';
import { parseSaveMarginClause } from './MonsterCardHelpers.js';
import monstersData from '../../../public/data/monsters.json';

const drow = () => monstersData.find(m => m.name === 'Drow');
const handCrossbow = () => drow().actions.find(a => a.name === 'Hand Crossbow');

describe('MA-0639 parseSaveMarginClause', () => {
    it('arms on the authored Drow Hand Crossbow save_margin key', () => {
        expect(parseSaveMarginClause(handCrossbow())).toEqual({ failsBy: 5, also: 'unconscious' });
    });

    it('locks the Drow disk row: structured key present, description byte-carries the RAW clause', () => {
        const row = handCrossbow();
        expect(row.save_margin).toEqual({ fails_by: 5, also: 'unconscious' });
        expect(row.save_effect).toBe('Failure: be poisoned for 1 hour.');
        expect(row.dc_success).toBeUndefined();
        expect(row.description).toContain('If the saving throw fails by 5 or more, the target is also unconscious while poisoned in this way.');
    });

    it('arms ONLY on the structured key — prose never arms it', () => {
        expect(parseSaveMarginClause({ name: 'Fake', description: 'If the saving throw fails by 5 or more, the target is also unconscious.' })).toBeNull();
        expect(parseSaveMarginClause({ name: 'Fake', save_effect: 'Failure: unconscious if failed by 5.' })).toBeNull();
    });

    it('is byte-inert for missing/malformed keys', () => {
        expect(parseSaveMarginClause(null)).toBeNull();
        expect(parseSaveMarginClause(undefined)).toBeNull();
        expect(parseSaveMarginClause({})).toBeNull();
        expect(parseSaveMarginClause({ save_margin: 'unconscious' })).toBeNull();
        expect(parseSaveMarginClause({ save_margin: {} })).toBeNull();
        expect(parseSaveMarginClause({ save_margin: { fails_by: 'x', also: 'unconscious' } })).toBeNull();
        expect(parseSaveMarginClause({ save_margin: { fails_by: 5 } })).toBeNull();
    });

    it('normalizes also-case and numeric string fails_by', () => {
        expect(parseSaveMarginClause({ save_margin: { fails_by: 5, also: 'Unconscious' } })).toEqual({ failsBy: 5, also: 'unconscious' });
        expect(parseSaveMarginClause({ save_margin: { fails_by: '5', also: 'stunned' } })).toEqual({ failsBy: 5, also: 'stunned' });
    });

    it('Drow Elite Warrior byte stays inert (same prose, no structured key — ticket scope)', () => {
        const elite = monstersData.find(m => m.name === 'Drow Elite Warrior');
        const row = elite.actions.find(a => a.name === 'Hand Crossbow');
        expect(row.save_margin).toBeUndefined();
        expect(parseSaveMarginClause(row)).toBeNull();
    });
});
