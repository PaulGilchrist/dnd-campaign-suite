import { describe, it, expect, vi } from 'vitest';

// ── Mocks BEFORE imports ───────────────────────────────────────

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../ui/logService.js', () => ({
  addEntry: vi.fn().mockResolvedValue({}),
}));

vi.mock('../../combat/conditions/savePromptService.js', () => ({
  sendDeathSavePrompt: vi.fn(),
  clearDeathSavePrompt: vi.fn(),
}));

vi.mock('../../automation/common/savePrompt.js', () => ({
  createSaveListener: vi.fn(),
}));

vi.mock('../../ui/utils.js', () => ({
  default: { guid: vi.fn(() => 'test-guid-123') },
}));

// ── Imports ────────────────────────────────────────────────────

import { evaluateHealExpression, getRuntimeUsesKey } from './relentlessRageService.js';

function makePlayerComputed(overrides = {}) {
  return {
    name: 'TestBarbarian',
    level: 11,
    allFeatures: [
      {
        name: 'Relentless Rage',
        automation: {
          type: 'reaction_save_heal',
          saveType: 'CON',
          saveDc: 10,
          dcScaling: 5,
          healExpression: '2 * barbarian_level',
        },
      },
    ],
    class: {
      class_levels: [{ name: 'Barbarian', level: 11 }],
    },
    ...overrides,
  };
}

// ── Tests ──────────────────────────────────────────────────────

describe('relentlessRageService - helpers', () => {

  describe('evaluateHealExpression', () => {
    it('returns numeric expression directly', () => {
      expect(evaluateHealExpression(10, makePlayerComputed())).toBe(10);
    });

    it('evaluates "2 * barbarian_level"', () => {
      const computed = makePlayerComputed({ level: 11 });
      expect(evaluateHealExpression('2 * barbarian_level', computed)).toBe(22);
    });

    it('evaluates "2 * level"', () => {
      const computed = makePlayerComputed({ level: 9 });
      expect(evaluateHealExpression('2 * level', computed)).toBe(18);
    });

    it('falls back to level for unrecognizable expressions', () => {
      const computed = makePlayerComputed({ level: 7 });
      expect(evaluateHealExpression('1d8+CON', computed)).toBe(7);
    });

    it('returns 1 when no expression and no level', () => {
      expect(evaluateHealExpression(null, {})).toBe(1);
    });

    it('evaluates "3 * barbarian_level" with class_levels', () => {
      const computed = { ...makePlayerComputed(), level: 20 };
      expect(evaluateHealExpression('3 * barbarian_level', computed)).toBe(33);
    });

    it('evaluates "2 * level" expression', () => {
      const computed = { ...makePlayerComputed(), level: 5 };
      expect(evaluateHealExpression('2 * level', computed)).toBe(10);
    });

    it('falls back to 1 when expression is unrecognizable and no level', () => {
      expect(evaluateHealExpression('1d8+CON', {})).toBe(1);
    });

    it('falls back to playerComputed.level when barbarian_level expression but no Barbarian class', () => {
      const computed = { level: 8, allFeatures: [], class: { class_levels: [{ name: 'Fighter', level: 8 }] } };
      expect(evaluateHealExpression('2 * barbarian_level', computed)).toBe(16);
    });

    it('falls back to playerComputed.level when barbarian_level expression and no class_levels', () => {
      const computed = { level: 5, allFeatures: [], class: {} };
      expect(evaluateHealExpression('2 * barbarian_level', computed)).toBe(10);
    });

    it('returns 0 for unknown field in numeric expression (value defaults to 0)', () => {
      const computed = { level: 7, allFeatures: [] };
      expect(evaluateHealExpression('2 * charisma', computed)).toBe(0);
    });

    it('uses level fallback of 1 when level is 0', () => {
      const computed = { level: 0, allFeatures: [] };
      expect(evaluateHealExpression('2 * level', computed)).toBe(2);
    });

    it('falls back to 1 inside the expression when barbarian_level has no class_levels and no level', () => {
      const computed = { allFeatures: [] };
      expect(evaluateHealExpression('2 * barbarian_level', computed)).toBe(2);
    });

    it('falls back to 1 inside the expression when level has no level property', () => {
      const computed = { allFeatures: [] };
      expect(evaluateHealExpression('2 * level', computed)).toBe(2);
    });
  });

  describe('getRuntimeUsesKey', () => {
    it('lowercases and removes spaces from feature name', () => {
      expect(getRuntimeUsesKey('Relentless Rage')).toBe('relentlessrageUses');
    });

    it('handles single word feature names', () => {
      expect(getRuntimeUsesKey('Frenzy')).toBe('frenzyUses');
    });
  });
});
