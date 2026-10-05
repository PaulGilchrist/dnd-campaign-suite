// CLA-100: Dread Ambush (Gloom Stalker) Ambusher's Leap — once-per-COMBAT
// speed_boost grant lifecycle. The dreadAmbushSpeedActive latch must block
// duplicate grants within one combat, but be reset at the combat-start seams
// (initiative-rolled via useInitiativeEffects.buildInitiativeUpdates /
// Initiative.clearPlayerRoundFlags, Initiative Clear via handleClear) so the
// round-1 turn-start of each NEW combat re-grants.
import { describe, it, expect, vi, beforeEach } from 'vitest';

const h = vi.hoisted(() => {
    const store = new Map();
    return {
        store,
        storeKey: (name, prop) => `${name}|${prop}`,
        combatRoundRef: { round: 1 },
        addEntry: vi.fn().mockResolvedValue(undefined),
    };
});

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn((name, prop) => h.store.get(h.storeKey(name, prop)) ?? null),
  setRuntimeValue: vi.fn(async (name, prop, value) => { h.store.set(h.storeKey(name, prop), value); }),
  getAllStoreKeys: vi.fn(() => []),
}));

vi.mock('../../ui/utils.js', () => ({
  default: { getName: vi.fn((val) => String(val)) },
}));

vi.mock('../../ui/storage.js', () => ({
  default: { set: vi.fn().mockResolvedValue(undefined) },
}));

vi.mock('../../encounters/combatData.js', () => ({
  getCurrentCombatRound: vi.fn(() => h.combatRoundRef.round),
  getActiveCreatureName: vi.fn(() => null),
  getCombatSummary: vi.fn(() => ({ round: h.combatRoundRef.round })),
  loadCombatSummary: vi.fn(),
  setCombatSummaryCache: vi.fn(),
}));

vi.mock('../../combat/automation/automationExpressions.js', () => ({
  evaluateAutoExpression: vi.fn((expr) => (typeof expr === 'number' ? expr : 1)),
}));

vi.mock('../../ui/logService.js', () => ({
  addEntry: (...args) => h.addEntry(...args),
}));

vi.mock('../../automation/handlers/buffs/tempHpService.js', () => ({
  setTempHp: vi.fn(),
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
vi.mock('../features/whirlwindService.js', () => ({
  applyWhirlwindTurnStart: vi.fn().mockResolvedValue(undefined),
}));

import { applyTurnStartEffects } from './turnStartEffects.js';

const NAME = 'FeyRanger';
const CAMPAIGN = 'test-campaign';
const STATS = { turnStartEffects: [{ type: 'dread_ambush_speed', bonusExpression: '10' }] };

function resetStore() {
  h.store.clear();
  h.combatRoundRef.round = 1;
  h.addEntry.mockClear();
}

function latch() {
  return h.store.get(h.storeKey(NAME, 'dreadAmbushSpeedActive'));
}

function dreadLogs() {
  return h.addEntry.mock.calls.filter(([, e]) => e && e.abilityName === 'Dread Ambush');
}

describe('CLA-100 Dread Ambush Ambusher\'s Leap re-grant lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStore();
  });

  it('grants the speed_boost and latches on the round-1 first turn of combat #1', async () => {
    await applyTurnStartEffects(NAME, STATS, CAMPAIGN);

    expect(latch()).toBe(true);
    expect(h.store.get(h.storeKey(NAME, 'activeBuffs'))).toEqual([
      { name: 'Dread Ambush', effect: 'speed_boost', duration: 'until_end_of_turn', speedBonus: 10 },
    ]);
    expect(dreadLogs()).toHaveLength(1);
    expect(dreadLogs()[0][1]).toMatchObject({
      type: 'ability_use',
      characterName: NAME,
      abilityName: 'Dread Ambush',
    });
  });

  it('blocks a duplicate grant later in the SAME combat (latch stays true)', async () => {
    await applyTurnStartEffects(NAME, STATS, CAMPAIGN);
    h.addEntry.mockClear();

    // Next turn-start while round is still 1: latch blocks the re-grant.
    await applyTurnStartEffects(NAME, STATS, CAMPAIGN);

    expect(latch()).toBe(true);
    expect(h.store.get(h.storeKey(NAME, 'activeBuffs'))).toHaveLength(1);
    expect(dreadLogs()).toHaveLength(0);

    // Later rounds are blocked by the round gate — latch untouched, no grant.
    h.combatRoundRef.round = 2;
    await applyTurnStartEffects(NAME, STATS, CAMPAIGN);
    expect(h.store.get(h.storeKey(NAME, 'activeBuffs'))).toHaveLength(1);
    expect(dreadLogs()).toHaveLength(0);
  });

  it('re-grants on the round-1 first turn of combat #2 once a combat-start seam cleared the latch', async () => {
    // Combat #1 grant; its until_end_of_turn buff is later stripped
    // (initiative-roll clearAllExpirationEffects path), leaving the latch.
    await applyTurnStartEffects(NAME, STATS, CAMPAIGN);
    h.store.set(h.storeKey(NAME, 'activeBuffs'), []);
    h.addEntry.mockClear();

    // Simulate the fixed combat-start seams (buildInitiativeUpdates /
    // clearPlayerRoundFlags / handleClear): each clears the latch.
    for (const seamValue of [null, undefined, false]) {
      h.store.set(h.storeKey(NAME, 'dreadAmbushSpeedActive'), seamValue);
      await applyTurnStartEffects(NAME, STATS, CAMPAIGN);

      expect(h.store.get(h.storeKey(NAME, 'activeBuffs'))).toEqual([
        { name: 'Dread Ambush', effect: 'speed_boost', duration: 'until_end_of_turn', speedBonus: 10 },
      ]);
      expect(latch()).toBe(true);
      // Same-combat double-grant stays blocked after the re-grant.
      h.store.set(h.storeKey(NAME, 'activeBuffs'), []);
      await applyTurnStartEffects(NAME, STATS, CAMPAIGN);
      expect(h.store.get(h.storeKey(NAME, 'activeBuffs'))).toEqual([]);
    }
    expect(dreadLogs()).toHaveLength(3);
  });
});
