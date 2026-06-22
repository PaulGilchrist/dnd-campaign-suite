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

    it('marks Divination Savant as used after casting', () => {
      vi.mocked(getRuntimeValue).mockImplementation((_name, key, _campaign) => {
        if (key === '_Divination_Savant_selection') return ['Warding Bond'];
        if (key === '_Divination_Savant_Warding_Bond_used') return false;
        return null;
      });
      vi.mocked(setRuntimeValue).mockReturnValue();

      const onCast = vi.fn();
      const spell = {
        ...baseMockSpell,
        name: 'Warding Bond',
        level: 2,
        damage: { damage_at_slot_level: { '2': '2d6' } },
      };
      const stats = { ...baseMockPlayerStats };
      renderPopup(spell, stats, mockCampaignName, { onCast });

      fireEvent.click(screen.getByRole('button', { name: /Cast Spell/ }));
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Elara',
        '_Divination_Savant_Warding_Bond_used',
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

    it('clears naturalRecoveryFreeCast after casting', () => {
      vi.mocked(getRuntimeValue).mockImplementation((_name, key) => {
        if (key === 'naturalRecoveryFreeCast') return ['Healing Word'];
        return null;
      });
      vi.mocked(setRuntimeValue).mockReturnValue();

      const onCast = vi.fn();
      const spell = {
        ...baseMockSpell,
        name: 'Healing Word',
        level: 1,
        damage: { damage_at_slot_level: { '1': '1d4+1' } },
      };
      const stats = { ...baseMockPlayerStats };
      renderPopup(spell, stats, mockCampaignName, { onCast });

      fireEvent.click(screen.getByRole('button', { name: /Cast Spell/ }));
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Elara',
        'naturalRecoveryFreeCast',
        null,
        mockCampaignName
      );
    });

    it('clears bewitching magic free cast after casting Misty Step', () => {
      vi.mocked(getRuntimeValue).mockImplementation((_name, key) => {
        if (key === '_Bewitching_Magic_freeCast') return true;
        return null;
      });
      vi.mocked(setRuntimeValue).mockReturnValue();

      const onCast = vi.fn();
      const spell = {
        ...baseMockSpell,
        name: 'Misty Step',
        level: 2,
        damage: { damage_at_slot_level: { '2': '3d6' } },
      };
      const stats = { ...baseMockPlayerStats };
      renderPopup(spell, stats, mockCampaignName, { onCast });

      fireEvent.click(screen.getByRole('button', { name: /Cast Spell/ }));
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Elara',
        '_Bewitching_Magic_freeCast',
        null,
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
    it('changes school to Illusion and sets _phantasmalCreatures flag for Summon Beast', () => {
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

    it('changes school to Illusion and sets _phantasmalCreatures flag for Summon Fey', () => {
      vi.mocked(getRuntimeValue).mockImplementation((_name, key) => {
        if (key === '_Phantasmal_Creatures_freeCastCount') return 1;
        if (key === '_phantasmalCreatures_list') return [];
        return null;
      });
      vi.mocked(setRuntimeValue).mockReturnValue();

      const onCast = vi.fn();
      const spell = {
        ...baseMockSpell,
        name: 'Summon Fey',
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

    it('adds Fey Spirit to creature list for Summon Fey', () => {
      vi.mocked(getRuntimeValue).mockImplementation((_name, key) => {
        if (key === '_Phantasmal_Creatures_freeCastCount') return 1;
        if (key === '_phantasmalCreatures_list') return [];
        return null;
      });
      vi.mocked(setRuntimeValue).mockReturnValue();

      const onCast = vi.fn();
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
      renderPopup(spell, stats, mockCampaignName, { onCast });

      fireEvent.click(screen.getByRole('button', { name: /Cast Spell/ }));
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Elara',
        '_phantasmalCreatures_list',
        ['Fey Spirit'],
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

    it('decrements base slot level when not upcasting', () => {
      vi.mocked(getRuntimeValue).mockReturnValue(4);
      vi.mocked(setRuntimeValue).mockReturnValue();

      const onCast = vi.fn();
      const noUpcastSpell = {
        ...baseMockSpell,
        damage: { damage_at_slot_level: { '1': '3d4+1' } },
      };
      renderPopup(noUpcastSpell, baseMockPlayerStats, mockCampaignName, {
        onCast,
      });

      fireEvent.click(screen.getByRole('button', { name: /Cast Spell/ }));
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Elara',
        'spell_slots_level_1',
        3,
        mockCampaignName
      );
    });
  });

  describe('onCast - meta context for Spell Breaker', () => {
    it('passes dispelAbilityCheckBonus when Dispel Magic is cast with Spell Breaker', () => {
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
      expect(onCast).toHaveBeenCalledTimes(1);
      const metaCtx = onCast.mock.calls[0][1];
      // Math.floor((11 - 1) / 4 + 2) = Math.floor(4.5) = 4
      expect(metaCtx.dispelAbilityCheckBonus).toBe(4);
    });

    it('calculates profBonus based on character level formula', () => {
      vi.mocked(getRuntimeValue).mockReturnValue(null);

      const onCast = vi.fn();
      const spellBreakerStats = {
        ...baseMockPlayerStats,
        level: 5,
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
      // Math.floor((5 - 1) / 4 + 2) = Math.floor(3) = 3
      expect(metaCtx.dispelAbilityCheckBonus).toBe(3);
    });
  });

  describe('canCast with upcastable spells and slots', () => {
    it('enables cast button when upcastable spell has available slots at base level', () => {
      vi.mocked(getRuntimeValue).mockReturnValue(3);

      const spell = {
        ...baseMockSpell,
        damage: { damage_at_slot_level: { '1': '3d4+1' } },
      };
      renderPopup(spell, baseMockPlayerStats);
      expect(screen.getByRole('button', { name: /Cast Spell/ })).not.toBeDisabled();
    });

    it('disables cast button when upcastable spell has no slots at base level', () => {
      vi.mocked(getRuntimeValue).mockReturnValue(0);

      const spell = {
        ...baseMockSpell,
        damage: { damage_at_slot_level: { '1': '3d4+1' } },
      };
      renderPopup(spell, baseMockPlayerStats);
      expect(screen.getByRole('button', { name: /Cast Spell/ })).toBeDisabled();
    });

    it('enables cast button for upcastable spell when upcast levels have available slots', () => {
      vi.mocked(getRuntimeValue).mockReturnValue(0);

      const upcastLevels = [
        { level: 1, formula: '3d4+1', availableSlots: 0 },
        { level: 2, formula: '4d4+1', availableSlots: 2 },
      ];
      const spell = {
        ...baseMockSpell,
        damage: { damage_at_slot_level: { '1': '3d4+1', '2': '4d4+1' } },
      };
      renderPopup(spell, baseMockPlayerStats, mockCampaignName, {
        upcastLevels,
      });
      expect(screen.getByRole('button', { name: /Cast Spell/ })).not.toBeDisabled();
    });
  });

  describe('spell detail popup CSS classes and icons', () => {
    it('renders Font Awesome wand icon on Cast Spell button', () => {
      renderPopup();
      const icon = document.querySelector(
        '.spell-detail-actions button.char-btn i.fa-solid.fa-wand-magic'
      );
      expect(icon).toBeInTheDocument();
    });

    it('renders Font Awesome times icon on Close button', () => {
      renderPopup();
      const icon = document.querySelector(
        '.spell-detail-actions button.char-btn-secondary i.fa-solid.fa-times'
      );
      expect(icon).toBeInTheDocument();
    });

    it('renders Font Awesome arrow-up icon in upcast label', () => {
      const upcastLevels = [
        { level: 1, formula: '3d4+1', availableSlots: 4 },
        { level: 2, formula: '4d4+1', availableSlots: 3 },
      ];
      renderPopup(baseMockSpell, baseMockPlayerStats, mockCampaignName, {
        upcastLevels,
      });
      const icon = document.querySelector(
        '.spell-detail-upcast-label i.fa-solid.fa-arrow-up'
      );
      expect(icon).toBeInTheDocument();
    });

    it('renders Font Awesome ghost icon for no-VS components badge', () => {
      const warlockStats = {
        ...baseMockPlayerStats,
        class: { name: 'Warlock', major: { name: 'Warlock' } },
        automation: {
          passives: [{ type: 'psychic_spells' }],
          actions: [],
        },
      };
      const spell = {
        ...baseMockSpell,
        school: 'Enchantment',
      };
      renderPopup(spell, warlockStats);
      const icon = document.querySelector(
        '.spell-detail-free-cast i.fa-solid.fa-ghost'
      );
      expect(icon).toBeInTheDocument();
    });

    it('renders Font Awesome bolt icon for free cast message', () => {
      vi.mocked(getRuntimeValue).mockImplementation((_name, key) => {
        if (key === '_Spell_Mastery_freeCast') return ['Magic Missile'];
        return null;
      });

      const stats = {
        ...baseMockPlayerStats,
        automation: {
          passives: [],
          actions: [{ name: 'Spell Mastery', type: 'free_spell', spell: 'Magic Missile' }],
        },
      };
      renderPopup(baseMockSpell, stats);
      const icon = document.querySelector(
        '.spell-detail-free-cast i.fa-solid.fa-bolt'
      );
      expect(icon).toBeInTheDocument();
    });
  });

  describe('popup structure and container elements', () => {
    it('renders with spell-detail-popup outer container', () => {
      renderPopup();
      expect(document.querySelector('.spell-detail-popup')).toBeInTheDocument();
    });

    it('renders with spell-detail-content inner container', () => {
      renderPopup();
      expect(document.querySelector('.spell-detail-content')).toBeInTheDocument();
    });

    it('renders with spell-detail-meta container for metadata', () => {
      renderPopup();
      expect(document.querySelector('.spell-detail-meta')).toBeInTheDocument();
    });

    it('renders with spell-detail-actions container for buttons', () => {
      renderPopup();
      expect(document.querySelector('.spell-detail-actions')).toBeInTheDocument();
    });

    it('renders h3 heading for spell name', () => {
      renderPopup();
      const heading = document.querySelector('.spell-detail-content h3');
      expect(heading).toBeInTheDocument();
      expect(heading.textContent).toBe('Magic Missile');
    });
  });
});
