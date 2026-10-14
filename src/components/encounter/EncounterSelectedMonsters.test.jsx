import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import EncounterSelectedMonsters from './EncounterSelectedMonsters.jsx';

describe('EncounterSelectedMonsters', () => {
  const baseMonster = {
    index: 'goblin',
    name: 'Goblin',
    xp: 50,
    challenge_rating: 0.25,
  };

  describe('empty/null state', () => {
    it.each([
      [undefined, 'undefined'],
      [null, 'null'],
      [[], 'empty array'],
    ])('returns null when selectedMonsters is %s', (value) => {
      const { container } = render(
        <EncounterSelectedMonsters selectedMonsters={value} onRemoveMonster={vi.fn()} />
      );
      expect(screen.queryByText(/Selected Monsters/)).not.toBeInTheDocument();
      expect(container.innerHTML).toBe('');
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

    it('displays total XP per monster row with qty multiplier and thousands separators', () => {
      render(
        <EncounterSelectedMonsters
          selectedMonsters={[
            { ...baseMonster, qty: 3 },
            { index: 'ancient-red-dragon', name: 'Ancient Red Dragon', xp: 25000, challenge_rating: 24, qty: 2 },
          ]}
          onRemoveMonster={vi.fn()}
        />
      );
      expect(screen.getByText('150 XP')).toBeInTheDocument();
      expect(screen.getByText('50,000 XP')).toBeInTheDocument();
    });

    it('renders monster names with qty only when qty is greater than 1', () => {
      render(
        <EncounterSelectedMonsters
          selectedMonsters={[
            { ...baseMonster, index: 'goblin-qty5', name: 'Goblin', qty: 5 },
            { ...baseMonster, index: 'goblin-qty1', name: 'Goblin A', qty: 1 },
            { ...baseMonster, index: 'goblin-no-qty', name: 'Goblin B' },
            { ...baseMonster, index: 'goblin-qty-zero', name: 'Goblin C', qty: 0 },
            { ...baseMonster, index: 'goblin-qty-null', name: 'Goblin D', qty: null },
          ]}
          onRemoveMonster={vi.fn()}
        />
      );
      expect(screen.getByText('Goblin (5)')).toBeInTheDocument();
      expect(screen.queryByText('Goblin A (1)')).not.toBeInTheDocument();
      expect(screen.getByText('Goblin A')).toBeInTheDocument();
      expect(screen.queryByText('Goblin B (1)')).not.toBeInTheDocument();
      expect(screen.getByText('Goblin B')).toBeInTheDocument();
      expect(screen.queryByText('Goblin C (1)')).not.toBeInTheDocument();
      expect(screen.getByText('Goblin C')).toBeInTheDocument();
      expect(screen.queryByText('Goblin D (1)')).not.toBeInTheDocument();
      expect(screen.getByText('Goblin D')).toBeInTheDocument();
    });
  });

  describe('remove button', () => {
    it('calls onRemoveMonster with the correct monster index when clicked', () => {
      const onRemove = vi.fn();
      render(
        <EncounterSelectedMonsters
          selectedMonsters={[
            { index: 'goblin', name: 'Goblin', xp: 50, challenge_rating: 0.25 },
            { index: 'orc', name: 'Orc', xp: 100, challenge_rating: 0.5 },
          ]}
          onRemoveMonster={onRemove}
        />
      );
      fireEvent.click(screen.getByLabelText('Remove Orc'));
      expect(onRemove).toHaveBeenCalledWith('orc');
      fireEvent.click(screen.getByLabelText('Remove Goblin'));
      expect(onRemove).toHaveBeenCalledWith('goblin');
    });
  });

  describe('details button', () => {
    it('does not render a details button when onViewDetails is not provided', () => {
      render(
        <EncounterSelectedMonsters
          selectedMonsters={[baseMonster]}
          onRemoveMonster={vi.fn()}
        />
      );
      expect(screen.queryByLabelText('View details for Goblin')).not.toBeInTheDocument();
    });

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

    it('calls onViewDetails with the correct monster object when clicked', () => {
      const onViewDetails = vi.fn();
      render(
        <EncounterSelectedMonsters
          selectedMonsters={[
            { index: 'goblin', name: 'Goblin', xp: 50, challenge_rating: 0.25 },
            { index: 'orc', name: 'Orc', xp: 100, challenge_rating: 0.5 },
          ]}
          onRemoveMonster={vi.fn()}
          onViewDetails={onViewDetails}
        />
      );
      fireEvent.click(screen.getByLabelText('View details for Orc'));
      expect(onViewDetails).toHaveBeenCalledWith({
        index: 'orc',
        name: 'Orc',
        xp: 100,
        challenge_rating: 0.5,
      });
    });
  });
});
