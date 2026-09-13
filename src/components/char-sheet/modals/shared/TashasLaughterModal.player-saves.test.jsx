// @improved-by-ai
// @cleaned-by-ai
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
        onClose: vi.fn(),
        ...overrides,
    };
}

// Helper: find the index of a target row by its displayed name (robust vs index-based)
function findTargetRowIndex(targetName) {
    const labels = document.querySelectorAll('.secondary-target-row');
    for (let i = 0; i < labels.length; i++) {
        if (labels[i].textContent.includes(targetName)) return i;
    }
    return -1;
}

// Helper: select a player target row and confirm to trigger the save prompt flow
function selectPlayerAndConfirm() {
    const idx = findTargetRowIndex('PlayerAlly');
    expect(idx).toBeGreaterThanOrEqual(0);
    const labels = document.querySelectorAll('.secondary-target-row');
    fireEvent.click(labels[idx]);
    return act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Tasha's Hideous Laughter \(1\)/ }));
    });
}

// Helper: dispatch a save-result event for the most recently sent prompt
function triggerSaveResult(success, extra = {}) {
    const savePromptCall = sendSavePrompt.mock.calls[0];
    const promptId = savePromptCall[1].promptId;
    return act(async () => {
        window.dispatchEvent(new CustomEvent('save-result', {
            detail: {
                promptId,
                success,
                roll: extra.roll ?? 5,
                total: extra.total ?? 6,
                saveBonus: extra.saveBonus ?? 1,
            },
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
    describe('player save prompts', () => {
        it('sends save prompt for player targets instead of resolving locally', async () => {
            render(<TashasLaughterModal {...makeProps()} />);
            await selectPlayerAndConfirm();

            expect(sendSavePrompt).toHaveBeenCalledWith(campaignName, expect.objectContaining({
                targetName: 'PlayerAlly',
                saveType: 'WIS',
                saveDc: 14,
                sourceName: 'Wizard1',
            }));
        });
    });

    describe('player save failure handling', () => {
        it('applies prone and incapacitated conditions to player on failed save', async () => {
            render(<TashasLaughterModal {...makeProps()} />);
            await selectPlayerAndConfirm();
            await triggerSaveResult(false);

            await waitFor(() => {
                const conditionCalls = setRuntimeValue.mock.calls.filter(
                    call => call[1] === 'activeConditions' && call[0] === 'PlayerAlly',
                );
                expect(conditionCalls.length).toBeGreaterThan(0);
                expect(conditionCalls[0][2]).toContain('prone');
                expect(conditionCalls[0][2]).toContain('incapacitated');
            });
        });

        it('calls addExpiration with prone, incapacitated, and tashas_laughter_expiration on failed save', async () => {
            render(<TashasLaughterModal {...makeProps()} />);
            await selectPlayerAndConfirm();
            await triggerSaveResult(false);

            await waitFor(() => {
                expect(addExpiration).toHaveBeenCalledWith({ attackerName: 'Wizard1', targetName: 'PlayerAlly', effects: [
                        { type: 'condition', condition: 'prone' },
                        { type: 'condition', condition: 'incapacitated' },
                        { type: 'tashas_laughter_expiration' },
                    ], campaignName });
            });
        });

        it('sets targetEffects with tashas_hideous_laughter on failed save', async () => {
            render(<TashasLaughterModal {...makeProps()} />);
            await selectPlayerAndConfirm();
            await triggerSaveResult(false);

            await waitFor(() => {
                const teCalls = setRuntimeValue.mock.calls.filter(
                    call => call[1] === 'targetEffects' && call[0] === 'campaign',
                );
                expect(teCalls.length).toBeGreaterThan(0);
                const effects = teCalls[0][2];
                const laughterEffect = effects.find(e => e.effect === 'tashas_hideous_laughter');
                expect(laughterEffect).toEqual(expect.objectContaining({
                    target: 'PlayerAlly',
                    effect: 'tashas_hideous_laughter',
                    source: 'Wizard1',
                }));
            });
        });

        it('logs save_result failure with roll details and description on failed save', async () => {
            render(<TashasLaughterModal {...makeProps()} />);
            await selectPlayerAndConfirm();
            await triggerSaveResult(false, { roll: 7, total: 8, saveBonus: 1 });

            await waitFor(() => {
                const saveEntries = addEntry.mock.calls.filter(
                    call => call[1]?.type === 'save_result' && call[1]?.targetName === 'PlayerAlly' && call[1]?.success === false,
                );
                expect(saveEntries.length).toBeGreaterThan(0);
                expect(saveEntries[0][1].roll).toBe(7);
                expect(saveEntries[0][1].total).toBe(8);
                expect(saveEntries[0][1].saveBonus).toBe(1);
                expect(saveEntries[0][1].targetName).toBe('PlayerAlly');
                expect(saveEntries[0][1].description).toContain('PlayerAlly failed');
                expect(saveEntries[0][1].description).toContain('rolled 7 + 1 = 8');
            });
        });

        it('logs combined condition entry with correct properties on failed save', async () => {
            render(<TashasLaughterModal {...makeProps()} />);
            await selectPlayerAndConfirm();
            await triggerSaveResult(false);

            await waitFor(() => {
                const conditionEntries = addEntry.mock.calls.filter(
                    call => call[1]?.type === 'condition' && call[1]?.action === 'applied' && call[1]?.characterName === 'PlayerAlly',
                );
                expect(conditionEntries.length).toBeGreaterThan(0);
                expect(conditionEntries[0][1]).toEqual(expect.objectContaining({
                    type: 'condition',
                    action: 'applied',
                    characterName: 'PlayerAlly',
                    condition: 'Prone, Incapacitated',
                }));
                expect(conditionEntries[0][1].note).toContain("Tasha's Hideous Laughter");
            });
        });

        it('records addTargetResult with failure and conditions on failed save', async () => {
            render(<TashasLaughterModal {...makeProps()} />);
            await selectPlayerAndConfirm();
            await triggerSaveResult(false);

            await waitFor(() => {
                const targetResultCalls = addTargetResult.mock.calls.filter(
                    call => call[0] === campaignName && call[1]?.targetName === 'PlayerAlly',
                );
                expect(targetResultCalls.length).toBe(1);
                expect(targetResultCalls[0][1].saveResult).toBe('failure');
                expect(targetResultCalls[0][1].conditions).toContain('prone');
                expect(targetResultCalls[0][1].conditions).toContain('incapacitated');
            });
        });

        it('calls persistAndNotify after player save result', async () => {
            render(<TashasLaughterModal {...makeProps()} />);
            await selectPlayerAndConfirm();
            await triggerSaveResult(false);

            await waitFor(() => {
                expect(persistAndNotify).toHaveBeenCalled();
            });
        });

        it('closes modal after player save result is processed', async () => {
            const onClose = vi.fn();
            render(<TashasLaughterModal {...makeProps({ onClose })} />);
            await selectPlayerAndConfirm();
            await triggerSaveResult(false);

            await waitFor(() => {
                expect(onClose).toHaveBeenCalled();
            });
        });
    });

    describe('player save success handling', () => {
        it('logs save_result success entry and description when player passes save', async () => {
            render(<TashasLaughterModal {...makeProps()} />);
            await selectPlayerAndConfirm();
            await triggerSaveResult(true, { roll: 15, total: 16, saveBonus: 1 });

            await waitFor(() => {
                const saveEntries = addEntry.mock.calls.filter(
                    call => call[1]?.type === 'save_result' && call[1]?.targetName === 'PlayerAlly' && call[1]?.success === true,
                );
                expect(saveEntries.length).toBe(1);
                expect(saveEntries[0][1].description).toContain('PlayerAlly succeeded');
                expect(saveEntries[0][1].description).toContain('rolled 15 + 1 = 16');
            });
        });

        it('records addTargetResult with success and empty conditions on save success', async () => {
            render(<TashasLaughterModal {...makeProps()} />);
            await selectPlayerAndConfirm();
            await triggerSaveResult(true);

            await waitFor(() => {
                const targetResultCalls = addTargetResult.mock.calls.filter(
                    call => call[0] === campaignName && call[1]?.targetName === 'PlayerAlly',
                );
                expect(targetResultCalls.length).toBe(1);
                expect(targetResultCalls[0][1].saveResult).toBe('success');
                expect(targetResultCalls[0][1].conditions).toEqual([]);
            });
        });

        it('does not apply conditions when player passes save', async () => {
            render(<TashasLaughterModal {...makeProps()} />);
            await selectPlayerAndConfirm();
            await triggerSaveResult(true);

            await waitFor(() => {
                const conditionCalls = setRuntimeValue.mock.calls.filter(
                    call => call[1] === 'activeConditions' && call[0] === 'PlayerAlly',
                );
                expect(conditionCalls.length).toBe(0);
            });
        });

        it('does not call addExpiration when player passes save', async () => {
            render(<TashasLaughterModal {...makeProps()} />);
            await selectPlayerAndConfirm();
            await triggerSaveResult(true);

            expect(addExpiration).not.toHaveBeenCalled();
        });

        it('does not set targetEffects when player passes save', async () => {
            render(<TashasLaughterModal {...makeProps()} />);
            await selectPlayerAndConfirm();
            await triggerSaveResult(true);

            await waitFor(() => {
                const teCalls = setRuntimeValue.mock.calls.filter(
                    call => call[1] === 'targetEffects' && call[0] === 'campaign',
                );
                const laughterEffect = teCalls.some(call => {
                    const effects = call[2];
                    return effects.some(e => e.target === 'PlayerAlly' && e.effect === 'tashas_hideous_laughter');
                });
                expect(laughterEffect).toBe(false);
            });
        });

        it('closes modal after player save success is processed', async () => {
            const onClose = vi.fn();
            render(<TashasLaughterModal {...makeProps({ onClose })} />);
            await selectPlayerAndConfirm();
            await triggerSaveResult(true);

            await waitFor(() => {
                expect(onClose).toHaveBeenCalled();
            });
        });
    });

    describe('save result event edge cases', () => {
        it.each([
            { name: 'missing promptId', detail: { success: false } },
            { name: 'unknown promptId', detail: { promptId: 'non-existent-prompt-id', success: false, roll: 5, total: 6, saveBonus: 1 } },
        ])('ignores save-result event with $name and applies no side effects', async ({ detail }) => {
            render(<TashasLaughterModal {...makeProps()} />);

            if (detail.promptId) {
                await selectPlayerAndConfirm();
            }

            await act(async () => {
                window.dispatchEvent(new CustomEvent('save-result', { detail }));
            });

            if (!detail.promptId) {
                expect(sendSavePrompt).not.toHaveBeenCalled();
                expect(setRuntimeValue).not.toHaveBeenCalledWith(
                    'campaign',
                    'pendingSaveListenerPrompts',
                    expect.any(Array),
                    campaignName,
                );
            } else {
                const conditionCalls = setRuntimeValue.mock.calls.filter(
                    call => call[1] === 'activeConditions' && call[0] === 'PlayerAlly',
                );
                expect(conditionCalls.length).toBe(0);
            }
        });

        it('handles save-result event with missing optional fields using default values', async () => {
            render(<TashasLaughterModal {...makeProps()} />);
            await selectPlayerAndConfirm();

            const savePromptCall = sendSavePrompt.mock.calls[0];
            const promptId = savePromptCall[1].promptId;

            await act(async () => {
                window.dispatchEvent(new CustomEvent('save-result', {
                    detail: {
                        promptId,
                        success: false,
                    },
                }));
            });

            await waitFor(() => {
                const conditionCalls = setRuntimeValue.mock.calls.filter(
                    call => call[1] === 'activeConditions' && call[0] === 'PlayerAlly',
                );
                expect(conditionCalls.length).toBeGreaterThan(0);
            });

            await waitFor(() => {
                const saveEntries = addEntry.mock.calls.filter(
                    call => call[1]?.type === 'save_result' && call[1]?.targetName === 'PlayerAlly' && call[1]?.success === false,
                );
                expect(saveEntries.length).toBeGreaterThan(0);
                expect(saveEntries[0][1].roll).toBe(0);
                expect(saveEntries[0][1].total).toBe(0);
                expect(saveEntries[0][1].saveBonus).toBe(0);
            });
        });

        it('ignores save-result event with null detail', async () => {
            const onClose = vi.fn();
            render(<TashasLaughterModal {...makeProps({ onClose })} />);

            await act(async () => {
                window.dispatchEvent(new CustomEvent('save-result', {
                    detail: null,
                }));
            });

            expect(onClose).not.toHaveBeenCalled();
        });
    });
});
