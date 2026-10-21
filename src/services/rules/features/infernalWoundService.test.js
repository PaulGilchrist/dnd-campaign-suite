// @maintained-by-ai
// MA-0367 sole-real-body owner (turnStartEffects.infernal-wound.test.js:27 pins the
// dispatch with the service MOCKED; THIS file runs the real body of every export).
// REAL, unmocked: targetEffectDefinitions — registerTargetEffect merge semantics at
// :1492-1506 (target+effect+source find; extraProps.duration overwrites the
// 'concentration' default) and the registry row at :258. Fakes are argument-keyed
// strict: wrong-campaign or unknown-store reads THROW. Fixed-stub dice tables pin
// die structure + exact arithmetic (never real rolls, never in-range-only). Write
// budgets are exact full tuples incl skipSync POSITION (arity 4 = broadcasts live
// HP; arity 5 true = SSE-echo suppression). Logs asserted byte-exact, survivors
// never logged. No clocks: the rounds:10 counter lives in expirationQueue (matured
// at initiative seams by the clear lanes); the only Date.now() here is log metadata.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const CAMPAIGN = 'test-campaign';
const DEVIL = 'Bearded Devil 1';
const DEVIL2 = 'Erinyes 2';
const writes = [];       // setRuntimeValue tuples [name, key, value, campaign, ...rest]
const addEntryLogs = []; // logService.addEntry entries (campaign pre-validated)
const storageWrites = []; // storage.set full tuples
const cacheWrites = [];   // setCombatSummaryCache full tuples
const clockWrites = [];   // expirationQueue.addExpiration full payloads
const diceCalls = [];
let dieTable = {};
let store = new Map();
let knownStores = new Set(['campaign']);
let logMode = 'ok';
let loadedCombatSummary = { creatures: [] };
let consoleErr;

const skey = (name, k, campaign) => {
    if (campaign !== CAMPAIGN) throw new Error(`wrong-campaign access: ${campaign}.${name}.${k}`);
    return `${campaign}|${name}.${k}`;
};
const readStore = (name, k) => {
    if (!knownStores.has(name)) throw new Error(`unknown store read: ${name}.${k}`);
    return store.get(skey(name, k, CAMPAIGN));
};
const seedStore = (name, k, v) => { knownStores.add(name); store.set(skey(name, k, CAMPAIGN), v); };
const teList = () => store.get(skey('campaign', 'targetEffects', CAMPAIGN)) || [];
const pendingOf = (name) => store.get(skey(name, 'pendingExpirations', CAMPAIGN)) || [];
const stripTs = (e) => { const { timestamp, ...rest } = e; expect(typeof timestamp).toBe('number'); return rest; };
const grantWound = (over = {}) => grantInfernalWound({ campaignName: CAMPAIGN, attackerName: DEVIL, targetName: 'Hero', actionName: 'Infernal Glaive', bleedDie: '1d10', ...over });

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: (name, k, campaign) => { skey(name, k, campaign); return readStore(name, k); },
    setRuntimeValue: (name, k, value, campaign, ...rest) => {
        writes.push([name, k, value, campaign, ...rest]);
        knownStores.add(name);
        store.set(skey(name, k, campaign), value);
        return Promise.resolve();
    },
    getAllStoreKeys: () => [...knownStores],
}));

vi.mock('../../ui/logService.js', () => ({
    addEntry: (campaign, entry) => {
        if (campaign !== CAMPAIGN) throw new Error(`addEntry wrong campaign: ${campaign}`);
        if (logMode === 'fail') return Promise.reject(new Error('campaign log unreachable'));
        addEntryLogs.push(entry);
        return Promise.resolve();
    },
}));

vi.mock('../../dice/diceRoller.js', () => ({
    rollExpression: (expr) => {
        diceCalls.push(expr);
        if (!(expr in dieTable)) throw new Error(`unstubbed die: ${expr}`);
        const total = dieTable[expr];
        return { total, rolls: [total], modifier: 0 };
    },
}));

vi.mock('../../encounters/combatData.js', () => ({
    loadCombatSummary: async (campaign) => {
        if (campaign !== CAMPAIGN) throw new Error(`loadCombatSummary wrong campaign: ${campaign}`);
        return loadedCombatSummary;
    },
    setCombatSummaryCache: (...args) => { cacheWrites.push(args); },
}));

// Faithful pendingExpirations write (expirationQueue.addExpiration shape) through the
// same campaign-keyed store; payload captured verbatim for dispatch-pinning. These
// emulated writes are fixture plumbing and bypass the setRuntimeValue recorder —
// the grant/cancel lanes' OWN writes stay exact in `writes`.
vi.mock('../effects/expirationQueue.js', () => ({
    addExpiration: (payload) => {
        clockWrites.push(payload);
        const k = skey(payload.attackerName, 'pendingExpirations', CAMPAIGN);
        seedStore(payload.attackerName, 'pendingExpirations', [...(store.get(k) || []), { target: payload.targetName, effects: payload.effects, appliedRound: 1, expiryRounds: payload.rounds }]);
    },
}));

vi.mock('../../ui/storage.js', () => ({
    default: { set: (...args) => { storageWrites.push(args); } },
}));

import {
    grantInfernalWound,
    applyInfernalWoundBleedTurnStart,
    removeInfernalWoundOnHeal,
    cancelInfernalWoundAfterSaveSuccess,
} from './infernalWoundService.js';
import { getEffectDefinition } from '../../combat/conditions/targetEffectDefinitions.js';

beforeEach(() => {
    vi.resetAllMocks(); // vitest 4 retains creation impls — explicit re-seed below
    dieTable = { '1d10': 7 };
    store = new Map();
    knownStores = new Set(['campaign']);
    logMode = 'ok';
    loadedCombatSummary = { creatures: [] };
    writes.length = 0;
    addEntryLogs.length = 0;
    storageWrites.length = 0;
    cacheWrites.length = 0;
    clockWrites.length = 0;
    diceCalls.length = 0;
    consoleErr = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe('MA-0367 grantInfernalWound', () => {
    it('grant: exact te bytes (extraProps duration overwrites concentration default), ONE rounds:10 clock, byte-exact grant log, skipSync=true write', async () => {
        expect(await grantWound()).toEqual({ granted: true, alreadyWounded: false });

        const te = { target: 'Hero', effect: 'infernal_wound', source: DEVIL, duration: 'until_1_minute', bleedDie: '1d10', actionName: 'Infernal Glaive' };
        expect(teList()).toEqual([te]);
        expect(writes).toEqual([['campaign', 'targetEffects', [te], CAMPAIGN, true]]);

        expect(clockWrites).toEqual([{ attackerName: DEVIL, targetName: 'Hero', campaignName: CAMPAIGN, rounds: 10, effects: [{ type: 'remove_target_effect', effectKey: 'infernal_wound', source: DEVIL, target: 'Hero' }] }]);
        expect(pendingOf(DEVIL)).toEqual([{ target: 'Hero', effects: [{ type: 'remove_target_effect', effectKey: 'infernal_wound', source: DEVIL, target: 'Hero' }], appliedRound: 1, expiryRounds: 10 }]);

        const kiraTe = { target: 'Kira', effect: 'infernal_wound', source: DEVIL, duration: 'until_1_minute', bleedDie: '1d10', actionName: 'Infernal Glaive' };
        expect(await grantWound({ targetName: 'Kira', bleedDie: undefined, actionName: undefined })).toEqual({ granted: true, alreadyWounded: false });
        expect(teList()).toEqual([te, kiraTe]);
        expect(writes[1]).toEqual(['campaign', 'targetEffects', [te, kiraTe], CAMPAIGN, true]);
        expect(clockWrites[1].targetName).toBe('Kira');
        expect(clockWrites[1].rounds).toBe(10);

        expect(addEntryLogs.map(stripTs)).toEqual([
            { type: 'automation', automationType: 'infernal_wound_granted', characterName: 'Hero', sourceName: DEVIL, abilityName: 'Infernal Glaive', description: "Hero failed Bearded Devil 1's Infernal Glaive save (DC 12) — Infernal Wound: loses 1d10 Hit Points at the start of each of its turns (10-round clock = 1 minute). Closes on any healing or a DC 12 Wisdom (Medicine) action (GM-enforced — badge ×)." },
            { type: 'automation', automationType: 'infernal_wound_granted', characterName: 'Kira', sourceName: DEVIL, abilityName: 'Infernal Glaive', description: "Kira failed Bearded Devil 1's Infernal Glaive save (DC 12) — Infernal Wound: loses 1d10 Hit Points at the start of each of its turns (10-round clock = 1 minute). Closes on any healing or a DC 12 Wisdom (Medicine) action (GM-enforced — badge ×)." },
        ]);

        expect(getEffectDefinition('infernal_wound')).toMatchObject({ label: 'Infernal Wound', icon: 'fa-droplet', cls: 'effect-debuff', fields: ['source', 'dc', 'bleedDie'], defaults: { bleedDie: '1d10' } });
    });

    it('already-wounded RAW refusal: no second te, no clock refresh, zero writes on re-fire, byte-exact refused log', async () => {
        expect(await grantWound()).toEqual({ granted: true, alreadyWounded: false });
        const teSnapshot = teList();
        const clockSnapshot = pendingOf(DEVIL);
        const writesSnapshot = [...writes];
        addEntryLogs.length = 0;

        expect(await grantWound()).toEqual({ granted: false, alreadyWounded: true });
        expect(teList()).toEqual(teSnapshot);
        expect(pendingOf(DEVIL)).toEqual(clockSnapshot);
        expect(writes).toEqual(writesSnapshot);
        expect(clockWrites).toHaveLength(1);
        expect(addEntryLogs.map(stripTs)).toEqual([
            { type: 'automation', automationType: 'infernal_wound_refused', characterName: 'Hero', sourceName: DEVIL, abilityName: 'Infernal Glaive', description: "Hero failed Bearded Devil 1's Infernal Glaive save but already has an Infernal Wound — RAW inflicts no second wound (the recurring 1d10 bleed continues under the original clock)." },
        ]);

        expect(await grantWound({ attackerName: DEVIL2 })).toEqual({ granted: false, alreadyWounded: true });
        expect(teList()).toEqual(teSnapshot);
        expect(pendingOf(DEVIL2)).toEqual([]);
    });
});

describe('MA-0367 applyInfernalWoundBleedTurnStart', () => {
    it('PC victim: fixed-stub 1d10 ticks 30→23 via arity-4 broadcast write; floors at 0 + unconscious flag; exact hp_change bytes', async () => {
        seedStore('Hero', 'currentHitPoints', 30);
        seedStore('Hero', 'hitPoints', 50);
        loadedCombatSummary = { creatures: [{ name: 'Hero', type: 'player', currentHp: 30, maxHp: 49 }] };
        await grantWound();
        const wBase = writes.length;
        const logBase = addEntryLogs.length;

        await applyInfernalWoundBleedTurnStart('Hero', CAMPAIGN);

        expect(diceCalls).toEqual(['1d10']);
        expect(readStore('Hero', 'currentHitPoints')).toBe(23);
        expect(writes.slice(wBase)).toEqual([['Hero', 'currentHitPoints', 23, CAMPAIGN]]);
        expect(storageWrites).toEqual([]);
        expect(cacheWrites).toEqual([]);
        expect(addEntryLogs.slice(logBase).map(stripTs)).toEqual([
            { type: 'hp_change', targetName: 'Hero', delta: -7, currentHp: 23, maxHp: 50, isHealing: false, isUnconscious: false, note: 'Infernal Wound (turn-start bleed 7 [1d10], Bearded Devil 1)' },
        ]);

        dieTable = { '1d10': 30 };
        await applyInfernalWoundBleedTurnStart('Hero', CAMPAIGN);
        expect(diceCalls).toEqual(['1d10', '1d10']);
        expect(readStore('Hero', 'currentHitPoints')).toBe(0);
        expect(writes.slice(wBase)).toEqual([['Hero', 'currentHitPoints', 23, CAMPAIGN], ['Hero', 'currentHitPoints', 0, CAMPAIGN]]);
        expect(addEntryLogs.slice(logBase + 1).map(stripTs)).toEqual([
            { type: 'hp_change', targetName: 'Hero', delta: -30, currentHp: 0, maxHp: 50, isHealing: false, isUnconscious: true, note: 'Infernal Wound (turn-start bleed 30 [1d10], Bearded Devil 1)' },
        ]);
    });

    it('monster victims: detached cs copies persist currentHp + hit_points.current (and its absence), original fixture pristine, event fired, exact logs', async () => {
        loadedCombatSummary = { creatures: [
            { name: 'Goblin', type: 'monster', currentHp: 20, maxHp: 20, hit_points: { current: 20, max: 20 } },
            { name: 'Orc', type: 'monster', currentHp: 18, maxHp: 18 },
        ] };
        dieTable = { '1d10': 4 };
        await grantWound({ targetName: 'Goblin' });
        await grantWound({ targetName: 'Orc' });
        const wBase = writes.length;
        const logBase = addEntryLogs.length;
        let evCount = 0;
        const bump = () => { evCount += 1; };
        window.addEventListener('combat-summary-updated', bump);

        await applyInfernalWoundBleedTurnStart('Goblin', CAMPAIGN);
        await applyInfernalWoundBleedTurnStart('Orc', CAMPAIGN);
        window.removeEventListener('combat-summary-updated', bump);

        expect(diceCalls).toEqual(['1d10', '1d10']);
        expect(writes.slice(wBase)).toEqual([]);
        expect(evCount).toBe(2);

        const copies = storageWrites.map(([key0, copy, campaign]) => { expect(key0).toBe('combatSummary'); expect(campaign).toBe(CAMPAIGN); return copy; });
        expect(copies).toHaveLength(2);
        expect(copies[0]).not.toBe(loadedCombatSummary);
        expect(copies[0]).toBe(cacheWrites[0][0]);
        expect(cacheWrites[1][0]).toBe(copies[1]);
        const gob1 = copies[0].creatures.find((c) => c.name === 'Goblin');
        expect(gob1.currentHp).toBe(16);
        expect(gob1.hit_points.current).toBe(16);
        const orc2 = copies[1].creatures.find((c) => c.name === 'Orc');
        expect(orc2.currentHp).toBe(14);
        expect('hit_points' in orc2).toBe(false);
        expect(copies[1].creatures.find((c) => c.name === 'Goblin').currentHp).toBe(20);
        expect(loadedCombatSummary.creatures[0].currentHp).toBe(20);
        expect(loadedCombatSummary.creatures[0].hit_points.current).toBe(20);
        expect(loadedCombatSummary.creatures[1].currentHp).toBe(18);

        expect(addEntryLogs.slice(logBase).map(stripTs)).toEqual([
            { type: 'hp_change', targetName: 'Goblin', delta: -4, currentHp: 16, maxHp: 20, isHealing: false, isUnconscious: false, note: 'Infernal Wound (turn-start bleed 4 [1d10], Bearded Devil 1)' },
            { type: 'hp_change', targetName: 'Orc', delta: -4, currentHp: 14, maxHp: 18, isHealing: false, isUnconscious: false, note: 'Infernal Wound (turn-start bleed 4 [1d10], Bearded Devil 1)' },
        ]);
    });

    it('bleed guards: near-miss te (wrong target / wrong effect) never rolls; 0-Hp victim with default-die te rolls once and writes nothing', async () => {
        seedStore('campaign', 'targetEffects', [
            { target: 'Kira', effect: 'infernal_wound', source: DEVIL, duration: 'until_1_minute', bleedDie: '1d10', actionName: 'Infernal Glaive' },
            { target: 'Hero', effect: 'ink_cloud', source: 'Giant Octopus 1' },
        ]);
        seedStore('Hero', 'currentHitPoints', 30);
        loadedCombatSummary = { creatures: [{ name: 'Hero', type: 'player', currentHp: 30, maxHp: 30 }] };

        await applyInfernalWoundBleedTurnStart('Hero', CAMPAIGN);
        expect(diceCalls).toEqual([]);
        expect(writes).toEqual([]);
        expect(addEntryLogs).toEqual([]);
        expect(storageWrites).toEqual([]);
        expect(cacheWrites).toEqual([]);
        expect(readStore('Hero', 'currentHitPoints')).toBe(30);

        seedStore('campaign', 'targetEffects', [...teList(), { target: 'Hero', effect: 'infernal_wound', source: DEVIL }]);
        seedStore('Hero', 'currentHitPoints', 0);
        loadedCombatSummary = { creatures: [{ name: 'Hero', type: 'player', currentHp: 0, maxHp: 50 }] };

        await applyInfernalWoundBleedTurnStart('Hero', CAMPAIGN);
        expect(diceCalls).toEqual(['1d10']);
        expect(readStore('Hero', 'currentHitPoints')).toBe(0);
        expect(writes).toEqual([]);
        expect(addEntryLogs).toEqual([]);
        expect(storageWrites).toEqual([]);
        expect(cacheWrites).toEqual([]);
    });
});

describe('MA-0367 close seams', () => {
    it('heal closes the wound: strips te + cancels clock, foreign te/clocks byte-survive, exact skipSync writes + log', async () => {
        const kiraTe = { target: 'Kira', effect: 'infernal_wound', source: DEVIL, duration: 'until_1_minute', bleedDie: '1d10', actionName: 'Infernal Glaive' };
        const inkTe = { target: 'Hero', effect: 'ink_cloud', source: 'Giant Octopus 1' };
        seedStore('campaign', 'targetEffects', [kiraTe, inkTe]);
        const kiraClock = { target: 'Kira', effects: [{ type: 'remove_target_effect', effectKey: 'infernal_wound', source: DEVIL, target: 'Kira' }], appliedRound: 1, expiryRounds: 10 };
        const proneClock = { target: 'Hero', effects: [{ type: 'remove_condition', effectKey: 'prone' }], appliedRound: 1, expiryRounds: 5 };
        seedStore(DEVIL, 'pendingExpirations', [kiraClock]);
        seedStore('Hero', 'pendingExpirations', [proneClock]);
        await grantWound();
        const wBase = writes.length;
        const logBase = addEntryLogs.length;

        expect(await removeInfernalWoundOnHeal('Hero', CAMPAIGN)).toBe(true);
        expect(teList()).toEqual([kiraTe, inkTe]);
        expect(pendingOf(DEVIL)).toEqual([kiraClock]);
        expect(pendingOf('Hero')).toEqual([proneClock]);
        expect(writes.slice(wBase)).toEqual([
            ['campaign', 'targetEffects', [kiraTe, inkTe], CAMPAIGN, true],
            [DEVIL, 'pendingExpirations', [kiraClock], CAMPAIGN, true],
        ]);
        expect(addEntryLogs.slice(logBase).map(stripTs)).toEqual([
            { type: 'automation', automationType: 'infernal_wound_closed', characterName: 'Hero', abilityName: 'Infernal Wound', description: 'Hero regained Hit Points — the Infernal Wound closes and its 1-minute clock is cancelled (RAW: "after a spell restores Hit Points"; any-heal implemented — spell-only nuance GM-adjudicated).' },
        ]);
    });

    it('unwounded targets are byte-inert at BOTH close seams (heal + reroll): false, zero writes/logs/rolls', async () => {
        expect(await removeInfernalWoundOnHeal('Hero', CAMPAIGN)).toBe(false);
        expect(await cancelInfernalWoundAfterSaveSuccess('Hero', CAMPAIGN)).toBe(false);
        expect(writes).toEqual([]);
        expect(addEntryLogs).toEqual([]);
        expect(diceCalls).toEqual([]);
        expect(clockWrites).toEqual([]);
        expect(storageWrites).toEqual([]);
        expect(cacheWrites).toEqual([]);
    });

    it('save-reroll cancel: strips te + clock with its own exact log bytes, then bleed is inert (cancel is functional)', async () => {
        await grantWound();
        const wBase = writes.length;
        seedStore('Hero', 'currentHitPoints', 30);
        loadedCombatSummary = { creatures: [{ name: 'Hero', type: 'player', currentHp: 30, maxHp: 30 }] };

        expect(await cancelInfernalWoundAfterSaveSuccess('Hero', CAMPAIGN)).toBe(true);
        expect(teList()).toEqual([]);
        expect(pendingOf(DEVIL)).toEqual([]);
        expect(writes.slice(wBase)).toEqual([
            ['campaign', 'targetEffects', [], CAMPAIGN, true],
            [DEVIL, 'pendingExpirations', [], CAMPAIGN, true],
        ]);
        expect(addEntryLogs.slice(1).map(stripTs)).toEqual([
            { type: 'automation', automationType: 'infernal_wound_closed', characterName: 'Hero', abilityName: 'Infernal Wound', description: "Hero's save reroll succeeded — the Infernal Wound is cancelled (this save determines only the wound; the attack damage stands in full)." },
        ]);

        await applyInfernalWoundBleedTurnStart('Hero', CAMPAIGN);
        expect(diceCalls).toEqual([]);
        expect(writes).toHaveLength(wBase + 2);
        expect(readStore('Hero', 'currentHitPoints')).toBe(30);
        expect(addEntryLogs).toHaveLength(2);
    });
});

describe('MA-0367 log-failure isolation', () => {
    it('dead campaign log never blocks game state: grant + bleed tick land with exact console.error prefixes', async () => {
        logMode = 'fail';
        expect(await grantWound()).toEqual({ granted: true, alreadyWounded: false });
        expect(teList()).toEqual([{ target: 'Hero', effect: 'infernal_wound', source: DEVIL, duration: 'until_1_minute', bleedDie: '1d10', actionName: 'Infernal Glaive' }]);
        expect(clockWrites).toHaveLength(1);
        expect(addEntryLogs).toEqual([]);
        expect(consoleErr).toHaveBeenCalledTimes(1);
        expect(consoleErr.mock.calls[0][0]).toBe('[infernalWoundService:granted]');
        expect(consoleErr.mock.calls[0][1]).toBeInstanceOf(Error);
        expect(consoleErr.mock.calls[0][1].message).toBe('campaign log unreachable');
        consoleErr.mockClear();

        seedStore('Hero', 'currentHitPoints', 30);
        seedStore('Hero', 'hitPoints', 50);
        loadedCombatSummary = { creatures: [{ name: 'Hero', type: 'player', currentHp: 30, maxHp: 50 }] };
        await applyInfernalWoundBleedTurnStart('Hero', CAMPAIGN);
        expect(readStore('Hero', 'currentHitPoints')).toBe(23);
        expect(addEntryLogs).toEqual([]);
        expect(consoleErr.mock.calls.map((c) => c[0])).toEqual(['[infernalWoundService:bleed-tick]']);
        expect(consoleErr.mock.calls[0][1]).toBeInstanceOf(Error);
        expect(consoleErr.mock.calls[0][1].message).toBe('campaign log unreachable');
    });
});
