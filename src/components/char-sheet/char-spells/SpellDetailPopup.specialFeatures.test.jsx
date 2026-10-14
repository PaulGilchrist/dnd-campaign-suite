// @improved-by-ai
// CLA-322 Spell Breaker and Psychic Spells damage-type override — cast-payload behavior.
// Casting-time display is covered in SpellDetailPopup.spellBreaker.test.jsx;
// the cantrip psychic path is covered in SpellDetailPopup.castCantrip.test.jsx.
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import SpellDetailPopup from './SpellDetailPopup.jsx';

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
}));

vi.mock('../../../services/rules/spells/metamagicRules.js', () => ({
  isPsionicSpell: vi.fn(() => false),
  hasPsionicSorcery: vi.fn(() => false),
}));

// The component calls these synchronously — return plain booleans.
// (A Promise is truthy, which would silently make every cast possible.)
vi.mock('../../../services/rules/spells/spellPreparationService.js', () => ({
  isFreeCastAuthorized: vi.fn(() => false),
  isWizardRitualAdeptSpell: vi.fn(() => false),
}));

vi.mock('../../../services/rules/spells/materialComponents.js', () => ({
  getConsumedMaterial: vi.fn(() => null),
  hasMaterial: vi.fn(() => true),
}));

const CAMPAIGN = 'test-campaign';

const makeStats = (overrides = {}) => ({
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
  ...overrides,
});

const makeSpell = (overrides = {}) => ({
  name: 'Magic Missile',
  level: 1,
  description: 'A spell with an explicit description.',
  casting_time: '1 action',
  range: '120 feet',
  duration: 'Instantaneous',
  school: 'Evocation',
  damage: null,
  ...overrides,
});

const renderPopup = (spell, playerStats, onCast = vi.fn()) =>
  render(
    <SpellDetailPopup
      spell={spell}
      playerStats={playerStats}
      campaignName={CAMPAIGN}
      onClose={vi.fn()}
      onCast={onCast}
    />,
  );

const castSpellButton = () => screen.getByRole('button', { name: /Cast Spell/ });

describe('SpellDetailPopup — special feature cast payloads', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Spell Breaker — dispelAbilityCheckBonus on cast (CLA-322)', () => {
    const SPELL_BREAKER = {
      type: 'spell_breaker',
      name: 'Spell Breaker',
      bonusActionSpells: ['Dispel Magic'],
      slotRetentionSpells: ['Counterspell', 'Dispel Magic'],
    };

    const spellBreakerStats = (overrides = {}) =>
      makeStats({ automation: { passives: [SPELL_BREAKER], actions: [] }, ...overrides });

    const dispelMagic = () =>
      makeSpell({ name: 'Dispel Magic', level: 3, school: 'Abjuration' });

    // The bonus mirrors the proficiency-bonus ladder: floor((level - 1) / 4) + 2.
    // Multiple levels pin the formula; a hard-coded constant would pass even if
    // the level scaling were broken.
    it.each([
      { level: 1, expectedBonus: 2 },
      { level: 5, expectedBonus: 3 },
      { level: 9, expectedBonus: 4 },
    ])('passes proficiency bonus $expectedBonus as dispelAbilityCheckBonus for Dispel Magic at player level $level', ({ level, expectedBonus }) => {
      const onCast = vi.fn();
      renderPopup(dispelMagic(), spellBreakerStats({ level }), onCast);

      fireEvent.click(castSpellButton());

      expect(onCast).toHaveBeenCalledTimes(1);
      const [castSpell, metaCtx] = onCast.mock.calls[0];
      expect(castSpell.name).toBe('Dispel Magic');
      expect(metaCtx.dispelAbilityCheckBonus).toBe(expectedBonus);
    });

    it('omits dispelAbilityCheckBonus when a Spell Breaker casts a spell outside bonusActionSpells', () => {
      const onCast = vi.fn();
      renderPopup(
        makeSpell({ name: 'Counterspell', level: 3, casting_time: '1 reaction', school: 'Abjuration' }),
        spellBreakerStats(),
        onCast,
      );

      fireEvent.click(castSpellButton());

      expect(onCast).toHaveBeenCalledTimes(1);
      expect(onCast.mock.calls[0][1]).not.toHaveProperty('dispelAbilityCheckBonus');
    });

    it('omits dispelAbilityCheckBonus for Dispel Magic without the Spell Breaker passive', () => {
      const onCast = vi.fn();
      renderPopup(dispelMagic(), makeStats(), onCast);

      fireEvent.click(castSpellButton());

      expect(onCast).toHaveBeenCalledTimes(1);
      expect(onCast.mock.calls[0][1]).not.toHaveProperty('dispelAbilityCheckBonus');
    });
  });

  describe('Psychic Spells — damage type override', () => {
    const PSYCHIC_PASSIVE = { type: 'psychic_spells' };

    const warlockStats = (passives = [PSYCHIC_PASSIVE]) =>
      makeStats({
        class: { name: 'Warlock', major: { name: 'Warlock' } },
        automation: { passives, actions: [] },
      });

    const burningHands = () =>
      makeSpell({
        name: 'Burning Hands',
        damage: { damage_at_slot_level: { '1': '3d4' } },
      });

    const psychicCheckbox = () =>
      screen.getByRole('checkbox', { name: /Change damage type to Psychic/ });

    it('offers the Psychic damage checkbox unchecked by default', () => {
      renderPopup(burningHands(), warlockStats());
      expect(psychicCheckbox()).not.toBeChecked();
    });

    it('passes usePsychicDamage:true when the checkbox is checked', () => {
      const onCast = vi.fn();
      renderPopup(burningHands(), warlockStats(), onCast);

      fireEvent.click(psychicCheckbox());
      expect(psychicCheckbox()).toBeChecked();

      fireEvent.click(castSpellButton());

      expect(onCast).toHaveBeenCalledTimes(1);
      expect(onCast.mock.calls[0][0]).toMatchObject({
        name: 'Burning Hands',
        usePsychicDamage: true,
      });
    });

    it('passes usePsychicDamage:false when the checkbox is left unchecked', () => {
      const onCast = vi.fn();
      renderPopup(burningHands(), warlockStats(), onCast);

      fireEvent.click(castSpellButton());

      expect(onCast).toHaveBeenCalledTimes(1);
      expect(onCast.mock.calls[0][0]).toMatchObject({ usePsychicDamage: false });
    });

    // canChangeDamageType requires ALL of: Warlock class, psychic_spells passive, damaging spell.
    it.each([
      {
        label: 'a non-Warlock caster holding the passive',
        spell: burningHands(),
        stats: makeStats({ automation: { passives: [PSYCHIC_PASSIVE], actions: [] } }),
      },
      {
        label: 'a Warlock without the psychic_spells passive',
        spell: burningHands(),
        stats: warlockStats([]),
      },
      {
        label: 'a spell that deals no damage',
        spell: makeSpell({ name: 'Shield', casting_time: '1 reaction', school: 'Abjuration' }),
        stats: warlockStats(),
      },
    ])('hides the Psychic damage checkbox for $label', ({ spell, stats }) => {
      renderPopup(spell, stats);
      expect(
        screen.queryByRole('checkbox', { name: /Change damage type to Psychic/ }),
      ).not.toBeInTheDocument();
    });
  });
});
