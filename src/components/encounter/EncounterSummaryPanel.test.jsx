import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import EncounterSummaryPanel from './EncounterSummaryPanel.jsx';

// @cleaned-by-ai

describe('EncounterSummaryPanel', () => {
  let defaultProps;

  beforeEach(() => {
    vi.clearAllMocks();
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

  describe('rendering summary values', () => {
    it('renders formatted total XP and effective XP with commas', () => {
      render(<EncounterSummaryPanel {...defaultProps} totalMonsterXP={10000} effectiveXP={15000} />);
      expect(screen.getByText('10,000')).toBeInTheDocument();
      expect(screen.getByText('15,000')).toBeInTheDocument();
    });

    it('renders monster count', () => {
      render(<EncounterSummaryPanel {...defaultProps} />);
      expect(screen.getByText('3')).toBeInTheDocument();
    });

    it('renders difficulty multiplier', () => {
      render(<EncounterSummaryPanel {...defaultProps} />);
      expect(screen.getByText('\u00D72')).toBeInTheDocument();
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

    it('renders Unknown when difficultyIndex is out of bounds or labels are empty', () => {
      render(<EncounterSummaryPanel {...defaultProps} difficultyIndex={5} />);
      expect(screen.getByText('Unknown')).toBeInTheDocument();
    });

    it('renders Unknown when difficultyLabels is empty', () => {
      render(<EncounterSummaryPanel {...defaultProps} difficultyLabels={[]} difficultyIndex={0} />);
      expect(screen.getByText('Unknown')).toBeInTheDocument();
    });
  });

  describe('Clear All button', () => {
    it('renders when monsters are selected', () => {
      render(<EncounterSummaryPanel {...defaultProps} />);
      expect(screen.getByText('Clear All')).toBeInTheDocument();
    });

    it('does not render when selectedMonsters is null or empty', () => {
      render(<EncounterSummaryPanel {...defaultProps} selectedMonsters={null} />);
      expect(screen.queryByText('Clear All')).not.toBeInTheDocument();
    });

    it('calls onClearMonsters when clicked', () => {
      render(<EncounterSummaryPanel {...defaultProps} />);
      screen.getByText('Clear All').click();
      expect(defaultProps.onClearMonsters).toHaveBeenCalledTimes(1);
    });
  });
});
