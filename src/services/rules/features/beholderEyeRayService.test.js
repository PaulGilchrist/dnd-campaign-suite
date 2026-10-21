// @maintained-by-ai
// MA-0374 / MA-0383: Beholder Eye Rays service. Failed-save grants are driven
// from monsters.json ray rows (Beholder d10 table, DC 16; Beholder Zombie d4
// table, DC 14) — every expectation is derived from disk, never hand-transcribed.
// One addExpiration clock per grant; the Paralyzed end-of-turn repeat ladder with
// its rounds:10 auto-success clock; the Petrification Restrained→Petrified
// two-stage; PC targets route through the queued save prompt.
// d10/d4 dice selection and the saveProcessing dispatcher live in
// saveProcessing.eye-rays.test.js / MonsterCardHelpers.eye-rays.test.js —
// cited here, not re-run. Concentration boundary: neither ladder te is
// concentration; neither touches it. No wall-clock timers: repeats resolve only
// at the turn-end seam; the auto-success leg rides the rounds:10 clock.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import monsters from '../../../../public/data/monsters.json';

const runtimeStore = {};
const logs = [];
const expirations = [];
const writes = [];

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: (name, key) => runtimeStore[`${name}.${key}`],
    setRuntimeValue: (name, key, value, _campaign, skipSync) => {
        runtimeStore[`${name}.${key}`] = value;
        writes.push({ name, key, skipSync });
        return Promise.resolve();
    },
}));

vi.mock('../../ui/logService.js', () => ({
    addEntry: (_campaign, entry) => { logs.push(entry); return Promise.resolve(); },
}));

let csCreatures = [];
vi.mock('../../encounters/combatData.js', () => ({
    getCombatSummary: () => ({ creatures: csCreatures }),
    loadCombatSummary: async () => ({ creatures: csCreatures }),
}));

let nextSaveResolve = null;
vi.mock('../../automation/common/savePrompt.js', () => ({
    createSaveListener: () => {
        const promise = new Promise((resolve) => { nextSaveResolve = resolve; });
        return { promise, promptId: 'prompt-1' };
    },
}));

vi.mock('../effects/expirationQueue.js', () => ({
    addExpiration: (arg) => { expirations.push(arg); },
}));

import { applyEyeRayFailedGrants, applyEyeRaysTurnEnd, EYE_RAY_PARALYZED_TE, EYE_RAY_PETRIFYING_TE } from './beholderEyeRayService.js';

const C = 'test-campaign';
const BH = 'Beholder 1';
const ZB = 'Beholder Zombie 1';
const T = 'HexWarlock';

const list = Array.isArray(monsters) ? monsters : monsters.monsters;
function rayRow(monsterName) {
    const row = (list.find(m => m.name === monsterName)?.actions || []).find(a => Array.isArray(a.rays) && a.rays.length >= 2);
    if (!row) throw new Error(`monsters.json: ${monsterName} has no authored rays[] row`);
    return row;
}
function pickRay(row, key) {
    const ray = row.rays.find(r => r.key === key);
    if (!ray) throw new Error(`monsters.json: ${key} ray missing from ${row.name} row`);
    return ray;
}
// The monster-card seam stamps the row DC onto the picked ray before the
// failed-save call (same shape as saveProcessing.eye-rays.test.js).
function ctxRay(row, ray) {
    return { ...ray, save_dc: row.save_dc };
}

const BH_ROW = rayRow('Beholder');    // d10 table, DC 16
const ZOMBIE_ROW = rayRow('Beholder Zombie'); // d4 table, DC 14

function tes() {
    return runtimeStore['campaign.targetEffects'] || [];
}
function activeConditions() {
    return runtimeStore[`${T}.activeConditions`] || [];
}
function effectKeys(effects) {
    return effects.map(e => `${e.type}|${e.effectKey ?? e.condition}`).sort();
}
function reset() {
    for (const k of Object.keys(runtimeStore)) delete runtimeStore[k];
    logs.length = 0;
    expirations.length = 0;
    writes.length = 0;
    csCreatures = [];
}

async function stage(ray, attacker = BH, row = BH_ROW) {
    await applyEyeRayFailedGrants({ campaignName: C, attackerName: attacker, targetName: T, ray: ctxRay(row, ray) });
}

// Every expectation on this disk ray row is derived from the row itself:
// exact te set = te_grants, ONE clock whose rounds and effect list match
// clock_rounds / te_grants / conditions, ladder branches per ladder field.
async function assertRayGrant(row, ray, attacker) {
    await stage(ray, attacker, row);
    const teKeys = tes().filter(te => te.target === T).map(te => te.effect).sort();

    if (ray.ladder === 'paralyzed') {
        expect(activeConditions()).toEqual(['paralyzed']);
        expect(teKeys).toEqual([EYE_RAY_PARALYZED_TE]);
        expect(tes().find(te => te.effect === EYE_RAY_PARALYZED_TE)).toMatchObject({
            source: attacker, dc: row.save_dc, saveType: 'CON', stage: 'paralyzed',
        });
        expect(expirations).toHaveLength(1);
        expect(expirations[0]).toMatchObject({ attackerName: attacker, targetName: T, campaignName: C, rounds: 10 });
        expect(effectKeys(expirations[0].effects)).toEqual(effectKeys([
            { type: 'condition', condition: 'paralyzed' },
            { type: 'remove_target_effect', effectKey: EYE_RAY_PARALYZED_TE },
        ]));
        expect(logs.some(e => e.type === 'condition' && e.condition === 'Paralyzed' && /Paralyzing Ray/.test(e.sourceAbility))).toBe(true);
    } else if (ray.ladder === 'petrification') {
        expect(activeConditions()).toEqual(['restrained']);
        expect(teKeys).toEqual([EYE_RAY_PETRIFYING_TE]);
        expect(expirations).toHaveLength(0); // repeat save owns the clock — never two racing
        expect(logs.some(e => e.type === 'condition' && e.condition === 'Restrained' && /Petrification Ray/.test(e.sourceAbility))).toBe(true);
    } else {
        expect(teKeys).toEqual([...(ray.te_grants || [])].sort());
        expect(activeConditions()).toEqual([]); // plain condition legs ride the standard seam
        for (const te of tes().filter(te => te.target === T)) {
            expect(te.saveType).toBe(String(ray.save_ability).toUpperCase());
        }
        if (ray.te_grants?.includes('telekinetic_movement')) {
            expect(tes().find(te => te.effect === 'telekinetic_movement').value).toBe(30);
        }
        const hasClock = Number(ray.clock_rounds) > 0;
        expect(expirations).toHaveLength(hasClock ? 1 : 0);
        if (hasClock) {
            expect(expirations[0]).toMatchObject({ attackerName: attacker, targetName: T, campaignName: C, rounds: Number(ray.clock_rounds) });
            const expected = [
                ...(ray.te_grants || []).map(effectKey => ({ type: 'remove_target_effect', effectKey })),
                ...(ray.conditions || []).map(condition => ({ type: 'condition', condition })),
            ];
            expect(effectKeys(expirations[0].effects)).toEqual(effectKeys(expected));
            expect(expirations[0].effects.every(e => e.type !== 'remove_target_effect' || (e.source === attacker && e.target === T))).toBe(true);
        }
    }
}

beforeEach(reset);

describe('MA-0374 applyEyeRayFailedGrants — disk ray table', () => {
    it('every Beholder d10 ray (all 10 enumerable): exact te grants + ONE clock, pinned to its monsters.json row', async () => {
        expect(BH_ROW.rays).toHaveLength(10);
        for (const ray of BH_ROW.rays) {
            reset();
            await assertRayGrant(BH_ROW, ray, BH);
        }
    });

    it('ray-less / target-less calls are inert', async () => {
        const slowing = ctxRay(BH_ROW, pickRay(BH_ROW, 'slowing'));
        await applyEyeRayFailedGrants({ campaignName: C, attackerName: BH, targetName: null, ray: slowing });
        await applyEyeRayFailedGrants({ campaignName: C, attackerName: BH, targetName: T, ray: null });
        await applyEyeRayFailedGrants({ campaignName: C, attackerName: BH, targetName: T });
        expect(tes()).toHaveLength(0);
        expect(expirations).toHaveLength(0);
        expect(logs).toHaveLength(0);
    });
});

describe('MA-0383 Beholder Zombie d4 row rides the identical service', () => {
    it('every zombie ray (all 4 enumerable): same grants, clocks, and ladders at DC 14', async () => {
        expect(ZOMBIE_ROW.rays).toHaveLength(4);
        for (const ray of ZOMBIE_ROW.rays) {
            reset();
            await assertRayGrant(ZOMBIE_ROW, ray, ZB);
        }
    });
});

describe('MA-0374 applyEyeRaysTurnEnd ladders', () => {
    function npc(con) {
        csCreatures = [{ name: T, type: 'monster', saveBonuses: { con: con } }];
    }

    it('no staged te → not handled', async () => {
        expect((await applyEyeRaysTurnEnd(C, T)).handled).toBe(false);
        expect(logs).toHaveLength(0);
    });

    it('paralyzing ladder vs NPC: fail holds Paralyzed, next-turn success sheds te + condition and the campaign write is skipSync', async () => {
        await stage(pickRay(BH_ROW, 'paralyzing'));
        npc(-20); // roll(1-20) − 20 < DC 16: deterministic fail
        const fail = await applyEyeRaysTurnEnd(C, T);
        expect(fail).toMatchObject({ handled: true, success: false });
        expect(fail.roll).toBeGreaterThanOrEqual(1);
        expect(fail.roll).toBeLessThanOrEqual(20);
        expect(fail.total).toBe(fail.roll - 20);
        expect(tes().some(te => te.effect === EYE_RAY_PARALYZED_TE)).toBe(true);
        expect(activeConditions()).toContain('paralyzed');
        expect(logs.some(e => e.type === 'save_result' && e.rollType === 'save-paralyzing-repeat' && !e.success && e.saveDc === 16)).toBe(true);

        logs.length = 0;
        npc(20); // roll + 20 ≥ DC 16: deterministic success
        const win = await applyEyeRaysTurnEnd(C, T);
        expect(win).toMatchObject({ handled: true, success: true });
        expect(win.total).toBe(win.roll + 20);
        expect(tes().some(te => te.effect === EYE_RAY_PARALYZED_TE)).toBe(false);
        expect(activeConditions()).not.toContain('paralyzed');
        expect(logs.some(e => e.type === 'condition' && e.action === 'removed' && e.condition === 'Paralyzed')).toBe(true);
        expect(writes.filter(w => w.name === 'campaign').every(w => w.skipSync === true)).toBe(true);
    });

    it('petrification ladder: failed repeat save escalates Restrained → Petrified, te cleared', async () => {
        await stage(pickRay(BH_ROW, 'petrification'));
        npc(-20);
        const res = await applyEyeRaysTurnEnd(C, T);
        expect(res).toMatchObject({ handled: true, success: false });
        expect(activeConditions()).toContain('petrified');
        expect(activeConditions()).not.toContain('restrained');
        expect(tes().some(te => te.effect === EYE_RAY_PETRIFYING_TE)).toBe(false);
        expect(logs.some(e => e.type === 'condition' && e.condition === 'Petrified')).toBe(true);
        expect(logs.some(e => e.type === 'save_result' && e.rollType === 'save-petrification-repeat')).toBe(true);
    });

    it('petrification ladder: successful repeat save sheds Restrained without petrifying', async () => {
        await stage(pickRay(BH_ROW, 'petrification'));
        npc(20);
        const res = await applyEyeRaysTurnEnd(C, T);
        expect(res).toMatchObject({ handled: true, success: true });
        expect(activeConditions()).toEqual([]);
        expect(tes().some(te => te.effect === EYE_RAY_PETRIFYING_TE)).toBe(false);
    });

    it('PC repeat saves route through the queued prompt: beholder DC 16 success sheds, zombie DC 14 fail holds', async () => {
        await stage(pickRay(BH_ROW, 'paralyzing'));
        csCreatures = [{ name: T, type: 'player' }];
        const winPromise = applyEyeRaysTurnEnd(C, T);
        nextSaveResolve({ roll: 19, saveBonus: 5, success: true });
        expect(await winPromise).toMatchObject({ handled: true, success: true, roll: 19, total: 24 });
        const promptRow = logs.find(e => e.type === 'ability_use' && /repeats its Constitution save \(DC 16\)/.test(e.description));
        expect(promptRow.promptId).toBe('prompt-1');
        expect(tes().some(te => te.effect === EYE_RAY_PARALYZED_TE)).toBe(false);

        reset();
        await stage(pickRay(ZOMBIE_ROW, 'paralyzing'), ZB, ZOMBIE_ROW);
        csCreatures = [{ name: T, type: 'player' }];
        logs.length = 0;
        const failPromise = applyEyeRaysTurnEnd(C, T);
        nextSaveResolve({ roll: 3, saveBonus: 0, success: false });
        expect(await failPromise).toMatchObject({ handled: true, success: false, roll: 3, total: 3 });
        const saveRow = logs.find(e => e.type === 'save_result' && e.rollType === 'save-paralyzing-repeat');
        expect(saveRow).toMatchObject({ saveDc: ZOMBIE_ROW.save_dc, saveType: 'CON', success: false });
        expect(activeConditions()).toContain('paralyzed');
    });
});
