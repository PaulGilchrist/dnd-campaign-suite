// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { handle } from './holyNimbusHandler.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

const campaignName = 'TestCampaign';

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestCleric',
    level: 5,
    proficiency: 3,
    class: { class_levels: [{ level: 5, channel_divinity: 2 }] },
    ...overrides,
  };
}

function makeAction(automation = {}) {
  return {
    name: 'Holy Nimbus',
    automation: { type: 'holy_nimbus', ...automation },
  };
}

function mockActive(remainingCharges, existingBuffs = []) {
  getRuntimeValue.mockImplementation((name, key) => {
    if (key === 'holyNimbusActive') return false;
    if (key === 'channelDivinityCharges') return remainingCharges;
    if (key === 'activeBuffs') return existingBuffs;
    return null;
  });
}

function mockInactive(existingBuffs = []) {
  getRuntimeValue.mockImplementation((name, key) => {
    if (key === 'holyNimbusActive') return true;
    if (key === 'activeBuffs') return existingBuffs;
    return null;
  });
}

describe('holyNimbusHandler.handle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('deactivation', () => {
    it('returns popup and sets holyNimbusActive to false when already active', async () => {
      mockInactive([{ name: 'Holy Nimbus', effect: 'sunlight_aura' }]);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toBe('Holy Nimbus ended.');
      expect(result.payload.automationType).toBe('holy_nimbus');
      expect(result.payload.automation).toEqual(makeAction().automation);
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'TestCleric',
        'holyNimbusActive',
        false,
        campaignName,
      );
    });

    it('filters out the Holy Nimbus buff by action name', async () => {
      mockInactive([
        { name: 'Other Buff', effect: 'other' },
        { name: 'Holy Nimbus', effect: 'sunlight_aura' },
      ]);

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'TestCleric',
        'activeBuffs',
        [{ name: 'Other Buff', effect: 'other' }],
        campaignName,
      );
    });
  });

  describe('charge validation', () => {
    it('returns error popup when charges are zero or negative', async () => {
      mockActive(0);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toBe('No Channel Divinity charges remaining.');
      expect(setRuntimeValue).not.toHaveBeenCalled();
    });
  });

  describe('activation', () => {
    it('spends one charge and sets holyNimbusActive to true', async () => {
      mockActive(2);

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(setRuntimeValue).toHaveBeenNthCalledWith(
        1,
        'TestCleric',
        'channelDivinityCharges',
        1,
        campaignName,
      );
      expect(setRuntimeValue).toHaveBeenNthCalledWith(
        2,
        'TestCleric',
        'holyNimbusActive',
        true,
        campaignName,
      );
    });

    it('adds a sunlight_aura buff when none exist', async () => {
      mockActive(2);

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'TestCleric',
        'activeBuffs',
        expect.arrayContaining([
          expect.objectContaining({
            name: 'Holy Nimbus',
            effect: 'sunlight_aura',
            duration: '10_minutes',
            distance: '10_ft',
          }),
        ]),
        campaignName,
      );
    });

    it('appends the buff to existing buffs', async () => {
      mockActive(2, [{ name: 'Other Buff', effect: 'other' }]);

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'TestCleric',
        'activeBuffs',
        expect.arrayContaining([
          expect.objectContaining({ name: 'Other Buff' }),
          expect.objectContaining({ name: 'Holy Nimbus' }),
        ]),
        campaignName,
      );
    });

    it('does not duplicate the buff if already present', async () => {
      mockActive(2, [
        { name: 'Holy Nimbus', effect: 'sunlight_aura', duration: '10_minutes', distance: '10_ft' },
      ]);

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'TestCleric',
        'activeBuffs',
        [{ name: 'Holy Nimbus', effect: 'sunlight_aura', duration: '10_minutes', distance: '10_ft' }],
        campaignName,
      );
    });

    it('falls back to class_specific.channel_divinity_charges when channel_divinity is absent', async () => {
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'holyNimbusActive') return false;
        if (key === 'channelDivinityCharges') return null;
        if (key === 'activeBuffs') return [];
        return null;
      });

      const ps = makePlayerStats({
        level: 1,
        class: { class_levels: [{ level: 1, channel_divinity: undefined, class_specific: { channel_divinity_charges: 3 } }] },
      });

      await handle(makeAction(), ps, campaignName, null);

      // maxCharges=3 (from class_specific), spent 1 => 2
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'TestCleric',
        'channelDivinityCharges',
        2,
        campaignName,
      );
    });
  });

  describe('success popup', () => {
    it('returns popup with correct description and payload fields', async () => {
      mockActive(2);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.name).toBe('Holy Nimbus');
      expect(result.payload.automationType).toBe('holy_nimbus');
      expect(result.payload.description).toBe(
        'Holy Nimbus activated! Aura of Protection is imbued with holy power for 10 minutes.',
      );
      expect(result.payload.automation).toEqual(makeAction().automation);
    });
  });
});
