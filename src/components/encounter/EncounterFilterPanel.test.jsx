import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import EncounterFilterPanel from './EncounterFilterPanel.jsx';

describe('EncounterFilterPanel', () => {
  let props;

  const defaultFilter = {
    difficulty: 2,
    playerLevels: [5, 5],
    totalThreshold: 600,
    difficultyIndex: 2,
    difficultyLabels: ['Easy', 'Medium', 'Hard', 'Deadly'],
    difficultyColors: ['var(--color-success)', 'var(--color-warning)', '#fd7e14', 'var(--color-error)'],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    props = {
      filter: defaultFilter,
      onDifficultyChange: vi.fn(),
      onEnvironmentChange: vi.fn(),
      onAddPlayer: vi.fn(),
      onRemovePlayer: vi.fn(),
      onPlayerLevelChange: vi.fn(),
    };
  });

  describe('rendering', () => {
    it('renders the difficulty select, party label, and add player button', () => {
      render(<EncounterFilterPanel {...props} />);
      expect(screen.getByRole('combobox', { name: /difficulty/i })).toBeInTheDocument();
      expect(screen.getByText('Difficulty')).toBeInTheDocument();
      expect(screen.getByText('Party')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /add player/i })).toBeInTheDocument();
    });

    it('renders player level rows with inputs and remove buttons', () => {
      render(<EncounterFilterPanel {...props} />);
      expect(screen.getByText('PC 1')).toBeInTheDocument();
      expect(screen.getByText('PC 2')).toBeInTheDocument();
      expect(screen.getByLabelText('PC 1')).toHaveValue(5);
      expect(screen.getByLabelText('PC 2')).toHaveValue(5);
      expect(screen.getByLabelText('Remove player 1')).toBeInTheDocument();
      expect(screen.getByLabelText('Remove player 2')).toBeInTheDocument();
    });

    it('renders all four difficulty options', () => {
      render(<EncounterFilterPanel {...props} />);
      const options = screen.getAllByRole('option');
      expect(options.map((o) => o.value)).toEqual(['0', '1', '2', '3']);
      expect(options[0]).toHaveTextContent('Easy');
      expect(options[1]).toHaveTextContent('Medium');
      expect(options[2]).toHaveTextContent('Hard');
      expect(options[3]).toHaveTextContent('Deadly');
    });

    it('renders no player rows when playerLevels is empty', () => {
      render(<EncounterFilterPanel {...props} filter={{ ...props.filter, playerLevels: [] }} />);
      expect(screen.queryByText(/^PC \d+$/)).not.toBeInTheDocument();
    });

    it('disables the remove button when only one player remains', () => {
      render(<EncounterFilterPanel {...props} filter={{ ...props.filter, playerLevels: [5] }} />);
      expect(screen.getByLabelText('Remove player 1')).toBeDisabled();
    });

    it('sets min and max attributes on player level inputs', () => {
      render(<EncounterFilterPanel {...props} />);
      const input = screen.getByLabelText('PC 1');
      expect(input).toHaveAttribute('min', '1');
      expect(input).toHaveAttribute('max', '20');
    });
  });

  describe('difficulty dropdown', () => {
    it('renders with the correct difficulty value selected', () => {
      render(<EncounterFilterPanel {...props} filter={{ ...props.filter, difficulty: 0 }} />);
      expect(screen.getByRole('combobox', { name: /difficulty/i })).toHaveValue('0');
    });

    it('calls onDifficultyChange when selection changes', () => {
      render(<EncounterFilterPanel {...props} />);
      const select = screen.getByRole('combobox', { name: /difficulty/i });
      fireEvent.change(select, { target: { value: '3' } });
      expect(props.onDifficultyChange).toHaveBeenCalled();
    });
  });

  describe('player actions', () => {
    it('calls onAddPlayer when Add Player is clicked', () => {
      render(<EncounterFilterPanel {...props} />);
      fireEvent.click(screen.getByRole('button', { name: /add player/i }));
      expect(props.onAddPlayer).toHaveBeenCalled();
    });

    it('calls onRemovePlayer with the correct index', () => {
      render(<EncounterFilterPanel {...props} />);
      fireEvent.click(screen.getByLabelText('Remove player 1'));
      expect(props.onRemovePlayer).toHaveBeenCalledWith(0);
      fireEvent.click(screen.getByLabelText('Remove player 2'));
      expect(props.onRemovePlayer).toHaveBeenCalledWith(1);
    });

    it('calls onPlayerLevelChange with numeric index and converted number value', () => {
      render(<EncounterFilterPanel {...props} />);
      const input = screen.getByLabelText('PC 1');
      fireEvent.change(input, { target: { value: '10' } });
      expect(props.onPlayerLevelChange).toHaveBeenCalledWith(0, 10);
    });

    it('updates player level inputs when filter changes', () => {
      const { rerender } = render(<EncounterFilterPanel {...props} />);
      const input1 = screen.getByLabelText('PC 1');
      const input2 = screen.getByLabelText('PC 2');
      expect(input1).toHaveValue(5);
      expect(input2).toHaveValue(5);

      rerender(<EncounterFilterPanel {...props} filter={{ ...props.filter, playerLevels: [8, 12] }} />);
      expect(input1).toHaveValue(8);
      expect(input2).toHaveValue(12);
    });
  });

  describe('threshold display', () => {
    it('shows the threshold value formatted with toLocaleString', () => {
      render(<EncounterFilterPanel {...props} />);
      expect(screen.getByText(/600 XP/)).toBeInTheDocument();
    });

    it('shows the difficulty label in the threshold display', () => {
      render(<EncounterFilterPanel {...props} filter={{ ...props.filter, difficultyIndex: 0 }} />);
      expect(screen.getByText(/Target:.*Easy/)).toBeInTheDocument();
    });

    it('shows Unknown when difficultyLabels is null or out of bounds', () => {
      const { filter } = props;
      const { rerender } = render(<EncounterFilterPanel {...props} filter={{ ...filter, difficultyLabels: null }} />);
      expect(screen.getByText(/Unknown/)).toBeInTheDocument();

      rerender(<EncounterFilterPanel {...props} filter={{ ...filter, difficultyIndex: 10 }} />);
      expect(screen.getByText(/Unknown/)).toBeInTheDocument();
    });

    it('formats large thresholds with commas', () => {
      render(<EncounterFilterPanel {...props} filter={{ ...props.filter, totalThreshold: 15000 }} />);
      expect(screen.getByText(/15,000 XP/)).toBeInTheDocument();
    });

    it('falls back to default color when difficultyColors is null', () => {
      render(<EncounterFilterPanel {...props} filter={{ ...props.filter, difficultyColors: null }} />);
      expect(screen.getByText(/600 XP/)).toBeInTheDocument();
    });
  });
});
