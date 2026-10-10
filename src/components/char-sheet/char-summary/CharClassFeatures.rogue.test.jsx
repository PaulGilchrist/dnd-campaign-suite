// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import RogueFeatures from './CharClassFeatures.jsx';

vi.mock('./TrackedResourceInput.jsx', () => {
  return {
    default: function MockTrackedResourceInput({ label, resourceKey }) {
      return (
        <div data-testid={`tracked-resource-${resourceKey}`}>
          <span data-testid="mock-tracked-resource-label">{label}</span>
        </div>
      );
    },
  };
});

vi.mock('../../../services/character/classFeatures.js', () => ({
  getClassFeatures: vi.fn(() => ({
    sneakAttack: { dice_count: 3, dice_value: 6 },
    expertise: ['Stealth'],
  })),
}));

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  useRuntimeValue: vi.fn(() => undefined),
}));

import * as runtimeState from '../../../hooks/runtime/useRuntimeState.js';
import * as classFeatures from '../../../services/character/classFeatures.js';

function buildPlayerStats(overrides = {}) {
  return {
    name: 'Test Rogue',
    level: 1,
    rules: '5e',
    proficiency: 2,
    class: {
      name: 'Rogue',
      major: {},
      subclass: {},
      class_levels: [],
      fightingStyles: [],
    },
    abilities: [
      { name: 'Dexterity', bonus: 3 },
    ],
    automation: {},
    ...overrides,
  };
}

describe('RogueFeatures', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    runtimeState.useRuntimeValue.mockImplementation((_name, key) => {
      if (key === 'stealthAttackCost') return 0;
      return undefined;
    });
  });

  describe('expertise', () => {
    it('renders expertise list from class features', () => {
      classFeatures.getClassFeatures.mockImplementation(() => ({
        sneakAttack: { dice_count: 3, dice_value: 6 },
        expertise: ['Stealth', 'Perception', 'Thieves\' Tools'],
      }));
      const stats = buildPlayerStats();
      render(<RogueFeatures playerStats={stats} campaignName="test" />);
      expect(screen.getByText(/Expertise:/)).toBeTruthy();
      expect(screen.getByText(/Stealth/)).toBeTruthy();
      expect(screen.getByText(/Perception/)).toBeTruthy();
      expect(screen.getByText(/Thieves' Tools/)).toBeTruthy();
    });

    it('does not render expertise when expertise array is empty', () => {
      classFeatures.getClassFeatures.mockImplementation(() => ({
        sneakAttack: { dice_count: 3, dice_value: 6 },
        expertise: [],
      }));
      const stats = buildPlayerStats();
      render(<RogueFeatures playerStats={stats} campaignName="test" />);
      expect(screen.queryByText('Expertise:')).not.toBeInTheDocument();
    });

  });

  describe('sneak attack damage', () => {
    it('renders sneak attack damage from class features', () => {
      const stats = buildPlayerStats();
      render(<RogueFeatures playerStats={stats} campaignName="test" />);
      expect(screen.getByText('Sneak Attack Damage:')).toBeTruthy();
      expect(screen.getByText('+3d6')).toBeTruthy();
    });
  });

  describe('energy dice', () => {
    it('renders energy dice when energy required_major matches class major', () => {
      const stats = buildPlayerStats({
        level: 5,
        class: {
          name: 'Rogue',
          major: { name: 'Swashbuckler' },
          subclass: {},
          class_levels: [null, null, null, null, {
            level: 5,
            energy: { required_major: 'Swashbuckler', energy_die_num: 4, energy_die_type: 6 },
          }],
          fightingStyles: [],
        },
      });
      render(<RogueFeatures playerStats={stats} campaignName="test" />);
      expect(screen.getByTestId('tracked-resource-psionicEnergy')).toBeTruthy();
      expect(screen.getByText('Energy Die Type:')).toBeTruthy();
      expect(screen.getByText('d6')).toBeTruthy();
    });

    it('does not render energy dice when energy required_major does not match class major', () => {
      const stats = buildPlayerStats({
        level: 5,
        class: {
          name: 'Rogue',
          major: { name: 'Assassin' },
          subclass: {},
          class_levels: [null, null, null, null, {
            level: 5,
            energy: { required_major: 'Swashbuckler', energy_die_num: 4, energy_die_type: 6 },
          }],
          fightingStyles: [],
        },
      });
      render(<RogueFeatures playerStats={stats} campaignName="test" />);
      expect(screen.queryByTestId('tracked-resource-psionicEnergy')).not.toBeInTheDocument();
    });

    it('does not render energy dice when energy field is missing from class level', () => {
      const stats = buildPlayerStats({
        level: 5,
        class: {
          name: 'Rogue',
          major: { name: 'Swashbuckler' },
          subclass: {},
          class_levels: [null, null, null, null, { level: 5 }],
          fightingStyles: [],
        },
      });
      render(<RogueFeatures playerStats={stats} campaignName="test" />);
      expect(screen.queryByTestId('tracked-resource-psionicEnergy')).not.toBeInTheDocument();
    });

    it('does not render energy dice when class_levels is null', () => {
      const stats = buildPlayerStats({
        level: 5,
        class: {
          name: 'Rogue',
          major: { name: 'Swashbuckler' },
          subclass: {},
          class_levels: null,
          fightingStyles: [],
        },
      });
      render(<RogueFeatures playerStats={stats} campaignName="test" />);
      expect(screen.queryByTestId('tracked-resource-psionicEnergy')).not.toBeInTheDocument();
    });
  });

  describe('supreme sneak', () => {
    it('does not render supreme sneak when level < 9', () => {
      const stats = buildPlayerStats({ level: 8, class: { name: 'Rogue', major: { name: 'Thief' }, subclass: {}, class_levels: [], fightingStyles: [] } });
      render(<RogueFeatures playerStats={stats} campaignName="test" />);
      expect(screen.queryByTitle(/Supreme Sneak/)).not.toBeInTheDocument();
    });

    it('does not render supreme sneak badge for non-Thief major', () => {
      const stats = buildPlayerStats({
        level: 20,
        class: { name: 'Rogue', major: {}, subclass: { name: 'Arcane Trickster' }, class_levels: [], fightingStyles: [] },
      });
      render(<RogueFeatures playerStats={stats} campaignName="test" />);
      expect(screen.queryByText('Supreme Sneak')).not.toBeInTheDocument();
      expect(screen.queryByTitle(/Supreme Sneak/)).not.toBeInTheDocument();
    });

    it('renders supreme sneak badge for Thief major at level >= 9', () => {
      const stats = buildPlayerStats({
        level: 9,
        class: { name: 'Rogue', major: { name: 'Thief' }, subclass: {}, class_levels: [], fightingStyles: [] },
      });
      render(<RogueFeatures playerStats={stats} campaignName="test" />);
      const badge = screen.getByTitle(/Supreme Sneak/);
      expect(badge).toHaveTextContent('Supreme Sneak');
      expect(badge.getAttribute('title')).toContain('Available at Rogue level 9');
    });

    it('shows active state tooltip when stealth attack cost is greater than 0', () => {
      runtimeState.useRuntimeValue.mockImplementation((_name, key) => {
        if (key === 'stealthAttackCost') return 1;
        return undefined;
      });
      const stats = buildPlayerStats({ level: 9, class: { name: 'Rogue', major: { name: 'Thief' }, subclass: {}, class_levels: [], fightingStyles: [] } });
      render(<RogueFeatures playerStats={stats} campaignName="test" />);
      const badge = screen.getByTitle(/Supreme Sneak/);
      expect(badge).toHaveTextContent('Supreme Sneak');
      expect(badge.getAttribute('title')).toContain('Stealth Attack active');
    });

    it('shows availability tooltip when stealth attack cost is 0', () => {
      const stats = buildPlayerStats({ level: 9, class: { name: 'Rogue', major: { name: 'Thief' }, subclass: {}, class_levels: [], fightingStyles: [] } });
      render(<RogueFeatures playerStats={stats} campaignName="test" />);
      const badge = screen.getByTitle(/Supreme Sneak/);
      expect(badge).toHaveTextContent('Supreme Sneak');
      expect(badge.getAttribute('title')).toContain('Available at Rogue level 9');
    });
  });
});
