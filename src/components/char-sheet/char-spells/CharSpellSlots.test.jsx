import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CharSpellSlots from './CharSpellSlots.jsx';

// Mock the rules service
vi.mock('../../../services/rules/rules.js', () => ({
  default: {
    getSpellMaxLevel: vi.fn(),
  },
}));

// Mock CharSpellSlotLevel to capture props passed from the parent.
// This avoids testing implementation details (DOM attributes) and instead
// verifies the data flow between parent and child components.
vi.mock('./CharSpellSlotLevel.jsx', () => {
  const mock = vi.fn(() => null);
  return { default: mock };
});

import rules from '../../../services/rules/rules.js';
import CharSpellSlotLevel from './CharSpellSlotLevel.jsx';

const createPlayerStats = (overrides = {}) => ({
  name: 'Test Character',
  spellAbilities: {
    spell_slots_level_1: 4,
    spell_slots_level_2: 3,
    spell_slots_level_3: 3,
    spell_slots_level_4: 2,
    spell_slots_level_5: 2,
    spell_slots_level_6: 1,
    spell_slots_level_7: 1,
    spell_slots_level_8: 1,
    spell_slots_level_9: 1,
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
    it.each`
      spellAbilities        | description
      ${undefined}          | 'absent'
      ${null}               | 'null'
      ${{}}                 | 'empty object'
    `('renders nothing when spellAbilities is $description', ({ spellAbilities }) => {
      render(<CharSpellSlots playerStats={{ name: 'Test', spellAbilities }} />);

      expect(screen.queryByText('Spell Slots')).not.toBeInTheDocument();
    });

    it('renders the header and level components up to maxLevel', () => {
      rules.getSpellMaxLevel.mockReturnValue(3);

      render(<CharSpellSlots playerStats={createPlayerStats()} />);

      expect(screen.getByText('Spell Slots')).toBeInTheDocument();
      expect(CharSpellSlotLevel).toHaveBeenCalledTimes(3);

      const calls = CharSpellSlotLevel.mock.calls;
      expect(calls[0][0].level).toBe(1);
      expect(calls[1][0].level).toBe(2);
      expect(calls[2][0].level).toBe(3);
    });

    it('renders header but no levels when maxLevel is falsy', () => {
      rules.getSpellMaxLevel.mockReturnValue(0);

      render(<CharSpellSlots playerStats={createPlayerStats()} />);

      expect(screen.getByText('Spell Slots')).toBeInTheDocument();
      expect(CharSpellSlotLevel).not.toHaveBeenCalled();
    });
  });

  describe('slot counts', () => {
    it.each`
      maxLevel | expectedLevels
      ${1}     | ${1}
      ${3}     | ${3}
      ${9}     | ${9}
    `(
      'passes correct level values for each level (maxLevel: $maxLevel)',
      ({ maxLevel, expectedLevels }) => {
        rules.getSpellMaxLevel.mockReturnValue(maxLevel);

        render(<CharSpellSlots playerStats={createPlayerStats()} />);

        expect(CharSpellSlotLevel).toHaveBeenCalledTimes(expectedLevels);

        const calls = CharSpellSlotLevel.mock.calls;
        for (let i = 0; i < expectedLevels; i++) {
          expect(calls[i][0].level).toBe(i + 1);
        }
      }
    );

    it('passes correct totalSlots with custom slot values', () => {
      rules.getSpellMaxLevel.mockReturnValue(3);

      const customStats = createPlayerStats({
        spellAbilities: {
          spell_slots_level_1: 6,
          spell_slots_level_2: 4,
          spell_slots_level_3: 2,
          spells: [],
        },
      });

      render(<CharSpellSlots playerStats={customStats} />);

      const calls = CharSpellSlotLevel.mock.calls;
      expect(calls[0][0]).toEqual(expect.objectContaining({ level: 1, totalSlots: 6 }));
      expect(calls[1][0]).toEqual(expect.objectContaining({ level: 2, totalSlots: 4 }));
      expect(calls[2][0]).toEqual(expect.objectContaining({ level: 3, totalSlots: 2 }));
    });

    it('passes undefined totalSlots when a slot level property is missing', () => {
      rules.getSpellMaxLevel.mockReturnValue(2);

      const partialStats = {
        name: 'Test Character',
        spellAbilities: {
          spell_slots_level_1: 4,
          spells: [],
        },
      };

      render(<CharSpellSlots playerStats={partialStats} />);

      const calls = CharSpellSlotLevel.mock.calls;
      expect(calls[0][0]).toEqual(expect.objectContaining({ level: 1, totalSlots: 4 }));
      expect(calls[1][0]).toEqual(expect.objectContaining({ level: 2, totalSlots: undefined }));
    });
  });
});
