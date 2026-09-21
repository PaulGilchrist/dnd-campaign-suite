// MA-0711: Faerie Dragon Euphoria Breath — the inline block-save seam fix.
// The row is shapeless ("within 5 feet" prose, no range field) so
// breathAoeShape is null and SaveAttackAoeModal never opens — MA-0087's
// slowedClauses grant route was picker-only, leaving a failed save with ZERO
// state (§53 MA-0090 class). buildAbilitySaveRollContext now arms
// slowedClauses via the SAME parseSlowedClauses helper (MA-0146
// speedZeroClause both-seams twin shape) so saveProcessing can grant the
// registered te no_reactions inline. Byte-inert null for clauseless rows;
// picker rows keep their own setConePicker seam byte-identical.
import { describe, it, expect } from 'vitest';
import { buildAbilitySaveRollContext, breathAoeShape } from './MonsterCardModal.jsx';
import { parseSlowedClauses } from './MonsterCardHelpers.js';
import monstersData from '../../../public/data/monsters.json';

const faerieRow = monstersData.find(m => m.index === 'faerie-dragon').actions.find(a => a.name === 'Euphoria Breath');
const biteRow = monstersData.find(m => m.index === 'faerie-dragon').actions.find(a => a.name === 'Bite');

const getDamageTypesForAction = (action) => [action?.damage_type_primary || 'Slashing'];

function contextFor(action) {
    return buildAbilitySaveRollContext({
        monsterName: 'Faerie Dragon 1',
        target: { name: 'Bandit 1', type: 'npc' },
        spellName: null,
        action,
        saveType: 'WIS',
        dcSuccess: 'half',
        saveDamageFormula: null,
        saveConditions: [],
        usesGate: null,
        prerequisite: null,
        getDamageTypesForAction,
    });
}

describe('MA-0711 buildAbilitySaveRollContext slowedClauses inline arm', () => {
    it('row fingerprint: shapeless (picker never opens), no canonical condition word', () => {
        expect(breathAoeShape(faerieRow, null)).toBeNull();
        expect(faerieRow.save_dc).toBe(11);
        expect(faerieRow.save_type).toBe('Wisdom');
        expect(parseSlowedClauses(faerieRow.save_effect)).toEqual({ effects: ['no_reactions'] });
    });

    it('Euphoria Breath save context carries slowedClauses {no_reactions}', () => {
        const ctx = contextFor(faerieRow);
        expect(ctx.slowedClauses).toEqual({ effects: ['no_reactions'] });
        expect(ctx.saveDc).toBe(11);
        expect(ctx.saveType).toBe('WIS');
        expect(ctx.autoDamageFormula).toBeNull();
    });

    it('byte-inert: clauseless row (same monster Bite) arms slowedClauses null', () => {
        const ctx = contextFor(biteRow);
        expect(ctx.slowedClauses).toBeNull();
    });

    it('byte-inert: save_effect without any slowed clause arms null', () => {
        const ctx = contextFor({
            name: 'Command', save_dc: 12, save_type: 'Wisdom',
            save_effect: 'The target is frightened until the end of its next turn.',
        });
        expect(ctx.slowedClauses).toBeNull();
    });
});
