import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CharSpellSlots from './CharSpellSlots.jsx';

// Mock the rules service
vi.mock('../../../services/rules/rules.js', () => ({
  default: {
    getSpellMaxLevel: vi.fn(),
   },
}));

// Mock the CharSpellSlotLevel component
vi.mock('./CharSpellSlotLevel.jsx', () => ({
  default: function MockCharSpellSlotLevel({ level, totalSlots }) {
    return (
         <div data-testid={`spell-slot-level-${level}`}>
          <span>{level}</span>
          <span>{totalSlots}</span>
         </div>
        );
      },
}));

import rules from '../../../services/rules/rules.js';

const mockPlayerStats = {
  name: 'Test Character',
  spellAbilities: {
    spell_slots_level_1: 4,
    spell_slots_level_2: 3,
    spell_slots_level_3: 3,
    spells: [],
   },
};

describe('CharSpellSlots', () => {
  beforeEach(() => {
    vi.clearAllMocks();
   });

  it('should render spell slots header', () => {
    rules.getSpellMaxLevel.mockReturnValue(3);

    render(
         <CharSpellSlots playerStats={mockPlayerStats} />
        );

    expect(screen.getByText('Spell Slots')).toBeInTheDocument();
   });

  it('should call getSpellMaxLevel with spellAbilities', () => {
    rules.getSpellMaxLevel.mockReturnValue(3);

    render(
         <CharSpellSlots playerStats={mockPlayerStats} />
        );

    expect(rules.getSpellMaxLevel).toHaveBeenCalledWith(mockPlayerStats.spellAbilities);
   });

  it('should not render spell slots when spellAbilities is not present', () => {
    const statsWithoutSpells = { name: 'Test Character' };
    rules.getSpellMaxLevel.mockReturnValue(null);

    const { container } = render(
         <CharSpellSlots playerStats={statsWithoutSpells} />
        );

    expect(container.querySelector('.levels')).not.toBeInTheDocument();
   });

  it('should not render spell slot levels when spellMaxLevel is 0', () => {
    rules.getSpellMaxLevel.mockReturnValue(0);

    const { container } = render(
         <CharSpellSlots playerStats={mockPlayerStats} />
        );

      // The .levels div is rendered but no CharSpellSlotLevel components
    expect(container.querySelector('.levels')).toBeInTheDocument();
    expect(screen.queryByTestId('spell-slot-level-1')).not.toBeInTheDocument();
      });

  it('should render level 1 spell slots when maxLevel >= 1', () => {
    rules.getSpellMaxLevel.mockReturnValue(1);

    render(
         <CharSpellSlots playerStats={mockPlayerStats} />
        );

    expect(screen.getByTestId('spell-slot-level-1')).toBeInTheDocument();
   });

  it('should render level 2 spell slots when maxLevel >= 2', () => {
    rules.getSpellMaxLevel.mockReturnValue(2);

    render(
         <CharSpellSlots playerStats={mockPlayerStats} />
        );

    expect(screen.getByTestId('spell-slot-level-1')).toBeInTheDocument();
    expect(screen.getByTestId('spell-slot-level-2')).toBeInTheDocument();
   });

  it('should render level 3 spell slots when maxLevel >= 3', () => {
    rules.getSpellMaxLevel.mockReturnValue(3);

    render(
         <CharSpellSlots playerStats={mockPlayerStats} />
        );

    expect(screen.getByTestId('spell-slot-level-1')).toBeInTheDocument();
    expect(screen.getByTestId('spell-slot-level-2')).toBeInTheDocument();
    expect(screen.getByTestId('spell-slot-level-3')).toBeInTheDocument();
   });

  it('should render all spell slot levels up to maxLevel', () => {
    rules.getSpellMaxLevel.mockReturnValue(5);

    render(
         <CharSpellSlots playerStats={mockPlayerStats} />
        );

    expect(screen.getByTestId('spell-slot-level-1')).toBeInTheDocument();
    expect(screen.getByTestId('spell-slot-level-2')).toBeInTheDocument();
    expect(screen.getByTestId('spell-slot-level-3')).toBeInTheDocument();
    expect(screen.getByTestId('spell-slot-level-4')).toBeInTheDocument();
    expect(screen.getByTestId('spell-slot-level-5')).toBeInTheDocument();
   });

  it('should pass correct totalSlots to each CharSpellSlotLevel', () => {
    rules.getSpellMaxLevel.mockReturnValue(3);

    render(
         <CharSpellSlots playerStats={mockPlayerStats} />
        );

    // Check that the correct totalSlots are passed
    const level1Element = screen.getByTestId('spell-slot-level-1');
    expect(level1Element.textContent).toContain('4');

    const level2Element = screen.getByTestId('spell-slot-level-2');
    expect(level2Element.textContent).toContain('3');

    const level3Element = screen.getByTestId('spell-slot-level-3');
    expect(level3Element.textContent).toContain('3');
   });

  it('should not render higher level slots when maxLevel is lower', () => {
    rules.getSpellMaxLevel.mockReturnValue(2);

    render(
         <CharSpellSlots playerStats={mockPlayerStats} />
        );

    expect(screen.queryByTestId('spell-slot-level-3')).not.toBeInTheDocument();
    expect(screen.queryByTestId('spell-slot-level-4')).not.toBeInTheDocument();
   });

  it('should render up to level 9 slots when maxLevel is 9', () => {
    const highLevelStats = {
      name: 'Test Character',
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
        };
    rules.getSpellMaxLevel.mockReturnValue(9);

    render(
         <CharSpellSlots playerStats={highLevelStats} />
        );

    for (let i = 1; i <= 9; i++) {
      expect(screen.getByTestId(`spell-slot-level-${i}`)).toBeInTheDocument();
        }
      });
});