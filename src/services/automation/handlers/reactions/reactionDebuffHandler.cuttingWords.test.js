// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handle } from './reactionDebuffHandler.js';

vi.mock('../../common/targetResolver.js', () => ({
  resolveTarget: vi.fn(),
  resolveMapPositions: vi.fn(),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn().mockResolvedValue(undefined),
  setRuntimeObject: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn().mockResolvedValue({}),
}));

vi.mock('../../../rules/combat/rangeValidation.js', () => ({
  rangeToFeet: vi.fn(),
  getDistanceFeet: vi.fn(),
}));

vi.mock('../../../rules/combat/rangeCheck.js', () => ({
  isWithinRange: vi.fn().mockResolvedValue(true),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
}));

vi.mock('../../../rules/combat/applyHealing.js', () => ({
  applyHealingToTarget: vi.fn(),
}));

vi.mock('../../common/damageRollback.js', () => ({
  findLastAttack: vi.fn().mockResolvedValue({
    attackEvent: null,
    attackerName: null,
    targetName: null,
    primaryDamage: 0,
    secondaryDamage: 0,
    totalDamage: 0,
    damageTypes: [],
  }),
}));

vi.mock('../../../combat/automation/automationService.js', () => ({
  evaluateAutoExpression: vi.fn(),
}));

vi.mock('../../common/infoPopup.js', () => ({
  infoPopup: vi.fn().mockImplementation((name, description, automation, extraProps) => {
    const result = {
      type: 'popup',
      payload: {
        type: 'automation_info',
        name,
        description,
        automation,
      },
    };
    if (extraProps) {
      Object.assign(result, extraProps);
    }
    return result;
  }),
}));

import * as targetResolver from '../../common/targetResolver.js';
import * as useRuntimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as damageUtils from '../../../rules/combat/damageUtils.js';
import * as damageRollback from '../../common/damageRollback.js';
import * as applyHealing from '../../../rules/combat/applyHealing.js';
import * as logService from '../../../ui/logService.js';

const campaignName = 'test-campaign';
const mapName = 'TestMap';

function makeBardStats(overrides = {}) {
  return {
    name: 'CuttingWordsBard',
    proficiency: 2,
    level: 3,
    class: {
      name: 'Bard',
      class_levels: [
        { level: 1, bardic_die: 6 },
        { level: 2, bardic_die: 6 },
        { level: 3, bardic_die: 6 },
      ],
    },
    abilities: [
      { name: 'Charisma', bonus: 4 },
      { name: 'Intelligence', bonus: 1 },
    ],
    characterAdvancement: [],
    _trackedResources: {
      bardicInspirationUses: { current: 4, max: 4 },
    },
    ...overrides,
  };
}

function makeCuttingWordsAction() {
  return {
    name: 'Cutting Words',
    automation: {
      type: 'reaction_debuff',
      trigger: 'damage_ability_check_or_attack_roll_within_60ft',
      debuffExpression: 'bardic_inspiration_die',
      subtractive: true,
      range: '60 ft',
      casting_time: '1 reaction',
    },
  };
}

function makeCombatSummary(creatures = []) {
  return { round: 1, creatures };
}

function setupAttackPath(attackEventOverrides = {}, damageOverrides = {}) {
  targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });
  damageUtils.getCombatContext.mockResolvedValue(makeCombatSummary([{ name: 'Goblin', hp: 15 }]));
  damageRollback.findLastAttack.mockResolvedValue({
    attackEvent: {
      d20: 14,
      bonus: 3,
      targetName: 'Goblin',
      targetAc: 17,
      hit: true,
      timestamp: Date.now(),
      ...attackEventOverrides,
    },
    attackerName: 'Goblin',
    targetName: 'Goblin',
    primaryDamage: 10,
    secondaryDamage: 0,
    totalDamage: 10,
    damageTypes: ['Piercing'],
    ...damageOverrides,
  });
  return { action: makeCuttingWordsAction() };
}

function setupDamagePath(rawDamage = 10) {
  targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });
  damageUtils.getCombatContext.mockResolvedValue(makeCombatSummary([{ name: 'Goblin', hp: 15 }]));
  damageRollback.findLastAttack.mockResolvedValue({
    attackEvent: { rawDamage, targetName: 'Goblin', timestamp: Date.now() },
    attackerName: 'Goblin',
    targetName: 'Goblin',
    primaryDamage: rawDamage,
    secondaryDamage: 0,
    totalDamage: rawDamage,
    damageTypes: ['Fire'],
  });
  return { action: makeCuttingWordsAction() };
}

describe('CLA-071: Cutting Words — Verification Test', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useRuntimeState.getRuntimeValue.mockReturnValue(undefined);
  });

  describe('attack roll debuff', () => {
    it('reduces d20 by bardic inspiration die and shows hit/miss change', async () => {
      const { action } = setupAttackPath(
        { d20: 14, bonus: 3, targetAc: 17, hit: true },
        { totalDamage: 0, damageTypes: [] }
      );

      const result = await handle(action, makeBardStats(), campaignName, mapName);

      expect(result.type).toBe('popup');
      expect(result.payload.name).toBe('Cutting Words');
      expect(result.payload.description).toContain('Cutting Words');
      expect(result.payload.description).toContain('Attack roll');
      expect(result.payload.description).toContain('Reduced');
      expect(result.payload.description).toContain('Bardic Inspiration die');
      expect(result.payload.description).toContain('MISS');
    });

    it('heals target when attack roll hit turns to miss with primary damage available', async () => {
      applyHealing.applyHealingToTarget.mockReturnValue({ newHp: 25, actualHeal: 10 });

      const { action } = setupAttackPath(
        { d20: 14, bonus: 3, targetAc: 17, hit: true },
        { totalDamage: 0, damageTypes: [], primaryDamage: 10 }
      );

      const result = await handle(action, makeBardStats(), campaignName, mapName);

      expect(result.payload.description).toContain('Attack roll');
      expect(result.payload.description).toContain('now misses');
      expect(result.payload.description).toContain('healed');
      expect(result.defenderHp).toBe(25);
    });

    it('reports attack still hits when debuff is insufficient', async () => {
      const { action } = setupAttackPath(
        { d20: 20, bonus: 5, targetAc: 14, hit: true },
        { totalDamage: 0, damageTypes: [] }
      );

      const result = await handle(action, makeBardStats(), campaignName, mapName);

      expect(result.payload.description).toContain('still hits');
    });

    it('caps reduced d20 at minimum of 1', async () => {
      const { action } = setupAttackPath(
        { d20: 1, bonus: 5, targetAc: 20, hit: false },
        { totalDamage: 0, damageTypes: [] }
      );

      const result = await handle(action, makeBardStats(), campaignName, mapName);

      expect(result.payload.description).toContain('d20(1) + 5 = 6');
    });

    it('heals target when hit turns to miss and damage is available', async () => {
      applyHealing.applyHealingToTarget.mockReturnValue({ newHp: 25, actualHeal: 10 });

      const { action } = setupAttackPath(
        { d20: 14, bonus: 3, targetAc: 17, hit: true },
        { totalDamage: 10, damageTypes: ['Piercing'] }
      );

      const result = await handle(action, makeBardStats(), campaignName, mapName);

      // When totalDamage > 0, handler routes to damage path
      expect(result.payload.description).toContain('Original damage');
      expect(result.payload.description).toContain('Reduced damage');
      expect(result.payload.description).toContain('Healed');
      expect(result.defenderHp).toBe(25);
      expect(applyHealing.applyHealingToTarget).toHaveBeenCalled();
    });
  });

  describe('damage debuff', () => {
    it('reduces damage and heals target', async () => {
      applyHealing.applyHealingToTarget.mockReturnValue({ newHp: 20 });

      const { action } = setupDamagePath(15);

      const result = await handle(action, makeBardStats(), campaignName, mapName);

      expect(result.payload.description).toContain('Original damage');
      expect(result.payload.description).toContain('Reduced damage');
      expect(result.payload.description).toContain('Bardic Inspiration die');
      expect(result.payload.description).toContain('Healed');
      expect(result.defenderHp).toBe(20);
    });

    it('does not reduce damage when bardic die roll equals total damage', async () => {
      applyHealing.applyHealingToTarget.mockReturnValue(null);

      const { action } = setupDamagePath(1);

      const result = await handle(action, makeBardStats(), campaignName, mapName);

      expect(result.payload.description).toContain('Original damage');
      expect(result.payload.description).toContain('Reduced damage');
    });
  });

  describe('early exits', () => {
    it('returns popup when no combat context', async () => {
      targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });
      damageUtils.getCombatContext.mockResolvedValue(null);

      const result = await handle(makeCuttingWordsAction(), makeBardStats(), campaignName, mapName);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('No combat context found');
    });

    it('returns popup when no target selected', async () => {
      targetResolver.resolveTarget.mockResolvedValue({ target: null });
      damageUtils.getCombatContext.mockResolvedValue(makeCombatSummary([{ name: 'Goblin', hp: 15 }]));

      const result = await handle(makeCuttingWordsAction(), makeBardStats(), campaignName, mapName);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('requires a target');
    });

    it('returns popup when no uses remaining', async () => {
      targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });
      damageUtils.getCombatContext.mockResolvedValue(makeCombatSummary([{ name: 'Goblin', hp: 15 }]));
      damageRollback.findLastAttack.mockResolvedValue({
        attackEvent: { d20: 15, bonus: 5, targetName: 'Goblin', targetAc: 14, hit: true, timestamp: Date.now() },
        attackerName: 'Goblin',
        targetName: 'Goblin',
        primaryDamage: 0,
        secondaryDamage: 0,
        totalDamage: 0,
        damageTypes: [],
      });
      useRuntimeState.getRuntimeValue.mockImplementation((key, prop) => {
        if (key === 'CuttingWordsBard' && prop === 'bardicInspirationUses') return 0;
        return undefined;
      });

      const bard = makeBardStats();
      bard._trackedResources = { bardicInspirationUses: { current: 0, max: 4 } };

      const result = await handle(makeCuttingWordsAction(), bard, campaignName, mapName);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('no uses remaining');
    });

    it('returns popup when no recent roll for resolved target', async () => {
      targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Orc' } });
      damageUtils.getCombatContext.mockResolvedValue(makeCombatSummary([{ name: 'Goblin', hp: 15 }]));
      damageRollback.findLastAttack.mockResolvedValue({
        attackEvent: { d20: 15, bonus: 5, targetName: 'Goblin', targetAc: 14, hit: true, timestamp: Date.now() },
        attackerName: 'Goblin',
        targetName: 'Goblin',
        primaryDamage: 0,
        secondaryDamage: 0,
        totalDamage: 0,
        damageTypes: [],
      });

      const result = await handle(makeCuttingWordsAction(), makeBardStats(), campaignName, mapName);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('No recent roll found for Orc');
    });
  });

  describe('uses decrement and logging', () => {
    it('decrements bardicInspirationUses after successful use', async () => {
      const { action } = setupAttackPath(
        { d20: 14, bonus: 3, targetAc: 17, hit: true },
        { totalDamage: 0, damageTypes: [] }
      );

      await handle(action, makeBardStats(), campaignName, mapName);

      expect(useRuntimeState.setRuntimeObject).toHaveBeenCalledWith(
        'CuttingWordsBard',
        expect.objectContaining({ bardicInspirationUses: 3 }),
        campaignName,
        expect.anything()
      );
    });

    it('logs ability_use to campaign log', async () => {
      const { action } = setupAttackPath(
        { d20: 14, bonus: 3, targetAc: 17, hit: true },
        { totalDamage: 0, damageTypes: [] }
      );

      await handle(action, makeBardStats(), campaignName, mapName);

      expect(logService.addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
        type: 'ability_use',
        characterName: 'CuttingWordsBard',
        abilityName: 'Cutting Words',
        targetName: 'Goblin',
      }));
    });
  });
});
