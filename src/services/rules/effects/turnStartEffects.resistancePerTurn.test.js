// @maintained-by-ai
// Lane: SP-099 re-arm PRODUCER — clearResistanceUsedThisTurnFlags
// (turnStartEffects.js:39-47): the campaign.targetEffects te-scan that
// re-arms resistanceUsedThisTurn for EVERY resistance_damage_reduction
// holder at EVERY creature's turn start, before the playerStats guard
// (turnStartEffects.js:196-197) so EB-monster turns re-arm too.
// Cited BY handlePlainDamage.resistanceReArm.test.js ("the re-arm
// PRODUCER — turnStartEffects clearing the flag at the target's own turn
// start — is owned by turnStartEffects.resistancePerTurn.test.js") and
// useLoggedDiceRollDamage.resistance.test.js ("PRODUCER turnStartEffects
// clears the flag") — consumer gates, te matching, 1d4 reduction and
// popup/log shape are owned there, NOT duplicated here.
// DISTINCT from the resistance_clear_turn row in
// turnStartEffects_additional.test.js:113-124 (via the expirations.js
// barrel): that handler dispatches from the ACTIVE creature's own
// turnStartEffects array and writes UNCONDITIONALLY to activeName. This
// lane is store-driven: it writes only where the consumed flag is set, to
// te holders who need not be active — hence the exact-budget rows below
// pin the flag gate, the te discriminant, holder scoping and the
// pre-playerStats boundary, none of which that row can fail on.
// Grant/replace/rest-clearing: resistanceHandler.test.js; concentration
// cleanup: cleanupConcentrationEffects.test.js. No timers: serialization is
// pinned with microtask yields only.
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
    getAllStoreKeys: vi.fn(() => []),
}));

vi.mock('../../ui/utils.js', () => ({
    default: {
        getName: vi.fn((val) => String(val)),
    },
}));

vi.mock('../../ui/storage.js', () => ({
    default: {
        set: vi.fn().mockResolvedValue(undefined),
    },
}));

vi.mock('../../encounters/combatData.js', () => ({
    getCurrentCombatRound: vi.fn(() => 1),
    getActiveCreatureName: vi.fn(),
    getCombatSummary: vi.fn(),
    loadCombatSummary: vi.fn(),
    setCombatSummaryCache: vi.fn(),
}));

vi.mock('../../combat/automation/automationExpressions.js', () => ({
    evaluateAutoExpression: vi.fn(() => 1),
}));

vi.mock('../../ui/logService.js', () => ({
    addEntry: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../automation/handlers/spells/confusionTurnStartHandler.js', () => ({
    handleConfusionTurnStart: vi.fn(),
}));

vi.mock('./auraDamageService.js', () => ({
    applyAuraDamage: vi.fn(),
    applyHolyNimbusDamage: vi.fn(async () => {}),
}));

vi.mock('./toppleCleanup.js', () => ({
    cleanUpToppleConditions: vi.fn(),
}));

vi.mock('../../automation/handlers/buffs/tempHpService.js', () => ({
    setTempHp: vi.fn(),
}));

import { applyTurnStartEffects } from './turnStartEffects.js';
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';

const CAMPAIGN = 'test-campaign';

function resistanceTe(target) {
    return { target, effect: 'resistance_damage_reduction', source: 'Divine_Cleric', chosenType: 'Bludgeoning' };
}

// Store seed: te holders' consumed flags via `flags`; every other read is
// null, which keeps the unmocked co-tenant pre-guard services
// (regainLegendaryUses, rollMonsterRecharges, infernal-wound/whirlwind/
// constrict ticks) inert — each filters its own effect key or early-returns
// on a null read — so the full setRuntimeValue budget below is exact.
function seed({ te = [], flags = {} } = {}) {
    getRuntimeValue.mockImplementation((key, prop) => {
        if (key === 'campaign' && prop === 'targetEffects') return te;
        if (prop === 'resistanceUsedThisTurn') return flags[key] ?? null;
        return null;
    });
    setRuntimeValue.mockImplementation(async () => undefined);
}

describe('SP-099 — resistance re-arm PRODUCER: te-scan clears the consumed flag at EVERY turn start', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        window.dispatchEvent = vi.fn();
    });

    // One exact full-write-budget table: the scan writes
    // [holder, 'resistanceUsedThisTurn', false, campaignName] for EXACTLY
    // the resistance te holders whose flag is set — at another creature's
    // turn, at their own turn, and nowhere else.
    it.each([
        {
            label: "another creature's turn start re-arms the holder (EB monster, no playerStats — pre-guard seam)",
            activeName: 'Thug 2', playerStats: undefined,
            te: [resistanceTe('Divine_Cleric')], flags: { Divine_Cleric: true },
            writes: [['Divine_Cleric', 'resistanceUsedThisTurn', false, CAMPAIGN]],
        },
        {
            label: "the protected holder's own turn start re-arms it",
            activeName: 'Divine_Cleric', playerStats: { turnStartEffects: [] },
            te: [resistanceTe('Divine_Cleric')], flags: { Divine_Cleric: true },
            writes: [['Divine_Cleric', 'resistanceUsedThisTurn', false, CAMPAIGN]],
        },
        {
            label: 'scopes to te holders — a consumed flag on a creature without the te survives',
            activeName: 'Thug 2', playerStats: undefined,
            te: [resistanceTe('Divine_Cleric')],
            flags: { Divine_Cleric: true, 'Thug 1': true },
            writes: [['Divine_Cleric', 'resistanceUsedThisTurn', false, CAMPAIGN]],
        },
        {
            label: 'flag not consumed — no spurious re-arm POST',
            activeName: 'Thug 1', playerStats: undefined,
            te: [resistanceTe('Divine_Cleric')], flags: { Divine_Cleric: false },
            writes: [],
        },
        {
            label: 'non-resistance te — discriminant gate, zero writes',
            activeName: 'Thug 1', playerStats: undefined,
            te: [{ target: 'Divine_Cleric', effect: 'ray_of_enfeeble_debuff', source: 'TestFighter' }],
            flags: { Divine_Cleric: true },
            writes: [],
        },
        {
            label: 'malformed te (null entry, target-less te) — no crash, zero writes',
            activeName: 'Thug 1', playerStats: undefined,
            te: [null, { effect: 'resistance_damage_reduction', source: 'Divine_Cleric' }],
            flags: { Divine_Cleric: true },
            writes: [],
        },
        {
            label: 'no turn boundary (no active creature) — consumed flag stays consumed',
            activeName: undefined, playerStats: undefined,
            te: [resistanceTe('Divine_Cleric')], flags: { Divine_Cleric: true },
            writes: [],
        },
    ])('writes exactly the consumed resistance te holders: $label', async ({ activeName, playerStats, te, flags, writes }) => {
        seed({ te, flags });

        await applyTurnStartEffects(activeName, playerStats, CAMPAIGN);

        expect(setRuntimeValue.mock.calls).toEqual(writes);
    });

    // Pitfall 21: each setRuntimeValue POSTs the full store snapshot, so the
    // scan must keep exactly ONE write in flight, in te order, and keep
    // iterating past non-matching entries. Microtask yields (no timers)
    // distinguish sequential from fire-and-forget/parallel dispatch, which
    // would interleave as start:start:end:end.
    it('clears multiple holders sequentially in te order — one POST in flight, iterates past skipped te', async () => {
        const events = [];
        seed({
            te: [
                resistanceTe('Divine_Cleric'),
                { target: 'Thug 1', effect: 'ray_of_enfeeble_debuff', source: 'TestFighter' },
                resistanceTe('War_Cleric'),
            ],
            flags: { Divine_Cleric: true, War_Cleric: true },
        });
        setRuntimeValue.mockImplementation(async (key, prop) => {
            if (prop !== 'resistanceUsedThisTurn') return undefined;
            events.push(`start:${key}`);
            await Promise.resolve();
            await Promise.resolve();
            events.push(`end:${key}`);
            return undefined;
        });

        await applyTurnStartEffects('Thug 2', undefined, CAMPAIGN);

        expect(events).toEqual([
            'start:Divine_Cleric',
            'end:Divine_Cleric',
            'start:War_Cleric',
            'end:War_Cleric',
        ]);
    });
});
