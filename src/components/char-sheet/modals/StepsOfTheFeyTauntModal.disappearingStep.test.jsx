// @maintained-by-ai
// Lane: Disappearing Step mode-specific render + accept dispatch exact payloads.
// Consolidated 3 tests → 2: the free-cast decrement test shared the same click
// path as the accept test (decrementCount() runs inside applyDisappearingStep),
// so its payload is now asserted in the accept test; the "already invisible"
// test pins the real branch (no activeConditions rewrite) instead of a bare
// addExpiration toHaveBeenCalled. Cancel no-op is covered by the shared
// handleCancel in refreshingStep.test.jsx; overlay/close seams live in
// integration.test.jsx; choice-step copy in render.test.jsx.
// Regression: both accept branches now log the resolution to the campaign log
// exactly once with full bytes (previously unlogged — app rule violation).
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import StepsOfTheFeyTauntModal from './StepsOfTheFeyTauntModal.jsx';
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../services/ui/logService.js';
import { addExpiration } from '../../../services/rules/effects/expirations.js';

const promptState = vi.hoisted(() => ({ n: 0 }));

vi.mock('../../../services/automation/common/savePrompt.js', () => ({
    // Real contract (savePrompt.js:105): createSaveListener(campaignName, config)
    // — ARITY 2, campaignName FIRST. The old mock destructured config fields off
    // the FIRST arg (campaignName), yielding prompt-undefined-<ts> — the class-
    // wide arg-destructure dishonesty (fix#215). Returns exactly
    // { promptId, promise } with a name-agnostic unique-per-mint id (mirrors
    // utils.guid(); prompt-<targetName> ids latent-collide — fix#1426/#1431)
    // and a promise routed BY its own promptId on a one-shot 'save-result'
    // listener (savePrompt.js:121-131). This lane rolls no saves.
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
    getRuntimeValue: vi.fn((characterKey, propertyName) => {
        if (propertyName === 'activeConditions' && characterKey !== 'campaign') {
            return [];
        }
        if (propertyName === 'targetEffects' && characterKey === 'campaign') {
            return [];
        }
        return null;
    }),
    setRuntimeValue: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../services/automation/handlers/buffs/tempHpService.js', () => ({
    setTempHp: vi.fn(),
}));

vi.mock('../../../services/rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(() => Promise.resolve({ creatures: [] })),
}));

const basePlayerStats = { name: 'FeyTrickster' };
const baseTargets = [
    { name: 'Goblin1', currentHp: 5, maxHp: 7 },
    { name: 'Orc1', currentHp: 12, maxHp: 15 },
];

const baseProps = {
    mode: 'normal',
    title: 'Steps of the Fey',
    targets: baseTargets,
    action: { name: 'Steps of the Fey', automation: { type: 'class_feature' } },
    playerStats: basePlayerStats,
    campaignName: 'test-campaign',
    saveDc: 14,
    featureName: 'Steps of the Fey',
    newCount: 3,
    freeCastCountKey: 'stepsRemaining',
    onClose: vi.fn(),
};

// Exact shape applyDisappearingStep must send to the expiration registry.
const expectedExpiration = {
    attackerName: 'FeyTrickster',
    targetName: 'FeyTrickster',
    effects: [{ type: 'condition', condition: 'invisible' }],
    campaignName: 'test-campaign',
    rounds: undefined,
    expireOnCreatureName: 'FeyTrickster',
};

// Exact campaign-log entry applyDisappearingStep must emit at the resolution
// seam (previously silent — app rule "every automation must log").
const expectedLogEntry = {
    type: 'ability_use',
    characterName: 'FeyTrickster',
    abilityName: 'Disappearing Step',
    description: "FeyTrickster cast Misty Step for free via Steps of the Fey — no spell slot consumed — teleporting up to 30 feet to an unoccupied space they can see (GM-positioned). Disappearing Step: FeyTrickster has the Invisible condition until the start of FeyTrickster's next turn.",
    timestamp: expect.any(Number),
};

function openDisappearingConfirm(props) {
    render(<StepsOfTheFeyTauntModal {...baseProps} {...(props || {})} />);
    fireEvent.click(screen.getByText('Disappearing Step'));
}

describe('StepsOfTheFeyTauntModal - Disappearing Step', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
    });

    it('shows the Disappearing Step confirmation, stays inert, then writes exact condition, expiration, and decrement payloads on accept', async () => {
        openDisappearingConfirm();

        // Mode-specific confirmation copy, with nothing applied yet.
        expect(screen.getByText('Disappearing Step')).toBeInTheDocument();
        expect(screen.getByText('You gain the Invisible condition until the start of your next turn.')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Disappear/ })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
        expect(setRuntimeValue).not.toHaveBeenCalled();
        expect(addExpiration).not.toHaveBeenCalled();
        expect(addEntry).not.toHaveBeenCalled();

        fireEvent.click(screen.getByRole('button', { name: /Disappear/ }));

        await waitFor(() => {
            expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
        });
        // Exactly two writes: the invisible condition and the free-cast decrement.
        expect(setRuntimeValue).toHaveBeenCalledTimes(2);
        expect(setRuntimeValue).toHaveBeenCalledWith('FeyTrickster', 'activeConditions', ['invisible'], 'test-campaign');
        expect(setRuntimeValue).toHaveBeenCalledWith('FeyTrickster', 'stepsRemaining', 2, 'test-campaign');
        expect(addExpiration).toHaveBeenCalledTimes(1);
        expect(addExpiration).toHaveBeenCalledWith(expectedExpiration);
        // Regression: the resolution logs exactly once, after the state writes.
        expect(addEntry).toHaveBeenCalledTimes(1);
        expect(addEntry).toHaveBeenCalledWith('test-campaign', expectedLogEntry);
        expect(setRuntimeValue.mock.invocationCallOrder.at(-1)).toBeLessThan(addEntry.mock.invocationCallOrder.at(-1));
        expect(addExpiration.mock.invocationCallOrder.at(-1)).toBeLessThan(addEntry.mock.invocationCallOrder.at(-1));
        expect(document.querySelector('.sp-body').textContent).toContain('2 remaining');
        expect(document.querySelector('.sp-body').textContent).toContain('Invisible condition until the start of your next turn.');
    });

    it('does not rewrite activeConditions when already invisible but still refreshes the expiration', async () => {
        vi.mocked(getRuntimeValue).mockImplementation((characterKey, propertyName) => {
            if (propertyName === 'activeConditions' && characterKey === 'FeyTrickster') {
                return ['invisible'];
            }
            return null;
        });

        openDisappearingConfirm();
        fireEvent.click(screen.getByRole('button', { name: /Disappear/ }));

        await waitFor(() => {
            expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
        });
        // Only the decrement is written — the condition write is skipped.
        expect(setRuntimeValue).toHaveBeenCalledTimes(1);
        expect(setRuntimeValue).toHaveBeenCalledWith('FeyTrickster', 'stepsRemaining', 2, 'test-campaign');
        expect(addExpiration).toHaveBeenCalledTimes(1);
        expect(addExpiration).toHaveBeenCalledWith(expectedExpiration);
        // The already-invisible branch still resolves and still logs — exactly once, after the writes.
        expect(addEntry).toHaveBeenCalledTimes(1);
        expect(addEntry).toHaveBeenCalledWith('test-campaign', expectedLogEntry);
        expect(addExpiration.mock.invocationCallOrder.at(-1)).toBeLessThan(addEntry.mock.invocationCallOrder.at(-1));
    });
});
