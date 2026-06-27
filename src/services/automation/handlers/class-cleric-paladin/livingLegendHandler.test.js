// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks BEFORE imports ───────────────────────────────────────

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

// ── Imports ────────────────────────────────────────────────────

import {
  handle,
  setUnerringStrikeUsed,
} from './livingLegendHandler.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';

// ── Constants ──────────────────────────────────────────────────

const campaignName = 'TestCampaign';
const playerName = 'TestCleric';
const livingLegendKey = 'livingLegendActive';
const unerringStrikeKey = 'unerringStrikeUsed';

// ── Helpers ────────────────────────────────────────────────────

function makePlayerStats(overrides = {}) {
  return {
    name: playerName,
    ...overrides,
  };
}

function makeAction(overrides = {}) {
  return {
    name: 'Living Legend',
    automation: {
      type: 'living_legend',
      ...overrides.automation,
    },
    ...overrides,
  };
}

// ── Tests ──────────────────────────────────────────────────────

describe('livingLegendHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('handle', () => {
    it('returns popup with automation_info when ability is not yet active', async () => {
      getRuntimeValue.mockReturnValue(undefined);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.name).toBe('Living Legend');
    });

    it('includes automationType matching the action automation type', async () => {
      getRuntimeValue.mockReturnValue(undefined);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.payload.automationType).toBe('living_legend');
    });

    it('includes description listing all three effects', async () => {
      getRuntimeValue.mockReturnValue(undefined);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.payload.description).toContain('Charisma checks have advantage');
      expect(result.payload.description).toContain('reroll failed saving throws');
      expect(result.payload.description).toContain('missed weapon attacks hit once per turn');
    });

    it('passes through the automation object in the payload', async () => {
      getRuntimeValue.mockReturnValue(undefined);

      const action = makeAction({ customField: 'customValue' });
      const result = await handle(action, makePlayerStats(), campaignName, null);

      expect(result.payload.automation).toEqual(action.automation);
    });

    it('activates living legend by setting runtime value to true', async () => {
      getRuntimeValue.mockReturnValue(undefined);

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(setRuntimeValue).toHaveBeenCalledWith(
        playerName,
        livingLegendKey,
        true,
        campaignName,
      );
    });

    it('records an ability_use log entry on activation', async () => {
      getRuntimeValue.mockReturnValue(undefined);

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(addEntry).toHaveBeenCalledWith(campaignName, {
        type: 'ability_use',
        characterName: playerName,
        abilityName: 'Living Legend',
        description: expect.stringContaining('activated Living Legend'),
        timestamp: expect.any(Number),
      });
    });

    it('uses custom action name in popup description', async () => {
      getRuntimeValue.mockReturnValue(undefined);

      const action = makeAction({ name: 'Custom Legendary Ability' });
      const result = await handle(action, makePlayerStats(), campaignName, null);

      expect(result.payload.description).toContain('Custom Legendary Ability');
    });

    it('uses custom action name in log entry', async () => {
      getRuntimeValue.mockReturnValue(undefined);

      const action = makeAction({ name: 'My Divine Gift' });
      await handle(action, makePlayerStats(), campaignName, null);

      expect(addEntry).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({
          abilityName: 'My Divine Gift',
          description: expect.stringContaining('activated My Divine Gift'),
        }),
      );
    });

    it('uses automation type from action.automation.type in payload', async () => {
      getRuntimeValue.mockReturnValue(undefined);

      const action = makeAction({ automation: { type: 'custom_legend' } });
      const result = await handle(action, makePlayerStats(), campaignName, null);

      expect(result.payload.automationType).toBe('custom_legend');
    });

    it('passes campaign name to setRuntimeValue and addEntry', async () => {
      getRuntimeValue.mockReturnValue(undefined);

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(setRuntimeValue).toHaveBeenCalledWith(
        playerName,
        livingLegendKey,
        true,
        campaignName,
      );
      expect(addEntry).toHaveBeenCalledWith(
        campaignName,
        expect.any(Object),
      );
    });

    it('does not throw when addEntry rejects (fire-and-forget logging)', async () => {
      getRuntimeValue.mockReturnValue(undefined);
      addEntry.mockRejectedValue(new Error('Network failure'));

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
    });
  });

  describe('setUnerringStrikeUsed', () => {
    it('sets the runtime value to the provided boolean when true', async () => {
      await setUnerringStrikeUsed(playerName, campaignName, true);

      expect(setRuntimeValue).toHaveBeenCalledWith(
        playerName,
        unerringStrikeKey,
        true,
        campaignName,
      );
    });

    it('sets the runtime value to the provided boolean when false', async () => {
      await setUnerringStrikeUsed(playerName, campaignName, false);

      expect(setRuntimeValue).toHaveBeenCalledWith(
        playerName,
        unerringStrikeKey,
        false,
        campaignName,
      );
    });

    it('passes the campaign name to setRuntimeValue', async () => {
      await setUnerringStrikeUsed(playerName, campaignName, true);

      expect(setRuntimeValue).toHaveBeenCalledWith(
        playerName,
        unerringStrikeKey,
        true,
        campaignName,
      );
    });
  });
});
