// @maintained-by-ai
// NoUses lane: exhausted-uses gating (newCount: 0, unlimited unset) for the
// normal-mode chooser — the "No uses remaining" copy, four inert step options
// (clicks never advance, nothing dispatches), and the free-cast Skip that stays
// open as the only resolution at zero uses (exact log, "0 remaining", no
// counter write). Gate-less chooser copy is owned by render.test.jsx; skip
// seams with uses available by integration.test.jsx; bewitching lane by
// bewitching.test.jsx.
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import StepsOfTheFeyTauntModal from './StepsOfTheFeyTauntModal.jsx';

// Honest savePrompt mock: source calls createSaveListener(campaignName, opts)
// — capture opts (args[1]) and hand out unique promptIds per call.
const saveListenerCalls = vi.hoisted(() => []);

vi.mock('../../../services/automation/common/savePrompt.js', () => ({
    createSaveListener: vi.fn((campaignName, opts) => {
        const promptId = `prompt-${opts.targetName}-${saveListenerCalls.length}`;
        saveListenerCalls.push({ campaignName, ...opts, promptId });
        return { promptId, ...opts };
    }),
}));

vi.mock('../../../services/ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../services/rules/effects/expirations.js', () => ({
    addExpiration: vi.fn(),
}));

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(() => []),
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
import { addExpiration } from '../../../services/rules/effects/expirations.js';
import { setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { setTempHp } from '../../../services/automation/handlers/buffs/tempHpService.js';

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
    // A counter key is present so any erroneous decrement at zero uses is visible.
    freeCastCountKey: 'stepsRemaining',
    onClose: vi.fn(),
};

function makeProps(overrides) {
    return { ...baseProps, newCount: 0, ...(overrides || {}) };
}

describe('StepsOfTheFeyTauntModal - No Uses (newCount: 0)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        saveListenerCalls.length = 0;
    });

    it('gates every step: shows the long-rest copy and keeps all four options inert — no advance, no dispatch', () => {
        render(<StepsOfTheFeyTauntModal {...makeProps()} />);

        expect(screen.getByText('No uses remaining — finish a Long Rest to regain.')).toBeInTheDocument();
        expect(screen.getAllByTestId(/step-option-/)).toHaveLength(4);

        // Clicking each option must leave the chooser intact and touch nothing.
        for (const key of ['refreshing', 'taunting', 'disappearing', 'dreadful']) {
            fireEvent.click(screen.getByTestId(`step-option-${key}`));
            expect(screen.getByText(/Choose how you use/)).toBeInTheDocument();
        }
        expect(screen.queryByRole('button', { name: 'Done' })).toBeNull();
        expect(createSaveListener).not.toHaveBeenCalled();
        expect(saveListenerCalls).toHaveLength(0);
        expect(addEntry).not.toHaveBeenCalled();
        expect(setRuntimeValue).not.toHaveBeenCalled();
        expect(setTempHp).not.toHaveBeenCalled();
        expect(addExpiration).not.toHaveBeenCalled();
        expect(baseProps.onClose).not.toHaveBeenCalled();
    });

    it('keeps the free-cast Skip open at zero uses: logs the cast exactly once, shows "0 remaining", writes no counter', () => {
        render(<StepsOfTheFeyTauntModal {...makeProps()} />);

        fireEvent.click(screen.getByRole('button', { name: 'Skip' }));

        expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
        expect(screen.getByText(/Cast Misty Step without expending a spell slot \(0 remaining\)/)).toBeInTheDocument();
        expect(addEntry).toHaveBeenCalledTimes(1);
        expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
            type: 'ability_use',
            characterName: 'FeyTrickster',
            abilityName: 'Steps of the Fey',
            description: 'FeyTrickster cast Misty Step for free via Steps of the Fey — no spell slot consumed — teleporting up to 30 feet to an unoccupied space they can see (GM-positioned).',
        }));
        // A free cast at zero uses consumes nothing and rolls no saves.
        expect(setRuntimeValue).not.toHaveBeenCalled();
        expect(createSaveListener).not.toHaveBeenCalled();
        expect(baseProps.onClose).not.toHaveBeenCalled();
    });
});
