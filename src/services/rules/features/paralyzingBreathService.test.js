// @maintained-by-ai
// MA-0248: Ancient Silver Dragon Paralyzing Breath (paralyzingBreathService —
// PRODUCER lane, MA-0068 staged-sleep shape / MA-0102 weakening sibling): the
// first failed CON save stages Incapacitated + the paralyzing_staged te (NO
// caster concentration, NO damage-wake consumer); the turn-END seam
// (navigationHandlers applyOutgoingTurnEndPasses) repeats the CON save — a
// first fail escalates Incapacitated → Paralyzed with a 10-round auto-success
// clock (CLA-334 minutes×10 via addExpiration, a ROUND counter that matures
// only at turn seams), every later repeat save ends the whole effect on a
// success (>= tie boundary pinned). Disk canon is read PROGRAMMATICALLY from
// public/data/monsters.json (no transcribed tables): Ancient Silver Dragon
// Paralyzing Breath save_dc 24 / save_type "Constitution" /
// staged_paralysis.paralyzed_minutes 1 (Adult Silver Dragon DC 20 is the
// near-miss twin: NO staged_paralysis — never stages here).
//
// #1295 CLASS (multi-dragon te collision): writers carry te.source
// (stageEffect + the escalation remove_target_effect payload), but every
// reader filters by effect+target ONLY — never te.source — so a second
// Ancient Silver Dragon re-staging the SAME target overwrites the first
// ladder's envelope (source/dc takeover, one te per target by design). The
// takeover is pinned honestly below; collateral on OTHER targets survives.
//
// Quirk pins: sparse GM-added te falls back to dc 24 / 'Paralyzing Breath'
// label / 10 rounds; the stage gate is strict lowercase 'paralyzed' (a
// capital-'Paralyzed' stage rides the stage-1 escalate leg) while condition
// filtering is case-INsensitive (lower(), applyCondition:51); a combat-summary
// miss means +0 saveBonus; the PC prompt envelope ??0-swallow logs
// "rolled 0 + 0 = 0". No wall-clock in this lane (no Date.now/setTimeout/
// setInterval anywhere in paralyzingBreathService.js).
//
// OWNERSHIP: this file owns the service staging + turn-END ladder legs. The
// picker→service wiring (stageParalysisTargets call args) is owned by
// SaveAttackAoeModal.staged-paralysis.test.jsx (it MOCKS this service), the
// registry bytes by targetEffectDefinitions.test.js, the disk row transport by
// MonsterCardModal.paralyzing-breath.test.jsx — not duplicated here.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../ui/logService.js', () => ({
    addEntry: vi.fn(),
}));

vi.mock('../../encounters/combatData.js', () => ({
    getCombatSummary: vi.fn(),
}));

vi.mock('../../automation/common/savePrompt.js', () => ({
    createSaveListener: vi.fn(),
}));

vi.mock('../effects/expirationQueue.js', () => ({
    addExpiration: vi.fn(),
}));

import {
    stageParalysisTargets,
    applyParalyzingBreathTurnEnd,
    PARALYZING_STAGED_TE,
} from './paralyzingBreathService.js';
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../ui/logService.js';
import { getCombatSummary } from '../../encounters/combatData.js';
import { createSaveListener } from '../../automation/common/savePrompt.js';
import { addExpiration } from '../effects/expirationQueue.js';

const campaignName = 'test-campaign';
const CASTER = 'Ancient Silver Dragon 1';
const CASTER2 = 'Ancient Silver Dragon 2';
const T1 = 'Thug 1';
const T2 = 'Thug 2';

// Disk canon, programmatic (drift-proof): same row + same minutes×10 seam
// conversion MonsterCardModal.jsx:307 applies at picker-arm time.
const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const dragonRow = (Array.isArray(monsters) ? monsters : (monsters.monsters || Object.values(monsters)))
    .find(m => m.name === 'Ancient Silver Dragon');
const breathRow = [...(dragonRow.multi_actions || []), ...(dragonRow.actions || [])]
    .find(a => a.name === 'Paralyzing Breath');
const DISK_DC = breathRow.save_dc; // 24
const DISK_ROUNDS = (Number(breathRow.staged_paralysis.paralyzed_minutes) || 1) * 10; // 10

// Byte mirror of stageEffect()'s producer envelope — the real caller
// (SaveAttackAoeModal.applyStagedParalysisSave) passes exactly these
// disk-driven values: save_type 'Constitution' → te saveType 'CON'.
function stagedTe(overrides = {}) {
    return {
        target: T1,
        effect: PARALYZING_STAGED_TE,
        source: CASTER,
        condition: 'incapacitated',
        stage: 'incapacitated',
        dc: DISK_DC,
        saveType: 'CON',
        duration: 'staged_until_repeat_save',
        label: 'Paralyzing Breath',
        logLabel: 'Paralyzing Breath',
        paralyzedRounds: DISK_ROUNDS,
        ...overrides,
    };
}

// ── Strict argument-keyed STATEFUL runtime store fake ─────────────────────
// Throws on any unexpected campaign, owner/key pairing, or unseeded prompt —
// no silent undefined branches. Reads return structural clones (real store
// fidelity); writes land in the store so reads-after-writes are honest,
// recurrence-provable state, and every write is budget-recorded with its
// skipSync POSITION.
let store, cs, writes, logs, prompts, expirations;

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
    logs = [];
    prompts = [];
    expirations = [];

    getRuntimeValue.mockImplementation((owner, key, campaign) => {
        assertScope(owner, key, campaign, 'read');
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
});

afterEach(() => {
    vi.restoreAllMocks(); // always release Math.random + console spies
});

const dice = (x) => vi.spyOn(Math, 'random').mockReturnValue(x); // roll = floor(x*20)+1
const tuples = (from = 0) => writes.slice(from).map(w => [w.owner, w.key, w.value, w.skipSync]);

describe('MA-0248 paralyzingBreathService (producer staging + turn-END ladder)', () => {
    it('stages a byte-exact te per failed target (source carried, skipSync budget audited); a same-target re-stage REPLACES — one te per target, last dragon takes over (#1295 class)', async () => {
        store[T1] = { activeConditions: ['poisoned'] }; // pre-existing condition survives the append

        const staged = await stageParalysisTargets(campaignName, CASTER, [T1, T2], DISK_DC, {
            saveType: breathRow.save_type, // disk 'Constitution' → abbreviation lookup is the LIVE branch
            label: breathRow.name,
            logLabel: breathRow.name,
            paralyzedRounds: DISK_ROUNDS,
        });

        expect(staged).toEqual([T1, T2]);
        expect(store[T1].activeConditions).toEqual(['poisoned', 'incapacitated']);
        expect(store[T2].activeConditions).toEqual(['incapacitated']);
        expect(store.campaign.targetEffects).toEqual([stagedTe(), stagedTe({ target: T2 })]);
        // Exact producer key-set (no fabricated concentration/damage keys).
        expect(Object.keys(store.campaign.targetEffects[0])).toEqual([
            'target', 'effect', 'source', 'condition', 'stage', 'dc', 'saveType', 'duration', 'label', 'logLabel', 'paralyzedRounds',
        ]);
        // Write budget: per-target condition writes explicit skipSync:false,
        // the single te write omits skipSync (undefined) — position-audited.
        expect(tuples()).toEqual([
            [T1, 'activeConditions', ['poisoned', 'incapacitated'], false],
            [T2, 'activeConditions', ['incapacitated'], false],
            ['campaign', 'targetEffects', [stagedTe(), stagedTe({ target: T2 })], undefined],
        ]);

        // Second dragon breathes the SAME target: existingIdx replace branch
        // (never covered before) — te count stays 2, T1's ladder untouched,
        // T2's te now carries CASTER2 (source takeover, effect+target-only key).
        const w0 = writes.length;
        const restaged = await stageParalysisTargets(campaignName, CASTER2, [T2], DISK_DC, {
            saveType: breathRow.save_type, label: breathRow.name, logLabel: breathRow.name, paralyzedRounds: DISK_ROUNDS,
        });
        expect(restaged).toEqual([T2]);
        expect(store.campaign.targetEffects).toEqual([stagedTe(), stagedTe({ target: T2, source: CASTER2 })]);
        expect(tuples(w0)).toEqual([
            [T2, 'activeConditions', ['incapacitated'], false], // applyCondition always re-writes (dedupe via lower()-filter, then append)
            ['campaign', 'targetEffects', [stagedTe(), stagedTe({ target: T2, source: CASTER2 })], undefined],
        ]);
        expect(logs).toHaveLength(0);       // staging itself is silent (the modal lane owns roll/grant logs)
        expect(expirations).toHaveLength(0); // clocks register only at the escalation seam
    });

    it('NPC ladder walk on one live te: CON repeat consumes saveBonuses.con not wis; fail escalates with ONE disk-canonical clock; stays are write-inert; >= tie success strips everything', async () => {
        cs.creatures = [{ name: T1, type: 'npc', saveBonuses: { con: 4, wis: 9 } }];
        const unrelated = { target: T2, effect: 'frightened', source: 'Hobgoblin 1' };
        store.campaign.targetEffects = [stagedTe(), unrelated];
        store[T1] = { activeConditions: ['incapacitated'] };

        // Turn-end 1 — failed stage-1 repeat save. rolled 15 + CON 4 = 19 < 24
        // (a WIS-consuming bug would tie 15 + 9 = 24 and falsely END here).
        dice(0.7);
        const r1 = await applyParalyzingBreathTurnEnd(campaignName, T1);
        expect(r1).toEqual({ handled: true, success: false, roll: 15, total: 19 });
        const escalated = stagedTe({ stage: 'paralyzed', condition: 'paralyzed' });
        expect(tuples()).toEqual([
            ['campaign', 'targetEffects', [escalated, unrelated], false],
            [T1, 'activeConditions', [], false],           // Incapacitated stripped…
            [T1, 'activeConditions', ['paralyzed'], false], // …then Paralyzed applied (live-store order)
        ]);
        expect(expirations).toEqual([{
            attackerName: CASTER,
            targetName: T1,
            effects: [
                { type: 'condition', condition: 'paralyzed' },
                { type: 'remove_target_effect', effectKey: PARALYZING_STAGED_TE, source: CASTER, target: T1 },
            ],
            campaignName,
            rounds: DISK_ROUNDS,
        }]);
        expect(logs).toEqual([
            {
                type: 'save_result', characterName: CASTER, rollType: 'save-paralyzing-repeat', targetName: T1,
                saveDc: DISK_DC, saveType: 'CON', success: false, roll: 15, total: 19, saveBonus: 4,
                description: `${T1} failed its repeat Constitution save (DC ${DISK_DC}, rolled 15 + 4 = 19) — becomes Paralyzed.`,
            },
            {
                type: 'condition', action: 'applied', characterName: T1, condition: 'Paralyzed',
                reason: 'Paralyzing Breath (failed repeat save)', sourceName: CASTER,
                note: `${T1} is Paralyzed. It repeats the save at the end of each of its turns, ending the effect on itself on a success; after 1 minute it succeeds automatically.`,
            },
        ]);

        // Turn-end 2 — fail while Paralyzed: keeps it, ZERO writes, ZERO second clock.
        const w = writes.length, l = logs.length;
        dice(0);
        const r2 = await applyParalyzingBreathTurnEnd(campaignName, T1);
        expect(r2).toEqual({ handled: true, success: false, roll: 1, total: 5 });
        expect(writes).toHaveLength(w);
        expect(expirations).toHaveLength(1);
        expect(logs.slice(l)).toEqual([{
            type: 'save_result', characterName: CASTER, rollType: 'save-paralyzing-repeat', targetName: T1,
            saveDc: DISK_DC, saveType: 'CON', success: false, roll: 1, total: 5, saveBonus: 4,
            description: `${T1} failed its repeat Constitution save (DC ${DISK_DC}, rolled 1 + 4 = 5) — remains Paralyzed (auto-succeeds after 1 minute).`,
        }]);
        expect(store.campaign.targetEffects).toEqual([escalated, unrelated]);

        // Turn-end 3 — rolled 20 + 4 = 24: exact >= tie boundary ends the WHOLE
        // ladder (a > bug would stay Paralyzed): te spliced, unrelated survives.
        const w2 = writes.length;
        dice(0.999);
        const r3 = await applyParalyzingBreathTurnEnd(campaignName, T1);
        expect(r3).toEqual({ handled: true, success: true, roll: 20, total: 24 });
        expect(tuples(w2)).toEqual([
            ['campaign', 'targetEffects', [unrelated], false],
            [T1, 'activeConditions', [], false],
        ]);
        expect(logs.at(-1)).toEqual({
            type: 'condition', action: 'removed', characterName: T1, condition: 'Paralyzed',
            reason: 'Paralyzing Breath ends (repeat save succeeded)', sourceName: CASTER,
        });
        expect(expirations).toHaveLength(1); // still the single escalation clock
    });

    it('PC leg: CON repeat prompt carries the full disk-shaped envelope (dc_success "none"); a numeric-less success outcome ??0-swallow logs "rolled 0 + 0 = 0" and still strips te + Incapacitated', async () => {
        cs.creatures = [{ name: 'HexWarlock', type: 'player' }];
        store.campaign.targetEffects = [stagedTe({ target: 'HexWarlock' })];
        store['HexWarlock'] = { activeConditions: ['incapacitated'] };
        createSaveListener.mockImplementation((campaign, opts) => {
            prompts.push({ campaign, opts });
            return { promptId: 'paralysis-repeat', promise: Promise.resolve({ success: true }) };
        });

        const result = await applyParalyzingBreathTurnEnd(campaignName, 'HexWarlock');

        expect(prompts).toEqual([{
            campaign: campaignName,
            opts: {
                targetName: 'HexWarlock', saveType: 'CON', saveDc: DISK_DC,
                dcSuccess: 'none', sourceName: CASTER, condition: 'Paralyzing Breath (repeat save)',
            },
        }]);
        expect(result).toEqual({ handled: true, success: true, roll: 0, total: 0 });
        expect(tuples()).toEqual([
            ['campaign', 'targetEffects', [], false],
            ['HexWarlock', 'activeConditions', [], false],
        ]);
        expect(logs).toEqual([
            {
                type: 'ability_use', characterName: CASTER, abilityName: 'Paralyzing Breath',
                description: `HexWarlock repeats its Constitution save (DC ${DISK_DC}) at the end of its turn.`,
                promptId: 'paralysis-repeat',
            },
            {
                type: 'save_result', characterName: CASTER, rollType: 'save-paralyzing-repeat', targetName: 'HexWarlock',
                saveDc: DISK_DC, saveType: 'CON', success: true, roll: 0, total: 0, saveBonus: 0,
                description: `HexWarlock succeeded on its repeat Constitution save (DC ${DISK_DC}, rolled 0 + 0 = 0) — Paralyzing Breath ends.`,
            },
            {
                type: 'condition', action: 'removed', characterName: 'HexWarlock', condition: 'Incapacitated',
                reason: 'Paralyzing Breath ends (repeat save succeeded)', sourceName: CASTER,
            },
        ]);
        expect(expirations).toHaveLength(0);
    });

    it('sparse GM-added te: dc ?? 24 / default label / rounds ?? 10 fallbacks; STRICT lowercase stage gate rides a capital-"Paralyzed" te through the stage-1 escalate leg while condition writes stay case-INsensitive; combat-summary miss = +0; another dragon\'s te is collateral-safe', async () => {
        cs.creatures = [{ name: T2, type: 'npc', saveBonuses: { con: -1 } }]; // T1 absent → ?? 0
        const sparse = { target: T1, effect: PARALYZING_STAGED_TE, source: CASTER, condition: 'Paralyzed', stage: 'Paralyzed', saveType: 'CON' };
        const otherLadder = stagedTe({ target: T2, source: CASTER2, dc: 20 }); // Adult Silver DC 20 near-miss rides CASTER2
        store.campaign.targetEffects = [sparse, otherLadder];
        store[T1] = { activeConditions: ['Paralyzed'] };

        dice(0.5); // roll 11 + 0 = 11 < 24 → fail
        const result = await applyParalyzingBreathTurnEnd(campaignName, T1);

        expect(result).toEqual({ handled: true, success: false, roll: 11, total: 11 });
        // Escalate spread preserves ONLY the authored keys — no fabricated dc/label/duration bytes.
        expect(store.campaign.targetEffects).toEqual([
            { ...sparse, stage: 'paralyzed', condition: 'paralyzed' },
            otherLadder,
        ]);
        expect(tuples()).toEqual([
            ['campaign', 'targetEffects', [{ ...sparse, stage: 'paralyzed', condition: 'paralyzed' }, otherLadder], false],
            // One condition write only: removeCondition('incapacitated') is inert
            // (length unchanged on ['Paralyzed']), applyCondition('paralyzed') strips
            // the capital-P variant case-insensitively and re-appends lowercase.
            [T1, 'activeConditions', ['paralyzed'], false],
        ]);
        expect(expirations).toEqual([{
            attackerName: CASTER,
            targetName: T1,
            effects: [
                { type: 'condition', condition: 'paralyzed' },
                { type: 'remove_target_effect', effectKey: PARALYZING_STAGED_TE, source: CASTER, target: T1 },
            ],
            campaignName,
            rounds: DISK_ROUNDS, // te.paralyzedRounds absent → DEFAULT_PARALYZED_ROUNDS
        }]);
        expect(logs).toEqual([
            {
                type: 'save_result', characterName: CASTER, rollType: 'save-paralyzing-repeat', targetName: T1,
                saveDc: DISK_DC, saveType: 'CON', success: false, roll: 11, total: 11, saveBonus: 0, // ?? fallbacks
                description: `${T1} failed its repeat Constitution save (DC ${DISK_DC}, rolled 11 + 0 = 11) — becomes Paralyzed.`,
            },
            {
                type: 'condition', action: 'applied', characterName: T1, condition: 'Paralyzed',
                reason: 'Paralyzing Breath (failed repeat save)', sourceName: CASTER,
                note: `${T1} is Paralyzed. It repeats the save at the end of each of its turns, ending the effect on itself on a success; after 1 minute it succeeds automatically.`,
            },
        ]);
        expect(prompts).toHaveLength(0); // NPC auto-roll leg — never a player prompt
    });

    it('no paralyzing_staged te for THIS target — handled:false exact, fully inert beside every real sibling te key in the store', async () => {
        store.campaign.targetEffects = [
            { target: T1, effect: 'sleep_staged', source: CASTER },
            { target: T1, effect: 'weakening_breath', source: 'Adult Gold Dragon 1' },
            { target: T1, effect: 'petrifying_bite_staged', source: 'Cockatrice 1' },
            { target: T1, effect: 'eye_ray_paralyzed', source: 'Beholder 1' },
            { target: T2, effect: PARALYZING_STAGED_TE, source: CASTER2 }, // right key, WRONG target
        ];

        const result = await applyParalyzingBreathTurnEnd(campaignName, T1);

        expect(result).toEqual({ handled: false });
        expect(writes).toHaveLength(0);
        expect(logs).toHaveLength(0);
        expect(expirations).toHaveLength(0);
        expect(prompts).toHaveLength(0);
        expect(store.campaign.targetEffects).toHaveLength(5);
    });

    it('addEntry rejection never breaks the ladder: exact-prefix console.error ×2 (identical Error) and the escalation still commits', async () => {
        cs.creatures = [{ name: T1, type: 'npc', saveBonuses: { con: 4 } }];
        store.campaign.targetEffects = [stagedTe()];
        store[T1] = { activeConditions: ['incapacitated'] };
        const err = new Error('log-boom');
        addEntry.mockImplementation(() => Promise.reject(err));
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        dice(0);

        const result = await applyParalyzingBreathTurnEnd(campaignName, T1);

        expect(result).toEqual({ handled: true, success: false, roll: 1, total: 5 });
        // Catch-order is deterministic (handlers attached in call order, flushed before the await resumes).
        expect(consoleSpy.mock.calls).toEqual([
            ['[paralyzingBreathService] Error logging repeat save result:', err],
            ['[paralyzingBreathService] Error logging paralyzed condition:', err],
        ]);
        expect(consoleSpy.mock.calls[0][1]).toBe(err); // identical Error instance, not re-wrapped
        expect(store.campaign.targetEffects[0]).toEqual(stagedTe({ stage: 'paralyzed', condition: 'paralyzed' }));
        expect(store[T1].activeConditions).toEqual(['paralyzed']);
        expect(expirations).toHaveLength(1); // mechanics complete even when every log POST fails
    });
});
