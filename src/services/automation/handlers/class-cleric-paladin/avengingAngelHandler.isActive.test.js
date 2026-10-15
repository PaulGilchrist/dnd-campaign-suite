// @maintained-by-ai
// Lane: isActive reader (pure). Activation via handle() lives in avengingAngelHandler.test.js;
// isAuraTarget and cleanupAuraTargetOnDamage have their own sibling suites.
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

  it('should return true and read the avengingAngelActive key when runtime value is strictly true', () => {
    getRuntimeValue.mockReturnValue(true);

    expect(isActive(playerName, campaignName)).toBe(true);
    expect(getRuntimeValue).toHaveBeenCalledWith(playerName, 'avengingAngelActive', campaignName);
  });

  it('should return false for any non-true value, passing playerName and campaignName through', () => {
    for (const value of [false, null, undefined, 0, 1, 'true', '']) {
      getRuntimeValue.mockReturnValue(value);

      expect(isActive(playerName, campaignName)).toBe(false);
      expect(getRuntimeValue).toHaveBeenCalledWith(playerName, 'avengingAngelActive', campaignName);
    }
  });
});
