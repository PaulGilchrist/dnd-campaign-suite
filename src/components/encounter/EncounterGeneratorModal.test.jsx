// @maintained-by-ai
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

const suggestion = (difficultyLabel, xp, count, monsters) => ({
  difficultyLabel,
  totalXP: xp,
  monsterCount: count,
  monsters,
});

const defaultSuggestions = [suggestion('Medium', 250, 2, [goblin, kobold])];
const secondSuggestions = [suggestion('Hard', 300, 3, [orc, kobold])];

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

const checkedEnvNames = () =>
  screen.getAllByRole('checkbox')
    .filter(checkbox => checkbox.checked)
    .map(checkbox => checkbox.closest('label').textContent.trim());

const clickGenerate = () => fireEvent.click(screen.getByRole('button', { name: /generate/i }));

describe('EncounterGeneratorModal', () => {
  beforeEach(() => {
    generateMock.mockReset();
    generateMock.mockReturnValue([]);
  });

  it('opens with every environment selected, the empty state, a live monster count, and an enabled Generate', () => {
    renderModal();
    expect(screen.getByText('Generate Encounter')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /generate/i })).toBeEnabled();
    screen.getAllByRole('checkbox').forEach(checkbox => expect(checkbox).toBeChecked());
    ['All', 'Dungeon', 'Wilderness'].forEach(pick => {
      expect(screen.getByRole('button', { name: pick })).toBeInTheDocument();
    });
    expect(screen.getByText('3 monsters available')).toBeInTheDocument();
    expect(screen.getByText('Pick environments and click Generate')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /apply/i })).not.toBeInTheDocument();
  });

  it('unselecting every matching environment drops the count to 0 and blocks generation; the All quick pick restores it', () => {
    renderModal();
    ['forest', 'grassland', 'hill', 'underdark'].forEach(env => {
      fireEvent.click(screen.getByLabelText(env));
    });
    expect(screen.getByText('0 monsters available')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /generate/i })).toBeDisabled();
    clickGenerate();
    expect(generateMock).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'All' }));
    expect(screen.getByText('3 monsters available')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /generate/i })).toBeEnabled();
    clickGenerate();
    expect(generateMock).toHaveBeenCalledTimes(1);
  });

  it.each([
    { name: 'empty monsters array', props: { monsters: [] } },
    { name: 'null monsters', props: { monsters: null } },
    { name: 'empty player levels', props: { playerLevels: [] } },
  ])('disables Generate and never calls the generator with $name', ({ props }) => {
    renderModal(props);
    expect(screen.getByRole('button', { name: /generate/i })).toBeDisabled();
    clickGenerate();
    expect(generateMock).not.toHaveBeenCalled();
  });

  it('the Dungeon quick pick selects exactly its environments and Generate sends the exact payload', () => {
    renderModal();
    fireEvent.click(screen.getByRole('button', { name: 'Dungeon' }));
    expect(checkedEnvNames()).toEqual(['underdark', 'urban']);
    expect(screen.getByText('1 monster available')).toBeInTheDocument();

    clickGenerate();
    expect(generateMock).toHaveBeenCalledWith({
      monsters: mockMonsters,
      playerLevels: [5, 5, 5],
      difficulty: 1,
      environments: ['underdark', 'urban'],
      count: 3,
    });
  });

  it('renders a generated suggestion with difficulty, XP total, monster rows, and Apply', () => {
    generateMock.mockReturnValue(defaultSuggestions);
    renderModal();
    clickGenerate();

    expect(screen.getByText('Suggestions')).toBeInTheDocument();
    expect(screen.getByText('Max 3 monsters (one per PC)')).toBeInTheDocument();
    expect(screen.getByText('Medium')).toHaveClass('gen-suggestion-diff', 'gen-suggestion-diff-medium');
    expect(screen.getByText('250 XP · 2 monsters')).toBeInTheDocument();
    const rows = screen.getAllByRole('listitem').map(li => li.textContent);
    expect(rows).toEqual([
      'GoblinCR 0.25×250 XP',
      'KoboldCR 0.25×125 XP',
    ]);
    expect(screen.getByRole('button', { name: /apply/i })).toBeEnabled();
    expect(screen.queryByText('Pick environments and click Generate')).not.toBeInTheDocument();
  });

  it('uses singular wording for a single PC and a single monster', () => {
    const rat = { index: 'rat', name: 'Rat', challenge_rating: 0, xp: 50 };
    generateMock.mockReturnValue([suggestion('Easy', 50, 1, [{ ...rat, qty: 1 }])]);
    renderModal({
      monsters: [{ ...rat, environments: ['forest'] }],
      playerLevels: [7],
    });
    clickGenerate();

    expect(screen.getByText('1 monster available')).toBeInTheDocument();
    expect(screen.getByText('Easy')).toHaveClass('gen-suggestion-diff', 'gen-suggestion-diff-easy');
    expect(screen.getByText('Max 1 monster (one per PC)')).toBeInTheDocument();
    expect(screen.getByText('50 XP · 1 monster')).toBeInTheDocument();
  });

  it('keeps the empty state and offers no Apply when the generator returns no suggestions', () => {
    renderModal();
    clickGenerate();
    expect(screen.getByText('Pick environments and click Generate')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /apply/i })).not.toBeInTheDocument();
  });

  it('replaces previous suggestions when Generate is clicked again', () => {
    generateMock.mockReturnValue(defaultSuggestions);
    renderModal();
    clickGenerate();
    expect(screen.getByText('Medium')).toBeInTheDocument();

    generateMock.mockReturnValue(secondSuggestions);
    clickGenerate();
    expect(screen.getByText('Hard')).toBeInTheDocument();
    expect(screen.queryByText('Medium')).not.toBeInTheDocument();
    expect(generateMock).toHaveBeenCalledTimes(2);
  });

  it('falls back to the deadly modifier class for an unknown difficulty label', () => {
    generateMock.mockReturnValue([suggestion('Mystery', 100, 1, [goblin])]);
    renderModal();
    clickGenerate();
    expect(screen.getByText('Mystery')).toHaveClass('gen-suggestion-diff', 'gen-suggestion-diff-deadly');
  });

  it('applies the exact monster roster of the clicked suggestion, once, then requests close', () => {
    generateMock.mockReturnValue([defaultSuggestions[0], secondSuggestions[0]]);
    const { onApply, onClose, container } = renderModal();
    clickGenerate();

    const applyButtons = screen.getAllByRole('button', { name: /apply/i });
    expect(applyButtons).toHaveLength(2);
    expect(screen.getByText('Hard')).toHaveClass('gen-suggestion-diff', 'gen-suggestion-diff-hard');
    fireEvent.click(applyButtons[1]);

    expect(onApply).toHaveBeenCalledTimes(1);
    expect(onApply).toHaveBeenCalledWith([{ ...orc }, { ...kobold }]);
    expect(onClose).toHaveBeenCalledTimes(1);
    // Backdrop clicks carry no close behaviour: neither the overlay nor the
    // modal content has a click handler, so the modal must survive them.
    fireEvent.click(container.querySelector('.gen-modal-overlay'));
    fireEvent.click(container.querySelector('.gen-modal'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('the header close button is labelled "Close" (family convention) and closes without applying', () => {
    const { onApply, onClose } = renderModal();
    // Pinned like EncounterModal.test.jsx: role-by-accessible-name. Without
    // aria-label the × glyph is the whole name and this query resolves zero.
    const close = screen.getByRole('button', { name: 'Close' });
    expect(close).toHaveAttribute('aria-label', 'Close');
    fireEvent.click(close);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onApply).not.toHaveBeenCalled();
  });
});
