// @maintained-by-ai 2026-11-26
// Sole sneak-attack owner of the contextBuilder-sync cluster (CLA-317 gate in
// contextBuilder-sync.js: computeSneakAttackDice / hasFlankingAlly / allyIsIncapacitated).
// Full output-shape contract lives in contextBuilder-sync.test.js — only the
// sneak lane's dice + isWithinRange probe census is pinned here. Fully mocked,
// no timers, stable 2024 rules — no churn expected when the app changes.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildAttackContextSync } from './contextBuilder-sync.js';
import { getRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { isWithinRange } from '../rules/combat/rangeCheck.js';
import { getCombatContext } from '../rules/combat/damageUtils.js';
import { getCurrentCombatRound } from '../encounters/combatData.js';

vi.mock('./common/damageRoll.js', () => ({
  buildBaseAttackContext: vi.fn(),
}));

vi.mock('../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
  getTargetFromAttacker: vi.fn(),
}));

vi.mock('../rules/combat/rangeCheck.js', () => ({
  isWithinRange: vi.fn().mockResolvedValue(false),
}));

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  getStore: vi.fn(() => new Map()),
  useSyncedState: vi.fn(() => [null, vi.fn()]),
  listeners: new Map(),
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../combat/buffs/buffService.js', () => ({
  getInnateSorceryBonus: vi.fn(),
}));

vi.mock('../combat/auras/wolfAuraUtils.js', () => ({
  getWolfAdvantageAgainst: vi.fn(),
}));

vi.mock('../combat/auras/duplicityAuraUtils.js', () => ({
  getDuplicityAdvantageAgainst: vi.fn(),
}));

vi.mock('../combat/auras/lionAuraUtils.js', () => ({
  getLionDisadvantageAgainst: vi.fn(),
}));

vi.mock('./handlers/spells/sanctuaryHandler.js', () => ({
  endSanctuary: vi.fn(),
  handle: vi.fn(),
}));

vi.mock('./handlers/class-cleric-paladin/avengingAngelHandler.js', () => ({
  isActive: vi.fn(),
  isAuraTarget: vi.fn(),
  handle: vi.fn(),
}));

vi.mock('../automation/handlers/buffs/protectionFromEvilAndGoodHandler.js', () => ({
  isProtectionFromEvilAndGoodActive: vi.fn().mockReturnValue(false),
  isCreatureWarded: vi.fn().mockReturnValue(false),
  handle: vi.fn(),
}));

vi.mock('../automation/handlers/buffs/deathWardHandler.js', () => ({
  isDeathWardActive: vi.fn().mockReturnValue(false),
  handle: vi.fn(),
}));

vi.mock('../combat/automation/automationService.js', () => ({
  collectWeaponMastery: vi.fn().mockReturnValue({ baseMastery: null, extraMasteries: [] }),
}));

vi.mock('../combat/automation/automationPassives.js', () => ({
  isResilientSphereActive: vi.fn().mockReturnValue(false),
}));

vi.mock('../encounters/combatData.js', () => ({
  getCurrentCombatRound: vi.fn().mockReturnValue(1),
}));

const { buildBaseAttackContext } = await import('./common/damageRoll.js');
const { getInnateSorceryBonus } = await import('../combat/buffs/buffService.js');
const { getWolfAdvantageAgainst } = await import('../combat/auras/wolfAuraUtils.js');
const { getDuplicityAdvantageAgainst } = await import('../combat/auras/duplicityAuraUtils.js');
const { getLionDisadvantageAgainst } = await import('../combat/auras/lionAuraUtils.js');

const rogueStats = {
  name: 'AasimarTest',
  level: 17,
  proficiency: 6,
  class: {
    name: 'Rogue',
    class_levels: [{ level: 17, sneak_attack_num_d6: 9 }],
  },
  abilities: [{ name: 'Dexterity', bonus: 5 }],
  automation: { passives: [] },
};

// 5e-rules dice count sits under class_specific.sneak_attack.dice_count.
const rogueStats5e = {
  ...rogueStats,
  class: {
    name: 'Rogue',
    class_levels: [{ level: 17, class_specific: { sneak_attack: { dice_count: 10 } } }],
  },
};

const finesseAttack = {
  name: 'Shortsword',
  damage: '1d6+2',
  damageType: 'Piercing',
  hitBonus: 8,
  hitBonusFormula: 'To Hit = 5 + 3',
  weaponType: 'melee',
  properties: ['Finesse', 'Light'],
};

function combatSummary(allyConds, extraCreature) {
  return {
    round: 1,
    creatures: [
      { name: 'AasimarTest', type: 'player' },
      { name: 'Thug 1', type: 'npc', attitude: 'hostile' },
      extraCreature || { name: 'ElderPaladin', type: 'player', ...(allyConds ? { conditions: allyConds } : {}) },
    ],
  };
}

function setupRuntime({ latch = null, activeConditions = [], attackerAllies } = {}) {
  getRuntimeValue.mockImplementation((name, key) => {
    if (name === 'campaign' && key === 'targetEffects') return [];
    if (name === 'AasimarTest' && key === '_SneakAttack_usedRound') return latch;
    if (name === 'AasimarTest' && key === 'selectedAllies') return attackerAllies;
    if (name === 'ElderPaladin' && key === 'activeConditions') return activeConditions;
    return undefined;
  });
}

const probeCalls = () => vi.mocked(isWithinRange).mock.calls;
const flankProbe = (ally) => ['Thug 1', ally, 5];

async function build(stats = rogueStats, attack = finesseAttack, mode = 'normal') {
  return buildAttackContextSync(attack, stats, 'camp', mode);
}

describe('CLA-317: sneak attack gate (computeSneakAttackDice / hasFlankingAlly)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    buildBaseAttackContext.mockResolvedValue({
      target: { name: 'Thug 1' },
      targetName: 'Thug 1',
      resistanceNotice: null,
    });
    getInnateSorceryBonus.mockReturnValue({ spellAdvantage: false, saveDcBonus: 0 });
    getWolfAdvantageAgainst.mockReturnValue({ advantage: false });
    getDuplicityAdvantageAgainst.mockReturnValue({ advantage: false });
    getLionDisadvantageAgainst.mockReturnValue({ disadvantage: false });
    getCurrentCombatRound.mockReturnValue(1);
    getCombatContext.mockResolvedValue(combatSummary());
    isWithinRange.mockResolvedValue(false);
    setupRuntime();
  });

  it('grants sneak when a healthy ally is within 5 ft — exactly one probe, sneak lane fields', async () => {
    isWithinRange.mockResolvedValue(true);
    const result = await build();
    expect(result).toMatchObject({
      sneakAttackDice: 9,
      targetName: 'Thug 1',
      attackerName: 'AasimarTest',
      weaponName: 'Shortsword',
    });
    expect(probeCalls()).toEqual([flankProbe('ElderPaladin')]);
  });

  // Flank cannot be established: each face refuses and pins the exact probe
  // census — out-of-range probed once, missing-combat-info never probes.
  it.each([
    ['healthy ally out of 5 ft range probes once, no grant', { rangeHit: false, probes: [flankProbe('ElderPaladin')] }],
    ['no combat summary', { rangeHit: true, summary: null, probes: [] }],
    ['target absent from initiative', {
      rangeHit: true,
      summary: { round: 1, creatures: [{ name: 'AasimarTest', type: 'player' }, { name: 'ElderPaladin', type: 'player' }] },
      probes: [],
    }],
  ])('refuses sneak — %s', async (_label, { rangeHit, summary, probes }) => {
    isWithinRange.mockResolvedValue(rangeHit);
    if (summary !== undefined) getCombatContext.mockResolvedValue(summary);
    const result = await build();
    expect(result.sneakAttackDice).toBe(0);
    expect(probeCalls()).toEqual(probes);
  });

  // Canonical ally clause: Incapacitated skips the ally BEFORE the range probe
  // (census stays empty), whichever source/shape carries the condition.
  it.each([
    ['runtime string condition', { activeConditions: ['incapacitated'] }],
    ['runtime object condition', { activeConditions: [{ key: 'Incapacitated' }] }],
    ['runtime derived alias — Stunned grants Incapacitated', { activeConditions: ['stunned'] }],
    ['conditions on combatSummary entry', { summaryConditions: [{ key: 'Incapacitated' }] }],
  ])('refuses sneak when the only in-range ally is incapacitated (%s)', async (_label, { activeConditions, summaryConditions }) => {
    isWithinRange.mockResolvedValue(true);
    if (activeConditions) setupRuntime({ activeConditions });
    if (summaryConditions) getCombatContext.mockResolvedValue(combatSummary(summaryConditions));
    const result = await build();
    expect(result.sneakAttackDice).toBe(0);
    expect(probeCalls()).toEqual([]);
  });

  // Ally filter, both models: unedited attackers get the type/attitude
  // default; Phase 3.2 betrayal — an EDITED selectedAllies list replaces it,
  // so a defector (self-only) loses former allies and named allies keep it.
  it.each([
    ['only creature in range is a hostile NPC', {
      summary: combatSummary(null, { name: 'Goblin Pet', type: 'npc', attitude: 'hostile' }),
      dice: 0, probes: [],
    }],
    ['friendly NPC (non-player) ally counts', {
      summary: combatSummary(null, { name: 'Wolf Companion', type: 'npc', attitude: 'friendly' }),
      dice: 9, probes: [flankProbe('Wolf Companion')],
    }],
    ['betrayal: defector rogue (self-only edited list) loses former ally flanking', {
      attackerAllies: ['AasimarTest'], dice: 0, probes: [],
    }],
    ['betrayal: edited list naming the flanker keeps the benefit', {
      attackerAllies: ['AasimarTest', 'ElderPaladin'], dice: 9, probes: [flankProbe('ElderPaladin')],
    }],
  ])('ally allegiance — %s', async (_label, { summary, attackerAllies, dice, probes }) => {
    isWithinRange.mockResolvedValue(true);
    if (summary) getCombatContext.mockResolvedValue(summary);
    if (attackerAllies) setupRuntime({ attackerAllies });
    const result = await build();
    expect(result.sneakAttackDice).toBe(dice);
    expect(probeCalls()).toEqual(probes);
  });

  // Forced mode short-circuits the lane: advantage grants outright,
  // disadvantage refuses — neither consults the ally range loop.
  it.each([
    ['advantage grants without probing', 'advantage', 9],
    ['disadvantage refuses even with adjacent ally', 'disadvantage', 0],
  ])('forced mode — %s', async (_label, mode, dice) => {
    isWithinRange.mockResolvedValue(true);
    const result = await build(rogueStats, finesseAttack, mode);
    expect(result.sneakAttackDice).toBe(dice);
    expect(probeCalls()).toEqual([]);
  });

  // Once per round: latch equal to the current round blocks before probing;
  // a new round re-arms.
  it.each([
    ['same round latch blocks second attack', 1, 1, 0, []],
    ['new round re-arms sneak', 1, 2, 9, [flankProbe('ElderPaladin')]],
  ])('round latch — %s', async (_label, latch, round, dice, probes) => {
    isWithinRange.mockResolvedValue(true);
    setupRuntime({ latch });
    getCurrentCombatRound.mockReturnValue(round);
    const result = await build();
    expect(result.sneakAttackDice).toBe(dice);
    expect(probeCalls()).toEqual(probes);
  });

  // Weapon/class eligibility gates return before any combat lookup; the
  // ranged face passes the gate, so its flank probe must land.
  it.each([
    ['non-finesse melee refused', { attack: { ...finesseAttack, name: 'Mace', properties: [], damageType: 'Bludgeoning' }, dice: 0, probes: [] }],
    ['non-finesse ranged still qualifies', { attack: { ...finesseAttack, name: 'Shortbow', weaponType: 'ranged', properties: [] }, dice: 9, probes: [flankProbe('ElderPaladin')] }],
    ['non-Rogue class refused', { stats: { ...rogueStats, class: { name: 'Fighter', class_levels: [] } }, dice: 0, probes: [] }],
  ])('eligibility gate — %s', async (_label, { attack, stats, dice, probes }) => {
    isWithinRange.mockResolvedValue(true);
    const result = await build(stats, attack);
    expect(result.sneakAttackDice).toBe(dice);
    expect(probeCalls()).toEqual(probes);
  });

  // Dice-count derivation per ruleset data shape (advantage isolates it).
  it.each([
    ['2024 sneak_attack_num_d6', rogueStats, 9],
    ['5e class_specific.sneak_attack.dice_count', rogueStats5e, 10],
  ])('dice count — %s', async (_label, stats, dice) => {
    const result = await build(stats, finesseAttack, 'advantage');
    expect(result.sneakAttackDice).toBe(dice);
    expect(probeCalls()).toEqual([]);
  });
});
