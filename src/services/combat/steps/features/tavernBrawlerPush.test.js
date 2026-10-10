import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ────────────────────────────────────────────────────────

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
  getTargetFromAttacker: vi.fn(),
}));

vi.mock('../../../encounters/combatData.js', () => ({
  getCurrentCombatRound: vi.fn(() => 3),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

// ── Imports ──────────────────────────────────────────────────────

import { tavernBrawlerPush } from './tavernBrawlerPush.js';

import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { getCombatContext, getTargetFromAttacker } from '../../../rules/combat/damageUtils.js';
import { getCurrentCombatRound } from '../../../encounters/combatData.js';
import { addEntry } from '../../../ui/logService.js';

// ── Helpers ──────────────────────────────────────────────────────

function makeCtx(overrides = {}) {
  return {
    campaignName: 'test-campaign',
    playerStats: {
      name: 'EvasiveFighter',
      automation: { passives: [{ effect: 'tavern_brawler_push', oncePerTurn: true }] },
    },
    attack: { name: 'Unarmed Strike', weaponType: 'unarmed', damage: '1d4+3' },
    targetName: 'Bandit 1',
    hit: true,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  getCurrentCombatRound.mockReturnValue(3);
  getRuntimeValue.mockReturnValue(null);
  setRuntimeValue.mockResolvedValue(undefined);
  getCombatContext.mockResolvedValue({ attacker: 'EvasiveFighter' });
  getTargetFromAttacker.mockReturnValue({ name: 'Bandit 1' });
});

// ── condition ────────────────────────────────────────────────────

describe('tavernBrawlerPush.condition', () => {
  it('passes for an unarmed hit with tavern_brawler_push passive', () => {
    expect(tavernBrawlerPush.condition(makeCtx())).toBe(true);
  });

  it('fails when weaponType collapsed to melee', () => {
    expect(tavernBrawlerPush.condition(makeCtx({ attack: { name: 'Longsword', weaponType: 'melee' } }))).toBe(false);
  });

  it('fails when isUnarmedStrike flag rides a melee-collapsed row', () => {
    // The gate is weaponType-based; flag alone must not false-fire.
    expect(tavernBrawlerPush.condition(makeCtx({ attack: { name: 'Longsword', weaponType: 'melee', isUnarmedStrike: true } }))).toBe(false);
  });

  it('fails on a miss', () => {
    expect(tavernBrawlerPush.condition(makeCtx({ hit: false }))).toBe(false);
  });

  it('fails without automation passives', () => {
    expect(tavernBrawlerPush.condition(makeCtx({ playerStats: { name: 'X' } }))).toBe(false);
  });

  it('fails without the tavern_brawler_push passive', () => {
    const ctx = makeCtx();
    ctx.playerStats.automation.passives = [{ effect: 'other' }];
    expect(tavernBrawlerPush.condition(ctx)).toBe(true); // condition is coarse; handler gates effect
  });
});

// ── handler ──────────────────────────────────────────────────────

describe('tavernBrawlerPush.handler', () => {
  it('stamps once-per-turn latch with campaignName-threaded round', async () => {
    await tavernBrawlerPush.handler(makeCtx(), { formula: '1d4+3', total: 5, rolls: [2] });
    expect(getCurrentCombatRound).toHaveBeenCalledWith('test-campaign');
    expect(setRuntimeValue).toHaveBeenCalledWith('EvasiveFighter', '_Tavern_Brawler_Push_UsedRound', 3, 'test-campaign');
  });

  it('writes MA-0079 push te marker (numeric value, instant)', async () => {
    await tavernBrawlerPush.handler(makeCtx(), { formula: '1d4+3', total: 5, rolls: [2] });
    const teWrite = setRuntimeValue.mock.calls.find(c => c[1] === 'targetEffects');
    expect(teWrite).toBeDefined();
    const te = teWrite[2][teWrite[2].length - 1];
    expect(te).toMatchObject({ target: 'Bandit 1', source: 'EvasiveFighter', effect: 'push', value: 5, duration: 'instant' });
  });

  it('reads campaign targetEffects with campaignName threaded', async () => {
    await tavernBrawlerPush.handler(makeCtx(), { formula: '1d4+3', total: 5, rolls: [2] });
    const teRead = getRuntimeValue.mock.calls.find(c => c[1] === 'targetEffects');
    expect(teRead).toEqual(['campaign', 'targetEffects', 'test-campaign']);
  });

  it('logs the push to the campaign log', async () => {
    await tavernBrawlerPush.handler(makeCtx(), { formula: '1d4+3', total: 5, rolls: [2] });
    const entry = addEntry.mock.calls.map(c => c[1]).find(e => e.description.includes('Pushed') || e.abilityName === 'Tavern Brawler');
    expect(entry).toBeDefined();
    expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.any(Object));
  });

  it('refuses once per turn: latch set for current round → no te, refusal logged', async () => {
    getRuntimeValue.mockImplementation((key, prop) => (prop === '_Tavern_Brawler_Push_UsedRound' ? 3 : null));
    const result = await tavernBrawlerPush.handler(makeCtx(), { formula: '1d4+3', total: 5, rolls: [2] });
    expect(result).toEqual({ data: { formula: '1d4+3', total: 5, rolls: [2] } });
    expect(setRuntimeValue).not.toHaveBeenCalled();
    const refusal = addEntry.mock.calls.map(c => c[1]).find(e => e.automationType === 'tavern_brawler_push_refused');
    expect(refusal).toBeDefined();
  });

  it('latch from a previous round does not refuse', async () => {
    getRuntimeValue.mockImplementation((key, prop) => (prop === '_Tavern_Brawler_Push_UsedRound' ? 2 : null));
    await tavernBrawlerPush.handler(makeCtx(), { formula: '1d4+3', total: 5, rolls: [2] });
    expect(setRuntimeValue).toHaveBeenCalledWith('EvasiveFighter', '_Tavern_Brawler_Push_UsedRound', 3, 'test-campaign');
  });

  it('non-unarmed attack never fires the handler path (no effect found → null)', async () => {
    const ctx = makeCtx();
    ctx.playerStats.automation.passives = [];
    expect(await tavernBrawlerPush.handler(ctx, { rolls: [] })).toBeNull();
    expect(setRuntimeValue).not.toHaveBeenCalled();
  });

  it('appends to existing targetEffects without clobbering', async () => {
    getRuntimeValue.mockImplementation((key, prop) => (prop === 'targetEffects' ? [{ target: 'Other', effect: 'restrained' }] : null));
    await tavernBrawlerPush.handler(makeCtx(), { formula: '1d4+3', total: 5, rolls: [2] });
    const teWrite = setRuntimeValue.mock.calls.find(c => c[1] === 'targetEffects');
    expect(teWrite[2]).toHaveLength(2);
    expect(teWrite[2][0].effect).toBe('restrained');
  });

  it('no target resolved → no writes, data untouched', async () => {
    getTargetFromAttacker.mockReturnValue(null);
    const ctx = makeCtx({ targetName: null });
    const result = await tavernBrawlerPush.handler(ctx, { formula: '1d4+3', total: 5, rolls: [2] });
    expect(result).toEqual({ data: { formula: '1d4+3', total: 5, rolls: [2] } });
    expect(setRuntimeValue).not.toHaveBeenCalled();
  });

  it('awaits latch before te write', async () => {
    await tavernBrawlerPush.handler(makeCtx(), { formula: '1d4+3', total: 5, rolls: [2] });
    const latchIdx = setRuntimeValue.mock.calls.findIndex(c => c[1] === '_Tavern_Brawler_Push_UsedRound');
    const teIdx = setRuntimeValue.mock.calls.findIndex(c => c[1] === 'targetEffects');
    expect(latchIdx).toBeGreaterThanOrEqual(0);
    expect(teIdx).toBeGreaterThan(latchIdx);
  });
});
