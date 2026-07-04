/* @improved-by-ai */
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import EncounterFilterPanel from './EncounterFilterPanel.jsx';

describe('EncounterFilterPanel', () => {
  let props;

  beforeEach(() => {
    vi.clearAllMocks();
    props = {
      filter: {
        difficulty: 2,
        playerLevels: [5, 5],
        totalThreshold: 600,
        environment: 'forest',
        difficultyIndex: 2,
        difficultyLabels: ['Easy', 'Medium', 'Hard', 'Deadly'],
        difficultyColors: ['var(--color-success)', 'var(--color-warning)', '#fd7e14', 'var(--color-error)'],
      },
      onDifficultyChange: vi.fn(),
      onEnvironmentChange: vi.fn(),
      onAddPlayer: vi.fn(),
      onRemovePlayer: vi.fn(),
      onPlayerLevelChange: vi.fn(),
    };
  });

  describe('difficulty dropdown', () => {
    it('renders the difficulty select with the correct value', () => {
      render(<EncounterFilterPanel {...props} />);
      const select = document.querySelector('#difficulty-select');
      expect(select).toBeInTheDocument();
      expect(select.value).toBe('2');
    });

    it('renders all four difficulty options', () => {
      render(<EncounterFilterPanel {...props} />);
      expect(screen.getByText('Easy')).toBeInTheDocument();
      expect(screen.getByText('Medium')).toBeInTheDocument();
      expect(screen.getByText('Hard')).toBeInTheDocument();
      expect(screen.getByText('Deadly')).toBeInTheDocument();
    });

    it('calls onDifficultyChange with the event when selection changes', () => {
      render(<EncounterFilterPanel {...props} />);
      const select = document.querySelector('#difficulty-select');
      fireEvent.change(select, { target: { value: '3' } });
      expect(props.onDifficultyChange).toHaveBeenCalledTimes(1);
    });

    it('defaults to Easy when difficulty is 0', () => {
      render(<EncounterFilterPanel {...props} filter={{ ...props.filter, difficulty: 0 }} />);
      const select = document.querySelector('#difficulty-select');
      expect(select.value).toBe('0');
    });
  });

  describe('environment dropdown', () => {
    it('renders the environment select with the correct value', () => {
      render(<EncounterFilterPanel {...props} />);
      const select = document.querySelector('#environment-select');
      expect(select).toBeInTheDocument();
      expect(select.value).toBe('forest');
    });

    it('renders all environment options', () => {
      render(<EncounterFilterPanel {...props} />);
      const select = document.querySelector('#environment-select');
      const options = select.querySelectorAll('option');
      const optionValues = Array.from(options).map(o => o.value);
      expect(optionValues).toContain('');
      expect(optionValues).toContain('arctic');
      expect(optionValues).toContain('coastal');
      expect(optionValues).toContain('desert');
      expect(optionValues).toContain('forest');
      expect(optionValues).toContain('grassland');
      expect(optionValues).toContain('hill');
      expect(optionValues).toContain('mountain');
      expect(optionValues).toContain('swamp');
      expect(optionValues).toContain('underdark');
      expect(optionValues).toContain('underwater');
      expect(optionValues).toContain('urban');
    });

    it('calls onEnvironmentChange with the event when selection changes', () => {
      render(<EncounterFilterPanel {...props} />);
      const select = document.querySelector('#environment-select');
      fireEvent.change(select, { target: { value: 'desert' } });
      expect(props.onEnvironmentChange).toHaveBeenCalledTimes(1);
    });


  });

  describe('player levels', () => {
    it('renders a row for each player level', () => {
      render(<EncounterFilterPanel {...props} />);
      expect(screen.getByText('PC 1')).toBeInTheDocument();
      expect(screen.getByText('PC 2')).toBeInTheDocument();
    });

    it('renders the Add Player button', () => {
      render(<EncounterFilterPanel {...props} />);
      expect(screen.getByText('Add Player')).toBeInTheDocument();
    });

    it('calls onAddPlayer when Add Player is clicked', () => {
      render(<EncounterFilterPanel {...props} />);
      fireEvent.click(screen.getByText('Add Player'));
      expect(props.onAddPlayer).toHaveBeenCalledTimes(1);
    });

    it('calls onRemovePlayer with the correct index when remove button is clicked', () => {
      render(<EncounterFilterPanel {...props} />);
      fireEvent.click(screen.getByLabelText('Remove player 1'));
      expect(props.onRemovePlayer).toHaveBeenCalledWith(0);
      fireEvent.click(screen.getByLabelText('Remove player 2'));
      expect(props.onRemovePlayer).toHaveBeenCalledWith(1);
    });

    it('disables the remove button when only one player remains', () => {
      render(<EncounterFilterPanel {...props} filter={{ ...props.filter, playerLevels: [5] }} />);
      expect(screen.getByLabelText('Remove player 1').disabled).toBe(true);
    });

    it('calls onPlayerLevelChange with numeric index and converted number value', () => {
      render(<EncounterFilterPanel {...props} />);
      const input = document.querySelector('#player-level-0');
      fireEvent.change(input, { target: { value: '10' } });
      expect(props.onPlayerLevelChange).toHaveBeenCalledWith(0, 10);
    });
  });

  describe('threshold display', () => {
    it('shows the threshold value formatted with toLocaleString', () => {
      render(<EncounterFilterPanel {...props} />);
      const threshold = document.querySelector('.threshold-display');
      expect(threshold).toBeInTheDocument();
      expect(threshold.textContent).toContain('600 XP');
    });

    it('shows the difficulty label from difficultyLabels', () => {
      render(<EncounterFilterPanel {...props} />);
      const threshold = document.querySelector('.threshold-display');
      expect(threshold.textContent).toContain('Hard');
    });

    it('shows the threshold border color from difficultyColors', () => {
      render(<EncounterFilterPanel {...props} />);
      const threshold = document.querySelector('.threshold-display');
      expect(threshold.style.borderLeftColor).toContain('rgb(253, 126, 20)');
    });

    it('shows Unknown when difficultyLabels is null', () => {
      render(<EncounterFilterPanel {...props} filter={{ ...props.filter, difficultyLabels: null }} />);
      const threshold = document.querySelector('.threshold-display');
      expect(threshold.textContent).toContain('Unknown');
    });

    it('uses default text color when difficultyColors is null', () => {
      render(<EncounterFilterPanel {...props} filter={{ ...props.filter, difficultyColors: null }} />);
      const threshold = document.querySelector('.threshold-display');
      expect(threshold.style.borderLeftColor).toContain('var(--color-text)');
    });

    it('shows 0 XP when totalThreshold is 0', () => {
      render(<EncounterFilterPanel {...props} filter={{ ...props.filter, totalThreshold: 0 }} />);
      const threshold = document.querySelector('.threshold-display');
      expect(threshold.textContent).toContain('0 XP');
    });

    it('shows negative threshold when totalThreshold is negative', () => {
      render(<EncounterFilterPanel {...props} filter={{ ...props.filter, totalThreshold: -100 }} />);
      const threshold = document.querySelector('.threshold-display');
      expect(threshold.textContent).toContain('-100 XP');
    });

    it('displays the Target: prefix', () => {
      render(<EncounterFilterPanel {...props} />);
      const threshold = document.querySelector('.threshold-display');
      expect(threshold.textContent).toContain('Target:');
    });
  });

  describe('accessibility', () => {
    it('provides aria-label on Add Player button', () => {
      render(<EncounterFilterPanel {...props} />);
      expect(screen.getByLabelText('Add player')).toBeInTheDocument();
    });

    it('provides aria-label on each remove button', () => {
      render(<EncounterFilterPanel {...props} />);
      expect(screen.getByLabelText('Remove player 1')).toBeInTheDocument();
      expect(screen.getByLabelText('Remove player 2')).toBeInTheDocument();
    });

    it('associates player level inputs with labels via htmlFor', () => {
      render(<EncounterFilterPanel {...props} />);
      const label1 = document.querySelector('label[for="player-level-0"]');
      const label2 = document.querySelector('label[for="player-level-1"]');
      expect(label1).toBeInTheDocument();
      expect(label1.textContent).toBe('PC 1');
      expect(label2).toBeInTheDocument();
      expect(label2.textContent).toBe('PC 2');
    });

    it('associates difficulty select with its label', () => {
      render(<EncounterFilterPanel {...props} />);
      const label = document.querySelector('label[for="difficulty-select"]');
      expect(label).toBeInTheDocument();
      expect(label.textContent).toBe('Difficulty');
    });

    it('associates environment select with its label', () => {
      render(<EncounterFilterPanel {...props} />);
      const label = document.querySelector('label[for="environment-select"]');
      expect(label).toBeInTheDocument();
      expect(label.textContent).toBe('Environment');
    });
  });
});
