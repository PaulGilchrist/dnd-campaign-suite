import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import StepsOfTheFeyTauntModal from './StepsOfTheFeyTauntModal.jsx';

vi.mock('../../../services/automation/common/savePrompt.js', () => ({
    createSaveListener: vi.fn(({ targetName, saveType, saveDc }) => ({
        promptId: `prompt-${targetName}`,
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
    getRuntimeValue: vi.fn((characterKey, propertyName, _campaignName) => {
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
    onClose: vi.fn(),
};

function makeProps(overrides) {
    return { ...baseProps, ...(overrides || {}) };
}

describe('StepsOfTheFeyTauntModal - Render', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
    });

    describe('initial render', () => {
        it('renders the feature name in the header with wand icon', () => {
            render(<StepsOfTheFeyTauntModal {...makeProps()} />);
            const header = document.querySelector('.sp-header');
            expect(header.textContent).toContain('Steps of the Fey');
            expect(header.querySelector('.fa-solid.fa-wand-sparkles')).toBeInTheDocument();
        });

        it('renders the choice prompt text', () => {
            render(<StepsOfTheFeyTauntModal {...makeProps()} />);
            expect(screen.getByText(/Choose how you use/)).toBeInTheDocument();
        });

        it('renders all four step options with labels', () => {
            render(<StepsOfTheFeyTauntModal {...makeProps()} />);
            expect(screen.getByText('Refreshing Step')).toBeInTheDocument();
            expect(screen.getByText('Taunting Step')).toBeInTheDocument();
            expect(screen.getByText('Disappearing Step')).toBeInTheDocument();
            expect(screen.getByText('Dreadful Step')).toBeInTheDocument();
        });

        it('renders the description for each step option', () => {
            render(<StepsOfTheFeyTauntModal {...makeProps()} />);
            expect(screen.getByText(/Gain 1d10 Temporary Hit Points/)).toBeInTheDocument();
            expect(screen.getByText(/Disadvantage on attack rolls/)).toBeInTheDocument();
            expect(screen.getByText(/Invisible condition/)).toBeInTheDocument();
            expect(screen.getByText(/2d10 Psychic damage/)).toBeInTheDocument();
        });

        it('renders the Skip button', () => {
            render(<StepsOfTheFeyTauntModal {...makeProps()} />);
            expect(screen.getByRole('button', { name: 'Skip' })).toBeInTheDocument();
        });

        it('renders the skip button with conditional text based on mode or title', async () => {
            const { rerender } = render(<StepsOfTheFeyTauntModal {...makeProps({ mode: 'mistyEscape' })} />);
            expect(screen.getByRole('button', { name: 'Misty Step only (free cast)' })).toBeInTheDocument();

            rerender(<StepsOfTheFeyTauntModal {...makeProps({ title: 'Bewitching Magic' })} />);
            expect(screen.getByRole('button', { name: 'Misty Step only (free cast)' })).toBeInTheDocument();
        });

        it('falls back to featureName in header when title is not provided', () => {
            render(<StepsOfTheFeyTauntModal {...makeProps({ title: undefined })} />);
            const header = document.querySelector('.sp-header');
            expect(header.textContent).toContain('Steps of the Fey');
        });
    });
});
