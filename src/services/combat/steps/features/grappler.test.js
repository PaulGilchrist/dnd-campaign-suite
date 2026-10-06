// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
  getTargetFromAttacker: vi.fn(),
}));

vi.mock('../../../encounters/combatData.js', () => ({
  getCurrentCombatRound: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../conditions/conditionSaveService.js', () => ({
  addCondition: vi.fn(() => ({ suppressed: false })),
}));

import { grappler } from './grappler.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { getCombatContext, getTargetFromAttacker } from '../../../rules/combat/damageUtils.js';
import { getCurrentCombatRound } from '../../../encounters/combatData.js';
import { addEntry } from '../../../ui/logService.js';
import { addCondition } from '../../conditions/conditionSaveService.js';

const RIDER = { type: 'attack_rider', trigger: 'unarmed_strike_hit', effect: 'punch_and_grab', oncePerTurn: true };

function makeCtx(overrides = {}) {
  return {
    campaignName: 'test-campaign',
    playerStats: { name: 'Monk1', automation: { passives: [RIDER] } },
    attack: { weaponType: 'unarmed', type: 'Action' },
    targetName: 'Bandit 1',
    formula: '1d4+4',
    total: 6,
    rolls: [2],
    ...overrides,
  };
}

// Round latch arming: Attack-action row stamps _attackActionTakenRound = round;
// no BA press stamp, latch unset, no existing condition meta.
function armAttackAction(round = 3) {
  getCurrentCombatRound.mockReturnValue(round);
  getRuntimeValue.mockImplementation((_store, key) => {
    if (key === '_attackActionTakenRound') return round;
    if (key === '_Grappler_usedRound') return null;
    if (key === '_bonusActionAttackRound') return null;
    return null;
  });
  getCombatContext.mockResolvedValue({ creatures: [{ name: 'Bandit 1' }] });
  getTargetFromAttacker.mockReturnValue({ name: 'Bandit 1' });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('grappler — condition', () => {
  it('is true for an unarmed strike with passives', () => {
    expect(grappler.condition(makeCtx())).toBe(true);
  });
  it('is false for a weapon attack', () => {
    expect(grappler.condition(makeCtx({ attack: { weaponType: 'weapon' } }))).toBe(false);
  });
  it('is false with no passives', () => {
    expect(grappler.condition(makeCtx({ playerStats: { name: 'Monk1' } }))).toBe(false);
  });
});

describe('grappler — qualifying unarmed hit', () => {
  it('grapples the target once, stamps the latch, and logs condition applied', async () => {
    armAttackAction(3);
    const res = await grappler.handler(makeCtx(), { formula: '1d4+4', total: 6, rolls: [2] });
    expect(res).toEqual({ data: { formula: '1d4+4', total: 6, rolls: [2] } });
    expect(addCondition).toHaveBeenCalledWith(expect.objectContaining({
      creatureName: 'Bandit 1',
      conditionDef: { key: 'grappled', label: 'Grappled' },
      campaignName: 'test-campaign',
    }));
    expect(setRuntimeValue).toHaveBeenCalledWith('Monk1', '_Grappler_usedRound', 3, 'test-campaign');
    expect(setRuntimeValue).toHaveBeenCalledWith('Bandit 1', 'activeConditionMeta',
      { grappled: { source: 'Grappler' } }, 'test-campaign');
    const applied = addEntry.mock.calls.map(c => c[1]).find(e => e.type === 'condition');
    expect(applied).toMatchObject({ characterName: 'Bandit 1', action: 'applied', condition: 'Grappled' });
    expect(applied.reason).toMatch(/Punch and Grab \(Grappler\)/);
    expect(addEntry.mock.calls.map(c => c[1]).some(e => e.note === 'grappler_refused')).toBe(false);
  });
});

describe('grappler — Bonus Action lane exclusion', () => {
  it('refuses a BA unarmed press this round (flurry row) even with Attack-action armed and latch unset', async () => {
    armAttackAction(3);
    getRuntimeValue.mockImplementation((_store, key) => {
      if (key === '_attackActionTakenRound') return 3;
      if (key === '_Grappler_usedRound') return null;
      if (key === '_bonusActionAttackRound') return 3; // BA row pressed this round
      return null;
    });
    const res = await grappler.handler(makeCtx({ attack: { weaponType: 'unarmed', type: 'Bonus Action' } }), { total: 6 });
    expect(res).toEqual({ data: { total: 6 } });
    expect(addCondition).not.toHaveBeenCalled();
    expect(setRuntimeValue).not.toHaveBeenCalledWith('Monk1', '_Grappler_usedRound', 3, 'test-campaign');
    const refused = addEntry.mock.calls.map(c => c[1]).find(e => e.note === 'grappler_refused');
    expect(refused).toMatchObject({ reason: 'no_attack_action' });
  });
});

describe('grappler — refusals', () => {
  it('refuses a second use in the same round (once_per_turn), no second grapple', async () => {
    armAttackAction(3);
    getRuntimeValue.mockImplementation((_s, key) => {
      if (key === '_attackActionTakenRound') return 3;
      if (key === '_Grappler_usedRound') return 3;
      return null;
    });
    const res = await grappler.handler(makeCtx(), { total: 6 });
    expect(res).toEqual({ data: { total: 6 } });
    expect(addCondition).not.toHaveBeenCalled();
    const refused = addEntry.mock.calls.map(c => c[1]).find(e => e.note === 'grappler_refused');
    expect(refused).toMatchObject({ type: 'automation', automationType: 'grappler_refused', reason: 'once_per_turn' });
  });

  it('logs no_target and does not consume the latch when no target is armed', async () => {
    armAttackAction(3);
    getTargetFromAttacker.mockReturnValueOnce(null);
    const res = await grappler.handler(makeCtx(), { total: 6 });
    expect(res).toEqual({ data: { total: 6 } });
    expect(addCondition).not.toHaveBeenCalled();
    expect(setRuntimeValue).not.toHaveBeenCalledWith('Monk1', '_Grappler_usedRound', 3, 'test-campaign');
    const refused = addEntry.mock.calls.map(c => c[1]).find(e => e.note === 'grappler_refused');
    expect(refused).toMatchObject({ type: 'automation', automationType: 'grappler_refused', reason: 'no_target' });
  });

  it('refuses when not part of the Attack action (no_attack_action)', async () => {
    armAttackAction(3);
    getRuntimeValue.mockImplementation((_s, key) => {
      if (key === '_attackActionTakenRound') return 2; // armed last round only
      if (key === '_Grappler_usedRound') return null;
      return null;
    });
    const res = await grappler.handler(makeCtx(), { total: 6 });
    expect(res).toEqual({ data: { total: 6 } });
    expect(addCondition).not.toHaveBeenCalled();
    expect(setRuntimeValue).not.toHaveBeenCalledWith('Monk1', '_Grappler_usedRound', 3, 'test-campaign');
    const refused = addEntry.mock.calls.map(c => c[1]).find(e => e.note === 'grappler_refused');
    expect(refused).toMatchObject({ reason: 'no_attack_action' });
  });

  it('logs immune and does not consume the latch when the condition is suppressed', async () => {
    armAttackAction(3);
    addCondition.mockReturnValueOnce({ suppressed: true });
    await grappler.handler(makeCtx(), { total: 6 });
    expect(setRuntimeValue).not.toHaveBeenCalledWith('Monk1', '_Grappler_usedRound', 3, 'test-campaign');
    const refused = addEntry.mock.calls.map(c => c[1]).find(e => e.note === 'grappler_refused');
    expect(refused).toMatchObject({ reason: 'immune' });
  });
});

describe('grappler — non-holder', () => {
  it('never grants when the punch_and_grab rider is absent', async () => {
    armAttackAction(3);
    const empty = makeCtx({ playerStats: { name: 'Monk1', automation: { passives: [] } } });
    expect(await grappler.handler(empty, { total: 6 })).toBeNull();
    const other = makeCtx({ playerStats: { name: 'Monk1', automation: { passives: [{ type: 'attack_rider', trigger: 'weapon_attack_hit' }] } } });
    expect(await grappler.handler(other, { total: 6 })).toBeNull();
    expect(addCondition).not.toHaveBeenCalled();
  });
});
