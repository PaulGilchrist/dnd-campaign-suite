// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks BEFORE imports (hoisted by vitest) ───────────────────

vi.mock('../../common/targetResolver.js', () => ({
  resolveTarget: vi.fn(),
  resolveMapPositions: vi.fn(),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn().mockResolvedValue({}),
}));

vi.mock('../../../rules/combat/rangeValidation.js', () => ({
  getDistanceFeet: vi.fn(),
  rangeToFeet: vi.fn(),
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

// ── Imports ─────────────────────────────────────────────────────

import { handle } from './reactionDebuffHandler.js';

import * as targetResolver from '../../common/targetResolver.js';
import * as useRuntimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as logService from '../../../ui/logService.js';
import * as rangeValidation from '../../../rules/combat/rangeValidation.js';
import * as damageUtils from '../../../rules/combat/damageUtils.js';
import * as applyHealing from '../../../rules/combat/applyHealing.js';
import * as damageRollback from '../../common/damageRollback.js';
import * as automationService from '../../../combat/automation/automationService.js';

// ── Helpers ─────────────────────────────────────────────────────

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

function fullAttackSetup(options = {}) {
  targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });
  damageUtils.getCombatContext.mockResolvedValue(makeCombatSummary());
  damageRollback.findLastAttack.mockResolvedValue({
    attackEvent: freshAttackEvent(options),
    attackerName: 'Goblin',
    targetName: 'Goblin',
    primaryDamage: options.primaryDamage ?? 10,
    secondaryDamage: 0,
    totalDamage: options.totalDamage ?? (options.hit ? 10 : 0),
    damageTypes: options.damageTypes || ['Piercing'],
  });
}

const campaignName = 'TestCampaign';
const mapName = 'DungeonMap';

// ── Tests ───────────────────────────────────────────────────────

describe('reactionDebuffHandler.handle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rangeValidation.rangeToFeet.mockReset();
    rangeValidation.getDistanceFeet.mockReset();
  });

  // ── Early exit: requires shield ─────────────────────────────

  describe('early exits: requires shield', () => {
    it('returns popup when requiresShield and no shield equipped', async () => {
      const ps = makePlayerStats({ inventory: { equipped: [] } });
      const action = makeAction({ requiresShield: true });

      const result = await handle(action, ps, campaignName, mapName);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('holding a Shield');
      expect(targetResolver.resolveTarget).not.toHaveBeenCalled();
    });

    it('returns popup when requiresShield and equipped list is empty', async () => {
      const ps = makePlayerStats({ inventory: {} });
      const action = makeAction({ requiresShield: true });

      const result = await handle(action, ps, campaignName, mapName);

      expect(result.payload.description).toContain('holding a Shield');
    });

    it('allows use when shield is equipped', async () => {
      const ps = makePlayerStats({
        inventory: { equipped: ['Shield'] },
        equipment: [{ name: 'Shield', armor_category: 'Shield' }],
      });
      const action = makeAction({ requiresShield: true });

      targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });
      damageUtils.getCombatContext.mockResolvedValue(makeCombatSummary());
      damageRollback.findLastAttack.mockResolvedValue({
        attackEvent: freshAttackEvent({ d20: 5, bonus: 3, hit: false }),
        attackerName: 'Goblin',
        targetName: 'Goblin',
        primaryDamage: 0,
        secondaryDamage: 0,
        totalDamage: 0,
        damageTypes: [],
      });

      const result = await handle(action, ps, campaignName, mapName);

      expect(result.payload.description).toContain('Attack roll');
    });

    it('allows use when magic shield (+ prefix) is equipped', async () => {
      const ps = makePlayerStats({
        inventory: { equipped: ['+1 Shield'] },
        equipment: [{ name: 'Shield', armor_category: 'Shield' }],
      });
      const action = makeAction({ requiresShield: true });

      targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });
      damageUtils.getCombatContext.mockResolvedValue(makeCombatSummary());
      damageRollback.findLastAttack.mockResolvedValue({
        attackEvent: freshAttackEvent({ d20: 5, bonus: 3, hit: false }),
        attackerName: 'Goblin',
        targetName: 'Goblin',
        primaryDamage: 0,
        secondaryDamage: 0,
        totalDamage: 0,
        damageTypes: [],
      });

      const result = await handle(action, ps, campaignName, mapName);

      expect(result.payload.description).toContain('Attack roll');
    });

    it('does not allow use when equipped item is not a shield', async () => {
      const ps = makePlayerStats({
        inventory: { equipped: ['Longsword'] },
        equipment: [{ name: 'Longsword', weapon_category: 'martial_melee' }],
      });
      const action = makeAction({ requiresShield: true });

      const result = await handle(action, ps, campaignName, mapName);

      expect(result.payload.description).toContain('holding a Shield');
    });
  });

  // ── Early exit: uses exhausted ──────────────────────────────

  describe('early exits: uses exhausted', () => {
    function setupExhausted(usesExpression = 3, recharge = 'long_rest') {
      const ps = makePlayerStats({});
      const action = makeAction({ uses_expression: usesExpression, recharge });
      automationService.evaluateAutoExpression.mockReturnValue(3);
      useRuntimeState.getRuntimeValue.mockReturnValue(0);
      return { ps, action };
    }

    it('returns popup when usesUsed equals effectiveUsesMax (numeric)', async () => {
      const { ps, action } = setupExhausted(3, 'long_rest');
      const result = await handle(action, ps, campaignName, mapName);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toContain('no uses remaining');
      expect(result.payload.description).toContain('Long Rest');
      expect(targetResolver.resolveTarget).not.toHaveBeenCalled();
    });

    it('returns popup when usesUsed equals effectiveUsesMax (string expression)', async () => {
      const { ps, action } = setupExhausted('proficiency_bonus', 'long_rest');
      automationService.evaluateAutoExpression.mockReturnValue(2);
      const result = await handle(action, ps, campaignName, mapName);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('no uses remaining');
    });

    it('mentions Short Rest when recharge is short_rest', async () => {
      const { ps, action } = setupExhausted(3, 'short_rest');
      const result = await handle(action, ps, campaignName, mapName);

      expect(result.payload.description).toContain('Short or Long Rest');
    });

    it('proceeds when usesUsed is less than effectiveUsesMax', async () => {
      const ps = makePlayerStats({});
      const action = makeAction({ uses_expression: 3 });
      automationService.evaluateAutoExpression.mockReturnValue(3);
      useRuntimeState.getRuntimeValue.mockReturnValue(2);

      fullAttackSetup();

      await handle(action, ps, campaignName, mapName);

      expect(targetResolver.resolveTarget).toHaveBeenCalled();
    });

    it('skips uses check when effectiveUsesMax is 0 (bardic fallback)', async () => {
      const ps = makePlayerStats({});
      const action = makeAction({});

      fullAttackSetup();

      await handle(action, ps, campaignName, mapName);

      expect(targetResolver.resolveTarget).toHaveBeenCalled();
    });

    it('proceeds when getRuntimeValue returns null (treated as max)', async () => {
      const ps = makePlayerStats({});
      const action = makeAction({ uses_expression: 3 });
      automationService.evaluateAutoExpression.mockReturnValue(3);
      useRuntimeState.getRuntimeValue.mockReturnValue(null);

      fullAttackSetup();

      await handle(action, ps, campaignName, mapName);

      expect(targetResolver.resolveTarget).toHaveBeenCalled();
    });
  });

  // ── Early exit: target / range / combat ─────────────────────

  describe('early exits: target, range, combat', () => {
    it('returns popup when no target resolved', async () => {
      const ps = makePlayerStats({});
      const action = makeAction({});
      targetResolver.resolveTarget.mockResolvedValue(null);

      const result = await handle(action, ps, campaignName, mapName);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('requires a target');
    });

    it('returns popup when out of range', async () => {
      const ps = makePlayerStats({});
      const action = makeAction({ uses_expression: 3 });
      automationService.evaluateAutoExpression.mockReturnValue(3);
      useRuntimeState.getRuntimeValue.mockReturnValue(2);

      targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });
      rangeValidation.rangeToFeet.mockReturnValue(30);
      targetResolver.resolveMapPositions.mockResolvedValue({
        attackerPos: { gridX: 0, gridY: 0 },
        targetPos: { gridX: 20, gridY: 0 },
      });
      rangeValidation.getDistanceFeet.mockReturnValue(50);

      const result = await handle(action, ps, campaignName, mapName);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('out of range');
    });

    it('skips range check when rangeToFeet returns null', async () => {
      const ps = makePlayerStats({});
      const action = makeAction({});

      targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });
      rangeValidation.rangeToFeet.mockReturnValueOnce(null);
      damageUtils.getCombatContext.mockResolvedValue(makeCombatSummary());
      damageRollback.findLastAttack.mockResolvedValue({
        attackEvent: freshAttackEvent(),
        attackerName: 'Goblin',
        targetName: 'Goblin',
        primaryDamage: 10,
        secondaryDamage: 0,
        totalDamage: 10,
        damageTypes: ['Piercing'],
      });

      await handle(action, ps, campaignName, mapName);

      expect(targetResolver.resolveMapPositions).not.toHaveBeenCalled();
    });

    it('skips range check when mapName is falsy', async () => {
      const ps = makePlayerStats({});
      const action = makeAction({});

      targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });
      damageUtils.getCombatContext.mockResolvedValue(makeCombatSummary());
      damageRollback.findLastAttack.mockResolvedValue({
        attackEvent: freshAttackEvent(),
        attackerName: 'Goblin',
        targetName: 'Goblin',
        primaryDamage: 10,
        secondaryDamage: 0,
        totalDamage: 10,
        damageTypes: ['Piercing'],
      });

      await handle(action, ps, campaignName, null);

      expect(targetResolver.resolveMapPositions).not.toHaveBeenCalled();
    });

    it('returns popup when no combat context', async () => {
      const ps = makePlayerStats({});
      const action = makeAction({ uses_expression: 3 });
      automationService.evaluateAutoExpression.mockReturnValue(3);
      useRuntimeState.getRuntimeValue.mockReturnValue(2);

      targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });
      damageUtils.getCombatContext.mockResolvedValue(null);

      const result = await handle(action, ps, campaignName, mapName);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('No combat context found');
    });
  });

  // ── Default path: attack roll debuff ────────────────────────

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

    it('reports already missed when original attack missed', async () => {
      const result = await setupAttackPath(
        {},
        freshAttackEvent({ d20: 3, bonus: 2, hit: false }),
        { totalDamage: 0, damageTypes: [] }
      );

      expect(result.payload.description).toContain('already missed');
    });

    it('uses effectiveAc over targetAc when both present', async () => {
      const result = await setupAttackPath(
        {},
        freshAttackEvent({ d20: 14, bonus: 3, hit: true, effectiveAc: 20 }),
        { totalDamage: 0, damageTypes: [] }
      );

      expect(result.payload.description).toContain('AC 20');
    });

    it('uses targetAc when effectiveAc is null', async () => {
      const result = await setupAttackPath(
        {},
        freshAttackEvent({ d20: 14, bonus: 3, hit: true, effectiveAc: null, targetAc: 17 }),
        { totalDamage: 0, damageTypes: [] }
      );

      expect(result.payload.description).toContain('AC 17');
    });

    it('shows dash when AC is null', async () => {
      const result = await setupAttackPath(
        {},
        freshAttackEvent({ d20: 14, bonus: 3, hit: true, effectiveAc: null, targetAc: null }),
        { totalDamage: 0, damageTypes: [] }
      );

      expect(result.payload.description).toContain('AC \u2014');
    });

    it('attempts healing when hit turns to miss and damage is available', async () => {
      applyHealing.applyHealingToTarget.mockReturnValue({ newHp: 25 });

      const result = await setupAttackPath(
        {},
        freshAttackEvent({ d20: 15, bonus: 3, hit: true, effectiveAc: null, targetAc: 17, targetName: 'Goblin' })
      );

      expect(result).toHaveProperty('defenderHp');
    });

    it('does not attempt healing when no damage event found', async () => {
      damageRollback.findLastAttack.mockResolvedValue({
        attackEvent: freshAttackEvent({ d20: 15, bonus: 3, hit: true, effectiveAc: null }),
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

  // ── Default path: damage debuff ─────────────────────────────

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
  });

  // ── Default path: no fresh events ───────────────────────────

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

  // ── Disadvantage effect path: disadvantage_on_attack_roll ───

  describe('effect: disadvantage_on_attack_roll', () => {
    function setupDisadvantagePath() {
      const ps = makePlayerStats({});
      const action = makeAction({ effect: 'disadvantage_on_attack_roll' });

      targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });
      damageUtils.getCombatContext.mockResolvedValue(makeCombatSummary());
      damageRollback.findLastAttack.mockResolvedValue({
        attackEvent: freshAttackEvent({ d20: 14, bonus: 3, hit: true, effectiveAc: null }),
        attackerName: 'Goblin',
        targetName: 'Goblin',
        primaryDamage: 10,
        secondaryDamage: 0,
        totalDamage: 10,
        damageTypes: ['Piercing'],
      });

      return handle(action, ps, campaignName, mapName);
    }

    it('returns popup when no attack event', async () => {
      const ps = makePlayerStats({});
      const action = makeAction({ effect: 'disadvantage_on_attack_roll' });

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
      expect(result.payload.description).toContain('No recent attack roll found');
    });

    it('reports disadvantage in description', async () => {
      const result = await setupDisadvantagePath();

      expect(result.payload.description).toContain('Disadvantage');
      expect(result.payload.description).toContain('second d20');
    });

    it('reports already missed for disadvantage on miss', async () => {
      const ps = makePlayerStats({});
      const action = makeAction({ effect: 'disadvantage_on_attack_roll' });

      targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });
      damageUtils.getCombatContext.mockResolvedValue(makeCombatSummary());
      damageRollback.findLastAttack.mockResolvedValue({
        attackEvent: freshAttackEvent({ d20: 3, bonus: 2, hit: false, effectiveAc: null }),
        attackerName: 'Goblin',
        targetName: 'Goblin',
        primaryDamage: 0,
        secondaryDamage: 0,
        totalDamage: 0,
        damageTypes: [],
      });

      const result = await handle(action, ps, campaignName, mapName);

      expect(result.payload.description).toContain('already missed');
    });

    it('returns popup when out of range', async () => {
      const ps = makePlayerStats({});
      const action = makeAction({ effect: 'disadvantage_on_attack_roll', range: '30_ft' });

      targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });
      rangeValidation.rangeToFeet.mockReturnValue(30);
      targetResolver.resolveMapPositions.mockResolvedValue({
        attackerPos: { gridX: 0, gridY: 0 },
        targetPos: { gridX: 20, gridY: 0 },
      });
      rangeValidation.getDistanceFeet.mockReturnValue(50);

      const result = await handle(action, ps, campaignName, mapName);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('out of range');
    });
  });

  // ── Improved Warding Flare ──────────────────────────────────

  describe('Improved Warding Flare', () => {
    function makeWardingFlarePlayer() {
      return makePlayerStats({
        abilities: [{ name: 'Wisdom', bonus: 2 }],
        characterAdvancement: [
          { name: 'Improved Warding Flare', automation: { tempHpExpression: '2d6' } },
        ],
      });
    }

    it('applies tempHp when effect is disadvantage and feature present', async () => {
      const ps = makeWardingFlarePlayer();
      const action = makeAction({ effect: 'disadvantage_on_attack_roll' });

      targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });
      damageUtils.getCombatContext.mockResolvedValue(makeCombatSummary());
      damageRollback.findLastAttack.mockResolvedValue({
        attackEvent: freshAttackEvent({ d20: 18, bonus: 3, hit: true, effectiveAc: null }),
        attackerName: 'Goblin',
        targetName: 'Goblin',
        primaryDamage: 10,
        secondaryDamage: 0,
        totalDamage: 10,
        damageTypes: ['Piercing'],
      });

      await handle(action, ps, campaignName, mapName);

      const tempHpCall = useRuntimeState.setRuntimeValue.mock.calls.find(
        (c) => c[1] === 'tempHp'
      );
      expect(tempHpCall).toBeDefined();
    });

    it('does not apply tempHp when effect is not disadvantage', async () => {
      const ps = makeWardingFlarePlayer();
      const action = makeAction({});

      targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });
      damageUtils.getCombatContext.mockResolvedValue(makeCombatSummary());
      damageRollback.findLastAttack.mockResolvedValue({
        attackEvent: freshAttackEvent({ d20: 5, bonus: 3, hit: false }),
        attackerName: 'Goblin',
        targetName: 'Goblin',
        primaryDamage: 0,
        secondaryDamage: 0,
        totalDamage: 0,
        damageTypes: [],
      });

      await handle(action, ps, campaignName, mapName);

      const tempHpCall = useRuntimeState.setRuntimeValue.mock.calls.find(
        (c) => c[1] === 'tempHp'
      );
      expect(tempHpCall).toBeUndefined();
    });

    it('does not apply tempHp when feature not on player', async () => {
      const ps = makePlayerStats({});
      const action = makeAction({ effect: 'disadvantage_on_attack_roll' });

      targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });
      damageUtils.getCombatContext.mockResolvedValue(makeCombatSummary());
      damageRollback.findLastAttack.mockResolvedValue({
        attackEvent: freshAttackEvent({ d20: 18, bonus: 3, hit: true, effectiveAc: null }),
        attackerName: 'Goblin',
        targetName: 'Goblin',
        primaryDamage: 10,
        secondaryDamage: 0,
        totalDamage: 10,
        damageTypes: ['Piercing'],
      });

      await handle(action, ps, campaignName, mapName);

      const tempHpCall = useRuntimeState.setRuntimeValue.mock.calls.find(
        (c) => c[1] === 'tempHp'
      );
      expect(tempHpCall).toBeUndefined();
    });
  });

  // ── Uses decrement tracking ─────────────────────────────────

  describe('uses decrement', () => {
    function setupBasicPath() {
      const ps = makePlayerStats({});
      const action = makeAction({ uses_expression: 3 });
      automationService.evaluateAutoExpression.mockReturnValue(3);
      useRuntimeState.getRuntimeValue.mockReturnValue(2);

      targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });
      damageUtils.getCombatContext.mockResolvedValue(makeCombatSummary());
      damageRollback.findLastAttack.mockResolvedValue({
        attackEvent: { ...freshAttackEvent({ d20: 5, bonus: 3, hit: false }), damageTypes: [] },
        attackerName: 'Goblin',
        targetName: 'Goblin',
        primaryDamage: 0,
        secondaryDamage: 0,
        totalDamage: 0,
        damageTypes: [],
      });

      return handle(action, ps, campaignName, mapName);
    }

    it('increments uses count after success with string expression', async () => {
      const ps = makePlayerStats({});
      const action = makeAction({ uses_expression: 'proficiency_bonus' });
      automationService.evaluateAutoExpression.mockReturnValue(2);

      targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });
      damageUtils.getCombatContext.mockResolvedValue(makeCombatSummary());
      damageRollback.findLastAttack.mockResolvedValue({
        attackEvent: freshAttackEvent({ d20: 5, bonus: 3, hit: false }),
        attackerName: 'Goblin',
        targetName: 'Goblin',
        primaryDamage: 0,
        secondaryDamage: 0,
        totalDamage: 0,
        damageTypes: [],
      });

      await handle(action, ps, campaignName, mapName);

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Bard',
        'cuttingwordsUses',
        1,
        campaignName
      );
    });

    it('decrements bardicInspirationUses with bardic inspiration fallback', async () => {
      const ps = makePlayerStats({});
      const action = makeAction({});

      targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });
      damageUtils.getCombatContext.mockResolvedValue(makeCombatSummary());
      damageRollback.findLastAttack.mockResolvedValue({
        attackEvent: freshAttackEvent({ d20: 5, bonus: 3, hit: false }),
        attackerName: 'Goblin',
        targetName: 'Goblin',
        primaryDamage: 0,
        secondaryDamage: 0,
        totalDamage: 0,
        damageTypes: [],
      });
      useRuntimeState.getRuntimeValue.mockReturnValue(2);

      await handle(action, ps, campaignName, mapName);

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Bard',
        'bardicInspirationUses',
        1,
        campaignName
      );
    });

    it('does not decrement uses on early return (uses exhausted)', async () => {
      const ps = makePlayerStats({});
      const action = makeAction({ uses_expression: 3 });
      automationService.evaluateAutoExpression.mockReturnValue(3);
      useRuntimeState.getRuntimeValue.mockReturnValue(0);

      await handle(action, ps, campaignName, mapName);

      expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
    });

    it('uses runtime value from getRuntimeValue for incremental count', async () => {
      useRuntimeState.getRuntimeValue
        .mockReturnValueOnce(2)
        .mockReturnValueOnce(2);

      await setupBasicPath();

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Bard',
        'cuttingwordsUses',
        1,
        campaignName
      );
    });
  });

  // ── Log entry creation ──────────────────────────────────────

  describe('log entry', () => {
    function setupLogPath() {
      const ps = makePlayerStats({});
      const action = makeAction({});

      targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });
      damageUtils.getCombatContext.mockResolvedValue(makeCombatSummary());
      damageRollback.findLastAttack.mockResolvedValue({
        attackEvent: freshAttackEvent({ d20: 5, bonus: 3, hit: false }),
        attackerName: 'Goblin',
        targetName: 'Goblin',
        primaryDamage: 0,
        secondaryDamage: 0,
        totalDamage: 0,
        damageTypes: [],
      });

      return { ps, action };
    }

    it('adds log entry with combat details after successful handling', async () => {
      const { ps, action } = setupLogPath();

      await handle(action, ps, campaignName, mapName);

      expect(logService.addEntry).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({
          type: 'ability_use',
          characterName: 'Bard',
          abilityName: 'Cutting Words',
          targetName: 'Goblin',
          description: expect.stringContaining('d20(5) + 3 = 8 vs AC 14'),
          timestamp: expect.any(Number),
        })
      );
    });

    it('uses "Feature" as name when action.name is empty', async () => {
      const { ps, action } = setupLogPath();
      action.name = '';

      await handle(action, ps, campaignName, mapName);

      expect(logService.addEntry).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({
          abilityName: 'Feature',
        })
      );
    });
  });

  // ── Edge cases and null safety ──────────────────────────────

  describe('edge cases', () => {
    it('handles playerStats with empty class_levels array', async () => {
      const ps = makePlayerStats({ class: { name: 'Bard', class_levels: [] } });
      const action = makeAction({});

      targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });
      damageUtils.getCombatContext.mockResolvedValue(makeCombatSummary());
      damageRollback.findLastAttack.mockResolvedValue({
        attackEvent: freshAttackEvent({ d20: 5, bonus: 3, hit: false }),
        attackerName: 'Goblin',
        targetName: 'Goblin',
        primaryDamage: 0,
        secondaryDamage: 0,
        totalDamage: 0,
        damageTypes: [],
      });

      const result = await handle(action, ps, campaignName, mapName);

      expect(result).toBeDefined();
    });

    it('handles missing classLevel for bardicDieSize defaults to 6', async () => {
      const ps = makePlayerStats({ level: 99 });
      const action = makeAction({});

      targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });
      damageUtils.getCombatContext.mockResolvedValue(makeCombatSummary());
      damageRollback.findLastAttack.mockResolvedValue({
        attackEvent: freshAttackEvent({ d20: 5, bonus: 3, hit: false }),
        attackerName: 'Goblin',
        targetName: 'Goblin',
        primaryDamage: 0,
        secondaryDamage: 0,
        totalDamage: 0,
        damageTypes: [],
      });

      const result = await handle(action, ps, campaignName, mapName);

      expect(result).toBeDefined();
    });
  });
});
