// @maintained-by-ai
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import SpellDetailPopup from './SpellDetailPopup.jsx';
import { getRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
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

const CAMPAIGN = 'test-campaign';

// Per-test fixture builders — each test owns the exact data it asserts on.
const makeStats = (overrides = {}) => ({
  name: 'Elara',
  level: 5,
  class: { name: 'Sorcerer', major: { name: 'Sorcerer' } },
  abilities: [{ name: 'Charisma', bonus: 3 }],
  proficiency: 3,
  spellAbilities: { spells: [] },
  automation: { passives: [], actions: [] },
  ...overrides,
});

const makeCantrip = (overrides = {}) => ({
  name: 'Fire Bolt',
  level: 0,
  description: 'A flash of fire.',
  casting_time: '1 action',
  range: '120 feet',
  duration: 'Instantaneous',
  ...overrides,
});

// Renders the popup for a cantrip cast attempt and returns the cast handler
// plus the (possibly disabled) Cast Spell button.
const castCantrip = ({
  spell = makeCantrip(),
  playerStats = makeStats(),
  playerLevel,
  beforeClick,
} = {}) => {
  const onCast = vi.fn();
  render(
    <SpellDetailPopup
      spell={spell}
      playerStats={playerStats}
      campaignName={CAMPAIGN}
      onClose={vi.fn()}
      onCast={onCast}
      playerLevel={playerLevel}
    />
  );
  const castButton = screen.getByRole('button', { name: /Cast Spell/ });
  if (beforeClick) beforeClick();
  fireEvent.click(castButton);
  return onCast;
};

// Cantrip cast contract: exact level, baseLevel 0, and the unmodified
// meta context (cantrips never overchannel).
const expectCastAtLevel = (onCast, level) => {
  expect(onCast).toHaveBeenCalledTimes(1);
  expect(onCast).toHaveBeenCalledWith(
    expect.objectContaining({ level, baseLevel: 0 }),
    expect.objectContaining({ overchannel: false })
  );
};

describe('SpellDetailPopup - casting cantrips', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getRuntimeValue).mockReturnValue(null);
    vi.mocked(getActiveBuffs).mockReturnValue([]);
  });

  describe('auto-levels from damage ladders', () => {
    const scalingCantrip = makeCantrip({
      damage: {
        damage_at_character_level: { 1: '1d10', 5: '2d10', 11: '3d10', 17: '4d10' },
      },
    });

    it.each([
      { playerLevel: 1, expectedLevel: 1, label: 'lowest tier at level 1' },
      { playerLevel: 5, expectedLevel: 5, label: 'exact tier at level 5' },
      { playerLevel: 20, expectedLevel: 17, label: 'highest tier below level 20' },
    ])('auto-levels from damage_at_character_level: $label', ({ playerLevel, expectedLevel }) => {
      expectCastAtLevel(castCantrip({ spell: scalingCantrip, playerLevel }), expectedLevel);
    });

    it('casts at base level when the ladder starts above the character level', () => {
      const spell = makeCantrip({
        damage: { damage_at_character_level: { 5: '2d10', 11: '3d10' } },
      });
      expectCastAtLevel(castCantrip({ spell, playerLevel: 3 }), 0);
    });

    it('falls back to damage_at_slot_level when no character-level ladder exists', () => {
      const spell = makeCantrip({
        name: 'Ray of Frost',
        damage: { damage_at_slot_level: { '0': '1d8', '1': '2d8', '3': '3d8', '5': '4d8' } },
      });
      expectCastAtLevel(castCantrip({ spell, playerLevel: 5 }), 5);
    });

    it('prefers the character-level ladder when both ladders exist', () => {
      const spell = makeCantrip({
        damage: {
          damage_at_character_level: { 5: '2d10', 11: '3d10' },
          damage_at_slot_level: { '0': '1d10', '1': '2d10' },
        },
      });
      // 11 comes from the char ladder — the slot ladder tops out at 1.
      expectCastAtLevel(castCantrip({ spell, playerLevel: 12 }), 11);
    });
  });

  it.each([
    { damage: null, label: 'damage is null' },
    { damage: { damage_at_character_level: {}, damage_at_slot_level: {} }, label: 'both ladders are empty' },
  ])('casts at base level when $label', ({ damage }) => {
    const spell = makeCantrip({ name: 'Minor Illusion', damage });
    expectCastAtLevel(castCantrip({ spell, playerLevel: 5 }), 0);
  });

  describe('cantrip casting is slot-free', () => {
    it('casts at level with no slot payment when every spell slot is exhausted', () => {
      vi.mocked(getRuntimeValue).mockImplementation((_name, key) =>
        key.startsWith('spell_slots_level_') ? 0 : null
      );
      const spell = makeCantrip({
        damage: { damage_at_character_level: { 1: '1d10', 5: '2d10' } },
      });
      const stats = makeStats({
        spellAbilities: { spells: [], spell_slots_level_1: 0, spell_slots_level_2: 0 },
      });

      const onCast = castCantrip({ spell, playerStats: stats, playerLevel: 5 });
      expect(screen.getByRole('button', { name: /Cast Spell/ })).toBeEnabled();
      expectCastAtLevel(onCast, 5);
      const [passedSpell] = onCast.mock.calls[0];
      expect(passedSpell.upcastLevel).toBeUndefined();
      expect(passedSpell.freeCastAuthorized).toBeFalsy();
    });
  });

  it('blocks cantrip casting while raging', () => {
    vi.mocked(getActiveBuffs).mockReturnValue([{ name: 'Rage' }]);
    const spell = makeCantrip({
      damage: { damage_at_character_level: { 1: '1d10', 5: '2d10' } },
    });

    const onCast = castCantrip({ spell, playerLevel: 5 });
    expect(screen.getByRole('button', { name: /Cast Spell/ })).toBeDisabled();
    expect(onCast).not.toHaveBeenCalled();
  });

  describe('psychic damage opt-in travels the cantrip payload (CLA-268)', () => {
    const psychicStats = makeStats({
      name: 'Nyxis',
      class: { name: 'Warlock', major: { name: 'Warlock' } },
      automation: { passives: [{ type: 'psychic_spells' }], actions: [] },
    });
    const spell = makeCantrip({
      school: 'Evocation',
      damage: { damage_at_character_level: { 1: '1d10', 5: '2d10' } },
    });

    it.each([
      { toggleOn: true, expected: true, label: 'checked' },
      { toggleOn: false, expected: false, label: 'unchecked' },
    ])('passes usePsychicDamage:$expected when the checkbox is $label', ({ toggleOn, expected }) => {
      const onCast = castCantrip({
        spell,
        playerStats: psychicStats,
        playerLevel: 5,
        beforeClick: () => {
          if (toggleOn) {
            fireEvent.click(screen.getByRole('checkbox', { name: /Change damage type to Psychic/ }));
          }
        },
      });

      expect(onCast).toHaveBeenCalledTimes(1);
      expect(onCast).toHaveBeenCalledWith(
        expect.objectContaining({ level: 5, baseLevel: 0, usePsychicDamage: expected }),
        expect.objectContaining({ overchannel: false })
      );
    });
  });
});
