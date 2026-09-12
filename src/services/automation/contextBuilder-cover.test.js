// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildAttackContext } from './contextBuilder.js';
import { getCombatContext, getTargetFromAttacker } from '../rules/combat/damageUtils.js';
import { buildBaseAttackContext } from './common/damageRoll.js';
import { loadMapData } from '../maps/mapsService.js';
import { loadNPCs } from '../npcs/npcsService.js';
import {
  computeRangeEffect,
  computeMeleeProximityEffect,
  getDistanceFeet,
  isHostileNPC,
  getNearestPlacedItem,
  rangeToFeet,
} from '../rules/combat/rangeValidation.js';
import { computeCover } from '../rules/combat/coverService.js';
import { getRuntimeValue, setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { getInnateSorceryBonus } from '../combat/buffs/buffService.js';
import { getWolfAdvantageAgainst } from '../combat/auras/wolfAuraUtils.js';
import { getDuplicityAdvantageAgainst } from '../combat/auras/duplicityAuraUtils.js';
import { getLionDisadvantageAgainst } from '../combat/auras/lionAuraUtils.js';
import { getCoronaSaveDisadvantage } from '../combat/auras/coronaAuraUtils.js';
import { isActive, isAuraTarget } from './handlers/class-cleric-paladin/avengingAngelHandler.js';
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

const mockStats = {
  name: 'Fighter1',
  level: 5,
  proficiency: 2,
  class: { class_levels: [{ rage_damage: 2 }] },
  abilities: [
    { name: 'Charisma', bonus: 2 },
    { name: 'Strength', bonus: 4 },
  ],
  automation: { passives: [] },
};

const mockRangedAttack = {
  name: 'Longbow',
  damage: '1d8+4',
  damageType: 'Piercing',
  hitBonus: 7,
  hitBonusFormula: 'To Hit = 4 + 2 + 1',
  weaponType: 'ranged',
  range: 150,
};

function makeCombatContext(attackerName, targetName, targetGridX, targetGridY) {
  return {
    creatures: [
      { name: attackerName, targetName },
      { name: targetName, gridX: targetGridX, gridY: targetGridY },
    ],
  };
}

function makeMapData(players, placedItems) {
  return { players: players || [], placedItems: placedItems || [] };
}

function setupDefaults() {
  buildBaseAttackContext.mockResolvedValue({
    target: { name: 'Orc' },
    targetName: 'Orc',
    resistanceNotice: null,
  });
  loadMapData.mockResolvedValue(null);
  loadNPCs.mockResolvedValue([]);
  rangeToFeet.mockImplementation((r) => (typeof r === 'number' ? r : 5));
  getRuntimeValue.mockReturnValue(undefined);
  setRuntimeValue.mockReturnValue(undefined);
  getInnateSorceryBonus.mockReturnValue({ spellAdvantage: false, saveDcBonus: 0 });
  isActive.mockReturnValue(false);
  isAuraTarget.mockReturnValue(false);
  getWolfAdvantageAgainst.mockReturnValue({ advantage: false });
  getDuplicityAdvantageAgainst.mockReturnValue({ advantage: false });
  getLionDisadvantageAgainst.mockReturnValue({ disadvantage: false });
  getCoronaSaveDisadvantage.mockReturnValue({ disadvantage: false });
  getCombatContext.mockResolvedValue(null);
  getTargetFromAttacker.mockReturnValue(null);
  getDistanceFeet.mockReturnValue(5);
  computeRangeEffect.mockReturnValue({ mode: 'ok' });
  computeCover.mockReturnValue({ level: 'none', acBonus: 0 });
  computeMeleeProximityEffect.mockReturnValue({ mode: 'ok' });
  getNearestPlacedItem.mockReturnValue(null);
  isHostileNPC.mockReturnValue(false);
}

describe('contextBuilder: baitAndSwitch cover bonus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDefaults();
  });

  it('applies baitAndSwitchBonus when it exceeds existing cover acBonus', async () => {
    loadMapData.mockResolvedValue(makeMapData(
      [{ name: 'Fighter1', gridX: 1, gridY: 1 }],
      [{ name: 'Orc', gridX: 10, gridY: 10, type: 'npc' }],
    ));
    getCombatContext.mockResolvedValue(makeCombatContext('Fighter1', 'Orc', 10, 10));
    getTargetFromAttacker.mockReturnValue({ name: 'Orc', gridX: 10, gridY: 10 });
    getNearestPlacedItem.mockReturnValue({ name: 'Orc', gridX: 10, gridY: 10 });
    computeCover.mockReturnValue({ level: 'half', acBonus: 2 });
    getRuntimeValue.mockImplementation((entityType, key) => {
      if (key === 'baitAndSwitchActive' && entityType === 'Orc') return true;
      if (key === 'baitAndSwitchBonus' && entityType === 'Orc') return 5;
      return undefined;
    });

    const result = await buildAttackContext({ attack: mockRangedAttack, playerStats: mockStats, campaignName: 'camp', mapName: 'test-map', conditionAttackMode: 'normal', featRangeEffects: {} });

    expect(result.coverAcBonus).toBe(5);
    expect(result.coverLevel).toBe('half');
  });
});
