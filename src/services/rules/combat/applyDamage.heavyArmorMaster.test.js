// FT-045 Heavy Armor Master (2024) regression tests.
// Locks down: B/P/S reduced by PB while wearing Heavy armor (inventory.equipped
// truth via speedUtils.checkHeavyArmor), clamp >=0, refusal logs for non-B/P/S
// and no-heavy-armor, zero logs for non-holders.
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { applyDamageToTarget } from './applyDamage.js';
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';

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

vi.mock('../../rules/features/silenceService.js', () => ({
  isCreatureInSilenceZone: vi.fn(() => false),
}));

// Faithful-lite mirror of the verified reductionApplies gate; the real gate is
// unit-locked in automationPassives.test.js (FT-045 case). Here the gate INPUT
// (isWearingHeavyArmor from inventory.equipped) is what's under test.
vi.mock('../../combat/automation/automationPassives.js', () => ({
  getDamageReduction: vi.fn((playerStats, damageType, isWearingHeavyArmor) => {
    if (!playerStats?.automation) return null;
    const all = [...(playerStats.automation.passives || []), ...(playerStats.automation.reactions || [])];
    let total = 0;
    for (const a of all) {
      if (a.type !== 'damage_reduction' || a.reaction) continue;
      if (a.condition === 'wearing_heavy_armor' && !isWearingHeavyArmor) continue;
      if (a.damageTypes?.length && !a.damageTypes.some(t => t.toLowerCase() === String(damageType).toLowerCase())) continue;
      if (a.reductionExpression === 'proficiency_bonus') total += 5;
      else if (typeof a.reduction === 'number') total += a.reduction;
    }
    return total > 0 ? total : null;
  }),
  getDamageResistances: vi.fn(() => []),
}));

vi.mock('../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

global.fetch = vi.fn(() => new Promise(() => {}));

// ── Helpers ─────────────────────────────────────────────────────

const HAM_PASSIVE = {
  type: 'damage_reduction',
  name: 'Heavy Armor Master',
  reductionExpression: 'proficiency_bonus',
  damageTypes: ['Bludgeoning', 'Piercing', 'Slashing'],
  condition: 'wearing_heavy_armor',
  reaction: false,
};

const CHAIN_MAIL = { name: 'Chain Mail', equipment_category: 'Armor', armor_category: 'Heavy' };
const LEATHER = { name: 'Leather Armor', equipment_category: 'Armor', armor_category: 'Light' };
const SCIMITAR = { name: 'Scimitar', equipment_category: 'Weapon' };

function createPlayerCreature(name) {
  return {
    name,
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

function createHolder(name, { equipped = ['Scimitar', 'Chain Mail'], ham = true } = {}) {
  return {
    name,
    inventory: { equipped },
    computedStats: {
      resistances: [],
      immunities: [],
      equipment: [CHAIN_MAIL, LEATHER, SCIMITAR],
      automation: { passives: [], reactions: ham ? [HAM_PASSIVE] : [] },
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

function hamLogCalls(module) {
  return module.addEntry.mock.calls
    .map(c => c[1])
    .filter(e => e && String(e.automationType || '').startsWith('heavy_armor_master'));
}

async function hit(chars, raw, damageTypes, hp = 112) {
  const player = createPlayerCreature('EvasiveFighter');
  const cs = { round: 1, creatures: [player] };
  stubRuntime(hp);
  const result = await applyDamageToTarget(cs, 'EvasiveFighter', raw, damageTypes, {
    campaignName: 'test-campaign',
    characters: chars,
    ignoreResistance: false,
    attackerName: 'Bandit 1',
    suppressHpLog: false,
  });
  return { result, player };
}

// ── Tests ───────────────────────────────────────────────────────

describe('FT-045 Heavy Armor Master damage reduction', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const logModule = await import('../../ui/logService.js');
    logModule.addEntry.mockResolvedValue();
  });

  it('reduces Slashing by PB while wearing Chain Mail (6 → 1) and logs the applied reduction', async () => {
    const logModule = await import('../../ui/logService.js');
    const { result } = await hit([createHolder('EvasiveFighter')], 6, ['Slashing']);

    expect(result.finalDamage).toBe(1);
    expect(result.damageReducedByFeature).toBe(5);
    const hpWrite = setRuntimeValue.mock.calls.find(c => c[1] === 'currentHitPoints');
    expect(hpWrite[2]).toBe(111);

    const applied = hamLogCalls(logModule).filter(e => e.automationType === 'heavy_armor_master_applied');
    expect(applied).toHaveLength(1);
    expect(applied[0].reducedBy).toBe(5);
    expect(applied[0].rawDamage).toBe(6);
    expect(applied[0].appliedDamage).toBe(1);
    expect(applied[0].description).toContain('6 reduced to 1');
  });

  it('reduces Bludgeoning and Piercing the same way', async () => {
    const b = await hit([createHolder('EvasiveFighter')], 8, ['Bludgeoning']);
    expect(b.result.finalDamage).toBe(3);
    expect(b.result.damageReducedByFeature).toBe(5);
    const p = await hit([createHolder('EvasiveFighter')], 7, ['Piercing']);
    expect(p.result.finalDamage).toBe(2);
    expect(p.result.damageReducedByFeature).toBe(5);
  });

  it('clamps at 0 when the reduction exceeds the damage (3 → 0)', async () => {
    const { result } = await hit([createHolder('EvasiveFighter')], 3, ['Slashing']);
    expect(result.finalDamage).toBe(0);
    expect(result.damageReducedByFeature).toBe(5);
  });

  it('does NOT reduce Fire damage and logs refusal non_bp_s_damage', async () => {
    const logModule = await import('../../ui/logService.js');
    const { result } = await hit([createHolder('EvasiveFighter')], 10, ['Fire']);

    expect(result.finalDamage).toBe(10);
    expect(result.damageReducedByFeature).toBe(0);
    const refused = hamLogCalls(logModule).filter(e => e.automationType === 'heavy_armor_master_refused');
    expect(refused).toHaveLength(1);
    expect(refused[0].reason).toBe('non_bp_s_damage');
    expect(hamLogCalls(logModule).filter(e => e.automationType === 'heavy_armor_master_applied')).toHaveLength(0);
  });

  it('does NOT reduce without heavy armor equipped and logs refusal not_wearing_heavy_armor', async () => {
    const logModule = await import('../../ui/logService.js');
    const { result } = await hit([createHolder('EvasiveFighter', { equipped: ['Scimitar'] })], 6, ['Slashing']);

    expect(result.finalDamage).toBe(6);
    expect(result.damageReducedByFeature).toBe(0);
    const refused = hamLogCalls(logModule).filter(e => e.automationType === 'heavy_armor_master_refused');
    expect(refused).toHaveLength(1);
    expect(refused[0].reason).toBe('not_wearing_heavy_armor');
  });

  it('does NOT reduce or log for a non-holder wearing heavy armor', async () => {
    const logModule = await import('../../ui/logService.js');
    const { result } = await hit([createHolder('EvasiveFighter', { ham: false })], 6, ['Slashing']);

    expect(result.finalDamage).toBe(6);
    expect(result.damageReducedByFeature).toBe(0);
    expect(hamLogCalls(logModule)).toHaveLength(0);
  });
});
