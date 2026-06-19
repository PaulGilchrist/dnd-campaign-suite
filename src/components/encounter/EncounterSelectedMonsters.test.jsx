/* @improved-by-ai */
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import EncounterSelectedMonsters from './EncounterSelectedMonsters.jsx';

describe('EncounterSelectedMonsters', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const baseMonster = {
    index: 'goblin',
    name: 'Goblin',
    xp: 50,
    challenge_rating: 0.25,
  };

  describe('empty/null state', () => {
    it('returns null when selectedMonsters is null', () => {
      const { container } = render(
        <EncounterSelectedMonsters selectedMonsters={null} onRemoveMonster={vi.fn()} />
      );
      expect(container.innerHTML).toBe('');
    });

    it('returns null when selectedMonsters is an empty array', () => {
      const { container } = render(
        <EncounterSelectedMonsters selectedMonsters={[]} onRemoveMonster={vi.fn()} />
      );
      expect(container.innerHTML).toBe('');
    });
  });

  describe('monster list rendering', () => {
    it('renders the section header with total monster count', () => {
      render(
        <EncounterSelectedMonsters
          selectedMonsters={[
            { ...baseMonster },
            { index: 'orc', name: 'Orc', xp: 100, challenge_rating: 0.5 },
          ]}
          onRemoveMonster={vi.fn()}
        />
      );
      expect(screen.getByText('Selected Monsters (2)')).toBeInTheDocument();
    });

    it('renders total count that includes qty multipliers', () => {
      render(
        <EncounterSelectedMonsters
          selectedMonsters={[
            { ...baseMonster, qty: 3 },
            { index: 'orc', name: 'Orc', xp: 100, challenge_rating: 0.5, qty: 2 },
          ]}
          onRemoveMonster={vi.fn()}
        />
      );
      expect(screen.getByText('Selected Monsters (5)')).toBeInTheDocument();
    });

    it('defaults qty to 1 when not provided', () => {
      render(
        <EncounterSelectedMonsters
          selectedMonsters={[{ ...baseMonster }]}
          onRemoveMonster={vi.fn()}
        />
      );
      expect(screen.getByText('Selected Monsters (1)')).toBeInTheDocument();
    });

    it('renders monster names in the list', () => {
      render(
        <EncounterSelectedMonsters
          selectedMonsters={[
            { index: 'goblin', name: 'Goblin', xp: 50, challenge_rating: 0.25 },
            { index: 'orc', name: 'Orc', xp: 100, challenge_rating: 0.5 },
          ]}
          onRemoveMonster={vi.fn()}
        />
      );
      expect(screen.getByText('Goblin')).toBeInTheDocument();
      expect(screen.getByText('Orc')).toBeInTheDocument();
    });

    it('renders CR for each monster', () => {
      render(
        <EncounterSelectedMonsters
          selectedMonsters={[
            { index: 'goblin', name: 'Goblin', xp: 50, challenge_rating: 0.25 },
            { index: 'orc', name: 'Orc', xp: 100, challenge_rating: 0.5 },
          ]}
          onRemoveMonster={vi.fn()}
        />
      );
      expect(screen.getByText('CR 0.25')).toBeInTheDocument();
      expect(screen.getByText('CR 0.5')).toBeInTheDocument();
    });

    it('renders XP for each monster', () => {
      render(
        <EncounterSelectedMonsters
          selectedMonsters={[
            { index: 'goblin', name: 'Goblin', xp: 50, challenge_rating: 0.25 },
          ]}
          onRemoveMonster={vi.fn()}
        />
      );
      expect(screen.getByText('50 XP')).toBeInTheDocument();
    });

    it('formats XP with thousands separators', () => {
      render(
        <EncounterSelectedMonsters
          selectedMonsters={[
            { index: 'dragon', name: 'Dragon', xp: 5900, challenge_rating: 10 },
          ]}
          onRemoveMonster={vi.fn()}
        />
      );
      expect(screen.getByText('5,900 XP')).toBeInTheDocument();
    });

    it('multiplies XP by qty when present', () => {
      render(
        <EncounterSelectedMonsters
          selectedMonsters={[
            { ...baseMonster, qty: 3 },
          ]}
          onRemoveMonster={vi.fn()}
        />
      );
      expect(screen.getByText('150 XP')).toBeInTheDocument();
    });

    it('shows qty in parentheses when qty > 1', () => {
      render(
        <EncounterSelectedMonsters
          selectedMonsters={[
            { ...baseMonster, qty: 5 },
          ]}
          onRemoveMonster={vi.fn()}
        />
      );
      expect(screen.getByText('Goblin (5)')).toBeInTheDocument();
    });

    it('does not show qty when qty is 1', () => {
      render(
        <EncounterSelectedMonsters
          selectedMonsters={[
            { ...baseMonster, qty: 1 },
          ]}
          onRemoveMonster={vi.fn()}
        />
      );
      expect(screen.getByText('Goblin')).toBeInTheDocument();
      expect(screen.queryByText('Goblin (1)')).not.toBeInTheDocument();
    });

    it('does not show qty when qty is not provided', () => {
      render(
        <EncounterSelectedMonsters
          selectedMonsters={[baseMonster]}
          onRemoveMonster={vi.fn()}
        />
      );
      expect(screen.getByText('Goblin')).toBeInTheDocument();
      expect(screen.queryByText('Goblin (1)')).not.toBeInTheDocument();
    });
  });

  describe('remove button', () => {
    it('calls onRemoveMonster with monster index when clicked', () => {
      const onRemove = vi.fn();
      render(
        <EncounterSelectedMonsters
          selectedMonsters={[baseMonster]}
          onRemoveMonster={onRemove}
        />
      );
      fireEvent.click(screen.getByLabelText('Remove Goblin'));
      expect(onRemove).toHaveBeenCalledWith('goblin');
    });

    it('renders a remove button for each monster', () => {
      render(
        <EncounterSelectedMonsters
          selectedMonsters={[
            { ...baseMonster },
            { index: 'orc', name: 'Orc', xp: 100, challenge_rating: 0.5 },
          ]}
          onRemoveMonster={vi.fn()}
        />
      );
      expect(screen.getByLabelText('Remove Goblin')).toBeInTheDocument();
      expect(screen.getByLabelText('Remove Orc')).toBeInTheDocument();
    });
  });

  describe('details button', () => {
    it('renders a details button when onViewDetails is provided', () => {
      render(
        <EncounterSelectedMonsters
          selectedMonsters={[baseMonster]}
          onRemoveMonster={vi.fn()}
          onViewDetails={vi.fn()}
        />
      );
      expect(screen.getByLabelText('View details for Goblin')).toBeInTheDocument();
    });

    it('does not render a details button when onViewDetails is not provided', () => {
      render(
        <EncounterSelectedMonsters
          selectedMonsters={[baseMonster]}
          onRemoveMonster={vi.fn()}
        />
      );
      expect(screen.queryByLabelText('View details for Goblin')).not.toBeInTheDocument();
    });

    it('calls onViewDetails with the monster object when details button clicked', () => {
      const onViewDetails = vi.fn();
      render(
        <EncounterSelectedMonsters
          selectedMonsters={[baseMonster]}
          onRemoveMonster={vi.fn()}
          onViewDetails={onViewDetails}
        />
      );
      fireEvent.click(screen.getByLabelText('View details for Goblin'));
      expect(onViewDetails).toHaveBeenCalledWith(baseMonster);
    });
  });
});
