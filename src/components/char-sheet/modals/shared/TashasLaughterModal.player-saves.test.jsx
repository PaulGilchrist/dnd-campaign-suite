// @maintained-by-ai 2026-11-28
// TashasLaughterModal player-saves lane: the modal-side player-save seam only.
// Prompt dispatch at confirm (payload, pending-prompt registration, inertness
// until the player answers), the Heightened Spell disadvantage flag on the
// payload (the player client owns the roll), resolution of the player's
// save-result event through the modal (rows, effect application, tally popup,
// single close), detail-tolerant resolution, stray-event inertness, and the
// deferred close when a cast mixes a local NPC roll with a pending player
// prompt. The shared failure-effect payload bytes (activeConditionMeta,
// expiration, targetEffect) are pinned by TashasLaughterModal.npc-saves.test.jsx
// through the same applyLaughterConditionsToTarget helper — referenced
// shallowly here, never re-pinned. NPC auto-roll adjudication lives in the
// npc-saves lane; dismiss hygiene in TashasLaughterModal.save-dismissed.test.jsx;
// rendering, selection, maxTargets, skip, and empty-state in
// TashasLaughterModal.test.jsx — not repeated here.
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import TashasLaughterModal from './TashasLaughterModal.jsx';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../../../services/combat/conditions/savePromptService.js', () => ({
    sendSavePrompt: vi.fn(),
}));

vi.mock('../../../../services/ui/logService.js', () => ({
    addEntry: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../../services/encounters/combatData.js', () => ({
    getCombatSummary: vi.fn(),
}));

vi.mock('../../../../services/automation/common/damageRollback.js', () => ({
    storeSpellLastAttack: vi.fn(),
    addTargetResult: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../../services/rules/effects/expirations.js', () => ({
    addExpiration: vi.fn(),
}));

vi.mock('./AreaEffectTargetModalBase.utils.jsx', () => ({
    persistAndNotify: vi.fn(),
}));

import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { sendSavePrompt } from '../../../../services/combat/conditions/savePromptService.js';
import { getCombatSummary } from '../../../../services/encounters/combatData.js';
import { addEntry } from '../../../../services/ui/logService.js';
import { storeSpellLastAttack, addTargetResult } from '../../../../services/automation/common/damageRollback.js';
import { addExpiration } from '../../../../services/rules/effects/expirations.js';
import { persistAndNotify } from './AreaEffectTargetModalBase.utils.jsx';

const campaignName = 'test-campaign';

const basePlayerStats = {
    name: 'Wizard1',
    level: 10,
    proficiency: 4,
    abilities: [{ name: 'Intelligence', bonus: 4 }],
};

const baseAction = {
    name: "Tasha's Hideous Laughter",
    automation: { type: 'tashas_hideous_laughter' },
};

const baseCombatSummary = {
    creatures: [
        { name: 'Goblin', type: 'npc', currentHp: 5, maxHp: 7, saveBonuses: { wis: 0 } },
        { name: 'Orc', type: 'npc', currentHp: 15, maxHp: 22, saveBonuses: { wis: 2 } },
        { name: 'PlayerAlly', type: 'player', currentHp: 30, maxHp: 30, saveBonuses: { wis: 1 } },
    ],
};

function makeProps(overrides = {}) {
    return {
        action: baseAction,
        playerStats: basePlayerStats,
        campaignName,
        saveType: 'WIS',
        saveDc: 14,
        spellSlotLevel: 1,
        onClose: vi.fn(),
        ...overrides,
    };
}

const entriesOf = (filter) => addEntry.mock.calls.map(c => c[1]).filter(filter);
const saveResultsFor = (name) =>
    entriesOf(e => e.type === 'save_result' && e.targetName === name);
const conditionWritesFor = (name) =>
    setRuntimeValue.mock.calls.filter(c => c[1] === 'activeConditions' && c[0] === name);
const targetEffectWrites = () =>
    setRuntimeValue.mock.calls
        .filter(c => c[1] === 'targetEffects' && c[0] === 'campaign')
        .map(c => c[2]);

function targetRow(name) {
    const rows = [...document.querySelectorAll('.secondary-target-row')];
    const row = rows.find(r => r.textContent.includes(name));
    if (!row) throw new Error(`target row for ${name} not found`);
    return row;
}

async function clickRow(name) {
    await act(async () => {
        fireEvent.click(targetRow(name));
    });
}

async function clickConfirm(count) {
    await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: new RegExp(`Tasha's Hideous Laughter \\(${count}\\)`) }));
    });
}

// Select the only player row and confirm (one prompt is dispatched).
async function selectPlayerAndConfirm() {
    await clickRow('PlayerAlly');
    await clickConfirm(1);
}

// Deterministic d20 draws consumed in target order (1 draw per NPC save
// without disadvantage; issuePlayerSavePrompt also draws once per prompt id).
// The last seeded value repeats as a fallback so later draws never NaN.
function seedRolls(draws) {
    const seq = [...draws];
    vi.spyOn(Math, 'random').mockImplementation(() => (seq.length > 1 ? seq.shift() : seq[0]));
}

// Dispatch a save-result for the live prompt. Rolls default to an honest
// failure vs DC 14 (7 + 1 = 8); pass explicit values to pin other outcomes.
function triggerSaveResult(success, detail = {}) {
    const promptId = sendSavePrompt.mock.calls[0][1].promptId;
    return act(async () => {
        window.dispatchEvent(new CustomEvent('save-result', {
            detail: { promptId, success, roll: 7, total: 8, saveBonus: 1, ...detail },
        }));
    });
}

beforeEach(() => {
    vi.resetAllMocks();
    getCombatSummary.mockReturnValue(baseCombatSummary);
    getRuntimeValue.mockReturnValue([]);
    setRuntimeValue.mockReturnValue(undefined);
    addEntry.mockResolvedValue(undefined);
    persistAndNotify.mockReturnValue(undefined);
});

describe('TashasLaughterModal - Player Saves', () => {
    it('dispatches a save prompt for a player target and stays inert until the player answers', async () => {
        const onClose = vi.fn();
        render(<TashasLaughterModal {...makeProps({ onClose })} />);
        await selectPlayerAndConfirm();

        expect(sendSavePrompt).toHaveBeenCalledTimes(1);
        const prompt = sendSavePrompt.mock.calls[0][1];
        expect(prompt).toMatchObject({
            targetName: 'PlayerAlly',
            saveType: 'WIS',
            saveDc: 14,
            sourceName: 'Wizard1',
            disadvantage: false,
        });
        // The prompt id is registered so the player's answer can be matched.
        const registration = setRuntimeValue.mock.calls.find(
            c => c[0] === 'campaign' && c[1] === 'pendingSaveListenerPrompts',
        );
        expect(registration[2]).toContain(prompt.promptId);
        expect(registration[3]).toBe(campaignName);

        // Nothing resolves locally while the prompt is unanswered.
        expect(storeSpellLastAttack).toHaveBeenCalledWith(campaignName,
            expect.objectContaining({ attackScope: 'single' }));
        expect(conditionWritesFor('PlayerAlly')).toHaveLength(0);
        expect(targetEffectWrites()).toHaveLength(0);
        expect(addExpiration).not.toHaveBeenCalled();
        expect(saveResultsFor('PlayerAlly')).toHaveLength(0);
        expect(addTargetResult).not.toHaveBeenCalled();
        expect(onClose).not.toHaveBeenCalled();
    });

    it('flags disadvantage on the player save prompt when Heightened Spell targets the player', async () => {
        render(<TashasLaughterModal {...makeProps({ metamagicHeighten: true })} />);
        const row = targetRow('PlayerAlly');
        await act(async () => {
            fireEvent.click(row);
        });
        await act(async () => {
            fireEvent.click(row.querySelector('input[name="heightenTarget"]'));
        });
        await clickConfirm(1);

        // The player client owns the roll — the modal's contract is the flag.
        expect(sendSavePrompt).toHaveBeenCalledWith(campaignName, expect.objectContaining({
            targetName: 'PlayerAlly',
            disadvantage: true,
        }));
    });

    it('applies the failure from the player\'s answered roll, logs both rows, pops the tally, and closes once', async () => {
        const onClose = vi.fn();
        const setPopupHtml = vi.fn();
        render(<TashasLaughterModal {...makeProps({ onClose, setPopupHtml })} />);
        await selectPlayerAndConfirm();
        await triggerSaveResult(false, { roll: 7, total: 8, saveBonus: 1 });

        await waitFor(() => {
            expect(saveResultsFor('PlayerAlly')).toHaveLength(1);
        });
        expect(saveResultsFor('PlayerAlly')[0]).toMatchObject({
            success: false,
            characterName: 'Wizard1',
            saveType: 'WIS',
            saveDc: 14,
            roll: 7,
            total: 8,
            saveBonus: 1,
            description: 'PlayerAlly failed WIS save (DC 14, rolled 7 + 1 = 8) and is Prone and Incapacitated.',
        });

        // The shared laughter applier fires (payload bytes owned by the NPC
        // lane); this branch's contract is that the answered failure lands.
        expect(conditionWritesFor('PlayerAlly')).toHaveLength(1);
        expect(conditionWritesFor('PlayerAlly')[0][2]).toEqual(['prone', 'incapacitated']);
        expect(addExpiration).toHaveBeenCalledWith(expect.objectContaining({
            attackerName: 'Wizard1',
            targetName: 'PlayerAlly',
        }));
        expect(targetEffectWrites().flat().some(e =>
            e.effect === 'tashas_hideous_laughter' && e.target === 'PlayerAlly'
        )).toBe(true);

        // This branch builds its own ledger row and log lines from the detail.
        expect(addTargetResult).toHaveBeenCalledWith(campaignName, {
            targetName: 'PlayerAlly',
            saveResult: 'failure',
            roll: 7,
            total: 8,
            conditions: ['prone', 'incapacitated'],
            appliedDamage: 0,
        });
        const condEntry = entriesOf(e =>
            e.type === 'condition' && e.action === 'applied' && e.characterName === 'PlayerAlly'
        );
        expect(condEntry).toHaveLength(1);
        expect(condEntry[0]).toMatchObject({
            condition: 'Prone, Incapacitated',
            reason: "Tasha's Hideous Laughter",
            note: expect.stringContaining("can't end the Prone condition"),
        });
        expect(persistAndNotify).toHaveBeenCalledWith(baseCombatSummary, campaignName);

        // Popup fires at 0ms, close at 500ms after the last pending prompt
        // resolves — UI feedback timers only; the game state already landed.
        await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1), { timeout: 1500 });
        expect(setPopupHtml).toHaveBeenCalledWith({
            type: 'automation_info',
            name: "Tasha's Hideous Laughter",
            description: '1 creature(s) failed their save and are Prone and Incapacitated: PlayerAlly. 0 creature(s) saved.',
        });
    });

    it('logs a clean success with no effect writes or popup, then closes', async () => {
        const onClose = vi.fn();
        const setPopupHtml = vi.fn();
        render(<TashasLaughterModal {...makeProps({ onClose, setPopupHtml })} />);
        await selectPlayerAndConfirm();
        await triggerSaveResult(true, { roll: 15, total: 16, saveBonus: 1 });

        await waitFor(() => {
            expect(saveResultsFor('PlayerAlly')).toHaveLength(1);
        });
        expect(saveResultsFor('PlayerAlly')[0]).toMatchObject({
            success: true,
            characterName: 'Wizard1',
            roll: 15,
            total: 16,
            saveBonus: 1,
            description: 'PlayerAlly succeeded on WIS save (DC 14, rolled 15 + 1 = 16)',
        });
        expect(addTargetResult).toHaveBeenCalledWith(campaignName, {
            targetName: 'PlayerAlly',
            saveResult: 'success',
            roll: 15,
            total: 16,
            conditions: [],
            appliedDamage: 0,
        });
        expect(conditionWritesFor('PlayerAlly')).toHaveLength(0);
        expect(targetEffectWrites()).toHaveLength(0);
        expect(addExpiration).not.toHaveBeenCalled();
        expect(entriesOf(e => e.type === 'condition')).toHaveLength(0);

        await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1), { timeout: 1500 });
        expect(setPopupHtml).not.toHaveBeenCalled();
    });

    it('resolves a save-result omitting roll details, logging honest zeros', async () => {
        const onClose = vi.fn();
        render(<TashasLaughterModal {...makeProps({ onClose })} />);
        await selectPlayerAndConfirm();
        await triggerSaveResult(false, { roll: undefined, total: undefined, saveBonus: undefined });

        await waitFor(() => {
            expect(saveResultsFor('PlayerAlly')).toHaveLength(1);
        });
        // Missing roll numbers coalesce to 0, and a 0 bonus drops the "+ bonus"
        // term before interpolation — the description reads "rolled 0 = 0",
        // never "undefined" (remote answers can arrive without roll numbers).
        expect(saveResultsFor('PlayerAlly')[0]).toMatchObject({
            success: false,
            roll: 0,
            total: 0,
            saveBonus: 0,
            description: 'PlayerAlly failed WIS save (DC 14, rolled 0 = 0) and is Prone and Incapacitated.',
        });
        // The failure leg still lands with the sparse detail.
        expect(conditionWritesFor('PlayerAlly')).toHaveLength(1);
        expect(conditionWritesFor('PlayerAlly')[0][2]).toEqual(['prone', 'incapacitated']);
        expect(addTargetResult).toHaveBeenCalledWith(campaignName, expect.objectContaining({
            saveResult: 'failure',
            roll: 0,
            total: 0,
            conditions: ['prone', 'incapacitated'],
        }));
        await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1), { timeout: 1500 });
    });

    it('ignores stray save-result events (null detail, missing or unknown promptId) and still resolves the live prompt', async () => {
        const onClose = vi.fn();
        render(<TashasLaughterModal {...makeProps({ onClose })} />);
        await selectPlayerAndConfirm();
        // A processed result would persist and log synchronously after the guard.
        const persistCallsAtConfirm = persistAndNotify.mock.calls.length;

        for (const detail of [
            null,
            { success: false },
            { promptId: 'not-a-real-prompt-id', success: false, roll: 20, total: 25, saveBonus: 5 },
        ]) {
            await act(async () => {
                window.dispatchEvent(new CustomEvent('save-result', { detail }));
            });
        }

        expect(persistAndNotify).toHaveBeenCalledTimes(persistCallsAtConfirm);
        expect(saveResultsFor('PlayerAlly')).toHaveLength(0);
        expect(conditionWritesFor('PlayerAlly')).toHaveLength(0);
        expect(addTargetResult).not.toHaveBeenCalled();
        expect(onClose).not.toHaveBeenCalled();

        // The strays must not consume the pending prompt.
        await triggerSaveResult(false);
        await waitFor(() => {
            expect(saveResultsFor('PlayerAlly')).toHaveLength(1);
        });
    });

    it('holds the close while a player prompt is pending beside a resolved NPC roll, then drains to one tally and one close', async () => {
        const onClose = vi.fn();
        const setPopupHtml = vi.fn();
        seedRolls([0.01]); // Goblin nat 1 + 0 = 1 < DC 14; later draws feed the prompt id
        try {
            render(<TashasLaughterModal {...makeProps({ spellSlotLevel: 2, onClose, setPopupHtml })} />);
            await clickRow('Goblin');
            await clickRow('PlayerAlly');
            await clickConfirm(2);

            // The NPC leg resolves at confirm; the player leg parks pending.
            await waitFor(() => {
                expect(saveResultsFor('Goblin')).toHaveLength(1);
            });
            expect(sendSavePrompt).toHaveBeenCalledTimes(1);
            // Bounded flush (past the 0ms popup slot): a pending prompt must
            // schedule no popup and no premature close for the half-resolved cast.
            await act(async () => {
                await new Promise(r => setTimeout(r, 60));
            });
            expect(setPopupHtml).not.toHaveBeenCalled();
            expect(onClose).not.toHaveBeenCalled();

            const promptId = sendSavePrompt.mock.calls[0][1].promptId;
            await act(async () => {
                window.dispatchEvent(new CustomEvent('save-result', {
                    detail: { promptId, success: true, roll: 15, total: 16, saveBonus: 1 },
                }));
            });

            // Drain-to-empty merges both branches into one cross-target tally,
            // and the cast closes exactly once.
            await waitFor(() => expect(setPopupHtml).toHaveBeenCalledWith({
                type: 'automation_info',
                name: "Tasha's Hideous Laughter",
                description: '1 creature(s) failed their save and are Prone and Incapacitated: Goblin. 1 creature(s) saved.',
            }));
            await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1), { timeout: 1500 });
        } finally {
            Math.random.mockRestore();
        }
    });
});
