// @improved-by-ai
// Overchannel channel of SpellDetailPopup: checkbox eligibility, the live
// necrotic-damage notice driven by the REAL damage table in overchannelHandler
// (un-mocked on purpose — it is pure given the mocked runtime store), and the
// overchannel flag carried through the cast payload.
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import SpellDetailPopup from './SpellDetailPopup.jsx';
import { getRuntimeValue, useRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
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

vi.mock('../../../services/rules/spells/spellPreparationService.js', () => ({
  isFreeCastAuthorized: vi.fn(() => false),
  isWizardRitualAdeptSpell: vi.fn(() => false),
}));

vi.mock('../../../services/rules/spells/metamagicRules.js', () => ({
  isPsionicSpell: vi.fn(() => false),
  hasPsionicSorcery: vi.fn(() => false),
}));

vi.mock('../../../services/rules/spells/materialComponents.js', () => ({
  getConsumedMaterial: vi.fn(() => null),
  hasMaterial: vi.fn(() => true),
}));

const OVERCHANNEL = { type: 'overchannel' };

const wizardStats = (passives = [OVERCHANNEL]) => ({
  name: 'Elara',
  level: 5,
  class: { name: 'Wizard', major: { name: 'Wizard' } },
  abilities: [{ name: 'Intelligence', bonus: 3 }],
  proficiency: 3,
  spellAbilities: {
    spell_slots_level_1: 4,
    spell_slots_level_2: 3,
    spell_slots_level_3: 2,
    spells: [],
  },
  automation: { passives, actions: [] },
});

const damageSpell = (level, formula = '1d6') => ({
  name: 'Magic Missile',
  level,
  description: 'You create three twisting darts of magical force.',
  casting_time: '1 action',
  range: '120 feet',
  duration: 'Instantaneous',
  school: 'Evocation',
  damage: { damage_at_slot_level: { [String(level)]: formula } },
});

// Stored Overchannel_useCount from the runtime store (next use is count + 1).
function mockOverchannelUseCount(count) {
  vi.mocked(useRuntimeValue).mockImplementation((_name, key) =>
    key === 'Overchannel_useCount' ? count : null,
  );
}

function renderPopup({ spell = damageSpell(1), playerStats = wizardStats(), onCast = vi.fn() } = {}) {
  render(
    <SpellDetailPopup
      spell={spell}
      playerStats={playerStats}
      campaignName="test-campaign"
      onClose={vi.fn()}
      onCast={onCast}
    />,
  );
  return onCast;
}

const overchannelCheckbox = () => screen.getByRole('checkbox', { name: /overchannel/i });

describe('SpellDetailPopup - Overchannel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getRuntimeValue).mockReturnValue(null);
    vi.mocked(useRuntimeValue).mockReturnValue(null);
    vi.mocked(getActiveBuffs).mockReturnValue([]);
  });

  describe('checkbox eligibility', () => {
    it('offers an unchecked Overchannel checkbox for a damage spell (levels 1-5) with the passive', () => {
      mockOverchannelUseCount(0);
      renderPopup();

      const checkbox = overchannelCheckbox();
      expect(checkbox).toBeInTheDocument();
      expect(checkbox).not.toBeChecked();
    });

    it.each([
      { label: 'no overchannel passive', spell: damageSpell(1), passives: [] },
      { label: 'cantrip', spell: damageSpell(0, '1d4'), passives: [OVERCHANNEL] },
      { label: 'spell above level 5', spell: damageSpell(6, '8d6'), passives: [OVERCHANNEL] },
      { label: 'spell without damage', spell: { ...damageSpell(1), damage: undefined }, passives: [OVERCHANNEL] },
    ])('hides the checkbox for a $label', ({ spell, passives }) => {
      mockOverchannelUseCount(0);
      renderPopup({ spell, playerStats: wizardStats(passives) });

      expect(screen.queryByRole('checkbox', { name: /overchannel/i })).not.toBeInTheDocument();
    });
  });

  describe('necrotic damage notice', () => {
    it('shows notices only while ticked, including warning after prior uses', () => {
      mockOverchannelUseCount(1);
      renderPopup();

      // Section is present but silent until the checkbox is ticked.
      expect(overchannelCheckbox()).toBeInTheDocument();
      expect(screen.queryByText(/Warning: Using Overchannel/)).not.toBeInTheDocument();
      expect(screen.queryByText('First use: no necrotic damage')).not.toBeInTheDocument();

      // Tick then untick: notices appear and disappear with the checkbox.
      fireEvent.click(overchannelCheckbox());
      expect(overchannelCheckbox()).toBeChecked();
      expect(screen.getByText(/Warning: Using Overchannel/)).toBeInTheDocument();

      fireEvent.click(overchannelCheckbox());
      expect(overchannelCheckbox()).not.toBeChecked();
      expect(screen.queryByText(/Warning: Using Overchannel/)).not.toBeInTheDocument();
      expect(screen.queryByText('First use: no necrotic damage')).not.toBeInTheDocument();
    });

    it('shows the first-use reassurance when ticked with no prior uses', () => {
      mockOverchannelUseCount(0);
      renderPopup();

      fireEvent.click(overchannelCheckbox());

      expect(overchannelCheckbox()).toBeChecked();
      expect(screen.getByText('First use: no necrotic damage')).toBeInTheDocument();
      expect(screen.queryByText(/Warning: Using Overchannel/)).not.toBeInTheDocument();
    });

    it('warns with the next use number and self-damage when ticked after prior uses', () => {
      mockOverchannelUseCount(1);
      renderPopup({ spell: damageSpell(1) });

      fireEvent.click(overchannelCheckbox());

      const warning = screen.getByText(/Warning: Using Overchannel/);
      expect(warning).toHaveTextContent('use #2');
      expect(warning).toHaveTextContent('2d12');
      expect(warning).toHaveTextContent('Necrotic');
      expect(screen.queryByText('First use: no necrotic damage')).not.toBeInTheDocument();
    });

    it.each([
      { level: 2, expected: '4d12' },
      { level: 3, expected: '6d12' },
    ])('scales the warned self-damage with the spell slot level (level $level → $expected)', ({ level, expected }) => {
      mockOverchannelUseCount(1);
      renderPopup({ spell: damageSpell(level) });

      fireEvent.click(overchannelCheckbox());

      expect(screen.getByText(/Warning: Using Overchannel/)).toHaveTextContent(expected);
    });

    it('escalates the warning as stored uses increase', () => {
      mockOverchannelUseCount(2);
      renderPopup({ spell: damageSpell(1) });

      fireEvent.click(overchannelCheckbox());

      const warning = screen.getByText(/Warning: Using Overchannel/);
      expect(warning).toHaveTextContent('use #3');
      expect(warning).toHaveTextContent('3d12');
    });
  });

  describe('cast payload', () => {
    it.each([
      { toggled: false, expectedOverchannel: false },
      { toggled: true, expectedOverchannel: true },
    ])('passes overchannel:$expectedOverchannel in the spell and metaCtx when $toggled', ({ toggled, expectedOverchannel }) => {
      mockOverchannelUseCount(0);
      const onCast = renderPopup();

      if (toggled) {
        fireEvent.click(overchannelCheckbox());
      }
      fireEvent.click(screen.getByRole('button', { name: /Cast Spell/ }));

      expect(onCast).toHaveBeenCalledTimes(1);
      const [passedSpell, metaCtx] = onCast.mock.calls[0];
      expect(metaCtx.overchannel).toBe(expectedOverchannel);
      expect(passedSpell.overchannel).toBe(expectedOverchannel);
    });

    it('casts without overchannel when the checkbox is ticked then unticked', () => {
      mockOverchannelUseCount(0);
      const onCast = renderPopup();

      fireEvent.click(overchannelCheckbox());
      expect(overchannelCheckbox()).toBeChecked();
      fireEvent.click(overchannelCheckbox());

      fireEvent.click(screen.getByRole('button', { name: /Cast Spell/ }));

      expect(onCast).toHaveBeenCalledTimes(1);
      const [passedSpell, metaCtx] = onCast.mock.calls[0];
      expect(metaCtx.overchannel).toBe(false);
      expect(passedSpell.overchannel).toBe(false);
    });
  });
});
