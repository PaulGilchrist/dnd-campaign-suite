/* @improved-by-ai */
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

describe('SpellDetailPopup - Free Cast Authorization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.mocked(getRuntimeValue).mockReturnValue(null);
    vi.mocked(getActiveBuffs).mockReturnValue([]);
    vi.mocked(setRuntimeValue).mockReturnValue();
  });

  describe('free cast authorization - multiple pathways', () => {
    it('authorizes free cast via naturalRecoveryFreeCast runtime value', () => {
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
      const stats = { ...baseMockPlayerStats };
      renderPopup(spell, stats);
      expect(
        screen.getByText('Free Cast — no spell slot consumed')
      ).toBeInTheDocument();
    });

    it('authorizes free cast via bewitching magic for Misty Step only', () => {
      vi.mocked(getRuntimeValue).mockImplementation((_name, key) => {
        if (key === '_Bewitching_Magic_freeCast') return true;
        return null;
      });

      const spell = {
        ...baseMockSpell,
        name: 'Misty Step',
        level: 2,
        damage: { damage_at_slot_level: { '2': '3d6' } },
      };
      const stats = { ...baseMockPlayerStats };
      renderPopup(spell, stats);
      expect(
        screen.getByText('Free Cast — no spell slot consumed')
      ).toBeInTheDocument();
    });

    it('does not authorize bewitching magic for non-Misty Step spells', () => {
      vi.mocked(getRuntimeValue).mockImplementation((_name, key) => {
        if (key === '_Bewitching_Magic_freeCast') return true;
        return null;
      });

      const spell = {
        ...baseMockSpell,
        name: 'Haste',
        level: 3,
        damage: { damage_at_slot_level: { '3': '6d6' } },
      };
      const stats = { ...baseMockPlayerStats };
      renderPopup(spell, stats);
      expect(
        screen.queryByText('Free Cast — no spell slot consumed')
      ).not.toBeInTheDocument();
    });

    it('authorizes free cast via Spell Mastery level 1', () => {
      vi.mocked(getRuntimeValue).mockImplementation((_name, key, _campaign) => {
        if (key === 'SpellMastery_level1') return 'Shield';
        return null;
      });

      const spell = {
        ...baseMockSpell,
        name: 'Shield',
        level: 1,
        damage: { damage_at_slot_level: { '1': '1d5+1' } },
      };
      const stats = { ...baseMockPlayerStats };
      renderPopup(spell, stats);
      expect(
        screen.getByText('Free Cast — no spell slot consumed')
      ).toBeInTheDocument();
    });

    it('authorizes free cast via Spell Mastery level 2', () => {
      vi.mocked(getRuntimeValue).mockImplementation((_name, key, _campaign) => {
        if (key === 'SpellMastery_level2') return 'Elemental Bane';
        return null;
      });

      const spell = {
        ...baseMockSpell,
        name: 'Elemental Bane',
        level: 2,
        damage: { damage_at_slot_level: { '2': '2d8' } },
      };
      const stats = { ...baseMockPlayerStats };
      renderPopup(spell, stats);
      expect(
        screen.getByText('Free Cast — no spell slot consumed')
      ).toBeInTheDocument();
    });

    it('does not authorize Spell Mastery for wrong level', () => {
      vi.mocked(getRuntimeValue).mockImplementation((_name, key, _campaign) => {
        if (key === 'SpellMastery_level1') return 'Magic Missile';
        return null;
      });

      const spell = {
        ...baseMockSpell,
        name: 'Magic Missile',
        level: 2,
        damage: { damage_at_slot_level: { '2': '4d4+1' } },
      };
      const stats = { ...baseMockPlayerStats };
      renderPopup(spell, stats);
      expect(
        screen.queryByText('Free Cast — no spell slot consumed')
      ).not.toBeInTheDocument();
    });

    it('authorizes free cast via Signature Spells for level 3', () => {
      vi.mocked(getRuntimeValue).mockImplementation((_name, key, _campaign) => {
        if (key === 'SignatureSpells_selection') return ['Fireball'];
        if (key === 'SignatureSpells_Fireball_used') return false;
        return null;
      });

      const spell = {
        ...baseMockSpell,
        name: 'Fireball',
        level: 3,
        damage: { damage_at_slot_level: { '3': '8d6' } },
      };
      const stats = { ...baseMockPlayerStats };
      renderPopup(spell, stats);
      expect(
        screen.getByText('Free Cast — no spell slot consumed')
      ).toBeInTheDocument();
    });

    it('does not authorize Signature Spells after they are used', () => {
      vi.mocked(getRuntimeValue).mockImplementation((_name, key, _campaign) => {
        if (key === 'SignatureSpells_selection') return ['Fireball'];
        if (key === 'SignatureSpells_Fireball_used') return true;
        return null;
      });

      const spell = {
        ...baseMockSpell,
        name: 'Fireball',
        level: 3,
        damage: { damage_at_slot_level: { '3': '8d6' } },
      };
      const stats = { ...baseMockPlayerStats };
      renderPopup(spell, stats);
      expect(
        screen.queryByText('Free Cast — no spell slot consumed')
      ).not.toBeInTheDocument();
    });

    it('does not authorize Signature Spells for non-level 3 spells', () => {
      vi.mocked(getRuntimeValue).mockImplementation((_name, key, _campaign) => {
        if (key === 'SignatureSpells_selection') return ['Shield'];
        return null;
      });

      const spell = {
        ...baseMockSpell,
        name: 'Shield',
        level: 1,
        damage: { damage_at_slot_level: { '1': '1d5+1' } },
      };
      const stats = { ...baseMockPlayerStats };
      renderPopup(spell, stats);
      expect(
        screen.queryByText('Free Cast — no spell slot consumed')
      ).not.toBeInTheDocument();
    });

    it('authorizes free cast via Divination Savant', () => {
      vi.mocked(getRuntimeValue).mockImplementation((_name, key, _campaign) => {
        if (key === '_Divination_Savant_selection') return ['Warding Bond'];
        if (key === '_Divination_Savant_Warding_Bond_used') return false;
        return null;
      });

      const spell = {
        ...baseMockSpell,
        name: 'Warding Bond',
        level: 2,
        damage: { damage_at_slot_level: { '2': '2d6' } },
      };
      const stats = { ...baseMockPlayerStats };
      renderPopup(spell, stats);
      expect(
        screen.getByText('Free Cast — no spell slot consumed')
      ).toBeInTheDocument();
    });

    it('does not authorize Divination Savant after used', () => {
      vi.mocked(getRuntimeValue).mockImplementation((_name, key, _campaign) => {
        if (key === '_Divination_Savant_selection') return ['Warding Bond'];
        if (key === '_Divination_Savant_Warding_Bond_used') return true;
        return null;
      });

      const spell = {
        ...baseMockSpell,
        name: 'Warding Bond',
        level: 2,
        damage: { damage_at_slot_level: { '2': '2d6' } },
      };
      const stats = { ...baseMockPlayerStats };
      renderPopup(spell, stats);
      expect(
        screen.queryByText('Free Cast — no spell slot consumed')
      ).not.toBeInTheDocument();
    });

    it('authorizes free cast via Phantasmal Creatures for Summon Beast', () => {
      vi.mocked(getRuntimeValue).mockImplementation((_name, key) => {
        if (key === '_Phantasmal_Creatures_freeCastCount') return 1;
        return null;
      });

      const spell = {
        ...baseMockSpell,
        name: 'Summon Beast',
        level: 2,
        damage: { damage_at_slot_level: { '2': '3d6' } },
      };
      const stats = {
        ...baseMockPlayerStats,
        automation: {
          passives: [{ type: 'phantasmal_creatures' }],
          actions: [],
        },
      };
      renderPopup(spell, stats);
      expect(
        screen.getByText('Free Cast — no spell slot consumed')
      ).toBeInTheDocument();
    });

    it('authorizes free cast via Phantasmal Creatures for Summon Fey', () => {
      vi.mocked(getRuntimeValue).mockImplementation((_name, key) => {
        if (key === '_Phantasmal_Creatures_freeCastCount') return 2;
        return null;
      });

      const spell = {
        ...baseMockSpell,
        name: 'Summon Fey',
        level: 2,
        damage: { damage_at_slot_level: { '2': '3d6' } },
      };
      const stats = {
        ...baseMockPlayerStats,
        automation: {
          passives: [{ type: 'phantasmal_creatures' }],
          actions: [],
        },
      };
      renderPopup(spell, stats);
      expect(
        screen.getByText('Free Cast — no spell slot consumed')
      ).toBeInTheDocument();
    });

    it('does not authorize Phantasmal Creatures without the passive', () => {
      vi.mocked(getRuntimeValue).mockImplementation((_name, key) => {
        if (key === '_Phantasmal_Creatures_freeCastCount') return 1;
        return null;
      });

      const spell = {
        ...baseMockSpell,
        name: 'Summon Beast',
        level: 2,
        damage: { damage_at_slot_level: { '2': '3d6' } },
      };
      const stats = {
        ...baseMockPlayerStats,
        automation: { passives: [], actions: [] },
      };
      renderPopup(spell, stats);
      expect(
        screen.queryByText('Free Cast — no spell slot consumed')
      ).not.toBeInTheDocument();
    });

    it('does not authorize Phantasmal Creatures for non-summon spells', () => {
      vi.mocked(getRuntimeValue).mockImplementation((_name, key) => {
        if (key === '_Phantasmal_Creatures_freeCastCount') return 1;
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
        automation: {
          passives: [{ type: 'phantasmal_creatures' }],
          actions: [],
        },
      };
      renderPopup(spell, stats);
      expect(
        screen.queryByText('Free Cast — no spell slot consumed')
      ).not.toBeInTheDocument();
    });

    it('does not authorize Phantasmal Creatures when count is 0', () => {
      vi.mocked(getRuntimeValue).mockImplementation((_name, key) => {
        if (key === '_Phantasmal_Creatures_freeCastCount') return 0;
        return null;
      });

      const spell = {
        ...baseMockSpell,
        name: 'Summon Beast',
        level: 2,
        damage: { damage_at_slot_level: { '2': '3d6' } },
      };
      const stats = {
        ...baseMockPlayerStats,
        automation: {
          passives: [{ type: 'phantasmal_creatures' }],
          actions: [],
        },
      };
      renderPopup(spell, stats);
      expect(
        screen.queryByText('Free Cast — no spell slot consumed')
      ).not.toBeInTheDocument();
    });

    it('authorizes free cast via counter-based free_spell (Mystic Arcanum pattern)', () => {
      vi.mocked(getRuntimeValue).mockImplementation((_name, key) => {
        if (key === '_Mystic_Arcanum_freeCastCount') return 1;
        return null;
      });

      const spell = {
        ...baseMockSpell,
        name: 'a level 9 Warlock spell (your choice)',
        level: 9,
        damage: { damage_at_slot_level: { '9': '10d6' } },
      };
      const stats = {
        ...baseMockPlayerStats,
        automation: {
          passives: [],
          actions: [
            {
              name: 'Mystic Arcanum',
              type: 'free_spell',
              spell: 'a level 9 Warlock spell (your choice)',
              uses_expression: '1/rest',
              usesMax: 1,
            },
          ],
        },
      };
      renderPopup(spell, stats);
      expect(
        screen.getByText('Free Cast — no spell slot consumed')
      ).toBeInTheDocument();
    });

    it('does not authorize counter-based free_spell when level does not match', () => {
      vi.mocked(getRuntimeValue).mockImplementation((_name, key) => {
        if (key === '_Mystic_Arcanum_freeCastCount') return 1;
        return null;
      });

      const spell = {
        ...baseMockSpell,
        name: 'a level 9 Warlock spell (your choice)',
        level: 8,
        damage: { damage_at_slot_level: { '8': '8d6' } },
      };
      const stats = {
        ...baseMockPlayerStats,
        automation: {
          passives: [],
          actions: [
            {
              name: 'Mystic Arcanum',
              type: 'free_spell',
              spell: 'a level 9 Warlock spell (your choice)',
              uses_expression: '1/rest',
              usesMax: 1,
            },
          ],
        },
      };
      renderPopup(spell, stats);
      expect(
        screen.queryByText('Free Cast — no spell slot consumed')
      ).not.toBeInTheDocument();
    });

    it('authorizes free cast via perSpellTracking action entry', () => {
      vi.mocked(getRuntimeValue).mockImplementation((_name, key) => {
        if (key === '_Fey_Touched_freeCast') return ['Shield'];
        return null;
      });

      const spell = {
        ...baseMockSpell,
        name: 'Shield',
        level: 1,
        damage: { damage_at_slot_level: { '1': '1d5+1' } },
      };
      const stats = {
        ...baseMockPlayerStats,
        automation: {
          passives: [],
          actions: [
            {
              name: 'Fey Touched',
              type: 'free_spell',
              spell: 'Shield',
              perSpellTracking: false,
            },
          ],
        },
      };
      renderPopup(spell, stats);
      expect(
        screen.getByText('Free Cast — no spell slot consumed')
      ).toBeInTheDocument();
    });
  });

  describe('free cast for fey_reinforcements and dragon_companion action types', () => {
    it('authorizes free cast via fey_reinforcements type by spell name', () => {
      vi.mocked(getRuntimeValue).mockImplementation((_name, key) => {
        if (key === '_Fey_Reinforcements_freeCast') return ['Hunters Mark'];
        return null;
      });

      const spell = {
        ...baseMockSpell,
        name: 'Hunters Mark',
        level: 1,
        damage: { damage_at_slot_level: { '1': '1d6' } },
      };
      const stats = {
        ...baseMockPlayerStats,
        automation: {
          passives: [],
          actions: [
            {
              name: 'Fey Reinforcements',
              type: 'fey_reinforcements',
              spell: 'Hunters Mark',
            },
          ],
        },
      };
      renderPopup(spell, stats);
      expect(
        screen.getByText('Free Cast — no spell slot consumed')
      ).toBeInTheDocument();
    });

    it('authorizes free cast via dragon_companion type by spell name', () => {
      vi.mocked(getRuntimeValue).mockImplementation((_name, key) => {
        if (key === '_Dragon_Companion_freeCast') return ['Dragon Breath'];
        return null;
      });

      const spell = {
        ...baseMockSpell,
        name: 'Dragon Breath',
        level: 1,
        damage: { damage_at_slot_level: { '1': '2d6' } },
      };
      const stats = {
        ...baseMockPlayerStats,
        automation: {
          passives: [],
          actions: [
            {
              name: 'Dragon Companion',
              type: 'dragon_companion',
              spell: 'Dragon Breath',
            },
          ],
        },
      };
      renderPopup(spell, stats);
      expect(
        screen.getByText('Free Cast — no spell slot consumed')
      ).toBeInTheDocument();
    });
  });
});
