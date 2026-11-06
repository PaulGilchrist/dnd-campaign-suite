// @maintained-by-ai
// CalmEmotionsModal — dismiss-softlock regression (save-dismissed sweep family,
// 2026-11-05). The cast parks on pendingPrompts drained only by save-result;
// the GM's un-rolled Dismiss never dispatches one, stranding the resolve. The
// lane opts into the promptId-keyed `save-dismissed` broadcast: the dismissed
// target gains NEITHER immunity nor indifference (neutral — never adjudicated
// as a failed save), a save_dismissed row lands, and the drain rides the
// existing dropPendingPrompt close path. Harness mirrors
// CalmEmotionsModal.cast-flow.test.jsx.
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import CalmEmotionsModal from './CalmEmotionsModal.jsx';

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
    getAllyList: vi.fn(() => null),
}));

vi.mock('../../../../services/automation/common/damageRollback.js', () => ({
    storeSpellLastAttack: vi.fn(),
    addTargetResult: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('./AreaEffectTargetModalBase.utils.jsx', () => ({
    persistAndNotify: vi.fn(),
}));

vi.mock('../../../../services/automation/handlers/spells/calmEmotionsHandler.js', () => ({
    applyCalmEmotionsImmunity: vi.fn().mockResolvedValue(undefined),
    applyCalmEmotionsIndifferent: vi.fn().mockResolvedValue(undefined),
    resolveCalmEmotionsEligibility: vi.fn().mockImplementation(async ({ creatures }) => ({
        eligible: (creatures || []).map(c => c.name),
        ineligible: [],
        advisory: [],
    })),
    logCalmEmotionsEligibility: vi.fn().mockResolvedValue(undefined),
    registerCalmEmotionsExpiration: vi.fn(),
    handle: vi.fn(),
}));

import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { getCombatSummary } from '../../../../services/encounters/combatData.js';
import { persistAndNotify } from './AreaEffectTargetModalBase.utils.jsx';
import { sendSavePrompt } from '../../../../services/combat/conditions/savePromptService.js';
import { addEntry } from '../../../../services/ui/logService.js';
import { addTargetResult } from '../../../../services/automation/common/damageRollback.js';
import { resolveCalmEmotionsEligibility, logCalmEmotionsEligibility } from '../../../../services/automation/handlers/spells/calmEmotionsHandler.js';
import { applyCalmEmotionsImmunity, applyCalmEmotionsIndifferent } from '../../../../services/automation/handlers/spells/calmEmotionsHandler.js';

const campaignName = 'test-campaign';

const basePlayerStats = {
    name: 'Wizard1',
    level: 10,
    proficiency: 4,
    abilities: [{ name: 'Intelligence', bonus: 4 }],
};

const baseAction = { name: 'Calm Emotions', automation: { type: 'calm_emotions' } };

const baseCombatSummary = {
    creatures: [
        { name: 'PlayerAlly', type: 'player', currentHp: 30, maxHp: 30, saveBonuses: { cha: 1 } },
    ],
};

function makeProps(overrides = {}) {
    return {
        action: baseAction,
        playerStats: basePlayerStats,
        campaignName,
        saveType: 'CHA',
        saveDc: 14,
        onClose: vi.fn(),
        ...overrides,
    };
}

async function armPlayerPrompt(props) {
    render(<CalmEmotionsModal {...props} />);
    await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Cast Calm Emotions \(\d+\)/ }));
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

describe('CalmEmotionsModal — dismissed save prompt', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        getCombatSummary.mockReturnValue(baseCombatSummary);
        getRuntimeValue.mockReturnValue([]);
        setRuntimeValue.mockReturnValue(undefined);
        addEntry.mockResolvedValue(undefined);
        persistAndNotify.mockReturnValue(undefined);
        resolveCalmEmotionsEligibility.mockImplementation(async ({ creatures }) => ({
            eligible: (creatures || []).map(c => c.name),
            ineligible: [],
            advisory: [],
        }));
        logCalmEmotionsEligibility.mockResolvedValue(undefined);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('a matching save-dismissed: no immunity/indifference, save_dismissed row, drain-to-close, both listeners detached', async () => {
        const ledger = trackSaveLedger();
        const props = makeProps();
        const promptId = await armPlayerPrompt(props);
        expect(ledger.open).toBe(2);

        await dispatchDismissed(promptId);

        // Neutral: nothing registered against the target, no fabricated save_result.
        expect(applyCalmEmotionsImmunity).not.toHaveBeenCalled();
        expect(applyCalmEmotionsIndifferent).not.toHaveBeenCalled();
        expect(addTargetResult).not.toHaveBeenCalled();
        expect(addEntry.mock.calls.map(c => c[1]).some(e => e && e.type === 'save_result')).toBe(false);
        expect(automationRows()).toHaveLength(1);
        expect(automationRows()[0]).toMatchObject({
            automationType: 'save_dismissed',
            characterName: 'Wizard1',
            targetName: 'PlayerAlly',
            abilityName: 'Calm Emotions',
        });

        await waitFor(() => expect(props.onClose).toHaveBeenCalledTimes(1));
        await waitFor(() => expect(ledger.open).toBe(0));
    });

    it('a save-dismissed for a DIFFERENT promptId stays inert (mismatch guard)', async () => {
        const props = makeProps();
        await armPlayerPrompt(props);

        await dispatchDismissed('someone-else-prompt');

        expect(automationRows()).toHaveLength(0);
        expect(props.onClose).not.toHaveBeenCalled();
    });
});
