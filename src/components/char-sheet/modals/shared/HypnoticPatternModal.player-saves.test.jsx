// @improved-by-ai
// @cleaned-by-ai
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

function playerTargetIndex() {
    const labels = document.querySelectorAll('.secondary-target-row');
    for (let i = 0; i < labels.length; i++) {
        if (labels[i].textContent.includes('PlayerAlly')) return i;
    }
    return 2;
}

function selectPlayerAndConfirm() {
    const idx = playerTargetIndex();
    const labels = document.querySelectorAll('.secondary-target-row');
    fireEvent.click(labels[idx]);
    return act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Hypnotic Pattern \(1\)/ }));
    });
}

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

describe('HypnoticPatternModal - Player Saves', () => {
    describe('player save prompt dispatch', () => {
        it('sends save prompt for player targets instead of resolving locally', async () => {
            render(<HypnoticPatternModal {...makeProps()} />);
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
        it('applies charmed, incapacitated, and speed_zero conditions on failed save', async () => {
            render(<HypnoticPatternModal {...makeProps()} />);
            await selectPlayerAndConfirm();
            await triggerSaveResult(false);

            await waitFor(() => {
                const conditionCalls = setRuntimeValue.mock.calls.filter(
                    call => call[1] === 'activeConditions' && call[0] === 'PlayerAlly',
                );
                expect(conditionCalls.length).toBeGreaterThan(0);
                expect(conditionCalls[0][2]).toContain('charmed');
                expect(conditionCalls[0][2]).toContain('incapacitated');
                expect(conditionCalls[0][2]).toContain('speed_zero');
            });
        });

        it('calls addExpiration with all three conditions on failed save', async () => {
            render(<HypnoticPatternModal {...makeProps()} />);
            await selectPlayerAndConfirm();
            await triggerSaveResult(false);

            await waitFor(() => {
                expect(addExpiration).toHaveBeenCalledWith({ attackerName: 'Wizard1', targetName: 'PlayerAlly', effects: [
                        { type: 'charmed', condition: 'charmed' },
                        { type: 'incapacitated', condition: 'incapacitated' },
                        { type: 'speed_zero', condition: 'speed_zero' },
                    ], campaignName });
            });
        });

        it('logs save_result failure entry with roll details and description', async () => {
            render(<HypnoticPatternModal {...makeProps()} />);
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
                expect(saveEntries[0][1].description).toContain('PlayerAlly failed');
                expect(saveEntries[0][1].description).toContain('rolled 7 + 1 = 8');
            });
        });

        it('records addTargetResult with failure and conditions on failed save', async () => {
            render(<HypnoticPatternModal {...makeProps()} />);
            await selectPlayerAndConfirm();
            await triggerSaveResult(false);

            await waitFor(() => {
                const targetResultCalls = addTargetResult.mock.calls.filter(
                    call => call[0] === campaignName && call[1]?.targetName === 'PlayerAlly',
                );
                expect(targetResultCalls.length).toBe(1);
                expect(targetResultCalls[0][1].saveResult).toBe('failure');
                expect(targetResultCalls[0][1].conditions).toEqual(['charmed', 'incapacitated', 'speed_zero']);
            });
        });

        it('closes modal after player save result is processed', async () => {
            const onClose = vi.fn();
            render(<HypnoticPatternModal {...makeProps({ onClose })} />);
            await selectPlayerAndConfirm();
            await triggerSaveResult(false);

            await waitFor(() => {
                expect(onClose).toHaveBeenCalled();
            });
        });
    });

    describe('player save success handling', () => {
        it('logs save_result success entry with description when player passes save', async () => {
            render(<HypnoticPatternModal {...makeProps()} />);
            await selectPlayerAndConfirm();
            await triggerSaveResult(true, { roll: 18, total: 19, saveBonus: 1 });

            await waitFor(() => {
                const saveEntries = addEntry.mock.calls.filter(
                    call => call[1]?.type === 'save_result' && call[1]?.targetName === 'PlayerAlly' && call[1]?.success === true,
                );
                expect(saveEntries.length).toBe(1);
                expect(saveEntries[0][1].description).toContain('PlayerAlly succeeded');
                expect(saveEntries[0][1].description).toContain('rolled 18 + 1 = 19');
            });
        });

        it('records addTargetResult with success and empty conditions on save success', async () => {
            render(<HypnoticPatternModal {...makeProps()} />);
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
            render(<HypnoticPatternModal {...makeProps()} />);
            await selectPlayerAndConfirm();
            await triggerSaveResult(true);

            await waitFor(() => {
                const conditionCalls = setRuntimeValue.mock.calls.filter(
                    call => call[1] === 'activeConditions' && call[0] === 'PlayerAlly',
                );
                expect(conditionCalls.length).toBe(0);
            });
        });

        it('closes modal after player save success is processed', async () => {
            const onClose = vi.fn();
            render(<HypnoticPatternModal {...makeProps({ onClose })} />);
            await selectPlayerAndConfirm();
            await triggerSaveResult(true);

            await waitFor(() => {
                expect(onClose).toHaveBeenCalled();
            });
        });
    });

    describe('save result event edge cases', () => {
        it('ignores save-result event with missing promptId', async () => {
            render(<HypnoticPatternModal {...makeProps()} />);

            await act(async () => {
                window.dispatchEvent(new CustomEvent('save-result', {
                    detail: { success: false },
                }));
            });

            expect(sendSavePrompt).not.toHaveBeenCalled();
        });

        it('ignores save-result event for unknown promptId', async () => {
            render(<HypnoticPatternModal {...makeProps()} />);
            await selectPlayerAndConfirm();

            await act(async () => {
                window.dispatchEvent(new CustomEvent('save-result', {
                    detail: {
                        promptId: 'non-existent-prompt-id',
                        success: false,
                        roll: 5,
                        total: 6,
                        saveBonus: 1,
                    },
                }));
            });
        });

        it('handles save-result event with missing optional fields using defaults', async () => {
            render(<HypnoticPatternModal {...makeProps()} />);
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
                const saveEntries = addEntry.mock.calls.filter(
                    call => call[1]?.type === 'save_result' && call[1]?.targetName === 'PlayerAlly' && call[1]?.success === false,
                );
                expect(saveEntries.length).toBeGreaterThan(0);
                expect(saveEntries[0][1].roll).toBe(0);
            });
        });
    });
});
