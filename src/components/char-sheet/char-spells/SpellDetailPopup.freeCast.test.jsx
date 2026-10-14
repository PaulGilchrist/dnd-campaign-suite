// @improved-by-ai
// SpellDetailPopup free-cast authorization lane (component-level).
// The popup delegates authorization to the REAL isFreeCastAuthorized service
// (spellPreparationService) with the runtime store mocked — service internals
// have their own suites (spellPreparationService.*.test.js); this file proves
// the component contract per channel: the classic "Free Cast" banner, a
// Cast Spell button that works at ZERO spell slots (a free cast must never
// fabricate payment), the denial warning + disabled button when unauthorized,
// and the freeCastAuthorized flag carried through the onCast payload.
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import SpellDetailPopup from './SpellDetailPopup.jsx';
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(),
  useRuntimeValue: vi.fn(() => null),
}));

vi.mock('../../../services/ui/sanitize.js', () => ({
  sanitizeHtml: (html) => html,
}));

const CAMPAIGN = 'test-campaign';
const freeCastText = 'Free Cast — no spell slot consumed';
const noSlotsText = 'No spell slots available for this level.';

// Per-test fixtures via factories — no shared mutable objects.
const makeSpell = (overrides = {}) => ({
  name: 'Magic Missile',
  level: 1,
  description: 'Three darts of force strike a creature.',
  casting_time: '1 action',
  range: '120 feet',
  duration: 'Instantaneous',
  school: 'Evocation',
  damage: null,
  ...overrides,
});

// Slots are deliberately EMPTY at every level in every test: any cast that
// happens must be free. If an authorization check broke, the popup would show
// "No spell slots available" and disable Cast — the assertions catch it.
const makeStats = (overrides = {}) => {
  const { automation: automationOverrides, spellAbilities: spellAbilitiesOverrides, ...rest } = overrides;
  return {
    name: 'Elara',
    level: 5,
    class: { name: 'Wizard', major: { name: 'Wizard' } },
    abilities: [{ name: 'Intelligence', bonus: 3 }],
    proficiency: 3,
    spellAbilities: {
      spell_slots_level_1: 0,
      spell_slots_level_2: 0,
      spell_slots_level_3: 0,
      spells: [],
      ...spellAbilitiesOverrides,
    },
    automation: { passives: [], actions: [], bonusActions: [], specialActions: [], ...automationOverrides },
    ...rest,
  };
};

// Stub the runtime store from a key → value map; unlisted keys read null.
const stubRuntime = (values = {}) => {
  vi.mocked(getRuntimeValue).mockImplementation((_playerName, key) =>
    Object.prototype.hasOwnProperty.call(values, key) ? values[key] : null);
};

const renderPopup = (spell, playerStats = makeStats(), extraProps = {}) => {
  const onCast = extraProps.onCast || vi.fn();
  render(
    <SpellDetailPopup
      spell={spell}
      playerStats={playerStats}
      campaignName={CAMPAIGN}
      onClose={vi.fn()}
      onCast={onCast}
      {...extraProps}
    />
  );
  return onCast;
};

// Authorized at zero slots: classic banner, no slot warning, Cast enabled —
// the free cast is genuinely slotless, not incidentally paid.
const expectFreeCastGranted = () => {
  expect(screen.getByText(freeCastText)).toBeInTheDocument();
  expect(screen.queryByText(noSlotsText)).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Cast Spell/ })).toBeEnabled();
};

// Denied at zero slots: no banner, the slot warning appears, Cast disabled.
const expectFreeCastDenied = () => {
  expect(screen.queryByText(freeCastText)).not.toBeInTheDocument();
  expect(screen.getByText(noSlotsText)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Cast Spell/ })).toBeDisabled();
};

describe('SpellDetailPopup — Free Cast authorization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getRuntimeValue).mockReturnValue(null);
  });

  describe('Natural Recovery', () => {
    it('authorizes a spell on the recovery list, casting slotless at zero slots', () => {
      stubRuntime({ naturalRecoveryFreeCast: ['Healing Word'] });
      renderPopup(makeSpell({ name: 'Healing Word' }));
      expectFreeCastGranted();
    });

    it('does not authorize a spell that is not on the recovery list', () => {
      stubRuntime({ naturalRecoveryFreeCast: ['Healing Word'] });
      renderPopup(makeSpell({ name: 'Fire Bolt', level: 0 }));
      // Cantrips need no grant and no payment — deny means "no free-cast banner".
      expect(screen.queryByText(freeCastText)).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Cast Spell/ })).toBeEnabled();
    });

    it('does not authorize any spell when the recovery list is empty', () => {
      stubRuntime({ naturalRecoveryFreeCast: [] });
      renderPopup(makeSpell({ name: 'Healing Word' }));
      expectFreeCastDenied();
    });
  });

  describe('Bewitching Magic', () => {
    it('authorizes Misty Step while the free-cast flag is up', () => {
      stubRuntime({ '_Bewitching_Magic_freeCast': true });
      renderPopup(makeSpell({ name: 'Misty Step', level: 2, casting_time: '1 bonus action', school: 'Conjuration' }));
      expectFreeCastGranted();
    });

    it('does not authorize other spells while the flag is up', () => {
      stubRuntime({ '_Bewitching_Magic_freeCast': true });
      renderPopup(makeSpell({ name: 'Fireball', level: 3 }));
      expectFreeCastDenied();
    });

    it('does not authorize Misty Step when the flag is absent', () => {
      renderPopup(makeSpell({ name: 'Misty Step', level: 2, casting_time: '1 bonus action', school: 'Conjuration' }));
      expectFreeCastDenied();
    });
  });

  describe('Spell Mastery', () => {
    it('authorizes the level 1 mastery spell at its fixed level', () => {
      stubRuntime({ SpellMastery_level1: 'Shield' });
      renderPopup(makeSpell({ name: 'Shield', school: 'Abjuration' }));
      expectFreeCastGranted();
    });

    it('does not authorize the mastery spell cast above its fixed level', () => {
      stubRuntime({ SpellMastery_level1: 'Shield' });
      renderPopup(makeSpell({ name: 'Shield', level: 2, school: 'Abjuration' }));
      expectFreeCastDenied();
    });

    it('does not authorize a spell outside the mastery selection', () => {
      stubRuntime({ SpellMastery_level1: 'Shield' });
      renderPopup(makeSpell());
      expectFreeCastDenied();
    });
  });

  describe('Signature Spells', () => {
    it('authorizes the selected level 3 spell while unused', () => {
      stubRuntime({ SignatureSpells_selection: ['Fireball'], SignatureSpells_Fireball_used: false });
      renderPopup(makeSpell({
        name: 'Fireball',
        level: 3,
        damage: { damage_at_slot_level: { '3': '8d6', '4': '9d6' } },
      }));
      expectFreeCastGranted();
    });

    it('does not authorize the signature spell once it has been used', () => {
      stubRuntime({ SignatureSpells_selection: ['Fireball'], SignatureSpells_Fireball_used: true });
      renderPopup(makeSpell({
        name: 'Fireball',
        level: 3,
        damage: { damage_at_slot_level: { '3': '8d6', '4': '9d6' } },
      }));
      expectFreeCastDenied();
    });

    it('does not authorize a spell outside the signature selection', () => {
      stubRuntime({ SignatureSpells_selection: ['Fireball'], SignatureSpells_Fireball_used: false });
      renderPopup(makeSpell());
      expectFreeCastDenied();
    });

    // CLA-312: authorization is gated on the EFFECTIVE level — upcasting past
    // the fixed level revokes the free cast, and the paid cast says so.
    it('revokes the free cast and pays the slot when upcast above the fixed level', () => {
      stubRuntime({ SignatureSpells_selection: ['Fireball'], SignatureSpells_Fireball_used: false });
      const upcastLevels = [
        { level: 3, formula: '8d6', availableSlots: 1 },
        { level: 4, formula: '9d6', availableSlots: 1 },
      ];
      const onCast = renderPopup(
        makeSpell({ name: 'Fireball', level: 3, damage: { damage_at_slot_level: { '3': '8d6', '4': '9d6' } } }),
        makeStats(),
        { upcastLevels }
      );

      // Default selection is the first available level (3) — free cast armed.
      expectFreeCastGranted();

      fireEvent.click(screen.getByRole('radio', { name: /Level 4/ }));
      expect(screen.queryByText(freeCastText)).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: /Cast Spell/ }));
      expect(onCast).toHaveBeenCalledTimes(1);
      const payload = onCast.mock.calls[0][0];
      expect(payload.freeCastAuthorized).toBe(false);
      expect(payload.isUpcast).toBe(true);
      expect(payload.upcastLevel).toBe(4);
    });
  });

  describe('Divination Savant', () => {
    it('authorizes the chosen spell while unused', () => {
      stubRuntime({ '_Divination_Savant_selection': ['Warding Bond'], '_Divination_Savant_Warding_Bond_used': false });
      renderPopup(makeSpell({ name: 'Warding Bond', level: 2, school: 'Abjuration' }));
      expectFreeCastGranted();
    });

    it('does not authorize the chosen spell once used', () => {
      stubRuntime({ '_Divination_Savant_selection': ['Warding Bond'], '_Divination_Savant_Warding_Bond_used': true });
      renderPopup(makeSpell({ name: 'Warding Bond', level: 2, school: 'Abjuration' }));
      expectFreeCastDenied();
    });

    it('does not authorize a spell outside the selection', () => {
      stubRuntime({ '_Divination_Savant_selection': ['Warding Bond'], '_Divination_Savant_Warding_Bond_used': false });
      renderPopup(makeSpell());
      expectFreeCastDenied();
    });
  });

  describe('Counter-based free_spell actions', () => {
    const smiteStats = () => makeStats({
      automation: {
        actions: [{
          name: "Paladin's Smite",
          type: 'free_spell',
          spell: 'Divine Smite',
          uses_expression: '1/rest',
          usesMax: 1,
        }],
      },
    });

    it('authorizes when the runtime counter is above zero', () => {
      stubRuntime({ "_Paladin's_Smite_freeCastCount": 1 });
      renderPopup(makeSpell({ name: 'Divine Smite' }), smiteStats());
      expectFreeCastGranted();
    });

    it('does not authorize when the runtime counter is spent (0)', () => {
      stubRuntime({ "_Paladin's_Smite_freeCastCount": 0 });
      renderPopup(makeSpell({ name: 'Divine Smite' }), smiteStats());
      expectFreeCastDenied();
    });

    it('does not authorize a spell the action does not grant', () => {
      stubRuntime({ "_Paladin's_Smite_freeCastCount": 1 });
      renderPopup(makeSpell({ name: 'Fireball', level: 3 }), smiteStats());
      expectFreeCastDenied();
    });

    it('falls back to the entry uses value when no runtime counter exists', () => {
      renderPopup(
        makeSpell({ name: 'Divine Smite' }),
        makeStats({
          automation: {
            actions: [{ name: "Paladin's Smite", type: 'free_spell', spell: 'Divine Smite', uses: 1, recharge: 'long_rest' }],
          },
        })
      );
      expectFreeCastGranted();
    });

    it('does not authorize when the uses fallback is exhausted (0)', () => {
      renderPopup(
        makeSpell({ name: 'Divine Smite' }),
        makeStats({
          automation: {
            actions: [{ name: "Paladin's Smite", type: 'free_spell', spell: 'Divine Smite', uses: 0, recharge: 'long_rest' }],
          },
        })
      );
      expectFreeCastDenied();
    });
  });

  describe('Level-gated free_spell actions (Mystic Arcanum)', () => {
    const arcanumStats = () => makeStats({
      automation: {
        actions: [{
          name: 'Mystic Arcanum',
          type: 'free_spell',
          spell: 'level 8 spell',
          uses_expression: '1/long rest',
          usesMax: 1,
        }],
      },
    });

    it('authorizes at the feature\'s fixed spell level while the counter remains', () => {
      stubRuntime({ '_Mystic_Arcanum_freeCastCount': 1 });
      renderPopup(makeSpell({ name: 'Incendiary Cloud', level: 8, school: 'Evocation' }), arcanumStats());
      expectFreeCastGranted();
    });

    it('does not authorize a spell below the feature\'s fixed spell level', () => {
      stubRuntime({ '_Mystic_Arcanum_freeCastCount': 1 });
      renderPopup(makeSpell({ name: 'Power Word Stun', level: 7, school: 'Enchantment' }), arcanumStats());
      expectFreeCastDenied();
    });
  });

  describe('Fey Reinforcements / Dragon Companion', () => {
    it('authorizes the Fey Reinforcements spell by name', () => {
      stubRuntime({ '_Fey_Reinforcements_freeCast': ["Hunter's Mark"] });
      renderPopup(
        makeSpell({ name: "Hunter's Mark", school: 'Conjuration' }),
        makeStats({ automation: { actions: [{ name: 'Fey Reinforcements', type: 'fey_reinforcements', spell: "Hunter's Mark" }] } })
      );
      expectFreeCastGranted();
    });

    it('authorizes the Dragon Companion spell by name', () => {
      stubRuntime({ '_Dragon_Companion_freeCast': ['Dragon Breath'] });
      renderPopup(
        makeSpell({ name: 'Dragon Breath' }),
        makeStats({ automation: { actions: [{ name: 'Dragon Companion', type: 'dragon_companion', spell: 'Dragon Breath' }] } })
      );
      expectFreeCastGranted();
    });
  });

  describe('Mantle of Majesty bonusActions', () => {
    it('authorizes a spell sitting in the shared free-cast array', () => {
      stubRuntime({ '_Mantle_of_Majesty_freeCast': ['Command'] });
      renderPopup(
        makeSpell({ name: 'Command', school: 'Enchantment' }),
        makeStats({ automation: { bonusActions: [{ name: 'Mantle of Majesty', type: 'free_spell', spell: 'Command' }] } })
      );
      expectFreeCastGranted();
    });

    it('authorizes via the uses/recharge counter lane while uses remain', () => {
      stubRuntime({ '_Test_Feature_freeCastCount': 2 });
      renderPopup(
        makeSpell({ name: 'Test Spell' }),
        makeStats({ automation: { bonusActions: [{ name: 'Test Feature', type: 'free_spell', spell: 'Test Spell', uses: 2, recharge: 'long_rest' }] } })
      );
      expectFreeCastGranted();
    });

    it('does not authorize when the bonusActions counter is spent (0)', () => {
      stubRuntime({ '_Test_Feature_freeCastCount': 0 });
      renderPopup(
        makeSpell({ name: 'Test Spell' }),
        makeStats({ automation: { bonusActions: [{ name: 'Test Feature', type: 'free_spell', spell: 'Test Spell', uses: 2, recharge: 'long_rest' }] } })
      );
      expectFreeCastDenied();
    });

    it('does not authorize a spell the bonusActions entry does not grant', () => {
      stubRuntime({ '_Test_Feature_freeCastCount': 2 });
      renderPopup(
        makeSpell({ name: 'Fireball', level: 3 }),
        makeStats({ automation: { bonusActions: [{ name: 'Test Feature', type: 'free_spell', spell: 'Test Spell', uses: 2, recharge: 'long_rest' }] } })
      );
      expectFreeCastDenied();
    });
  });

  describe('Mantle of Majesty active buff', () => {
    it('authorizes Command while Mantle of Majesty is an active buff', () => {
      stubRuntime({ activeBuffs: [{ name: 'Mantle of Majesty' }] });
      renderPopup(makeSpell({ name: 'Command', school: 'Enchantment' }));
      expectFreeCastGranted();
    });

    it('does not authorize Command when Mantle of Majesty is not active', () => {
      renderPopup(makeSpell({ name: 'Command', school: 'Enchantment' }));
      expectFreeCastDenied();
    });

    it('does not authorize other spells while Mantle of Majesty is active', () => {
      stubRuntime({ activeBuffs: [{ name: 'Mantle of Majesty' }] });
      renderPopup(makeSpell({ name: 'Fireball', level: 3 }));
      expectFreeCastDenied();
    });
  });

  describe('Cast payload integrity', () => {
    it('carries freeCastAuthorized:true on cast and never touches runtime state from the popup', () => {
      stubRuntime({ naturalRecoveryFreeCast: ['Healing Word'] });
      const onCast = renderPopup(makeSpell({ name: 'Healing Word' }));

      fireEvent.click(screen.getByRole('button', { name: /Cast Spell/ }));

      expect(onCast).toHaveBeenCalledTimes(1);
      const payload = onCast.mock.calls[0][0];
      expect(payload.name).toBe('Healing Word');
      expect(payload.freeCastAuthorized).toBe(true);
      expect(payload.isUpcast).toBe(false);
      // The popup only authorizes and reports — payment/consumption happens
      // downstream in prepareSpellCast, never fabricated here.
      expect(setRuntimeValue).not.toHaveBeenCalled();
    });
  });
});
