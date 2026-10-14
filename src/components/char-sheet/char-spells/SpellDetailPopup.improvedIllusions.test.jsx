// @improved-by-ai
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import SpellDetailPopup from './SpellDetailPopup.jsx';

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(),
  useRuntimeValue: vi.fn(() => null),
}));

vi.mock('../../../services/combat/buffs/buffService.js', () => ({
  getActiveBuffs: vi.fn(() => []),
}));

vi.mock('../../../services/rules/spells/spellPreparationService.js', () => ({
  isFreeCastAuthorized: vi.fn(() => false),
  isWizardRitualAdeptSpell: vi.fn(() => false),
}));

vi.mock('../../../services/rules/spells/materialComponents.js', () => ({
  getConsumedMaterial: vi.fn(() => null),
  hasMaterial: vi.fn(() => true),
}));

const IMPROVED_ILLUSIONS_BANNER = 'No Verbal components (Improved Illusions)';
const PSYCHIC_SPELLS_BANNER = 'No Verbal or Somatic components (Psychic Spells)';

// Per-test fixture factories — each call returns a fresh object.
function makeSpell(overrides = {}) {
  return {
    name: 'Disguise Self',
    level: 1,
    school: 'Illusion',
    description: 'You use magical trickery to change your appearance.',
    casting_time: '1 action',
    range: 'Self',
    duration: '1 hour',
    ...overrides,
  };
}

// Improved Illusions is a 2024 Illusionist (Wizard) subclass feature, so the
// baseline caster is a wizard — the popup's banner is deliberately class-agnostic
// and keyed only on the passive + spell school.
function makeIllusionistStats(passives = [{ type: 'improved_illusions' }]) {
  return {
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
  };
}

function renderPopup(spell, playerStats) {
  return render(
    <SpellDetailPopup
      spell={spell}
      playerStats={playerStats}
      campaignName="test-campaign"
      onClose={vi.fn()}
      onCast={vi.fn()}
    />
  );
}

describe('SpellDetailPopup - Improved Illusions banner', () => {
  it('shows the banner when the caster has the passive and the spell school is Illusion', () => {
    renderPopup(makeSpell(), makeIllusionistStats());

    expect(screen.getByText(IMPROVED_ILLUSIONS_BANNER)).toBeInTheDocument();
  });

  it('does not show the banner when the caster lacks the improved_illusions passive', () => {
    renderPopup(makeSpell(), makeIllusionistStats([]));

    expect(screen.queryByText(IMPROVED_ILLUSIONS_BANNER)).not.toBeInTheDocument();
  });

  it('shows the banner regardless of character class — keyed on the passive, not Warlock', () => {
    const warlockWithPassive = {
      ...makeIllusionistStats(),
      class: { name: 'Warlock', major: { name: 'Warlock' } },
    };

    renderPopup(makeSpell(), warlockWithPassive);

    expect(screen.getByText(IMPROVED_ILLUSIONS_BANNER)).toBeInTheDocument();
  });

  it.each(['Evocation', 'Necromancy', 'Abjuration'])(
    'does not show the banner for a %s spell even with the passive',
    (school) => {
      renderPopup(makeSpell({ name: 'Magic Missile', school }), makeIllusionistStats());

      expect(screen.queryByText(IMPROVED_ILLUSIONS_BANNER)).not.toBeInTheDocument();
    }
  );

  it.each([
    { label: 'null', school: null },
    { label: 'undefined', school: undefined },
    { label: 'an empty string', school: '' },
  ])('does not show the banner when spell.school is $label', ({ school }) => {
    renderPopup(makeSpell({ school }), makeIllusionistStats());

    expect(screen.queryByText(IMPROVED_ILLUSIONS_BANNER)).not.toBeInTheDocument();
  });

  it('matches the Illusion school case-insensitively', () => {
    renderPopup(makeSpell({ school: 'illusion' }), makeIllusionistStats());

    expect(screen.getByText(IMPROVED_ILLUSIONS_BANNER)).toBeInTheDocument();
  });
});

describe('SpellDetailPopup - Improved Illusions alongside Psychic Spells', () => {
  // Psychic Spells is a Warlock feature and additionally requires the class,
  // so these interplay cases use a warlock holding both passives.
  function makeWarlockWithBothPassives() {
    return {
      ...makeIllusionistStats([
        { type: 'psychic_spells' },
        { type: 'improved_illusions' },
      ]),
      class: { name: 'Warlock', major: { name: 'Warlock' } },
      abilities: [{ name: 'Charisma', bonus: 3 }],
    };
  }

  it('shows both banners for an Illusion spell with both passives', () => {
    renderPopup(makeSpell(), makeWarlockWithBothPassives());

    expect(screen.getByText(PSYCHIC_SPELLS_BANNER)).toBeInTheDocument();
    expect(screen.getByText(IMPROVED_ILLUSIONS_BANNER)).toBeInTheDocument();
  });

  it('shows only the Psychic Spells banner for an Enchantment spell with both passives', () => {
    renderPopup(
      makeSpell({ name: 'Bane', school: 'Enchantment' }),
      makeWarlockWithBothPassives()
    );

    expect(screen.getByText(PSYCHIC_SPELLS_BANNER)).toBeInTheDocument();
    expect(screen.queryByText(IMPROVED_ILLUSIONS_BANNER)).not.toBeInTheDocument();
  });
});
