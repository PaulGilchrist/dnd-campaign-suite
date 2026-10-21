// @maintained-by-ai
// SP-128: Expeditious Retreat Dash re-offer at the caster's turn start —
// the expeditious_retreat_dash_offer turn-start lane (turnStartEffects.js
// applyExpeditiousRetreatDashOffer) writes exactly two things while the cast
// grant flag is active: setRuntimeValue(name, '_Expeditious_Retreat_dash_usedRound',
// null, campaign) — 4 args, no skipSync, full-store snapshot POST + SSE — and
// an addEntry ability_use offer row with byte-exact description. It gates ONLY
// on the expeditiousRetreatActive flag, so the offer re-arms EVERY turn start
// (even when the latch is already null) and goes fully inert — zero writes,
// zero logs — once concentrationService purges the flag to null
// (concentrationService.sp128-er-purge.test.js owns the purge shape).
// Cross-lane owners (not duplicated here): cast stamp + grant flag →
// rules/features/expeditiousRetreatService.test.js; Dash execution + same-turn
// serialization → automation/handlers/spells/expeditiousRetreatDashHandler.test.js;
// dispatch/aggregation of the turnStartEffects array →
// effects/turnStartEffects_additional.test.js.
import { describe, it, expect, vi, beforeEach } from 'vitest';

const h = vi.hoisted(() => {
    const store = new Map();
    return {
        store,
        storeKey: (name, prop) => `${name}|${prop}`,
        setRuntimeValue: vi.fn(async (name, prop, value) => { store.set(`${name}|${prop}`, value); }),
        addEntry: vi.fn().mockResolvedValue(undefined),
    };
});

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn((name, prop) => h.store.get(h.storeKey(name, prop)) ?? null),
    setRuntimeValue: h.setRuntimeValue,
    getAllStoreKeys: vi.fn(() => []),
}));

vi.mock('../../ui/utils.js', () => ({
    default: { getName: vi.fn((val) => String(val)) },
}));

vi.mock('../../ui/storage.js', () => ({
    default: { set: vi.fn().mockResolvedValue(undefined) },
}));

vi.mock('../../encounters/combatData.js', () => ({
    getCurrentCombatRound: vi.fn(() => 1),
    getActiveCreatureName: vi.fn(() => null),
    getCombatSummary: vi.fn(() => null),
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
vi.mock('../features/constrictGrappleService.js', () => ({
    applyConstrictGrappleTurnStart: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../features/whirlwindService.js', () => ({
    applyWhirlwindTurnStart: vi.fn().mockResolvedValue(undefined),
}));

import { applyTurnStartEffects } from './turnStartEffects.js';

const NAME = 'AberrantSorcerer';
const CAMPAIGN = 'test-campaign';
const STATS = { turnStartEffects: [{ type: 'expeditious_retreat_dash_offer' }] };
const FLAG = 'expeditiousRetreatActive';
const LATCH = '_Expeditious_Retreat_dash_usedRound';

const OFFER_ENTRY = {
    type: 'ability_use',
    characterName: NAME,
    abilityName: 'Expeditious Retreat',
    description: `${NAME} can take the Dash action as a Bonus Action this turn (Expeditious Retreat).`,
    timestamp: expect.any(Number),
};

describe('SP-128 Expeditious Retreat Dash re-offer turn-start lane', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        h.store.clear();
    });

    it('re-arms the Dash latch and logs the byte-exact offer at EVERY turn start while the grant flag is active', async () => {
        // Turn 1: latch armed by a Dash last turn → cleared, offer logged.
        h.store.set(h.storeKey(NAME, FLAG), true);
        h.store.set(h.storeKey(NAME, LATCH), 1);

        await applyTurnStartEffects(NAME, STATS, CAMPAIGN);

        expect(h.store.get(h.storeKey(NAME, LATCH))).toBeNull();

        // Turn 2: latch already null → the lane must still fire every turn
        // start (gate is the flag alone), re-offering the Dash.
        await applyTurnStartEffects(NAME, STATS, CAMPAIGN);

        expect(h.store.get(h.storeKey(NAME, LATCH))).toBeNull();
        // Whole-invocation write budget: exactly one latch clear per turn,
        // exact tuple with the skipSync position pinned (absent → POST + SSE).
        expect(h.setRuntimeValue.mock.calls).toEqual([
            [NAME, LATCH, null, CAMPAIGN],
            [NAME, LATCH, null, CAMPAIGN],
        ]);
        expect(h.addEntry).toHaveBeenCalledTimes(2);
        expect(h.addEntry).toHaveBeenNthCalledWith(1, CAMPAIGN, OFFER_ENTRY);
        expect(h.addEntry).toHaveBeenNthCalledWith(2, CAMPAIGN, OFFER_ENTRY);
    });

    it('goes inert once the concentration purge nulls the flag: zero writes, zero logs, latch survives byte-identical', async () => {
        // Purge shape owned by concentrationService.sp128-er-purge.test.js:
        // expeditiousRetreatActive written to null, latch untouched (1).
        h.store.set(h.storeKey(NAME, FLAG), null);
        h.store.set(h.storeKey(NAME, LATCH), 1);

        await applyTurnStartEffects(NAME, STATS, CAMPAIGN);

        expect(h.store.get(h.storeKey(NAME, LATCH))).toBe(1);
        expect(h.store.get(h.storeKey(NAME, FLAG))).toBeNull();
        expect(h.setRuntimeValue.mock.calls).toEqual([]);
        expect(h.addEntry).not.toHaveBeenCalled();
    });
});
