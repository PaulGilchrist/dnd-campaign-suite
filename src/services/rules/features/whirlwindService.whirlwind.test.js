// @maintained-by-ai
// MA-0610: whirlwindService — SOLE owner of the REAL applyWhirlwindTurnStart
// body: the Djinni Create Whirlwind turn-START recurring tick. Lane boundary:
//   - Arming/registration is NOT here: zone dict → te transport bytes live in
//     MonsterCardModal.zoneTeForAction + SaveAttackAoeModal.armZoneTargets
//     (pinned by MonsterCardModal.whirlwind-zone.test.jsx, which cites this
//     file as the recurring-tick owner).
//   - The turn-END repeat save (STR DC 17 tie-breaks, MA-0303 case fallbacks,
//     no-dc guard) is repeatSaveService's face (#1405) via navigationHandlers
//     :236 — cited, not re-run. Whirlwind does NOT ride armRepeatSaveClause
//     (that is the Thri-Kreen saveProcessing fork); it rides zone registration.
// THIS lane: te-keyed (effect === 'whirlwind' && target === activeName — the
// filter is source-blind, order-of-arrival tes[0] wins) + Restrained-gated
// untyped HP loss at the ACTIVE creature's turn start, BEFORE the playerStats
// guard in turnStartEffects.js so PC AND monster victims tick alike (MA-0367
// infernal-wound seam twin; constrictGrappleService.test.js is its sibling).
// Disk canon (monsters.json Djinni actions[3].zone): radius_ft 20,
// recurring_damage '6d6' Thunder, repeat_save STR dc 17 restrained,
// dc_success 'none' — shared 5e corpus only, no 2024 monsters.json (#1431).
// Near-miss sibling rows are REAL: Air Elemental 'Whirlwind (Recharge 4-6)'
// and Garuda 'Whirlwind Flight' are instant-save rows with NO zone dict and
// never arm this te. Golden quirk pinned here: the dice roll is consumed
// BEFORE the cs/HP guards (dead victims spend a roll, pay nothing).
// No clock in this service: Date.now() appears only inside log stamps
// (fake-stamped STAMP_MS); concentration/20-ft movement/save latch are
// GM-enforced (§7 advisory, honest copy in the automation log).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const CAMPAIGN = 'test-campaign';
const DJINNI = 'Djinni 1';
const BANDIT = 'Bandit 1';
const PC = 'AasimarTest';
const STAMP_MS = 1761000000000;

const store = {};       // runtime-store fake: 'owner.key' → value
const reads = [];       // 'owner.key' census of getRuntimeValue
const runtimeWrites = []; // full argument tuples of setRuntimeValue (arity audited)
const logs = [];        // addEntry entries (campaign audited at the fake)
const cacheWrites = []; // full argument tuples of setCombatSummaryCache
const storageWrites = []; // full argument triples of storage.set
const diceCalls = [];   // expressions rolled
const events = [];     // window event types dispatched
let diceQueue = [];    // fixed roll results; unstubbed roll THROWS
let csObj = null;
let csArmed = false;   // loadCombatSummary called un-armed THROWS
let rejectHpLog = false;
let rejectAutoLog = false;
const consoleErrors = []; // captured console.error argument tuples
const REJECT_ERR = new Error('log down');

window.addEventListener('combat-summary-updated', (e) => events.push(e.type));

const seed = (owner, key, value) => { store[`${owner}.${key}`] = value; };
const armCs = (obj) => { csObj = obj; csArmed = true; };
const roll = (rolls) => diceQueue.push({ rolls, total: rolls.reduce((a, b) => a + b, 0) });

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: (...args) => {
        if (args.length !== 3) throw new Error(`whirlwind test: getRuntimeValue arity ${args.length}`);
        const [owner, key, campaignName] = args;
        if (campaignName !== CAMPAIGN) throw new Error(`whirlwind test: unexpected campaign read '${campaignName}'`);
        reads.push(`${owner}.${key}`);
        const k = `${owner}.${key}`;
        if (!(k in store)) throw new Error(`whirlwind test: unseeded read '${k}'`);
        return store[k];
    },
    setRuntimeValue: (...args) => {
        if (args.length !== 4) throw new Error(`whirlwind test: setRuntimeValue arity ${args.length} (4-arity hook, no skipSync)`);
        const [owner, key, value, campaignName] = args;
        if (campaignName !== CAMPAIGN) throw new Error(`whirlwind test: unexpected campaign write '${campaignName}'`);
        runtimeWrites.push(args);
        store[`${owner}.${key}`] = value;
        return Promise.resolve();
    },
}));

vi.mock('../../ui/logService.js', () => ({
    addEntry: (campaignName, entry) => {
        if (campaignName !== CAMPAIGN) throw new Error(`whirlwind test: unexpected campaign log '${campaignName}'`);
        if (entry.type === 'hp_change' && rejectHpLog) return Promise.reject(REJECT_ERR);
        if (entry.type === 'automation' && rejectAutoLog) return Promise.reject(REJECT_ERR);
        logs.push(entry);
        return Promise.resolve();
    },
}));

vi.mock('../../dice/diceRoller.js', () => ({
    rollExpression: (expr) => {
        if (typeof expr !== 'string') throw new Error(`whirlwind test: rollExpression non-string '${expr}'`);
        diceCalls.push(expr);
        const result = diceQueue.shift();
        if (!result) throw new Error('whirlwind test: unstubbed dice roll');
        return result;
    },
}));

vi.mock('../../encounters/combatData.js', () => ({
    loadCombatSummary: (campaignName) => {
        if (campaignName !== CAMPAIGN) throw new Error(`whirlwind test: unexpected campaign cs '${campaignName}'`);
        if (!csArmed) throw new Error('whirlwind test: loadCombatSummary called un-armed');
        return Promise.resolve(csObj);
    },
    setCombatSummaryCache: (...args) => {
        if (args.length !== 2) throw new Error(`whirlwind test: setCombatSummaryCache arity ${args.length}`);
        if (args[1] !== CAMPAIGN) throw new Error(`whirlwind test: unexpected campaign cache write '${args[1]}'`);
        cacheWrites.push(args);
    },
}));

vi.mock('../../ui/storage.js', () => ({
    default: {
        set: (...args) => {
            if (args.length !== 3) throw new Error(`whirlwind test: storage.set arity ${args.length}`);
            if (args[2] !== CAMPAIGN) throw new Error(`whirlwind test: unexpected campaign storage '${args[2]}'`);
            storageWrites.push(args);
        },
    },
}));

import { applyWhirlwindTurnStart, WHIRLWIND_TE } from './whirlwindService.js';

// Disk-canonical te exactly as SaveAttackAoeModal.armZoneTargets + the
// MA-0610 descriptor forwarders stamp it from the Djinni zone dict.
function te(over = {}) {
    return {
        target: BANDIT,
        effect: WHIRLWIND_TE,
        source: DJINNI,
        dc: 17,
        duration: 'until_end_of_zone',
        radiusFt: 20,
        recurringDie: '6d6',
        recurringType: 'Thunder',
        repeatSave: { saveType: 'Strength', dc: 17, condition: 'restrained' },
        ...over,
    };
}

const banditVictim = (currentHp = 999) => ({
    name: BANDIT, type: 'npc', currentHp, maxHp: 999, saveBonuses: {}, hit_points: { current: currentHp },
});
const djinniRow = () => ({ name: DJINNI, type: 'npc', currentHp: 218, maxHp: 218, saveBonuses: {} });

let nowSpy;
let consoleSpy;

beforeEach(() => {
    for (const k of Object.keys(store)) delete store[k];
    reads.length = 0;
    runtimeWrites.length = 0;
    logs.length = 0;
    cacheWrites.length = 0;
    storageWrites.length = 0;
    diceCalls.length = 0;
    events.length = 0;
    diceQueue.length = 0;
    csObj = null;
    csArmed = false;
    rejectHpLog = false;
    rejectAutoLog = false;
    nowSpy = vi.spyOn(Date, 'now').mockReturnValue(STAMP_MS);
    consoleErrors.length = 0;
    consoleSpy = vi.spyOn(console, 'error').mockImplementation((...a) => { consoleErrors.push(a); });
});

afterEach(() => {
    nowSpy.mockRestore();
    consoleSpy.mockRestore();
});

describe('whirlwindService — MA-0610 turn-START tick consumer (Djinni whirlwind lane)', () => {
    it('monster victim: canonical 6d6 Thunder tick pays through the detached cs copy with exact log envelopes', async () => {
        seed('campaign', 'targetEffects', [te()]);
        seed(BANDIT, 'activeConditions', ['restrained']);
        const loaded = { creatures: [banditVictim(999), djinniRow()] };
        armCs(loaded);
        const puritySnapshot = JSON.parse(JSON.stringify(loaded));
        roll([5, 4, 3, 2, 3, 2]); // fixed 19

        await applyWhirlwindTurnStart(BANDIT, CAMPAIGN);

        // Monster lane never touches runtime HP keys — read-order census exact.
        expect(reads).toEqual(['campaign.targetEffects', `${BANDIT}.activeConditions`]);
        expect(diceCalls).toEqual(['6d6']);
        expect(runtimeWrites).toEqual([]);

        // Detached copy: exact full-set creatures, legacy hit_points mirror kept.
        expect(cacheWrites.length).toBe(1);
        expect(cacheWrites[0].length).toBe(2);
        const detached = cacheWrites[0][0];
        expect(detached).not.toBe(loaded);
        expect(detached.creatures).toEqual([
            { name: BANDIT, type: 'npc', currentHp: 980, maxHp: 999, saveBonuses: {}, hit_points: { current: 980 } },
            djinniRow(), // survivor untouched, never logged
        ]);
        // Input purity: the loaded summary object itself is never mutated.
        expect(loaded).toEqual(puritySnapshot);

        // Serialized write queue + broadcast: exact tuples, same-object identity.
        expect(storageWrites.length).toBe(1);
        expect(storageWrites[0][0]).toBe('combatSummary');
        expect(storageWrites[0][1]).toBe(detached);
        expect(storageWrites[0][2]).toBe(CAMPAIGN);
        expect(events).toEqual(['combat-summary-updated']);

        // Exact log envelopes, em-dash bytes included.
        expect(logs.map(e => e.type)).toEqual(['hp_change', 'automation']);
        expect(logs[0]).toEqual({
            type: 'hp_change',
            targetName: BANDIT,
            delta: -19,
            currentHp: 980,
            maxHp: 999,
            isHealing: false,
            isUnconscious: false,
            note: 'Whirlwind turn-start thunder 19 (6d6) from Djinni 1 — Restrained in the whirlwind; repeats the save at turn end.',
            timestamp: STAMP_MS,
        });
        expect(logs[1]).toEqual({
            type: 'automation',
            automationType: 'whirlwind_turn_start_tick',
            characterName: BANDIT,
            sourceName: DJINNI,
            abilityName: 'Create Whirlwind',
            description: 'Bandit 1 is Restrained in Djinni 1\'s whirlwind — takes 19 Thunder damage (6d6) at the start of its turn (turn-end repeat save still to come; zone concentration, 20-ft/turn movement and the once-per-turn save latch are GM-enforced).',
            timestamp: STAMP_MS,
        });
    });

    it('PC victim (pre-playerStats seam): CAPITALISED Restrained store ticks through runtime currentHitPoints, death-clamped at 0, never rewrites cs', async () => {
        seed('campaign', 'targetEffects', [te({ target: PC })]);
        seed(PC, 'activeConditions', ['Restrained']); // MA-0303 CAPITALISED store form — case gate passes
        seed(PC, 'currentHitPoints', 10);
        seed(PC, 'hitPoints', 50);
        armCs({ creatures: [{ name: PC, type: 'player' }] });
        roll([5, 4, 3, 2, 3, 2]); // fixed 19

        await applyWhirlwindTurnStart(PC, CAMPAIGN);

        // Read census: cs currentHp is NEVER consulted for PCs — maxHp rides runtime hitPoints.
        expect(reads).toEqual([
            'campaign.targetEffects',
            `${PC}.activeConditions`,
            `${PC}.currentHitPoints`,
            `${PC}.hitPoints`,
        ]);
        expect(runtimeWrites).toEqual([[PC, 'currentHitPoints', 0, CAMPAIGN]]); // exact 4-arity tuple, clamp at 0
        expect(cacheWrites).toEqual([]);
        expect(storageWrites).toEqual([]);
        expect(events).toEqual([]);

        expect(logs.map(e => e.type)).toEqual(['hp_change', 'automation']);
        expect(logs[0]).toEqual({
            type: 'hp_change',
            targetName: PC,
            delta: -19,
            currentHp: 0,
            maxHp: 50,
            isHealing: false,
            isUnconscious: true,
            note: 'Whirlwind turn-start thunder 19 (6d6) from Djinni 1 — Restrained in the whirlwind; repeats the save at turn end.',
            timestamp: STAMP_MS,
        });
        expect(logs[1]).toEqual({
            type: 'automation',
            automationType: 'whirlwind_turn_start_tick',
            characterName: PC,
            sourceName: DJINNI,
            abilityName: 'Create Whirlwind',
            description: 'AasimarTest is Restrained in Djinni 1\'s whirlwind — takes 19 Thunder damage (6d6) at the start of its turn (turn-end repeat save still to come; zone concentration, 20-ft/turn movement and the once-per-turn save latch are GM-enforced).',
            timestamp: STAMP_MS,
        });
    });

    it('die precedence stateful walk: tes[0].recurringDie wins lowercased, absent die defaults to 6d6 with source defaulting to "the whirlwind"', async () => {
        // Phase A: two whirlwind tes on one victim — FIRST in arrival order owns die+source
        // (filter is target+effect only, source-blind — honest producer-half note).
        seed('campaign', 'targetEffects', [
            te({ recurringDie: '8D6', source: 'Elder Elemental' }),
            te(),
        ]);
        seed(BANDIT, 'activeConditions', ['restrained']);
        armCs({ creatures: [banditVictim(999)] });
        roll([6, 5, 4, 3, 2, 3, 2, 2]); // fixed 27

        await applyWhirlwindTurnStart(BANDIT, CAMPAIGN);

        // Phase B: bare transport te — no recurringDie, no source.
        seed('campaign', 'targetEffects', [{ target: BANDIT, effect: WHIRLWIND_TE, duration: 'until_end_of_zone' }]);
        armCs({ creatures: [banditVictim(999)] });
        roll([5, 4, 3, 2, 3, 2]); // fixed 19

        await applyWhirlwindTurnStart(BANDIT, CAMPAIGN);

        expect(diceCalls).toEqual(['8d6', '6d6']); // explicit normalized lowercase → disk default
        expect(reads).toEqual([
            'campaign.targetEffects', `${BANDIT}.activeConditions`,
            'campaign.targetEffects', `${BANDIT}.activeConditions`,
        ]);
        expect(cacheWrites[0][0].creatures[0].currentHp).toBe(972); // 999 - 27
        expect(cacheWrites[1][0].creatures[0].currentHp).toBe(980); // 999 - 19
        expect(logs.map(e => e.type)).toEqual(['hp_change', 'automation', 'hp_change', 'automation']);
        expect(logs[0].note).toBe('Whirlwind turn-start thunder 27 (8d6) from Elder Elemental — Restrained in the whirlwind; repeats the save at turn end.');
        expect(logs[2].note).toBe('Whirlwind turn-start thunder 19 (6d6) from the whirlwind — Restrained in the whirlwind; repeats the save at turn end.');
        // Golden copy byte of the source-default leg (the doubled "whirlwind's whirlwind" prose).
        expect(logs[3].description).toBe('Bandit 1 is Restrained in the whirlwind\'s whirlwind — takes 19 Thunder damage (6d6) at the start of its turn (turn-end repeat save still to come; zone concentration, 20-ft/turn movement and the once-per-turn save latch are GM-enforced).');
    });

    it('Restrained gate never rolls: real near-miss containment store, empty store, and non-array string form', async () => {
        seed('campaign', 'targetEffects', [te()]);
        seed(BANDIT, 'activeConditions', ['grappled', 'prone']); // REAL near-miss conditions
        await applyWhirlwindTurnStart(BANDIT, CAMPAIGN);

        seed(BANDIT, 'activeConditions', 'restrained'); // non-array string — Array.isArray guard inert
        await applyWhirlwindTurnStart(BANDIT, CAMPAIGN);

        // diceQueue empty — ANY roll attempt THROWS (loud, not silent).
        expect(diceCalls).toEqual([]);
        expect(reads).toEqual([
            'campaign.targetEffects', `${BANDIT}.activeConditions`,
            'campaign.targetEffects', `${BANDIT}.activeConditions`,
        ]);
        expect(runtimeWrites).toEqual([]);
        expect(cacheWrites).toEqual([]);
        expect(storageWrites).toEqual([]);
        expect(logs).toEqual([]);
        expect(events).toEqual([]);
    });

    it('te filter inert: foreign effect / foreign target / effect-less / null entries and undefined activeName', async () => {
        seed('campaign', 'targetEffects', [
            te({ effect: 'constrict_grapple' }),
            te({ target: 'Bandit 2' }),
            { target: BANDIT, source: DJINNI }, // no effect key
            null,
        ]);
        seed(BANDIT, 'activeConditions', ['restrained']); // Restrained stands, but no matching te

        await applyWhirlwindTurnStart(undefined, CAMPAIGN); // !activeName guard: zero reads
        await applyWhirlwindTurnStart(BANDIT, CAMPAIGN);

        expect(reads).toEqual(['campaign.targetEffects']); // undefined-name paid nothing; filter stopped at the scan
        expect(diceCalls).toEqual([]);
        expect(runtimeWrites).toEqual([]);
        expect(cacheWrites).toEqual([]);
        expect(logs).toEqual([]);
        expect(events).toEqual([]);
    });

    it('dead victim spends the dice roll then pays nothing (golden order: roll BEFORE cs/HP guards)', async () => {
        seed('campaign', 'targetEffects', [te()]);
        seed(BANDIT, 'activeConditions', ['restrained']);
        armCs({ creatures: [banditVictim(0)] });
        roll([5, 4, 3, 2, 3, 2]); // consumed and discarded — never a negative tick

        await applyWhirlwindTurnStart(BANDIT, CAMPAIGN);

        expect(diceCalls).toEqual(['6d6']); // quirk pinned: 0-HP targets still burn the roll
        expect(cacheWrites).toEqual([]);
        expect(runtimeWrites).toEqual([]);
        expect(logs).toEqual([]);
        expect(events).toEqual([]);
    });

    it('log failures never block the HP payment — each leg swallowed with its exact prefixed console.error', async () => {
        seed('campaign', 'targetEffects', [te()]);
        seed(BANDIT, 'activeConditions', ['restrained']);

        rejectHpLog = true;
        armCs({ creatures: [banditVictim(999)] });
        roll([5, 4, 3, 2, 3, 2]);
        await expect(applyWhirlwindTurnStart(BANDIT, CAMPAIGN)).resolves.toBeUndefined();

        // Payment and broadcast completed despite the dead hp log; automation log survived.
        expect(cacheWrites.length).toBe(1);
        expect(storageWrites[0][1]).toBe(cacheWrites[0][0]);
        expect(events).toEqual(['combat-summary-updated']);
        expect(logs.map(e => e.type)).toEqual(['automation']);
        expect(consoleErrors).toEqual([['[whirlwindService:turn-start-tick]', REJECT_ERR]]);

        rejectHpLog = false;
        rejectAutoLog = true;
        logs.length = 0;
        cacheWrites.length = 0;
        storageWrites.length = 0;
        diceQueue.length = 0;
        roll([5, 4, 3, 2, 3, 2]);
        await expect(applyWhirlwindTurnStart(BANDIT, CAMPAIGN)).resolves.toBeUndefined();

        expect(logs.map(e => e.type)).toEqual(['hp_change']);
        expect(consoleErrors).toEqual([
            ['[whirlwindService:turn-start-tick]', REJECT_ERR],
            ['[whirlwindService:tick-log]', REJECT_ERR],
        ]);
    });
});
