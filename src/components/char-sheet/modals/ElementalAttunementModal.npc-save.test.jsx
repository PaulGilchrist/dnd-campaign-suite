/**
 * ElementalAttunementModal — NPC SAVE RESOLUTION lane (resolveAllSavesAndDamage NPC branch).
 *
 * Ownership map (siblings, do not duplicate here):
 * - .elemental-data.test.jsx  — ELEMENT_DATA/ELEMENT_DESCRIPTIONS as rendered, non-mutation.
 * - .phase-flow.test.jsx      — element→targets→processing→summary transitions, DC math,
 *                                map-overlay loading, overlay click-to-close guard.
 * - .player-save.test.jsx     — save prompts, save-result event handling, listener lifecycle.
 * - .summary.test.jsx         — onClose invocation, expiration log DESCRIPTION text variants.
 * - .deactivation.test.jsx    — handleResultsClose commit payloads, §39 single-clock order,
 *                                double-commit defect pin, inertness. Close is NEVER clicked here.
 * - .error-handling.test.jsx  — every addEntry/loadMapData/addExpiration REJECTION lane and the
 *                                unguarded .then pins (its Thunder arm asserts commit survival under
 *                                a rejecting log; this lane asserts the happy-path payloads).
 * This lane owns NPC save math (pinned d20, missing-bonus defaults, pass/fail threshold), the
 * exact store writes THROUGH LIVE cells/summary (full damage applied / half on save / speed_reduction
 * written once / appended to existing / never on saves), the exact log rows ('roll' save-damage and
 * 'ability_use' — full field-by-field, timestamp frozen), persistAndNotify identity + write order
 * (in-memory HP mutation lands BEFORE persist), and the exact summary-phase result line.
 *
 * FLAG (defect, pinned not fixed — found live, owned here as the resolution lane):
 * - ElementalAttunementModal.jsx:404-409 — Thunder push is DEAD CODE: every element WITH damage,
 *   including Thunder (effect:'push'), routes through resolveNpcDamageResult, so
 *   resolveNpcPushResult/applyNpcPush NEVER fire. A failed NPC CON save against Thunder takes the
 *   1d6 but silently loses the 10 ft push. The Thunder arm below pins the ACTUAL current behavior
 *   (damage lands, no 'targetEffects' cell appears), not the intended push. Product fix: dispatch
 *   on `effect` before `damage` (or compose push with damage) at :404.
 *
 * Anti-vacuity: live runtime store (cells inspected directly — a never-issued commit is a missing
 * cell, not a call-recorder echo); live applyDamage mock mutates the ONE by-identity combat
 * fixture so "damage applied / none" is proven on the summary itself; exact full log rows with a
 * frozen Date.now timestamp (an extra or missing field flips the pin); Math.random pinned (d20 =
 * floor(r*20)+1); role-scoped queries; frozen inputs; fresh vi.fn onClose per render; no bare
 * setTimeout, no timers of any kind on this seam.
 */
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import ElementalAttunementModal from './ElementalAttunementModal.jsx';

// ── Live runtime store (anti-vacuous): condition writes land here; cells inspected directly ──

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

// LIVE applyDamage: mutates the fixture's currentHp so "damage applied / half / none"
// is proven on the summary object itself, not on a call-args echo.
vi.mock('../../../services/rules/combat/applyDamage.js', () => ({
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
import * as aoeService from '../../../services/rules/combat/aoeService.js';
import * as combatData from '../../../services/encounters/combatData.js';
import * as logService from '../../../services/ui/logService.js';
import { persistAndNotify } from './shared/AreaEffectTargetModalBase.utils.jsx';

const { cells } = runtime;
const { applyDamageToTarget } = applyDamage;

// ── Fixtures (frozen where the component must not mutate; creature HP stays mutable —
//    the live applyDamage mock moves it) ──

const PLAYER = 'Monk1';
const CAMPAIGN = 'test-campaign';
const NPC = 'Goblin1';
const OVERLAY = Object.freeze({ type: 'sphere' });
const FROZEN_TS = 1737000000000;

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

// ONE summary per test, handed back by identity; exact-arg/identity assertions prove the
// component consumed THIS fixture and mutated THIS creature.
function seedNpc({ saveBonuses = { dex: -10, con: -10 }, currentHp = 7, omitSaveBonuses = false } = {}) {
    const npc = { name: NPC, type: 'npc', currentHp, maxHp: 7, resistances: [], immunities: [] };
    if (!omitSaveBonuses) npc.saveBonuses = saveBonuses;
    const summary = Object.freeze({ creatures: Object.freeze([npc]) });
    combatData.getCombatSummary.mockReturnValue(summary);
    aoeService.getAffectedCreatures.mockReturnValue(summary.creatures.map(c => ({ creature: c })));
    return { npc, summary };
}

function clickElement(element) {
    fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${element}`) }));
}

// ── Setup / teardown ──

beforeEach(() => {
    // Save roll = floor(r*20)+1: 0.5 → 11 (fails DC 12 with -10, passes with +2 at 0.9 → 19).
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    vi.spyOn(Date, 'now').mockReturnValue(FROZEN_TS);
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
    combatData.getCombatSummary.mockReset().mockReturnValue(null);
    aoeService.getAffectedCreatures.mockReset().mockReturnValue([]);
    logService.addEntry.mockReset().mockResolvedValue(undefined);
    persistAndNotify.mockReset();
});

// ── Tests ──

describe('ElementalAttunementModal — NPC save resolution', () => {

    describe('damage elements — failed saves', () => {
        it.each([
            { element: 'Fire', saveType: 'dex', formula: '1d10', damageType: 'fire' },
            { element: 'Lightning', saveType: 'dex', formula: '1d8', damageType: 'lightning' },
            {
                element: 'Thunder',
                saveType: 'con',
                formula: '1d6',
                damageType: 'thunder',
                // FLAG (header): the failed CON save still owes a 10 ft push — resolveNpcPushResult/
                // applyNpcPush are DEAD CODE (jsx:404 routes Thunder through the damage branch), so
                // the LIVE store proves the push was silently dropped. Pinned as current behavior;
                // a fix that dispatches effect-before-damage flips this pin.
                assertEffect: () => {
                    expect(cells.has(`${NPC}|targetEffects`)).toBe(false);
                    expect(runtime.setRuntimeValue).not.toHaveBeenCalled();
                },
            },
        ])('$element fail: full damage THROUGH the live summary, exact roll row, no effect writes', async ({ element, saveType, formula, damageType, assertEffect }) => {
            const { npc, summary } = seedNpc();

            render(<ElementalAttunementModal {...makeProps()} />);
            clickElement(element);

            // Exact full row of the damage resolver (resolveNpcDamageResult) — every field.
            await waitFor(() => expect(logService.addEntry).toHaveBeenCalled());
            expect(logService.addEntry.mock.calls).toEqual([[CAMPAIGN, {
                type: 'roll',
                characterName: PLAYER,
                rollType: 'save-damage',
                name: 'Elemental Attunement',
                targetName: NPC,
                saveType,
                saveDc: 12,
                saveResult: 'failure',
                saveRoll: 11,
                saveBonus: -10,
                saveRawRolls: [11],
                timestamp: FROZEN_TS,
                formula,
                rolls: [5],
                total: 5,
                modifier: 0,
                damageType,
                finalDamage: 5,
            }]]);
            // Damage applied UNHALVED through the live mutator: exact call args AND the moved HP.
            expect(applyDamageToTarget).toHaveBeenCalledWith(summary, NPC, 5, [damageType], {
                campaignName: CAMPAIGN, characters: [], ignoreResistance: false, attackerName: PLAYER, suppressHpLog: false,
            });
            expect(npc.currentHp).toBe(2);
            expect(diceRoller.rollExpression).toHaveBeenCalledWith(formula);
            // The damage branch writes NO conditions (Cold is the only condition lane).
            expect(runtime.setRuntimeValue).not.toHaveBeenCalled();
            if (assertEffect) assertEffect();
        });
    });

    it('Fire saved (d20 pinned to pass): HALF damage through the live summary, exact roll row, zero store writes', async () => {
        vi.spyOn(Math, 'random').mockReturnValue(0.9); // roll 19 + dex 2 = 21 ≥ DC 12
        const { npc, summary } = seedNpc({ saveBonuses: { dex: 2, con: -10 } });

        render(<ElementalAttunementModal {...makeProps()} />);
        clickElement('Fire');

        await waitFor(() => expect(logService.addEntry).toHaveBeenCalled());
        expect(logService.addEntry.mock.calls).toEqual([[CAMPAIGN, {
            type: 'roll',
            characterName: PLAYER,
            rollType: 'save-damage',
            name: 'Elemental Attunement',
            targetName: NPC,
            saveType: 'dex',
            saveDc: 12,
            saveResult: 'success',
            saveRoll: 19,
            saveBonus: 2,
            saveRawRolls: [19],
            timestamp: FROZEN_TS,
            formula: '1d10',
            rolls: [5],
            total: 5,
            modifier: 0,
            damageType: 'fire',
            finalDamage: 2,
        }]]);
        expect(applyDamageToTarget).toHaveBeenCalledWith(summary, NPC, 2, ['fire'], {
            campaignName: CAMPAIGN, characters: [], ignoreResistance: false, attackerName: PLAYER, suppressHpLog: false,
        });
        expect(npc.currentHp).toBe(5);
        expect(runtime.setRuntimeValue).not.toHaveBeenCalled();
        expect(cells.size).toBe(0);
    });

    it('NPC with no saveBonuses property: bonus defaults to 0, still fails DC 12, exact row and damage', async () => {
        const { npc, summary } = seedNpc({ omitSaveBonuses: true });

        render(<ElementalAttunementModal {...makeProps()} />);
        clickElement('Fire');

        await waitFor(() => expect(logService.addEntry).toHaveBeenCalled());
        expect(logService.addEntry.mock.calls).toEqual([[CAMPAIGN, {
            type: 'roll',
            characterName: PLAYER,
            rollType: 'save-damage',
            name: 'Elemental Attunement',
            targetName: NPC,
            saveType: 'dex',
            saveDc: 12,
            saveResult: 'failure',
            saveRoll: 11,
            saveBonus: 0,
            saveRawRolls: [11],
            timestamp: FROZEN_TS,
            formula: '1d10',
            rolls: [5],
            total: 5,
            modifier: 0,
            damageType: 'fire',
            finalDamage: 5,
        }]]);
        expect(applyDamageToTarget).toHaveBeenCalledWith(summary, NPC, 5, ['fire'], {
            campaignName: CAMPAIGN, characters: [], ignoreResistance: false, attackerName: PLAYER, suppressHpLog: false,
        });
        expect(npc.currentHp).toBe(2);
    });

    describe('Cold speed_reduction', () => {
        it('failed save: writes exactly [speed_reduction] to the LIVE store, exact ability_use row, zero damage', async () => {
            const { npc, summary } = seedNpc();

            render(<ElementalAttunementModal {...makeProps()} />);
            clickElement('Cold');

            await waitFor(() => expect(logService.addEntry).toHaveBeenCalled());
            expect(logService.addEntry.mock.calls).toEqual([[CAMPAIGN, {
                type: 'ability_use',
                characterName: PLAYER,
                abilityName: 'Elemental Attunement',
                description: 'Elemental Attunement (Cold) on <strong>Goblin1</strong>: failed DEX save (DC 12). Speed reduced by 15 ft.',
                saveRoll: 11,
                saveBonus: -10,
                saveTotal: 1,
                saveDc: 12,
                saveSuccess: false,
            }]]);
            // The condition write landed in the LIVE cell — exact, one key, one entry.
            expect(runtime.setRuntimeValue).toHaveBeenCalledWith(NPC, 'activeConditions', ['speed_reduction'], CAMPAIGN);
            expect(cells.get(`${NPC}|activeConditions`)).toEqual(['speed_reduction']);
            expect(cells.size).toBe(1);
            // Cold deals no damage: the summary is untouched, applyDamageToTarget never runs.
            expect(applyDamageToTarget).not.toHaveBeenCalled();
            expect(diceRoller.rollExpression).not.toHaveBeenCalled();
            expect(npc.currentHp).toBe(7);
            expect(summary.creatures[0].currentHp).toBe(7);
        });

        it('saved: NO condition is written to the LIVE store and logs the saved ability_use row', async () => {
            vi.spyOn(Math, 'random').mockReturnValue(0.9); // roll 19 + dex 2 = 21 ≥ DC 12
            const { npc } = seedNpc({ saveBonuses: { dex: 2, con: -10 } });

            render(<ElementalAttunementModal {...makeProps()} />);
            clickElement('Cold');

            await waitFor(() => expect(logService.addEntry).toHaveBeenCalled());
            expect(logService.addEntry.mock.calls).toEqual([[CAMPAIGN, {
                type: 'ability_use',
                characterName: PLAYER,
                abilityName: 'Elemental Attunement',
                description: 'Elemental Attunement (Cold) on <strong>Goblin1</strong>: saved DEX save (DC 12). No effect.',
                saveRoll: 19,
                saveBonus: 2,
                saveTotal: 21,
                saveDc: 12,
                saveSuccess: true,
            }]]);
            expect(runtime.setRuntimeValue).not.toHaveBeenCalled();
            expect(cells.size).toBe(0);
            expect(npc.currentHp).toBe(7);
        });

        it('does not duplicate an already-active speed_reduction: re-writes the SAME array by identity', async () => {
            const seed = ['speed_reduction'];
            cells.set(`${NPC}|activeConditions`, seed);
            seedNpc();

            render(<ElementalAttunementModal {...makeProps()} />);
            clickElement('Cold');

            await waitFor(() => expect(runtime.setRuntimeValue).toHaveBeenCalled());
            // No duplication, no reorder, no copy: the exact same array object went back in.
            expect(runtime.setRuntimeValue).toHaveBeenCalledWith(NPC, 'activeConditions', seed, CAMPAIGN);
            expect(cells.get(`${NPC}|activeConditions`)).toBe(seed);
            expect(cells.get(`${NPC}|activeConditions`)).toEqual(['speed_reduction']);
        });

        it('appends speed_reduction AFTER existing conditions — other conditions survive byte-exact', async () => {
            cells.set(`${NPC}|activeConditions`, ['prone', 'restrained']);
            seedNpc();

            render(<ElementalAttunementModal {...makeProps()} />);
            clickElement('Cold');

            await waitFor(() => expect(runtime.setRuntimeValue).toHaveBeenCalled());
            expect(runtime.setRuntimeValue).toHaveBeenCalledWith(NPC, 'activeConditions', ['prone', 'restrained', 'speed_reduction'], CAMPAIGN);
            expect(cells.get(`${NPC}|activeConditions`)).toEqual(['prone', 'restrained', 'speed_reduction']);
        });
    });

    it('persistAndNotify: ONE persist of the SAME summary object, AFTER in-memory damage landed', async () => {
        const { npc, summary } = seedNpc();
        let hpAtPersist = null;
        persistAndNotify.mockImplementationOnce(() => { hpAtPersist = npc.currentHp; });

        render(<ElementalAttunementModal {...makeProps()} />);
        clickElement('Fire');

        await screen.findByRole('button', { name: /Close/ });
        expect(persistAndNotify).toHaveBeenCalledTimes(1);
        expect(persistAndNotify.mock.calls[0][0]).toBe(summary);
        expect(persistAndNotify.mock.calls[0][1]).toBe(CAMPAIGN);
        // Write order: the damage mutated the summary BEFORE persist made it durable
        // (the non-atomic window is pinned by .error-handling; order proven here).
        expect(hpAtPersist).toBe(2);
    });

    describe('summary phase result lines', () => {
        it.each([
            { element: 'Fire', saveBonuses: { dex: 2, con: -10 }, random: 0.9, line: 'Goblin1: Saved (d20 19+2 = 21). 1d10 fire: 1d10 [5] = 5 → 2 fire damage' },
            { element: 'Cold', saveBonuses: { dex: -10, con: -10 }, random: 0.5, line: 'Goblin1: Failed (d20 11+-10 = 1) — speed reduced by 15 ft.' },
        ])('$element renders the exact one-line result: $line', async ({ element, saveBonuses, random, line }) => {
            vi.spyOn(Math, 'random').mockReturnValue(random);
            seedNpc({ saveBonuses });

            render(<ElementalAttunementModal {...makeProps()} />);
            clickElement(element);

            // Close exists ONLY in the summary phase — it gates the phase transition.
            await screen.findByRole('button', { name: /Close/ });
            const results = document.querySelector('.aoe-results');
            expect(results.children).toHaveLength(1);
            expect(results.textContent).toBe(line);
        });
    });
});
