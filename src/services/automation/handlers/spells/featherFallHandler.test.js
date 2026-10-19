// @maintained-by-ai
// CLA-315 lane companion: Feather Fall reaction — retroactive undo of a stamped
// trigger:'falling' lastAttack (heal through the applyHealingToTarget chokepoint)
// behind a reaction-economy latch (`_Feather_Fall_negatedStamp`, latch-before-write).
// THIS file owns the cast lane: success bytes (incl. partial-heal falsifier) +
// guard ladder refusals + same-fall re-cast via faithful-store two-call progression.
// Sibling lanes (verified present — not duplicated here):
// - handlers/shieldHandler.test.js        — same rollback guard ladder (maintained)
// - common/damageRollback.test.js         — owns findLastAttack store-query internals
// - combat/damageReductionHandler.slow-fall.test.js — proactive slow-fall lane
// - class-warlock/searingVengeance.heal.test.js     — maintained heal-seam precedent
// No te / no duration byte here: the only write is the latch stamp (no registry
// #820 entry needed); the spell's authored 1 minute is combat-scoped (#app) and
// this handler carries no minutes×10 recipe. Handler unmocked (#791); infoPopup
// unmocked for byte-exact payloads (#829).
// old→new: 5 flat tests → 1 success (partial-heal falsifier) | it.each×3 guards
// (zero-write pinned) | 1 faithful-store two-call latch (replaces mock-stamp leg).
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../common/damageRollback.js', () => ({
  findLastAttack: vi.fn(),
}));
vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
}));
vi.mock('../../../rules/combat/applyHealing.js', () => ({
  applyHealingToTarget: vi.fn(),
}));
vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));
vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

import { handle } from './featherFallHandler.js';
import * as damageRollback from '../../common/damageRollback.js';
import * as damageUtils from '../../../rules/combat/damageUtils.js';
import * as applyHealing from '../../../rules/combat/applyHealing.js';
import * as runtimeState from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';

const campaignName = 'test-campaign';
const action = { name: 'Feather Fall', automation: { type: 'feather_fall', trigger: 'falling' } };
const caster = { name: 'TestHero' };
const STAMP = 1000;

function fallingAttack(overrides = {}) {
  // findLastAttack carries the stamp ONLY on attackEvent (not top-level) —
  // fixture must match that real shape (live-caught defect 2026-10-10).
  return {
    attackEvent: { trigger: 'falling', timestamp: STAMP },
    trigger: 'falling',
    targetName: 'TestHero',
    totalDamage: 27,
    ...overrides,
  };
}

const NOTHING_FALLING = 'Nothing is falling — this Reaction can only be used when a creature takes falling damage.';

function refusalPopup(reason) {
  return {
    type: 'popup',
    payload: { type: 'automation_info', name: 'Feather Fall', description: `Feather Fall: ${reason}`, automation: action.automation },
  };
}

function refusalLog(reason) {
  return expect.objectContaining({
    type: 'automation',
    characterName: 'TestHero',
    automationType: 'feather_fall_refused',
    name: 'Feather Fall',
    description: `Feather Fall: ${reason}`,
  });
}

describe('featherFallHandler', () => {
  let store; // faithful runtime-store double (#934): reads see the writes

  beforeEach(() => {
    vi.clearAllMocks();
    store = new Map();
    runtimeState.getRuntimeValue.mockImplementation((name, key) => store.get(`${name}|${key}`));
    runtimeState.setRuntimeValue.mockImplementation((name, key, value) => {
      store.set(`${name}|${key}`, value);
      return Promise.resolve();
    });
    damageUtils.getCombatContext.mockResolvedValue({ round: 1 });
    applyHealing.applyHealingToTarget.mockImplementation((cs, name, amount) => ({ actualHeal: amount }));
    damageRollback.findLastAttack.mockResolvedValue({ attackEvent: null, trigger: null, targetName: null, totalDamage: 0 });
  });

  it('negates fall damage: requests full fall damage, reports actualHeal (not fallDamage) in popup + log, writes latch stamp once', async () => {
    damageRollback.findLastAttack.mockResolvedValue(fallingAttack());
    // Partial heal falsifies fallDamage leaking into the messages in place of actualHeal.
    applyHealing.applyHealingToTarget.mockResolvedValue({ actualHeal: 19 });

    const result = await handle(action, caster, campaignName);

    expect(applyHealing.applyHealingToTarget).toHaveBeenCalledWith({ round: 1 }, 'TestHero', 27, campaignName);
    expect(result).toEqual({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Feather Fall',
        description: 'Feather Fall: falling damage negated — healed 19 HP of the 27 falling damage taken.',
        automation: action.automation,
      },
    });
    expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
      type: 'ability_use',
      characterName: 'TestHero',
      abilityName: 'Feather Fall',
      description: 'TestHero casts Feather Fall — falling damage retroactively negated: healed 19 HP (fall damage 27).',
    }));
    expect(runtimeState.setRuntimeValue).toHaveBeenCalledTimes(1);
    expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith('TestHero', '_Feather_Fall_negatedStamp', STAMP, campaignName);
    expect(store.get('TestHero|_Feather_Fall_negatedStamp')).toBe(STAMP);
  });

  it.each([
    ['no falling event', { attackEvent: null, trigger: null, targetName: null, totalDamage: 0 }, NOTHING_FALLING],
    ['attack recorded but trigger is not falling (trigger leak)', fallingAttack({ trigger: null, attackEvent: {} }), NOTHING_FALLING],
    ['falling creature is someone else', fallingAttack({ targetName: 'SomeoneElse' }), 'SomeoneElse is the falling creature — you are not the one who took the falling damage.'],
  ])('guard refusal — %s: refusal popup + feather_fall_refused log, zero heal, zero stamp write', async (_label, lastAttack, reason) => {
    damageRollback.findLastAttack.mockResolvedValue(lastAttack);

    const result = await handle(action, caster, campaignName);

    expect(result).toEqual(refusalPopup(reason));
    expect(addEntry).toHaveBeenCalledWith(campaignName, refusalLog(reason));
    expect(applyHealing.applyHealingToTarget).not.toHaveBeenCalled();
    expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
  });

  it('same fall twice: first cast heals and latches, second cast is refused with zero further writes', async () => {
    damageRollback.findLastAttack.mockResolvedValue(fallingAttack());

    const first = await handle(action, caster, campaignName);
    expect(first.payload.description).toBe('Feather Fall: falling damage negated — healed 27 HP of the 27 falling damage taken.');

    const second = await handle(action, caster, campaignName);

    expect(second).toEqual(refusalPopup('You have already negated this fall.'));
    expect(applyHealing.applyHealingToTarget).toHaveBeenCalledTimes(1);
    expect(runtimeState.setRuntimeValue).toHaveBeenCalledTimes(1);
    expect(addEntry).toHaveBeenLastCalledWith(campaignName, refusalLog('You have already negated this fall.'));
  });
});
