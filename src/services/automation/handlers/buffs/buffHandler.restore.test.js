// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks BEFORE imports ───────────────────────────────────────

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

// ── Imports ────────────────────────────────────────────────────

import { restoreAdrenalineRushUses } from './buffHandler.js';
import * as runtimeState from '../../../../hooks/runtime/useRuntimeState.js';

// ── Constants ──────────────────────────────────────────────────

const USES_KEY = 'adrenalineRushUses';

// ── Tests ──────────────────────────────────────────────────────

describe('restoreAdrenalineRushUses', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should reset adrenalineRushUses to null for the player', () => {
    const playerName = 'TestHero';
    const campaignName = 'TestCampaign';

    const result = restoreAdrenalineRushUses(playerName, campaignName);

    expect(result).toBeUndefined();
    expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
      playerName,
      USES_KEY,
      null,
      campaignName
    );
  });

  it('should use the correct campaign name in the call', () => {
    restoreAdrenalineRushUses('TestHero', 'MyCampaign');

    expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
      'TestHero',
      USES_KEY,
      null,
      'MyCampaign'
    );
  });

  it('should pass playerName as the first argument to setRuntimeValue', () => {
    restoreAdrenalineRushUses('RogueOne', 'CampaignA');

    expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
      'RogueOne',
      USES_KEY,
      null,
      'CampaignA'
    );
  });

  it('should be synchronous and not return a promise', () => {
    const result = restoreAdrenalineRushUses('TestHero', 'TestCampaign');

    expect(result).toBeUndefined();
    expect(result).not.toBeInstanceOf(Promise);
  });

  it('should still call setRuntimeValue with empty playerName', () => {
    restoreAdrenalineRushUses('', 'TestCampaign');

    expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
      '',
      USES_KEY,
      null,
      'TestCampaign'
    );
  });

  it('should still call setRuntimeValue when campaignName contains special characters', () => {
    restoreAdrenalineRushUses('Hero', 'Campaign/With:Special');

    expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
      'Hero',
      USES_KEY,
      null,
      'Campaign/With:Special'
    );
  });
});
