// @maintained-by-ai
// MassSuggestionModal — dismiss-softlock regression (save-dismissed sweep
// family, 2026-11-05, playbook §66). The modal parks its cast on pendingPrompts
// drained solely by save-result; the GM's un-rolled Dismiss never dispatches
// one (dismiss doctrine), which used to strand the cast mid-resolve forever.
// The lane now opts into the promptId-keyed `save-dismissed` broadcast: the
// dismissed target is simply NOT charmed (neutral — never treated as a failed
// save), a save_dismissed log row lands, and the drain-to-empty rides the
// same 500ms close path as a resolved save. Harness mirrors
// MassSuggestionModal.saveResults.test.jsx.
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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

async function selectAndConfirmPlayerTarget(renderedProps = {}) {
    const props = { ...makeProps(), ...renderedProps };
    render(<MassSuggestionModal {...props} />);
    fireEvent.click(screen.getByLabelText(/PlayerAlly/));
    await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Mass Suggestion \(1\)/ }));
    });
    // Flush the listener-registration effect before dispatching.
    await act(async () => { await new Promise(r => setTimeout(r, 0)); });
    return sendSavePrompt.mock.calls[0][1].promptId;
}

// Listener ledger for the modal's own save buses.
function trackSaveLedger() {
    const ledger = { open: 0 };
    const realAdd = window.addEventListener.bind(window);
    const realRemove = window.removeEventListener.bind(window);
    vi.spyOn(window, 'addEventListener').mockImplementation((type, fn, opts) => {
        if (type === 'save-result' || type === 'save-dismissed') ledger.open += 1;
        return realAdd(type, fn, opts);
    });
    vi.spyOn(window, 'removeEventListener').mockImplementation((type, fn, opts) => {
        if (type === 'save-result' || type === 'save-dismissed') ledger.open -= 1;
        return realRemove(type, fn, opts);
    });
    return ledger;
}

const dispatchDismissed = (promptId) => act(async () => {
    window.dispatchEvent(new CustomEvent('save-dismissed', { detail: { promptId } }));
    await new Promise(r => setTimeout(r, 0));
});

const automationRows = () => addEntry.mock.calls.map(c => c[1]).filter(e => e && e.type === 'automation');

describe('MassSuggestionModal — dismissed save prompt', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        getCombatSummary.mockReturnValue(baseCombatSummary);
        getRuntimeValue.mockReturnValue([]);
        setRuntimeValue.mockReturnValue(undefined);
        addEntry.mockResolvedValue(undefined);
        persistAndNotify.mockReturnValue(undefined);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('a matching save-dismissed: no charm, save_dismissed row, drain-to-close, both listeners detached', async () => {
        const ledger = trackSaveLedger();
        const onClose = vi.fn();
        const promptId = await selectAndConfirmPlayerTarget({ onClose });
        expect(ledger.open).toBe(2); // save-result + save-dismissed companions

        await dispatchDismissed(promptId);

        // Neutral outcome: the target is never charmed and no save_result row
        // is fabricated; the campaign log carries exactly one save_dismissed row.
        const charmedWrites = setRuntimeValue.mock.calls.filter(
            c => c[0] === 'PlayerAlly' && c[1] === 'activeConditions'
        );
        expect(charmedWrites).toHaveLength(0);
        expect(addExpiration).not.toHaveBeenCalled();
        expect(addTargetResult).not.toHaveBeenCalled();
        expect(addEntry.mock.calls.map(c => c[1]).some(e => e && e.type === 'save_result')).toBe(false);
        expect(automationRows()).toHaveLength(1);
        expect(automationRows()[0]).toMatchObject({
            automationType: 'save_dismissed',
            characterName: 'Wizard1',
            targetName: 'PlayerAlly',
            abilityName: 'Mass Suggestion',
        });

        // Drain-to-empty closes via the same deferred path as a resolved save.
        await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
        await waitFor(() => expect(ledger.open).toBe(0)); // effect cleanup removed BOTH
    });

    it('a save-dismissed for a DIFFERENT promptId stays inert (mismatch guard)', async () => {
        const onClose = vi.fn();
        await selectAndConfirmPlayerTarget({ onClose });

        await dispatchDismissed('someone-else-prompt');

        expect(automationRows()).toHaveLength(0);
        expect(onClose).not.toHaveBeenCalled();
    });

    it('a resolved save-result also tears down the dismissed companion (pending drains to close)', async () => {
        const ledger = trackSaveLedger();
        const onClose = vi.fn();
        const promptId = await selectAndConfirmPlayerTarget({ onClose });

        await act(async () => {
            window.dispatchEvent(new CustomEvent('save-result', { detail: { promptId, success: true, roll: 15, total: 16, saveBonus: 1 } }));
            await new Promise(r => setTimeout(r, 0));
        });

        await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
        await waitFor(() => expect(ledger.open).toBe(0));
    });
});
