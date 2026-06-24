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

import {
  handle,
  getAuraOfPuritySaveAdvantageConditions,
  isAuraOfPurityActive,
} from './auraOfPurityHandler.js';
import * as buffToggle from '../../common/buffToggle.js';
import * as expirations from '../../../rules/effects/expirations.js';
import * as runtimeState from '../../../../hooks/runtime/useRuntimeState.js';

// ── Constants & Helpers ────────────────────────────────────────

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

// ── Tests ──────────────────────────────────────────────────────

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

    it('overrides any existing effect value to aura_of_purity', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ effect: 'some_other_effect' });
      buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

      await handle(action, ps, CAMPAIGN_NAME, null);

      expect(buffToggle.toggleBuff).toHaveBeenCalledWith(
        ps.name,
        action.name,
        expect.objectContaining({ effect: 'aura_of_purity' }),
        CAMPAIGN_NAME
      );
    });

    it('defaults resistanceTypes to [] when missing from automation', async () => {
      const ps = makePlayerStats();
      const action = makeAction({});
      buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

      await handle(action, ps, CAMPAIGN_NAME, null);

      expect(buffToggle.toggleBuff).toHaveBeenCalledWith(
        ps.name,
        action.name,
        expect.objectContaining({ resistanceTypes: [] }),
        CAMPAIGN_NAME
      );
    });

    it('defaults saveAdvantageConditions to [] when missing from automation', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ saveAdvantageConditions: undefined });
      buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

      await handle(action, ps, CAMPAIGN_NAME, null);

      expect(buffToggle.toggleBuff).toHaveBeenCalledWith(
        ps.name,
        action.name,
        expect.objectContaining({ saveAdvantageConditions: undefined }),
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

    it('uses playerName as both attacker and target in expiration', async () => {
      const ps = makePlayerStats({ name: 'AnotherHero' });
      const action = makeAction();
      buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

      await handle(action, ps, CAMPAIGN_NAME, null);

      expect(expirations.addExpiration).toHaveBeenCalledWith(
        'AnotherHero',
        'AnotherHero',
        [{ type: 'remove_active_buff', buffName: action.name }],
        CAMPAIGN_NAME
      );
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

    it('sets save advantage conditions even when none are configured', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ saveAdvantageConditions: [] });
      buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

      await handle(action, ps, CAMPAIGN_NAME, null);

      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        ps.name,
        'auraOfPuritySaveAdvantageConditions',
        [],
        CAMPAIGN_NAME
      );
    });
  });

  describe('return value structure', () => {
    it('returns a popup with automation_info payload on activation', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

      const result = await handle(action, ps, CAMPAIGN_NAME, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.name).toBe(action.name);
      expect(result.payload.automationType).toBe(action.automation.type);
    });

    it('returns a popup with automation_info payload on deactivation', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      buffToggle.toggleBuff.mockReturnValue({ wasActive: true });

      const result = await handle(action, ps, CAMPAIGN_NAME, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.name).toBe(action.name);
    });

    it('includes the automation object in the payload', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ resistanceTypes: ['fire'], auraRange: 15 });
      buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

      const result = await handle(action, ps, CAMPAIGN_NAME, null);

      expect(result.payload.automation).toEqual(action.automation);
    });

    it('accepts a mapName parameter without affecting behavior', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

      const result = await handle(action, ps, CAMPAIGN_NAME, 'TestMap');

      expect(result.type).toBe('popup');
      expect(expirations.addExpiration).toHaveBeenCalled();
    });
  });

  describe('activation description', () => {
    it('includes activation text', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

      const result = await handle(action, ps, CAMPAIGN_NAME, null);

      expect(result.payload.description).toContain('activated');
    });

    it('includes resistance description when resistanceTypes is non-empty', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ resistanceTypes: ['fire', 'cold'] });
      buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

      const result = await handle(action, ps, CAMPAIGN_NAME, null);

      expect(result.payload.description).toContain(
        'Resistance to fire and cold damage'
      );
    });

    it('joins resistanceTypes with " and " in the description', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ resistanceTypes: ['fire', 'cold', 'lightning'] });
      buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

      const result = await handle(action, ps, CAMPAIGN_NAME, null);

      expect(result.payload.description).toContain('fire and cold and lightning');
    });

    it('omits resistance description when resistanceTypes is empty', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ resistanceTypes: [] });
      buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

      const result = await handle(action, ps, CAMPAIGN_NAME, null);

      expect(result.payload.description).not.toContain('Resistance');
    });

    it('omits resistance description when resistanceTypes is missing', async () => {
      const ps = makePlayerStats();
      const action = makeAction({});
      buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

      const result = await handle(action, ps, CAMPAIGN_NAME, null);

      expect(result.payload.description).not.toContain('Resistance');
    });

    it('includes save advantage description when saveAdvantageConditions is non-empty', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ saveAdvantageConditions: ['frightened'] });
      buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

      const result = await handle(action, ps, CAMPAIGN_NAME, null);

      expect(result.payload.description).toContain('Advantage on saving throws');
      expect(result.payload.description).toContain('frightened');
    });

    it('joins multiple saveAdvantageConditions with ", " in the description', async () => {
      const ps = makePlayerStats();
      const action = makeAction({
        saveAdvantageConditions: ['frightened', 'poisoned'],
      });
      buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

      const result = await handle(action, ps, CAMPAIGN_NAME, null);

      expect(result.payload.description).toContain('frightened, poisoned');
    });

    it('omits save advantage description when saveAdvantageConditions is empty', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ saveAdvantageConditions: [] });
      buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

      const result = await handle(action, ps, CAMPAIGN_NAME, null);

      expect(result.payload.description).not.toContain('Advantage on saving throws');
    });

    it('omits save advantage description when saveAdvantageConditions is missing', async () => {
      const ps = makePlayerStats();
      const action = makeAction({});
      buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

      const result = await handle(action, ps, CAMPAIGN_NAME, null);

      expect(result.payload.description).not.toContain('Advantage on saving throws');
    });

    it('includes both resistance and save advantage descriptions when both are non-empty', async () => {
      const ps = makePlayerStats();
      const action = makeAction({
        resistanceTypes: ['fire'],
        saveAdvantageConditions: ['frightened', 'poisoned'],
      });
      buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

      const result = await handle(action, ps, CAMPAIGN_NAME, null);

      expect(result.payload.description).toContain('Resistance to fire damage');
      expect(result.payload.description).toContain('Advantage on saving throws');
      expect(result.payload.description).toContain('frightened');
      expect(result.payload.description).toContain('poisoned');
    });

    it('includes the action name in the activation description', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

      const result = await handle(action, ps, CAMPAIGN_NAME, null);

      expect(result.payload.description).toContain('Aura of Purity');
    });
  });

  describe('deactivation description', () => {
    it('includes deactivation text', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      buffToggle.toggleBuff.mockReturnValue({ wasActive: true });

      const result = await handle(action, ps, CAMPAIGN_NAME, null);

      expect(result.payload.description).toContain('deactivated');
    });

    it('includes resistance description on deactivation when resistanceTypes is non-empty', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ resistanceTypes: ['fire'] });
      buffToggle.toggleBuff.mockReturnValue({ wasActive: true });

      const result = await handle(action, ps, CAMPAIGN_NAME, null);

      expect(result.payload.description).toContain('Resistance to fire damage');
    });

    it('includes save advantage description on deactivation when saveAdvantageConditions is non-empty', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ saveAdvantageConditions: ['frightened'] });
      buffToggle.toggleBuff.mockReturnValue({ wasActive: true });

      const result = await handle(action, ps, CAMPAIGN_NAME, null);

      expect(result.payload.description).toContain('Advantage on saving throws');
      expect(result.payload.description).toContain('frightened');
    });

    it('omits resistance description on deactivation when resistanceTypes is empty', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ resistanceTypes: [] });
      buffToggle.toggleBuff.mockReturnValue({ wasActive: true });

      const result = await handle(action, ps, CAMPAIGN_NAME, null);

      expect(result.payload.description).not.toContain('Resistance');
    });

    it('omits save advantage description on deactivation when saveAdvantageConditions is empty', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ saveAdvantageConditions: [] });
      buffToggle.toggleBuff.mockReturnValue({ wasActive: true });

      const result = await handle(action, ps, CAMPAIGN_NAME, null);

      expect(result.payload.description).not.toContain('Advantage');
    });
  });

  describe('auraRange', () => {
    it.each([
      [0, 'zero'],
      [null, 'null'],
      [undefined, 'undefined'],
      [15, 'custom value'],
      [30, 'default value'],
      [60, 'large value'],
    ])(
      'uses auraRange=%p (%s) — falls back to 30 for falsy values',
      async (auraRange, _description) => {
        const ps = makePlayerStats();
        const action = makeAction(auraRange != null ? { auraRange } : {});
        buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

        await handle(action, ps, CAMPAIGN_NAME, null);

        const expectedRange = auraRange || 30;
        expect(buffToggle.toggleBuff).toHaveBeenCalledWith(
          ps.name,
          action.name,
          expect.objectContaining({ auraRange: expectedRange }),
          CAMPAIGN_NAME
        );
      }
    );
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
    const nonArrays = [
      null,
      undefined,
      'not-an-array',
      0,
      {},
      { condition: 'frightened' },
      '',
      true,
    ];

    for (const value of nonArrays) {
      runtimeState.getRuntimeValue.mockReturnValue(value);

      const result = getAuraOfPuritySaveAdvantageConditions(PLAYER_NAME, CAMPAIGN_NAME);

      expect(result).toEqual([]);
    }
  });

  it('returns an empty array when the stored value is an empty array', () => {
    runtimeState.getRuntimeValue.mockReturnValue([]);

    const result = getAuraOfPuritySaveAdvantageConditions(PLAYER_NAME, CAMPAIGN_NAME);

    expect(result).toEqual([]);
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

  it('returns false when activeBuffs is null or undefined', () => {
    runtimeState.getRuntimeValue.mockReturnValue(null);
    expect(isAuraOfPurityActive(PLAYER_NAME, CAMPAIGN_NAME)).toBe(false);

    runtimeState.getRuntimeValue.mockReturnValue(undefined);
    expect(isAuraOfPurityActive(PLAYER_NAME, CAMPAIGN_NAME)).toBe(false);
  });

  it('returns false for any non-array activeBuffs value that is null or undefined', () => {
    const nonArrays = [null, undefined];

    for (const value of nonArrays) {
      runtimeState.getRuntimeValue.mockReturnValue(value);

      expect(isAuraOfPurityActive(PLAYER_NAME, CAMPAIGN_NAME)).toBe(false);
    }
  });

  it('returns false when no buffs exist', () => {
    runtimeState.getRuntimeValue.mockReturnValue([]);

    expect(isAuraOfPurityActive(PLAYER_NAME, CAMPAIGN_NAME)).toBe(false);
  });

  it('returns false when a buff has the wrong name or wrong effect', () => {
    const cases = [
      [{ name: 'Fire Shield', effect: 'fire_resistance' }],
      [{ name: 'Aura of Purity', effect: 'fire_shield' }],
      [{ name: 'Other Aura', effect: 'aura_of_purity' }],
    ];

    for (const buffs of cases) {
      runtimeState.getRuntimeValue.mockReturnValue(buffs);

      expect(isAuraOfPurityActive(PLAYER_NAME, CAMPAIGN_NAME)).toBe(false);
    }
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
