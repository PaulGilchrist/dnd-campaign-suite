// @maintained-by-ai
// ── regenerate QUARTET lane #1949 .test — handle() orchestration (closes family) ──
// Seam map: regenerateHandler.active.test.js header (#1946). Lanes:
//   #1946 .active — load guard; isRegenerateActive predicate DEAD, export flagged
//                 for removal there.
//   #1947 .apply  — applyRegenerateEffect application incl. the exact one-write
//                 regenerateActive pin (subject's only flag-write forward contract).
//   #1948 .sp096 — fix locks: PC maxHp runtime truth, HP clamp, rolled notation.
//   #1949 .test  (this) — handle() ONLY: cast gate, combat-context popup fallback,
//                 regenerate_target_selection popup composition, purity guard.
// NOT here (do not re-add): application internals (#1947), fix-clause pins (#1948),
// predicate pins (#1946 retired), turn-seam 1 HP ticks (turnStartEffects.js lanes —
// applyTurnStartEffects.test.js L250-264 cited, cite-refreshed fix#336S/#1283). handle() never reads/writes the
// regenerateActive flag; per #1946 handoff, no predicate or turn-tick pins here.
//
// Contract note: the trim queue brief listed "CON save prompt / save-outcome
// dispatch / ability_use+save_result logs" lanes — they DO NOT exist in this
// subject. Regenerate declares no save in either ruleset spells.json; handle() is
// a pure popup composer (source L16-47): zero runtime writes, zero log entries,
// zero rolls. The caster prompt IS the target-selection popup; application happens
// on confirm through #1947's apply lane. Purity is pinned below, not fabricated.
//
// Liveness audit (re-verified 2026-10-16, grep incl. string/dynamic dispatch):
//   Registered surface: index.js import L14, HANDLER_MAP 'regenerate' L614.
//   executeHandler (L702) resolves HANDLER_MAP[automation.type] ONLY (resolveHandler
//   L675 — no name/index fallback; the spell row's "index":"regenerate" is NOT a
//   dispatch key). Today NO live producer feeds automation.type==='regenerate':
//   · 5e+2024 Regenerate spell rows carry type 'healing_start_of_turn' — no
//     HANDLER_MAP key → executeHandler returns null. No 'regenerate' type in any
//     public/data or public/campaigns JSON.
//   · Live cast lane: spellGates.js gateRegenerate L639 → cfSetPending('regenerate')
//     → useSimpleSpellHandlers runRegenerate L124 → regenerateService
//     confirmRegenerate L25 → applyRegenerateEffect DIRECT — bypasses handle().
//   · spellCastService/execution: triggerSpells.handleRegenerate L59 +
//     helpers.applyRegenerateSpell L447 — parallel cast lane with its own impl
//     (#1946 header's remove_regenerate_buff legacy-recipe flag stands).
//   · The former ONLY dispatch edge into handle() — regenerateService.triggerRegenerate
//     → executeHandler — was EXCISED by the #1398 dead-export census batch (2026-10-23):
//     triggerRegenerate had ZERO prod callers repo-wide, and fix#211 (#1483/#1472) wired
//     the LIVE lane WITHOUT it (shield 'regenerate' triggerSpells.js:64 → handleRegenerate
//     arm → helpers.applyRegenerateSpell; modal lane via confirmRegenerate — route homes,
//     cited never edited).
//   · Popup type 'regenerate_target_selection' has ZERO component consumers.
//   VERDICT: handle is registered-but-currently-undispatched — legacy callable
//   surface kept as fix#211's registry shield (index.js L614, owner constraint).
//   Owner decision still needed: retire handle + index.js L614 together, or rewire
//   the gate lane through handle. A test lane cannot settle that; this file pins the
//   EXACT popup contract that the registry entry still composes against, so either
//   direction is safe and any accidental contract drift while the lane sleeps fails
//   loudly here.
//
// makeAction merge shape: fix #14 pattern — spell/automation shallow-merged into
// defaults; remaining overrides spread exactly once (no whole-spell clobber).
// abilities-ARRAY honest grep: handle() reads NO playerStats field at all (gate +
// popup composition only) — the abilities-array fixture is inert here, no bug class.
// Timers: none in this lane — handle awaits one getCombatContext fetch, schedules
// nothing. Turn-based ✓.
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../combat/automation/automationExpressions.js', () => ({
    evaluateAutoExpression: vi.fn(),
}));

vi.mock('../../../rules/combat/applyHealing.js', () => ({
    applyHealingToTarget: vi.fn(),
}));

vi.mock('../../../encounters/combatData.js', () => ({
    getCombatSummary: vi.fn(),
}));

// Sealed for lane purity: handle() must never roll (rolling belongs to apply's
// rollInitialHeal, pinned in #1947/#1948). The purity guard asserts not-called.
vi.mock('../../../dice/diceRoller.js', () => ({
    rollExpression: vi.fn(),
}));

import { handle } from './regenerateHandler.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { addEntry } from '../../../ui/logService.js';
import { evaluateAutoExpression } from '../../../combat/automation/automationExpressions.js';
import { applyHealingToTarget } from '../../../rules/combat/applyHealing.js';
import { getCombatSummary } from '../../../encounters/combatData.js';
import { rollExpression } from '../../../dice/diceRoller.js';

const campaignName = 'TestCampaign';

// handle() ignores playerStats entirely (see abilities-ARRAY audit in header);
// fixture kept for call-shape honesty only.
function makePlayerStats(overrides = {}) {
    return {
        name: 'Cleric1',
        level: 7,
        proficiency: 4,
        abilities: [{ name: 'Wisdom', bonus: 3 }],
        hitPoints: 50,
        ...overrides,
    };
}

// fix #14 merge shape: spell + automation shallow-merge into defaults; every other
// override (e.g. name) spreads exactly once AFTER, so none can clobber spell.
function makeAction(overrides = {}) {
    return {
        name: 'Regenerate',
        automation: { ...overrides.automation },
        spell: {
            name: 'Regenerate',
            range: 'Touch',
            level: 7,
            ...overrides.spell,
        },
        ...Object.fromEntries(
            Object.entries(overrides).filter(([k]) => !['spell', 'automation'].includes(k)),
        ),
    };
}

describe('regenerateHandler.handle — #1949 orchestration lane', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('cast gate (source L19-21)', () => {
        it('returns null for every non-matching spell shape and short-circuits BEFORE touching combat context', async () => {
            const cases = [
                ['non-Regenerate spell', { name: 'Cure Wounds', automation: {}, spell: { name: 'Cure Wounds', range: 'Touch', level: 1 } }],
                ['spell.name missing', { name: 'Regenerate', spell: {} }],
                ['case-strict: lowercase name', makeAction({ spell: { name: 'regenerate' } })],
                ['spell key absent entirely', { name: 'Regenerate' }],
                ['spell.name null', makeAction({ spell: { name: null } })],
            ];
            for (const [, action] of cases) {
                expect(await handle(action, makePlayerStats(), campaignName, null)).toBeNull();
            }
            // gate must run before any context fetch (ordering kill for a
            // mutant that hoists getCombatContext above the name check)
            expect(getCombatContext).not.toHaveBeenCalled();
        });
    });

    describe('combat-context fallback (source L23-33)', () => {
        it('pops the exact automation_info payload when no combat context exists', async () => {
            getCombatContext.mockResolvedValue(null);

            const result = await handle(
                // distinct outer name pins name: action.name passthrough,
                // not a REGEN_NAME hardcode
                makeAction({ name: 'Regenerate (Scroll)' }),
                makePlayerStats(),
                campaignName,
                null,
            );

            expect(getCombatContext).toHaveBeenCalledTimes(1);
            expect(getCombatContext).toHaveBeenCalledWith(campaignName);
            expect(result).toEqual({
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: 'Regenerate (Scroll)',
                    description: 'No combat context found. Cannot apply Regenerate.',
                },
            });
        });
    });

    describe('regenerate_target_selection popup composition (source L35-46)', () => {
        it('composes the exact payload: names-only ordered creatureTargets, range, automation passthrough', async () => {
            getCombatContext.mockResolvedValue({
                creatures: [
                    { name: 'Goblin', currentHp: 7 },
                    { name: 'Orc' },
                    { name: 'Cleric1', type: 'player' },
                ],
            });
            const action = makeAction({ automation: { type: 'regenerate', range: 'Touch' } });

            const result = await handle(action, makePlayerStats(), campaignName, null);

            // whole-payload strict table: exact map(c=>c.name) projection
            // (caster included, source order), no key drift
            expect(result).toEqual({
                type: 'popup',
                payload: {
                    type: 'regenerate_target_selection',
                    name: action.name,
                    creatureTargets: ['Goblin', 'Orc', 'Cleric1'],
                    range: 'Touch',
                    automation: { type: 'regenerate', range: 'Touch' },
                },
            });
        });

        it('applies range and automation fallback defaults per table', async () => {
            getCombatContext.mockResolvedValue({ creatures: [] });
            const cases = [
                ['explicit range preserved', makeAction({ spell: { range: '60ft' } }), '60ft', {}],
                ['range missing defaults to Touch', makeAction({ spell: {} }), 'Touch', {}],
                ['automation absent defaults to {}', { name: 'Regenerate', spell: { name: 'Regenerate' } }, 'Touch', {}],
                ['custom automation passes through untouched', makeAction({ automation: { customFlag: true } }), 'Touch', { customFlag: true }],
            ];
            for (const [, action, expectedRange, expectedAutomation] of cases) {
                const result = await handle(action, makePlayerStats(), campaignName, null);
                expect(result.type).toBe('popup');
                expect(result.payload).toEqual({
                    type: 'regenerate_target_selection',
                    name: 'Regenerate',
                    creatureTargets: [],
                    range: expectedRange,
                    automation: expectedAutomation,
                });
            }
        });
    });

    describe('purity guard (no game-state side effects on the cast prompt)', () => {
        it('handle() reads combat context ONLY — zero flag writes, logs, expression eval, rolls, or healing', async () => {
            getCombatContext.mockResolvedValue({ creatures: [{ name: 'Goblin' }] });

            await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(getCombatContext).toHaveBeenCalledWith(campaignName);
            // regenerateActive writes belong to apply (#1947 one-write table)
            expect(setRuntimeValue).not.toHaveBeenCalled();
            expect(getRuntimeValue).not.toHaveBeenCalled();
            // all ability_use/hp_change/spell_effect logging is #1947 apply-lane territory
            expect(addEntry).not.toHaveBeenCalled();
            // expression evaluation + rolling belong to apply rollInitialHeal (#1947/#1948)
            expect(evaluateAutoExpression).not.toHaveBeenCalled();
            expect(rollExpression).not.toHaveBeenCalled();
            // handle awaits the async getCombatContext seam; sync getCombatSummary
            // is apply's seam — pinning the two lanes stay distinct
            expect(getCombatSummary).not.toHaveBeenCalled();
            expect(applyHealingToTarget).not.toHaveBeenCalled();
        });
    });
});
