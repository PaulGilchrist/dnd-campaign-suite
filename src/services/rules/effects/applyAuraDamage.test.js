// @maintained-by-ai
// applyAuraDamage at its own seam: which entities get selected into the aura
// damage set and the exact applyDamageToTarget call shape.
// Owned elsewhere (not duplicated here): early-return gates, allyFilter,
// targetFilter, out-of-range skip, per-creature error recovery —
// expirations_applyAuraDamage.test.js; detached-copy persistence + inactive
// skip — auraDamageService.test.js; caller-side range/damage expressions —
// turnStartEffects_innerRadiance.test.js; distance truth tables —
// rangeCheck owner lane (#1223).
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../ui/utils.js', () => ({
  default: {
    getName: vi.fn((val) => String(val)),
  },
}));

vi.mock('../../ui/storage.js', () => ({
  default: {
    set: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../../encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(() => null),
  loadCombatSummary: vi.fn().mockResolvedValue(null),
  setCombatSummaryCache: vi.fn(),
}));

vi.mock('../../rules/combat/rangeCheck.js', () => ({
  isWithinRange: vi.fn().mockResolvedValue(true),
}));

vi.mock('../../rules/combat/applyDamage.js', () => ({
  applyDamageToTarget: vi.fn(),
}));

import { applyAuraDamage } from './auraDamageService.js';
import { getRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { getCombatSummary, loadCombatSummary } from '../../encounters/combatData.js';
import { isWithinRange } from '../../rules/combat/rangeCheck.js';
import { applyDamageToTarget } from '../../rules/combat/applyDamage.js';

const ACTIVE_KEY = 'innerRadianceActive';

function auraOptions({ damageValue = 7, range = 10, ...rest } = {}) {
  return { activeKey: ACTIVE_KEY, damageValue, range, ...rest };
}

async function runAura(options) {
  await applyAuraDamage('Test', {}, 'Campaign', [{ name: 'Test' }], options);
}

describe('applyAuraDamage — damage application', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRuntimeValue.mockImplementation((_name, prop) => (prop === ACTIVE_KEY ? true : null));
    getCombatSummary.mockReturnValue(null);
    loadCombatSummary.mockResolvedValue(null);
    isWithinRange.mockResolvedValue(true);
    applyDamageToTarget.mockReturnValue(undefined);
  });

  it('applies the exact damage call to every in-range enemy, forwarding range and characters', async () => {
    getCombatSummary.mockReturnValue({
      creatures: [
        { name: 'Orc', hit_points: { current: 15 } },
        { name: 'Goblin', hit_points: { current: 7 } },
      ],
    });

    await runAura(auraOptions({ damageType: 'Fire' }));

    expect(applyDamageToTarget).toHaveBeenCalledTimes(2);
    expect(applyDamageToTarget).toHaveBeenCalledWith(
      expect.any(Object), 'Orc', 7, ['Fire'],
      { campaignName: 'Campaign', characters: [{ name: 'Test' }], ignoreResistance: false, attackerName: 'Test' },
    );
    expect(applyDamageToTarget).toHaveBeenCalledWith(
      expect.any(Object), 'Goblin', 7, ['Fire'],
      { campaignName: 'Campaign', characters: [{ name: 'Test' }], ignoreResistance: false, attackerName: 'Test' },
    );
    // Aura range must reach the shared range check verbatim.
    expect(isWithinRange).toHaveBeenCalledWith('Test', 'Orc', 10);
  });

  it('defaults damageType to Radiant when omitted', async () => {
    getCombatSummary.mockReturnValue({
      creatures: [{ name: 'Orc', hit_points: { current: 15 } }],
    });

    await runAura(auraOptions());

    expect(applyDamageToTarget).toHaveBeenCalledWith(
      expect.any(Object), 'Orc', 7, ['Radiant'],
      { campaignName: 'Campaign', characters: [{ name: 'Test' }], ignoreResistance: false, attackerName: 'Test' },
    );
  });

  it('never damages the aura source even when it is in range', async () => {
    getCombatSummary.mockReturnValue({
      creatures: [
        { name: 'Test' },
        { name: 'Orc' },
      ],
    });

    await runAura(auraOptions({ damageType: 'Fire' }));

    const damaged = applyDamageToTarget.mock.calls.map((c) => c[1]);
    expect(damaged).toEqual(['Orc']);
  });

  it('falls back to loadCombatSummary and damages from the loaded summary', async () => {
    getCombatSummary.mockReturnValue(null);
    loadCombatSummary.mockResolvedValue({ creatures: [{ name: 'Orc', hit_points: { current: 15 } }] });

    await runAura(auraOptions({ damageType: 'Fire' }));

    expect(loadCombatSummary).toHaveBeenCalledWith('Campaign');
    expect(applyDamageToTarget).toHaveBeenCalledTimes(1);
    expect(applyDamageToTarget).toHaveBeenCalledWith(
      expect.any(Object), 'Orc', 7, ['Fire'],
      { campaignName: 'Campaign', characters: [{ name: 'Test' }], ignoreResistance: false, attackerName: 'Test' },
    );
  });
});
