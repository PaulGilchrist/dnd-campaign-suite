// @maintained-by-ai
// Leak-ledger pins for the save-result window listeners in StepsOfTheFeyTauntModal
// (⚠ defect, maintenance ledger run2 #257, test-maintain-bugs.md:283). Pre-fix the
// taunting/dreadful confirm lanes registered anonymous 'save-result' handlers that
// self-removed ONLY on event arrival — closing the modal while saves were pending
// left stale handlers live on window forever, where a late save-result resolved the
// dead promise and ran setResult/setApplied plus side effects against unmounted
// state (fix#145 family: symmetric effect cleanup). Mirrors the house ledger lane
// useCharActionsEventListeners.cleanup.test.jsx: exact add/remove pairs per handler
// identity (#1348), unmount-with-pending-saves drains every added handler exactly
// once, and post-unmount dispatch has zero effect. Arrival-then-unmount proves the
// two removal paths stay idempotent — no double-removal, existing one-shot pins in
// tauntingStep/dreadfulStep lanes keep green.
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import StepsOfTheFeyTauntModal from './StepsOfTheFeyTauntModal.jsx';
import { createSaveListener } from '../../../services/automation/common/savePrompt.js';
import { addEntry } from '../../../services/ui/logService.js';
import { addExpiration } from '../../../services/rules/effects/expirations.js';
import { setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { applyDamageToTarget } from '../../../services/rules/combat/applyDamage.js';

const { promptState, store } = vi.hoisted(() => ({
    promptState: { n: 0 },
    store: { targetEffects: [] },
}));

vi.mock('../../../services/automation/common/savePrompt.js', () => ({
    // Real signature is (campaignName, { targetName, saveType, saveDc }).
    // Unique promptId per call so unresolved listeners from one test can
    // never match another test's save-result events.
    createSaveListener: vi.fn((_campaignName, { targetName, saveType, saveDc }) => ({
        promptId: `prompt-${targetName}-${++promptState.n}`,
        targetName,
        saveType,
        saveDc,
    })),
}));

vi.mock('../../../services/ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../services/rules/effects/expirations.js', () => ({
    addExpiration: vi.fn(),
}));

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(() => store.targetEffects),
    setRuntimeValue: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../services/automation/handlers/buffs/tempHpService.js', () => ({
    setTempHp: vi.fn(),
}));

vi.mock('../../../services/rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(() => Promise.resolve({ creatures: [] })),
}));

vi.mock('../../../services/rules/combat/applyDamage.js', () => ({
    applyDamageToTarget: vi.fn(),
}));

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

function makeProps(overrides) {
    return { ...baseProps, ...(overrides || {}) };
}

// Exact ledger: records every add/remove of 'save-result' (delegating to the
// real implementation so dispatch still reaches live listeners) and tracks the
// net open count, mirroring trackChoiceLedger from the fix#145 lane.
function trackSaveResultLedger() {
    const ledger = { adds: [], removes: [], open: 0 };
    const realAdd = window.addEventListener.bind(window);
    const realRemove = window.removeEventListener.bind(window);
    vi.spyOn(window, 'addEventListener').mockImplementation((type, fn, opts) => {
        if (type === 'save-result') {
            ledger.adds.push(fn);
            ledger.open += 1;
        }
        return realAdd(type, fn, opts);
    });
    vi.spyOn(window, 'removeEventListener').mockImplementation((type, fn, opts) => {
        if (type === 'save-result') {
            ledger.removes.push(fn);
            ledger.open -= 1;
        }
        return realRemove(type, fn, opts);
    });
    return ledger;
}

const removesFor = (fn) => (ledger) => ledger.removes.filter((f) => f === fn);

function flush() {
    return act(async () => { await new Promise((r) => setTimeout(r, 0)); });
}

function dispatchSave(promptId, success) {
    return act(async () => {
        window.dispatchEvent(new CustomEvent('save-result', { detail: { promptId, success } }));
    });
}

async function confirmStep(stepLabel, buttonMatcher) {
    fireEvent.click(screen.getByText(stepLabel));
    fireEvent.click(screen.getByRole('checkbox', { name: /Goblin1/ }));
    fireEvent.click(screen.getByRole('checkbox', { name: /Orc1/ }));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: buttonMatcher })); });
    return createSaveListener.mock.results.map(r => r.value.promptId);
}

const saveResultLogs = () => addEntry.mock.calls.filter(([, e]) => e.type === 'save_result');

describe('StepsOfTheFeyTauntModal - save-result listener leak ledger', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        store.targetEffects = [];
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('taunting: unmount with saves pending removes every added handler exactly once and late events fire nothing', async () => {
        const ledger = trackSaveResultLedger();
        const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        const view = render(<StepsOfTheFeyTauntModal {...makeProps()} />);
        const [goblinPrompt, orcPrompt] = await confirmStep('Taunting Step', /Taunt/);

        // Two targets confirmed: exactly two 'save-result' registrations, both live.
        expect(ledger.adds).toHaveLength(2);
        expect(ledger.open).toBe(2);
        expect(screen.queryByRole('button', { name: 'Done' })).not.toBeInTheDocument();

        // Unmount BEFORE any save-result arrives (cancel/navigation/clobber path).
        view.unmount();

        // Drain: each added handler removed exactly once, ledger balanced to zero.
        expect(ledger.open).toBe(0);
        expect(ledger.removes).toHaveLength(2);
        ledger.adds.forEach((fn) => {
            expect(removesFor(fn)(ledger)).toHaveLength(1);
        });

        // Post-unmount dispatch of the still-open saves: zero effect. No state
        // updates (no React unmounted warning), no save_result logs, no
        // targetEffects beyond the pre-existing decrement, no expiration.
        await dispatchSave(goblinPrompt, false);
        await dispatchSave(orcPrompt, false);
        await flush();

        expect(saveResultLogs()).toHaveLength(0);
        expect(setRuntimeValue).toHaveBeenCalledTimes(1); // decrement only
        expect(addExpiration).not.toHaveBeenCalled();
        expect(consoleErrorSpy.mock.calls.flat().join(' ')).not.toMatch(/unmounted component/);
    });

    it('dreadful twin: unmount with saves pending drains both handlers; late events deal no damage and log nothing', async () => {
        const ledger = trackSaveResultLedger();
        const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        const view = render(<StepsOfTheFeyTauntModal {...makeProps()} />);
        const [goblinPrompt, orcPrompt] = await confirmStep('Dreadful Step', /Dreadful/);

        expect(ledger.adds).toHaveLength(2);
        expect(ledger.open).toBe(2);

        view.unmount();

        expect(ledger.open).toBe(0);
        expect(ledger.removes).toHaveLength(2);
        ledger.adds.forEach((fn) => {
            expect(removesFor(fn)(ledger)).toHaveLength(1);
        });

        // Both late saves "fail" — post-fix the dead lane must stay inert.
        await dispatchSave(goblinPrompt, false);
        await dispatchSave(orcPrompt, false);
        await flush();

        expect(applyDamageToTarget).not.toHaveBeenCalled();
        expect(saveResultLogs()).toHaveLength(0);
        expect(addExpiration).not.toHaveBeenCalled();
        expect(consoleErrorSpy.mock.calls.flat().join(' ')).not.toMatch(/unmounted component/);
    });

    it('arrival then unmount: one removal per handler per path — arrival self-removal still works, unmount drain adds no extra removes', async () => {
        const ledger = trackSaveResultLedger();

        const view = render(<StepsOfTheFeyTauntModal {...makeProps()} />);
        const [goblinPrompt, orcPrompt] = await confirmStep('Taunting Step', /Taunt/);
        expect(ledger.adds).toHaveLength(2);

        await dispatchSave(goblinPrompt, false);
        await dispatchSave(orcPrompt, true);
        await waitFor(() => {
            expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
        });

        // Arrival path: each handler removed exactly once by its own event —
        // pre-existing one-shot semantics preserved (#1348 exact pairs).
        expect(ledger.removes).toHaveLength(2);
        expect(ledger.open).toBe(0);
        const removesAfterArrival = ledger.removes.length;

        // Unmount after full resolution: ref was spliced on arrival, so the
        // drain removes nothing further — no double-removal across the two paths.
        view.unmount();
        expect(ledger.removes).toHaveLength(removesAfterArrival);
        expect(ledger.open).toBe(0);

        // Re-dispatched duplicate events hit nothing: no duplicate save_result.
        await dispatchSave(goblinPrompt, false);
        await flush();
        expect(saveResultLogs()).toHaveLength(2);
    });
});
