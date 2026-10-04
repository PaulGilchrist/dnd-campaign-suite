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
import * as rangeCheck from '../../../rules/combat/rangeCheck.js';
import * as damageUtils from '../../../rules/combat/damageUtils.js';
import * as damageRollback from '../../common/damageRollback.js';

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

describe('reactionDebuffHandler — disadvantage effect & warding flare', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rangeCheck.isWithinRange.mockReset().mockResolvedValue(true);
  });

  describe('effect: disadvantage_on_attack_roll', () => {
    it('returns popup when out of range', async () => {
      const ps = makePlayerStats({});
      const action = makeAction({ effect: 'disadvantage_on_attack_roll', range: '30_ft' });

      targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });
      damageUtils.getCombatContext.mockResolvedValue(makeCombatSummary());
      damageRollback.findLastAttack.mockResolvedValue({
        attackEvent: freshAttackEvent({ d20: 18, bonus: 5, hit: true }),
        attackerName: 'Goblin',
        targetName: 'Goblin',
        primaryDamage: 10,
        secondaryDamage: 0,
        totalDamage: 10,
        damageTypes: ['Piercing'],
      });
      targetResolver.resolveMapPositions.mockResolvedValue({
        attackerPos: { gridX: 0, gridY: 0 },
        targetPos: { gridX: 20, gridY: 0 },
      });
      rangeCheck.isWithinRange.mockResolvedValue(false);

      const result = await handle(action, ps, campaignName, mapName);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('out of range');
    });
  });

  describe('Improved Warding Flare', () => {
    function makeWardingFlarePlayer() {
      return makePlayerStats({
        abilities: [{ name: 'Wisdom', bonus: 2 }],
        characterAdvancement: [
          { name: 'Improved Warding Flare', automation: { tempHpExpression: '2d6' } },
        ],
      });
    }

    function setupWardingFlareTest(hasFeature, effect) {
      const ps = hasFeature ? makeWardingFlarePlayer() : makePlayerStats({});
      const action = makeAction({ effect });

      targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });
      damageUtils.getCombatContext.mockResolvedValue(makeCombatSummary());
      damageRollback.findLastAttack.mockResolvedValue({
        attackEvent: freshAttackEvent({ d20: 18, bonus: 3, hit: true }),
        attackerName: 'Goblin',
        targetName: 'Goblin',
        primaryDamage: 10,
        secondaryDamage: 0,
        totalDamage: 10,
        damageTypes: ['Piercing'],
      });

      return { action, ps };
    }

    it.each([
      { effect: 'disadvantage_on_attack_roll', hasFeature: true, expectTempHp: true, desc: 'includes tempHp when effect is disadvantage and feature present' },
      { effect: '', hasFeature: true, expectTempHp: false, desc: 'does not include tempHp when effect is not disadvantage' },
      { effect: 'disadvantage_on_attack_roll', hasFeature: false, expectTempHp: false, desc: 'does not include tempHp when feature not on player' },
    ])('$desc', async ({ effect, hasFeature, expectTempHp }) => {
      const { action, ps } = setupWardingFlareTest(hasFeature, effect);

      const result = await handle(action, ps, campaignName, mapName);

      if (expectTempHp) {
        expect(result.payload.description).toContain('Temporary Hit Points');
      } else {
        expect(result.payload.description).not.toContain('Temporary Hit Points');
      }
    });
  });
});
