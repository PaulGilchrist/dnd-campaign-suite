import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import SpellDetailPopup from './SpellDetailPopup.jsx';
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { getActiveBuffs } from '../../../services/combat/buffs/buffService.js';

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

describe('SpellDetailPopup - canCast and button state', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.mocked(getRuntimeValue).mockReturnValue(null);
    vi.mocked(getActiveBuffs).mockReturnValue([]);
    vi.mocked(setRuntimeValue).mockReturnValue();
  });

  describe('Rage blocking', () => {
    it('disables Cast Spell button when player is raging', () => {
      vi.mocked(getActiveBuffs).mockReturnValue([{ name: 'Rage' }]);

      const spell = {
        ...baseMockSpell,
        name: 'Fireball',
        level: 3,
        damage: { damage_at_slot_level: { '3': '8d6' } },
      };
      const stats = {
        ...baseMockPlayerStats,
        automation: { passives: [], actions: [] },
      };
      renderPopup(spell, stats);
      expect(screen.getByRole('button', { name: /Cast Spell/ })).toBeDisabled();
    });

    it('allows casting when not raging even with other buffs', () => {
      vi.mocked(getActiveBuffs).mockReturnValue([{ name: 'Bless' }, { name: 'Shield of Faith' }]);

      const nonUpcastableSpell = {
        ...baseMockSpell,
        damage: { damage_at_slot_level: { '1': '3d4+1' } },
      };
      renderPopup(nonUpcastableSpell);
      expect(screen.getByRole('button', { name: /Cast Spell/ })).toBeEnabled();
    });
  });

  describe('Cantrip casting', () => {
    it('enables Cast Spell for cantrips regardless of slots', () => {
      const cantrip = {
        ...baseMockSpell,
        level: 0,
        damage: { damage_at_slot_level: { '0': '1d6' } },
      };
      const stats = {
        ...baseMockPlayerStats,
        spellAbilities: {
          ...baseMockPlayerStats.spellAbilities,
          spell_slots_level_1: 0,
        },
      };
      renderPopup(cantrip, stats);
      expect(screen.getByRole('button', { name: /Cast Spell/ })).toBeEnabled();
    });
  });

  describe('Free cast authorization enabling cast', () => {
    it('enables Cast Spell when freeCastAuthorized even with zero slots', () => {
      vi.mocked(getRuntimeValue).mockImplementation((_name, key) => {
        if (key === 'naturalRecoveryFreeCast') return ['Healing Word'];
        return null;
      });

      const spell = {
        ...baseMockSpell,
        name: 'Healing Word',
        level: 1,
        damage: { damage_at_slot_level: { '1': '1d4+1' } },
      };
      const stats = {
        ...baseMockPlayerStats,
        spellAbilities: {
          ...baseMockPlayerStats.spellAbilities,
          spell_slots_level_1: 0,
        },
      };
      renderPopup(spell, stats);
      expect(screen.getByRole('button', { name: /Cast Spell/ })).toBeEnabled();
    });
  });

  describe('No slots message', () => {
    it('shows "No spell slots available" when canCast is false for non-cantrip', () => {
      const spell = {
        ...baseMockSpell,
        name: 'Fireball',
        level: 3,
        damage: { damage_at_slot_level: { '3': '8d6' } },
      };
      const stats = {
        ...baseMockPlayerStats,
        spellAbilities: {
          ...baseMockPlayerStats.spellAbilities,
          spell_slots_level_3: 0,
        },
      };
      vi.mocked(getRuntimeValue).mockReturnValue(0);
      renderPopup(spell, stats);
      expect(screen.getByText('No spell slots available for this level.')).toBeInTheDocument();
    });

    it('does not show "No spell slots available" for cantrips', () => {
      const cantrip = {
        ...baseMockSpell,
        level: 0,
        damage: { damage_at_slot_level: { '0': '1d6' } },
      };
      const stats = {
        ...baseMockPlayerStats,
        spellAbilities: {
          ...baseMockPlayerStats.spellAbilities,
          spell_slots_level_1: 0,
        },
      };
      renderPopup(cantrip, stats);
      expect(screen.queryByText('No spell slots available for this level.')).not.toBeInTheDocument();
    });

    it('does not show "No spell slots available" when free cast is authorized', () => {
      vi.mocked(getRuntimeValue).mockImplementation((_name, key) => {
        if (key === 'naturalRecoveryFreeCast') return ['Fireball'];
        return null;
      });

      const spell = {
        ...baseMockSpell,
        name: 'Fireball',
        level: 3,
        damage: { damage_at_slot_level: { '3': '8d6' } },
      };
      const stats = {
        ...baseMockPlayerStats,
        spellAbilities: {
          ...baseMockPlayerStats.spellAbilities,
          spell_slots_level_3: 0,
        },
      };
      renderPopup(spell, stats);
      expect(screen.queryByText('No spell slots available for this level.')).not.toBeInTheDocument();
    });
  });

  describe('Upcast selector visibility', () => {
    it('hides upcast selector when only one upcast level exists', () => {
      const upcastLevels = [
        { level: 1, formula: '3d4+1', availableSlots: 4 },
      ];
      renderPopup(baseMockSpell, baseMockPlayerStats, mockCampaignName, { upcastLevels });
      expect(screen.queryByText(/Cast at Level:/)).not.toBeInTheDocument();
    });

    it('hides upcast selector when spell is not upcastable (single damage value)', () => {
      const nonUpcastableSpell = {
        ...baseMockSpell,
        damage: { damage_at_slot_level: { '1': '3d4+1' } },
      };
      const upcastLevels = [
        { level: 1, formula: '3d4+1', availableSlots: 4 },
        { level: 2, formula: '4d4+1', availableSlots: 3 },
      ];
      renderPopup(nonUpcastableSpell, baseMockPlayerStats, mockCampaignName, { upcastLevels });
      expect(screen.queryByText(/Cast at Level:/)).not.toBeInTheDocument();
    });
  });
});
