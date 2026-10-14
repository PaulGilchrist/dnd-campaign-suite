import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import EncounterSummaryPanel from './EncounterSummaryPanel.jsx';

describe('EncounterSummaryPanel', () => {
  let defaultProps;

  beforeEach(() => {
    defaultProps = {
      totalMonsterXP: 500,
      monsterCount: 3,
      difficultyMultiplier: 2,
      effectiveXP: 250,
      difficultyIndex: 2,
      difficultyLabels: ['Easy', 'Medium', 'Hard', 'Deadly'],
      difficultyColors: ['var(--color-success)', 'var(--color-warning)', '#fd7e14', 'var(--color-error)'],
      selectedMonsters: [
        { index: 'goblin', name: 'Goblin', xp: 50, qty: 2 },
      ],
      onClearMonsters: vi.fn(),
    };
  });

  describe('summary values', () => {
    it('renders total XP and effective XP formatted with thousand separators', () => {
      render(<EncounterSummaryPanel {...defaultProps} totalMonsterXP={10000} effectiveXP={15000} />);
      expect(screen.getByText('10,000')).toBeInTheDocument();
      expect(screen.getByText('15,000')).toBeInTheDocument();
    });

    it('renders zero XP values without separators', () => {
      render(<EncounterSummaryPanel {...defaultProps} totalMonsterXP={0} effectiveXP={0} />);
      expect(screen.getAllByText('0')).toHaveLength(2);
    });

    it('renders the monster count', () => {
      render(<EncounterSummaryPanel {...defaultProps} monsterCount={7} />);
      expect(screen.getByText('7')).toBeInTheDocument();
    });

    it('renders the difficulty multiplier prefixed with the multiplication sign', () => {
      render(<EncounterSummaryPanel {...defaultProps} difficultyMultiplier={3} />);
      expect(screen.getByText('\u00D73')).toBeInTheDocument();
    });
  });

  describe('difficulty label', () => {
    it.each([
      { index: 0, expected: 'Easy' },
      { index: 1, expected: 'Medium' },
      { index: 2, expected: 'Hard' },
      { index: 3, expected: 'Deadly' },
    ])('renders $expected label for difficultyIndex $index', ({ index, expected }) => {
      render(<EncounterSummaryPanel {...defaultProps} difficultyIndex={index} />);
      expect(screen.getByText(expected)).toBeInTheDocument();
    });

    it.each([
      ['an out-of-bounds index', { difficultyIndex: 5 }],
      ['a negative index', { difficultyIndex: -1 }],
      ['empty labels', { difficultyLabels: [], difficultyIndex: 0 }],
      ['undefined labels', { difficultyLabels: undefined, difficultyIndex: 0 }],
      ['an undefined index', { difficultyIndex: undefined }],
    ])('renders Unknown when given %s', (_description, overrides) => {
      render(<EncounterSummaryPanel {...defaultProps} {...overrides} />);
      expect(screen.getByText('Unknown')).toBeInTheDocument();
    });
  });

  describe('Clear All button', () => {
    it('renders when monsters are selected', () => {
      render(<EncounterSummaryPanel {...defaultProps} />);
      expect(screen.getByRole('button', { name: 'Clear All' })).toBeInTheDocument();
    });

    it.each([
      ['null', null],
      ['an empty array', []],
    ])('does not render when selectedMonsters is %s', (_description, selectedMonsters) => {
      render(<EncounterSummaryPanel {...defaultProps} selectedMonsters={selectedMonsters} />);
      expect(screen.queryByRole('button', { name: 'Clear All' })).not.toBeInTheDocument();
    });

    it('calls onClearMonsters when clicked', () => {
      render(<EncounterSummaryPanel {...defaultProps} />);
      fireEvent.click(screen.getByRole('button', { name: 'Clear All' }));
      expect(defaultProps.onClearMonsters).toHaveBeenCalledTimes(1);
    });
  });
});
