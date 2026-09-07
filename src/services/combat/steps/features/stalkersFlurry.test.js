// Regression tests for CLA-326: Stalker's Flurry (Ranger, Gloom Stalker lv11,
// 2024) attack_rider step. Locks down: the choice modal is offered on an armed
// attack hit, the once-per-turn gate refuses a second trigger in the same round,
// and resolving a chosen option stamps oncePerTurn (holder-name format) +
// clears the option keys — so the modal never auto-refires from stale state
// while the resume seam lets the triggering hit's damage land.
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(() => Promise.resolve({ round: 2, creatures: [] })),
  getTargetFromAttacker: vi.fn(() => ({ name: 'Thug 1' })),
}));

vi.mock('../../../automation/common/oncePerTurn.js', () => ({
  checkOncePerTurnWithSkip: vi.fn(() => Promise.resolve(null)),
  clearSkipFlag: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../automation/handlers/combat/massFearHandler.js', () => ({
  resolveMassFear: vi.fn(() => Promise.resolve({ type: 'popup', payload: {} })),
}));

import { stalkersFlurry } from './stalkersFlurry.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { checkOncePerTurnWithSkip } from '../../../automation/common/oncePerTurn.js';
import { resolveMassFear } from '../../../automation/handlers/combat/massFearHandler.js';

const sf = {
  name: "Stalker's Flurry",
  type: 'attack_rider',
  trigger: 'weapon_attack_hit',
  oncePerTurn: true,
  chooseOne: true,
  options: [
    { name: 'Sudden Strike', effect: 'sudden_strike' },
    { name: 'Mass Fear', effect: 'mass_fear' },
  ],
};

const playerStats = {
  name: 'FeyRanger',
  automation: { passives: [sf] },
};

function makeCtx() {
  return {
    playerStats,
    campaignName: 'test-campaign',
    attack: { name: 'Longbow', damageType: 'Piercing' },
    total: 5,
    setAttackRiderModal: vi.fn(),
  };
}

describe('stalkersFlurry feature step (CLA-326)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRuntimeValue.mockReturnValue(null);
    checkOncePerTurnWithSkip.mockResolvedValue(null);
  });

  it('returns null when the character has no Stalker\'s Flurry passive', async () => {
    const ctx = makeCtx();
    ctx.playerStats = { name: 'Nobody', automation: { passives: [] } };
    expect(await stalkersFlurry.handler(ctx, {})).toBeNull();
  });

  it('offers the choice modal on a fresh hit with no option chosen', async () => {
    const ctx = makeCtx();
    const result = await stalkersFlurry.handler(ctx, { formula: '1d8+2', total: 5 });

    expect(ctx.setAttackRiderModal).toHaveBeenCalledWith(expect.objectContaining({ targetName: 'Thug 1' }));
    expect(result.modal).toMatchObject({ type: 'stalkersFlurry' });
    expect(resolveMassFear).not.toHaveBeenCalled();
  });

  it('once-per-turn gate refuses a second trigger in the same round (no modal, no effect)', async () => {
    checkOncePerTurnWithSkip.mockResolvedValue({
      type: 'popup',
      payload: { name: "Stalker's Flurry", description: 'already used' },
    });
    const ctx = makeCtx();
    const result = await stalkersFlurry.handler(ctx, { formula: '1d8+2', total: 5 });

    expect(result).toEqual({ data: { formula: '1d8+2', total: 5 } });
    expect(ctx.setAttackRiderModal).not.toHaveBeenCalled();
    expect(resolveMassFear).not.toHaveBeenCalled();
  });

  it('Mass Fear branch resolves saves and stamps oncePerTurn with the holder name in sideEffects', async () => {
    getRuntimeValue.mockImplementation((name, key) => {
      if (key === "_Stalker's_Flurry_option") return 'Mass Fear';
      return null;
    });
    const ctx = makeCtx();
    const result = await stalkersFlurry.handler(ctx, { formula: '1d8+2', total: 5 });

    expect(result.modal).toBeUndefined();
    expect(resolveMassFear).toHaveBeenCalledWith('test-campaign', 'FeyRanger', 'Thug 1', expect.objectContaining({ effect: 'mass_fear' }), playerStats, null);

    await result.sideEffects();

    // Stamp is round-scoped under the holder's own store (FT-082: never the
    // cs.activeCreatureName mirror); checkOncePerTurnWithSkip accepts the
    // number format and refuses a same-round re-trigger.
    const stamps = setRuntimeValue.mock.calls.filter(c => c[1] === "_Stalker's_Flurry_usedRound");
    expect(stamps).toHaveLength(1);
    expect(stamps[0][0]).toBe('FeyRanger');
    expect(stamps[0][2]).toBe(2);
    const clears = setRuntimeValue.mock.calls.filter(c => c[1] === "_Stalker's_Flurry_option");
    expect(clears).toHaveLength(1);
    expect(clears[0][2]).toBeNull();
  });

  it('Sudden Strike branch arms pendingSuddenStrike for the post-damage consumer', async () => {
    getRuntimeValue.mockImplementation((name, key) => {
      if (key === "_Stalker's_Flurry_option") return 'Sudden Strike';
      return null;
    });
    const ctx = makeCtx();
    const result = await stalkersFlurry.handler(ctx, { formula: '1d8+2', total: 5 });

    expect(result.modal).toBeUndefined();
    expect(result.data).toEqual({ formula: '1d8+2', total: 5 });
    expect(resolveMassFear).not.toHaveBeenCalled();
    const pend = setRuntimeValue.mock.calls.find(c => c[1] === 'pendingSuddenStrike');
    expect(pend).toBeTruthy();
    expect(pend[2]).toBe(true);
  });
});
