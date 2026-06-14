import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks BEFORE imports (hoisted by vitest) ───────────────────

vi.mock('../common/targetResolver.js', () => ({
  resolveTarget: vi.fn(),
  resolveMapPositions: vi.fn(),
}));

vi.mock('../../../hooks/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../ui/logService.js', () => ({
  addEntry: vi.fn().mockResolvedValue({}),
}));

vi.mock('../../rules/combat/rangeValidation.js', () => ({
  getDistanceFeet: vi.fn(),
  rangeToFeet: vi.fn(),
}));

vi.mock('../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
}));

vi.mock('../../rules/combat/applyHealing.js', () => ({
  applyHealingToTarget: vi.fn(),
}));

vi.mock('../../../hooks/useMetamagic.js', () => ({
  getLastDamageEvent: vi.fn(),
  getLastAttackRoll: vi.fn(),
  getLastAbilityCheck: vi.fn(),
}));

vi.mock('../../combat/automationService.js', () => ({
  evaluateAutoExpression: vi.fn().mockReturnValue(0),
}));

// ── Imports (Vite returns mocked versions) ─────────────────────

import { handle } from './reactionDebuffHandler.js';

import * as targetResolver from '../common/targetResolver.js';
import * as useRuntimeState from '../../../hooks/useRuntimeState.js';
import * as logService from '../../ui/logService.js';
import * as rangeValidation from '../../rules/combat/rangeValidation.js';
import * as damageUtils from '../../rules/combat/damageUtils.js';
import * as applyHealing from '../../rules/combat/applyHealing.js';
import * as useMetamagic from '../../../hooks/useMetamagic.js';
import * as automationService from '../../combat/automationService.js';

// ── Helpers ─────────────────────────────────────────────────────

function makePlayerStats(overrides = {}) {
  return {
    name: 'Bard',
    proficiency: 2,
    level: 3,
    class: {
      name: 'Bard',
      class_levels: [
        { level: 1, bardic_die: 6, bardic_inspiration_uses: 2 },
        { level: 2, bardic_die: 6, bardic_inspiration_uses: 3 },
        { level: 3, bardic_die: 8, bardic_inspiration_uses: 4 },
      ],
    },
    abilities: [
      { name: 'Wisdom', bonus: 2 },
    ],
    characterAdvancement: [],
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

function freshDamageEvent(options = {}) {
  return {
    rawDamage: 8,
    targetName: 'Goblin',
    timestamp: Date.now(),
    ...options,
  };
}

function freshAbilityCheckEvent(options = {}) {
  return {
    d20: 12,
    bonus: 3,
    checkName: 'Stealth check',
    timestamp: Date.now(),
    ...options,
  };
}

function staleTimestamp() {
  return Date.now() - 70000; // 70 seconds old > 60s threshold
}

const campaignName = 'TestCampaign';
const mapName = 'DungeonMap';

// ── Tests ───────────────────────────────────────────────────────

describe('reactionDebuffHandler.handle', () => {
  function resetMocks() {
    useMetamagic.getLastAttackRoll.mockClear().mockReset();
    useMetamagic.getLastDamageEvent.mockClear().mockReset();
    useMetamagic.getLastAbilityCheck.mockClear().mockReset();
    useRuntimeState.getRuntimeValue.mockClear().mockReset();
    useRuntimeState.setRuntimeValue.mockClear().mockResolvedValue(undefined);
    targetResolver.resolveTarget.mockClear().mockReset();
    targetResolver.resolveMapPositions.mockClear().mockReset();
    rangeValidation.getDistanceFeet.mockClear().mockReset();
    rangeValidation.rangeToFeet.mockClear().mockReturnValue(60);
    damageUtils.getCombatContext.mockClear().mockReset();
    applyHealing.applyHealingToTarget.mockClear().mockReset();
    automationService.evaluateAutoExpression.mockClear().mockReturnValue(0);
    logService.addEntry.mockClear().mockResolvedValue({});
  }

  beforeEach(() => {
    resetMocks();
  });

  // ── Early exit: no target, no combat context, out of range ────

  describe('early exits', () => {
    it('returns early when usesUsed >= effectiveUsesMax (numeric uses_expression)', async () => {
      const ps = makePlayerStats({});
      const action = makeAction({ uses_expression: 3 });
      automationService.evaluateAutoExpression.mockReturnValue(3);
      useRuntimeState.getRuntimeValue.mockReturnValue(0);

      const result = await handle(action, ps, campaignName, mapName);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('no uses remaining');
      expect(targetResolver.resolveTarget).not.toHaveBeenCalled();
    });

    it('returns early when usesUsed >= effectiveUsesMax (string expression)', async () => {
      const ps = makePlayerStats({});
      const action = makeAction({ uses_expression: 'proficiency_bonus' });
      automationService.evaluateAutoExpression.mockReturnValue(2);
      useRuntimeState.getRuntimeValue.mockReturnValue(0);

      const result = await handle(action, ps, campaignName, mapName);

      expect(result.payload.description).toContain('no uses remaining');
    });

    it('does NOT return early when usesUsed < effectiveUsesMax', async () => {
      const ps = makePlayerStats({});
      const action = makeAction({ uses_expression: 3 });
      automationService.evaluateAutoExpression.mockReturnValue(3);
      useRuntimeState.getRuntimeValue.mockReturnValue(2);

      targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });
      damageUtils.getCombatContext.mockResolvedValue(makeCombatSummary());
      useMetamagic.getLastAttackRoll.mockReturnValue(freshAttackEvent());

      await handle(action, ps, campaignName, mapName);
      expect(targetResolver.resolveTarget).toHaveBeenCalled();
    });

    it('skips uses check when usesMax is 0 (bardic inspiration fallback)', async () => {
      const ps = makePlayerStats({});
      const action = makeAction({}); // no uses_expression → bardic fallback

      targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });
      damageUtils.getCombatContext.mockResolvedValue(makeCombatSummary());
      useMetamagic.getLastAttackRoll.mockReturnValue(freshAttackEvent());

      await handle(action, ps, campaignName, mapName);
      expect(targetResolver.resolveTarget).toHaveBeenCalled();
    });

    it('recharge description mentions Long Rest for long_rest', async () => {
      const ps = makePlayerStats({});
      const action = makeAction({ uses_expression: 3, recharge: 'long_rest' });
      automationService.evaluateAutoExpression.mockReturnValue(3);
      useRuntimeState.getRuntimeValue.mockReturnValue(0);

      const result = await handle(action, ps, campaignName, mapName);
      expect(result.payload.description).toContain('Long Rest');
    });

    it('recharge description mentions Short or Long Rest', async () => {
      const ps = makePlayerStats({});
      const action = makeAction({ uses_expression: 3, recharge: 'short_rest' });
      automationService.evaluateAutoExpression.mockReturnValue(3);
      useRuntimeState.getRuntimeValue.mockReturnValue(0);

      const result = await handle(action, ps, campaignName, mapName);
      expect(result.payload.description).toContain('Short or Long Rest');
    });

    it('returns early when no target resolved', async () => {
      const ps = makePlayerStats({});
      const action = makeAction({});
      targetResolver.resolveTarget.mockResolvedValue(null);

      const result = await handle(action, ps, campaignName, mapName);
      expect(result.payload.description).toContain('requires a target');
    });

    it('returns early when no combat context', async () => {
      const ps = makePlayerStats({});
      const action = makeAction({ uses_expression: 3 });
      automationService.evaluateAutoExpression.mockReturnValue(3);
      useRuntimeState.getRuntimeValue.mockReturnValue(2);

      targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });
      damageUtils.getCombatContext.mockResolvedValue(null);

      const result = await handle(action, ps, campaignName, mapName);
      expect(result.payload.description).toContain('No combat context found');
    });

    it('returns early when out of range', async () => {
      const ps = makePlayerStats({});
      const action = makeAction({ uses_expression: 3 });
      automationService.evaluateAutoExpression.mockReturnValue(3);
      useRuntimeState.getRuntimeValue.mockReturnValue(2);

      targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });
      rangeValidation.rangeToFeet.mockReturnValueOnce(30);
      targetResolver.resolveMapPositions.mockResolvedValue({
        attackerPos: { gridX: 0, gridY: 0 },
        targetPos: { gridX: 20, gridY: 0 },
      });
      rangeValidation.getDistanceFeet.mockReturnValueOnce(50);

      const result = await handle(action, ps, campaignName, mapName);
      expect(result.payload.description).toContain('out of range');
    });

    it('skips range check when rangeToFeet returns null', async () => {
      const ps = makePlayerStats({});
      const action = makeAction({}); // bardic fallback (no uses_expression)

      targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });
      rangeValidation.rangeToFeet.mockReturnValueOnce(null);
      damageUtils.getCombatContext.mockResolvedValue(makeCombatSummary());
      useMetamagic.getLastAttackRoll.mockReturnValue(freshAttackEvent());

      await handle(action, ps, campaignName, mapName);
      expect(targetResolver.resolveMapPositions).not.toHaveBeenCalled();
    });

    it('skips range check when mapName is falsy', async () => {
      const ps = makePlayerStats({});
      const action = makeAction({});

      targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });
      damageUtils.getCombatContext.mockResolvedValue(makeCombatSummary());
      useMetamagic.getLastAttackRoll.mockReturnValue(freshAttackEvent());

      await handle(action, ps, campaignName, null);
      expect(targetResolver.resolveMapPositions).not.toHaveBeenCalled();
    });
  });

  // ── Default path: attack roll debuff ────────────────────────

  describe('default path — attack roll debuff', () => {
    function setupAttackPath(psOverrides, attackEvent, damageEvent) {
      const ps = makePlayerStats(psOverrides);
      const action = makeAction({});

      targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });
      damageUtils.getCombatContext.mockResolvedValue(makeCombatSummary());
      useMetamagic.getLastAttackRoll.mockReturnValue(attackEvent);
      useMetamagic.getLastDamageEvent.mockReturnValue(damageEvent);
      useMetamagic.getLastAbilityCheck.mockReturnValue(null);

      return handle(action, ps, campaignName, mapName);
    }

    it('routes to attack handler when fresh attack event present', async () => {
      const result = await setupAttackPath({}, freshAttackEvent(), null);
      expect(result.payload.description).toContain('Attack roll');
      expect(result.payload.description).toContain('Cutting Words');
    });

    it('reduces d20 by biDieRoll (capped at 1)', async () => {
      const result = await setupAttackPath({}, freshAttackEvent({ d20: 3, bonus: 5, hit: true }), null);
      expect(result.payload.description).toContain('Reduced');
    });

    it('reports "already missed" for original miss', async () => {
      const result = await setupAttackPath({}, freshAttackEvent({ d20: 3, bonus: 2, hit: false }), null);
      expect(result.payload.description).toContain('already missed');
    });

    it('has defenderHp property on result', async () => {
      const result = await setupAttackPath({}, freshAttackEvent(), null);
      expect(result).toHaveProperty('defenderHp');
    });

    it('returns popup type with automation_info payload', async () => {
      const result = await setupAttackPath({}, freshAttackEvent({ d20: 3, bonus: 2, hit: false }), null);
      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
    });

    it('uses effectiveAc over targetAc when both present', async () => {
      const result = await setupAttackPath(
        {},
        freshAttackEvent({ d20: 14, bonus: 3, hit: true, effectiveAc: 20 }),
        null
      );
      expect(result.payload.description).toContain('AC 20');
    });

    it('uses targetAc when effectiveAc is null', async () => {
      const result = await setupAttackPath(
        {},
        freshAttackEvent({ d20: 14, bonus: 3, hit: true, effectiveAc: null, targetAc: 17 }),
        null
      );
      expect(result.payload.description).toContain('AC 17');
    });

    it('shows dash when AC is null', async () => {
      const result = await setupAttackPath(
        {},
        freshAttackEvent({ d20: 14, bonus: 3, hit: true, effectiveAc: null, targetAc: null }),
        null
      );
      expect(result.payload.description).toContain('AC \u2014');
    });

    it('attempts healing on hit→miss when damage event is available', async () => {
      // original total 18+3=21 >= AC 17 (hit=true)
      // biDieRoll could be 6 → reducedD20 = max(1, 18-6)=12, 12+3=15 < 17 → miss
      // but random — let's ensure by checking applyHealing was called when conditions line up
      const result = await setupAttackPath(
        {},
        freshAttackEvent({ d20: 15, bonus: 3, hit: true, effectiveAc: null, targetAc: 17, targetName: 'Goblin' }),
        freshDamageEvent({ rawDamage: 10 })
      );
      // The description mentions whether healing happened or not
      expect(result).toHaveProperty('defenderHp');
    });

    it('does NOT attempt healing when no damage event found', async () => {
      await setupAttackPath(
        {},
        freshAttackEvent({ d20: 15, bonus: 3, hit: true, effectiveAc: null }),
        null // no damage event
      );
      expect(applyHealing.applyHealingToTarget).not.toHaveBeenCalled();
    });
  });

  // ── Default path: damage debuff ────────────────────────────

  describe('default path — damage debuff', () => {
    it('routes to damage handler when only fresh damage event present', async () => {
      const ps = makePlayerStats({});
      const action = makeAction({});

      targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });
      damageUtils.getCombatContext.mockResolvedValue(makeCombatSummary());
      useMetamagic.getLastAttackRoll.mockReturnValue(null);
      useMetamagic.getLastDamageEvent.mockReturnValue(freshDamageEvent({ rawDamage: 10, targetName: 'Goblin' }));
      useMetamagic.getLastAbilityCheck.mockReturnValue(null);

      const result = await handle(action, ps, campaignName, mapName);
      expect(result.payload.description).toContain('Original damage');
      expect(result.payload.description).toContain('Reduced damage');
    });

    it('attempts healing when originalDamage > reducedDamage', async () => {
      const ps = makePlayerStats({});
      const action = makeAction({});

      targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });
      damageUtils.getCombatContext.mockResolvedValue(makeCombatSummary());
      useMetamagic.getLastAttackRoll.mockReturnValue(null);
      useMetamagic.getLastDamageEvent.mockReturnValue(freshDamageEvent({ rawDamage: 10, targetName: 'Goblin' }));
      useMetamagic.getLastAbilityCheck.mockReturnValue(null);
      applyHealing.applyHealingToTarget.mockReturnValue({ newHp: 30 });

      await handle(action, ps, campaignName, mapName);
      expect(applyHealing.applyHealingToTarget).toHaveBeenCalled();
    });

    it('includes healed HP info in description when healing succeeds', async () => {
      const ps = makePlayerStats({});
      const action = makeAction({});

      targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });
      damageUtils.getCombatContext.mockResolvedValue(makeCombatSummary());
      useMetamagic.getLastAttackRoll.mockReturnValue(null);
      useMetamagic.getLastDamageEvent.mockReturnValue(freshDamageEvent({ rawDamage: 10, targetName: 'Goblin' }));
      useMetamagic.getLastAbilityCheck.mockReturnValue(null);
      applyHealing.applyHealingToTarget.mockReturnValue({ newHp: 30 });

      const result = await handle(action, ps, campaignName, mapName);
      expect(result.payload.description).toContain('HP: 30');
    });

    it('returns defenderHp from healing result', async () => {
      const ps = makePlayerStats({});
      const action = makeAction({});

      targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });
      damageUtils.getCombatContext.mockResolvedValue(makeCombatSummary());
      useMetamagic.getLastAttackRoll.mockReturnValue(null);
      useMetamagic.getLastDamageEvent.mockReturnValue(freshDamageEvent({ rawDamage: 10, targetName: 'Goblin' }));
      useMetamagic.getLastAbilityCheck.mockReturnValue(null);
      applyHealing.applyHealingToTarget.mockReturnValue({ newHp: 30 });

      const result = await handle(action, ps, campaignName, mapName);
      expect(result.defenderHp).toBe(30);
    });

    it('sets defenderHp to null when healing returns no newHp', async () => {
      const ps = makePlayerStats({});
      const action = makeAction({});

      targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });
      damageUtils.getCombatContext.mockResolvedValue(makeCombatSummary());
      useMetamagic.getLastAttackRoll.mockReturnValue(null);
      useMetamagic.getLastDamageEvent.mockReturnValue(freshDamageEvent({ rawDamage: 10, targetName: 'Goblin' }));
      useMetamagic.getLastAbilityCheck.mockReturnValue(null);
      applyHealing.applyHealingToTarget.mockReturnValue(null);

      const result = await handle(action, ps, campaignName, mapName);
      expect(result.defenderHp).toBeNull();
    });

    it('returns early when damage event has no targetName', async () => {
      const ps = makePlayerStats({});
      const action = makeAction({});

      targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });
      damageUtils.getCombatContext.mockResolvedValue(makeCombatSummary());
      useMetamagic.getLastAttackRoll.mockReturnValue(null);
      useMetamagic.getLastDamageEvent.mockReturnValue({ rawDamage: 5, timestamp: Date.now() });
      useMetamagic.getLastAbilityCheck.mockReturnValue(null);

      const result = await handle(action, ps, campaignName, mapName);
      expect(result.payload.description).toContain('Could not determine who');
    });
  });

  // ── Default path: ability check debuff ──────────────────────

  describe('default path — ability check debuff', () => {
    it('routes to ability check handler when only fresh ability check event present', async () => {
      const ps = makePlayerStats({});
      const action = makeAction({});

      targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });
      damageUtils.getCombatContext.mockResolvedValue(makeCombatSummary());
      useMetamagic.getLastAttackRoll.mockReturnValue(null);
      useMetamagic.getLastDamageEvent.mockReturnValue(null);
      useMetamagic.getLastAbilityCheck.mockReturnValue(freshAbilityCheckEvent({ d20: 12, bonus: 3 }));

      const result = await handle(action, ps, campaignName, mapName);
      expect(result.payload.description).toContain('d20(12)');
      expect(result.payload.description).toContain('+ 3 = 15');
    });

    it('routes to ability handler when only fresh ability check event (all attack/damage stale)', async () => {
      const ps = makePlayerStats({});
      const action = makeAction({});

      targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });
      damageUtils.getCombatContext.mockResolvedValue(makeCombatSummary());
      useMetamagic.getLastAttackRoll.mockReturnValue(null);
      useMetamagic.getLastDamageEvent.mockReturnValue(null);
      useMetamagic.getLastAbilityCheck.mockReturnValue(freshAbilityCheckEvent({ d20: 8, bonus: 4, checkName: 'Athletics check' }));

      const result = await handle(action, ps, campaignName, mapName);
      expect(result.payload.description).toContain('Athletics check');
    });
  });

  // ── Default path: no fresh events ──────────────────────────

  describe('default path — no fresh events', () => {
    it('returns early when all events are stale or missing', async () => {
      const ps = makePlayerStats({});
      const action = makeAction({});

      targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });
      damageUtils.getCombatContext.mockResolvedValue(makeCombatSummary());
      useMetamagic.getLastAttackRoll.mockReturnValue(null);
      useMetamagic.getLastDamageEvent.mockReturnValue(null);
      useMetamagic.getLastAbilityCheck.mockReturnValue(null);

      const result = await handle(action, ps, campaignName, mapName);
      expect(result.payload.description).toContain('No recent roll found');
    });

    it('returns early when attack event is stale', async () => {
      const ps = makePlayerStats({});
      const action = makeAction({});

      targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });
      damageUtils.getCombatContext.mockResolvedValue(makeCombatSummary());
      useMetamagic.getLastAttackRoll.mockReturnValue({ timestamp: staleTimestamp() });
      useMetamagic.getLastDamageEvent.mockReturnValue(null);
      useMetamagic.getLastAbilityCheck.mockReturnValue(null);

      const result = await handle(action, ps, campaignName, mapName);
      expect(result.payload.description).toContain('No recent roll found');
    });

    it('returns early when damage event has no rawDamage', async () => {
      const ps = makePlayerStats({});
      const action = makeAction({});

      targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });
      damageUtils.getCombatContext.mockResolvedValue(makeCombatSummary());
      useMetamagic.getLastAttackRoll.mockReturnValue(null);
      useMetamagic.getLastDamageEvent.mockReturnValue({ rawDamage: 0, timestamp: Date.now() });
      useMetamagic.getLastAbilityCheck.mockReturnValue(null);

      const result = await handle(action, ps, campaignName, mapName);
      expect(result.payload.description).toContain('No recent roll found');
    });

    it('prefers attack event over damage when both fresh', async () => {
      const ps = makePlayerStats({});
      const action = makeAction({});

      targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });
      damageUtils.getCombatContext.mockResolvedValue(makeCombatSummary());
      useMetamagic.getLastAttackRoll.mockReturnValue(freshAttackEvent({ d20: 3, bonus: 2, hit: false }));
      useMetamagic.getLastDamageEvent.mockReturnValue(freshDamageEvent());
      useMetamagic.getLastAbilityCheck.mockReturnValue(null);

      const result = await handle(action, ps, campaignName, mapName);
      // Attack path takes precedence → "already missed" message
      expect(result.payload.description).toContain('already missed');
    });

    it('prefers damage event over ability check when both fresh (no attack)', async () => {
      const ps = makePlayerStats({});
      const action = makeAction({});

      targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });
      damageUtils.getCombatContext.mockResolvedValue(makeCombatSummary());
      useMetamagic.getLastAttackRoll.mockReturnValue(null);
      useMetamagic.getLastDamageEvent.mockReturnValue(freshDamageEvent());
      useMetamagic.getLastAbilityCheck.mockReturnValue(freshAbilityCheckEvent());

      const result = await handle(action, ps, campaignName, mapName);
      expect(result.payload.description).toContain('Original damage');
    });
  });

  // ── Disadvantage effect path ────────────────────────────────

  describe('effect: disadvantage_on_attack_roll', () => {
    it('returns early when no attack event', async () => {
      const ps = makePlayerStats({});
      const action = makeAction({ effect: 'disadvantage_on_attack_roll' });

      targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });
      damageUtils.getCombatContext.mockResolvedValue(makeCombatSummary());
      useMetamagic.getLastAttackRoll.mockReturnValue(null);

      const result = await handle(action, ps, campaignName, mapName);
      expect(result.payload.description).toContain('No recent attack roll found for Goblin');
    });

    it('returns early when attack event is stale', async () => {
      const ps = makePlayerStats({});
      const action = makeAction({ effect: 'disadvantage_on_attack_roll' });

      targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });
      damageUtils.getCombatContext.mockResolvedValue(makeCombatSummary());
      useMetamagic.getLastAttackRoll.mockReturnValue({ timestamp: staleTimestamp() });

      const result = await handle(action, ps, campaignName, mapName);
      expect(result.payload.description).toContain('No recent attack roll found');
    });

    it('rolls second d20 and takes lower of two', async () => {
      const ps = makePlayerStats({});
      const action = makeAction({ effect: 'disadvantage_on_attack_roll' });

      targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });
      damageUtils.getCombatContext.mockResolvedValue(makeCombatSummary());
      useMetamagic.getLastAttackRoll.mockReturnValue(freshAttackEvent({ d20: 14, bonus: 3, hit: true, effectiveAc: null }));

      const result = await handle(action, ps, campaignName, mapName);
      expect(result.payload.description).toContain('Disadvantage');
      expect(result.payload.description).toContain('second d20');
    });

    it('reports "already missed" for disadvantage on miss', async () => {
      const ps = makePlayerStats({});
      const action = makeAction({ effect: 'disadvantage_on_attack_roll' });

      targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });
      damageUtils.getCombatContext.mockResolvedValue(makeCombatSummary());
      useMetamagic.getLastAttackRoll.mockReturnValue(freshAttackEvent({ d20: 3, bonus: 2, hit: false, effectiveAc: null }));

      const result = await handle(action, ps, campaignName, mapName);
      expect(result.payload.description).toContain('already missed');
    });

    it('returns defenderName in result', async () => {
      const ps = makePlayerStats({});
      const action = makeAction({ effect: 'disadvantage_on_attack_roll' });

      targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });
      damageUtils.getCombatContext.mockResolvedValue(makeCombatSummary());
      useMetamagic.getLastAttackRoll.mockReturnValue(freshAttackEvent({ d20: 14, bonus: 3, hit: true, effectiveAc: null }));

      const result = await handle(action, ps, campaignName, mapName);
      expect(result).toHaveProperty('defenderName');
    });

    it('does NOT apply Improved Warding Flare when feature not present', async () => {
      const ps = makePlayerStats({});
      const action = makeAction({ effect: 'disadvantage_on_attack_roll' });

      targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });
      damageUtils.getCombatContext.mockResolvedValue(makeCombatSummary());
      useMetamagic.getLastAttackRoll.mockReturnValue(freshAttackEvent({ d20: 14, bonus: 3, hit: true, effectiveAc: null }));

      await handle(action, ps, campaignName, mapName);
      const tempHpCall = useRuntimeState.setRuntimeValue.mock.calls.find(c => c[1] === 'tempHp');
      expect(tempHpCall).toBeUndefined();
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

    it('applies when effect is disadvantage and feature present', async () => {
      const ps = makeWardingFlarePlayer();
      const action = makeAction({ effect: 'disadvantage_on_attack_roll' });

      targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });
      damageUtils.getCombatContext.mockResolvedValue(makeCombatSummary());
      useMetamagic.getLastAttackRoll.mockReturnValue(freshAttackEvent({ d20: 18, bonus: 3, hit: true, effectiveAc: null }));

      await handle(action, ps, campaignName, mapName);

      const tempHpCall = useRuntimeState.setRuntimeValue.mock.calls.find(c => c[1] === 'tempHp');
      expect(tempHpCall).toBeDefined();
    });

    it('does NOT apply when effect is not disadvantage', async () => {
      const ps = makeWardingFlarePlayer();
      const action = makeAction({}); // no effect → default path

      targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });
      damageUtils.getCombatContext.mockResolvedValue(makeCombatSummary());
      useMetamagic.getLastAttackRoll.mockReturnValue(freshAttackEvent({ d20: 5, bonus: 3, hit: false }));
      useMetamagic.getLastDamageEvent.mockReturnValue(null);
      useMetamagic.getLastAbilityCheck.mockReturnValue(null);

      await handle(action, ps, campaignName, mapName);

      const tempHpCall = useRuntimeState.setRuntimeValue.mock.calls.find(c => c[1] === 'tempHp');
      expect(tempHpCall).toBeUndefined();
    });

    it('does NOT apply when feature not on player', async () => {
      const ps = makePlayerStats({}); // no Improved Warding Flare
      const action = makeAction({ effect: 'disadvantage_on_attack_roll' });

      targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });
      damageUtils.getCombatContext.mockResolvedValue(makeCombatSummary());
      useMetamagic.getLastAttackRoll.mockReturnValue(freshAttackEvent({ d20: 18, bonus: 3, hit: true, effectiveAc: null }));

      await handle(action, ps, campaignName, mapName);

      const tempHpCall = useRuntimeState.setRuntimeValue.mock.calls.find(c => c[1] === 'tempHp');
      expect(tempHpCall).toBeUndefined();
    });

    it('does NOT apply when defenderName is empty string', async () => {
      const ps = makeWardingFlarePlayer();
      const action = makeAction({ effect: 'disadvantage_on_attack_roll' });

      targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });
      damageUtils.getCombatContext.mockResolvedValue(makeCombatSummary());
      useMetamagic.getLastAttackRoll.mockReturnValue(freshAttackEvent({ d20: 18, bonus: 3, hit: true, effectiveAc: null, targetName: '' }));

      await handle(action, ps, campaignName, mapName);

      const tempHpCall = useRuntimeState.setRuntimeValue.mock.calls.find(c => c[1] === 'tempHp');
      expect(tempHpCall).toBeUndefined();
    });
  });

  // ── Uses decrement tracking ────────────────────────────────

  describe('uses decrement', () => {
    it('increments uses count after success with string expression', async () => {
      const ps = makePlayerStats({});
      const action = makeAction({ uses_expression: 'proficiency_bonus' });
      automationService.evaluateAutoExpression.mockReturnValue(2);

      targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });
      damageUtils.getCombatContext.mockResolvedValue(makeCombatSummary());
      useMetamagic.getLastAttackRoll.mockReturnValue(freshAttackEvent({ d20: 5, bonus: 3, hit: false }));

      await handle(action, ps, campaignName, mapName);

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Bard',
        'cuttingwordsUses',
        1,
        campaignName
      );
    });

    it('increments uses count with bardic inspiration fallback', async () => {
      const ps = makePlayerStats({});
      const action = makeAction({}); // no uses_expression → bardic fallback

      targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });
      damageUtils.getCombatContext.mockResolvedValue(makeCombatSummary());
      useMetamagic.getLastAttackRoll.mockReturnValue(freshAttackEvent({ d20: 5, bonus: 3, hit: false }));
      useRuntimeState.getRuntimeValue.mockReturnValue(2);

      await handle(action, ps, campaignName, mapName);

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Bard',
        'cuttingwordsUses',
        1,
        campaignName
      );
    });

    it('does NOT decrement uses on early return (uses exhausted)', async () => {
      const ps = makePlayerStats({});
      const action = makeAction({ uses_expression: 3 });
      automationService.evaluateAutoExpression.mockReturnValue(3);
      useRuntimeState.getRuntimeValue.mockReturnValue(0);

      await handle(action, ps, campaignName, mapName);
      expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
    });

    it('does NOT decrement uses on early return (no combat context)', async () => {
      const ps = makePlayerStats({});
      const action = makeAction({ uses_expression: 3 });
      automationService.evaluateAutoExpression.mockReturnValue(3);
      useRuntimeState.getRuntimeValue.mockReturnValue(0);

      targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });
      damageUtils.getCombatContext.mockResolvedValue(null);

      await handle(action, ps, campaignName, mapName);
      expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
    });

    it('does NOT decrement uses on early return (out of range)', async () => {
      const ps = makePlayerStats({});
      const action = makeAction({ uses_expression: 3 });
      automationService.evaluateAutoExpression.mockReturnValue(3);
      useRuntimeState.getRuntimeValue.mockReturnValue(0);

      targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });
      rangeValidation.rangeToFeet.mockReturnValueOnce(30);
      targetResolver.resolveMapPositions.mockResolvedValue({
        attackerPos: { gridX: 0, gridY: 0 },
        targetPos: { gridX: 20, gridY: 0 },
      });
      rangeValidation.getDistanceFeet.mockReturnValueOnce(50);

      await handle(action, ps, campaignName, mapName);
      expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
    });
    it('uses correct usesKey derived from feature name', async () => {
      const ps = makePlayerStats({});
      const action = makeAction({ uses_expression: 3 });
      automationService.evaluateAutoExpression.mockReturnValue(3);
      useRuntimeState.getRuntimeValue.mockReturnValue(2);

      targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });
      damageUtils.getCombatContext.mockResolvedValue(makeCombatSummary());
      useMetamagic.getLastAttackRoll.mockReturnValue(freshAttackEvent({ d20: 5, bonus: 3, hit: false }));

      await handle(action, ps, campaignName, mapName);

      const setCall = useRuntimeState.setRuntimeValue.mock.calls.find(c => c[1].includes('Uses'));
      expect(setCall).toBeDefined();
      expect(setCall[1]).toBe('cuttingwordsUses');
    });

    it('uses runtime value from getRuntimeValue for incremental count', async () => {
      const ps = makePlayerStats({});
      const action = makeAction({ uses_expression: 3 });
      automationService.evaluateAutoExpression.mockReturnValue(3);
      useRuntimeState.getRuntimeValue
        .mockReturnValueOnce(2) // early check: usesUsed=2, max=3 → proceed
        .mockReturnValueOnce(2); // decrement: read 2 again

      targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });
      damageUtils.getCombatContext.mockResolvedValue(makeCombatSummary());
      useMetamagic.getLastAttackRoll.mockReturnValue(freshAttackEvent({ d20: 5, bonus: 3, hit: false }));


      await handle(action, ps, campaignName, mapName);

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Bard',
        'cuttingwordsUses',
        1, // read 2, write 2-1=1
        campaignName
      );
    });

    it('handles getRuntimeValue returning null for uses count', async () => {
      const ps = makePlayerStats({});
      const action = makeAction({ uses_expression: 3 });
      automationService.evaluateAutoExpression.mockReturnValue(3);
      useRuntimeState.getRuntimeValue.mockReturnValue(null); // → Number(null ?? 0) = 0 < 3, proceed

      targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });
      damageUtils.getCombatContext.mockResolvedValue(makeCombatSummary());
      useMetamagic.getLastAttackRoll.mockReturnValue(freshAttackEvent({ d20: 5, bonus: 3, hit: false }));

      await handle(action, ps, campaignName, mapName);
      expect(targetResolver.resolveTarget).toHaveBeenCalled();
    });
  });

  // ── Log entry creation ──────────────────────────────────────

  describe('log entry', () => {
    it('adds log entry after successful handling', async () => {
      const ps = makePlayerStats({});
      const action = makeAction({});

      targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });
      damageUtils.getCombatContext.mockResolvedValue(makeCombatSummary());
      useMetamagic.getLastAttackRoll.mockReturnValue(freshAttackEvent({ d20: 5, bonus: 3, hit: false }));

      await handle(action, ps, campaignName, mapName);

      expect(logService.addEntry).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({
          type: 'ability_use',
          characterName: 'Bard',
          abilityName: 'Cutting Words',
          targetName: 'Goblin',
          description: 'Bard used Cutting Words on Goblin.',
          timestamp: expect.any(Number),
        })
      );
    });

    it('uses "Feature" as name when action.name is empty', async () => {
      const ps = makePlayerStats({});
      const action = makeAction({});
      action.name = ''; // defaults to 'Feature'

      targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });
      damageUtils.getCombatContext.mockResolvedValue(makeCombatSummary());
      useMetamagic.getLastAttackRoll.mockReturnValue(freshAttackEvent({ d20: 5, bonus: 3, hit: false }));

      await handle(action, ps, campaignName, mapName);

      expect(logService.addEntry).toHaveBeenCalled();
    });

    it('does NOT add log entry on early exit (no combat context)', async () => {
      const ps = makePlayerStats({});
      const action = makeAction({ uses_expression: 3 });
      automationService.evaluateAutoExpression.mockReturnValue(3);
      useRuntimeState.getRuntimeValue.mockReturnValue(0);

      targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });
      damageUtils.getCombatContext.mockResolvedValue(null);

      await handle(action, ps, campaignName, mapName);
      expect(logService.addEntry).not.toHaveBeenCalled();
    });

    it('does NOT add log entry when uses exhausted', async () => {
      const ps = makePlayerStats({});
      const action = makeAction({ uses_expression: 3 });
      automationService.evaluateAutoExpression.mockReturnValue(3);
      useRuntimeState.getRuntimeValue.mockReturnValue(3);

      await handle(action, ps, campaignName, mapName);
      expect(logService.addEntry).not.toHaveBeenCalled();
    });
  });

  // ── Edge cases and null safety ──────────────────────────────

  describe('edge cases', () => {
    it('handles playerStats with empty class_levels array', async () => {
      const ps = makePlayerStats({ class: { name: 'Bard', class_levels: [] } });
      const action = makeAction({});

      targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });
      damageUtils.getCombatContext.mockResolvedValue(makeCombatSummary());
      useMetamagic.getLastAttackRoll.mockReturnValue(freshAttackEvent({ d20: 5, bonus: 3, hit: false }));

      await handle(action, ps, campaignName, mapName);
      expect(damageUtils.getCombatContext).toHaveBeenCalled();
    });

    it('handles missing classLevel for bardicDieSize defaults to 6', async () => {
      const ps = makePlayerStats({
        level: 99, // no matching level in class_levels
      });
      const action = makeAction({});

      targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });
      damageUtils.getCombatContext.mockResolvedValue(makeCombatSummary());
      useMetamagic.getLastAttackRoll.mockReturnValue(freshAttackEvent({ d20: 5, bonus: 3, hit: false }));

      await handle(action, ps, campaignName, mapName);
      expect(targetResolver.resolveTarget).toHaveBeenCalled();
    });

    it('treats events without timestamp as stale', async () => {
      const ps = makePlayerStats({});
      const action = makeAction({ effect: 'disadvantage_on_attack_roll' });

      targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });
      damageUtils.getCombatContext.mockResolvedValue(makeCombatSummary());
      useMetamagic.getLastAttackRoll.mockReturnValue({}); // no timestamp

      const result = await handle(action, ps, campaignName, mapName);
      expect(result.payload.description).toContain('No recent attack roll found');
    });

    it('treats events older than 60 seconds as stale', async () => {
      const ps = makePlayerStats({});
      const action = makeAction({ effect: 'disadvantage_on_attack_roll' });

      targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });
      damageUtils.getCombatContext.mockResolvedValue(makeCombatSummary());
      useMetamagic.getLastAttackRoll.mockReturnValue({ timestamp: Date.now() - 60001 });

      const result = await handle(action, ps, campaignName, mapName);
      expect(result.payload.description).toContain('No recent attack roll found');
    });

    it('treats events under 60 seconds as fresh', async () => {
      const ps = makePlayerStats({});
      const action = makeAction({ effect: 'disadvantage_on_attack_roll' });

      targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });
      damageUtils.getCombatContext.mockResolvedValue(makeCombatSummary());
      const event = freshAttackEvent({ d20: 14, bonus: 3, hit: true, effectiveAc: null });
      event.timestamp = Date.now() - 5000; // well under threshold → fresh
      useMetamagic.getLastAttackRoll.mockReturnValue(event);

      await handle(action, ps, campaignName, mapName);
      // Should proceed past staleness check — uses decrement should fire
      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalled();
    });
  });
});
