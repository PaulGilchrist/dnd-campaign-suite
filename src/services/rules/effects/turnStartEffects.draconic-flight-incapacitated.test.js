// @maintained-by-ai
// CLA-096 lane: the TURN-START incapacitated face of Draconic Flight.
// applyTurnStartEffects dispatches endDraconicFlightIfIncapacitated
// (turnStartEffects.js:102-115) for the ACTIVE creature at its turn start:
//   1. incapacitated holder with wings standing → EXACTLY ONE filtered
//      activeBuffs write (foreign fly buffs survive byte-identical) plus
//      the exact Incapacitated dissolve log bytes (:113), once ever —
//      idempotent on the next turn start (recurrence row).
//   2. zero writes / zero logs when the holder is not incapacitated, and
//      for foreign-holder bait (same fly effect key, different buff name).
// Lane borders: duration-expiry clear bytes belong to
// clearExpirationEffects.draconic-flight-expiry.test.js (#1291); rest
// cleanup to restRules-constants.cla096-draconic-flight.test.js (#1302);
// activation/retract and the used-flag latch reader to
// automation/handlers/buffs/buffHandler.draconic-flight.test.js.
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock surface = the 15 direct imports of turnStartEffects.js, 1:1.
// Only applyTurnStartEffects dispatch + the three incapacitated end-clauses
// run for real; every collaborator is inert.
vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../automation/handlers/buffs/tempHpService.js', () => ({
  setTempHp: vi.fn(),
}));

vi.mock('../../combat/automation/automationExpressions.js', () => ({
  evaluateAutoExpression: vi.fn(() => 1),
}));

vi.mock('../../encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(() => null),
}));

vi.mock('../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../automation/handlers/spells/confusionTurnStartHandler.js', () => ({
  handleConfusionTurnStart: vi.fn(),
}));

vi.mock('./auraDamageService.js', () => ({
  applyAuraDamage: vi.fn(async () => {}),
  applyHolyNimbusDamage: vi.fn(async () => {}),
}));

vi.mock('./toppleCleanup.js', () => ({
  cleanUpToppleConditions: vi.fn(),
}));

vi.mock('../../encounters/monsterLegendaryUses.js', () => ({
  regainLegendaryUses: vi.fn(async () => {}),
}));

vi.mock('../../encounters/monsterRecharge.js', () => ({
  rollMonsterRecharges: vi.fn(async () => {}),
}));

vi.mock('../../rules/features/infernalWoundService.js', () => ({
  applyInfernalWoundBleedTurnStart: vi.fn(async () => {}),
}));

vi.mock('../features/constrictGrappleService.js', () => ({
  applyConstrictGrappleTurnStart: vi.fn(async () => {}),
}));

vi.mock('../features/whirlwindService.js', () => ({
  applyWhirlwindTurnStart: vi.fn(async () => {}),
}));

vi.mock('../../ui/utils.js', () => ({
  default: { getName: (val) => String(val) },
}));

vi.mock('../../ui/storage.js', () => ({
  default: { set: vi.fn(() => Promise.resolve()) },
}));

import { applyTurnStartEffects } from './turnStartEffects.js';
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../ui/logService.js';

const campaignName = 'test-campaign';
const holder = 'DragonbornTest';

const FLY_BUFF = { name: 'Draconic Flight', effect: 'fly_speed_equals_walk_speed' };
// Foreign bait: identical effect key, different buff name — survives by design.
const FOREIGN_WINGS = { name: 'Heavenly Wings', effect: 'fly_speed_equals_walk_speed' };

// Stateful store (#1307): writes land where the next run reads, so the
// exact-write budget and the recurrence row are honest, not decorative.
function stubStore({ buffs = [], conditions = [] } = {}) {
  const store = { activeBuffs: buffs, activeConditions: conditions };
  getRuntimeValue.mockImplementation((name, prop) => {
    if (prop === 'targetEffects') return [];
    return store[prop] ?? null;
  });
  setRuntimeValue.mockImplementation((name, prop, value) => {
    store[prop] = value;
    return Promise.resolve();
  });
  return store;
}

describe('CLA-096 endDraconicFlightIfIncapacitated turn-start lane', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // vitest-4 re-seed: the log promise the source .catch()es must survive clears.
    addEntry.mockImplementation(() => Promise.resolve());
  });

  it('dissolves at turn start: one filtered write, exact dissolve bytes, never twice', async () => {
    // Capitalised condition pins the guard's case-normalising read (:106).
    const store = stubStore({ buffs: [FLY_BUFF, FOREIGN_WINGS], conditions: ['Incapacitated'] });

    await applyTurnStartEffects(holder, { turnStartEffects: [] }, campaignName, []);

    // Full-set write budget: exactly one write — the survivor array, not [].
    expect(setRuntimeValue).toHaveBeenCalledTimes(1);
    expect(setRuntimeValue).toHaveBeenCalledWith(holder, 'activeBuffs', [FOREIGN_WINGS], campaignName);
    expect(store.activeBuffs).toEqual([FOREIGN_WINGS]);
    // Exact log bytes of the Incapacitated dissolve text (turnStartEffects.js:113).
    expect(addEntry).toHaveBeenCalledTimes(1);
    expect(addEntry).toHaveBeenCalledWith(campaignName, {
      type: 'ability_use',
      characterName: holder,
      abilityName: 'Draconic Flight',
      description: `${holder}'s spectral wings dissolve due to the Incapacitated condition.`,
    });

    // Recurrence row: wings already down — next turn start is fully silent.
    await applyTurnStartEffects(holder, { turnStartEffects: [] }, campaignName, []);

    expect(setRuntimeValue).toHaveBeenCalledTimes(1);
    expect(addEntry).toHaveBeenCalledTimes(1);
    expect(store.activeBuffs).toEqual([FOREIGN_WINGS]);
  });

  it.each([
    { label: 'holder not incapacitated', buffs: [FLY_BUFF], conditions: [] },
    { label: 'foreign holder bait (same effect key, other name)', buffs: [FOREIGN_WINGS], conditions: ['Incapacitated'] },
  ])('leaves the wings standing — $label', async ({ buffs, conditions }) => {
    const store = stubStore({ buffs, conditions });

    await applyTurnStartEffects(holder, { turnStartEffects: [] }, campaignName, []);

    expect(setRuntimeValue).not.toHaveBeenCalled();
    expect(addEntry).not.toHaveBeenCalled();
    expect(store.activeBuffs).toEqual(buffs);
  });
});
