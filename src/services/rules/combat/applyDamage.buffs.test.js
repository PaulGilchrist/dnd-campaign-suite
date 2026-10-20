// @maintained-by-ai
// LANE — applyDamage buffs CONSUMPTION: the player-only generic activeBuffs
// resistanceTypes merge (resolveCreatureDefenses :753-757 → addBuffResistances
// :251-258) and the Arcane Ward self-absorb consumer seam (absorbIntoArcaneWard
// :418-427, gated player-only at :865-867). This lane never STRIPS buffs — the
// elemental one-shot consume (:965-989) owns stripping and lives in
// elemental-absorption.test.js (#1183 consume-writes census).
// Cite owners (NEVER re-driven here):
// - Generic resistance/immunity math CANON → applyDamage.helpers.test.js :52-84
//   (#1182; membership lookup is some() at :47/:64 — duplicate entries can never
//   double-halve, so a "dedup across buffs" assertion is vacuous and was purged)
// - elemental_absorption NPC fold + one-shot consume → applyDamage.elemental-absorption.test.js (MA-0681)
// - epitome_resistance fold → applyDamage.epitome.test.js (CLA-113)
// - FT-009 / CLA-110 chooser live folds → energy-resistance / elemental-affinity tests
// - projectedWardDamage RECORD lane → applyDamage.test.js :494-544
// - Projected Ward reaction CLICK producer (arms arcaneWardActive/arcaneWardHp) → arcaneWardHandler.test.js
// - THP absorption arithmetic → tempHpService producers (#1137 precedent)
// - Aura-granted resistances → applyDamage.auraWarding.test.js (#1185)
// Ward state here is store-faithful (#1137/#1091): arcaneWardActive/arcaneWardHp
// live in the runtime store exactly as the producer writes them; the automation
// reaction fixture on characters is inert at this seam (only damage_reduction
// wear_heavy_armor rows are read, :347-348) and was dropped.
// Exact byte delta chains damage→finalDamage→newHp (#1160); zero-consume legs
// byte-distinct (#948/#1026); decoy fields survive byte-distinct (#1183);
// campaign-keyed tuples asserted (#932/#1019, auraWarding :451 precedent).
// Runtime is stubbed KEYED by `${target}.${key}` — order-independent, no
// positional mockReturnValueOnce chains (#1057 determinism).
//
// old -> new map (5 -> 4):
// - "merges resistanceTypes from activeBuffs for player"          -> T1 leg A (+exact HP-write bytes)
// - "deduplicates resistanceTypes from multiple buffs"            -> purged as DEDUP claim (vacuous vs
//   some()-CANON); its real content — multi-buff ITERATION — folded into T1 leg B
// - "handles non-array/null activeBuffs + combines base resistances" -> T2 (null + string legs hit the
//   SAME :754 Array.isArray ternary; one string leg carries the falsifier)
// - "does not apply buff merging for NPCs"                       -> T3 (old test asserted only the READ
//   and passed for ANY damage value — vacuous, #1184 precedent; now pins full-damage bytes; fixture
//   type fixed from 'player' to 'npc' so the player-only guard is actually exercised)
// - "Projected Ward does not auto-absorb, absorbs self first"   -> T4 (+ward-depleted overflow-to-HP leg)
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Mocks BEFORE imports (hoisted by vitest) ───────────────────

// diceRoller: rollD20 is imported directly by applyDamage.js:3; rollExpression
// stays because automation/index.js (~50 importer graph modules) is transitively
// live via this lane's import graph — both exports verified live, not purged (#1094/#1132).
vi.mock('../../dice/diceRoller.js', () => ({
  rollD20: vi.fn(),
  rollExpression: vi.fn(),
}));

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
  getStore: vi.fn(() => ({ keys: () => [] })),
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

// tashasLaughterHandler: live via automation/index.js in this lane's graph — kept.
vi.mock('../../automation/handlers/spells/tashasLaughterHandler.js', () => ({
  processTashasLaughterRepeatSave: vi.fn(),
  handle: vi.fn(),
}));

// rangeValidation: live via silenceService/wardingBondService (real, consulted here).
vi.mock('./rangeValidation.js', () => ({
  getDistanceFeet: vi.fn(() => 30),
}));

vi.mock('../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

// ── Imports ─────────────────────────────────────────────────────

import { applyDamageToTarget } from './applyDamage.js';
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';

// ── Helpers ─────────────────────────────────────────────────────

const CAMPAIGN = 'TestCampaign';

// Store-faithful keyed stub: map keys are `${target}.${runtimeKey}`; every
// unstubbed read returns undefined (each consumer guards it), making the stub
// independent of source call order.
function stubRuntime(map = {}) {
  getRuntimeValue.mockImplementation((target, key) => map[`${target}.${key}`]);
}

function playerCreature(name, currentHp) {
  return {
    name,
    type: 'player',
    maxHp: currentHp,
    currentHp,
    resistances: [],
    immunities: [],
    conditions: [],
    template: [],
    concentration: null,
    saveBonuses: {},
  };
}

function npcCreature(name, currentHp) {
  return { ...playerCreature(name, currentHp), type: 'npc' };
}

function character(name, computedExtra = {}) {
  return {
    name,
    computedStats: {
      resistances: [],
      immunities: [],
      class_levels: [],
      equipment: [],
      characterAdvancement: [],
      allFeatures: [],
      ...computedExtra,
    },
  };
}

function summary(...creatures) {
  return { round: 1, creatures };
}

// ── Tests ───────────────────────────────────────────────────────

describe('applyDamageToTarget — generic buff resistanceTypes merge (player-only consumer seam)', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.restoreAllMocks());

  it('folds resistanceTypes from EVERY buff in activeBuffs into the half; decoy fields and uncovered types pay full damage', async () => {
    const buffs = [
      { name: 'Fire Dome', resistanceTypes: ['fire'], resistanceTypes2: ['lightning'] },
      { name: 'Frost Shell', resistanceTypes: ['cold'] },
    ];

    // Leg A — fire covered by buffs[0]: 10 → 5, exact HP-write bytes, campaign-keyed read.
    stubRuntime({ 'Wizard.activeBuffs': buffs, 'Wizard.currentHitPoints': 30 });
    const fire = await applyDamageToTarget(summary(playerCreature('Wizard', 30)), 'Wizard', 10, ['Fire'], { campaignName: CAMPAIGN, characters: [character('Wizard')] });
    expect(fire.finalDamage).toBe(5);
    expect(fire.newHp).toBe(25);
    expect(setRuntimeValue).toHaveBeenCalledWith('Wizard', 'currentHitPoints', 25, CAMPAIGN);
    expect(getRuntimeValue).toHaveBeenCalledWith('Wizard', 'activeBuffs', CAMPAIGN);

    // Leg B — cold covered ONLY by buffs[1]: falsifier for a first-buff-only fold.
    stubRuntime({ 'Brenna.activeBuffs': buffs, 'Brenna.currentHitPoints': 40 });
    const cold = await applyDamageToTarget(summary(playerCreature('Brenna', 40)), 'Brenna', 11, ['Cold'], { campaignName: CAMPAIGN, characters: [character('Brenna')] });
    expect(cold.finalDamage).toBe(5);
    expect(cold.newHp).toBe(35);

    // Leg C — lightning appears ONLY in the decoy field resistanceTypes2 (never read by
    // addBuffResistances): full damage byte, distinct from legs A/B halves.
    stubRuntime({ 'Corin.activeBuffs': buffs, 'Corin.currentHitPoints': 30 });
    const decoy = await applyDamageToTarget(summary(playerCreature('Corin', 30)), 'Corin', 10, ['Lightning'], { campaignName: CAMPAIGN, characters: [character('Corin')] });
    expect(decoy.finalDamage).toBe(10);
    expect(decoy.newHp).toBe(20);
  });

  it('treats non-array activeBuffs as inert (full damage, no crash) and merges buff types with base computedStats resistances without replacing either', async () => {
    // Leg A — string hits the :754 Array.isArray ternary (null takes the same branch):
    // generic buffs stay inert, damage pays in full.
    stubRuntime({ 'Soren.activeBuffs': 'not-an-array', 'Soren.currentHitPoints': 30 });
    const inert = await applyDamageToTarget(summary(playerCreature('Soren', 30)), 'Soren', 10, ['Fire'], { campaignName: CAMPAIGN, characters: [character('Soren')] });
    expect(inert.finalDamage).toBe(10);
    expect(inert.newHp).toBe(20);

    // Leg B — base computedStats carries fire, the buff carries cold: BOTH stay live.
    // A merge-that-replaced would pay full 8 on the fire leg (byte-distinct from 4).
    stubRuntime({ 'Paladin.activeBuffs': [{ resistanceTypes: ['cold'] }], 'Paladin.currentHitPoints': 30 });
    const chars = [character('Paladin', { resistances: ['fire'] })];
    const cs = summary(playerCreature('Paladin', 30));
    const viaBuff = await applyDamageToTarget(cs, 'Paladin', 11, ['Cold'], { campaignName: CAMPAIGN, characters: chars });
    expect(viaBuff.finalDamage).toBe(5);
    const viaBase = await applyDamageToTarget(cs, 'Paladin', 8, ['Fire'], { campaignName: CAMPAIGN, characters: chars });
    expect(viaBase.finalDamage).toBe(4);
    expect(viaBase.newHp).toBe(26);
  });

  it('never folds generic buff resistanceTypes into an NPC target (player-only channel; NPC elemental_absorption lane: elemental-absorption.test.js)', async () => {
    const goblin = npcCreature('Goblin', 20);
    stubRuntime({ 'Goblin.activeBuffs': [{ resistanceTypes: ['fire'] }], 'Goblin.tempHp': 0 });
    const result = await applyDamageToTarget(summary(goblin), 'Goblin', 10, ['Fire'], { campaignName: CAMPAIGN, characters: [] });
    // Byte-distinct from the player half at T1 leg A (10 vs 5): the merge never ran.
    expect(result.finalDamage).toBe(10);
    expect(result.newHp).toBe(10);
    expect(goblin.currentHp).toBe(10);
    expect(getRuntimeValue).toHaveBeenCalledWith('Goblin', 'activeBuffs', CAMPAIGN);
  });
});

describe('applyDamageToTarget — Arcane Ward self-absorb consumer seam', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.restoreAllMocks());

  it('absorbs a warden self-hit into arcaneWardHp before HP, spills the overflow to HP when the ward depletes, and never auto-absorbs an ally hit', async () => {
    // Leg A — self-hit fully inside the ward: 10 into ward of 15 → ward 5, HP untouched.
    stubRuntime({ 'Diviner.arcaneWardActive': true, 'Diviner.arcaneWardHp': 15, 'Diviner.currentHitPoints': 20 });
    const self = await applyDamageToTarget(summary(playerCreature('Diviner', 20)), 'Diviner', 10, ['Fire'], { campaignName: CAMPAIGN, characters: [character('Diviner')] });
    expect(self.newHp).toBe(20);
    expect(setRuntimeValue).toHaveBeenCalledWith('Diviner', 'arcaneWardHp', 5, CAMPAIGN);
    expect(setRuntimeValue).toHaveBeenCalledWith('Diviner', 'currentHitPoints', 20, CAMPAIGN);

    // Leg B — ward depletes mid-hit: 10 into ward of 8 → ward 0 written, overflow 2
    // reaches HP (20 → 18). Honest partial-absorption bytes (#1160).
    stubRuntime({ 'Elara.arcaneWardActive': true, 'Elara.arcaneWardHp': 8, 'Elara.currentHitPoints': 20 });
    const spill = await applyDamageToTarget(summary(playerCreature('Elara', 20)), 'Elara', 10, ['Cold'], { campaignName: CAMPAIGN, characters: [character('Elara')] });
    expect(setRuntimeValue).toHaveBeenCalledWith('Elara', 'arcaneWardHp', 0, CAMPAIGN);
    expect(spill.newHp).toBe(18);
    expect(setRuntimeValue).toHaveBeenCalledWith('Elara', 'currentHitPoints', 18, CAMPAIGN);

    // Leg C — ally takes the hit while the warden's ward stands: NO auto-absorb
    // (absorption is reaction-click owned — arcaneWardHandler.test.js producer lane).
    // The projectedWardDamage RECORD this write enables is owned by applyDamage.test.js :494.
    stubRuntime({
      'Mystra.arcaneWardActive': true,
      'Mystra.arcaneWardHp': 12,
      'Bryn.currentHitPoints': 20,
    });
    const ally = await applyDamageToTarget(
      summary(playerCreature('Mystra', 20), playerCreature('Bryn', 20)),
      'Bryn', 10, ['Thunder'],
      { campaignName: CAMPAIGN, characters: [character('Mystra'), character('Bryn')] }
    );
    expect(ally.newHp).toBe(10);
    expect(setRuntimeValue).not.toHaveBeenCalledWith('Mystra', 'arcaneWardHp', expect.any(Number));
  });
});
