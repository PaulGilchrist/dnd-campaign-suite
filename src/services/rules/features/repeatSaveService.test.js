// @maintained-by-ai
// MA-0610: repeatSaveService — the GENERIC turn-END repeat-save roller, and its
// MA-0048 failed-save arm grant. Consumes te descriptor `te.repeatSave =
// { saveType, dc, condition }`. Live disk rows that front here:
//   - Djinni Create Whirlwind zone lane (zone.repeat_save → te on victims):
//     Restrained-gated STR DC 17, re-rolled at the end of the holder's turn.
//   - Thri-Kreen Bite (MA-1584, first row-level repeat_save .effect rider,
//     saveProcessing armRepeatSaveClause fork): CON DC 11 while poisoned.
// Legacy FP rows (repeat_save={condition:'frightened',save_type,duration_minutes}
// WITHOUT `effect`, e.g. Tarrasque) never route here — byte-inert, stay on the
// trackFrightfulPresence leg. No clock lives in this service: the repeat save
// itself is the terminator; Date.now() appears only inside log-entry stamps.
// The save-prompt send/cancel mechanics are owned by savePrompt/SavePromptModal
// lanes — this file pins only the dispatch tuple the PC branch emits.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const CAMPAIGN = 'test-campaign';
const DJINNI = 'Djinni 1';
const KREEN = 'Thri-Kreen';
const BANDIT = 'Bandit 1';
const PC = 'AasimarTest';
const STAMP_MS = 1761000000000;

const store = {};
const reads = [];   // 'owner.key' census of getRuntimeValue
const writes = []; // full argument tuples of setRuntimeValue (arity audited)
const logs = [];   // addEntry campaign + entry pairs
const prompts = []; // createSaveListener configs
const consoleErrors = [];
const diceQueue = [];
const pcQueue = [];

const seed = (owner, key, value) => { store[`${owner}.${key}`] = value; };

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn((owner, key, campaignName) => {
        reads.push(`${owner}.${key}`);
        if (campaignName !== CAMPAIGN) throw new Error(`repeatSave test: unexpected campaign read '${campaignName}'`);
        const k = `${owner}.${key}`;
        if (!(k in store)) throw new Error(`repeatSave test: unseeded read '${k}'`);
        return store[k];
    }),
    setRuntimeValue: vi.fn((...args) => {
        const [owner, key, value, campaignName] = args;
        if (campaignName !== CAMPAIGN) throw new Error(`repeatSave test: unexpected campaign write '${campaignName}'`);
        writes.push({ args });
        store[`${owner}.${key}`] = value;
    }),
}));

vi.mock('../../ui/logService.js', () => ({
    addEntry: vi.fn((campaignName, entry) => {
        if (campaignName !== CAMPAIGN) throw new Error(`repeatSave test: unexpected campaign log '${campaignName}'`);
        logs.push({ campaignName, entry });
        return Promise.resolve();
    }),
}));

vi.mock('../../encounters/combatData.js', () => ({
    getCombatSummary: vi.fn((campaignName) => {
        if (campaignName !== CAMPAIGN) throw new Error(`repeatSave test: unexpected campaign cs '${campaignName}'`);
        if (!('__cs__' in store)) throw new Error('repeatSave test: getCombatSummary called with no cs seeded');
        return store.__cs__;
    }),
}));

// PC prompt lane: the fake resolves from an explicit per-row queue; an
// unseeded prompt resolution THROWS (never a silent default success/fail).
vi.mock('../../automation/common/savePrompt.js', () => ({
    createSaveListener: vi.fn((campaignName, cfg) => {
        if (campaignName !== CAMPAIGN) throw new Error(`repeatSave test: unexpected campaign prompt '${campaignName}'`);
        prompts.push(cfg);
        const next = pcQueue.shift();
        if (!next) throw new Error('repeatSave test: unstubbed PC save prompt resolution');
        return { promise: Promise.resolve(next) };
    }),
}));

import { applyRepeatSaveTurnEnd, grantRepeatSaveEffect } from './repeatSaveService.js';

// Fixed natural-20 dice queue: unstubbed NPC rolls THROW (no RNG in tests).
let dice;
let nowSpy;
let consoleSpy;
function npcRolls(...naturals) { diceQueue.push(...naturals); }

function whirlwindTe(over = {}) {
    return {
        target: BANDIT,
        effect: 'whirlwind',
        source: DJINNI,
        dc: 17,
        duration: 'until_end_of_zone',
        repeatSave: { saveType: 'Strength', dc: 17, condition: 'restrained' },
        ...over,
    };
}

beforeEach(() => {
    for (const k of Object.keys(store)) delete store[k];
    reads.length = 0;
    writes.length = 0;
    logs.length = 0;
    prompts.length = 0;
    consoleErrors.length = 0;
    diceQueue.length = 0;
    pcQueue.length = 0;
    dice = vi.spyOn(Math, 'random').mockImplementation(() => {
        const n = diceQueue.shift();
        if (n == null) throw new Error('repeatSave test: unstubbed d20 roll');
        return (n - 1) / 20; // floor((n-1)/20*20)+1 === n exactly
    });
    nowSpy = vi.spyOn(Date, 'now').mockReturnValue(STAMP_MS);
    consoleSpy = vi.spyOn(console, 'error').mockImplementation((...a) => { consoleErrors.push(a); });
});

afterEach(() => {
    dice.mockRestore();
    nowSpy.mockRestore();
    consoleSpy.mockRestore();
});

describe('applyRepeatSaveTurnEnd — turn-END seam (whirlwind STR DC 17, disk Djinni zone lane)', () => {
    it('NPC success at exactly DC: strips te + Restrained, logs both (full envelopes, read/write censuses)', async () => {
        seed('campaign', 'targetEffects', [whirlwindTe()]);
        seed(BANDIT, 'activeConditions', ['restrained']);
        store[`${BANDIT}.activeConditions`] = ['restrained'];
        store.__cs__ = { creatures: [{ name: BANDIT, type: 'npc', saveBonuses: { strength: 3 } }] };
        npcRolls(14); // 14 + 3 = 17 → succeeds at exactly DC (>= boundary, success side)

        const out = await applyRepeatSaveTurnEnd(CAMPAIGN, BANDIT);

        expect(out).toEqual({ handled: true, results: [{ effect: 'whirlwind', success: true, roll: 14, total: 17 }] });
        expect(store['campaign.targetEffects']).toEqual([]);
        expect(store[`${BANDIT}.activeConditions`]).toEqual([]);
        // read census: tes → gate → stripTe re-read → stripCondition re-read
        expect(reads).toEqual([
            'campaign.targetEffects',
            `${BANDIT}.activeConditions`,
            'campaign.targetEffects',
            `${BANDIT}.activeConditions`,
        ]);
        // write budget: te strip carries the inert 5th arg true (setRuntimeValue is
        // a 4-arity export — quirk pinned at the call site); condition strip arity 4.
        expect(writes.map(w => w.args)).toEqual([
            ['campaign', 'targetEffects', [], CAMPAIGN, true],
            [BANDIT, 'activeConditions', [], CAMPAIGN],
        ]);
        expect(logs.map(l => l.entry)).toEqual([
            {
                type: 'save_result',
                characterName: DJINNI,
                rollType: 'save-repeat',
                targetName: BANDIT,
                saveDc: 17,
                saveType: 'Strength',
                success: true,
                roll: 14,
                total: 17,
                saveBonus: 3,
                description: 'Bandit 1 succeeded its repeat Strength save (DC 17, rolled 14 + 3 = 17) — whirlwind ends on itself.',
                timestamp: STAMP_MS,
            },
            {
                type: 'condition',
                action: 'removed',
                characterName: BANDIT,
                condition: 'Restrained',
                reason: 'whirlwind ends (repeat save succeeded)',
                sourceName: DJINNI,
                timestamp: STAMP_MS,
            },
        ]);
        expect(consoleErrors.length).toBe(0);
    });

    it('NPC fail just below DC: keeps te + Restrained, logs remain-under bytes, no strips', async () => {
        const te = whirlwindTe();
        seed('campaign', 'targetEffects', [te]);
        store[`${BANDIT}.activeConditions`] = ['restrained'];
        store.__cs__ = { creatures: [{ name: BANDIT, type: 'npc', saveBonuses: { strength: 3 } }] };
        npcRolls(13); // 13 + 3 = 16 < 17 (>= boundary, fail side — save still owed next turn)

        const out = await applyRepeatSaveTurnEnd(CAMPAIGN, BANDIT);

        expect(out).toEqual({ handled: true, results: [{ effect: 'whirlwind', success: false, roll: 13, total: 16 }] });
        expect(store['campaign.targetEffects'][0]).toBe(te); // survivor te identity untouched
        expect(store[`${BANDIT}.activeConditions`]).toEqual(['restrained']);
        expect(writes.length).toBe(0);
        expect(logs.length).toBe(1);
        expect(logs[0].entry).toEqual({
            type: 'save_result',
            characterName: DJINNI,
            rollType: 'save-repeat',
            targetName: BANDIT,
            saveDc: 17,
            saveType: 'Strength',
            success: false,
            roll: 13,
            total: 16,
            saveBonus: 3,
            description: 'Bandit 1 failed its repeat Strength save (DC 17, rolled 13 + 3 = 16) — remains under whirlwind.',
            timestamp: STAMP_MS,
        });
        expect(prompts.length).toBe(0);
    });

    it('MA-0303 fallback: abbreviated cs key { str } + CAPITALISED stored condition still match and strip', async () => {
        seed('campaign', 'targetEffects', [whirlwindTe()]);
        store[`${BANDIT}.activeConditions`] = ['Restrained']; // capitalised as authored
        store.__cs__ = { creatures: [{ name: BANDIT, type: 'npc', saveBonuses: { str: 2 } }] };
        npcRolls(15); // full-word 'strength' absent → 3-letter fallback 2; 15 + 2 = 17 ≥ DC

        const out = await applyRepeatSaveTurnEnd(CAMPAIGN, BANDIT);

        expect(out.results).toEqual([{ effect: 'whirlwind', success: true, roll: 15, total: 17 }]);
        expect(logs[0].entry.saveBonus).toBe(2);
        expect(store['campaign.targetEffects']).toEqual([]);
        expect(store[`${BANDIT}.activeConditions`]).toEqual([]); // lower() gate strips 'Restrained'
        expect(writes.length).toBe(2);
    });

    it('descriptor without condition: gate bypassed, success strips te but writes no condition/log', async () => {
        // holder absent from combat summary too → NPC lane defaults bonus 0, saveType 'Strength'
        seed('campaign', 'targetEffects', [whirlwindTe({ dc: undefined, repeatSave: { dc: 17 } })]);
        store[`${BANDIT}.activeConditions`] = ['blinded']; // near-miss condition never consulted-gated
        store.__cs__ = { creatures: [] };
        npcRolls(17); // 17 + 0 ≥ 17

        const out = await applyRepeatSaveTurnEnd(CAMPAIGN, BANDIT);

        expect(out).toEqual({ handled: true, results: [{ effect: 'whirlwind', success: true, roll: 17, total: 17 }] });
        expect(store['campaign.targetEffects']).toEqual([]);
        expect(store[`${BANDIT}.activeConditions`]).toEqual(['blinded']); // kept — not gated, not stripped
        expect(writes.map(w => w.args.slice(0, 2))).toEqual([['campaign', 'targetEffects']]);
        expect(logs.length).toBe(1); // zero condition-removed log on null condition
        expect(logs[0].entry.type).toBe('save_result');
        expect(logs[0].entry.saveType).toBe('Strength'); // descriptor default saveType
    });

    it('holder WITHOUT the gated condition: handled:true, zero rolls, zero prompts, zero writes', async () => {
        seed('campaign', 'targetEffects', [whirlwindTe()]);
        store[`${BANDIT}.activeConditions`] = []; // saved inside the whirlwind earlier
        store.__cs__ = { creatures: [{ name: BANDIT, type: 'npc', saveBonuses: { strength: 99 } }] }; // never consumed

        const out = await applyRepeatSaveTurnEnd(CAMPAIGN, BANDIT);

        expect(out).toEqual({ handled: true, results: [] });
        expect(dice).not.toHaveBeenCalled();
        expect(prompts.length).toBe(0);
        expect(logs.length).toBe(0);
        expect(writes.length).toBe(0);
        expect(reads).toEqual(['campaign.targetEffects', `${BANDIT}.activeConditions`]);
    });

    it('descriptor with no dc anywhere: console.error exact bytes, skip (no roll, no log, no write)', async () => {
        seed('campaign', 'targetEffects', [whirlwindTe({ dc: undefined, repeatSave: { saveType: 'Strength', condition: 'restrained' } })]);
        store[`${BANDIT}.activeConditions`] = ['restrained'];
        store.__cs__ = { creatures: [{ name: BANDIT, type: 'npc' }] };

        const out = await applyRepeatSaveTurnEnd(CAMPAIGN, BANDIT);

        expect(out).toEqual({ handled: true, results: [] });
        expect(consoleErrors).toEqual([['[repeatSaveService] repeat_save te "whirlwind" on Bandit 1 carries no dc — skipping.']]);
        expect(dice).not.toHaveBeenCalled();
        expect(logs.length).toBe(0);
        expect(writes.length).toBe(0);
    });

    it('never engages: falsy args, empty store, repeatTurnEnd zone te, boolean legacy repeatSave flag', async () => {
        expect(await applyRepeatSaveTurnEnd('', BANDIT)).toEqual({ handled: false });
        expect(await applyRepeatSaveTurnEnd(CAMPAIGN, '')).toEqual({ handled: false });
        seed('campaign', 'targetEffects', []);
        expect(await applyRepeatSaveTurnEnd(CAMPAIGN, BANDIT)).toEqual({ handled: false });
        // H3 zone lane (lair_insect_cloud) and legacy FP flag (lair_sand_cloud) are NOT this engine's
        seed('campaign', 'targetEffects', [
            { target: BANDIT, effect: 'lair_insect_cloud', source: DJINNI, repeatTurnEnd: true },
            { target: BANDIT, effect: 'lair_sand_cloud', source: DJINNI, repeatSave: true, dc: 15 },
        ]);
        store[`${BANDIT}.activeConditions`] = ['blinded'];

        expect(await applyRepeatSaveTurnEnd(CAMPAIGN, BANDIT)).toEqual({ handled: false });
        expect(dice).not.toHaveBeenCalled(); // empty dice queue proves zero rolls
        expect(prompts.length).toBe(0);
        expect(logs.length).toBe(0);
        expect(writes.length).toBe(0);
    });

    it('PC holder: queued save-listener prompt (exact dispatch tuple, dc_success:none), prompt verdict consumed', async () => {
        seed('campaign', 'targetEffects', [whirlwindTe({ target: PC })]);
        store[`${PC}.activeConditions`] = ['restrained'];
        store.__cs__ = { creatures: [{ name: PC, type: 'player' }] };
        pcQueue.push({ roll: 12, saveBonus: 5, success: true }); // 12 + 5 = 17 ≥ DC, prompt-side math

        const out = await applyRepeatSaveTurnEnd(CAMPAIGN, PC);

        expect(prompts).toEqual([{
            targetName: PC,
            saveType: 'STR',
            saveDc: 17,
            dcSuccess: 'none',
            condition: 'whirlwind (repeat save)',
        }]);
        expect(dice).not.toHaveBeenCalled(); // PCs never auto-roll inline
        expect(out).toEqual({ handled: true, results: [{ effect: 'whirlwind', success: true, roll: 12, total: 17 }] });
        expect(store['campaign.targetEffects']).toEqual([]);
        expect(store[`${PC}.activeConditions`]).toEqual([]);
        expect(logs[0].entry.total).toBe(17);
    });

    it('two armed tes compose sequentially over a fixed dice queue: strip only the winner', async () => {
        const whl = whirlwindTe();
        const bite = {
            target: BANDIT,
            effect: 'thri_kreen_bite_poison',
            source: KREEN,
            dc: 11,
            repeatSave: { saveType: 'Constitution', dc: 11, condition: 'poisoned' },
        };
        seed('campaign', 'targetEffects', [whl, bite]);
        store[`${BANDIT}.activeConditions`] = ['restrained', 'poisoned'];
        store.__cs__ = { creatures: [{ name: BANDIT, type: 'npc', saveBonuses: { strength: 3 } }] };
        npcRolls(14, 5); // whirlwind 14+3=17 ≥ 17 succeeds; bite CON 5+0=5 < 11 fails

        const out = await applyRepeatSaveTurnEnd(CAMPAIGN, BANDIT);

        expect(out).toEqual({
            handled: true,
            results: [
                { effect: 'whirlwind', success: true, roll: 14, total: 17 },
                { effect: 'thri_kreen_bite_poison', success: false, roll: 5, total: 5 },
            ],
        });
        expect(store['campaign.targetEffects']).toEqual([bite]);
        expect(store['campaign.targetEffects'][0]).toBe(bite); // loser te survives by identity
        expect(store[`${BANDIT}.activeConditions`]).toEqual(['poisoned']); // only Restrained stripped
        expect(logs.map(l => l.entry.type)).toEqual(['save_result', 'condition', 'save_result']);
        expect(logs[1].entry).toEqual({
            type: 'condition',
            action: 'removed',
            characterName: BANDIT,
            condition: 'Restrained',
            reason: 'whirlwind ends (repeat save succeeded)',
            sourceName: DJINNI,
            timestamp: STAMP_MS,
        });
    });
});

describe('grantRepeatSaveEffect — MA-0048 failed-save arm (saveProcessing fork, disk Thri-Kreen MA-1584)', () => {
    it('arms the disk Thri-Kreen te: full envelope, dc precedence over saveDc arg, exact arm log, input purity', async () => {
        seed('campaign', 'targetEffects', []);
        const repeatSave = { effect: 'thri_kreen_bite_poison', save_type: 'Constitution', dc: 11, condition: 'Poisoned' };
        const puritySnapshot = JSON.parse(JSON.stringify(repeatSave));

        await grantRepeatSaveEffect({ campaignName: CAMPAIGN, attackerName: KREEN, targetName: BANDIT, repeatSave, saveDc: 99, saveType: 'str' });

        expect(store['campaign.targetEffects']).toEqual([{
            target: BANDIT,
            effect: 'thri_kreen_bite_poison',
            source: KREEN,
            duration: 'until_repeat_save_succeeds',
            dc: 11, // repeatSave.dc wins over the saveDc arg
            saveType: 'Constitution',
            repeatSave: { saveType: 'Constitution', dc: 11, condition: 'poisoned' }, // condition lower-cased
        }]);
        expect(repeatSave).toEqual(puritySnapshot); // input arg never mutated
        expect(writes.length).toBe(1); // single register write, inert skipSync 5th arg
        expect(writes[0].args).toEqual(['campaign', 'targetEffects', store['campaign.targetEffects'], CAMPAIGN, true]);
        expect(logs.length).toBe(1);
        expect(logs[0].entry).toEqual({
            type: 'automation',
            automationType: 'thri_kreen_bite_poison_repeat_save_armed',
            characterName: BANDIT,
            sourceName: KREEN,
            abilityName: 'thri_kreen_bite_poison', // actionName absent → effect fallback
            description: 'Bandit 1 failed the Constitution save (DC 11) — thri_kreen_bite_poison armed with a turn-END repeat save while poisoned; a success ends the effect on itself (zone persistence/anchoring GM-enforced).',
            timestamp: STAMP_MS,
        });
    });

    it('fallback chain: saveDc/saveType args fill missing descriptor values; same te re-arm replaces in place (last-writer, single entry)', async () => {
        seed('campaign', 'targetEffects', []);

        await grantRepeatSaveEffect({ campaignName: CAMPAIGN, attackerName: KREEN, targetName: BANDIT, repeatSave: { effect: 'thri_kreen_bite_poison', condition: 'Poisoned' }, saveDc: 17, saveType: 'Constitution' });
        expect(store['campaign.targetEffects'][0]).toEqual({
            target: BANDIT,
            effect: 'thri_kreen_bite_poison',
            source: KREEN,
            duration: 'until_repeat_save_succeeds',
            dc: 17, // saveDc arg fallback when descriptor lacks dc
            saveType: 'Constitution', // saveType arg fallback when save_type absent
            repeatSave: { saveType: 'Constitution', dc: 17, condition: 'poisoned' },
        });
        // re-arm same target/effect/source with NO dc anywhere → '(DC ?)' byte, te replaced in place
        await grantRepeatSaveEffect({ campaignName: CAMPAIGN, attackerName: KREEN, targetName: BANDIT, repeatSave: { effect: 'thri_kreen_bite_poison' }, saveDc: undefined, saveType: 'Constitution' });

        expect(store['campaign.targetEffects']).toEqual([
            {
                target: BANDIT,
                effect: 'thri_kreen_bite_poison',
                source: KREEN,
                duration: 'until_repeat_save_succeeds',
                dc: undefined,
                saveType: 'Constitution',
                repeatSave: { saveType: 'Constitution', dc: undefined, condition: null },
            },
        ]); // exactly one te — second grant replaced the first (last-writer), did not append
        expect(logs.length).toBe(2);
        expect(logs[1].entry.description).toBe('Bandit 1 failed the Constitution save (DC ?) — thri_kreen_bite_poison armed with a turn-END repeat save; a success ends the effect on itself (zone persistence/anchoring GM-enforced).'); // condition clause absent, DC ? byte
    });

    it('no-effect legacy FP descriptor + falsy guards: no-op, zero writes/logs/reads', async () => {
        // Real disk shape (Tarrasque etc.): stays on the trackFrightfulPresence leg.
        await grantRepeatSaveEffect({ campaignName: CAMPAIGN, attackerName: DJINNI, targetName: BANDIT, repeatSave: { condition: 'frightened', save_type: 'Wisdom', duration_minutes: 1 }, saveDc: 18, saveType: 'wis' });
        await grantRepeatSaveEffect({ campaignName: '', attackerName: DJINNI, targetName: BANDIT, repeatSave: { effect: 'whirlwind', dc: 17 } });
        await grantRepeatSaveEffect({ campaignName: CAMPAIGN, attackerName: DJINNI, targetName: '', repeatSave: { effect: 'whirlwind', dc: 17 } });

        expect(store['campaign.targetEffects']).toBeUndefined(); // registerTargetEffect never ran
        expect(writes.length).toBe(0);
        expect(logs.length).toBe(0);
        expect(reads.length).toBe(0);
        expect(consoleErrors.length).toBe(0);
    });
});
