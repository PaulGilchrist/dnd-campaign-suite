/**
 * L5-001 coverage guard: every action command entry must route through
 * assertCanAct. A future action button wired without the gate fails this test.
 *
 * Source-text guard (runs without rendering all of CharSheet): each listed entry
 * file must contain an assertCanAct call. Sites that delegate to an already-gated
 * executor (e.g. BonusSpellRow → handleSpellAttackClick) are intentionally absent —
 * their execution terminates in a listed file.
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(__dirname, '../../..');

const GATED_ENTRY_FILES = [
    'src/components/char-sheet/useCharActionsAutomation.js',      // feature/action/bonus rows
    'src/components/char-sheet/useCharActionsAttackHandlers.js',  // attack rows
    'src/components/char-sheet/useCharActionsBaseActions.js',     // Hide / Dodge / Grapple
    'src/components/char-sheet/CharActions.jsx',                   // action spell damage + attack damage cells
    'src/components/char-sheet/CharBonusActions.jsx',              // bonus cells, poison, treats, horde breaker, spiritual weapon
    'src/components/char-sheet/CharReactions.jsx',                 // reaction rows + automation reactions
    'src/components/char-sheet/CharSpecialActions.jsx',            // meal / treats / brew / shapechange / special automation
    'src/components/char-sheet/char-spells/CharSpells.jsx',       // spell attack header
    'src/hooks/combat/useActionSpellMetamagic.js',                 // spell attack + metamagic casts
    'src/hooks/combat/useSpellCastExecutor.js',                    // confirmed spell-cast chokepoint
];

describe('action gate coverage (L5-001)', () => {
    it.each(GATED_ENTRY_FILES)('%s calls assertCanAct', (relPath) => {
        const src = readFileSync(resolve(ROOT, relPath), 'utf8');
        expect(src).toContain('assertCanAct(');
    });

    it('turn-state resets ride the initiative turn seams', () => {
        const src = readFileSync(resolve(ROOT, 'src/components/initiative/navigationHandlers.js'), 'utf8');
        expect(src).toContain('applyTurnStateTransition(');
        expect(src).toContain('rearmReactions(');
        expect(src).toContain('resetForTurn(');
    });

    it('the change-data chokepoint validates enforcement-scoped keys', () => {
        const src = readFileSync(resolve(ROOT, 'server/routes/campaigns-changedata.js'), 'utf8');
        expect(src).toContain('validateRuntimeWrite(');
    });
});
