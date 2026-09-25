// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { generateEncounterSuggestions } from '../../services/encounters/encounterGenerator.js';
import EncounterGeneratorModal from './EncounterGeneratorModal.jsx';

vi.mock('../../services/encounters/encounterGenerator.js', () => ({
  generateEncounterSuggestions: vi.fn(),
}));

const generateMock = vi.mocked(generateEncounterSuggestions);

const mockMonsters = [
  { index: 'goblin', name: 'Goblin', challenge_rating: 0.25, xp: 50, environments: ['forest', 'grassland'] },
  { index: 'kobold', name: 'Kobold', challenge_rating: 0.25, xp: 25, environments: ['dungeon', 'underdark'] },
  { index: 'orc', name: 'Orc', challenge_rating: 0.75, xp: 100, environments: ['forest', 'hill'] },
];

const defaultProps = {
  monsters: mockMonsters,
  playerLevels: [5, 5, 5],
  difficulty: 1,
};

const goblin = { index: 'goblin', name: 'Goblin', challenge_rating: 0.25, xp: 50, qty: 2 };
const kobold = { index: 'kobold', name: 'Kobold', challenge_rating: 0.25, xp: 25, qty: 1 };
const orc = { index: 'orc', name: 'Orc', challenge_rating: 0.75, xp: 100, qty: 2 };

const defaultSuggestions = [
  {
    difficultyLabel: 'Medium',
    totalXP: 250,
    monsterCount: 2,
    monsters: [goblin, kobold],
  },
];

const secondSuggestions = [
  {
    difficultyLabel: 'Hard',
    totalXP: 300,
    monsterCount: 3,
    monsters: [orc, kobold],
  },
];

function renderModal(overrides = {}) {
  const onApply = vi.fn();
  const onClose = vi.fn();
  const utils = render(
    <EncounterGeneratorModal
      {...defaultProps}
      {...overrides}
      onApply={onApply}
      onClose={onClose}
    />
  );
  return { onApply, onClose, unmount: utils.unmount, ...utils };
}

describe('EncounterGeneratorModal', () => {
  beforeEach(() => {
    generateMock.mockReset();
    generateMock.mockReturnValue([]);
  });

  describe('initial render', () => {
    it('renders the title and an enabled Generate button', () => {
      renderModal();
      expect(screen.getByText('Generate Encounter')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /generate/i })).not.toBeDisabled();
    });

    it('renders every environment group label and quick pick button', () => {
      renderModal();
      ['Arctic', 'Temperate', 'Wetlands', 'Desert', 'Underground', 'Aquatic', 'Urban'].forEach(label => {
        expect(screen.getByText(label)).toBeInTheDocument();
      });
      ['All', 'Dungeon', 'Wilderness'].forEach(pick => {
        expect(screen.getByRole('button', { name: pick })).toBeInTheDocument();
      });
    });

    it('shows the empty state and available monster count before generation', () => {
      renderModal();
      expect(screen.getByText('Pick environments and click Generate')).toBeInTheDocument();
      expect(screen.getByText(/3 monsters? available/)).toBeInTheDocument();
    });

    it('disables Generate and shows 0 monsters when monsters prop is empty array', () => {
      renderModal({ monsters: [] });
      expect(screen.getByText(/0 monsters? available/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /generate/i })).toBeDisabled();
    });

    it('disables Generate and shows 0 monsters when monsters prop is null', () => {
      renderModal({ monsters: null });
      expect(screen.getByText(/0 monsters? available/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /generate/i })).toBeDisabled();
    });

    it('disables Generate when player levels array is empty', () => {
      renderModal({ playerLevels: [] });
      expect(screen.getByRole('button', { name: /generate/i })).toBeDisabled();
    });

    it('disables Generate when no monsters match selected environments', () => {
      renderModal();
      // Unselect all environments so no monsters match
      ['forest', 'grassland', 'hill', 'underdark'].forEach(env => {
        fireEvent.click(screen.getByLabelText(env));
      });
      expect(screen.getByText(/0 monsters? available/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /generate/i })).toBeDisabled();
    });

    it('toggles individual environment checkboxes', () => {
      renderModal();
      const forestCheckbox = screen.getByLabelText('forest');
      expect(forestCheckbox).toBeChecked();
      fireEvent.click(forestCheckbox);
      expect(forestCheckbox).not.toBeChecked();
    });

    it('applies a quick pick to select exactly its environments', () => {
      renderModal();
      fireEvent.click(screen.getByRole('button', { name: 'Dungeon' }));
      expect(screen.getByLabelText('underdark')).toBeChecked();
      expect(screen.getByLabelText('urban')).toBeChecked();
      expect(screen.getByLabelText('forest')).not.toBeChecked();
      expect(screen.getByLabelText('grassland')).not.toBeChecked();
    });
  });

  describe('generation', () => {
    it('passes the selected environments and party info to the generator', () => {
      renderModal();
      fireEvent.click(screen.getByRole('button', { name: 'Dungeon' }));
      fireEvent.click(screen.getByRole('button', { name: /generate/i }));

      expect(generateMock).toHaveBeenCalledWith(expect.objectContaining({
        monsters: mockMonsters,
        playerLevels: defaultProps.playerLevels,
        difficulty: defaultProps.difficulty,
        count: 3,
        environments: ['underdark', 'urban'],
      }));
    });

    it('renders suggestions with difficulty, XP totals, and monster list', () => {
      generateMock.mockReturnValue(defaultSuggestions);
      renderModal();

      fireEvent.click(screen.getByRole('button', { name: /generate/i }));

      expect(screen.getByText('Suggestions')).toBeInTheDocument();
      expect(screen.getByText('Medium')).toBeInTheDocument();
      expect(screen.getByText(/250 XP/)).toBeInTheDocument();
      expect(screen.getByText(/2 monsters/)).toBeInTheDocument();
      expect(screen.getByText('Goblin')).toBeInTheDocument();
      expect(screen.getByText('Kobold')).toBeInTheDocument();
      expect(screen.getAllByText(/CR 0\.25/)).toHaveLength(2);
      expect(screen.getByText('×2')).toBeInTheDocument();
      expect(screen.getByText('×1')).toBeInTheDocument();
      expect(screen.getByText('50 XP')).toBeInTheDocument();
      expect(screen.getByText('25 XP')).toBeInTheDocument();
    });

    it('uses singular monster wording for a single-monster suggestion', () => {
      generateMock.mockReturnValue([{
        difficultyLabel: 'Easy',
        totalXP: 50,
        monsterCount: 1,
        monsters: [{ index: 'rat', name: 'Rat', challenge_rating: 0, xp: 50, qty: 1 }],
      }]);
      renderModal();

      fireEvent.click(screen.getByRole('button', { name: /generate/i }));

      expect(screen.getByText(/1 monster/)).toBeInTheDocument();
      expect(screen.getByText('Rat')).toBeInTheDocument();
    });

    it('hides empty state and shows Apply button when suggestions exist', () => {
      generateMock.mockReturnValue(defaultSuggestions);
      renderModal();
      fireEvent.click(screen.getByRole('button', { name: /generate/i }));
      expect(screen.queryByText('Pick environments and click Generate')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: /apply/i })).toBeInTheDocument();
    });

    it('keeps empty state visible when generation returns no suggestions', () => {
      renderModal();
      fireEvent.click(screen.getByRole('button', { name: /generate/i }));
      expect(screen.getByText('Pick environments and click Generate')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /apply/i })).not.toBeInTheDocument();
    });

    it('replaces previous suggestions when Generate is clicked again', () => {
      generateMock.mockReturnValue(defaultSuggestions);
      renderModal();

      fireEvent.click(screen.getByRole('button', { name: /generate/i }));
      expect(screen.getByText('Medium')).toBeInTheDocument();

      generateMock.mockReturnValue(secondSuggestions);
      fireEvent.click(screen.getByRole('button', { name: /generate/i }));

      expect(screen.getByText('Hard')).toBeInTheDocument();
      expect(screen.queryByText('Medium')).not.toBeInTheDocument();
    });

    it('renders each difficulty label with its corresponding diff class', () => {
      const labels = ['Easy', 'Medium', 'Hard', 'Deadly'];
      generateMock.mockReturnValue(labels.map(label => ({
        difficultyLabel: label,
        totalXP: 100,
        monsterCount: 1,
        monsters: [goblin],
      })));
      renderModal();
      fireEvent.click(screen.getByRole('button', { name: /generate/i }));

      labels.forEach(label => {
        const diffEl = screen.getByText(label).closest('.gen-suggestion-diff');
        expect(diffEl).toBeInTheDocument();
        expect(diffEl.textContent).toBe(label);
      });
    });

    it('does not call the generator when Generate is disabled', () => {
      renderModal({ monsters: [] });

      fireEvent.click(screen.getByRole('button', { name: /generate/i }));

      expect(generateMock).not.toHaveBeenCalled();
    });
  });

  describe('apply and close', () => {
    it('calls onApply with the suggestion monsters and onClose on Apply', () => {
      generateMock.mockReturnValue(defaultSuggestions);
      const { onApply, onClose } = renderModal();

      fireEvent.click(screen.getByRole('button', { name: /generate/i }));
      fireEvent.click(screen.getByRole('button', { name: /apply/i }));

      expect(onApply).toHaveBeenCalledWith(defaultSuggestions[0].monsters);
      expect(onClose).toHaveBeenCalled();
    });

    it('applies the monsters of the clicked suggestion when several exist', () => {
      generateMock.mockReturnValue([...defaultSuggestions, ...secondSuggestions]);
      const { onApply, onClose } = renderModal();

      fireEvent.click(screen.getByRole('button', { name: /generate/i }));
      fireEvent.click(screen.getAllByRole('button', { name: /apply/i })[1]);

      expect(onApply).toHaveBeenCalledWith(secondSuggestions[0].monsters);
      expect(onClose).toHaveBeenCalled();
    });

    it('calls onClose when the close button is clicked', () => {
      const { onClose } = renderModal();

      fireEvent.click(screen.getByRole('button', { name: /×/ }));

      expect(onClose).toHaveBeenCalled();
    });

    it('does not call onClose when the backdrop is clicked', () => {
      const { onClose, container } = renderModal();

      const overlay = container.querySelector('.gen-modal-overlay');
      fireEvent.click(overlay);

      expect(onClose).not.toHaveBeenCalled();
      expect(container.querySelector('.gen-modal')).toBeInTheDocument();
    });

    it('does not call onClose when the modal content is clicked', () => {
      const { onClose, container } = renderModal();

      const modal = container.querySelector('.gen-modal');
      fireEvent.click(modal);

      expect(onClose).not.toHaveBeenCalled();
    });
  });
});
