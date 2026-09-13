// @improved-by-ai
// @cleaned-by-ai
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import FearModal from './FearModal.jsx';

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

vi.mock('../../../../hooks/useAllySelection.js', () => ({
    getAllyList: vi.fn(),
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
import { getCombatSummary } from '../../../../services/encounters/combatData.js';
import { sendSavePrompt } from '../../../../services/combat/conditions/savePromptService.js';
import { addEntry } from '../../../../services/ui/logService.js';
import { addTargetResult } from '../../../../services/automation/common/damageRollback.js';
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
    name: 'Bane',
    automation: { type: 'bane' },
};

const baseCombatSummary = {
    creatures: [
        { name: 'Goblin', type: 'npc', currentHp: 5, maxHp: 7, saveBonuses: { cha: 0 } },
        { name: 'Orc', type: 'npc', currentHp: 15, maxHp: 22, saveBonuses: { cha: 2 } },
        { name: 'PlayerAlly', type: 'player', currentHp: 30, maxHp: 30, saveBonuses: { cha: 1 } },
    ],
};

function makeProps(overrides = {}) {
    return {
        action: baseAction,
        playerStats: basePlayerStats,
        campaignName,
        saveType: 'CHA',
        saveDc: 14,
        onClose: vi.fn(),
        ...overrides,
    };
}

// Helper: select a player target and confirm to trigger save prompt flow
function selectPlayerAndConfirm(props = {}) {
    return render(<FearModal {...makeProps(props)} />);
}

// Helper: select player target, confirm, and return the promptId from sendSavePrompt
async function selectPlayerAndConfirmWithPromptId(props = {}) {
    const result = selectPlayerAndConfirm(props);
    const labels = document.querySelectorAll('.secondary-target-row');
    await act(async () => { fireEvent.click(labels[2]); });
    await waitFor(() => {
        expect(screen.getByRole('button', { name: /Bane \(1\)/ })).toBeInTheDocument();
    });
    await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Bane \(1\)/ }));
    });
    const savePromptCall = vi.mocked(sendSavePrompt).mock.calls[0];
    return { ...result, promptId: savePromptCall[1].promptId };
}

// Helper: dispatch a save-result custom event
async function triggerSaveResult(promptId, success, overrides = {}) {
    return act(async () => {
        const event = new CustomEvent('save-result', {
            detail: {
                promptId,
                success,
                roll: overrides.roll ?? 5,
                total: overrides.total ?? 6,
                saveBonus: overrides.saveBonus ?? 1,
            },
        });
        window.dispatchEvent(event);
    });
}

beforeEach(() => {
    vi.resetAllMocks();
    getCombatSummary.mockReturnValue(baseCombatSummary);
    getRuntimeValue.mockReturnValue([]);
    setRuntimeValue.mockReturnValue(undefined);
    addEntry.mockResolvedValue(undefined);
});

describe('FearModal player saves', () => {
    // ── Player save prompts ──

    describe('player save prompts', () => {
        it('sends save prompt, tracks pending prompts, logs ability_use, and calls persistAndNotify for player targets', async () => {
            selectPlayerAndConfirm();
            const labels = document.querySelectorAll('.secondary-target-row');
            await act(async () => { fireEvent.click(labels[2]); });
            await waitFor(() => {
                expect(screen.getByRole('button', { name: /Bane \(1\)/ })).toBeInTheDocument();
            });
            await act(async () => {
                fireEvent.click(screen.getByRole('button', { name: /Bane \(1\)/ }));
            });

            expect(sendSavePrompt).toHaveBeenCalledWith(campaignName, expect.objectContaining({
                targetName: 'PlayerAlly',
                saveType: 'CHA',
                saveDc: 14,
                sourceName: 'Wizard1',
            }));

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'campaign',
                'pendingSaveListenerPrompts',
                expect.arrayContaining([expect.any(String)]),
                campaignName,
            );

            const abilityCalls = addEntry.mock.calls.filter(
                call => call[1]?.type === 'ability_use'
            );
            expect(abilityCalls.length).toBeGreaterThan(0);
            expect(abilityCalls[0][1]).toMatchObject({
                characterName: 'Wizard1',
                abilityName: 'Bane',
            });

            expect(persistAndNotify).toHaveBeenCalledWith(baseCombatSummary, campaignName);

            const conditionCalls = setRuntimeValue.mock.calls.filter(
                call => call[1] === 'activeConditions' && call[0] === 'PlayerAlly'
            );
            expect(conditionCalls.length).toBe(0);
        });
    });

    // ── Player save result handling ──

    describe('player save result handling', () => {
        it('applies frightened, expiration, fear effect, and logs on failed player save', async () => {
            const { promptId } = await selectPlayerAndConfirmWithPromptId();

            await triggerSaveResult(promptId, false);

            await waitFor(() => {
                const conditionCalls = setRuntimeValue.mock.calls.filter(
                    call => call[1] === 'activeConditions' && call[0] === 'PlayerAlly'
                );
                expect(conditionCalls.length).toBeGreaterThan(0);
                expect(conditionCalls[0][2]).toContain('frightened');
            });

            expect(addExpiration).toHaveBeenCalledWith({ attackerName: 'Wizard1', targetName: 'PlayerAlly', effects: [{ type: 'condition', condition: 'frightened' }], campaignName });

            await waitFor(() => {
                const targetEffectCalls = setRuntimeValue.mock.calls.filter(
                    call => call[1] === 'targetEffects' && call[0] === 'campaign'
                );
                expect(targetEffectCalls.length).toBeGreaterThan(0);
                const effects = targetEffectCalls[0][2];
                const fearEffect = effects.find(e => e.effect === 'fear_end_on_los');
                expect(fearEffect).toBeDefined();
                expect(fearEffect.target).toBe('PlayerAlly');
                expect(fearEffect.source).toBe('Wizard1');
                expect(fearEffect.dc).toBe(14);
                expect(fearEffect.condition).toBe('frightened');
                expect(fearEffect.duration).toBe('concentration');
            });

            await waitFor(() => {
                const saveEntries = addEntry.mock.calls.filter(
                    call => call[1]?.type === 'save_result' && call[1]?.success === false
                );
                expect(saveEntries.length).toBeGreaterThan(0);
                expect(saveEntries[0][1].targetName).toBe('PlayerAlly');
            });

            await waitFor(() => {
                const conditionEntries = addEntry.mock.calls.filter(
                    call => call[1]?.type === 'condition' && call[1]?.condition === 'Frightened'
                );
                expect(conditionEntries.length).toBeGreaterThan(0);
                expect(conditionEntries[0][1].characterName).toBe('PlayerAlly');
            });
        });

        it('logs save_result success and calls addTargetResult when player passes save', async () => {
            const { promptId } = await selectPlayerAndConfirmWithPromptId();

            await triggerSaveResult(promptId, true, { roll: 18, total: 19 });

            await waitFor(() => {
                const saveEntries = addEntry.mock.calls.filter(
                    call => call[1]?.type === 'save_result' && call[1]?.success === true
                );
                expect(saveEntries.length).toBeGreaterThan(0);
            });

            expect(addTargetResult).toHaveBeenCalledWith(campaignName, expect.objectContaining({
                targetName: 'PlayerAlly',
                saveResult: 'success',
            }));

            const conditionCalls = setRuntimeValue.mock.calls.filter(
                call => call[1] === 'activeConditions' && call[0] === 'PlayerAlly'
            );
            expect(conditionCalls.length).toBe(0);
        });

        it('closes modal when all pending prompts are resolved', async () => {
            const onClose = vi.fn();
            const { promptId } = await selectPlayerAndConfirmWithPromptId({ onClose });

            await triggerSaveResult(promptId, false);

            await waitFor(() => {
                expect(onClose).toHaveBeenCalledTimes(1);
            });
        });

        it('handles save-result event with missing optional fields', async () => {
            const { promptId } = await selectPlayerAndConfirmWithPromptId();

            await act(async () => {
                const event = new CustomEvent('save-result', {
                    detail: {
                        promptId,
                        success: false,
                    },
                });
                window.dispatchEvent(event);
            });

            await waitFor(() => {
                const conditionCalls = setRuntimeValue.mock.calls.filter(
                    call => call[1] === 'activeConditions' && call[0] === 'PlayerAlly'
                );
                expect(conditionCalls.length).toBeGreaterThan(0);
            });
        });
    });

    // ── Edge cases ──

    describe('edge cases', () => {
        it.each([
            { detail: null, name: 'no detail' },
            { detail: { promptId: 'unknown-prompt-id', success: false }, name: 'unknown promptId' },
        ])('ignores save-result events with $name', async () => {
            const onClose = vi.fn();
            selectPlayerAndConfirm({ onClose });
            const labels = document.querySelectorAll('.secondary-target-row');
            await act(async () => { fireEvent.click(labels[2]); });
            await waitFor(() => {
                expect(screen.getByRole('button', { name: /Bane \(1\)/ })).toBeInTheDocument();
            });
            await act(async () => {
                fireEvent.click(screen.getByRole('button', { name: /Bane \(1\)/ }));
            });

            await act(async () => {
                const event = new CustomEvent('save-result', {
                    detail: null,
                });
                window.dispatchEvent(event);
            });

            expect(onClose).not.toHaveBeenCalled();
        });
    });
});
