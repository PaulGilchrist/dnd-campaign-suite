// @maintained-by-ai
// reactionDebuffHandler octet — lane: WARDING-FLARE ROUTE GATE + IMPROVED
// WARDING FLARE tempHp TAIL (effect 'disadvantage_on_attack_roll' →
// EFFECT_ROUTES → handleWardingFlare + logWardingFlareTail →
// applyImprovedWardingFlare; automation/index.js `reaction_debuff`; live from
// public/data/2024/classes.json Light Domain 'Warding Flare' /
// 'Improved Warding Flare' — CLA-193).
//
// Seam map lives in reactionDebuffHandler.attacksVsAlly.test.js header.
// This file owns:
//  - wardingFlareRangeGate exact refusal copy + zero-side-effect refusal
//    (zero spend, zero te, zero latch, warding_flare_refused log row) and
//    the '30_ft' default the gate uses when the production automation omits
//    a range field (2024 classes.json Warding Flare has none).
//  - applyImprovedWardingFlare tempHp math + write + tail copy: 2d6 + WIS
//    onto the DEFENDER (never the attacker), pinned deterministically via
//    Math.random stubs; feature found in characterAdvancement OR
//    specialActions (both search branches); skip when feature absent, and
//    skip when 2d6 + negative WIS lands ≤ 0 (flare still fires); tempHp tail
//    never runs on the default (bardic) route.
// NOT owned here (do not re-add): te disadvantage_next_attack write, latch,
// spend, and no-attack/self-attack refusals (.wardingFlare.test.js);
// attacksVsAlly range gate (its own same-named test); bardic lane content
// (.cuttingWords/.defaultPath/.latch/.uses); generic handle() guards
// (.earlyExits). Its 'refuses out-of-range attackers...' test duplicates this
// lane's gate coverage (weaker copy — reported for removal).
//
// Deterministic: runtime/logService/range/rollback/-popup/automationService
// fully mocked; the two random WF rolls are stubbed wherever numerals are
// pinned; unstubbed lanes vary only unpinned numerals. No churn expected.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { handle } from './reactionDebuffHandler.js';

// ── Mocks BEFORE imports ────────────────────────────────────────

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
  rangeToFeet: vi.fn().mockReturnValue(30),
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
  findLastAttack: vi.fn(),
}));

vi.mock('../../../combat/automation/automationService.js', () => ({
  evaluateAutoExpression: vi.fn().mockReturnValue(3),
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
import * as logService from '../../../ui/logService.js';
import * as rangeValidation from '../../../rules/combat/rangeValidation.js';
import * as rangeCheck from '../../../rules/combat/rangeCheck.js';
import * as damageUtils from '../../../rules/combat/damageUtils.js';
import * as damageRollback from '../../common/damageRollback.js';

const campaignName = 'TestCampaign';
const mapName = 'TestMap';

// Production shape from 2024 classes.json Light Domain — deliberately NO
// range field: the gate's '30_ft' default is pinned below.
function makeWardingFlareAction() {
  return {
    name: 'Warding Flare',
    automation: {
      type: 'reaction_debuff',
      trigger: 'attack_roll_within_30ft',
      effect: 'disadvantage_on_attack_roll',
      uses_expression: 'WIS modifier_min_1',
      recharge: 'long_rest',
      casting_time: '1 reaction',
    },
  };
}

function makeCleric(overrides = {}) {
  return {
    name: 'Light_Cleric',
    level: 8,
    proficiency: 3,
    abilities: [{ name: 'Wisdom', bonus: 4 }],
    characterAdvancement: [],
    specialActions: [],
    ...overrides,
  };
}

const improvedWardingFlare = {
  name: 'Improved Warding Flare',
  automation: { tempHpExpression: '2d6 + WIS modifier' },
};

// Thug 1 hits Ally_Paladin — attacker ≠ player ≠ defender so every pin
// names its exact role.
function setupFlareTrigger() {
  damageUtils.getCombatContext.mockResolvedValue({ round: 1, creatures: [] });
  damageRollback.findLastAttack.mockResolvedValue({
    attackEvent: {
      d20: 15,
      bonus: 5,
      targetName: 'Ally_Paladin',
      targetAc: 14,
      effectiveAc: null,
      hit: true,
      timestamp: 1700000000000,
    },
    attackerName: 'Thug 1',
    targetName: 'Ally_Paladin',
    primaryDamage: 10,
    secondaryDamage: 0,
    totalDamage: 10,
    damageTypes: ['Slashing'],
  });
}

function stubRolls(first, second) {
  // 2d6: roll = floor(r * 6) + 1 — distinct values catch roll-order swaps.
  return vi.spyOn(Math, 'random').mockReturnValueOnce(first).mockReturnValueOnce(second);
}

function tempHpWrites() {
  return useRuntimeState.setRuntimeValue.mock.calls.filter(c => c[1] === 'tempHp');
}

function refusalLogRow() {
  return logService.addEntry.mock.calls.map(c => c[1]).find(e => e.automationType === 'warding_flare_refused');
}

describe('reactionDebuffHandler — warding-flare lane (range gate + Improved WF tempHp tail)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rangeCheck.isWithinRange.mockReset().mockResolvedValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('refuses an out-of-range attacker with the exact gate copy and ZERO writes (spend, te, latch all untouched), logging the refusal', async () => {
    setupFlareTrigger();
    targetResolver.resolveMapPositions.mockResolvedValue({
      attackerPos: { gridX: 0, gridY: 0 },
      targetPos: { gridX: 20, gridY: 0 },
    });
    rangeCheck.isWithinRange.mockResolvedValue(false);

    const result = await handle(makeWardingFlareAction(), makeCleric(), campaignName, mapName);

    expect(result.type).toBe('popup');
    expect(result.payload.description).toBe(
      'Thug 1 is out of range of Light_Cleric — Warding Flare requires the attacker to be within 30 feet.'
    );
    // Production automation omits range → gate defaults to '30_ft'.
    expect(rangeValidation.rangeToFeet).toHaveBeenCalledWith('30_ft');
    expect(rangeCheck.isWithinRange).toHaveBeenCalledWith('Light_Cleric', 'Thug 1', 30);
    // Refusal economy: nothing is spent, no te, no round latch.
    expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();

    const refusal = refusalLogRow();
    expect(refusal).toMatchObject({
      type: 'automation',
      characterName: 'Light_Cleric',
      name: 'Warding Flare',
      description: 'Thug 1 is out of range of Light_Cleric — Warding Flare requires the attacker to be within 30 feet.',
    });
  });

  it.each(['characterAdvancement', 'specialActions'])(
    'Improved Warding Flare in %s grants 2d6 + WIS tempHp to the DEFENDER with exact write and tail copy',
    async (storageKey) => {
      const ps = makeCleric({ [storageKey]: [improvedWardingFlare] });
      setupFlareTrigger();
      stubRolls(0.99, 0.0); // rolls 6 + 1 + WIS 4 = 11

      const result = await handle(makeWardingFlareAction(), ps, campaignName, mapName);

      expect(result.type).toBe('popup');
      expect(tempHpWrites()).toEqual([['Ally_Paladin', 'tempHp', 11, campaignName]]);
      // Never the attacker.
      expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalledWith('Thug 1', 'tempHp', expect.anything(), campaignName);
      expect(result.payload.description).toContain(
        '<br/><br/>Ally_Paladin gains 11 Temporary Hit Points from Improved Warding Flare.'
      );
    }
  );

  it('reacts without tempHp when Improved Warding Flare is not on the character', async () => {
    setupFlareTrigger();

    const result = await handle(makeWardingFlareAction(), makeCleric(), campaignName, mapName);

    expect(result.type).toBe('popup');
    expect(tempHpWrites()).toEqual([]);
    expect(result.payload.description).not.toContain('Temporary Hit Points');
  });

  it('skips the tempHp grant when 2d6 + negative WIS lands at or below zero — the flare still fires', async () => {
    const ps = makeCleric({
      abilities: [{ name: 'Wisdom', bonus: -2 }],
      characterAdvancement: [improvedWardingFlare],
    });
    setupFlareTrigger();
    stubRolls(0.0, 0.0); // rolls 1 + 1 - 2 = 0

    const result = await handle(makeWardingFlareAction(), ps, campaignName, mapName);

    expect(result.type).toBe('popup');
    expect(result.payload.type).toBe('automation_info');
    expect(tempHpWrites()).toEqual([]);
    expect(result.payload.description).not.toContain('Temporary Hit Points');
  });

  it('never runs the WF tempHp tail on the default (bardic) route even when the feature is present', async () => {
    const action = {
      name: 'Cutting Words',
      automation: {
        type: 'reaction_debuff',
        range: '60_ft',
        effect: '',
        uses_expression: null,
        recharge: 'long_rest',
      },
    };
    const ps = makeCleric({ specialActions: [improvedWardingFlare] });
    setupFlareTrigger();
    targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Thug 1' } });

    const result = await handle(action, ps, campaignName, mapName);

    expect(result.type).toBe('popup');
    expect(tempHpWrites()).toEqual([]);
    expect(result.payload.description).not.toContain('Temporary Hit Points');
  });
});
