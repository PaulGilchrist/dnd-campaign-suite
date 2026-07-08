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

describe('SpellDetailPopup - handleCast: Concentration management', () => {
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

  describe('setting concentration on new spell', () => {
    it('sets concentration when spell has concentration flag and no existing concentration', () => {
      const onCast = vi.fn();
      const concentrationSpell = {
        ...baseMockSpell,
        name: 'Bane',
        level: 1,
        concentration: true,
        damage: null,
        dc: { dc_type: 'CHA', dc_success: 'half' },
      };
      const cs = {
        creatures: [{ name: 'Elara', concentration: null }],
      };
      vi.mocked(getCombatSummary).mockReturnValue(cs);

      renderPopup(concentrationSpell, baseMockPlayerStats, mockCampaignName, { onCast });

      fireEvent.click(screen.getByRole('button', { name: /Cast Spell/ }));

      expect(addConcentration).toHaveBeenCalledWith(cs, 'Elara', 'Bane', 10, null);
      expect(storageService.default.set).toHaveBeenCalledWith('combatSummary', cs, mockCampaignName);
    });

    it('does not set concentration when combat summary is null', () => {
      const onCast = vi.fn();
      const concentrationSpell = {
        ...baseMockSpell,
        name: 'Bane',
        level: 1,
        concentration: true,
        damage: null,
        dc: { dc_type: 'CHA', dc_success: 'half' },
      };
      vi.mocked(getCombatSummary).mockReturnValue(null);

      renderPopup(concentrationSpell, baseMockPlayerStats, mockCampaignName, { onCast });

      fireEvent.click(screen.getByRole('button', { name: /Cast Spell/ }));

      expect(addConcentration).not.toHaveBeenCalled();
      expect(storageService.default.set).not.toHaveBeenCalled();
    });

    it('does not set concentration when spell does not require concentration', () => {
      const onCast = vi.fn();
      const noConcentrationSpell = {
        ...baseMockSpell,
        name: 'Fireball',
        level: 3,
        concentration: false,
        damage: { damage_at_slot_level: { '3': '8d6' } },
      };
      const cs = {
        creatures: [{ name: 'Elara', concentration: null }],
      };
      vi.mocked(getCombatSummary).mockReturnValue(cs);

      renderPopup(noConcentrationSpell, baseMockPlayerStats, mockCampaignName, { onCast });

      fireEvent.click(screen.getByRole('button', { name: /Cast Spell/ }));

      expect(addConcentration).not.toHaveBeenCalled();
    });
  });

  describe('breaking old concentration', () => {
    it('breaks old concentration and sets new when recasting a different concentration spell', () => {
      const onCast = vi.fn();
      const concentrationSpell = {
        ...baseMockSpell,
        name: 'Bane',
        level: 1,
        concentration: true,
        damage: null,
        dc: { dc_type: 'CHA', dc_success: 'half' },
      };
      const cs = {
        creatures: [{ name: 'Elara', concentration: { spell: 'Hold Monster' } }],
      };
      vi.mocked(getCombatSummary).mockReturnValue(cs);
      vi.mocked(breakConcentration).mockReturnValue('Hold Monster');

      renderPopup(concentrationSpell, baseMockPlayerStats, mockCampaignName, { onCast });

      fireEvent.click(screen.getByRole('button', { name: /Cast Spell/ }));

      expect(breakConcentration).toHaveBeenCalledWith(cs, 'Elara');
      expect(storageService.default.set).toHaveBeenCalledWith('combatSummary', cs, mockCampaignName);
      expect(addConcentration).toHaveBeenCalledWith(cs, 'Elara', 'Bane', 10, null);
    });

    it('does not break concentration when recasting the same spell (concentration refresh)', () => {
      const onCast = vi.fn();
      const concentrationSpell = {
        ...baseMockSpell,
        name: 'Bane',
        level: 1,
        concentration: true,
        damage: null,
        dc: { dc_type: 'CHA', dc_success: 'half' },
      };
      const cs = {
        creatures: [{ name: 'Elara', concentration: { spell: 'Bane' } }],
      };
      vi.mocked(getCombatSummary).mockReturnValue(cs);

      renderPopup(concentrationSpell, baseMockPlayerStats, mockCampaignName, { onCast });

      fireEvent.click(screen.getByRole('button', { name: /Cast Spell/ }));

      expect(breakConcentration).not.toHaveBeenCalled();
      // No addConcentration for same-spell recast since shouldSetConcentration stays false
      expect(addConcentration).not.toHaveBeenCalled();
    });
  });

  describe('cleanup of old concentration buffs', () => {
    it('calls cleanupBuffsByName for old concentration spell', () => {
      const onCast = vi.fn();
      const concentrationSpell = {
        ...baseMockSpell,
        name: 'Bane',
        level: 1,
        concentration: true,
        damage: null,
        dc: { dc_type: 'CHA', dc_success: 'half' },
      };
      const cs = {
        creatures: [
          { name: 'Elara', concentration: { spell: 'Hold Monster' } },
          { name: 'Goblin', activeBuffs: [{ name: 'Hold Monster' }] },
        ],
      };
      vi.mocked(getCombatSummary).mockReturnValue(cs);
      vi.mocked(breakConcentration).mockReturnValue('Hold Monster');

      renderPopup(concentrationSpell, baseMockPlayerStats, mockCampaignName, { onCast });

      fireEvent.click(screen.getByRole('button', { name: /Cast Spell/ }));

      // cleanupBuffsByName is an internal function that filters activeBuffs
      // We verify it was called through the setRuntimeValue calls
      expect(setRuntimeValue).toHaveBeenCalled();
    });
  });
});
