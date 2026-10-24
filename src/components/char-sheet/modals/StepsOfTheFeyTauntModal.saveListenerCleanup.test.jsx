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
    // Real contract (savePrompt.js:105-145): (campaignName, config) =>
    // { promptId, promise }. Name-agnostic unique-per-mint ids (mirrors
    // utils.guid(); prompt-<targetName>-n ids latent-collide — fix#1426/
    // #1431 family). The promise registers its OWN one-shot 'save-result'
    // routing listener and self-removes on arrival (savePrompt.js:121-131);
    // the identity tag below lets the leak ledger separate the mock's honest
    // routing listener from the MODAL handlers this lane exists to pin.
    createSaveListener: vi.fn((_campaignName, _config) => {
        const promptId = `save-guid-${++promptState.n}`;
        const promise = new Promise((resolve) => {
            const handleSaveResult = (event) => {
                if (event.detail.promptId !== promptId) return;
                window.removeEventListener('save-result', handleSaveResult);
                resolve(event.detail);
            };
            handleSaveResult.__mockSavePromptListener = true;
            window.addEventListener('save-result', handleSaveResult);
        });
        return { promptId, promise };
    }),
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

// The honest savePrompt mock registers its own one-shot routing listeners
// (mirroring savePrompt.js:121-131). Tag-separate them so every ledger pin
// below stays exact for the MODAL's listeners — the ones fix#159 tracks.
const isModalHandler = (fn) => !fn.__mockSavePromptListener;
const modalAdds = (ledger) => ledger.adds.filter(isModalHandler);
const modalRemoves = (ledger) => ledger.removes.filter(isModalHandler);
const modalOpen = (ledger) => modalAdds(ledger).length - modalRemoves(ledger).length;

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

        // Two targets confirmed: exactly two MODAL 'save-result' registrations,
        // both live (the mock's own honest routing listeners are tag-separated).
        expect(modalAdds(ledger)).toHaveLength(2);
        expect(modalOpen(ledger)).toBe(2);
        expect(screen.queryByRole('button', { name: 'Done' })).not.toBeInTheDocument();

        // Unmount BEFORE any save-result arrives (cancel/navigation/clobber path).
        view.unmount();

        // Drain: each added handler removed exactly once, ledger balanced to zero.
        expect(modalOpen(ledger)).toBe(0);
        expect(modalRemoves(ledger)).toHaveLength(2);
        modalAdds(ledger).forEach((fn) => {
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
        // The mock's honest routing listeners DO see their own ids post-unmount
        // and self-remove (savePrompt.js:124) — without touching the modal.
        expect(ledger.removes.filter((fn) => fn.__mockSavePromptListener)).toHaveLength(2);
    });

    it('dreadful twin: unmount with saves pending drains both handlers; late events deal no damage and log nothing', async () => {
        const ledger = trackSaveResultLedger();
        const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        const view = render(<StepsOfTheFeyTauntModal {...makeProps()} />);
        const [goblinPrompt, orcPrompt] = await confirmStep('Dreadful Step', /Dreadful/);

        expect(modalAdds(ledger)).toHaveLength(2);
        expect(modalOpen(ledger)).toBe(2);

        view.unmount();

        expect(modalOpen(ledger)).toBe(0);
        expect(modalRemoves(ledger)).toHaveLength(2);
        modalAdds(ledger).forEach((fn) => {
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
        // Mock's own honest routing listeners drained by their own minted ids
        // on the late dispatch (savePrompt.js:124) — the dead modal lane inert.
        expect(ledger.removes.filter((fn) => fn.__mockSavePromptListener)).toHaveLength(2);
    });

    it('arrival then unmount: one removal per handler per path — arrival self-removal still works, unmount drain adds no extra removes', async () => {
        const ledger = trackSaveResultLedger();

        const view = render(<StepsOfTheFeyTauntModal {...makeProps()} />);
        const [goblinPrompt, orcPrompt] = await confirmStep('Taunting Step', /Taunt/);
        expect(modalAdds(ledger)).toHaveLength(2);

        await dispatchSave(goblinPrompt, false);
        // Routing arm (fix#215): Goblin's minted id fires ONLY Goblin's own
        // subscriber — its modal handler self-removes on arrival (#1348
        // one-shot), Orc1's handler stays open, and the Promise.all aggregate
        // (StepsOfTheFeyTauntModal.jsx:230) keeps the lane unresolved: no
        // Done, no save_result logs yet.
        expect(screen.queryByRole('button', { name: 'Done' })).not.toBeInTheDocument();
        expect(saveResultLogs()).toHaveLength(0);
        expect(modalOpen(ledger)).toBe(1);
        await dispatchSave(orcPrompt, true);
        await waitFor(() => {
            expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
        });

        // Arrival path: each MODAL handler removed exactly once by its own event —
        // pre-existing one-shot semantics preserved (#1348 exact pairs). The
        // mock's tagged routing listeners self-remove on arrival too
        // (savePrompt.js:124), so the raw ledger stays balanced overall.
        expect(modalRemoves(ledger)).toHaveLength(2);
        expect(modalOpen(ledger)).toBe(0);
        expect(ledger.open).toBe(0);
        const removesAfterArrival = modalRemoves(ledger).length;

        // Unmount after full resolution: ref was spliced on arrival, so the
        // drain removes nothing further — no double-removal across the two paths.
        view.unmount();
        expect(modalRemoves(ledger)).toHaveLength(removesAfterArrival);
        expect(modalOpen(ledger)).toBe(0);

        // Re-dispatched duplicate events hit nothing: no duplicate save_result,
        // no extra removes on either side of the ledger.
        await dispatchSave(goblinPrompt, false);
        await flush();
        expect(saveResultLogs()).toHaveLength(2);
        expect(modalRemoves(ledger)).toHaveLength(removesAfterArrival);
        expect(ledger.removes.filter((fn) => fn.__mockSavePromptListener)).toHaveLength(2);
    });
});
