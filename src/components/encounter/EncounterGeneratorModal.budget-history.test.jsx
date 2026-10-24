// @maintained-by-ai
// Budget indicators + last-roll persistence in the Generate suggestions modal.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { generateEncounterSuggestions } from '../../services/encounters/encounterGenerator.js';
import EncounterGeneratorModal from './EncounterGeneratorModal.jsx';

vi.mock('../../services/encounters/encounterGenerator.js', () => ({
  generateEncounterSuggestions: vi.fn(),
}));

const generateMock = vi.mocked(generateEncounterSuggestions);

const goblin = { index: 'goblin', name: 'Goblin', challenge_rating: 0.25, xp: 50, qty: 2 };
const kobold = { index: 'kobold', name: 'Kobold', challenge_rating: 0.25, xp: 25, qty: 1 };
const orc = { index: 'orc', name: 'Orc', challenge_rating: 0.75, xp: 100, qty: 9 };

const suggestion = (difficultyLabel, xp, count, monsters) => ({
  difficultyLabel,
  totalXP: xp,
  monsterCount: count,
  monsters,
});

const TARGET_XP = 1000;
const inBudget = [suggestion('Easy', 250, 2, [goblin, kobold])];
const overBudget = [suggestion('Hard', 1150, 3, [orc, kobold])];

function renderModal(overrides = {}) {
  const onApply = vi.fn();
  const onClose = vi.fn();
  const utils = render(
    <EncounterGeneratorModal
      monsters={[
        { ...goblin, environments: ['forest'] },
        { ...kobold, environments: ['underdark'] },
        { ...orc, environments: ['hill'] },
      ]}
      playerLevels={[5, 5, 5]}
      difficulty={1}
      targetXP={TARGET_XP}
      {...overrides}
      onApply={onApply}
      onClose={onClose}
    />
  );
  return { onApply, onClose, unmount: utils.unmount, container: utils.container, ...utils };
}

const clickGenerate = () => fireEvent.click(screen.getByRole('button', { name: /generate/i }));
const previousToggle = () => screen.getByRole('button', { name: /previous roll/i });

describe('EncounterGeneratorModal budget indicators', () => {
  beforeEach(() => {
    generateMock.mockReset();
    generateMock.mockReturnValue([]);
  });

  it('a within-budget row shows its XP total and a percentage-of-target indicator', () => {
    generateMock.mockReturnValue(inBudget);
    renderModal();
    clickGenerate();

    expect(screen.getByText('250 XP · 2 monsters')).toBeInTheDocument();
    const budget = screen.getByText('25% of target 1,000');
    expect(budget).toHaveClass('gen-suggestion-budget', 'gen-budget-within');
    expect(budget.closest('.gen-suggestion')).not.toHaveClass('gen-suggestion-over');
  });

  it('an over-target row is distinguished with the over-budget classes and a +Δ delta', () => {
    generateMock.mockReturnValue(overBudget);
    renderModal();
    clickGenerate();

    const budget = screen.getByText('115% of target 1,000 · +150 over');
    expect(budget).toHaveClass('gen-suggestion-budget', 'gen-budget-over');
    expect(budget.closest('.gen-suggestion')).toHaveClass('gen-suggestion-over');
  });

  it('no budget indicator renders when the target XP is missing', () => {
    generateMock.mockReturnValue(inBudget);
    const { container } = renderModal({ targetXP: undefined });
    clickGenerate();

    expect(screen.getByText('250 XP · 2 monsters')).toBeInTheDocument();
    expect(container.querySelector('.gen-suggestion-budget')).not.toBeInTheDocument();
  });
});

describe('EncounterGeneratorModal last-roll persistence', () => {
  beforeEach(() => {
    generateMock.mockReset();
    generateMock.mockReturnValue([]);
  });

  it('a re-roll parks the prior set in a collapsed Previous roll block and the newest set stays the active Suggestions', () => {
    generateMock.mockReturnValue(inBudget);
    renderModal();
    clickGenerate();
    expect(screen.queryByText(/previous roll/i)).not.toBeInTheDocument();

    generateMock.mockReturnValue(overBudget);
    clickGenerate();

    // Newest roll is the active one, still labeled Suggestions.
    expect(screen.getByText('Suggestions')).toBeInTheDocument();
    expect(screen.getByText('Hard')).toBeInTheDocument();
    // Prior roll preserved but collapsed: toggle visible, row content absent.
    const toggle = previousToggle();
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(toggle).toHaveTextContent('Previous roll (1 suggestion)');
    expect(screen.queryByText('Easy')).not.toBeInTheDocument();

    fireEvent.click(toggle);
    expect(previousToggle()).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Easy')).toBeInTheDocument();
    expect(screen.getByText('25% of target 1,000')).toBeInTheDocument();
  });

  it('Apply from the Previous roll block applies that stored set and closes', () => {
    generateMock.mockReturnValue(inBudget);
    const { onApply, onClose, container } = renderModal();
    clickGenerate();
    generateMock.mockReturnValue(overBudget);
    clickGenerate();

    fireEvent.click(previousToggle());
    const prevApply = container.querySelector('.gen-previous-roll .gen-apply-btn');
    fireEvent.click(prevApply);

    expect(onApply).toHaveBeenCalledTimes(1);
    expect(onApply).toHaveBeenCalledWith([goblin, kobold]);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('successive re-rolls stack exactly one deep and re-collapse the block', () => {
    const first = inBudget;
    const second = overBudget;
    const third = [suggestion('Medium', 500, 1, [goblin])];

    generateMock.mockReturnValue(first);
    const { container } = renderModal();
    clickGenerate();
    generateMock.mockReturnValue(second);
    clickGenerate();
    fireEvent.click(previousToggle());
    expect(container.querySelectorAll('.gen-previous-roll .gen-suggestion')).toHaveLength(1);

    generateMock.mockReturnValue(third);
    clickGenerate();

    // Previous is now the second roll only; the first roll is gone.
    const toggle = previousToggle();
    expect(toggle).toHaveTextContent('Previous roll (1 suggestion)');
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(toggle);
    expect(screen.getByText('Hard')).toBeInTheDocument();
    expect(screen.queryByText('Easy')).not.toBeInTheDocument();
  });

  it('an empty re-roll keeps the prior set available in Previous roll alongside the empty state', () => {
    generateMock.mockReturnValue(inBudget);
    renderModal();
    clickGenerate();
    generateMock.mockReturnValue([]);
    clickGenerate();

    expect(screen.getByText('Pick environments and click Generate')).toBeInTheDocument();
    fireEvent.click(previousToggle());
    expect(screen.getByText('Easy')).toBeInTheDocument();
    expect(screen.getByText('25% of target 1,000')).toBeInTheDocument();
  });

  it('fresh open starts clean: a remounted modal has no stale Previous roll block', () => {
    generateMock.mockReturnValue(inBudget);
    const first = renderModal();
    clickGenerate();
    generateMock.mockReturnValue(overBudget);
    clickGenerate();
    expect(previousToggle()).toBeInTheDocument();
    first.unmount();

    const second = renderModal();
    expect(screen.queryByText(/previous roll/i)).not.toBeInTheDocument();
    clickGenerate();
    expect(screen.queryByText(/previous roll/i)).not.toBeInTheDocument();
    second.unmount();
  });
});
