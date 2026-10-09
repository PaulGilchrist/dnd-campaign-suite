// @improved-by-ai
// @cleaned-by-ai
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import SpellDetailPopup from './SpellDetailPopup.jsx';
import { getRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { getActiveBuffs } from '../../../services/combat/buffs/buffService.js';
import { isFreeCastAuthorized } from '../../../services/rules/spells/spellPreparationService.js';
import { getConsumedMaterial } from '../../../services/rules/spells/materialComponents.js';

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(),
  useRuntimeValue: vi.fn(() => null),
}));

vi.mock('../../../services/combat/buffs/buffService.js', () => ({
  getActiveBuffs: vi.fn(() => []),
}));

vi.mock('../../../services/rules/spells/spellPreparationService.js', () => ({
  isFreeCastAuthorized: vi.fn(() => false),
  isWizardRitualAdeptSpell: vi.fn(() => false),
}));

vi.mock('../../../services/rules/spells/materialComponents.js', () => ({
  getConsumedMaterial: vi.fn(() => null),
  hasMaterial: vi.fn(() => true),
}));

const baseMockPlayerStats = {
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
  },
  automation: { passives: [], actions: [] },
};

const mockCampaignName = 'test-campaign';

const baseMockSpell = {
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
};

const renderPopup = (
  spell = baseMockSpell,
  playerStats = baseMockPlayerStats,
  campaignName = mockCampaignName,
  extraProps = {}
) =>
  render(
    <SpellDetailPopup
      spell={spell}
      playerStats={playerStats}
      campaignName={campaignName}
      onClose={vi.fn()}
      {...extraProps}
    />
  );

describe('SpellDetailPopup - Improved Illusions feature', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getRuntimeValue).mockReturnValue(null);
    vi.mocked(getActiveBuffs).mockReturnValue([]);
    vi.mocked(isFreeCastAuthorized).mockReturnValue(false);
    vi.mocked(getConsumedMaterial).mockReturnValue(null);
  });

  const warlockWithImprovedIllusions = {
    ...baseMockPlayerStats,
    class: { name: 'Warlock', major: { name: 'Warlock' } },
    automation: {
      passives: [{ type: 'improved_illusions' }],
      actions: [],
    },
  };

  const illusionSpell = {
    ...baseMockSpell,
    name: 'Disguise Self',
    level: 1,
    school: 'Illusion',
  };

  describe('Improved Illusions banner display', () => {
    it('shows the banner for warlock with improved illusions casting an illusion spell', () => {
      renderPopup(illusionSpell, warlockWithImprovedIllusions, mockCampaignName);
      expect(screen.getByText('No Verbal components (Improved Illusions)')).toBeInTheDocument();
    });

    it('does not show the banner when warlock lacks the improved illusions passive', () => {
      const warlockNoPassive = {
        ...baseMockPlayerStats,
        class: { name: 'Warlock', major: { name: 'Warlock' } },
        automation: { passives: [], actions: [] },
      };

      renderPopup(illusionSpell, warlockNoPassive, mockCampaignName);
      expect(screen.queryByText('No Verbal components (Improved Illusions)')).not.toBeInTheDocument();
    });

    it('does not show the banner for non-warlock class casting an illusion spell', () => {
      renderPopup(illusionSpell, baseMockPlayerStats, mockCampaignName);
      expect(screen.queryByText('No Verbal components (Improved Illusions)')).not.toBeInTheDocument();
    });

    it('does not show the banner for non-illusion spell school', () => {
      const evocationSpell = {
        ...baseMockSpell,
        name: 'Magic Missile',
        level: 1,
        school: 'Evocation',
      };

      renderPopup(evocationSpell, warlockWithImprovedIllusions, mockCampaignName);
      expect(screen.queryByText('No Verbal components (Improved Illusions)')).not.toBeInTheDocument();
    });

    it('does not show the banner when school is null, undefined, or empty string', () => {
      const warlockStats = warlockWithImprovedIllusions;
      const cases = [
        { name: 'null', school: null },
        { name: 'undefined', school: undefined },
        { name: 'empty string', school: '' },
      ];

      for (const { school } of cases) {
        const spell = {
          ...baseMockSpell,
          name: 'Magic Missile',
          level: 1,
          school,
        };

        renderPopup(spell, warlockStats, mockCampaignName);
        expect(screen.queryByText('No Verbal components (Improved Illusions)')).not.toBeInTheDocument();
      }
    });

    it('shows the banner for illusion school with lowercase casing (case-insensitive match)', () => {
      const lowercaseIllusionSpell = {
        ...baseMockSpell,
        name: 'Disguise Self',
        level: 1,
        school: 'illusion',
      };

      renderPopup(lowercaseIllusionSpell, warlockWithImprovedIllusions, mockCampaignName);
      expect(screen.getByText('No Verbal components (Improved Illusions)')).toBeInTheDocument();
    });
  });

  describe('Both Psychic Spells and Improved Illusions banners', () => {
    it('shows both banners when warlock has both passives and casts an illusion spell', () => {
      const warlockStats = {
        ...baseMockPlayerStats,
        class: { name: 'Warlock', major: { name: 'Warlock' } },
        automation: {
          passives: [
            { type: 'psychic_spells' },
            { type: 'improved_illusions' },
          ],
          actions: [],
        },
      };

      renderPopup(illusionSpell, warlockStats, mockCampaignName);
      expect(screen.getByText('No Verbal or Somatic components (Psychic Spells)')).toBeInTheDocument();
      expect(screen.getByText('No Verbal components (Improved Illusions)')).toBeInTheDocument();
    });

    it('shows only psychic spells banner for enchantment spell with psychic spells but no improved illusions', () => {
      const warlockStats = {
        ...baseMockPlayerStats,
        class: { name: 'Warlock', major: { name: 'Warlock' } },
        automation: {
          passives: [{ type: 'psychic_spells' }],
          actions: [],
        },
      };

      const enchantmentSpell = {
        ...baseMockSpell,
        name: 'Bane',
        level: 1,
        school: 'Enchantment',
      };

      renderPopup(enchantmentSpell, warlockStats, mockCampaignName);
      expect(screen.getByText('No Verbal or Somatic components (Psychic Spells)')).toBeInTheDocument();
      expect(screen.queryByText('No Verbal components (Improved Illusions)')).not.toBeInTheDocument();
    });

    it('shows only psychic spells banner for enchantment spell with both passives', () => {
      const warlockStats = {
        ...baseMockPlayerStats,
        class: { name: 'Warlock', major: { name: 'Warlock' } },
        automation: {
          passives: [
            { type: 'psychic_spells' },
            { type: 'improved_illusions' },
          ],
          actions: [],
        },
      };

      const enchantmentSpell = {
        ...baseMockSpell,
        name: 'Bane',
        level: 1,
        school: 'Enchantment',
      };

      renderPopup(enchantmentSpell, warlockStats, mockCampaignName);
      expect(screen.getByText('No Verbal or Somatic components (Psychic Spells)')).toBeInTheDocument();
      expect(screen.queryByText('No Verbal components (Improved Illusions)')).not.toBeInTheDocument();
    });
  });
});
