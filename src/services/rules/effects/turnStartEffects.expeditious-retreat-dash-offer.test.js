// SP-128: Expeditious Retreat Dash re-offer at the caster's turn start —
// the expeditious_retreat_dash_offer turn-start lane must clear the
// once-per-turn Dash latch and log the offer ONLY while the cast grant flag
// is active, so the row is re-armed every turn until concentration ends, and
// goes inert once concentrationService clears the flag.
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

const NAME = 'AberrantSorcerer';
const CAMPAIGN = 'test-campaign';
const STATS = { turnStartEffects: [{ type: 'expeditious_retreat_dash_offer' }] };
const LATCH = '_Expeditious_Retreat_dash_usedRound';

function resetStore() {
  h.store.clear();
  h.combatRoundRef.round = 2;
  h.addEntry.mockClear();
}

function offerLogs() {
  return h.addEntry.mock.calls.filter(([, e]) => e && e.abilityName === 'Expeditious Retreat');
}

describe('SP-128 Expeditious Retreat Dash re-offer turn-start lane', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStore();
  });

  it('re-arms the Dash latch and logs the offer while the grant flag is active', async () => {
    h.store.set(h.storeKey(NAME, 'expeditiousRetreatActive'), true);
    h.store.set(h.storeKey(NAME, LATCH), 1); // used last turn

    await applyTurnStartEffects(NAME, STATS, CAMPAIGN);

    expect(h.store.get(h.storeKey(NAME, LATCH))).toBeNull();
    expect(offerLogs()).toHaveLength(1);
    expect(offerLogs()[0][1]).toMatchObject({
      type: 'ability_use',
      characterName: NAME,
      abilityName: 'Expeditious Retreat',
    });
  });

  it('re-arms the latch every turn while the concentration grant stays up', async () => {
    h.store.set(h.storeKey(NAME, 'expeditiousRetreatActive'), true);

    for (const round of [2, 3, 4]) {
      h.combatRoundRef.round = round;
      h.store.set(h.storeKey(NAME, LATCH), round - 1);
      await applyTurnStartEffects(NAME, STATS, CAMPAIGN);
      expect(h.store.get(h.storeKey(NAME, LATCH))).toBeNull();
    }
    expect(offerLogs()).toHaveLength(3);
  });

  it('goes inert once concentration ends (flag cleared): latch untouched, no offer log', async () => {
    h.store.set(h.storeKey(NAME, 'expeditiousRetreatActive'), null);
    h.store.set(h.storeKey(NAME, LATCH), 1);

    await applyTurnStartEffects(NAME, STATS, CAMPAIGN);

    expect(h.store.get(h.storeKey(NAME, LATCH))).toBe(1);
    expect(offerLogs()).toHaveLength(0);
  });
});
