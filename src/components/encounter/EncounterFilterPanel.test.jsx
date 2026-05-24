import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import EncounterFilterPanel from './EncounterFilterPanel.jsx';

describe('EncounterFilterPanel', () => {
  let props;

  beforeEach(() => {
    props = {
      filter: {
        difficulty: 2,
        playerLevels: [5, 5],
        totalThreshold: 600,
        difficultyIndex: 2,
        difficultyLabels: ['Easy', 'Medium', 'Hard', 'Deadly'],
        difficultyColors: ['var(--color-success)', 'var(--color-warning)', '#fd7e14', 'var(--color-error)'],
      },
      onDifficultyChange: vi.fn(),
      onAddPlayer: vi.fn(),
      onRemovePlayer: vi.fn(),
      onPlayerLevelChange: vi.fn(),
    };
  });

  it('should render difficulty dropdown', () => {
    render(<EncounterFilterPanel {...props} />);
    const select = document.querySelector('#difficulty-select');
    expect(select).toBeInTheDocument();
    expect(select.value).toBe('2');
  });

  it('should render all difficulty options', () => {
    render(<EncounterFilterPanel {...props} />);
    expect(screen.getByText('Easy')).toBeInTheDocument();
    expect(screen.getByText('Medium')).toBeInTheDocument();
    expect(screen.getByText('Hard')).toBeInTheDocument();
    expect(screen.getByText('Deadly')).toBeInTheDocument();
  });

  it('should call onDifficultyChange when selection changes', () => {
    render(<EncounterFilterPanel {...props} />);
    const select = document.querySelector('#difficulty-select');
    fireEvent.change(select, { target: { value: '3' } });
    expect(props.onDifficultyChange).toHaveBeenCalled();
  });

  it('should render player level rows', () => {
    render(<EncounterFilterPanel {...props} />);
    expect(screen.getByText('PC 1')).toBeInTheDocument();
    expect(screen.getByText('PC 2')).toBeInTheDocument();
  });

  it('should render Add Player button', () => {
    render(<EncounterFilterPanel {...props} />);
    expect(screen.getByText('Add Player')).toBeInTheDocument();
  });

  it('should call onAddPlayer when Add Player clicked', () => {
    render(<EncounterFilterPanel {...props} />);
    fireEvent.click(screen.getByText('Add Player'));
    expect(props.onAddPlayer).toHaveBeenCalled();
  });

  it('should call onRemovePlayer when remove button clicked', () => {
    render(<EncounterFilterPanel {...props} />);
    fireEvent.click(screen.getByLabelText('Remove player 1'));
    expect(props.onRemovePlayer).toHaveBeenCalledWith(0);
  });

  it('should disable remove button when only one player', () => {
    render(<EncounterFilterPanel {...props} filter={{ ...props.filter, playerLevels: [5] }} />);
    expect(screen.getByLabelText('Remove player 1').disabled).toBe(true);
  });

  it('should call onPlayerLevelChange when level input changes', () => {
    render(<EncounterFilterPanel {...props} />);
    const input = document.querySelector('#player-level-0');
    fireEvent.change(input, { target: { value: '10' } });
    expect(props.onPlayerLevelChange).toHaveBeenCalledWith(0, 10);
  });

  it('should show threshold display with label', () => {
    render(<EncounterFilterPanel {...props} />);
    expect(screen.getByText(/600/)).toBeInTheDocument();
    const threshold = document.querySelector('.threshold-display');
    expect(threshold).toBeInTheDocument();
    expect(threshold.textContent).toContain('Target:');
    expect(threshold.textContent).toContain('Hard');
  });

  it('should show Unknown when difficultyLabels is missing', () => {
    render(<EncounterFilterPanel {...props} filter={{ ...props.filter, difficultyLabels: null }} />);
    const threshold = document.querySelector('.threshold-display');
    expect(threshold.textContent).toContain('Unknown');
  });
});
