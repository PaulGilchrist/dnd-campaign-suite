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
    it('toggles the buff and returns an activation popup when the buff is not active', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ auraRange: 30 });
      buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

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
      expect(result.payload.description).toBe(`${action.name} activated`);
      expect(result.payload.automation).toBe(action.automation);
    });

    it('toggles the buff and returns a deactivation popup when the buff is already active', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ auraRange: 60 });
      buffToggle.toggleBuff.mockReturnValue({ wasActive: true });

      const result = await handle(action, ps, campaignName, null);

      expect(buffToggle.toggleBuff).toHaveBeenCalledWith(
        ps.name,
        action.name,
        {
          type: 'buff',
          auraRange: 60,
          effect: 'holy_aura',
        },
        campaignName
      );
      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toBe(`${action.name} deactivated`);
      expect(result.payload.automation).toBe(action.automation);
    });

    it('uses default auraRange of 30 when automation.auraRange is missing', async () => {
      const ps = makePlayerStats();
      const action = makeAction({});
      buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

      await handle(action, ps, campaignName, null);

      expect(buffToggle.toggleBuff).toHaveBeenCalledWith(
        ps.name,
        action.name,
        { type: 'buff', auraRange: 30, effect: 'holy_aura' },
        campaignName
      );
    });

    it.each([
      [0, 'zero'],
      [null, 'null'],
      [undefined, 'undefined'],
      [15, 'custom value'],
    ])('uses auraRange=%p (%s) — falls back to 30 for falsy values', async (auraRange, _description) => {
      const ps = makePlayerStats();
      const action = makeAction(auraRange != null ? { auraRange } : {});
      buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

      await handle(action, ps, campaignName, null);

      const expectedRange = auraRange || 30;
      expect(buffToggle.toggleBuff).toHaveBeenCalledWith(
        ps.name,
        action.name,
        { type: 'buff', auraRange: expectedRange, effect: 'holy_aura' },
        campaignName
      );
    });
  });

  describe('expiration and runtime state management', () => {
    it('registers an expiration and resets targets when activating the buff', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

      await handle(action, ps, campaignName, null);

      expect(expirations.addExpiration).toHaveBeenCalledWith(
        ps.name,
        ps.name,
        [{ type: 'remove_active_buff', buffName: action.name }],
        campaignName
      );
      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        ps.name,
        'holyAuraTargets',
        [],
        campaignName
      );
    });

    it('resets targets but does not register an expiration when deactivating the buff', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      buffToggle.toggleBuff.mockReturnValue({ wasActive: true });

      await handle(action, ps, campaignName, null);

      expect(expirations.addExpiration).not.toHaveBeenCalled();
      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        ps.name,
        'holyAuraTargets',
        [],
        campaignName
      );
    });
  });

  describe('return value structure', () => {
    it('includes name, automationType, and automation in the popup payload on activation', async () => {
      const ps = makePlayerStats({ name: 'PaladinSteve' });
      const action = makeAction({ auraRange: 30 });
      buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload).toEqual(
        expect.objectContaining({
          type: 'automation_info',
          name: action.name,
          automationType: action.automation.type,
          description: `${action.name} activated`,
          automation: action.automation,
        })
      );
    });

    it('includes name, automationType, and automation in the popup payload on deactivation', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      buffToggle.toggleBuff.mockReturnValue({ wasActive: true });

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload).toEqual(
        expect.objectContaining({
          name: action.name,
          automationType: action.automation.type,
          automation: action.automation,
        })
      );
    });

    it('accepts a mapName parameter without affecting behavior', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

      await handle(action, ps, campaignName, 'TestMap');

      expect(buffToggle.toggleBuff).toHaveBeenCalled();
      expect(expirations.addExpiration).toHaveBeenCalled();
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

  it('returns an empty array for any non-array stored value', () => {
    const nonArrays = [null, undefined, 'not-an-array', 0, {}, { target: 'Enemy1' }, '', true];

    for (const value of nonArrays) {
      runtimeState.getRuntimeValue.mockReturnValue(value);

      const result = getHolyAuraTargets('TestHero', campaignName);

      expect(result).toEqual([]);
    }
  });

  it('returns an empty array when the stored value is an empty array', () => {
    runtimeState.getRuntimeValue.mockReturnValue([]);

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

  it('returns true when activeBuffs contains a buff with matching name and effect', () => {
    runtimeState.getRuntimeValue.mockImplementation((_name, key) => {
      if (key === 'activeBuffs') return [{ name: 'Holy Aura', effect: 'holy_aura' }];
      return null;
    });

    expect(isHolyAuraActive('TestHero', campaignName)).toBe(true);
  });

  it('returns false when activeBuffs is null or undefined', () => {
    runtimeState.getRuntimeValue.mockReturnValue(null);
    expect(isHolyAuraActive('TestHero', campaignName)).toBe(false);

    runtimeState.getRuntimeValue.mockReturnValue(undefined);
    expect(isHolyAuraActive('TestHero', campaignName)).toBe(false);
  });

  it('returns false for any non-array activeBuffs value', () => {
    runtimeState.getRuntimeValue.mockReturnValue('not-an-array');
    expect(isHolyAuraActive('TestHero', campaignName)).toBe(false);
  });

  it('returns false when no buffs exist', () => {
    runtimeState.getRuntimeValue.mockReturnValue([]);

    expect(isHolyAuraActive('TestHero', campaignName)).toBe(false);
  });

  it('returns false when a buff has the wrong name or wrong effect', () => {
    const cases = [
      [{ name: 'Fire Shield', effect: 'fire_resistance' }, 'different name and effect'],
      [{ name: 'Holy Aura', effect: 'fire_shield' }, 'wrong effect'],
      [{ name: 'Other Aura', effect: 'holy_aura' }, 'wrong name'],
    ];

    for (const [buffs] of cases) {
      runtimeState.getRuntimeValue.mockReturnValue(buffs);

      expect(isHolyAuraActive('TestHero', campaignName)).toBe(false);
    }
  });

  it('returns true when multiple buffs include the matching Holy Aura buff', () => {
    runtimeState.getRuntimeValue.mockReturnValue([
      { name: 'Shield', effect: 'shield' },
      { name: 'Holy Aura', effect: 'holy_aura' },
      { name: 'mage_armor', effect: 'mage_armor' },
    ]);

    expect(isHolyAuraActive('TestHero', campaignName)).toBe(true);
  });

  it('uses the playerName and campaignName parameters correctly', () => {
    runtimeState.getRuntimeValue.mockImplementation((_name, key) => {
      if (key === 'activeBuffs') return [{ name: 'Holy Aura', effect: 'holy_aura' }];
      return null;
    });

    isHolyAuraActive('DifferentPlayer', 'OtherCampaign');

    expect(runtimeState.getRuntimeValue).toHaveBeenCalledWith(
      'DifferentPlayer',
      'activeBuffs',
      'OtherCampaign'
    );
  });
});
