// @improved-by-ai
// BUG FT-035(b) rule lock: Fey Touched free-cast latches are written by FEATURE name
// (spellPreparationService), NOT by the formData key: the chosen-spell spell row spends
// the shared `_Fey_Magic_freeCastCount` (rules.js addFeyTouchedFreeCast uses:1
// recharge:"long_rest" entry, adjustRechargeCounter) and the fixed Misty Step row spends
// the per-spell `_Fey_Magic_Misty_Step_freeCastCount` (automation-collected
// perSpellTracking entry, adjustPerSpellCounter). The old Long-Rest reset nulled the
// DEAD key `_feyTouchedSpell_freeCastCount` (zero writers) — the free badges never
// returned (CLA-130 family rule: every latch belongs in LONG_REST_RESOURCES or the free
// use dies permanently; FT-070 Shadow Touched fixed at restRules-longRest.js :567 —
// same pattern mirrored here).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import feats2024 from '../../../../public/data/2024/feats.json' with { type: 'json' };
import { getLongRestResources, getShortRestResources } from './restRules-constants.js';

// Mock surface mirrors restRules-longRest.shadowArts.test.js / cla130 sibling.
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

vi.mock('../../combat/conditions/exhaustionRules.js', () => ({
  getLevelAfterLongRest: vi.fn((level) => Math.max(0, level - 1)),
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

vi.mock('../../../services/automation/handlers/buffs/tempHpService.js', () => ({
  setTempHp: vi.fn((name, amount) => amount),
}));

vi.mock('../features/invisibilityService.js', () => ({
  endInvisibility: vi.fn(),
  endGreaterInvisibility: vi.fn(),
}));

vi.mock('../../../services/ui/storage.js', () => ({
  default: { set: vi.fn() },
}));

import { applyLongRest } from './restRules.js';
import { setRuntimeBatch, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';

const CAMPAIGN = 'test-campaign';

// The live writer pattern is `_${action.name}_freeCastCount` (spellCastHandler.js:191/:225,
// spellPreparationService.featureFreeCastKey) — every latch a Fey Touched cast can stamp,
// keyed by the 'Fey Magic' benefit name (feats.json / rules.js addFeyTouchedFreeCast).
const LIVE_FEY_MAGIC_LATCHES = [
  '_Fey_Magic_freeCastCount',
  '_Fey_Magic_Misty_Step_freeCastCount',
];

function makeFeyTouchedStats() {
  return {
    name: 'FeyNewTest',
    hitPoints: 38,
    level: 4,
    proficiency: 2,
    feyTouchedSpell: 'Detect Magic',
    abilities: [{ name: 'Charisma', bonus: 0 }],
    automation: {
      actions: [{
        type: 'free_spell',
        name: 'Fey Magic',
        spell: ['Misty Step'],
        uses: 1,
        usesMax: 1,
        recharge: 'long_rest',
        perSpellTracking: true,
        casting_time: '1 bonus action',
      }],
      bonusActions: [],
      specialActions: [{
        type: 'free_spell',
        name: 'Fey Magic',
        spell: 'Detect Magic',
        uses: 1,
        recharge: 'long_rest',
      }],
      passives: [],
    },
  };
}

describe('FT-035(b) Fey Touched free-cast latch Long Rest re-arm', () => {
  it('feats.json data anchor: Fey Magic automation is a per-spell long-rest free_spell of Misty Step', () => {
    const feat = feats2024.find(f => f.name === 'Fey Touched');
    const auto = feat.benefits.find(b => b.automation?.type === 'free_spell').automation;
    expect(auto.spell).toContain('Misty Step');
    expect(auto.perSpellTracking).toBe(true);
    expect(auto.recharge).toBe('long_rest');
  });

  it('registers the whole live Fey Magic latch family in LONG_REST_RESOURCES', () => {
    const resources = getLongRestResources();
    for (const key of LIVE_FEY_MAGIC_LATCHES) {
      expect(resources, `${key} must be nulled on a Long Rest or the free use dies permanently`).toContain(key);
    }
  });

  it('does NOT re-arm the Fey Magic latches on a Short Rest (recharge:"long_rest" RAW)', () => {
    const resources = getShortRestResources();
    for (const key of LIVE_FEY_MAGIC_LATCHES) {
      expect(resources).not.toContain(key);
    }
  });

  describe('applyLongRest', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('nulls the LIVE shared latch at the dedicated reset site (was the dead `_feyTouchedSpell_freeCastCount`)', async () => {
      await applyLongRest(makeFeyTouchedStats(), CAMPAIGN);
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'FeyNewTest', '_Fey_Magic_freeCastCount', null, CAMPAIGN, true,
      );
    });

    it('re-arms the per-spell Misty Step latch via the FT-070 automation loop', async () => {
      await applyLongRest(makeFeyTouchedStats(), CAMPAIGN);
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'FeyNewTest', '_Fey_Magic_Misty_Step_freeCastCount', null, CAMPAIGN, true,
      );
    });

    it('never writes the dead `_feyTouchedSpell_freeCastCount` key again (write-side guard)', async () => {
      await applyLongRest(makeFeyTouchedStats(), CAMPAIGN);
      const deadWrites = setRuntimeValue.mock.calls.filter(call => String(call[1]) === '_feyTouchedSpell_freeCastCount');
      expect(deadWrites).toHaveLength(0);
      const batch = setRuntimeBatch.mock.calls.find(c => c[0] === 'FeyNewTest');
      expect(batch[1]).not.toHaveProperty('_feyTouchedSpell_freeCastCount');
    });

    it('nulls the live latch family in the atomic long-rest batch (null = free use available)', async () => {
      await applyLongRest(makeFeyTouchedStats(), CAMPAIGN);
      const batch = setRuntimeBatch.mock.calls.find(c => c[0] === 'FeyNewTest');
      expect(batch).toBeTruthy();
      expect(batch[1]._Fey_Magic_freeCastCount).toBeNull();
      expect(batch[1]._Fey_Magic_Misty_Step_freeCastCount).toBeNull();
    });
  });
});
