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

import { handle, getAuraOfPuritySaveAdvantageConditions, isAuraOfPurityActive } from './auraOfPurityHandler.js';
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
    name: 'Aura of Purity',
    automation: {
      type: 'buff',
      ...automation,
    },
  };
}

// ── Tests ──────────────────────────────────────────────────────

describe('auraOfPurityHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('handle', () => {
    it('should call toggleBuff with correct arguments when activating', async () => {
      const ps = makePlayerStats();
      const action = makeAction({
        resistanceTypes: ['fire', 'cold'],
        saveAdvantageConditions: ['frightened'],
        auraRange: 30,
      });
      buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

      await handle(action, ps, campaignName, null);

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
        campaignName
      );
    });

    it('should call toggleBuff with empty defaults when automation fields are missing', async () => {
      const ps = makePlayerStats();
      const action = makeAction({});
      buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

      await handle(action, ps, campaignName, null);

      expect(buffToggle.toggleBuff).toHaveBeenCalledWith(
        ps.name,
        action.name,
        expect.objectContaining({
          type: 'buff',
          auraRange: 30,
          effect: 'aura_of_purity',
        }),
        campaignName
      );
    });

    it('should call addExpiration when activating (wasActive is false)', async () => {
      const ps = makePlayerStats();
      const action = makeAction({});
      buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

      await handle(action, ps, campaignName, null);

      expect(expirations.addExpiration).toHaveBeenCalledWith(
        ps.name,
        ps.name,
        [{ type: 'remove_active_buff', buffName: action.name }],
        campaignName
      );
    });

    it('should NOT call addExpiration when deactivating (wasActive is true)', async () => {
      const ps = makePlayerStats();
      const action = makeAction({});
      buffToggle.toggleBuff.mockReturnValue({ wasActive: true });

      await handle(action, ps, campaignName, null);

      expect(expirations.addExpiration).not.toHaveBeenCalled();
    });

    it('should set save advantage conditions via setRuntimeValue when activating', async () => {
      const ps = makePlayerStats();
      const action = makeAction({
        saveAdvantageConditions: ['frightened', 'poisoned'],
      });
      buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

      await handle(action, ps, campaignName, null);

      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        ps.name,
        'auraOfPuritySaveAdvantageConditions',
        ['frightened', 'poisoned'],
        campaignName
      );
    });

    it('should clear save advantage conditions (set to []) when deactivating', async () => {
      const ps = makePlayerStats();
      const action = makeAction({
        saveAdvantageConditions: ['frightened'],
      });
      buffToggle.toggleBuff.mockReturnValue({ wasActive: true });

      await handle(action, ps, campaignName, null);

      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        ps.name,
        'auraOfPuritySaveAdvantageConditions',
        [],
        campaignName
      );
    });

    it('should return popup with "activated" description when wasActive is false', async () => {
      const ps = makePlayerStats();
      const action = makeAction({
        resistanceTypes: ['fire'],
        saveAdvantageConditions: ['frightened'],
      });
      buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.name).toBe(action.name);
      expect(result.payload.automationType).toBe(action.automation.type);
      expect(result.payload.description).toContain('activated');
    });

    it('should return popup with "deactivated" description when wasActive is true', async () => {
      const ps = makePlayerStats();
      const action = makeAction({
        resistanceTypes: ['fire'],
        saveAdvantageConditions: ['frightened'],
      });
      buffToggle.toggleBuff.mockReturnValue({ wasActive: true });

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.description).toContain('deactivated');
    });

    it('should include resistance description when resistanceTypes is non-empty', async () => {
      const ps = makePlayerStats();
      const action = makeAction({
        resistanceTypes: ['fire', 'cold'],
        saveAdvantageConditions: [],
      });
      buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.description).toContain('Resistance to fire and cold damage');
    });

    it('should NOT include resistance description when resistanceTypes is empty', async () => {
      const ps = makePlayerStats();
      const action = makeAction({
        resistanceTypes: [],
        saveAdvantageConditions: [],
      });
      buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.description).not.toContain('Resistance');
    });

    it('should include save advantage description when saveAdvantageConditions is non-empty', async () => {
      const ps = makePlayerStats();
      const action = makeAction({
        resistanceTypes: [],
        saveAdvantageConditions: ['frightened'],
      });
      buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.description).toContain('Advantage on saving throws');
      expect(result.payload.description).toContain('frightened');
    });

    it('should NOT include save advantage description when saveAdvantageConditions is empty', async () => {
      const ps = makePlayerStats();
      const action = makeAction({
        resistanceTypes: [],
        saveAdvantageConditions: [],
      });
      buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.description).not.toContain('Advantage on saving throws');
    });

    it('should join multiple saveAdvantageConditions with commas', async () => {
      const ps = makePlayerStats();
      const action = makeAction({
        resistanceTypes: [],
        saveAdvantageConditions: ['frightened', 'poisoned'],
      });
      buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.description).toContain('frightened, poisoned');
    });

    it('should include automation object in payload', async () => {
      const ps = makePlayerStats();
      const action = makeAction({
        resistanceTypes: ['fire'],
        saveAdvantageConditions: ['frightened'],
        auraRange: 15,
      });
      buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.automation).toEqual(action.automation);
    });

    it('should use auto.auraRange default of 30 when not provided', async () => {
      const ps = makePlayerStats();
      const action = makeAction({});
      buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

      await handle(action, ps, campaignName, null);

      expect(buffToggle.toggleBuff).toHaveBeenCalledWith(
        ps.name,
        action.name,
        expect.objectContaining({ auraRange: 30 }),
        campaignName
      );
    });

    it('should use custom auraRange when provided', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ auraRange: 15 });
      buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

      await handle(action, ps, campaignName, null);

      expect(buffToggle.toggleBuff).toHaveBeenCalledWith(
        ps.name,
        action.name,
        expect.objectContaining({ auraRange: 15 }),
        campaignName
      );
    });
  });

  describe('getAuraOfPuritySaveAdvantageConditions', () => {
    it('should return stored array when it exists', () => {
      runtimeState.getRuntimeValue.mockReturnValue(['frightened', 'poisoned']);

      const result = getAuraOfPuritySaveAdvantageConditions('TestHero', campaignName);

      expect(result).toEqual(['frightened', 'poisoned']);
      expect(runtimeState.getRuntimeValue).toHaveBeenCalledWith(
        'TestHero',
        'auraOfPuritySaveAdvantageConditions',
        campaignName
      );
    });

    it('should return empty array when stored value is null', () => {
      runtimeState.getRuntimeValue.mockReturnValue(null);

      const result = getAuraOfPuritySaveAdvantageConditions('TestHero', campaignName);

      expect(result).toEqual([]);
    });

    it('should return empty array when stored value is undefined', () => {
      runtimeState.getRuntimeValue.mockReturnValue(undefined);

      const result = getAuraOfPuritySaveAdvantageConditions('TestHero', campaignName);

      expect(result).toEqual([]);
    });

    it('should return empty array when stored value is not an array', () => {
      runtimeState.getRuntimeValue.mockReturnValue('not-an-array');

      const result = getAuraOfPuritySaveAdvantageConditions('TestHero', campaignName);

      expect(result).toEqual([]);
    });

    it('should return empty array when stored value is 0', () => {
      runtimeState.getRuntimeValue.mockReturnValue(0);

      const result = getAuraOfPuritySaveAdvantageConditions('TestHero', campaignName);

      expect(result).toEqual([]);
    });

    it('should return empty array when stored value is an empty string', () => {
      runtimeState.getRuntimeValue.mockReturnValue('');

      const result = getAuraOfPuritySaveAdvantageConditions('TestHero', campaignName);

      expect(result).toEqual([]);
    });
  });

  describe('isAuraOfPurityActive', () => {
    it('should return true when Aura of Purity buff with aura_of_purity effect exists', () => {
      runtimeState.getRuntimeValue.mockReturnValue([
        { name: 'Aura of Purity', effect: 'aura_of_purity' },
      ]);

      const result = isAuraOfPurityActive('TestHero', campaignName);

      expect(result).toBe(true);
    });

    it('should return false when no activeBuffs exist', () => {
      runtimeState.getRuntimeValue.mockReturnValue([]);

      const result = isAuraOfPurityActive('TestHero', campaignName);

      expect(result).toBe(false);
    });

    it('should return false when activeBuffs is null', () => {
      runtimeState.getRuntimeValue.mockReturnValue(null);

      const result = isAuraOfPurityActive('TestHero', campaignName);

      expect(result).toBe(false);
    });

    it('should return false when buff has different name', () => {
      runtimeState.getRuntimeValue.mockReturnValue([
        { name: 'Other Buff', effect: 'aura_of_purity' },
      ]);

      const result = isAuraOfPurityActive('TestHero', campaignName);

      expect(result).toBe(false);
    });

    it('should return false when buff has different effect', () => {
      runtimeState.getRuntimeValue.mockReturnValue([
        { name: 'Aura of Purity', effect: 'some_other_effect' },
      ]);

      const result = isAuraOfPurityActive('TestHero', campaignName);

      expect(result).toBe(false);
    });

    it('should return false when both name and effect differ', () => {
      runtimeState.getRuntimeValue.mockReturnValue([
        { name: 'Other Buff', effect: 'some_other_effect' },
      ]);

      const result = isAuraOfPurityActive('TestHero', campaignName);

      expect(result).toBe(false);
    });

    it('should return true when Aura of Purity buff exists among other buffs', () => {
      runtimeState.getRuntimeValue.mockReturnValue([
        { name: 'Rage', effect: 'rage' },
        { name: 'Aura of Purity', effect: 'aura_of_purity' },
        { name: 'Bardic Inspiration', effect: 'bardic_inspiration' },
      ]);

      const result = isAuraOfPurityActive('TestHero', campaignName);

      expect(result).toBe(true);
    });

    it('should use playerName to fetch activeBuffs from runtime state', () => {
      runtimeState.getRuntimeValue.mockReturnValue([
        { name: 'Aura of Purity', effect: 'aura_of_purity' },
      ]);

      isAuraOfPurityActive('DifferentHero', campaignName);

      expect(runtimeState.getRuntimeValue).toHaveBeenCalledWith(
        'DifferentHero',
        'activeBuffs',
        campaignName
      );
    });
  });
});
