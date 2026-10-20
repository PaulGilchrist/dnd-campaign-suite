// @maintained-by-ai
// FT-036 Grappler "Punch and Grab" lane. Owner-split (cite, do NOT re-drive here):
//  - conditionSaveService.test.js #1005 owns grapple CON-save advantage channels (save math).
//  - useCharActionsAttackHandlers.cla143-stamp.test.js owns the _attackActionTakenRound write seam;
//    this file exercises only the READ side of the RAW gates (store bytes below).
//  - automationCollector.grappler.test.js owns feats.json → automation.passives data routing.
//  - useCharActionsBaseActions.grapple-contest-math.test.js (BA-002) owns the contested grapple.
// Here: rider verbatim match, gate-byte battery with zero side-effect, meta-stamp merge bytes,
// exact refusal/applied telemetry bytes, damage passthrough.
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

const RIDER = { type: 'attack_rider', trigger: 'unarmed_strike_hit', effect: 'punch_and_grab' };
// Sentinel combat context — identity-checked so the handler can't fake it with a re-fetch.
const CS = { creatures: [{ name: 'Bandit 1' }] };

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

// Store-byte arming: defaults are the fully-qualified Attack-action state
// (armed this round, no BA press stamp, latch unset, no existing condition meta).
function armStore({ round, armed = round, ba = null, used = null, meta = null }) {
  getCurrentCombatRound.mockReturnValue(round);
  getRuntimeValue.mockImplementation((_store, key) => {
    if (key === '_attackActionTakenRound') return armed;
    if (key === '_bonusActionAttackRound') return ba;
    if (key === '_Grappler_usedRound') return used;
    if (key === 'activeConditionMeta') return meta;
    return null;
  });
  getCombatContext.mockResolvedValue(CS);
  getTargetFromAttacker.mockReturnValue({ name: 'Bandit 1' });
}

// One refusal, byte-exact, nothing else logged (playbook §5 convention).
function expectSingleRefusal(reason) {
  expect(addEntry).toHaveBeenCalledTimes(1);
  const [campaign, refused] = addEntry.mock.calls[0];
  expect(campaign).toBe('test-campaign');
  expect(refused).toEqual({
    type: 'automation',
    characterName: 'Monk1',
    automationType: 'grappler_refused',
    abilityName: 'Punch and Grab (Grappler)',
    note: 'grappler_refused',
    reason,
    description: `Punch and Grab refused (${reason}) — no effect on Bandit 1.`,
    timestamp: expect.any(Number),
  });
}

function expectRefused(reason) {
  expect(setRuntimeValue).not.toHaveBeenCalled(); // zero latch burn, zero meta stamp (#1026)
  expectSingleRefusal(reason);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('grappler — condition', () => {
  it('is true only for unarmed attacks by characters carrying an automation.passives array', () => {
    expect(grappler.condition(makeCtx())).toBe(true);
    expect(grappler.condition(makeCtx({ attack: { weaponType: 'weapon' } }))).toBe(false);
    expect(grappler.condition(makeCtx({ attack: undefined }))).toBe(false);
    expect(grappler.condition(makeCtx({ playerStats: { name: 'Monk1' } }))).toBe(false);
    expect(grappler.condition(makeCtx({ playerStats: { name: 'Monk1', automation: {} } }))).toBe(false);
  });
});

describe('grappler — qualifying Attack-action unarmed hit', () => {
  it('grapples the armed target once: exact addCondition request, attribution before latch burn, exact applied log, damage passthrough', async () => {
    armStore({ round: 3 });
    const ctx = makeCtx();
    const prevData = { formula: '1d4+4', total: 6, rolls: [2] };

    const res = await grappler.handler(ctx, prevData);

    expect(res).toEqual({ data: prevData });
    expect(res.data).toBe(prevData); // pipeline passthrough preserves the object identity
    expect(getTargetFromAttacker).toHaveBeenCalledWith(CS, 'Monk1');
    expect(addCondition).toHaveBeenCalledTimes(1);
    expect(addCondition).toHaveBeenCalledWith({
      combatSummary: CS,
      creatureName: 'Bandit 1',
      conditionDef: { key: 'grappled', label: 'Grappled' },
      getRuntimeValue,
      setRuntimeValue,
      campaignName: 'test-campaign',
      playerStats: ctx.playerStats,
    });

    expect(setRuntimeValue).toHaveBeenCalledTimes(2);
    expect(setRuntimeValue).toHaveBeenNthCalledWith(1, 'Bandit 1', 'activeConditionMeta',
      { grappled: { source: 'Grappler' } }, 'test-campaign');
    expect(setRuntimeValue).toHaveBeenNthCalledWith(2, 'Monk1', '_Grappler_usedRound', 3, 'test-campaign');

    expect(addEntry).toHaveBeenCalledTimes(1);
    const [campaign, applied] = addEntry.mock.calls[0];
    expect(campaign).toBe('test-campaign');
    expect(applied).toEqual({
      type: 'condition',
      characterName: 'Bandit 1',
      action: 'applied',
      condition: 'Grappled',
      reason: "Monk1's Punch and Grab (Grappler)",
      timestamp: expect.any(Number),
    });
  });

  it('stamps Grapppler source into existing grappled meta without clobbering other bytes, and skips the write when already attributed', async () => {
    armStore({ round: 3, meta: { grappled: { source: 'Scylla', escapeDC: 15 }, prone: { source: 'Ice Ray' } } });
    await grappler.handler(makeCtx(), { total: 6 });
    expect(setRuntimeValue).toHaveBeenCalledWith('Bandit 1', 'activeConditionMeta',
      { grappled: { source: 'Grappler', escapeDC: 15 }, prone: { source: 'Ice Ray' } }, 'test-campaign');

    vi.clearAllMocks();
    armStore({ round: 4, meta: { grappled: { source: 'Grappler' } } });
    await grappler.handler(makeCtx(), { total: 6 });
    expect(setRuntimeValue.mock.calls.filter(([, key]) => key === 'activeConditionMeta')).toHaveLength(0);
    expect(setRuntimeValue).toHaveBeenCalledWith('Monk1', '_Grappler_usedRound', 4, 'test-campaign');
  });
});

describe('grappler — RAW gate battery (refusal, zero side-effect)', () => {
  // Two disjuncts on the Attack-action guard (stale armed / BA press stamp) plus the
  // once-per-turn latch — each row falsifies a different byte (#1035 reach-branch).
  it.each([
    ['BA flurry press while Attack-action armed and latch unset (stamp asymmetry)', { ba: 3 }, 'no_attack_action', { attack: { weaponType: 'unarmed', type: 'Bonus Action' } }],
    ['Attack action armed last round only', { armed: 2 }, 'no_attack_action', {}],
    ['latch already burned this round', { used: 3 }, 'once_per_turn', {}],
  ])('refuses %s — no target fetch, no grant, no latch burn', async (_desc, bytes, reason, ctxPatch) => {
    armStore({ round: 3, ...bytes });
    const prevData = { total: 6 };

    const res = await grappler.handler(makeCtx(ctxPatch), prevData);

    expect(res).toEqual({ data: prevData });
    expect(getCombatContext).not.toHaveBeenCalled(); // gate short-circuits before target resolution
    expect(addCondition).not.toHaveBeenCalled();
    expectRefused(reason);
  });
});

describe('grappler — no armed target', () => {
  it('logs no_target and burns nothing when target resolution misses, and never attempts resolution when combat context fetch fails', async () => {
    const prevData = { total: 6 };

    armStore({ round: 3 });
    getTargetFromAttacker.mockReturnValueOnce(null);
    expect(await grappler.handler(makeCtx(), prevData)).toEqual({ data: prevData });
    expect(addCondition).not.toHaveBeenCalled();
    expectRefused('no_target');

    vi.clearAllMocks();
    armStore({ round: 3 });
    getCombatContext.mockResolvedValueOnce(null);
    expect(await grappler.handler(makeCtx(), prevData)).toEqual({ data: prevData });
    expect(getTargetFromAttacker).not.toHaveBeenCalled();
    expectRefused('no_target');
  });
});

describe('grappler — immune target', () => {
  it('logs immune and does not burn the latch or stamp meta when the condition is suppressed', async () => {
    armStore({ round: 3 });
    addCondition.mockReturnValueOnce({ suppressed: true });
    const prevData = { total: 6 };

    const res = await grappler.handler(makeCtx(), prevData);
    expect(res).toEqual({ data: prevData });
    expect(addCondition).toHaveBeenCalledTimes(1); // suppression is discovered via addCondition itself
    expectRefused('immune');
  });
});

describe('grappler — non-holders and near-miss riders', () => {
  it('returns null silently unless a rider matches type+trigger+effect punch_and_grab verbatim', async () => {
    armStore({ round: 3 });
    const cases = [
      { name: 'Monk1' }, // no automation at all
      { name: 'Monk1', automation: { passives: [] } },
      { name: 'Monk1', automation: { passives: [{ type: 'attack_rider', trigger: 'unarmed_strike_hit', effect: 'push' }] } }, // tavern-brawler lane near-miss
      { name: 'Monk1', automation: { passives: [{ type: 'attack_rider', trigger: 'weapon_attack_hit', effect: 'punch_and_grab' }] } }, // wrong trigger
    ];
    for (const playerStats of cases) {
      expect(await grappler.handler(makeCtx({ playerStats }), { total: 6 })).toBeNull();
    }
    expect(addCondition).not.toHaveBeenCalled();
    expect(setRuntimeValue).not.toHaveBeenCalled();
    expect(addEntry).not.toHaveBeenCalled(); // non-holders are silent — no refusal spam
  });
});
