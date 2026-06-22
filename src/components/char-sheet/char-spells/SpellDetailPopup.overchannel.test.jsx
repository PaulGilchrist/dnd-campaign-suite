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

    it('renders Overchannel checkbox for applicable spells (level 1-5 with damage)', () => {
      vi.mocked(useRuntimeValue).mockReturnValue(0);
      const spell = {
        ...baseMockSpell,
        level: 3,
        damage: { damage_at_slot_level: { '1': '3d6', '3': '8d6' } },
      };
      renderPopup(spell, overchannelStats, mockCampaignName);
      expect(
        screen.getByText('Overchannel (Maximize Damage)')
      ).toBeInTheDocument();
    });

    it('does not render Overchannel for cantrips (level 0)', () => {
      vi.mocked(useRuntimeValue).mockReturnValue(0);
      const cantrip = {
        ...baseMockSpell,
        level: 0,
        damage: { damage_at_slot_level: { '0': '1d6' } },
      };
      renderPopup(cantrip, overchannelStats, mockCampaignName);
      expect(
        screen.queryByText('Overchannel (Maximize Damage)')
      ).not.toBeInTheDocument();
    });

    it('does not render Overchannel for spells above level 5', () => {
      vi.mocked(useRuntimeValue).mockReturnValue(0);
      const highLevelSpell = {
        ...baseMockSpell,
        level: 6,
        damage: { damage_at_slot_level: { '6': '10d6' } },
      };
      renderPopup(highLevelSpell, overchannelStats, mockCampaignName);
      expect(
        screen.queryByText('Overchannel (Maximize Damage)')
      ).not.toBeInTheDocument();
    });

    it('does not render Overchannel for spells without damage', () => {
      vi.mocked(useRuntimeValue).mockReturnValue(0);
      const noDamageSpell = {
        ...baseMockSpell,
        damage: null,
      };
      renderPopup(noDamageSpell, overchannelStats, mockCampaignName);
      expect(
        screen.queryByText('Overchannel (Maximize Damage)')
      ).not.toBeInTheDocument();
    });

    it('does not render Overchannel without the passive', () => {
      const noOverchannelStats = {
        ...baseMockPlayerStats,
        automation: { passives: [], actions: [] },
      };
      renderPopup(baseMockSpell, noOverchannelStats, mockCampaignName);
      expect(
        screen.queryByText('Overchannel (Maximize Damage)')
      ).not.toBeInTheDocument();
    });

    it('shows first-use no-damage info when overchannel count is 0', () => {
      vi.mocked(useRuntimeValue).mockReturnValue(0);
      const spell = {
        ...baseMockSpell,
        level: 1,
        damage: { damage_at_slot_level: { '1': '1d6' } },
      };
      renderPopup(spell, overchannelStats, mockCampaignName);
      const checkbox = screen.getByRole('checkbox');
      fireEvent.click(checkbox);
      expect(
        screen.getByText('First use: no necrotic damage')
      ).toBeInTheDocument();
    });

    it('shows warning with expression when overchannel count > 0', () => {
      vi.mocked(useRuntimeValue).mockReturnValue(1);
      const spell = {
        ...baseMockSpell,
        level: 3,
        damage: { damage_at_slot_level: { '1': '3d6', '3': '8d6' } },
      };
      renderPopup(spell, overchannelStats, mockCampaignName);
      const checkbox = screen.getByRole('checkbox');
      fireEvent.click(checkbox);
      const warning = screen.getByText(/Warning: Using Overchannel/);
      expect(warning).toBeInTheDocument();
      expect(warning.textContent).toContain('use #2');
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

  describe('spell detail popup CSS classes and icons - overchannel', () => {
    it('renders Font Awesome skull icon in overchannel warning', () => {
      vi.mocked(useRuntimeValue).mockReturnValue(1);
      const spell = {
        ...baseMockSpell,
        level: 3,
        damage: { damage_at_slot_level: { '1': '3d6', '3': '8d6' } },
      };
      const overchannelStats = {
        ...baseMockPlayerStats,
        automation: {
          passives: [{ type: 'overchannel' }],
          actions: [],
        },
      };
      renderPopup(spell, overchannelStats, mockCampaignName);
      const checkbox = screen.getByRole('checkbox');
      fireEvent.click(checkbox);
      const icon = document.querySelector(
        '.spell-detail-overchannel-warning i.fa-solid.fa-skull'
      );
      expect(icon).toBeInTheDocument();
    });

    it('renders Font Awesome shield-halved icon for first-use overchannel info', () => {
      vi.mocked(useRuntimeValue).mockReturnValue(0);
      const spell = {
        ...baseMockSpell,
        level: 1,
        damage: { damage_at_slot_level: { '1': '1d6' } },
      };
      const overchannelStats = {
        ...baseMockPlayerStats,
        automation: {
          passives: [{ type: 'overchannel' }],
          actions: [],
        },
      };
      renderPopup(spell, overchannelStats, mockCampaignName);
      const checkbox = screen.getByRole('checkbox');
      fireEvent.click(checkbox);
      const icon = document.querySelector(
        '.spell-detail-overchannel-info i.fa-solid.fa-shield-halved'
      );
      expect(icon).toBeInTheDocument();
    });
  });
});
