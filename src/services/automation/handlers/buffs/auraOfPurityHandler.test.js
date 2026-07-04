// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

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

import {
  handle,
  getAuraOfPuritySaveAdvantageConditions,
  isAuraOfPurityActive,
} from './auraOfPurityHandler.js';
import * as buffToggle from '../../common/buffToggle.js';
import * as expirations from '../../../rules/effects/expirations.js';
import * as runtimeState from '../../../../hooks/runtime/useRuntimeState.js';

const CAMPAIGN_NAME = 'TestCampaign';
const PLAYER_NAME = 'TestHero';

function makePlayerStats(overrides = {}) {
  return { name: PLAYER_NAME, ...overrides };
}

function makeAction(automation = {}) {
  return {
    name: 'Aura of Purity',
    automation: { type: 'buff', ...automation },
  };
}

function resetMocks() {
  buffToggle.toggleBuff.mockClear();
  expirations.addExpiration.mockClear();
  runtimeState.setRuntimeValue.mockClear();
  runtimeState.getRuntimeValue.mockClear();
}

describe('auraOfPurityHandler.handle', () => {
  beforeEach(() => {
    resetMocks();
  });

  describe('toggleBuff calls', () => {
    it('passes playerName, buffName, merged effect object, and campaignName', async () => {
      const ps = makePlayerStats();
      const action = makeAction({
        resistanceTypes: ['fire', 'cold'],
        saveAdvantageConditions: ['frightened'],
        auraRange: 30,
      });
      buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

      await handle(action, ps, CAMPAIGN_NAME, null);

      expect(buffToggle.toggleBuff).toHaveBeenCalledWith(
        ps.name,
        action.name,
        {
          type: 'buff',
          resistanceTypes: ['fire', 'cold'],
          saveAdvantageConditions: ['frightened'],
          auraRange: 30,
          effect: 'aura_of_purity',
        },
        CAMPAIGN_NAME
      );
    });

    it('overrides any existing effect value to aura_of_purity and defaults missing arrays', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ effect: 'some_other_effect' });
      buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

      await handle(action, ps, CAMPAIGN_NAME, null);

      expect(buffToggle.toggleBuff).toHaveBeenCalledWith(
        ps.name,
        action.name,
        expect.objectContaining({ effect: 'aura_of_purity', resistanceTypes: [] }),
        CAMPAIGN_NAME
      );
    });

    it('passes extra automation properties through to the effect object', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ duration: '1 hour', extraProp: 'value' });
      buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

      await handle(action, ps, CAMPAIGN_NAME, null);

      expect(buffToggle.toggleBuff).toHaveBeenCalledWith(
        ps.name,
        action.name,
        expect.objectContaining({ duration: '1 hour', extraProp: 'value' }),
        CAMPAIGN_NAME
      );
    });
  });

  describe('expiration registration', () => {
    it('registers expiration on first activation (wasActive false)', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

      await handle(action, ps, CAMPAIGN_NAME, null);

      expect(expirations.addExpiration).toHaveBeenCalledWith(
        ps.name,
        ps.name,
        [{ type: 'remove_active_buff', buffName: action.name }],
        CAMPAIGN_NAME
      );
    });

    it('does not register expiration on deactivation (wasActive true)', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      buffToggle.toggleBuff.mockReturnValue({ wasActive: true });

      await handle(action, ps, CAMPAIGN_NAME, null);

      expect(expirations.addExpiration).not.toHaveBeenCalled();
    });
  });

  describe('runtime state management', () => {
    it('sets save advantage conditions when activating the buff', async () => {
      const ps = makePlayerStats();
      const action = makeAction({
        saveAdvantageConditions: ['frightened', 'poisoned'],
      });
      buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

      await handle(action, ps, CAMPAIGN_NAME, null);

      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        ps.name,
        'auraOfPuritySaveAdvantageConditions',
        ['frightened', 'poisoned'],
        CAMPAIGN_NAME
      );
    });

    it('clears save advantage conditions when deactivating the buff', async () => {
      const ps = makePlayerStats();
      const action = makeAction({
        saveAdvantageConditions: ['frightened'],
      });
      buffToggle.toggleBuff.mockReturnValue({ wasActive: true });

      await handle(action, ps, CAMPAIGN_NAME, null);

      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        ps.name,
        'auraOfPuritySaveAdvantageConditions',
        [],
        CAMPAIGN_NAME
      );
    });
  });

  describe('return value and descriptions', () => {
    it('returns a popup with automation_info payload and correct description on activation', async () => {
      const ps = makePlayerStats();
      const action = makeAction({
        resistanceTypes: ['fire', 'cold'],
        saveAdvantageConditions: ['frightened'],
      });
      buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

      const result = await handle(action, ps, CAMPAIGN_NAME, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.name).toBe(action.name);
      expect(result.payload.automationType).toBe(action.automation.type);
      expect(result.payload.automation).toEqual(action.automation);
      expect(result.payload.description).toContain('activated');
      expect(result.payload.description).toContain('Resistance to fire and cold damage');
      expect(result.payload.description).toContain('Advantage on saving throws');
      expect(result.payload.description).toContain('frightened');
    });

    it('returns a popup with deactivation text when wasActive is true', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      buffToggle.toggleBuff.mockReturnValue({ wasActive: true });

      const result = await handle(action, ps, CAMPAIGN_NAME, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('deactivated');
    });

    it('omits resistance and save advantage descriptions when arrays are empty or missing', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ resistanceTypes: [], saveAdvantageConditions: [] });
      buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

      const result = await handle(action, ps, CAMPAIGN_NAME, null);

      expect(result.payload.description).not.toContain('Resistance');
      expect(result.payload.description).not.toContain('Advantage on saving throws');
    });
  });

  describe('auraRange', () => {
    it.each([
      [0, 30],
      [null, 30],
      [undefined, 30],
      [15, 15],
      [30, 30],
      [60, 60],
    ])('uses auraRange=%p — falls back to 30 for falsy values', async (auraRange, expectedRange) => {
      const ps = makePlayerStats();
      const action = makeAction(auraRange != null ? { auraRange } : {});
      buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

      await handle(action, ps, CAMPAIGN_NAME, null);

      expect(buffToggle.toggleBuff).toHaveBeenCalledWith(
        ps.name,
        action.name,
        expect.objectContaining({ auraRange: expectedRange }),
        CAMPAIGN_NAME
      );
    });
  });
});

describe('auraOfPurityHandler.getAuraOfPuritySaveAdvantageConditions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the stored array when it is a valid array', () => {
    const conditions = ['frightened', 'poisoned'];
    runtimeState.getRuntimeValue.mockReturnValue(conditions);

    const result = getAuraOfPuritySaveAdvantageConditions(PLAYER_NAME, CAMPAIGN_NAME);

    expect(result).toBe(conditions);
    expect(runtimeState.getRuntimeValue).toHaveBeenCalledWith(
      PLAYER_NAME,
      'auraOfPuritySaveAdvantageConditions',
      CAMPAIGN_NAME
    );
  });

  it('returns an empty array for any non-array stored value', () => {
    const nonArrays = [null, undefined, 'not-an-array', 0, {}, { condition: 'frightened' }, '', true];

    for (const value of nonArrays) {
      runtimeState.getRuntimeValue.mockReturnValue(value);
      expect(getAuraOfPuritySaveAdvantageConditions(PLAYER_NAME, CAMPAIGN_NAME)).toEqual([]);
    }
  });

  it('returns an empty array when the stored value is an empty array', () => {
    runtimeState.getRuntimeValue.mockReturnValue([]);
    expect(getAuraOfPuritySaveAdvantageConditions(PLAYER_NAME, CAMPAIGN_NAME)).toEqual([]);
  });

  it('uses the playerName and campaignName parameters correctly', () => {
    runtimeState.getRuntimeValue.mockReturnValue([]);
    getAuraOfPuritySaveAdvantageConditions('DifferentPlayer', 'OtherCampaign');
    expect(runtimeState.getRuntimeValue).toHaveBeenCalledWith(
      'DifferentPlayer',
      'auraOfPuritySaveAdvantageConditions',
      'OtherCampaign'
    );
  });
});

describe('auraOfPurityHandler.isAuraOfPurityActive', () => {
  beforeEach(() => {
    runtimeState.getRuntimeValue.mockReset().mockReturnValue([]);
  });

  it('returns true when activeBuffs contains a buff with matching name and effect', () => {
    runtimeState.getRuntimeValue.mockImplementation((_name, key) => {
      if (key === 'activeBuffs') return [{ name: 'Aura of Purity', effect: 'aura_of_purity' }];
      return null;
    });

    expect(isAuraOfPurityActive(PLAYER_NAME, CAMPAIGN_NAME)).toBe(true);
  });

  it('returns false when activeBuffs is null, undefined, non-array, empty, or has wrong name/effect', () => {
    runtimeState.getRuntimeValue.mockReturnValue(null);
    expect(isAuraOfPurityActive(PLAYER_NAME, CAMPAIGN_NAME)).toBe(false);

    runtimeState.getRuntimeValue.mockReturnValue(undefined);
    expect(isAuraOfPurityActive(PLAYER_NAME, CAMPAIGN_NAME)).toBe(false);

    runtimeState.getRuntimeValue.mockReturnValue([]);
    expect(isAuraOfPurityActive(PLAYER_NAME, CAMPAIGN_NAME)).toBe(false);

    runtimeState.getRuntimeValue.mockReturnValue([
      { name: 'Fire Shield', effect: 'fire_resistance' },
      { name: 'Aura of Purity', effect: 'fire_shield' },
      { name: 'Other Aura', effect: 'aura_of_purity' },
    ]);
    expect(isAuraOfPurityActive(PLAYER_NAME, CAMPAIGN_NAME)).toBe(false);
  });

  it('returns true when multiple buffs include the matching Aura of Purity buff', () => {
    runtimeState.getRuntimeValue.mockReturnValue([
      { name: 'Shield', effect: 'shield' },
      { name: 'Aura of Purity', effect: 'aura_of_purity' },
      { name: 'mage_armor', effect: 'mage_armor' },
    ]);

    expect(isAuraOfPurityActive(PLAYER_NAME, CAMPAIGN_NAME)).toBe(true);
  });

  it('uses the playerName and campaignName parameters correctly', () => {
    runtimeState.getRuntimeValue.mockImplementation((_name, key) => {
      if (key === 'activeBuffs') return [{ name: 'Aura of Purity', effect: 'aura_of_purity' }];
      return null;
    });

    isAuraOfPurityActive('DifferentPlayer', 'OtherCampaign');

    expect(runtimeState.getRuntimeValue).toHaveBeenCalledWith(
      'DifferentPlayer',
      'activeBuffs',
      'OtherCampaign'
    );
  });
});
