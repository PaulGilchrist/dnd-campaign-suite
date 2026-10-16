// CLA-071: Cutting Words re-fires unlimited on one resolved attack (no Reaction latch).
//
// reactionDebuffHandler octet — lane: CUTTING WORDS LATCH (default route →
// handleBardicRoll → gateBardicReaction / bardicAttackIdentity /
// buildBardicStampPatch; automation/index.js `reaction_debuff` → handle →
// DEFAULT_EFFECT_ROUTE). This file owns the once-per-round Reaction latch
// (_Cutting_Words_usedRound), the per-attack-instance marker
// (_Cutting_Words_appliedAttack, timestamp + no-timestamp fallback identity),
// and the §39 bake-before-dispatch / flush-after-dispatch single-channel
// writes. Refusals: cutting_words_refused + reason token, zero spend, zero
// stamp, zero heal.
//
// Seam map vs sibling reactionDebuffHandler.cuttingWords.test.js (non-latch
// content of the same feature): that file owns the debuff CONTENT/wording
// (d20 reduction, hit→miss prose, d20 floor at 1), early exits (no combat
// context / no target / no uses / no recent roll), and the loose uses
// decrement ('decrements bardicInspirationUses after successful use',
// expect.anything() skip flag) plus its loose hit→miss heal
// ('heals target when attack roll hit turns to miss with primary damage
// available' — description-only, no arg pin). Overlap mapped here honestly:
// our 'allows a fresh attack in a later round...' test is a strict superset
// of that sibling decrement test (exact stamp keys + skipSync=true + flush),
// and our 'threads campaignName through the hit-to-miss rollback heal' is
// the exact-arg complement (defender, amount, campaignName) of that sibling
// description-only test. Neither sibling of the octet pins the identity
// fallback shape — owned here. Attacks-vs-ally lane flagged SOURCE BUG #11
// (handleAttacksVsAlly :463 calls resolveMapPositions with 2 args); our
// 3-arg arity pin below (bardicRangeRefusal :582 — campaignName, mapName,
// playerName) is the CORRECT reference shape — keep it strong.
// @maintained-by-ai
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
const ATTACK_TS = 1234567890;

function makeBardStats(overrides = {}) {
  return {
    name: 'CuttingWordsBard',
    proficiency: 2,
    level: 20,
    class: {
      name: 'Bard',
      class_levels: [
        { level: 3, bardic_die: 6 },
        { level: 20, bardic_die: 12 },
      ],
    },
    abilities: [{ name: 'Charisma', bonus: 5 }],
    characterAdvancement: [],
    _trackedResources: {
      bardicInspirationUses: { current: 5, max: 5 },
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

function mockRuntimeStore(store = {}) {
  useRuntimeState.getRuntimeValue.mockImplementation((charKey, key) => store[`${charKey}.${key}`]);
}

function setupDamageLane({ round = 1, timestamp = ATTACK_TS } = {}) {
  targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Bandit 1' } });
  targetResolver.resolveMapPositions.mockResolvedValue(null);
  damageUtils.getCombatContext.mockResolvedValue({ round, creatures: [{ name: 'Bandit 1' }] });
  damageRollback.findLastAttack.mockResolvedValue({
    attackEvent: { d20: 17, bonus: 3, targetName: 'HeroesFeastBard', targetAc: 13, hit: true, timestamp },
    attackerName: 'Bandit 1',
    targetName: 'HeroesFeastBard',
    primaryDamage: 6,
    secondaryDamage: 0,
    totalDamage: 6,
    damageTypes: ['Slashing'],
  });
  return makeCuttingWordsAction();
}

describe('CLA-071: Cutting Words — reaction latch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRuntimeStore();
  });

  it('refuses a second call in the same round: zero BI spend, zero heal, refusal logged', async () => {
    mockRuntimeStore({ 'CuttingWordsBard._Cutting_Words_usedRound': 1 });
    applyHealing.applyHealingToTarget.mockReturnValue({ newHp: 163, actualHeal: 6 });
    const action = setupDamageLane({ round: 1 });

    const result = await handle(action, makeBardStats(), campaignName, mapName);

    expect(result.payload.description).toContain('already been used this round');
    expect(applyHealing.applyHealingToTarget).not.toHaveBeenCalled();
    expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalledWith(
      'CuttingWordsBard', 'bardicInspirationUses', expect.anything(), campaignName
    );
    expect(useRuntimeState.setRuntimeObject).not.toHaveBeenCalled();
    expect(logService.addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
      type: 'automation',
      automationType: 'cutting_words_refused',
      reason: 'reaction_spent',
      characterName: 'CuttingWordsBard',
    }));
  });

  it('refuses the same attack roll twice even when the round latch is clear: zero spend, zero heal', async () => {
    mockRuntimeStore({
      'CuttingWordsBard._Cutting_Words_appliedAttack': String(ATTACK_TS),
    });
    applyHealing.applyHealingToTarget.mockReturnValue({ newHp: 163, actualHeal: 6 });
    const action = setupDamageLane({ round: 2, timestamp: ATTACK_TS });

    const result = await handle(action, makeBardStats(), campaignName, mapName);

    expect(result.payload.description).toContain('already been applied to this roll');
    expect(applyHealing.applyHealingToTarget).not.toHaveBeenCalled();
    expect(useRuntimeState.setRuntimeObject).not.toHaveBeenCalled();
    expect(logService.addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
      type: 'automation',
      automationType: 'cutting_words_refused',
      reason: 'attack_already_debuffed',
    }));
  });

  it('matches the marker against the no-timestamp fallback identity d20:17+3:Bandit 1', async () => {
    // bardicAttackIdentity fallback: no attackEvent.timestamp → `d20:{d20}+{bonus}:{attacker}`
    // (null, not undefined — the helper's default param would resurrect ATTACK_TS)
    mockRuntimeStore({
      'CuttingWordsBard._Cutting_Words_appliedAttack': 'd20:17+3:Bandit 1',
    });
    applyHealing.applyHealingToTarget.mockReturnValue({ newHp: 163, actualHeal: 6 });
    const action = setupDamageLane({ round: 2, timestamp: null });

    const result = await handle(action, makeBardStats(), campaignName, mapName);

    expect(result.payload.description).toContain('already been applied to this roll');
    expect(applyHealing.applyHealingToTarget).not.toHaveBeenCalled();
    expect(useRuntimeState.setRuntimeObject).not.toHaveBeenCalled();
    expect(logService.addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
      automationType: 'cutting_words_refused',
      reason: 'attack_already_debuffed',
    }));
  });

  it('allows a fresh attack in a later round and stamps latch + marker before responding', async () => {
    mockRuntimeStore({ 'CuttingWordsBard._Cutting_Words_usedRound': 1 });
    applyHealing.applyHealingToTarget.mockReturnValue({ newHp: 163, actualHeal: 6 });
    const action = setupDamageLane({ round: 3, timestamp: ATTACK_TS + 60000 });

    const result = await handle(action, makeBardStats(), campaignName, mapName);

    expect(result.payload.description).toContain('Original damage');
    // bake: store-only write BEFORE dispatch so the heal POST carries final keys
    expect(useRuntimeState.setRuntimeObject).toHaveBeenCalledWith(
      'CuttingWordsBard',
      expect.objectContaining({
        _Cutting_Words_usedRound: 3,
        _Cutting_Words_appliedAttack: String(ATTACK_TS + 60000),
        bardicInspirationUses: 4,
      }),
      campaignName,
      true
    );
    // flush: one awaited write after dispatch (economy keys byte-identical)
    expect(useRuntimeState.setRuntimeObject).toHaveBeenCalledWith(
      'CuttingWordsBard',
      expect.objectContaining({
        _Cutting_Words_usedRound: 3,
        bardicInspirationUses: 4,
        _Cutting_Words_flushTs: expect.any(Number),
      }),
      campaignName
    );
    // secondary defect guard: campaignName threaded into the heal
    expect(applyHealing.applyHealingToTarget).toHaveBeenCalledWith(
      expect.anything(), 'HeroesFeastBard', expect.any(Number), campaignName
    );
  });

  it('threads campaignName through the hit-to-miss rollback heal', async () => {
    targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Bandit 1' } });
    targetResolver.resolveMapPositions.mockResolvedValue(null);
    damageUtils.getCombatContext.mockResolvedValue({ round: 1, creatures: [{ name: 'Bandit 1' }] });
    damageRollback.findLastAttack.mockResolvedValue({
      attackEvent: { d20: 14, bonus: 3, targetName: 'Bandit 1', targetAc: 17, hit: true, timestamp: ATTACK_TS },
      attackerName: 'Bandit 1',
      targetName: 'Bandit 1',
      primaryDamage: 10,
      secondaryDamage: 0,
      totalDamage: 0,
      damageTypes: [],
    });
    applyHealing.applyHealingToTarget.mockReturnValue({ newHp: 25, actualHeal: 10 });

    await handle(makeCuttingWordsAction(), makeBardStats(), campaignName, mapName);

    expect(applyHealing.applyHealingToTarget).toHaveBeenCalledWith(
      expect.anything(), 'Bandit 1', 10, campaignName
    );
  });

  it('passes campaignName + mapName + playerName to resolveMapPositions when a map is active', async () => {
    targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Bandit 1' } });
    targetResolver.resolveMapPositions.mockResolvedValue({
      attackerPos: { gridX: 1, gridY: 1 },
      targetPos: { gridX: 2, gridY: 2 },
    });
    damageUtils.getCombatContext.mockResolvedValue({ round: 1, creatures: [{ name: 'Bandit 1' }] });
    damageRollback.findLastAttack.mockResolvedValue({
      attackEvent: { d20: 17, bonus: 3, targetName: 'HeroesFeastBard', targetAc: 13, hit: true, timestamp: ATTACK_TS },
      attackerName: 'Bandit 1',
      targetName: 'HeroesFeastBard',
      primaryDamage: 6,
      secondaryDamage: 0,
      totalDamage: 6,
      damageTypes: ['Slashing'],
    });
    applyHealing.applyHealingToTarget.mockReturnValue({ newHp: 163, actualHeal: 6 });

    await handle(makeCuttingWordsAction(), makeBardStats(), campaignName, mapName);

    expect(targetResolver.resolveMapPositions).toHaveBeenCalledWith(campaignName, mapName, 'CuttingWordsBard');
  });
});
