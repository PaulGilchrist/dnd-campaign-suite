// @maintained-by-ai
// Lane: isAuraTarget reader (aura-list membership over avengingAngelAuraTargets, pure).
// Population via handle()/resolveFrightfulAura lives in avengingAngelHandler.frightfulAura.test.js;
// isActive and cleanupAuraTargetOnDamage have their own sibling suites.
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

  it('should return true when the target is in the aura list, reading the avengingAngelAuraTargets key', () => {
    const membershipCases = [
      { targets: ['Goblin1'], target: 'Goblin1' }, // only entry
      { targets: ['Goblin1', 'Goblin2', 'Goblin3'], target: 'Goblin2' }, // middle entry
      { targets: ['Goblin1', 'Goblin2'], target: 'Goblin2' }, // last entry
    ];
    for (const { targets, target } of membershipCases) {
      mockAuraTargets(targets);

      expect(isAuraTarget(playerName, target, campaignName)).toBe(true);
      expect(getRuntimeValue).toHaveBeenCalledWith(
        playerName,
        'avengingAngelAuraTargets',
        campaignName,
      );
    }
  });

  it('should return false when the target is absent from a non-empty aura list', () => {
    mockAuraTargets(['Goblin1', 'Goblin3']);

    expect(isAuraTarget(playerName, 'Goblin2', campaignName)).toBe(false);
  });

  it('should return false when the aura list is empty or falsy (|| [] guard)', () => {
    for (const value of [[], undefined, null, 0]) {
      mockAuraTargets(value);

      expect(isAuraTarget(playerName, 'Goblin1', campaignName)).toBe(false);
    }
  });

  it('should pass playerName and campaignName through to getRuntimeValue', () => {
    mockAuraTargets(['Goblin1']);

    expect(isAuraTarget('OtherPaladin', 'Goblin1', 'different-campaign')).toBe(true);
    expect(getRuntimeValue).toHaveBeenCalledWith(
      'OtherPaladin',
      'avengingAngelAuraTargets',
      'different-campaign',
    );
  });
});
