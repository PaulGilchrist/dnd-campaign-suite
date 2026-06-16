import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks BEFORE imports (hoisted by vitest) ───────────────────

vi.mock('../rules/combat/damageUtils.js', () => ({
  getTargetFromAttacker: vi.fn(),
  getCombatContext: vi.fn(),
  getResistanceNotice: vi.fn(),
  getAttackerTargetName: vi.fn(),
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

vi.mock('../rules/combat/coverService.js', () => ({
  computeCover: vi.fn(),
}));

vi.mock('../npcs/npcsService.js', () => ({
  loadNPCs: vi.fn(),
}));

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
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

// ── Imports (Vite returns mocked versions) ─────────────────────

import {
  buildAttackContext,
  buildAttackContextSync,
} from './contextBuilder.js';

import * as damageUtils from '../rules/combat/damageUtils.js';
import * as mapsService from '../maps/mapsService.js';
import * as rangeValidation from '../rules/combat/rangeValidation.js';
import * as coverService from '../rules/combat/coverService.js';
import * as npcsService from '../npcs/npcsService.js';
import * as runtimeState from '../../hooks/runtime/useRuntimeState.js';
import * as buffService from '../combat/buffs/buffService.js';
import * as wolfAura from '../combat/auras/wolfAuraUtils.js';
import * as duplicityAura from '../combat/auras/duplicityAuraUtils.js';
import * as lionAura from '../combat/auras/lionAuraUtils.js';
import * as coronaAura from '../combat/auras/coronaAuraUtils.js';

// ── Helpers ────────────────────────────────────────────────────

function makeAttack(overrides = {}) {
  return {
    name: 'Longsword',
    damage: '1d8+3',
    damageType: 'Slashing',
    weaponType: 'melee',
    range: 5,
    saveDc: 12,
    saveType: 'Dexterity',
    saveSuccess: 'Half Damage',
    ...overrides,
  };
}

function makePlayerStats(overrides = {}) {
  return {
    name: 'Thorin',
    level: 5,
    class: null,
    ...overrides,
  };
}

// Set up safe defaults for all mocks. Call this at the start of each test.
function setupSafeDefaults() {
  vi.clearAllMocks();

  // damageUtils defaults
  damageUtils.getTargetFromAttacker.mockReturnValue(null);
  damageUtils.getCombatContext.mockResolvedValue(null);
  damageUtils.getResistanceNotice.mockReturnValue(null);
  damageUtils.getAttackerTargetName.mockReturnValue(undefined);

  // runtimeState defaults
  runtimeState.getRuntimeValue.mockReturnValue(null);
  runtimeState.setRuntimeValue.mockReturnValue(undefined);

  // buffService defaults
  buffService.getInnateSorceryBonus.mockReturnValue({ spellAdvantage: false, saveDcBonus: 0 });

  // Aura defaults — no advantage/disadvantage
  wolfAura.getWolfAdvantageAgainst.mockReturnValue({ advantage: false });
  duplicityAura.getDuplicityAdvantageAgainst.mockReturnValue({ advantage: false });
  lionAura.getLionDisadvantageAgainst.mockReturnValue({ disadvantage: false });
  coronaAura.getCoronaSaveDisadvantage.mockReturnValue({ disadvantage: false });

  // rangeValidation defaults
  rangeValidation.rangeToFeet.mockReturnValue(null);
  rangeValidation.getDistanceFeet.mockReturnValue(null);
  rangeValidation.computeRangeEffect.mockReturnValue({ mode: 'normal' });
  rangeValidation.computeMeleeProximityEffect.mockReturnValue({ mode: 'normal' });
  rangeValidation.isHostileNPC.mockReturnValue(false);
  rangeValidation.getNearestPlacedItem.mockReturnValue(null);

  // coverService defaults
  coverService.computeCover.mockReturnValue({ level: 'none', acBonus: 0 });

  // mapsService defaults
  mapsService.loadMapData.mockResolvedValue({ players: [], placedItems: [] });

  // npcsService defaults
  npcsService.loadNPCs.mockResolvedValue([]);
}

// ── buildAttackContextSync ─────────────────────────────────────

describe('buildAttackContextSync', () => {
  beforeEach(() => {
    setupSafeDefaults();
  });

  it('returns a promise with the correct base fields', async () => {
    const attack = makeAttack();
    const ps = makePlayerStats();

    const result = await buildAttackContextSync(attack, ps, 'TestCampaign', 'normal');

    expect(result.damageType).toBe('Slashing');
    expect(result.resistanceNotice).toBeNull();
    expect(result.targetName).toBeUndefined();
    expect(result.attackerName).toBe('Thorin');
    expect(result.autoDamageName).toBe('Longsword');
    expect(result.ramActive).toBe(false);
    expect(result.isMelee).toBe(true);
  });

  it('computes saveDc with innate sorcery bonus', async () => {
    const attack = makeAttack({ saveDc: 12 });
    const ps = makePlayerStats();

    buffService.getInnateSorceryBonus.mockReturnValue({ spellAdvantage: false, saveDcBonus: 3 });

    const result = await buildAttackContextSync(attack, ps, 'TestCampaign', 'normal');
    expect(result.saveDc).toBe(15); // 12 + 3
  });

  it('includes saveType and dcSuccess from attack', async () => {
    const attack = makeAttack({ saveType: 'Constitution', saveSuccess: 'Half Damage' });
    const ps = makePlayerStats();

    const result = await buildAttackContextSync(attack, ps, 'TestCampaign', 'normal');

    expect(result.saveType).toBe('Constitution');
    expect(result.dcSuccess).toBe('Half Damage');
  });

  it('sets isMelee true for melee weaponType', async () => {
    const attack = makeAttack({ weaponType: 'melee' });
    const ps = makePlayerStats();

    const result = await buildAttackContextSync(attack, ps, 'TestCampaign', 'normal');
    expect(result.isMelee).toBe(true);
  });

  it('sets isMelee true for unarmed weaponType', async () => {
    const attack = makeAttack({ weaponType: 'unarmed' });
    const ps = makePlayerStats();

    const result = await buildAttackContextSync(attack, ps, 'TestCampaign', 'normal');
    expect(result.isMelee).toBe(true);
  });

  it('sets isMelee false for ranged weaponType', async () => {
    const attack = makeAttack({ weaponType: 'ranged' });
    const ps = makePlayerStats();

    const result = await buildAttackContextSync(attack, ps, 'TestCampaign', 'normal');
    expect(result.isMelee).toBe(false);
  });

  it('sets isMelee false for spell weaponType', async () => {
    const attack = makeAttack({ weaponType: 'spell' });
    const ps = makePlayerStats();

    const result = await buildAttackContextSync(attack, ps, 'TestCampaign', 'normal');
    expect(result.isMelee).toBe(false);
  });

  // ── Combat context with target ──

  it('resolves target and resistance notice when combat context exists', async () => {
    const attack = makeAttack();
    const ps = makePlayerStats();

    const target = { name: 'Goblin', resistances: [], immunities: ['Fire'] };
    damageUtils.getCombatContext.mockResolvedValue({ creatures: [] });
    damageUtils.getTargetFromAttacker.mockReturnValue(target);
    damageUtils.getResistanceNotice.mockReturnValue('Goblin is IMMUNE to Fire');

    const result = await buildAttackContextSync(attack, ps, 'TestCampaign', 'normal');

    expect(result.resistanceNotice).toBe('Goblin is IMMUNE to Fire');
    expect(result.targetName).toBe('Goblin');
  });

  it('falls back to getAttackerTargetName when target is null but cs exists', async () => {
    const attack = makeAttack();
    const ps = makePlayerStats();

    damageUtils.getCombatContext.mockResolvedValue({ creatures: [] });
    damageUtils.getTargetFromAttacker.mockReturnValue(null);
    damageUtils.getAttackerTargetName.mockReturnValue('Orc');

    const result = await buildAttackContextSync(attack, ps, 'TestCampaign', 'normal');
    expect(result.targetName).toBe('Orc');
  });

  it('sets targetName to undefined when no combat context', async () => {
    const attack = makeAttack();
    const ps = makePlayerStats();

    damageUtils.getCombatContext.mockResolvedValue(null);
    const result = await buildAttackContextSync(attack, ps, 'TestCampaign', 'normal');
    expect(result.targetName).toBeUndefined();
  });

  // ── Save advantage (Stunning Strike) ──

  it('grants save advantage when targetName is in storedAdvantage array', async () => {
    const attack = makeAttack();
    const ps = makePlayerStats();

    damageUtils.getCombatContext.mockResolvedValue({ creatures: [] });
    damageUtils.getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });
    runtimeState.getRuntimeValue.mockImplementation((key, subKey) => {
      if (subKey === '_advantageOn_Goblin') return ['Goblin', 'Orc'];
      return null;
    });

    const result = await buildAttackContextSync(attack, ps, 'TestCampaign', 'normal');

    expect(result.forcedMode).toBe('advantage');
    expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
      'Thorin', '_advantageOn_Goblin', ['Orc'], 'TestCampaign'
    );
  });

  it('does not grant save advantage when storedAdvantage is not an array', async () => {
    const attack = makeAttack();
    const ps = makePlayerStats();

    damageUtils.getCombatContext.mockResolvedValue({ creatures: [] });
    damageUtils.getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });
    runtimeState.getRuntimeValue.mockImplementation((key, subKey) => {
      if (subKey === '_advantageOn_Goblin') return 'not an array';
      return null;
    });

    const result = await buildAttackContextSync(attack, ps, 'TestCampaign', 'normal');
    expect(result.forcedMode).toBeUndefined();
  });

  it('does not grant save advantage when targetName not in storedAdvantage array', async () => {
    const attack = makeAttack();
    const ps = makePlayerStats();

    damageUtils.getCombatContext.mockResolvedValue({ creatures: [] });
    damageUtils.getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });
    runtimeState.getRuntimeValue.mockImplementation((key, subKey) => {
      if (subKey === '_advantageOn_Goblin') return ['Orc', 'Troll'];
      return null;
    });

    const result = await buildAttackContextSync(attack, ps, 'TestCampaign', 'normal');
    expect(result.forcedMode).toBeUndefined();
  });

  it('does not check save advantage when targetName is falsy', async () => {
    const attack = makeAttack();
    const ps = makePlayerStats();

    damageUtils.getCombatContext.mockResolvedValue(null);
    const result = await buildAttackContextSync(attack, ps, 'TestCampaign', 'normal');
    expect(result.forcedMode).toBeUndefined();
  });

  // ── Innate Sorcery Bonus advantage ──

  it('grants advantage from innate sorcery bonus', async () => {
    const attack = makeAttack();
    const ps = makePlayerStats();

    buffService.getInnateSorceryBonus.mockReturnValue({ spellAdvantage: true, saveDcBonus: 0 });

    const result = await buildAttackContextSync(attack, ps, 'TestCampaign', 'normal');
    expect(result.forcedMode).toBe('advantage');
  });

  // ── Stance damage bonus (Rage) ──

  it('adds rage damage bonus from active buff', async () => {
    const attack = makeAttack({ damage: '1d8+3' });
    const ps = makePlayerStats({
      level: 5,
      class: {
        class_levels: [
          { rage_damage: 2 },
          { rage_damage: 3 },
          { rage_damage: 4 },
          { rage_damage: 5 },
          { rage_damage: 6 },
        ],
      },
    });

    runtimeState.getRuntimeValue.mockImplementation((key, subKey) => {
      if (subKey === 'activeBuffs') return [{ effect: 'rage', damageBonusExpression: 'rage_damage' }];
      return null;
    });

    const result = await buildAttackContextSync(attack, ps, 'TestCampaign', 'normal');

    // level 5 → index (5-1)=4 → rage_damage: 6
    expect(result.autoDamageFormula).toBe('1d8+3+6');
  });

  it('defaults rage_damage to 2 when class_levels entry is missing', async () => {
    const attack = makeAttack({ damage: '1d8+3' });
    const ps = makePlayerStats({ level: 5, class: { class_levels: [] } });

    runtimeState.getRuntimeValue.mockImplementation((key, subKey) => {
      if (subKey === 'activeBuffs') return [{ effect: 'rage', damageBonusExpression: 'rage_damage' }];
      return null;
    });

    const result = await buildAttackContextSync(attack, ps, 'TestCampaign', 'normal');
    expect(result.autoDamageFormula).toBe('1d8+3+2'); // default 2
  });

  it('adds 0 for non-rage damageBonusExpression', async () => {
    const attack = makeAttack({ damage: '1d8+3' });
    const ps = makePlayerStats();

    runtimeState.getRuntimeValue.mockImplementation((key, subKey) => {
      if (subKey === 'activeBuffs') return [{ effect: 'other', damageBonusExpression: 'something_else' }];
      return null;
    });

    const result = await buildAttackContextSync(attack, ps, 'TestCampaign', 'normal');
    expect(result.autoDamageFormula).toBe('1d8+3'); // +0
  });

  it('does not add stance damage bonus when no active buffs', async () => {
    const attack = makeAttack({ damage: '1d8+3' });
    const ps = makePlayerStats();

    runtimeState.getRuntimeValue.mockImplementation((key, subKey) => {
      if (subKey === 'activeBuffs') return [];
      return null;
    });

    const result = await buildAttackContextSync(attack, ps, 'TestCampaign', 'normal');
    expect(result.autoDamageFormula).toBe('1d8+3');
  });

  it('does not add stance damage bonus when activeBuffs is null', async () => {
    const attack = makeAttack({ damage: '1d8+3' });
    const ps = makePlayerStats();

    // getRuntimeValue returns null for activeBuffs (default)
    const result = await buildAttackContextSync(attack, ps, 'TestCampaign', 'normal');
    expect(result.autoDamageFormula).toBe('1d8+3');
  });

  // ── Reckless Attack buff (advantage_attacks_disadvantage_against) ──

  it('grants advantage from reckless attack buff', async () => {
    const attack = makeAttack();
    const ps = makePlayerStats();

    runtimeState.getRuntimeValue.mockImplementation((key, subKey) => {
      if (subKey === 'activeBuffs') return [{ effect: 'advantage_attacks_disadvantage_against' }];
      return null;
    });

    const result = await buildAttackContextSync(attack, ps, 'TestCampaign', 'normal');
    expect(result.forcedMode).toBe('advantage');
  });

  it('sets ramActive when buff optionName is Ram', async () => {
    const attack = makeAttack();
    const ps = makePlayerStats();

    runtimeState.getRuntimeValue.mockImplementation((key, subKey) => {
      if (subKey === 'activeBuffs') return [{ optionName: 'Ram' }];
      return null;
    });

    const result = await buildAttackContextSync(attack, ps, 'TestCampaign', 'normal');
    expect(result.ramActive).toBe(true);
  });

  // ── Duplicity: Distract buff (create_illusion) ──

  it('grants advantage from create_illusion buff', async () => {
    const attack = makeAttack();
    const ps = makePlayerStats();

    runtimeState.getRuntimeValue.mockImplementation((key, subKey) => {
      if (subKey === 'activeBuffs') return [{ effect: 'create_illusion' }];
      return null;
    });

    const result = await buildAttackContextSync(attack, ps, 'TestCampaign', 'normal');
    expect(result.forcedMode).toBe('advantage');
  });

  // ── Aura checks (no-map) ──

  it('grants advantage from wolf aura (no map)', async () => {
    const attack = makeAttack();
    const ps = makePlayerStats();

    runtimeState.getRuntimeValue.mockImplementation((key, subKey) => {
      if (subKey === 'activeBuffs') return [];
      return null;
    });

    wolfAura.getWolfAdvantageAgainst.mockReturnValue({ advantage: true });

    const result = await buildAttackContextSync(attack, ps, 'TestCampaign', 'normal');
    expect(result.forcedMode).toBe('advantage');
  });

  it('grants advantage from duplicity aura (no map)', async () => {
    const attack = makeAttack();
    const ps = makePlayerStats();

    runtimeState.getRuntimeValue.mockImplementation((key, subKey) => {
      if (subKey === 'activeBuffs') return [];
      return null;
    });

    wolfAura.getWolfAdvantageAgainst.mockReturnValue({ advantage: false });
    duplicityAura.getDuplicityAdvantageAgainst.mockReturnValue({ advantage: true });

    const result = await buildAttackContextSync(attack, ps, 'TestCampaign', 'normal');
    expect(result.forcedMode).toBe('advantage');
  });

  it('grants disadvantage from lion aura (no map)', async () => {
    const attack = makeAttack();
    const ps = makePlayerStats();

    runtimeState.getRuntimeValue.mockImplementation((key, subKey) => {
      if (subKey === 'activeBuffs') return [];
      return null;
    });

    wolfAura.getWolfAdvantageAgainst.mockReturnValue({ advantage: false });
    duplicityAura.getDuplicityAdvantageAgainst.mockReturnValue({ advantage: false });
    lionAura.getLionDisadvantageAgainst.mockReturnValue({ disadvantage: true });

    const result = await buildAttackContextSync(attack, ps, 'TestCampaign', 'normal');
    expect(result.forcedMode).toBe('disadvantage');
  });

  it('grants disadvantage from corona aura (no map) when targetName exists', async () => {
    const attack = makeAttack();
    const ps = makePlayerStats();

    damageUtils.getCombatContext.mockResolvedValue({ creatures: [] });
    damageUtils.getTargetFromAttacker.mockReturnValue(null);
    damageUtils.getAttackerTargetName.mockReturnValue('Goblin');

    runtimeState.getRuntimeValue.mockImplementation((key, subKey) => {
      if (subKey === 'activeBuffs') return [];
      return null;
    });

    wolfAura.getWolfAdvantageAgainst.mockReturnValue({ advantage: false });
    duplicityAura.getDuplicityAdvantageAgainst.mockReturnValue({ advantage: false });
    lionAura.getLionDisadvantageAgainst.mockReturnValue({ disadvantage: false });
    coronaAura.getCoronaSaveDisadvantage.mockReturnValue({ disadvantage: true });

    const result = await buildAttackContextSync(attack, ps, 'TestCampaign', 'normal');
    expect(result.forcedMode).toBe('disadvantage');
  });

  it('skips corona aura check when targetName is undefined', async () => {
    const attack = makeAttack();
    const ps = makePlayerStats();

    damageUtils.getCombatContext.mockResolvedValue(null);
    runtimeState.getRuntimeValue.mockImplementation((key, subKey) => {
      if (subKey === 'activeBuffs') return [];
      return null;
    });

    wolfAura.getWolfAdvantageAgainst.mockReturnValue({ advantage: false });
    duplicityAura.getDuplicityAdvantageAgainst.mockReturnValue({ advantage: false });
    lionAura.getLionDisadvantageAgainst.mockReturnValue({ disadvantage: false });

    const result = await buildAttackContextSync(attack, ps, 'TestCampaign', 'normal');
    expect(result.forcedMode).toBeUndefined();
    expect(coronaAura.getCoronaSaveDisadvantage).not.toHaveBeenCalled();
  });

  // ── conditionAttackMode takes priority ──

  it('respects conditionAttackMode when set to advantage', async () => {
    const attack = makeAttack();
    const ps = makePlayerStats();

    const result = await buildAttackContextSync(attack, ps, 'TestCampaign', 'advantage');
    expect(result.forcedMode).toBe('advantage');
  });

  it('respects conditionAttackMode when set to disadvantage', async () => {
    const attack = makeAttack();
    const ps = makePlayerStats();

    const result = await buildAttackContextSync(attack, ps, 'TestCampaign', 'disadvantage');
    expect(result.forcedMode).toBe('disadvantage');
  });

  it('conditionAttackMode overrides save advantage', async () => {
    const attack = makeAttack();
    const ps = makePlayerStats();

    damageUtils.getCombatContext.mockResolvedValue({ creatures: [] });
    damageUtils.getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });
    runtimeState.getRuntimeValue.mockImplementation((key, subKey) => {
      if (subKey === '_advantageOn_Goblin') return ['Goblin'];
      if (subKey === 'activeBuffs') return [];
      return null;
    });

    const result = await buildAttackContextSync(attack, ps, 'TestCampaign', 'disadvantage');
    expect(result.forcedMode).toBe('disadvantage');
  });

  it('conditionAttackMode overrides innate sorcery advantage', async () => {
    const attack = makeAttack();
    const ps = makePlayerStats();

    buffService.getInnateSorceryBonus.mockReturnValue({ spellAdvantage: true, saveDcBonus: 0 });
    runtimeState.getRuntimeValue.mockImplementation((key, subKey) => {
      if (subKey === 'activeBuffs') return [];
      return null;
    });

    const result = await buildAttackContextSync(attack, ps, 'TestCampaign', 'disadvantage');
    expect(result.forcedMode).toBe('disadvantage');
  });

  it('conditionAttackMode overrides reckless attack advantage', async () => {
    const attack = makeAttack();
    const ps = makePlayerStats();

    runtimeState.getRuntimeValue.mockImplementation((key, subKey) => {
      if (subKey === 'activeBuffs') return [{ effect: 'advantage_attacks_disadvantage_against' }];
      return null;
    });

    const result = await buildAttackContextSync(attack, ps, 'TestCampaign', 'disadvantage');
    expect(result.forcedMode).toBe('disadvantage');
  });

  it('conditionAttackMode overrides create_illusion advantage', async () => {
    const attack = makeAttack();
    const ps = makePlayerStats();

    runtimeState.getRuntimeValue.mockImplementation((key, subKey) => {
      if (subKey === 'activeBuffs') return [{ effect: 'create_illusion' }];
      return null;
    });

    const result = await buildAttackContextSync(attack, ps, 'TestCampaign', 'disadvantage');
    expect(result.forcedMode).toBe('disadvantage');
  });

  it('conditionAttackMode overrides aura advantage', async () => {
    const attack = makeAttack();
    const ps = makePlayerStats();

    runtimeState.getRuntimeValue.mockImplementation((key, subKey) => {
      if (subKey === 'activeBuffs') return [];
      return null;
    });

    wolfAura.getWolfAdvantageAgainst.mockReturnValue({ advantage: true });

    const result = await buildAttackContextSync(attack, ps, 'TestCampaign', 'disadvantage');
    expect(result.forcedMode).toBe('disadvantage');
  });

  // ── Multiple buffs with damage bonus ──

  it('sums stance damage bonus from multiple rage buffs', async () => {
    const attack = makeAttack({ damage: '1d8+3' });
    const ps = makePlayerStats({
      level: 3,
      class: {
        class_levels: [
          { rage_damage: 2 },
          { rage_damage: 3 },
          { rage_damage: 4 },
        ],
      },
    });

    runtimeState.getRuntimeValue.mockImplementation((key, subKey) => {
      if (subKey === 'activeBuffs') return [
        { effect: 'rage', damageBonusExpression: 'rage_damage' },
        { effect: 'rage2', damageBonusExpression: 'rage_damage' },
      ];
      return null;
    });

    const result = await buildAttackContextSync(attack, ps, 'TestCampaign', 'normal');
    // level 3 → index (3-1)=2 → rage_damage: 4. Two buffs × 4 = 8
    expect(result.autoDamageFormula).toBe('1d8+3+8');
  });

  it('skips buffs without damageBonusExpression', async () => {
    const attack = makeAttack({ damage: '1d8+3' });
    const ps = makePlayerStats();

    runtimeState.getRuntimeValue.mockImplementation((key, subKey) => {
      if (subKey === 'activeBuffs') return [{ effect: 'some_buff' }]; // no damageBonusExpression
      return null;
    });

    const result = await buildAttackContextSync(attack, ps, 'TestCampaign', 'normal');
    expect(result.autoDamageFormula).toBe('1d8+3');
  });

  // ── Edge cases ──

  it('handles player with no class', async () => {
    const attack = makeAttack();
    const ps = makePlayerStats({ class: null });

    runtimeState.getRuntimeValue.mockImplementation((key, subKey) => {
      if (subKey === 'activeBuffs') return [];
      return null;
    });

    const result = await buildAttackContextSync(attack, ps, 'TestCampaign', 'normal');
    expect(result.autoDamageFormula).toBe('1d8+3');
  });

  it('handles player with no level', async () => {
    const attack = makeAttack();
    const ps = makePlayerStats({ level: undefined });

    runtimeState.getRuntimeValue.mockImplementation((key, subKey) => {
      if (subKey === 'activeBuffs') return [];
      return null;
    });

    const result = await buildAttackContextSync(attack, ps, 'TestCampaign', 'normal');
    expect(result.autoDamageFormula).toBe('1d8+3');
  });
});

// ── buildAttackContext (with map) ──────────────────────────────

describe('buildAttackContext', () => {
  beforeEach(() => {
    setupSafeDefaults();
  });

  it('delegates to buildAttackContextSync when mapName is falsy', async () => {
    const attack = makeAttack();
    const ps = makePlayerStats();

    const result = await buildAttackContext(attack, ps, 'TestCampaign', null, 'normal');

    expect(result.damageType).toBe('Slashing');
    // Should not call map-related functions
    expect(mapsService.loadMapData).not.toHaveBeenCalled();
  });

  it('returns base result when attacker not found on map', async () => {
    const attack = makeAttack();
    const ps = makePlayerStats();

    mapsService.loadMapData.mockResolvedValue({ players: [], placedItems: [] });

    const result = await buildAttackContext(attack, ps, 'TestCampaign', 'Dungeon Map', 'normal');

    expect(result.damageType).toBe('Slashing');
  });

  it('loads map data and NPCs when attacker is on the map', async () => {
    const attack = makeAttack();
    const ps = makePlayerStats();

    mapsService.loadMapData.mockResolvedValue({
      players: [{ name: 'Thorin', gridX: 5, gridY: 5 }],
      placedItems: [],
    });

    const result = await buildAttackContext(attack, ps, 'TestCampaign', 'Dungeon Map', 'normal');

    expect(mapsService.loadMapData).toHaveBeenCalledWith('TestCampaign', 'Dungeon Map');
    expect(npcsService.loadNPCs).toHaveBeenCalledWith('TestCampaign');
    expect(result.damageType).toBe('Slashing');
  });

  it('handles mapData with no players property', async () => {
    const attack = makeAttack();
    const ps = makePlayerStats();

    mapsService.loadMapData.mockResolvedValue({});

    const result = await buildAttackContext(attack, ps, 'TestCampaign', 'Dungeon Map', 'normal');

    expect(result.damageType).toBe('Slashing');
  });

  it('handles mapData with no placedItems property', async () => {
    const attack = makeAttack();
    const ps = makePlayerStats();

    mapsService.loadMapData.mockResolvedValue({ players: [{ name: 'Thorin', gridX: 5, gridY: 5 }] });

    const result = await buildAttackContext(attack, ps, 'TestCampaign', 'Dungeon Map', 'normal');

    expect(result.damageType).toBe('Slashing');
  });

  it('handles missing mapData gracefully', async () => {
    const attack = makeAttack();
    const ps = makePlayerStats();

    mapsService.loadMapData.mockResolvedValue(null);

    const result = await buildAttackContext(attack, ps, 'TestCampaign', 'Dungeon Map', 'normal');

    expect(result.damageType).toBe('Slashing');
  });

  // ── Map-based aura checks (with targetPos) ──

  it('checks wolf/duplicity/lion/corona auras with map data when targetPos exists', async () => {
    const attack = makeAttack();
    const ps = makePlayerStats();

    damageUtils.getCombatContext.mockImplementation(() => {
      // First call (from buildAttackContextSync) returns null
      // Second call (from map path) returns combat context with target
      const callCount = damageUtils.getCombatContext.mock.calls.length;
      if (callCount === 0) return Promise.resolve(null);
      return Promise.resolve({ creatures: [] });
    });

    damageUtils.getTargetFromAttacker.mockImplementation(() => {
      const callCount = damageUtils.getTargetFromAttacker.mock.calls.length;
      if (callCount === 0) return null; // first call from sync path
      return { name: 'Goblin' }; // second call from map path
    });

    mapsService.loadMapData.mockResolvedValue({
      players: [
        { name: 'Thorin', gridX: 5, gridY: 5 },
        { name: 'Goblin', gridX: 10, gridY: 10 },
      ],
      placedItems: [],
    });

    wolfAura.getWolfAdvantageAgainst.mockImplementation((args) => {
      if (args.targetPos) return { advantage: true };
      return { advantage: false };
    });

    await buildAttackContext(attack, ps, 'TestCampaign', 'Dungeon Map', 'normal');

    // The wolf aura should have been called with targetPos from the map path
    const wolfCallsWithTargetPos = wolfAura.getWolfAdvantageAgainst.mock.calls.filter(
      c => c[0] && c[0].targetPos
    );
    expect(wolfCallsWithTargetPos.length).toBeGreaterThan(0);
  });

  // ── No-map fallback when targetPos is null but map is active ──

  it('falls back to no-map aura checks when targetPos is null', async () => {
    const attack = makeAttack();
    const ps = makePlayerStats();

    damageUtils.getCombatContext.mockImplementation(() => {
      const callCount = damageUtils.getCombatContext.mock.calls.length;
      if (callCount === 0) return Promise.resolve(null);
      return Promise.resolve({ creatures: [] });
    });

    damageUtils.getTargetFromAttacker.mockReturnValue(null);

    mapsService.loadMapData.mockResolvedValue({
      players: [{ name: 'Thorin', gridX: 5, gridY: 5 }],
      placedItems: [],
    });

    wolfAura.getWolfAdvantageAgainst.mockImplementation((args) => {
      if (args.skipRangeCheck && args.mapData) return { advantage: true };
      return { advantage: false };
    });

    await buildAttackContext(attack, ps, 'TestCampaign', 'Dungeon Map', 'normal');

    // Should have been called with skipRangeCheck: true and mapData
    const wolfCallsWithSkip = wolfAura.getWolfAdvantageAgainst.mock.calls.filter(
      c => c[0] && c[0].skipRangeCheck && c[0].mapData
    );
    expect(wolfCallsWithSkip.length).toBeGreaterThan(0);
  });

  // ── Range checks ──

  it('computes range effect for ranged attacks with targetPos', async () => {
    const attack = makeAttack({ weaponType: 'ranged', range: 100 });
    const ps = makePlayerStats();

    damageUtils.getCombatContext.mockImplementation(() => {
      const callCount = damageUtils.getCombatContext.mock.calls.length;
      if (callCount === 0) return Promise.resolve(null);
      return Promise.resolve({ creatures: [] });
    });

    damageUtils.getTargetFromAttacker.mockImplementation(() => {
      const callCount = damageUtils.getTargetFromAttacker.mock.calls.length;
      if (callCount === 0) return null;
      return { name: 'Goblin' };
    });

    mapsService.loadMapData.mockResolvedValue({
      players: [
        { name: 'Thorin', gridX: 5, gridY: 5 },
        { name: 'Goblin', gridX: 10, gridY: 10 },
      ],
      placedItems: [],
    });

    rangeValidation.rangeToFeet.mockReturnValue(100);
    rangeValidation.getDistanceFeet.mockReturnValue(50);
    rangeValidation.computeRangeEffect.mockReturnValue({ mode: 'normal' });

    await buildAttackContext(attack, ps, 'TestCampaign', 'Dungeon Map', 'normal');

    expect(rangeValidation.rangeToFeet).toHaveBeenCalled();
    expect(rangeValidation.getDistanceFeet).toHaveBeenCalled();
    expect(rangeValidation.computeRangeEffect).toHaveBeenCalled();
  });

  it('sets disadvantage when range effect is disadvantage', async () => {
    const attack = makeAttack({ weaponType: 'ranged', range: 100 });
    const ps = makePlayerStats();

    damageUtils.getCombatContext.mockImplementation(() => {
      const callCount = damageUtils.getCombatContext.mock.calls.length;
      if (callCount === 0) return Promise.resolve(null);
      return Promise.resolve({ creatures: [] });
    });

    damageUtils.getTargetFromAttacker.mockImplementation(() => {
      const callCount = damageUtils.getTargetFromAttacker.mock.calls.length;
      if (callCount === 0) return null;
      return { name: 'Goblin' };
    });

    mapsService.loadMapData.mockResolvedValue({
      players: [
        { name: 'Thorin', gridX: 5, gridY: 5 },
        { name: 'Goblin', gridX: 10, gridY: 10 },
      ],
      placedItems: [],
    });

    rangeValidation.rangeToFeet.mockReturnValue(100);
    rangeValidation.getDistanceFeet.mockReturnValue(150);
    rangeValidation.computeRangeEffect.mockReturnValue({
      mode: 'disadvantage',
      reason: 'Beyond normal range',
    });

    const result = await buildAttackContext(attack, ps, 'TestCampaign', 'Dungeon Map', 'normal');

    expect(result.forcedMode).toBe('disadvantage');
    expect(result.rangeReason).toBe('Beyond normal range');
  });

  it('sets isAutoMiss when range effect is miss', async () => {
    const attack = makeAttack({ weaponType: 'ranged', range: 100 });
    const ps = makePlayerStats();

    damageUtils.getCombatContext.mockImplementation(() => {
      const callCount = damageUtils.getCombatContext.mock.calls.length;
      if (callCount === 0) return Promise.resolve(null);
      return Promise.resolve({ creatures: [] });
    });

    damageUtils.getTargetFromAttacker.mockImplementation(() => {
      const callCount = damageUtils.getTargetFromAttacker.mock.calls.length;
      if (callCount === 0) return null;
      return { name: 'Goblin' };
    });

    mapsService.loadMapData.mockResolvedValue({
      players: [
        { name: 'Thorin', gridX: 5, gridY: 5 },
        { name: 'Goblin', gridX: 10, gridY: 10 },
      ],
      placedItems: [],
    });

    rangeValidation.rangeToFeet.mockReturnValue(100);
    rangeValidation.getDistanceFeet.mockReturnValue(250);
    rangeValidation.computeRangeEffect.mockReturnValue({
      mode: 'miss',
      reason: 'Out of range',
    });

    const result = await buildAttackContext(attack, ps, 'TestCampaign', 'Dungeon Map', 'normal');

    expect(result.isAutoMiss).toBe(true);
    expect(result.rangeReason).toBe('Out of range');
  });

  it('applies spellRangeBonus to effective range', async () => {
    const attack = makeAttack({ weaponType: 'ranged', range: 100 });
    const ps = makePlayerStats();

    damageUtils.getCombatContext.mockImplementation(() => {
      const callCount = damageUtils.getCombatContext.mock.calls.length;
      if (callCount === 0) return Promise.resolve(null);
      return Promise.resolve({ creatures: [] });
    });

    damageUtils.getTargetFromAttacker.mockImplementation(() => {
      const callCount = damageUtils.getTargetFromAttacker.mock.calls.length;
      if (callCount === 0) return null;
      return { name: 'Goblin' };
    });

    mapsService.loadMapData.mockResolvedValue({
      players: [
        { name: 'Thorin', gridX: 5, gridY: 5 },
        { name: 'Goblin', gridX: 10, gridY: 10 },
      ],
      placedItems: [],
    });

    rangeValidation.rangeToFeet.mockReturnValue(100);
    rangeValidation.getDistanceFeet.mockReturnValue(50);

    await buildAttackContext(
      attack, ps, 'TestCampaign', 'Dungeon Map', 'normal',
      { ignoresMeleeDisadvantage: false, ignoresLongRangeDisadvantage: false, rangeMultiplier: 1, spellRangeBonus: 30 }
    );

    // Verify computeRangeEffect was called with the bonus range (130)
    const rangeCalls = rangeValidation.computeRangeEffect.mock.calls;
    const validCall = rangeCalls.find(c => c[0] === 130);
    expect(validCall).toBeDefined();
  });

  // ── Cover checks ──

  it('computes cover for ranged attacks with targetPos', async () => {
    const attack = makeAttack({ weaponType: 'ranged', range: 100 });
    const ps = makePlayerStats();

    damageUtils.getCombatContext.mockImplementation(() => {
      const callCount = damageUtils.getCombatContext.mock.calls.length;
      if (callCount === 0) return Promise.resolve(null);
      return Promise.resolve({ creatures: [] });
    });

    damageUtils.getTargetFromAttacker.mockImplementation(() => {
      const callCount = damageUtils.getTargetFromAttacker.mock.calls.length;
      if (callCount === 0) return null;
      return { name: 'Goblin' };
    });

    mapsService.loadMapData.mockResolvedValue({
      players: [
        { name: 'Thorin', gridX: 5, gridY: 5 },
        { name: 'Goblin', gridX: 10, gridY: 10 },
      ],
      placedItems: [],
    });

    rangeValidation.rangeToFeet.mockReturnValue(100);
    rangeValidation.getDistanceFeet.mockReturnValue(50);
    rangeValidation.computeRangeEffect.mockReturnValue({ mode: 'normal' });
    coverService.computeCover.mockReturnValue({ level: 'none', acBonus: 0 });

    await buildAttackContext(attack, ps, 'TestCampaign', 'Dungeon Map', 'normal');

    expect(coverService.computeCover).toHaveBeenCalled();
  });

  it('sets isAutoMiss when cover is full', async () => {
    const attack = makeAttack({ weaponType: 'ranged', range: 100 });
    const ps = makePlayerStats();

    damageUtils.getCombatContext.mockImplementation(() => {
      const callCount = damageUtils.getCombatContext.mock.calls.length;
      if (callCount === 0) return Promise.resolve(null);
      return Promise.resolve({ creatures: [] });
    });

    damageUtils.getTargetFromAttacker.mockImplementation(() => {
      const callCount = damageUtils.getTargetFromAttacker.mock.calls.length;
      if (callCount === 0) return null;
      return { name: 'Goblin' };
    });

    mapsService.loadMapData.mockResolvedValue({
      players: [
        { name: 'Thorin', gridX: 5, gridY: 5 },
        { name: 'Goblin', gridX: 10, gridY: 10 },
      ],
      placedItems: [],
    });

    rangeValidation.rangeToFeet.mockReturnValue(100);
    rangeValidation.getDistanceFeet.mockReturnValue(50);
    rangeValidation.computeRangeEffect.mockReturnValue({ mode: 'normal' });
    coverService.computeCover.mockReturnValue({ level: 'full', acBonus: null });

    const result = await buildAttackContext(attack, ps, 'TestCampaign', 'Dungeon Map', 'normal');

    expect(result.isAutoMiss).toBe(true);
    expect(result.coverReason).toBe('Target has full cover');
  });

  it('sets coverAcBonus and coverLevel when cover provides AC bonus', async () => {
    const attack = makeAttack({ weaponType: 'ranged', range: 100 });
    const ps = makePlayerStats();

    damageUtils.getCombatContext.mockImplementation(() => {
      const callCount = damageUtils.getCombatContext.mock.calls.length;
      if (callCount === 0) return Promise.resolve(null);
      return Promise.resolve({ creatures: [] });
    });

    damageUtils.getTargetFromAttacker.mockImplementation(() => {
      const callCount = damageUtils.getTargetFromAttacker.mock.calls.length;
      if (callCount === 0) return null;
      return { name: 'Goblin' };
    });

    mapsService.loadMapData.mockResolvedValue({
      players: [
        { name: 'Thorin', gridX: 5, gridY: 5 },
        { name: 'Goblin', gridX: 10, gridY: 10 },
      ],
      placedItems: [],
    });

    rangeValidation.rangeToFeet.mockReturnValue(100);
    rangeValidation.getDistanceFeet.mockReturnValue(50);
    rangeValidation.computeRangeEffect.mockReturnValue({ mode: 'normal' });
    coverService.computeCover.mockReturnValue({ level: 'half', acBonus: 2 });

    const result = await buildAttackContext(attack, ps, 'TestCampaign', 'Dungeon Map', 'normal');

    expect(result.coverAcBonus).toBe(2);
    expect(result.coverLevel).toBe('half');
  });

  it('skips cover check when isAutoMiss is true', async () => {
    const attack = makeAttack({ weaponType: 'ranged', range: 100 });
    const ps = makePlayerStats();

    damageUtils.getCombatContext.mockImplementation(() => {
      const callCount = damageUtils.getCombatContext.mock.calls.length;
      if (callCount === 0) return Promise.resolve(null);
      return Promise.resolve({ creatures: [] });
    });

    damageUtils.getTargetFromAttacker.mockImplementation(() => {
      const callCount = damageUtils.getTargetFromAttacker.mock.calls.length;
      if (callCount === 0) return null;
      return { name: 'Goblin' };
    });

    mapsService.loadMapData.mockResolvedValue({
      players: [
        { name: 'Thorin', gridX: 5, gridY: 5 },
        { name: 'Goblin', gridX: 10, gridY: 10 },
      ],
      placedItems: [],
    });

    rangeValidation.rangeToFeet.mockReturnValue(100);
    rangeValidation.getDistanceFeet.mockReturnValue(250);
    rangeValidation.computeRangeEffect.mockReturnValue({ mode: 'miss', reason: 'Out of range' });

    const result = await buildAttackContext(attack, ps, 'TestCampaign', 'Dungeon Map', 'normal');

    expect(result.isAutoMiss).toBe(true);
  });

  // ── Melee proximity checks ──

  it('computes melee proximity for ranged attacks', async () => {
    const attack = makeAttack({ weaponType: 'ranged', range: 100 });
    const ps = makePlayerStats();

    damageUtils.getCombatContext.mockImplementation(() => {
      const callCount = damageUtils.getCombatContext.mock.calls.length;
      if (callCount === 0) return Promise.resolve(null);
      return Promise.resolve({ creatures: [] });
    });

    damageUtils.getTargetFromAttacker.mockImplementation(() => {
      const callCount = damageUtils.getTargetFromAttacker.mock.calls.length;
      if (callCount === 0) return null;
      return { name: 'Goblin' };
    });

    mapsService.loadMapData.mockResolvedValue({
      players: [
        { name: 'Thorin', gridX: 5, gridY: 5 },
        { name: 'Goblin', gridX: 10, gridY: 10 },
      ],
      placedItems: [{ type: 'npc', name: 'Orc', gridX: 5, gridY: 6 }],
    });

    rangeValidation.rangeToFeet.mockReturnValue(100);
    rangeValidation.getDistanceFeet.mockReturnValue(50);
    rangeValidation.computeRangeEffect.mockReturnValue({ mode: 'normal' });
    coverService.computeCover.mockReturnValue({ level: 'none', acBonus: 0 });
    rangeValidation.isHostileNPC.mockReturnValue(true);
    rangeValidation.computeMeleeProximityEffect.mockReturnValue({ mode: 'normal' });

    await buildAttackContext(attack, ps, 'TestCampaign', 'Dungeon Map', 'normal');

    expect(rangeValidation.computeMeleeProximityEffect).toHaveBeenCalled();
  });

  it('sets disadvantage from melee proximity', async () => {
    const attack = makeAttack({ weaponType: 'ranged', range: 100 });
    const ps = makePlayerStats();

    damageUtils.getCombatContext.mockImplementation(() => {
      const callCount = damageUtils.getCombatContext.mock.calls.length;
      if (callCount === 0) return Promise.resolve(null);
      return Promise.resolve({ creatures: [] });
    });

    damageUtils.getTargetFromAttacker.mockImplementation(() => {
      const callCount = damageUtils.getTargetFromAttacker.mock.calls.length;
      if (callCount === 0) return null;
      return { name: 'Goblin' };
    });

    mapsService.loadMapData.mockResolvedValue({
      players: [
        { name: 'Thorin', gridX: 5, gridY: 5 },
        { name: 'Goblin', gridX: 10, gridY: 10 },
      ],
      placedItems: [{ type: 'npc', name: 'Orc', gridX: 5, gridY: 6 }],
    });

    rangeValidation.rangeToFeet.mockReturnValue(100);
    rangeValidation.getDistanceFeet.mockReturnValue(50);
    rangeValidation.computeRangeEffect.mockReturnValue({ mode: 'normal' });
    coverService.computeCover.mockReturnValue({ level: 'none', acBonus: 0 });
    rangeValidation.isHostileNPC.mockReturnValue(true);
    rangeValidation.computeMeleeProximityEffect.mockReturnValue({
      mode: 'disadvantage',
      reason: 'Firing in melee range of Orc',
    });

    const result = await buildAttackContext(attack, ps, 'TestCampaign', 'Dungeon Map', 'normal');

    expect(result.forcedMode).toBe('disadvantage');
    expect(result.rangeReason).toBe('Firing in melee range of Orc');
  });

  // ── Catch fallback ──

  it('falls back to basePromise on error in map path', async () => {
    const attack = makeAttack();
    const ps = makePlayerStats();

    // First call (from buildAttackContextSync) resolves normally
    // Second call (from map path inner getCombatContext) rejects
    damageUtils.getCombatContext.mockResolvedValueOnce(null).mockRejectedValueOnce(new Error('Network error'));

    mapsService.loadMapData.mockResolvedValue({
      players: [{ name: 'Thorin', gridX: 5, gridY: 5 }],
      placedItems: [],
    });

    const result = await buildAttackContext(attack, ps, 'TestCampaign', 'Dungeon Map', 'normal');

    // Should fall back to base result
    expect(result.damageType).toBe('Slashing');
  });

  // ── Target is NPC on map ──

  it('finds target position from placedItems when target is an NPC', async () => {
    const attack = makeAttack();
    const ps = makePlayerStats();

    damageUtils.getCombatContext.mockImplementation(() => {
      const callCount = damageUtils.getCombatContext.mock.calls.length;
      if (callCount === 0) return Promise.resolve(null);
      return Promise.resolve({ creatures: [] });
    });

    damageUtils.getTargetFromAttacker.mockImplementation(() => {
      const callCount = damageUtils.getTargetFromAttacker.mock.calls.length;
      if (callCount === 0) return null;
      return { name: 'Goblin' };
    });

    mapsService.loadMapData.mockResolvedValue({
      players: [{ name: 'Thorin', gridX: 5, gridY: 5 }],
      placedItems: [{ type: 'npc', name: 'Goblin', gridX: 10, gridY: 10 }],
    });

    rangeValidation.getNearestPlacedItem.mockReturnValue({ gridX: 10, gridY: 10 });

    await buildAttackContext(attack, ps, 'TestCampaign', 'Dungeon Map', 'normal');

    expect(rangeValidation.getNearestPlacedItem).toHaveBeenCalled();
  });

  it('does not call getNearestPlacedItem when placedItems is empty', async () => {
    const attack = makeAttack();
    const ps = makePlayerStats();

    damageUtils.getCombatContext.mockImplementation(() => {
      const callCount = damageUtils.getCombatContext.mock.calls.length;
      if (callCount === 0) return Promise.resolve(null);
      return Promise.resolve({ creatures: [] });
    });

    damageUtils.getTargetFromAttacker.mockImplementation(() => {
      const callCount = damageUtils.getTargetFromAttacker.mock.calls.length;
      if (callCount === 0) return null;
      return { name: 'Goblin' };
    });

    mapsService.loadMapData.mockResolvedValue({
      players: [{ name: 'Thorin', gridX: 5, gridY: 5 }],
      placedItems: [],
    });

    await buildAttackContext(attack, ps, 'TestCampaign', 'Dungeon Map', 'normal');

    expect(rangeValidation.getNearestPlacedItem).not.toHaveBeenCalled();
  });
});
