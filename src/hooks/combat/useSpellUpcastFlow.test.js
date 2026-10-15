// @maintained-by-ai: 2026-10-15
// Canonical lane for the useSpellUpcastFlow upcast-choice hook seam: the slot-level
// picker state machine (gateUpcast arms pendingUpcast, handleUpcastConfirm pays the
// slot via runtime store + hands the level-stamped spell to afterUpcast, cancel rolls
// back without paying) plus ladder building for damage / heal / upcast_at_slot_level /
// summon-HP rows and cantrip auto-level resolution. Consumed live by CharSpells.jsx
// (picker) and CharActions/CharBonusActions/CharReactions (buildUpcastLevels).
// NOT covered here (sibling lanes): CLA-050 fixed-level clamp (cla050 file), metamagic
// gate maxTargets parsing (useSpellMetamagicFlow.upcast), Magic Missile darts (sp075),
// heal-slot seam (cla086), Aid ladder (sp127). Fixtures mirror real spells.json rows:
// Burning Hands 3d6→11d6, Cure Wounds/Healing Word "{n}d{die} + MOD", 2024 Hunter's
// Mark 1d6 ladder (Foe Slayer d6→d10 at Ranger 20), Eldritch Blast 1/5/11/17 tiers,
// Bestial Spirit +5 HP per slot above 2.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSpellUpcastFlow } from './useSpellUpcastFlow.js';

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockGetRuntimeValue = vi.fn(() => null);
const mockSetRuntimeValue = vi.fn();

vi.mock('../runtime/useRuntimeState.js', () => ({
  getRuntimeValue: (...args) => mockGetRuntimeValue(...args),
  setRuntimeValue: (...args) => mockSetRuntimeValue(...args),
}));

// ── Fixtures (mirrors of real spells.json rows) ────────────────────────────

const makePlayerStats = (overrides = {}) => ({
  name: 'TestWizard',
  spellAbilities: {
    spell_slots_level_1: 4,
    spell_slots_level_2: 3,
    spell_slots_level_3: 2,
  },
  ...overrides,
});

// 5e spells.json: 3d6 +1d6 per slot level, 1..9.
const BURNING_HANDS = {
  name: 'Burning Hands',
  level: 1,
  damage: {
    damage_type: 'Fire',
    damage_at_slot_level: {
      1: '3d6', 2: '4d6', 3: '5d6', 4: '6d6', 5: '7d6',
      6: '8d6', 7: '9d6', 8: '10d6', 9: '11d6',
    },
  },
};

// 5e spells.json heal ladder (3-rung prefix keeps rows readable).
const CURE_WOUNDS = {
  name: 'Cure Wounds',
  level: 1,
  heal_at_slot_level: { 1: '1d8 + MOD', 2: '2d8 + MOD', 3: '3d8 + MOD' },
};

// 2024-style targets ladder (mirrors Charm Monster / Animal Friendship rows).
const TARGETS_LADDER_SPELL = {
  name: 'Charm Monster',
  level: 4,
  upcast_at_slot_level: { 4: '1 target', 5: '2 targets', 6: '3 targets' },
};

// spells.json: cantrip scales at character levels 1/5/11/17.
const ELDRITCH_BLAST = {
  name: 'Eldritch Blast',
  level: 0,
  damage: {
    damage_type: 'Force',
    damage_at_character_level: { 1: '1d10', 5: '2d10', 11: '3d10', 17: '4d10' },
  },
};

// Cantrips only carry slot ladders via homebrew/feature transforms
// (cf. warMagicCantripHandler stamped rows) — defensive fallback branch.
const SLOT_LADDER_CANTRIP = {
  name: 'Stamped Cantrip',
  level: 0,
  damage: { damage_at_slot_level: { 1: '1d8', 2: '2d8' } },
};

// 2024 spells.json Hunter's Mark: flat 1d6 Force 1..9 (upcast extends
// concentration, but the picker row exists for the Foe Slayer replacement).
const HUNTERS_MARK_2024 = {
  name: "Hunter's Mark",
  level: 1,
  damage: {
    damage_type: 'Force',
    damage_at_slot_level: {
      1: '1d6', 2: '1d6', 3: '1d6', 4: '1d6', 5: '1d6',
      6: '1d6', 7: '1d6', 8: '1d6', 9: '1d6',
    },
  },
};

// 2024 spells.json summon_spirit row (SP-015 HP ladder).
const BESTIAL_SPIRIT = {
  name: 'Bestial Spirit',
  level: 2,
  automation: {
    type: 'summon_spirit',
    typeLabel: 'Bestial Spirit',
    baseLevel: 2,
    hpPerLevelAbove: 5,
    variants: [],
  },
};

// scale:false summon blocks (Animate Objects, Giant Insect) stay inert.
const ANIMATE_OBJECTS = {
  name: 'Animate Objects',
  level: 5,
  automation: { type: 'summon_spirit', typeLabel: 'Animated Object', scale: false, variants: [] },
};

// ── Helpers ──────────────────────────────────────────────────────────────────

// runtimeSlots: { [level]: number } overrides layered over playerStats caps;
// unlisted levels fall through to the stats value (hook: runtime ?? max).
function renderFlow(stats = makePlayerStats(), runtimeSlots = {}) {
  mockGetRuntimeValue.mockImplementation((_name, key) => {
    const m = /^spell_slots_level_(\d+)$/.exec(key || '');
    return m && runtimeSlots[m[1]] != null ? runtimeSlots[m[1]] : null;
  });
  return renderHook(() => useSpellUpcastFlow(stats, 'TestCampaign'));
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('useSpellUpcastFlow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── isUpcastable ───────────────────────────────────────────────────────

  describe('isUpcastable', () => {
    it.each([
      ['multi-rung damage ladder', BURNING_HANDS, true],
      ['multi-rung heal ladder', CURE_WOUNDS, true],
      ['multi-rung upcast_at_slot_level ladder', TARGETS_LADDER_SPELL, true],
      ['cantrip with character-level ladder', ELDRITCH_BLAST, false],
      ['cantrip with slot ladder', SLOT_LADDER_CANTRIP, false],
      ['single-rung spell', { name: 'Single', level: 2, damage: { damage_at_slot_level: { 2: '2d6' } } }, false],
      ['spell with no damage data', { name: 'Shield', level: 1 }, false],
      ['null spell', null, false],
    ])('%s → %s', (_label, spell, expected) => {
      const { result } = renderFlow();
      expect(result.current.isUpcastable(spell)).toBe(expected);
    });
  });

  // ── buildUpcastLevels ──────────────────────────────────────────────────

  describe('buildUpcastLevels', () => {
    it('builds the full sorted damage ladder with formulas and slot counts (0 where no slots)', () => {
      const { result } = renderFlow();
      expect(result.current.buildUpcastLevels(BURNING_HANDS)).toEqual([
        { level: 1, formula: '3d6', availableSlots: 4 },
        { level: 2, formula: '4d6', availableSlots: 3 },
        { level: 3, formula: '5d6', availableSlots: 2 },
        { level: 4, formula: '6d6', availableSlots: 0 },
        { level: 5, formula: '7d6', availableSlots: 0 },
        { level: 6, formula: '8d6', availableSlots: 0 },
        { level: 7, formula: '9d6', availableSlots: 0 },
        { level: 8, formula: '10d6', availableSlots: 0 },
        { level: 9, formula: '11d6', availableSlots: 0 },
      ]);
    });

    it.each([
      ['heal ladder uses heal_at_slot_level',
        CURE_WOUNDS,
        [{ level: 1, formula: '1d8 + MOD' }, { level: 2, formula: '2d8 + MOD' }, { level: 3, formula: '3d8 + MOD' }]],
      ['damage ladder wins when both damage and heal ladders exist',
        { name: 'Vampiric Touch', level: 3, damage: { damage_at_slot_level: { 3: '3d6', 4: '4d6' } }, heal_at_slot_level: { 3: '3d6 + MOD', 4: '4d6 + MOD' } },
        [{ level: 3, formula: '3d6' }, { level: 4, formula: '4d6' }]],
      ['empty damage ladder falls back to heal ladder',
        { name: 'Cure Wounds', level: 1, damage: { damage_at_slot_level: {} }, heal_at_slot_level: { 1: '1d8 + MOD', 2: '2d8 + MOD' } },
        [{ level: 1, formula: '1d8 + MOD' }, { level: 2, formula: '2d8 + MOD' }]],
      ['falls back to upcast_at_slot_level when damage and heal are absent',
        TARGETS_LADDER_SPELL,
        [{ level: 4, formula: '1 target' }, { level: 5, formula: '2 targets' }, { level: 6, formula: '3 targets' }]],
      ['spell with no ladder data builds nothing',
        { name: 'Shield', level: 1 },
        []],
    ])('%s', (_label, spell, expectedRows) => {
      const { result } = renderFlow();
      const levels = result.current.buildUpcastLevels(spell);
      expect(levels).toHaveLength(expectedRows.length);
      expectedRows.forEach((row, i) => expect(levels[i]).toMatchObject(row));
    });

    it('prefers runtime slot counts over class caps', () => {
      const { result } = renderFlow(makePlayerStats(), { 1: 2, 2: 1, 3: 3 });
      const levels = result.current.buildUpcastLevels(CURE_WOUNDS);
      expect(levels.map(l => l.availableSlots)).toEqual([2, 1, 3]);
    });

    it.each([
      ['Ranger lv20', { class: { name: 'Ranger' }, level: 20 }, '1d10'],
      ['Ranger lv19', { class: { name: 'Ranger' }, level: 19 }, '1d6'],
      ['non-Ranger lv20', { class: { name: 'Wizard' }, level: 20 }, '1d6'],
    ])('Foe Slayer swaps Hunter\'s Mark d6→d10 for %s', (_label, statsOverride, expectedDie) => {
      const { result } = renderFlow(makePlayerStats(statsOverride));
      const levels = result.current.buildUpcastLevels(HUNTERS_MARK_2024);
      expect(levels).toHaveLength(9);
      levels.forEach(l => expect(l.formula).toBe(expectedDie));
    });

    it('builds the SP-015 summon_spirit HP ladder from baseLevel to 9', () => {
      const { result } = renderFlow();
      const levels = result.current.buildUpcastLevels(BESTIAL_SPIRIT);
      expect(levels.map(l => l.level)).toEqual([2, 3, 4, 5, 6, 7, 8, 9]);
      expect(levels[0].formula).toBe('+5 HP per slot level above 2');
      expect(levels[0].availableSlots).toBe(3);
      expect(levels[1].availableSlots).toBe(2);
    });

    it.each([
      ['scale:false (Animate Objects)', ANIMATE_OBJECTS],
      ['summon without hpPerLevelAbove', { name: 'Summon Beast', level: 2, automation: { type: 'summon_spirit', baseLevel: 2, variants: [] } }],
    ])('leaves summon %s inert (no ladder)', (_label, spell) => {
      const { result } = renderFlow();
      expect(result.current.buildUpcastLevels(spell)).toEqual([]);
    });
  });

  // ── picker state machine: gate → confirm (pay) / cancel (rollback) ─────

  describe('gateUpcast', () => {
    it('arms pendingUpcast with the spell, callback, and deductSlot=true by default', () => {
      const { result } = renderFlow();
      const afterUpcast = vi.fn();

      let retVal;
      act(() => { retVal = result.current.gateUpcast(BURNING_HANDS, afterUpcast); });

      expect(retVal).toBe(true);
      expect(result.current.pendingUpcast).toMatchObject({
        spell: BURNING_HANDS,
        afterUpcast,
        deductSlot: true,
      });
    });

    it.each([
      ['non-upcastable spell', { name: 'Shield', level: 1 }],
      ['null spell', null],
    ])('does not arm for %s', (_label, spell) => {
      const { result } = renderFlow();
      const afterUpcast = vi.fn();

      let retVal;
      act(() => { retVal = result.current.gateUpcast(spell, afterUpcast); });

      expect(retVal).toBe(false);
      expect(result.current.pendingUpcast).toBeNull();
      expect(afterUpcast).not.toHaveBeenCalled();
    });

    it('honours deductSlot=false on the armed pending', () => {
      const { result } = renderFlow();
      act(() => { result.current.gateUpcast(BURNING_HANDS, vi.fn(), false); });
      expect(result.current.pendingUpcast.deductSlot).toBe(false);
    });
  });

  describe('handleUpcastConfirm', () => {
    it('pays the slot via the runtime store, casts level-stamped, clears pending', () => {
      const { result } = renderFlow(makePlayerStats(), { 3: 3 });
      const afterUpcast = vi.fn();

      act(() => { result.current.gateUpcast(BURNING_HANDS, afterUpcast); });
      act(() => { result.current.handleUpcastConfirm(3); });

      expect(mockSetRuntimeValue).toHaveBeenCalledWith('TestWizard', 'spell_slots_level_3', 2, 'TestCampaign');
      expect(afterUpcast).toHaveBeenCalledWith(expect.objectContaining({ name: 'Burning Hands', level: 3 }));
      expect(result.current.pendingUpcast).toBeNull();
    });

    it.each([
      ['deductSlot=false', { deductSlot: false }, {}, 'never'],
      ['zero slots available', { deductSlot: true }, { 3: 0 }, 'never'],
    ])('still casts but pays %s', (_label, { deductSlot }, runtimeSlots, _expectation) => {
      const { result } = renderFlow(makePlayerStats(), runtimeSlots);
      const afterUpcast = vi.fn();

      act(() => { result.current.gateUpcast(BURNING_HANDS, afterUpcast, deductSlot); });
      act(() => { result.current.handleUpcastConfirm(3); });

      expect(mockSetRuntimeValue).not.toHaveBeenCalled();
      expect(afterUpcast).toHaveBeenCalledWith(expect.objectContaining({ level: 3 }));
    });

    it('is a no-op when nothing is armed', () => {
      const { result } = renderFlow();
      act(() => { result.current.handleUpcastConfirm(3); });
      expect(mockSetRuntimeValue).not.toHaveBeenCalled();
    });
  });

  describe('handleUpcastCancel', () => {
    it('clears pendingUpcast without paying or casting', () => {
      const { result } = renderFlow();
      const afterUpcast = vi.fn();

      act(() => { result.current.gateUpcast(BURNING_HANDS, afterUpcast); });
      act(() => { result.current.handleUpcastCancel(); });

      expect(result.current.pendingUpcast).toBeNull();
      expect(mockSetRuntimeValue).not.toHaveBeenCalled();
      expect(afterUpcast).not.toHaveBeenCalled();
    });
  });

  // ── getCantripAutoLevel ────────────────────────────────────────────────

  describe('getCantripAutoLevel', () => {
    it.each([
      [0, null],
      [1, 1],
      [5, 5],
      [10, 5],
      [11, 11],
      [17, 17],
      [20, 17],
    ])('Eldritch Blast at player level %i resolves to tier %s', (playerLevel, expected) => {
      const { result } = renderFlow();
      expect(result.current.getCantripAutoLevel(ELDRITCH_BLAST, playerLevel)).toBe(expected);
    });

    it('falls back to damage_at_slot_level when no character-level ladder', () => {
      const { result } = renderFlow();
      expect(result.current.getCantripAutoLevel(SLOT_LADDER_CANTRIP, 0)).toBeNull();
      expect(result.current.getCantripAutoLevel(SLOT_LADDER_CANTRIP, 2)).toBe(2);
      expect(result.current.getCantripAutoLevel(SLOT_LADDER_CANTRIP, 17)).toBe(2);
    });

    it('prefers damage_at_character_level over damage_at_slot_level', () => {
      const { result } = renderFlow();
      const spell = {
        name: 'Both Ladders',
        level: 0,
        damage: {
          damage_at_character_level: { 1: '1d10', 5: '2d10' },
          damage_at_slot_level: { 1: '1d8', 3: '2d8' },
        },
      };
      expect(result.current.getCantripAutoLevel(spell, 3)).toBe(1);
    });

    it.each([
      ['no damage property', { name: 'No Damage', level: 0 }],
      ['empty ladders', { name: 'Empty', level: 0, damage: { damage_at_character_level: {}, damage_at_slot_level: {} } }],
    ])('returns null for cantrip with %s', (_label, spell) => {
      const { result } = renderFlow();
      expect(result.current.getCantripAutoLevel(spell, 5)).toBeNull();
    });
  });
});
