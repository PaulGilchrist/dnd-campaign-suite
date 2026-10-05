// @improved-by-ai
// BUG CLA-130 rule lock: `_Faithful_Steed_freeCastCount` (2024 Paladin lv5
// Faithful Steed — classes.json free_spell uses:1 recharge:"long_rest") is
// spent to 0 by spellPreparationService.adjustRechargeCounter. Without a
// LONG_REST_RESOURCES registration nothing ever restores it — the free use
// died permanently after one cast (CLA-096/099 family rule: every once-per-
// LR latch must be nulled by the long-rest batch, null = available via the
// featureFreeCastCount `stored ?? uses` fallback that arms the free badge).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import classes5e from '../../../../public/data/classes.json' with { type: 'json' };
import classes2024 from '../../../../public/data/2024/classes.json' with { type: 'json' };
import { getLongRestResources, getShortRestResources } from './restRules-constants.js';

// Mock surface mirrors restRules-longRest-special.test.js.
vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => undefined),
  setRuntimeBatch: vi.fn(),
  setRuntimeValue: vi.fn(),
  getAllStoreKeys: vi.fn(() => []),
}));

vi.mock('../../../services/dice/diceRoller.js', () => ({
  rollD20: vi.fn(() => 10),
}));

vi.mock('./expirations.js', () => ({
  clearAllExpirationEffects: vi.fn(),
}));

vi.mock('../../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve({})),
}));

vi.mock('../../../services/encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(() => null),
  setCombatSummaryCache: vi.fn(),
}));

vi.mock('../../../services/combat/concentration/concentrationService.js', () => ({
  clearAllConcentrations: vi.fn(),
}));

vi.mock('../../../services/automation/handlers/class-warlock/celestialResilienceHandler.js', () => ({
  grantCelestialResilience: vi.fn(() => null),
}));

vi.mock('../../../services/ui/storage.js', () => ({
  default: { set: vi.fn() },
}));

import { applyLongRest } from './restRules.js';
import { setRuntimeBatch } from '../../../hooks/runtime/useRuntimeState.js';

const CAMPAIGN = 'test-campaign';

// Enumerate every feature-keyed `_<Feature>_freeCastCount` latch produced by
// free_spell + long-rest-recharge automation in BOTH ruleset class databases.
function freeCastLatchKeys(classes) {
  const keys = new Set();
  const scan = (feature) => {
    const autos = Array.isArray(feature?.automation) ? feature.automation : [feature?.automation].filter(Boolean);
    for (const a of autos) {
      if (a?.type !== 'free_spell' || a?.perSpellTracking) continue;
      if (a.uses == null && a.uses_expression == null) continue;
      if (!String(a.recharge || '').includes('long_rest')) continue;
      keys.add(`_${String(feature.name).replace(/\s+/g, '_')}_freeCastCount`);
    }
  };
  const walk = (node) => {
    if (Array.isArray(node)) { node.forEach(walk); return; }
    if (node && typeof node === 'object') {
      if (node.name && node.automation) scan(node);
      Object.values(node).forEach(walk);
    }
  };
  walk(classes);
  return keys;
}

describe('CLA-130 Faithful Steed free-cast latch Long Rest re-arm', () => {
  it('registers _Faithful_Steed_freeCastCount in LONG_REST_RESOURCES', () => {
    expect(getLongRestResources()).toContain('_Faithful_Steed_freeCastCount');
  });

  it('does NOT re-arm on a Short Rest (recharge:"long_rest" RAW)', () => {
    expect(getShortRestResources()).not.toContain('_Faithful_Steed_freeCastCount');
  });

  it('every feature-keyed _<Feature>_freeCastCount latch in class data re-arms on a Long Rest', () => {
    const resources = getLongRestResources();
    const keys = new Set([...freeCastLatchKeys(classes5e), ...freeCastLatchKeys(classes2024)]);
    // Family floor: the audit found at least Faithful Steed, Contact Patron,
    // Misty Wanderer, Paladin's Smite and Favored Enemy latches.
    expect(keys.size).toBeGreaterThanOrEqual(5);
    for (const key of keys) {
      expect(resources, `${key} must be nulled on a Long Rest or the free use dies permanently`).toContain(key);
    }
  });

  describe('applyLongRest batch', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    const paladinStats = {
      name: 'ElderPaladin',
      hitPoints: 133,
      level: 20,
      proficiency: 6,
      class: { name: 'Paladin' },
      abilities: [{ name: 'Charisma', bonus: 4 }],
    };

    it('nulls the spent latch in the atomic long-rest batch (null = free use available)', async () => {
      await applyLongRest(paladinStats, CAMPAIGN);
      const batch = setRuntimeBatch.mock.calls.find(c => c[0] === 'ElderPaladin');
      expect(batch).toBeTruthy();
      expect(batch[1]._Faithful_Steed_freeCastCount).toBeNull();
    });

    it('nulls the whole freeCastCount latch family in the same batch', async () => {
      await applyLongRest(paladinStats, CAMPAIGN);
      const batch = setRuntimeBatch.mock.calls.find(c => c[0] === 'ElderPaladin');
      expect(batch[1]._Favored_Enemy_freeCastCount).toBeNull();
      expect(batch[1]['_Paladin\'s_Smite_freeCastCount']).toBeNull();
      expect(batch[1]._Contact_Patron_freeCastCount).toBeNull();
      expect(batch[1]._Misty_Wanderer_freeCastCount).toBeNull();
      expect(batch[1]._Star_Map_freeCastCount).toBeNull();
    });
  });
});
