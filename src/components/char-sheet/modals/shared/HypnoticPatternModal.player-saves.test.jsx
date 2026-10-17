// @maintained-by-ai
// HypnoticPatternModal player-save lane: prompt dispatch for player targets
// (issuePlayerSavePrompt payload + pending bookkeeping, no local resolution) and
// window 'save-result' event resolution (fail: conditions/expiry/logs/record/close;
// pass: log/record/close; malformed/foreign events: ignored). NPC local resolution
// lives in .npc-saves.test.jsx, careful/heighten metamagic in .metamagic.test.jsx,
// overlay/unmount guard in .advanced.test.jsx, SP-069 latch in .sp069.test.jsx.
// No dice roll here — player saves arrive pre-rolled via the save-result event.
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import HypnoticPatternModal from './HypnoticPatternModal.jsx';

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

vi.mock('../../../../hooks/useAllySelection.js', () => ({
    getAllyList: vi.fn(),
}));

import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { sendSavePrompt } from '../../../../services/combat/conditions/savePromptService.js';
import { getCombatSummary } from '../../../../services/encounters/combatData.js';
import { addEntry } from '../../../../services/ui/logService.js';
import { addExpiration } from '../../../../services/rules/effects/expirations.js';
import { persistAndNotify } from './AreaEffectTargetModalBase.utils.jsx';
import { addTargetResult } from '../../../../services/automation/common/damageRollback.js';

const campaignName = 'test-campaign';

const basePlayerStats = {
    name: 'Wizard1',
    level: 10,
    proficiency: 4,
    abilities: [{ name: 'Intelligence', bonus: 4 }],
};

const baseAction = {
    name: 'Hypnotic Pattern',
    automation: { type: 'hypnotic_pattern' },
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
        onClose: vi.fn(),
        ...overrides,
    };
}

function rowFor(name) {
    return [...document.querySelectorAll('.secondary-target-row')].find(row => row.textContent.includes(name));
}

function conditionWritesFor(name) {
    return setRuntimeValue.mock.calls.filter(call => call[0] === name && call[1] === 'activeConditions');
}

function saveResultLogs(name, success) {
    return addEntry.mock.calls
        .map(call => call[1])
        .filter(entry => entry?.type === 'save_result'
            && (name === undefined || entry.targetName === name)
            && (success === undefined || entry.success === success));
}

// Select the player target and confirm — the modal dispatches a save prompt
// and the 'save-result' listener becomes live.
async function dispatchPlayerPrompt() {
    render(<HypnoticPatternModal {...makeProps()} />);
    await act(async () => { fireEvent.click(rowFor('PlayerAlly')); });
    await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Hypnotic Pattern \(1\)/ }));
    });
    expect(sendSavePrompt).toHaveBeenCalledTimes(1);
    return sendSavePrompt.mock.calls[0][1].promptId;
}

async function triggerSaveResult(promptId, detail) {
    await act(async () => {
        window.dispatchEvent(new CustomEvent('save-result', { detail: { promptId, ...detail } }));
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

describe('HypnoticPatternModal - Player Saves', () => {
    it('dispatches a save prompt for a player target and resolves nothing locally', async () => {
        render(<HypnoticPatternModal {...makeProps()} />);
        await act(async () => { fireEvent.click(rowFor('PlayerAlly')); });
        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: /Hypnotic Pattern \(1\)/ }));
        });

        expect(sendSavePrompt).toHaveBeenCalledWith(campaignName, expect.objectContaining({
            targetName: 'PlayerAlly',
            saveType: 'WIS',
            saveDc: 14,
            sourceName: 'Wizard1',
        }));
        const promptId = sendSavePrompt.mock.calls[0][1].promptId;
        expect(promptId).toEqual(expect.any(String));
        // The prompt is registered as pending so its reply stays routable.
        expect(setRuntimeValue).toHaveBeenCalledWith(
            'campaign', 'pendingSaveListenerPrompts',
            expect.arrayContaining([promptId]), campaignName,
        );
        // "Prompt, don't resolve": no conditions, records, or save_result logs yet.
        expect(conditionWritesFor('PlayerAlly')).toHaveLength(0);
        expect(addTargetResult).not.toHaveBeenCalled();
        expect(saveResultLogs()).toHaveLength(0);
    });

    it('failed save-result resolves the player: conditions, expiry, full audit log, failure record, close', async () => {
        const onClose = vi.fn();
        render(<HypnoticPatternModal {...makeProps({ onClose })} />);
        await act(async () => { fireEvent.click(rowFor('PlayerAlly')); });
        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: /Hypnotic Pattern \(1\)/ }));
        });
        const promptId = sendSavePrompt.mock.calls[0][1].promptId;
        await triggerSaveResult(promptId, { success: false, roll: 7, total: 8, saveBonus: 1 });

        await waitFor(() => {
            const writes = conditionWritesFor('PlayerAlly');
            expect(writes).toHaveLength(1);
            expect(writes[0][2]).toEqual(['charmed', 'incapacitated', 'speed_zero']);

            expect(addExpiration).toHaveBeenCalledWith({
                attackerName: 'Wizard1',
                targetName: 'PlayerAlly',
                effects: [
                    { type: 'charmed', condition: 'charmed' },
                    { type: 'incapacitated', condition: 'incapacitated' },
                    { type: 'speed_zero', condition: 'speed_zero' },
                ],
                campaignName,
            });

            const entries = saveResultLogs('PlayerAlly');
            expect(entries).toHaveLength(1);
            expect(entries[0]).toEqual(expect.objectContaining({
                characterName: 'Wizard1',
                success: false,
                roll: 7,
                total: 8,
                saveBonus: 1,
                saveDc: 14,
                saveType: 'WIS',
                description: expect.stringContaining('PlayerAlly failed WIS save (DC 14, rolled 7 + 1 = 8)'),
            }));

            // Spell-effect audit trail (separate from the raw save_result entry).
            const conditionLogs = addEntry.mock.calls
                .map(call => call[1])
                .filter(entry => entry?.type === 'condition' && entry?.action === 'applied'
                    && entry.characterName === 'PlayerAlly');
            expect(conditionLogs).toHaveLength(1);
            expect(conditionLogs[0].condition).toBe('Charmed, Incapacitated, Speed 0');

            expect(addTargetResult).toHaveBeenCalledWith(campaignName, expect.objectContaining({
                targetName: 'PlayerAlly',
                saveResult: 'failure',
                roll: 7,
                total: 8,
                conditions: ['charmed', 'incapacitated', 'speed_zero'],
                appliedDamage: 0,
            }));

            expect(persistAndNotify).toHaveBeenCalled();
        });

        // Last prompt resolved -> modal closes after its grace delay.
        await waitFor(() => { expect(onClose).toHaveBeenCalled(); }, { timeout: 1500 });
    });

    it('successful save-result logs success, records no conditions, and closes', async () => {
        const onClose = vi.fn();
        render(<HypnoticPatternModal {...makeProps({ onClose })} />);
        await act(async () => { fireEvent.click(rowFor('PlayerAlly')); });
        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: /Hypnotic Pattern \(1\)/ }));
        });
        const promptId = sendSavePrompt.mock.calls[0][1].promptId;
        await triggerSaveResult(promptId, { success: true, roll: 18, total: 19, saveBonus: 1 });

        await waitFor(() => {
            const entries = saveResultLogs('PlayerAlly');
            expect(entries).toHaveLength(1);
            expect(entries[0]).toEqual(expect.objectContaining({
                characterName: 'Wizard1',
                success: true,
                roll: 18,
                total: 19,
                saveBonus: 1,
                description: expect.stringContaining('PlayerAlly succeeded on WIS save (DC 14, rolled 18 + 1 = 19)'),
            }));

            expect(addTargetResult).toHaveBeenCalledWith(campaignName, expect.objectContaining({
                targetName: 'PlayerAlly',
                saveResult: 'success',
                roll: 18,
                total: 19,
                conditions: [],
                appliedDamage: 0,
            }));

            expect(persistAndNotify).toHaveBeenCalled();
        });

        expect(conditionWritesFor('PlayerAlly')).toHaveLength(0);
        expect(addExpiration).not.toHaveBeenCalled();

        // Last prompt resolved -> modal closes after its grace delay.
        await waitFor(() => { expect(onClose).toHaveBeenCalled(); }, { timeout: 1500 });
    });

    it('ignores save-result events with missing or foreign promptId — nothing resolves or closes', async () => {
        const promptId = await dispatchPlayerPrompt();
        expect(promptId).toBeTruthy();

        await triggerSaveResult(undefined, { success: false });
        await triggerSaveResult('non-existent-prompt-id', { success: false, roll: 5, total: 6, saveBonus: 1 });

        expect(conditionWritesFor('PlayerAlly')).toHaveLength(0);
        expect(addExpiration).not.toHaveBeenCalled();
        expect(addTargetResult).not.toHaveBeenCalled();
        expect(saveResultLogs()).toHaveLength(0);
    });

    it('resolves save-result with missing roll fields using zero defaults', async () => {
        const promptId = await dispatchPlayerPrompt();
        await triggerSaveResult(promptId, { success: false });

        await waitFor(() => {
            const entries = saveResultLogs('PlayerAlly');
            expect(entries).toHaveLength(1);
            expect(entries[0]).toEqual(expect.objectContaining({
                success: false,
                roll: 0,
                total: 0,
                saveBonus: 0,
                description: expect.stringContaining('PlayerAlly failed WIS save (DC 14, rolled 0 = 0)'),
            }));

            expect(addTargetResult).toHaveBeenCalledWith(campaignName, expect.objectContaining({
                targetName: 'PlayerAlly',
                saveResult: 'failure',
                roll: 0,
                total: 0,
                conditions: ['charmed', 'incapacitated', 'speed_zero'],
            }));
        });

        // Failure path still applies its conditions.
        expect(conditionWritesFor('PlayerAlly')[0][2]).toEqual(['charmed', 'incapacitated', 'speed_zero']);
    });
});
