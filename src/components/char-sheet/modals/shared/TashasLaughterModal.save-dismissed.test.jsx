// @maintained-by-ai
// TashasLaughterModal — dismiss-softlock regression (save-dismissed sweep
// family, 2026-11-05). The cast parks on pendingPrompts drained only by
// save-result; the GM's un-rolled Dismiss never dispatches one, stranding the
// resolve forever. The lane opts into the promptId-keyed `save-dismissed`
// broadcast: the dismissed target is never made Prone/Incapacitated (neutral —
// a dismissed save is NOT a failed save), a save_dismissed row lands, the
// tally counts it as dismissed (never as "saved"), and the drain-to-empty
// rides finishLaughterResolution's existing close path. Harness mirrors
// TashasLaughterModal.player-saves.test.jsx.
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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
        spellSlotLevel: 1,
        setPopupHtml: vi.fn(),
        onClose: vi.fn(),
        ...overrides,
    };
}

function targetRow(name) {
    const rows = [...document.querySelectorAll('.secondary-target-row')];
    const row = rows.find(r => r.textContent.includes(name));
    if (!row) throw new Error(`target row for ${name} not found`);
    return row;
}

async function armPlayerPrompt(props) {
    render(<TashasLaughterModal {...props} />);
    await act(async () => {
        fireEvent.click(targetRow('PlayerAlly'));
    });
    await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Tasha's Hideous Laughter \(1\)/ }));
    });
    await act(async () => { await new Promise(r => setTimeout(r, 0)); });
    return sendSavePrompt.mock.calls[0][1].promptId;
}

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

describe('TashasLaughterModal — dismissed save prompt', () => {
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

    it('a matching save-dismissed: never Prone/Incapacitated, save_dismissed row, drain-to-close, both listeners detached', async () => {
        const ledger = trackSaveLedger();
        const props = makeProps();
        const promptId = await armPlayerPrompt(props);
        expect(ledger.open).toBe(2);

        await dispatchDismissed(promptId);

        // Neutral: no conditions, no expiration, no fabricated save_result row;
        // the summary popup counts it DISMISSED, never "saved".
        const condWrites = setRuntimeValue.mock.calls.filter(c => c[0] === 'PlayerAlly' && c[1] === 'activeConditions');
        expect(condWrites).toHaveLength(0);
        expect(addExpiration).not.toHaveBeenCalled();
        expect(addTargetResult).not.toHaveBeenCalled();
        expect(addEntry.mock.calls.map(c => c[1]).some(e => e && e.type === 'save_result')).toBe(false);
        expect(automationRows()).toHaveLength(1);
        expect(automationRows()[0]).toMatchObject({
            automationType: 'save_dismissed',
            characterName: 'Wizard1',
            targetName: 'PlayerAlly',
            abilityName: "Tasha's Hideous Laughter",
        });
        await waitFor(() => expect(props.setPopupHtml).toHaveBeenCalledWith(expect.objectContaining({
            description: expect.stringContaining('dismissed'),
        })));
        expect(props.setPopupHtml.mock.calls[0][0].description).not.toMatch(/1 creature\(s\) saved/);

        await waitFor(() => expect(props.onClose).toHaveBeenCalledTimes(1));
        await waitFor(() => expect(ledger.open).toBe(0));
    });

    it('a save-dismissed for a DIFFERENT promptId stays inert (mismatch guard)', async () => {
        const props = makeProps();
        await armPlayerPrompt(props);

        await dispatchDismissed('someone-else-prompt');

        expect(automationRows()).toHaveLength(0);
        expect(props.setPopupHtml).not.toHaveBeenCalled();
        expect(props.onClose).not.toHaveBeenCalled();
    });
});
