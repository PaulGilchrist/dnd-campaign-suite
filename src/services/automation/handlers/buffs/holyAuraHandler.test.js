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

// ── Tests ──────────────────────────────────────────────────────

describe('holyAuraHandler.handle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Buff toggling', () => {
    it('should call toggleBuff with correct arguments when activating', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ auraRange: 30 });
      buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

      await handle(action, ps, campaignName, null);

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
    });

    it('should call toggleBuff when wasActive is true (deactivating)', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ auraRange: 60 });
      buffToggle.toggleBuff.mockReturnValue({ wasActive: true });

      await handle(action, ps, campaignName, null);

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
    });

    it('should use default auraRange of 30 when auto.auraRange is missing', async () => {
      const ps = makePlayerStats();
      const action = makeAction({});
      buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

      await handle(action, ps, campaignName, null);

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
    });

    it('should use playerStats.name from playerStats when activating', async () => {
      const ps = makePlayerStats({ name: 'PaladinSteve' });
      const action = makeAction();
      buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

      await handle(action, ps, campaignName, null);

      expect(buffToggle.toggleBuff).toHaveBeenCalledWith(
        'PaladinSteve',
        action.name,
        expect.any(Object),
        campaignName
      );
    });
  });

  describe('Expiration handling on activation', () => {
    it('should call addExpiration when buff was not active (activating)', async () => {
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
    });

    it('should NOT call addExpiration when buff was already active (deactivating)', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      buffToggle.toggleBuff.mockReturnValue({ wasActive: true });

      await handle(action, ps, campaignName, null);

      expect(expirations.addExpiration).not.toHaveBeenCalled();
    });
  });

  describe('Runtime value reset', () => {
    it('should setRuntimeValue for holyAuraTargets to empty array when activating', async () => {
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
    });

    it('should setRuntimeValue for holyAuraTargets to empty array when deactivating', async () => {
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
    });
  });

  describe('Return value', () => {
    it('should return popup type with automation_info payload when activating', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.name).toBe(action.name);
      expect(result.payload.automationType).toBe(action.automation.type);
      expect(result.payload.description).toBe(`${action.name} activated`);
      expect(result.payload.automation).toBe(action.automation);
    });

    it('should return popup type with deactivated description when wasActive is true', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      buffToggle.toggleBuff.mockReturnValue({ wasActive: true });

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toBe(`${action.name} deactivated`);
    });

    it('should pass through the mapName parameter without using it', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

      await handle(action, ps, campaignName, 'TestMap');

      expect(buffToggle.toggleBuff).toHaveBeenCalled();
    });
  });
});

describe('holyAuraHandler.getHolyAuraTargets', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return the stored array when it exists', () => {
    const targets = ['Enemy1', 'Enemy2'];
    runtimeState.getRuntimeValue.mockReturnValue(targets);

    const result = getHolyAuraTargets('TestHero', campaignName);

    expect(result).toEqual(targets);
    expect(runtimeState.getRuntimeValue).toHaveBeenCalledWith(
      'TestHero',
      'holyAuraTargets',
      campaignName
    );
  });

  it('should return empty array when stored value is null', () => {
    runtimeState.getRuntimeValue.mockReturnValue(null);

    const result = getHolyAuraTargets('TestHero', campaignName);

    expect(result).toEqual([]);
  });

  it('should return empty array when stored value is undefined', () => {
    runtimeState.getRuntimeValue.mockReturnValue(undefined);

    const result = getHolyAuraTargets('TestHero', campaignName);

    expect(result).toEqual([]);
  });

  it('should return empty array when stored value is not an array', () => {
    runtimeState.getRuntimeValue.mockReturnValue('not-an-array');

    const result = getHolyAuraTargets('TestHero', campaignName);

    expect(result).toEqual([]);
  });

  it('should return empty array when stored value is an object', () => {
    runtimeState.getRuntimeValue.mockReturnValue({ target: 'Enemy1' });

    const result = getHolyAuraTargets('TestHero', campaignName);

    expect(result).toEqual([]);
  });

  it('should return empty array when stored value is 0', () => {
    runtimeState.getRuntimeValue.mockReturnValue(0);

    const result = getHolyAuraTargets('TestHero', campaignName);

    expect(result).toEqual([]);
  });

  it('should return empty array when stored value is an empty string', () => {
    runtimeState.getRuntimeValue.mockReturnValue('');

    const result = getHolyAuraTargets('TestHero', campaignName);

    expect(result).toEqual([]);
  });

  it('should use the correct playerName parameter', () => {
    runtimeState.getRuntimeValue.mockReturnValue([]);

    getHolyAuraTargets('DifferentPlayer', campaignName);

    expect(runtimeState.getRuntimeValue).toHaveBeenCalledWith(
      'DifferentPlayer',
      'holyAuraTargets',
      campaignName
    );
  });

  it('should use the correct campaignName parameter', () => {
    runtimeState.getRuntimeValue.mockReturnValue([]);

    getHolyAuraTargets('TestHero', 'OtherCampaign');

    expect(runtimeState.getRuntimeValue).toHaveBeenCalledWith(
      'TestHero',
      'holyAuraTargets',
      'OtherCampaign'
    );
  });
});

describe('holyAuraHandler.isHolyAuraActive', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return true when Holy Aura buff with holy_aura effect exists', () => {
    runtimeState.getRuntimeValue.mockReturnValue([
      { name: 'Holy Aura', effect: 'holy_aura' },
    ]);

    const result = isHolyAuraActive('TestHero', campaignName);

    expect(result).toBe(true);
  });

  it('should return false when no buffs exist', () => {
    runtimeState.getRuntimeValue.mockReturnValue([]);

    const result = isHolyAuraActive('TestHero', campaignName);

    expect(result).toBe(false);
  });

  it('should return false when activeBuffs is null', () => {
    runtimeState.getRuntimeValue.mockReturnValue(null);

    const result = isHolyAuraActive('TestHero', campaignName);

    expect(result).toBe(false);
  });

  it('should return false when activeBuffs is undefined', () => {
    runtimeState.getRuntimeValue.mockReturnValue(undefined);

    const result = isHolyAuraActive('TestHero', campaignName);

    expect(result).toBe(false);
  });

  it('should return false when buff exists but has different name', () => {
    runtimeState.getRuntimeValue.mockReturnValue([
      { name: 'Fire Shield', effect: 'fire_resistance' },
    ]);

    const result = isHolyAuraActive('TestHero', campaignName);

    expect(result).toBe(false);
  });

  it('should return false when buff has same name but different effect', () => {
    runtimeState.getRuntimeValue.mockReturnValue([
      { name: 'Holy Aura', effect: 'fire_shield' },
    ]);

    const result = isHolyAuraActive('TestHero', campaignName);

    expect(result).toBe(false);
  });

  it('should return false when buff has same effect but different name', () => {
    runtimeState.getRuntimeValue.mockReturnValue([
      { name: 'Other Aura', effect: 'holy_aura' },
    ]);

    const result = isHolyAuraActive('TestHero', campaignName);

    expect(result).toBe(false);
  });

  it('should return true when multiple buffs include Holy Aura with holy_aura effect', () => {
    runtimeState.getRuntimeValue.mockReturnValue([
      { name: 'Shield', effect: 'shield' },
      { name: 'Holy Aura', effect: 'holy_aura' },
      { name: 'mage_armor', effect: 'mage_armor' },
    ]);

    const result = isHolyAuraActive('TestHero', campaignName);

    expect(result).toBe(true);
  });

  it('should use the correct playerName parameter', () => {
    runtimeState.getRuntimeValue.mockReturnValue([
      { name: 'Holy Aura', effect: 'holy_aura' },
    ]);

    isHolyAuraActive('DifferentPlayer', campaignName);

    expect(runtimeState.getRuntimeValue).toHaveBeenCalledWith(
      'DifferentPlayer',
      'activeBuffs',
      campaignName
    );
  });

  it('should use the correct campaignName parameter', () => {
    runtimeState.getRuntimeValue.mockReturnValue([
      { name: 'Holy Aura', effect: 'holy_aura' },
    ]);

    isHolyAuraActive('TestHero', 'OtherCampaign');

    expect(runtimeState.getRuntimeValue).toHaveBeenCalledWith(
      'TestHero',
      'activeBuffs',
      'OtherCampaign'
    );
  });

  it('should not throw when activeBuffs is not an array', () => {
    runtimeState.getRuntimeValue.mockReturnValue('not-an-array');

    const result = isHolyAuraActive('TestHero', campaignName);

    expect(result).toBe(false);
  });
});
