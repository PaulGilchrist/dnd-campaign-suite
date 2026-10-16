// @maintained-by-ai
/**
 * L5-001 coverage guard — action-gate WIRING registry (source-text lane).
 *
 * Seam map (this lane vs siblings):
 * - THIS FILE: static wiring only — every action-entry file must import AND call
 *   assertCanAct, and the initiative navigation seam must drive turnState resets.
 *   Runs without rendering CharSheet; a future action button wired without the
 *   gate, or a gate call silently gutted to a comment, fails here.
 * - assertCanAct.test.js: enforcement internals (buckets, cannotAct, popups).
 * - assertCanAct.charge.test.js: charge-on-allow consumption.
 * - turnState.test.js: pure turnState reducer semantics.
 * - server/routes/campaigns-changedata-l5-validation.test.js: HTTP-level
 *   behavior of the validateRuntimeWrite chokepoint (posts real enforcement /
 *   turnState keys and asserts accept/deny), so no string guard for it lives here.
 *
 * Sites that delegate to an already-gated executor (e.g. BonusSpellRow →
 * handleSpellAttackClick) are intentionally absent — their execution terminates
 * in a listed file.
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(__dirname, '../../..');

const read = (relPath) => readFileSync(resolve(ROOT, relPath), 'utf8');

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
    it.each(GATED_ENTRY_FILES)('%s routes through assertCanAct', (relPath) => {
        const src = read(relPath);
        // Import wired from the enforcement module (not just a stray mention)…
        expect(src).toMatch(/import\s*\{[^}]*\bassertCanAct\b[^}]*\}\s*from\s*['"][^'"]*assertCanAct\.js['"]/);
        // …and actually invoked at a call-site.
        expect(src).toMatch(/\bassertCanAct\s*\(/);
    });

    it('turn-state resets ride the initiative turn seams', () => {
        const src = read('src/components/initiative/navigationHandlers.js');
        // navigationHandlers must be wired to the turnState reducer…
        expect(src).toMatch(/import\s*\{[^}]*\bresetForTurn\b[^}]*\}\s*from\s*['"][^'"]*turnState\.js['"]/);
        // …and applyTurnStateTransition must be BOTH defined and invoked at the
        // navigation seam (one occurrence alone — a gutted, uncalled definition — fails).
        expect((src.match(/applyTurnStateTransition\(/g) || []).length).toBeGreaterThanOrEqual(2);
    });
});
