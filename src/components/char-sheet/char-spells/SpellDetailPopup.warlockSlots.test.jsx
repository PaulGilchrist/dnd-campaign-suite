import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import SpellDetailPopup from './SpellDetailPopup.jsx';
import { getRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';

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

const makeWarlockStats = (spellSlots) => ({
  ...baseMockPlayerStats,
  class: { name: 'Warlock', major: { name: 'Warlock' } },
  spellAbilities: {
    spell_slots_level_1: spellSlots?.level_1 ?? 0,
    spell_slots_level_2: spellSlots?.level_2 ?? 0,
    spell_slots_level_3: spellSlots?.level_3 ?? 0,
    spell_slots_level_4: spellSlots?.level_4 ?? 0,
    spell_slots_level_5: spellSlots?.level_5 ?? 0,
    spells: [],
  },
  automation: { passives: [], actions: [] },
});

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

describe('SpellDetailPopup - Warlock slot display and casting', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Warlock slot display', () => {
    it.each([
      { runtime: { level_1: 0, level_2: 2 }, spell: { level: 1 }, expected: /2 slot/, label: 'higher level slots but no base' },
      { runtime: { level_1: 0, level_2: 1 }, spell: { level: 1 }, expected: /1 slot$/, label: 'exactly 1 slot' },
      { runtime: { level_1: 0, level_2: 0 }, spell: { level: 1 }, expected: /0$/, label: 'no slots' },
      { runtime: { level_1: 4, level_2: 0 }, spell: { level: 1 }, expected: /4 slot/, label: 'base level slots' },
    ])('shows correct count when warlock has $label', ({ runtime, spell, expected }) => {
      vi.mocked(getRuntimeValue).mockImplementation((_name, key) => {
        const match = key.match(/^spell_slots_level_(\d+)$/);
        if (!match) return null;
        const lvl = parseInt(match[1], 10);
        return runtime[`level_${lvl}`] ?? null;
      });

      renderPopup(spell, makeWarlockStats(runtime), mockCampaignName);
      expect(screen.getByText(/Slots Remaining:/)).toBeInTheDocument();
      expect(screen.getByText(expected)).toBeInTheDocument();
    });

  });

  describe('Warlock canCast logic', () => {
    it.each([
      { runtime: { level_1: 0, level_2: 2 }, enabled: true, label: 'higher level slots but no base' },
      { runtime: { level_1: 0, level_2: 0 }, enabled: false, label: 'no slots at any level' },
      { runtime: { level_1: 4, level_2: 0 }, enabled: true, label: 'base level slots available' },
    ])('cast button is $enabled when warlock has $label', ({ runtime, enabled }) => {
      vi.mocked(getRuntimeValue).mockImplementation((_name, key) => {
        const match = key.match(/^spell_slots_level_(\d+)$/);
        if (!match) return null;
        const lvl = parseInt(match[1], 10);
        return runtime[`level_${lvl}`] ?? null;
      });

      const spell = { ...baseMockSpell, level: 1, damage: { damage_at_slot_level: { '1': '3d4+1' } } };

      renderPopup(spell, makeWarlockStats(runtime), mockCampaignName);
      const button = screen.getByRole('button', { name: /Cast Spell/ });
      if (enabled) {
        expect(button).toBeEnabled();
      } else {
        expect(button).toBeDisabled();
      }
    });

    it('uses current runtime value over spellAbilities max for slot availability', () => {
      vi.mocked(getRuntimeValue).mockImplementation((_name, key) => {
        if (key === 'spell_slots_level_1') return 0;
        return null;
      });

      const spell = { ...baseMockSpell, level: 1, damage: { damage_at_slot_level: { '1': '3d4+1' } } };

      renderPopup(spell, makeWarlockStats({ level_1: 4 }), mockCampaignName);
      expect(screen.getByRole('button', { name: /Cast Spell/ })).toBeDisabled();
    });

    it('falls back to spellAbilities max when runtime value is null', () => {
      vi.mocked(getRuntimeValue).mockImplementation(() => null);

      const spell = { ...baseMockSpell, level: 1, damage: { damage_at_slot_level: { '1': '3d4+1' } } };

      renderPopup(spell, makeWarlockStats({ level_1: 2 }), mockCampaignName);
      expect(screen.getByRole('button', { name: /Cast Spell/ })).toBeEnabled();
    });

    it('shows "No spell slots available" when warlock has no slots', () => {
      vi.mocked(getRuntimeValue).mockImplementation((_name, key) => {
        if (key.startsWith('spell_slots_level_')) return 0;
        return null;
      });

      const spell = { ...baseMockSpell, level: 1, damage: { damage_at_slot_level: { '1': '3d4+1' } } };

      renderPopup(spell, makeWarlockStats({ level_1: 0 }), mockCampaignName);
      expect(screen.getByRole('button', { name: /Cast Spell/ })).toBeDisabled();
      expect(screen.getByText(/No spell slots available/)).toBeInTheDocument();
    });
  });

  describe('Warlock upcast casting', () => {
    it('enables cast when warlock can use higher level slots for upcast', () => {
      vi.mocked(getRuntimeValue).mockImplementation((_name, key) => {
        if (key === 'spell_slots_level_2') return 0;
        if (key === 'spell_slots_level_3') return 2;
        return null;
      });

      const spell = {
        ...baseMockSpell,
        level: 2,
        damage: {
          damage_at_slot_level: {
            '2': '4d4+1',
            '3': '5d4+1',
          },
        },
      };
      const upcastLevels = [
        { level: 2, formula: '4d4+1', availableSlots: 0 },
        { level: 3, formula: '5d4+1', availableSlots: 2 },
      ];

      renderPopup(spell, makeWarlockStats({ level_2: 0, level_3: 2 }), mockCampaignName, { upcastLevels });
      expect(screen.getByRole('button', { name: /Cast Spell/ })).toBeEnabled();
    });

    it('disables cast for upcast when warlock has no slots at the spell level or higher', () => {
      vi.mocked(getRuntimeValue).mockImplementation((_name, key) => {
        if (key.startsWith('spell_slots_level_')) return 0;
        return null;
      });

      const spell = {
        ...baseMockSpell,
        level: 2,
        damage: {
          damage_at_slot_level: {
            '2': '4d4+1',
            '3': '5d4+1',
          },
        },
      };
      const upcastLevels = [
        { level: 2, formula: '4d4+1', availableSlots: 0 },
        { level: 3, formula: '5d4+1', availableSlots: 0 },
      ];

      renderPopup(spell, makeWarlockStats({ level_2: 0, level_3: 0 }), mockCampaignName, { upcastLevels });
      expect(screen.getByRole('button', { name: /Cast Spell/ })).toBeDisabled();
      expect(screen.getByText(/No spell slots available/)).toBeInTheDocument();
    });

    it('disables cast when upcastLevels is empty and warlock has no base slots', () => {
      vi.mocked(getRuntimeValue).mockImplementation((_name, key) => {
        if (key.startsWith('spell_slots_level_')) return 0;
        return null;
      });

      const spell = {
        ...baseMockSpell,
        level: 2,
        damage: {
          damage_at_slot_level: {
            '2': '4d4+1',
            '3': '5d4+1',
          },
        },
      };

      renderPopup(spell, makeWarlockStats({ level_1: 0, level_2: 0 }), mockCampaignName, { upcastLevels: [] });
      expect(screen.getByRole('button', { name: /Cast Spell/ })).toBeDisabled();
    });
  });
});
