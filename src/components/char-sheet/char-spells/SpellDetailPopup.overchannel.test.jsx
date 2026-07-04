/* @improved-by-ai */
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import SpellDetailPopup from './SpellDetailPopup.jsx';
import { getRuntimeValue, setRuntimeValue, useRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
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

describe('SpellDetailPopup - Overchannel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.mocked(getRuntimeValue).mockReturnValue(null);
    vi.mocked(getActiveBuffs).mockReturnValue([]);
    vi.mocked(setRuntimeValue).mockReturnValue();
  });

  describe('Overchannel feature', () => {
    const overchannelStats = {
      ...baseMockPlayerStats,
      automation: {
        passives: [{ type: 'overchannel' }],
        actions: [],
      },
    };

    it.each([
      { name: 'applicable spell (level 1-5 with damage)', level: 3, damage: { damage_at_slot_level: { '1': '3d6', '3': '8d6' } }, stats: 'overchannel', shouldShow: true },
      { name: 'cantrip (level 0)', level: 0, damage: { damage_at_slot_level: { '0': '1d6' } }, stats: 'overchannel', shouldShow: false },
      { name: 'spell above level 5', level: 6, damage: { damage_at_slot_level: { '6': '10d6' } }, stats: 'overchannel', shouldShow: false },
      { name: 'spell without damage', level: 3, damage: null, stats: 'overchannel', shouldShow: false },
      { name: 'without the overchannel passive', level: 3, damage: { damage_at_slot_level: { '1': '3d6', '3': '8d6' } }, stats: 'noOverchannel', shouldShow: false },
    ])('renders Overchannel checkbox when applicable: $name', ({ level, damage, stats, shouldShow }) => {
      vi.mocked(useRuntimeValue).mockReturnValue(0);
      const spell = { ...baseMockSpell, level, damage };
      const playerStats = stats === 'noOverchannel'
        ? { ...baseMockPlayerStats, automation: { passives: [], actions: [] } }
        : overchannelStats;
      renderPopup(spell, playerStats, mockCampaignName);
      if (shouldShow) {
        expect(screen.getByText('Overchannel (Maximize Damage)')).toBeInTheDocument();
      } else {
        expect(screen.queryByText('Overchannel (Maximize Damage)')).not.toBeInTheDocument();
      }
    });

    it.each([
      { count: 0, expectedText: 'First use: no necrotic damage', expectedNotText: /Warning: Using Overchannel/ },
      { count: 1, expectedText: /Warning: Using Overchannel/, expectedNotText: 'First use: no necrotic damage' },
    ])('shows correct message when overchannel count is $count', ({ count, expectedText, expectedNotText }) => {
      vi.mocked(useRuntimeValue).mockReturnValue(count);
      const spell = {
        ...baseMockSpell,
        level: 1,
        damage: { damage_at_slot_level: { '1': '1d6' } },
      };
      renderPopup(spell, overchannelStats, mockCampaignName);
      const checkbox = screen.getByRole('checkbox');
      fireEvent.click(checkbox);
      expect(screen.getByText(expectedText)).toBeInTheDocument();
      expect(screen.queryByText(expectedNotText)).not.toBeInTheDocument();
    });

    it('passes overchannel: true in metaCtx when Overchannel checkbox is toggled', () => {
      vi.mocked(useRuntimeValue).mockReturnValue(0);
      const onCast = vi.fn();
      const spell = {
        ...baseMockSpell,
        level: 1,
        damage: { damage_at_slot_level: { '1': '1d6' } },
      };
      renderPopup(spell, overchannelStats, mockCampaignName, { onCast });

      const checkbox = screen.getByRole('checkbox');
      fireEvent.click(checkbox);

      fireEvent.click(screen.getByRole('button', { name: /Cast Spell/ }));
      expect(onCast).toHaveBeenCalledTimes(1);
      const metaCtx = onCast.mock.calls[0][1];
      expect(metaCtx.overchannel).toBe(true);
    });

    it('passes overchannel: false in metaCtx when Overchannel is not toggled', () => {
      vi.mocked(useRuntimeValue).mockReturnValue(0);
      const onCast = vi.fn();
      const spell = {
        ...baseMockSpell,
        level: 1,
        damage: { damage_at_slot_level: { '1': '1d6' } },
      };
      renderPopup(spell, overchannelStats, mockCampaignName, { onCast });

      fireEvent.click(screen.getByRole('button', { name: /Cast Spell/ }));
      expect(onCast).toHaveBeenCalledTimes(1);
      const metaCtx = onCast.mock.calls[0][1];
      expect(metaCtx.overchannel).toBe(false);
    });
  });
});
