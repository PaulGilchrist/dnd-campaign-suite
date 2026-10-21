// @maintained-by-ai
// MA-0048/0147/0163 — frightfulPresenceService BODY lane: track arms te +
// ONE merged 10-round clock, turn-END consumer repeats the save, grant
// writes the 24h immunity te (14400 = "24 hours" round LABEL, CLA-334 —
// no wall clock). saveProcessing.frightful-presence owns the DC-18
// prompt→arm fork; clearExpirationEffects.frightful-presence owns expiry
// grant + registerTargetEffect merge semantics (input args pinned here);
// ma1577-tarrasque re-runs the DC-17 chain (report-only overlap). Cited
// by adult-white-fp (:147-172) and ancient-black-fp (:174-221 — row shape
// + description wording included): keep those spans' subjects intact.
// Pinned AS-IS source smells: PC prompt hard-codes saveType 'WIS' even
// over a Charisma te; NPC bonus falls back saveBonuses[?] ?? wis ?? 0.
// grantFrightfulPresenceImmunity has zero external callers (turn-END
// success leg + this suite; caller scan 2026-10-20). Immunity refusal is
// upstream (MA-0030 gate per service header) — absence NOT pinned here.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { applyFrightfulPresenceTurnEnd, trackFrightfulPresence, grantFrightfulPresenceImmunity, FP_TE_EFFECT, FP_IMMUNITY_TE_EFFECT } from './frightfulPresenceService.js';

const runtimeStore = {};
const writes = [];
const logs = [];
const expirations = [];
const registered = [];
const listenerOpts = [];
let csCreatures = [];
let saveOutcome = { roll: 20, saveBonus: 5, total: 25, success: true };
let logFailure = null; const LOG_DOWN = new Error('log service down');
// Argument-keyed strict runtime: ANY unplanned read explodes (#1367 bar).
vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: (name, key) => {
        const k = `${name}.${key}`;
        if (!(k in runtimeStore)) throw new Error(`unexpected runtime read ${k}`);
        return runtimeStore[k];
    },
    setRuntimeValue: (name, key, value) => { const k = `${name}.${key}`; writes.push(k); runtimeStore[k] = value; return Promise.resolve(); },
}));
vi.mock('../../ui/logService.js', () => ({ addEntry: (_campaign, entry) => { logs.push(entry); return logFailure ? Promise.reject(LOG_DOWN) : Promise.resolve(); } }));
vi.mock('../../encounters/combatData.js', () => ({
    getCombatSummary: () => ({ creatures: csCreatures }),
}));
vi.mock('../../automation/common/savePrompt.js', () => ({
    createSaveListener: (_campaign, opts) => {
        listenerOpts.push(opts);
        return { promise: Promise.resolve(saveOutcome) };
    },
}));
vi.mock('../effects/expirationQueue.js', () => ({ addExpiration: (entry) => { expirations.push(entry); } }));
vi.mock('../../combat/conditions/targetEffectDefinitions.js', () => ({
    registerTargetEffect: (_campaign, targetName, effectKey, source, extra = {}) => {
        registered.push({ targetName, effectKey, source, ...extra });
    },
    getActiveTargetEffect: () => null,
}));

const k2 = (name, key) => `${name}.${key}`;
const CAMPAIGN = 'test-campaign';
const DRACOLICH = 'Adult Blue Dracolich 1';
const TARGET = 'ElderPaladin';
const ARMED_TE = { target: TARGET, effect: FP_TE_EFFECT, source: DRACOLICH, condition: 'frightened', saveType: 'Wisdom', dc: 18, duration: '1_minute', rounds: 10 };
const seed = (entries) => Object.assign(runtimeStore, entries);
const teFor = (t) => runtimeStore['campaign.targetEffects'].find(te => te.effect === FP_TE_EFFECT && te.target === t);
const immunityFor = (t) => registered.find(r => r.effectKey === FP_IMMUNITY_TE_EFFECT && r.targetName === t);
const logWith = (prop, value) => logs.find(l => l[prop] === value);

beforeEach(() => {
    vi.restoreAllMocks();
    Object.keys(runtimeStore).forEach(k => delete runtimeStore[k]);
    [writes, logs, expirations, registered, listenerOpts].forEach(a => { a.length = 0; });
    csCreatures = [];
    saveOutcome = { roll: 20, saveBonus: 5, total: 25, success: true };
    logFailure = null;
});
afterEach(() => { vi.restoreAllMocks(); });

describe('trackFrightfulPresence (MA-0048)', () => {
    it('failed-save arming writes ONE te envelope + ONE merged 10-round clock (strip te + Frightened, then immunity-grant leg) + ONE tracked log, byte-exact', async () => {
        await trackFrightfulPresence({ campaignName: CAMPAIGN, attackerName: DRACOLICH, targetName: TARGET, saveType: 'Wisdom', saveDc: 18 });
        expect(registered).toEqual([{ targetName: TARGET, effectKey: FP_TE_EFFECT, source: DRACOLICH, condition: 'frightened', saveType: 'Wisdom', dc: 18, duration: '1_minute', rounds: 10 }]);
        expect(expirations).toEqual([{ attackerName: DRACOLICH, targetName: TARGET, campaignName: CAMPAIGN, rounds: 10, effects: [
            { type: 'remove_target_effect', effectKey: FP_TE_EFFECT, source: DRACOLICH, target: TARGET },
            { type: 'condition', condition: 'frightened' },
            { type: 'frightful_presence_immunity_grant', immunityEffect: FP_IMMUNITY_TE_EFFECT },
        ] }]);
        expect(logs).toHaveLength(1);
        expect(logs[0]).toMatchObject({ type: 'automation', automationType: 'frightful_presence_tracked', characterName: TARGET, sourceName: DRACOLICH, abilityName: 'Frightful Presence' });
        expect(logs[0].description).toBe("ElderPaladin is Frightened by Adult Blue Dracolich 1's Frightful Presence (DC 18) — repeats the save at the end of each of its turns; effect ends after 1 minute (10 rounds), then ElderPaladin is immune to Adult Blue Dracolich 1's Frightful Presence for 24 hours (14400 rounds).");
        expect(typeof logs[0].timestamp).toBe('number');
        expect(writes).toEqual([]); // te/clock exit via mocked seams; zero raw store writes
    });
    it('guards real tables: missing campaign/attacker/target or nullish saveDc (pre-fix rows carry no save_dc) arms NOTHING, logs nothing, writes nothing', async () => {
        const bad = [{}, { attackerName: DRACOLICH }, { campaignName: CAMPAIGN }, { campaignName: '', attackerName: DRACOLICH, targetName: TARGET, saveDc: 18 }, { campaignName: CAMPAIGN, targetName: TARGET, saveDc: 18 }, { campaignName: CAMPAIGN, attackerName: DRACOLICH, saveDc: 18 }, { campaignName: CAMPAIGN, attackerName: DRACOLICH, targetName: TARGET, saveDc: null }, { campaignName: CAMPAIGN, attackerName: DRACOLICH, targetName: TARGET }];
        for (const arg of bad) await trackFrightfulPresence(arg);
        expect([registered, expirations, logs, writes]).toEqual([[], [], [], []]);
    });
    it('log-service failure cannot desync the arm: te + clock still written once, identical Error surfaced with exact console prefix, promise resolves', async () => {
        const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        logFailure = LOG_DOWN;
        await expect(trackFrightfulPresence({ campaignName: CAMPAIGN, attackerName: DRACOLICH, targetName: TARGET, saveType: 'Wisdom', saveDc: 18 })).resolves.toBeUndefined();
        expect(registered).toHaveLength(1);
        expect(expirations).toHaveLength(1);
        expect(errSpy).toHaveBeenCalledWith('[frightfulPresenceService:tracked]', LOG_DOWN);
    });
});
describe('applyFrightfulPresenceTurnEnd (MA-0048 turn-END consumer)', () => {
    it('unarmed target → { handled: false } with zero writes, logs, prompts, clocks', async () => {
        seed({ 'campaign.targetEffects': [] });
        expect(await applyFrightfulPresenceTurnEnd(CAMPAIGN, TARGET)).toEqual({ handled: false });
        expect([writes, logs, listenerOpts, expirations, registered]).toEqual([[], [], [], [], []]);
    });
    it('PC success: exact WIS prompt (dcSuccess none), sheds Frightened + strips te (write budget exactly those two keys), registers 24h immunity te + clock, logs save-fp-repeat / condition removed / granted', async () => {
        csCreatures = [{ name: TARGET, type: 'player' }];
        seed({ 'campaign.targetEffects': [ARMED_TE], [k2(TARGET, 'activeConditions')]: ['frightened'] });
        expect(await applyFrightfulPresenceTurnEnd(CAMPAIGN, TARGET)).toEqual({ handled: true, success: true, roll: 20, total: 25 });
        expect(listenerOpts).toEqual([{ targetName: TARGET, saveType: 'WIS', saveDc: 18, dcSuccess: 'none', condition: 'Frightful Presence (repeat save)' }]);
        expect(runtimeStore[k2(TARGET, 'activeConditions')]).toEqual([]);
        expect(teFor(TARGET)).toBeUndefined();
        expect(immunityFor(TARGET)).toEqual({ targetName: TARGET, effectKey: FP_IMMUNITY_TE_EFFECT, source: DRACOLICH, duration: '24_hours', rounds: 14400 });
        expect(expirations).toEqual([{ attackerName: DRACOLICH, targetName: TARGET, campaignName: CAMPAIGN, rounds: 14400, effects: [{ type: 'remove_target_effect', effectKey: FP_IMMUNITY_TE_EFFECT, source: DRACOLICH, target: TARGET }] }]);
        expect(writes).toEqual([k2(TARGET, 'activeConditions'), 'campaign.targetEffects']);
        expect(logWith('rollType', 'save-fp-repeat')).toMatchObject({ type: 'save_result', characterName: DRACOLICH, targetName: TARGET, success: true, roll: 20, saveBonus: 5, total: 25, saveDc: 18, saveType: 'Wisdom' });
        expect(logWith('action', 'removed')).toMatchObject({ type: 'condition', characterName: TARGET, condition: 'Frightened', reason: 'Frightful Presence ends (repeat save succeeded)', sourceName: DRACOLICH });
        expect(logWith('automationType', 'frightful_presence_immunity_granted').description).toBe("ElderPaladin is immune to Adult Blue Dracolich 1's Frightful Presence for the next 24 hours (14400 rounds) — repeat save succeeded.");
    });
    it('PC failure keeps Frightened + te byte-intact: zero store writes, zero clocks, zero immunity registrations, remains-Frightened wording', async () => {
        csCreatures = [{ name: TARGET, type: 'player' }];
        seed({ 'campaign.targetEffects': [ARMED_TE], [k2(TARGET, 'activeConditions')]: ['frightened'] });
        saveOutcome = { roll: 4, saveBonus: 5, success: false };
        expect(await applyFrightfulPresenceTurnEnd(CAMPAIGN, TARGET)).toEqual({ handled: true, success: false, roll: 4, total: 9 });
        expect(runtimeStore[k2(TARGET, 'activeConditions')]).toEqual(['frightened']);
        expect(teFor(TARGET)).toEqual(ARMED_TE);
        expect([registered, expirations, writes]).toEqual([[], [], []]);
        expect(logWith('rollType', 'save-fp-repeat').description).toBe("ElderPaladin failed its repeat Wisdom save (DC 18, rolled 4 + 5 = 9) — remains Frightened.");
    });
    it('NPC auto-roll: no PC prompt, saveBonuses.wis mapped, inclusive boundary total == DC succeeds and ends the effect', async () => {
        csCreatures = [{ name: TARGET, type: 'npc', saveBonuses: { wis: -2 } }];
        seed({ 'campaign.targetEffects': [ARMED_TE], [k2(TARGET, 'activeConditions')]: ['frightened'] });
        vi.spyOn(Math, 'random').mockReturnValue(0.99); // roll 20 + (-2) = 18 == DC 18
        expect(await applyFrightfulPresenceTurnEnd(CAMPAIGN, TARGET)).toEqual({ handled: true, success: true, roll: 20, total: 18 });
        expect(listenerOpts).toEqual([]);
        expect(runtimeStore[k2(TARGET, 'activeConditions')]).toEqual([]);
        expect(teFor(TARGET)).toBeUndefined();
        expect(immunityFor(TARGET)).toMatchObject({ rounds: 14400 });
    });
});
describe('MA-0147 Adult White Dragon FP — CHA row engages the MA-0048 service', () => {
    const WHITE = 'Adult White Dragon 1';
    it('disk row (exact repeat_save/success_immunity objects, dc_success none, byte-key parity with FP constants) arms te + clock verbatim through the service', async () => {
        const row = (await import('../../../../public/data/monsters.json')).default.find(m => m.name === 'Adult White Dragon').legendary_actions.find(a => a.name === 'Frightful Presence');
        expect(row.dc_success).toBe('none');
        expect(row.save_dc).toBe(14);
        expect(row.save_type).toBe('Charisma');
        expect(row.repeat_save).toEqual({ condition: 'frightened', save_type: 'Charisma', duration_minutes: 1 });
        expect(row.success_immunity).toEqual({ effect: 'frightful_presence_immunity', duration: '24_hours', duration_minutes: 1440 });
        expect(FP_TE_EFFECT).toBe('frightful_presence');
        await trackFrightfulPresence({ campaignName: CAMPAIGN, attackerName: WHITE, targetName: TARGET, saveType: row.repeat_save.save_type, saveDc: row.save_dc });
        expect(registered).toEqual([{ targetName: TARGET, effectKey: FP_TE_EFFECT, source: WHITE, condition: 'frightened', saveType: 'Charisma', dc: 14, duration: '1_minute', rounds: 10 }]);
        expect(expirations[0].rounds).toBe(10);
        expect(expirations[0].effects.map(e => e.type)).toEqual(['remove_target_effect', 'condition', 'frightful_presence_immunity_grant']);
        expect(logWith('automationType', 'frightful_presence_tracked').sourceName).toBe(WHITE);
    });
    it('turn-END success over a CHA DC 14 te: save-fp-repeat records Charisma DC 14, immunity te sourced from the dragon; prompt stays WIS-hardcoded (pinned AS-IS)', async () => {
        csCreatures = [{ name: TARGET, type: 'player' }];
        seed({ 'campaign.targetEffects': [{ ...ARMED_TE, source: WHITE, saveType: 'Charisma', dc: 14 }], [k2(TARGET, 'activeConditions')]: ['frightened'] });
        expect(await applyFrightfulPresenceTurnEnd(CAMPAIGN, TARGET)).toEqual({ handled: true, success: true, roll: 20, total: 25 });
        expect(listenerOpts[0]).toMatchObject({ saveType: 'WIS', saveDc: 14 });
        expect(teFor(TARGET)).toBeUndefined();
        expect(runtimeStore[k2(TARGET, 'activeConditions')]).toEqual([]);
        expect(logWith('rollType', 'save-fp-repeat')).toMatchObject({ saveType: 'Charisma', saveDc: 14, success: true });
        expect(immunityFor(TARGET)).toEqual({ targetName: TARGET, effectKey: FP_IMMUNITY_TE_EFFECT, source: WHITE, duration: '24_hours', rounds: 14400 });
        expect(expirations).toEqual([{ attackerName: WHITE, targetName: TARGET, campaignName: CAMPAIGN, rounds: 14400, effects: [{ type: 'remove_target_effect', effectKey: FP_IMMUNITY_TE_EFFECT, source: WHITE, target: TARGET }] }]);
    });
});

describe('MA-0163 Ancient Black Dragon FP — WIS row engages the MA-0048 service', () => {
    // Cited range owner (ancient-black-fp.test.jsx → :174-221): exact WIS DC 21
    // row shape + every description this row byte-produces (tracked, save-fp-repeat,
    // granted, removed). Failure leg wording pinned beside the success chain.
    const ABD = 'Ancient Black Dragon 1';
    const dcRow = async () => (await import('../../../../public/data/monsters.json')).default.find(m => m.name === 'Ancient Black Dragon').legendary_actions.find(a => a.name === 'Frightful Presence');
    it('authored row shape (DC 21 Wisdom, objects not booleans, MA-0147 mirror) arms te + 10-round clock with exact tracked description wording', async () => {
        const row = await dcRow();
        expect(row.save_dc).toBe(21);
        expect(row.save_type).toBe('Wisdom');
        expect(row.dc_success).toBe('none');
        expect(row.repeat_save).toEqual({ condition: 'frightened', save_type: 'Wisdom', duration_minutes: 1 });
        expect(row.success_immunity).toEqual({ effect: FP_IMMUNITY_TE_EFFECT, duration: '24_hours', duration_minutes: 1440 });
        await trackFrightfulPresence({ campaignName: CAMPAIGN, attackerName: ABD, targetName: TARGET, saveType: row.repeat_save.save_type, saveDc: row.save_dc });
        expect(registered).toEqual([{ targetName: TARGET, effectKey: FP_TE_EFFECT, source: ABD, condition: 'frightened', saveType: 'Wisdom', dc: 21, duration: '1_minute', rounds: 10 }]);
        expect(expirations).toEqual([{ attackerName: ABD, targetName: TARGET, campaignName: CAMPAIGN, rounds: 10, effects: [
            { type: 'remove_target_effect', effectKey: FP_TE_EFFECT, source: ABD, target: TARGET },
            { type: 'condition', condition: 'frightened' },
            { type: 'frightful_presence_immunity_grant', immunityEffect: FP_IMMUNITY_TE_EFFECT },
        ] }]);
        expect(logWith('automationType', 'frightful_presence_tracked').description).toBe("ElderPaladin is Frightened by Ancient Black Dragon 1's Frightful Presence (DC 21) — repeats the save at the end of each of its turns; effect ends after 1 minute (10 rounds), then ElderPaladin is immune to Ancient Black Dragon 1's Frightful Presence for 24 hours (14400 rounds).");
    });
    it('success chain on the DC 21 row sheds te + Frightened, grants 14400-round immunity te + clock sourced from the dragon, exact repeat/removed/granted description wording pinned', async () => {
        csCreatures = [{ name: TARGET, type: 'player' }];
        seed({ 'campaign.targetEffects': [{ ...ARMED_TE, source: ABD, dc: 21 }], [k2(TARGET, 'activeConditions')]: ['frightened'] });
        expect(await applyFrightfulPresenceTurnEnd(CAMPAIGN, TARGET)).toEqual({ handled: true, success: true, roll: 20, total: 25 });
        expect(listenerOpts[0]).toMatchObject({ targetName: TARGET, saveType: 'WIS', saveDc: 21, dcSuccess: 'none' });
        expect(teFor(TARGET)).toBeUndefined();
        expect(runtimeStore[k2(TARGET, 'activeConditions')]).toEqual([]);
        expect(immunityFor(TARGET)).toEqual({ targetName: TARGET, effectKey: FP_IMMUNITY_TE_EFFECT, source: ABD, duration: '24_hours', rounds: 14400 });
        expect(expirations).toEqual([{ attackerName: ABD, targetName: TARGET, campaignName: CAMPAIGN, rounds: 14400, effects: [{ type: 'remove_target_effect', effectKey: FP_IMMUNITY_TE_EFFECT, source: ABD, target: TARGET }] }]);
        expect(logWith('rollType', 'save-fp-repeat')).toMatchObject({ type: 'save_result', characterName: ABD, targetName: TARGET, saveDc: 21, saveType: 'Wisdom', success: true, roll: 20, saveBonus: 5, total: 25 });
        expect(logWith('rollType', 'save-fp-repeat').description).toBe("ElderPaladin succeeded its repeat Wisdom save (DC 21, rolled 20 + 5 = 25) — Frightful Presence ends; immune to Ancient Black Dragon 1's Frightful Presence for 24 hours.");
        expect(logWith('automationType', 'frightful_presence_immunity_granted').description).toBe("ElderPaladin is immune to Ancient Black Dragon 1's Frightful Presence for the next 24 hours (14400 rounds) — repeat save succeeded.");
        expect(logWith('action', 'removed').reason).toBe('Frightful Presence ends (repeat save succeeded)');
    });
    it('repeat-save failure at DC 21 keeps te + Frightened, registers zero immunity, writes zero clocks, exact remains-Frightened wording', async () => {
        csCreatures = [{ name: TARGET, type: 'npc', saveBonuses: { wis: 1 } }];
        seed({ 'campaign.targetEffects': [{ ...ARMED_TE, source: ABD, dc: 21 }], [k2(TARGET, 'activeConditions')]: ['frightened'] });
        vi.spyOn(Math, 'random').mockReturnValue(0); // roll 1 + 1 = 2 < 21
        expect(await applyFrightfulPresenceTurnEnd(CAMPAIGN, TARGET)).toEqual({ handled: true, success: false, roll: 1, total: 2 });
        expect(listenerOpts).toEqual([]); // NPC auto-roll lane — no PC prompt ever
        expect(runtimeStore[k2(TARGET, 'activeConditions')]).toEqual(['frightened']);
        expect(immunityFor(TARGET)).toBeUndefined();
        expect(expirations).toEqual([]);
        expect(logWith('rollType', 'save-fp-repeat').description).toBe("ElderPaladin failed its repeat Wisdom save (DC 21, rolled 1 + 1 = 2) — remains Frightened.");
    });
});

describe('grantFrightfulPresenceImmunity (exported; production entry = turn-END success leg)', () => {
    it('writes the 24h immunity te (14400 rounds, CLA-334 minutes×10 label) + matching clock + granted log interpolating the reason', async () => {
        await grantFrightfulPresenceImmunity({ campaignName: CAMPAIGN, attackerName: DRACOLICH, targetName: TARGET, reason: 'repeat save succeeded' });
        expect(registered).toEqual([{ targetName: TARGET, effectKey: FP_IMMUNITY_TE_EFFECT, source: DRACOLICH, duration: '24_hours', rounds: 14400 }]);
        expect(expirations).toEqual([{ attackerName: DRACOLICH, targetName: TARGET, campaignName: CAMPAIGN, rounds: 14400, effects: [{ type: 'remove_target_effect', effectKey: FP_IMMUNITY_TE_EFFECT, source: DRACOLICH, target: TARGET }] }]);
        expect(logs).toHaveLength(1);
        expect(logWith('automationType', 'frightful_presence_immunity_granted').description).toBe("ElderPaladin is immune to Adult Blue Dracolich 1's Frightful Presence for the next 24 hours (14400 rounds) — repeat save succeeded.");
    });
});