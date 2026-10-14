import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import EyebiteEffectModal from './EyebiteEffectModal.jsx';

vi.mock('./shared/SecondaryTargetModal.jsx', () => {
    return {
        default: vi.fn(({ title, targets, onTargetSelected, onSkip, description, confirmLabel, confirmIcon }) => {
            const firstTargetName = targets.length > 0 ? (targets[0].name || targets[0].value) : null;
            return (
                <div data-testid="secondary-target-modal">
                    <span data-testid="stm-title">{title}</span>
                    <span data-testid="stm-icon">{confirmIcon}</span>
                    <span data-testid="stm-description">{description}</span>
                    <span data-testid="stm-confirmLabel">{confirmLabel}</span>
                    <span data-testid="stm-targetCount">{targets.length}</span>
                    <button
                        onClick={() => onTargetSelected(firstTargetName)}
                        data-testid="stm-confirm"
                        type="button"
                    >
                        {confirmLabel}
                    </button>
                    <button onClick={onSkip} data-testid="stm-skip" type="button">
                        Skip
                    </button>
                    {targets.map((t, i) => (
                        <span key={i} data-testid={`stm-target-${i}`}>{t.name || t.value}</span>
                    ))}
                </div>
            );
        }),
    };
});

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(() => null),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../../services/rules/effects/expirations.js', () => ({
    addExpiration: vi.fn(),
}));

vi.mock('../../../services/dice/diceRoller.js', () => ({
    rollD20: vi.fn(() => 15),
}));

vi.mock('../../../services/combat/automation/automationService.js', () => ({
    playerIsImmuneToCondition: vi.fn(() => false),
}));

vi.mock('../../../services/ui/utils.js', () => ({
    default: {
        getName: (name) => name,
        guid: vi.fn(() => 'test-guid-123'),
    },
}));

vi.mock('../../../services/ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../services/combat/conditions/savePromptService.js', () => ({
    sendSavePrompt: vi.fn(),
    sendSaveResult: vi.fn(),
}));

vi.mock('../../../services/automation/common/damageRollback.js', () => ({
    storeSpellLastAttack: vi.fn(),
    addTargetResult: vi.fn(),
}));

import * as runtimeState from '../../../hooks/runtime/useRuntimeState.js';
import * as automationService from '../../../services/combat/automation/automationService.js';
import * as logService from '../../../services/ui/logService.js';
import * as savePromptService from '../../../services/combat/conditions/savePromptService.js';
import * as damageRollback from '../../../services/automation/common/damageRollback.js';

const baseProps = {
    combatSummary: {
        creatures: [
            { name: 'Goblin1', type: 'npc', saveBonuses: { wis: 2, dex: 0 } },
            { name: 'Orc Warrior', type: 'npc', saveBonuses: { wis: 4, dex: 2 } },
            { name: 'Elf Mage', type: 'player', saveBonuses: { wis: 1, dex: 3 } },
        ],
    },
    attackerName: 'Witch1',
    saveDc: 13,
    campaignName: 'test-campaign',
    onClose: vi.fn(),
    characters: [],
    featureName: 'Eyebite',
    rangeFeet: 60,
};

function makeProps(overrides) {
    return { ...baseProps, ...(overrides || {}) };
}

/**
 * Renders EyebiteEffectModal for a player target and advances to the
 * save-prompt stage (select effect → confirm target). Returns the render
 * result so callers can dispatch save-result events and assert on UI.
 */
function renderPlayerModal(propsOverride = {}) {
    const renderResult = render(<EyebiteEffectModal {...makeProps(propsOverride)} />);
    fireEvent.click(screen.getByRole('button', { name: /Asleep/ }));
    act(() => {
        fireEvent.click(screen.getByTestId('stm-confirm'));
    });
    return renderResult;
}

describe('EyebiteEffectModal - Player save', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        automationService.playerIsImmuneToCondition.mockReturnValue(false);
    });

    describe('sending save prompt', () => {
        it('sends save prompt for player targets', async () => {
            renderPlayerModal({
                combatSummary: {
                    creatures: [
                        { name: 'Elf Mage', type: 'player', saveBonuses: { wis: 1 } },
                    ],
                },
            });
            await waitFor(() => {
                expect(savePromptService.sendSavePrompt).toHaveBeenCalled();
            });
            const promptCall = savePromptService.sendSavePrompt.mock.calls[0][1];
            expect(promptCall.targetName).toBe('Elf Mage');
            expect(promptCall.saveType).toBe('WIS');
            expect(promptCall.saveDc).toBe(13);
            expect(promptCall.sourceName).toBe('Witch1');
        });

        it('does not send save prompt for immune player targets', async () => {
            automationService.playerIsImmuneToCondition.mockReturnValue(true);
            renderPlayerModal({
                combatSummary: {
                    creatures: [
                        { name: 'Elf Mage', type: 'player', saveBonuses: { wis: 1 } },
                    ],
                },
            });
            await waitFor(() => {
                expect(screen.getByText(/Elf Mage/)).toBeInTheDocument();
            });
            expect(savePromptService.sendSavePrompt).not.toHaveBeenCalled();
        });
    });

    describe('save-result event handling', () => {
        function dispatchSaveResult(detail) {
            act(() => {
                window.dispatchEvent(new CustomEvent('save-result', { detail }));
            });
        }

        it('applies condition, targetEffect, and logging when player fails save', async () => {
            renderPlayerModal({
                combatSummary: {
                    creatures: [
                        { name: 'Elf Mage', type: 'player', saveBonuses: { wis: 1 } },
                    ],
                },
            });
            await waitFor(() => {
                expect(savePromptService.sendSavePrompt).toHaveBeenCalled();
            });
            dispatchSaveResult({
                promptId: 'test-guid-123',
                success: false,
                roll: 5,
                total: 6,
            });
            await waitFor(() => {
                expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                    'Elf Mage',
                    'activeConditions',
                    expect.arrayContaining(['unconscious']),
                    'test-campaign'
                );
                const targetEffectsCall = runtimeState.setRuntimeValue.mock.calls.find(
                    c => c[0] === 'campaign' && c[1] === 'targetEffects'
                );
                expect(targetEffectsCall).toBeDefined();
                const effects = targetEffectsCall[2];
                expect(effects).toContainEqual(
                    expect.objectContaining({
                        target: 'Elf Mage',
                        effect: 'eyebite_asleep',
                        source: 'Witch1',
                        condition: 'unconscious',
                        duration: 'concentration',
                    })
                );
                expect(damageRollback.addTargetResult).toHaveBeenCalledWith(
                    'test-campaign',
                    expect.objectContaining({
                        targetName: 'Elf Mage',
                        saveResult: 'failure',
                        roll: 5,
                        total: 6,
                        conditions: ['unconscious'],
                    })
                );
                const saveResultCalls = logService.addEntry.mock.calls.filter(
                    c => c[1].type === 'save_result' && c[1].targetName === 'Elf Mage'
                );
                expect(saveResultCalls.length).toBeGreaterThan(0);
                const conditionCalls = logService.addEntry.mock.calls.filter(
                    c => c[1].type === 'condition'
                );
                expect(conditionCalls.length).toBeGreaterThan(0);
            });
        });

        it('shows popup on player save failure', async () => {
            renderPlayerModal({
                combatSummary: {
                    creatures: [
                        { name: 'Elf Mage', type: 'player', saveBonuses: { wis: 1 } },
                    ],
                },
            });
            await waitFor(() => {
                expect(savePromptService.sendSavePrompt).toHaveBeenCalled();
            });
            dispatchSaveResult({
                promptId: 'test-guid-123',
                success: false,
                roll: 5,
                total: 6,
            });
            await waitFor(() => {
                expect(screen.getByText(/Elf Mage/)).toBeInTheDocument();
                expect(screen.getByText(/Unconscious/)).toBeInTheDocument();
                expect(screen.getByText(/failed on WIS save/)).toBeInTheDocument();
            });
        });

        it('calls addTargetResult and logs when player succeeds save', async () => {
            renderPlayerModal({
                combatSummary: {
                    creatures: [
                        { name: 'Elf Mage', type: 'player', saveBonuses: { wis: 1 } },
                    ],
                },
            });
            await waitFor(() => {
                expect(savePromptService.sendSavePrompt).toHaveBeenCalled();
            });
            dispatchSaveResult({
                promptId: 'test-guid-123',
                success: true,
                roll: 12,
                total: 13,
            });
            await waitFor(() => {
                expect(damageRollback.addTargetResult).toHaveBeenCalledWith(
                    'test-campaign',
                    expect.objectContaining({
                        targetName: 'Elf Mage',
                        saveResult: 'success',
                        conditions: [],
                    })
                );
                const saveResultCalls = logService.addEntry.mock.calls.filter(
                    c => c[1].type === 'save_result' && c[1].targetName === 'Elf Mage'
                );
                expect(saveResultCalls.length).toBeGreaterThan(0);
                expect(saveResultCalls[saveResultCalls.length - 1][1]).toEqual(
                    expect.objectContaining({
                        targetName: 'Elf Mage',
                        success: true,
                    })
                );
            });
        });

        it('shows popup on player save success', async () => {
            renderPlayerModal({
                combatSummary: {
                    creatures: [
                        { name: 'Elf Mage', type: 'player', saveBonuses: { wis: 1 } },
                    ],
                },
            });
            await waitFor(() => {
                expect(savePromptService.sendSavePrompt).toHaveBeenCalled();
            });
            dispatchSaveResult({
                promptId: 'test-guid-123',
                success: true,
                roll: 12,
                total: 13,
            });
            await waitFor(() => {
                expect(screen.getByText(/Elf Mage/)).toBeInTheDocument();
                expect(screen.getByText(/succeeded on WIS save/)).toBeInTheDocument();
            });
        });

        it('does nothing when save-result detail is null', async () => {
            renderPlayerModal({
                combatSummary: {
                    creatures: [
                        { name: 'Elf Mage', type: 'player', saveBonuses: { wis: 1 } },
                    ],
                },
            });
            await waitFor(() => {
                expect(savePromptService.sendSavePrompt).toHaveBeenCalled();
            });
            dispatchSaveResult(null);
            const conditionCalls = runtimeState.setRuntimeValue.mock.calls.filter(
                c => c[0] === 'Elf Mage' && c[1] === 'activeConditions'
            );
            expect(conditionCalls.length).toBe(0);
        });

        it('does nothing when save-result detail has no promptId', async () => {
            renderPlayerModal({
                combatSummary: {
                    creatures: [
                        { name: 'Elf Mage', type: 'player', saveBonuses: { wis: 1 } },
                    ],
                },
            });
            await waitFor(() => {
                expect(savePromptService.sendSavePrompt).toHaveBeenCalled();
            });
            dispatchSaveResult({ success: false, roll: 1, total: 1 });
            const conditionCalls = runtimeState.setRuntimeValue.mock.calls.filter(
                c => c[0] === 'Elf Mage' && c[1] === 'activeConditions'
            );
            expect(conditionCalls.length).toBe(0);
        });

        it('does nothing when save-result has unknown promptId', async () => {
            renderPlayerModal({
                combatSummary: {
                    creatures: [
                        { name: 'Elf Mage', type: 'player', saveBonuses: { wis: 1 } },
                    ],
                },
            });
            await waitFor(() => {
                expect(savePromptService.sendSavePrompt).toHaveBeenCalled();
            });
            dispatchSaveResult({
                promptId: 'nonexistent-guid',
                success: false,
                roll: 1,
                total: 1,
            });
            await waitFor(() => {
                expect(screen.queryByRole('button', { name: 'Done' })).not.toBeInTheDocument();
            });
        });

        it('handles missing roll/total with defaults on save result', async () => {
            renderPlayerModal({
                combatSummary: {
                    creatures: [
                        { name: 'Elf Mage', type: 'player', saveBonuses: { wis: 1 } },
                    ],
                },
            });
            await waitFor(() => {
                expect(savePromptService.sendSavePrompt).toHaveBeenCalled();
            });
            dispatchSaveResult({
                promptId: 'test-guid-123',
                success: false,
            });
            await waitFor(() => {
                expect(damageRollback.addTargetResult).toHaveBeenCalledWith(
                    'test-campaign',
                    expect.objectContaining({
                        targetName: 'Elf Mage',
                        saveResult: 'failure',
                        roll: 0,
                        total: 0,
                    })
                );
            });
        });

        it('calls onClose when Done is clicked after player save result', async () => {
            renderPlayerModal({
                combatSummary: {
                    creatures: [
                        { name: 'Elf Mage', type: 'player', saveBonuses: { wis: 1 } },
                    ],
                },
            });
            await waitFor(() => {
                expect(savePromptService.sendSavePrompt).toHaveBeenCalled();
            });
            dispatchSaveResult({
                promptId: 'test-guid-123',
                success: false,
                roll: 5,
                total: 6,
            });
            await waitFor(() => {
                expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
            });
            fireEvent.click(screen.getByRole('button', { name: 'Done' }));
            expect(baseProps.onClose).toHaveBeenCalled();
        });
    });
});
