// @maintained-by-ai
// FT-045 Heavy Armor Master (2024) consumer-seam lane: applyDamage feature
// reduction → HP → log. Owns applyFeatureDamageReduction (applyDamage.js:397-415):
// worn-armor truth via inventory.equipped names resolved by the REAL
// speedUtils.checkHeavyArmor (:381-385), flat PB subtraction with :403 floor,
// applied/refused automation-log gating (:405, :410-412) and its reason ternary.
//
// Runs the REAL automationPassives.getDamageReduction end-to-end (no mirror
// mock) with the verbatim disk automation row — public/data/2024/feats.json
// Heavy Armor Master → Damage Reduction automation; PB resolves via
// computedStats.proficiency (disk shape: HexWarlock.json:1512 "proficiency": 5).
//
// Owners cited, NOT re-driven here:
// - reductionApplies B/P/S damageTypes + wearing_heavy_armor condition gate in
//   both directions → automationPassives.test.js:543-561 (FT-045 unit-lock).
//   Consumer sees one number; per-type legs live there.
// - Generic resistance/save arithmetic (halve, floor, immunity priority) →
//   applyDamage.helpers.test.js:52-84 CANON (next queue entry).
// - Entry guards (null summary / unusable rawDamage / missing target) →
//   applyDamage.test.js:157-163.
// - Feat grant/parsing of the automation row onto computedStats →
//   computeFeatBuffs.2024.test.js:431 (verbatim disk passthrough).
// - Crit vs normal: this seam has no crit branch (reduction applies to
//   post-resistance finalDamage at :401-403) — no crit leg here, honestly.
//
// old→new map:
// - "reduces Slashing by PB (6 → 1)" → strengthened: real gate + real
//   proficiency_bonus resolution (mock mirror retired), exact applied-log
//   bytes incl. campaign arg, HP write pinned.
// - "reduces Bludgeoning and Piercing the same way" → removed: same channel
//   unit-locked at automationPassives.test.js:548-561; consumer path is
//   type-agnostic once reduction > 0.
// - "clamps at 0 (3 → 0)" → kept: falsifies Math.max at :403; zero-is-data
//   (applied log still honest with appliedDamage 0).
// - Fire refusal + bare-hand refusal → consolidated into one it.each reason
//   table (kills both arms of the :411 ternary) plus a light-armor-only leg
//   (Chain Mail still in equipment) falsifying any-armor-worn detection.
// - "non-holder zero logs" → kept.
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { applyDamageToTarget } from './applyDamage.js';
import { addEntry } from '../../ui/logService.js';
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';

// ── Mocks (family-standard; automationPassives REAL — no mirror) ──

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
  getStore: vi.fn(() => ({ keys: () => [] })),
}));

// 'proficiency_bonus' resolves arithmetically to 5 via PB substitution — no
// dice roll on this seam; canRollExpression must exist for the real
// automationExpressions import graph.
vi.mock('../../dice/diceRoller.js', () => ({
  rollD20: vi.fn(() => 10),
  rollExpression: vi.fn(),
  rollExpressionMaximized: vi.fn(),
  canRollExpression: vi.fn(() => false),
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

vi.mock('../../rules/features/silenceService.js', () => ({
  isCreatureInSilenceZone: vi.fn(() => false),
}));

vi.mock('../../ui/logService.js', () => ({
  addEntry: vi.fn(async () => {}),
}));

global.fetch = vi.fn(() => new Promise(() => {}));

// ── Fixtures (verbatim disk shapes) ──────────────────────────────

// verbatim: public/data/2024/feats.json → Heavy Armor Master → benefits
// ["Damage Reduction"].automation (no fabricated name/reaction fields).
const HAM_AUTOMATION = {
  type: 'damage_reduction',
  reductionExpression: 'proficiency_bonus',
  damageTypes: ['Bludgeoning', 'Piercing', 'Slashing'],
  condition: 'wearing_heavy_armor',
  casting_time: '1 reaction',
};

// verbatim names/categories from public/data/equipment.json.
const CHAIN_MAIL = { name: 'Chain Mail', equipment_category: 'Armor', armor_category: 'Heavy' };
const LEATHER = { name: 'Leather', equipment_category: 'Armor', armor_category: 'Light' };
const SCIMITAR = { name: 'Scimitar', equipment_category: 'Weapon' };

const TARGET = 'IronGuard';

function createCreature() {
  return {
    name: TARGET,
    type: 'player',
    maxHp: 112,
    currentHp: 112,
    resistances: [],
    immunities: [],
    conditions: [],
    concentration: null,
    saveBonuses: {},
  };
}

function createHolder({ equipped = ['Scimitar', 'Chain Mail'], ham = true } = {}) {
  return {
    name: TARGET,
    inventory: { equipped },
    computedStats: {
      resistances: [],
      immunities: [],
      proficiency: 5,
      equipment: [CHAIN_MAIL, LEATHER, SCIMITAR],
      automation: { passives: [], reactions: ham ? [HAM_AUTOMATION] : [] },
    },
  };
}

function stubRuntime(currentHp) {
  getRuntimeValue.mockImplementation((_charName, key) => {
    if (key === 'lastAttack') return null;
    if (key === 'activeBuffs') return [];
    if (key === 'arcaneWardActive') return false;
    if (key === 'arcaneWardHp') return 0;
    if (key === 'currentHitPoints') return currentHp;
    if (key === 'hitPoints') return currentHp;
    if (key === 'activeConditions') return [];
    if (key === 'tempHp') return 0;
    if (key === 'polymorphTempHp') return 0;
    return undefined;
  });
}

function hamLogCalls() {
  return addEntry.mock.calls.filter(c => c[1] && String(c[1].automationType || '').startsWith('heavy_armor_master'));
}

async function hit(chars, raw, damageTypes, hp = 112) {
  stubRuntime(hp);
  return applyDamageToTarget(
    { round: 1, creatures: [createCreature()] },
    TARGET,
    raw,
    damageTypes,
    {
      campaignName: 'test-campaign',
      characters: chars,
      ignoreResistance: false,
      attackerName: 'Bandit 1',
      suppressHpLog: false,
    }
  );
}

// ── Tests ─────────────────────────────────────────────────────────

describe('FT-045 Heavy Armor Master damage reduction (applyDamage consumer seam)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reduces Slashing by the real resolved PB while Chain Mail is worn — 6 → 1, HP 111, exact applied log', async () => {
    const result = await hit([createHolder()], 6, ['Slashing']);

    expect(result.finalDamage).toBe(1);
    expect(result.damageReducedByFeature).toBe(5);
    const hpWrite = setRuntimeValue.mock.calls.find(c => c[1] === 'currentHitPoints');
    expect(hpWrite[2]).toBe(111);

    const applied = hamLogCalls().filter(c => c[1].automationType === 'heavy_armor_master_applied');
    expect(applied).toHaveLength(1);
    expect(applied[0][0]).toBe('test-campaign');
    expect(applied[0][1]).toMatchObject({
      characterName: TARGET,
      reducedBy: 5,
      rawDamage: 6,
      appliedDamage: 1,
      damageType: 'Slashing',
    });
    expect(applied[0][1].description).toContain('6 reduced to 1');
  });

  it('floors the reduction at 0 — 3 Slashing → 0 never negative, full 5 still reported, honest appliedDamage 0 log', async () => {
    const result = await hit([createHolder()], 3, ['Slashing']);

    expect(result.finalDamage).toBe(0);
    expect(result.damageReducedByFeature).toBe(5);

    const applied = hamLogCalls().filter(c => c[1].automationType === 'heavy_armor_master_applied');
    expect(applied).toHaveLength(1);
    expect(applied[0][1].appliedDamage).toBe(0);
    expect(applied[0][1].description).toContain('3 reduced to 0');
  });

  it.each([
    { raw: 10, damageType: 'Fire', equipped: ['Scimitar', 'Chain Mail'], reason: 'non_bp_s_damage' },
    { raw: 6, damageType: 'Slashing', equipped: ['Scimitar'], reason: 'not_wearing_heavy_armor' },
    { raw: 6, damageType: 'Slashing', equipped: ['Scimitar', 'Leather'], reason: 'not_wearing_heavy_armor' },
  ])('refuses $damageType with $equipped worn — full $raw damage, refusal log reason $reason', async ({ raw, damageType, equipped, reason }) => {
    const result = await hit([createHolder({ equipped })], raw, [damageType]);

    expect(result.finalDamage).toBe(raw);
    expect(result.damageReducedByFeature).toBe(0);

    const refused = hamLogCalls().filter(c => c[1].automationType === 'heavy_armor_master_refused');
    expect(refused).toHaveLength(1);
    expect(refused[0][1].reason).toBe(reason);
    expect(refused[0][1].damageType).toBe(damageType);
    expect(refused[0][1].description).toBe(`Heavy Armor Master does not reduce this ${damageType} damage (${reason}).`);
    expect(hamLogCalls().filter(c => c[1].automationType === 'heavy_armor_master_applied')).toHaveLength(0);
  });

  it('non-holder in Heavy armor takes full damage with zero heavy_armor_master logs', async () => {
    const result = await hit([createHolder({ ham: false })], 6, ['Slashing']);

    expect(result.finalDamage).toBe(6);
    expect(result.damageReducedByFeature).toBe(0);
    expect(hamLogCalls()).toHaveLength(0);
  });
});
