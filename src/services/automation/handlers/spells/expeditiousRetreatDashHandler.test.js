// @maintained-by-ai
// SP-128 lane: Expeditious Retreat Dash handler (bonus-action Dash → speed_boost
// grant). Owns: cast grant (exact buff/latch/expiration/log bytes), serialization
// of second same-turn click via a faithful store, round-wrap re-arm, and guard
// refusals. Cross-lane owners (not duplicated here): cast stamp + grant flag →
// rules/features/expeditiousRetreatService.test.js; turn-start latch re-offer →
// rules/effects/turnStartEffects.expeditious-retreat-dash-offer.test.js;
// concentration purge of flag/latch/buff → concentrationService.sp128-er-purge.test.js;
// speed_boost consumption by sheet Speed → charSummaryCalc.ft105-dash-speed.test.js.
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { handle } from './expeditiousRetreatDashHandler.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../encounters/combatData.js', () => ({
    getCurrentCombatRound: vi.fn(),
    getCombatSummary: vi.fn(() => null),
}));

vi.mock('../../../rules/effects/expirations.js', () => ({
    addExpiration: vi.fn(),
}));

import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { addEntry } from '../../../ui/logService.js';
import { getCurrentCombatRound } from '../../../encounters/combatData.js';
import { addExpiration } from '../../../rules/effects/expirations.js';

const CAMPAIGN_NAME = 'test-campaign';
const CASTER = 'AberrantSorcerer';
const GRANT_FLAG = 'expeditiousRetreatActive';
const LATCH = '_Expeditious_Retreat_dash_usedRound';
const DASH_NAME = 'Dash (Expeditious Retreat)';

const ACTION = {
    name: DASH_NAME,
    description: 'Take the Dash action — Speed doubles until end of turn.',
    automation: { type: 'expeditious_retreat_dash', action: 'bonus_action', casting_time: '1 bonus action' },
};

// Faithful in-memory runtime store: writes are readable on the next read,
// so second-click refusals exercise real state, not scripted per-test mocks.
const store = new Map();
const key = (name, k) => `${name}::${k}`;

let currentRound = 4;

function stampBuffEntry(speed) {
    return { name: DASH_NAME, effect: 'speed_boost', speedBonus: speed, duration: 'until_end_of_turn' };
}

function logCalls(type) {
    return vi.mocked(addEntry).mock.calls.map(c => c[1]).filter(e => e.automationType === type);
}

describe('expeditiousRetreatDashHandler (SP-128)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        store.clear();
        store.set(key(CASTER, GRANT_FLAG), true);
        currentRound = 4;
        vi.mocked(getRuntimeValue).mockImplementation((name, k) => store.get(key(name, k)) ?? null);
        vi.mocked(setRuntimeValue).mockImplementation(async (name, k, value) => {
            store.set(key(name, k), value);
        });
        vi.mocked(getCombatContext).mockResolvedValue({ round: currentRound, activeCreatureName: CASTER });
        vi.mocked(getCurrentCombatRound).mockImplementation(() => currentRound);
    });

    it.each([
        { label: 'doubles base speed', speed: 30, bonus: 30 },
        { label: 'defaults speed 30 when missing', speed: undefined, bonus: 30 },
    ])('grants Dash: $label — exact buff/latch/expiration/log bytes, popup once', async ({ speed, bonus }) => {
        const result = await handle(ACTION, { name: CASTER, speed }, CAMPAIGN_NAME);

        expect(result).toEqual({
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: DASH_NAME,
                automationType: 'expeditious_retreat_dash',
                description: `You take the Dash action (Expeditious Retreat). Speed doubled ${bonus} → ${bonus * 2} ft until the end of the turn. You can take it again as a Bonus Action on each of your turns until Concentration ends.`,
                automation: ACTION.automation,
            },
        });

        // CLA-371: latch stamp is written before the buff write (serializes clicks).
        const latchIdx = vi.mocked(setRuntimeValue).mock.calls.findIndex(c => c[1] === LATCH);
        const buffIdx = vi.mocked(setRuntimeValue).mock.calls.findIndex(c => c[1] === 'activeBuffs');
        expect(latchIdx).toBeGreaterThanOrEqual(0);
        expect(buffIdx).toBeGreaterThanOrEqual(0);
        expect(latchIdx).toBeLessThan(buffIdx);

        expect(store.get(key(CASTER, LATCH))).toBe(4);
        expect(store.get(key(CASTER, 'activeBuffs'))).toEqual([stampBuffEntry(bonus)]);

        expect(addExpiration).toHaveBeenCalledTimes(1);
        expect(vi.mocked(addExpiration).mock.calls[0][0]).toEqual({
            attackerName: CASTER,
            targetName: CASTER,
            effects: [{ type: 'remove_active_buff', buffName: DASH_NAME }],
            campaignName: CAMPAIGN_NAME,
            expireOnCreatureName: CASTER,
        });

        expect(logCalls('dash_bonus')).toEqual([{
            type: 'ability_use',
            characterName: CASTER,
            abilityName: DASH_NAME,
            automationType: 'dash_bonus',
            description: `Dash (Expeditious Retreat): Speed doubled ${bonus} → ${bonus * 2} ft until the end of the turn (+${bonus} ft speed_boost).`,
            timestamp: expect.any(Number),
        }]);
    });

    it('refuses a second same-turn click after the first resolves: refused log, no double buff, no new writes', async () => {
        await handle(ACTION, { name: CASTER, speed: 30 }, CAMPAIGN_NAME);

        const writesAfterFirst = vi.mocked(setRuntimeValue).mock.calls.length;
        const result = await handle(ACTION, { name: CASTER, speed: 30 }, CAMPAIGN_NAME);

        expect(result.payload.description).toBe('Once per turn — the Expeditious Retreat Dash has already been taken this turn.');
        expect(logCalls('expeditious_retreat_dash_refused')).toHaveLength(1);
        expect(vi.mocked(setRuntimeValue).mock.calls).toHaveLength(writesAfterFirst);
        expect(addExpiration).toHaveBeenCalledTimes(1);
        expect(store.get(key(CASTER, 'activeBuffs'))).toEqual([stampBuffEntry(30)]);
    });

    it('re-arms on a later round: second grant succeeds, latch moves, stale buff replaced not stacked', async () => {
        await handle(ACTION, { name: CASTER, speed: 30 }, CAMPAIGN_NAME);

        currentRound = 5;
        vi.mocked(getCombatContext).mockResolvedValue({ round: 5, activeCreatureName: CASTER });
        const result = await handle(ACTION, { name: CASTER, speed: 30 }, CAMPAIGN_NAME);

        expect(result.type).toBe('popup');
        expect(logCalls('expeditious_retreat_dash_refused')).toHaveLength(0);
        expect(store.get(key(CASTER, LATCH))).toBe(5);
        expect(store.get(key(CASTER, 'activeBuffs'))).toEqual([stampBuffEntry(30)]);
    });

    it.each([
        {
            label: 'grant flag cleared (concentration broken)',
            setup: () => store.delete(key(CASTER, GRANT_FLAG)),
            reason: 'Expeditious Retreat is not active — cast the spell to gain the Dash Bonus Action.',
        },
        {
            label: 'no combat context',
            setup: () => vi.mocked(getCombatContext).mockResolvedValue(null),
            reason: `No combat context found. Cannot use ${DASH_NAME}.`,
        },
        {
            label: "not your turn (__initiative__ owner differs)",
            setup: () => store.set(key('__initiative__', 'lastAppliedTurnStartCreature'), '4:Bandit'),
            reason: `It is Bandit's turn — the Expeditious Retreat Dash is a Bonus Action on your own turn.`,
        },
    ])('refuses when $label: refusal popup + refused log, zero game-state writes', async ({ setup, reason }) => {
        setup();

        const result = await handle(ACTION, { name: CASTER, speed: 30 }, CAMPAIGN_NAME);

        expect(result).toEqual({
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: DASH_NAME,
                automationType: 'expeditious_retreat_dash',
                description: reason,
                automation: ACTION.automation,
            },
        });
        expect(logCalls('expeditious_retreat_dash_refused')).toEqual([{
            type: 'automation',
            characterName: CASTER,
            automationType: 'expeditious_retreat_dash_refused',
            name: DASH_NAME,
            description: `${DASH_NAME} refused — ${reason}`,
            timestamp: expect.any(Number),
        }]);
        expect(setRuntimeValue).not.toHaveBeenCalled();
        expect(addExpiration).not.toHaveBeenCalled();
        expect(logCalls('dash_bonus')).toHaveLength(0);
    });
});
