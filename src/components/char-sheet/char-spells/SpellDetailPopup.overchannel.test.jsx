import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import SpellDetailPopup from './SpellDetailPopup.jsx';
import { getRuntimeValue, useRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { getActiveBuffs } from '../../../services/combat/buffs/buffService.js';
import { getOverchannelNecroticDamage } from '../../../services/automation/handlers/class-wizard/overchannelHandler.js';

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

vi.mock('../../../services/automation/handlers/class-wizard/overchannelHandler.js', () => ({
  getOverchannelNecroticDamage: vi.fn(() => null),
  handle: vi.fn(),
  getOverchannelUses: vi.fn(() => 0),
  hasOverchannelRemaining: vi.fn(() => true),
  consumeOverchannelUse: vi.fn(() => Promise.resolve(true)),
  restoreOverchannelOnLongRest: vi.fn(() => Promise.resolve()),
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
    />,
  );

describe('SpellDetailPopup - Overchannel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getRuntimeValue).mockReturnValue(null);
    vi.mocked(getActiveBuffs).mockReturnValue([]);
  });

  describe('overchannel warning messages', () => {
    it.each([
      { useCount: 0, expectedWarning: false, expectedInfo: true, label: 'first use shows info, no damage warning' },
      { useCount: 1, expectedWarning: true, expectedInfo: false, label: 'subsequent use shows damage warning' },
      { useCount: 2, expectedWarning: true, expectedInfo: false, label: 'later use shows damage warning' },
    ])('checkbox $label', ({ useCount, expectedWarning, expectedInfo }) => {
      vi.mocked(useRuntimeValue).mockReturnValue(useCount);
      vi.mocked(getOverchannelNecroticDamage).mockReturnValue(expectedWarning ? { expression: '4d12' } : 0);

      const spell = {
        ...baseMockSpell,
        level: 1,
        damage: { damage_at_slot_level: { '1': '1d6' } },
      };
      const stats = {
        ...baseMockPlayerStats,
        automation: { passives: [{ type: 'overchannel' }], actions: [] },
      };
      renderPopup(spell, stats, mockCampaignName);

      const checkbox = screen.getByRole('checkbox');
      fireEvent.click(checkbox);

      if (expectedWarning) {
        expect(screen.getByText(/Warning: Using Overchannel/)).toBeInTheDocument();
        expect(screen.queryByText('First use: no necrotic damage')).not.toBeInTheDocument();
      }
      if (expectedInfo) {
        expect(screen.getByText('First use: no necrotic damage')).toBeInTheDocument();
        expect(screen.queryByText(/Warning: Using Overchannel/)).not.toBeInTheDocument();
      }
    });
  });

  describe('metaCtx overchannel flag on cast', () => {
    it.each([
      { toggled: false, expectedOverchannel: false, label: 'not toggled' },
      { toggled: true, expectedOverchannel: true, label: 'toggled' },
    ])('passes overchannel:$expectedOverchannel in metaCtx when $label', ({ toggled, expectedOverchannel }) => {
      vi.mocked(useRuntimeValue).mockReturnValue(0);
      vi.mocked(getOverchannelNecroticDamage).mockReturnValue(0);
      const onCast = vi.fn();
      const spell = {
        ...baseMockSpell,
        level: 1,
        damage: { damage_at_slot_level: { '1': '1d6' } },
      };
      const stats = {
        ...baseMockPlayerStats,
        automation: { passives: [{ type: 'overchannel' }], actions: [] },
      };
      renderPopup(spell, stats, mockCampaignName, { onCast });

      if (toggled) {
        fireEvent.click(screen.getByRole('checkbox'));
      }
      fireEvent.click(screen.getByRole('button', { name: /Cast Spell/ }));

      expect(onCast).toHaveBeenCalledTimes(1);
      const [passedSpell, metaCtx] = onCast.mock.calls[0];
      expect(metaCtx.overchannel).toBe(expectedOverchannel);
      expect(passedSpell.overchannel).toBe(expectedOverchannel);
    });
  });
});
