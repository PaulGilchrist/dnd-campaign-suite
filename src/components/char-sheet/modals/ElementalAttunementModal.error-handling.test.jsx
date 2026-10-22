// @maintained-by-ai
/**
 * ElementalAttunementModal — ERROR-HANDLING lane.
 *
 * Ownership map (siblings, do not duplicate here):
 * - .elemental-data.test.jsx  — ELEMENT_DATA/ELEMENT_DESCRIPTIONS as rendered, non-mutation.
 * - .phase-flow.test.jsx      — element→targets→processing→summary transitions, DC math,
 *                                map-overlay happy-path loading, overlay click-to-close guard.
 * - .npc-save.test.jsx        — NPC save resolution math, condition log CONTENT, persistAndNotify
 *                                (NOTE: NPC push math exists but is unreachable — see dead-code flag).
 * - .player-save.test.jsx     — save prompts, save-result event handling INCLUDING the player
 *                                addEntry rejection logs (:290-340 there: 'Error logging player
 *                                save:'/'Error logging player effect:' and pending-prompt removal
 *                                when logging fails) and malformed/unknown-promptId junk events.
 * - .summary.test.jsx         — onClose invocation, expiration log DESCRIPTION text variants.
 * - .deactivation.test.jsx    — handleResultsClose commit payloads, §39 single-clock order,
 *                                double-commit defect pin, inertness.
 * This lane owns ONLY failure behavior: every in-flight addEntry .catch lane the component can
 * actually reach (NPC save / speed reduction / expiration) proves the caught log rejection never
 * strands or rolls back the game-state commit; the unreachable Thunder push lane pinned inert;
 * the loadMapData catch's stranded inert view; and
 * the PINNED unhandled-rejection behavior of the unguarded .then at jsx:482-485 (a future fix
 * adding .catch there flips these pins).
 *
 * DELETED (subsumed here): the prior single mega-test "handles logging, map loading, and
 * expiration errors without crashing" — its speed-reduction case is subsumed by the parameterised
 * NPC log-rejection lane (Fire arm also covers the previously untested 'Error logging NPC save:'
 * catch), its expiration case by the dedicated expiration lane (now also asserting the commit
 * survives through the LIVE store, which the mega-test never checked), and its map case by the
 * map lane (now pinning the stranded null render + no-retry + zero-partial-writes that the
 * mega-test skipped). All three shared one test, so a mid-test consoleSpy/mock bleed could mask
 * regressions; each lane now runs with its own fresh mocks and its own rejection guard.
 *
 * Anti-vacuity: live runtime store (writes land, cells inspected directly — a rolled-back or
 * never-issued commit shows as a missing cell, not a call-recorder echo); ONE frozen combat
 * fixture handed back by identity so exact-arg assertions prove consumption; every console.error
 * asserted with its exact full-line prefix AND the exact rejected Error instance (identity, not
 * expect.any); role-scoped queries; no bare setTimeout.
 *
 * FLAG (component, not fixed here):
 * - ElementalAttunementModal.jsx:430-450 — unguarded async IIFE (map path): the catch logs and
 *   abandons. Phase stays 'targets', which renders null — the user gets NO error feedback, NO
 *   retry, and no way out except remount. Pinned as current behavior. Product fix: surface an
 *   error screen with Retry/Cancel.
 * - ElementalAttunementModal.jsx:482-485 — unguarded .then(setResults): ANY throw inside
 *   resolveAllSavesAndDamage rejects unhandled and strands the 'Resolving…' processing view
 *   forever (no Close, no results). Pinned via the Promise.prototype.then rejection guard
 *   (below) on the dice lane and the persist lane; persist also shows the silent data-loss
 *   window (in-memory damage applied, persist skipped). Product fix: .catch → console.error + error phase.
 * - ElementalAttunementModal.jsx:482 — even when the dice lane had a guard, results/persist are
 *   not atomic: applyDamageToTarget mutates the summary before persistAndNotify runs, so a
 *   persist failure loses HP silently.
 * - ElementalAttunementModal.jsx:152-156,172-219 — DEAD CODE (found live): resolveAllSavesAndDamage
 *   (:404-409) routes every element WITH damage — including Thunder, which carries effect:'push' —
 *   through resolveNpcDamageResult, so resolveNpcPushResult/applyNpcPush never run for NPCs and
 *   the 'Error logging Thunder save:' console lane can never fire. Thunder push is silently lost
 *   on NPC targets. Pinned by the Thunder arm below. Product fix: dispatch on `effect` first
 *   (or compose push with damage) instead of `damage` first.
 */
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import ElementalAttunementModal from './ElementalAttunementModal.jsx';

// ── Live runtime store (anti-vacuous): failed logs must roll NOTHING back and
//    successful lanes must leave the store untouched — checked on cells, not calls. ──

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => {
    const cells = new Map();
    const read = (key, prop) => cells.get(`${key}|${prop}`) ?? null;
    const write = (key, prop, value) => { cells.set(`${key}|${prop}`, value); return Promise.resolve(); };
    return {
        cells,
        getRuntimeValue: vi.fn(read),
        setRuntimeValue: vi.fn(write),
    };
});

// Recorder for addExpiration: the expiration-log rejection must not skip the clock arming.
vi.mock('../../../services/rules/effects/expirations.js', () => {
    const arms = [];
    return {
        arms,
        addExpiration: vi.fn(arm => { arms.push(arm); }),
    };
});

vi.mock('../../../services/dice/diceRoller.js', () => ({
    rollExpression: vi.fn(() => ({ total: 5, rolls: [5], modifier: 0 })),
}));

vi.mock('../../../services/rules/combat/applyDamage.js', async (importOriginal) => ({
    ...await importOriginal(),
    computeDamageAfterSave: vi.fn((damage, success, dcSuccess) => {
        if (dcSuccess === 'half') return success ? Math.floor(damage / 2) : damage;
        return damage;
    }),
    computeDamageAfterResistancesWithDetails: vi.fn(({ rawDamage }) => ({ finalDamage: rawDamage })),
    applyDamageToTarget: vi.fn(),
}));

vi.mock('../../../services/combat/conditions/savePromptService.js', () => ({
    sendSavePrompt: vi.fn(),
}));

vi.mock('../../../services/rules/combat/aoeService.js', () => ({
    getAffectedCreatures: vi.fn(() => []),
}));

vi.mock('../../../services/encounters/combatData.js', () => ({
    getCombatSummary: vi.fn(() => null),
    setCombatSummaryCache: vi.fn(),
}));

vi.mock('../../../services/ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('./shared/AreaEffectTargetModalBase.utils.jsx', () => ({
    persistAndNotify: vi.fn(),
}));

vi.mock('../../../services/maps/mapsService.js', () => ({
    loadMapData: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('./shared/CreatureSelectionModal.jsx', () => ({
    default: vi.fn(({ targets, onConfirm, onSkip }) => (
        <div className="sp-overlay">
            <div className="sp-modal">
                <button onClick={() => onConfirm(targets.map(t => t.name))} disabled={targets.length === 0}>Activate</button>
                <button onClick={onSkip}>Skip</button>
            </div>
        </div>
    )),
}));

// ── Re-import mocked modules ──

import * as runtime from '../../../hooks/runtime/useRuntimeState.js';
import * as expirations from '../../../services/rules/effects/expirations.js';
import * as diceRoller from '../../../services/dice/diceRoller.js';
import * as aoeService from '../../../services/rules/combat/aoeService.js';
import * as combatData from '../../../services/encounters/combatData.js';
import * as logService from '../../../services/ui/logService.js';
import * as mapsService from '../../../services/maps/mapsService.js';
import { persistAndNotify } from './shared/AreaEffectTargetModalBase.utils.jsx';
import { applyDamageToTarget } from '../../../services/rules/combat/applyDamage.js';

const { cells } = runtime;
const { arms } = expirations;

// ── Fixtures (frozen — the component may not mutate its inputs) ──

const PLAYER = 'Monk1';
const CAMPAIGN = 'test-campaign';
const OVERLAY = { type: 'sphere' };

const baseAction = Object.freeze({ name: 'Elemental Attunement' });
const basePlayerStats = Object.freeze({
    name: PLAYER,
    level: 5,
    proficiency: 3,
    abilities: Object.freeze([
        Object.freeze({ name: 'Strength', bonus: 2 }),
        Object.freeze({ name: 'Dexterity', bonus: 4 }),
        Object.freeze({ name: 'Constitution', bonus: 1 }),
        Object.freeze({ name: 'Intelligence', bonus: 0 }),
        Object.freeze({ name: 'Wisdom', bonus: 1 }),
        Object.freeze({ name: 'Charisma', bonus: 0 }),
    ]),
});

// DC = 8 + WIS 1 + PROF 3 = 12; Math.random pinned to 0.5 → save roll 11.
// Goblin fails every save (dex -10, con -10): 11 + (-10) = 1 < 12.
const NPC_GOBLIN = Object.freeze({
    name: 'Goblin1',
    type: 'npc',
    currentHp: 7,
    maxHp: 7,
    saveBonuses: Object.freeze({ dex: -10, con: -10 }),
    resistances: Object.freeze([]),
    immunities: Object.freeze([]),
});

// ONE frozen summary by identity: exact-arg/identity assertions prove the component
// consumed THIS fixture, not a mock echoing its own input.
const combatNpc = Object.freeze({ creatures: Object.freeze([NPC_GOBLIN]) });

// Fresh vi.fn per render (house rule: no shared module-level onClose).
function makeProps(overrides = {}) {
    return {
        action: baseAction,
        playerStats: basePlayerStats,
        campaignName: CAMPAIGN,
        onClose: vi.fn(),
        ...overrides,
    };
}

function seedOverlayCombat(fixture) {
    combatData.getCombatSummary.mockReturnValue(fixture);
    aoeService.getAffectedCreatures.mockReturnValue(fixture.creatures.map(c => ({ creature: c })));
}

// ── Rejection guard for the pins (see header :482-485 flag).
//    Vitest 4 runs tests in a separate realm: process/window 'unhandledrejection'
//    listeners registered from test code never fire (verified live), and any truly
//    unhandled rejection fails the whole run at vitest's collector. So the guard is
//    a scope-limited Promise.prototype.then patch, armed ONLY around the pinned clicks:
//    chains that pass NO rejection handler — exactly jsx:482 — get a recording no-op
//    injected (component behavior byte-identical: setResults still never runs, the view
//    still strands), while the exact stranded reason is captured. The component's own
//    .catch lanes pass through untouched. A future fix adding a real .catch at :482
//    means the guard sees nothing and these pins flip. ──

let rejections;
let originalThen = null;

function armUnguardedThenGuard() {
    rejections = [];
    originalThen = Promise.prototype.then;
    Promise.prototype.then = function (onFulfilled, onRejected) {
        if (typeof onRejected === 'function') return originalThen.call(this, onFulfilled, onRejected);
        return originalThen.call(this, onFulfilled, err => { if (!rejections.includes(err)) rejections.push(err); });
    };
}

function disarmUnguardedThenGuard() {
    if (originalThen) {
        Promise.prototype.then = originalThen;
        originalThen = null;
    }
}

beforeEach(() => {
    // Deterministic NPC save roll: floor(0.5*20)+1 = 11.
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
});

// House rule: mockReset (not clearAllMocks) + re-arm defaults; live cells wiped; spies restored.
afterEach(() => {
    disarmUnguardedThenGuard();
    cleanup();
    cells.clear();
    arms.length = 0;
    rejections = [];
    vi.restoreAllMocks();
    runtime.getRuntimeValue.mockReset().mockImplementation((key, prop) => cells.get(`${key}|${prop}`) ?? null);
    runtime.setRuntimeValue.mockReset().mockImplementation((key, prop, value) => { cells.set(`${key}|${prop}`, value); return Promise.resolve(); });
    expirations.addExpiration.mockReset().mockImplementation(arm => { arms.push(arm); });
    diceRoller.rollExpression.mockReset().mockReturnValue({ total: 5, rolls: [5], modifier: 0 });
    combatData.getCombatSummary.mockReset().mockReturnValue(null);
    aoeService.getAffectedCreatures.mockReset().mockReturnValue([]);
    logService.addEntry.mockReset().mockResolvedValue(undefined);
    mapsService.loadMapData.mockReset().mockResolvedValue(null);
    persistAndNotify.mockReset();
    applyDamageToTarget.mockReset();
});

// ── Tests ──

describe('ElementalAttunementModal — error handling', () => {

    describe('in-flight addEntry rejections: the log fails, the commit survives', () => {
        it.each([
            {
                element: 'Fire',
                consoleMessage: '[ElementalAttunementModal] Error logging NPC save:',
                assertCommitSurvived: () => {
                    // Damage still applied with exact args, against the identity-seeded summary.
                    expect(applyDamageToTarget).toHaveBeenCalledWith(combatNpc, 'Goblin1', 5, ['fire'], {
                        campaignName: CAMPAIGN, characters: [], ignoreResistance: false, attackerName: PLAYER, suppressHpLog: false,
                    });
                    expect(persistAndNotify.mock.calls[0][0]).toBe(combatNpc);
                    expect(persistAndNotify).toHaveBeenCalledWith(combatNpc, CAMPAIGN);
                },
            },
            {
                element: 'Cold',
                consoleMessage: '[ElementalAttunementModal] Error logging speed reduction:',
                assertCommitSurvived: () => {
                    // The failed write still landed in the LIVE store — no rollback.
                    expect(runtime.setRuntimeValue).toHaveBeenCalledWith('Goblin1', 'activeConditions', ['speed_reduction'], CAMPAIGN);
                    expect(cells.get('Goblin1|activeConditions')).toEqual(['speed_reduction']);
                },
            },
            {
                element: 'Thunder',
                // PINNED dead-code behavior: Thunder carries effect:'push' but the damage branch
                // claims it (jsx:404), so the log lane is the generic NPC-save one — the component's
                // dedicated 'Error logging Thunder save:' catch (jsx:203) is UNREACHABLE dead code.
                consoleMessage: '[ElementalAttunementModal] Error logging NPC save:',
                assertCommitSurvived: () => {
                    expect(applyDamageToTarget).toHaveBeenCalledWith(combatNpc, 'Goblin1', 5, ['thunder'], {
                        campaignName: CAMPAIGN, characters: [], ignoreResistance: false, attackerName: PLAYER, suppressHpLog: false,
                    });
                    // FLAG (header): the failed CON save still owes a 10 ft push — applyNpcPush
                    // never runs, so the live store proves the push was silently dropped.
                    expect(cells.has('Goblin1|targetEffects')).toBe(false);
                    expect(runtime.setRuntimeValue).not.toHaveBeenCalled();
                },
            },
        ])('$element: a rejected log logs the exact one-line error, then resolution commits and summary opens', async ({ element, consoleMessage, assertCommitSurvived }) => {
            const err = new Error('log-service down');
            logService.addEntry.mockRejectedValue(err);
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
            seedOverlayCombat(combatNpc);

            render(<ElementalAttunementModal {...makeProps({ activeOverlay: OVERLAY })} />);
            fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${element}`) }));

            await waitFor(() => expect(consoleSpy).toHaveBeenCalledWith(consoleMessage, err));
            // The .catch swallowed THIS rejection (identity) and the flow completed:
            // results committed → auto-summary → Close available.
            await screen.findByRole('button', { name: /Close/ });
            assertCommitSurvived();
            // Proof the .catch swallowed THIS exact rejection: if it regressed, the rejection
            // would surface unhandled and vitest 4 fails the whole run at its collector
            // (test-realm listeners verified live to be unable to suppress it).
        });

        it('expiration log rejection: the deactivation commit still lands flags, ONE clock, and onClose', async () => {
            const err = new Error('log-service down');
            // Isolate the lane: the Fire processing 'roll' log resolves; only the expiration
            // ability_use log rejects.
            logService.addEntry.mockImplementation((campaign, entry) =>
                entry.type === 'ability_use' ? Promise.reject(err) : Promise.resolve());
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
            seedOverlayCombat(combatNpc);

            const props = makeProps({ activeOverlay: OVERLAY });
            render(<ElementalAttunementModal {...props} />);
            fireEvent.click(screen.getByRole('button', { name: /^Fire/ }));
            const closeBtn = await screen.findByRole('button', { name: /Close/ });
            fireEvent.click(closeBtn);

            await waitFor(() => expect(consoleSpy).toHaveBeenCalledWith('[ElementalAttunementModal] Error logging expiration:', err));
            // Deactivation is NOT gated on its log: exact flag writes live in the store,
            // the clock is armed once, and the modal closed (payload SHAPE → .deactivation lane).
            expect(cells.get(`${PLAYER}|elementalAttunementActive`)).toBe(true);
            expect(cells.get(`${PLAYER}|elementalAttunementElement`)).toBe('Fire');
            expect(arms).toHaveLength(1);
            expect(props.onClose).toHaveBeenCalledTimes(1);
        });
    });

    it('FLAG pinned: loadMapData rejection logs the exact error and strands an INVISIBLE view — no retry, no feedback, zero partial writes', async () => {
        const err = new Error('map load failed');
        mapsService.loadMapData.mockRejectedValue(err);
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        seedOverlayCombat(combatNpc);

        const { container } = render(<ElementalAttunementModal {...makeProps({ mapName: 'test-map', activeOverlay: OVERLAY })} />);
        fireEvent.click(screen.getByRole('button', { name: /^Fire/ }));

        await waitFor(() => expect(consoleSpy).toHaveBeenCalledWith('[ElementalAttunementModal] Error loading map data:', err));
        // The console identity proves the try/catch at jsx:447-449 claimed it — had it not,
        // vitest 4 would fail this whole run with an unhandled rejection at its collector.
        // Exactly ONE attempt with exact args: the catch never re-arms (deps unchanged) —
        // no invented retry, and no way for the user to trigger one.
        expect(mapsService.loadMapData).toHaveBeenCalledTimes(1);
        expect(mapsService.loadMapData).toHaveBeenCalledWith(CAMPAIGN, 'test-map');
        // DEFECT (jsx:430-450): the catch logs and abandons — phase stays 'targets',
        // which renders null. Stranded invisible view, pinned as current behavior.
        expect(container.firstChild).toBeNull();
        expect(screen.queryByRole('button', { name: /Close/ })).not.toBeInTheDocument();
        // Nothing downstream of the failed load fired — the failed read wrote no partial state.
        expect(aoeService.getAffectedCreatures).not.toHaveBeenCalled();
        expect(persistAndNotify).not.toHaveBeenCalled();
        expect(logService.addEntry).not.toHaveBeenCalled();
        expect(runtime.setRuntimeValue).not.toHaveBeenCalled();
        expect(cells.size).toBe(0);
    });

    describe('FLAG pinned: unguarded .then(setResults) (jsx:482-485) — a rejecting resolve strands the processing view', () => {
        it('dice rejection before the first target write: no partial writes, exact reason strands UNHANDLED, view stuck on Resolving…', async () => {
            const diceErr = new Error('dice service unavailable');
            diceRoller.rollExpression.mockImplementationOnce(() => { throw diceErr; });
            seedOverlayCombat(combatNpc);

            render(<ElementalAttunementModal {...makeProps({ activeOverlay: OVERLAY })} />);
            // Guard armed only across the click window: the effect's .then at :482 (no rejection
            // handler) gets the recording no-op; every .catch lane inside passes through.
            armUnguardedThenGuard();
            try {
                fireEvent.click(screen.getByRole('button', { name: /^Fire/ }));
                // PIN: exact reason strands on a handler-less chain. A fix adding .catch at
                // :482-485 routes it back into the component and empties this — flipping the pin.
                await waitFor(() => expect(rejections).toEqual([diceErr]));
                expect(rejections[0]).toBe(diceErr);
                // Stranded forever: results never commit, auto-summary never fires, no Close.
                expect(screen.getByText('Resolving DEX saving throws (DC 12)...')).toBeInTheDocument();
                expect(screen.queryByRole('button', { name: /Close/ })).not.toBeInTheDocument();
                // The throw hit resolveNpcDamageResult BEFORE applyDamage/addEntry/persist:
                // zero partial writes to store, log, or summary.
                expect(applyDamageToTarget).not.toHaveBeenCalled();
                expect(logService.addEntry).not.toHaveBeenCalled();
                expect(persistAndNotify).not.toHaveBeenCalled();
                expect(runtime.setRuntimeValue).not.toHaveBeenCalled();
                expect(cells.size).toBe(0);
                // No retry lane exists in the component: exactly one dice roll attempted.
                expect(diceRoller.rollExpression).toHaveBeenCalledTimes(1);
            } finally {
                disarmUnguardedThenGuard();
            }
        });

        it('persist rejection AFTER in-memory mutation: applied damage is silently lost, view stuck on Resolving…', async () => {
            const persistErr = new Error('persist failed');
            persistAndNotify.mockImplementation(() => { throw persistErr; });
            seedOverlayCombat(combatNpc);

            render(<ElementalAttunementModal {...makeProps({ activeOverlay: OVERLAY })} />);
            armUnguardedThenGuard();
            try {
                fireEvent.click(screen.getByRole('button', { name: /^Fire/ }));
                await waitFor(() => expect(rejections).toEqual([persistErr]));
                expect(rejections[0]).toBe(persistErr);
                expect(screen.getByText('Resolving DEX saving throws (DC 12)...')).toBeInTheDocument();
                expect(screen.queryByRole('button', { name: /Close/ })).not.toBeInTheDocument();
                // DATA-LOSS WINDOW (flagged in header): the 5 fire damage mutated the in-memory
                // summary and its log fired, but the persist that would make it durable was skipped.
                expect(applyDamageToTarget).toHaveBeenCalledWith(combatNpc, 'Goblin1', 5, ['fire'], {
                    campaignName: CAMPAIGN, characters: [], ignoreResistance: false, attackerName: PLAYER, suppressHpLog: false,
                });
                expect(logService.addEntry.mock.calls).toHaveLength(1);
                expect(logService.addEntry.mock.calls[0][1].rollType).toBe('save-damage');
            } finally {
                disarmUnguardedThenGuard();
            }
        });
    });
});
