// @maintained-by-ai 2026-11-27
// ── regenerate QUARTET lane #1949 .test — handle() orchestration + registration ──
// Shared seam map lives in regenerateHandler.active.test.js header (#1946, audit
// lane, RE-VERIFIED 2026-11-27). Lanes:
//   #1946 .active — load guard + dead-export census; isRegenerateActive (source
//                 L192-195) is a DEAD export, unpinned by tally precedent #1916
//                 (delete recommended there; NOTHING here pins it either).
//   #1947 .apply  — applyRegenerateEffect application incl. the exact one-write
//                 regenerateActive flag census (subject's only flag-WRITE pin).
//   #1948 .sp096  — fix locks: PC maxHp runtime truth, HP clamp, rolled notation.
//   #1949 .test   (this) — handle() ONLY: cast gate, combat-context popup fallback,
//                 regenerate_target_selection popup composition, purity guard,
//                 plus the HANDLER_MAP registration wiring pin (unclaimed by the
//                 generic mechanics lane #1997, which pins dispatcher mechanics,
//                 never feature-specific routes — feature-lane precedent: psychic
//                 #1996 / implosion #1998 / web #1999).
// NOT here (do not re-add): application internals (#1947), fix-clause pins (#1948),
// predicate pins (#1946 retired), turn-seam 1 HP ticks (turnStartEffects.js lanes —
// expirations_additional / applyTurnStartEffects homes, cite by NAME per run2
// line-drift note). handle() never reads/writes the regenerateActive flag.
//
// Contract note: the trim queue brief listed "CON save prompt / save-outcome
// dispatch / ability_use+save_result logs" lanes — they DO NOT exist in this
// subject. Regenerate declares no save in either ruleset spells.json; handle() is
// a pure popup composer (source L16-47): zero runtime writes, zero log entries,
// zero rolls. The caster prompt IS the target-selection popup; application happens
// on confirm through #1947's apply lane. Purity is pinned below, not fabricated.
// Fire/cold damage-pause: BESTIARY TRAIT PROSE only; spell RAW has no such clause,
// handler implements none — nothing to pin (per #1946 duration-policy PASS).
//
// Liveness audit (RE-VERIFIED 2026-11-27 against current bytes, grep incl. string
// dispatch; previous pass carried line drift — names below are the contract):
//   Registered surface: index.js import L14, HANDLER_MAP 'regenerate' L614
//   (executeHandler → resolveHandler L675-699, table fallthrough L699 ONLY — the
//   spell row's "index":"regenerate" is NOT a dispatch key). NO live producer
//   feeds automation.type==='regenerate':
//   · 5e+2024 Regenerate spell rows carry automation.type 'healing_start_of_turn'
//     — no HANDLER_MAP key → executeHandler returns null. Pinned below as the
//     DORMANT-LANE DATA PIN so silent re-arming of this route fails loudly.
//   · Live modal cast lane: spellGates.js gateRegenerate L639 → cfSetPending
//     ('regenerate') → useSimpleSpellHandlers runRegenerate L140 → regenerateService
//     confirmRegenerate L21 → applyRegenerateEffect DIRECT — bypasses handle().
//   · Live service cast lane: triggerSpells.js 'regenerate' shield L64 →
//     handleRegenerate L67 → helpers.applyRegenerateSpell L511 — parallel impl,
//     never enters handle() (grep-verified: no executeHandler call in that path).
//   · The former ONLY dispatch edge into handle() — regenerateService.triggerRegenerate
//     → executeHandler — was EXCISED by the #1398 dead-export census batch (2026-10-23);
//     fix#211 (#1483/#1472) wired the LIVE lanes WITHOUT it.
//   · Popup type 'regenerate_target_selection' has ZERO component consumers
//     (grep 2026-11-27: only this handler composes it).
//   VERDICT: handle is registered-but-currently-undispatched — legacy callable
//   surface kept as fix#211's registry shield (index.js L614, owner constraint).
//   Owner decision still needed: retire handle + index.js L614 together, or rewire
//   a cast lane through handle. A test lane cannot settle that; this file pins the
//   EXACT popup contract AND that the registry route still resolves to this handle,
//   so either direction is safe and any accidental contract drift while the lane
//   sleeps fails loudly here.
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
import { executeHandler } from '../../index.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { addEntry } from '../../../ui/logService.js';
import { evaluateAutoExpression } from '../../../combat/automation/automationExpressions.js';
import { applyHealingToTarget } from '../../../rules/combat/applyHealing.js';
import { getCombatSummary } from '../../../encounters/combatData.js';
import { rollExpression } from '../../../dice/diceRoller.js';
import spells5e from '../../../../../public/data/spells.json';
import spells2024 from '../../../../../public/data/2024/spells.json';
import classes5e from '../../../../../public/data/classes.json';
import classes2024 from '../../../../../public/data/2024/classes.json';

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

// [label, action] pairs for the refusal family.
const REFUSAL_CASES = [
    ['non-Regenerate spell', { name: 'Cure Wounds', automation: {}, spell: { name: 'Cure Wounds', range: 'Touch', level: 1 } }],
    ['spell.name missing', { name: 'Regenerate', spell: {} }],
    ['case-strict: lowercase name', makeAction({ spell: { name: 'regenerate' } })],
    ['spell key absent entirely', { name: 'Regenerate' }],
    ['spell.name null', makeAction({ spell: { name: null } })],
];

describe('regenerateHandler.handle — #1949 orchestration lane', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('cast gate: refuses every non-matching spell shape and short-circuits BEFORE touching combat context', async () => {
        for (const [, action] of REFUSAL_CASES) {
            expect(await handle(action, makePlayerStats(), campaignName, null)).toBeNull();
        }
        // full-array zero-spend census: gate runs before any context fetch
        // (ordering kill for a mutant that hoists getCombatContext above the check)
        expect(getCombatContext.mock.calls).toEqual([]);
    });

    it('no combat context: pops the exact automation_info payload and fetches context exactly once', async () => {
        getCombatContext.mockResolvedValue(null);

        const result = await handle(
            // distinct outer name pins name: action.name passthrough (not a
            // REGEN_NAME hardcode) AND that the gate keys on spell.name, not
            // the outer action name
            makeAction({ name: 'Regenerate (Scroll)' }),
            makePlayerStats(),
            campaignName,
            null,
        );

        expect(getCombatContext.mock.calls).toEqual([[campaignName]]);
        expect(result).toEqual({
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: 'Regenerate (Scroll)',
                description: 'No combat context found. Cannot apply Regenerate.',
            },
        });
    });

    it('popup composition: exact regenerate_target_selection payload table (names-only ordered projection, name passthrough, range/automation fallbacks)', async () => {
        const cases = [
            {
                label: 'names-only projection, source order, caster included; distinct outer name passes through',
                creatures: [
                    { name: 'Goblin', currentHp: 7 },
                    { name: 'Orc' },
                    { name: 'Cleric1', type: 'player' },
                ],
                action: makeAction({
                    name: 'Regenerate (Potion)',
                    automation: { type: 'regenerate', range: 'Touch' },
                }),
                payload: {
                    type: 'regenerate_target_selection',
                    name: 'Regenerate (Potion)',
                    creatureTargets: ['Goblin', 'Orc', 'Cleric1'],
                    range: 'Touch',
                    automation: { type: 'regenerate', range: 'Touch' },
                },
            },
            {
                label: 'explicit range preserved',
                creatures: [],
                action: makeAction({ spell: { range: '60ft' } }),
                payload: {
                    type: 'regenerate_target_selection',
                    name: 'Regenerate',
                    creatureTargets: [],
                    range: '60ft',
                    automation: {},
                },
            },
            {
                label: 'range missing defaults to Touch',
                creatures: [],
                action: makeAction({ spell: {} }),
                payload: {
                    type: 'regenerate_target_selection',
                    name: 'Regenerate',
                    creatureTargets: [],
                    range: 'Touch',
                    automation: {},
                },
            },
            {
                label: 'automation absent defaults to {}',
                creatures: [],
                // raw action: no automation key at all (source L44 fallback)
                action: { name: 'Regenerate', spell: { name: 'Regenerate' } },
                payload: {
                    type: 'regenerate_target_selection',
                    name: 'Regenerate',
                    creatureTargets: [],
                    range: 'Touch',
                    automation: {},
                },
            },
            {
                label: 'custom automation passes through untouched',
                creatures: [],
                action: makeAction({ automation: { customFlag: true } }),
                payload: {
                    type: 'regenerate_target_selection',
                    name: 'Regenerate',
                    creatureTargets: [],
                    range: 'Touch',
                    automation: { customFlag: true },
                },
            },
        ];
        for (const { label, creatures, action, payload } of cases) {
            getCombatContext.mockResolvedValue({ creatures });
            const result = await handle(action, makePlayerStats(), campaignName, null);
            // whole-payload strict table: exact map(c=>c.name) projection, no key drift
            expect(result, label).toEqual({ type: 'popup', payload });
        }
        expect(getCombatContext.mock.calls).toEqual(cases.map(() => [campaignName]));
    });

    it('purity guard: handle() reads combat context ONLY — zero flag reads/writes, logs, expression eval, rolls, or healing', async () => {
        getCombatContext.mockResolvedValue({ creatures: [{ name: 'Goblin' }] });

        await handle(makeAction(), makePlayerStats(), campaignName, null);

        expect(getCombatContext.mock.calls).toEqual([[campaignName]]);
        // regenerateActive writes belong to apply (#1947 one-write table)
        expect(setRuntimeValue.mock.calls).toEqual([]);
        expect(getRuntimeValue.mock.calls).toEqual([]);
        // all ability_use/hp_change/spell_effect logging is #1947 apply-lane territory
        expect(addEntry.mock.calls).toEqual([]);
        // expression evaluation + rolling belong to apply rollInitialHeal (#1947/#1948)
        expect(evaluateAutoExpression.mock.calls).toEqual([]);
        expect(rollExpression.mock.calls).toEqual([]);
        // handle awaits the async getCombatContext seam; sync getCombatSummary
        // is apply's seam — pinning the two lanes stay distinct
        expect(getCombatSummary.mock.calls).toEqual([]);
        expect(applyHealingToTarget.mock.calls).toEqual([]);
    });

    it('registration wiring: the REAL executeHandler dispatcher routes automation.type "regenerate" to this module\'s handle (index.js import L14 + HANDLER_MAP L614)', async () => {
        getCombatContext.mockResolvedValue({
            creatures: [{ name: 'Goblin' }, { name: 'Cleric1', type: 'player' }],
        });
        const action = makeAction({ automation: { type: 'regenerate', range: 'Touch' } });

        const result = await executeHandler(action, makePlayerStats(), campaignName, null);

        // exact composed popup proves dispatcher identity: 'regenerate_target_selection'
        // is composed NOWHERE else repo-wide, so this payload can only come from
        // this module's handle via the registry entry #1946 re-verifies as live.
        expect(result).toEqual({
            type: 'popup',
            payload: {
                type: 'regenerate_target_selection',
                name: 'Regenerate',
                creatureTargets: ['Goblin', 'Cleric1'],
                range: 'Touch',
                automation: { type: 'regenerate', range: 'Touch' },
            },
        });
        expect(getCombatContext.mock.calls).toEqual([[campaignName]]);
    });

    it('dormant-lane data pin: no ruleset row dispatches type "regenerate" — the registry entry stays fix#211 shield, never a live cast route', () => {
        // Both Regenerate spell rows pin their exact on-disk automation shape:
        // type 'healing_start_of_turn' (turn-start subsystem, NOT this handler).
        for (const doc of [spells5e, spells2024]) {
            const row = doc.find(s => s.name === 'Regenerate');
            expect(row).toBeDefined();
            expect(row.automation).toEqual({
                type: 'healing_start_of_turn',
                healExpression: '1',
                bodyPartRegrowMinutes: 2,
            });
        }
        // Absence census across all four rules docs: re-arming this route (a row
        // declaring type 'regenerate') must fail here, not silently wake a lane
        // whose popup has zero component consumers.
        const automationRows = docs => docs.flatMap(doc =>
            doc.flatMap(s => Array.isArray(s.automation) ? s.automation : [s.automation].filter(Boolean)),
        );
        for (const row of automationRows([spells5e, spells2024, classes5e, classes2024])) {
            expect(row.type).not.toBe('regenerate');
        }
    });
});
