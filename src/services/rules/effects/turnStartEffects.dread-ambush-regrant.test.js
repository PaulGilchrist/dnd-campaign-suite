// @maintained-by-ai
// CLA-100: Dread Ambush (Gloom Stalker) Ambusher's Leap — once-per-COMBAT
// speed_boost grant lifecycle, pinned at the DISPATCH layer: the whole decision
// (round gate, latch, tuple, log) lives in turnStartEffects.js
// applyDreadAmbushSpeedTurnStart — there is no separate dread-ambush service.
//
// Faces pinned here (owner of record — turnStartEffects_additional.test.js:9-11
// cites this file): exact buff-tuple grant, latch block, round gate, re-grant.
// Related lanes (cite, don't re-run): queue mechanics — expirations family;
// round-counter maturity arithmetic — initiative seam #1298. The latch RESETS
// themselves are pinned by the initiative lanes; here we only feed the seam's
// real write value (null — useInitiativeEffects.js:85, createCreatureHandlers.js:85,
// Initiative.jsx:135) as the re-grant precondition.
//
// STATS bonusExpression '10' mirrors disk: public/data/2024/classes.json
// { "effect": "dread_ambush_speed", "casting_time": "passive", "bonusExpression": "10" }.
import { describe, it, expect, vi, beforeEach } from 'vitest';

const h = vi.hoisted(() => {
    const store = new Map();
    return {
        store,
        storeKey: (name, prop) => `${name}|${prop}`,
        combatRoundRef: { round: 1 },
        noCombat: false,
        addEntry: vi.fn().mockResolvedValue(undefined),
    };
});

// Mock surface = exactly the 15 real imports of turnStartEffects.js, 1:1.
vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn((name, prop) => h.store.get(h.storeKey(name, prop)) ?? null),
  setRuntimeValue: vi.fn(async (name, prop, value) => { h.store.set(h.storeKey(name, prop), value); }),
}));
vi.mock('../../ui/utils.js', () => ({
  default: { getName: vi.fn((val) => String(val)) },
}));
vi.mock('../../ui/storage.js', () => ({
  default: { set: vi.fn().mockResolvedValue(undefined) },
}));
vi.mock('../../encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(() => (h.noCombat ? null : { round: h.combatRoundRef.round })),
}));
vi.mock('../../ui/logService.js', () => ({
  addEntry: (...args) => h.addEntry(...args),
}));
vi.mock('../../automation/handlers/spells/confusionTurnStartHandler.js', () => ({
  handleConfusionTurnStart: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('./auraDamageService.js', () => ({
  applyAuraDamage: vi.fn().mockResolvedValue(undefined),
  applyHolyNimbusDamage: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('./toppleCleanup.js', () => ({
  cleanUpToppleConditions: vi.fn(),
}));
vi.mock('../../encounters/monsterLegendaryUses.js', () => ({
  regainLegendaryUses: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../../encounters/monsterRecharge.js', () => ({
  rollMonsterRecharges: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../../rules/features/infernalWoundService.js', () => ({
  applyInfernalWoundBleedTurnStart: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../features/constrictGrappleService.js', () => ({
  applyConstrictGrappleTurnStart: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../features/whirlwindService.js', () => ({
  applyWhirlwindTurnStart: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../../automation/handlers/buffs/tempHpService.js', () => ({
  setTempHp: vi.fn(),
}));
vi.mock('../../combat/automation/automationExpressions.js', () => ({
  evaluateAutoExpression: vi.fn((expr) => (typeof expr === 'number' ? expr : 1)),
}));

import { applyTurnStartEffects } from './turnStartEffects.js';
import { setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';

const NAME = 'FeyRanger';
const CAMPAIGN = 'test-campaign';
const STATS = { turnStartEffects: [{ type: 'dread_ambush_speed', bonusExpression: '10' }] };
const BUFF = { name: 'Dread Ambush', effect: 'speed_boost', duration: 'until_end_of_turn', speedBonus: 10 };
const LOG_DESC = "FeyRanger's Ambusher's Leap — Speed increases by 10 ft until the end of this turn.";
// Distinct unrelated survivor buff — proves append vs clobber and byte-identity in negatives.
const SURVIVOR = { name: 'Bless', effect: 'attack_roll_bonus', bonus: 3 };

function buffs() {
  return h.store.get(h.storeKey(NAME, 'activeBuffs'));
}
function latch() {
  return h.store.get(h.storeKey(NAME, 'dreadAmbushSpeedActive'));
}
function dreadLogs() {
  return h.addEntry.mock.calls.filter(([, e]) => e && e.abilityName === 'Dread Ambush');
}
function dreadWrites() {
  return setRuntimeValue.mock.calls.filter(([, key]) => key === 'dreadAmbushSpeedActive' || key === 'activeBuffs');
}

describe('CLA-100 Dread Ambush Ambusher\'s Leap once-per-combat lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks(); // keeps implementations (clearAllMocks, not resetAllMocks)
    h.store.clear();
    h.combatRoundRef.round = 1;
    h.noCombat = false;
  });

  it('grants the exact speed_boost tuple and logs Ambusher\'s Leap once on round-1 first turn', async () => {
    await applyTurnStartEffects(NAME, STATS, CAMPAIGN);

    expect(latch()).toBe(true);
    expect(buffs()).toEqual([BUFF]);
    // Write contract: latch armed BEFORE the buff append; 4-arg calls (no skipSync).
    expect(dreadWrites()).toEqual([
      [NAME, 'dreadAmbushSpeedActive', true, CAMPAIGN],
      [NAME, 'activeBuffs', [BUFF], CAMPAIGN],
    ]);
    // Exactly one log entry app-wide, exact bytes (timestamp is the only free slot).
    expect(h.addEntry).toHaveBeenCalledTimes(1);
    expect(dreadLogs()[0]).toEqual([CAMPAIGN, {
      type: 'ability_use',
      characterName: NAME,
      abilityName: 'Dread Ambush',
      description: LOG_DESC,
      timestamp: expect.any(Number),
    }]);
  });

  it('latch blocks a second grant later in the SAME combat — zero dread writes, survivors byte-identical', async () => {
    await applyTurnStartEffects(NAME, STATS, CAMPAIGN);
    // Third-party buff lands mid-combat; the blocked turn-start must not clobber it.
    h.store.set(h.storeKey(NAME, 'activeBuffs'), [BUFF, SURVIVOR]);
    vi.clearAllMocks();

    await applyTurnStartEffects(NAME, STATS, CAMPAIGN); // turn 2, round still 1

    expect(latch()).toBe(true);
    expect(buffs()).toEqual([BUFF, SURVIVOR]);
    expect(dreadWrites()).toHaveLength(0);
    expect(dreadLogs()).toHaveLength(0);
  });

  it('round gate: with the latch already cleared, rounds != 1 and out-of-combat grants never touch state or log', async () => {
    // Latch pre-cleared to the real seam value (null) so ONLY the round gate can block.
    h.store.set(h.storeKey(NAME, 'dreadAmbushSpeedActive'), null);

    h.combatRoundRef.round = 2;
    await applyTurnStartEffects(NAME, STATS, CAMPAIGN);

    expect(latch()).toBeNull(); // not even written back — the guard returns pre-latch
    expect(buffs()).toBeUndefined();
    expect(dreadWrites()).toHaveLength(0);
    expect(dreadLogs()).toHaveLength(0);

    // No active combat at all — same silent no-op contract.
    h.noCombat = true;
    await applyTurnStartEffects(NAME, STATS, CAMPAIGN);

    expect(latch()).toBeNull();
    expect(buffs()).toBeUndefined();
    expect(dreadWrites()).toHaveLength(0);
    expect(dreadLogs()).toHaveLength(0);
  });

  it('re-grants exactly once when a combat-start seam clears the latch to null, appending past survivors, then stays blocked', async () => {
    // Combat #1 grant; its until_end_of_turn buff is later stripped by the
    // initiative-roll expiration clear, leaving only an unrelated survivor buff.
    await applyTurnStartEffects(NAME, STATS, CAMPAIGN);
    h.store.set(h.storeKey(NAME, 'activeBuffs'), [SURVIVOR]);
    // Real combat-start seams write null (useInitiativeEffects / clearPlayerRoundFlags / handleClear).
    // All three seam values (null/undefined/false) hit the same truthiness guard — pin the one they actually write.
    await setRuntimeValue(NAME, 'dreadAmbushSpeedActive', null, CAMPAIGN);
    vi.clearAllMocks();
    h.combatRoundRef.round = 1; // new combat — round counter restarts (maturity math owned by #1298)

    await applyTurnStartEffects(NAME, STATS, CAMPAIGN);

    expect(latch()).toBe(true);
    expect(buffs()).toEqual([SURVIVOR, BUFF]); // appended, survivor byte-identical
    expect(dreadWrites()).toEqual([
      [NAME, 'dreadAmbushSpeedActive', true, CAMPAIGN],
      [NAME, 'activeBuffs', [SURVIVOR, BUFF], CAMPAIGN],
    ]);
    expect(dreadLogs()).toHaveLength(1);
    expect(dreadLogs()[0][1].description).toBe(LOG_DESC);

    // Second invocation within the new combat: zero-add.
    await applyTurnStartEffects(NAME, STATS, CAMPAIGN);

    expect(buffs()).toEqual([SURVIVOR, BUFF]);
    expect(dreadWrites()).toHaveLength(2); // unchanged from the re-grant
    expect(dreadLogs()).toHaveLength(1);
  });
});
