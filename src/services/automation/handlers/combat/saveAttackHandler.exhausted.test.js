import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks BEFORE imports ───────────────────────────────────────

vi.mock('../../../dice/diceRoller.js', () => ({
  rollExpression: vi.fn(),
}));

vi.mock('../../common/savePrompt.js', () => ({
  buildSaveDc: vi.fn(),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../maps/mapsService.js', () => ({
  loadMapData: vi.fn(),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
  getAttackerTargetName: vi.fn(),
}));

vi.mock('../../../rules/combat/rangeValidation.js', () => ({
  rangeToFeet: vi.fn(),
}));

vi.mock('../../../rules/effects/expirations.js', () => ({
  addExpiration: vi.fn(),
}));

vi.mock('../../../combat/automation/automationExpressions.js', () => ({
  resolveUses: vi.fn(),
  resolveScaling: vi.fn(),
}));

// ── Imports ────────────────────────────────────────────────────

import { isExhausted } from './saveAttackHandler.js';
import * as runtimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as automationExpressions from '../../../combat/automation/automationExpressions.js';

// ── Helpers ────────────────────────────────────────────────────

const campaignName = 'TestCampaign';

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestCaster',
    level: 5,
    ...overrides,
  };
}

function makeAction(automation = {}) {
  return {
    name: 'Breath Weapon',
    automation: {
      type: 'save_attack',
      ...automation,
    },
  };
}

// ── Tests ──────────────────────────────────────────────────────

describe('saveAttackHandler - isExhausted', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    runtimeState.getRuntimeValue.mockReturnValue(null);
    automationExpressions.resolveUses.mockReturnValue(undefined);
  });

  it('should return false when action has no automation', () => {
    const result = isExhausted({ name: 'Test' }, makePlayerStats(), campaignName);
    expect(result).toBe(false);
  });

  it('should return false when automation exists but has no resource constraints', () => {
    const action = makeAction({ damage: '1d6' });
    const result = isExhausted(action, makePlayerStats(), campaignName);
    expect(result).toBe(false);
  });

  describe('channel divinity resource cost', () => {
    it('should return true when charges are depleted', () => {
      runtimeState.getRuntimeValue.mockReturnValue(0);
      const ps = makePlayerStats({
        class: { class_levels: [{ level: 5, channel_divinity: 2 }] },
      });
      const action = makeAction({ resourceCost: 'channel_divinity' });

      expect(isExhausted(action, ps, campaignName)).toBe(true);
    });

    it('should return false when charges are available', () => {
      runtimeState.getRuntimeValue.mockReturnValue(1);
      const ps = makePlayerStats({
        class: { class_levels: [{ level: 5, channel_divinity: 2 }] },
      });
      const action = makeAction({ resourceCost: 'channel_divinity' });

      expect(isExhausted(action, ps, campaignName)).toBe(false);
    });

    it('should default to max charges when no runtime value is set', () => {
      runtimeState.getRuntimeValue.mockReturnValue(null);
      const ps = makePlayerStats({
        class: { class_levels: [{ level: 5, channel_divinity: 2 }] },
      });
      const action = makeAction({ resourceCost: 'channel_divinity' });

      expect(isExhausted(action, ps, campaignName)).toBe(false);
    });

    it('should use class_specific channel_divinity_charges fallback', () => {
      runtimeState.getRuntimeValue.mockReturnValue(null);
      const ps = makePlayerStats({
        class: { class_levels: [{ level: 5, class_specific: { channel_divinity_charges: 3 } }] },
      });
      const action = makeAction({ resourceCost: 'channel_divinity' });

      expect(isExhausted(action, ps, campaignName)).toBe(false);
    });

    it('should default to 2 charges when no class data exists', () => {
      runtimeState.getRuntimeValue.mockReturnValue(null);
      const ps = makePlayerStats({ class: {} });
      const action = makeAction({ resourceCost: 'channel_divinity' });

      expect(isExhausted(action, ps, campaignName)).toBe(false);
    });
  });

  describe('wild shape resource cost', () => {
    it('should return true when uses are depleted', () => {
      runtimeState.getRuntimeValue.mockReturnValue(0);
      const ps = makePlayerStats({
        class: { class_levels: [{ level: 5, wild_shape: 2 }] },
      });
      const action = makeAction({ resourceCost: 'wild_shape' });

      expect(isExhausted(action, ps, campaignName)).toBe(true);
    });

    it('should return false when uses are available', () => {
      runtimeState.getRuntimeValue.mockReturnValue(2);
      const ps = makePlayerStats({
        class: { class_levels: [{ level: 5, wild_shape: 2 }] },
      });
      const action = makeAction({ resourceCost: 'wild_shape' });

      expect(isExhausted(action, ps, campaignName)).toBe(false);
    });

    it('should default to max wild_shape when no runtime value is set', () => {
      runtimeState.getRuntimeValue.mockReturnValue(null);
      const ps = makePlayerStats({
        class: { class_levels: [{ level: 5, wild_shape: 2 }] },
      });
      const action = makeAction({ resourceCost: 'wild_shape' });

      expect(isExhausted(action, ps, campaignName)).toBe(false);
    });

    it('should return true when wild_shape max is 0', () => {
      runtimeState.getRuntimeValue.mockReturnValue(null);
      const ps = makePlayerStats({
        class: { class_levels: [{ level: 5, wild_shape: 0 }] },
      });
      const action = makeAction({ resourceCost: 'wild_shape' });

      expect(isExhausted(action, ps, campaignName)).toBe(true);
    });
  });

  describe('uses / usesMax resource cost', () => {
    it('should return true when current uses are 0', () => {
      runtimeState.getRuntimeValue.mockReturnValue(0);
      const action = makeAction({ usesMax: 1 });

      expect(isExhausted(action, makePlayerStats(), campaignName)).toBe(true);
    });

    it('should return false when uses are available', () => {
      runtimeState.getRuntimeValue.mockReturnValue(1);
      const action = makeAction({ usesMax: 1 });

      expect(isExhausted(action, makePlayerStats(), campaignName)).toBe(false);
    });

    it('should use resolveUses fallback when usesMax is undefined', () => {
      automationExpressions.resolveUses.mockReturnValue(3);
      runtimeState.getRuntimeValue.mockReturnValue(2);
      const action = makeAction({ uses: '1_per_long_rest' });

      expect(isExhausted(action, makePlayerStats(), campaignName)).toBe(false);
    });

    it('should return false when both uses and usesMax are undefined', () => {
      const action = makeAction({});

      expect(isExhausted(action, makePlayerStats(), campaignName)).toBe(false);
    });
  });
});
