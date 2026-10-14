import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn().mockResolvedValue(undefined),
}));

import { isAuraTarget } from './avengingAngelHandler.js';
import { getRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';

const campaignName = 'test-campaign';
const playerName = 'TestPaladin';

describe('avengingAngelHandler.isAuraTarget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function mockAuraTargets(targets) {
    getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'avengingAngelAuraTargets') return targets;
      return null;
    });
  }

  describe('target is in aura list', () => {
    it('should return true when the target is the only entry', () => {
      mockAuraTargets(['Goblin1']);
      expect(isAuraTarget(playerName, 'Goblin1', campaignName)).toBe(true);
    });

    it('should return true when the target is one of multiple entries', () => {
      mockAuraTargets(['Goblin1', 'Goblin2', 'Goblin3']);
      expect(isAuraTarget(playerName, 'Goblin2', campaignName)).toBe(true);
    });

    it('should return true for the last entry in the list', () => {
      mockAuraTargets(['Goblin1', 'Goblin2']);
      expect(isAuraTarget(playerName, 'Goblin2', campaignName)).toBe(true);
    });
  });

  describe('target is not in aura list', () => {
    it('should return false when the target is absent from a non-empty list', () => {
      mockAuraTargets(['Goblin1', 'Goblin3']);
      expect(isAuraTarget(playerName, 'Goblin2', campaignName)).toBe(false);
    });

    it('should return false when the aura targets list is empty', () => {
      mockAuraTargets([]);
      expect(isAuraTarget(playerName, 'Goblin1', campaignName)).toBe(false);
    });

    it('should return false when the aura targets list is undefined', () => {
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'avengingAngelAuraTargets') return undefined;
        return null;
      });
      expect(isAuraTarget(playerName, 'Goblin1', campaignName)).toBe(false);
    });

    it('should return false when the aura targets list is null', () => {
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'avengingAngelAuraTargets') return null;
        return null;
      });
      expect(isAuraTarget(playerName, 'Goblin1', campaignName)).toBe(false);
    });

    it('should return false when the aura targets list is a non-array falsy value', () => {
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'avengingAngelAuraTargets') return 0;
        return null;
      });
      expect(isAuraTarget(playerName, 'Goblin1', campaignName)).toBe(false);
    });
  });

  describe('different player names', () => {
    it('should work with a different player name', () => {
      mockAuraTargets(['Goblin1']);
      expect(isAuraTarget('OtherPaladin', 'Goblin1', campaignName)).toBe(true);
    });
  });

  describe('getRuntimeValue call verification', () => {
    it('should call getRuntimeValue with the correct key', () => {
      mockAuraTargets(['Goblin1']);
      isAuraTarget(playerName, 'Goblin1', campaignName);

      expect(getRuntimeValue).toHaveBeenCalledWith(
        playerName,
        'avengingAngelAuraTargets',
        campaignName,
      );
    });

    it('should pass playerName and campaignName through to getRuntimeValue', () => {
      mockAuraTargets(['Goblin1']);
      isAuraTarget('DifferentPlayer', 'Goblin1', 'different-campaign');

      expect(getRuntimeValue).toHaveBeenCalledWith(
        'DifferentPlayer',
        'avengingAngelAuraTargets',
        'different-campaign',
      );
    });
  });
});
