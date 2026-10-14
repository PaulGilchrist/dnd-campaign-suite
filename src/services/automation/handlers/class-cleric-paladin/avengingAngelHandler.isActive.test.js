import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn().mockResolvedValue(undefined),
}));

import { isActive } from './avengingAngelHandler.js';
import { getRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';

const campaignName = 'test-campaign';
const playerName = 'TestPaladin';

describe('avengingAngelHandler.isActive', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function mockIsActive(value) {
    getRuntimeValue.mockReturnValue(value);
  }

  it('should return true when runtime value is strictly true', () => {
    mockIsActive(true);
    expect(isActive(playerName, campaignName)).toBe(true);
  });

  it('should return false for any non-true value', () => {
    mockIsActive(null);
    expect(isActive(playerName, campaignName)).toBe(false);
  });
});
