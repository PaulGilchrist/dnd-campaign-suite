/* @improved-by-ai */
import { render, screen, fireEvent } from '@testing-library/react';
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

describe('SpellDetailPopup - Cast Behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.mocked(getRuntimeValue).mockReturnValue(null);
    vi.mocked(getActiveBuffs).mockReturnValue([]);
    vi.mocked(setRuntimeValue).mockReturnValue();
  });

  describe('onCast - free cast path marking used', () => {
    it('marks Signature Spells as used after casting', () => {
      vi.mocked(getRuntimeValue).mockImplementation((_name, key, _campaign) => {
        if (key === 'SignatureSpells_selection') return ['Fireball'];
        if (key === 'SignatureSpells_Fireball_used') return false;
        return null;
      });
      vi.mocked(setRuntimeValue).mockReturnValue();

      const onCast = vi.fn();
      const spell = {
        ...baseMockSpell,
        name: 'Fireball',
        level: 3,
        damage: { damage_at_slot_level: { '3': '8d6' } },
      };
      const stats = { ...baseMockPlayerStats };
      renderPopup(spell, stats, mockCampaignName, { onCast });

      fireEvent.click(screen.getByRole('button', { name: /Cast Spell/ }));
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Elara',
        'SignatureSpells_Fireball_used',
        true,
        mockCampaignName
      );
    });

    it('marks counter-based free cast count down after casting', () => {
      vi.mocked(getRuntimeValue).mockImplementation((_name, key) => {
        if (key === '_Mystic_Arcanum_freeCastCount') return 1;
        return null;
      });
      vi.mocked(setRuntimeValue).mockReturnValue();

      const onCast = vi.fn();
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
      renderPopup(spell, stats, mockCampaignName, { onCast });

      fireEvent.click(screen.getByRole('button', { name: /Cast Spell/ }));
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Elara',
        '_Mystic_Arcanum_freeCastCount',
        0,
        mockCampaignName
      );
    });

    it('marks perSpellTracking entry as used after casting', () => {
      vi.mocked(getRuntimeValue).mockImplementation((_name, key) => {
        if (key === '_Fey_Touched_Shard_Touch_freeCast') return true;
        return null;
      });
      vi.mocked(setRuntimeValue).mockReturnValue();

      const onCast = vi.fn();
      const spell = {
        ...baseMockSpell,
        name: 'Shard Touch',
        level: 1,
        damage: { damage_at_slot_level: { '1': '1d6' } },
      };
      const stats = {
        ...baseMockPlayerStats,
        automation: {
          passives: [],
          actions: [
            {
              name: 'Fey Touched',
              type: 'free_spell',
              spell: 'Shard Touch',
              perSpellTracking: true,
            },
          ],
        },
      };
      renderPopup(spell, stats, mockCampaignName, { onCast });

      fireEvent.click(screen.getByRole('button', { name: /Cast Spell/ }));
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Elara',
        '_Fey_Touched_Shard_Touch_used',
        true,
        mockCampaignName
      );
    });
  });

  describe('onCast - Phantasmal Creatures modifications', () => {
    it('changes school to Illusion and sets _phantasmalCreatures flag for summon spells', () => {
      vi.mocked(getRuntimeValue).mockImplementation((_name, key) => {
        if (key === '_Phantasmal_Creatures_freeCastCount') return 1;
        if (key === '_phantasmalCreatures_list') return [];
        return null;
      });
      vi.mocked(setRuntimeValue).mockReturnValue();

      const onCast = vi.fn();
      const spell = {
        ...baseMockSpell,
        name: 'Summon Beast',
        level: 2,
        school: 'Conjuration',
        damage: { damage_at_slot_level: { '2': '3d6' } },
      };
      const stats = {
        ...baseMockPlayerStats,
        automation: {
          passives: [{ type: 'phantasmal_creatures' }],
          actions: [],
        },
      };
      renderPopup(spell, stats, mockCampaignName, { onCast });

      fireEvent.click(screen.getByRole('button', { name: /Cast Spell/ }));
      expect(onCast).toHaveBeenCalledTimes(1);
      const castSpell = onCast.mock.calls[0][0];
      expect(castSpell.school).toBe('Illusion');
      expect(castSpell._phantasmalCreatures).toBe(true);
    });

    it('adds summon creature name to _phantasmalCreatures_list runtime value', () => {
      vi.mocked(getRuntimeValue).mockImplementation((_name, key) => {
        if (key === '_Phantasmal_Creatures_freeCastCount') return 1;
        if (key === '_phantasmalCreatures_list') return [];
        return null;
      });
      vi.mocked(setRuntimeValue).mockReturnValue();

      const onCast = vi.fn();
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
      renderPopup(spell, stats, mockCampaignName, { onCast });

      fireEvent.click(screen.getByRole('button', { name: /Cast Spell/ }));
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Elara',
        '_phantasmalCreatures_list',
        ['Bestial Spirit'],
        mockCampaignName
      );
    });

    it('does not duplicate creature name in _phantasmalCreatures_list', () => {
      vi.mocked(getRuntimeValue).mockImplementation((_name, key) => {
        if (key === '_Phantasmal_Creatures_freeCastCount') return 1;
        if (key === '_phantasmalCreatures_list') return ['Bestial Spirit'];
        return null;
      });
      vi.mocked(setRuntimeValue).mockImplementation((_name, _key, value) => {
        if (_key === '_phantasmalCreatures_list') {
          expect(value).toEqual(['Bestial Spirit']);
        }
      });

      const onCast = vi.fn();
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
      renderPopup(spell, stats, mockCampaignName, { onCast });

      fireEvent.click(screen.getByRole('button', { name: /Cast Spell/ }));
      expect(onCast).toHaveBeenCalledTimes(1);
    });

    it('does not modify school for non-summon spells with phantasmal creatures', () => {
      vi.mocked(getRuntimeValue).mockImplementation((_name, key) => {
        if (key === '_Phantasmal_Creatures_freeCastCount') return 1;
        return null;
      });
      vi.mocked(setRuntimeValue).mockReturnValue();

      const onCast = vi.fn();
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
      renderPopup(spell, stats, mockCampaignName, { onCast });

      fireEvent.click(screen.getByRole('button', { name: /Cast Spell/ }));
      const castSpell = onCast.mock.calls[0][0];
      expect(castSpell.school).toBe('Evocation');
      expect(castSpell._phantasmalCreatures).toBeUndefined();
    });
  });

  describe('onCast - upcast slot decrement', () => {
    it('decrements the correct slot level when casting at upcast level', () => {
      vi.mocked(getRuntimeValue).mockReturnValue(null);
      vi.mocked(setRuntimeValue).mockReturnValue();

      const onCast = vi.fn();
      const upcastLevels = [
        { level: 1, formula: '3d4+1', availableSlots: 4 },
        { level: 2, formula: '4d4+1', availableSlots: 3 },
        { level: 3, formula: '5d4+1', availableSlots: 2 },
      ];
      renderPopup(baseMockSpell, baseMockPlayerStats, mockCampaignName, {
        onCast,
        upcastLevels,
      });

      // Select level 3
      const radios = screen.getAllByRole('radio');
      fireEvent.click(radios[2]);
      expect(radios[2]).toBeChecked();

      fireEvent.click(screen.getByRole('button', { name: /Cast Spell/ }));
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Elara',
        'spell_slots_level_3',
        1,
        mockCampaignName
      );
    });
  });

  describe('onCast - meta context for Spell Breaker', () => {
    it('passes dispelAbilityCheckBonus calculated from character level', () => {
      vi.mocked(getRuntimeValue).mockReturnValue(null);

      const onCast = vi.fn();
      const spellBreakerStats = {
        ...baseMockPlayerStats,
        level: 11,
        automation: {
          passives: [{ type: 'spell_breaker' }],
          actions: [],
        },
      };
      const dispelSpell = {
        ...baseMockSpell,
        name: 'Dispel Magic',
        casting_time: '1 action',
        damage: { damage_at_slot_level: { '1': '3d4+1' } },
      };
      renderPopup(dispelSpell, spellBreakerStats, mockCampaignName, { onCast });

      fireEvent.click(screen.getByRole('button', { name: /Cast Spell/ }));
      const metaCtx = onCast.mock.calls[0][1];
      // Math.floor((11 - 1) / 4 + 2) = Math.floor(4.5) = 4
      expect(metaCtx.dispelAbilityCheckBonus).toBe(4);
    });
  });
});
