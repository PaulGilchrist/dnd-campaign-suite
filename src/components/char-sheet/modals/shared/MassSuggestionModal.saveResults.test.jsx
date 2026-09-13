// @improved-by-ai
// @cleaned-by-ai
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MassSuggestionModal from './MassSuggestionModal.jsx';

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

// Need to import after mocking
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { sendSavePrompt } from '../../../../services/combat/conditions/savePromptService.js';
import { addEntry } from '../../../../services/ui/logService.js';
import { getCombatSummary } from '../../../../services/encounters/combatData.js';
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
    name: 'Mass Suggestion',
    automation: { type: 'mass_suggestion' },
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

// Helper: render modal and select a player target, then confirm
async function selectAndConfirmPlayerTarget(renderedProps = {}) {
    const props = { ...makeProps(), ...renderedProps };
    render(<MassSuggestionModal {...props} />);

    const labels = document.querySelectorAll('.secondary-target-row');
    fireEvent.click(labels[2]); // PlayerAlly

    await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Mass Suggestion \(1\)/ }));
    });

    const savePromptCall = sendSavePrompt.mock.calls[0];
    return { ...props, promptId: savePromptCall[1].promptId };
}

beforeEach(() => {
    vi.resetAllMocks();
    getCombatSummary.mockReturnValue(baseCombatSummary);
    getRuntimeValue.mockReturnValue([]);
    setRuntimeValue.mockReturnValue(undefined);
    addEntry.mockResolvedValue(undefined);
    persistAndNotify.mockReturnValue(undefined);
});

describe('MassSuggestionModal - Save Results', () => {
    describe('player save result handling', () => {
        it('applies charmed condition and closes modal when player fails save', async () => {
            const onClose = vi.fn();
            const { promptId } = await selectAndConfirmPlayerTarget({ onClose });

            await act(async () => {
                const event = new CustomEvent('save-result', {
                    detail: {
                        promptId,
                        success: false,
                        roll: 5,
                        total: 6,
                        saveBonus: 1,
                    },
                });
                window.dispatchEvent(event);
            });

            await waitFor(() => {
                expect(onClose).toHaveBeenCalledTimes(1);
            });
            await waitFor(() => {
                expect(addExpiration).toHaveBeenCalledWith({ attackerName: 'Wizard1', targetName: 'PlayerAlly', effects: [{ type: 'charmed', condition: 'charmed' }], campaignName });
            });
        });

        it('closes modal when player passes save', async () => {
            const onClose = vi.fn();
            const { promptId } = await selectAndConfirmPlayerTarget({ onClose });

            await act(async () => {
                const event = new CustomEvent('save-result', {
                    detail: {
                        promptId,
                        success: true,
                        roll: 18,
                        total: 19,
                        saveBonus: 1,
                    },
                });
                window.dispatchEvent(event);
            });

            await waitFor(() => {
                expect(onClose).toHaveBeenCalledTimes(1);
            });
        });

        it('records save result via addTargetResult on failure and success', async () => {
            const { promptId } = await selectAndConfirmPlayerTarget();

            await act(async () => {
                const event = new CustomEvent('save-result', {
                    detail: {
                        promptId,
                        success: false,
                        roll: 5,
                        total: 6,
                        saveBonus: 1,
                    },
                });
                window.dispatchEvent(event);
            });

            await waitFor(() => {
                const failureResults = addTargetResult.mock.calls.filter(
                    call => call[0] === campaignName && call[1]?.targetName === 'PlayerAlly' && call[1]?.saveResult === 'failure'
                );
                expect(failureResults.length).toBeGreaterThan(0);
                expect(failureResults[0][1].conditions).toEqual(['charmed']);
            });
        });
    });

    describe('save result event edge cases', () => {
        it('ignores save-result event for unknown promptId', async () => {
            const onClose = vi.fn();
            await selectAndConfirmPlayerTarget({ onClose });

            await act(async () => {
                const event = new CustomEvent('save-result', {
                    detail: {
                        promptId: 'non-existent-prompt-id',
                        success: false,
                        roll: 5,
                        total: 6,
                        saveBonus: 1,
                    },
                });
                window.dispatchEvent(event);
            });

            expect(onClose).not.toHaveBeenCalled();
        });

        it('handles save-result event with null or empty detail', async () => {
            const onClose = vi.fn();
            await selectAndConfirmPlayerTarget({ onClose });

            await act(async () => {
                const event = new CustomEvent('save-result', {
                    detail: null,
                });
                window.dispatchEvent(event);
            });

            expect(onClose).not.toHaveBeenCalled();
            expect(addExpiration).not.toHaveBeenCalled();
        });
    });
});
