// @maintained-by-ai
// SP-008: Aura of Life RAW — "your Hit Point maximums can't be reduced"
// while in the aura. Topic face ONLY: the preGate protection seam of the
// shared hp-max-drain core (hpMaxReduceService.js:152-162) — MA-1489
// attack lane and MA-1547 save lane both ride this same gate (saveOutcome
// face pinned on the blocked call below). The generic drain core has NO
// base lane yet (hpMaxReduceService.test.js queued per
// hooks/combat/saveProcessing.ma1547-draining-kiss.test.js header); its
// numerics live there until adoption, so this lane's unflagged control
// stays minimal: gate-abstention + the PC current<=newMax clamp
// (:70 Math.min — never clamped anywhere else) + the strict === true
// flag read (:135 — truthy string 'true' is NOT protected).
//
// Aura-family lane map: SP-008 expiry CLEAR (flag purge, badge purge,
// auraOfLifeHpMaxProtected:false sole pin) — effects/clearExpirationEffects
// .aura-of-life.test.js (#1289); damage internals — auraDamageService.test.js
// (#1284); consumer shapes — applyAuraDamage.test.js (#1282); saveDc
// producer — features/holyAuraService.test.js (#1376); addCondition
// internals — conditionSaveService.test.js (#1003). te effect keys here:
// 'hp_max_reduce' is the ledger key this core registers (:203);
// 'aura_of_life' (registry, targetEffectDefinitions.js:645) is stamped/
// cleared by the aura handler + #1289 lanes, never here.
//
// NO-CLOCK audit: CLEAN — blocked path writes nothing at all (zero-write
// budget pinned); unflagged ledger duration is the flag string
// 'until_long_rest' (:204, GM-enforced), no countdowns, no timers;
// Date.now log stamps ride fake clocks only.
// Quirks pinned honestly: zero-damage pre-gate runs BEFORE the protection
// check (:153 vs :157) — protected + damage 0 pays the legacy zero log,
// not the block log; blocked returns null (producer-visible honest
// refusal); refuse-via-console.error (:29) belongs to unresolvable-base
// inputs — never triggered here, zero-call pinned as regression canary.
// Store fake is strict + argument-keyed (#1372 form): unknown reads and
// wrong-campaign calls THROW; unseeded-but-read keys are seeded to real
// store null (#1137 faithfulness). registerTargetEffect never persists in
// the fake, so sequential victims re-resolve baseMax — pin count/shape only.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const CAMPAIGN = 'test-campaign';
const FIXED_TS = 1760000000000;

const runtimeStore = {};
const reads = [];
const writes = [];
const logs = [];
const registered = [];

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: (name, key, campaign) => {
        if (campaign !== undefined && campaign !== CAMPAIGN) {
            throw new Error(`wrong-campaign read: ${campaign}`);
        }
        const k = `${name}.${key}`;
        reads.push(`${k}|${campaign ?? 'no-campaign'}`);
        if (!(k in runtimeStore)) throw new Error(`unexpected runtime read ${k}`);
        return runtimeStore[k];
    },
    setRuntimeValue: (name, key, value, campaign) => {
        if (campaign !== CAMPAIGN) throw new Error(`wrong-campaign write: ${campaign}`);
        writes.push({ name, key, value });
        runtimeStore[`${name}.${key}`] = value;
        return Promise.resolve();
    },
}));

const storageSet = vi.fn();
vi.mock('../../ui/storage.js', () => ({
    default: { set: (...args) => storageSet(...args) },
}));

const applyDamageToTarget = vi.fn().mockResolvedValue(undefined);
vi.mock('../combat/applyDamage.js', () => ({
    applyDamageToTarget: (...args) => applyDamageToTarget(...args),
}));

vi.mock('../../combat/conditions/targetEffectDefinitions.js', () => ({
    registerTargetEffect: (campaign, target, effect, source, extra) => { registered.push({ campaign, target, effect, source, extra }); },
}));

import { applyHpMaxReduce } from './hpMaxReduceService.js';

const PALADIN = { name: 'ElderPaladin', type: 'player' };
const PEER = { name: 'AuraPeer', type: 'player' };
const NPC_ALLY = { name: 'Bravo', type: 'npc' };
const SPECTER = { name: 'Specter 1', type: 'monster' };
const cs = {
    creatures: [{ name: 'Bravo', type: 'npc', maxHp: 22, currentHp: 18, maxHitPoints: 22, currentHitPoints: 18 }],
};

function call({ target = PALADIN, damage, attackerName = SPECTER.name, saveOutcome } = {}) {
    return applyHpMaxReduce({
        attackName: 'Life Drain',
        target,
        damage,
        combatSummary: cs,
        characters: [],
        campaignName: CAMPAIGN,
        attackerName,
        logEntry: (entry) => logs.push(entry),
        ...(saveOutcome ? { saveOutcome } : {}),
    });
}

const blockLog = (targetName, damage) => ({
    type: 'automation',
    automationType: 'hp_max_reduce_blocked',
    characterName: targetName,
    sourceName: SPECTER.name,
    abilityName: 'Life Drain',
    description: `${targetName}'s Hit Point maximum can't be reduced — protected by Aura of Life (Necrotic drain of ${damage} blocked on the maximum; GM-enforced RAW).`,
    timestamp: FIXED_TS,
});

let consoleError;

beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ now: FIXED_TS });
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    for (const k of Object.keys(runtimeStore)) delete runtimeStore[k];
    reads.length = 0;
    writes.length = 0;
    logs.length = 0;
    registered.length = 0;
    // explicit re-seed (#1312): every read the core can legally perform.
    runtimeStore['campaign.targetEffects'] = [];
    runtimeStore['ElderPaladin.hitPoints'] = 40;
    runtimeStore['ElderPaladin.currentHitPoints'] = 35; // > newMax 30 — clamp bait
    runtimeStore['ElderPaladin.hpMaxReduction'] = null; // real-store unseeded null (#1137)
    runtimeStore['ElderPaladin.auraOfLifeHpMaxProtected'] = false;
    runtimeStore['AuraPeer.hitPoints'] = 50;
    runtimeStore['AuraPeer.currentHitPoints'] = 50;
    runtimeStore['AuraPeer.hpMaxReduction'] = null;
    runtimeStore['AuraPeer.auraOfLifeHpMaxProtected'] = false;
    runtimeStore['Bravo.auraOfLifeHpMaxProtected'] = false;
    cs.creatures[0] = { name: 'Bravo', type: 'npc', maxHp: 22, currentHp: 18, maxHitPoints: 22, currentHitPoints: 18 };
});

afterEach(() => {
    vi.useRealTimers();
    consoleError.mockRestore();
});

describe('SP-008 Aura of Life blocks HP max reduction (preGate seam, :152-162)', () => {
    it('flag true: honest refusal on BOTH faces — zero-write budget, exact block log, no save-face log, no console.error', async () => {
        runtimeStore['ElderPaladin.auraOfLifeHpMaxProtected'] = true;

        const result = await call({ damage: 10, saveOutcome: 'failure' });

        expect(result).toBeNull();
        // short-circuit read shape: the flag is the ONLY store read — no
        // ledger/base resolution ever runs on a protected target.
        expect(reads).toEqual(['ElderPaladin.auraOfLifeHpMaxProtected|test-campaign']);
        expect(writes).toEqual([]);
        expect(runtimeStore['ElderPaladin.hitPoints']).toBe(40);
        expect(runtimeStore['ElderPaladin.currentHitPoints']).toBe(35);
        expect(runtimeStore['ElderPaladin.hpMaxReduction']).toBeNull();
        expect(registered).toEqual([]);
        expect(storageSet).toHaveBeenCalledTimes(0);
        expect(applyDamageToTarget).toHaveBeenCalledTimes(0);
        expect(consoleError).toHaveBeenCalledTimes(0);
        expect(logs).toEqual([blockLog('ElderPaladin', 10)]);
    });

    it('flag true for an NPC-class victim: cs four-key bytes untouched, storage channel silent, second exact block log', async () => {
        runtimeStore['Bravo.auraOfLifeHpMaxProtected'] = true;

        const result = await call({ target: NPC_ALLY, damage: 8 });

        expect(result).toBeNull();
        expect(reads).toEqual(['Bravo.auraOfLifeHpMaxProtected|test-campaign']);
        expect(cs.creatures[0]).toEqual({ name: 'Bravo', type: 'npc', maxHp: 22, currentHp: 18, maxHitPoints: 22, currentHitPoints: 18 });
        expect(storageSet).toHaveBeenCalledTimes(0);
        expect(registered).toEqual([]);
        expect(logs).toEqual([blockLog('Bravo', 8)]);
    });

    it('flag=false drains with exact write budget + current<=newMax clamp; truthy-string flag is NOT protected (=== true, :135)', async () => {
        const ledger = await call({ damage: 10 });
        expect(ledger).toEqual({ baseMax: 40, reduced: 10, max: 30 });
        // exact ordered write budget (:69-71), campaign-arg enforced by the fake.
        expect(writes).toEqual([
            { name: 'ElderPaladin', key: 'hitPoints', value: 30 },
            { name: 'ElderPaladin', key: 'currentHitPoints', value: 30 }, // clamp: seed 35 > newMax 30
            { name: 'ElderPaladin', key: 'hpMaxReduction', value: 10 }, // null + 10 → 10 (#1137 coercion)
        ]);
        expect(registered).toEqual([{
            campaign: CAMPAIGN,
            target: 'ElderPaladin',
            effect: 'hp_max_reduce',
            source: SPECTER.name,
            extra: { baseMax: 40, reduced: 10, max: 30, duration: 'until_long_rest' },
        }]);
        expect(logs[0]).toEqual({
            type: 'condition',
            action: 'applied',
            characterName: 'ElderPaladin',
            condition: 'Max HP Reduced',
            reason: 'Life Drain — max HP 40 → 30 (−10, equal to damage taken)',
            note: "ElderPaladin's Hit Point maximum decreased by 10 — ends on a long rest (Greater Restoration can restore early); dies if the maximum reaches 0.",
            timestamp: FIXED_TS,
        });
        expect(applyDamageToTarget).toHaveBeenCalledTimes(0); // damage resolves upstream, never here

        // falsy-triple class: the STRING 'true' fails the strict === true
        // gate and MUST drain — protection is boolean-granted only.
        reads.length = 0;
        runtimeStore['AuraPeer.auraOfLifeHpMaxProtected'] = 'true';
        const peerLedger = await call({ target: PEER, damage: 6 });
        expect(peerLedger).toEqual({ baseMax: 50, reduced: 6, max: 44 });
        expect(runtimeStore['AuraPeer.hitPoints']).toBe(44);
        expect(runtimeStore['AuraPeer.currentHitPoints']).toBe(44); // clamp 50 → 44
        expect(logs.filter(l => l.automationType === 'hp_max_reduce_blocked')).toEqual([]);
        expect(consoleError).toHaveBeenCalledTimes(0);
    });

    it('zero damage pre-gates BEFORE protection (:153 vs :157): legacy zero log, not block log', async () => {
        runtimeStore['ElderPaladin.auraOfLifeHpMaxProtected'] = true;

        const result = await call({ damage: 0 });

        expect(result).toBe('zero');
        expect(reads).toEqual([]); // protection flag never read on the zero leg
        expect(writes).toEqual([]);
        expect(registered).toEqual([]);
        expect(logs).toEqual([{
            type: 'automation',
            automationType: 'hp_max_reduce',
            characterName: SPECTER.name,
            abilityName: 'Life Drain',
            targetName: 'ElderPaladin',
            description: "Specter 1's Life Drain dealt 0 damage — ElderPaladin's Hit Point maximum is reduced by 0 (equal to damage taken). No change.",
            timestamp: FIXED_TS,
        }]);
    });
});
