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
    addTargetResult: vi.fn(),
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
import { getCombatSummary } from '../../../../services/encounters/combatData.js';
import { getAllyList } from '../../../../hooks/useAllySelection.js';
import { addExpiration } from '../../../../services/rules/effects/expirations.js';
import { addEntry } from '../../../../services/ui/logService.js';

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

function selectAndConfirm(targetIndex, targetCount) {
    const labels = document.querySelectorAll('.secondary-target-row');
    fireEvent.click(labels[targetIndex]);
    return act(async () => {
        fireEvent.click(screen.getByRole('button', { name: new RegExp(`Hypnotic Pattern \\(${targetCount}\\)`) }));
    });
}

beforeEach(() => {
    vi.resetAllMocks();
    getCombatSummary.mockReturnValue(baseCombatSummary);
    getRuntimeValue.mockReturnValue([]);
    setRuntimeValue.mockReturnValue(undefined);
    addEntry.mockResolvedValue(undefined);
    getAllyList.mockReturnValue(null);
});

describe('HypnoticPatternModal - NPC Saves', () => {
    describe('NPC save resolution', () => {
        function setupNpcSave() {
            getRuntimeValue.mockReturnValue([]);
            vi.spyOn(Math, 'random').mockReturnValue(0.01);
            render(<HypnoticPatternModal {...makeProps()} />);
            return selectAndConfirm(0, 1);
        }

        it('applies charmed, incapacitated, and speed_zero conditions on failed NPC save', async () => {
            await setupNpcSave();

            await waitFor(() => {
                const conditionCalls = setRuntimeValue.mock.calls.filter(
                    call => call[1] === 'activeConditions' && call[0] === 'Goblin'
                );
                expect(conditionCalls.length).toBeGreaterThan(0);
                expect(conditionCalls[0][2]).toContain('charmed');
                expect(conditionCalls[0][2]).toContain('incapacitated');
                expect(conditionCalls[0][2]).toContain('speed_zero');
            });
        });

        it('calls addExpiration with all three conditions', async () => {
            await setupNpcSave();

            await waitFor(() => {
                expect(addExpiration).toHaveBeenCalledWith({ attackerName: 'Wizard1', targetName: 'Goblin', effects: [
                        { type: 'charmed', condition: 'charmed' },
                        { type: 'incapacitated', condition: 'incapacitated' },
                        { type: 'speed_zero', condition: 'speed_zero' },
                    ], campaignName });
            });
        });
    });

    describe('successful NPC save', () => {
        it('does not apply conditions when NPC passes save', async () => {
            getRuntimeValue.mockReturnValue([]);
            vi.spyOn(Math, 'random').mockReturnValue(0.99);

            render(<HypnoticPatternModal {...makeProps()} />);
            await selectAndConfirm(0, 1);

            await waitFor(() => {
                const conditionCalls = setRuntimeValue.mock.calls.filter(
                    call => call[1] === 'activeConditions' && call[0] === 'Goblin'
                );
                expect(conditionCalls.length).toBe(0);
            });
        });
    });

    describe('multiple targets', () => {
        it('applies conditions to all selected NPC targets', async () => {
            getRuntimeValue.mockReturnValue([]);
            vi.spyOn(Math, 'random').mockReturnValue(0.01);

            render(<HypnoticPatternModal {...makeProps()} />);
            const labels = document.querySelectorAll('.secondary-target-row');
            await act(async () => { fireEvent.click(labels[0]); });
            await act(async () => { fireEvent.click(labels[1]); });
            await waitFor(() => {
                expect(screen.getByRole('button', { name: /Hypnotic Pattern \(2\)/ })).toBeInTheDocument();
            });
            await act(async () => {
                fireEvent.click(screen.getByRole('button', { name: /Hypnotic Pattern \(2\)/ }));
            });

            await waitFor(() => {
                const goblinConditions = setRuntimeValue.mock.calls.filter(
                    call => call[1] === 'activeConditions' && call[0] === 'Goblin'
                );
                expect(goblinConditions.length).toBeGreaterThan(0);
                expect(goblinConditions[0][2]).toContain('charmed');

                const orcConditions = setRuntimeValue.mock.calls.filter(
                    call => call[1] === 'activeConditions' && call[0] === 'Orc'
                );
                expect(orcConditions.length).toBeGreaterThan(0);
                expect(orcConditions[0][2]).toContain('charmed');
            });
        });
    });

    describe('creature not found in combat summary', () => {
        it('does not apply conditions when confirm button shows zero targets', async () => {
            getRuntimeValue.mockReturnValue([]);
            getCombatSummary.mockReturnValue({ creatures: [] });

            render(<HypnoticPatternModal {...makeProps()} />);
            const confirmButton = screen.getByRole('button', { name: /Hypnotic Pattern \(0\)/ });
            expect(confirmButton).toBeDisabled();
        });
    });
});
