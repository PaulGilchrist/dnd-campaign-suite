// @improved-by-ai
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CharSpellSlots from './CharSpellSlots.jsx';

// Mock the rules service
vi.mock('../../../services/rules/rules.js', () => ({
  default: {
    getSpellMaxLevel: vi.fn(),
  },
}));

// Mock the CharSpellSlotLevel component to verify props are forwarded correctly
vi.mock('./CharSpellSlotLevel.jsx', () => ({
  default: function MockCharSpellSlotLevel({ level, totalSlots, playerStats, campaignName }) {
    return (
      <div
        data-testid={`spell-slot-level-${level}`}
        data-total-slots={totalSlots}
        data-player-stats-name={playerStats?.name}
        data-campaign-name={campaignName}
      >
        <span className='slot-level'>{level}</span>
        <span className='slot-total'>{totalSlots}</span>
      </div>
    );
  },
}));

import rules from '../../../services/rules/rules.js';

const createPlayerStats = (overrides = {}) => ({
  name: 'Test Character',
  spellAbilities: {
    spell_slots_level_1: 4,
    spell_slots_level_2: 3,
    spell_slots_level_3: 3,
    spells: [],
    ...overrides.spellAbilities,
  },
  ...overrides,
});

describe('CharSpellSlots', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('should render the spell slots header', () => {
      rules.getSpellMaxLevel.mockReturnValue(3);

      render(<CharSpellSlots playerStats={createPlayerStats()} />);

      expect(screen.getByText('Spell Slots')).toBeInTheDocument();
    });

    it('should render a container with char-spell-slots and levels classes', () => {
      rules.getSpellMaxLevel.mockReturnValue(1);

      const { container } = render(<CharSpellSlots playerStats={createPlayerStats()} />);

      const wrapper = container.querySelector('.char-spell-slots.levels');
      expect(wrapper).toBeInTheDocument();
    });

    it('should not render the container when spellAbilities is absent', () => {
      rules.getSpellMaxLevel.mockReturnValue(null);

      render(<CharSpellSlots playerStats={{ name: 'No Spells' }} />);

      const allElements = document.querySelectorAll('.char-spell-slots.levels');
      expect(allElements.length).toBe(0);
    });

    it('should render no slot levels when spellMaxLevel is 0', () => {
      rules.getSpellMaxLevel.mockReturnValue(0);

      render(<CharSpellSlots playerStats={createPlayerStats()} />);

      const wrapper = document.querySelector('.char-spell-slots.levels');
      expect(wrapper).toBeInTheDocument();
      expect(screen.queryByTestId('spell-slot-level-1')).not.toBeInTheDocument();
    });

    it('should render no slot levels when spellMaxLevel is falsy', () => {
      rules.getSpellMaxLevel.mockReturnValue(null);

      render(<CharSpellSlots playerStats={createPlayerStats()} />);

      expect(screen.queryByTestId('spell-slot-level-1')).not.toBeInTheDocument();
    });
  });

  describe('spell slot level rendering', () => {
    it('should render levels up to maxLevel', () => {
      rules.getSpellMaxLevel.mockReturnValue(5);

      render(<CharSpellSlots playerStats={createPlayerStats()} />);

      for (let i = 1; i <= 5; i++) {
        expect(screen.getByTestId(`spell-slot-level-${i}`)).toBeInTheDocument();
      }
      expect(screen.queryByTestId('spell-slot-level-6')).not.toBeInTheDocument();
    });
  });

  describe('prop forwarding', () => {
    it('should pass correct totalSlots to each level component', () => {
      rules.getSpellMaxLevel.mockReturnValue(3);

      render(<CharSpellSlots playerStats={createPlayerStats()} />);

      expect(screen.getByTestId('spell-slot-level-1')).toHaveAttribute('data-total-slots', '4');
      expect(screen.getByTestId('spell-slot-level-2')).toHaveAttribute('data-total-slots', '3');
      expect(screen.getByTestId('spell-slot-level-3')).toHaveAttribute('data-total-slots', '3');
    });

    it('should forward playerStats to each level component', () => {
      rules.getSpellMaxLevel.mockReturnValue(1);

      const stats = createPlayerStats({ name: 'Gandalf' });
      render(<CharSpellSlots playerStats={stats} />);

      expect(screen.getByTestId('spell-slot-level-1')).toHaveAttribute(
        'data-player-stats-name',
        'Gandalf',
      );
    });

    it('should forward campaignName to each level component', () => {
      rules.getSpellMaxLevel.mockReturnValue(1);

      render(
        <CharSpellSlots playerStats={createPlayerStats()} campaignName='My Campaign' />,
      );

      expect(screen.getByTestId('spell-slot-level-1')).toHaveAttribute(
        'data-campaign-name',
        'My Campaign',
      );
    });

    it('should pass undefined when a slot level property is missing from spellAbilities', () => {
      rules.getSpellMaxLevel.mockReturnValue(2);

      const partialStats = {
        name: 'Test Character',
        spellAbilities: {
          spell_slots_level_1: 4,
          spells: [],
        },
      };

      render(<CharSpellSlots playerStats={partialStats} />);

      expect(screen.getByTestId('spell-slot-level-1')).toHaveAttribute('data-total-slots', '4');
      expect(screen.getByTestId('spell-slot-level-2')).not.toHaveAttribute('data-total-slots');
    });
  });
});
