// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
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
import * as damageUtils from '../../../rules/combat/damageUtils.js';
import * as damageRollback from '../../common/damageRollback.js';
import * as applyHealing from '../../../rules/combat/applyHealing.js';

function makePlayerStats(overrides = {}) {
  return {
    name: 'Bard',
    proficiency: 2,
    level: 3,
    class: {
      name: 'Bard',
      class_levels: [
        { level: 1, bardic_die: 6 },
        { level: 2, bardic_die: 6 },
        { level: 3, bardic_die: 8 },
      ],
    },
    abilities: [
      { name: 'Wisdom', bonus: 2 },
      { name: 'Charisma', bonus: 4 },
    ],
    characterAdvancement: [],
    _trackedResources: {
      bardicInspirationUses: { current: 4, max: 4 },
    },
    ...overrides,
  };
}

function makeAction(automation = {}) {
  return {
    name: 'Cutting Words',
    automation: {
      type: 'reaction_debuff',
      range: '60_ft',
      effect: '',
      uses_expression: null,
      recharge: 'long_rest',
      ...automation,
    },
  };
}

function makeCombatSummary(creatures = []) {
  return { round: 1, creatures };
}

function freshAttackEvent(options = {}) {
  return {
    d20: 15,
    bonus: 5,
    targetName: 'Goblin',
    targetAc: 14,
    effectiveAc: null,
    hit: true,
    timestamp: Date.now(),
    ...options,
  };
}

const campaignName = 'TestCampaign';
const mapName = 'DungeonMap';

describe('reactionDebuffHandler — default path: attack roll & damage debuff', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('default path — attack roll debuff', () => {
    function setupAttackPath(psOverrides, attackEvent, damageOverride = {}) {
      const ps = makePlayerStats(psOverrides);
      const action = makeAction({});

      targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });
      damageUtils.getCombatContext.mockResolvedValue(makeCombatSummary());
      damageRollback.findLastAttack.mockResolvedValue({
        attackEvent,
        attackerName: 'Goblin',
        targetName: 'Goblin',
        primaryDamage: 10,
        secondaryDamage: 0,
        totalDamage: 10,
        damageTypes: ['Piercing'],
        ...damageOverride,
      });

      return handle(action, ps, campaignName, mapName);
    }

    it('routes to attack handler when attack event present with no damage', async () => {
      const result = await setupAttackPath(
        {},
        freshAttackEvent(),
        { totalDamage: 0, damageTypes: [] }
      );

      expect(result.payload.description).toContain('Attack roll');
      expect(result.payload.description).toContain('Cutting Words');
    });

    it('reduces d20 by bardic die roll (capped at 1)', async () => {
      const result = await setupAttackPath(
        {},
        freshAttackEvent({ d20: 3, bonus: 5, hit: true }),
        { totalDamage: 0, damageTypes: [] }
      );

      expect(result.payload.description).toContain('Reduced');
    });

    it('reports attack still hits when debuff is insufficient to change outcome', async () => {
      const result = await setupAttackPath(
        {},
        freshAttackEvent({ d20: 20, bonus: 5, hit: true, targetAc: 14 }),
        { totalDamage: 0, damageTypes: [] }
      );

      expect(result.payload.description).toContain('still hits');
    });

    it('caps reduced d20 at minimum of 1', async () => {
      const result = await setupAttackPath(
        {},
        freshAttackEvent({ d20: 1, bonus: 5, hit: false, targetAc: 20 }),
        { totalDamage: 0, damageTypes: [] }
      );

      expect(result.payload.description).toContain('d20(1) + 5 = 6');
    });

    it('returns popup when attacker name does not match resolved target', async () => {
      const ps = makePlayerStats({});
      const action = makeAction({});

      targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });
      damageUtils.getCombatContext.mockResolvedValue(makeCombatSummary());
      damageRollback.findLastAttack.mockResolvedValue({
        attackEvent: freshAttackEvent(),
        attackerName: 'Orc',
        targetName: 'Goblin',
        primaryDamage: 10,
        secondaryDamage: 0,
        totalDamage: 10,
        damageTypes: ['Piercing'],
      });

      const result = await handle(action, ps, campaignName, mapName);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('No recent roll found for Goblin');
    });

    it('displays correct AC based on effectiveAc/targetAc/null', async () => {
      // effectiveAc takes priority over targetAc
      let result = await setupAttackPath(
        {},
        freshAttackEvent({ d20: 14, bonus: 3, hit: true, effectiveAc: 20 }),
        { totalDamage: 0, damageTypes: [] }
      );
      expect(result.payload.description).toContain('AC 20');

      // falls back to targetAc when effectiveAc is null
      vi.clearAllMocks();
      targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });
      damageUtils.getCombatContext.mockResolvedValue(makeCombatSummary());
      damageRollback.findLastAttack.mockResolvedValue({
        attackEvent: freshAttackEvent({ d20: 14, bonus: 3, hit: true, effectiveAc: null, targetAc: 17 }),
        attackerName: 'Goblin',
        targetName: 'Goblin',
        primaryDamage: 10,
        secondaryDamage: 0,
        totalDamage: 0,
        damageTypes: [],
      });
      result = await handle(makeAction(), makePlayerStats(), campaignName, mapName);
      expect(result.payload.description).toContain('AC 17');

      // shows dash when both are null
      vi.clearAllMocks();
      targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });
      damageUtils.getCombatContext.mockResolvedValue(makeCombatSummary());
      damageRollback.findLastAttack.mockResolvedValue({
        attackEvent: freshAttackEvent({ d20: 14, bonus: 3, hit: true, effectiveAc: null, targetAc: null }),
        attackerName: 'Goblin',
        targetName: 'Goblin',
        primaryDamage: 10,
        secondaryDamage: 0,
        totalDamage: 0,
        damageTypes: [],
      });
      result = await handle(makeAction(), makePlayerStats(), campaignName, mapName);
      expect(result.payload.description).toContain('AC \u2014');
    });

    it('attempts healing when hit turns to miss and damage is available', async () => {
      applyHealing.applyHealingToTarget.mockReturnValue({ newHp: 25 });

      const result = await setupAttackPath(
        {},
        freshAttackEvent({ d20: 14, bonus: 3, hit: true, effectiveAc: null, targetAc: 17, targetName: 'Goblin' })
      );

      expect(result).toHaveProperty('defenderHp');
    });

    it('does not attempt healing when no damage event found', async () => {
      damageRollback.findLastAttack.mockResolvedValue({
        attackEvent: freshAttackEvent({ d20: 14, bonus: 3, hit: true, effectiveAc: null, targetAc: 17 }),
        attackerName: 'Goblin',
        targetName: 'Goblin',
        primaryDamage: 0,
        secondaryDamage: 0,
        totalDamage: 0,
        damageTypes: [],
      });

      const ps = makePlayerStats({});
      const action = makeAction({});

      targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });
      damageUtils.getCombatContext.mockResolvedValue(makeCombatSummary());

      await handle(action, ps, campaignName, mapName);

      expect(applyHealing.applyHealingToTarget).not.toHaveBeenCalled();
    });

    it('does not attempt healing when hit does not turn to miss', async () => {
      const ps = makePlayerStats({});
      const action = makeAction({});

      targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });
      damageUtils.getCombatContext.mockResolvedValue(makeCombatSummary());
      damageRollback.findLastAttack.mockResolvedValue({
        attackEvent: freshAttackEvent({ d20: 18, bonus: 5, hit: true }),
        attackerName: 'Goblin',
        targetName: 'Goblin',
        primaryDamage: 10,
        secondaryDamage: 0,
        totalDamage: 0,
        damageTypes: [],
      });

      await handle(action, ps, campaignName, mapName);

      expect(applyHealing.applyHealingToTarget).not.toHaveBeenCalled();
    });
  });

  describe('default path — damage debuff', () => {
    function setupDamagePath() {
      const ps = makePlayerStats({});
      const action = makeAction({});

      targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });
      damageUtils.getCombatContext.mockResolvedValue(makeCombatSummary());
      damageRollback.findLastAttack.mockResolvedValue({
        attackEvent: { rawDamage: 10, targetName: 'Goblin', timestamp: Date.now() },
        attackerName: 'Goblin',
        targetName: 'Goblin',
        primaryDamage: 10,
        secondaryDamage: 0,
        totalDamage: 10,
        damageTypes: ['Fire'],
      });

      return handle(action, ps, campaignName, mapName);
    }

    it('routes to damage handler when attack has damage', async () => {
      const result = await setupDamagePath();

      expect(result.payload.description).toContain('Original damage');
      expect(result.payload.description).toContain('Reduced damage');
    });

    it('attempts healing when original damage exceeds reduced damage', async () => {
      applyHealing.applyHealingToTarget.mockReturnValue({ newHp: 30 });

      await setupDamagePath();

      expect(applyHealing.applyHealingToTarget).toHaveBeenCalled();
    });

    it('includes healed HP info in description when healing succeeds', async () => {
      applyHealing.applyHealingToTarget.mockReturnValue({ newHp: 30 });

      const result = await setupDamagePath();

      expect(result.payload.description).toContain('HP: 30');
    });

    it('returns defenderHp from healing result', async () => {
      applyHealing.applyHealingToTarget.mockReturnValue({ newHp: 30 });

      const result = await setupDamagePath();

      expect(result.defenderHp).toBe(30);
    });

    it('sets defenderHp to null when healing returns no newHp', async () => {
      applyHealing.applyHealingToTarget.mockReturnValue(null);

      const result = await setupDamagePath();

      expect(result.defenderHp).toBeNull();
    });

    it('returns popup when damage event has no targetName', async () => {
      const ps = makePlayerStats({});
      const action = makeAction({});

      targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });
      damageUtils.getCombatContext.mockResolvedValue(makeCombatSummary());
      damageRollback.findLastAttack.mockResolvedValue({
        attackEvent: { rawDamage: 5, timestamp: Date.now() },
        attackerName: 'Goblin',
        targetName: null,
        primaryDamage: 5,
        secondaryDamage: 0,
        totalDamage: 5,
        damageTypes: ['Fire'],
      });

      const result = await handle(action, ps, campaignName, mapName);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('Could not determine who');
    });

    it('uses primaryDamage as fallback when totalDamage is 0', async () => {
      applyHealing.applyHealingToTarget.mockReturnValue({ newHp: 25 });

      const ps = makePlayerStats({});
      const action = makeAction({});

      targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });
      damageUtils.getCombatContext.mockResolvedValue(makeCombatSummary());
      damageRollback.findLastAttack.mockResolvedValue({
        attackEvent: freshAttackEvent({ d20: 14, bonus: 3, hit: true, effectiveAc: null, targetAc: 17, targetName: 'Goblin' }),
        attackerName: 'Goblin',
        targetName: 'Goblin',
        primaryDamage: 8,
        secondaryDamage: 0,
        totalDamage: 0,
        damageTypes: [],
      });

      const result = await handle(action, ps, campaignName, mapName);

      expect(result).toHaveProperty('defenderHp');
      expect(applyHealing.applyHealingToTarget).toHaveBeenCalled();
    });
  });

  describe('default path — no fresh events', () => {
    it('returns popup when all events are stale or missing', async () => {
      const ps = makePlayerStats({});
      const action = makeAction({});

      targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });
      damageUtils.getCombatContext.mockResolvedValue(makeCombatSummary());
      damageRollback.findLastAttack.mockResolvedValue({
        attackEvent: null,
        attackerName: null,
        targetName: null,
        primaryDamage: 0,
        secondaryDamage: 0,
        totalDamage: 0,
        damageTypes: [],
      });

      const result = await handle(action, ps, campaignName, mapName);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('No recent roll found');
    });
  });
});
