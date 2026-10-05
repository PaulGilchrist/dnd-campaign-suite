// @improved-by-ai
// CLA-110 regression: Elemental Affinity (2024 Draconic Sorcery lv6).
// The chosen-type chooser stamps the runtime key `_Elemental_Affinity_chosenType`
// (producer = elementalAffinityHandler, via choiceStorage name "Elemental
// Affinity"). rulesFactory merges it into computedStats.resistances for RENDER
// only — the damage pipeline must read that SAME producer key LIVE at
// hit-resolution (FT-009 Energy Resistances lane twin) so a mid-session
// re-pick halves damage WITHOUT a computedStats recompute.
// Locks: chosen Fire halves Fire (floor(raw/2), resisted), unchosen Cold lands
// full, re-pick Fire→Cold switches live, the halving is logged via the
// passive-resistance channel, and an absent key stays byte-inert.
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

// Stale computedStats: the chooser stamped the runtime key AFTER this was
// computed. rulesFactory :179 merges the chosen type AND stamps its
// provenance (_elementalAffinityResistedType) — the damage lane must REPLACE
// the stamped slot live (CLA-110 re-pick), not just union into it.
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

function stubRuntime(chosenType) {
  getRuntimeValue.mockImplementation((_charName, key) => {
    if (key === 'lastAttack') return null;
    if (key === 'activeBuffs') return [];
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
  const cs = makeCombatSummary([createPlayerCreature(PLAYER)]);
  return applyDamageToTarget(cs, PLAYER, rawDamage, damageTypes, {
    campaignName: 'test-campaign',
    characters: [createSorcererCharacter(PLAYER)],
    ignoreResistance: false,
    attackerName: 'DivinationWizard',
  });
}

// ── Tests ───────────────────────────────────────────────────────

describe('applyDamageToTarget — CLA-110 Elemental Affinity chosen-type live resistance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('halves Fire while Fire is chosen (resisted)', async () => {
    stubRuntime('Fire');
    const result = await apply(['Fire'], 21);
    expect(result.finalDamage).toBe(10);
    expect(result.resistanceDetails).toEqual([{ damageType: 'Fire', status: 'resistant' }]);
  });

  it('halves lowercase fire (normalization mirrors the FT-009 sibling)', async () => {
    stubRuntime('Fire');
    const result = await apply(['fire'], 25);
    expect(result.finalDamage).toBe(12);
    expect(result.resistanceDetails).toEqual([{ damageType: 'fire', status: 'resistant' }]);
  });

  it('does NOT halve Cold while Fire is chosen — full damage', async () => {
    stubRuntime('Fire');
    const result = await apply(['Cold'], 21);
    expect(result.finalDamage).toBe(21);
    expect(result.resistanceDetails).toEqual([]);
  });

  it('does NOT halve non-elemental Slashing while Fire is chosen', async () => {
    stubRuntime('Fire');
    const result = await apply(['Slashing'], 16);
    expect(result.finalDamage).toBe(16);
    expect(result.resistanceDetails).toEqual([]);
  });

  it('halves the Fire leg of a mixed Slashing+Fire attack via the breakdown', async () => {
    stubRuntime('Fire');
    const slashResult = await apply(['Slashing'], 16);
    expect(slashResult.finalDamage).toBe(16);
    expect(slashResult.resistanceDetails).toEqual([]);
    const fireResult = await apply(['Fire'], 21);
    expect(fireResult.finalDamage).toBe(10);
  });

  it('re-pick Fire→Cold switches LIVE — stale computedStats slot is REPLACED (CLA-336 staleness)', async () => {
    // Computed while Fire was live: rulesFactory merged Fire AND stamped the provenance.
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

  it('does not strip non-chooser resistances when replacing the stale slot', async () => {
    // computedStats carried Fire (chooser, stale) + Necrotic (unrelated source).
    const staleChar = createSorcererCharacter(PLAYER, ['Fire', 'Necrotic'], 'Fire');
    stubRuntime('Cold');
    const necrotic = await applyWithCharacter(staleChar, ['Necrotic'], 14);
    expect(necrotic.finalDamage).toBe(7);
    const fire = await applyWithCharacter(staleChar, ['Fire'], 21);
    expect(fire.finalDamage).toBe(21);
  });

  it('replace slot is byte-inert without the provenance stamp (legacy computedStats)', async () => {
    // Legacy pre-CLA-110 computedStats: merged Fire present, no stamp — union keeps it.
    const legacyChar = createSorcererCharacter(PLAYER, ['Fire']);
    stubRuntime('Cold');
    const fire = await applyWithCharacter(legacyChar, ['Fire'], 21);
    expect(fire.finalDamage).toBe(10);
    const cold = await applyWithCharacter(legacyChar, ['Cold'], 13);
    expect(cold.finalDamage).toBe(6);
  });

  it('logs the halving via the passive-resistance log channel', async () => {
    stubRuntime('Fire');
    addEntry.mockClear();
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

  it('is byte-inert when no chosen type is set (absent key → full damage)', async () => {
    stubRuntime(null);
    for (const [type, dmg] of [['Fire', 21], ['Cold', 13], ['Lightning', 15]]) {
      const result = await apply([type], dmg);
      expect(result.finalDamage).toBe(dmg);
      expect(result.resistanceDetails).toEqual([]);
    }
  });

  it('reads the live producer key, not a wrong name (key mismatch guard)', async () => {
    getRuntimeValue.mockImplementation((_charName, key) => {
      if (key === '_Elemental_Adept_chosenType') return 'Fire'; // wrong feature name
      if (key === '_Energy_Resistances_chosenTypes') return []; // sibling lane, empty
      if (key === '_Elemental_Affinity_chosenType') return 'Lightning'; // the live producer key
      if (key === 'activeBuffs') return [];
      if (key === 'currentHitPoints') return 62;
      return undefined;
    });
    const cs = makeCombatSummary([createPlayerCreature(PLAYER)]);
    const fire = await applyDamageToTarget(cs, PLAYER, 21, ['Fire'], {
      campaignName: 'test-campaign',
      characters: [createSorcererCharacter(PLAYER)],
      attackerName: 'DivinationWizard',
    });
    expect(fire.finalDamage).toBe(21);
    expect(fire.resistanceDetails).toEqual([]);
    const lightning = await applyDamageToTarget(cs, PLAYER, 15, ['Lightning'], {
      campaignName: 'test-campaign',
      characters: [createSorcererCharacter(PLAYER)],
      attackerName: 'DivinationWizard',
    });
    expect(lightning.finalDamage).toBe(7);
    expect(lightning.resistanceDetails).toEqual([{ damageType: 'Lightning', status: 'resistant' }]);
  });
});
