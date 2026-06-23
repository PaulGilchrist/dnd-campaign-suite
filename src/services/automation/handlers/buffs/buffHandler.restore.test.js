import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks BEFORE imports ───────────────────────────────────────

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

// ── Imports ────────────────────────────────────────────────────

import { restoreAdrenalineRushUses } from './buffHandler.js';
import * as runtimeState from '../../../../hooks/runtime/useRuntimeState.js';

// ── Helpers ────────────────────────────────────────────────────

const campaignName = 'TestCampaign';

// ── Tests ──────────────────────────────────────────────────────

describe('restoreAdrenalineRushUses', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call setRuntimeValue with the adrenalineRushUses key and null value', () => {
    restoreAdrenalineRushUses('TestHero', campaignName);

    expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
      'TestHero',
      'adrenalineRushUses',
      null,
      campaignName
    );
  });

  it('should use the correct campaignName', () => {
    restoreAdrenalineRushUses('TestHero', 'OtherCampaign');

    expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
      'TestHero',
      'adrenalineRushUses',
      null,
      'OtherCampaign'
    );
  });

  it('should use the correct playerName', () => {
    restoreAdrenalineRushUses('AnotherHero', campaignName);

    expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
      'AnotherHero',
      'adrenalineRushUses',
      null,
      campaignName
    );
  });
});
