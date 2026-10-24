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
// #1295 CLASS THIRD MEMBER — fix#343 EXECUTED (was QUEUED-OWNER-LIVE #1337S):
// readers NOW match effect+target+SOURCE (fix#112 weakeningBreath precedent,
// registry identity law registerTargetEffect :1508-1509). findSleepEffects
// returns ALL instances of the key on the target and every one adjudicates
// its OWN ladder at its OWN dc/saveType; stageSleepTargets dedups on
// target+effect+source (same-source re-cast resets ITS row; a second brass
// dragon COEXISTS); the turn-END mutation + strip triple-match; wake stays
// TARGET-wide BY RAW design ("ends early if the target takes damage" — any
// wake ends every ladder on the target; callers carry no effect-source and
// source-filtering would strand losing ladders), logging each retired
// instance under its OWN source. Writers always carried te.source
// (stageSleepEffect :108-census + expiration payload) — collision was PURELY
// reader-side. Pinned honestly below: takeover legs flipped to coexistence.
// Same te key 'sleep_staged' fronts BOTH producers by design (#1378): the
// spell (WIS/concentration) and the breath (CON/staged_until_repeat_save) —
// source now owns each ladder; saveType+duration stay the badge's FACE.
//
// Quirk pins preserved per-instance: STRICT lowercase stage gate
// (applySleepTurnEnd :197 — capital-"Incapacitated" GM te handled:false fully
// inert, OPPOSITE of the paralyzing twin #1390 whose capital stage rides the
// escalate leg), condition filtering case-INsensitive (lower()); sparse GM te
// still defaults dc ?? 10 / saveType WIS / unconsciousRounds ?? 10 / logLabel
// "Sleep spell" — the SPELL shape onto a sparse te is REGISTRY-CONSISTENT
// (fix#343-C: the GM adder field set for sleep_staged is ['source','dc']
// under label 'Sleep', targetEffectDefinitions.js:533, and every in-game
// producer stamps the FULL CON shape, so a sparse te IS the spell face by
// declared shape — breath-vs-GM intent beyond bytes stays owner UI lane);
// wakeSleepTarget's reason byte still hardcodes "Sleep ends (...)" — the te
// label never appears in wake logs; PC prompt ??0-swallow logs
// "rolled 0 + 0 = 0". Turn-END returns { handled, results[] } — one row per
// source instance; navigationHandlers ignores it (fire-and-forget .catch).
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
    it('stages a byte-exact disk-driven te per failed target (Constitution→CON live branch, concentrate:false short-circuits concentration + storage + combat-summary read); a same-target re-stage by ANOTHER dragon COEXISTS as its own ladder — Ancient Brass DC 21 no longer takes over the Adult ladder (fix#343 flips the #1295-class takeover pin)', async () => {
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

        // fix#343 takeover leg FLIPPED: Ancient Brass DC 21 breathes the SAME
        // target — source-matched existingIdx (sleepIndex) misses CASTER2, so it
        // APPENDS its own ladder. CASTER1's DC 18 te on T2 survives UNTOUCHED;
        // two coexisting instances (two ladders, two DCs — registry law
        // registerTargetEffect target+effect+source, fix#112 precedent).
        const w0 = writes.length;
        const restaged = await stageSleepTargets(campaignName, CASTER2, [T2], ANC_DC, options);
        expect(restaged).toEqual([T2]);
        expect(store.campaign.targetEffects).toEqual([
            breathTe(),
            breathTe({ target: T2 }),
            breathTe({ target: T2, source: CASTER2, dc: ANC_DC }),
        ]);
        expect(tuples(w0)).toEqual([
            [T2, 'activeConditions', ['incapacitated'], false], // applyCondition always re-writes (lower()-filter, then append)
            ['campaign', 'targetEffects', [
                breathTe(),
                breathTe({ target: T2 }),
                breathTe({ target: T2, source: CASTER2, dc: ANC_DC }),
            ], undefined],
        ]);

        // Same-source re-stage still REPLACES its OWN row (ladder reset at the
        // new dc); the other dragon's row and the T1 row stay untouched.
        const w1 = writes.length;
        await stageSleepTargets(campaignName, CASTER, [T2], ANC_DC, options);
        expect(store.campaign.targetEffects).toEqual([
            breathTe(),
            breathTe({ target: T2, dc: ANC_DC }),
            breathTe({ target: T2, source: CASTER2, dc: ANC_DC }),
        ]);
        expect(tuples(w1).map(t => [t[0], t[2].length])).toEqual([
            [T2, 1], // condition write
            ['campaign', 3], // 3 tes total: T2's CASTER row replaced at idx 1, count unchanged
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
        expect(r1).toEqual({ handled: true, results: [{ source: CASTER, success: false, roll: 9, total: 10 }] });
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

        expect(r).toEqual({ handled: true, results: [{ source: CASTER, success: true, roll: 17, total: 18 }] });
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
        expect(r2).toEqual({ handled: true, results: [{ source: CASTER, success: true, roll: 17, total: 18 }] });
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
        expect(result).toEqual({ handled: true, results: [{ source: CASTER, success: true, roll: 0, total: 0 }] });
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

        expect(result).toEqual({ handled: true, results: [{ source: CASTER, success: false, roll: 1, total: 1 }] });
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

    // fix#343 falsifiability arm (i): TWO dragons' breath ladders on the SAME
    // target — turn-end adjudicates each at its OWN dc; the dc18 ladder
    // SUCCEEDS (strips only its own row) while the dc21 ladder FAILS and
    // escalates its OWN row with its OWN 100-round clock. Pre-fix: one
    // source-blind find meant a single adjudication on the FIRST row and the
    // sibling's ladder silently inherited/hijacked the outcome.
    it('fix#343 two-dragon same-target walk: CASTER(dc18) succeeds on the 18-tie stripping ONLY its row while the guard HOLDS Incapacitated for the sibling; CASTER2(dc21) fails and escalates its OWN row with its OWN clock', async () => {
        cs.creatures = [{ name: T1, type: 'npc', saveBonuses: { con: 0 } }];
        const ladder1 = breathTe(); // CASTER, DC 18 (disk Adult)
        const ladder2 = breathTe({ source: CASTER2, dc: ANC_DC }); // Ancient DC 21, SAME target
        store.campaign.targetEffects = [ladder1, ladder2];
        store[T1] = { activeConditions: ['incapacitated'] };

        const w0 = writes.length;
        dice(18, 10); // ladder1: 18+0=18 ≥18 SUCCESS; ladder2: 10+0=10 <21 FAIL
        const r = await applySleepTurnEnd(campaignName, T1);
        expect(r).toEqual({
            handled: true,
            results: [
                { source: CASTER, success: true, roll: 18, total: 18 },
                { source: CASTER2, success: false, roll: 10, total: 10 },
            ],
        });
        const esc2 = breathTe({ source: CASTER2, dc: ANC_DC, stage: 'unconscious', condition: 'unconscious' });
        expect(store.campaign.targetEffects).toEqual([esc2]); // NO collateral — only ladder1 stripped
        expect(store[T1].activeConditions).toEqual(['unconscious']); // guard held Incapacitated through ladder1's end, then ladder2's escalate stripped it
        expect(expirations).toHaveLength(1); // ONLY the escalated ladder clocks
        expect(expirations[0]).toMatchObject({ attackerName: CASTER2, targetName: T1, rounds: DISK_ROUNDS });
        expect(tuples(w0)).toEqual([
            ['campaign', 'targetEffects', [ladder2], false], // ladder1 strip; guard holds the shared condition → NO condition write here
            ['campaign', 'targetEffects', [esc2], false],     // ladder2 escalates its own row
            ['Thug 1', 'activeConditions', [], false],         // guard released: strip Incapacitated
            ['Thug 1', 'activeConditions', ['unconscious'], false],
        ]);
        expect(logs.map(l => [l.type, l.characterName ?? null, l.saveDc ?? null, l.sourceName ?? 'OMIT'])).toEqual([
            ['save_result', CASTER, 18, 'OMIT'],
            ['condition', T1, null, 'OMIT'], // endSleepOnSaveSuccess quirk: no sourceName (mirrors :395 pin)
            ['save_result', CASTER2, 21, 'OMIT'],
            ['condition', T1, null, CASTER2], // escalate log carries ITS OWN source
        ]);
    });

    // fix#343 falsifiability arm (ii): SAME-source escalation end-to-end on
    // the live store (stage → fail → Unconscious → damage wake): the composed
    // walk lives above at the ladder-walk pin; this adds the PC DOUBLE-PROMPT
    // corollary — a player under two sleep ladders gets TWO sequential queued
    // prompts, each at its own dc/source, each waiting indefinitely
    // (turn-based, no-clock law; fix#112 family precedent).
    it('fix#343 PC under two ladders: two sequential prompts (dc18 then dc21, dragon-attributed); first fails → escalates its row with its own clock; second succeeds → strips only its row; shared Incapacitated stays held by the escalated sibling until released', async () => {
        cs.creatures = [{ name: PC, type: 'player' }];
        const ladder1 = breathTe({ target: PC }); // CASTER dc18
        const ladder2 = breathTe({ target: PC, source: CASTER2, dc: ANC_DC });
        store.campaign.targetEffects = [ladder1, ladder2];
        store[PC] = { activeConditions: ['incapacitated'] };
        const outcomes = [{ success: false }, { success: true }]; // ladder1 FAILS, ladder2 SUCCEEDS
        let call = 0;
        createSaveListener.mockImplementation((campaign, opts) => {
            prompts.push({ campaign, opts });
            const o = outcomes[call];
            call += 1;
            return { promptId: `ladder-${call}`, promise: Promise.resolve(o) };
        });

        const r = await applySleepTurnEnd(campaignName, PC);
        expect(prompts.map(p => [p.opts.saveDc, p.opts.sourceName, p.opts.condition])).toEqual([
            [DISK_DC, CASTER, 'Sleep Breath (repeat save)'],
            [ANC_DC, CASTER2, 'Sleep Breath (repeat save)'],
        ]);
        expect(r).toEqual({
            handled: true,
            results: [
                { source: CASTER, success: false, roll: 0, total: 0 },
                { source: CASTER2, success: true, roll: 0, total: 0 },
            ],
        });
        const esc1 = breathTe({ target: PC, stage: 'unconscious', condition: 'unconscious' });
        expect(store.campaign.targetEffects).toEqual([esc1]); // ladder2 stripped; escalated ladder1 survives
        expect(store[PC].activeConditions).toEqual(['unconscious']); // ladder1 holds it; ladder2's success must not wake the sibling's sleeper
        expect(expirations).toHaveLength(1);
        expect(expirations[0].attackerName).toBe(CASTER);
        expect(expirations[0].rounds).toBe(DISK_ROUNDS);
    });

    // fix#343 wake adjudication (cited :269 row): the effect+target-wide strip
    // STAYS — RAW "the effect ends early if the target takes damage" ends
    // EVERY sleep instance on the target simultaneously, and callers carry no
    // effect-source (applyDamage passes the sleeper only). Per-instance
    // consequence pinned: each retired te logs its OWN source + stage word.
    it('fix#343 wake stays TARGET-wide by RAW (any damage ends every sleep instance): multi-source strip in ONE te write, per-instance logs carry each te OWN source and stage word', async () => {
        const ladder1 = breathTe(); // CASTER, stage1
        const ladder2 = breathTe({ source: CASTER2, dc: ANC_DC, stage: 'unconscious', condition: 'unconscious' });
        const bystander = { target: T1, effect: 'weakening_breath', source: 'Adult Gold Dragon 1' };
        store.campaign.targetEffects = [ladder1, ladder2, bystander];
        store[T1] = { activeConditions: ['incapacitated', 'unconscious'] };

        expect(wakeSleepOnDamage(campaignName, T1, 5)).toBe(true);
        expect(store.campaign.targetEffects).toEqual([bystander]); // BOTH sleep ladders retired, bystander intact
        expect(store[T1].activeConditions).toEqual([]); // both conditions shed
        const wakeLogs = logs.filter(l => l.action === 'removed');
        expect(wakeLogs.map(l => [l.condition, l.sourceName])).toEqual([
            ['Incapacitated', CASTER],   // ladder1's stage word + ITS source
            ['Unconscious', CASTER2],    // ladder2's stage word + ITS source
        ]);
    });

    // fix#343 falsifiability arm (iii): breath-face sourceless te — refused
    // loudly at the turn-END, never absorbed by the staging dedup.
    it('fix#343 sourceless breath te: turn-END REFUSES loudly (zero rolls/writes); staging beside the orphan APPENDS its own ladder', async () => {
        const orphan = { target: T1, effect: SLEEP_TE_EFFECT, condition: 'incapacitated', stage: 'incapacitated', dc: ANC_DC, saveType: 'CON' }; // NO source
        store.campaign.targetEffects = [orphan];
        cs.creatures = [{ name: T1, type: 'npc', saveBonuses: { con: 0 } }];

        const refused = await applySleepTurnEnd(campaignName, T1);
        expect(refused).toEqual({ handled: false });
        expect(store.campaign.targetEffects).toEqual([orphan]); // never edited
        expect(writes).toHaveLength(0);
        expect(expirations).toHaveLength(0);
        expect(rolls).toEqual([]); // refused ladder never rolls

        // Staging beside the orphan: strict === refuses the merge — APPEND.
        const options = { saveType: 'Constitution', concentrate: false, label: 'Sleep Breath', logLabel: 'Sleep Breath', unconsciousRounds: DISK_ROUNDS };
        await stageSleepTargets(campaignName, CASTER, [T1], ANC_DC, options);
        expect(store.campaign.targetEffects).toEqual([orphan, breathTe({ dc: ANC_DC })]);
    });
});
