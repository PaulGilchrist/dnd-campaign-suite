// @maintained-by-ai
// BUG FT-035(b) rest-lane lock: Fey Touched (2024/feats.json 'Fey Magic' row) spends
// TWO live latches at cast time, keyed by FEATURE name, never by the formData key:
// the chosen-spell row spends the shared `_Fey_Magic_freeCastCount` (rules.js
// addFeyTouchedFreeCast synthesizes uses:1 recharge:"long_rest"; adjustRechargeCounter)
// and the fixed Misty Step row spends the per-spell `_Fey_Magic_Misty_Step_freeCastCount`
// (disk perSpellTracking:true; adjustPerSpellCounter). The old LR reset nulled the DEAD
// key `_feyTouchedSpell_freeCastCount` (zero writers) — the free badges never returned
// (CLA-130 family rule: every latch must re-arm on the LR lane or the free use dies
// permanently; FT-070 Shadow Touched fixed at restRules-longRest.js:567, mirrored here).
// The Long Rest re-arm is pinned as EXACT batch null bytes — registration membership in
// LONG_REST_RESOURCES is not echoed statically: buildLongRestCharData nulls every
// LONG_REST_RESOURCES key (restRules-longRest.js:64-66), so the observed batch byte
// subsumes it — alongside the two dedicated setRuntimeValue sites (:689 shared latch,
// resetPerSpellFreeCastCounters:728 per-spell loop from the automation entry). RAW
// "until you finish a Long Rest" means the Short Rest lane must leave a spent (0) latch
// untouched. Not subsumed by the #1304 classes-JSON latch-family scan: it walks
// classes5e/classes2024 only, skips perSpellTracking rows, and skips rows without
// `uses` — the Fey Magic disk row hits all three exclusions, so this feat lane is
// owned here. Spell-side (free-spell row injection) is FT-035(a), owned by
// spellCalc2024.ft035-free-spell-row.test.js (#1276); badge-authorization semantics by
// spellPreparationService tests. This file pins ONLY the FT-035(b) rest-latch bytes.
// Mock surface mirrors sibling cla048/cla096/cla099/cla130/cla140 rest-lane tests verbatim.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import feats2024 from '../../../../public/data/2024/feats.json' with { type: 'json' };

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
  // automation/index.js imports handle + confirm/skip statically — mock full surface
  handle: vi.fn(() => null),
  confirmCelestialResilience: vi.fn(() => null),
  skipCelestialResilience: vi.fn(() => null),
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

import { applyShortRest, applyLongRest } from './restRules.js';
import { getRuntimeValue, setRuntimeBatch, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';

const CAMPAIGN = 'test-campaign';
const CHAR = 'FeyNewTest';
const KEY_DEAD = '_feyTouchedSpell_freeCastCount'; // zero-writer key: must NEVER be written

// Derive every latch key from the disk feat exactly as the live writers do
// (spellPreparationService names by FEATURE/benefit name, not the formData key):
// per-spell keys when the automation row sets perSpellTracking, plus the shared
// counter from the rules.js-synthesized chosen-spell row (addFeyTouchedFreeCast
// uses:1 recharge:"long_rest", feature name 'Fey Magic').
const FREE_CAST_LATCHES = (() => {
  const feat = feats2024.find(f => f.name === 'Fey Touched');
  const benefit = feat.benefits.find(b => b.type === 'spell' && b.automation?.type === 'free_spell');
  const featureKey = `_${benefit.name.replace(/\s+/g, '_')}`;
  const keys = [`${featureKey}_freeCastCount`];
  if (benefit.automation.perSpellTracking) {
    for (const spell of [].concat(benefit.automation.spell)) {
      keys.push(`${featureKey}_${String(spell).replace(/\s+/g, '_')}_freeCastCount`);
    }
  }
  return keys;
})();

// rules.js addFeyTouchedFreeCast repro shape (lv4 Fighter): the chosen-spell row
// (Detect Magic, no tracking → shared counter) and the disk-derived fixed row
// ('Fey Magic', spell:["Misty Step"], perSpellTracking → per-spell counter).
function makeStats() {
  return {
    name: CHAR,
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

function spentStore() {
  vi.mocked(getRuntimeValue).mockImplementation((_name, key) =>
    FREE_CAST_LATCHES.includes(key) ? 0 : undefined);
}

function batchFor(name) {
  const call = setRuntimeBatch.mock.calls.find(c => c[0] === name);
  expect(call, `${name} rest lane must fire one atomic batch`).toBeTruthy();
  return call[1];
}

describe('FT-035(b) Fey Touched free-cast latch rest-lane contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    spentStore();
  });

  it('canon: feats.json Fey Magic is a per-spell long-rest free_spell of Misty Step — re-arm is Long Rest only, both latches derive', () => {
    const feat = feats2024.find(f => f.name === 'Fey Touched');
    const benefit = feat.benefits.find(b => b.type === 'spell' && b.automation?.type === 'free_spell');
    const auto = benefit.automation;
    expect(auto.spell).toContain('Misty Step');
    expect(auto.perSpellTracking).toBe(true);
    expect(auto.recharge).toBe('long_rest');
    // The row is nameless in JSON — the live latch family keys off the BENEFIT name.
    expect(benefit.name).toBe('Fey Magic');
    // Disk rows carry no static uses: the shared counter comes from the rules.js
    // synthesis (uses:1), the per-spell latch from this row's spell list.
    expect(auto.uses).toBeUndefined();
    expect(FREE_CAST_LATCHES).toEqual([
      '_Fey_Magic_freeCastCount',
      '_Fey_Magic_Misty_Step_freeCastCount',
    ]);
    // RAW clause driving the split lanes below.
    expect(feat.description).toMatch(/until you finish a Long Rest/i);
  });

  it('a spent latch (0) survives a Short Rest with ZERO writes — re-arm stays closed (RAW: Long Rest only)', async () => {
    await applyShortRest(makeStats(), CAMPAIGN);

    const updates = batchFor(CHAR);
    expect(Object.keys(updates).length, 'SR lane must still fire its own batch').toBeGreaterThan(0);
    for (const key of FREE_CAST_LATCHES) {
      expect(updates, `${key} must not be re-armed by a Short Rest`).not.toHaveProperty(key);
      // Arity-safe: no standalone write of the live latch at any argument count.
      expect(setRuntimeValue.mock.calls.filter(c => c[1] === key), `${key} must stay spent after a Short Rest`).toHaveLength(0);
    }
  });

  it('Long Rest null-re-arms BOTH live latches (batch bytes, dedicated shared-latch write, per-spell loop) and never touches the dead key', async () => {
    await applyLongRest(makeStats(), CAMPAIGN);

    const updates = batchFor(CHAR);
    // Exact null bytes — subsumes LONG_REST_RESOURCES membership (:64-66 nulls every
    // registered key); null = available via the `stored ?? uses` consumer fallback.
    for (const key of FREE_CAST_LATCHES) {
      expect(updates, `${key} must be null-re-armed or the free use dies permanently`).toHaveProperty(key, null);
    }
    // Dedicated writers: shared latch at restRules-longRest.js:689, per-spell latch
    // re-armed generically by resetPerSpellFreeCastCounters (:728) from the
    // perSpellTracking automation entry (FT-070 machinery).
    expect(setRuntimeValue.mock.calls.filter(c =>
      c[0] === CHAR && c[2] === null && FREE_CAST_LATCHES.includes(c[1])).map(c => c[1]).sort()
    ).toEqual([...FREE_CAST_LATCHES].sort());
    // Dead-key write-side guard: the old `_feyTouchedSpell_freeCastCount` reset had
    // zero writers — it must appear in NEITHER the batch nor any standalone write.
    expect(updates).not.toHaveProperty(KEY_DEAD);
    expect(setRuntimeValue.mock.calls.filter(c => c[1] === KEY_DEAD), 'dead key must never be written again').toHaveLength(0);
  });
});
