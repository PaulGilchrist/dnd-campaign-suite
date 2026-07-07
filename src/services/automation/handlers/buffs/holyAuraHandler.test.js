// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks BEFORE imports ───────────────────────────────────────

vi.mock('../../common/buffToggle.js', () => ({
  toggleBuff: vi.fn(),
}));

vi.mock('../../../rules/effects/expirations.js', () => ({
  addExpiration: vi.fn(),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

// ── Imports ────────────────────────────────────────────────────

import { handle, getHolyAuraTargets, isHolyAuraActive } from './holyAuraHandler.js';
import * as buffToggle from '../../common/buffToggle.js';
import * as expirations from '../../../rules/effects/expirations.js';
import * as runtimeState from '../../../../hooks/runtime/useRuntimeState.js';

// ── Helpers ────────────────────────────────────────────────────

const campaignName = 'TestCampaign';

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestHero',
    ...overrides,
  };
}

function makeAction(automation = {}) {
  return {
    name: 'Holy Aura',
    automation: {
      type: 'buff',
      ...automation,
    },
  };
}

function resetMocks() {
  buffToggle.toggleBuff.mockClear();
  expirations.addExpiration.mockClear();
  runtimeState.setRuntimeValue.mockClear();
}

// ── Tests ──────────────────────────────────────────────────────

describe('holyAuraHandler.handle', () => {
  beforeEach(() => {
    resetMocks();
  });

  describe('buff activation and deactivation', () => {
    it.each([
      [false, 'activated', 'activation'],
      [true, 'deactivated', 'deactivation'],
    ])('toggles the buff and returns %s popup when wasActive is %p', async (wasActive, expectedDesc, _label) => {
      const ps = makePlayerStats({ name: 'PaladinSteve' });
      const action = makeAction({ auraRange: 30 });
      buffToggle.toggleBuff.mockReturnValue({ wasActive });

      const result = await handle(action, ps, campaignName, null);

      expect(buffToggle.toggleBuff).toHaveBeenCalledWith(
        ps.name,
        action.name,
        {
          type: 'buff',
          auraRange: 30,
          effect: 'holy_aura',
        },
        campaignName
      );
      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.name).toBe(action.name);
      expect(result.payload.automationType).toBe(action.automation.type);
      expect(result.payload.description).toBe(`${action.name} ${expectedDesc}`);
      expect(result.payload.automation).toBe(action.automation);
    });

    it.each([
      [0, 30],
      [null, 30],
      [undefined, 30],
      [15, 15],
      [60, 60],
    ])('uses auraRange=%p — falls back to %p for falsy values', async (auraRange, expectedRange) => {
      const ps = makePlayerStats();
      const action = makeAction(auraRange != null ? { auraRange } : {});
      buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

      await handle(action, ps, campaignName, null);

      expect(buffToggle.toggleBuff).toHaveBeenCalledWith(
        ps.name,
        action.name,
        { type: 'buff', auraRange: expectedRange, effect: 'holy_aura' },
        campaignName
      );
    });

    it('resets targets and registers expiration on activation', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

      await handle(action, ps, campaignName, null);

      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        ps.name,
        'holyAuraTargets',
        [],
        campaignName
      );
      expect(expirations.addExpiration).toHaveBeenCalledWith(
        ps.name,
        ps.name,
        [{ type: 'remove_active_buff', buffName: 'Holy Aura' }],
        campaignName
      );
    });

    it('resets targets on deactivation without registering expiration', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      buffToggle.toggleBuff.mockReturnValue({ wasActive: true });

      await handle(action, ps, campaignName, null);

      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        ps.name,
        'holyAuraTargets',
        [],
        campaignName
      );
      expect(expirations.addExpiration).not.toHaveBeenCalled();
    });
  });
});

describe('holyAuraHandler.getHolyAuraTargets', () => {
  beforeEach(() => {
    resetMocks();
  });

  it('returns the stored targets array when it is a valid array', () => {
    const targets = ['Enemy1', 'Enemy2'];
    runtimeState.getRuntimeValue.mockReturnValue(targets);

    const result = getHolyAuraTargets('TestHero', campaignName);

    expect(result).toBe(targets);
    expect(runtimeState.getRuntimeValue).toHaveBeenCalledWith(
      'TestHero',
      'holyAuraTargets',
      campaignName
    );
  });

  it('returns an empty array for non-array stored values', () => {
    runtimeState.getRuntimeValue.mockReturnValue(null);

    const result = getHolyAuraTargets('TestHero', campaignName);

    expect(result).toEqual([]);
  });

  it('uses the playerName and campaignName parameters correctly', () => {
    runtimeState.getRuntimeValue.mockReturnValue([]);

    getHolyAuraTargets('DifferentPlayer', 'OtherCampaign');

    expect(runtimeState.getRuntimeValue).toHaveBeenCalledWith(
      'DifferentPlayer',
      'holyAuraTargets',
      'OtherCampaign'
    );
  });
});

describe('holyAuraHandler.isHolyAuraActive', () => {
  beforeEach(() => {
    resetMocks();
  });

  it('returns true when activeBuffs contains a matching buff', () => {
    runtimeState.getRuntimeValue.mockImplementation((_name, key) => {
      if (key === 'activeBuffs') return [{ name: 'Holy Aura', effect: 'holy_aura' }];
      return null;
    });

    expect(isHolyAuraActive('TestHero', campaignName)).toBe(true);
  });

  it('returns false when activeBuffs is invalid or empty', () => {
    runtimeState.getRuntimeValue.mockReturnValue(null);

    expect(isHolyAuraActive('TestHero', campaignName)).toBe(false);
  });

  it('returns false when a buff has the wrong name or effect', () => {
    runtimeState.getRuntimeValue.mockReturnValue([
      { name: 'Holy Aura', effect: 'fire_shield' },
    ]);

    expect(isHolyAuraActive('TestHero', campaignName)).toBe(false);
  });
});
