// @maintained-by-ai
// FT-009 regression: Boon Of Energy Resistance (2024 Epic Boon) — CONSUMER seam.
// The multi-choice chooser stamps the runtime key `_Energy_Resistances_chosenTypes`
// (producer = boonOfEnergyResistanceHandler via choiceStorage name "Energy
// Resistances" — producer stamp/validTypes/once-per-rest bytes owned by
// boonOfEnergyResistanceHandler.test.js, NOT re-driven here). The damage pipeline
// must read that SAME producer key LIVE at hit-resolution (CLA-336 Stormborn shape)
// so a mid-session re-pick halves damage WITHOUT a computedStats recompute.
// #1191 chooser-pair verdict: THIS lane OWNS the multi-chosenTypes shared-chooser
// twin-shaped coverage (N chosen types, multi-select UI-backed disk shape);
// CLA-110 (elemental-affinity.test.js) keeps its single-slot chosenType +
// stamp-REPLACE distinct — FT-009 has NO provenance stamp, so it can only
// union-append live types (stamp-free honest, distinct axis — never stripped here).
//
// Chooser-pair cite table (#1038 dup-map leg table):
//   multi-key LIVE fold + chosen-vs-unchosen byte-distinct #1022 · multi-slot
//   re-pick add/remove LIVE delta · retain-vs-consume census #1183 (retains per
//   disk) · buff-channel precedence falsifier vs addBuffResistances :757 #967/#1036 ·
//   key-inertness guard: old broken feat-name key #789584fad + `_Elemental_Adept_chosenType`
//   decoy never read here (mirror of #1191 leg, inverse) · campaign-keyed tuple
//   #932/#1019 · store-faithful keyed stubs #1137/#1057 VERBATIM · zero-effect
//   honest #948/#1026 · coercion #959 / zero-is-data #945 · fixtures verbatim
//   disk-shape #977/#993 · log exact #app · RNG exact-if-any #1072/#1076 (none
//   on this path — no RNG) · seams NEVER wall-clock #app MANDATORY · honest titles
//   #910/#1062 · afterEach restoreAllMocks #1007/#1190 · dead-mock purge
//   transitive #1094/#1132 · vacuous purge #1184/#1186/#1188/#1189/#1191.
// NOT re-driven here (owned elsewhere): case-fold/floor/no-match-raw canonical
// math = applyDamage.helpers.test.js:52-84 (#1191 precedent ×3 removed there);
// render merge = rulesFactory.js:196-201; producer choice modal =
// boonOfEnergyResistanceHandler.test.js; single-slot stamp REPLACE = CLA-110 twin.
//
// Old→new map: halves-Fire + halves-Cold + unchosen-Lightning → FT-1 it.each
// element census #903 · mixed Slashing+Fire two-call test → deleted (separate
// applies; unchosen leg dup of FT-1, multi-type first-match math canonical in
// helpers :52-84) · log → FT-6 · absent-null + absent-empty → FT-4 census ·
// key-mismatch guard → FT-5 strengthened (live-key wins, both decoys inert).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { applyDamageToTarget } from './applyDamage.js';
import { getRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../ui/logService.js';

// ── Mocks ──────────────────────────────────────────────────────

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
  getStore: vi.fn(() => ({ keys: () => [] })),
}));

vi.mock('../../dice/diceRoller.js', () => ({
  rollD20: vi.fn(() => 10),
  rollExpression: vi.fn(),
}));

vi.mock('../../ui/storage.js', () => ({ default: { get: vi.fn(), set: vi.fn() } }));

vi.mock('../../combat/conditions/savePromptService.js', () => ({
  sendDeathSavePrompt: vi.fn(),
  sendConcentrationPrompt: vi.fn(),
}));

vi.mock('../../combat/concentration/concentrationRules.js', () => ({
  rollConcentrationSave: vi.fn(),
}));

vi.mock('../../ui/utils.js', () => ({ default: { guid: vi.fn(() => 'test-guid-001') } }));

vi.mock('./rangeValidation.js', () => ({
  getDistanceFeet: vi.fn(() => 30),
}));

// choiceStorage is NOT mocked — getChosenRuntimeValue runs LIVE, delegating to
// the mocked getRuntimeValue, so the producer key lookup is exercised for real.
vi.mock('../../combat/automation/automationExpressions.js', () => ({
  evaluateAutoExpression: vi.fn(),
}));
vi.mock('../core/attackCalc.js', () => ({
  parseMagicItemName: vi.fn(),
}));
vi.mock('../../../shared/abilityLookup.js', () => ({
  getAbilityModifier: vi.fn(() => 0),
}));
vi.mock('../core/greatWeaponFighting.js', () => ({
  applyGreatWeaponFighting: vi.fn(),
}));

vi.mock('../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

global.fetch = vi.fn(() => new Promise(() => {}));

// ── Helpers ─────────────────────────────────────────────────────

const PLAYER = 'Disciplined_Monk';
const PRODUCER_KEY = '_Energy_Resistances_chosenTypes';

function makeCombatSummary(creatures) {
  return { round: 1, creatures };
}

function createPlayerCreature(name) {
  return {
    name,
    type: 'player',
    maxHp: 143,
    currentHp: 143,
    resistances: [],
    immunities: [],
    conditions: [],
    concentration: null,
    saveBonuses: {},
  };
}

// Disk-shape character (verbatim #977/#993): stale computedStats — the chooser
// stamped runtime keys AFTER this was computed, so computedStats.resistances is
// empty even though chosenTypes is live (CLA-336 staleness).
function createMonkCharacter(name, computedResistances = []) {
  return {
    name,
    campaignName: 'test-campaign',
    computedStats: {
      resistances: computedResistances,
      immunities: [],
      class_levels: [],
      equipment: [],
      characterAdvancement: [],
      allFeatures: [],
      automation: { passives: [] },
    },
  };
}

// Store-faithful keyed stub #1137/#1057 VERBATIM: only known keys answer;
// unknown keys return undefined, so the exact producer key read is itself
// under test (wrong key → undefined → no halving → red).
function stubRuntime(chosenTypes, activeBuffs = []) {
  getRuntimeValue.mockImplementation((_charName, key) => {
    if (key === 'lastAttack') return null;
    if (key === 'activeBuffs') return activeBuffs;
    if (key === 'arcaneWardActive') return false;
    if (key === 'arcaneWardHp') return 0;
    if (key === 'currentHitPoints') return 143;
    if (key === 'hitPoints') return 143;
    if (key === 'activeConditions') return [];
    if (key === 'tempHp') return 0;
    if (key === 'polymorphTempHp') return 0;
    if (key === PRODUCER_KEY) return chosenTypes;
    return undefined;
  });
}

function applyWithCharacter(character, damageTypes, rawDamage) {
  const cs = makeCombatSummary([createPlayerCreature(PLAYER)]);
  return applyDamageToTarget(cs, PLAYER, rawDamage, damageTypes, {
    campaignName: 'test-campaign',
    characters: [character],
    ignoreResistance: false,
    attackerName: 'Fire Giant 1',
  });
}

function apply(damageTypes, rawDamage) {
  return applyWithCharacter(createMonkCharacter(PLAYER), damageTypes, rawDamage);
}

// ── Tests ───────────────────────────────────────────────────────

describe('applyDamageToTarget — FT-009 Energy Resistances live multi-chooser resistance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // FT-1: multi-key LIVE fold, chosen-vs-unchosen byte-distinct #1022, element
  // census #903 over the 2-type multi-select disk shape. Raw floor/case-match
  // math canonical in helpers :52-84 — not re-driven. Campaign-keyed tuple
  // #932/#1019 + retain census #1183 asserted on every leg (key persists).
  it.each([
    ['Fire', 13, 6, [{ damageType: 'Fire', status: 'resistant' }]],
    ['Cold', 11, 5, [{ damageType: 'Cold', status: 'resistant' }]],
    ['Lightning', 15, 15, []],
    ['Slashing', 16, 16, []],
    ['Fire', 0, 0, [{ damageType: 'Fire', status: 'resistant' }]], // zero-is-data #945
  ])('%s %i → %i while Fire+Cold chosen', async (type, raw, expected, details) => {
    stubRuntime(['Fire', 'Cold']);
    const result = await apply([type], raw);
    expect(result.finalDamage).toBe(expected);
    expect(result.resistanceDetails).toEqual(details);
    expect(getRuntimeValue).toHaveBeenCalledWith(PLAYER, PRODUCER_KEY, 'test-campaign');
    // Retain census #1183: chooser key persists across hits — second hit identical.
    const again = await apply([type], raw);
    expect(again.finalDamage).toBe(expected);
  });

  // FT-2: the headline FT-009 claim, multi-slot delta — mid-session re-pick
  // changes WHICH types halve LIVE, add and remove, WITHOUT a computedStats
  // recompute. Stamp-free honest: FT-009 has no provenance stamp, so this lane
  // union-appends only — the CLA-110 stamp-REPLACE axis stays distinct.
  it('re-pick adds and removes chosen types LIVE — halving follows the current selection', async () => {
    stubRuntime(['Fire']);
    expect((await apply(['Fire'], 13)).finalDamage).toBe(6); // Fire halves
    expect((await apply(['Cold'], 11)).finalDamage).toBe(11); // Cold unchosen, full

    stubRuntime(['Fire', 'Cold']); // re-pick ADDS Cold
    expect((await apply(['Cold'], 11)).finalDamage).toBe(5); // Cold halves immediately
    expect((await apply(['Fire'], 13)).finalDamage).toBe(6); // Fire retained

    stubRuntime(['Cold']); // re-pick REMOVES Fire
    expect((await apply(['Fire'], 13)).finalDamage).toBe(13); // Fire full again
    expect((await apply(['Cold'], 11)).finalDamage).toBe(5); // Cold still halves
  });

  // FT-3: precedence falsifier #967/#1036 — the chooser lane folds BEFORE
  // addBuffResistances (:757); all three channels coexist additively and the
  // lane NEVER strips other channels (stamp-free honest vs CLA-110 REPLACE).
  it('chooser, computedStats, and buff channels coexist — each halves via its own channel (:757 falsifier)', async () => {
    // Computed while Fire was chosen: rulesFactory :196 merged Fire into the
    // sheet. No provenance stamp exists on this lane, so it survives union-add.
    const staleChar = createMonkCharacter(PLAYER, ['Thunder']);
    stubRuntime(['Cold'], [{ resistanceTypes: ['Slashing'] }]);
    expect((await applyWithCharacter(staleChar, ['Cold'], 11)).finalDamage).toBe(5); // chooser channel, live
    expect((await applyWithCharacter(staleChar, ['Slashing'], 16)).finalDamage).toBe(8); // buff channel, folded after the chooser lane at :757
    expect((await applyWithCharacter(staleChar, ['Thunder'], 14)).finalDamage).toBe(7); // computedStats channel untouched (never stripped — no stamp, honest)
    expect((await applyWithCharacter(staleChar, ['Lightning'], 15)).finalDamage).toBe(15); // unchosen everywhere
  });

  // FT-4: byte-inert census — unset (undefined fallthrough), null, and empty
  // chosenTypes all leave every damage type at full damage, zero-effect honest
  // #948/#1026. Coercion #959: array-vs-nothing, never a fabricated default.
  it.each([
    ['unset (undefined)', undefined],
    ['null', null],
    ['empty array', []],
  ])('is byte-inert when %s — all types full damage', async (_label, chosenTypes) => {
    stubRuntime(chosenTypes);
    for (const [type, dmg] of [['Fire', 13], ['Cold', 11], ['Lightning', 15]]) {
      const result = await apply([type], dmg);
      expect(result.finalDamage).toBe(dmg);
      expect(result.resistanceDetails).toEqual([]);
    }
  });

  // FT-5: key-inertness guard — reads ONLY the live producer key. The OLD
  // broken feat-name key (#789584fad regression) carries Fire+Lightning values
  // and `_Elemental_Adept_chosenType` (mirror of #1191 decoy, inverse) carries
  // Fire: if either is ever read here, the full-damage legs go red.
  it('reads ONLY the live producer key — old feat-name key and adept decoy never halve', async () => {
    getRuntimeValue.mockImplementation((_charName, key) => {
      if (key === PRODUCER_KEY) return ['Cold']; // live producer key
      if (key === '_Boon_Of_Energy_Resistance_chosenTypes') return ['Lightning', 'Fire']; // OLD broken key, #789584fad — never read
      if (key === '_Elemental_Adept_chosenType') return 'Fire'; // decoy — no lane reads this (#1191 inverse)
      if (key === 'lastAttack') return null;
      if (key === 'activeBuffs') return [];
      if (key === 'arcaneWardActive') return false;
      if (key === 'arcaneWardHp') return 0;
      if (key === 'currentHitPoints') return 143;
      if (key === 'activeConditions') return [];
      if (key === 'tempHp') return 0;
      if (key === 'polymorphTempHp') return 0;
      return undefined;
    });
    const cold = await apply(['Cold'], 11);
    expect(cold.finalDamage).toBe(5); // live key read LIVE
    expect(cold.resistanceDetails).toEqual([{ damageType: 'Cold', status: 'resistant' }]);
    for (const [type, dmg] of [['Lightning', 15], ['Fire', 13]]) {
      const result = await apply([type], dmg);
      expect(result.finalDamage).toBe(dmg); // decoy keys inert
      expect(result.resistanceDetails).toEqual([]);
    }
  });

  // FT-6: #app — every automation halving logs with event details.
  it('logs the halving via the passive-resistance log channel (exact, #app)', async () => {
    stubRuntime(['Fire', 'Cold']);
    await apply(['Fire'], 13);
    const resistLog = addEntry.mock.calls.find(
      (c) => c[1].type === 'automation' && c[1].name === 'Damage Resistance'
    );
    expect(resistLog).toBeDefined();
    expect(resistLog[1].description).toContain(PLAYER);
    expect(resistLog[1].description).toContain('Fire');
    expect(resistLog[1].description).toContain('13');
    expect(resistLog[1].description).toContain('6');
  });
});
