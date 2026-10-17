// @maintained-by-ai
// Save-result event lane of MassSuggestionModal: how the modal resolves the
// save-result events answering player save prompts (charmed on fail, record
// via addTargetResult, close when all prompts resolve, ignore foreign events).
// Confirm-path/NPC resolution lives in MassSuggestionModal.test.jsx; the
// pay-at-confirm slot lane lives in MassSuggestionModal.pay-at-confirm.test.jsx.
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

// Helper: render modal, select the player target, confirm — returning the props
// and the promptId the modal sent with its save prompt.
async function selectAndConfirmPlayerTarget(renderedProps = {}) {
    const props = { ...makeProps(), ...renderedProps };
    render(<MassSuggestionModal {...props} />);

    fireEvent.click(screen.getByLabelText(/PlayerAlly/));

    await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Mass Suggestion \(1\)/ }));
    });

    const promptId = sendSavePrompt.mock.calls[0][1].promptId;
    return { ...props, promptId };
}

function dispatchSaveResult(detail) {
    return act(async () => {
        window.dispatchEvent(new CustomEvent('save-result', { detail }));
    });
}

function charmedConditionWrites() {
    return setRuntimeValue.mock.calls.filter(
        call => call[0] === 'PlayerAlly' && call[1] === 'activeConditions'
    );
}

function targetResultCalls(saveResult) {
    return addTargetResult.mock.calls.filter(
        call => call[0] === campaignName && call[1]?.targetName === 'PlayerAlly' && call[1]?.saveResult === saveResult
    );
}

beforeEach(() => {
    vi.resetAllMocks();
    getCombatSummary.mockReturnValue(baseCombatSummary);
    getRuntimeValue.mockReturnValue([]);
    setRuntimeValue.mockReturnValue(undefined);
    addEntry.mockResolvedValue(undefined);
    persistAndNotify.mockReturnValue(undefined);
});

describe('MassSuggestionModal - save-result event resolution', () => {
    it('failed player save: applies charmed once, records failure with roll, closes modal', async () => {
        const onClose = vi.fn();
        const { promptId } = await selectAndConfirmPlayerTarget({ onClose });

        await dispatchSaveResult({ promptId, success: false, roll: 5, total: 6, saveBonus: 1 });

        await waitFor(() => {
            expect(onClose).toHaveBeenCalledTimes(1);
        });
        const charmedWrites = charmedConditionWrites();
        expect(charmedWrites).toHaveLength(1);
        expect(charmedWrites[0][2]).toEqual(['charmed']);
        expect(addExpiration).toHaveBeenCalledWith({
            attackerName: 'Wizard1',
            targetName: 'PlayerAlly',
            effects: [{ type: 'charmed', condition: 'charmed' }],
            campaignName,
        });
        const failures = targetResultCalls('failure');
        expect(failures).toHaveLength(1);
        expect(failures[0][1]).toEqual(expect.objectContaining({
            roll: 5,
            total: 6,
            conditions: ['charmed'],
            appliedDamage: 0,
        }));
    });

    it('passed player save: nothing charmed, records success with roll, closes modal', async () => {
        const onClose = vi.fn();
        const { promptId } = await selectAndConfirmPlayerTarget({ onClose });

        await dispatchSaveResult({ promptId, success: true, roll: 18, total: 19, saveBonus: 1 });

        await waitFor(() => {
            expect(onClose).toHaveBeenCalledTimes(1);
        });
        expect(charmedConditionWrites()).toHaveLength(0);
        expect(addExpiration).not.toHaveBeenCalled();
        const successes = targetResultCalls('success');
        expect(successes).toHaveLength(1);
        expect(successes[0][1]).toEqual(expect.objectContaining({
            roll: 18,
            total: 19,
            conditions: [],
            appliedDamage: 0,
        }));
    });

    it.each([
        ['null detail', null],
        ['detail without a promptId', {}],
        ['a foreign promptId', { promptId: 'not-our-prompt-id', success: false, roll: 5, total: 6, saveBonus: 1 }],
    ])('ignores save-result event with %s, yet still resolves its own pending prompt', async (_label, foreignDetail) => {
        const onClose = vi.fn();
        const { promptId } = await selectAndConfirmPlayerTarget({ onClose });

        await dispatchSaveResult(foreignDetail);

        expect(onClose).not.toHaveBeenCalled();
        expect(charmedConditionWrites()).toHaveLength(0);
        expect(addExpiration).not.toHaveBeenCalled();
        expect(targetResultCalls('failure')).toHaveLength(0);
        expect(targetResultCalls('success')).toHaveLength(0);

        // The ignored event must not detach the listener — the real answer still resolves.
        await dispatchSaveResult({ promptId, success: true, roll: 18, total: 19, saveBonus: 1 });

        await waitFor(() => {
            expect(onClose).toHaveBeenCalledTimes(1);
        });
        expect(addExpiration).not.toHaveBeenCalled();
    });
});
