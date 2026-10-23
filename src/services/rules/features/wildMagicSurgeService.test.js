// @maintained-by-ai
// Wild Magic Surge trigger lane (post-cast seam). PRESERVED-CITED-BY:
// d20RollComputation.feats-of-chaos.test.js:12 — 'wildMagicSurgeService.test.js
// owns surge triggering and re-arming' — the CLA-134 cast-time-stamp re-arm
// row below keeps that contract.
//
// IDENTITY / OWNERSHIP (READ bytes, not assumed):
// - triggerWildMagicSurge is the ONLY live export: sole production caller is
//   spellCastService/execution/index.js:538 (awaited post-cast seam).
// - #1433 export-surface-shrink DONE: the four finders are demoted to
//   MODULE-LOCAL (were test-only exports, zero external importers ever).
//   No dedicated getter suites — every finder predicate (type/effect/
//   condition keys, first-match pick) is pinned through the live seam below
//   via near-miss passives + full-set write censuses, so finder drift flips
//   a lane here. The disk census restructure (fix#297 row-9 seam pattern)
//   rides triggerWildMagicSurge: disk rows are pinned by what the seam
//   DISPATCHES/WRITES and by chaos-only-near-miss zero-IO refusal.
// - NO dice live in this service: the d20 gate (2014 roll-a-1 / 2024
//   roll-a-20, public/data/classes.json:11353, public/data/2024/classes.json
//   :11391) and d100→row table mapping are owned by
//   automation/handlers/class-sorcerer/wildMagicSurgeHandler.js behind the
//   mocked executeHandler — wildMagicSurgeHandler.test.js owns table bytes.
//   This lane therefore runs ZERO randomness: fixed combat-context round
//   stub, fixed executeHandler stub queue (exhaustion THROWS), and an
//   argument-keyed runtime store fake that THROWS on unknown owner/key/
//   campaign/arity. No Date.now, no timers, no clocks (no-clock policy).
// - Passive shapes are VERBATIM automationInfoBuilder/core-handlers.js
//   producers: surge :389, tamed :401, feats :412 (condition defaults
//   'feats_of_chaos_active' at :418). metaCtx.featsOfChaosArmedAtCast is
//   produced at execution/index.js:741 (CLA-134).
// - #1433(a) FIXED 2026-10-22 (was disk-deadness drift pin): 2014 origin
//   ships automation.type 'auto_effect' trigger 'roll_1_on_wild_magic_d20'
//   effect 'wild_magic_surge_table' (public/data/classes.json:11353-11360) —
//   a type-only filter never saw those bytes. Verdict: FILTER-side gap, disk
//   stays authoritative (trigger names the 2014 nat-1 die rule verbatim;
//   overwriting it to the 2024 'after_sorcerer_spell_slot' form would lie
//   about the ruleset). Finder now accepts the engine's own fingerprint for
//   that disk form — automation/index.js:679 resolveHandler already routes
//   type 'auto_effect' + effect 'wild_magic_surge_table' to
//   handleWildMagicSurge; the execution side spoke disk long before the
//   finder did. Disk-vs-filter trigger census pinned below from disk bytes.
// - #1433(b) FIXED: RAW class gate — surge only when cast BY a Sorcerer.
//   Disk: classes.json:11352 "immediately after you cast a sorcerer spell of
//   1st level or higher" / 2024 classes.json:11391 "immediately after you
//   cast a Sorcerer spell with a spell slot" — both rows live IN THE
//   SORCERER CLASS BLOCK, so "you" is the Sorcerer feature-holder. The old
//   spell.classes branch let a Wizard casting a Sorcerer-listed spell surge;
//   gate is now caster-class-only (house form: automationInfoBuilder/
//   damage.js:23 playerStats.class?.name === 'Ranger').
// - #1433(c) FIXED: spell:null golden trio (was: Wizard-null TypeError at
//   spell.classes, Sorcerer-null TypeError at spell.level, Sorcerer-null +
//   slotLevel:1 phantom surge dispatch) → null/undefined spell now loud-
//   refuses '[wildMagicSurgeService] Missing spell:' with ZERO dispatch for
//   sorcerers (house miss-guard form) and stays class-gate-silent for
//   non-sorcerers (the seam runs on every caster's post-cast path).
// - FT-082: markOncePerTurn stamps {round, playerStats.name}; the combat
//   mirror is deliberately stale in the stub and must never reach a write.
// - Producer arity quirk pinned by census: checkOncePerTurn reads
//   'surgeUsedRound' with a 2-arg getRuntimeValue (campaign omitted);
//   skipSync=true appears only at the service's own 5-arg writes; the
//   latch write (markOncePerTurn) is 4-arg.
// - Fix vs previous suite: it mocked '../../../rules/combat/damageUtils.js'
//   (nonexistent src/rules/) so a REAL jsdom fetch ran per latch check;
//   correct path mocked here and console must stay silent on all pass lanes.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import { coreHandlers } from '../../combat/automation/automationInfoBuilder/core-handlers.js';
import { triggerWildMagicSurge } from './wildMagicSurgeService.js';

const H = vi.hoisted(() => {
    const CAMPAIGN = 'TestCampaign';
    const MAP = 'testMap';
    // exact (owner,key) -> allowed arity of producer reads / writes
    // #1433(b): non-Sorcerer owners REMOVED from the allowance maps — any
    // read/write past the caster-class gate now throws unexpected-read.
    const READERS = {
        'Sorcerer.tamedSurgeUses': 3,
        'Sorcerer.featsOfChaosActive': 3,
        'Sorcerer.surgeUsedRound': 2, // checkOncePerTurn: 2-arg read, no campaign
    };
    const WRITERS = {
        'Sorcerer.wildMagicDoubleRoll': 5, // skipSync=true
        'Sorcerer.featsOfChaosActive': 5, // skipSync=true
        'Sorcerer.featsOfChaosUses': 5, // skipSync=true
        'Sorcerer.surgeUsedRound': 4, // markOncePerTurn: no skipSync
        'Zosime.surgeUsedRound': 4,
    };
    const state = {
        store: new Map(),
        reads: [],
        writes: [],
        actions: [],
        statsPass: [],
        results: [],
        round: 1,
        mirror: 'StaleGoblin', // FT-082: mirror must never be stamped into writes
    };
    return {
        CAMPAIGN,
        MAP,
        READERS,
        WRITERS,
        state,
        reset() {
            state.store.clear();
            state.reads.length = 0;
            state.writes.length = 0;
            state.actions.length = 0;
            state.statsPass.length = 0;
            state.results.length = 0;
            state.round = 1;
            state.mirror = 'StaleGoblin';
        },
        seed(fullKey, value) {
            if (!(fullKey in READERS) && !(fullKey in WRITERS)) {
                throw new Error(`test store: unknown seed key ${fullKey}`);
            }
            state.store.set(fullKey, value);
        },
    };
});

vi.mock('../../automation/index.js', () => ({
    // producer arity (service :68/:104): executeHandler(action, playerStats, campaignName, mapName)
    executeHandler: (action, playerStats, campaignName, mapName) => {
        if (campaignName !== H.CAMPAIGN || mapName !== H.MAP) {
            throw new Error(`surge stub: unexpected route args ${campaignName}/${mapName}`);
        }
        H.state.actions.push(action);
        H.state.statsPass.push(playerStats);
        if (H.state.results.length === 0) {
            throw new Error('surge stub: executeHandler queue exhausted — seed a fixed result');
        }
        const r = H.state.results.shift();
        return r && r.__reject ? Promise.reject(r.__reject) : Promise.resolve(r);
    },
}));

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: (owner, key, ...rest) => {
        const arity = rest.length + 2;
        const full = `${owner}.${key}`;
        if (!(full in H.READERS)) throw new Error(`test store: unexpected read ${full}`);
        if (arity === 2) {
            if (key !== 'surgeUsedRound') throw new Error(`test store: unexpected 2-arg read ${full}`);
        } else if (arity !== 3 || rest[0] !== H.CAMPAIGN) {
            throw new Error(`test store: unexpected arity ${arity}/campaign for ${full}`);
        }
        H.state.reads.push(`${key}/arity${arity}`);
        return H.state.store.has(full) ? H.state.store.get(full) : null;
    },
    setRuntimeValue: (owner, key, value, ...rest) => {
        const arity = rest.length + 3;
        const full = `${owner}.${key}`;
        if (!(full in H.WRITERS) || H.WRITERS[full] !== arity) {
            throw new Error(`test store: unexpected write ${full} arity ${arity}`);
        }
        if (rest[0] !== H.CAMPAIGN) {
            throw new Error(`test store: unexpected campaign ${rest[0]} for ${full}`);
        }
        if (arity === 5 && rest[1] !== true) {
            throw new Error(`test store: ${full} must carry skipSync=true`);
        }
        H.state.writes.push({ owner, key, value, arity, skipSync: arity === 5 ? rest[1] : undefined });
        H.state.store.set(full, value);
        return Promise.resolve();
    },
}));

// correct path (previous suite mocked nonexistent src/rules/combat/damageUtils.js)
vi.mock('../../rules/combat/damageUtils.js', () => ({
    getCombatContext: (campaignName) => {
        if (campaignName !== H.CAMPAIGN) {
            throw new Error(`combat-context stub: unexpected campaign ${campaignName}`);
        }
        return Promise.resolve({ round: H.state.round, activeCreatureName: H.state.mirror });
    },
}));

const SURGE_TABLE = [
    { min: 1, max: 50, effect: 'Effect A' },
    { min: 51, max: 100, effect: 'Effect B' },
];
const WISH_ONLY_TABLE = [{ min: 1, max: 100, effect: 'Wish (final row — CLA-354 excluded from chooser)' }];

// passive bytes verbatim from automationInfoBuilder/core-handlers.js producers
const SURGE_2024 = { type: 'wild_magic_surge', name: 'Wild Magic Surge', trigger: 'after_sorcerer_spell_slot', oncePerTurn: true, hasAutomation: true };
const SURGE_LEGACY = { type: 'wild_magic_surge', name: 'Wild Surge' };
const SURGE_SECOND = { type: 'wild_magic_surge', name: 'Second Surge', trigger: 'after_sorcerer_spell_slot', oncePerTurn: true, hasAutomation: true };
const SURGE_5E_DISK = { type: 'auto_effect', name: 'Wild Magic Surge', trigger: 'roll_1_on_wild_magic_d20', effect: 'wild_magic_surge_table', uses: 1, recharge: 'turn', casting_time: '1 action', hasAutomation: true };
const CONTROLLED_CHAOS = { type: 'auto_effect', effect: 'wild_magic_double_roll', name: 'Controlled Chaos', trigger: 'wild_magic_surge_roll' };
const FEATS = { type: 'feats_of_chaos', name: 'Feats of Chaos', target: 'd20', condition: 'feats_of_chaos_active', effect: 'advantage', abilities: [], hasAutomation: true };
const FEATS_WRONG_COND = { type: 'feats_of_chaos', name: 'Feats of Chaos', target: 'd20', condition: 'other', effect: 'advantage', abilities: [], hasAutomation: true };
const AUTO_NOISE = { type: 'auto_effect', effect: 'unrelated_auto_effect', name: 'Noise' };
const TAMED = { type: 'wild_magic_tamed', name: 'Tamed Surge', trigger: 'after_sorcerer_spell_slot', recharge: 'long_rest', uses: 1, hasAutomation: true };

const SPELL = { name: 'Burning Hands', level: 1 };
const SLOT = { slotLevel: 1 };

function mkStats(passives, over = {}) {
    return { name: 'Sorcerer', class: { name: 'Sorcerer' }, automation: { passives }, wildMagicSurgeTable: SURGE_TABLE, ...over };
}

const rollAutomation = (oncePerTurn, extra = {}) => ({ type: 'wild_magic_surge', trigger: 'after_sorcerer_spell_slot', oncePerTurn, ...extra });
const rollWrite = (owner = 'Sorcerer', round = 1) => ({ owner, key: 'surgeUsedRound', value: { round, activeCreature: owner }, arity: 4, skipSync: undefined });
const featWrite = (key, value) => ({ owner: 'Sorcerer', key, value, arity: 5, skipSync: true });
const ROLL_READS = ['featsOfChaosActive/arity3', 'surgeUsedRound/arity2'];
const TAMED_READ = 'tamedSurgeUses/arity3';
const MISS_GUARD = '[wildMagicSurgeService] Missing array:';
const SPELL_GUARD = '[wildMagicSurgeService] Missing spell:';

const ROWS = [
    // ---- gate lane: silent null, zero dispatch/read/write ----------
    { lane: 'gate', label: 'playerStats null → silent', stats: null },
    { lane: 'gate', label: 'playerStats undefined → silent', stats: undefined },
    { lane: 'gate', label: 'Wizard caster, non-Sorcerer spell → silent', stats: mkStats([SURGE_2024], { class: { name: 'Wizard' } }) },
    { lane: 'gate', label: 'Wizard caster near-miss classes:["Wizard"] → silent', stats: mkStats([SURGE_2024], { class: { name: 'Wizard' } }), spell: { ...SPELL, classes: ['Wizard'] } },
    { lane: 'gate', label: 'cantrip (slotLevel 0, level 0) → silent before any feature read', stats: mkStats([SURGE_2024, TAMED]), spell: { name: 'Fire Bolt', level: 0 }, metaCtx: { slotLevel: 0 } },
    // #1433(b): caster-class gate — the spell's class list is NOT the gate.
    { lane: 'gate', label: '#1433(b) FIXED: Wizard casting Sorcerer-listed spell → silent (was dispatch — RAW surge only BY a Sorcerer)', stats: mkStats([SURGE_2024], { name: 'Zosime', class: { name: 'Wizard' } }), spell: { ...SPELL, classes: ['Sorcerer'] } },
    { lane: 'gate', label: '#1433(b): Fighter + Sorcerer-listed spell + SURGE_5E_DISK live passive → still silent (class gate upstream of finder)', stats: mkStats([SURGE_5E_DISK], { name: 'Zosime', class: { name: 'Fighter' } }), spell: { ...SPELL, classes: ['Sorcerer'] } },
    { lane: 'gate', label: '#1433(c): Wizard + null spell → class-gate silent BEFORE spell deref (was TypeError at spell.classes)', stats: mkStats([SURGE_2024], { class: { name: 'Wizard' } }), spell: null },
    { lane: 'gate', label: '#1433(c): Wizard + undefined spell → class-gate silent (was TypeError at spell.classes)', stats: mkStats([SURGE_2024], { class: { name: 'Wizard' } }), spell: undefined },
    { lane: 'gate', label: '#1433(c): Sorcerer + null spell, no slotLevel → loud refuse, zero dispatch (was TypeError at spell.level)', stats: mkStats([SURGE_2024]), spell: null, metaCtx: {}, errByte: SPELL_GUARD, errArg: null },
    { lane: 'gate', label: '#1433(c): Sorcerer + null spell + slotLevel:1 → loud refuse, ZERO dispatch (was phantom surge dispatched)', stats: mkStats([SURGE_2024]), spell: null, errByte: SPELL_GUARD, errArg: null },
    { lane: 'gate', label: '#1433(c): Sorcerer + undefined spell + slotLevel:1 → loud refuse, ZERO dispatch', stats: mkStats([SURGE_2024]), spell: undefined, errByte: SPELL_GUARD, errArg: undefined },
    { lane: 'gate', label: 'executeHandler resolves null → null normalized, latch NOT stamped (result && markOnce)', stats: mkStats([SURGE_2024]), result: null, reads: ROLL_READS, writes: [], dispatches: 1 },
    { lane: 'gate', label: 'surgeUsedRound stamp at current round → null, no re-stamp', stats: mkStats([SURGE_2024]), seed: [['Sorcerer.surgeUsedRound', { round: 1, activeCreature: 'Sorcerer' }]], reads: ROLL_READS },
    // ---- golden guards: missing-array throws, junk passives TypeError (console census) ----------
    { lane: 'reject', label: 'automation missing → first getter guard throws before any read', stats: { name: 'Sorcerer', class: { name: 'Sorcerer' }, wildMagicSurgeTable: SURGE_TABLE }, msg: 'Expected array, got undefined', errByte: MISS_GUARD, errArg: undefined },
    { lane: 'reject', label: 'automation.passives null → guard throws', stats: mkStats(null), msg: 'Expected array, got null', errByte: MISS_GUARD, errArg: null },
    { lane: 'reject', label: 'passives non-array 42 → == null guard does not cover junk, TypeError, console untouched', stats: mkStats(42), msg: 'passives.find is not a function' },
    { lane: 'reject', label: 'wildMagicSurgeTable null → guard throws after latch read, never stamped', stats: mkStats([SURGE_2024], { wildMagicSurgeTable: null }), reads: ROLL_READS, writes: [], msg: 'Expected array, got null', errByte: MISS_GUARD, errArg: null },
    { lane: 'reject', label: 'wildMagicSurgeTable undefined variant', stats: mkStats([SURGE_2024], { wildMagicSurgeTable: undefined }), reads: ROLL_READS, writes: [], msg: 'Expected array, got undefined', errByte: MISS_GUARD, errArg: undefined },
    { lane: 'reject', label: 'executeHandler rejects → rethrow + exact log byte, latch NOT stamped', stats: mkStats([SURGE_2024]), reject: new Error('Handler failed'), reads: ROLL_READS, writes: [], actions: 1, msg: 'Handler failed', errByte: '[wildMagicSurge] Failed to execute surge for Wild Magic Surge:', errArgOwn: true },
    // ---- roll lane: exact action envelope + full read/write censuses ----------
    // ---- dispatch lanes (post-fix: sorcerer + real spell slot casts only) ----------
    { lane: 'dispatch', label: '#1433(a) FIXED: 5e-disk auto_effect surge passive (classes.json:11355 trigger roll_1_on_wild_magic_d20 effect wild_magic_surge_table) LIVE via fingerprint (automation/index.js:679 precedent); disk carries no oncePerTurn byte → envelope false, 2014 once-per-turn RAW enforced by surgeUsedRound latch', stats: mkStats([SURGE_5E_DISK]), action: { name: 'Wild Magic Surge', automation: rollAutomation(false), wildMagicSurgeTable: SURGE_TABLE }, reads: ROLL_READS, writes: [rollWrite()] },
    { lane: 'dispatch', label: '2024 disk passive oncePerTurn:true byte', stats: mkStats([SURGE_2024]), action: { name: 'Wild Magic Surge', automation: rollAutomation(true), wildMagicSurgeTable: SURGE_TABLE }, reads: ROLL_READS, writes: [rollWrite()] },
    { lane: 'dispatch', label: 'legacy passive: oncePerTurn || false, trigger hardcoded over empty byte', stats: mkStats([SURGE_LEGACY]), action: { name: 'Wild Surge', automation: rollAutomation(false), wildMagicSurgeTable: SURGE_TABLE }, reads: ROLL_READS, writes: [rollWrite()] },
    { lane: 'dispatch', label: 'metaCtx {} falls back to spell.level 3', stats: mkStats([SURGE_2024]), metaCtx: {}, spell: { ...SPELL, level: 3 }, action: { name: 'Wild Magic Surge', automation: rollAutomation(true), wildMagicSurgeTable: SURGE_TABLE }, reads: ROLL_READS, writes: [rollWrite()] },
    { lane: 'dispatch', label: 'slotLevel:0 + spell.level:1 OR-gate dispatches (slot 0 does not :0-swallow a leveled spell)', stats: mkStats([SURGE_2024]), metaCtx: { slotLevel: 0 }, action: { name: 'Wild Magic Surge', automation: rollAutomation(true), wildMagicSurgeTable: SURGE_TABLE }, reads: ROLL_READS, writes: [rollWrite()] },
    { lane: 'dispatch', label: 'near-miss passives skipped; first wild_magic_surge wins ([0]); no double-roll write without exact effect key', stats: mkStats([AUTO_NOISE, FEATS_WRONG_COND, SURGE_2024, SURGE_SECOND]), action: { name: 'Wild Magic Surge', automation: rollAutomation(true), wildMagicSurgeTable: SURGE_TABLE }, reads: ROLL_READS, writes: [rollWrite()] },
    { lane: 'dispatch', label: 'Controlled Chaos writes wildMagicDoubleRoll(skipSync=true) BEFORE latch write', stats: mkStats([SURGE_2024, CONTROLLED_CHAOS]), action: { name: 'Wild Magic Surge', automation: rollAutomation(true), wildMagicSurgeTable: SURGE_TABLE }, reads: ROLL_READS, writes: [featWrite('wildMagicDoubleRoll', true), rollWrite()] },
    { lane: 'dispatch', label: 'feats passive armed=false → normal lane, no feats writes, no autoSurge byte', stats: mkStats([SURGE_2024, FEATS]), seed: [['Sorcerer.featsOfChaosActive', false]], action: { name: 'Wild Magic Surge', automation: rollAutomation(true), wildMagicSurgeTable: SURGE_TABLE }, reads: ROLL_READS, writes: [rollWrite()] },
    { lane: 'dispatch', label: 'feats latch strict ===true: string "true" stays unarmed', stats: mkStats([SURGE_2024, FEATS]), seed: [['Sorcerer.featsOfChaosActive', 'true']], action: { name: 'Wild Magic Surge', automation: rollAutomation(true), wildMagicSurgeTable: SURGE_TABLE }, reads: ROLL_READS, writes: [rollWrite()] },
    { lane: 'dispatch', label: 'empty surgeTable [] dispatches (row-mapping owned by handler lane)', stats: mkStats([SURGE_2024], { wildMagicSurgeTable: [] }), action: { name: 'Wild Magic Surge', automation: rollAutomation(true), wildMagicSurgeTable: [] }, reads: ROLL_READS, writes: [rollWrite()] },
    // ---- once-per-round latch (round-scoped, never a clock) ----------
    { lane: 'dispatch', label: 'round wrap re-arm: stale mirror never stamped, holder name stamped (FT-082)', stats: mkStats([SURGE_2024]), seed: [['Sorcerer.surgeUsedRound', { round: 1, activeCreature: 'Sorcerer' }]], round: 2, action: { name: 'Wild Magic Surge', automation: rollAutomation(true), wildMagicSurgeTable: SURGE_TABLE }, reads: ROLL_READS, writes: [rollWrite('Sorcerer', 2)] },
    // ---- feats of chaos auto lane (CLA-134: runtime latch OR cast-time stamp) ----------
    { lane: 'dispatch', label: 'feats armed at runtime → autoSurge, latch consumed, short-circuit before latch read', stats: mkStats([SURGE_2024, FEATS]), seed: [['Sorcerer.featsOfChaosActive', true]], action: { name: 'Wild Magic Surge', automation: rollAutomation(true, { autoSurge: true }), wildMagicSurgeTable: SURGE_TABLE }, reads: ['featsOfChaosActive/arity3'], writes: [featWrite('featsOfChaosActive', false), featWrite('featsOfChaosUses', 1)] },
    { lane: 'dispatch', label: 'CLA-134: runtime latch consumed → cast-time metaCtx stamp re-arms autoSurge', stats: mkStats([SURGE_2024, FEATS]), metaCtx: { slotLevel: 1, featsOfChaosArmedAtCast: true }, action: { name: 'Wild Magic Surge', automation: rollAutomation(true, { autoSurge: true }), wildMagicSurgeTable: SURGE_TABLE }, reads: ['featsOfChaosActive/arity3'], writes: [featWrite('featsOfChaosActive', false), featWrite('featsOfChaosUses', 1)] },
    // ---- tamed chooser lane (CLA-354: chooser INSTEAD of roll, checked first) ----------
    { lane: 'dispatch', label: 'CLA-354: tamed available (uses unset→null normalized 1) → chooser, full passive spread into automation', stats: mkStats([SURGE_2024, TAMED]), result: { type: 'modal', modalName: 'wildMagicSurge', payload: { mode: 'tamedSurge' } }, action: { name: 'Tamed Surge', automation: { ...TAMED } }, reads: [TAMED_READ], writes: [] },
    { lane: 'dispatch', label: 'CLA-354: tamed-only caster (no wild_magic_surge passive) still gets chooser', stats: mkStats([TAMED]), result: { type: 'modal', modalName: 'wildMagicSurge', payload: { mode: 'tamedSurge' } }, action: { name: 'Tamed Surge', automation: { ...TAMED } }, reads: [TAMED_READ], writes: [] },
    { lane: 'dispatch', label: 'CLA-354: chooser precedence beats Controlled Chaos (no wildMagicDoubleRoll write)', stats: mkStats([SURGE_2024, CONTROLLED_CHAOS, TAMED]), result: { type: 'modal', modalName: 'wildMagicSurge', payload: { mode: 'tamedSurge' } }, action: { name: 'Tamed Surge', automation: { ...TAMED } }, reads: [TAMED_READ], writes: [] },
    { lane: 'dispatch', label: 'CLA-354: tamedSurgeUses:0 → falls through to roll lane', stats: mkStats([SURGE_2024, TAMED]), seed: [['Sorcerer.tamedSurgeUses', 0]], action: { name: 'Wild Magic Surge', automation: rollAutomation(true), wildMagicSurgeTable: SURGE_TABLE }, reads: [TAMED_READ, ...ROLL_READS], writes: [rollWrite()] },
    { lane: 'dispatch', label: 'CLA-354: wish-only table (slice(0,-1) empty) → no chooser, roll lane keeps full table', stats: mkStats([SURGE_2024, TAMED], { wildMagicSurgeTable: WISH_ONLY_TABLE }), action: { name: 'Wild Magic Surge', automation: rollAutomation(true), wildMagicSurgeTable: WISH_ONLY_TABLE }, reads: [TAMED_READ, ...ROLL_READS], writes: [rollWrite()] },
    { lane: 'reject', label: 'CLA-354: tamed + missing table → ||[] swallows chooser, roll-lane guard throws', stats: mkStats([SURGE_2024, TAMED], { wildMagicSurgeTable: undefined }), reads: [TAMED_READ, ...ROLL_READS], writes: [], msg: 'Expected array, got undefined', errByte: MISS_GUARD, errArg: undefined },
];

const LANES = {
    gate: ROWS.filter(r => r.lane === 'gate'),
    reject: ROWS.filter(r => r.lane === 'reject'),
    dispatch: ROWS.filter(r => r.lane === 'dispatch'),
};

let errSpy;

function setup(row) {
    row.__stats = 'stats' in row ? row.stats : mkStats([SURGE_2024]);
    (row.seed || []).forEach(([k, v]) => H.seed(k, v));
    if (row.round !== undefined) H.state.round = row.round;
    if (row.reject) {
        row.__first = row.reject;
        H.state.results.push({ __reject: row.reject });
    } else {
        row.__first = 'result' in row ? row.result : { type: 'popup', payload: {} };
        H.state.results.push(row.__first);
    }
}

function call(row) {
    return triggerWildMagicSurge(
        'spell' in row ? row.spell : SPELL,
        'metaCtx' in row ? row.metaCtx : SLOT,
        row.__stats,
        H.CAMPAIGN,
        H.MAP,
    );
}

function assertConsole(row) {
    if (row.errByte === undefined) {
        expect(errSpy).not.toHaveBeenCalled();
        return;
    }
    expect(errSpy).toHaveBeenCalledTimes(1);
    expect(errSpy.mock.calls[0][0]).toBe(row.errByte);
    if (row.errArgOwn) {
        expect(errSpy.mock.calls[0][1]).toBe(row.reject);
    } else if ('errArg' in row) {
        expect(errSpy.mock.calls[0][1]).toBe(row.errArg);
    }
}

describe('wildMagicSurgeService.triggerWildMagicSurge', () => {
    beforeEach(() => {
        H.reset();
        errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('gate lanes (silent null / normalized passthrough)', () => {
        it.each(LANES.gate)('$label', async (row) => {
            setup(row);
            const result = await call(row);
            expect(result).toBeNull();
            expect(H.state.actions).toHaveLength(row.dispatches || 0);
            expect(H.state.reads).toEqual(row.reads || []);
            expect(H.state.writes).toEqual(row.writes || []);
            assertConsole(row);
        });
    });

    describe('crash sites + guard throws (exact bytes, nothing stamped)', () => {
        it.each(LANES.reject)('$label', async (row) => {
            setup(row);
            await expect(call(row)).rejects.toThrow(row.msg);
            expect(H.state.actions).toHaveLength(row.actions || 0);
            expect(H.state.reads).toEqual(row.reads || []);
            expect(H.state.writes).toEqual(row.writes || []);
            assertConsole(row);
        });
    });

    describe('dispatch lanes (exact action envelope + result identity + full read/write censuses)', () => {
        it.each(LANES.dispatch)('$label', async (row) => {
            setup(row);
            const result = await call(row);
            expect(H.state.actions).toHaveLength(1);
            expect(H.state.actions[0]).toEqual(row.action);
            expect(H.state.statsPass[0]).toBe(row.__stats); // playerStats passed through by identity
            expect(result).toBe(row.__first);
            expect(H.state.reads).toEqual(row.reads);
            expect(H.state.writes).toEqual(row.writes);
            assertConsole(row);
        });
    });
});

// #1433(a): DISK TRIGGER-VOCABULARY CENSUS — reads the REAL bytes of both
// ruleset classes.json files, pushes every Sorcerer wild-magic feature
// through the REAL collector producer (automationInfoBuilder/core-handlers.js
// auto_effect :17) and RIDES THE PUBLIC SEAM triggerWildMagicSurge
// (#1433 export-surface-shrink: the finders are module-local now, so disk
// rows are pinned by what the seam DISPATCHES and WRITES — fix#297 row-9
// restructure-pins pattern). A row the finders stop seeing flips this lane:
// ZERO dispatch / no envelope name / no double-roll stamp.
// Paths are cwd-relative: vitest's jsdom rewrites import.meta.url to an
// http URL (non-file scheme), so URL-based resolution is unavailable.
describe('wildMagicSurgeService #1433 disk trigger census (real disk bytes → public seam)', () => {
    const DISK = {
        legacy: {
            file: 'public/data/classes.json',
            surgeTuple: { type: 'auto_effect', trigger: 'roll_1_on_wild_magic_d20', effect: 'wild_magic_surge_table' },
            rawQuote: 'immediately after you cast a sorcerer spell of 1st level or higher',
        },
        current: {
            file: 'public/data/2024/classes.json',
            surgeTuple: { type: 'wild_magic_surge', trigger: 'after_sorcerer_spell_slot' },
            rawQuote: 'immediately after you cast a Sorcerer spell with a spell slot',
        },
    };

    function sorcererWildMagicPassives(file) {
        const data = JSON.parse(fs.readFileSync(file, 'utf8'));
        const sorcerer = (Array.isArray(data) ? data : data.classes || Object.values(data))
            .find(c => c && (c.index === 'sorcerer' || c.name === 'Sorcerer'));
        if (!sorcerer) throw new Error('no Sorcerer row on disk — census fixture drifted');
        const features = [];
        const walk = o => {
            if (Array.isArray(o)) return o.forEach(walk);
            if (o && typeof o === 'object') {
                if (o.name && o.automation && /wild_magic/.test(JSON.stringify(o.automation))) features.push(o);
                Object.values(o).forEach(walk);
            }
        };
        walk(sorcerer);
        // Collector producer fidelity: core-handlers dispatches on automation.type.
        return {
            passives: features.map(f => coreHandlers[f.automation.type](f)),
            features,
        };
    }

    // One public-seam run: fresh store, one queued executeHandler result.
    async function runSeam(stats, seeds = []) {
        H.reset();
        seeds.forEach(([k, v]) => H.seed(k, v));
        const expected = { type: 'popup', payload: {} };
        H.state.results.push(expected);
        const result = await triggerWildMagicSurge(SPELL, SLOT, stats, H.CAMPAIGN, H.MAP);
        expect(result).toBe(expected); // result identity passthrough
        return expected;
    }

    let diskErrSpy;
    beforeEach(() => { diskErrSpy = vi.spyOn(console, 'error').mockImplementation(() => {}); });
    afterEach(() => { vi.restoreAllMocks(); });

    for (const [ruleset, spec] of Object.entries(DISK)) {
        it(`${ruleset}: disk surge row rides the roll-lane seam — exact envelope + full read/write census; RAW 'you cast' quote present`, async () => {
            const { passives, features } = sorcererWildMagicPassives(spec.file);
            expect(passives.length).toBeGreaterThan(0);
            // Collector-fidelity byte census (disk bytes, not memory): names
            // and the surge type/trigger/effect triple ride every passive.
            const surgeRow = passives.find(p => p.name === 'Wild Magic Surge');
            const chaosRow = passives.find(p => p.effect === 'wild_magic_double_roll');
            expect(surgeRow).toBeDefined();
            expect(chaosRow).toBeDefined();
            expect({ type: surgeRow.type, trigger: surgeRow.trigger, effect: surgeRow.effect })
                .toEqual(spec.surgeTuple);
            // RAW law byte-check: the surge feature text is second-person,
            // living INSIDE the Sorcerer class block — 'you' is the Sorcerer.
            const surgeFeature = features.find(f => /wild_magic_surge|roll_1_on_wild_magic/.test(JSON.stringify(f.automation)) && !/double_roll/.test(JSON.stringify(f.automation)));
            expect(surgeFeature.description).toContain(spec.rawQuote);

            // Roll-lane run on the FULL disk passive set. legacy: no tamed
            // row → the tamed clause short-circuits BEFORE any store read.
            // current: tamedSurgeUses=0 seed defuses the chooser so BOTH
            // rulesets ride the same surge+chaos finder seam. oncePerTurn is
            // derived from the disk passive byte, never hardcoded.
            await runSeam(mkStats(passives), ruleset === 'current' ? [['Sorcerer.tamedSurgeUses', 0]] : []);
            expect(H.state.actions).toHaveLength(1);
            expect(H.state.actions[0]).toEqual({
                name: 'Wild Magic Surge',
                automation: rollAutomation(surgeRow.oncePerTurn || false),
                wildMagicSurgeTable: SURGE_TABLE,
            });
            // Controlled Chaos rides its own finder → wildMagicDoubleRoll
            // (skipSync=true) stamped BEFORE the latch write; the chaos row is
            // NEVER the dispatched feature (envelope name pin above).
            expect(H.state.reads).toEqual([...(ruleset === 'current' ? [TAMED_READ] : []), ...ROLL_READS]);
            expect(H.state.writes).toEqual([featWrite('wildMagicDoubleRoll', true), rollWrite()]);
            expect(diskErrSpy).not.toHaveBeenCalled();
        });

        it(`${ruleset}: near-miss keep-out — Controlled Chaos alone NEVER fires the surge lane (zero dispatch, zero IO)`, async () => {
            const { passives } = sorcererWildMagicPassives(spec.file);
            const chaosRow = passives.find(p => p.effect === 'wild_magic_double_roll');
            // Were the surge finder ever widened to swallow auto_effect
            // double_roll rows, this seam would dispatch here.
            H.reset();
            const result = await triggerWildMagicSurge(SPELL, SLOT, mkStats([chaosRow]), H.CAMPAIGN, H.MAP);
            expect(result).toBeNull();
            expect(H.state.actions).toHaveLength(0);
            expect(H.state.reads).toEqual([]);
            expect(H.state.writes).toEqual([]);
            expect(diskErrSpy).not.toHaveBeenCalled();
        });
    }

    it('current: disk Tamed Surge row rides the chooser lane with its full disk bytes spread into the envelope', async () => {
        const { passives } = sorcererWildMagicPassives(DISK.current.file);
        const tamedRow = passives.find(p => p.type === 'wild_magic_tamed');
        expect(tamedRow).toBeDefined(); // 2024-only row: disk bytes verbatim
        // Default store: tamedSurgeUses unset → null normalized 1 (CLA-354).
        await runSeam(mkStats(passives));
        expect(H.state.actions).toHaveLength(1);
        expect(H.state.actions[0].name).toBe('Tamed Surge');
        expect(H.state.actions[0].automation).toMatchObject({
            type: 'wild_magic_tamed',
            trigger: 'after_sorcerer_spell_slot',
            recharge: 'long_rest',
            uses: 1,
        });
        expect(H.state.reads).toEqual([TAMED_READ]);
        expect(H.state.writes).toEqual([]); // chooser short-circuits before chaos/latch
        expect(diskErrSpy).not.toHaveBeenCalled();
    });

    it('legacy: no Tamed Surge row on 2014 disk — finder-miss short-circuits before any tamedSurgeUses read', async () => {
        const { passives } = sorcererWildMagicPassives(DISK.legacy.file);
        expect(passives.some(p => p.type === 'wild_magic_tamed')).toBe(false);
        await runSeam(mkStats(passives));
        expect(H.state.reads).not.toContain(TAMED_READ); // byte-order proof
        expect(H.state.actions).toHaveLength(1); // roll lane took the seam
    });
});
