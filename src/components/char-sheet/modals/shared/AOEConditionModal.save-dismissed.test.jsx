// @maintained-by-ai
// AOEConditionModal — dismiss-softlock regression (save-dismissed sweep family,
// 2026-11-05, playbook §66 "Eyebite family / AoE modals need the DivineSpark
// opt-in"). The processing view renders "Waiting for save roll..." rows and
// ONLY shows actions once every pendingPrompt resolves via save-result; the
// GM's un-rolled Dismiss never dispatches one (dismiss doctrine), stranding
// the cast. The selection lane now opts into the promptId-keyed
// `save-dismissed` broadcast: the dismissed target drains with an honest
// neutral "Save dismissed — unaffected" row (no condition applied — a
// dismissed save is NEVER adjudicated as a failed save) + a save_dismissed log
// row, and the drain fires the same ResultsSummaryModal gate. The overlay
// lane shares the SAME handleSaveDismissedCore via the base's new
// handleSaveDismissedOverride (its forwarding is pinned in
// AreaEffectTargetModalBase.save-dismissed.test.jsx). Harness mirrors
// AOEConditionModal.save-flow.test.jsx.
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import AOEConditionModal from './AOEConditionModal.jsx';

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
    addTargetResult: vi.fn(),
}));

vi.mock('./AreaEffectTargetModalBase.utils.jsx', () => ({
    persistAndNotify: vi.fn(),
}));

vi.mock('../../../../services/rules/effects/expirations.js', () => ({
    addExpiration: vi.fn(),
}));

import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { getCombatSummary } from '../../../../services/encounters/combatData.js';
import { persistAndNotify } from './AreaEffectTargetModalBase.utils.jsx';
import { sendSavePrompt } from '../../../../services/combat/conditions/savePromptService.js';
import { addEntry } from '../../../../services/ui/logService.js';
import { addTargetResult } from '../../../../services/automation/common/damageRollback.js';

const campaignName = 'test-campaign';

const basePlayerStats = {
    name: 'Wizard1',
    level: 10,
    proficiency: 4,
    abilities: [{ name: 'Intelligence', bonus: 4 }],
};

const baseAction = { name: 'Blinding Darkness' };

const baseCombatSummary = {
    creatures: [
        { name: 'PlayerAlly', type: 'player', currentHp: 30, maxHp: 30, saveBonuses: { con: 1 } },
    ],
};

const baseEffects = [{ type: 'blinded', condition: 'blinded' }];

function makeProps(overrides = {}) {
    return {
        action: baseAction,
        playerStats: basePlayerStats,
        campaignName,
        saveType: 'CON',
        saveDc: 12,
        effects: baseEffects,
        conditionLabel: 'Blinded',
        onClose: vi.fn(),
        ...overrides,
    };
}

function flush(action) {
    return act(async () => {
        if (action) action();
        await new Promise(resolve => setTimeout(resolve, 0));
    });
}

async function armPlayerPrompt(props) {
    render(<AOEConditionModal {...props} />);
    fireEvent.click(screen.getByRole('checkbox', { name: /PlayerAlly/ }));
    await flush(() => {
        fireEvent.click(screen.getByRole('button', { name: /Blinding Darkness/ }));
    });
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

describe('AOEConditionModal — dismissed save prompt', () => {
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

    it('a matching save-dismissed drains neutral: no condition, save_dismissed row, summary shows "dismissed — unaffected", listeners detached', async () => {
        const ledger = trackSaveLedger();
        const props = makeProps();
        const promptId = await armPlayerPrompt(props);
        expect(ledger.open).toBe(2); // save-result + save-dismissed companions
        // The selection lane opens the Results summary at confirm; nothing has
        // resolved yet — no fabricated rows, nothing applied.
        expect(document.body.textContent).toMatch(/0 targets saved, 0 targets failed/);

        await dispatchDismissed(promptId);

        // Neutral outcome: the target is never Blinded and no save_result /
        // targetResult row is fabricated; exactly one save_dismissed row lands.
        const condWrites = setRuntimeValue.mock.calls.filter(
            c => c[0] === 'PlayerAlly' && c[1] === 'activeConditions'
        );
        expect(condWrites).toHaveLength(0);
        expect(addTargetResult).not.toHaveBeenCalled();
        expect(addEntry.mock.calls.map(c => c[1]).some(e => e && e.type === 'save_result')).toBe(false);
        expect(automationRows()).toHaveLength(1);
        expect(automationRows()[0]).toMatchObject({
            automationType: 'save_dismissed',
            automationDetail: 'save_dismissed',
            characterName: 'Wizard1',
            targetName: 'PlayerAlly',
            saveDc: 12,
            saveType: 'CON',
        });

        // The modal un-strands: the summary lists the honest neutral entry
        // with a working Close.
        expect(document.body.textContent).toMatch(/Save dismissed — unaffected/);
        expect(document.body.textContent).toMatch(/1 dismissed/);
        fireEvent.click(screen.getByRole('button', { name: 'Close' }));
        expect(props.onClose).toHaveBeenCalledTimes(1);

        // Drain-to-empty: pendingPrompts.length effect removed BOTH listeners.
        expect(ledger.open).toBe(0);
    });

    it('a save-dismissed for a DIFFERENT promptId stays inert (mismatch guard)', async () => {
        const props = makeProps();
        await armPlayerPrompt(props);

        await dispatchDismissed('someone-else-prompt');

        expect(automationRows()).toHaveLength(0);
        expect(document.body.textContent).not.toMatch(/dismissed/i);
        expect(props.onClose).not.toHaveBeenCalled();
    });

    it('a resolved save-result drains fully too: a trailing save-dismissed cannot log a phantom refusal', async () => {
        const promptId = await armPlayerPrompt(makeProps());

        await act(async () => {
            window.dispatchEvent(new CustomEvent('save-result', { detail: { promptId, success: true, roll: 15, total: 16, saveBonus: 1 } }));
            await new Promise(r => setTimeout(r, 0));
        });

        await dispatchDismissed(promptId);

        expect(automationRows()).toHaveLength(0);
        expect(document.body.textContent).toMatch(/Saved — unaffected/);
    });
});
