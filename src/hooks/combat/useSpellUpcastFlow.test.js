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
    it('returns an object with expected properties', () => {
      const playerStats = makePlayerStats();
      const { result } = renderHook(() =>
        useSpellUpcastFlow(playerStats, 'TestCampaign')
      );

      expect(Object.keys(result.current)).toEqual(
        expect.arrayContaining([
          'pendingUpcast',
          'isUpcastable',
          'buildUpcastLevels',
          'gateUpcast',
          'handleUpcastConfirm',
          'handleUpcastCancel',
          'getCantripAutoLevel',
        ])
      );
    });

    it('initializes pendingUpcast as null', () => {
      const playerStats = makePlayerStats();
      const { result } = renderHook(() =>
        useSpellUpcastFlow(playerStats, 'TestCampaign')
      );

      expect(result.current.pendingUpcast).toBeNull();
    });
  });

  // ── getAvailableSlotCount (via buildUpcastLevels) ──────────────────────

  describe('getAvailableSlotCount (via buildUpcastLevels)', () => {
    it('returns runtime value when available', () => {
      const playerStats = makePlayerStats();
      mockGetRuntimeValue.mockImplementation((_name, key) => {
        if (key === 'spell_slots_level_1') return 2;
        return null;
      });

      const { result } = renderHook(() =>
        useSpellUpcastFlow(playerStats, 'TestCampaign')
      );

      const spell = makeUpcastableSpell();
      const levels = result.current.buildUpcastLevels(spell);
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
      expect(level1Entry.availableSlots).toBe(4);
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

    it('returns 0 when spellAbilities is undefined', () => {
      const playerStats = makePlayerStats({ spellAbilities: undefined });
      mockGetRuntimeValue.mockReturnValue(null);

      const { result } = renderHook(() =>
        useSpellUpcastFlow(playerStats, 'TestCampaign')
      );

      const spell = makeUpcastableSpell();
      const levels = result.current.buildUpcastLevels(spell);
      expect(levels.every(l => l.availableSlots === 0)).toBe(true);
    });

    it('returns 0 when spellAbilities is null', () => {
      const playerStats = makePlayerStats({ spellAbilities: null });
      mockGetRuntimeValue.mockReturnValue(null);

      const { result } = renderHook(() =>
        useSpellUpcastFlow(playerStats, 'TestCampaign')
      );

      const spell = makeUpcastableSpell();
      const levels = result.current.buildUpcastLevels(spell);
      expect(levels.every(l => l.availableSlots === 0)).toBe(true);
    });

    it('uses Hunter\'s Mark Foe Slayer replacement at level 20', () => {
      const playerStats = makePlayerStats({
        class: { name: 'Ranger' },
        level: 20,
      });
      mockGetRuntimeValue.mockReturnValue(null);

      const { result } = renderHook(() =>
        useSpellUpcastFlow(playerStats, 'TestCampaign')
      );

      const spell = {
        name: "Hunter's Mark",
        level: 1,
        damage: {
          damage_at_slot_level: {
            1: '1d6',
            3: '1d6',
            5: '1d6',
          },
        },
      };

      const levels = result.current.buildUpcastLevels(spell);
      expect(levels[0].formula).toBe('1d10');
      expect(levels[1].formula).toBe('1d10');
      expect(levels[2].formula).toBe('1d10');
    });

    it('does not apply Foe Slayer when ranger is below level 20', () => {
      const playerStats = makePlayerStats({
        class: { name: 'Ranger' },
        level: 19,
      });
      mockGetRuntimeValue.mockReturnValue(null);

      const { result } = renderHook(() =>
        useSpellUpcastFlow(playerStats, 'TestCampaign')
      );

      const spell = {
        name: "Hunter's Mark",
        level: 1,
        damage: {
          damage_at_slot_level: {
            1: '1d6',
            2: '2d6',
          },
        },
      };

      const levels = result.current.buildUpcastLevels(spell);
      expect(levels[0].formula).toBe('1d6');
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

    it('returns false for a cantrip with damage_at_slot_level', () => {
      const playerStats = makePlayerStats();
      const { result } = renderHook(() =>
        useSpellUpcastFlow(playerStats, 'TestCampaign')
      );

      const spell = makeCantripWithSlotDmg();
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

    it('returns false for a spell with no damage object', () => {
      const playerStats = makePlayerStats();
      const { result } = renderHook(() =>
        useSpellUpcastFlow(playerStats, 'TestCampaign')
      );

      const spell = { name: 'Simple Spell', level: 1 };
      expect(result.current.isUpcastable(spell)).toBe(false);
    });

    it('returns false for null or undefined spell', () => {
      const playerStats = makePlayerStats();
      const { result } = renderHook(() =>
        useSpellUpcastFlow(playerStats, 'TestCampaign')
      );

      expect(result.current.isUpcastable(null)).toBe(false);
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

    it('returns true for a healing spell with multiple heal_at_slot_level entries', () => {
      const playerStats = makePlayerStats();
      const { result } = renderHook(() =>
        useSpellUpcastFlow(playerStats, 'TestCampaign')
      );

      const spell = {
        name: 'Cure Wounds',
        level: 1,
        heal_at_slot_level: {
          1: '1d8 + MOD',
          2: '2d8 + MOD',
          3: '3d8 + MOD',
          5: '5d8 + MOD',
        },
      };
      expect(result.current.isUpcastable(spell)).toBe(true);
    });

    it('returns false for a healing spell with only one heal_at_slot_level entry', () => {
      const playerStats = makePlayerStats();
      const { result } = renderHook(() =>
        useSpellUpcastFlow(playerStats, 'TestCampaign')
      );

      const spell = {
        name: 'Single Heal',
        level: 2,
        heal_at_slot_level: { 2: '1d8 + MOD' },
      };
      expect(result.current.isUpcastable(spell)).toBe(false);
    });

    it('returns true for a spell with both damage and healing upcast', () => {
      const playerStats = makePlayerStats();
      const { result } = renderHook(() =>
        useSpellUpcastFlow(playerStats, 'TestCampaign')
      );

      const spell = {
        name: 'Vampiric Touch',
        level: 2,
        damage: {
          damage_at_slot_level: { 2: '2d6', 3: '3d6' },
        },
        heal_at_slot_level: {
          2: '2d6 + MOD',
          3: '3d6 + MOD',
        },
      };
      expect(result.current.isUpcastable(spell)).toBe(true);
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
      expect(levels).toEqual(
        expect.arrayContaining([
          { level: 1, formula: '3d4+3', availableSlots: 4 },
          { level: 3, formula: '5d4+3', availableSlots: 2 },
          { level: 5, formula: '7d4+3', availableSlots: 0 },
        ])
      );
      // Verify sorted order
      expect(levels[0].level).toBeLessThan(levels[1].level);
      expect(levels[1].level).toBeLessThan(levels[2].level);
    });

    it('returns empty array when no damage object', () => {
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

    it('handles string keys in damage_at_slot_level', () => {
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

      const levels = result.current.buildUpcastLevels(spell);
      expect(levels[0].level).toBe(1);
      expect(levels[1].level).toBe(3);
    });

    it('throws on null spell', () => {
      const playerStats = makePlayerStats();
      const { result } = renderHook(() =>
        useSpellUpcastFlow(playerStats, 'TestCampaign')
      );

      expect(() => result.current.buildUpcastLevels(null)).toThrow();
    });

    it('returns sorted levels with formula and availableSlots for healing spells', () => {
      const playerStats = makePlayerStats();
      mockGetRuntimeValue.mockReturnValue(null);

      const { result } = renderHook(() =>
        useSpellUpcastFlow(playerStats, 'TestCampaign')
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
      expect(levels).toEqual(
        expect.arrayContaining([
          { level: 1, formula: '1d8 + MOD', availableSlots: 4 },
          { level: 2, formula: '2d8 + MOD', availableSlots: 3 },
          { level: 5, formula: '5d8 + MOD', availableSlots: 0 },
        ])
      );
      expect(levels[0].level).toBeLessThan(levels[1].level);
      expect(levels[1].level).toBeLessThan(levels[2].level);
    });

    it('returns healing spell levels with runtime slot values', () => {
      const playerStats = makePlayerStats();
      mockGetRuntimeValue.mockImplementation((_name, key) => {
        if (key === 'spell_slots_level_1') return 2;
        if (key === 'spell_slots_level_2') return 1;
        return null;
      });

      const { result } = renderHook(() =>
        useSpellUpcastFlow(playerStats, 'TestCampaign')
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
      expect(levels[2].availableSlots).toBe(2);
    });

    it('prioritizes damage over healing when both exist', () => {
      const playerStats = makePlayerStats();
      mockGetRuntimeValue.mockReturnValue(null);

      const { result } = renderHook(() =>
        useSpellUpcastFlow(playerStats, 'TestCampaign')
      );

      const spell = {
        name: 'Vampiric Touch',
        level: 2,
        damage: {
          damage_at_slot_level: { 2: '2d6', 3: '3d6' },
        },
        heal_at_slot_level: {
          2: '2d6 + MOD',
          3: '3d6 + MOD',
        },
      };

      const levels = result.current.buildUpcastLevels(spell);
      expect(levels[0].formula).toBe('2d6');
      expect(levels[1].formula).toBe('3d6');
    });

    it('returns empty array when only damage_at_slot_level is empty but healing exists', () => {
      const playerStats = makePlayerStats();
      const { result } = renderHook(() =>
        useSpellUpcastFlow(playerStats, 'TestCampaign')
      );

      const spell = {
        name: 'Cure Wounds',
        level: 1,
        damage: { damage_at_slot_level: {} },
        heal_at_slot_level: {
          1: '1d8 + MOD',
          2: '2d8 + MOD',
        },
      };

      const levels = result.current.buildUpcastLevels(spell);
      expect(levels).toHaveLength(2);
      expect(levels[0].formula).toBe('1d8 + MOD');
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

      let retVal;
      act(() => {
        retVal = result.current.gateUpcast(spell, afterUpcast);
      });

      expect(retVal).toBe(true);
      expect(result.current.pendingUpcast).not.toBeNull();
      expect(result.current.pendingUpcast.spell).toBe(spell);
      expect(result.current.pendingUpcast.afterUpcast).toBe(afterUpcast);
      expect(result.current.pendingUpcast.deductSlot).toBe(true);
    });

    it('returns false and does not set pendingUpcast for a non-upcastable spell', () => {
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
      expect(afterUpcast).not.toHaveBeenCalled();
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

    it('returns false for null or undefined spell', () => {
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

      act(() => {
        retVal = result.current.gateUpcast(undefined, afterUpcast);
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
      mockGetRuntimeValue.mockImplementation((_name, key) => {
        if (key === 'spell_slots_level_3') return 3;
        return null;
      });

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
      mockGetRuntimeValue.mockImplementation((_name, key) => {
        if (key === 'spell_slots_level_3') return 3;
        return null;
      });

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
      mockGetRuntimeValue.mockImplementation((_name, key) => {
        if (key === 'spell_slots_level_3') return 0;
        return null;
      });

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
      mockGetRuntimeValue.mockImplementation((_name, key) => {
        if (key === 'spell_slots_level_5') return 3;
        return null;
      });

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
      mockGetRuntimeValue.mockImplementation((_name, key) => {
        if (key === 'spell_slots_level_3') return 0;
        return null;
      });

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
      mockGetRuntimeValue.mockImplementation((_name, key) => {
        if (key === 'spell_slots_level_1') return 4;
        return null;
      });

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

    it('calls afterUpcast when spellAbilities has no entry for upcast level', () => {
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

      act(() => {
        result.current.handleUpcastConfirm(3);
      });

      expect(mockSetRuntimeValue).not.toHaveBeenCalled();
      expect(afterUpcast).toHaveBeenCalledWith({ ...spell, level: 3 });
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

    it('returns null when damage has no relevant sub-properties', () => {
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

    it('returns null for negative playerLevel', () => {
      const playerStats = makePlayerStats();
      const { result } = renderHook(() =>
        useSpellUpcastFlow(playerStats, 'TestCampaign')
      );

      const spell = makeCantripWithCharDmg();
      expect(result.current.getCantripAutoLevel(spell, -1)).toBeNull();
    });

    it('handles spell with only damage_at_slot_level and no matching levels', () => {
      const playerStats = makePlayerStats();
      const { result } = renderHook(() =>
        useSpellUpcastFlow(playerStats, 'TestCampaign')
      );

      const spell = makeCantripWithSlotDmg();
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
      mockGetRuntimeValue.mockImplementation((_name, key) => {
        if (key === 'spell_slots_level_3') return 2;
        return null;
      });

      const { result } = renderHook(() =>
        useSpellUpcastFlow(playerStats, 'TestCampaign')
      );

      const spell = makeUpcastableSpell();
      const afterUpcast = vi.fn();

      let gateResult;
      act(() => {
        gateResult = result.current.gateUpcast(spell, afterUpcast);
      });

      expect(gateResult).toBe(true);
      expect(result.current.pendingUpcast).not.toBeNull();

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
      expect(afterUpcast).not.toHaveBeenCalled();
    });

    it('buildUpcastLevels reflects runtime slot values per level', () => {
      const playerStats = makePlayerStats();
      mockGetRuntimeValue.mockImplementation((_name, key) => {
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

    it('handles spell with only one damage_at_slot_level key', () => {
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
      const levels = result.current.buildUpcastLevels(spell);
      expect(levels).toHaveLength(1);
    });
  });
});
