import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import SpellDetailPopup from './SpellDetailPopup.jsx';
import { getConsumedMaterial, hasMaterial } from '../../../services/rules/spells/materialComponents.js';

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(),
  useRuntimeValue: vi.fn(() => null),
}));

vi.mock('../../../services/combat/buffs/buffService.js', () => ({
  getActiveBuffs: vi.fn(() => []),
}));

vi.mock('../../../services/ui/sanitize.js', () => ({
  sanitizeHtml: (html) => html,
}));

vi.mock('../../../services/rules/spells/materialComponents.js', () => ({
  getConsumedMaterial: vi.fn(),
  hasMaterial: vi.fn(() => false),
}));

const mockCampaignName = 'test-campaign';
const mockOnClose = vi.fn();

const createPlayerStats = (overrides = {}) => ({
  name: 'Elara',
  level: 5,
  class: { name: 'Sorcerer', major: { name: 'Sorcerer' } },
  abilities: [{ name: 'Charisma', bonus: 3 }],
  proficiency: 3,
  spellAbilities: {
    spell_slots_level_1: 4,
    spell_slots_level_2: 3,
    spell_slots_level_3: 2,
    spells: [],
    ...overrides.spellAbilities,
  },
  automation: { passives: [], actions: [] },
  ...overrides,
});

const createSpell = (overrides = {}) => ({
  name: 'Magic Missile',
  level: 1,
  description: 'Three darts of force strike a creature.',
  casting_time: '1 action',
  range: '120 feet',
  duration: 'Instantaneous',
  damage: {
    damage_at_slot_level: {
      '1': '3d4+1',
      '2': '4d4+1',
      '3': '5d4+1',
    },
  },
  school: 'Evocation',
  ...overrides,
});

const renderPopup = (spell, playerStats, campaignName, extraProps = {}) =>
  render(
    <SpellDetailPopup
      spell={spell}
      playerStats={playerStats}
      campaignName={campaignName}
      onClose={mockOnClose}
      {...extraProps}
    />
  );

describe('SpellDetailPopup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Material components display', () => {
    it('renders material section with missing indicator when spell has consumed materials and player lacks them', () => {
      vi.mocked(getConsumedMaterial).mockReturnValue({
        itemName: 'Drop of Blood, Piece of Flesh, Pinch of Bone Dust',
        required: 'a drop of blood, a piece of flesh, and a pinch of bone dust',
      });

      renderPopup(createSpell(), createPlayerStats(), mockCampaignName);

      expect(screen.getByText(/Material:/)).toBeInTheDocument();
      expect(screen.getByText(/Drop of Blood/)).toBeInTheDocument();
      expect(screen.getByText(/a drop of blood, a piece of flesh, and a pinch of bone dust/)).toBeInTheDocument();
      expect(screen.getByText('(not found in backpack)')).toBeInTheDocument();
    });

    it('hides missing indicator when player has the exact material in backpack', () => {
      vi.mocked(getConsumedMaterial).mockReturnValue({
        itemName: 'Diamond (300 gp)',
        required: 'a diamond worth 300+ GP',
      });
      vi.mocked(hasMaterial).mockReturnValue(true);

      renderPopup(createSpell(), createPlayerStats(), mockCampaignName);

      expect(screen.getByText(/Material:/)).toBeInTheDocument();
      expect(screen.getByText(/Diamond \(300 gp\)/)).toBeInTheDocument();
      expect(screen.queryByText('(not found in backpack)')).not.toBeInTheDocument();
    });

    it('does not render material section when spell has no consumed materials', () => {
      vi.mocked(getConsumedMaterial).mockReturnValue(null);

      renderPopup(createSpell(), createPlayerStats(), mockCampaignName);

      expect(screen.queryByText(/Material:/)).not.toBeInTheDocument();
    });
  });

  describe('Upcast formula resolution', () => {
    it.each([
      { modifier: 3, expected1: '1d8+3', expected2: '2d8+3', label: 'positive modifier' },
      { modifier: undefined, expected1: '1d8+0', expected2: '2d8+0', label: 'undefined defaults to 0' },
      { modifier: -1, expected1: '1d8+-1', expected2: '2d8+-1', label: 'negative modifier' },
    ])('replaces MOD with $label ($modifier)', ({ modifier, expected1, expected2 }) => {
      const stats = createPlayerStats({ spellAbilities: { modifier } });
      const spell = createSpell({
        damage: { damage_at_slot_level: { '1': '1d8+MOD', '2': '2d8+MOD' } },
      });
      const upcastLevels = [
        { level: 1, formula: '1d8+MOD', availableSlots: 4 },
        { level: 2, formula: '2d8+MOD', availableSlots: 3 },
      ];

      renderPopup(spell, stats, mockCampaignName, { upcastLevels });

      expect(screen.getByText(expected1)).toBeInTheDocument();
      expect(screen.getByText(expected2)).toBeInTheDocument();
      expect(screen.queryByText(/MOD/)).not.toBeInTheDocument();
    });

    it('handles MOD appearing multiple times in the same formula', () => {
      const stats = createPlayerStats({ spellAbilities: { modifier: 2 } });
      const spell = createSpell({
        damage: { damage_at_slot_level: { '1': '2d6+MOD+MOD', '2': '3d6+MOD+MOD' } },
      });
      const upcastLevels = [
        { level: 1, formula: '2d6+MOD+MOD', availableSlots: 4 },
        { level: 2, formula: '3d6+MOD+MOD', availableSlots: 3 },
      ];

      renderPopup(spell, stats, mockCampaignName, { upcastLevels });

      expect(screen.getByText('2d6+2+2')).toBeInTheDocument();
      expect(screen.getByText('3d6+2+2')).toBeInTheDocument();
      expect(screen.queryByText(/MOD/)).not.toBeInTheDocument();
    });

    it('handles MOD at the start of a formula', () => {
      const stats = createPlayerStats({ spellAbilities: { modifier: 5 } });
      const spell = createSpell({
        damage: { damage_at_slot_level: { '1': 'MOD+2d6', '2': 'MOD+3d6' } },
      });
      const upcastLevels = [
        { level: 1, formula: 'MOD+2d6', availableSlots: 4 },
        { level: 2, formula: 'MOD+3d6', availableSlots: 3 },
      ];

      renderPopup(spell, stats, mockCampaignName, { upcastLevels });

      expect(screen.getByText('5+2d6')).toBeInTheDocument();
      expect(screen.getByText('5+3d6')).toBeInTheDocument();
      expect(screen.queryByText(/MOD/)).not.toBeInTheDocument();
    });

  });
});
