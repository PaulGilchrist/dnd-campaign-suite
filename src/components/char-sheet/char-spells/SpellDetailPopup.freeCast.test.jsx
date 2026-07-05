// @cleaned-by-ai
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

  describe('runtime value–based free casts', () => {
    it.each([
      { key: 'naturalRecoveryFreeCast', value: ['Healing Word'], spellName: 'Healing Word', level: 1, dmg: { '1': '1d4+1' }, name: 'Natural Recovery' },
      { key: '_Bewitching_Magic_freeCast', value: true, spellName: 'Misty Step', level: 2, dmg: { '2': '3d6' }, name: 'Bewitching Magic' },
    ])('authorizes via $name', ({ key, value, spellName, level, dmg }) => {
      vi.mocked(getRuntimeValue).mockImplementation((_name, k) => {
        if (k === key) return value;
        return null;
      });

      const spell = {
        ...baseMockSpell,
        name: spellName,
        level,
        damage: { damage_at_slot_level: dmg },
      };
      renderPopup(spell);
      expect(
        screen.getByText('Free Cast — no spell slot consumed')
      ).toBeInTheDocument();
    });

    it('authorizes via Spell Mastery when spell name and level match', () => {
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
      renderPopup(spell);
      expect(
        screen.getByText('Free Cast — no spell slot consumed')
      ).toBeInTheDocument();
    });
  });

  describe('Selection-based free cast (Signature Spells, Divination Savant)', () => {
    it.each([
      { selectionKey: 'SignatureSpells_selection', usedKey: 'SignatureSpells_Fireball_used', spellName: 'Fireball', level: 3, dmg: { '3': '8d6' }, selection: ['Fireball'], name: 'Signature Spells' },
      { selectionKey: '_Divination_Savant_selection', usedKey: '_Divination_Savant_Warding_Bond_used', spellName: 'Warding Bond', level: 2, dmg: { '2': '2d6' }, selection: ['Warding Bond'], name: 'Divination Savant' },
    ])('authorizes when spell is in $name selection and not yet used', ({ selectionKey, usedKey, spellName, level, dmg }) => {
      vi.mocked(getRuntimeValue).mockImplementation((_name, key, _campaign) => {
        if (key === selectionKey) return ['Fireball', 'Warding Bond'].find(s => s === spellName) ? [spellName] : [];
        if (key === usedKey) return false;
        return null;
      });

      const spell = {
        ...baseMockSpell,
        name: spellName,
        level,
        damage: { damage_at_slot_level: dmg },
      };
      renderPopup(spell);
      expect(
        screen.getByText('Free Cast — no spell slot consumed')
      ).toBeInTheDocument();
    });

    it.each([
      { selectionKey: 'SignatureSpells_selection', usedKey: 'SignatureSpells_Fireball_used', spellName: 'Fireball', level: 3, dmg: { '3': '8d6' }, name: 'Signature Spells' },
      { selectionKey: '_Divination_Savant_selection', usedKey: '_Divination_Savant_Warding_Bond_used', spellName: 'Warding Bond', level: 2, dmg: { '2': '2d6' }, name: 'Divination Savant' },
    ])('does not authorize when spell in $name selection has already been used', ({ selectionKey, usedKey, spellName, level, dmg }) => {
      vi.mocked(getRuntimeValue).mockImplementation((_name, key, _campaign) => {
        if (key === selectionKey) return [spellName];
        if (key === usedKey) return true;
        return null;
      });

      const spell = {
        ...baseMockSpell,
        name: spellName,
        level,
        damage: { damage_at_slot_level: dmg },
      };
      renderPopup(spell);
      expect(
        screen.queryByText('Free Cast — no spell slot consumed')
      ).not.toBeInTheDocument();
    });
  });

  describe('Phantasmal Creatures free cast', () => {
    it.each([
      { count: 1, shouldAuthorize: true, name: 'count > 0' },
      { count: 0, shouldAuthorize: false, name: 'count is 0' },
    ])('authorizes for Summon Beast when passive exists and $name', ({ count, shouldAuthorize }) => {
      vi.mocked(getRuntimeValue).mockImplementation((_name, key) => {
        if (key === '_Phantasmal_Creatures_freeCastCount') return count;
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
      if (shouldAuthorize) {
        expect(
          screen.getByText('Free Cast — no spell slot consumed')
        ).toBeInTheDocument();
      } else {
        expect(
          screen.queryByText('Free Cast — no spell slot consumed')
        ).not.toBeInTheDocument();
      }
    });
  });

  describe('counter-based free_spell actions', () => {
    it('authorizes via Mystic Arcanum when level matches and count > 0', () => {
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
  });

  describe('fey_reinforcements and dragon_companion action types', () => {
    it.each([
      { entryType: 'fey_reinforcements', entryName: 'Fey Reinforcements', freeCastKey: '_Fey_Reinforcements_freeCast', spellName: 'Hunters Mark', level: 1, dmg: { '1': '1d6' } },
      { entryType: 'dragon_companion', entryName: 'Dragon Companion', freeCastKey: '_Dragon_Companion_freeCast', spellName: 'Dragon Breath', level: 1, dmg: { '1': '2d6' } },
    ])('authorizes via $entryType by spell name', ({ entryType, entryName, freeCastKey, spellName, level, dmg }) => {
      vi.mocked(getRuntimeValue).mockImplementation((_name, key) => {
        if (key === freeCastKey) return [spellName];
        return null;
      });

      const stats = {
        ...baseMockPlayerStats,
        automation: {
          passives: [],
          actions: [
            {
              name: entryName,
              type: entryType,
              spell: spellName,
            },
          ],
        },
      };
      const spell = {
        ...baseMockSpell,
        name: spellName,
        level,
        damage: { damage_at_slot_level: dmg },
      };
      renderPopup(spell, stats);
      expect(
        screen.getByText('Free Cast — no spell slot consumed')
      ).toBeInTheDocument();
    });
  });
});
