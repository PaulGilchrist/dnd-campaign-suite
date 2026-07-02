// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks BEFORE imports ────────────────────────────────────────

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
import * as damageRollback from '../../common/damageRollback.js';

// ── Helpers ─────────────────────────────────────────────────────

function makePlayerStats(overrides = {}) {
  return {
    name: 'Paladin',
    proficiency: 2,
    level: 5,
    class: {
      name: 'Paladin',
      class_levels: [
        { level: 1, bardic_die: 6, bardic_inspiration_uses: 0 },
        { level: 2, bardic_die: 6, bardic_inspiration_uses: 0 },
        { level: 3, bardic_die: 6, bardic_inspiration_uses: 0 },
        { level: 4, bardic_die: 6, bardic_inspiration_uses: 0 },
        { level: 5, bardic_die: 6, bardic_inspiration_uses: 0 },
      ],
    },
    abilities: [
      { name: 'Wisdom', bonus: 2 },
    ],
    characterAdvancement: [],
    specialActions: [],
    ...overrides,
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

// ── Tests ───────────────────────────────────────────────────────

describe('reactionDebuffHandler — disadvantage_on_attacks_vs_ally', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rangeValidation.rangeToFeet.mockReset();
    rangeValidation.getDistanceFeet.mockReset();
  });

  describe('effect: disadvantage_on_attacks_vs_ally', () => {
    function setupPath(options = {}) {
      const ps = makePlayerStats(options);
      const action = makeAction();

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

      return handle(action, ps, campaignName, mapName);
    }

    function makeAction() {
      return {
        name: 'Blessed Defender',
        automation: {
          type: 'reaction_debuff',
          range: '30_ft',
          effect: 'disadvantage_on_attacks_vs_ally',
          uses_expression: null,
          recharge: 'long_rest',
        },
      };
    }

    it('returns popup when no attack event found', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

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
      expect(result.payload.description).toContain('No recent attack found');
    });

    it('returns popup when no defenderName in attack event', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });
      damageUtils.getCombatContext.mockResolvedValue(makeCombatSummary());
      damageRollback.findLastAttack.mockResolvedValue({
        attackEvent: { d20: 15, bonus: 5, hit: true, timestamp: Date.now() },
        attackerName: 'Goblin',
        targetName: null,
        primaryDamage: 10,
        secondaryDamage: 0,
        totalDamage: 10,
        damageTypes: ['Piercing'],
      });

      const result = await handle(action, ps, campaignName, mapName);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('Could not determine who was attacked');
    });

    it('stores protection effect in targetEffects', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue([]);

      await setupPath();

      const targetEffectsCall = useRuntimeState.setRuntimeValue.mock.calls.find(
        (c) => c[1] === 'targetEffects'
      );
      expect(targetEffectsCall).toBeDefined();
      expect(targetEffectsCall[2]).toHaveLength(1);
      expect(targetEffectsCall[2][0].effect).toBe('protection');
      expect(targetEffectsCall[2][0].target).toBe('Goblin');
      expect(targetEffectsCall[2][0].source).toBe('Paladin');
      expect(targetEffectsCall[2][0].timestamp).toBeDefined();
    });

    it('uses default duration until_start_of_next_turn', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue([]);

      await setupPath();

      const targetEffectsCall = useRuntimeState.setRuntimeValue.mock.calls.find(
        (c) => c[1] === 'targetEffects'
      );
      expect(targetEffectsCall[2][0].duration).toBe('until_start_of_next_turn');
    });

    it('uses custom duration when specified in automation', async () => {
      const ps = makePlayerStats();
      const action = {
        name: 'Blessed Defender',
        automation: {
          type: 'reaction_debuff',
          range: '30_ft',
          effect: 'disadvantage_on_attacks_vs_ally',
          duration: '1_round',
          uses_expression: null,
          recharge: 'long_rest',
        },
      };

      targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });
      damageUtils.getCombatContext.mockResolvedValue(makeCombatSummary());
      useRuntimeState.getRuntimeValue.mockReturnValue([]);
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

      const targetEffectsCall = useRuntimeState.setRuntimeValue.mock.calls.find(
        (c) => c[1] === 'targetEffects'
      );
      expect(targetEffectsCall[2][0].duration).toBe('1_round');
    });

    it('replaces existing protection effect for same target', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue([
        { effect: 'protection', target: 'Goblin', source: 'Other', duration: 'until_start_of_next_turn', timestamp: Date.now() - 1000 },
      ]);

      await setupPath();

      const targetEffectsCall = useRuntimeState.setRuntimeValue.mock.calls.find(
        (c) => c[1] === 'targetEffects'
      );
      expect(targetEffectsCall[2]).toHaveLength(1);
      expect(targetEffectsCall[2][0].source).toBe('Paladin');
    });

    it('does not replace if different target has existing protection', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue([
        { effect: 'protection', target: 'Orc', source: 'Other', duration: 'until_start_of_next_turn', timestamp: Date.now() },
      ]);

      await setupPath();

      const targetEffectsCall = useRuntimeState.setRuntimeValue.mock.calls.find(
        (c) => c[1] === 'targetEffects'
      );
      expect(targetEffectsCall[2]).toHaveLength(2);
    });

    it('reports disadvantage in description', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue([]);

      const result = await setupPath();

      expect(result.payload.description).toContain('Disadvantage');
      expect(result.payload.description).toContain('second d20');
    });

    it('returns defenderName in result', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue([]);

      const result = await setupPath();

      expect(result).toHaveProperty('defenderName');
      expect(result.defenderName).toBe('Goblin');
    });

    it('returns healedAmount in result', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue([]);

      const result = await setupPath();

      expect(result).toHaveProperty('healedAmount');
    });
  });

  describe('effect: disadvantage_on_attacks_vs_ally — range checks', () => {
    function makeAction() {
      return {
        name: 'Blessed Defender',
        automation: {
          type: 'reaction_debuff',
          range: '30_ft',
          effect: 'disadvantage_on_attacks_vs_ally',
          uses_expression: null,
          recharge: 'long_rest',
        },
      };
    }

    it('returns popup when out of range', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });
      rangeValidation.rangeToFeet.mockReturnValue(30);
      targetResolver.resolveMapPositions.mockResolvedValue({
        attackerPos: { gridX: 0, gridY: 0 },
        targetPos: { gridX: 20, gridY: 0 },
      });
      rangeValidation.getDistanceFeet.mockReturnValue(50);
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

      const result = await handle(action, ps, campaignName, mapName);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('out of range');
    });

    it('skips range check when mapName is falsy', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

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

    it('skips range check when rangeToFeet returns null', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

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

    it('skips range check when only attackerPos is available', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

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
      targetResolver.resolveMapPositions.mockResolvedValue({
        attackerPos: { gridX: 0, gridY: 0 },
        targetPos: null,
      });

      // Should proceed (not return early) and store targetEffects
      await handle(action, ps, campaignName, mapName);

      const targetEffectsCall = useRuntimeState.setRuntimeValue.mock.calls.find(
        (c) => c[1] === 'targetEffects'
      );
      expect(targetEffectsCall).toBeDefined();
    });
  });

  describe('effect: disadvantage_on_attacks_vs_ally — log entry', () => {
    function makeAction() {
      return {
        name: 'Blessed Defender',
        automation: {
          type: 'reaction_debuff',
          range: '30_ft',
          effect: 'disadvantage_on_attacks_vs_ally',
          uses_expression: null,
          recharge: 'long_rest',
        },
      };
    }

    it('adds log entry with disadvantage description', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });
      damageUtils.getCombatContext.mockResolvedValue(makeCombatSummary());
      useRuntimeState.getRuntimeValue.mockReturnValue([]);
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

      expect(logService.addEntry).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({
          type: 'ability_use',
          characterName: 'Paladin',
          abilityName: 'Blessed Defender',
          targetName: 'Goblin',
          description: expect.stringContaining('Disadvantage'),
        })
      );
    });

    it('uses result defenderName for log when available', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });
      damageUtils.getCombatContext.mockResolvedValue(makeCombatSummary());
      useRuntimeState.getRuntimeValue.mockReturnValue([]);
      damageRollback.findLastAttack.mockResolvedValue({
        attackEvent: freshAttackEvent({ targetName: 'Orc' }),
        attackerName: 'Orc',
        targetName: 'Orc',
        primaryDamage: 10,
        secondaryDamage: 0,
        totalDamage: 10,
        damageTypes: ['Piercing'],
      });

      await handle(action, ps, campaignName, mapName);

      expect(logService.addEntry).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({
          targetName: 'Orc',
        })
      );
    });
  });

  describe('effect: disadvantage_on_attacks_vs_ally — uses decrement', () => {
    function makeAction() {
      return {
        name: 'Blessed Defender',
        automation: {
          type: 'reaction_debuff',
          range: '30_ft',
          effect: 'disadvantage_on_attacks_vs_ally',
          uses_expression: 2,
          recharge: 'long_rest',
        },
      };
    }

    it('decrements uses after successful handling', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });
      damageUtils.getCombatContext.mockResolvedValue(makeCombatSummary());
      useRuntimeState.getRuntimeValue
        .mockReturnValueOnce(1)
        .mockReturnValueOnce([])
        .mockReturnValueOnce(1);
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

      const usesCall = useRuntimeState.setRuntimeValue.mock.calls.find(
        (c) => c[1] && c[1].includes('Uses')
      );
      expect(usesCall).toBeDefined();
      expect(usesCall[2]).toBe(0);
    });

    it('does not decrement uses on early return (no attack event)', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      damageRollback.findLastAttack.mockResolvedValue({
        attackEvent: null,
        attackerName: null,
        targetName: null,
        primaryDamage: 0,
        secondaryDamage: 0,
        totalDamage: 0,
        damageTypes: [],
      });

      await handle(action, ps, campaignName, mapName);

      const usesCall = useRuntimeState.setRuntimeValue.mock.calls.find(
        (c) => c[1] && c[1].includes('Uses')
      );
      expect(usesCall).toBeUndefined();
    });

    it('does not decrement uses on early return (out of range)', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });
      rangeValidation.rangeToFeet.mockReturnValue(30);
      targetResolver.resolveMapPositions.mockResolvedValue({
        attackerPos: { gridX: 0, gridY: 0 },
        targetPos: { gridX: 20, gridY: 0 },
      });
      rangeValidation.getDistanceFeet.mockReturnValue(50);
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

      const usesCall = useRuntimeState.setRuntimeValue.mock.calls.find(
        (c) => c[1] && c[1].includes('Uses')
      );
      expect(usesCall).toBeUndefined();
    });
  });

  describe('Improved Warding Flare — not applicable for attacks_vs_ally', () => {
    function makeAction() {
      return {
        name: 'Blessed Defender',
        automation: {
          type: 'reaction_debuff',
          range: '30_ft',
          effect: 'disadvantage_on_attacks_vs_ally',
          uses_expression: null,
          recharge: 'long_rest',
        },
      };
    }

    it('does not apply tempHp for disadvantage_on_attacks_vs_ally effect', async () => {
      const ps = {
        name: 'Paladin',
        proficiency: 2,
        level: 5,
        class: {
          name: 'Paladin',
          class_levels: [
            { level: 1, bardic_die: 6, bardic_inspiration_uses: 0 },
            { level: 2, bardic_die: 6, bardic_inspiration_uses: 0 },
            { level: 3, bardic_die: 6, bardic_inspiration_uses: 0 },
            { level: 4, bardic_die: 6, bardic_inspiration_uses: 0 },
            { level: 5, bardic_die: 6, bardic_inspiration_uses: 0 },
          ],
        },
        abilities: [{ name: 'Wisdom', bonus: 2 }],
        characterAdvancement: [
          { name: 'Improved Warding Flare', automation: { tempHpExpression: '2d6' } },
        ],
        specialActions: [],
      };
      const action = makeAction();

      targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });
      damageUtils.getCombatContext.mockResolvedValue(makeCombatSummary());
      useRuntimeState.getRuntimeValue.mockReturnValue([]);
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

      const tempHpCall = useRuntimeState.setRuntimeValue.mock.calls.find(
        (c) => c[1] === 'tempHp'
      );
      expect(tempHpCall).toBeUndefined();
    });
  });
});
