import { describe, it, expect } from 'vitest';
import { parseConcentrationDisadvantageClause, extractConditionsFromSaveEffect } from './MonsterCardHelpers.js';

// @improved-by-ai

const ADULT_CLOUD = '22 (4d10) Poison damage, and the target has Disadvantage on saving throws to maintain Concentration until the end of its next turn';
const ANCIENT_CLOUD = 'Failure: 33 (6d10) Poison damage, and the target has Disadvantage on saving throws to maintain Concentration until the end of its next turn. Failure or Success: The dragon can\'t take this action again until the start of its next turn.';

describe('MA-0038 parseConcentrationDisadvantageClause', () => {
    it('matches the Adult Black Dragon Cloud of Insects failed-save clause', () => {
        expect(parseConcentrationDisadvantageClause(ADULT_CLOUD)).toEqual({ effect: 'concentration_disadvantage' });
    });

    it('matches the Ancient Black Dragon wording', () => {
        expect(parseConcentrationDisadvantageClause(ANCIENT_CLOUD)).toEqual({ effect: 'concentration_disadvantage' });
    });

    it('matches <strong>Concentration</strong> markup (description text)', () => {
        expect(parseConcentrationDisadvantageClause('the target has Disadvantage on saving throws to maintain <strong>Concentration</strong> until the end of its next turn')).toEqual({ effect: 'concentration_disadvantage' });
    });

    it('returns null for plain damage-only save effects', () => {
        expect(parseConcentrationDisadvantageClause('10 (3d6) Fire damage')).toBeNull();
        expect(parseConcentrationDisadvantageClause(null)).toBeNull();
        expect(parseConcentrationDisadvantageClause(undefined)).toBeNull();
    });

    it('Cloud of Insects clause is invisible to the CONDITION vocabulary (the original gap)', () => {
        expect(extractConditionsFromSaveEffect(ADULT_CLOUD)).toEqual([]);
    });
});
