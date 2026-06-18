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

    it('should not render the container when spellAbilities is null', () => {
      rules.getSpellMaxLevel.mockReturnValue(null);

      const stats = { name: 'No Spells', spellAbilities: null };
      render(<CharSpellSlots playerStats={stats} />);

      const allElements = document.querySelectorAll('.char-spell-slots.levels');
      expect(allElements.length).toBe(0);
    });

    it('should not render the container when spellAbilities is undefined', () => {
      rules.getSpellMaxLevel.mockReturnValue(null);

      const stats = { name: 'No Spells', spellAbilities: undefined };
      render(<CharSpellSlots playerStats={stats} />);

      const allElements = document.querySelectorAll('.char-spell-slots.levels');
      expect(allElements.length).toBe(0);
    });

    it('should not render any slot levels when spellMaxLevel is 0', () => {
      rules.getSpellMaxLevel.mockReturnValue(0);

      render(<CharSpellSlots playerStats={createPlayerStats()} />);

      const wrapper = document.querySelector('.char-spell-slots.levels');
      expect(wrapper).toBeInTheDocument();
      expect(screen.queryByTestId('spell-slot-level-1')).not.toBeInTheDocument();
    });

    it('should not render any slot levels when spellMaxLevel is null', () => {
      rules.getSpellMaxLevel.mockReturnValue(null);

      render(<CharSpellSlots playerStats={createPlayerStats()} />);

      expect(screen.queryByTestId('spell-slot-level-1')).not.toBeInTheDocument();
    });

    it('should not render any slot levels when spellMaxLevel is undefined', () => {
      rules.getSpellMaxLevel.mockReturnValue(undefined);

      render(<CharSpellSlots playerStats={createPlayerStats()} />);

      expect(screen.queryByTestId('spell-slot-level-1')).not.toBeInTheDocument();
    });

    it('should not render any slot levels when spellMaxLevel is falsy', () => {
      rules.getSpellMaxLevel.mockReturnValue(false);

      render(<CharSpellSlots playerStats={createPlayerStats()} />);

      expect(screen.queryByTestId('spell-slot-level-1')).not.toBeInTheDocument();
    });
  });

  describe('spell slot level rendering', () => {
    it('should render one level when maxLevel is 1', () => {
      rules.getSpellMaxLevel.mockReturnValue(1);

      render(<CharSpellSlots playerStats={createPlayerStats()} />);

      expect(screen.getByTestId('spell-slot-level-1')).toBeInTheDocument();
      expect(screen.queryByTestId('spell-slot-level-2')).not.toBeInTheDocument();
    });

    it('should render two levels when maxLevel is 2', () => {
      rules.getSpellMaxLevel.mockReturnValue(2);

      render(<CharSpellSlots playerStats={createPlayerStats()} />);

      expect(screen.getByTestId('spell-slot-level-1')).toBeInTheDocument();
      expect(screen.getByTestId('spell-slot-level-2')).toBeInTheDocument();
      expect(screen.queryByTestId('spell-slot-level-3')).not.toBeInTheDocument();
    });

    it('should render all levels up to maxLevel', () => {
      rules.getSpellMaxLevel.mockReturnValue(5);

      render(<CharSpellSlots playerStats={createPlayerStats()} />);

      for (let i = 1; i <= 5; i++) {
        expect(screen.getByTestId(`spell-slot-level-${i}`)).toBeInTheDocument();
      }
      expect(screen.queryByTestId('spell-slot-level-6')).not.toBeInTheDocument();
    });

    it('should render all nine levels when maxLevel is 9', () => {
      rules.getSpellMaxLevel.mockReturnValue(9);

      const highLevelStats = createPlayerStats({
        spellAbilities: {
          spell_slots_level_1: 4,
          spell_slots_level_2: 3,
          spell_slots_level_3: 3,
          spell_slots_level_4: 3,
          spell_slots_level_5: 3,
          spell_slots_level_6: 2,
          spell_slots_level_7: 2,
          spell_slots_level_8: 1,
          spell_slots_level_9: 1,
          spells: [],
        },
      });

      render(<CharSpellSlots playerStats={highLevelStats} />);

      for (let i = 1; i <= 9; i++) {
        expect(screen.getByTestId(`spell-slot-level-${i}`)).toBeInTheDocument();
      }
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

  describe('edge cases', () => {
    it('should throw when playerStats is null', () => {
      rules.getSpellMaxLevel.mockReturnValue(null);

      expect(() => render(<CharSpellSlots playerStats={null} />)).toThrow(
        "Cannot read properties of null (reading 'spellAbilities')",
      );
    });

    it('should throw when playerStats is undefined', () => {
      rules.getSpellMaxLevel.mockReturnValue(null);

      expect(() => render(<CharSpellSlots playerStats={undefined} />)).toThrow(
        "Cannot read properties of undefined (reading 'spellAbilities')",
      );
    });

    it('should throw when playerStats is missing entirely', () => {
      rules.getSpellMaxLevel.mockReturnValue(null);

      expect(() => render(<CharSpellSlots />)).toThrow(
        "Cannot read properties of undefined (reading 'spellAbilities')",
      );
    });
  });
});
