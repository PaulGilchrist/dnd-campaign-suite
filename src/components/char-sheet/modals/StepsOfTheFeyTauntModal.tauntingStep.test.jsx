// @maintained-by-ai 2026-11-28
// Taunting Step confirm lane only (handleTauntConfirm) — the one lane no sibling
// covers: save dispatch via createSaveListener, taunting_step targetEffects upsert
// (in-place replace, other effects preserved, null seed, cross-failure merged
// writes), addExpiration payload bytes, exact save_result logs, and count
// decrement. Choice-step copy lives in render.test.jsx, the taunting chooser→skip
// flow in integration.test.jsx, no-uses blocking in noUses.test.jsx, the
// dismissed arm + Done→onClose seam in save-dismissed.test.jsx, unmount listener
// cleanup in saveListenerCleanup.test.jsx, dreadful damage in dreadfulStep.test.jsx.
//
// Trim notes (this pass, fix#54 zero-dup law):
//  - taunting_step registry canon (label/icon/cls/group/fields) is owned by the
//    golden census in targetEffectDefinitions.test.js — the static mirror test
//    here was a duplicate and is gone.
//  - the standalone zero-target arm was a DOM tautology (clicking a disabled
//    button is a browser no-op); its observable precondition — disabled attr +
//    zero dispatch/logs/decrement pre-selection — stays pinned inside test 1.
//  - null-seed upsert (#1517: store → null becomes exactly [newRow], the || []
//    branch) folded into the two-failure merged-write test: seeding THAT store
//    with null pins the single-row seed byte-for-byte on teWrites[0] while the
//    second write still proves fix#86 (first row carried, never clobbered —
//    needs the key-aware store-backed runtime mock below).
// Ships-truth for the expiration row: the modal calls addExpiration with
// rounds: undefined and NO until field → expirationQueue.js:23 stamps
// expiryRounds: Infinity, :24-26 omits until entirely (until:'combat' rides
// ONLY combat-scoped callers, fix#108/#127 policy — this lane is NOT one: it
// ships a source-creature-anchored latch cleared by the expireOnCreatureName
// seam in processExpirationList, expirationQueue.js:50-52). Row construction
// itself is owned by addExpiration.test.js + addExpiration.ba001-single-write
// .test.js; this lane pins the modal-owned call bytes.
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
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
  // save-dismissed sweep (2026-11-05): components under test may now import the shared dismissal log helper.
  logSaveDismissed: vi.fn(() => Promise.resolve()),
    // Real contract (savePrompt.js:105-145): (campaignName, config) =>
    // { promptId, promise }. promptId is utils.guid() — name-agnostic, unique
    // per mint, never prompt-<targetName> (shared name-based ids latent-
    // collide; fix#1426/#1431 family). The promise routes event.detail BY its
    // own promptId on a one-shot 'save-result' listener (savePrompt.js:121-131)
    // and self-removes on arrival exactly like the real service. The modal
    // consumes only promptId and waits on the same event (waitForSaveResult).
    createSaveListener: vi.fn((_campaignName, _config) => {
        const promptId = `save-guid-${++promptState.n}`;
        const promise = new Promise((resolve) => {
            const handleSaveResult = (event) => {
                if (event.detail.promptId !== promptId) return;
                window.removeEventListener('save-result', handleSaveResult);
                resolve(event.detail);
            };
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

// Key-aware and store-backed (was key-blind + write-ignoring): lets the lane
// pin the exact read key ('campaign','targetEffects'), the #1517 null seed,
// and the fix#86 merged-write across two sequential failures honestly — in
// prod the second read reflects the first POST through the runtime cache.
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

function openTauntingSelection() {
    fireEvent.click(screen.getByText('Taunting Step'));
}

function checkTarget(name) {
    fireEvent.click(screen.getByRole('checkbox', { name: new RegExp(name) }));
}

function getTauntButton() {
    return screen.getByRole('button', { name: /Taunt/ });
}

function dispatchSave(promptId, success) {
    return act(async () => {
        window.dispatchEvent(new CustomEvent('save-result', { detail: { promptId, success } }));
    });
}

describe('StepsOfTheFeyTauntModal - Taunting Step', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        store.targetEffects = [];
    });

    it('taunts two targets: exact WIS prompts, indefinite wait, then taunting_step on the failure only with decremented uses', async () => {
        const onClose = vi.fn();
        // Pre-existing effects: a stale taunting_step on Goblin1 (must be replaced
        // in place, not duplicated) and an unrelated effect (must be preserved).
        store.targetEffects = [
            { effect: 'taunting_step', target: 'Goblin1', source: 'OldGuy', duration: 'old', timestamp: 111 },
            { effect: 'hunter_mark', target: 'Orc1', source: 'Someone', timestamp: 222 },
        ];
        render(<StepsOfTheFeyTauntModal {...makeProps({ onClose })} />);
        openTauntingSelection();

        expect(screen.getByText('Taunting Step: Select creatures to taunt.')).toBeInTheDocument();
        expect(screen.getByText(/must make a WIS save or have Disadvantage on attack rolls against creatures other than you\./)).toBeInTheDocument();
        expect(getTauntButton()).toBeDisabled();
        expect(createSaveListener).not.toHaveBeenCalled();
        expect(addEntry).not.toHaveBeenCalled();

        checkTarget('Goblin1');
        checkTarget('Orc1');
        expect(getTauntButton()).toBeEnabled();
        await act(async () => { fireEvent.click(getTauntButton()); });

        // One exact WIS prompt + ability_use log per target, in target order.
        const [goblinPrompt, orcPrompt] = createSaveListener.mock.results.map(r => r.value.promptId);
        expect(createSaveListener).toHaveBeenCalledTimes(2);
        expect(createSaveListener).toHaveBeenCalledWith('test-campaign', { targetName: 'Goblin1', saveType: 'WIS', saveDc: 14 });
        expect(createSaveListener).toHaveBeenCalledWith('test-campaign', { targetName: 'Orc1', saveType: 'WIS', saveDc: 14 });

        expect(addEntry).toHaveBeenCalledTimes(2);
        expect(addEntry).toHaveBeenCalledWith('test-campaign', {
            type: 'ability_use',
            characterName: 'FeyTrickster',
            abilityName: 'Steps of the Fey',
            description: 'Steps of the Fey triggered — Goblin1 must make WIS save (DC 14) or have Disadvantage on attack rolls against creatures other than FeyTrickster.',
            promptId: goblinPrompt,
        });
        expect(addEntry).toHaveBeenCalledWith('test-campaign', {
            type: 'ability_use',
            characterName: 'FeyTrickster',
            abilityName: 'Steps of the Fey',
            description: 'Steps of the Fey triggered — Orc1 must make WIS save (DC 14) or have Disadvantage on attack rolls against creatures other than FeyTrickster.',
            promptId: orcPrompt,
        });

        // Use is consumed up front, but the effect waits indefinitely for the saves —
        // no premature result, no close, no targetEffects or expiration yet.
        expect(setRuntimeValue).toHaveBeenCalledTimes(1);
        expect(setRuntimeValue).toHaveBeenCalledWith('FeyTrickster', 'stepsRemaining', 2, 'test-campaign');
        expect(screen.queryByRole('button', { name: 'Done' })).not.toBeInTheDocument();
        expect(onClose).not.toHaveBeenCalled();
        expect(addExpiration).not.toHaveBeenCalled();

        await dispatchSave(goblinPrompt, false);
        // Per-promptId routing arm (fix#215): answering Goblin's minted id
        // resolves ONLY Goblin's own waitForSaveResult subscriber. The lane's
        // aggregate is gated on Promise.all (StepsOfTheFeyTauntModal.jsx:230),
        // so with Orc1 unanswered there is no Done and no save_result log yet.
        expect(screen.queryByRole('button', { name: 'Done' })).not.toBeInTheDocument();
        expect(addEntry.mock.calls.filter(([, e]) => e.type === 'save_result')).toHaveLength(0);
        await dispatchSave(orcPrompt, true);

        await waitFor(() => {
            expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
        });

        // Failed target's taunting_step replaces the stale entry IN PLACE at index 0;
        // the unrelated hunter_mark is untouched; the saving target gains nothing.
        expect(setRuntimeValue).toHaveBeenCalledTimes(2);
        expect(setRuntimeValue).toHaveBeenCalledWith('campaign', 'targetEffects', [
            { effect: 'taunting_step', target: 'Goblin1', source: 'FeyTrickster', duration: 'until_start_of_next_turn', timestamp: expect.any(Number) },
            { effect: 'hunter_mark', target: 'Orc1', source: 'Someone', timestamp: 222 },
        ], 'test-campaign');

        expect(addExpiration).toHaveBeenCalledTimes(1);
        expect(addExpiration).toHaveBeenCalledWith({
            attackerName: 'FeyTrickster',
            targetName: 'Goblin1',
            effects: [{ type: 'targetEffect', effect: 'taunting_step', target: 'Goblin1' }],
            campaignName: 'test-campaign',
            rounds: undefined,
            expireOnCreatureName: 'FeyTrickster',
        });

        // 2 ability_use + 2 save_result, exact payloads. Taunting deals no damage.
        expect(addEntry).toHaveBeenCalledTimes(4);
        expect(addEntry).toHaveBeenCalledWith('test-campaign', {
            type: 'save_result',
            characterName: 'FeyTrickster',
            rollType: 'save-class_feature',
            targetName: 'Goblin1',
            saveDc: 14,
            saveType: 'WIS',
            success: false,
            description: 'Goblin1 failed WIS save. Goblin1 has Disadvantage on attack rolls against creatures other than FeyTrickster until start of FeyTrickster\'s next turn.',
        });
        expect(addEntry).toHaveBeenCalledWith('test-campaign', {
            type: 'save_result',
            characterName: 'FeyTrickster',
            rollType: 'save-class_feature',
            targetName: 'Orc1',
            saveDc: 14,
            saveType: 'WIS',
            success: true,
            description: 'Orc1 succeeded on WIS save from Steps of the Fey. No effect.',
        });
        expect(applyDamageToTarget).not.toHaveBeenCalled();

        const body = screen.getByRole('button', { name: 'Done' }).closest('.sp-modal').querySelector('.sp-body');
        expect(body.textContent).toContain('2 creature(s) targeted');
        expect(body.textContent).toContain('1 failed save — Disadvantage on attack rolls vs others. 1 saved.');
        expect(body.textContent).toContain('2 remaining');
        // The lane parks on the result view for an explicit Done click (Done→onClose
        // itself is owned by save-dismissed.test.jsx — one pin across the family).
        expect(onClose).not.toHaveBeenCalled();
    });

    it('all targets saving resolves the lane inertly — uses spent, no taunting_step, no expiration — and ignores foreign promptId events', async () => {
        render(<StepsOfTheFeyTauntModal {...makeProps({ newCount: 2 })} />);
        openTauntingSelection();
        checkTarget('Goblin1');
        checkTarget('Orc1');
        await act(async () => { fireEvent.click(getTauntButton()); });

        const [goblinPrompt, orcPrompt] = createSaveListener.mock.results.map(r => r.value.promptId);

        // An unrelated save-result event must not resolve or advance anything.
        await dispatchSave('someone-elses-prompt', false);
        expect(screen.queryByRole('button', { name: 'Done' })).not.toBeInTheDocument();
        expect(setRuntimeValue).toHaveBeenCalledTimes(1); // decrement only

        await dispatchSave(goblinPrompt, true);
        await dispatchSave(orcPrompt, true);

        await waitFor(() => {
            expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
        });

        // The use was consumed but the effect lane stayed completely inert.
        expect(setRuntimeValue).toHaveBeenCalledTimes(1);
        expect(setRuntimeValue).toHaveBeenCalledWith('FeyTrickster', 'stepsRemaining', 1, 'test-campaign');
        expect(addExpiration).not.toHaveBeenCalled();
        expect(applyDamageToTarget).not.toHaveBeenCalled();

        // 2 ability_use + 2 save_result successes, exact payloads.
        expect(addEntry).toHaveBeenCalledTimes(4);
        expect(addEntry).toHaveBeenCalledWith('test-campaign', {
            type: 'save_result',
            characterName: 'FeyTrickster',
            rollType: 'save-class_feature',
            targetName: 'Goblin1',
            saveDc: 14,
            saveType: 'WIS',
            success: true,
            description: 'Goblin1 succeeded on WIS save from Steps of the Fey. No effect.',
        });
        expect(addEntry).toHaveBeenCalledWith('test-campaign', {
            type: 'save_result',
            characterName: 'FeyTrickster',
            rollType: 'save-class_feature',
            targetName: 'Orc1',
            saveDc: 14,
            saveType: 'WIS',
            success: true,
            description: 'Orc1 succeeded on WIS save from Steps of the Fey. No effect.',
        });

        const body = screen.getByRole('button', { name: 'Done' }).closest('.sp-modal').querySelector('.sp-body');
        expect(body.textContent).toContain('0 failed save');
        expect(body.textContent).toContain('1 remaining');
    });

    it('null-seed store + two failures: first write seeds exactly [row] (#1517), second carries the first row byte-for-byte (fix#86), two latches stamped', async () => {
        store.targetEffects = null; // the || [] branch: unpinned while the store mock was key-blind
        render(<StepsOfTheFeyTauntModal {...makeProps({ newCount: 2 })} />);
        openTauntingSelection();
        checkTarget('Goblin1');
        checkTarget('Orc1');
        await act(async () => { fireEvent.click(getTauntButton()); });

        const [goblinPrompt, orcPrompt] = createSaveListener.mock.results.map(r => r.value.promptId);

        await dispatchSave(goblinPrompt, false);
        await dispatchSave(orcPrompt, false);
        await waitFor(() => {
            expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
        });

        const teWrites = setRuntimeValue.mock.calls.filter(([key, subKey]) => key === 'campaign' && subKey === 'targetEffects');
        expect(teWrites).toHaveLength(2);

        const goblinRow = { effect: 'taunting_step', target: 'Goblin1', source: 'FeyTrickster', duration: 'until_start_of_next_turn', timestamp: expect.any(Number) };
        const orcRow = { effect: 'taunting_step', target: 'Orc1', source: 'FeyTrickster', duration: 'until_start_of_next_turn', timestamp: expect.any(Number) };
        // First fail on the NULL store: exact read/write key bytes seed [goblin]
        // (#1517). Second fail re-reads the store (now carrying goblin) and
        // appends orc — merged list, first row preserved, never clobbered.
        expect(teWrites[0]).toEqual(['campaign', 'targetEffects', [goblinRow], 'test-campaign']);
        expect(teWrites[1]).toEqual(['campaign', 'targetEffects', [goblinRow, orcRow], 'test-campaign']);

        // One creature-anchored latch per failed target, in save-resolution order.
        expect(addExpiration).toHaveBeenCalledTimes(2);
        expect(addExpiration).toHaveBeenNthCalledWith(1, {
            attackerName: 'FeyTrickster', targetName: 'Goblin1',
            effects: [{ type: 'targetEffect', effect: 'taunting_step', target: 'Goblin1' }],
            campaignName: 'test-campaign', rounds: undefined, expireOnCreatureName: 'FeyTrickster',
        });
        expect(addExpiration).toHaveBeenNthCalledWith(2, {
            attackerName: 'FeyTrickster', targetName: 'Orc1',
            effects: [{ type: 'targetEffect', effect: 'taunting_step', target: 'Orc1' }],
            campaignName: 'test-campaign', rounds: undefined, expireOnCreatureName: 'FeyTrickster',
        });

        // Both save_result logs are failures; no damage lane on taunting.
        const failLogs = addEntry.mock.calls.filter(([, e]) => e.type === 'save_result');
        expect(failLogs).toHaveLength(2);
        expect(failLogs[0][1]).toMatchObject({ targetName: 'Goblin1', success: false, saveType: 'WIS', saveDc: 14 });
        expect(failLogs[1][1]).toMatchObject({ targetName: 'Orc1', success: false, saveType: 'WIS', saveDc: 14 });
        expect(applyDamageToTarget).not.toHaveBeenCalled();

        const body = screen.getByRole('button', { name: 'Done' }).closest('.sp-modal').querySelector('.sp-body');
        expect(body.textContent).toContain('2 creature(s) targeted. 2 failed save');
    });
});
