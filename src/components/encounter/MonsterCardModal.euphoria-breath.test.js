// @maintained-by-ai
// MA-0711: Faerie Dragon Euphoria Breath — the inline block-save seam fix.
// The row is shapeless ("within 5 feet" prose, no range field) so
// breathAoeShape is null and SaveAttackAoeModal never opens — MA-0087's
// slowedClauses grant route was picker-only, leaving a failed save with ZERO
// state. This file pins ONLY the modal-lane threading seam: buildAbilitySaveRollContext
// arms slowedClauses via the SAME parseSlowedClauses helper (MA-0146
// speedZeroClause both-seams twin shape) with euphoria-distinct bytes on the
// inline ctx, and stays byte-inert null for clauseless rows (picker rows keep
// their own setConePicker seam byte-identical).
// Cited owners (not re-pinned here): parseSlowedClauses branches —
// MonsterCardHelpers.slowed-clauses.test.js; te grant + merged §37 clock on
// fail — saveProcessing.euphoria-breath.test.js; save-leg damage fields
// (autoDamageFormula pass-through) — giant-snake-save-leg.test.js et al.
import { describe, it, expect } from 'vitest';
import { buildAbilitySaveRollContext, breathAoeShape } from './MonsterCardModal.jsx';
import monstersData from '../../../public/data/monsters.json';

const faerie = monstersData.find(m => m.index === 'faerie-dragon');
const faerieRow = faerie.actions.find(a => a.name === 'Euphoria Breath');
const biteRow = faerie.actions.find(a => a.name === 'Bite');

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
    // BY-name disk lock: shapeless row (picker never opens) + ctx identity
    // (DC/type prove the context was built from the real Euphoria Breath row).
    it('Euphoria Breath inline ctx arms slowedClauses {no_reactions}', () => {
        expect(breathAoeShape(faerieRow, null)).toBeNull();
        const ctx = contextFor(faerieRow);
        expect(ctx.slowedClauses).toEqual({ effects: ['no_reactions'] });
        expect(ctx.saveDc).toBe(11);
        expect(ctx.saveType).toBe('WIS');
    });

    it.each([
        ['Bite (no save_effect field)', biteRow],
        ['clauseless prose (Command)', {
            name: 'Command', save_dc: 12, save_type: 'Wisdom',
            save_effect: 'The target is frightened until the end of its next turn.',
        }],
    ])('byte-inert: %s arms slowedClauses null', (_label, action) => {
        expect(contextFor(action).slowedClauses).toBeNull();
    });
});
