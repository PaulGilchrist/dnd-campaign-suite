// L5 Phase 3 — AI ruling schema tests (Principle 3: proposer output is validated, malformed fails closed).
import { describe, it, expect } from 'vitest';
import { validateRuling, needsHumanRuling } from './schemas.js';

describe('validateRuling', () => {
    it('accepts each engine-mapped ruling type', () => {
        expect(validateRuling({ type: 'dice', expression: '1d20+7', explanation: 'attack' }).ok).toBe(true);
        expect(validateRuling({ type: 'dice', expression: 'd8', mode: 'advantage' }).ok).toBe(true);
        expect(validateRuling({ type: 'automation', actionName: 'Attack with Longsword', targetName: 'Goblin' }).ok).toBe(true);
        expect(validateRuling({ type: 'target_effect', effect: 'bless', targetName: 'Hero' }).ok).toBe(true);
        expect(validateRuling({ type: 'hp_change', targetName: 'Goblin', amount: -7, expression: '2d6+3' }).ok).toBe(true);
        expect(validateRuling({ type: 'narrative', text: 'The door creaks open.' }).ok).toBe(true);
        expect(validateRuling({ type: 'needs_human', text: 'GM call needed' }).ok).toBe(true);
    });

    it('rejects non-objects and unknown types — never guesses', () => {
        expect(validateRuling(null).ok).toBe(false);
        expect(validateRuling('narrative').ok).toBe(false);
        expect(validateRuling([]).ok).toBe(false);
        expect(validateRuling({ type: 'save_roll', expression: '1d20' }).ok).toBe(false);
        expect(validateRuling({ expression: '1d20' }).ok).toBe(false);
    });

    it('dice rulings must carry a valid expression — the AI proposes odds, never results', () => {
        expect(validateRuling({ type: 'dice' }).ok).toBe(false);
        expect(validateRuling({ type: 'dice', expression: '20' }).ok).toBe(false);   // a stated RESULT, not an expression
        expect(validateRuling({ type: 'dice', expression: '1d20+5+3' }).ok).toBe(false);
        expect(validateRuling({ type: 'dice', expression: '1d6', mode: 'surewin' }).ok).toBe(false);
    });

    it('hp_change is a bounded signed integer; target_effect needs a snake_case key', () => {
        // amount checks carry a valid expression so ONLY the amount fails
        expect(validateRuling({ type: 'hp_change', targetName: 'X', amount: 0, expression: '1d6' }).ok).toBe(false);
        expect(validateRuling({ type: 'hp_change', targetName: 'X', amount: 9999, expression: '1d6' }).ok).toBe(false);
        expect(validateRuling({ type: 'hp_change', targetName: 'X', amount: 1.5, expression: '1d6' }).ok).toBe(false);
        expect(validateRuling({ type: 'target_effect', effect: 'Bless You!', targetName: 'X' }).ok).toBe(false);
        expect(validateRuling({ type: 'target_effect', effect: 'bless' }).ok).toBe(false);
    });

    it('hp_change must carry the dice that produce the amount (rule 2 — no invented numbers)', () => {
        // bare amount, zero provenance: invalid, fails closed to needs_human
        expect(validateRuling({ type: 'hp_change', targetName: 'X', amount: -6 }).ok).toBe(false);
        const bare = validateRuling({ type: 'hp_change', targetName: 'X', amount: -6 });
        expect(bare.errors.join(' ')).toMatch(/hp_change requires the dice expression/i);
        expect(validateRuling({ type: 'hp_change', targetName: 'X', amount: -6, expression: '2d6+3' }).ok).toBe(true);
        // non-expressions never pass the grammar
        expect(validateRuling({ type: 'hp_change', targetName: 'X', amount: -6, expression: 'chandelier!' }).ok).toBe(false);
        expect(validateRuling({ type: 'hp_change', targetName: 'X', amount: -6, expression: '2d' }).ok).toBe(false);
        expect(validateRuling({ type: 'hp_change', targetName: 'X', amount: -6, expression: '   ' }).ok).toBe(false);
    });

    it('caps text sizes and confidence range', () => {
        expect(validateRuling({ type: 'narrative', text: 'x'.repeat(2001) }).ok).toBe(false);
        expect(validateRuling({ type: 'dice', expression: '1d20', confidence: 1.5 }).ok).toBe(false);
        expect(validateRuling({ type: 'dice', expression: '1d20', confidence: 0.9 }).ok).toBe(true);
    });

    it('needsHumanRuling fallback is always schema-valid', () => {
        const r = needsHumanRuling('endpoint down');
        expect(validateRuling(r).ok).toBe(true);
        expect(r.text).toContain('endpoint down');
    });
});
