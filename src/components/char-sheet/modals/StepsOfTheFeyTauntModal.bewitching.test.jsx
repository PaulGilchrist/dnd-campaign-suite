// @maintained-by-ai
// CLA-037: Bewitching Magic rides the StepsOfTheFeyTauntModal in its own mode —
// unlimited free Misty Step confirm, never the 4-option chooser, never the
// Steps_of_the_Fey free-cast counter, and every resolution logs.
// Payload shape (mode/unlimited flags) is owned by bewitchingMagicHandler.test.js;
// this lane pins modal-side behavior only: the accept and decline resolutions.
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import StepsOfTheFeyTauntModal from './StepsOfTheFeyTauntModal.jsx';

const promptState = vi.hoisted(() => ({ n: 0 }));

vi.mock('../../../services/automation/common/savePrompt.js', () => ({
    // Real contract (savePrompt.js:105): createSaveListener(campaignName, config)
    // — ARITY 2, campaignName FIRST. The old mock destructured config fields off
    // the FIRST arg into a fully-shared prompt-<targetName> id: two listeners on
    // one prompt name would resolve each other (fix#1426/#1431 collision family).
    // Returns exactly { promptId, promise } with a name-agnostic unique-per-mint
    // id (mirrors utils.guid(), savePrompt.js:106) and a one-shot 'save-result'
    // promise routed BY its own promptId (savePrompt.js:121-131). This mode
    // rolls no saves (pinned below).
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
    getCombatContext: vi.fn(() => Promise.resolve({ creatures: [] })),
}));

import { createSaveListener } from '../../../services/automation/common/savePrompt.js';
import { addEntry } from '../../../services/ui/logService.js';
import { setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';

const baseProps = {
    mode: 'bewitchingMagic',
    title: 'Bewitching Magic',
    targets: [{ name: 'Bandit', currentHp: 999, maxHp: 999 }],
    action: { name: 'Bewitching Magic', automation: { type: 'bewitching_magic', casting_time: 'passive' } },
    playerStats: { name: 'HexWarlock' },
    campaignName: 'test-campaign',
    saveDc: 16,
    featureName: 'Bewitching Magic',
    unlimited: true,
    onClose: vi.fn(),
};

describe('StepsOfTheFeyTauntModal — Bewitching Magic mode', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('resolves as an unlimited free cast: mode alone picks the lane (never the chooser, never uses-gated), logs the ability_use, never touches the Steps counter', () => {
        // CLA-037 guardrail: even props suggesting zero uses cannot gate the lane.
        const gated = render(<StepsOfTheFeyTauntModal {...baseProps} unlimited={false} newCount={0} />);
        expect(screen.getByTestId('bewitching-free-cast-btn')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Decline/i })).toBeInTheDocument();
        expect(screen.queryByTestId(/step-option-/)).toBeNull();
        expect(screen.queryByText(/No uses remaining/i)).toBeNull();
        expect(screen.queryByText(/Choose how you use/i)).toBeNull();
        gated.unmount();

        render(<StepsOfTheFeyTauntModal {...baseProps} />);
        fireEvent.click(screen.getByTestId('bewitching-free-cast-btn'));

        expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
            type: 'ability_use',
            characterName: 'HexWarlock',
            abilityName: 'Bewitching Magic',
            description: expect.stringContaining('cast Misty Step for free via Bewitching Magic — no spell slot consumed'),
            freeCastsUnlimited: true,
        }));
        // Declining is a separate lane — accepting must not log a decline entry.
        expect(addEntry.mock.calls.filter(([, e]) => e && e.automationDetail === 'bewitching_magic_declined')).toHaveLength(0);
        // Never the Steps_of_the_Fey free-cast counter, and bewitching rolls no saves.
        expect(setRuntimeValue).not.toHaveBeenCalled();
        expect(createSaveListener).not.toHaveBeenCalled();

        expect(screen.getByText(/without expending a spell slot/i)).toBeInTheDocument();
        expect(screen.getByText(/unlimited — no uses limit/)).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Done' }));
        expect(baseProps.onClose).toHaveBeenCalledTimes(1);
    });

    it('resolves as declined: logs the decline for the right character and closes without logging a cast', () => {
        render(<StepsOfTheFeyTauntModal {...baseProps} />);
        fireEvent.click(screen.getByRole('button', { name: /Decline/i }));

        expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
            type: 'automation',
            characterName: 'HexWarlock',
            abilityName: 'Bewitching Magic',
            automationType: 'bewitching_magic',
            automationDetail: 'bewitching_magic_declined',
            description: 'Bewitching Magic declined — no free Misty Step cast.',
        }));
        // Decline must never produce a free-cast log or counter write.
        expect(addEntry.mock.calls.filter(([, e]) => e && e.type === 'ability_use')).toHaveLength(0);
        expect(setRuntimeValue).not.toHaveBeenCalled();
        expect(baseProps.onClose).toHaveBeenCalledTimes(1);
    });
});
