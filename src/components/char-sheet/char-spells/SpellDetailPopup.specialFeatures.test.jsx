import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import SpellDetailPopup from './SpellDetailPopup.jsx';
import { getRuntimeValue, setRuntimeValue, useRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { getActiveBuffs } from '../../../services/combat/buffs/buffService.js';
import { getCombatSummary } from '../../../services/encounters/combatData.js';
import { addConcentration, breakConcentration } from '../../../services/combat/concentration/concentrationService.js';
import * as storageService from '../../../services/ui/storage.js';

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

vi.mock('../../../services/encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(() => null),
}));

vi.mock('../../../services/combat/concentration/concentrationService.js', () => ({
  addConcentration: vi.fn(),
  breakConcentration: vi.fn(),
}));

vi.mock('../../../services/ui/storage.js', () => ({
  default: { set: vi.fn() },
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

describe('SpellDetailPopup - handleCast: Special features', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.mocked(getRuntimeValue).mockReturnValue(null);
    vi.mocked(getActiveBuffs).mockReturnValue([]);
    vi.mocked(setRuntimeValue).mockReturnValue();
    vi.mocked(getCombatSummary).mockReturnValue(null);
    vi.mocked(addConcentration).mockReturnValue();
    vi.mocked(breakConcentration).mockReturnValue(null);
    vi.mocked(storageService.default.set).mockReturnValue();
  });

  describe('War God\'s Blessing (WGB) management', () => {
    it('removes Shield of Faith buff when casting Spiritual Weapon via WGB', () => {
      const onCast = vi.fn();
      const wgbStats = {
        ...baseMockPlayerStats,
        automation: { passives: [], actions: [] },
      };
      vi.mocked(getRuntimeValue).mockImplementation((_name, key) => {
        if (key === '_War_Gods_Blessing_active') return true;
        if (key === 'spell_slots_level_1') return 4;
        return null;
      });

      const spell = {
        ...baseMockSpell,
        name: 'Spiritual Weapon',
        level: 2,
        damage: { damage_at_slot_level: { '2': '1d8+3' } },
      };

      renderPopup(spell, wgbStats, mockCampaignName, { onCast });

      fireEvent.click(screen.getByRole('button', { name: /Cast Spell/ }));

      // WGB spell — should not consume a slot, should call cleanupBuffsByName for Shield of Faith
      // The modified spell should NOT have baseLevel set
      const modifiedSpell = onCast.mock.calls[0][0];
      expect(modifiedSpell.baseLevel).toBe(undefined);
    });

    it('does not remove Shield of Faith when casting non-WGB spell', () => {
      const onCast = vi.fn();
      const wgbStats = {
        ...baseMockPlayerStats,
        automation: { passives: [], actions: [] },
      };
      vi.mocked(getRuntimeValue).mockImplementation((_name, key) => {
        if (key === '_War_Gods_Blessing_active') return true;
        if (key === 'spell_slots_level_1') return 4;
        return null;
      });

      const spell = {
        ...baseMockSpell,
        name: 'Magic Missile',
        level: 1,
        damage: { damage_at_slot_level: { '1': '3d4+1' } },
      };

      renderPopup(spell, wgbStats, mockCampaignName, { onCast });

      fireEvent.click(screen.getByRole('button', { name: /Cast Spell/ }));

      // Not a WGB spell, should consume a slot normally
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Elara',
        'spell_slots_level_1',
        3,
        mockCampaignName
      );
    });
  });

  describe('SpellBreaker — Dispel Magic as bonus action', () => {
    it('changes casting_time to bonus action when SpellBreaker passive and Dispel Magic', () => {
      const onCast = vi.fn();
      const spellBreakerStats = {
        ...baseMockPlayerStats,
        automation: {
          passives: [{ type: 'spell_breaker' }],
          actions: [],
        },
      };
      vi.mocked(getRuntimeValue).mockImplementation((_name, key) => {
        if (key === 'spell_slots_level_3') return 2;
        return null;
      });

      const spell = {
        ...baseMockSpell,
        name: 'Dispel Magic',
        level: 3,
        casting_time: '1 action',
        damage: null,
      };

      renderPopup(spell, spellBreakerStats, mockCampaignName, { onCast });

      fireEvent.click(screen.getByRole('button', { name: /Cast Spell/ }));

      expect(onCast).toHaveBeenCalledTimes(1);
      const modifiedSpell = onCast.mock.calls[0][0];
      expect(modifiedSpell.casting_time).toBe('1 bonus action');
      const metaCtx = onCast.mock.calls[0][1];
      expect(metaCtx.dispelAbilityCheckBonus).toBe(3);
    });

    it('does not modify casting_time for non-Dispel Magic spells with SpellBreaker', () => {
      const onCast = vi.fn();
      const spellBreakerStats = {
        ...baseMockPlayerStats,
        automation: {
          passives: [{ type: 'spell_breaker' }],
          actions: [],
        },
      };
      vi.mocked(getRuntimeValue).mockImplementation((_name, key) => {
        if (key === 'spell_slots_level_1') return 4;
        return null;
      });

      const spell = {
        ...baseMockSpell,
        name: 'Magic Missile',
        level: 1,
        damage: { damage_at_slot_level: { '1': '3d4+1' } },
      };

      renderPopup(spell, spellBreakerStats, mockCampaignName, { onCast });

      fireEvent.click(screen.getByRole('button', { name: /Cast Spell/ }));

      const modifiedSpell = onCast.mock.calls[0][0];
      expect(modifiedSpell.casting_time).toBe('1 action');
    });
  });

  describe('Psychic Spells override', () => {
    it('sets _psychicSpellsOverride flag when Warlock with Psychic Spells and psychic damage toggled', () => {
      const onCast = vi.fn();
      const warlockStats = {
        ...baseMockPlayerStats,
        class: { name: 'Warlock', major: { name: 'Warlock' } },
        automation: {
          passives: [{ type: 'psychic_spells' }],
          actions: [],
        },
      };
      vi.mocked(getRuntimeValue).mockImplementation((_name, key) => {
        if (key === 'spell_slots_level_1') return 4;
        return null;
      });

      const spell = {
        ...baseMockSpell,
        name: 'Burning Hands',
        level: 1,
        school: 'Evocation',
        damage: { damage_at_slot_level: { '1': '3d4' } },
      };

      renderPopup(spell, warlockStats, mockCampaignName, { onCast });

      // Toggle psychic damage
      fireEvent.click(screen.getByText('Change damage type to Psychic'));
      fireEvent.click(screen.getByRole('button', { name: /Cast Spell/ }));

      expect(onCast).toHaveBeenCalledTimes(1);
      const modifiedSpell = onCast.mock.calls[0][0];
      expect(modifiedSpell._psychicSpellsOverride).toBe(true);
    });

    it('does not show psychic damage toggle for non-Warlock', () => {
      const onCast = vi.fn();
      renderPopup(baseMockSpell, baseMockPlayerStats, mockCampaignName, { onCast });

      expect(screen.queryByText('Change damage type to Psychic')).not.toBeInTheDocument();
    });

    it('does not show psychic damage toggle for Warlock without Psychic Spells passive', () => {
      const onCast = vi.fn();
      const warlockNoPsychic = {
        ...baseMockPlayerStats,
        class: { name: 'Warlock', major: { name: 'Warlock' } },
        automation: { passives: [], actions: [] },
      };

      renderPopup(baseMockSpell, warlockNoPsychic, mockCampaignName, { onCast });

      expect(screen.queryByText('Change damage type to Psychic')).not.toBeInTheDocument();
    });

    it('does not show psychic damage toggle for spells without damage', () => {
      const onCast = vi.fn();
      const warlockStats = {
        ...baseMockPlayerStats,
        class: { name: 'Warlock', major: { name: 'Warlock' } },
        automation: {
          passives: [{ type: 'psychic_spells' }],
          actions: [],
        },
      };
      const noDamageSpell = {
        ...baseMockSpell,
        name: 'Bane',
        level: 1,
        damage: null,
      };

      renderPopup(noDamageSpell, warlockStats, mockCampaignName, { onCast });

      expect(screen.queryByText('Change damage type to Psychic')).not.toBeInTheDocument();
    });
  });

  describe('Phantasmal Creatures', () => {
    it('modifies school and sets _phantasmalCreatures flag for Summon Beast with free cast', () => {
      const onCast = vi.fn();
      const phantasmalStats = {
        ...baseMockPlayerStats,
        automation: {
          passives: [{ type: 'phantasmal_creatures' }],
          actions: [],
        },
      };
      vi.mocked(getRuntimeValue).mockImplementation((_name, key) => {
        if (key === '_Phantasmal_Creatures_freeCastCount') return 1;
        if (key === 'spell_slots_level_2') return 3;
        return null;
      });

      const spell = {
        ...baseMockSpell,
        name: 'Summon Beast',
        level: 2,
        school: 'Conjuration',
        damage: { damage_at_slot_level: { '2': '3d6' } },
      };

      renderPopup(spell, phantasmalStats, mockCampaignName, { onCast });

      fireEvent.click(screen.getByRole('button', { name: /Cast Spell/ }));

      expect(onCast).toHaveBeenCalledTimes(1);
      const modifiedSpell = onCast.mock.calls[0][0];
      expect(modifiedSpell.school).toBe('Illusion');
      expect(modifiedSpell._phantasmalCreatures).toBe(true);
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Elara',
        '_phantasmalCreatures_list',
        ['Bestial Spirit'],
        mockCampaignName
      );
    });

    it('tracks Fey Spirit for Summon Fey', () => {
      const onCast = vi.fn();
      const phantasmalStats = {
        ...baseMockPlayerStats,
        automation: {
          passives: [{ type: 'phantasmal_creatures' }],
          actions: [],
        },
      };
      vi.mocked(getRuntimeValue).mockImplementation((_name, key) => {
        if (key === '_Phantasmal_Creatures_freeCastCount') return 1;
        if (key === 'spell_slots_level_2') return 3;
        return null;
      });

      const spell = {
        ...baseMockSpell,
        name: 'Summon Fey',
        level: 2,
        school: 'Conjuration',
        damage: { damage_at_slot_level: { '2': '3d6' } },
      };

      renderPopup(spell, phantasmalStats, mockCampaignName, { onCast });

      fireEvent.click(screen.getByRole('button', { name: /Cast Spell/ }));

      expect(onCast).toHaveBeenCalledTimes(1);
      const modifiedSpell = onCast.mock.calls[0][0];
      expect(modifiedSpell.school).toBe('Illusion');
      expect(modifiedSpell._phantasmalCreatures).toBe(true);
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Elara',
        '_phantasmalCreatures_list',
        ['Fey Spirit'],
        mockCampaignName
      );
    });

    it('appends to existing creature list when already has entries', () => {
      const onCast = vi.fn();
      const phantasmalStats = {
        ...baseMockPlayerStats,
        automation: {
          passives: [{ type: 'phantasmal_creatures' }],
          actions: [],
        },
      };
      vi.mocked(getRuntimeValue).mockImplementation((_name, key) => {
        if (key === '_Phantasmal_Creatures_freeCastCount') return 1;
        if (key === '_phantasmalCreatures_list') return ['Bestial Spirit'];
        if (key === 'spell_slots_level_2') return 3;
        return null;
      });

      const spell = {
        ...baseMockSpell,
        name: 'Summon Fey',
        level: 2,
        school: 'Conjuration',
        damage: { damage_at_slot_level: { '2': '3d6' } },
      };

      renderPopup(spell, phantasmalStats, mockCampaignName, { onCast });

      fireEvent.click(screen.getByRole('button', { name: /Cast Spell/ }));

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Elara',
        '_phantasmalCreatures_list',
        ['Bestial Spirit', 'Fey Spirit'],
        mockCampaignName
      );
    });
  });

  describe('metaCtx for overchannel', () => {
    it('passes overchannel: false in metaCtx when not toggled', () => {
      const onCast = vi.fn();
      const overchannelStats = {
        ...baseMockPlayerStats,
        automation: {
          passives: [{ type: 'overchannel' }],
          actions: [],
        },
      };
      vi.mocked(getRuntimeValue).mockImplementation((_name, key) => {
        if (key === 'spell_slots_level_1') return 4;
        return null;
      });
      vi.mocked(useRuntimeValue).mockReturnValue(0);

      const spell = {
        ...baseMockSpell,
        level: 1,
        damage: { damage_at_slot_level: { '1': '1d6' } },
      };

      renderPopup(spell, overchannelStats, mockCampaignName, { onCast });

      fireEvent.click(screen.getByRole('button', { name: /Cast Spell/ }));

      const metaCtx = onCast.mock.calls[0][1];
      expect(metaCtx.overchannel).toBe(false);
    });
  });
});
