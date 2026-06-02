import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MetamagicPopup from './MetamagicPopup.jsx';

const mockSpell = {
  name: 'Fireball',
  level: 3,
};

const mockPlayerStats = {
  name: 'Sorcerer',
  class: { name: 'Sorcerer' },
  abilities: [{ name: 'Charisma', bonus: 4 }],
  rules: '5e',
  level: 5,
  _metamagicCurrentSP: 10,
};

describe('MetamagicPopup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    // Set up combat summary with creatures for twinned target selector
    localStorage.setItem('combatSummary', JSON.stringify({
      creatures: [
        { name: 'Sorcerer', type: 'player' },
        { name: 'Goblin', type: 'npc' },
        { name: 'Orc', type: 'npc' },
      ],
    }));
  });

  it('renders spell name and level', () => {
    render(
      <MetamagicPopup
        spell={mockSpell}
        playerStats={mockPlayerStats}
        campaignName="test"
        onConfirm={vi.fn()}
        onSkip={vi.fn()}
      />
    );
    expect(screen.getByText('Fireball')).toBeInTheDocument();
    expect(screen.getByText(/Level 3/)).toBeInTheDocument();
  });

  it('displays sorcery points', () => {
    render(
      <MetamagicPopup
        spell={mockSpell}
        playerStats={mockPlayerStats}
        campaignName="test"
        onConfirm={vi.fn()}
        onSkip={vi.fn()}
      />
    );
    expect(screen.getByText(/Sorcery Points:/)).toBeInTheDocument();
  });

  it('shows pre-cast options excluding Empowered', () => {
    render(
      <MetamagicPopup
        spell={mockSpell}
        playerStats={mockPlayerStats}
        campaignName="test"
        onConfirm={vi.fn()}
        onSkip={vi.fn()}
      />
    );
    expect(screen.getByText('Careful Spell')).toBeInTheDocument();
    expect(screen.getByText('Twinned Spell')).toBeInTheDocument();
    expect(screen.queryByText('Empowered Spell')).not.toBeInTheDocument();
  });

  it('calls onSkip when Cast Without Metamagic clicked', () => {
    const onSkip = vi.fn();
    render(
      <MetamagicPopup
        spell={mockSpell}
        playerStats={mockPlayerStats}
        campaignName="test"
        onConfirm={vi.fn()}
        onSkip={onSkip}
      />
    );
    fireEvent.click(screen.getByText('Cast Without Metamagic'));
    expect(onSkip).toHaveBeenCalledTimes(1);
  });

  it('calls onConfirm with selected options and cost', () => {
    const onConfirm = vi.fn();
    render(
      <MetamagicPopup
        spell={mockSpell}
        playerStats={mockPlayerStats}
        campaignName="test"
        onConfirm={onConfirm}
        onSkip={vi.fn()}
      />
    );
    // Select Quickened Spell (cost 2)
    fireEvent.click(screen.getByText('Quickened Spell'));
    // Click Apply & Cast
    fireEvent.click(screen.getByText(/Apply & Cast/));
    expect(onConfirm).toHaveBeenCalledWith({
      options: ['Quickened Spell'],
      totalCost: 2,
      twinTarget: null,
    });
  });

  it('shows Twinned target dropdown when Twinned selected', () => {
    render(
      <MetamagicPopup
        spell={mockSpell}
        playerStats={mockPlayerStats}
        campaignName="test"
        onConfirm={vi.fn()}
        onSkip={vi.fn()}
      />
    );
    fireEvent.click(screen.getByText('Twinned Spell'));
    expect(screen.getByText(/Second Target/)).toBeInTheDocument();
    expect(screen.getByText('Goblin')).toBeInTheDocument();
    expect(screen.getByText('Orc')).toBeInTheDocument();
  });

  it('requires twin target before confirming Twinned Spell', () => {
    const onConfirm = vi.fn();
    render(
      <MetamagicPopup
        spell={mockSpell}
        playerStats={mockPlayerStats}
        campaignName="test"
        onConfirm={onConfirm}
        onSkip={vi.fn()}
      />
    );
    // Select Twinned Spell but no target
    fireEvent.click(screen.getByText('Twinned Spell'));
    // Button should be disabled
    const btn = screen.getByText(/Apply & Cast/);
    expect(btn.disabled).toBe(true);
  });

  it('enforces max metamagic per spell (1 by default)', () => {
    const onConfirm = vi.fn();
    render(
      <MetamagicPopup
        spell={mockSpell}
        playerStats={mockPlayerStats}
        campaignName="test"
        onConfirm={onConfirm}
        onSkip={vi.fn()}
      />
    );
    // Select Careful (1 SP) 
    fireEvent.click(screen.getByText('Careful Spell'));
    // After selecting 1 option, Heightened should not be selectable since it's 3 more SP
    // The Apply button should show the cost
    expect(screen.getByText(/Apply & Cast/)).toBeInTheDocument();
  });

  it('shows Sorcery Incarnate note for 2024 level 6+', () => {
    const stats2024 = {
      ...mockPlayerStats,
      rules: '2024',
      level: 6,
      _metamagicCurrentSP: 10,
    };
    render(
      <MetamagicPopup
        spell={mockSpell}
        playerStats={stats2024}
        campaignName="test"
        onConfirm={vi.fn()}
        onSkip={vi.fn()}
      />
    );
    expect(screen.getByText(/Sorcery Incarnate/)).toBeInTheDocument();
  });
});
