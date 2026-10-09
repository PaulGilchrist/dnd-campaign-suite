// CLA-299 regression: SpellDetailPopup Ritual Adept affordance for the 2024 Wizard.
// An UNPREPARED spellbook ritual with ZERO slots shows the ritual cast banner (+10 min,
// read from the spellbook), keeps Cast Spell ENABLED and never the "No spell slots"
// warning; its payload carries ritualCast:true. A PREPARED spellbook ritual offers a
// "Cast as Ritual" checkbox (ticked = slotless, unticked = byte-identical slot pay with
// "No spell slots" honest at zero). Non-wizards get neither affordance.
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import SpellDetailPopup from './SpellDetailPopup.jsx';
import { getRuntimeValue, useRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(),
  useRuntimeValue: vi.fn(() => null),
}));

vi.mock('../../../services/ui/sanitize.js', () => ({
  sanitizeHtml: (html) => html,
}));

const autoBanner = 'Ritual Cast — no spell slot consumed';
const bookNote = 'Ritual Adept: read from your spellbook — casting time +10 minutes.';
const tickBanner = 'Ritual Cast — no spell slot consumed (+10 minutes, read from your spellbook)';
const freeCastText = 'Free Cast — no spell slot consumed';

function makeWizardStats({ lv1 = 0, spells = [identifyUnprepared] } = {}) {
  return {
    name: 'DivinationWizard',
    level: 20,
    rules: '2024',
    class: { name: 'Wizard', spell_casting_ability: 'Intelligence' },
    abilities: [{ name: 'Intelligence', bonus: 7 }],
    proficiency: 6,
    spellAbilities: {
      spellCastingAbility: 'Intelligence',
      saveDc: 21,
      modifier: 7,
      spell_slots_level_1: lv1,
      spells,
    },
    automation: { passives: [], actions: [], bonusActions: [], specialActions: [] },
  };
}

const identifyUnprepared = {
  name: 'Identify',
  level: 1,
  description: '<p>You choose one object that you must touch.</p>',
  casting_time: '1 minute or Ritual',
  range: 'Touch',
  duration: 'Instantaneous',
  school: 'Divination',
  damage: null,
  ritual: true,
  prepared: '',
};

const identifyPrepared = { ...identifyUnprepared, prepared: 'Prepared' };

describe('SpellDetailPopup — Ritual Adept wizard channel (CLA-299)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getRuntimeValue).mockReturnValue(null);
    vi.mocked(useRuntimeValue).mockReturnValue(null);
  });

  describe('unprepared spellbook ritual (auto ritual-only)', () => {
    it('shows the ritual banner with zero spell slots and keeps Cast Spell enabled', () => {
      render(
        <SpellDetailPopup
          spell={identifyUnprepared}
          playerStats={makeWizardStats()}
          campaignName="test-campaign"
          onClose={vi.fn()}
          onCast={vi.fn()}
        />
      );

      expect(screen.getByText(autoBanner)).toBeInTheDocument();
      expect(screen.getByText(bookNote)).toBeInTheDocument();
      expect(screen.queryByText(freeCastText)).not.toBeInTheDocument();
      expect(screen.queryByText('No spell slots available for this level.')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Cast Spell/ })).toBeEnabled();
    });

    it('carries ritualCast:true and freeCastAuthorized:true in the cast payload', () => {
      const onCast = vi.fn();
      render(
        <SpellDetailPopup
          spell={identifyUnprepared}
          playerStats={makeWizardStats()}
          campaignName="test-campaign"
          onClose={vi.fn()}
          onCast={onCast}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: /Cast Spell/ }));
      expect(onCast).toHaveBeenCalledTimes(1);
      expect(onCast.mock.calls[0][0].ritualCast).toBe(true);
      expect(onCast.mock.calls[0][0].freeCastAuthorized).toBe(true);
    });
  });

  describe('prepared spellbook ritual (opt-in checkbox)', () => {
    it('offers the Cast as Ritual checkbox; ticked pays no slot and confirms in the banner', () => {
      vi.mocked(getRuntimeValue).mockImplementation((_name, key) => (key === 'spell_slots_level_1' ? 3 : null));
      const onCast = vi.fn();
      render(
        <SpellDetailPopup
          spell={identifyPrepared}
          playerStats={makeWizardStats({ lv1: 3, spells: [identifyPrepared] })}
          campaignName="test-campaign"
          onClose={vi.fn()}
          onCast={onCast}
        />
      );

      const checkbox = screen.getByRole('checkbox', { name: /Cast as Ritual/ });
      expect(checkbox).toBeInTheDocument();
      expect(screen.queryByText(tickBanner)).not.toBeInTheDocument();

      fireEvent.click(checkbox);
      expect(screen.getByText(tickBanner)).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: /Cast Spell/ }));
      expect(onCast).toHaveBeenCalledTimes(1);
      expect(onCast.mock.calls[0][0].ritualCast).toBe(true);
    });

    it('unticked prepared ritual keeps the byte-identical slot payment affordance', () => {
      vi.mocked(getRuntimeValue).mockImplementation((_name, key) => (key === 'spell_slots_level_1' ? 3 : null));
      const onCast = vi.fn();
      render(
        <SpellDetailPopup
          spell={identifyPrepared}
          playerStats={makeWizardStats({ lv1: 3, spells: [identifyPrepared] })}
          campaignName="test-campaign"
          onClose={vi.fn()}
          onCast={onCast}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: /Cast Spell/ }));
      expect(onCast).toHaveBeenCalledTimes(1);
      expect(onCast.mock.calls[0][0].ritualCast).toBe(false);
      expect(screen.getByText(/Slots Remaining:/)).toBeInTheDocument();
      expect(screen.queryByText(autoBanner)).not.toBeInTheDocument();
    });

    it('shows "No spell slots available" at zero slots while the checkbox stays unticked', () => {
      render(
        <SpellDetailPopup
          spell={identifyPrepared}
          playerStats={makeWizardStats({ spells: [identifyPrepared] })}
          campaignName="test-campaign"
          onClose={vi.fn()}
          onCast={vi.fn()}
        />
      );

      expect(screen.getByText('No spell slots available for this level.')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Cast Spell/ })).toBeDisabled();
    });

    it('enables the zero-slot cast once the checkbox is ticked', () => {
      render(
        <SpellDetailPopup
          spell={identifyPrepared}
          playerStats={makeWizardStats({ spells: [identifyPrepared] })}
          campaignName="test-campaign"
          onClose={vi.fn()}
          onCast={vi.fn()}
        />
      );

      fireEvent.click(screen.getByRole('checkbox', { name: /Cast as Ritual/ }));
      expect(screen.getByRole('button', { name: /Cast Spell/ })).toBeEnabled();
      expect(screen.queryByText('No spell slots available for this level.')).not.toBeInTheDocument();
    });
  });

  it('offers neither the checkbox nor the ritual banner for non-Wizard classes', () => {
    const warlockStats = {
      ...makeWizardStats(),
      rules: '2024',
      class: { name: 'Warlock', spell_casting_ability: 'Charisma' },
    };
    render(
      <SpellDetailPopup
        spell={identifyUnprepared}
        playerStats={warlockStats}
        campaignName="test-campaign"
        onClose={vi.fn()}
        onCast={vi.fn()}
      />
    );

    expect(screen.queryByRole('checkbox', { name: /Cast as Ritual/ })).not.toBeInTheDocument();
    expect(screen.queryByText(autoBanner)).not.toBeInTheDocument();
    expect(screen.queryByText(bookNote)).not.toBeInTheDocument();
  });

  it('offers neither affordance for a 5e wizard (prepared-only RAW)', () => {
    const legacyStats = { ...makeWizardStats({ spells: [identifyPrepared] }), rules: '5e' };
    render(
      <SpellDetailPopup
        spell={identifyPrepared}
        playerStats={legacyStats}
        campaignName="test-campaign"
        onClose={vi.fn()}
        onCast={vi.fn()}
      />
    );

    expect(screen.queryByRole('checkbox', { name: /Cast as Ritual/ })).not.toBeInTheDocument();
    expect(screen.queryByText(autoBanner)).not.toBeInTheDocument();
  });
});
