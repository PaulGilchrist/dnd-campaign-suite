// @cleaned-by-ai
// @improved-by-ai
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

// ── Helpers ──────────────────────────────────────────────────────────────────

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestWizard',
    spellAbilities: {
      spell_slots_level_1: 4,
      spell_slots_level_2: 3,
      spell_slots_level_3: 2,
    },
    ...overrides,
  };
}

function makeUpcastableSpell(overrides = {}) {
  return {
    name: 'Magic Missile',
    level: 1,
    damage: {
      damage_at_slot_level: {
        1: '3d4+3',
        3: '5d4+3',
        5: '7d4+3',
      },
    },
    ...overrides,
  };
}

function makeCantripWithCharDmg(overrides = {}) {
  return {
    name: 'Eldritch Blast',
    level: 0,
    damage: {
      damage_at_character_level: {
        1: '1d10',
        5: '2d10',
        10: '3d10',
      },
    },
    ...overrides,
  };
}

function makeCantripWithSlotDmg(overrides = {}) {
  return {
    name: 'Fire Bolt',
    level: 0,
    damage: {
      damage_at_slot_level: {
        1: '1d8',
        2: '2d8',
        3: '3d8',
      },
    },
    ...overrides,
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('useSpellUpcastFlow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── isUpcastable ───────────────────────────────────────────────────────

  describe('isUpcastable', () => {
    it('returns true for a spell with multiple slot damage levels', () => {
      const { result } = renderHook(() =>
        useSpellUpcastFlow(makePlayerStats(), 'TestCampaign')
      );
      expect(result.current.isUpcastable(makeUpcastableSpell())).toBe(true);
    });

    it('returns true for a healing spell with multiple heal_at_slot_level entries', () => {
      const { result } = renderHook(() =>
        useSpellUpcastFlow(makePlayerStats(), 'TestCampaign')
      );
      const spell = {
        name: 'Cure Wounds',
        level: 1,
        heal_at_slot_level: {
          1: '1d8 + MOD',
          2: '2d8 + MOD',
          3: '3d8 + MOD',
        },
      };
      expect(result.current.isUpcastable(spell)).toBe(true);
    });

    it('returns false for a cantrip regardless of damage type', () => {
      const { result } = renderHook(() =>
        useSpellUpcastFlow(makePlayerStats(), 'TestCampaign')
      );
      expect(result.current.isUpcastable(makeCantripWithCharDmg())).toBe(false);
      expect(result.current.isUpcastable(makeCantripWithSlotDmg())).toBe(false);
    });

    it('returns false for a spell with only one slot damage level', () => {
      const { result } = renderHook(() =>
        useSpellUpcastFlow(makePlayerStats(), 'TestCampaign')
      );
      const spell = {
        name: 'Single Level Spell',
        level: 2,
        damage: { damage_at_slot_level: { 2: '2d6' } },
      };
      expect(result.current.isUpcastable(spell)).toBe(false);
    });

    it('returns false for a spell with no damage object', () => {
      const { result } = renderHook(() =>
        useSpellUpcastFlow(makePlayerStats(), 'TestCampaign')
      );
      expect(result.current.isUpcastable({ name: 'Simple Spell', level: 1 })).toBe(false);
    });

    it('returns false for null or undefined spell', () => {
      const { result } = renderHook(() =>
        useSpellUpcastFlow(makePlayerStats(), 'TestCampaign')
      );
      expect(result.current.isUpcastable(null)).toBe(false);
      expect(result.current.isUpcastable(undefined)).toBe(false);
    });
  });

  // ── buildUpcastLevels ──────────────────────────────────────────────────

  describe('buildUpcastLevels', () => {
    it('returns sorted levels with formula and availableSlots for damage spells', () => {
      const { result } = renderHook(() =>
        useSpellUpcastFlow(makePlayerStats(), 'TestCampaign')
      );
      const levels = result.current.buildUpcastLevels(makeUpcastableSpell());
      expect(levels).toHaveLength(3);
      expect(levels).toEqual(
        expect.arrayContaining([
          { level: 1, formula: '3d4+3', availableSlots: 4 },
          { level: 3, formula: '5d4+3', availableSlots: 2 },
          { level: 5, formula: '7d4+3', availableSlots: 0 },
        ])
      );
      expect(levels[0].level).toBeLessThan(levels[1].level);
      expect(levels[1].level).toBeLessThan(levels[2].level);
    });

    it('returns sorted levels with formula for healing spells', () => {
      const { result } = renderHook(() =>
        useSpellUpcastFlow(makePlayerStats(), 'TestCampaign')
      );
      const spell = {
        name: 'Cure Wounds',
        level: 1,
        heal_at_slot_level: {
          1: '1d8 + MOD',
          2: '2d8 + MOD',
          5: '5d8 + MOD',
        },
      };
      const levels = result.current.buildUpcastLevels(spell);
      expect(levels).toHaveLength(3);
      expect(levels[0].formula).toBe('1d8 + MOD');
      expect(levels[1].formula).toBe('2d8 + MOD');
      expect(levels[2].formula).toBe('5d8 + MOD');
      expect(levels[0].level).toBeLessThan(levels[1].level);
    });

    it('uses runtime slot values when available', () => {
      mockGetRuntimeValue.mockImplementation((_name, key) => {
        if (key === 'spell_slots_level_1') return 2;
        if (key === 'spell_slots_level_2') return 1;
        if (key === 'spell_slots_level_3') return 3;
        return null;
      });
      const { result } = renderHook(() =>
        useSpellUpcastFlow(makePlayerStats(), 'TestCampaign')
      );
      const spell = {
        name: 'Healing Word',
        level: 1,
        heal_at_slot_level: {
          1: '2d4 + MOD',
          2: '3d4 + MOD',
          3: '4d4 + MOD',
        },
      };
      const levels = result.current.buildUpcastLevels(spell);
      expect(levels[0].availableSlots).toBe(2);
      expect(levels[1].availableSlots).toBe(1);
      expect(levels[2].availableSlots).toBe(3);
    });

    it('prioritizes damage over healing when both exist', () => {
      const { result } = renderHook(() =>
        useSpellUpcastFlow(makePlayerStats(), 'TestCampaign')
      );
      const spell = {
        name: 'Vampiric Touch',
        level: 2,
        damage: { damage_at_slot_level: { 2: '2d6', 3: '3d6' } },
        heal_at_slot_level: { 2: '2d6 + MOD', 3: '3d6 + MOD' },
      };
      const levels = result.current.buildUpcastLevels(spell);
      expect(levels[0].formula).toBe('2d6');
    });

    it('applies Hunter\'s Mark Foe Slayer replacement at level 20', () => {
      const { result } = renderHook(() =>
        useSpellUpcastFlow(makePlayerStats({
          class: { name: 'Ranger' },
          level: 20,
        }), 'TestCampaign')
      );
      const spell = {
        name: "Hunter's Mark",
        level: 1,
        damage: { damage_at_slot_level: { 1: '1d6', 3: '1d6', 5: '1d6' } },
      };
      const levels = result.current.buildUpcastLevels(spell);
      expect(levels[0].formula).toBe('1d10');
      expect(levels[1].formula).toBe('1d10');
      expect(levels[2].formula).toBe('1d10');
    });

    it('returns empty array when spell has no damage object', () => {
      const { result } = renderHook(() =>
        useSpellUpcastFlow(makePlayerStats(), 'TestCampaign')
      );
      expect(result.current.buildUpcastLevels({ name: 'Empty', level: 1 })).toEqual([]);
    });

    it('falls back to healing when damage_at_slot_level is empty', () => {
      const { result } = renderHook(() =>
        useSpellUpcastFlow(makePlayerStats(), 'TestCampaign')
      );
      const spell = {
        name: 'Cure Wounds',
        level: 1,
        damage: { damage_at_slot_level: {} },
        heal_at_slot_level: { 1: '1d8 + MOD', 2: '2d8 + MOD' },
      };
      const levels = result.current.buildUpcastLevels(spell);
      expect(levels).toHaveLength(2);
      expect(levels[0].formula).toBe('1d8 + MOD');
    });

    it('returns 0 availableSlots when level not in spellAbilities', () => {
      const { result } = renderHook(() =>
        useSpellUpcastFlow(makePlayerStats({
          spellAbilities: { spell_slots_level_1: 4 },
        }), 'TestCampaign')
      );
      const levels = result.current.buildUpcastLevels(makeUpcastableSpell());
      const level5Entry = levels.find(l => l.level === 5);
      expect(level5Entry.availableSlots).toBe(0);
    });
  });

  // ── gateUpcast ─────────────────────────────────────────────────────────

  describe('gateUpcast', () => {
    it('sets pendingUpcast and returns true for an upcastable spell', () => {
      const { result } = renderHook(() =>
        useSpellUpcastFlow(makePlayerStats(), 'TestCampaign')
      );
      const spell = makeUpcastableSpell();
      const afterUpcast = vi.fn();

      let retVal;
      act(() => { retVal = result.current.gateUpcast(spell, afterUpcast); });

      expect(retVal).toBe(true);
      expect(result.current.pendingUpcast).not.toBeNull();
      expect(result.current.pendingUpcast.spell).toBe(spell);
      expect(result.current.pendingUpcast.afterUpcast).toBe(afterUpcast);
      expect(result.current.pendingUpcast.deductSlot).toBe(true);
    });

    it('returns false and does not set pendingUpcast for a non-upcastable spell', () => {
      const { result } = renderHook(() =>
        useSpellUpcastFlow(makePlayerStats(), 'TestCampaign')
      );
      const spell = { name: 'Fireball', level: 3 };
      const afterUpcast = vi.fn();

      let retVal;
      act(() => { retVal = result.current.gateUpcast(spell, afterUpcast); });

      expect(retVal).toBe(false);
      expect(result.current.pendingUpcast).toBeNull();
      expect(afterUpcast).not.toHaveBeenCalled();
    });

    it('respects deductSlot = false', () => {
      const { result } = renderHook(() =>
        useSpellUpcastFlow(makePlayerStats(), 'TestCampaign')
      );
      const spell = makeUpcastableSpell();
      const afterUpcast = vi.fn();

      act(() => { result.current.gateUpcast(spell, afterUpcast, false); });
      expect(result.current.pendingUpcast.deductSlot).toBe(false);
    });

    it('returns false for null or undefined spell', () => {
      const { result } = renderHook(() =>
        useSpellUpcastFlow(makePlayerStats(), 'TestCampaign')
      );
      const afterUpcast = vi.fn();
      act(() => { expect(result.current.gateUpcast(null, afterUpcast)).toBe(false); });
      act(() => { expect(result.current.gateUpcast(undefined, afterUpcast)).toBe(false); });
    });
  });

  // ── handleUpcastConfirm ────────────────────────────────────────────────

  describe('handleUpcastConfirm', () => {
    it('deducts a spell slot and calls afterUpcast when slots are available', () => {
      mockGetRuntimeValue.mockImplementation((_name, key) => {
        if (key === 'spell_slots_level_3') return 3;
        return null;
      });
      const { result } = renderHook(() =>
        useSpellUpcastFlow(makePlayerStats(), 'TestCampaign')
      );
      const spell = makeUpcastableSpell();
      const afterUpcast = vi.fn();

      act(() => { result.current.gateUpcast(spell, afterUpcast); });
      act(() => { result.current.handleUpcastConfirm(3); });

      expect(mockSetRuntimeValue).toHaveBeenCalledWith(
        'TestWizard', 'spell_slots_level_3', 2, 'TestCampaign'
      );
      expect(afterUpcast).toHaveBeenCalledWith({ ...spell, level: 3 });
      expect(result.current.pendingUpcast).toBeNull();
    });

    it('skips slot deduction when deductSlot is false', () => {
      mockGetRuntimeValue.mockImplementation((_name, key) => {
        if (key === 'spell_slots_level_3') return 3;
        return null;
      });
      const { result } = renderHook(() =>
        useSpellUpcastFlow(makePlayerStats(), 'TestCampaign')
      );
      const spell = makeUpcastableSpell();
      const afterUpcast = vi.fn();

      act(() => { result.current.gateUpcast(spell, afterUpcast, false); });
      act(() => { result.current.handleUpcastConfirm(3); });

      expect(mockSetRuntimeValue).not.toHaveBeenCalled();
      expect(afterUpcast).toHaveBeenCalled();
    });

    it('skips slot deduction when no slots available but still calls afterUpcast', () => {
      mockGetRuntimeValue.mockImplementation((_name, key) => {
        if (key === 'spell_slots_level_3') return 0;
        return null;
      });
      const { result } = renderHook(() =>
        useSpellUpcastFlow(makePlayerStats(), 'TestCampaign')
      );
      const spell = makeUpcastableSpell();
      const afterUpcast = vi.fn();

      act(() => { result.current.gateUpcast(spell, afterUpcast); });
      act(() => { result.current.handleUpcastConfirm(3); });

      expect(mockSetRuntimeValue).not.toHaveBeenCalled();
      expect(afterUpcast).toHaveBeenCalledWith({ ...spell, level: 3 });
    });

    it('is a no-op when there is no pending upcast', () => {
      const { result } = renderHook(() =>
        useSpellUpcastFlow(makePlayerStats(), 'TestCampaign')
      );
      act(() => { result.current.handleUpcastConfirm(3); });
      expect(mockSetRuntimeValue).not.toHaveBeenCalled();
    });
  });

  // ── handleUpcastCancel ─────────────────────────────────────────────────

  describe('handleUpcastCancel', () => {
    it('clears pendingUpcast', () => {
      const { result } = renderHook(() =>
        useSpellUpcastFlow(makePlayerStats(), 'TestCampaign')
      );
      const spell = makeUpcastableSpell();
      const afterUpcast = vi.fn();

      act(() => { result.current.gateUpcast(spell, afterUpcast); });
      expect(result.current.pendingUpcast).not.toBeNull();

      act(() => { result.current.handleUpcastCancel(); });
      expect(result.current.pendingUpcast).toBeNull();
    });
  });

  // ── getCantripAutoLevel ────────────────────────────────────────────────

  describe('getCantripAutoLevel', () => {
    it('returns the highest applicable character level from damage_at_character_level', () => {
      const { result } = renderHook(() =>
        useSpellUpcastFlow(makePlayerStats(), 'TestCampaign')
      );
      const spell = makeCantripWithCharDmg();
      expect(result.current.getCantripAutoLevel(spell, 0)).toBeNull();
      expect(result.current.getCantripAutoLevel(spell, 1)).toBe(1);
      expect(result.current.getCantripAutoLevel(spell, 5)).toBe(5);
      expect(result.current.getCantripAutoLevel(spell, 7)).toBe(5);
      expect(result.current.getCantripAutoLevel(spell, 15)).toBe(10);
    });

    it('falls back to damage_at_slot_level when no damage_at_character_level', () => {
      const { result } = renderHook(() =>
        useSpellUpcastFlow(makePlayerStats(), 'TestCampaign')
      );
      const spell = makeCantripWithSlotDmg();
      expect(result.current.getCantripAutoLevel(spell, 0)).toBeNull();
      expect(result.current.getCantripAutoLevel(spell, 2)).toBe(2);
      expect(result.current.getCantripAutoLevel(spell, 3)).toBe(3);
    });

    it('prefers damage_at_character_level over damage_at_slot_level', () => {
      const { result } = renderHook(() =>
        useSpellUpcastFlow(makePlayerStats(), 'TestCampaign')
      );
      const spell = {
        name: 'Both',
        level: 0,
        damage: {
          damage_at_character_level: { 1: '1d10', 5: '2d10' },
          damage_at_slot_level: { 1: '1d8', 3: '2d8' },
        },
      };
      expect(result.current.getCantripAutoLevel(spell, 3)).toBe(1);
    });

    it('returns null when spell has no damage property or empty damage objects', () => {
      const { result } = renderHook(() =>
        useSpellUpcastFlow(makePlayerStats(), 'TestCampaign')
      );
      expect(result.current.getCantripAutoLevel({ name: 'No Damage', level: 0 }, 5)).toBeNull();
      expect(result.current.getCantripAutoLevel({
        name: 'Empty',
        level: 0,
        damage: { damage_at_character_level: {}, damage_at_slot_level: {} },
      }, 5)).toBeNull();
    });
  });

  // ── Integration tests ──────────────────────────────────────────────────

  describe('full upcast flow', () => {
    it('completes the full gate -> confirm flow with slot deduction', () => {
      mockGetRuntimeValue.mockImplementation((_name, key) => {
        if (key === 'spell_slots_level_3') return 2;
        return null;
      });
      const { result } = renderHook(() =>
        useSpellUpcastFlow(makePlayerStats(), 'TestCampaign')
      );
      const spell = makeUpcastableSpell();
      const afterUpcast = vi.fn();

      let gateResult;
      act(() => { gateResult = result.current.gateUpcast(spell, afterUpcast); });
      expect(gateResult).toBe(true);

      act(() => { result.current.handleUpcastConfirm(3); });

      expect(mockSetRuntimeValue).toHaveBeenCalledWith(
        'TestWizard', 'spell_slots_level_3', 1, 'TestCampaign'
      );
      expect(afterUpcast).toHaveBeenCalledWith({ ...spell, level: 3 });
      expect(result.current.pendingUpcast).toBeNull();
    });

    it('completes the full gate -> cancel flow', () => {
      const { result } = renderHook(() =>
        useSpellUpcastFlow(makePlayerStats(), 'TestCampaign')
      );
      const spell = makeUpcastableSpell();
      const afterUpcast = vi.fn();

      act(() => { result.current.gateUpcast(spell, afterUpcast); });
      act(() => { result.current.handleUpcastCancel(); });

      expect(result.current.pendingUpcast).toBeNull();
      expect(afterUpcast).not.toHaveBeenCalled();
      expect(mockSetRuntimeValue).not.toHaveBeenCalled();
    });

    it('rejects non-upcastable spell at the gate', () => {
      const { result } = renderHook(() =>
        useSpellUpcastFlow(makePlayerStats(), 'TestCampaign')
      );
      const spell = { name: 'Fireball', level: 3 };
      const afterUpcast = vi.fn();

      let gateResult;
      act(() => { gateResult = result.current.gateUpcast(spell, afterUpcast); });

      expect(gateResult).toBe(false);
      expect(result.current.pendingUpcast).toBeNull();
      expect(afterUpcast).not.toHaveBeenCalled();
    });
  });
});
