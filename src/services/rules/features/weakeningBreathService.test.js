// @maintained-by-ai
// MA-0102/MA-0212 weakeningBreathService lane (producer + bespoke turn-END
// repeater). Disk canon read PROGRAMMATICALLY from public/data/monsters.json
// (shared 5e file — 2024/ has NO monsters.json, per #1410): exactly FOUR
// weakening-breath carriers, all gold dragons — Wyrmling 13/1d4, Young
// 17/1d6, Adult 21/1d6, Ancient 24/1d10 (near-miss silver dragons carry
// PARALYZING breath, owned by #1390 — never here).
//
// LANDMARK te.source verdict (#1295 origin): this PRODUCER writes source on
// EVERY envelope — registerTargetEffect positional #4 (service :36) and the
// auto-success expiration payload (service :49) — pinned by full-set toEqual
// below. So the #1295 multi-dragon collision is READER-side only: the
// clear/expiration leg is pinned by clearExpirationEffects.weakening-breath
// .test.js and the paralyzing twin by paralyzingBreathService.test.js
// (#1390); THIS file pins the THIRD reader — applyWeakeningBreathTurnEnd's
// own source-blind find (:26) / strip (:105) — honestly, in 'two dragons on
// one target'. Do not duplicate those pins elsewhere.
//
// ENGINE verdict: bespoke, Tashas #1423 form — te carries NO repeatSave
// descriptor, so the generic repeatSaveService (#1405) never ticks this
// ladder; navigationHandlers :201 calls applyWeakeningBreathTurnEnd directly.
// NO-CLOCK: clean — the 1-minute auto-success lands as a ROUNDS:10 counter
// via addExpiration (turn-seam matures only; CLA-334 minutes×10); zero
// setTimeout/setInterval in this module or lane.
// Zero-dice on every grant/PC row (Math.random is NPC-inline-only); dice
// queue THROWS on exhaustion so an accidental extra roll is loud (#1380).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const CAMPAIGN = 'test-campaign';
const ATTACKER = 'Adult Gold Dragon 1';
const ANCIENT = 'Ancient Gold Dragon';
const TARGET = 'EvasiveFighter';
const STAMP_MS = 1765000000000;

const runtimeStore = {};
const logs = [];
const writes = [];
const registered = [];
const expirations = [];
const listenerCalls = [];
let csCreatures = [];
let listenerResolve = { roll: 20, saveBonus: 5, success: true };
let addEntryFails = false;

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: (owner, key, campaignName) => {
        if (campaignName !== CAMPAIGN) throw new Error(`unowned campaign ${campaignName}`);
        if (owner !== 'campaign' || key !== 'targetEffects') throw new Error(`unowned key ${owner}.${key}`);
        return runtimeStore[`${owner}.${key}`];
    },
    setRuntimeValue: (owner, key, value, campaignName, ...rest) => {
        if (campaignName !== CAMPAIGN) throw new Error(`unowned campaign ${campaignName}`);
        if (owner !== 'campaign' || key !== 'targetEffects') throw new Error(`unowned key ${owner}.${key}`);
        writes.push({ path: `${owner}.${key}`, value, argc: 4 + rest.length, skipSync: rest[0] });
        runtimeStore[`${owner}.${key}`] = value;
        return Promise.resolve();
    },
}));

vi.mock('../../ui/logService.js', () => ({
    addEntry: (campaignName, entry) => {
        if (campaignName !== CAMPAIGN) throw new Error(`unowned campaign ${campaignName}`);
        logs.push(entry);
        return addEntryFails ? Promise.reject(new Error('log-down')) : Promise.resolve();
    },
}));

vi.mock('../../encounters/combatData.js', () => ({
    getCombatSummary: (campaignName) => {
        if (campaignName !== CAMPAIGN) throw new Error(`unowned campaign ${campaignName}`);
        return { creatures: csCreatures };
    },
}));

vi.mock('../../automation/common/savePrompt.js', () => ({
    createSaveListener: (campaignName, opts) => {
        if (campaignName !== CAMPAIGN) throw new Error(`unowned campaign ${campaignName}`);
        listenerCalls.push(opts);
        return { promise: Promise.resolve(listenerResolve) };
    },
}));

vi.mock('../effects/expirationQueue.js', () => ({
    addExpiration: (entry) => { expirations.push(entry); },
}));

vi.mock('../../combat/conditions/targetEffectDefinitions.js', () => ({
    registerTargetEffect: (campaignName, targetName, effectKey, source, extra, ...rest) => {
        registered.push({ args: [campaignName, targetName, effectKey, source, extra], argc: 5 + rest.length });
    },
    getEffectDefinition: () => null,
}));

import { grantWeakeningBreath, applyWeakeningBreathTurnEnd, WEAKENING_BREATH_TE } from './weakeningBreathService.js';

function armTe(te) {
    runtimeStore['campaign.targetEffects'] = [{
        target: TARGET, effect: WEAKENING_BREATH_TE, source: ATTACKER,
        saveType: 'Strength', dc: 21, strCheckDisadvantage: true, damageSubtractDie: '1d6', duration: '1_minute', rounds: 10, ...te,
    }];
}

// Fixed dice stub: naturals queue, mid-cell floats (floor(r*20)+1 === n
// exactly), THROW on exhaustion so an unexpected extra roll never passes
// silently (#1380 unstubbed-dice form for the raw Math.random NPC leg).
let diceSpy = null;
function stubDice(naturals) {
    const queue = [...naturals];
    diceSpy = vi.spyOn(Math, 'random').mockImplementation(() => {
        const n = queue.shift();
        if (n == null) throw new Error('unstubbed dice: Math.random queue exhausted');
        return (n - 0.5) / 20;
    });
    return diceSpy;
}

let errSpy;
beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(STAMP_MS);
    errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    Object.keys(runtimeStore).forEach(k => delete runtimeStore[k]);
    logs.length = 0;
    writes.length = 0;
    registered.length = 0;
    expirations.length = 0;
    listenerCalls.length = 0;
    csCreatures = [];
    listenerResolve = { roll: 20, saveBonus: 5, success: true };
    addEntryFails = false;
});

afterEach(() => {
    diceSpy?.mockRestore();
    diceSpy = null;
    errSpy.mockRestore();
    vi.useRealTimers();
});

describe('MA-0102 grantWeakeningBreath', () => {
    it('failed save: full-set te envelope (source positional #4 — the #1295 fix-half) + ONE merged 10-round auto-success clock carrying source+target bytes + exact save_result/condition logs', async () => {
        await grantWeakeningBreath({ campaignName: CAMPAIGN, attackerName: ATTACKER, targetName: TARGET, saveType: 'Strength', saveDc: 21, roll: 4, saveBonus: 1 });
        expect(registered).toEqual([{
            args: [CAMPAIGN, TARGET, WEAKENING_BREATH_TE, ATTACKER, {
                duration: '1_minute', rounds: 10, dc: 21, saveType: 'Strength',
                strCheckDisadvantage: true, damageSubtractDie: '1d6',
            }],
            argc: 5,
        }]);
        // Expiration payload: source+target ride here (#1295 cited; the clear
        // lane at :482 IGNORES source — producer side is all THIS test can hold).
        expect(expirations).toEqual([{
            attackerName: ATTACKER, targetName: TARGET, campaignName: CAMPAIGN, rounds: 10,
            effects: [{ type: 'weakening_breath_auto_success', effectKey: WEAKENING_BREATH_TE, source: ATTACKER, target: TARGET }],
        }]);
        expect(logs).toHaveLength(2);
        expect(logs[0]).toEqual({
            type: 'save_result', characterName: ATTACKER, rollType: 'save-weakening-breath',
            targetName: TARGET, saveDc: 21, saveType: 'Strength', success: false, roll: 4,
            total: 5, saveBonus: 1,
            description: `${TARGET} failed ${ATTACKER}'s Weakening Breath save (Strength DC 21, rolled 4 + 1 = 5) — Enfeebled.`,
            timestamp: STAMP_MS,
        });
        expect(logs[1]).toEqual({
            type: 'condition', action: 'applied', characterName: TARGET, condition: 'Weakened',
            sourceName: ATTACKER, sourceAbility: 'Weakening Breath',
            description: `${TARGET} failed the Strength save (DC 21) in ${ATTACKER}'s Weakening Breath — Disadvantage on Strength-based d20 tests and subtracts 1d6 from damage rolls; repeats the save at the end of each of its turns (auto-succeeds after 1 minute — 10 rounds).`,
            timestamp: STAMP_MS,
        });
        expect(errSpy).not.toHaveBeenCalled();
    });

    it('every missing guard leg is fully inert; saveDc 0 is LIVE (== null semantics)', async () => {
        const base = { campaignName: CAMPAIGN, attackerName: ATTACKER, targetName: TARGET, saveType: 'Strength', saveDc: 21, roll: 4, saveBonus: 1 };
        await grantWeakeningBreath({ ...base, campaignName: '' });
        await grantWeakeningBreath({ ...base, attackerName: '' });
        await grantWeakeningBreath({ ...base, targetName: '' });
        await grantWeakeningBreath({ ...base, saveDc: null });
        await grantWeakeningBreath({ ...base, saveDc: undefined });
        expect(registered).toEqual([]);
        expect(expirations).toEqual([]);
        expect(logs).toEqual([]);
        expect(listenerCalls).toEqual([]);
        expect(errSpy).not.toHaveBeenCalled();
        // saveDc 0 passes the `== null` guard — inert-by-falsiness would be the drift.
        await grantWeakeningBreath({ ...base, saveDc: 0 });
        expect(registered).toEqual([{
            args: [CAMPAIGN, TARGET, WEAKENING_BREATH_TE, ATTACKER, {
                duration: '1_minute', rounds: 10, dc: 0, saveType: 'Strength',
                strCheckDisadvantage: true, damageSubtractDie: '1d6',
            }],
            argc: 5,
        }]);
        expect(expirations).toHaveLength(1);
    });

    it('defaults and :0-swallow bytes: no saveType → Strength, no die → 1d6, no roll/saveBonus → 0/0 logged as `rolled ? + 0 = 0`', async () => {
        await grantWeakeningBreath({ campaignName: CAMPAIGN, attackerName: ATTACKER, targetName: TARGET, saveDc: 21 });
        expect(registered[0].args[4]).toEqual({
            duration: '1_minute', rounds: 10, dc: 21, saveType: 'Strength',
            strCheckDisadvantage: true, damageSubtractDie: '1d6',
        });
        expect(logs[0]).toEqual({
            type: 'save_result', characterName: ATTACKER, rollType: 'save-weakening-breath',
            targetName: TARGET, saveDc: 21, saveType: 'Strength', success: false, roll: 0,
            total: 0, saveBonus: 0,
            description: `${TARGET} failed ${ATTACKER}'s Weakening Breath save (Strength DC 21, rolled ? + 0 = 0) — Enfeebled.`,
            timestamp: STAMP_MS,
        });
    });

    it('addEntry rejection never blocks the grant: te+clock still land, both legs log exact console.error prefixes', async () => {
        addEntryFails = true;
        await expect(grantWeakeningBreath({ campaignName: CAMPAIGN, attackerName: ATTACKER, targetName: TARGET, saveType: 'Strength', saveDc: 21, roll: 4, saveBonus: 1 })).resolves.toBeUndefined();
        expect(registered).toHaveLength(1);
        expect(expirations).toHaveLength(1);
        expect(errSpy).toHaveBeenCalledTimes(2);
        expect(errSpy.mock.calls.map(c => c[0])).toEqual(['[weakeningBreathService:save-result]', '[weakeningBreathService:granted]']);
    });

    it('MA-0212 per-monster die: 1d10 lands on te + condition bytes; Adult default stays byte-identical 1d6', async () => {
        await grantWeakeningBreath({ campaignName: CAMPAIGN, attackerName: ANCIENT, targetName: TARGET, saveType: 'Strength', saveDc: 24, roll: 2, saveBonus: 1, die: '1d10' });
        expect(registered[0].args).toEqual([CAMPAIGN, TARGET, WEAKENING_BREATH_TE, ANCIENT, {
            duration: '1_minute', rounds: 10, dc: 24, saveType: 'Strength',
            strCheckDisadvantage: true, damageSubtractDie: '1d10',
        }]);
        expect(logs[1].description).toBe(`${TARGET} failed the Strength save (DC 24) in ${ANCIENT}'s Weakening Breath — Disadvantage on Strength-based d20 tests and subtracts 1d10 from damage rolls; repeats the save at the end of each of its turns (auto-succeeds after 1 minute — 10 rounds).`);
        // Adult default (no die arg) stays 1d6 (MA-0102 byte-lock).
        await grantWeakeningBreath({ campaignName: CAMPAIGN, attackerName: ATTACKER, targetName: 'Other Target', saveType: 'Strength', saveDc: 21, roll: 4, saveBonus: 1 });
        expect(registered[1].args).toEqual([CAMPAIGN, 'Other Target', WEAKENING_BREATH_TE, ATTACKER, {
            duration: '1_minute', rounds: 10, dc: 21, saveType: 'Strength',
            strCheckDisadvantage: true, damageSubtractDie: '1d6',
        }]);
    });

    it('disk census: exactly four weakening-breath carriers (all gold dragons), dc/save/die map byte-exact; no 2024 monsters corpus', async () => {
        const monsters = (await import('../../../../public/data/monsters.json')).default;
        const list = Array.isArray(monsters) ? monsters : Object.values(monsters);
        const rows = list
            .filter(x => (x.actions || []).some(a => /weakening breath/i.test(a.name || '')))
            .map(x => {
                const a = x.actions.find(a => /weakening breath/i.test(a.name || ''));
                return { index: x.index, dc: a.save_dc, save: a.save_type, die: (a.save_effect.match(/\((\d+d\d+)\)/) || [])[1] };
            });
        expect(rows).toEqual([
            { index: 'adult-gold-dragon', dc: 21, save: 'Strength', die: '1d6' },
            { index: 'ancient-gold-dragon', dc: 24, save: 'Strength', die: '1d10' },
            { index: 'gold-dragon-wyrmling', dc: 13, save: 'Strength', die: '1d4' },
            { index: 'young-gold-dragon', dc: 17, save: 'Strength', die: '1d6' },
        ]);
        // Shared 5e file is canon: no 2024 monsters.json in the dual-path corpus (#1410).
        const data2024 = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../../../public/data/2024');
        expect(readdirSync(data2024)).not.toContain('monsters.json');
    });
});

describe('MA-0102 applyWeakeningBreathTurnEnd', () => {
    it('no te on the outgoing creature — inert, zero logs, zero writes', async () => {
        const r = await applyWeakeningBreathTurnEnd(CAMPAIGN, TARGET);
        expect(r).toEqual({ handled: false });
        expect(logs).toEqual([]);
        expect(writes).toEqual([]);
        expect(listenerCalls).toEqual([]);
    });

    it('PC leg: full-set DISADVANTAGE STR prompt (roll/saveBonus ?? 0 mapped through); success strips the te via ONE gated write (foreign te survives) + exact repeat-log bytes', async () => {
        armTe();
        runtimeStore['campaign.targetEffects'].push({ target: 'Bystander', effect: 'hex', source: 'Warlock' });
        csCreatures = [{ name: TARGET, type: 'player' }];
        listenerResolve = { roll: undefined, saveBonus: undefined, success: true };
        const r = await applyWeakeningBreathTurnEnd(CAMPAIGN, TARGET);
        expect(listenerCalls).toEqual([{
            targetName: TARGET, saveType: 'STR', saveDc: 21, dcSuccess: 'none',
            disadvantage: true, condition: 'Weakening Breath (repeat save)',
        }]);
        expect(r).toEqual({ handled: true, success: true, roll: 0, total: 0 });
        // Write budget (#1341): exactly ONE campaign.targetEffects write,
        // producer-leg so skipSync stays UNSET (4 args, arity audited here).
        expect(writes).toHaveLength(1);
        expect(writes[0].argc).toBe(4);
        expect(writes[0].skipSync).toBeUndefined();
        expect(writes[0].value).toEqual([{ target: 'Bystander', effect: 'hex', source: 'Warlock' }]);
        expect(logs).toEqual([
            {
                type: 'save_result', characterName: ATTACKER, rollType: 'save-weakening-repeat',
                targetName: TARGET, saveDc: 21, saveType: 'Strength', success: true, roll: 0,
                total: 0, saveBonus: 0, mode: 'disadvantage',
                description: `${TARGET} succeeded its repeat Strength save (DC 21, rolled 0 + 0 = 0, disadvantage) — Weakening Breath ends.`,
                timestamp: STAMP_MS,
            },
            {
                type: 'condition', action: 'removed', characterName: TARGET, condition: 'Weakened',
                reason: 'Weakening Breath ends (repeat save succeeded)', sourceName: ATTACKER,
                timestamp: STAMP_MS,
            },
        ]);
        expect(errSpy).not.toHaveBeenCalled();
    });

    it('NPC leg: rolls twice keeps low; fail keeps the te with ZERO writes; exact fail bytes', async () => {
        armTe();
        csCreatures = [{ name: TARGET, type: 'npc', saveBonuses: { str: 1 } }];
        stubDice([20, 11]); // min = 11; +1 = 12 < 21
        const r = await applyWeakeningBreathTurnEnd(CAMPAIGN, TARGET);
        expect(r).toEqual({ handled: true, success: false, roll: 11, total: 12 });
        expect(writes).toEqual([]);
        expect(listenerCalls).toEqual([]);
        expect(runtimeStore['campaign.targetEffects']).toHaveLength(1);
        expect(logs).toHaveLength(1);
        expect(logs[0]).toEqual({
            type: 'save_result', characterName: ATTACKER, rollType: 'save-weakening-repeat',
            targetName: TARGET, saveDc: 21, saveType: 'Strength', success: false, roll: 11,
            total: 12, saveBonus: 1, mode: 'disadvantage',
            description: `${TARGET} failed its repeat Strength save (DC 21, rolled 11 + 1 = 12, disadvantage) — remains Weakened (auto-succeeds after 1 minute).`,
            timestamp: STAMP_MS,
        });
    });

    it('>= tie boundary succeeds AND sparse te falls back to dc 21 / Strength / key str (no dc/saveType on the te)', async () => {
        armTe({ dc: undefined, saveType: undefined });
        delete runtimeStore['campaign.targetEffects'][0].dc;
        delete runtimeStore['campaign.targetEffects'][0].saveType;
        csCreatures = [{ name: TARGET, type: 'npc', saveBonuses: { str: 1 } }];
        stubDice([20, 20]); // min = 20; +1 = 21 === fallback DC 21 → >= tie SUCCEEDS
        const r = await applyWeakeningBreathTurnEnd(CAMPAIGN, TARGET);
        expect(r).toEqual({ handled: true, success: true, roll: 20, total: 21 });
        expect(runtimeStore['campaign.targetEffects']).toEqual([]);
        expect(logs[0].description).toBe(`${TARGET} succeeded its repeat Strength save (DC 21, rolled 20 + 1 = 21, disadvantage) — Weakening Breath ends.`);
    });

    it('case-split gate (#1390 breath-family form): saveBonuses lookup is strict lowercase — uppercase STR key misses, bonus 0', async () => {
        armTe();
        csCreatures = [{ name: TARGET, type: 'npc', saveBonuses: { STR: 10 } }];
        stubDice([20, 20]); // min 20 + (missed lookup → 0) = 20 < 21 → fail keeps te
        const r = await applyWeakeningBreathTurnEnd(CAMPAIGN, TARGET);
        expect(r).toEqual({ handled: true, success: false, roll: 20, total: 20 });
        expect(runtimeStore['campaign.targetEffects']).toHaveLength(1);
        expect(logs[0].saveBonus).toBe(0);
    });

    it('creature missing from combat summary — auto NPC leg with bonus 0, no prompt queued', async () => {
        armTe();
        csCreatures = [];
        stubDice([20, 20]); // 20 + 0 = 20 < 21
        const r = await applyWeakeningBreathTurnEnd(CAMPAIGN, TARGET);
        expect(r).toEqual({ handled: true, success: false, roll: 20, total: 20 });
        expect(listenerCalls).toEqual([]);
        expect(logs[0].saveBonus).toBe(0);
    });

    it('two dragons on one target (#1295-class, THIS lane): find reads the FIRST te ignoring te.source (foreign dc 24 invisible); success STRIPS BOTH rows — source-blind strip pinned honestly', async () => {
        // Producers DO carry source (:36 positional #4, :49 payload — see grant
        // lane); real registerTargetEffect dedups by target+effect+source, so
        // two weakening rows on one target are reachable. Readers here filter
        // effect+target ONLY (:26/:105). Clear-lane twin: #1295
        // clearExpirationEffects.weakening-breath.test.js; paralyzing twin: #1390.
        runtimeStore['campaign.targetEffects'] = [
            { target: TARGET, effect: WEAKENING_BREATH_TE, source: ATTACKER, saveType: 'Strength', dc: 21 },
            { target: TARGET, effect: WEAKENING_BREATH_TE, source: ANCIENT, saveType: 'Strength', dc: 24 },
        ];
        csCreatures = [{ name: TARGET, type: 'npc', saveBonuses: { str: 1 } }];
        stubDice([20, 20]); // adjudicated at FIRST row's dc 21: 20+1 = 21 ≥ 21 → success
        const r = await applyWeakeningBreathTurnEnd(CAMPAIGN, TARGET);
        expect(r).toEqual({ handled: true, success: true, roll: 20, total: 21 });
        expect(logs[0]).toEqual({
            type: 'save_result', characterName: ATTACKER, rollType: 'save-weakening-repeat',
            targetName: TARGET, saveDc: 21, saveType: 'Strength', success: true, roll: 20,
            total: 21, saveBonus: 1, mode: 'disadvantage',
            description: `${TARGET} succeeded its repeat Strength save (DC 21, rolled 20 + 1 = 21, disadvantage) — Weakening Breath ends.`,
            timestamp: STAMP_MS,
        }); // second dragon's DC 24 ladder silently adjudicated at Adult's 21
        // Collateral strip: Ancient's row is gone too even though the save was
        // against Adult's ladder — if reader source-scoping is ever fixed, THIS
        // survivor assertion flips deliberately (#1295 form).
        expect(runtimeStore['campaign.targetEffects']).toEqual([]);
    });
});
