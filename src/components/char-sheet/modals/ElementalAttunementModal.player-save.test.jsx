// @maintained-by-ai
/**
 * ElementalAttunementModal — PLAYER SAVE RESOLUTION lane (queuePlayerSavePrompt dispatch +
 * the 'save-result' window listener contract: captured listener dispatched directly, unique
 * promptIds, exact damage/effect commits through LIVE stores).
 *
 * Ownership map (siblings, do not duplicate here):
 * - .elemental-data.test.jsx  — ELEMENT_DATA/ELEMENT_DESCRIPTIONS as rendered, non-mutation.
 * - .phase-flow.test.jsx      — element→targets→processing→summary transitions, DC math,
 *                                map-overlay loading, overlay click-to-close guard, pending→summary
 *                                gate master chain (this lane consumes the gate, never re-pins it).
 * - .npc-save.test.jsx        — NPC save math, NPC store writes, NPC log rows, persistAndNotify
 *                                order (its pending-gated player fixtures prove PROCESSING; this lane
 *                                owns the RESOLUTION behind the gate).
 * - .summary.test.jsx         — onClose invocation, expiration log DESCRIPTION text variants.
 * - .deactivation.test.jsx    — handleResultsClose commit payloads, §39 single-clock order,
 *                                double-commit defect pin, inertness. Close is NEVER clicked here.
 * - .error-handling.test.jsx  — NPC addEntry/loadMapData/addExpiration REJECTION lanes and the
 *                                unguarded .then pins. PER ITS HEADER: the player addEntry rejection
 *                                lanes ('Error logging player save:' / 'Error logging player effect:')
 *                                stay OWNED HERE, pinned below with commit-survival through live cells.
 * This lane owns: the exact prompt payloads per element branch (damage / speed_reduction), unique
 * promptIds, save-result resolution — exact 'roll' and 'ability_use' log rows, exact HP writes
 * THROUGH the live summary fixture (half on save / full on fail), speed_reduction written through
 * the live store on the TARGET's key, the pending-gate per promptId (out-of-order dispatch),
 * junk/unknown-promptId drops, and the player addEntry rejection lanes.
 *
 * FLAG (defects, pinned not fixed — found live, owned here as the player resolution lane):
 * - ElementalAttunementModal.jsx:224-247,:521-525 — Thunder push is DEAD CODE for PLAYERS too
 *   (mirrors the NPC flag in .npc-save.test.jsx): queuePlayerSavePrompt dispatches on `damage`
 *   first, so Thunder (effect:'push') queues a plain damage prompt, and the listener routes it to
 *   applyAttunementSaveDamage — applyNpcPush NEVER runs, no 'targetEffects' cell ever appears.
 *   The Thunder arm below pins the ACTUAL behavior (damage lands, push silently dropped).
 *   Product fix: dispatch on `effect` alongside/before `damage`, or compose push with damage.
 * - ElementalAttunementModal.jsx:253-254 — DOUBLE-ROLL/divergence: the listener re-rolls
 *   rollExpression(damage) for the log's `rolls` while `total`/damage math use the EVENT's echoed
 *   rawDamage; with real dice the log row could contradict itself ([5] rolled, total 8). Pinned.
 *   Product fix: send the prompt's rawDamage+rolls back on the event, or stop re-rolling.
 * - ElementalAttunementModal.jsx:501 — save-result with NO rawDamage echo computes damage from
 *   `?? 0`: the player takes ZERO damage even though the prompt promised 1d10. The damage echo is
 *   an unenforced event contract. Pinned. Product fix: read rawDamage from the pending prompt
 *   record stored at queue time, not from the event.
 * - ElementalAttunementModal.jsx:503-504 — a save-result arriving while getCombatSummary is null
 *   is silently DROPPED (early return, prompt stays pending forever, no log). Pinned.
 * - ElementalAttunementModal.jsx:579-603,653 — inline styles (picker + resolved note): same
 *   no-inline-styles flag as .deactivation/.elemental-data lanes; inherited, not fixed here.
 *
 * Anti-vacuity: live runtime store (cells inspected directly — a never-issued commit is a missing
 * cell, not a call-recorder echo); LIVE applyDamage mutates the ONE by-identity combat fixture so
 * HP movement is proven on the summary itself; frozen Date.now pins promptIds and timestamps
 * exactly ('{ts}-i' / '{ts}-r' from pinned Math.random 0.5/0.75 — dice AND ids are deterministic);
 * exact full log rows field-by-field; exact full-line summary text; role-scoped queries; frozen
 * inputs; fresh vi.fn onClose per render; mockReset + re-arm per test; findBy idiom; no bare
 * setTimeout, no timers of any kind on this seam.
 */
import { render, screen, fireEvent, waitFor, act, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import ElementalAttunementModal from './ElementalAttunementModal.jsx';

// ── Live runtime store (anti-vacuous): condition/push writes land here; cells inspected directly ──

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

vi.mock('../../../services/dice/diceRoller.js', () => ({
    rollExpression: vi.fn(() => ({ total: 5, rolls: [5], modifier: 0 })),
}));

// LIVE applyDamage: mutates the fixture's currentHp so "damage applied / halved / zero"
// is proven on the summary object itself, not on a call-args echo.
vi.mock('../../../services/rules/combat/applyDamage.js', async (importOriginal) => ({
    ...await importOriginal(),
    computeDamageAfterSave: vi.fn((damage, success, dcSuccess) => {
        if (dcSuccess === 'half') return success ? Math.floor(damage / 2) : damage;
        return damage;
    }),
    computeDamageAfterResistancesWithDetails: vi.fn(({ rawDamage }) => ({ finalDamage: rawDamage })),
    applyDamageToTarget: vi.fn((summary, targetName, damage) => {
        const creature = summary?.creatures?.find(c => c.name === targetName);
        if (creature) creature.currentHp = Math.max(0, creature.currentHp - damage);
    }),
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

vi.mock('../../../services/rules/effects/expirations.js', () => ({
    addExpiration: vi.fn(),
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
import * as diceRoller from '../../../services/dice/diceRoller.js';
import * as applyDamage from '../../../services/rules/combat/applyDamage.js';
import * as savePromptService from '../../../services/combat/conditions/savePromptService.js';
import * as aoeService from '../../../services/rules/combat/aoeService.js';
import * as combatData from '../../../services/encounters/combatData.js';
import * as logService from '../../../services/ui/logService.js';
import { persistAndNotify } from './shared/AreaEffectTargetModalBase.utils.jsx';

const { cells } = runtime;
const { applyDamageToTarget } = applyDamage;

// ── Fixtures (frozen where the component must not mutate; creature HP stays mutable —
//    the live applyDamage mock moves it) ──

const PLAYER = 'Monk1'; // the attuning monk (attacker); prompt sourceName
const CAMPAIGN = 'test-campaign';
const OVERLAY = Object.freeze({ type: 'sphere' });
const FROZEN_TS = 1737000000000;
// Pinned Math.random → promptId suffix is exact: (0.5).toString(36).slice(2,9)==='i',
// (0.75)→'r'. promptIds therefore equal `${FROZEN_TS}-i` / `${FROZEN_TS}-r`.
const PROMPT_ID_1 = `${FROZEN_TS}-i`;
const PROMPT_ID_2 = `${FROZEN_TS}-r`;

// DC = 8 + WIS 1 + PROF 3 = 12 (DC math owned by .phase-flow — consumed as given here).
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

// Fresh vi.fn per render (house rule: no shared module-level onClose).
function makeProps(overrides = {}) {
    return {
        action: baseAction,
        playerStats: basePlayerStats,
        campaignName: CAMPAIGN,
        onClose: vi.fn(),
        activeOverlay: OVERLAY,
        ...overrides,
    };
}

function makePlayer(name, currentHp, dexSave) {
    return { name, type: 'player', currentHp, maxHp: currentHp, saveBonuses: { dex: dexSave }, resistances: [], immunities: [] };
}

// ONE summary per test, handed back by identity; exact-arg/identity assertions prove the
// component consumed THIS fixture and mutated THESE creatures.
function seedPlayers(...players) {
    const summary = Object.freeze({ creatures: Object.freeze(players) });
    combatData.getCombatSummary.mockReturnValue(summary);
    aoeService.getAffectedCreatures.mockReturnValue(players.map(c => ({ creature: c })));
    return summary;
}

function clickElement(element) {
    fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${element}`) }));
}

async function clickElementAndWaitForPrompt(element) {
    clickElement(element);
    await screen.findByText(/Waiting for save roll/);
    // Anti-lost-event lane: see saveResultBusLive() — the row bytes can surface before
    // the listener effect's flush lands under load; anchor every save-result dispatch lane
    // on the bus actually listening, never on row bytes alone.
    await waitFor(() => expect(saveResultBusLive()).toBeGreaterThan(0));
}

function dispatchSaveResult(detail) {
    return act(async () => {
        window.dispatchEvent(new CustomEvent('save-result', { detail }));
    });
}

function pendingRows() {
    return Array.from(document.querySelectorAll('.abjure-result-pending'));
}

// ── save-result bus registration anchor (flake fix CI #183 / #184) ──
// The modal registers its 'save-result' listener in a passive effect keyed on
// pendingPrompts (ElementalAttunementModal.jsx:489-532). Under full-suite CPU contention
// findByText can resolve BEFORE that passive flush lands, so dispatchSaveResult hit a bus
// nobody listened on: the prompt stayed pending forever and the count-anchored waitFors
// timed out (observed victims: Thunder damage lane, Cold speed_reduction append lane).
// Spying add/removeEventListener (pass-through) gives a live-listener anchor: dispatch
// only once the bus demonstrably has a receiver. Assertions are unchanged — every commit
// call-count pin and exact-byte check still runs at the same strength, just re-anchored
// onto state bytes with the call pins folded in immediately after settle.
let addSpy, removeSpy;

function saveResultBusLive() {
    return addSpy.mock.calls.filter(([type]) => type === 'save-result').length
        - removeSpy.mock.calls.filter(([type]) => type === 'save-result').length;
}

// ── Setup / teardown ──

beforeEach(() => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5); // promptId suffix 'i' (second prompt: 0.75 → 'r')
    vi.spyOn(Date, 'now').mockReturnValue(FROZEN_TS); // promptId prefix AND log timestamps
    // Pass-through spies: record (do not intercept) the modal's save-result registration so
    // saveResultBusLive() can gate dispatch (flake fix CI #183/#184 — see anchor above).
    addSpy = vi.spyOn(window, 'addEventListener');
    removeSpy = vi.spyOn(window, 'removeEventListener');
});

// House rule: mockReset (not clearAllMocks/resetAllMocks) + re-arm; live cells wiped;
// Math/Date spies restored.
afterEach(() => {
    cleanup();
    cells.clear();
    vi.restoreAllMocks();
    runtime.getRuntimeValue.mockReset().mockImplementation((key, prop) => cells.get(`${key}|${prop}`) ?? null);
    runtime.setRuntimeValue.mockReset().mockImplementation((key, prop, value) => { cells.set(`${key}|${prop}`, value); return Promise.resolve(); });
    diceRoller.rollExpression.mockReset().mockReturnValue({ total: 5, rolls: [5], modifier: 0 });
    const liveApply = applyDamageToTarget.getMockImplementation();
    applyDamageToTarget.mockReset().mockImplementation(liveApply);
    savePromptService.sendSavePrompt.mockReset();
    combatData.getCombatSummary.mockReset().mockReturnValue(null);
    aoeService.getAffectedCreatures.mockReset().mockReturnValue([]);
    logService.addEntry.mockReset().mockResolvedValue(undefined);
    persistAndNotify.mockReset();
});

// ── Tests ──

describe('ElementalAttunementModal — player save resolution', () => {

    describe('save prompt dispatch (queuePlayerSavePrompt)', () => {
        it.each([
            { element: 'Fire', saveType: 'DEX', formula: '1d10' },
            { element: 'Lightning', saveType: 'DEX', formula: '1d8' },
        ])('$element queues ONE prompt with the rolled rawDamage and exact fields, persists once, writes nothing early', async ({ element, saveType, formula }) => {
            const p1 = makePlayer('Player1', 20, 3);
            const summary = seedPlayers(p1);

            render(<ElementalAttunementModal {...makeProps()} />);
            await clickElementAndWaitForPrompt(element);

            // Exact full payload — rawDamage is present (damage branch) and equal to the pinned roll.
            expect(savePromptService.sendSavePrompt.mock.calls).toEqual([[CAMPAIGN, {
                promptId: PROMPT_ID_1,
                targetName: 'Player1',
                saveType,
                saveDc: 12,
                sourceName: PLAYER,
                rawDamage: 5,
            }]]);
            expect(diceRoller.rollExpression).toHaveBeenCalledWith(formula);
            // Resolution is DEFERRED behind the prompt: no damage, no store writes, one persist
            // of the SAME summary (the player lane must still persist the encounter state).
            expect(applyDamageToTarget).not.toHaveBeenCalled();
            expect(p1.currentHp).toBe(20);
            expect(cells.size).toBe(0);
            expect(persistAndNotify.mock.calls).toEqual([[summary, CAMPAIGN]]);
            // The prompt shows in the processing lane while it waits.
            expect(pendingRows()).toHaveLength(1);
            expect(pendingRows()[0].textContent).toBe('Player1: Waiting for save roll...');
        });

        it('Cold queues the effect prompt with NO rawDamage key at all (speed_reduction branch)', async () => {
            const p1 = makePlayer('Player1', 20, 3);
            seedPlayers(p1);

            render(<ElementalAttunementModal {...makeProps()} />);
            await clickElementAndWaitForPrompt('Cold');

            // toEqual (not toMatchObject): the rawDamage KEY must be ABSENT, not undefined-ish.
            expect(savePromptService.sendSavePrompt.mock.calls).toEqual([[CAMPAIGN, {
                promptId: PROMPT_ID_1,
                targetName: 'Player1',
                saveType: 'DEX',
                saveDc: 12,
                sourceName: PLAYER,
            }]]);
            // Cold rolls no dice.
            expect(diceRoller.rollExpression).not.toHaveBeenCalled();
        });

        it('two player targets get unique pinned promptIds, one exact payload each', async () => {
            // Sequential pinned randoms: prompt #1 → 0.5 ('i'), prompt #2 → 0.75 ('r').
            const rolls = [0.5, 0.75];
            vi.spyOn(Math, 'random').mockImplementation(() => rolls.shift() ?? 0.5);
            const p1 = makePlayer('Player1', 10, -10);
            const p2 = makePlayer('Player2', 8, 3);
            seedPlayers(p1, p2);

            render(<ElementalAttunementModal {...makeProps()} />);
            clickElement('Fire');
            await waitFor(() => expect(savePromptService.sendSavePrompt).toHaveBeenCalledTimes(2));

            expect(savePromptService.sendSavePrompt.mock.calls).toEqual([
                [CAMPAIGN, { promptId: PROMPT_ID_1, targetName: 'Player1', saveType: 'DEX', saveDc: 12, sourceName: PLAYER, rawDamage: 5 }],
                [CAMPAIGN, { promptId: PROMPT_ID_2, targetName: 'Player2', saveType: 'DEX', saveDc: 12, sourceName: PLAYER, rawDamage: 5 }],
            ]);
            // Unique-by-construction proof straight off the recorded calls, not the constants.
            expect(savePromptService.sendSavePrompt.mock.calls[0][1].promptId)
                .not.toBe(savePromptService.sendSavePrompt.mock.calls[1][1].promptId);
        });
    });

    describe('save-result resolution — damage path (applyAttunementSaveDamage)', () => {
        it.each([
            {
                element: 'Fire', formula: '1d10', damageType: 'fire',
                detail: { success: false, roll: 5, saveBonus: 3, total: 8, rawDamage: 5 },
                saveResult: 'failure', finalDamage: 5, expectedHp: 15,
                line: 'Player1: Failed (d20 5+3 = 8). 1d10 fire: 1d10 [5] = 5 → 5 fire damage',
            },
            {
                element: 'Fire', formula: '1d10', damageType: 'fire',
                detail: { success: true, roll: 15, saveBonus: 3, total: 18, rawDamage: 5 },
                saveResult: 'success', finalDamage: 2, expectedHp: 18,
                line: 'Player1: Saved (d20 15+3 = 18). 1d10 fire: 1d10 [5] = 5 → 2 fire damage',
            },
            {
                element: 'Lightning', formula: '1d8', damageType: 'lightning',
                detail: { success: false, roll: 8, saveBonus: 3, total: 11, rawDamage: 5 },
                saveResult: 'failure', finalDamage: 5, expectedHp: 15,
                line: 'Player1: Failed (d20 8+3 = 11). 1d8 lightning: 1d8 [5] = 5 → 5 lightning damage',
            },
        ])('$element $saveResult: exact roll row, exact applyDamage opts, HP moved THROUGH the live fixture', async ({ element, formula, damageType, detail, saveResult, finalDamage, expectedHp, line }) => {
            const p1 = makePlayer('Player1', 20, 3);
            const summary = seedPlayers(p1);

            render(<ElementalAttunementModal {...makeProps()} />);
            await clickElementAndWaitForPrompt(element);

            await dispatchSaveResult({ promptId: PROMPT_ID_1, targetName: 'Player1', ...detail });

            // Exact full row of the damage resolver — every field, frozen timestamp.
            await waitFor(() => expect(logService.addEntry).toHaveBeenCalled());
            expect(logService.addEntry.mock.calls).toEqual([[CAMPAIGN, {
                type: 'roll',
                characterName: PLAYER,
                rollType: 'save-damage',
                name: 'Elemental Attunement',
                targetName: 'Player1',
                saveType: 'dex',
                saveDc: 12,
                saveResult,
                saveRoll: detail.roll,
                saveBonus: detail.saveBonus,
                saveRawRolls: [detail.roll],
                timestamp: FROZEN_TS,
                formula,
                rolls: [5],
                total: detail.rawDamage,
                modifier: 0,
                damageType,
                finalDamage,
            }]]);
            // Damage applied through the live mutator: exact call args (characters = the player
            // creatures of the summary) AND the HP that actually moved on the fixture.
            expect(applyDamageToTarget).toHaveBeenCalledTimes(1);
            expect(applyDamageToTarget).toHaveBeenCalledWith(summary, 'Player1', finalDamage, [damageType], {
                campaignName: CAMPAIGN, characters: [p1], ignoreResistance: false, attackerName: PLAYER, suppressHpLog: false,
            });
            expect(p1.currentHp).toBe(expectedHp);
            // No conditions on a damage element; target's condition cell stays unwritten.
            expect(runtime.setRuntimeValue).not.toHaveBeenCalled();
            expect(cells.size).toBe(0);
            // The prompt is consumed and the exact summary line renders behind the gate.
            await screen.findByRole('button', { name: /Close/ });
            const results = document.querySelector('.aoe-results');
            expect(results.children).toHaveLength(1);
            expect(results.textContent).toBe(line);
        });

        it('FLAG pinned: event rawDamage is AUTHORITATIVE — the log can contradict its own re-rolled dice', async () => {
            // (header flag :253-254) The listener re-rolls for `rolls` but takes damage
            // math from detail.rawDamage. Feed an echo (8) that differs from the dice (5).
            const p1 = makePlayer('Player1', 20, 3);
            const summary = seedPlayers(p1);

            render(<ElementalAttunementModal {...makeProps()} />);
            await clickElementAndWaitForPrompt('Fire');

            await dispatchSaveResult({ promptId: PROMPT_ID_1, targetName: 'Player1', success: false, roll: 5, saveBonus: 3, total: 8, rawDamage: 8 });

            await waitFor(() => expect(logService.addEntry).toHaveBeenCalled());
            // rolls:[5] comes from the FRESH re-roll; total/finalDamage come from the ECHO (8).
            // With real dice these can diverge — the current contradiction is pinned, not blessed.
            expect(logService.addEntry.mock.calls).toEqual([[CAMPAIGN, {
                type: 'roll',
                characterName: PLAYER,
                rollType: 'save-damage',
                name: 'Elemental Attunement',
                targetName: 'Player1',
                saveType: 'dex',
                saveDc: 12,
                saveResult: 'failure',
                saveRoll: 5,
                saveBonus: 3,
                saveRawRolls: [5],
                timestamp: FROZEN_TS,
                formula: '1d10',
                rolls: [5],
                total: 8,
                modifier: 0,
                damageType: 'fire',
                finalDamage: 8,
            }]]);
            expect(applyDamageToTarget).toHaveBeenCalledWith(summary, 'Player1', 8, ['fire'], {
                campaignName: CAMPAIGN, characters: [p1], ignoreResistance: false, attackerName: PLAYER, suppressHpLog: false,
            });
            expect(p1.currentHp).toBe(12); // 20 − echo(8), NOT 20 − dice(5)
        });

        it('FLAG pinned: save-result with NO rawDamage echo resolves to ZERO damage despite the 1d10 the prompt promised', async () => {
            // (header flag :501) `detail.rawDamage ?? 0` trusts the event echo; a save that
            // answers without the echo silently zeroes the commit. Pinned as current behavior.
            const p1 = makePlayer('Player1', 20, 3);
            seedPlayers(p1);

            render(<ElementalAttunementModal {...makeProps()} />);
            await clickElementAndWaitForPrompt('Fire');

            await dispatchSaveResult({ promptId: PROMPT_ID_1, targetName: 'Player1', success: false, roll: 5, saveBonus: 3, total: 8 });

            await waitFor(() => expect(logService.addEntry).toHaveBeenCalled());
            expect(logService.addEntry.mock.calls).toEqual([[CAMPAIGN, expect.objectContaining({
                type: 'roll',
                targetName: 'Player1',
                saveResult: 'failure',
                formula: '1d10',
                rolls: [5],
                total: 0,
                damageType: 'fire',
                finalDamage: 0,
            })]]);
            expect(p1.currentHp).toBe(20); // promised 1d10, took nothing — the ?? 0 hole
            expect(cells.size).toBe(0);
        });

        it('Thunder: prompt is a plain damage prompt and a failed save lands damage but NO push — push is DEAD CODE for players too', async () => {
            // (header flag :224-247,:521-525 — mirrors the NPC dead-push pin in .npc-save)
            const p1 = makePlayer('Player1', 20, 3);
            const summary = seedPlayers(p1);

            render(<ElementalAttunementModal {...makeProps()} />);
            await clickElementAndWaitForPrompt('Thunder');

            // Queued WITHOUT the effect: same damage-branch payload shape as Fire/Lightning.
            expect(savePromptService.sendSavePrompt.mock.calls).toEqual([[CAMPAIGN, {
                promptId: PROMPT_ID_1,
                targetName: 'Player1',
                saveType: 'CON',
                saveDc: 12,
                sourceName: PLAYER,
                rawDamage: 5,
            }]]);

            await dispatchSaveResult({ promptId: PROMPT_ID_1, targetName: 'Player1', success: false, roll: 5, saveBonus: -10, total: -5, rawDamage: 5 });

            // Flake fix (CI #183): anchor on STATE bytes moving on the live fixture (the
            // live applyDamage mock mutates it), fold the call pins in AFTER settle.
            await waitFor(() => expect(p1.currentHp).toBe(15));
            expect(applyDamageToTarget).toHaveBeenCalled();
            expect(applyDamageToTarget).toHaveBeenCalledWith(summary, 'Player1', 5, ['thunder'], {
                campaignName: CAMPAIGN, characters: [p1], ignoreResistance: false, attackerName: PLAYER, suppressHpLog: false,
            });
            expect(p1.currentHp).toBe(15);
            // THE PIN: the failed CON save still owes a 10 ft push — targetEffects NEVER appears.
            expect(cells.has('Player1|targetEffects')).toBe(false);
            expect(runtime.setRuntimeValue).not.toHaveBeenCalled();
        });
    });

    describe('save-result resolution — Cold speed_reduction (applyAttunementSaveEffect)', () => {
        it('failed save: exact ability_use row AND the condition lands on the TARGET key in the LIVE store, zero damage', async () => {
            const p1 = makePlayer('Player1', 20, -10);
            seedPlayers(p1);

            render(<ElementalAttunementModal {...makeProps()} />);
            await clickElementAndWaitForPrompt('Cold');

            await dispatchSaveResult({ promptId: PROMPT_ID_1, targetName: 'Player1', success: false, roll: 5, saveBonus: -10, total: -5 });

            await waitFor(() => expect(logService.addEntry).toHaveBeenCalled());
            expect(logService.addEntry.mock.calls).toEqual([[CAMPAIGN, {
                type: 'ability_use',
                characterName: PLAYER,
                abilityName: 'Elemental Attunement',
                description: 'Elemental Attunement (Cold) on <strong>Player1</strong>: failed DEX save (DC 12). Speed reduced by 15 ft.',
                saveRoll: 5,
                saveBonus: -10,
                saveTotal: -5,
                saveDc: 12,
                saveSuccess: false,
            }]]);
            // The condition write landed in the LIVE cell — on the TARGET's key, not the
            // attuning monk's, and nothing else was written.
            expect(runtime.setRuntimeValue).toHaveBeenCalledWith('Player1', 'activeConditions', ['speed_reduction'], CAMPAIGN);
            expect(cells.get('Player1|activeConditions')).toEqual(['speed_reduction']);
            expect(cells.has(`${PLAYER}|activeConditions`)).toBe(false);
            expect(cells.size).toBe(1);
            // Cold deals no damage: no applyDamage, no dice, HP untouched.
            expect(applyDamageToTarget).not.toHaveBeenCalled();
            expect(diceRoller.rollExpression).not.toHaveBeenCalled();
            expect(p1.currentHp).toBe(20);
            // Exact failed-save summary line behind the pending gate.
            await screen.findByRole('button', { name: /Close/ });
            const results = document.querySelector('.aoe-results');
            expect(results.children).toHaveLength(1);
            expect(results.textContent).toBe('Player1: Failed (d20 5+-10 = -5) — speed reduced by 15 ft.');
        });

        it('failed save appends speed_reduction AFTER existing conditions — other conditions survive byte-exact', async () => {
            const p1 = makePlayer('Player1', 20, -10);
            cells.set('Player1|activeConditions', ['prone', 'restrained']);
            seedPlayers(p1);

            render(<ElementalAttunementModal {...makeProps()} />);
            await clickElementAndWaitForPrompt('Cold');

            await dispatchSaveResult({ promptId: PROMPT_ID_1, targetName: 'Player1', success: false, roll: 5, saveBonus: -10, total: -5 });

            // Flake fix (CI #184): anchor on the LIVE CELL bytes (the actual commit), and
            // fold the call pin in AFTER settle. Same evidence, race-free ordering.
            await waitFor(() => expect(cells.get('Player1|activeConditions')).toEqual(['prone', 'restrained', 'speed_reduction']));
            expect(runtime.setRuntimeValue).toHaveBeenCalledWith('Player1', 'activeConditions', ['prone', 'restrained', 'speed_reduction'], CAMPAIGN);
        });

        it('saved: NO condition lands in the LIVE store and the exact saved ability_use row is logged', async () => {
            const p1 = makePlayer('Player1', 20, 10);
            seedPlayers(p1);

            render(<ElementalAttunementModal {...makeProps()} />);
            await clickElementAndWaitForPrompt('Cold');

            await dispatchSaveResult({ promptId: PROMPT_ID_1, targetName: 'Player1', success: true, roll: 15, saveBonus: 10, total: 25 });

            await waitFor(() => expect(logService.addEntry).toHaveBeenCalled());
            expect(logService.addEntry.mock.calls).toEqual([[CAMPAIGN, {
                type: 'ability_use',
                characterName: PLAYER,
                abilityName: 'Elemental Attunement',
                description: 'Elemental Attunement (Cold) on <strong>Player1</strong>: saved DEX save (DC 12). No effect.',
                saveRoll: 15,
                saveBonus: 10,
                saveTotal: 25,
                saveDc: 12,
                saveSuccess: true,
            }]]);
            expect(runtime.setRuntimeValue).not.toHaveBeenCalled();
            expect(cells.size).toBe(0);
            await screen.findByRole('button', { name: /Close/ });
            const results = document.querySelector('.aoe-results');
            expect(results.textContent).toBe('Player1: Saved (d20 15+10 = 25) — no effect.');
        });
    });

    describe('save-result listener contract', () => {
        it('ignores a save-result with an unknown promptId — prompt stays pending, zero commits', async () => {
            const p1 = makePlayer('Player1', 20, 3);
            seedPlayers(p1);

            render(<ElementalAttunementModal {...makeProps()} />);
            await clickElementAndWaitForPrompt('Fire');

            await dispatchSaveResult({ promptId: 'nonexistent-id', targetName: 'Player1', success: true, roll: 15, saveBonus: 3, total: 18, rawDamage: 5 });

            // Still exactly the original prompt, still waiting; nothing resolved.
            expect(screen.getByText(/Waiting for save roll/)).toBeInTheDocument();
            expect(pendingRows()).toHaveLength(1);
            expect(logService.addEntry).not.toHaveBeenCalled();
            expect(applyDamageToTarget).not.toHaveBeenCalled();
            expect(cells.size).toBe(0);
            expect(p1.currentHp).toBe(20);
        });

        it.each([
            { label: 'no detail at all', detail: undefined },
            { label: 'detail without promptId', detail: { targetName: 'Player1', success: true, roll: 15, saveBonus: 3, total: 18, rawDamage: 5 } },
        ])('ignores a junk save-result event ($label) — no crash, prompt stays pending', async ({ detail }) => {
            const p1 = makePlayer('Player1', 20, 3);
            seedPlayers(p1);

            render(<ElementalAttunementModal {...makeProps()} />);
            await clickElementAndWaitForPrompt('Fire');

            await dispatchSaveResult(detail);

            expect(screen.getByText(/Waiting for save roll/)).toBeInTheDocument();
            expect(pendingRows()).toHaveLength(1);
            expect(logService.addEntry).not.toHaveBeenCalled();
            expect(applyDamageToTarget).not.toHaveBeenCalled();
            expect(cells.size).toBe(0);
        });

        it('FLAG pinned: a save-result arriving while getCombatSummary is null is silently dropped — prompt stays pending forever', async () => {
            // (header flag :503-504) The listener early-returns with no log, no resolution,
            // and no way out of the processing view. Pinned as current behavior.
            const p1 = makePlayer('Player1', 20, 3);
            seedPlayers(p1);

            render(<ElementalAttunementModal {...makeProps()} />);
            await clickElementAndWaitForPrompt('Fire');

            combatData.getCombatSummary.mockReturnValue(null); // summary vanishes before the save lands
            await dispatchSaveResult({ promptId: PROMPT_ID_1, targetName: 'Player1', success: false, roll: 5, saveBonus: 3, total: 8, rawDamage: 5 });

            expect(screen.getByText(/Waiting for save roll/)).toBeInTheDocument();
            expect(pendingRows()).toHaveLength(1);
            expect(logService.addEntry).not.toHaveBeenCalled();
            expect(applyDamageToTarget).not.toHaveBeenCalled();
            expect(cells.size).toBe(0);
            expect(p1.currentHp).toBe(20);
        });

        it('pending-gate per promptId: out-of-order resolution commits ONLY the matching target; second save completes the summary', async () => {
            const p1 = makePlayer('Player1', 10, -10);
            const p2 = makePlayer('Player2', 8, 3);
            const summary = seedPlayers(p1, p2);
            // Sequential pinned randoms so the two promptIds are exact and distinct.
            const rolls = [0.5, 0.75];
            vi.spyOn(Math, 'random').mockImplementation(() => rolls.shift() ?? 0.5);

            render(<ElementalAttunementModal {...makeProps()} />);
            clickElement('Fire');
            // Wait for the PENDING ROWS, not just the sendSavePrompt calls: the prompt queue
            // lands via a .then microtask after fireEvent returns, and the save-result listener
            // registers in the same render — dispatching before the rows exist loses the event.
            await waitFor(() => expect(pendingRows()).toHaveLength(2));
            await waitFor(() => expect(saveResultBusLive()).toBeGreaterThan(0)); // listener live (CI #183/#184 anchor)
            expect(savePromptService.sendSavePrompt).toHaveBeenCalledTimes(2);

            // Resolve Player2 FIRST (id '...-r'): only Player2 commits; Player1 stays pending.
            await dispatchSaveResult({ promptId: PROMPT_ID_2, targetName: 'Player2', success: true, roll: 15, saveBonus: 3, total: 18, rawDamage: 5 });

            await waitFor(() => expect(logService.addEntry).toHaveBeenCalledTimes(1));
            expect(logService.addEntry.mock.calls).toEqual([[CAMPAIGN, expect.objectContaining({
                targetName: 'Player2', saveResult: 'success', finalDamage: 2,
            })]]);
            expect(applyDamageToTarget).toHaveBeenCalledTimes(1);
            expect(applyDamageToTarget).toHaveBeenCalledWith(summary, 'Player2', 2, ['fire'], expect.objectContaining({ attackerName: PLAYER }));
            expect(p2.currentHp).toBe(6); // 8 − halved 2
            expect(p1.currentHp).toBe(10); // untouched — the gate holds
            expect(pendingRows()).toHaveLength(1);
            expect(pendingRows()[0].textContent).toBe('Player1: Waiting for save roll...');

            // Player1's save lands: both resolved, the gate opens, exact lines in dispatch order.
            await dispatchSaveResult({ promptId: PROMPT_ID_1, targetName: 'Player1', success: false, roll: 5, saveBonus: -10, total: -5, rawDamage: 5 });

            await screen.findByRole('button', { name: /Close/ });
            expect(pendingRows()).toHaveLength(0);
            expect(p1.currentHp).toBe(5); // 10 − full 5
            const results = document.querySelector('.aoe-results');
            expect(results.children).toHaveLength(2);
            expect(results.textContent).toBe(
                'Player2: Saved (d20 15+3 = 18). 1d10 fire: 1d10 [5] = 5 → 2 fire damage' +
                'Player1: Failed (d20 5+-10 = -5). 1d10 fire: 1d10 [5] = 5 → 5 fire damage'
            );
        });

        it('listener is removed on unmount; a save arriving after unmount commits nothing', async () => {
            const p1 = makePlayer('Player1', 20, 3);
            seedPlayers(p1);

            const { unmount } = render(<ElementalAttunementModal {...makeProps()} />);
            await clickElementAndWaitForPrompt('Fire');

            const removeSpy = vi.spyOn(window, 'removeEventListener');
            unmount();
            expect(removeSpy).toHaveBeenCalledWith('save-result', expect.any(Function));

            logService.addEntry.mockClear();
            await dispatchSaveResult({ promptId: PROMPT_ID_1, targetName: 'Player1', success: false, roll: 5, saveBonus: 3, total: 8, rawDamage: 5 });
            expect(logService.addEntry).not.toHaveBeenCalled();
            expect(applyDamageToTarget).not.toHaveBeenCalled();
            expect(cells.size).toBe(0);
            expect(p1.currentHp).toBe(20);
        });
    });

    describe('player addEntry rejection lanes (owned here per .error-handling delegation)', () => {
        it.each([
            {
                element: 'Fire',
                label: 'damage path',
                consoleMsg: '[ElementalAttunementModal] Error logging player save:',
                detail: { success: false, roll: 5, saveBonus: 3, total: 8, rawDamage: 5 },
                line: 'Player1: Failed (d20 5+3 = 8). 1d10 fire: 1d10 [5] = 5 → 5 fire damage',
                assertCommit: (p1) => {
                    // The log failed, but the HP write survived exactly as on the happy path.
                    expect(p1.currentHp).toBe(15);
                    expect(logService.addEntry).toHaveBeenCalledTimes(1);
                },
            },
            {
                element: 'Cold',
                label: 'effect path',
                consoleMsg: '[ElementalAttunementModal] Error logging player effect:',
                detail: { success: false, roll: 5, saveBonus: -10, total: -5 },
                line: 'Player1: Failed (d20 5+-10 = -5) — speed reduced by 15 ft.',
                assertCommit: (p1) => {
                    // The log failed, but the condition landed byte-exact in the LIVE cell.
                    expect(cells.get('Player1|activeConditions')).toEqual(['speed_reduction']);
                    expect(cells.size).toBe(1);
                    expect(p1.currentHp).toBe(20);
                    expect(logService.addEntry).toHaveBeenCalledTimes(1);
                },
            },
        ])('addEntry rejection ($label): logs the exact error with identity, the commit survives, the prompt is still consumed', async ({ element, consoleMsg, detail, assertCommit, line }) => {
            const err = new Error('network error');
            logService.addEntry.mockRejectedValue(err);
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
            const p1 = makePlayer('Player1', 20, element === 'Cold' ? -10 : 3);
            seedPlayers(p1);

            render(<ElementalAttunementModal {...makeProps()} />);
            await clickElementAndWaitForPrompt(element);

            await dispatchSaveResult({ promptId: PROMPT_ID_1, targetName: 'Player1', ...detail });

            // Exact full console message AND the exact rejected Error instance (identity, not any).
            await waitFor(() => expect(consoleSpy).toHaveBeenCalledWith(consoleMsg, err));
            assertCommit(p1);
            // The pending prompt is removed despite the failed log, and the exact result line
            // still renders — the game-state commit is complete, only the log was lost.
            await waitFor(() => expect(pendingRows()).toHaveLength(0));
            await screen.findByRole('button', { name: /Close/ });
            const results = document.querySelector('.aoe-results');
            expect(results.children).toHaveLength(1);
            expect(results.textContent).toBe(line);
        });
    });
});
