import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSpellUpcastFlow } from './useSpellUpcastFlow.js';

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockGetRuntimeValue = vi.fn(() => null);
const mockSetRuntimeValue = vi.fn();

vi.mock('./useRuntimeState.js', () => ({
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

function makeSpell(overrides = {}) {
  return {
    name: 'Fireball',
    level: 3,
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

  // ── Return value structure ─────────────────────────────────────────────

  describe('return value', () => {
    it('returns the expected set of properties', () => {
      const playerStats = makePlayerStats();
      const { result } = renderHook(() =>
        useSpellUpcastFlow(playerStats, 'TestCampaign')
      );

      expect(result.current).toHaveProperty('pendingUpcast');
      expect(result.current).toHaveProperty('isUpcastable');
      expect(result.current).toHaveProperty('buildUpcastLevels');
      expect(result.current).toHaveProperty('gateUpcast');
      expect(result.current).toHaveProperty('handleUpcastConfirm');
      expect(result.current).toHaveProperty('handleUpcastCancel');
      expect(result.current).toHaveProperty('getCantripAutoLevel');

      expect(typeof result.current.isUpcastable).toBe('function');
      expect(typeof result.current.buildUpcastLevels).toBe('function');
      expect(typeof result.current.gateUpcast).toBe('function');
      expect(typeof result.current.handleUpcastConfirm).toBe('function');
      expect(typeof result.current.handleUpcastCancel).toBe('function');
      expect(typeof result.current.getCantripAutoLevel).toBe('function');
    });

    it('initializes pendingUpcast as null', () => {
      const playerStats = makePlayerStats();
      const { result } = renderHook(() =>
        useSpellUpcastFlow(playerStats, 'TestCampaign')
      );

      expect(result.current.pendingUpcast).toBeNull();
    });
  });

  // ── getAvailableSlotCount (internal, exposed via buildUpcastLevels) ───

  describe('getAvailableSlotCount (via buildUpcastLevels)', () => {
    it('returns runtime value when available', () => {
      const playerStats = makePlayerStats();
      mockGetRuntimeValue.mockReturnValue(2);

      const { result } = renderHook(() =>
        useSpellUpcastFlow(playerStats, 'TestCampaign')
      );

      const spell = makeUpcastableSpell();
      const levels = result.current.buildUpcastLevels(spell);
      // Level 1 slot: runtime returns 2
      expect(mockGetRuntimeValue).toHaveBeenCalledWith(
        playerStats.name, 'spell_slots_level_1'
      );
      const level1Entry = levels.find(l => l.level === 1);
      expect(level1Entry.availableSlots).toBe(2);
    });

    it('falls back to playerStats.spellAbilities when runtime is null', () => {
      const playerStats = makePlayerStats();
      mockGetRuntimeValue.mockReturnValue(null);

      const { result } = renderHook(() =>
        useSpellUpcastFlow(playerStats, 'TestCampaign')
      );

      const spell = makeUpcastableSpell();
      const levels = result.current.buildUpcastLevels(spell);
      const level1Entry = levels.find(l => l.level === 1);
      expect(level1Entry.availableSlots).toBe(4); // from spellAbilities
    });

    it('returns 0 when level not in spellAbilities and runtime is null', () => {
      const playerStats = makePlayerStats({
        spellAbilities: { spell_slots_level_1: 4 },
      });
      mockGetRuntimeValue.mockReturnValue(null);

      const { result } = renderHook(() =>
        useSpellUpcastFlow(playerStats, 'TestCampaign')
      );

      const spell = makeUpcastableSpell();
      const levels = result.current.buildUpcastLevels(spell);
      const level5Entry = levels.find(l => l.level === 5);
      expect(level5Entry.availableSlots).toBe(0);
    });

    it('handles missing spellAbilities gracefully', () => {
      const playerStats = makePlayerStats({ spellAbilities: undefined });
      mockGetRuntimeValue.mockReturnValue(null);

      const { result } = renderHook(() =>
        useSpellUpcastFlow(playerStats, 'TestCampaign')
      );

      const spell = makeUpcastableSpell();
      const levels = result.current.buildUpcastLevels(spell);
      // All should fall back to 0 since spellAbilities is undefined
      expect(levels.every(l => l.availableSlots === 0)).toBe(true);
    });
  });

  // ── isUpcastable ───────────────────────────────────────────────────────

  describe('isUpcastable', () => {
    it('returns true for a spell with multiple slot damage levels', () => {
      const playerStats = makePlayerStats();
      const { result } = renderHook(() =>
        useSpellUpcastFlow(playerStats, 'TestCampaign')
      );

      const spell = makeUpcastableSpell();
      expect(result.current.isUpcastable(spell)).toBe(true);
    });

    it('returns false for a cantrip (level 0)', () => {
      const playerStats = makePlayerStats();
      const { result } = renderHook(() =>
        useSpellUpcastFlow(playerStats, 'TestCampaign')
      );

      const spell = makeCantripWithCharDmg();
      expect(result.current.isUpcastable(spell)).toBe(false);
    });

    it('returns false for a spell with only one slot damage level', () => {
      const playerStats = makePlayerStats();
      const { result } = renderHook(() =>
        useSpellUpcastFlow(playerStats, 'TestCampaign')
      );

      const spell = {
        name: 'Single Level Spell',
        level: 2,
        damage: {
          damage_at_slot_level: { 2: '2d6' },
        },
      };
      expect(result.current.isUpcastable(spell)).toBe(false);
    });

    it('returns false for a spell with no damage_at_slot_level', () => {
      const playerStats = makePlayerStats();
      const { result } = renderHook(() =>
        useSpellUpcastFlow(playerStats, 'TestCampaign')
      );

      const spell = makeSpell();
      expect(result.current.isUpcastable(spell)).toBe(false);
    });

    it('returns false for a spell with no damage object', () => {
      const playerStats = makePlayerStats();
      const { result } = renderHook(() =>
        useSpellUpcastFlow(playerStats, 'TestCampaign')
      );

      const spell = { name: 'Simple Spell', level: 1 };
      expect(result.current.isUpcastable(spell)).toBe(false);
    });

    it('returns false for null spell', () => {
      const playerStats = makePlayerStats();
      const { result } = renderHook(() =>
        useSpellUpcastFlow(playerStats, 'TestCampaign')
      );

      expect(result.current.isUpcastable(null)).toBe(false);
    });

    it('returns false for undefined spell', () => {
      const playerStats = makePlayerStats();
      const { result } = renderHook(() =>
        useSpellUpcastFlow(playerStats, 'TestCampaign')
      );

      expect(result.current.isUpcastable(undefined)).toBe(false);
    });

    it('returns false for a spell with empty damage_at_slot_level', () => {
      const playerStats = makePlayerStats();
      const { result } = renderHook(() =>
        useSpellUpcastFlow(playerStats, 'TestCampaign')
      );

      const spell = {
        name: 'Empty Slot Dmg',
        level: 2,
        damage: {
          damage_at_slot_level: {},
        },
      };
      expect(result.current.isUpcastable(spell)).toBe(false);
    });

    it('returns false for a spell with no damage property at all', () => {
      const playerStats = makePlayerStats();
      const { result } = renderHook(() =>
        useSpellUpcastFlow(playerStats, 'TestCampaign')
      );

      const spell = { name: 'No Damage', level: 1 };
      expect(result.current.isUpcastable(spell)).toBe(false);
    });
  });

  // ── buildUpcastLevels ──────────────────────────────────────────────────

  describe('buildUpcastLevels', () => {
    it('returns sorted levels with formula and availableSlots', () => {
      const playerStats = makePlayerStats();
      mockGetRuntimeValue.mockReturnValue(null);

      const { result } = renderHook(() =>
        useSpellUpcastFlow(playerStats, 'TestCampaign')
      );

      const spell = makeUpcastableSpell();
      const levels = result.current.buildUpcastLevels(spell);

      expect(levels).toHaveLength(3);
      // spellAbilities: level_1=4, level_2=3, level_3=2
      // Level 5 not in spellAbilities -> falls back to 0
      expect(levels[0]).toEqual({ level: 1, formula: '3d4+3', availableSlots: 4 });
      expect(levels[1]).toEqual({ level: 3, formula: '5d4+3', availableSlots: 2 });
      expect(levels[2]).toEqual({ level: 5, formula: '7d4+3', availableSlots: 0 });
    });

    it('returns empty array when no damage_at_slot_level', () => {
      const playerStats = makePlayerStats();
      const { result } = renderHook(() =>
        useSpellUpcastFlow(playerStats, 'TestCampaign')
      );

      const spell = makeSpell();
      expect(result.current.buildUpcastLevels(spell)).toEqual([]);
    });

    it('returns empty array when damage_at_slot_level is empty', () => {
      const playerStats = makePlayerStats();
      const { result } = renderHook(() =>
        useSpellUpcastFlow(playerStats, 'TestCampaign')
      );

      const spell = {
        name: 'Empty',
        level: 1,
        damage: { damage_at_slot_level: {} },
      };
      expect(result.current.buildUpcastLevels(spell)).toEqual([]);
    });

    it('handles spell with no damage property', () => {
      const playerStats = makePlayerStats();
      const { result } = renderHook(() =>
        useSpellUpcastFlow(playerStats, 'TestCampaign')
      );

      const spell = { name: 'No Damage', level: 1 };
      expect(result.current.buildUpcastLevels(spell)).toEqual([]);
    });

    it('throws on null spell (source bug: no null guard before .damage access)', () => {
      const playerStats = makePlayerStats();
      const { result } = renderHook(() =>
        useSpellUpcastFlow(playerStats, 'TestCampaign')
      );

      expect(() => {
        result.current.buildUpcastLevels(null);
      }).toThrow();
    });
  });

  // ── gateUpcast ─────────────────────────────────────────────────────────

  describe('gateUpcast', () => {
    it('returns true and sets pendingUpcast for an upcastable spell', () => {
      const playerStats = makePlayerStats();
      const { result } = renderHook(() =>
        useSpellUpcastFlow(playerStats, 'TestCampaign')
      );

      const spell = makeUpcastableSpell();
      const afterUpcast = vi.fn();

      act(() => {
        result.current.gateUpcast(spell, afterUpcast);
      });

      expect(result.current.pendingUpcast).not.toBeNull();
      expect(result.current.pendingUpcast.spell).toBe(spell);
      expect(result.current.pendingUpcast.afterUpcast).toBe(afterUpcast);
      expect(result.current.pendingUpcast.deductSlot).toBe(true);
    });

    it('returns false for a non-upcastable spell', () => {
      const playerStats = makePlayerStats();
      const { result } = renderHook(() =>
        useSpellUpcastFlow(playerStats, 'TestCampaign')
      );

      const spell = makeSpell();
      const afterUpcast = vi.fn();

      let retVal;
      act(() => {
        retVal = result.current.gateUpcast(spell, afterUpcast);
      });

      expect(retVal).toBe(false);
      expect(result.current.pendingUpcast).toBeNull();
    });

    it('respects deductSlot = false', () => {
      const playerStats = makePlayerStats();
      const { result } = renderHook(() =>
        useSpellUpcastFlow(playerStats, 'TestCampaign')
      );

      const spell = makeUpcastableSpell();
      const afterUpcast = vi.fn();

      act(() => {
        result.current.gateUpcast(spell, afterUpcast, false);
      });

      expect(result.current.pendingUpcast.deductSlot).toBe(false);
    });

    it('defaults deductSlot to true when omitted', () => {
      const playerStats = makePlayerStats();
      const { result } = renderHook(() =>
        useSpellUpcastFlow(playerStats, 'TestCampaign')
      );

      const spell = makeUpcastableSpell();
      const afterUpcast = vi.fn();

      act(() => {
        result.current.gateUpcast(spell, afterUpcast);
      });

      expect(result.current.pendingUpcast.deductSlot).toBe(true);
    });

    it('returns false for null spell', () => {
      const playerStats = makePlayerStats();
      const { result } = renderHook(() =>
        useSpellUpcastFlow(playerStats, 'TestCampaign')
      );

      const afterUpcast = vi.fn();

      let retVal;
      act(() => {
        retVal = result.current.gateUpcast(null, afterUpcast);
      });

      expect(retVal).toBe(false);
    });
  });

  // ── handleUpcastConfirm ────────────────────────────────────────────────

  describe('handleUpcastConfirm', () => {
    it('does nothing when there is no pending upcast', () => {
      const playerStats = makePlayerStats();
      const { result } = renderHook(() =>
        useSpellUpcastFlow(playerStats, 'TestCampaign')
      );

      act(() => {
        result.current.handleUpcastConfirm(3);
      });

      expect(mockSetRuntimeValue).not.toHaveBeenCalled();
    });

    it('clears pendingUpcast after confirm', () => {
      const playerStats = makePlayerStats();
      const { result } = renderHook(() =>
        useSpellUpcastFlow(playerStats, 'TestCampaign')
      );

      const spell = makeUpcastableSpell();
      const afterUpcast = vi.fn();

      act(() => {
        result.current.gateUpcast(spell, afterUpcast);
      });

      expect(result.current.pendingUpcast).not.toBeNull();

      act(() => {
        result.current.handleUpcastConfirm(3);
      });

      expect(result.current.pendingUpcast).toBeNull();
    });

    it('deducts a spell slot when deductSlot is true and slots > 0', () => {
      const playerStats = makePlayerStats();
      mockGetRuntimeValue.mockReturnValue(3);

      const { result } = renderHook(() =>
        useSpellUpcastFlow(playerStats, 'TestCampaign')
      );

      const spell = makeUpcastableSpell();
      const afterUpcast = vi.fn();

      act(() => {
        result.current.gateUpcast(spell, afterUpcast);
      });

      act(() => {
        result.current.handleUpcastConfirm(3);
      });

      expect(mockSetRuntimeValue).toHaveBeenCalledWith(
        playerStats.name, 'spell_slots_level_3', 2, 'TestCampaign'
      );
    });

    it('does not deduct slot when deductSlot is false', () => {
      const playerStats = makePlayerStats();
      mockGetRuntimeValue.mockReturnValue(3);

      const { result } = renderHook(() =>
        useSpellUpcastFlow(playerStats, 'TestCampaign')
      );

      const spell = makeUpcastableSpell();
      const afterUpcast = vi.fn();

      act(() => {
        result.current.gateUpcast(spell, afterUpcast, false);
      });

      act(() => {
        result.current.handleUpcastConfirm(3);
      });

      expect(mockSetRuntimeValue).not.toHaveBeenCalled();
    });

    it('does not deduct slot when currentSlots is 0', () => {
      const playerStats = makePlayerStats();
      mockGetRuntimeValue.mockReturnValue(0);

      const { result } = renderHook(() =>
        useSpellUpcastFlow(playerStats, 'TestCampaign')
      );

      const spell = makeUpcastableSpell();
      const afterUpcast = vi.fn();

      act(() => {
        result.current.gateUpcast(spell, afterUpcast);
      });

      act(() => {
        result.current.handleUpcastConfirm(3);
      });

      expect(mockSetRuntimeValue).not.toHaveBeenCalled();
    });

    it('calls afterUpcast with modified spell at the upcast level', () => {
      const playerStats = makePlayerStats();
      mockGetRuntimeValue.mockReturnValue(3);

      const { result } = renderHook(() =>
        useSpellUpcastFlow(playerStats, 'TestCampaign')
      );

      const spell = makeUpcastableSpell();
      const afterUpcast = vi.fn();

      act(() => {
        result.current.gateUpcast(spell, afterUpcast);
      });

      act(() => {
        result.current.handleUpcastConfirm(5);
      });

      expect(afterUpcast).toHaveBeenCalledWith({
        ...spell,
        level: 5,
      });
    });

    it('calls afterUpcast even when slot deduction is skipped (0 slots)', () => {
      const playerStats = makePlayerStats();
      mockGetRuntimeValue.mockReturnValue(0);

      const { result } = renderHook(() =>
        useSpellUpcastFlow(playerStats, 'TestCampaign')
      );

      const spell = makeUpcastableSpell();
      const afterUpcast = vi.fn();

      act(() => {
        result.current.gateUpcast(spell, afterUpcast);
      });

      act(() => {
        result.current.handleUpcastConfirm(3);
      });

      expect(afterUpcast).toHaveBeenCalled();
    });

    it('handles confirm with level 1 upcast', () => {
      const playerStats = makePlayerStats();
      mockGetRuntimeValue.mockReturnValue(4);

      const { result } = renderHook(() =>
        useSpellUpcastFlow(playerStats, 'TestCampaign')
      );

      const spell = makeUpcastableSpell();
      const afterUpcast = vi.fn();

      act(() => {
        result.current.gateUpcast(spell, afterUpcast);
      });

      act(() => {
        result.current.handleUpcastConfirm(1);
      });

      expect(mockSetRuntimeValue).toHaveBeenCalledWith(
        playerStats.name, 'spell_slots_level_1', 3, 'TestCampaign'
      );
      expect(afterUpcast).toHaveBeenCalledWith({ ...spell, level: 1 });
    });
  });

  // ── handleUpcastCancel ─────────────────────────────────────────────────

  describe('handleUpcastCancel', () => {
    it('clears pendingUpcast when there is one', () => {
      const playerStats = makePlayerStats();
      const { result } = renderHook(() =>
        useSpellUpcastFlow(playerStats, 'TestCampaign')
      );

      const spell = makeUpcastableSpell();
      const afterUpcast = vi.fn();

      act(() => {
        result.current.gateUpcast(spell, afterUpcast);
      });

      expect(result.current.pendingUpcast).not.toBeNull();

      act(() => {
        result.current.handleUpcastCancel();
      });

      expect(result.current.pendingUpcast).toBeNull();
    });

    it('is a no-op when pendingUpcast is already null', () => {
      const playerStats = makePlayerStats();
      const { result } = renderHook(() =>
        useSpellUpcastFlow(playerStats, 'TestCampaign')
      );

      expect(result.current.pendingUpcast).toBeNull();

      act(() => {
        result.current.handleUpcastCancel();
      });

      expect(result.current.pendingUpcast).toBeNull();
    });
  });

  // ── getCantripAutoLevel ────────────────────────────────────────────────

  describe('getCantripAutoLevel', () => {
    it('returns the highest applicable character level from damage_at_character_level', () => {
      const playerStats = makePlayerStats();
      const { result } = renderHook(() =>
        useSpellUpcastFlow(playerStats, 'TestCampaign')
      );

      const spell = makeCantripWithCharDmg();
      expect(result.current.getCantripAutoLevel(spell, 7)).toBe(5);
    });

    it('returns the exact level when playerLevel matches', () => {
      const playerStats = makePlayerStats();
      const { result } = renderHook(() =>
        useSpellUpcastFlow(playerStats, 'TestCampaign')
      );

      const spell = makeCantripWithCharDmg();
      expect(result.current.getCantripAutoLevel(spell, 5)).toBe(5);
    });

    it('returns the highest level when playerLevel exceeds all', () => {
      const playerStats = makePlayerStats();
      const { result } = renderHook(() =>
        useSpellUpcastFlow(playerStats, 'TestCampaign')
      );

      const spell = makeCantripWithCharDmg();
      expect(result.current.getCantripAutoLevel(spell, 15)).toBe(10);
    });

    it('returns null when playerLevel is below all damage levels', () => {
      const playerStats = makePlayerStats();
      const { result } = renderHook(() =>
        useSpellUpcastFlow(playerStats, 'TestCampaign')
      );

      const spell = makeCantripWithCharDmg();
      expect(result.current.getCantripAutoLevel(spell, 0)).toBeNull();
    });

    it('falls back to damage_at_slot_level when no damage_at_character_level', () => {
      const playerStats = makePlayerStats();
      const { result } = renderHook(() =>
        useSpellUpcastFlow(playerStats, 'TestCampaign')
      );

      const spell = makeCantripWithSlotDmg();
      expect(result.current.getCantripAutoLevel(spell, 2)).toBe(2);
    });

    it('prefers damage_at_character_level over damage_at_slot_level', () => {
      const playerStats = makePlayerStats();
      const { result } = renderHook(() =>
        useSpellUpcastFlow(playerStats, 'TestCampaign')
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

    it('returns null when both damage objects are empty', () => {
      const playerStats = makePlayerStats();
      const { result } = renderHook(() =>
        useSpellUpcastFlow(playerStats, 'TestCampaign')
      );

      const spell = {
        name: 'Empty Both',
        level: 0,
        damage: {
          damage_at_character_level: {},
          damage_at_slot_level: {},
        },
      };

      expect(result.current.getCantripAutoLevel(spell, 5)).toBeNull();
    });

    it('returns null when spell has no damage property', () => {
      const playerStats = makePlayerStats();
      const { result } = renderHook(() =>
        useSpellUpcastFlow(playerStats, 'TestCampaign')
      );

      const spell = { name: 'No Damage', level: 0 };
      expect(result.current.getCantripAutoLevel(spell, 5)).toBeNull();
    });

    it('returns null when spell has damage but no relevant sub-properties', () => {
      const playerStats = makePlayerStats();
      const { result } = renderHook(() =>
        useSpellUpcastFlow(playerStats, 'TestCampaign')
      );

      const spell = {
        name: 'Other Damage',
        level: 0,
        damage: { base_damage: '1d8' },
      };

      expect(result.current.getCantripAutoLevel(spell, 5)).toBeNull();
    });

    it('throws on null spell (source bug: no null guard before .damage access)', () => {
      const playerStats = makePlayerStats();
      const { result } = renderHook(() =>
        useSpellUpcastFlow(playerStats, 'TestCampaign')
      );

      expect(() => {
        result.current.getCantripAutoLevel(null, 5);
      }).toThrow();
    });

    it('throws on undefined spell (source bug: no null guard before .damage access)', () => {
      const playerStats = makePlayerStats();
      const { result } = renderHook(() =>
        useSpellUpcastFlow(playerStats, 'TestCampaign')
      );

      expect(() => {
        result.current.getCantripAutoLevel(undefined, 5);
      }).toThrow();
    });

    it('handles playerLevel of 0 with level-1 damage entry', () => {
      const playerStats = makePlayerStats();
      const { result } = renderHook(() =>
        useSpellUpcastFlow(playerStats, 'TestCampaign')
      );

      const spell = makeCantripWithCharDmg();
      // Level 1 is the lowest damage level; playerLevel 0 means nothing applies
      expect(result.current.getCantripAutoLevel(spell, 0)).toBeNull();
    });

    it('handles playerLevel of 1 with level-1 damage entry', () => {
      const playerStats = makePlayerStats();
      const { result } = renderHook(() =>
        useSpellUpcastFlow(playerStats, 'TestCampaign')
      );

      const spell = makeCantripWithCharDmg();
      expect(result.current.getCantripAutoLevel(spell, 1)).toBe(1);
    });

    it('handles spell with only damage_at_slot_level and no matching levels', () => {
      const playerStats = makePlayerStats();
      const { result } = renderHook(() =>
        useSpellUpcastFlow(playerStats, 'TestCampaign')
      );

      const spell = makeCantripWithSlotDmg();
      // Lowest slot level is 1; playerLevel 0 means nothing applies
      expect(result.current.getCantripAutoLevel(spell, 0)).toBeNull();
    });

    it('handles spell with only damage_at_slot_level and matching level', () => {
      const playerStats = makePlayerStats();
      const { result } = renderHook(() =>
        useSpellUpcastFlow(playerStats, 'TestCampaign')
      );

      const spell = makeCantripWithSlotDmg();
      expect(result.current.getCantripAutoLevel(spell, 3)).toBe(3);
    });
  });

  // ── Integration / Flow tests ───────────────────────────────────────────

  describe('full upcast flow', () => {
    it('completes the full gate -> confirm flow with slot deduction', () => {
      const playerStats = makePlayerStats();
      mockGetRuntimeValue.mockReturnValue(2);

      const { result } = renderHook(() =>
        useSpellUpcastFlow(playerStats, 'TestCampaign')
      );

      const spell = makeUpcastableSpell();
      const afterUpcast = vi.fn();

      // Gate the upcast
      let gateResult;
      act(() => {
        gateResult = result.current.gateUpcast(spell, afterUpcast);
      });

      expect(gateResult).toBe(true);
      expect(result.current.pendingUpcast).not.toBeNull();

      // Confirm the upcast
      act(() => {
        result.current.handleUpcastConfirm(3);
      });

      expect(mockSetRuntimeValue).toHaveBeenCalledWith(
        playerStats.name, 'spell_slots_level_3', 1, 'TestCampaign'
      );
      expect(afterUpcast).toHaveBeenCalledWith({ ...spell, level: 3 });
      expect(result.current.pendingUpcast).toBeNull();
    });

    it('completes the full gate -> cancel flow', () => {
      const playerStats = makePlayerStats();
      const { result } = renderHook(() =>
        useSpellUpcastFlow(playerStats, 'TestCampaign')
      );

      const spell = makeUpcastableSpell();
      const afterUpcast = vi.fn();

      act(() => {
        result.current.gateUpcast(spell, afterUpcast);
      });

      expect(result.current.pendingUpcast).not.toBeNull();

      act(() => {
        result.current.handleUpcastCancel();
      });

      expect(result.current.pendingUpcast).toBeNull();
      expect(afterUpcast).not.toHaveBeenCalled();
      expect(mockSetRuntimeValue).not.toHaveBeenCalled();
    });

    it('rejects non-upcastable spell at the gate', () => {
      const playerStats = makePlayerStats();
      const { result } = renderHook(() =>
        useSpellUpcastFlow(playerStats, 'TestCampaign')
      );

      const spell = makeSpell();
      const afterUpcast = vi.fn();

      let gateResult;
      act(() => {
        gateResult = result.current.gateUpcast(spell, afterUpcast);
      });

      expect(gateResult).toBe(false);
      expect(result.current.pendingUpcast).toBeNull();
    });

    it('buildUpcastLevels reflects runtime slot values', () => {
      const playerStats = makePlayerStats();
      mockGetRuntimeValue.mockImplementation((name, key) => {
        if (key === 'spell_slots_level_1') return 3;
        if (key === 'spell_slots_level_3') return 1;
        if (key === 'spell_slots_level_5') return 0;
        return null;
      });

      const { result } = renderHook(() =>
        useSpellUpcastFlow(playerStats, 'TestCampaign')
      );

      const spell = makeUpcastableSpell();
      const levels = result.current.buildUpcastLevels(spell);

      expect(levels[0].availableSlots).toBe(3);
      expect(levels[1].availableSlots).toBe(1);
      expect(levels[2].availableSlots).toBe(0);
    });
  });

  // ── Edge cases ─────────────────────────────────────────────────────────

  describe('edge cases', () => {
    it('handles empty campaignName', () => {
      const playerStats = makePlayerStats();
      const { result } = renderHook(() =>
        useSpellUpcastFlow(playerStats, '')
      );

      expect(result.current.pendingUpcast).toBeNull();
    });

    it('handles null campaignName', () => {
      const playerStats = makePlayerStats();
      const { result } = renderHook(() =>
        useSpellUpcastFlow(playerStats, null)
      );

      expect(result.current.pendingUpcast).toBeNull();
    });

    it('handles playerStats with missing name', () => {
      const playerStats = makePlayerStats({ name: undefined });
      const { result } = renderHook(() =>
        useSpellUpcastFlow(playerStats, 'TestCampaign')
      );

      expect(result.current.pendingUpcast).toBeNull();
    });

    it('handles playerStats with null spellAbilities', () => {
      const playerStats = makePlayerStats({ spellAbilities: null });
      mockGetRuntimeValue.mockReturnValue(null);

      const { result } = renderHook(() =>
        useSpellUpcastFlow(playerStats, 'TestCampaign')
      );

      const spell = makeUpcastableSpell();
      const levels = result.current.buildUpcastLevels(spell);
      // All slots should be 0 since spellAbilities is null and runtime returns null
      expect(levels.every(l => l.availableSlots === 0)).toBe(true);
    });

    it('handles spell with damage_at_slot_level having only one key', () => {
      const playerStats = makePlayerStats();
      const { result } = renderHook(() =>
        useSpellUpcastFlow(playerStats, 'TestCampaign')
      );

      const spell = {
        name: 'Single Level',
        level: 2,
        damage: {
          damage_at_slot_level: { 2: '2d6' },
        },
      };

      expect(result.current.isUpcastable(spell)).toBe(false);
      expect(result.current.buildUpcastLevels(spell)).toHaveLength(1);
    });

    it('handles spell with string keys in damage_at_slot_level', () => {
      const playerStats = makePlayerStats();
      mockGetRuntimeValue.mockReturnValue(null);

      const { result } = renderHook(() =>
        useSpellUpcastFlow(playerStats, 'TestCampaign')
      );

      const spell = {
        name: 'String Keys',
        level: 1,
        damage: {
          damage_at_slot_level: { '1': '1d6', '3': '2d6' },
        },
      };

      expect(result.current.isUpcastable(spell)).toBe(true);
      const levels = result.current.buildUpcastLevels(spell);
      expect(levels[0].level).toBe(1);
      expect(levels[1].level).toBe(3);
    });

    it('handles getCantripAutoLevel with playerLevel as string', () => {
      const playerStats = makePlayerStats();
      const { result } = renderHook(() =>
        useSpellUpcastFlow(playerStats, 'TestCampaign')
      );

      const spell = makeCantripWithCharDmg();
      // playerLevel is compared with <=, so string '7' works due to JS coercion
      expect(result.current.getCantripAutoLevel(spell, '7')).toBe(5);
    });

    it('handles getCantripAutoLevel with playerLevel as 0', () => {
      const playerStats = makePlayerStats();
      const { result } = renderHook(() =>
        useSpellUpcastFlow(playerStats, 'TestCampaign')
      );

      const spell = makeCantripWithCharDmg();
      expect(result.current.getCantripAutoLevel(spell, 0)).toBeNull();
    });

    it('handles getCantripAutoLevel with playerLevel as negative', () => {
      const playerStats = makePlayerStats();
      const { result } = renderHook(() =>
        useSpellUpcastFlow(playerStats, 'TestCampaign')
      );

      const spell = makeCantripWithCharDmg();
      expect(result.current.getCantripAutoLevel(spell, -1)).toBeNull();
    });

    it('handles spell with level 0 but has damage_at_slot_level (not upcastable)', () => {
      const playerStats = makePlayerStats();
      const { result } = renderHook(() =>
        useSpellUpcastFlow(playerStats, 'TestCampaign')
      );

      const spell = {
        name: 'Cantrip with slot dmg',
        level: 0,
        damage: {
          damage_at_slot_level: { 1: '1d6', 3: '2d6' },
        },
      };

      expect(result.current.isUpcastable(spell)).toBe(false);
    });

    it('handles gateUpcast with deductSlot explicitly set to true', () => {
      const playerStats = makePlayerStats();
      const { result } = renderHook(() =>
        useSpellUpcastFlow(playerStats, 'TestCampaign')
      );

      const spell = makeUpcastableSpell();
      const afterUpcast = vi.fn();

      act(() => {
        result.current.gateUpcast(spell, afterUpcast, true);
      });

      expect(result.current.pendingUpcast.deductSlot).toBe(true);
    });

    it('handles confirm when getAvailableSlotCount returns null (runtime null, no spellAbilities)', () => {
      const playerStats = makePlayerStats({ spellAbilities: {} });
      mockGetRuntimeValue.mockReturnValue(null);

      const { result } = renderHook(() =>
        useSpellUpcastFlow(playerStats, 'TestCampaign')
      );

      const spell = makeUpcastableSpell();
      const afterUpcast = vi.fn();

      act(() => {
        result.current.gateUpcast(spell, afterUpcast);
      });

      // getAvailableSlotCount returns 0 (fallback from empty spellAbilities)
      // currentSlots > 0 check fails, so no deduction
      act(() => {
        result.current.handleUpcastConfirm(3);
      });

      expect(mockSetRuntimeValue).not.toHaveBeenCalled();
      // But afterUpcast should still be called
      expect(afterUpcast).toHaveBeenCalled();
    });

    it('handles confirm when getAvailableSlotCount returns null (runtime null, no spellAbilities for that level)', () => {
      const playerStats = makePlayerStats({
        spellAbilities: { spell_slots_level_1: 4 },
      });
      mockGetRuntimeValue.mockReturnValue(null);

      const { result } = renderHook(() =>
        useSpellUpcastFlow(playerStats, 'TestCampaign')
      );

      const spell = makeUpcastableSpell();
      const afterUpcast = vi.fn();

      act(() => {
        result.current.gateUpcast(spell, afterUpcast);
      });

      // Level 3 not in spellAbilities -> getAvailableSlotCount returns 0
      act(() => {
        result.current.handleUpcastConfirm(3);
      });

      expect(mockSetRuntimeValue).not.toHaveBeenCalled();
      expect(afterUpcast).toHaveBeenCalled();
    });
  });
});
