// @maintained-by-ai
// contextBuilder-sync advantage/disadvantage PRIORITY lane — the only suite
// asserting the ordering contract of buildAttackContextSync's forced-mode chain:
//   conditionAttackMode > stored/buff-scan accumulation > deferred resolvers > dis fold.
// Individual lane behaviours live in their own sibling suites (buffs, wolf-aura,
// improved-duplicity, target-effects, foresight-dis, wm008-vex-consume, buffs
// vow-of-enmity, and the core shapes in contextBuilder-sync.test.js) — do not
// re-add single-source pass/fail tests here; this file is about WHO WINS.
// Deterministic: all externals mocked → stable contract, flag kept.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildAttackContextSync } from './contextBuilder.js';
import { getRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';

vi.mock('./common/damageRoll.js', () => ({
  buildBaseAttackContext: vi.fn(),
}));

vi.mock('../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
  getTargetFromAttacker: vi.fn(),
}));

vi.mock('../maps/mapsService.js', () => ({
  loadMapData: vi.fn(),
}));

vi.mock('../rules/combat/rangeValidation.js', () => ({
  computeRangeEffect: vi.fn(),
  computeMeleeProximityEffect: vi.fn(),
  getDistanceFeet: vi.fn(),
  isHostileNPC: vi.fn(),
  getNearestPlacedItem: vi.fn(),
  rangeToFeet: vi.fn(),
}));

vi.mock('../rules/combat/rangeCheck.js', () => ({
  isWithinRange: vi.fn().mockResolvedValue(true),
}));

vi.mock('../rules/combat/coverService.js', () => ({
  computeCover: vi.fn(),
}));

vi.mock('../npcs/npcsService.js', () => ({
  loadNPCs: vi.fn(),
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

vi.mock('../combat/auras/coronaAuraUtils.js', () => ({
  getCoronaSaveDisadvantage: vi.fn(),
}));

vi.mock('./handlers/class-cleric-paladin/avengingAngelHandler.js', () => ({
  isActive: vi.fn(),
  isAuraTarget: vi.fn(),
  handle: vi.fn(),
}));

const { buildBaseAttackContext } = await import('./common/damageRoll.js');
const { getCombatContext } = await import('../rules/combat/damageUtils.js');
const { getInnateSorceryBonus } = await import('../combat/buffs/buffService.js');
const { getWolfAdvantageAgainst } = await import('../combat/auras/wolfAuraUtils.js');
const { getDuplicityAdvantageAgainst } = await import('../combat/auras/duplicityAuraUtils.js');
const { getLionDisadvantageAgainst } = await import('../combat/auras/lionAuraUtils.js');
const { getCoronaSaveDisadvantage } = await import('../combat/auras/coronaAuraUtils.js');

const mockStats = {
  name: 'Fighter1',
  level: 5,
  proficiency: 2,
  class: {
    class_levels: [{ rage_damage: 2 }],
  },
  abilities: [
    { name: 'Charisma', bonus: 2 },
    { name: 'Strength', bonus: 4 },
    { name: 'Dexterity', bonus: 3 },
  ],
  automation: {
    passives: [],
  },
};

const mockAttack = {
  name: 'Longsword',
  damage: '1d8+4',
  damageType: 'Slashing',
  hitBonus: 7,
  hitBonusFormula: 'To Hit = 4 + 2 + 1',
  weaponType: 'melee',
};

// 2024 Ranger level 17 with the precise_hunter passive (mockStats otherwise has none).
const rangerStats = {
  ...mockStats,
  name: 'TestRanger',
  automation: {
    passives: [
      { type: 'passive_rule', effect: 'precise_hunter', name: 'Precise Hunter' },
    ],
  },
};

function defaultBaseAttackContext(targetName = 'Orc', target = null) {
  buildBaseAttackContext.mockResolvedValue({
    target: target ?? { name: targetName },
    targetName,
    resistanceNotice: null,
  });
}

// Every adv/dis source OFF — each test switches on exactly the sources it needs.
// (Shared re-stub boilerplate across the sync cluster could later move to a
// contextBuilder-sync.test-utils.js — deliberately not created mid-queue.)
function neutralSources() {
  getRuntimeValue.mockReturnValue(undefined);
  getCombatContext.mockResolvedValue({ creatures: [] });
  getInnateSorceryBonus.mockReturnValue({ spellAdvantage: false, saveDcBonus: 0 });
  getWolfAdvantageAgainst.mockReturnValue({ advantage: false });
  getDuplicityAdvantageAgainst.mockReturnValue({ advantage: false });
  getLionDisadvantageAgainst.mockReturnValue({ disadvantage: false });
  getCoronaSaveDisadvantage.mockReturnValue({ disadvantage: false });
}

describe('contextBuilder-sync: forcedMode priority chain', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    defaultBaseAttackContext();
    neutralSources();
  });

  it('all advantage sources are checked before any disadvantage sources', async () => {
    // Buff-scan advantage (Reckless-style buff) must resolve forcedMode='advantage'
    // before the deferred chain ever reaches the protection-te, Lion aura, or
    // Corona disadvantage resolvers.
    getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'activeBuffs') return [{ effect: 'advantage_attacks_advantage_against' }];
      if (name === 'campaign' && key === 'targetEffects') return [{ effect: 'protection', target: 'Orc', source: 'Paladin' }];
      return undefined;
    });
    getLionDisadvantageAgainst.mockReturnValue({ disadvantage: true });
    getCoronaSaveDisadvantage.mockReturnValue({ disadvantage: true });

    const result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal');

    expect(result.forcedMode).toBe('advantage');
  });

  it('precise_hunter defers to the higher-priority vow of enmity resolver', async () => {
    // Vow of enmity is deferred resolver #1, precise_hunter #5. Hunter's Mark
    // concentration is live (precise_hunter WOULD fire), so if the resolver
    // order flipped, advantageReason would carry the precise-hunter stamp.
    getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'activeBuffs') return [{ effect: 'vow_of_enmity' }];
      return undefined;
    });
    getCombatContext.mockResolvedValue({
      creatures: [
        { name: 'TestRanger', concentration: { spell: "Hunter's Mark", target: 'Orc' } },
        { name: 'Orc' },
      ],
    });

    const result = await buildAttackContextSync(mockAttack, rangerStats, 'camp', 'normal');

    expect(result.forcedMode).toBe('advantage');
    expect(result.advantageReason).toBeUndefined();
  });
});

describe('contextBuilder-sync: precise hunter (2024 Ranger level 17)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    defaultBaseAttackContext();
    neutralSources();
  });

  it('sets advantage when attacker has precise_hunter passive and target has Hunter\'s Mark concentration', async () => {
    getCombatContext.mockResolvedValue({
      creatures: [
        { name: 'TestRanger', concentration: { spell: "Hunter's Mark", target: 'Orc' } },
        { name: 'Orc' },
      ],
    });

    const result = await buildAttackContextSync(mockAttack, rangerStats, 'camp', 'normal');

    expect(result.forcedMode).toBe('advantage');
    expect(result.advantageReason).toBe('Precise Hunter (Hunter\'s Mark)');
  });

  it('does not set advantage when attacker has precise_hunter but lacks Hunter\'s Mark concentration', async () => {
    getCombatContext.mockResolvedValue({
      creatures: [
        { name: 'TestRanger' },
        { name: 'Orc' },
      ],
    });

    const result = await buildAttackContextSync(mockAttack, rangerStats, 'camp', 'normal');

    expect(result.forcedMode).toBeUndefined();
    expect(result.advantageReason).toBeUndefined();
  });

  it('does not set advantage when target has Hunter\'s Mark but attacker lacks precise_hunter', async () => {
    getCombatContext.mockResolvedValue({
      creatures: [
        { name: 'TestCharacter' },
        { name: 'Orc', concentration: { spell: "Hunter's Mark" } },
      ],
    });

    const result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal');

    expect(result.forcedMode).toBeUndefined();
    expect(result.advantageReason).toBeUndefined();
  });
});
