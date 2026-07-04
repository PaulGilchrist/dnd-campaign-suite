/* @cleaned-by-ai */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import EncounterGeneratorModal from './EncounterGeneratorModal.jsx';

vi.mock('../../services/encounters/encounterGenerator.js', () => ({
    generateEncounterSuggestions: vi.fn(),
}));

const mockMonsters = [
    { index: 'goblin', name: 'Goblin', challenge_rating: 0.25, xp: 50, environments: ['forest', 'grassland'] },
    { index: 'kobold', name: 'Kobold', challenge_rating: 0.25, xp: 25, environments: ['dungeon', 'underdark'] },
    { index: 'orc', name: 'Orc', challenge_rating: 0.75, xp: 100, environments: ['forest', 'hill'] },
];

const mockPlayerLevels = [5, 5, 5];
const mockDifficulty = 1;
const mockOnApply = vi.fn();
const mockOnClose = vi.fn();

const defaultSuggestions = [
    {
        difficultyLabel: 'Medium',
        totalXP: 250,
        monsterCount: 2,
        monsters: [
            { index: 'goblin', name: 'Goblin', challenge_rating: 0.25, xp: 50, qty: 2 },
            { index: 'kobold', name: 'Kobold', challenge_rating: 0.25, xp: 25, qty: 1 },
        ],
    },
];

const emptySuggestions = [];

describe('EncounterGeneratorModal', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('initial render', () => {
        it('renders modal header with title, wand icon, and generate button', () => {
            render(
                <EncounterGeneratorModal
                    monsters={mockMonsters}
                    playerLevels={mockPlayerLevels}
                    difficulty={mockDifficulty}
                    onApply={mockOnApply}
                    onClose={mockOnClose}
                />
            );
            expect(screen.getByText('Generate Encounter')).toBeInTheDocument();
            expect(screen.getByRole('button', { name: /generate/i })).toBeInTheDocument();
            expect(screen.getByRole('button', { name: /generate/i })).not.toBeDisabled();
        });

        it('renders all environment group labels and quick pick buttons', () => {
            render(
                <EncounterGeneratorModal
                    monsters={mockMonsters}
                    playerLevels={mockPlayerLevels}
                    difficulty={mockDifficulty}
                    onApply={mockOnApply}
                    onClose={mockOnClose}
                />
            );
            expect(screen.getByText('Arctic')).toBeInTheDocument();
            expect(screen.getByText('Temperate')).toBeInTheDocument();
            expect(screen.getByText('Wetlands')).toBeInTheDocument();
            expect(screen.getByText('Desert')).toBeInTheDocument();
            expect(screen.getByText('Underground')).toBeInTheDocument();
            expect(screen.getByText('Aquatic')).toBeInTheDocument();
            expect(screen.getByText('Urban')).toBeInTheDocument();
            expect(screen.getByText('All')).toBeInTheDocument();
            expect(screen.getByText('Dungeon')).toBeInTheDocument();
            expect(screen.getByText('Wilderness')).toBeInTheDocument();
        });

        it('shows empty state and monster count before generation', () => {
            render(
                <EncounterGeneratorModal
                    monsters={mockMonsters}
                    playerLevels={mockPlayerLevels}
                    difficulty={mockDifficulty}
                    onApply={mockOnApply}
                    onClose={mockOnClose}
                />
            );
            expect(screen.getByText('Pick environments and click Generate')).toBeInTheDocument();
            expect(screen.getByText(/3 monsters? available/)).toBeInTheDocument();
        });

        it('disables generate button when no monsters available', () => {
            render(
                <EncounterGeneratorModal
                    monsters={[]}
                    playerLevels={mockPlayerLevels}
                    difficulty={mockDifficulty}
                    onApply={mockOnApply}
                    onClose={mockOnClose}
                />
            );
            expect(screen.getByRole('button', { name: /generate/i })).toBeDisabled();
        });

        it('disables generate button when player levels are empty', () => {
            render(
                <EncounterGeneratorModal
                    monsters={mockMonsters}
                    playerLevels={[]}
                    difficulty={mockDifficulty}
                    onApply={mockOnApply}
                    onClose={mockOnClose}
                />
            );
            expect(screen.getByRole('button', { name: /generate/i })).toBeDisabled();
        });

        it('disables generate button when monsters is null', () => {
            render(
                <EncounterGeneratorModal
                    monsters={null}
                    playerLevels={mockPlayerLevels}
                    difficulty={mockDifficulty}
                    onApply={mockOnApply}
                    onClose={mockOnClose}
                />
            );
            expect(screen.getByRole('button', { name: /generate/i })).toBeDisabled();
        });

        it('shows 0 monsters available when no monsters match selected environments', () => {
            render(
                <EncounterGeneratorModal
                    monsters={mockMonsters}
                    playerLevels={mockPlayerLevels}
                    difficulty={mockDifficulty}
                    onApply={mockOnApply}
                    onClose={mockOnClose}
                />
            );
            // Unselect all environment checkboxes so none match
            const forestCheckbox = screen.getByLabelText('forest');
            const grasslandCheckbox = screen.getByLabelText('grassland');
            const hillCheckbox = screen.getByLabelText('hill');
            const underdarkCheckbox = screen.getByLabelText('underdark');
            fireEvent.click(forestCheckbox);
            fireEvent.click(grasslandCheckbox);
            fireEvent.click(hillCheckbox);
            fireEvent.click(underdarkCheckbox);
            expect(screen.getByText(/0 monsters? available/)).toBeInTheDocument();
        });

        it('toggles individual environment checkboxes', () => {
            render(
                <EncounterGeneratorModal
                    monsters={mockMonsters}
                    playerLevels={mockPlayerLevels}
                    difficulty={mockDifficulty}
                    onApply={mockOnApply}
                    onClose={mockOnClose}
                />
            );
            const forestCheckbox = screen.getByLabelText('forest');
            expect(forestCheckbox).toBeChecked();
            fireEvent.click(forestCheckbox);
            expect(forestCheckbox).not.toBeChecked();
        });

        it('applies quick pick to filter environments', () => {
            render(
                <EncounterGeneratorModal
                    monsters={mockMonsters}
                    playerLevels={mockPlayerLevels}
                    difficulty={mockDifficulty}
                    onApply={mockOnApply}
                    onClose={mockOnClose}
                />
            );
            // Dungeon quick pick selects only underdark and urban
            fireEvent.click(screen.getByText('Dungeon'));
            expect(screen.getByLabelText('underdark')).toBeChecked();
            expect(screen.getByLabelText('urban')).toBeChecked();
            expect(screen.getByLabelText('forest')).not.toBeChecked();
            expect(screen.getByLabelText('grassland')).not.toBeChecked();
        });
    });

    describe('generation', () => {
        it('passes selected environments to generateEncounterSuggestions', async () => {
            const { generateEncounterSuggestions } = await import('../../services/encounters/encounterGenerator.js');
            generateEncounterSuggestions.mockReturnValue(emptySuggestions);

            render(
                <EncounterGeneratorModal
                    monsters={mockMonsters}
                    playerLevels={mockPlayerLevels}
                    difficulty={mockDifficulty}
                    onApply={mockOnApply}
                    onClose={mockOnClose}
                />
            );

            // Deselect forest and hill so only grassland, underdark, and urban remain selected
            fireEvent.click(screen.getByLabelText('forest'));
            fireEvent.click(screen.getByLabelText('hill'));
            fireEvent.click(screen.getByText('Generate'));

            expect(generateEncounterSuggestions).toHaveBeenCalledWith(
                expect.objectContaining({
                    monsters: mockMonsters,
                    playerLevels: mockPlayerLevels,
                    difficulty: mockDifficulty,
                    count: 3,
                })
            );
        });

        it('shows generated suggestions with difficulty, XP, and monster list', async () => {
            const { generateEncounterSuggestions } = await import('../../services/encounters/encounterGenerator.js');
            generateEncounterSuggestions.mockReturnValue(defaultSuggestions);

            render(
                <EncounterGeneratorModal
                    monsters={mockMonsters}
                    playerLevels={mockPlayerLevels}
                    difficulty={mockDifficulty}
                    onApply={mockOnApply}
                    onClose={mockOnClose}
                />
            );

            fireEvent.click(screen.getByRole('button', { name: /generate/i }));

            expect(screen.getByText('Suggestions')).toBeInTheDocument();
            expect(screen.getByText('Medium')).toBeInTheDocument();
            expect(screen.getByText(/250 XP/)).toBeInTheDocument();
            expect(screen.getByText(/2 monsters?/)).toBeInTheDocument();
            expect(screen.getByText('Goblin')).toBeInTheDocument();
            expect(screen.getByText('Kobold')).toBeInTheDocument();
            expect(screen.getAllByText(/CR 0\.25/)).toHaveLength(2);
            expect(screen.getByText(/×2/)).toBeInTheDocument();
            expect(screen.getByText(/×1/)).toBeInTheDocument();
        });

        it('shows max monsters per PC note with correct count', async () => {
            const { generateEncounterSuggestions } = await import('../../services/encounters/encounterGenerator.js');
            generateEncounterSuggestions.mockReturnValue(defaultSuggestions);

            render(
                <EncounterGeneratorModal
                    monsters={mockMonsters}
                    playerLevels={mockPlayerLevels}
                    difficulty={mockDifficulty}
                    onApply={mockOnApply}
                    onClose={mockOnClose}
                />
            );

            fireEvent.click(screen.getByRole('button', { name: /generate/i }));

            expect(screen.getByText(/Max 3 monsters? \(one per PC\)/)).toBeInTheDocument();
        });

        it('shows empty XP and quantity for single monster', async () => {
            const { generateEncounterSuggestions } = await import('../../services/encounters/encounterGenerator.js');
            generateEncounterSuggestions.mockReturnValue([{
                difficultyLabel: 'Easy',
                totalXP: 50,
                monsterCount: 1,
                monsters: [{ index: 'rat', name: 'Rat', challenge_rating: 0, xp: 50, qty: 1 }],
            }]);

            render(
                <EncounterGeneratorModal
                    monsters={mockMonsters}
                    playerLevels={mockPlayerLevels}
                    difficulty={mockDifficulty}
                    onApply={mockOnApply}
                    onClose={mockOnClose}
                />
            );

            fireEvent.click(screen.getByRole('button', { name: /generate/i }));

            expect(screen.getByText(/1 monster/)).toBeInTheDocument();
            expect(screen.getByText('Rat')).toBeInTheDocument();
        });

        it('shows empty state when no suggestions are returned', async () => {
            const { generateEncounterSuggestions } = await import('../../services/encounters/encounterGenerator.js');
            generateEncounterSuggestions.mockReturnValue(emptySuggestions);

            render(
                <EncounterGeneratorModal
                    monsters={mockMonsters}
                    playerLevels={mockPlayerLevels}
                    difficulty={mockDifficulty}
                    onApply={mockOnApply}
                    onClose={mockOnClose}
                />
            );

            fireEvent.click(screen.getByRole('button', { name: /generate/i }));

            expect(screen.getByText('Pick environments and click Generate')).toBeInTheDocument();
        });

        it('renders difficulty badge with correct CSS class for each difficulty level', async () => {
            const { generateEncounterSuggestions } = await import('../../services/encounters/encounterGenerator.js');

            const difficulties = [
                { label: 'Easy', className: 'gen-suggestion-diff-easy' },
                { label: 'Medium', className: 'gen-suggestion-diff-medium' },
                { label: 'Hard', className: 'gen-suggestion-diff-hard' },
                { label: 'Deadly', className: 'gen-suggestion-diff-deadly' },
            ];

            for (const { label, className } of difficulties) {
                generateEncounterSuggestions.mockReturnValue([{
                    difficultyLabel: label,
                    totalXP: 100,
                    monsterCount: 1,
                    monsters: [{ index: 'goblin', name: 'Goblin', challenge_rating: 0.25, xp: 100, qty: 1 }],
                }]);

                cleanup();
                render(
                    <EncounterGeneratorModal
                        monsters={mockMonsters}
                        playerLevels={mockPlayerLevels}
                        difficulty={mockDifficulty}
                        onApply={mockOnApply}
                        onClose={mockOnClose}
                    />
                );

                fireEvent.click(screen.getByRole('button', { name: /generate/i }));

                const diffEl = screen.getByText(label).closest('.gen-suggestion-diff');
                expect(diffEl).toHaveClass(className);
            }
        });
    });

    describe('apply and close', () => {
        it('calls onApply with monster list and onClose when Apply button is clicked', async () => {
            const { generateEncounterSuggestions } = await import('../../services/encounters/encounterGenerator.js');
            generateEncounterSuggestions.mockReturnValue(defaultSuggestions);

            render(
                <EncounterGeneratorModal
                    monsters={mockMonsters}
                    playerLevels={mockPlayerLevels}
                    difficulty={mockDifficulty}
                    onApply={mockOnApply}
                    onClose={mockOnClose}
                />
            );

            fireEvent.click(screen.getByRole('button', { name: /generate/i }));
            fireEvent.click(screen.getByRole('button', { name: /apply/i }));

            expect(mockOnApply).toHaveBeenCalledWith(defaultSuggestions[0].monsters);
            expect(mockOnClose).toHaveBeenCalled();
        });

        it('calls onClose when backdrop is clicked', () => {
            render(
                <EncounterGeneratorModal
                    monsters={mockMonsters}
                    playerLevels={mockPlayerLevels}
                    difficulty={mockDifficulty}
                    onApply={mockOnApply}
                    onClose={mockOnClose}
                />
            );
            const overlay = document.querySelector('.gen-modal-overlay');
            fireEvent.click(overlay);
            expect(mockOnClose).toHaveBeenCalled();
        });

        it('does not call onClose when modal content is clicked', () => {
            render(
                <EncounterGeneratorModal
                    monsters={mockMonsters}
                    playerLevels={mockPlayerLevels}
                    difficulty={mockDifficulty}
                    onApply={mockOnApply}
                    onClose={mockOnClose}
                />
            );
            const modal = document.querySelector('.gen-modal');
            fireEvent.click(modal);
            expect(mockOnClose).not.toHaveBeenCalled();
        });

        it('calls onClose when close button is clicked', () => {
            render(
                <EncounterGeneratorModal
                    monsters={mockMonsters}
                    playerLevels={mockPlayerLevels}
                    difficulty={mockDifficulty}
                    onApply={mockOnApply}
                    onClose={mockOnClose}
                />
            );
            const closeBtn = document.querySelector('.encounter-modal-close');
            fireEvent.click(closeBtn);
            expect(mockOnClose).toHaveBeenCalled();
        });
    });
});
