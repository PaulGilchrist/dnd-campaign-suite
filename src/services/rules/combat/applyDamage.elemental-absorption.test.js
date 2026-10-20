// @maintained-by-ai
// MA-0681 consumer lane — Elemental Absorption (Elemental Cultist, 1/Day): the
// press-at-pending-hit resolver stamps a one-shot activeBuffs entry
// {effect:'elemental_absorption', resistanceTypes:[<type>]}; applyDamageToTarget
// folds ONLY that buff's resistanceTypes into an NPC's live resistances
// (addElementalAbsorptionResistances :283-288, NPC-only branch :767-771 — halves
// THAT instance) and consumeElementalAbsorptionOnApply (:965-989) strips the stamp
// + logs the raw→halved detail when all three guard clauses hold: armed buff
// (:968-969), damage type matched case-insensitively (:970-972), halving actually
// resisted (:973-974). THP granted at press absorbs the halved instance before HP.
// No RNG, no wall-clock on this seam (call site :1016 is turn-driven).
// Cite owners (NEVER re-driven here):
// - generic resistance/immunity arithmetic CANON → applyDamage.helpers.test.js :52-84 (#1182)
// - player-only generic buff resistanceTypes channel → applyDamage.buffs.test.js (#1184)
// - press-side gate (1/Day uses, reacted/type refusals, THP grant) → MonsterCardHelpers.gated-reaction.test.js (#180 flake fixed @ledger)
// - elemental AFFINITY sibling is axis-distinct (player chooser live-key lane, CLA-110) — never absorbed here
// - FT-009 chooser twin → applyDamage.energy-resistance.test.js
// Runtime stubbed KEYED by `${target}.${key}` — store-faithful, order-independent,
// no positional chains (#1137/#1057). Fixtures are disk-shape verbatim: Elemental
// Cultist hit_points 135, resistances/immunities [] (monsters.json :21634, #977).
// Campaign-keyed consume-write tuple asserted (#932/#1019); decoy buff survives
// byte-distinct (one-shot consume census #1183); zero-is-data leg honest (#945).
// diceRoller kept for the transitive automation import graph, verified live (#1094/#1132).
//
// old -> new map (4 -> 5):
// - "halves an armed Fire hit... one-shot consumes"   -> T1 (+decoy survives #1183, +campaign tuple #932,
//                                                           +newHp delta #1160, +log record fields)
// - "THP absorbs the halved instance before HP"        -> T5 (+exact press-time THP-standing log bytes)
// - "non-elemental damage is byte-inert"               -> T2 it.each element census (#903) + immunity
//                                                        resisted-clause falsifier (#967) + raw-0 zero-is-data leg
// - "no armed buff: plain full damage"                 -> T4 honest baseline (#948)
// - NEW T3 buff-shape/effect-filter falsifier (:285/:968)
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// diceRoller: rollD20 imported directly by applyDamage.js:3; rollExpression stays
// because automation/index.js is transitively live via this lane's import graph (#1094/#1132).
vi.mock('../../dice/diceRoller.js', () => ({
  rollD20: vi.fn(),
  rollExpression: vi.fn(),
}));

// Store-faithful keyed stub: keys are `${target}.${runtimeKey}`; every unstubbed
// read returns undefined (each consumer guards it) — order-independent (#1057).
const store = {};
vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn((name, key) => store[`${name}.${key}`]),
  setRuntimeValue: vi.fn((name, key, value) => { store[`${name}.${key}`] = value; }),
  getStore: vi.fn(() => ({ keys: () => [] })),
}));

vi.mock('../../ui/storage.js', () => ({ default: { get: vi.fn(), set: vi.fn() } }));
vi.mock('../../combat/conditions/savePromptService.js', () => ({
  sendDeathSavePrompt: vi.fn(),
  sendConcentrationPrompt: vi.fn(),
}));
vi.mock('../../combat/concentration/concentrationRules.js', () => ({ rollConcentrationSave: vi.fn() }));
vi.mock('../../ui/utils.js', () => ({ default: { guid: vi.fn(() => 'g-1') } }));
vi.mock('../../ui/logService.js', () => ({ addEntry: vi.fn(() => Promise.resolve()) }));

import { applyDamageToTarget } from './applyDamage.js';
import { setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../ui/logService.js';

const CAMPAIGN = 'test-campaign';
const CULTIST = 'Elemental Cultist 1';
// Disk-shape fixture: monsters.json :21634 — hit_points 135, no innate resist/immune.
function cultist(over = {}) {
  return { name: CULTIST, type: 'npc', maxHp: 135, currentHp: 135, resistances: [], immunities: [], conditions: [], template: [], concentration: null, saveBonuses: {}, ...over };
}

const ABSORB = { effect: 'elemental_absorption', resistanceTypes: ['Fire'] };
// Decoy buff: generic entry that must survive the consume filter byte-distinct (#1183).
const DECOY = { effect: 'npc_rally', attackBonus: 2 };

function armedFire(tempHp = 0) {
  store[`${CULTIST}.activeBuffs`] = [ABSORB, DECOY];
  store[`${CULTIST}.tempHp`] = tempHp;
}

const buffStore = () => store[`${CULTIST}.activeBuffs`];
const stampArmed = () => (buffStore() || []).some(b => b && b.effect === 'elemental_absorption');
const absorptionLogs = () => addEntry.mock.calls.map(c => c[1]).filter(e => e && e.automationType === 'elemental_absorption_applied');

beforeEach(() => {
  vi.clearAllMocks();
  for (const k of Object.keys(store)) delete store[k];
});
afterEach(() => vi.restoreAllMocks());

describe('MA-0681 applyDamage — elemental absorption NPC fold + one-shot consume', () => {
  it('halves the armed Fire instance, consumes ONLY the stamp, logs the raw→halved detail', async () => {
    armedFire(0);
    const cs = { round: 1, creatures: [cultist()] };
    const result = await applyDamageToTarget(cs, CULTIST, 22, ['Fire'], { campaignName: CAMPAIGN, characters: [] });
    expect(result.finalDamage).toBe(11);
    expect(result.damageReduced).toBe(true);
    expect(result.newHp).toBe(124);
    expect(result.resistanceDetails).toContainEqual({ damageType: 'Fire', status: 'resistant' });
    // one-shot consume: exact campaign-keyed write tuple, decoy survives byte-distinct.
    expect(setRuntimeValue).toHaveBeenCalledWith(CULTIST, 'activeBuffs', [DECOY], CAMPAIGN);
    expect(buffStore()).toEqual([DECOY]);
    expect(absorptionLogs()).toHaveLength(1);
    expect(absorptionLogs()[0]).toMatchObject({
      automationType: 'elemental_absorption_applied',
      characterName: CULTIST,
      damageTypes: ['Fire'],
      rawDamage: 22,
      appliedDamage: 11,
      tempHp: 0,
    });
  });

  // Guard falsifier leg table (#967): each row kills one distinct clause of the
  // consume guard — matched (:970-972 resisted-false legs) — while the absorbed
  // rows prove the fold+consume itself across byte-distinct casings/compositions.
  it.each([
    { label: 'lowercase fire halves + consumes (:970 case-insensitive)', types: ['fire'], raw: 22, immunities: [], final: 11, consumed: true },
    { label: 'mixed Cold+Fire folds Fire, halves + consumes', types: ['Cold', 'Fire'], raw: 22, immunities: [], final: 11, consumed: true },
    { label: 'Poison passes full, stamp stays armed (unmatched :971)', types: ['Poison'], raw: 22, immunities: [], final: 22, consumed: false },
    { label: 'Cold passes full, stamp stays armed (unmatched :971)', types: ['Cold'], raw: 22, immunities: [], final: 22, consumed: false },
    { label: 'Fire vs innate immunity is never resisted — damage 0, stamp stays armed (:973)', types: ['Fire'], raw: 22, immunities: ['Fire'], final: 0, consumed: false },
    { label: 'raw 0 damage is data — seam fires, consumes, logs 0 halved to 0 (#945)', types: ['Fire'], raw: 0, immunities: [], final: 0, consumed: true },
  ])('$label', async ({ types, raw, immunities, final, consumed }) => {
    armedFire(0);
    const cs = { round: 1, creatures: [cultist({ immunities })] };
    const result = await applyDamageToTarget(cs, CULTIST, raw, types, { campaignName: CAMPAIGN, characters: [] });
    expect(result.finalDamage).toBe(final);
    expect(stampArmed()).toBe(!consumed);
    expect(absorptionLogs()).toHaveLength(consumed ? 1 : 0);
    if (consumed) expect(buffStore()).toEqual([DECOY]);
  });

  // Buff-shape falsifier (:285/:968): only entries carrying effect
  // 'elemental_absorption' AND an array resistanceTypes arm the fold/consume —
  // a generic Fire-resistance buff or a shapeless stamp must do nothing.
  it('ignores generic buffs and stamps missing resistanceTypes — full damage, buffs untouched, no log', async () => {
    store[`${CULTIST}.activeBuffs`] = [{ effect: 'elemental_absorption' }, { effect: 'npc_rally', resistanceTypes: ['Fire'] }];
    const cs = { round: 1, creatures: [cultist()] };
    const result = await applyDamageToTarget(cs, CULTIST, 22, ['Fire'], { campaignName: CAMPAIGN, characters: [] });
    expect(result.finalDamage).toBe(22);
    expect(buffStore()).toHaveLength(2);
    expect(absorptionLogs()).toHaveLength(0);
  });

  it('no armed stamp: plain full damage, nothing stripped, no absorption log', async () => {
    const cs = { round: 1, creatures: [cultist()] };
    const result = await applyDamageToTarget(cs, CULTIST, 22, ['Fire'], { campaignName: CAMPAIGN, characters: [] });
    expect(result.finalDamage).toBe(22);
    expect(absorptionLogs()).toHaveLength(0);
  });

  it('THP absorbs the halved instance before HP; the log reports press-time THP standing', async () => {
    armedFire(10);
    const cs = { round: 1, creatures: [cultist()] };
    const result = await applyDamageToTarget(cs, CULTIST, 22, ['Fire'], { campaignName: CAMPAIGN, characters: [] });
    expect(result.finalDamage).toBe(11);
    // halved 11 into THP 10: THP depletes to 0, only the 1 excess reaches HP (#1160 delta).
    expect(store[`${CULTIST}.tempHp`]).toBe(0);
    expect(result.newHp).toBe(134);
    // consume logs BEFORE THP absorption writes, so standing shows the press grant of 10.
    expect(absorptionLogs()).toHaveLength(1);
    expect(absorptionLogs()[0].description).toBe(`${CULTIST} absorbs this instance of Fire damage — 22 halved to 11; 10 Temporary Hit Points standing.`);
    expect(absorptionLogs()[0].tempHp).toBe(10);
  });
});
