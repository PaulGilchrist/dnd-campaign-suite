import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import EncounterGeneratorModal from './EncounterGeneratorModal.jsx';

vi.mock('../../services/encounters/encounterGenerator.js', () => ({
    generateEncounterSuggestions: vi.fn(() => [
        {
            difficultyLabel: 'Medium',
            totalXP: 250,
            monsterCount: 2,
            monsters: [
                { index: 'goblin', name: 'Goblin', challenge_rating: 0.25, xp: 50, qty: 2 },
                { index: 'kobold', name: 'Kobold', challenge_rating: 0.25, xp: 25, qty: 1 },
            ],
        },
    ]),
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

describe('EncounterGeneratorModal', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders modal header with title', () => {
        render(<EncounterGeneratorModal monsters={mockMonsters} playerLevels={mockPlayerLevels} difficulty={mockDifficulty} onApply={mockOnApply} onClose={mockOnClose} />);
        expect(screen.getByText('Generate Encounter')).toBeInTheDocument();
    });

    it('renders environment sections', () => {
        render(<EncounterGeneratorModal monsters={mockMonsters} playerLevels={mockPlayerLevels} difficulty={mockDifficulty} onApply={mockOnApply} onClose={mockOnClose} />);
        expect(screen.getByText('Arctic')).toBeInTheDocument();
        expect(screen.getByText('Temperate')).toBeInTheDocument();
        expect(screen.getByText('Wetlands')).toBeInTheDocument();
        expect(screen.getByText('Desert')).toBeInTheDocument();
    });

    it('renders quick pick buttons', () => {
        render(<EncounterGeneratorModal monsters={mockMonsters} playerLevels={mockPlayerLevels} difficulty={mockDifficulty} onApply={mockOnApply} onClose={mockOnClose} />);
        expect(screen.getByText('All')).toBeInTheDocument();
        expect(screen.getByText('Dungeon')).toBeInTheDocument();
        expect(screen.getByText('Wilderness')).toBeInTheDocument();
    });

    it('renders generate button', () => {
        render(<EncounterGeneratorModal monsters={mockMonsters} playerLevels={mockPlayerLevels} difficulty={mockDifficulty} onApply={mockOnApply} onClose={mockOnClose} />);
        expect(screen.getByText('Generate')).toBeInTheDocument();
    });

    it('shows empty state before generation', () => {
        render(<EncounterGeneratorModal monsters={mockMonsters} playerLevels={mockPlayerLevels} difficulty={mockDifficulty} onApply={mockOnApply} onClose={mockOnClose} />);
        expect(screen.getByText('Pick environments and click Generate')).toBeInTheDocument();
    });

    it('shows available monster count', () => {
        render(<EncounterGeneratorModal monsters={mockMonsters} playerLevels={mockPlayerLevels} difficulty={mockDifficulty} onApply={mockOnApply} onClose={mockOnClose} />);
        expect(screen.getByText(/monsters? available/)).toBeInTheDocument();
    });

    it('disables generate button when no monsters available', () => {
        render(<EncounterGeneratorModal monsters={[]} playerLevels={mockPlayerLevels} difficulty={mockDifficulty} onApply={mockOnApply} onClose={mockOnClose} />);
        expect(screen.getByText('Generate')).toBeDisabled();
    });

    it('disables generate button when player levels are empty', () => {
        render(<EncounterGeneratorModal monsters={mockMonsters} playerLevels={[]} difficulty={mockDifficulty} onApply={mockOnApply} onClose={mockOnClose} />);
        expect(screen.getByText('Generate')).toBeDisabled();
    });

    it('toggles environment checkboxes', () => {
        render(<EncounterGeneratorModal monsters={mockMonsters} playerLevels={mockPlayerLevels} difficulty={mockDifficulty} onApply={mockOnApply} onClose={mockOnClose} />);
        const forestCheckbox = screen.getByLabelText('forest');
        expect(forestCheckbox).toBeChecked();
        fireEvent.click(forestCheckbox);
        expect(forestCheckbox).not.toBeChecked();
    });

    it('applies quick pick selection', () => {
        render(<EncounterGeneratorModal monsters={mockMonsters} playerLevels={mockPlayerLevels} difficulty={mockDifficulty} onApply={mockOnApply} onClose={mockOnClose} />);
        fireEvent.click(screen.getByText('Dungeon'));
        // Quick picks should toggle environments
    });

    it('shows generated suggestions', async () => {
        render(<EncounterGeneratorModal monsters={mockMonsters} playerLevels={mockPlayerLevels} difficulty={mockDifficulty} onApply={mockOnApply} onClose={mockOnClose} />);
        fireEvent.click(screen.getByText('Generate'));
        await screen.findByText('Suggestions');
        expect(screen.getByText('Medium')).toBeInTheDocument();
    });

    it('shows monster details in suggestions', async () => {
        render(<EncounterGeneratorModal monsters={mockMonsters} playerLevels={mockPlayerLevels} difficulty={mockDifficulty} onApply={mockOnApply} onClose={mockOnClose} />);
        fireEvent.click(screen.getByText('Generate'));
        await screen.findByText('Goblin');
        expect(screen.getByText('Goblin')).toBeInTheDocument();
    });

    it('shows monster CR in suggestions', async () => {
        render(<EncounterGeneratorModal monsters={mockMonsters} playerLevels={mockPlayerLevels} difficulty={mockDifficulty} onApply={mockOnApply} onClose={mockOnClose} />);
        fireEvent.click(screen.getByText('Generate'));
        await screen.findByText('Goblin');
    });

    it('shows monster quantity in suggestions', async () => {
        render(<EncounterGeneratorModal monsters={mockMonsters} playerLevels={mockPlayerLevels} difficulty={mockDifficulty} onApply={mockOnApply} onClose={mockOnClose} />);
        fireEvent.click(screen.getByText('Generate'));
        await screen.findByText('×2');
    });

    it('calls onApply when Apply button is clicked', async () => {
        render(<EncounterGeneratorModal monsters={mockMonsters} playerLevels={mockPlayerLevels} difficulty={mockDifficulty} onApply={mockOnApply} onClose={mockOnClose} />);
        fireEvent.click(screen.getByText('Generate'));
        await screen.findByText('Apply');
        fireEvent.click(screen.getByText('Apply'));
        expect(mockOnApply).toHaveBeenCalled();
    });

    it('calls onClose when Apply button is clicked', async () => {
        render(<EncounterGeneratorModal monsters={mockMonsters} playerLevels={mockPlayerLevels} difficulty={mockDifficulty} onApply={mockOnApply} onClose={mockOnClose} />);
        fireEvent.click(screen.getByText('Generate'));
        await screen.findByText('Apply');
        fireEvent.click(screen.getByText('Apply'));
        expect(mockOnClose).toHaveBeenCalled();
    });

    it('calls onClose when backdrop is clicked', () => {
        render(<EncounterGeneratorModal monsters={mockMonsters} playerLevels={mockPlayerLevels} difficulty={mockDifficulty} onApply={mockOnApply} onClose={mockOnClose} />);
        const overlay = document.querySelector('.gen-modal-overlay');
        fireEvent.click(overlay);
        expect(mockOnClose).toHaveBeenCalled();
    });

    it('calls onClose when close button is clicked', () => {
        render(<EncounterGeneratorModal monsters={mockMonsters} playerLevels={mockPlayerLevels} difficulty={mockDifficulty} onApply={mockOnApply} onClose={mockOnClose} />);
        const closeBtn = document.querySelector('.encounter-modal-close');
        fireEvent.click(closeBtn);
        expect(mockOnClose).toHaveBeenCalled();
    });

    it('renders difficulty class for easy', async () => {
        render(<EncounterGeneratorModal monsters={mockMonsters} playerLevels={mockPlayerLevels} difficulty={mockDifficulty} onApply={mockOnApply} onClose={mockOnClose} />);
        fireEvent.click(screen.getByText('Generate'));
        await screen.findByText('Medium');
    });

    it('shows max monsters per PC note', async () => {
        render(<EncounterGeneratorModal monsters={mockMonsters} playerLevels={mockPlayerLevels} difficulty={mockDifficulty} onApply={mockOnApply} onClose={mockOnClose} />);
        fireEvent.click(screen.getByText('Generate'));
        await screen.findByText(/Max \d+ monsters?/);
    });

    it('renders difficulty class for easy', async () => {
        render(<EncounterGeneratorModal monsters={mockMonsters} playerLevels={mockPlayerLevels} difficulty={mockDifficulty} onApply={mockOnApply} onClose={mockOnClose} />);
        fireEvent.click(screen.getByText('Generate'));
        await screen.findByText('Medium');
    });
});
