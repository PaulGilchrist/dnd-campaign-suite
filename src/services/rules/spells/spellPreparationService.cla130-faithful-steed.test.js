// @maintained-by-ai
// CLA-130 Faithful Steed (2024 Paladin lv5): free-cast latch auth + consume in
// spellPreparationService — the preparation-phase half of the fix ("free cast never
// recharges on Long Rest"). Disk-faithful fixtures: classes.json /class_levels[4]
// /features[1].automation {type:'free_spell', spell:'Find Steed', uses:1,
// recharge:'long_rest', casting_time:'passive'} (2024) and the 2024 spells.json
// Find Steed row (lv2, Action, concentration:false, Instantaneous, summon_spirit →
// Otherworldly Steed, exists in monsters.json — census-checked).
// The latch key `_Faithful_Steed_freeCastCount` is derived by featureFreeCastKey
// from the entry name. Cannot-regress pin: featureFreeCastCount uses
// `stored ?? fallback(entry.uses)` — explicit-null (Long-Rest batch re-arm) and
// fresh-absent keys both fall back to uses=1 → ALLOW; a spent 0 → DENY.
// Owned elsewhere (not duplicated here): the LONG_REST_RESOURCES registration in
// restRules-constants.cla130-faithful-steed.test.js, and the summon-spawn lane in
// automation/handlers/spells/findSteedSummon.test.js.
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => {
  const mem = new Map();
  const setRuntimeValue = vi.fn((_name, key, value) => { mem.set(key, value); });
  const getRuntimeValue = vi.fn((_name, key) => (mem.has(key) ? mem.get(key) : undefined));
  const clearRuntimeState = vi.fn(() => mem.clear());
  return { setRuntimeValue, getRuntimeValue, clearRuntimeState, __mem: mem };
});

vi.mock('../../../services/encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(() => null),
}));

vi.mock('../../../services/combat/concentration/concentrationService.js', () => ({
  breakConcentration: vi.fn(),
  addConcentration: vi.fn(),
  cleanupConcentrationEffects: vi.fn(),
}));

vi.mock('../../../services/ui/storage.js', () => ({
  default: { set: vi.fn() },
}));

vi.mock('../../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve({})),
}));

vi.mock('./metamagicRules.js', () => ({
  isPsionicSpell: vi.fn(() => false),
  hasPsionicSorcery: vi.fn(() => false),
}));

import { isFreeCastAuthorized, prepareSpellCast } from './spellPreparationService.js';
import { setRuntimeValue, __mem as mem } from '../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../services/ui/logService.js';
import { breakConcentration, addConcentration } from '../../../services/combat/concentration/concentrationService.js';

const CAMPAIGN = 'test-campaign';
const CASTER = 'ElderPaladin';
// featureFreeCastKey(faithfulSteedEntry) — real bytes, never retyped.
const LATCH = '_Faithful_Steed_freeCastCount';

// Verbatim automation block of public/data/2024/classes.json Faithful Steed.
const faithfulSteedEntry = {
  name: 'Faithful Steed',
  type: 'free_spell',
  spell: 'Find Steed',
  uses: 1,
  recharge: 'long_rest',
  casting_time: 'passive',
};

// Disk-faithful public/data/2024/spells.json Find Steed (casting_time differs
// from the 5e row's '10 minutes' — CLA-130 is the 2024 feature).
function findSteedSpell() {
  return {
    name: 'Find Steed',
    level: 2,
    casting_time: 'Action',
    concentration: false,
    duration: 'Instantaneous',
    school: 'Conjuration',
    automation: {
      type: 'summon_spirit',
      typeLabel: 'Otherworldly Steed',
      baseLevel: 2,
      hpPerLevelAbove: 10,
      variants: [{ name: 'Otherworldly Steed', monsterIndex: 'otherworldly-steed' }],
      noConcentration: true,
    },
  };
}

function paladinStats() {
  return {
    name: CASTER,
    rules: '2024',
    class: { name: 'Paladin' },
    abilities: [{ name: 'Charisma', bonus: 4 }],
    proficiency: 6,
    spellAbilities: { spellCastingAbility: 'Charisma', toHit: 11, saveDc: 19, modifier: 5, spell_slots_level_2: 2 },
    automation: { actions: [], bonusActions: [], specialActions: [faithfulSteedEntry], passives: [] },
  };
}

function store(pairs) {
  Object.entries(pairs).forEach(([k, v]) => mem.set(k, v));
}

describe('CLA-130 Faithful Steed free-cast latch (auth + consume) in spellPreparationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mem.clear();
  });

  it('authorizes Find Steed while the latch is fresh: key absent, null re-arm, or 1', () => {
    expect(isFreeCastAuthorized.length).toBe(5);
    // Fresh (never cast): key absent → featureFreeCastCount ?? entry.uses=1.
    expect(isFreeCastAuthorized(CASTER, 'Find Steed', 2, paladinStats(), CAMPAIGN)).toBe(true);
    // CLA-130 cannot-regress: Long Rest nulls the latch (restRules batch); the
    // `?? fallback` must re-arm the free use, not read null as spent.
    store({ [LATCH]: null });
    expect(isFreeCastAuthorized(CASTER, 'Find Steed', 2, paladinStats(), CAMPAIGN)).toBe(true);
    store({ [LATCH]: 1 });
    expect(isFreeCastAuthorized(CASTER, 'Find Steed', 2, paladinStats(), CAMPAIGN)).toBe(true);
  });

  it('denies Find Steed once spent (0) and denies non-entry spells while armed', () => {
    store({ [LATCH]: 0 });
    expect(isFreeCastAuthorized(CASTER, 'Find Steed', 2, paladinStats(), CAMPAIGN)).toBe(false);
    // Spell-name gate: the entry only ever grants Find Steed (case-exact bytes).
    store({ [LATCH]: 1 });
    expect(isFreeCastAuthorized(CASTER, 'find steed', 2, paladinStats(), CAMPAIGN)).toBe(false);
    expect(isFreeCastAuthorized(CASTER, 'Cure Wounds', 2, paladinStats(), CAMPAIGN)).toBe(false);
  });

  it('free cast consumes the latch 1→0 exactly once, campaign-scoped, slot and concentration untouched', async () => {
    store({ [LATCH]: 1, spell_slots_level_2: 2 });
    expect(isFreeCastAuthorized(CASTER, 'Find Steed', 2, paladinStats(), CAMPAIGN)).toBe(true);

    const result = await prepareSpellCast(findSteedSpell(), {}, {
      playerName: CASTER,
      playerStats: paladinStats(),
      campaignName: CAMPAIGN,
      isUpcast: false,
      freeCastAuthorized: true,
    });

    expect(prepareSpellCast.length).toBe(3);
    expect(result.slotConsumed).toBe(false);
    expect(result.freeCastUsed).toBe(true);
    // SP-005 carry-through onto metaCtx for the summon lane.
    expect(result.metaCtx.slotConsumed).toBe(false);
    expect(result.metaCtx.freeCastUsed).toBe(true);
    expect(result.metaCtx.oldConcentrationSpell).toBe(null);
    expect(result.metaCtx.shouldSetConcentration).toBe(false);
    // Exact write-set: the single latch consume, campaign carried.
    expect(setRuntimeValue.mock.calls).toEqual([[CASTER, LATCH, 0, CAMPAIGN]]);
    expect(mem.get(LATCH)).toBe(0);
    expect(mem.get('spell_slots_level_2')).toBe(2);
    expect(addEntry).not.toHaveBeenCalled();
    expect(breakConcentration).not.toHaveBeenCalled();
    expect(addConcentration).not.toHaveBeenCalled();
    // Instantaneous, non-concentrating summon: modified spell is byte-identical.
    expect(result.modifiedSpell).toStrictEqual(findSteedSpell());
  });

  it('paid cast (spent latch, freeCastAuthorized false) consumes the lv2 slot and never touches the latch', async () => {
    store({ [LATCH]: 0, spell_slots_level_2: 2 });
    expect(isFreeCastAuthorized(CASTER, 'Find Steed', 2, paladinStats(), CAMPAIGN)).toBe(false);

    const result = await prepareSpellCast(findSteedSpell(), {}, {
      playerName: CASTER,
      playerStats: paladinStats(),
      campaignName: CAMPAIGN,
      isUpcast: false,
      freeCastAuthorized: false,
    });

    expect(result.slotConsumed).toBe(true);
    expect(result.freeCastUsed).toBe(false);
    expect(result.metaCtx.slotConsumed).toBe(true);
    expect(result.metaCtx.freeCastUsed).toBe(false);
    // Single payment channel: only the slot write; the spent latch stays 0.
    expect(setRuntimeValue.mock.calls).toEqual([[CASTER, 'spell_slots_level_2', 1, CAMPAIGN]]);
    expect(mem.get(LATCH)).toBe(0);
    expect(mem.get('spell_slots_level_2')).toBe(1);
  });
});
