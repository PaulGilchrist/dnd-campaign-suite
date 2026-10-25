// @maintained-by-ai
// Dreadful Step lane only: subview copy + confirm gating, exact save-dispatch
// payloads (incl. saveDc/featureName pass-through), and the save-resolution
// damage seam — owned solely here (no sibling dispatches save-result or
// touches applyDamageToTarget). Choice-step copy lives in render.test.jsx,
// overlay/close seams and the free-cast skip in integration.test.jsx, no-uses
// blocking in noUses.test.jsx.
// handleSkip derives its modeLabel from the user's choice (fix: was derived
// from the modal's mode, mislabeling this lane "Taunting Step" in normal
// mode); the skip result copy is pinned here to exact bytes.
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import StepsOfTheFeyTauntModal from './StepsOfTheFeyTauntModal.jsx';
import { setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { createSaveListener } from '../../../services/automation/common/savePrompt.js';
import { addEntry } from '../../../services/ui/logService.js';
import { applyDamageToTarget } from '../../../services/rules/combat/applyDamage.js';

const { combatContext, promptState } = vi.hoisted(() => ({
    combatContext: { creatures: [] },
    promptState: { n: 0 },
}));

vi.mock('../../../services/automation/common/savePrompt.js', () => ({
    // Real contract (savePrompt.js:105-145): (campaignName, config) =>
    // { promptId, promise }. promptId is utils.guid() — name-agnostic, unique
    // per mint, never prompt-<targetName> (shared name-based ids latent-
    // collide; fix#1426/#1431 family). The promise routes event.detail BY its
    // own promptId on a one-shot 'save-result' listener (savePrompt.js:121-131)
    // and self-removes on arrival exactly like the real service.
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

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(() => null),
    setRuntimeValue: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../services/automation/handlers/buffs/tempHpService.js', () => ({
    setTempHp: vi.fn(),
}));

vi.mock('../../../services/rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(() => Promise.resolve(combatContext)),
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
    onClose: vi.fn(),
};

function makeProps(overrides) {
    return { ...baseProps, ...(overrides || {}) };
}

function openDreadfulSelection() {
    fireEvent.click(screen.getByText('Dreadful Step'));
}

function checkTarget(name) {
    fireEvent.click(screen.getByRole('checkbox', { name: new RegExp(name) }));
}

function getDreadfulButton() {
    return screen.getByRole('button', { name: /Dreadful/ });
}

describe('StepsOfTheFeyTauntModal - Dreadful Step', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.restoreAllMocks();
    });

    it('opens the dreadful target selection with DC/damage copy and enables confirm only once a creature is checked', () => {
        render(<StepsOfTheFeyTauntModal {...makeProps()} />);
        openDreadfulSelection();

        expect(screen.getByText('Dreadful Step: Select creatures to target.')).toBeInTheDocument();
        expect(screen.getByText(/WIS save \(DC 14\) or take 2d10 Psychic damage\./)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Skip' })).toBeInTheDocument();
        expect(getDreadfulButton()).toBeDisabled();
        expect(createSaveListener).not.toHaveBeenCalled();
        expect(addEntry).not.toHaveBeenCalled();

        checkTarget('Goblin1');
        expect(screen.getByRole('button', { name: 'Dreadful (1)' })).toBeEnabled();
        expect(createSaveListener).not.toHaveBeenCalled();
    });

    it('skip resolves to the no-targets result without dispatching saves and leaves uses intact', async () => {
        render(<StepsOfTheFeyTauntModal {...makeProps({ newCount: 3 })} />);
        openDreadfulSelection();
        fireEvent.click(screen.getByRole('button', { name: 'Skip' }));

        await waitFor(() => {
            expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
        });
        const body = screen.getByText('Done').closest('.sp-modal').querySelector('.sp-body');
        // Fix pin: modeLabel derives from the skipped CHOICE ('dreadful'),
        // not the modal's mode — exact bytes of the full result description.
        expect(body.textContent).toBe(
            'Steps of the Fey: Cast Misty Step without expending a spell slot (3 remaining).Dreadful Step: No targets selected.'
        );
        expect(body.innerHTML).toBe(
            'Steps of the Fey: Cast Misty Step without expending a spell slot (3 remaining).<br><br><b>Dreadful Step:</b> No targets selected.'
        );
        expect(createSaveListener).not.toHaveBeenCalled();
    });

    it('confirming dispatches an exact WIS save prompt and ability_use log per target, waiting indefinitely for saves', async () => {
        const onClose = vi.fn();
        render(<StepsOfTheFeyTauntModal {...makeProps({ saveDc: 18, featureName: 'Fey Trickery', onClose })} />);
        openDreadfulSelection();
        checkTarget('Goblin1');
        checkTarget('Orc1');
        await act(async () => { fireEvent.click(getDreadfulButton()); });

        const [goblinPrompt, orcPrompt] = createSaveListener.mock.results.map(r => r.value.promptId);
        expect(createSaveListener).toHaveBeenCalledTimes(2);
        expect(createSaveListener).toHaveBeenCalledWith('test-campaign', { targetName: 'Goblin1', saveType: 'WIS', saveDc: 18 });
        expect(createSaveListener).toHaveBeenCalledWith('test-campaign', { targetName: 'Orc1', saveType: 'WIS', saveDc: 18 });

        expect(addEntry).toHaveBeenCalledTimes(2);
        expect(addEntry).toHaveBeenCalledWith('test-campaign', {
            type: 'ability_use',
            characterName: 'FeyTrickster',
            abilityName: 'Fey Trickery',
            description: 'Fey Trickery triggered — Goblin1 must make WIS save (DC 18) or take 2d10 Psychic damage.',
            promptId: goblinPrompt,
        });
        expect(addEntry).toHaveBeenCalledWith('test-campaign', {
            type: 'ability_use',
            characterName: 'FeyTrickster',
            abilityName: 'Fey Trickery',
            description: 'Fey Trickery triggered — Orc1 must make WIS save (DC 18) or take 2d10 Psychic damage.',
            promptId: orcPrompt,
        });

        // Saves stay open until answered — no premature result, no close.
        expect(screen.queryByRole('button', { name: 'Done' })).not.toBeInTheDocument();
        expect(onClose).not.toHaveBeenCalled();

        // Answer the saves so this render's listeners are unhooked.
        await act(async () => {
            window.dispatchEvent(new CustomEvent('save-result', { detail: { promptId: goblinPrompt, success: true } }));
            window.dispatchEvent(new CustomEvent('save-result', { detail: { promptId: orcPrompt, success: true } }));
        });
    });

    it('resolved saves apply 2d10 Psychic damage only to failures and summarize with a decremented count', async () => {
        vi.spyOn(Math, 'random').mockReturnValue(0.5); // each d10 rolls 6 → failed target takes 12
        // freeCastCountKey supplied so the '(2 remaining)' summary below mirrors
        // an ACTUAL decrement write (matches tauntingStep:113 / disappearingStep:89
        // sibling lanes; pass #258 text-vs-write honesty).
        render(<StepsOfTheFeyTauntModal {...makeProps({ newCount: 3, freeCastCountKey: 'stepsRemaining' })} />);
        openDreadfulSelection();
        checkTarget('Goblin1');
        checkTarget('Orc1');
        await act(async () => { fireEvent.click(getDreadfulButton()); });

        const [goblinPrompt, orcPrompt] = createSaveListener.mock.results.map(r => r.value.promptId);
        await act(async () => {
            window.dispatchEvent(new CustomEvent('save-result', { detail: { promptId: goblinPrompt, success: true } }));
            window.dispatchEvent(new CustomEvent('save-result', { detail: { promptId: orcPrompt, success: false } }));
        });

        await waitFor(() => {
            expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
        });

        expect(applyDamageToTarget).toHaveBeenCalledTimes(1);
        expect(applyDamageToTarget).toHaveBeenCalledWith(
            combatContext,
            'Orc1',
            12,
            ['Psychic'],
            { campaignName: 'test-campaign', characters: [], ignoreResistance: false, attackerName: 'FeyTrickster' }
        );

        // 2 ability_use + 2 save_result, exact payloads.
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
            success: false,
            description: 'Orc1 failed WIS save. Orc1 takes 12 Psychic damage.',
        });

        const body = screen.getByRole('button', { name: 'Done' }).closest('.sp-modal').querySelector('.sp-body');
        expect(body.textContent).toContain('2 creature(s) targeted');
        expect(body.textContent).toContain('1 failed save — 12 Psychic damage. 1 saved.');
        expect(body.textContent).toContain('2 remaining');
        // The '(2 remaining)' copy is backed by the real counter write: 3 → 2.
        expect(setRuntimeValue).toHaveBeenCalledWith('FeyTrickster', 'stepsRemaining', 2, 'test-campaign');
    });
});
