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

import { setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { sendSavePrompt } from '../../../../services/combat/conditions/savePromptService.js';
import { getCombatSummary } from '../../../../services/encounters/combatData.js';
import { getAllyList } from '../../../../hooks/useAllySelection.js';
import { addTargetResult } from '../../../../services/automation/common/damageRollback.js';
import { addEntry } from '../../../../services/ui/logService.js';
import { addExpiration } from '../../../../services/rules/effects/expirations.js';

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

beforeEach(() => {
    vi.resetAllMocks();
    getCombatSummary.mockReturnValue(baseCombatSummary);
    setRuntimeValue.mockReturnValue(undefined);
    addEntry.mockResolvedValue(undefined);
    getAllyList.mockReturnValue(null);
});

describe('HypnoticPatternModal - Metamagic', () => {
    describe('metamagic heighten rendering', () => {
        it('shows heighten note in description when metamagicHeighten is true', () => {
            const { container } = render(<HypnoticPatternModal {...makeProps({ metamagicHeighten: true })} />);
            const noteEl = container.querySelector('.sp-note');
            expect(noteEl.textContent).toContain('Heightened Spell');
            expect(noteEl.textContent).toContain('one target will have disadvantage');
        });
    });

    describe('metamagic careful rendering', () => {
        it('shows careful spell protection badge on ally targets when metamagicCareful is true', () => {
            getAllyList.mockReturnValue(['PlayerAlly']);
            render(<HypnoticPatternModal {...makeProps({ metamagicCareful: true })} />);
            const rows = document.querySelectorAll('.secondary-target-row');
            const playerRow = [...rows].find(row => row.textContent.includes('PlayerAlly'));
            expect(playerRow.textContent).toContain('Careful Spell protected');
        });

        it('does not show careful spell protection badge for non-ally targets', () => {
            getAllyList.mockReturnValue(['OtherAlly']);
            render(<HypnoticPatternModal {...makeProps({ metamagicCareful: true })} />);
            const rows = document.querySelectorAll('.secondary-target-row');
            const playerRow = [...rows].find(row => row.textContent.includes('PlayerAlly'));
            expect(playerRow.textContent).not.toContain('Careful Spell protected');
        });
    });

    describe('careful spell protection for NPCs', () => {
        it('automatically succeeds for careful spell protected NPCs: no conditions, no expiration, logged success with Careful Spell message, and recorded in targetResult', async () => {
            getAllyList.mockReturnValue(['Goblin']);
            render(<HypnoticPatternModal {...makeProps({ metamagicCareful: true })} />);
            const labels = document.querySelectorAll('.secondary-target-row');
            fireEvent.click(labels[0]);
            await act(async () => {
                fireEvent.click(screen.getByRole('button', { name: /Hypnotic Pattern \(1\)/ }));
            });

            await waitFor(() => {
                const conditionCalls = setRuntimeValue.mock.calls.filter(
                    call => call[1] === 'activeConditions' && call[0] === 'Goblin'
                );
                expect(conditionCalls.length).toBe(0);
                expect(addExpiration).not.toHaveBeenCalled();

                const saveEntries = addEntry.mock.calls.filter(
                    call => call[1]?.type === 'save_result' && call[1]?.targetName === 'Goblin'
                );
                expect(saveEntries.length).toBe(1);
                expect(saveEntries[0][1].success).toBe(true);
                expect(saveEntries[0][1].description).toContain('Careful Spell protected');

                const targetResultCalls = addTargetResult.mock.calls.filter(
                    call => call[0] === campaignName && call[1]?.targetName === 'Goblin'
                );
                expect(targetResultCalls.length).toBe(1);
                expect(targetResultCalls[0][1].saveResult).toBe('success');
                expect(targetResultCalls[0][1].conditions).toEqual([]);
            });
        });
    });

    describe('careful spell protection for players', () => {
        it('skips the entire save flow for careful spell protected player targets: no prompt, no pending prompts, no save_result log', async () => {
            getAllyList.mockReturnValue(['PlayerAlly']);
            render(<HypnoticPatternModal {...makeProps({ metamagicCareful: true })} />);
            const labels = document.querySelectorAll('.secondary-target-row');
            fireEvent.click(labels[2]);
            await act(async () => {
                fireEvent.click(screen.getByRole('button', { name: /Hypnotic Pattern \(1\)/ }));
            });

            expect(sendSavePrompt).not.toHaveBeenCalled();
            expect(setRuntimeValue).not.toHaveBeenCalledWith(
                'campaign',
                'pendingSaveListenerPrompts',
                expect.any(Array),
                campaignName,
            );
            const saveEntries = addEntry.mock.calls.filter(
                call => call[1]?.type === 'save_result' && call[1]?.targetName === 'PlayerAlly'
            );
            expect(saveEntries.length).toBe(0);
        });
    });

});
