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
import * as useRuntimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as damageUtils from '../../../rules/combat/damageUtils.js';
import * as damageRollback from '../../common/damageRollback.js';
import * as automationService from '../../../combat/automation/automationService.js';

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

function setupDefaultPath(overrides = {}) {
  const {
    getRuntimeValueReturn,
    usesExpression,
    evaluateAutoExpressionReturn,
    attackEventOverride,
    actionOverrides,
  } = overrides;

  const action = makeAction(actionOverrides);
  if (usesExpression !== undefined) {
    action.automation.uses_expression = usesExpression;
  }

  if (evaluateAutoExpressionReturn !== undefined) {
    automationService.evaluateAutoExpression.mockReturnValue(evaluateAutoExpressionReturn);
  }

  if (getRuntimeValueReturn !== undefined) {
    useRuntimeState.getRuntimeValue.mockReturnValue(getRuntimeValueReturn);
  }

  targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });
  damageUtils.getCombatContext.mockResolvedValue(makeCombatSummary());
  damageRollback.findLastAttack.mockResolvedValue({
    attackEvent: freshAttackEvent(attackEventOverride),
    attackerName: 'Goblin',
    targetName: 'Goblin',
    primaryDamage: 0,
    secondaryDamage: 0,
    totalDamage: 0,
    damageTypes: [],
  });

  return { action };
}

const campaignName = 'TestCampaign';
const mapName = 'DungeonMap';

describe('reactionDebuffHandler — uses decrement & logging', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useRuntimeState.getRuntimeValue.mockReturnValue(undefined);
  });

  describe('uses decrement on successful path', () => {
    it('decrements uses based on current value and uses max', async () => {
      // current undefined → use evaluated expression (2), decrement to 1
      const { action } = setupDefaultPath({
        usesExpression: 'proficiency_bonus',
        evaluateAutoExpressionReturn: 2,
      });
      const result1 = await handle(action, makePlayerStats(), campaignName, mapName);
      expect(result1.type).toBe('popup');
      expect(useRuntimeState.setRuntimeObject).toHaveBeenCalledWith(
        'Bard',
        expect.objectContaining({ cuttingwordsUses: 1 }),
        campaignName,
        expect.anything()
      );

      vi.clearAllMocks();
      useRuntimeState.getRuntimeValue.mockReturnValue(undefined);

      // current = 2 → decrement to 1
      const { action: action2 } = setupDefaultPath({
        usesExpression: 3,
        evaluateAutoExpressionReturn: 3,
        getRuntimeValueReturn: 2,
      });
      const result2 = await handle(action2, makePlayerStats(), campaignName, mapName);
      expect(result2.type).toBe('popup');
      expect(useRuntimeState.setRuntimeObject).toHaveBeenCalledWith(
        'Bard',
        expect.objectContaining({ cuttingwordsUses: 1 }),
        campaignName,
        expect.anything()
      );

      vi.clearAllMocks();
      useRuntimeState.getRuntimeValue.mockReturnValue(undefined);

      // current null → use max (3), decrement to 2
      const { action: action3 } = setupDefaultPath({
        usesExpression: 3,
        evaluateAutoExpressionReturn: 3,
        getRuntimeValueReturn: null,
      });
      const result3 = await handle(action3, makePlayerStats(), campaignName, mapName);
      expect(result3.type).toBe('popup');
      expect(useRuntimeState.setRuntimeObject).toHaveBeenCalledWith(
        'Bard',
        expect.objectContaining({ cuttingwordsUses: 2 }),
        campaignName,
        expect.anything()
      );
    });

    it('uses bardicInspirationUses key when no uses_expression is set', async () => {
      const { action } = setupDefaultPath({});

      const result = await handle(action, makePlayerStats(), campaignName, mapName);

      expect(result.type).toBe('popup');
      expect(useRuntimeState.setRuntimeObject).toHaveBeenCalledWith(
        'Bard',
        expect.objectContaining({ bardicInspirationUses: 3 }),
        campaignName,
        expect.anything()
      );
    });
  });
});
