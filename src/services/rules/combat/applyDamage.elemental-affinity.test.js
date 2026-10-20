// @maintained-by-ai
// CLA-110 regression: Elemental Affinity (2024 Draconic Sorcery lv6) — CONSUMER seam.
// The chosen-type chooser stamps the runtime key `_Elemental_Affinity_chosenType`
// (producer = elementalAffinityHandler, via choiceStorage name "Elemental Affinity" —
// producer bytes owned by elementalAffinityHandler.test.js, NOT re-driven here).
// rulesFactory.js:179 merges the key into computedStats.resistances for RENDER only
// and stamps provenance `_elementalAffinityResistedType` — the damage pipeline must
// read that SAME producer key LIVE at hit-resolution (FT-009 Energy Resistances twin)
// so a mid-session re-pick halves damage WITHOUT a computedStats recompute.
// This lane owns the live-fold/REPLACE at applyDamage.js:730-750 (single-slot
// chooser). Axis verdict vs family #1182-#1190 (#1190 verbatim): CLA-110 = player
// chooser live-key lane, axis-distinct from NPC absorption fold — absorbed nothing.
// FT-009 chooser-twin sits behind: generic chooser machinery (choiceStorage
// getChosenRuntimeValue) is shared and owned there/via #976 shared-chooser-machinery;
// the FEATURE bytes here (single chosenType key, stamp-gated REPLACE — FT-009 has no
// provenance stamp) stay distinct.
//
// Leg table (dup-map #1038): chosen-vs-unchosen byte-distinct #1022 · exact live
// producer key #993 · consume-vs-retain census #1183 (affinity is NOT one-shot) ·
// precedence falsifier buff-channel vs affinity-key #1186/#1036 · stamp-gated filter
// honest leg #948/#1026 · absent-key byte-inert + wrong-name decoy guard.
// NOT re-driven here (owned elsewhere): case-insensitive match + floor(raw/2) raw
// math = canonical in applyDamage.helpers.test.js:52-84 (computeDamageAfterResistances);
// render merge/stamp = rulesFactory.js:179; choiceStorage key shape = FT-009 lane.
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

const PLAYER = 'AberrantSorcerer';

function makeCombatSummary(creatures) {
  return { round: 1, creatures };
}

function createPlayerCreature(name) {
  return {
    name,
    type: 'player',
    maxHp: 62,
    currentHp: 62,
    resistances: [],
    immunities: [],
    conditions: [],
    concentration: null,
    saveBonuses: {},
  };
}

// Disk-shape character: computedStats is what rulesFactory :179 left behind.
// Optional stale chooser slot + provenance stamp (CLA-336 staleness) — the
// damage lane must REPLACE the stamped slot live, key-gated on the stamp.
function createSorcererCharacter(name, computedResistances = [], stampedType) {
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
      ...(stampedType !== undefined ? { _elementalAffinityResistedType: stampedType } : {}),
    },
  };
}

function applyWithCharacter(character, damageTypes, rawDamage) {
  const cs = makeCombatSummary([createPlayerCreature(PLAYER)]);
  return applyDamageToTarget(cs, PLAYER, rawDamage, damageTypes, {
    campaignName: 'test-campaign',
    characters: [character],
    ignoreResistance: false,
    attackerName: 'DivinationWizard',
  });
}

// Store-faithful keyed stub #1137/#1057: only known keys answer; unknown keys
// return undefined, so the exact producer key `_Elemental_Affinity_chosenType`
// read is itself under test (wrong key → undefined → no halving → red).
function stubRuntime(chosenType, activeBuffs = []) {
  getRuntimeValue.mockImplementation((_charName, key) => {
    if (key === 'lastAttack') return null;
    if (key === 'activeBuffs') return activeBuffs;
    if (key === 'arcaneWardActive') return false;
    if (key === 'arcaneWardHp') return 0;
    if (key === 'currentHitPoints') return 62;
    if (key === 'hitPoints') return 82;
    if (key === 'activeConditions') return [];
    if (key === 'tempHp') return 0;
    if (key === 'polymorphTempHp') return 0;
    if (key === '_Elemental_Affinity_chosenType') return chosenType;
    return undefined;
  });
}

function apply(damageTypes, rawDamage) {
  return applyWithCharacter(createSorcererCharacter(PLAYER), damageTypes, rawDamage);
}

// ── Tests ───────────────────────────────────────────────────────

describe('applyDamageToTarget — CLA-110 Elemental Affinity chosen-type live resistance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Chosen-vs-unchosen byte-distinct #1022 + retain census #1183 (not one-shot).
  // Raw floor/case-match math is canonical in helpers.test.js:52-84 — not re-driven.
  it.each([
    ['Fire', 21, 10, [{ damageType: 'Fire', status: 'resistant' }]],
    ['Cold', 13, 13, []],
  ])('%s while Fire is chosen → %i (chosen absorbs, unchosen passes)', async (type, raw, expected, details) => {
    stubRuntime('Fire');
    const result = await apply([type], raw);
    expect(result.finalDamage).toBe(expected);
    expect(result.resistanceDetails).toEqual(details);
    // Retain census: the chooser key persists across hits — second hit identical.
    const again = await apply([type], raw);
    expect(again.finalDamage).toBe(expected);
  });

  it('re-pick Fire→Cold switches LIVE — stale stamped slot is REPLACED (CLA-336 staleness)', async () => {
    // Computed while Fire was live: rulesFactory :179 merged Fire AND stamped it.
    const staleChar = createSorcererCharacter(PLAYER, ['Fire'], 'Fire');
    stubRuntime('Fire');
    const first = await applyWithCharacter(staleChar, ['Fire'], 21);
    expect(first.finalDamage).toBe(10);

    // Mid-session re-pick to Cold — computedStats NEVER refreshes (stale ['Fire'] + stamp).
    stubRuntime('Cold');
    const fireAfter = await applyWithCharacter(staleChar, ['Fire'], 21);
    expect(fireAfter.finalDamage).toBe(21);
    expect(fireAfter.resistanceDetails).toEqual([]);
    const coldAfter = await applyWithCharacter(staleChar, ['Cold'], 13);
    expect(coldAfter.finalDamage).toBe(6);
    expect(coldAfter.resistanceDetails).toEqual([{ damageType: 'Cold', status: 'resistant' }]);
  });

  it('stamp REPLACE strips ONLY the chooser slot — buff and computedStats channels survive (#1186/#1036 precedence falsifier)', async () => {
    // computedStats carried Fire (chooser, stale) + Necrotic (unrelated source);
    // activeBuffs carries Fire via the SEPARATE buff channel. Live choice is Cold.
    const staleChar = createSorcererCharacter(PLAYER, ['Fire', 'Necrotic'], 'Fire');
    stubRuntime('Cold', [{ resistanceTypes: ['Fire'] }]);
    const buffFire = await applyWithCharacter(staleChar, ['Fire'], 21);
    expect(buffFire.finalDamage).toBe(10); // buff channel, folded AFTER the filter (:757)
    const necrotic = await applyWithCharacter(staleChar, ['Necrotic'], 14);
    expect(necrotic.finalDamage).toBe(7); // computedStats channel untouched by the filter
    const cold = await applyWithCharacter(staleChar, ['Cold'], 13);
    expect(cold.finalDamage).toBe(6); // affinity channel, live
  });

  it('filter is stamp-gated — legacy computedStats without provenance keeps merged Fire (union, honest leg #948/#1026)', async () => {
    // Legacy pre-CLA-110 computedStats: merged Fire present, no stamp — no replace.
    const legacyChar = createSorcererCharacter(PLAYER, ['Fire']);
    stubRuntime('Cold');
    const fire = await applyWithCharacter(legacyChar, ['Fire'], 21);
    expect(fire.finalDamage).toBe(10);
    const cold = await applyWithCharacter(legacyChar, ['Cold'], 13);
    expect(cold.finalDamage).toBe(6);
  });

  it('logs the halving via the passive-resistance log channel (exact, #app)', async () => {
    stubRuntime('Fire');
    await apply(['Fire'], 21);
    const resistLog = addEntry.mock.calls.find(
      (c) => c[1].type === 'automation' && c[1].name === 'Damage Resistance'
    );
    expect(resistLog).toBeDefined();
    expect(resistLog[1].description).toContain(PLAYER);
    expect(resistLog[1].description).toContain('Fire');
    expect(resistLog[1].description).toContain('21');
    expect(resistLog[1].description).toContain('10');
  });

  it('is byte-inert when the producer key is absent — wrong-name decoys never leak', async () => {
    // Affinity key absent while a wrong-feature-name key carries live values:
    // if the lane ever reads the wrong key (#993), Fire halves and this goes red.
    getRuntimeValue.mockImplementation((_charName, key) => {
      if (key === '_Elemental_Adept_chosenType') return 'Fire'; // decoy — no lane reads this
      if (key === 'lastAttack') return null;
      if (key === 'activeBuffs') return [];
      if (key === 'arcaneWardActive') return false;
      if (key === 'arcaneWardHp') return 0;
      if (key === 'currentHitPoints') return 62;
      if (key === 'activeConditions') return [];
      if (key === 'tempHp') return 0;
      if (key === 'polymorphTempHp') return 0;
      return undefined;
    });
    for (const [type, dmg] of [['Fire', 21], ['Cold', 13], ['Lightning', 15]]) {
      const result = await apply([type], dmg);
      expect(result.finalDamage).toBe(dmg);
      expect(result.resistanceDetails).toEqual([]);
    }
  });
});
