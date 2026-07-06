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

      const action = makeAction({ automation: { type: 'custom_legend' } });
      const result = await handle(action, makePlayerStats(), campaignName, null);

      expect(result.payload.automationType).toBe('custom_legend');
    });

    it('includes description listing all three effects', async () => {
      getRuntimeValue.mockReturnValue(undefined);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.payload.description).toContain('Charisma checks have advantage');
      expect(result.payload.description).toContain('reroll failed saving throws');
      expect(result.payload.description).toContain('missed weapon attacks hit once per turn');
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

    it('uses custom action name in popup and log entry', async () => {
      getRuntimeValue.mockReturnValue(undefined);

      const action = makeAction({ name: 'Custom Legendary Ability' });
      const result = await handle(action, makePlayerStats(), campaignName, null);

      expect(result.payload.description).toContain('Custom Legendary Ability');

      await handle(makeAction({ name: 'My Divine Gift' }), makePlayerStats(), campaignName, null);

      expect(addEntry).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({
          abilityName: 'My Divine Gift',
          description: expect.stringContaining('activated My Divine Gift'),
        }),
      );
    });

    it('does not throw when addEntry rejects (fire-and-forget logging)', async () => {
      getRuntimeValue.mockReturnValue(undefined);
      addEntry.mockRejectedValue(new Error('Network failure'));

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
    });
  });

  describe('setUnerringStrikeUsed', () => {
    it.each`
      used     | expectedCall
      ${true}  | ${true}
      ${false} | ${false}
    `('sets the runtime value to $used', async ({ used, expectedCall }) => {
      await setUnerringStrikeUsed(playerName, campaignName, used);

      expect(setRuntimeValue).toHaveBeenCalledWith(
        playerName,
        unerringStrikeKey,
        expectedCall,
        campaignName,
      );
    });
  });
});
