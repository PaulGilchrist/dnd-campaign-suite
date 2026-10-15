// @maintained-by-ai
// Contract tests for the living_legend activation handler: popup shape,
// runtime-store write, campaign-log entry, already-active guard, and the
// setUnerringStrikeUsed pass-through. Deterministic — boundaries fully mocked.
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

const campaignName = 'test-campaign';
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
      expect(result.payload.description).toContain('Charisma checks have advantage');
      expect(result.payload.description).toContain('reroll failed saving throws');
      expect(result.payload.description).toContain('missed weapon attacks hit once per turn');
    });

    it('activates living legend: sets runtime value and logs ability_use', async () => {
      getRuntimeValue.mockReturnValue(undefined);

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(setRuntimeValue).toHaveBeenCalledWith(
        playerName,
        livingLegendKey,
        true,
        campaignName,
      );
      expect(addEntry).toHaveBeenCalledWith(campaignName, {
        type: 'ability_use',
        characterName: playerName,
        abilityName: 'Living Legend',
        description: expect.stringContaining('activated Living Legend'),
        timestamp: expect.any(Number),
      });
    });

    it('does not throw when addEntry rejects (fire-and-forget logging)', async () => {
      getRuntimeValue.mockReturnValue(undefined);
      addEntry.mockRejectedValue(new Error('Network failure'));

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
    });

    it('returns warning popup and does not write state or log when already active', async () => {
      getRuntimeValue.mockReturnValue(true);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('warning');
      expect(result.payload.description).toContain('already active');
      expect(setRuntimeValue).not.toHaveBeenCalled();
      expect(addEntry).not.toHaveBeenCalled();
    });
  });

  describe('setUnerringStrikeUsed', () => {
    it('passes the used flag through to the runtime store', async () => {
      await setUnerringStrikeUsed(playerName, campaignName, true);

      expect(setRuntimeValue).toHaveBeenCalledWith(
        playerName,
        unerringStrikeKey,
        true,
        campaignName,
      );

      await setUnerringStrikeUsed(playerName, campaignName, false);

      expect(setRuntimeValue).toHaveBeenCalledWith(
        playerName,
        unerringStrikeKey,
        false,
        campaignName,
      );
    });
  });
});
