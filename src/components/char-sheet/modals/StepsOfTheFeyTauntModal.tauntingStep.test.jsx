// @maintained-by-ai
// Taunting Step confirm lane only (handleTauntConfirm) — the one lane no sibling
// covers: save dispatch via createSaveListener, taunting_step targetEffects upsert
// (in-place replace, other effects preserved), addExpiration payload, exact
// save_result logs, and count decrement. Choice-step copy lives in render.test.jsx,
// the taunting chooser→skip flow in integration.test.jsx, no-uses blocking in
// noUses.test.jsx, dreadful damage in dreadfulStep.test.jsx (#257).
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
});
