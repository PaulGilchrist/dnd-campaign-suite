// @maintained-by-ai
// Deterministic contract tests for holyNimbusHandler.handle: toggle on/off runtime
// writes (exact order), Channel Divinity charge spend and max-charge fallback, buff
// dedup, popup payload copy, campaign log, and log-failure resilience.
// Downstream consumers of holyNimbusActive (auraDamageService, expirations,
// SavePromptModal, savePromptUtils) own their own suites — this file pins the handler only.
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { handle } from './holyNimbusHandler.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';

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

  describe('toggle behavior', () => {
    it('deactivates when already active: removes buff, sets holyNimbusActive false, returns info popup', async () => {
      mockInactive([
        { name: 'Other Buff', effect: 'other' },
        { name: 'Holy Nimbus', effect: 'sunlight_aura' },
      ]);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toBe('Holy Nimbus ended.');
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'TestCleric',
        'activeBuffs',
        [{ name: 'Other Buff', effect: 'other' }],
        campaignName,
      );
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'TestCleric',
        'holyNimbusActive',
        false,
        campaignName,
      );
    });

    it('activates when inactive: spends one charge, sets holyNimbusActive true, adds buff, returns info popup', async () => {
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

    it('does not duplicate the buff when a stale Holy Nimbus buff is still listed (flag off)', async () => {
      mockActive(2, [
        { name: 'Other Buff', effect: 'other' },
        { name: 'Holy Nimbus', effect: 'sunlight_aura', duration: '10_minutes', distance: '10_ft' },
      ]);

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      // Exact array: pins that the stale buff is neither duplicated nor replaced.
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'TestCleric',
        'activeBuffs',
        [
          { name: 'Other Buff', effect: 'other' },
          { name: 'Holy Nimbus', effect: 'sunlight_aura', duration: '10_minutes', distance: '10_ft' },
        ],
        campaignName,
      );
    });
  });

  describe('charge validation', () => {
    it('returns error popup when charges are zero', async () => {
      mockActive(0);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toBe('No Channel Divinity charges remaining.');
      expect(setRuntimeValue).not.toHaveBeenCalled();
    });

    it('falls back to class max charges when nothing is stored yet', async () => {
      mockActive(null);

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(setRuntimeValue).toHaveBeenNthCalledWith(
        1,
        'TestCleric',
        'channelDivinityCharges',
        1,
        campaignName,
      );
    });
  });

  describe('campaign log', () => {
    it('logs an ability_use entry on activation', async () => {
      mockActive(2);

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
        type: 'ability_use',
        characterName: 'TestCleric',
        abilityName: 'Holy Nimbus',
        description: 'TestCleric activated Holy Nimbus. Aura of Protection gains holy power for 10 minutes.',
      }));
    });

    it('still returns the popup and activates when the log service fails', async () => {
      mockActive(2);
      const consoleErrorSpy = vi.spyOn(console, 'error').mockReturnValue();

      addEntry.mockRejectedValueOnce(new Error('Log service down'));

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toBe(
        'Holy Nimbus activated! Aura of Protection is imbued with holy power for 10 minutes.',
      );
      expect(consoleErrorSpy).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });
  });
});
