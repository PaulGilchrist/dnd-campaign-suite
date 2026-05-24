import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import EncounterSelectedMonsters from './EncounterSelectedMonsters.jsx';

describe('EncounterSelectedMonsters', () => {
  it('should return null when selectedMonsters is empty', () => {
    const { container } = render(
      <EncounterSelectedMonsters selectedMonusters={[]} onRemoveMonster={vi.fn()} />
    );
    expect(container.innerHTML).toBe('');
  });

  it('should return null when selectedMonsters is null', () => {
    const { container } = render(
      <EncounterSelectedMonsters selectedMonsters={null} onRemoveMonster={vi.fn()} />
    );
    expect(container.innerHTML).toBe('');
  });

  it('should render selected monster count in title', () => {
    render(
      <EncounterSelectedMonsters
        selectedMonsters={[
          { index: 'goblin', name: 'Goblin', xp: 50, challenge_rating: 0.25 },
          { index: 'orc', name: 'Orc', xp: 100, challenge_rating: 0.5 },
        ]}
        onRemoveMonster={vi.fn()}
      />
    );
    expect(screen.getByText('Selected Monsters (2)')).toBeInTheDocument();
  });

  it('should render monster names', () => {
    render(
      <EncounterSelectedMonsters
        selectedMonsters={[
          { index: 'goblin', name: 'Goblin', xp: 50, challenge_rating: 0.25 },
        ]}
        onRemoveMonster={vi.fn()}
      />
    );
    expect(screen.getByText('Goblin')).toBeInTheDocument();
  });

  it('should render CR for each monster', () => {
    render(
      <EncounterSelectedMonsters
        selectedMonsters={[
          { index: 'goblin', name: 'Goblin', xp: 50, challenge_rating: 0.25 },
        ]}
        onRemoveMonster={vi.fn()}
      />
    );
    expect(screen.getByText('CR 0.25')).toBeInTheDocument();
  });

  it('should render XP for each monster', () => {
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

  it('should render formatted XP', () => {
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

  it('should call onRemoveMonster when remove button clicked', () => {
    const onRemove = vi.fn();
    render(
      <EncounterSelectedMonsters
        selectedMonsters={[
          { index: 'goblin', name: 'Goblin', xp: 50, challenge_rating: 0.25 },
        ]}
        onRemoveMonster={onRemove}
      />
    );
    fireEvent.click(screen.getByLabelText('Remove Goblin'));
    expect(onRemove).toHaveBeenCalledWith('goblin');
  });

  it('should render multiple monsters', () => {
    render(
      <EncounterSelectedMonsters
        selectedMonsters={[
          { index: 'goblin', name: 'Goblin', xp: 50, challenge_rating: 0.25 },
          { index: 'orc', name: 'Orc', xp: 100, challenge_rating: 0.5 },
          { index: 'dragon', name: 'Dragon', xp: 5900, challenge_rating: 10 },
        ]}
        onRemoveMonster={vi.fn()}
      />
    );
    expect(screen.getByText('Selected Monsters (3)')).toBeInTheDocument();
    expect(screen.getByText('Goblin')).toBeInTheDocument();
    expect(screen.getByText('Orc')).toBeInTheDocument();
    expect(screen.getByText('Dragon')).toBeInTheDocument();
  });
});
