import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import EncounterSummaryPanel from './EncounterSummaryPanel.jsx';

describe('EncounterSummaryPanel', () => {
  const defaultProps = {
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

  it('should render total XP', () => {
    render(<EncounterSummaryPanel {...defaultProps} />);
    expect(screen.getByText('500')).toBeInTheDocument();
  });

  it('should render formatted total XP', () => {
    render(<EncounterSummaryPanel {...defaultProps} totalMonsterXP={10000} />);
    expect(screen.getByText('10,000')).toBeInTheDocument();
  });

  it('should render monster count', () => {
    render(<EncounterSummaryPanel {...defaultProps} />);
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('should render difficulty multiplier', () => {
    render(<EncounterSummaryPanel {...defaultProps} />);
    expect(screen.getByText('\u00D72')).toBeInTheDocument();
  });

  it('should render effective XP', () => {
    render(<EncounterSummaryPanel {...defaultProps} />);
    expect(screen.getByText('250')).toBeInTheDocument();
  });

  it('should render difficulty label', () => {
    render(<EncounterSummaryPanel {...defaultProps} />);
    expect(screen.getByText('Hard')).toBeInTheDocument();
  });

  it('should render Easy difficulty label', () => {
    render(<EncounterSummaryPanel {...defaultProps} difficultyIndex={0} />);
    expect(screen.getByText('Easy')).toBeInTheDocument();
  });

  it('should render Deadly difficulty label', () => {
    render(<EncounterSummaryPanel {...defaultProps} difficultyIndex={3} />);
    expect(screen.getByText('Deadly')).toBeInTheDocument();
  });

  it('should render Unknown when difficulty index is out of bounds', () => {
    render(<EncounterSummaryPanel {...defaultProps} difficultyIndex={5} />);
    expect(screen.getByText('Unknown')).toBeInTheDocument();
  });

  it('should show Clear All button when monsters are selected', () => {
    render(<EncounterSummaryPanel {...defaultProps} />);
    expect(screen.getByText('Clear All')).toBeInTheDocument();
  });

  it('should hide Clear All button when no monsters selected', () => {
    render(<EncounterSummaryPanel {...defaultProps} selectedMonsters={[]} />);
    expect(screen.queryByText('Clear All')).not.toBeInTheDocument();
  });

  it('should render all summary labels', () => {
    render(<EncounterSummaryPanel {...defaultProps} />);
    expect(screen.getByText('Total XP')).toBeInTheDocument();
    expect(screen.getByText('Monster Count')).toBeInTheDocument();
    expect(screen.getByText('Multiplier')).toBeInTheDocument();
    expect(screen.getByText('Effective XP')).toBeInTheDocument();
    expect(screen.getByText('Difficulty')).toBeInTheDocument();
  });

  it('should apply difficulty value class', () => {
    render(<EncounterSummaryPanel {...defaultProps} />);
    const diffValue = screen.getByText('Hard');
    expect(diffValue.className).toContain('summary-value-hard');
  });
});
