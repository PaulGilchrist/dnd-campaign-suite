// @maintained-by-ai
// Base-render lane for StepsOfTheFeyTauntModal: chooser header title/featureName
// fallback, prompt copy, four step-card labels/descriptions, and mode-driven skip
// button labels — all rendered with uses available. Zero-uses gating is owned by
// noUses.test.jsx; skip/confirm seams by integration.test.jsx and the per-step
// lane files; the bewitchingMagic mode by bewitching.test.jsx.
import { render, screen, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import StepsOfTheFeyTauntModal from './StepsOfTheFeyTauntModal.jsx';

const promptState = vi.hoisted(() => ({ n: 0 }));

// Honest savePrompt mock matching the REAL contract (savePrompt.js:105-145):
// createSaveListener(campaignName, config) => { promptId, promise } — the old
// stub flattened `...opts` into the return (fields the real service never
// returns) under a shared prompt-<targetName> id that latent-collides across
// listeners (fix#1426/#1431 family). Ids here are name-agnostic and unique
// per mint (mirrors utils.guid()); the promise routes event.detail BY its own
// promptId on a one-shot 'save-result' listener (savePrompt.js:121-131).
// This base-render lane never dispatches saves; the stub only isolates import.
vi.mock('../../../services/automation/common/savePrompt.js', () => ({
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
    getRuntimeValue: vi.fn(() => []),
    setRuntimeValue: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../services/automation/handlers/buffs/tempHpService.js', () => ({
    setTempHp: vi.fn(),
}));

vi.mock('../../../services/rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(() => Promise.resolve({ creatures: [] })),
    getTargetFromAttacker: vi.fn(() => null),
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

    it('styles the choice step via scoped classes with zero inline styles (no-inline-styles convention)', () => {
        // fix#313 recipe pin (pass #254-era census): the former inline styles
        // in renderChoiceStep — options container (:403-era), step cards
        // (:410-417-era), card header (:419-era), icon (:420-era), description
        // (:423-era), and no-uses note (:427-era) — now live in
        // StepsOfTheFeyTauntModal.css (exact-value migration). The hasUses
        // dimming state rides the .disabled modifier class. fix#254's
        // vacuous-choice rec (bewitching lane) is untouched.
        const { rerender } = render(<StepsOfTheFeyTauntModal {...makeProps()} />);

        const body = document.querySelector('.sp-body');
        expect(body.querySelectorAll('[style]')).toHaveLength(0);

        const list = document.querySelector('.fey-taunt-options');
        expect(list).toBeTruthy();
        expect(list.getAttribute('style')).toBeNull();

        const cards = list.querySelectorAll('.fey-taunt-option');
        expect(cards).toHaveLength(4);
        for (const card of cards) {
            expect(card.getAttribute('style')).toBeNull();
            expect(card.className).toContain('clickable');
            expect(card.className).not.toContain('disabled');
            expect(card.querySelector('.fey-taunt-option-icon')).toBeTruthy();
            expect(card.querySelector('.fey-taunt-option-desc')).toBeTruthy();
        }
        // Uses available: no-uses note absent.
        expect(list.querySelector('.fey-taunt-no-uses')).toBeNull();

        // Zero-uses state: cards gain .disabled, lose .clickable — still zero inline.
        rerender(<StepsOfTheFeyTauntModal {...makeProps({ newCount: 0 })} />);
        const dimmed = document.querySelectorAll('.fey-taunt-option');
        expect(dimmed).toHaveLength(4);
        for (const card of dimmed) {
            expect(card.getAttribute('style')).toBeNull();
            expect(card.className).toContain('disabled');
            expect(card.className).not.toContain('clickable');
        }
        const note = document.querySelector('.fey-taunt-no-uses');
        expect(note).toBeTruthy();
        expect(note.getAttribute('style')).toBeNull();
        expect(document.querySelectorAll('.sp-body [style]')).toHaveLength(0);
    });
});
