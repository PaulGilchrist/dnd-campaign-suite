// @maintained-by-ai
// H3 (§17): turn-END zone-damage repeat consumer — engine lane tests.
//
// ENGINE IDENTITY (sole-owner lane; three-engine discrimination):
//   • THIS engine (zoneRepeatTurnEndService, te.repeatTurnEnd===true):
//     turn-END repeated SAVE + untyped recurring DAMAGE through the
//     direct-HP idiom (full on fail, floor-half on success). Consumers
//     filter te.target only — source-blind; round+effect latch on the
//     victim store blocks intra-round doubles.
//   • SIBLING generic repeatSave (#1405, te.repeatSave={saveType,dc,
//     condition}): condition-only turn-END re-save, no damage lane.
//   • SIBLING whirlwind (#1432): recurring save rides the generic
//     repeatSaveService on the turn-START tick, not armRepeatSaveClause.
//   • SIBLING sleet/stinking cloud (#1416): recurring turn-start CON
//     saves ride expireStaleEffects phase 4 (trackingPrefix) — neither
//     repeatSaveService nor THIS engine (stinkingCloudService.test.js:23
//     cites us; PRESERVED-CITED-BY, no line numbers to honor).
//
// DISK CENSUS (grep of public/data + public/data/2024, machine walk):
//   snake_case producer key `repeat_turn_end: true` exists on EXACTLY
//   THREE rows: Adult Black Dragon .lair_actions[1].zone, Ancient Black
//   Dragon .lair_actions[1].zone, Young Black Dragon .lair_actions[2].zone
//   — all {radius_ft:20, repeat_turn_end:true}. Zero rows in spells.json,
//   2024/*.json, any other catalog. They reach THIS engine only via
//   MonsterCardModal.jsx:228 (repeatTurnEnd: action.zone.repeat_turn_end)
//   → SaveAttackAoeModal.armZoneTargets, which mints the camelCase te +
//   caster tracking stamp `_${effectKey}_${caster}`.
//
// SEAM (verified navigationHandlers.js): applySoulTomeTrapTurnEnd(:229)
//   → applyRepeatSaveTurnEnd(:238) → applyZoneRepeatTurnEnd(:243) — the
//   cited soulTome -> repeatSave -> zoneRepeat order holds; the seam owns
//   the floating .catch, so a reject here lands on navigationHandlers'
//   console, never on the UI thread.
//
// QUIRK PINS (byte evidence from zoneRepeatTurnEndService.js):
//   • dice precedence te.recurringDie > stamp.damage > null-skip with the
//     exact console.error at :132 — dice lowercased at :52/:54.
//   • save precedence dc = te.dc ?? stamp.saveDc (:60) but saveType =
//     stamp.saveType || te.saveType (:61) — dc prefers te, type prefers
//     stamp (asymmetric; pinned live in 'precedence' suite).
//   • NPC save full-word key with 3-letter fallback (:83) — live in every
//     monster row (stamp saveType 'Constitution' vs bonuses {con}).
//   • tie is success: (roll+bonus) >= dc (:85).
//   • rollExpression(:155) is the inline-dup chokepoint; the stamp key is
//     read TWICE per tick (:53/:59) — ordered read census pins it.
//   • stampLatch (:71) merges prior latch keys and stamps BEFORE the save
//     resolves: a hung PC prompt would still leave the round stamped.
//   • dead-victim census (:150): HP guard runs BEFORE stampLatch and
//     before any dice/save roll.
//   • damage<=0 (:185): save_result still logs, hp_change suppressed, no
//     HP write (:0-swallow family).
//   • label fallback registry-first (:92/:166); unregistered effect
//     degrades to underscores→spaces (or 'Zone' in the PC condition).
//   • DEAD GUARD (zero-production, declared not asserted): applyZoneHpLoss
//     :119 `if (!row) return` — the row was just found in the same
//     liveCs.creatures array at :147, so the clone always holds it.
//   • NO-CLOCK POLICY: no setTimeout/setInterval in source; Date.now
//     appears ONLY as log timestamps (:182/:196) — stamped here under
//     fake timers, never a game-state expiry. Duration/expiry clocks
//     belong to zoneDurationClock/expireStaleEffects (#1332), READ-only.
//   • #1434 FIXED (stale-cs snapshot): tickOneZone reroutes the monster HP
//     base through the LIVE combatSummary cache (getCombatSummary, fix#77
//     canon; read-your-write twin of useRuntimeState.js:99) per tick, so
//     multi-te rounds walk SEQUENTIAL truth (15→12→10, not stale 13) —
//     mirroring the PC lane's victimHp(:99) fresh runtime re-read, which was
//     always immune. Merged-write-once (fix#86 canon) REJECTED: per-te
//     save_result+hp_change logs carry per-te running HP (LogHpHealingEntry
//     .jsx:81 renders entry.currentHp/maxHp per line) and the PC lane writes
//     per tick — batching would desync the two lanes.
//   • exports: applyZoneRepeatTurnEnd (navigationHandlers:243),
//     isZonesEnforced (SaveAttackAoeModal.jsx:13), ZONE_REPEAT_LATCH_KEY
//     (source + here) — all live with caller evidence.
import { applyZoneRepeatTurnEnd, isZonesEnforced, ZONE_REPEAT_LATCH_KEY } from './zoneRepeatTurnEndService.js';

const CAMPAIGN = 'test-campaign';
const STAMP_MS = 1700000000000;
const LATCH = '_zoneRepeatTurnEnd_latch'; // byte-identical to ZONE_REPEAT_LATCH_KEY (asserted)
const TRACK = '_lair_insect_cloud_Black_Dragon';

const store = new Map(); // 'owner::key' -> value
const reads = [];
const writes = [];
const logs = [];
const listenerCalls = [];
const storageSets = [];
const cacheWrites = [];
let diceQueue = [];
let diceExprs = [];
let saveRolls = [];
let listenerResults = [];
let logRejects = false;
let csState = null;
let cachedCs = null;

const ALLOWED_OWNERS = new Set(['campaign', 'Black Dragon', 'Kraken', 'Goblin 1', 'Rakan', 'Corpse', 'Ghost']);

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn((who, key, campaignName) => {
        if (campaignName !== 'test-campaign') throw new Error(`[mock] unexpected campaign: ${campaignName}`);
        if (!ALLOWED_OWNERS.has(who)) throw new Error(`[mock] unexpected runtime owner: ${who}`);
        reads.push(`${who}::${key}`);
        const v = store.get(`${who}::${key}`);
        return v === undefined ? null : v;
    }),
    setRuntimeValue: vi.fn(async (who, key, value, campaignName) => {
        if (campaignName !== 'test-campaign') throw new Error(`[mock] unexpected campaign: ${campaignName}`);
        if (!ALLOWED_OWNERS.has(who) || who === 'campaign') throw new Error(`[mock] unexpected write owner: ${who}`);
        const okKey = key === LATCH || (key === 'currentHitPoints' && who === 'Rakan');
        if (!okKey) throw new Error(`[mock] unexpected write key: ${who}::${key}`);
        writes.push(`${who}::${key}`);
        store.set(`${who}::${key}`, value);
    }),
}));
vi.mock('../../dice/diceRoller.js', () => ({
    rollExpression: vi.fn((expr) => {
        diceExprs.push(expr);
        if (!diceQueue.length) throw new Error(`[mock] dice queue exhausted — unexpected rollExpression(${expr})`);
        return { total: diceQueue.shift() };
    }),
}));
vi.mock('../../ui/logService.js', () => ({
    addEntry: vi.fn(async (campaignName, entry) => {
        if (campaignName !== 'test-campaign') throw new Error(`[mock] unexpected log campaign: ${campaignName}`);
        if (logRejects) throw LOG_DOWN;
        logs.push(entry);
    }),
}));
vi.mock('../../encounters/combatData.js', () => ({
    loadCombatSummary: vi.fn(async (campaignName) => {
        if (campaignName !== 'test-campaign') throw new Error(`[mock] unexpected cs campaign: ${campaignName}`);
        // REAL loadCombatSummary seeds the cache with its loaded summary (combatData.js:41);
        // the mock mirrors it WITHOUT polluting cacheWrites (the HP-write-lane probe).
        cachedCs = cachedCs ?? csState;
        return cachedCs;
    }),
    getCombatSummary: vi.fn((campaignName) => { // #1434 fix lane: live cache read-your-write store
        if (campaignName !== 'test-campaign') throw new Error(`[mock] unexpected cs campaign: ${campaignName}`);
        return cachedCs;
    }),
    setCombatSummaryCache: vi.fn((cs, campaignName) => {
        if (campaignName !== 'test-campaign') throw new Error(`[mock] unexpected cs campaign: ${campaignName}`);
        cachedCs = cs;
        cacheWrites.push(cs);
    }),
}));
vi.mock('../../automation/common/savePrompt.js', () => ({
    createSaveListener: vi.fn((campaignName, config) => {
        if (campaignName !== 'test-campaign') throw new Error(`[mock] unexpected listener campaign: ${campaignName}`);
        listenerCalls.push(config);
        if (!listenerResults.length) throw new Error('[mock] PC listener queue exhausted');
        return { promise: Promise.resolve(listenerResults.shift()) };
    }),
}));
vi.mock('../../ui/storage.js', () => ({
    default: {
        set: vi.fn((key, value, campaignName) => {
            if (key !== 'combatSummary' || campaignName !== 'test-campaign') {
                throw new Error(`[mock] unexpected storage write: ${key}/${campaignName}`);
            }
            storageSets.push({ value });
        }),
    },
}));
// targetEffectDefinitions is deliberately NOT mocked: 'lair_insect_cloud' →
// 'Insect Cloud (Lair)' from the REAL registry; 'test_web' is unregistered
// to pin the fallbacks live.

import { setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { createSaveListener } from '../../automation/common/savePrompt.js';

const LOG_DOWN = new Error('log service down');

const ARMED_TE = Object.freeze({
    target: 'Goblin 1', effect: 'lair_insect_cloud', source: 'Black Dragon',
    dc: 13, repeatTurnEnd: true, duration: 'until_end_of_zone',
});
const STAMP = Object.freeze({ saveDc: 13, saveType: 'Constitution', radiusFt: 20, repeatTurnEnd: true, damage: '2d6', affectedNames: Object.freeze(['Goblin 1']) });

function freshCs(round = 3) {
    return {
        round,
        creatures: [
            { name: 'Goblin 1', type: 'monster', currentHp: 30, maxHp: 30, saveBonuses: { con: -1 }, hit_points: { current: 30 } },
            { name: 'Rakan', type: 'player' },
            { name: 'Corpse', type: 'monster', currentHp: 0, maxHp: 4 },
        ],
    };
}

function seed({ enforcement, tes = [ARMED_TE], stamp = STAMP, latch = null, round = 3, withCreatures = true } = {}) {
    store.clear();
    reads.length = 0; writes.length = 0; logs.length = 0;
    listenerCalls.length = 0; storageSets.length = 0; cacheWrites.length = 0;
    diceQueue = []; diceExprs = []; saveRolls = []; listenerResults = [];
    logRejects = false; cachedCs = null;
    csState = withCreatures ? freshCs(round) : { round };
    store.set('campaign::enforcement', enforcement);
    if (tes) store.set('campaign::targetEffects', tes);
    if (stamp) store.set('Black Dragon::' + TRACK, stamp);
    if (latch) store.set('Goblin 1::' + LATCH, latch);
}

function monsterRow(cs) { return cs.creatures.find((c) => c.name === 'Goblin 1'); }

beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] }); // STAMP_MS pin for log timestamps; promise lanes untouched
    vi.setSystemTime(STAMP_MS);
    vi.spyOn(Math, 'random').mockImplementation(() => {
        if (!saveRolls.length) throw new Error('[mock] NPC save-roll queue exhausted');
        return (saveRolls.shift() - 1) / 20;
    });
});

afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
});

describe('enforcement gate (L1–4 parity)', () => {
    it('ON needs mode===on AND zones===true; OFF ⇒ zero engagement past the single enforcement read', async () => {
        expect(ZONE_REPEAT_LATCH_KEY).toBe(LATCH);
        seed({ enforcement: undefined });
        expect(isZonesEnforced(CAMPAIGN)).toBe(false);
        seed({ enforcement: { mode: 'off', zones: true } });
        expect(isZonesEnforced(CAMPAIGN)).toBe(false);
        seed({ enforcement: { mode: 'on', zones: 'true' } });
        expect(isZonesEnforced(CAMPAIGN)).toBe(false); // strict === true, string fails
        seed({ enforcement: { mode: 'on', zones: true } });
        expect(isZonesEnforced(CAMPAIGN)).toBe(true);

        seed({ enforcement: { mode: 'on' } });
        expect(await applyZoneRepeatTurnEnd(CAMPAIGN, 'Goblin 1')).toEqual({ handled: false });
        // census: OFF ⇒ exactly ONE read (the enforcement flag) per apply, nothing else
        expect(reads).toEqual(['campaign::enforcement']);
        seed({ enforcement: { mode: 'off', zones: true } });
        expect(await applyZoneRepeatTurnEnd(CAMPAIGN, 'Goblin 1')).toEqual({ handled: false });
        expect(reads).toEqual(['campaign::enforcement']);
        expect(writes).toEqual([]);
        expect(storageSets).toEqual([]);
        expect(cacheWrites).toEqual([]);
        expect(logs).toEqual([]);
        expect(listenerCalls).toEqual([]);
        expect(diceExprs).toEqual([]);
    });
});

describe('handled:false inert census + dead-victim roll-before-guard', () => {
    it('missing args, creature-less cs, unmatched tes ⇒ inert in the right places; corpse never rolls', async () => {
        seed({ enforcement: { mode: 'on', zones: true } });
        expect(await applyZoneRepeatTurnEnd('', 'Goblin 1')).toEqual({ handled: false });
        expect(await applyZoneRepeatTurnEnd(CAMPAIGN, '')).toEqual({ handled: false });
        expect(reads).toEqual([]); // arg guards precede EVERY store read

        seed({ enforcement: { mode: 'on', zones: true }, withCreatures: false });
        expect(await applyZoneRepeatTurnEnd(CAMPAIGN, 'Goblin 1')).toEqual({ handled: false });
        expect(reads).toEqual(['campaign::enforcement', 'campaign::targetEffects']); // stops after cs load

        seed({
            enforcement: { mode: 'on', zones: true },
            tes: [null, undefined, { target: 'Goblin 1' }, { ...ARMED_TE, repeatTurnEnd: false },
                  { ...ARMED_TE, repeatTurnEnd: 'true' }, { ...ARMED_TE, target: 'Rakan' }],
            stamp: null,
        });
        expect(await applyZoneRepeatTurnEnd(CAMPAIGN, 'Goblin 1')).toEqual({ handled: false });
        expect(diceExprs).toEqual([]);
        expect(writes).toEqual([]);

        seed({ enforcement: { mode: 'on', zones: true }, tes: null }); // no te store at all
        expect(await applyZoneRepeatTurnEnd(CAMPAIGN, 'Goblin 1')).toEqual({ handled: false });

        // target in te but absent from cs: resolves dice/save (stamp read), never stamps/latches or rolls
        seed({ enforcement: { mode: 'on', zones: true }, tes: [Object.freeze({ ...ARMED_TE, target: 'Ghost' })] });
        expect(await applyZoneRepeatTurnEnd(CAMPAIGN, 'Ghost')).toEqual({ handled: true, results: [] });
        expect(store.has('Ghost::' + LATCH)).toBe(false);

        // corpse: HP guard fires before stampLatch, dice, and the save roll
        seed({ enforcement: { mode: 'on', zones: true }, tes: [Object.freeze({ ...ARMED_TE, target: 'Corpse' })] });
        expect(await applyZoneRepeatTurnEnd(CAMPAIGN, 'Corpse')).toEqual({ handled: true, results: [] });
        expect(diceExprs).toEqual([]);
        expect(saveRolls.length).toBe(0); // NPC queue untouched — consumed() by guard order
        expect(store.has('Corpse::' + LATCH)).toBe(false);
        expect(writes).toEqual([]);
        expect(storageSets).toEqual([]);
        expect(logs).toEqual([]);
    });
});

describe('monster inline lane — fail: full untyped zone damage', () => {
    it('natural 1 + (-1) tie-gate fail ⇒ full raw through combatSummary+storage, byte-exact logs', async () => {
        seed({ enforcement: { mode: 'on', zones: true } });
        saveRolls = [1];
        diceQueue = [12];
        let evt = 0;
        const handler = () => { evt++; };
        window.addEventListener('combat-summary-updated', handler);

        const r = await applyZoneRepeatTurnEnd(CAMPAIGN, 'Goblin 1');
        expect(r).toEqual({ handled: true, results: [{ effect: 'lair_insect_cloud', success: false, raw: 12, damage: 12, newHp: 18 }] });
        // ordered read census — stamp read TWICE per tick (dice+save inline dup chokepoint)
        expect(reads).toEqual([
            'campaign::enforcement', 'campaign::targetEffects',
            'Goblin 1::' + LATCH,
            'Black Dragon::' + TRACK, 'Black Dragon::' + TRACK,
            'Goblin 1::' + LATCH, // stampLatch re-read for merge
        ]);
        expect(diceExprs).toEqual(['2d6']); // stamp.damage lowercase → rollExpression arg
        // latch write: full-set value, 4-arg position, before the save roll
        expect(setRuntimeValue).toHaveBeenCalledWith('Goblin 1', LATCH, { lair_insect_cloud: 3 }, CAMPAIGN);
        expect(monsterRow(cacheWrites[0]).currentHp).toBe(18);
        expect(monsterRow(cacheWrites[0]).hit_points.current).toBe(18); // HP-key double-write census
        expect(storageSets[0].value).toBe(cacheWrites[0]); // identical detached object on both write lanes
        expect(evt).toBe(1);
        expect(logs.length).toBe(2);
        expect(logs[0]).toEqual({
            type: 'save_result', characterName: 'Goblin 1', rollType: 'zone-repeat-save',
            targetName: 'Goblin 1', saveDc: 13, saveType: 'Constitution', success: false,
            roll: 1, total: 0, saveBonus: -1, // 3-letter 'con' fallback on full-word miss (:83)
            description: 'Goblin 1 failed its turn-end Constitution save vs Insect Cloud (Lair) (DC 13, rolled 1 + -1 = 0) — takes 12 damage (2d6).',
            timestamp: STAMP_MS,
        });
        expect(logs[1]).toEqual({
            type: 'hp_change', targetName: 'Goblin 1', sourceName: 'Black Dragon',
            delta: -12, currentHp: 18, maxHp: 30, isHealing: false, isUnconscious: false,
            note: 'Insect Cloud (Lair) turn-end repeat damage 12 (2d6) from Black Dragon.',
            timestamp: STAMP_MS,
        });
        // input purity: frozen te and stamp unchanged
        expect(store.get('campaign::targetEffects')).toEqual([ARMED_TE]);
        window.removeEventListener('combat-summary-updated', handler);
    });
});

describe('monster inline lane — success: RAW half, and the zero-damage swallow', () => {
    it('natural 20 ⇒ floor(raw/2); raw 1 ⇒ halved to 0 — save logs, hp_change suppressed, no HP write', async () => {
        seed({ enforcement: { mode: 'on', zones: true } });
        saveRolls = [20];
        diceQueue = [7];
        const r = await applyZoneRepeatTurnEnd(CAMPAIGN, 'Goblin 1');
        expect(r).toEqual({ handled: true, results: [{ effect: 'lair_insect_cloud', success: true, raw: 7, damage: 3, newHp: 27 }] });
        expect(monsterRow(cacheWrites[0]).currentHp).toBe(27);
        expect(logs[1].note).toBe('Insect Cloud (Lair) turn-end repeat damage 3 (2d6, halved by save) from Black Dragon.');

        // raw 1, success ⇒ floor(1/2)=0: no hp_change entry, no cache/storage write, latch still stamped
        seed({ enforcement: { mode: 'on', zones: true } });
        saveRolls = [20];
        diceQueue = [1];
        const r0 = await applyZoneRepeatTurnEnd(CAMPAIGN, 'Goblin 1');
        expect(r0.results).toEqual([{ effect: 'lair_insect_cloud', success: true, raw: 1, damage: 0, newHp: 30 }]);
        expect(logs.map((l) => l.type)).toEqual(['save_result']);
        expect(storageSets).toEqual([]);
        expect(cacheWrites).toEqual([]);
        expect(store.get('Goblin 1::' + LATCH)).toEqual({ lair_insect_cloud: 3 });
    });
});

describe('unresolvable descriptor — honest skip, loud error', () => {
    it('missing dice vs missing save ⇒ exact skip bytes per te, zero rolls/writes/logs', async () => {
        const err = vi.spyOn(console, 'error').mockImplementation(() => {});
        // dice unresolvable (no recurringDie, no stamp) but save fully inline
        const teNoDice = Object.freeze({ target: 'Goblin 1', effect: 'lair_insect_cloud', source: 'Black Dragon', dc: 13, saveType: 'Constitution', repeatTurnEnd: true });
        seed({ enforcement: { mode: 'on', zones: true }, tes: [teNoDice], stamp: null });
        expect(await applyZoneRepeatTurnEnd(CAMPAIGN, 'Goblin 1')).toEqual({ handled: true, results: [] });
        expect(err).toHaveBeenNthCalledWith(1, `[zoneRepeatTurnEnd] armed te "lair_insect_cloud" on Goblin 1 lacks dice or save/dc — skipping (GM-enforced residual). te=${JSON.stringify(teNoDice)}`);

        // dice inline, save unresolvable (no dc anywhere, no stamp)
        const teNoSave = Object.freeze({ target: 'Goblin 1', effect: 'test_web', source: 'Black Dragon', recurringDie: '2d6', repeatTurnEnd: true });
        seed({ enforcement: { mode: 'on', zones: true }, tes: [teNoSave], stamp: null });
        expect(await applyZoneRepeatTurnEnd(CAMPAIGN, 'Goblin 1')).toEqual({ handled: true, results: [] });
        expect(err).toHaveBeenNthCalledWith(2, `[zoneRepeatTurnEnd] armed te "test_web" on Goblin 1 lacks dice or save/dc — skipping (GM-enforced residual). te=${JSON.stringify(teNoSave)}`);

        expect(err).toHaveBeenCalledTimes(2);
        expect(diceExprs).toEqual([]);
        expect(writes).toEqual([]);
        expect(logs).toEqual([]);
    });
});

describe('descriptor precedence + source-blind census', () => {
    it('te.recurringDie/dc beat stamp; saveType falls back te when stamp silent; unregistered label degrades', async () => {
        seed({
            enforcement: { mode: 'on', zones: true },
            tes: [Object.freeze({ target: 'Goblin 1', effect: 'test_web', source: 'Black Dragon', dc: 10, saveType: 'Constitution', recurringDie: '4D8', repeatTurnEnd: true })],
            stamp: Object.freeze({ saveDc: 13, damage: '2d6' }), // no saveType — te fallback
        });
        saveRolls = [15]; // 15 + (-1) = 14 ≥ te.dc 10 ⇒ success
        diceQueue = [7];
        const r = await applyZoneRepeatTurnEnd(CAMPAIGN, 'Goblin 1');
        expect(r).toEqual({ handled: true, results: [{ effect: 'test_web', success: true, raw: 7, damage: 3, newHp: 27 }] });
        expect(diceExprs).toEqual(['4d8']); // te.recurringDie wins over stamp '2d6', lowercased
        expect(logs[0].saveDc).toBe(10); // te.dc wins over stamp.saveDc 13
        expect(logs[0].saveType).toBe('Constitution'); // te.saveType fallback (stamp silent)
        expect(logs[0].description).toBe('Goblin 1 succeeded its turn-end Constitution save vs test web (DC 10, rolled 15 + -1 = 14) — half of 7 (3) damage.');

        // source-blind filter + tracking-key derivation: Kraken has no stamp, inline dice carry it
        seed({ enforcement: { mode: 'on', zones: true } });
        store.set('campaign::targetEffects', [Object.freeze({ target: 'Goblin 1', effect: 'test_web', source: 'Kraken', dc: 12, saveType: 'Constitution', recurringDie: '1d4', repeatTurnEnd: true })]);
        saveRolls = [1];
        diceQueue = [5];
        const rk = await applyZoneRepeatTurnEnd(CAMPAIGN, 'Goblin 1');
        expect(rk.results).toEqual([{ effect: 'test_web', success: false, raw: 5, damage: 5, newHp: 25 }]);
        expect(reads).toContain('Kraken::_test_web_Kraken'); // stamp probe on the te's own source
        expect(logs[1].sourceName).toBe('Kraken');
        expect(logs[1].note).toBe('test web turn-end repeat damage 5 (1d4) from Kraken.');
    });
});

describe('PC lane — queued save-listener', () => {
    it('prompt config is exact (CON/half/registry label+suffix); returned fail lands full damage on runtime HP', async () => {
        seed({ enforcement: { mode: 'on', zones: true }, tes: [Object.freeze({ ...ARMED_TE, target: 'Rakan' })] });
        store.set('Rakan::currentHitPoints', 20);
        store.set('Rakan::hitPoints', 40);
        listenerResults = [{ roll: 8, saveBonus: 2, success: false }];
        diceQueue = [11];
        const r = await applyZoneRepeatTurnEnd(CAMPAIGN, 'Rakan');
        expect(createSaveListener).toHaveBeenCalledTimes(1);
        expect(listenerCalls[0]).toEqual({
            targetName: 'Rakan', saveType: 'CON', saveDc: 13, dcSuccess: 'half',
            condition: 'Insect Cloud (Lair) (zone repeat save)',
        });
        expect(diceExprs).toEqual(['2d6']);
        expect(store.get('Rakan::' + LATCH)).toEqual({ lair_insect_cloud: 3 });
        // write-budget census: latch then HP (both on the PC owner), 4-arg positional
        expect(writes).toEqual(['Rakan::' + LATCH, 'Rakan::currentHitPoints']);
        expect(setRuntimeValue).toHaveBeenCalledWith('Rakan', 'currentHitPoints', 9, CAMPAIGN);
        expect(storageSets).toEqual([]); // PC never touches the combatSummary lane
        expect(logs.map((l) => l.type)).toEqual(['save_result', 'hp_change']);
        expect(logs[0]).toMatchObject({ rollType: 'zone-repeat-save', roll: 8, saveBonus: 2, total: 10, success: false });
        expect(r).toEqual({ handled: true, results: [{ effect: 'lair_insect_cloud', success: false, raw: 11, damage: 11, newHp: 9 }] });
    });
});

describe('multi-round compose — deterministic tick / idempotent replay / monotonic HP', () => {
    it('round 3 tick stamps latch; same-round replay is a total no-op; round 4 ticks both tes, merges latch, walks HP down', async () => {
        seed({ enforcement: { mode: 'on', zones: true } });
        saveRolls = [1]; diceQueue = [12];
        const p1 = await applyZoneRepeatTurnEnd(CAMPAIGN, 'Goblin 1');
        expect(p1).toEqual({ handled: true, results: [{ effect: 'lair_insect_cloud', success: false, raw: 12, damage: 12, newHp: 18 }] });
        expect(store.get('Goblin 1::' + LATCH)).toEqual({ lair_insect_cloud: 3 });
        expect(monsterRow(cachedCs).currentHp).toBe(18);
        const writesAfterP1 = writes.length;
        const logsAfterP1 = logs.length;

        // replay the same seam in round 3 — latch short-circuits BEFORE any resolve
        const p2 = await applyZoneRepeatTurnEnd(CAMPAIGN, 'Goblin 1');
        expect(p2).toEqual({ handled: true, results: [] });
        expect(diceExprs).toEqual(['2d6']); // no extra consumption
        expect(saveRolls.length).toBe(0);
        expect(writes.length).toBe(writesAfterP1);
        expect(logs.length).toBe(logsAfterP1);
        expect(monsterRow(cachedCs).currentHp).toBe(18);

        // round 4 (initiative advanced externally on the cached summary): two armed tes tick in order
        cachedCs.round = 4;
        const webTe = Object.freeze({ target: 'Goblin 1', effect: 'test_web', source: 'Black Dragon', dc: 11, saveType: 'Constitution', recurringDie: '4D8', repeatTurnEnd: true });
        store.set('campaign::targetEffects', [ARMED_TE, webTe]);
        saveRolls = [15, 1]; diceQueue = [6, 5];
        const p3 = await applyZoneRepeatTurnEnd(CAMPAIGN, 'Goblin 1');
        expect(p3).toEqual({
            handled: true,
            results: [
                { effect: 'lair_insect_cloud', success: true, raw: 6, damage: 3, newHp: 15 }, // 15-1=14 ≥ 13 ⇒ half
                { effect: 'test_web', success: false, raw: 5, damage: 5, newHp: 10 }, // 15−5=10 SEQUENTIAL off te1's write
            ],
        });
        expect(store.get('Goblin 1::' + LATCH)).toEqual({ lair_insect_cloud: 4, test_web: 4 }); // stampLatch merge
        // #1434 FIXED (was STALE-CS QUIRK pinned-as-reported): cs loaded ONCE per apply no longer
        // rebases every monster tick on the same start HP — tickOneZone reroutes the monster base
        // through the live combatSummary cache (getCombatSummary, fix#77 canon; read-your-write Map
        // twin of useRuntimeState.js:99), so te2 computes 15−5=10 instead of stale 18−5=13 and
        // its write no longer clobbers the cloud's 15. The PC lane was always immune
        // (victimHp re-reads runtime per tick) — the monster lane now mirrors that fresh-read shape.
        expect(monsterRow(cachedCs).currentHp).toBe(10); // monotonic across rounds 30→18→15→10
        expect(cacheWrites.map((cs) => monsterRow(cs).currentHp)).toEqual([18, 15, 10]); // zero-clobber: every write carries the running total
        expect(diceExprs).toEqual(['2d6', '2d6', '4d8']); // p1 + p3(cloud,web); replay p2 consumed nothing
        expect(logs.filter((l) => l.type === 'hp_change').map((l) => l.currentHp)).toEqual([18, 15, 10]);
        // input purity through the whole compose
        expect(store.get('campaign::targetEffects')).toEqual([ARMED_TE, webTe]);
    });
});

describe('multi-te same-seam sequential truth (#1434 stale-cs fix)', () => {
    const WEB_TE = Object.freeze({ target: 'Goblin 1', effect: 'test_web', source: 'Black Dragon', dc: 11, saveType: 'Constitution', recurringDie: '1d4', repeatTurnEnd: true });

    it('two armed tes rebase off the LIVE row: 15 −3 = 12 then 12 −2 = 10 (stale-cs clone wrote 13)', async () => {
        seed({ enforcement: { mode: 'on', zones: true }, tes: [ARMED_TE, WEB_TE] });
        monsterRow(csState).currentHp = 15;
        monsterRow(csState).hit_points.current = 15;
        saveRolls = [20, 1]; // cloud: 20 + (-1) = 19 ≥ 13 ⇒ success; web: 1 + (-1) = 0 < 11 ⇒ fail
        diceQueue = [7, 2]; // cloud floor(7/2)=3 ⇒ 12; web 2 ⇒ 10
        const r = await applyZoneRepeatTurnEnd(CAMPAIGN, 'Goblin 1');
        expect(r).toEqual({
            handled: true,
            results: [
                { effect: 'lair_insect_cloud', success: true, raw: 7, damage: 3, newHp: 12 },
                { effect: 'test_web', success: false, raw: 2, damage: 2, newHp: 10 },
            ],
        });
        // zero-clobber census: each cache write carries the running total — te2's clone is
        // based on te1's 12 (never the start-15), and no earlier write is resurrected.
        expect(cacheWrites.map((cs) => monsterRow(cs).currentHp)).toEqual([12, 10]);
        expect(monsterRow(cachedCs).currentHp).toBe(10);
        expect(monsterRow(cachedCs).hit_points.current).toBe(10); // HP-key double-write on the final row
        expect(storageSets.length).toBe(2); // per-te serialized writes preserved (per-te logs need per-te running HP — LogHpHealingEntry.jsx:81)
        expect(storageSets.map((s) => monsterRow(s.value).currentHp)).toEqual([12, 10]);
        expect(logs.filter((l) => l.type === 'hp_change').map((l) => l.currentHp)).toEqual([12, 10]);
        expect(logs.filter((l) => l.type === 'save_result').length).toBe(2);
        expect(store.get('Goblin 1::' + LATCH)).toEqual({ lair_insect_cloud: 3, test_web: 3 }); // stampLatch merge both effects
    });

    it('te1 kills (HP→0) ⇒ te2 fresh-reads the dead row and never rolls, stamps, writes or revives', async () => {
        seed({ enforcement: { mode: 'on', zones: true }, tes: [ARMED_TE, WEB_TE] });
        monsterRow(csState).currentHp = 2;
        monsterRow(csState).hit_points.current = 2;
        saveRolls = [1, 1]; // second save-roll must NEVER be consumed
        diceQueue = [2, 1]; // cloud fail: 2 dmg ⇒ exactly 0; web's 1-die is the revive probe (stale base 2 − 1 = 1)
        const r = await applyZoneRepeatTurnEnd(CAMPAIGN, 'Goblin 1');
        expect(r.results).toEqual([{ effect: 'lair_insect_cloud', success: false, raw: 2, damage: 2, newHp: 0 }]);
        expect(diceExprs).toEqual(['2d6']); // web skipped before rollExpression — stale-cs rebase would have revived to 2−dmg
        expect(saveRolls.length).toBe(1);
        expect(monsterRow(cachedCs).currentHp).toBe(0); // no resurrection through the cache lane
        expect(store.get('Goblin 1::' + LATCH)).toEqual({ lair_insect_cloud: 3 }); // dead-victim guard precedes stampLatch — web unstamped
        expect(logs.filter((l) => l.type === 'hp_change').map((l) => l.currentHp)).toEqual([0]);
    });
});

describe('addEntry-reject resilience (own .catch lines :183/:197)', () => {
    it('log pipeline down ⇒ damage still applied, exact prefixed console.errors on the same Error instance', async () => {
        seed({ enforcement: { mode: 'on', zones: true } });
        saveRolls = [1]; diceQueue = [12];
        logRejects = true;
        const err = vi.spyOn(console, 'error').mockImplementation(() => {});
        const r = await applyZoneRepeatTurnEnd(CAMPAIGN, 'Goblin 1');
        expect(r).toEqual({ handled: true, results: [{ effect: 'lair_insect_cloud', success: false, raw: 12, damage: 12, newHp: 18 }] });
        expect(store.get('Goblin 1::' + LATCH)).toEqual({ lair_insect_cloud: 3 });
        expect(monsterRow(cachedCs).currentHp).toBe(18); // HP lane independent of log lane
        expect(err).toHaveBeenCalledWith('[zoneRepeatTurnEnd:save]', LOG_DOWN);
        expect(err).toHaveBeenCalledWith('[zoneRepeatTurnEnd:hp]', LOG_DOWN);
        expect(err).toHaveBeenCalledTimes(2);
    });
});
