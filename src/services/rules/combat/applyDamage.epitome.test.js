// @maintained-by-ai
// LANE — CLA-113 Epitome of Magic CONSUMER seam: applyDamage folds the chosen
// type stamped on activeBuffs by the producer LIVE at hit-resolution.
// Cite table (bytes consulted, owners cited not re-driven):
// - getEpitomeResistances effect-scoped filter :268-273; LIVE fold into
//   resistances (halve) + passiveResistances (log) :758-766; the
//   activeBuffs read seam :753 (real store arity is 2 — useRuntimeState.js
//   :63; the trailing campaignName arg is ignored there, campaign scoping
//   lives in the per-campaign store seeding, not the call).
// - Producer bytes (cited, NEVER re-driven here): elementalEpitomeHandler
//   .applyResistanceChoice :34-57 — REPLACES the 'Elemental Epitome' entry
//   IN PLACE (:40-54) on every re-pick, so the consumer needs no refresh
//   (CLA-336 staleness immunity). Expiry census: short rest PRUNES the buff
//   entry with the generic activeBuffs filter (restRules-shortRest :318-322);
//   long rest clears the mirror keys (restRules-longRest :671-672).
// - #1050 round-latch verdict: this lane has NO round latch and no Date.now
//   gate — resistance is LIVE-until-replaced by design (per-turn
//   re-choosability via in-place replace, pinned by T2). The only round
//   latch in the epitome family is epitomeEmpoweredUsedRound on the EMPOWERED
//   STRIKES step (epitomeEmpoweredStrikes.js :15/:31) — a different lane,
//   not the applyDamage resistance fold owned here.
// Cite owners (NEVER re-driven here):
// - resistance/immunity math + some() membership CANON → applyDamage.helpers.test.js :52-84 (#1182)
// - generic resistanceTypes merge + Arcane Ward → applyDamage.buffs.test.js (#1185)
// - elemental_absorption one-shot consume → applyDamage.elemental-absorption.test.js (MA-0681/#1183)
// - FT-009 / CLA-110 chooser live folds + their log legs → energy-resistance / elemental-affinity tests
// - Aura-granted resistances → applyDamage.auraWarding.test.js (#1185/:451 arity-discovery exemplar)
// Runtime stub is store-faithful and KEYED by `${characterKey}.${propertyName}`
// (#1057 determinism, #1137 unknown-key exact-read: real store returns null
// for unseeded keys, so projectedWardDamage/activeConditions/default hit null).
// Dead stub branches purged (#1094): arcaneWardHp is gated behind a FALSY
// arcaneWardActive at :419-421 — never read on this unwarded lane.
// Log exact (#app): passive-resistance channel description byte-pinned (:327);
// arm-vs-absent byte-distinct (#1022); precedence falsifier (#967/#1036).
//
// old -> new map (8 -> 4):
// - "halves Fire while epitome Fire is armed"          -> T1 leg A (+ exact log bytes, old T5 same-stub same-hit)
// - "does NOT halve Cold while Fire is chosen"         -> T1 leg B (chosen-specificity falsifier)
// - "halves lowercase fire"                            -> T1 leg C (stamp passes through to the some() lookup untouched;
//   arithmetic CANON stays in helpers :71, this only pins pass-through)
// - "logs the halving via the passive-resistance log channel" -> folded into T1 (one hit, full result contract)
// - "per-turn re-pick Fire→Cold switches LIVE"         -> T2 (CLA-113 core, kept verbatim)
// - "byte-inert without the epitome effect"            -> T3 leg A (stray damageType on another effect — the
//   :270 effect-filter falsifier)
// - "byte-inert with no activeBuffs"                   -> T3 leg B (Cold/Lightning loop legs purged: repeats of
//   the same ternary, vacuous once leg A passes, #1184)
// - "resistanceTypes buffs still fold unchanged next to the epitome entry" -> T4 (multi-channel precedence falsifier)
import { describe, it, expect, vi, beforeEach } from 'vitest';

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

vi.mock('../../combat/automation/automationExpressions.js', () => ({
  evaluateAutoExpression: vi.fn(),
}));
vi.mock('../core/attackCalc.js', () => ({
  parseMagicWordName: vi.fn(),
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

function createPlayerCreature(name) {
  return {
    name,
    type: 'player',
    maxHp: 183,
    currentHp: 183,
    resistances: [],
    immunities: [],
    conditions: [],
    concentration: null,
    saveBonuses: {},
  };
}

function createMonkCharacter(name) {
  return {
    name,
    campaignName: 'test-campaign',
    computedStats: {
      resistances: [],
      immunities: [],
      class_levels: [],
      equipment: [],
      characterAdvancement: [],
      allFeatures: [],
      automation: { passives: [] },
    },
  };
}

function epitomeBuff(type) {
  return { name: 'Elemental Epitome', effect: 'epitome_resistance', damageType: type };
}

// Store-faithful keyed stub (#1057/#1137): unknown keys return null exactly
// like the real store (useRuntimeState.js :74). currentHitPoints must be a
// number — applyPlayerHpDamage THROWS on null (:452-463).
function stubRuntime(activeBuffs) {
  const map = {
    'campaign.lastAttack': null,
    [`${PLAYER}.activeBuffs`]: activeBuffs,
    [`${PLAYER}.arcaneWardActive`]: false,
    [`${PLAYER}.tempHp`]: 0,
    [`${PLAYER}.polymorphTempHp`]: 0,
    [`${PLAYER}.currentHitPoints`]: 183,
    [`${PLAYER}.hitPoints`]: 183,
  };
  getRuntimeValue.mockImplementation(
    (characterKey, propertyName) => map[`${characterKey}.${propertyName}`] ?? null
  );
}

function apply(damageTypes, rawDamage) {
  const combatSummary = { round: 1, creatures: [createPlayerCreature(PLAYER)] };
  return applyDamageToTarget(combatSummary, PLAYER, rawDamage, damageTypes, {
    campaignName: 'test-campaign',
    characters: [createMonkCharacter(PLAYER)],
    attackerName: 'DivinationWizard',
  });
}

const resistLogs = () =>
  addEntry.mock.calls.filter((c) => c[1].type === 'automation' && c[1].name === 'Damage Resistance');

// ── Tests ───────────────────────────────────────────────────────

describe('applyDamageToTarget — CLA-113 Elemental Epitome chosen-type live resistance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('folds the chosen type LIVE: Fire halved with exact log bytes, unchosen Cold full, lowercase fire still matches', async () => {
    stubRuntime([epitomeBuff('Fire')]);

    const fire = await apply(['Fire'], 29);
    expect(fire.finalDamage).toBe(14);
    expect(fire.resistanceDetails).toEqual([{ damageType: 'Fire', status: 'resistant' }]);

    // Unchosen type must NOT inherit the resistance (specificity falsifier —
    // without the epitome fold this same call is byte-identical full damage).
    const cold = await apply(['Cold'], 21);
    expect(cold.finalDamage).toBe(21);
    expect(cold.resistanceDetails).toEqual([]);

    // The buff's damageType passes through :270-271 untouched; case-insensitive
    // membership is CANON (helpers :71) — this leg only pins the pass-through.
    const lower = await apply(['fire'], 25);
    expect(lower.finalDamage).toBe(12);

    // Passive-resistance log channel, exact (#app): halved hits log, the
    // full-damage Cold hit never logs (guard :791 + matched filter :318-322).
    const logs = resistLogs();
    expect(logs).toHaveLength(2);
    expect(logs[0][1].description).toBe(`${PLAYER} has resistance to Fire damage — 29 damage halved to 14.`);
    expect(logs[1][1].description).toBe(`${PLAYER} has resistance to fire damage — 25 damage halved to 12.`);
  });

  it('per-turn re-pick Fire→Cold switches LIVE — producer replaces the entry in place', async () => {
    stubRuntime([epitomeBuff('Fire')]);
    const first = await apply(['Fire'], 29);
    expect(first.finalDamage).toBe(14);

    // Start of next turn: handler re-picks Cold by REPLACING the same entry
    // (elementalEpitomeHandler :40-47) — consumer re-reads at every hit.
    stubRuntime([epitomeBuff('Cold')]);
    const fireAfter = await apply(['Fire'], 29);
    expect(fireAfter.finalDamage).toBe(29);
    expect(fireAfter.resistanceDetails).toEqual([]);
    const coldAfter = await apply(['Cold'], 13);
    expect(coldAfter.finalDamage).toBe(6);
    expect(coldAfter.resistanceDetails).toEqual([{ damageType: 'Cold', status: 'resistant' }]);
  });

  it('is byte-inert outside the epitome effect — stray damageType or empty activeBuffs never halve', async () => {
    // Generic buff carrying a stray damageType must NOT grant resistance
    // (effect-scoped filter falsifier, MA-0681 shape at :270).
    stubRuntime([{ name: 'Something Else', effect: 'other', damageType: 'Fire' }]);
    const stray = await apply(['Fire'], 29);
    expect(stray.finalDamage).toBe(29);
    expect(stray.resistanceDetails).toEqual([]);

    stubRuntime([]);
    const none = await apply(['Fire'], 29);
    expect(none.finalDamage).toBe(29);
    expect(none.resistanceDetails).toEqual([]);
  });

  it('resistanceTypes buffs (existing lane) still fold unchanged next to the epitome entry', async () => {
    // Multi-channel precedence falsifier (#967/#1036): epitome fold must not
    // displace addBuffResistances (:251-258, owned by applyDamage.buffs).
    stubRuntime([
      epitomeBuff('Fire'),
      { name: 'Protection', effect: 'protection', resistanceTypes: ['Cold'] },
    ]);
    const fire = await apply(['Fire'], 29);
    expect(fire.finalDamage).toBe(14);
    const cold = await apply(['Cold'], 21);
    expect(cold.finalDamage).toBe(10);
  });
});
