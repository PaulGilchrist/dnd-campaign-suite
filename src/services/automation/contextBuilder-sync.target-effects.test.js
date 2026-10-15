// @maintained-by-ai
// Target-axis targetEffects → forcedMode contract for buildAttackContextSync:
// one-shot consumption (distracting strike), unconsumed adv/dis forced modes,
// sundering-blow inertness (applied downstream), and Death Ward disadvantage.
// Fully mocked, deterministic — no churn needed when the app changes.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildAttackContextSync } from './contextBuilder.js';
import { getRuntimeValue, setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';

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

vi.mock('../combat/automation/automationExpressions.js', () => ({
  resolveDiceExpression: vi.fn(),
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
const { getCoronaSaveDisadvantage } = await import('../combat/auras/coronaAuraUtils.js');
const { isDeathWardActive } = await import('../automation/handlers/buffs/deathWardHandler.js');

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

function defaultBaseAttackContext(targetName = 'Orc', target = null) {
  buildBaseAttackContext.mockResolvedValue({
    target: target ?? { name: targetName },
    targetName,
    resistanceNotice: null,
  });
}

function defaultAuraMocks() {
  getWolfAdvantageAgainst.mockReturnValue({ advantage: false });
  getDuplicityAdvantageAgainst.mockReturnValue({ advantage: false });
  getLionDisadvantageAgainst.mockReturnValue({ disadvantage: false });
  getCoronaSaveDisadvantage.mockReturnValue({ disadvantage: false });
  getInnateSorceryBonus.mockReturnValue({ spellAdvantage: false, saveDcBonus: 0 });
}

describe('contextBuilder-sync: target effects that grant advantage (consumed)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    defaultBaseAttackContext();
    getRuntimeValue.mockReturnValue(undefined);
    defaultAuraMocks();
  });

  // WM-008 vex (next_attack_advantage, attacker-held te with vexTarget) consumption
  // lives in contextBuilder-sync.wm008-vex-consume.test.js — target-axis only here.
  it('sets advantage and consumes distracting_strike_advantage effect', async () => {
    getRuntimeValue.mockImplementation((name, key) => {
      if (name === 'campaign' && key === 'targetEffects') return [
        { effect: 'distracting_strike_advantage', target: 'Orc', source: 'Ally' },
      ];
      if (key === 'activeBuffs') return [];
      return undefined;
    });

    const result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal');

    expect(result.forcedMode).toBe('advantage');
    expect(setRuntimeValue).toHaveBeenCalledWith(
      'campaign',
      'targetEffects',
      [],
      'camp',
    );
  });

  it('preserves other effects when consuming a targeting advantage effect', async () => {
    getRuntimeValue.mockImplementation((name, key) => {
      if (name === 'campaign' && key === 'targetEffects') return [
        { effect: 'distracting_strike_advantage', target: 'Orc', source: 'Ally' },
        { effect: 'graze', target: 'Orc' },
      ];
      if (key === 'activeBuffs') return [];
      return undefined;
    });

    await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal');

    expect(setRuntimeValue).toHaveBeenCalledWith(
      'campaign',
      'targetEffects',
      [{ effect: 'graze', target: 'Orc' }],
      'camp',
    );
  });
});

describe('contextBuilder-sync: target effects that force attack mode (not consumed)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    defaultBaseAttackContext();
    getRuntimeValue.mockReturnValue(undefined);
    defaultAuraMocks();
  });

  it.each([
    { effect: 'reckless_attack', te: { effect: 'reckless_attack', target: 'Orc' }, expected: 'advantage' },
    { effect: 'crusher_enhanced_critical', te: { effect: 'crusher_enhanced_critical', target: 'Orc' }, expected: 'advantage' },
    // Protection rides the deferred resolver chain, not the stored-count scan.
    { effect: 'protection', te: { effect: 'protection', target: 'Orc', source: 'Paladin' }, expected: 'disadvantage' },
  ])('sets $expected when $effect effect is on target', async ({ te, expected }) => {
    getRuntimeValue.mockImplementation((name, key) => {
      if (name === 'campaign' && key === 'targetEffects') return [te];
      if (key === 'activeBuffs') return [];
      return undefined;
    });

    const result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal');

    expect(result.forcedMode).toBe(expected);
    // Not consumed — the te survives the attack for later turns/twins.
    expect(setRuntimeValue).not.toHaveBeenCalledWith('campaign', 'targetEffects', expect.anything(), 'camp');
  });

  it('does not set advantage/disadvantage when effect targets a different creature', async () => {
    getRuntimeValue.mockImplementation((name, key) => {
      if (name === 'campaign' && key === 'targetEffects') return [
        { effect: 'reckless_attack', target: 'Goblin' },
      ];
      if (key === 'activeBuffs') return [];
      return undefined;
    });

    const result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal');

    expect(result.forcedMode).toBeUndefined();
  });
});

describe('contextBuilder-sync: next_attack_bonus (Sundering Blow)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    defaultBaseAttackContext();
    getRuntimeValue.mockReturnValue(undefined);
    defaultAuraMocks();
  });

  // Contract (formula quirk, pinned deliberately): buildAttackContextSync computes
  // effectiveHitBonus BEFORE computeSunderingBonus runs, so the +5 never lands on
  // hitBonus here — the bonus is applied downstream in d20RollComputation.js, which
  // reads the te itself (covered in useLoggedDiceRollAttack.misc-effects.test.js).
  // This suite pins that the sync builder leaves the te intact and the bonus inert.
  it('leaves hitBonus and next_attack_bonus te untouched on target (applied downstream)', async () => {
    getRuntimeValue.mockImplementation((name, key) => {
      if (name === 'campaign' && key === 'targetEffects') return [
        { effect: 'next_attack_bonus', target: 'Orc', value: 5 },
      ];
      if (key === 'activeBuffs') return [];
      return undefined;
    });

    const result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal');

    expect(result.hitBonus).toBe(7);
    expect(result.hitBonusFormula).not.toContain('Sundering Blow');
    expect(setRuntimeValue).not.toHaveBeenCalledWith('campaign', 'targetEffects', expect.anything(), 'camp');
  });
});

describe('contextBuilder-sync: Death Ward grants disadvantage on attacks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    defaultBaseAttackContext();
    getRuntimeValue.mockReturnValue(undefined);
    defaultAuraMocks();
  });

  it('sets disadvantage when target has Death Ward buff', async () => {
    isDeathWardActive.mockReturnValue(true);

    const result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal');

    expect(result.forcedMode).toBe('disadvantage');
  });

  it('does not set disadvantage when target has no Death Ward buff', async () => {
    isDeathWardActive.mockReturnValue(false);

    const result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal');

    expect(result.forcedMode).toBeUndefined();
  });
});
