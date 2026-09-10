// MN-020: the Superior Technique style grant must carry the save spec tokens
// (saveDc:'ability', saveAbility:['STR','DEX']) mirroring the Battle Master major
// feature automation, so buildSaveDc resolves 8 + STR/DEX mod + PB at prompt time
// instead of falling back to DC 10.
import { describe, it, expect } from 'vitest';
import { applyFightingStyleSpecialActionsUniversal } from './rules-fightingStyles.js';

const host = () => ({
    class: { fightingStyles: ['Superior Technique'] },
    specialActions: [],
});

describe('MN-020 Superior Technique grant — save spec tokens', () => {
    it('pushes Combat Superiority with saveDc:"ability" and saveAbility:["STR","DEX"]', () => {
        const stats = host();
        applyFightingStyleSpecialActionsUniversal(stats);

        const grant = stats.specialActions.find(a => a.name === 'Combat Superiority');
        expect(grant).toBeTruthy();
        expect(grant.automation.saveDc).toBe('ability');
        expect(grant.automation.saveAbility).toEqual(['STR', 'DEX']);
    });

    it('keeps the concrete d6 die and 1-use caps for the style', () => {
        const stats = host();
        applyFightingStyleSpecialActionsUniversal(stats);

        const grant = stats.specialActions.find(a => a.name === 'Combat Superiority');
        expect(grant.automation.dieExpression).toBe('6');
        expect(grant.automation.uses_max).toBe(1);
        expect(grant.automation.maxOptions).toBe(1);
    });
});
