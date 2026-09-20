// MA-0610: whirlwindService — Djinni Create Whirlwind turn-start recurring
// tick. The MA-0042/MA-0043 zone picker arms the registered `whirlwind` te on
// covered creatures (failed save → Restrained via MA-0063); this consumer is
// the MA-0367 infernal-wound pre-playerStats seam twin: RAW "At the start of
// each of its turns, the Restrained target takes 21 (6d6) Thunder damage" —
// te-keyed + Restrained-gated untyped HP loss for PC AND monster victims.
// A creature inside the zone that saved (no Restrained) never ticks.
import { describe, it, expect, vi, beforeEach } from 'vitest';

const runtimeStore = {};
const addEntryLogs = [];
const storageWrites = [];
const cacheWrites = [];

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: (name, key) => runtimeStore[`${name}.${key}`] ?? null,
    setRuntimeValue: (name, key, value) => { runtimeStore[`${name}.${key}`] = value; return Promise.resolve(); },
}));

vi.mock('../../ui/logService.js', () => ({
    addEntry: (_c, entry) => { addEntryLogs.push(entry); return Promise.resolve(); },
}));

const rollExpression = vi.fn(() => ({ total: 19, rolls: [5, 4, 3, 2, 3, 2], modifier: 0 }));
vi.mock('../../dice/diceRoller.js', () => ({
    rollExpression: (...args) => rollExpression(...args),
}));

let loadedCombatSummary = { creatures: [] };
vi.mock('../../encounters/combatData.js', () => ({
    loadCombatSummary: async () => loadedCombatSummary,
    getCurrentCombatRound: () => 1,
    getCombatSummary: () => loadedCombatSummary,
    setCombatSummaryCache: (cs) => cacheWrites.push(cs),
}));

vi.mock('../../ui/storage.js', () => ({
    default: { set: (_k, v) => { storageWrites.push(v); } },
}));

import { applyWhirlwindTurnStart, WHIRLWIND_TE } from './whirlwindService.js';

const CAMPAIGN = 'test-campaign';
const DJINNI = 'Djinni 1';
const BANDIT = 'Bandit 1';

function teWith(descriptor = {}) {
    runtimeStore['campaign.targetEffects'] = [{
        target: BANDIT,
        effect: WHIRLWIND_TE,
        source: DJINNI,
        duration: 'until_end_of_zone',
        dc: 17,
        radiusFt: 20,
        ...descriptor,
    }];
}

function npcCreature(name, hp) {
    return { name, type: 'npc', currentHp: hp, maxHp: hp, saveBonuses: {} };
}

beforeEach(() => {
    vi.clearAllMocks();
    for (const k of Object.keys(runtimeStore)) delete runtimeStore[k];
    addEntryLogs.length = 0;
    storageWrites.length = 0;
    cacheWrites.length = 0;
    rollExpression.mockReturnValue({ total: 19, rolls: [5, 4, 3, 2, 3, 2], modifier: 0 });
    loadedCombatSummary = { creatures: [npcCreature(BANDIT, 999)] };
});

describe('applyWhirlwindTurnStart', () => {
    it('ticks untyped 6d6 Thunder + logs on a Restrained whirlwind holder', async () => {
        teWith({ recurringDie: '6d6', recurringType: 'Thunder' });
        runtimeStore[`${BANDIT}.activeConditions`] = ['restrained'];
        await applyWhirlwindTurnStart(BANDIT, CAMPAIGN);
        expect(rollExpression).toHaveBeenCalledWith('6d6');
        // HP applied through the detached cs copy (monster direct-HP shape).
        expect(cacheWrites.length).toBe(1);
        expect(cacheWrites[0].creatures.find(c => c.name === BANDIT).currentHp).toBe(980);
        const hpLog = addEntryLogs.find(e => e.type === 'hp_change');
        expect(hpLog).toBeTruthy();
        expect(hpLog.delta).toBe(-19);
        expect(hpLog.targetName).toBe(BANDIT);
        expect(/Whirlwind/i.test(hpLog.note)).toBe(true);
        const autoLog = addEntryLogs.find(e => e.type === 'automation' && e.automationType === 'whirlwind_turn_start_tick');
        expect(autoLog).toBeTruthy();
        expect(/GM-enforced/i.test(autoLog.description)).toBe(true);
    });

    it('defaults the die to 6d6 when the te carries no recurringDie', async () => {
        teWith({});
        runtimeStore[`${BANDIT}.activeConditions`] = ['restrained'];
        await applyWhirlwindTurnStart(BANDIT, CAMPAIGN);
        expect(rollExpression).toHaveBeenCalledWith('6d6');
        expect(addEntryLogs.some(e => e.type === 'hp_change')).toBe(true);
    });

    it('never ticks a zone holder WITHOUT Restrained (saved inside the whirlwind)', async () => {
        teWith({ recurringDie: '6d6' });
        runtimeStore[`${BANDIT}.activeConditions`] = [];
        await applyWhirlwindTurnStart(BANDIT, CAMPAIGN);
        expect(rollExpression).not.toHaveBeenCalled();
        expect(addEntryLogs.some(e => e.type === 'hp_change')).toBe(false);
        expect(cacheWrites.length).toBe(0);
    });

    it('is a no-op with no whirlwind te on the active creature', async () => {
        runtimeStore[`${BANDIT}.activeConditions`] = ['restrained'];
        await applyWhirlwindTurnStart(BANDIT, CAMPAIGN);
        expect(rollExpression).not.toHaveBeenCalled();
        expect(addEntryLogs.length).toBe(0);
    });

    it('ticks a PC victim through runtime currentHitPoints (pre-playerStats seam)', async () => {
        const PC = 'AasimarTest';
        loadedCombatSummary = { creatures: [{ name: PC, type: 'player' }] };
        runtimeStore[`${PC}.currentHitPoints`] = 50;
        runtimeStore[`${PC}.hitPoints`] = 50;
        runtimeStore[`${PC}.activeConditions`] = ['restrained'];
        runtimeStore['campaign.targetEffects'] = [{ target: PC, effect: WHIRLWIND_TE, source: DJINNI, recurringDie: '6d6' }];
        await applyWhirlwindTurnStart(PC, CAMPAIGN);
        expect(runtimeStore[`${PC}.currentHitPoints`]).toBe(31);
    });

    it('skips a 0-HP victim (death clamp — no negative tick)', async () => {
        teWith({ recurringDie: '6d6' });
        loadedCombatSummary = { creatures: [npcCreature(BANDIT, 0)] };
        runtimeStore[`${BANDIT}.activeConditions`] = ['restrained'];
        await applyWhirlwindTurnStart(BANDIT, CAMPAIGN);
        expect(cacheWrites.length).toBe(0);
        expect(addEntryLogs.some(e => e.type === 'hp_change')).toBe(false);
    });
});
