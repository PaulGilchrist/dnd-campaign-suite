// @maintained-by-ai
// StepsOfTheFeyTauntModal — dismiss-softlock regression (save-dismissed sweep
// family, 2026-11-05). Both save lanes (Taunting + Dreadful) park the modal on
// Promise.all(waitForSaveResult); the GM's un-rolled Dismiss on a queued
// prompt never dispatches save-result (dismiss doctrine — a dismissed save
// never resolves), which used to strand the modal mid-cast forever. The queue
// now broadcasts a promptId-keyed `save-dismissed` and waitForSaveResult opts
// in: the dismissed target resolves NEUTRAL (unaffected — NOT a failure, no
// condition/damage) with an honest save_dismissed log row, both window
// listeners detach, and the lane finishes to the Done view.
// Harness mirrors StepsOfTheFeyTauntModal.tauntingStep.test.jsx but with a
// LISTENER-FREE createSaveListener mock so the ledger below counts only the
// modal's own handlers (saveOnlyHandler.dismiss.test.js recipe). Unique
// promptIds per mint (playbook §66 test doctrine).
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import StepsOfTheFeyTauntModal from './StepsOfTheFeyTauntModal.jsx';
import { createSaveListener, logSaveDismissed } from '../../../services/automation/common/savePrompt.js';

const { promptState, store } = vi.hoisted(() => ({
    promptState: { n: 0 },
    store: { targetEffects: [] },
}));

vi.mock('../../../services/automation/common/savePrompt.js', () => ({
    createSaveListener: vi.fn(() => ({ promptId: `feey-dismiss-prompt-${++promptState.n}` })),
    logSaveDismissed: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../services/ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../services/rules/effects/expirations.js', () => ({
    addExpiration: vi.fn(),
}));

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn((characterKey, key) =>
        characterKey === 'campaign' && key === 'targetEffects' ? store.targetEffects : undefined),
    setRuntimeValue: vi.fn((characterKey, key, value) => {
        if (characterKey === 'campaign' && key === 'targetEffects') store.targetEffects = value;
        return Promise.resolve();
    }),
}));

vi.mock('../../../services/automation/handlers/buffs/tempHpService.js', () => ({
    setTempHp: vi.fn(),
}));

vi.mock('../../../services/rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(() => Promise.resolve({ creatures: [] })),
    getTargetFromAttacker: vi.fn(() => null),
}));

vi.mock('../../../services/rules/combat/applyDamage.js', () => ({
    applyDamageToTarget: vi.fn(),
}));

import { setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { applyDamageToTarget } from '../../../services/rules/combat/applyDamage.js';

const baseProps = {
    mode: 'normal',
    title: 'Steps of the Fey',
    targets: [
        { name: 'Goblin1', currentHp: 5, maxHp: 7 },
        { name: 'Orc1', currentHp: 12, maxHp: 15 },
    ],
    action: { name: 'Steps of the Fey', automation: { type: 'class_feature' } },
    playerStats: { name: 'FeyTrickster' },
    campaignName: 'test-campaign',
    saveDc: 14,
    featureName: 'Steps of the Fey',
    newCount: 3,
    freeCastCountKey: 'stepsRemaining',
    onClose: vi.fn(),
};

const makeProps = (overrides = {}) => ({ ...baseProps, ...overrides });

// Leak ledger (saveOnlyHandler.dismiss.test.js family): net-open count of the
// MODAL's own save-result / save-dismissed window listeners.
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

async function confirmTauntOn(...names) {
    fireEvent.click(screen.getByText('Taunting Step'));
    for (const name of names) {
        fireEvent.click(screen.getByRole('checkbox', { name: new RegExp(name) }));
    }
    await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Taunt/ }));
    });
}

const dispatchDismissed = (promptId) => act(async () => {
    window.dispatchEvent(new CustomEvent('save-dismissed', { detail: { promptId } }));
});

const dispatchResult = (promptId, success) => act(async () => {
    window.dispatchEvent(new CustomEvent('save-result', { detail: { promptId, success } }));
});

describe('StepsOfTheFeyTauntModal — dismissed save prompt', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        store.targetEffects = [];
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('dismissed Taunting target resolves neutral: no taunting_step, save_dismissed row, Done view, listeners detached', async () => {
        const ledger = trackSaveLedger();
        const onClose = vi.fn();
        render(<StepsOfTheFeyTauntModal {...makeProps({ onClose })} />);
        await confirmTauntOn('Goblin1');

        const promptId = createSaveListener.mock.results[0].value.promptId;
        // Modal is parked mid-cast: no result screen yet.
        expect(screen.queryByRole('button', { name: 'Done' })).not.toBeInTheDocument();
        expect(ledger.open).toBe(2); // ONE save-result + ONE save-dismissed

        await dispatchDismissed(promptId);

        // Neutral refusal outcome: nothing applied, honest log, Done appears.
        expect(logSaveDismissed).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
            casterName: 'FeyTrickster',
            abilityName: 'Steps of the Fey',
            targetName: 'Goblin1',
            saveDc: 14,
            saveType: 'WIS',
        }));
        expect(setRuntimeValue).not.toHaveBeenCalledWith('campaign', 'targetEffects', expect.anything(), expect.anything());
        const done = await screen.findByRole('button', { name: 'Done' });
        expect(document.body.textContent).toMatch(/1 dismissed — no effect/);
        fireEvent.click(done);
        expect(onClose).toHaveBeenCalledTimes(1);
        expect(ledger.open).toBe(0); // BOTH listeners detached on arrival
    });

    it('mixed lane: dismissed target neutral + failed target still lands its effect; summary counts both', async () => {
        const ledger = trackSaveLedger();
        render(<StepsOfTheFeyTauntModal {...makeProps()} />);
        await confirmTauntOn('Goblin1', 'Orc1');
        const [goblinPrompt, orcPrompt] = createSaveListener.mock.results.map(r => r.value.promptId);

        await dispatchDismissed(goblinPrompt);
        await dispatchResult(orcPrompt, false);

        // Only the Orc (real failed save) gets the taunting_step effect.
        const written = store.targetEffects;
        expect(written.map(e => e.target)).toEqual(['Orc1']);
        expect(logSaveDismissed).toHaveBeenCalledTimes(1);
        expect(document.body.textContent).toMatch(/1 failed save[^]*1 dismissed — no effect/);
        expect(ledger.open).toBe(0);
    });

    it('a save-dismissed for a DIFFERENT promptId stays inert (mismatch guard)', async () => {
        render(<StepsOfTheFeyTauntModal {...makeProps()} />);
        await confirmTauntOn('Goblin1');

        await dispatchDismissed('not-my-prompt');

        expect(logSaveDismissed).not.toHaveBeenCalled();
        expect(screen.queryByRole('button', { name: 'Done' })).not.toBeInTheDocument();
    });

    it('dismissal is single-shot: a late save-result for the dismissed promptId cannot apply the effect', async () => {
        render(<StepsOfTheFeyTauntModal {...makeProps()} />);
        await confirmTauntOn('Goblin1');
        const promptId = createSaveListener.mock.results[0].value.promptId;

        await dispatchDismissed(promptId);
        await dispatchResult(promptId, false);

        expect(store.targetEffects).toHaveLength(0);
        expect(logSaveDismissed).toHaveBeenCalledTimes(1);
    });

    it('Dreadful Step lane: dismissed target takes no damage and logs neutral', async () => {
        render(<StepsOfTheFeyTauntModal {...makeProps()} />);
        fireEvent.click(screen.getByText('Dreadful Step'));
        fireEvent.click(screen.getByRole('checkbox', { name: /Goblin1/ }));
        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: /\(1\)/ }));
        });

        const promptId = createSaveListener.mock.results[0].value.promptId;
        await dispatchDismissed(promptId);

        expect(logSaveDismissed).toHaveBeenCalledTimes(1);
        expect(applyDamageToTarget).not.toHaveBeenCalled();
        await screen.findByRole('button', { name: 'Done' });
        expect(document.body.textContent).toMatch(/1 dismissed — no effect/);
    });
});
