// @maintained-by-ai
// Base-render lane for StepsOfTheFeyTauntModal: chooser header title/featureName
// fallback, prompt copy, four step-card labels/descriptions, and mode-driven skip
// button labels — all rendered with uses available. Zero-uses gating is owned by
// noUses.test.jsx; skip/confirm seams by integration.test.jsx and the per-step
// lane files; the bewitchingMagic mode by bewitching.test.jsx.
import { render, screen, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import StepsOfTheFeyTauntModal from './StepsOfTheFeyTauntModal.jsx';

// Honest savePrompt mock matching the real signature createSaveListener(campaignName, opts).
// This base-render lane never dispatches saves; the stub only isolates module import.
vi.mock('../../../services/automation/common/savePrompt.js', () => ({
    createSaveListener: vi.fn((_campaignName, opts = {}) => ({
        promptId: `prompt-${opts.targetName ?? 'unknown'}`,
        ...opts,
    })),
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

const baseProps = {
    mode: 'normal',
    // Title differs from featureName so the fallback branch is distinguishable.
    title: 'Fey Shenanigans',
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

const STEP_OPTIONS = [
    { key: 'refreshing', label: 'Refreshing Step', description: 'Gain 1d10 Temporary Hit Points.' },
    { key: 'taunting', label: 'Taunting Step', description: 'Creatures within 5 ft must make a WIS save or have Disadvantage on attack rolls against creatures other than you.' },
    { key: 'disappearing', label: 'Disappearing Step', description: 'You have the Invisible condition until the start of your next turn.' },
    { key: 'dreadful', label: 'Dreadful Step', description: 'Creatures within 5 ft must make a WIS save (DC 14) or take 2d10 Psychic damage.' },
];

describe('StepsOfTheFeyTauntModal - base chooser render', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('shows the title in the wand-icon header and falls back to featureName only when title is absent', () => {
        const { container, rerender } = render(<StepsOfTheFeyTauntModal {...makeProps()} />);
        const header = container.querySelector('.sp-header');
        expect(header).toHaveTextContent('Fey Shenanigans');
        // Proves the header renders title, not the featureName fallback.
        expect(header).not.toHaveTextContent('Steps of the Fey');
        expect(header.querySelector('.fa-solid.fa-wand-sparkles')).toBeInTheDocument();

        rerender(<StepsOfTheFeyTauntModal {...makeProps({ title: undefined })} />);
        expect(container.querySelector('.sp-header')).toHaveTextContent('Steps of the Fey');
    });

    it('renders the prompt with the interpolated name and exactly four step cards with exact labels and descriptions', () => {
        render(<StepsOfTheFeyTauntModal {...makeProps()} />);

        expect(screen.getByText(/Choose how you use/)).toHaveTextContent('Choose how you use Fey Shenanigans:');
        expect(screen.getAllByTestId(/step-option-/)).toHaveLength(4);

        for (const { key, label, description } of STEP_OPTIONS) {
            const card = within(screen.getByTestId(`step-option-${key}`));
            expect(card.getByText(label)).toBeInTheDocument();
            expect(card.getByText(description)).toBeInTheDocument();
        }
    });

    it.each([
        { mode: 'normal', title: 'Fey Shenanigans', expected: 'Skip', other: 'Misty Step only (free cast)' },
        { mode: 'mistyEscape', title: 'Fey Shenanigans', expected: 'Misty Step only (free cast)', other: 'Skip' },
        { mode: 'normal', title: 'Bewitching Magic', expected: 'Misty Step only (free cast)', other: 'Skip' },
    ])('labels the exit button "$expected" for mode $mode with title "$title"', ({ mode, title, expected, other }) => {
        render(<StepsOfTheFeyTauntModal {...makeProps({ mode, title })} />);
        expect(screen.getByRole('button', { name: expected })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: other })).toBeNull();
    });
});
