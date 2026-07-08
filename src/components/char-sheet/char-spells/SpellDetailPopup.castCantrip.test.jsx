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

describe('SpellDetailPopup - handleCast: Cantrip casting', () => {
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

  it('calls onCast with modified cantrip (baseLevel: 0)', () => {
    const onCast = vi.fn();
    const cantrip = {
      ...baseMockSpell,
      level: 0,
      damage: { damage_at_slot_level: { '0': '1d6' } },
    };
    renderPopup(cantrip, baseMockPlayerStats, mockCampaignName, { onCast });

    fireEvent.click(screen.getByRole('button', { name: /Cast Spell/ }));
    expect(onCast).toHaveBeenCalledTimes(1);
    const modifiedSpell = onCast.mock.calls[0][0];
    expect(modifiedSpell.level).toBe(0);
    expect(modifiedSpell.baseLevel).toBe(0);
  });

  it('calls onCast with cantrip auto-level when playerLevel prop allows higher damage', () => {
    const onCast = vi.fn();
    const cantrip = {
      name: 'Fire Bolt',
      level: 0,
      description: 'A flash of fire.',
      casting_time: '1 action',
      range: '120 feet',
      duration: 'Instantaneous',
      damage: {
        damage_at_character_level: {
          1: '1d10',
          5: '2d10',
          11: '3d10',
          17: '4d10',
        },
      },
    };
    renderPopup(cantrip, baseMockPlayerStats, mockCampaignName, { onCast, playerLevel: 5 });

    fireEvent.click(screen.getByRole('button', { name: /Cast Spell/ }));
    expect(onCast).toHaveBeenCalledTimes(1);
    const modifiedSpell = onCast.mock.calls[0][0];
    expect(modifiedSpell.level).toBe(5);
    expect(modifiedSpell.baseLevel).toBe(0);
  });

  it('calls onCast with cantrip at lowest level when no character level range matches', () => {
    const onCast = vi.fn();
    const cantrip = {
      name: 'Fire Bolt',
      level: 0,
      description: 'A flash of fire.',
      casting_time: '1 action',
      range: '120 feet',
      duration: 'Instantaneous',
      damage: {
        damage_at_character_level: {
          5: '2d10',
          11: '3d10',
        },
      },
    };
    renderPopup(cantrip, baseMockPlayerStats, mockCampaignName, { onCast, playerLevel: 3 });

    fireEvent.click(screen.getByRole('button', { name: /Cast Spell/ }));
    expect(onCast).toHaveBeenCalledTimes(1);
    const modifiedSpell = onCast.mock.calls[0][0];
    // No applicable levels (all >= 5, playerLevel is 3), so cantripAutoLevel is null
    // Falls back to { ...spell, baseLevel: 0 }
    expect(modifiedSpell.level).toBe(0);
    expect(modifiedSpell.baseLevel).toBe(0);
  });
});
