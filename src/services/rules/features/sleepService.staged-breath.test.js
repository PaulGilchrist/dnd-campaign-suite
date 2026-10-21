// @maintained-by-ai
// MA-0068: Adult Brass Dragon Sleep Breath — the staged-breath face of the
// DUAL-FACE sleepService (SP-107 Sleep spell owns the defaults; the breath
// rides the SAME seams via options: CON repeat save, concentrate:false, no
// caster concentration). Disk canon read PROGRAMMATICALLY from
// public/data/monsters.json (monsters are 5e-shared only — no
// public/data/2024/monsters.json exists, so there is no second-ruleset copy):
// Adult Brass Dragon Sleep Breath save_dc 18 / save_type "Constitution" /
// staged_sleep.unconscious_minutes 10 → unconsciousRounds 100 (minutes×10
// CLA-334) is computed at PICKER-ARM by sleepStagingForAction
// (MonsterCardModal.jsx:293-296) and passed through SaveAttackAoeModal.jsx:759-765
// (?? 100 fallback). THIS service carries rounds only — grep-clean of
// Date.now/setTimeout/setInterval: the 100-round clock matures exclusively at
// turn seams via addExpiration/expirationQueue (seam-clear owners #1285/#1294).
// Near-miss rows never stage through this lane (NO staged_sleep key):
// Brass Dragon Wyrmling DC 11, Young Brass Dragon DC 14; Ancient Brass
// Dragon DC 21 stages the identical shape (drives the takeover leg below).
//
// #1295 CLASS THIRD MEMBER (CONFIRMED): EVERY reader filters targetEffects by
// effect+target and NEVER te.source — findSleepEffect (sleepService.js:22-25),
// the stageSleepTargets existingIdx replace (128), the applySleepTurnEnd
// findIndex (217), the wakeSleepTarget filter (269). Writers DO carry
// te.source, so a second brass dragon re-staging the SAME target silently
// takes over the first ladder's envelope (source/dc swap, one te per target
// by design). Pinned honestly below; collateral on other targets survives.
// Same te key 'sleep_staged' fronts BOTH producers by design (#1378): the
// spell (WIS/concentration) and the breath (CON/staged_until_repeat_save) —
// te.saveType is the only discriminator; the ladder itself is shared.
//
// Quirk pins: STRICT lowercase stage gate (applySleepTurnEnd:197) — a
// capital-"Incapacitated" GM te is handled:false fully inert (OPPOSITE of the
// paralyzing twin #1390, whose capital stage rides the escalate leg), while
// condition filtering is case-INsensitive (lower(), :63/:70); sparse GM te
// falls back dc ?? 10 / saveType WIS / unconsciousRounds ?? 10 / logLabel
// "Sleep spell" — the SPELL shape leaks onto the DRAGON face (drift pin vs
// disk Constitution/100-round); wakeSleepTarget's reason byte hardcodes
// "Sleep ends (target took damage)" — the te's 'Sleep Breath' label NEVER
// appears in wake logs; PC prompt ??0-swallow logs "rolled 0 + 0 = 0".
// Key convention (test-maintain-bugs.md:222, pass #235): combat-summary save
// bonuses are consumed under the ABBREVIATED saveBonuses.con key
// (saveTypeAbbr), never a full-word 'constitution' key — pinned in the walk.
//
// OWNERSHIP: base sleepService.test.js owns the plain-spell face (triggerSleep,
// isSleepImmune, WIS/concentration defaults incl. the concentrate-true
// staging + already-concentrating skip, plain no-te/already-unconscious no-ops,
// skipSync honour, zero-damage/shake wake reasons). SaveAttackAoeModal.staged-sleep
// owns the picker call-args; MonsterCardModal.sleep-breath owns disk-row
// transport + recharge and EXPLICITLY delegates "turn-END sleep ladder" here.
// This file owns ONLY the staged-breath service bytes: disk-driven envelope,
// concentrate:false short-circuit, CON ladder compose, >= tie, PC prompt,
// sparse/gate fallbacks, breath wake bytes, log-failure robustness.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../ui/storage.js', () => ({
    default: { set: vi.fn() },
}));

vi.mock('../../ui/logService.js', () => ({
    addEntry: vi.fn(),
}));

vi.mock('../../encounters/combatData.js', () => ({
    getCombatSummary: vi.fn(),
}));

vi.mock('../../combat/concentration/concentrationService.js', () => ({
    addConcentration: vi.fn(),
}));

vi.mock('../../npcs/monsterUtils.js', () => ({
    getMonsterData: vi.fn(),
}));

vi.mock('../effects/tranceRules.js', () => ({
    hasTranceTrait: vi.fn(() => false),
}));

vi.mock('../../automation/common/savePrompt.js', () => ({
    createSaveListener: vi.fn(),
}));

vi.mock('../effects/expirationQueue.js', () => ({
    addExpiration: vi.fn(),
}));

vi.mock('../../automation/index.js', () => ({
    executeHandler: vi.fn(),
}));

import storage from '../../ui/storage.js';
import {
    stageSleepTargets,
    applySleepTurnEnd,
    wakeSleepOnDamage,
    SLEEP_TE_EFFECT,
} from './sleepService.js';
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { getCombatSummary } from '../../encounters/combatData.js';
import { addConcentration } from '../../combat/concentration/concentrationService.js';
import { addEntry } from '../../ui/logService.js';
import { createSaveListener } from '../../automation/common/savePrompt.js';
import { addExpiration } from '../effects/expirationQueue.js';

const campaignName = 'test-campaign';
const CASTER = 'Adult Brass Dragon 1';
const CASTER2 = 'Ancient Brass Dragon 2';
const T1 = 'Thug 1';
const T2 = 'Thug 2';
const PC = 'PlayerB';

// Disk canon, programmatic (drift-proof): the exact row + minutes×10 seam the
// picker applies at arm time (MonsterCardModal.jsx:293-296).
const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const roster = Array.isArray(monsters) ? monsters : (monsters.monsters || Object.values(monsters));
const breathOf = (name) => {
    const row = roster.find(m => m.name === name);
    return [...(row.multi_actions || []), ...(row.actions || [])].find(a => a.name === 'Sleep Breath');
};
const adultBreath = breathOf('Adult Brass Dragon');
const ancientBreath = breathOf('Ancient Brass Dragon');
const DISK_DC = adultBreath.save_dc; // 18
const ANC_DC = ancientBreath.save_dc; // 21
const DISK_ROUNDS = (Number(adultBreath.staged_sleep.unconscious_minutes) || 1) * 10; // 100

// Byte mirror of stageSleepEffect()'s producer envelope for the breath face —
// the real caller (SaveAttackAoeModal.applyStagedSleepSave) passes exactly
// these disk-driven values: disk save_type 'Constitution' → te 'CON'.
function breathTe(overrides = {}) {
    return {
        target: T1,
        effect: SLEEP_TE_EFFECT,
        source: CASTER,
        condition: 'incapacitated',
        stage: 'incapacitated',
        dc: DISK_DC,
        saveType: 'CON',
        duration: 'staged_until_repeat_save',
        label: 'Sleep Breath',
        logLabel: 'Sleep Breath',
        unconsciousRounds: DISK_ROUNDS,
        ...overrides,
    };
}

// ── Strict argument-keyed STATEFUL runtime store fake ──────────────────────
// Throws on any unexpected campaign, owner/key pairing, unseeded save prompt,
// or unstubbed d20 roll — no silent undefined branches. Reads return
// structural clones (real store fidelity); writes land in the store so the
// ladder COMPOSES across invocations, and every write is budget-recorded with
// its skipSync POSITION (#1341) plus a read-order census (#1372).
let store, cs, writes, reads, logs, prompts, expirations, rolls;

const jclone = (v) => JSON.parse(JSON.stringify(v)); // store values are JSON-safe

function assertScope(owner, key, campaign, op) {
    if (campaign !== campaignName) throw new Error(`[test-fake] unexpected campaign "${campaign}" on ${op}`);
    const ok = owner === 'campaign' ? key === 'targetEffects' : key === 'activeConditions';
    if (!ok) throw new Error(`[test-fake] unexpected ${op} ${owner}.${key} (no concentration/damage reads allowed in this lane)`);
}

beforeEach(() => {
    vi.resetAllMocks();
    store = { campaign: { targetEffects: [] } };
    cs = { creatures: [] };
    writes = [];
    reads = [];
    logs = [];
    prompts = [];
    expirations = [];
    rolls = [];

    getRuntimeValue.mockImplementation((owner, key, campaign) => {
        assertScope(owner, key, campaign, 'read');
        reads.push([owner, key]);
        const bucket = store[owner];
        return bucket && bucket[key] !== undefined ? jclone(bucket[key]) : null;
    });
    setRuntimeValue.mockImplementation((owner, key, value, campaign, skipSync) => {
        assertScope(owner, key, campaign, 'write');
        if (!Array.isArray(value)) throw new Error(`[test-fake] write ${owner}.${key} must be an array, got ${typeof value}`);
        if (!store[owner]) store[owner] = {};
        store[owner][key] = jclone(value);
        writes.push({ owner, key, value: jclone(value), skipSync });
        return Promise.resolve();
    });
    addEntry.mockImplementation((campaign, entry) => {
        if (campaign !== campaignName) throw new Error(`[test-fake] unexpected campaign "${campaign}" on addEntry`);
        logs.push(jclone(entry));
        return Promise.resolve();
    });
    getCombatSummary.mockImplementation((campaign) => {
        if (campaign !== campaignName) throw new Error(`[test-fake] unexpected campaign "${campaign}" on getCombatSummary`);
        return cs;
    });
    // Player legs must seed their prompt outcome explicitly — an unseeded
    // repeat-save prompt is a test bug, so THROW instead of hang.
    createSaveListener.mockImplementation(() => {
        throw new Error('[test-fake] unexpected save prompt — seed createSaveListener first');
    });
    addExpiration.mockImplementation((entry) => { expirations.push(jclone(entry)); });
    // Fixed-natural d20 queue: roll = floor(((n-1)/20)*20)+1 = n exactly.
    // An unstubbed roll inside this lane is a test bug — THROW.
    vi.spyOn(Math, 'random').mockImplementation(() => {
        if (!rolls.length) throw new Error('[test-fake] unstubbed d20 roll — seed dice(n) first');
        return (rolls.shift() - 1) / 20;
    });
});

afterEach(() => {
    vi.restoreAllMocks(); // always release Math.random + console spies
});

const dice = (...naturals) => rolls.push(...naturals);
const tuples = (from = 0) => writes.slice(from).map(w => [w.owner, w.key, w.value, w.skipSync]);

describe('MA-0068 sleepService staged-breath face (Adult Brass Dragon Sleep Breath)', () => {
    it('stages a byte-exact disk-driven te per failed target (Constitution→CON live branch, concentrate:false short-circuits concentration + storage + combat-summary read); a same-target re-stage REPLACES — Ancient Brass DC 21 silently takes over the ladder (#1295-class third member)', async () => {
        // Disk canon canaries — invented nothing (#1362): these are the REAL rows.
        expect(adultBreath.save_dc).toBe(18);
        expect(adultBreath.save_type).toBe('Constitution');
        expect(DISK_ROUNDS).toBe(100);
        expect(ancientBreath.staged_sleep.unconscious_minutes).toBe(10);
        for (const nearMiss of ['Brass Dragon Wyrmling', 'Young Brass Dragon']) {
            expect(breathOf(nearMiss).staged_sleep).toBeUndefined(); // never staged via this lane
        }

        store[T1] = { activeConditions: ['poisoned'] }; // pre-existing condition survives the append
        const options = {
            saveType: adultBreath.save_type, // disk 'Constitution' → saveTypeAbbr word lookup is the LIVE branch
            concentrate: false,
            label: adultBreath.name,
            logLabel: adultBreath.name,
            unconsciousRounds: DISK_ROUNDS,
        };

        const staged = await stageSleepTargets(campaignName, CASTER, [T1, T2], DISK_DC, options);

        expect(staged).toEqual([T1, T2]);
        expect(options).toEqual({
            saveType: 'Constitution', concentrate: false, label: 'Sleep Breath',
            logLabel: 'Sleep Breath', unconsciousRounds: 100,
        }); // input purity (#1395): sleepStageSpec never mutates the caller's options
        expect(store[T1].activeConditions).toEqual(['poisoned', 'incapacitated']);
        expect(store[T2].activeConditions).toEqual(['incapacitated']);
        expect(store.campaign.targetEffects).toEqual([breathTe(), breathTe({ target: T2 })]);
        expect(Object.keys(store.campaign.targetEffects[0])).toEqual([
            'target', 'effect', 'source', 'condition', 'stage', 'dc', 'saveType', 'duration', 'label', 'logLabel', 'unconsciousRounds',
        ]);
        // Write budget: per-target condition writes carry explicit skipSync:false
        // (applyCondition arg, sleepService.js:126); the single te write is 4-arg
        // → skipSync undefined (producer broadcasts, #1341 position-audited).
        expect(tuples()).toEqual([
            [T1, 'activeConditions', ['poisoned', 'incapacitated'], false],
            [T2, 'activeConditions', ['incapacitated'], false],
            ['campaign', 'targetEffects', [breathTe(), breathTe({ target: T2 })], undefined],
        ]);
        // Read-order census: campaign pool first, then one condition read per target.
        expect(reads).toEqual([
            ['campaign', 'targetEffects'],
            [T1, 'activeConditions'],
            [T2, 'activeConditions'],
        ]);
        expect(getCombatSummary).not.toHaveBeenCalled(); // concentrate:false returns BEFORE the spell's concentration block
        expect(addConcentration).not.toHaveBeenCalled();
        expect(storage.set).not.toHaveBeenCalled();
        expect(logs).toHaveLength(0);        // staging itself is silent (the modal lane owns roll/grant logs)
        expect(expirations).toHaveLength(0); // clocks register only at the escalation seam

        // #1295 takeover leg: Ancient Brass DC 21 breathes the SAME target —
        // existingIdx replace (sleepService.js:128-133) keys on effect+target
        // ONLY, so T2's ladder silently changes owner 18→21 and CASTER→CASTER2.
        const w0 = writes.length;
        const restaged = await stageSleepTargets(campaignName, CASTER2, [T2], ANC_DC, options);
        expect(restaged).toEqual([T2]);
        expect(store.campaign.targetEffects).toEqual([
            breathTe(),
            breathTe({ target: T2, source: CASTER2, dc: ANC_DC }),
        ]);
        expect(tuples(w0)).toEqual([
            [T2, 'activeConditions', ['incapacitated'], false], // applyCondition always re-writes (lower()-filter, then append)
            ['campaign', 'targetEffects', [breathTe(), breathTe({ target: T2, source: CASTER2, dc: ANC_DC })], undefined],
        ]);
    });

    it('NPC ladder walk COMPOSES on the live te across seams: CON consumes saveBonuses.con never wis; first fail escalates with ONE disk-canonical 100-round clock; later turn-ends are handled:false write-inert (no re-roll — rolls queue stays empty); damage 0 is read-inert, damage 4 wakes with the hardcoded "Sleep ends" reason (te label never surfaces)', async () => {
        cs.creatures = [{ name: T1, type: 'npc', saveBonuses: { con: 1, wis: 9 } }];
        const otherLadder = breathTe({ target: T2, source: CASTER2 });
        const weakening = { target: T1, effect: 'weakening_breath', source: 'Adult Gold Dragon 1' };
        store.campaign.targetEffects = [breathTe(), otherLadder, weakening];
        store[T1] = { activeConditions: ['incapacitated'] };

        // Turn-end 1 — failed stage-1 repeat save. A WIS-consuming bug would
        // tie 9 + 9 = 18 ≥ DC 18 and falsely END the ladder right here.
        dice(9);
        const r1 = await applySleepTurnEnd(campaignName, T1);
        expect(r1).toEqual({ handled: true, success: false, roll: 9, total: 10 });
        const escalated = breathTe({ stage: 'unconscious', condition: 'unconscious' });
        // navigationHandlers.js:187 calls applySleepTurnEnd campaign-wide WITHOUT
        // options → skipSync === false on every write (5-arg form at :243-245).
        expect(tuples()).toEqual([
            ['campaign', 'targetEffects', [escalated, otherLadder, weakening], false],
            [T1, 'activeConditions', [], false],            // Incapacitated stripped…
            [T1, 'activeConditions', ['unconscious'], false], // …then Unconscious applied (live-store order)
        ]);
        expect(expirations).toEqual([{
            attackerName: CASTER,
            targetName: T1,
            effects: [
                { type: 'condition', condition: 'unconscious' },
                { type: 'remove_target_effect', effectKey: SLEEP_TE_EFFECT, source: CASTER, target: T1 },
            ],
            campaignName,
            rounds: DISK_ROUNDS, // 10 min = 100 rounds, CLA-334 round counter at seams — never a clock
        }]);
        expect(logs).toEqual([
            {
                type: 'save_result', characterName: CASTER, rollType: 'save-sleep-repeat', targetName: T1,
                saveDc: DISK_DC, saveType: 'CON', success: false, roll: 9, total: 10, saveBonus: 1,
                description: `${T1} failed its repeat Constitution save (DC ${DISK_DC}, rolled 9 + 1 = 10) — falls Unconscious.`,
            },
            {
                type: 'condition', action: 'applied', characterName: T1, condition: 'Unconscious',
                reason: 'Sleep Breath (failed repeat save)', sourceName: CASTER,
                note: `${T1} falls Unconscious. The effect ends early if ${T1} takes damage or someone within 5 feet uses an action to shake it awake.`,
            },
        ]);
        expect(prompts).toHaveLength(0); // NPC auto-roll leg — never a player prompt

        // Turn-end 2 — escalated te composed straight from the store: the strict
        // stage gate (:197) sheds it handled:false BEFORE any cs read or roll —
        // the empty dice queue above would THROW if the ladder re-rolled.
        const w = writes.length, l = logs.length;
        const r2 = await applySleepTurnEnd(campaignName, T1);
        expect(r2).toEqual({ handled: false });
        expect(writes).toHaveLength(w);
        expect(logs).toHaveLength(l);
        expect(expirations).toHaveLength(1); // still the single escalation clock

        // Damage 0 never wakes — returns before touching the store (:287).
        const rr = reads.length;
        expect(wakeSleepOnDamage(campaignName, T1, 0)).toBe(false);
        expect(reads).toHaveLength(rr);
        expect(writes).toHaveLength(w);

        // Damage 4 wakes via the applyDamage seam: te filtered out (both
        // bystanders survive), Unconscious stripped, and the reason byte is
        // HARDCODED 'Sleep ends (target took damage)' — 'Sleep Breath' label
        // asymmetry: wakeSleepTarget (:279) never reads te.label.
        expect(wakeSleepOnDamage(campaignName, T1, 4)).toBe(true);
        expect(tuples(w)).toEqual([
            ['campaign', 'targetEffects', [otherLadder, weakening], false],
            [T1, 'activeConditions', [], false], // removeCondition('incapacitated') is inert — ONE condition write
        ]);
        expect(logs.at(-1)).toEqual({
            type: 'condition', action: 'removed', characterName: T1, condition: 'Unconscious',
            reason: 'Sleep ends (target took damage)', sourceName: CASTER,
        });

        // Post-wake the ladder is fully shed: handled:false, nothing left to do.
        const r3 = await applySleepTurnEnd(campaignName, T1);
        expect(r3).toEqual({ handled: false });
        expect(expirations).toHaveLength(1);
    });

    it('repeat-save >= tie boundary (17 + CON 1 = 18 = DC) ends the WHOLE ladder (a > bug would stay staged): te spliced with bystanders intact, exact success bytes, no clock — and every addEntry rejection lands exact-prefix console.error with the identical Error while the strip still commits', async () => {
        cs.creatures = [{ name: T1, type: 'npc', saveBonuses: { con: 1 } }];
        const weakening = { target: T1, effect: 'weakening_breath', source: 'Adult Gold Dragon 1' };
        store.campaign.targetEffects = [breathTe(), weakening];
        store[T1] = { activeConditions: ['incapacitated'] };

        dice(17); // 17 + 1 = 18 — exact DISK_DC tie, success on >=
        const r = await applySleepTurnEnd(campaignName, T1);

        expect(r).toEqual({ handled: true, success: true, roll: 17, total: 18 });
        expect(tuples()).toEqual([
            ['campaign', 'targetEffects', [weakening], false],
            [T1, 'activeConditions', [], false],
        ]);
        expect(expirations).toHaveLength(0); // success never registers a clock
        expect(prompts).toHaveLength(0);
        expect(logs).toEqual([
            {
                type: 'save_result', characterName: CASTER, rollType: 'save-sleep-repeat', targetName: T1,
                saveDc: DISK_DC, saveType: 'CON', success: true, roll: 17, total: 18, saveBonus: 1,
                description: `${T1} succeeded on its repeat Constitution save (DC ${DISK_DC}, rolled 17 + 1 = 18) — Sleep Breath ends.`,
            },
            {
                type: 'condition', action: 'removed', characterName: T1, condition: 'Incapacitated',
                reason: 'Sleep Breath ends (repeat save succeeded)', // NO sourceName — sleep's endSleepOnSaveSuccess (:186-192) omits it (twin #1390 carries it)
            },
        ]);

        // Log-failure leg: every POST rejects with the SAME Error — the two
        // catches on the success path (:233, :192) fire in call order, and the
        // mechanical strip commits anyway.
        const err = new Error('log-boom');
        store.campaign.targetEffects = [breathTe(), weakening];
        store[T1] = { activeConditions: ['incapacitated'] };
        addEntry.mockImplementation(() => Promise.reject(err));
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        dice(17);
        const r2 = await applySleepTurnEnd(campaignName, T1);
        expect(r2).toEqual({ handled: true, success: true, roll: 17, total: 18 });
        expect(consoleSpy.mock.calls).toEqual([
            ['[sleepService] Error logging repeat save result:', err],
            ['[sleepService] Error logging condition removal:', err],
        ]);
        expect(consoleSpy.mock.calls[0][1]).toBe(err); // identical Error instance, not re-wrapped
        expect(store.campaign.targetEffects).toEqual([weakening]);
        expect(store[T1].activeConditions).toEqual([]);
    });

    it('PC leg: prompt carries the full disk-shaped envelope (dc_success "none", sourceName the dragon, condition "Sleep Breath (repeat save)"); a numeric-less success outcome ??0-swallows as "rolled 0 + 0 = 0" yet strips te + Incapacitated byte-identically to the NPC tie', async () => {
        cs.creatures = [{ name: PC, type: 'player' }];
        store.campaign.targetEffects = [breathTe({ target: PC })];
        store[PC] = { activeConditions: ['incapacitated'] };
        createSaveListener.mockImplementation((campaign, opts) => {
            prompts.push({ campaign, opts });
            return { promptId: 'breath-repeat', promise: Promise.resolve({ success: true }) };
        });

        const result = await applySleepTurnEnd(campaignName, PC);

        expect(prompts).toEqual([{
            campaign: campaignName,
            opts: {
                targetName: PC, saveType: 'CON', saveDc: DISK_DC,
                dcSuccess: 'none', sourceName: CASTER, condition: 'Sleep Breath (repeat save)',
            },
        }]);
        expect(result).toEqual({ handled: true, success: true, roll: 0, total: 0 });
        expect(tuples()).toEqual([
            ['campaign', 'targetEffects', [], false],
            [PC, 'activeConditions', [], false],
        ]);
        expect(logs).toEqual([
            {
                type: 'ability_use', characterName: CASTER, abilityName: 'Sleep Breath',
                description: `${PC} repeats its Constitution save (DC ${DISK_DC}) at the end of its turn.`,
                promptId: 'breath-repeat',
            },
            {
                type: 'save_result', characterName: CASTER, rollType: 'save-sleep-repeat', targetName: PC,
                saveDc: DISK_DC, saveType: 'CON', success: true, roll: 0, total: 0, saveBonus: 0, // ??0-swallow (:178)
                description: `${PC} succeeded on its repeat Constitution save (DC ${DISK_DC}, rolled 0 + 0 = 0) — Sleep Breath ends.`,
            },
            {
                type: 'condition', action: 'removed', characterName: PC, condition: 'Incapacitated',
                reason: 'Sleep Breath ends (repeat save succeeded)', // sourceName omitted — see tie-test note
            },
        ]);
        expect(expirations).toHaveLength(0);
    });

    it('strict lowercase stage gate vs case-INsensitive condition filter: a capital-"Incapacitated" GM te is handled:false FULLY inert (OPPOSITE of the paralyzing twin #1390, whose capital stage rides the escalate leg); a sparse lowercase te falls back dc ?? 10 / saveType WIS / unconsciousRounds ?? 10 / logLabel "Sleep spell" — the SPELL shape leaks onto the DRAGON face (drift pin vs disk Constitution/100), combat-summary miss = +0, escalate spread preserves only authored keys', async () => {
        // Gate leg: capital stage never ladders (findIndex would have matched —
        // only the stage compare at :197 sheds it).
        store.campaign.targetEffects = [{ target: T1, effect: SLEEP_TE_EFFECT, source: CASTER, condition: 'Incapacitated', stage: 'Incapacitated' }];
        const gated = await applySleepTurnEnd(campaignName, T1);
        expect(gated).toEqual({ handled: false });
        expect(writes).toHaveLength(0);
        expect(logs).toHaveLength(0);
        expect(expirations).toHaveLength(0);
        expect(prompts).toHaveLength(0);

        // Sparse leg: GM-added te with nothing but the addressing keys.
        const sparse = { target: T1, effect: SLEEP_TE_EFFECT, source: CASTER, stage: 'incapacitated' };
        store.campaign.targetEffects = [sparse];
        store[T1] = { activeConditions: ['Incapacitated'] }; // capital survives the gate's stage compare, stripped case-insensitively below

        dice(1); // 1 + 0 (cs miss ?? 0) < DC 10 fallback → fail
        const result = await applySleepTurnEnd(campaignName, T1);

        expect(result).toEqual({ handled: true, success: false, roll: 1, total: 1 });
        const escalatedSparse = { ...sparse, stage: 'unconscious', condition: 'unconscious' };
        // Escalate spread (:241) preserves ONLY the authored keys — no
        // fabricated dc/saveType/label/unconsciousRounds bytes.
        expect(store.campaign.targetEffects).toEqual([escalatedSparse]);
        expect(tuples()).toEqual([
            ['campaign', 'targetEffects', [escalatedSparse], false],
            [T1, 'activeConditions', [], false],             // lower()-filter strips capital 'Incapacitated'
            [T1, 'activeConditions', ['unconscious'], false],
        ]);
        expect(expirations).toEqual([{
            attackerName: CASTER,
            targetName: T1,
            effects: [
                { type: 'condition', condition: 'unconscious' },
                { type: 'remove_target_effect', effectKey: SLEEP_TE_EFFECT, source: CASTER, target: T1 },
            ],
            campaignName,
            rounds: 10, // sleepStageSpec ?? 10 SPELL default — NOT the disk's 100: honest drift pin
        }]);
        expect(logs).toEqual([
            {
                type: 'save_result', characterName: CASTER, rollType: 'save-sleep-repeat', targetName: T1,
                saveDc: 10, saveType: 'WIS', success: false, roll: 1, total: 1, saveBonus: 0, // ?? fallbacks
                description: `${T1} failed its repeat Wisdom save (DC 10, rolled 1 + 0 = 1) — falls Unconscious.`,
            },
            {
                type: 'condition', action: 'applied', characterName: T1, condition: 'Unconscious',
                reason: 'Sleep spell (failed repeat save)', sourceName: CASTER, // logLabel default leaks the spell face
                note: `${T1} falls Unconscious. The effect ends early if ${T1} takes damage or someone within 5 feet uses an action to shake it awake.`,
            },
        ]);
        expect(prompts).toHaveLength(0); // NPC auto-roll leg even with csCreature undefined
    });
});
