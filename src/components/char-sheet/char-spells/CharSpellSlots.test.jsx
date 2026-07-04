// @cleaned-by-ai
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
    it('renders the spell slots header', () => {
      rules.getSpellMaxLevel.mockReturnValue(3);

      render(<CharSpellSlots playerStats={createPlayerStats()} />);

      expect(screen.getByText('Spell Slots')).toBeInTheDocument();
    });

    it('renders no slot levels when spellMaxLevel is falsy', () => {
      rules.getSpellMaxLevel.mockReturnValue(0);

      render(<CharSpellSlots playerStats={createPlayerStats()} />);

      expect(screen.queryByTestId('spell-slot-level-1')).not.toBeInTheDocument();
    });

    it('does not render when spellAbilities is absent', () => {
      rules.getSpellMaxLevel.mockReturnValue(null);

      render(<CharSpellSlots playerStats={{ name: 'No Spells' }} />);

      expect(screen.queryByText('Spell Slots')).not.toBeInTheDocument();
    });

    it('renders levels up to maxLevel', () => {
      rules.getSpellMaxLevel.mockReturnValue(5);

      render(<CharSpellSlots playerStats={createPlayerStats()} />);

      for (let i = 1; i <= 5; i++) {
        expect(screen.getByTestId(`spell-slot-level-${i}`)).toBeInTheDocument();
      }
      expect(screen.queryByTestId('spell-slot-level-6')).not.toBeInTheDocument();
    });

    it('passes correct totalSlots to each level component', () => {
      rules.getSpellMaxLevel.mockReturnValue(3);

      render(<CharSpellSlots playerStats={createPlayerStats()} />);

      expect(screen.getByTestId('spell-slot-level-1')).toHaveAttribute('data-total-slots', '4');
      expect(screen.getByTestId('spell-slot-level-2')).toHaveAttribute('data-total-slots', '3');
      expect(screen.getByTestId('spell-slot-level-3')).toHaveAttribute('data-total-slots', '3');
    });

    it('passes undefined when a slot level property is missing from spellAbilities', () => {
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
