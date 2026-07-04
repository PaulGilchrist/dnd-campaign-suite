/* @cleaned-by-ai */
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
    it('returns null when selectedMonsters is null or empty', () => {
      const { container: emptyContainer } = render(
        <EncounterSelectedMonsters selectedMonsters={[]} onRemoveMonster={vi.fn()} />
      );
      expect(emptyContainer.firstChild).toBeNull();

      const { container: nullContainer } = render(
        <EncounterSelectedMonsters selectedMonsters={null} onRemoveMonster={vi.fn()} />
      );
      expect(nullContainer.firstChild).toBeNull();
    });
  });

  describe('monster list rendering', () => {
    it('renders the section header with total monster count including qty multipliers', () => {
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

    it('defaults total count to 1 when qty is not provided', () => {
      render(
        <EncounterSelectedMonsters
          selectedMonsters={[{ ...baseMonster }]}
          onRemoveMonster={vi.fn()}
        />
      );
      expect(screen.getByText('Selected Monsters (1)')).toBeInTheDocument();
    });

    it('renders monster names, CR, and XP', () => {
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
      expect(screen.getByText('CR 0.25')).toBeInTheDocument();
      expect(screen.getByText('CR 0.5')).toBeInTheDocument();
      expect(screen.getByText('50 XP')).toBeInTheDocument();
      expect(screen.getByText('100 XP')).toBeInTheDocument();
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

    it('does not show qty when qty is 1 or not provided', () => {
      const monsterWithQty1 = { ...baseMonster, index: 'goblin-qty1', name: 'Goblin A', qty: 1 };
      const monsterWithoutQty = { ...baseMonster, index: 'goblin-no-qty', name: 'Goblin B' };

      render(
        <EncounterSelectedMonsters
          selectedMonsters={[monsterWithQty1, monsterWithoutQty]}
          onRemoveMonster={vi.fn()}
        />
      );
      expect(screen.queryByText('Goblin A (1)')).not.toBeInTheDocument();
      expect(screen.queryByText('Goblin B (1)')).not.toBeInTheDocument();
      expect(screen.getByText('Goblin A')).toBeInTheDocument();
      expect(screen.getByText('Goblin B')).toBeInTheDocument();
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
