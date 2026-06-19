/* @improved-by-ai */
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import EncounterSummaryPanel from './EncounterSummaryPanel.jsx';

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
    it('renders total XP', () => {
      render(<EncounterSummaryPanel {...defaultProps} />);
      expect(screen.getByText('500')).toBeInTheDocument();
    });

    it('formats total XP with commas', () => {
      render(<EncounterSummaryPanel {...defaultProps} totalMonsterXP={10000} />);
      expect(screen.getByText('10,000')).toBeInTheDocument();
    });

    it('formats large total XP with commas', () => {
      render(<EncounterSummaryPanel {...defaultProps} totalMonsterXP={1234567} />);
      expect(screen.getByText('1,234,567')).toBeInTheDocument();
    });

    it('renders monster count', () => {
      render(<EncounterSummaryPanel {...defaultProps} />);
      expect(screen.getByText('3')).toBeInTheDocument();
    });

    it('renders zero monster count', () => {
      render(<EncounterSummaryPanel {...defaultProps} monsterCount={0} />);
      expect(screen.getByText('0')).toBeInTheDocument();
    });

    it('renders difficulty multiplier', () => {
      render(<EncounterSummaryPanel {...defaultProps} />);
      expect(screen.getByText('\u00D72')).toBeInTheDocument();
    });

    it('renders effective XP', () => {
      render(<EncounterSummaryPanel {...defaultProps} />);
      expect(screen.getByText('250')).toBeInTheDocument();
    });

    it('formats effective XP with commas', () => {
      render(<EncounterSummaryPanel {...defaultProps} effectiveXP={15000} />);
      expect(screen.getByText('15,000')).toBeInTheDocument();
    });
  });

  describe('difficulty label', () => {
    const difficultyTests = [
      { index: 0, expected: 'Easy' },
      { index: 1, expected: 'Medium' },
      { index: 2, expected: 'Hard' },
      { index: 3, expected: 'Deadly' },
    ];

    it.each(difficultyTests)(
      'renders $expected label for difficultyIndex $index',
      ({ index, expected }) => {
        render(<EncounterSummaryPanel {...defaultProps} difficultyIndex={index} />);
        expect(screen.getByText(expected)).toBeInTheDocument();
      },
    );

    it('renders Unknown when difficulty index is out of bounds', () => {
      render(<EncounterSummaryPanel {...defaultProps} difficultyIndex={5} />);
      expect(screen.getByText('Unknown')).toBeInTheDocument();
    });

    it('renders Unknown when difficultyLabels is null', () => {
      render(<EncounterSummaryPanel {...defaultProps} difficultyLabels={null} />);
      expect(screen.getByText('Unknown')).toBeInTheDocument();
    });

    it('renders Unknown when difficultyLabels is undefined', () => {
      const { rerender } = render(<EncounterSummaryPanel {...defaultProps} />);
      rerender(<EncounterSummaryPanel {...defaultProps} difficultyLabels={undefined} />);
      expect(screen.getByText('Unknown')).toBeInTheDocument();
    });

    it('renders Unknown when difficultyLabels entry is undefined', () => {
      render(<EncounterSummaryPanel {...defaultProps} difficultyLabels={[]} />);
      expect(screen.getByText('Unknown')).toBeInTheDocument();
    });
  });

  describe('difficulty value class', () => {
    const classTests = [
      { index: 0, expectedClass: 'summary-value-easy' },
      { index: 1, expectedClass: 'summary-value-medium' },
      { index: 2, expectedClass: 'summary-value-hard' },
      { index: 3, expectedClass: 'summary-value-deadly' },
    ];

    it.each(classTests)(
      'applies $expectedClass for difficultyIndex $index',
      ({ index, expectedClass }) => {
        render(<EncounterSummaryPanel {...defaultProps} difficultyIndex={index} />);
        const diffValue = screen.getByText(
          ['Easy', 'Medium', 'Hard', 'Deadly'][index] || 'Unknown',
        );
        expect(diffValue.className).toContain(expectedClass);
      },
    );

    it('applies empty class when difficultyIndex is out of bounds', () => {
      render(<EncounterSummaryPanel {...defaultProps} difficultyIndex={5} />);
      const diffValue = screen.getByText('Unknown');
      expect(diffValue.className).toBe('summary-value ');
    });
  });

  describe('Clear All button', () => {
    it('renders Clear All button when monsters are selected', () => {
      render(<EncounterSummaryPanel {...defaultProps} />);
      expect(screen.getByText('Clear All')).toBeInTheDocument();
    });

    it('does not render Clear All button when selectedMonsters is empty array', () => {
      render(<EncounterSummaryPanel {...defaultProps} selectedMonsters={[]} />);
      expect(screen.queryByText('Clear All')).not.toBeInTheDocument();
    });

    it('does not render Clear All button when selectedMonsters is null', () => {
      render(<EncounterSummaryPanel {...defaultProps} selectedMonsters={null} />);
      expect(screen.queryByText('Clear All')).not.toBeInTheDocument();
    });

    it('calls onClearMonsters when Clear All button is clicked', () => {
      render(<EncounterSummaryPanel {...defaultProps} />);
      screen.getByText('Clear All').click();
      expect(defaultProps.onClearMonsters).toHaveBeenCalledTimes(1);
    });
  });

  describe('summary labels', () => {
    it('renders all summary labels', () => {
      render(<EncounterSummaryPanel {...defaultProps} />);
      expect(screen.getByText('Total XP')).toBeInTheDocument();
      expect(screen.getByText('Monster Count')).toBeInTheDocument();
      expect(screen.getByText('Multiplier')).toBeInTheDocument();
      expect(screen.getByText('Effective XP')).toBeInTheDocument();
      expect(screen.getByText('Difficulty')).toBeInTheDocument();
    });
  });

  describe('zero XP handling', () => {
    it('renders zero total XP', () => {
      render(<EncounterSummaryPanel {...defaultProps} totalMonsterXP={0} />);
      expect(screen.getByText('0')).toBeInTheDocument();
    });

    it('renders zero effective XP', () => {
      render(<EncounterSummaryPanel {...defaultProps} effectiveXP={0} />);
      expect(screen.getByText('0')).toBeInTheDocument();
    });
  });
});
