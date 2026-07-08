import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import SpellDetailPopup from './SpellDetailPopup.jsx';
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
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

describe('SpellDetailPopup - handleCast: Free cast tracking cleanup', () => {
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

  describe('Natural Recovery cleanup', () => {
    it('clears naturalRecoveryFreeCast after casting the spell', () => {
      const onCast = vi.fn();
      vi.mocked(getRuntimeValue).mockImplementation((_name, key) => {
        if (key === 'naturalRecoveryFreeCast') return ['Healing Word'];
        if (key === 'spell_slots_level_1') return 4;
        return null;
      });

      const spell = {
        ...baseMockSpell,
        name: 'Healing Word',
        level: 1,
        damage: { damage_at_slot_level: { '1': '1d4+1' } },
      };

      renderPopup(spell, baseMockPlayerStats, mockCampaignName, { onCast });

      fireEvent.click(screen.getByRole('button', { name: /Cast Spell/ }));

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Elara',
        'naturalRecoveryFreeCast',
        null,
        mockCampaignName
      );
    });
  });

  describe('Bewitching Magic cleanup', () => {
    it('clears _Bewitching_Magic_freeCast after casting Misty Step', () => {
      const onCast = vi.fn();
      vi.mocked(getRuntimeValue).mockImplementation((_name, key) => {
        if (key === '_Bewitching_Magic_freeCast') return true;
        if (key === 'spell_slots_level_2') return 3;
        return null;
      });

      const spell = {
        ...baseMockSpell,
        name: 'Misty Step',
        level: 2,
        damage: { damage_at_slot_level: { '2': '3d6' } },
      };

      renderPopup(spell, baseMockPlayerStats, mockCampaignName, { onCast });

      fireEvent.click(screen.getByRole('button', { name: /Cast Spell/ }));

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Elara',
        '_Bewitching_Magic_freeCast',
        null,
        mockCampaignName
      );
    });

    it('does not clear _Bewitching_Magic_freeCast for non-Misty Step', () => {
      const onCast = vi.fn();
      vi.mocked(getRuntimeValue).mockImplementation((_name, key) => {
        if (key === '_Bewitching_Magic_freeCast') return true;
        if (key === 'spell_slots_level_1') return 4;
        return null;
      });

      const spell = {
        ...baseMockSpell,
        name: 'Magic Missile',
        level: 1,
        damage: { damage_at_slot_level: { '1': '3d4+1' } },
      };

      renderPopup(spell, baseMockPlayerStats, mockCampaignName, { onCast });

      fireEvent.click(screen.getByRole('button', { name: /Cast Spell/ }));

      expect(setRuntimeValue).not.toHaveBeenCalledWith(
        'Elara',
        '_Bewitching_Magic_freeCast',
        null,
        mockCampaignName
      );
    });
  });

  describe('Signature Spells cleanup', () => {
    it('marks Signature Spell as used after casting', () => {
      const onCast = vi.fn();
      vi.mocked(getRuntimeValue).mockImplementation((_name, key, _campaign) => {
        if (key === 'SignatureSpells_selection') return ['Fireball'];
        if (key === 'SignatureSpells_Fireball_used') return false;
        if (key === 'spell_slots_level_3') return 2;
        return null;
      });

      const spell = {
        ...baseMockSpell,
        name: 'Fireball',
        level: 3,
        damage: { damage_at_slot_level: { '3': '8d6' } },
      };

      renderPopup(spell, baseMockPlayerStats, mockCampaignName, { onCast });

      fireEvent.click(screen.getByRole('button', { name: /Cast Spell/ }));

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Elara',
        'SignatureSpells_Fireball_used',
        true,
        mockCampaignName
      );
    });

    it('does not mark Signature Spell as used for wrong level', () => {
      const onCast = vi.fn();
      vi.mocked(getRuntimeValue).mockImplementation((_name, key, _campaign) => {
        if (key === 'SignatureSpells_selection') return ['Fireball'];
        if (key === 'spell_slots_level_1') return 4;
        return null;
      });

      const spell = {
        ...baseMockSpell,
        name: 'Magic Missile',
        level: 1,
        damage: { damage_at_slot_level: { '1': '3d4+1' } },
      };

      renderPopup(spell, baseMockPlayerStats, mockCampaignName, { onCast });

      fireEvent.click(screen.getByRole('button', { name: /Cast Spell/ }));

      expect(setRuntimeValue).not.toHaveBeenCalledWith(
        expect.any(String),
        'SignatureSpells_Fireball_used',
        true,
        mockCampaignName
      );
    });
  });

  describe('Divination Savant cleanup', () => {
    it('marks Divination Savant spell as used after casting', () => {
      const onCast = vi.fn();
      vi.mocked(getRuntimeValue).mockImplementation((_name, key, _campaign) => {
        if (key === '_Divination_Savant_selection') return ['Warding Bond'];
        if (key === '_Divination_Savant_Warding_Bond_used') return false;
        if (key === 'spell_slots_level_2') return 3;
        return null;
      });

      const spell = {
        ...baseMockSpell,
        name: 'Warding Bond',
        level: 2,
        damage: { damage_at_slot_level: { '2': '2d6' } },
      };

      renderPopup(spell, baseMockPlayerStats, mockCampaignName, { onCast });

      fireEvent.click(screen.getByRole('button', { name: /Cast Spell/ }));

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Elara',
        '_Divination_Savant_Warding_Bond_used',
        true,
        mockCampaignName
      );
    });
  });

  describe('Counter-based free cast count decrement', () => {
    it('decrements freeCastCount for counter-based free_spell action', () => {
      const onCast = vi.fn();
      vi.mocked(getRuntimeValue).mockImplementation((_name, key) => {
        if (key === '_Mystic_Arcanum_freeCastCount') return 1;
        if (key === 'spell_slots_level_9') return 1;
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
        spellAbilities: {
          ...baseMockPlayerStats.spellAbilities,
          spell_slots_level_9: 1,
        },
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
  });

  describe('perSpellTracking free cast cleanup', () => {
    it('marks perSpellTracking entry as used and clears freeCast after casting', () => {
      const onCast = vi.fn();
      vi.mocked(getRuntimeValue).mockImplementation((_name, key) => {
        // perSpellTracking uses per-spell freeCast keys
        if (key === '_Feature_A_SpellA_freeCast') return true;
        if (key === '_Feature_A_SpellA_used') return false;
        if (key === 'spell_slots_level_1') return 4;
        return null;
      });

      const spell = {
        ...baseMockSpell,
        name: 'SpellA',
        level: 1,
        damage: { damage_at_slot_level: { '1': '1d6' } },
      };
      const stats = {
        ...baseMockPlayerStats,
        automation: {
          passives: [],
          actions: [
            {
              name: 'Feature A',
              type: 'free_spell',
              spell: 'SpellA',
              perSpellTracking: true,
            },
          ],
        },
      };

      renderPopup(spell, stats, mockCampaignName, { onCast });

      fireEvent.click(screen.getByRole('button', { name: /Cast Spell/ }));

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Elara',
        '_Feature_A_SpellA_used',
        true,
        mockCampaignName
      );
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Elara',
        '_Feature_A_SpellA_freeCast',
        null,
        mockCampaignName
      );
    });
  });
});
