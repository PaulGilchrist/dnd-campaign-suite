// @maintained-by-ai 2026-11-27
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

// Canonical action-gate site inventory (one list for both checks below).
// feedCannotAct (RB-1115): the site must feed cannotAct into assertCanAct and
// must NOT re-add the silent `if (cannotAct) return;` shape the enforcement
// gate was designed to replace (assertCanAct.js header). The two spell
// chokepoints opt out: useSpellCastExecutor gates at the execute seam and
// useSpellMetamagicGates gates pre-payment (owner ruling 2026-11-10), and
// neither receives cannotAct in its ctx. CharReactions keeps its cannotAct-ONLY
// loud economy gate at handleReactionClick by design (pending-OA bypass law),
// so the feed requirement is per-file, not per-call.
const GATED_ENTRY_FILES = [
    { path: 'src/components/char-sheet/useCharActionsAutomation.js', feedCannotAct: true },       // feature/action/bonus rows
    { path: 'src/components/char-sheet/useCharActionsAttackHandlers.js', feedCannotAct: true },   // attack rows
    { path: 'src/components/char-sheet/useCharActionsBaseActions.js', feedCannotAct: true },      // Hide / Dodge / Grapple
    { path: 'src/components/char-sheet/CharActions.jsx', feedCannotAct: true },                   // action spell damage + attack damage cells
    { path: 'src/components/char-sheet/CharBonusActions.jsx', feedCannotAct: true },              // bonus cells, poison, treats, horde breaker, spiritual weapon
    { path: 'src/components/char-sheet/CharReactions.jsx', feedCannotAct: true },                 // reaction rows + automation reactions
    { path: 'src/components/char-sheet/CharSpecialActions.jsx', feedCannotAct: true },            // meal / treats / brew / shapechange / special automation
    { path: 'src/components/char-sheet/char-spells/CharSpells.jsx', feedCannotAct: true },        // spell attack header
    { path: 'src/hooks/combat/useActionSpellMetamagic.js', feedCannotAct: true },                 // spell attack + metamagic casts
    { path: 'src/hooks/combat/useSpellCastExecutor.js', feedCannotAct: false },                   // confirmed spell-cast chokepoint
    // The sheet spell lane PAYS (slot/material) inside gateMetamagic's branches
    // before delegating to the executor, so it gates early at its own entry —
    // enforcement denials must cost nothing (owner ruling 2026-11-10).
    { path: 'src/hooks/combat/useSpellMetamagicGates.js', feedCannotAct: false },                 // spell-row pre-payment enforcement gate
];

describe('action gate coverage (L5-001)', () => {
    it.each(GATED_ENTRY_FILES)('$path routes through assertCanAct', ({ path, feedCannotAct }) => {
        const src = read(path);
        // Import wired from the enforcement module (not just a stray mention)…
        expect(src).toMatch(/import\s*\{[^}]*\bassertCanAct\b[^}]*\}\s*from\s*['"][^'"]*assertCanAct\.js['"]/);
        // …and actually invoked at a call-site.
        expect(src).toMatch(/\bassertCanAct\s*\(/);

        if (feedCannotAct) {
            expect(src, `${path}: silent cannotAct gate re-added`).not.toMatch(/if\s*\(\s*cannotAct\s*(\|\|[^)]*)?\)\s*return;/);
            const fedCalls = [...src.matchAll(/\bassertCanAct\s*\(\s*\{([\s\S]*?)\}\s*\)/g)]
                .filter(([, args]) => /[,{\s]cannotAct\s*[,}]/.test(args));
            expect(fedCalls.length, `${path}: assertCanAct must be fed cannotAct (no silent gates)`).toBeGreaterThan(0);
        }
    });

    it('turn-state resets ride the initiative turn seams', () => {
        const src = read('src/components/initiative/navigationHandlers.js');
        // navigationHandlers must be wired to the turnState reducer AND actually
        // drive it: importing resetForTurn without invoking it (the parenthesis
        // distinguishes a call from the bare import specifier) is a gutted seam.
        expect(src).toMatch(/import\s*\{[^}]*\bresetForTurn\b[^}]*\}\s*from\s*['"][^'"]*turnState\.js['"]/);
        expect(src).toMatch(/\bresetForTurn\s*\(/);
        // applyTurnStateTransition must be BOTH defined and invoked at the
        // navigation seam — pin the definition, then require a second
        // occurrence (the call; a lone gutted definition fails).
        expect(src).toMatch(/function\s+applyTurnStateTransition\s*\(/);
        expect((src.match(/\bapplyTurnStateTransition\s*\(/g) || []).length).toBeGreaterThanOrEqual(2);
    });
});
