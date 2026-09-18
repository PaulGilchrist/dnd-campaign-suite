// MA-0374: Beholder Eye Rays service — failed-save te grants with ONE
// rounds clock, the Paralyzed end-of-turn repeat ladder (10-round
// auto-success clock), and the Petrification Restrained→Petrified two-stage.
import { describe, it, expect, vi, beforeEach } from 'vitest';

const runtimeStore = {};
const logs = [];
const expirations = [];

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: (name, key) => runtimeStore[`${name}.${key}`],
    setRuntimeValue: (name, key, value) => { runtimeStore[`${name}.${key}`] = value; return Promise.resolve(); },
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
const T = 'HexWarlock';

function ray(key, extra = {}) {
    const base = {
        charm: { save_ability: 'Wisdom', conditions: ['charmed'], clock_rounds: 600 },
        paralyzing: { save_ability: 'Constitution', conditions: [], ladder: 'paralyzed' },
        slowing: { save_ability: 'Constitution', conditions: [], te_grants: ['speed_half', 'no_reactions', 'no_action_and_bonus_action'], clock_rounds: 2 },
        enervation: { save_ability: 'Constitution', conditions: ['poisoned'], te_grants: ['no_healing'], clock_rounds: 2 },
        telekinetic: { save_ability: 'Strength', conditions: ['restrained'], te_grants: ['telekinetic_movement'], clock_rounds: 2 },
        petrification: { save_ability: 'Constitution', conditions: [], ladder: 'petrification' },
    };
    return { key, save_dc: 16, ...base[key], ...extra };
}

function tes() {
    return runtimeStore['campaign.targetEffects'] || [];
}

beforeEach(() => {
    vi.clearAllMocks();
    for (const k of Object.keys(runtimeStore)) delete runtimeStore[k];
    logs.length = 0;
    expirations.length = 0;
    csCreatures = [];
});

describe('MA-0374 applyEyeRayFailedGrants', () => {
    it('slowing ray grants the MA-0087 slowed trio te with ONE rounds:2 clock', async () => {
        await applyEyeRayFailedGrants({ campaignName: C, attackerName: BH, targetName: T, ray: ray('slowing') });
        const keys = tes().filter(te => te.target === T).map(te => te.effect).sort();
        expect(keys).toEqual(['no_action_and_bonus_action', 'no_reactions', 'speed_half']);
        expect(expirations).toHaveLength(1);
        expect(expirations[0]).toMatchObject({ attackerName: BH, targetName: T, campaignName: C, rounds: 2 });
        expect(expirations[0].effects.map(e => e.effectKey).sort()).toEqual(keys);
    });

    it('telekinetic ray carries the telekinetic_movement te with value 30 + rounds:2 clock covering the restrained condition', async () => {
        await applyEyeRayFailedGrants({ campaignName: C, attackerName: BH, targetName: T, ray: ray('telekinetic') });
        const tk = tes().find(te => te.effect === 'telekinetic_movement');
        expect(tk).toMatchObject({ target: T, source: BH, value: 30 });
        expect(expirations).toHaveLength(1);
        const types = expirations[0].effects.map(e => e.type);
        expect(types).toContain('remove_target_effect');
        expect(expirations[0].effects.some(e => e.type === 'condition' && e.condition === 'restrained')).toBe(true);
    });

    it('charm ray: single rounds:600 clock (1 hour, CLA-334 hours×600), no te', async () => {
        await applyEyeRayFailedGrants({ campaignName: C, attackerName: BH, targetName: T, ray: ray('charm') });
        expect(expirations).toHaveLength(1);
        expect(expirations[0]).toMatchObject({ rounds: 600 });
        expect(expirations[0].effects).toEqual([{ type: 'condition', condition: 'charmed' }]);
    });

    it('paralyzing ray stages Paralyzed + te + the 10-round auto-success clock, logs the ladder', async () => {
        await applyEyeRayFailedGrants({ campaignName: C, attackerName: BH, targetName: T, ray: ray('paralyzing') });
        expect(runtimeStore[`${T}.activeConditions`]).toContain('paralyzed');
        expect(tes().some(te => te.effect === EYE_RAY_PARALYZED_TE && te.source === BH)).toBe(true);
        expect(expirations).toHaveLength(1);
        expect(expirations[0]).toMatchObject({ rounds: 10 });
        const log = logs.find(e => e.type === 'condition' && e.condition === 'Paralyzed');
        expect(log.sourceAbility).toMatch(/Paralyzing Ray/);
    });

    it('petrification ray stages Restrained + ladder te (no clock — repeat save owns it)', async () => {
        await applyEyeRayFailedGrants({ campaignName: C, attackerName: BH, targetName: T, ray: ray('petrification') });
        expect(runtimeStore[`${T}.activeConditions`]).toContain('restrained');
        expect(tes().some(te => te.effect === EYE_RAY_PETRIFYING_TE && te.stage === 'restrained')).toBe(true);
        expect(expirations).toHaveLength(0);
    });

    it('no ray / no target: inert', async () => {
        await applyEyeRayFailedGrants({ campaignName: C, attackerName: BH, targetName: null, ray: ray('slowing') });
        expect(tes()).toHaveLength(0);
        expect(expirations).toHaveLength(0);
    });
});

describe('MA-0374 applyEyeRaysTurnEnd ladders', () => {
    async function npcTarget(con) {
        csCreatures = [{ name: T, type: 'monster', saveBonuses: { con: con } }];
    }

    it('no staged te → not handled', async () => {
        expect((await applyEyeRaysTurnEnd(C, T)).handled).toBe(false);
    });

    it('paralyzing repeat save succeeds (NPC auto-roll high CON) → te + Paralyzed shed + removed log', async () => {
        await applyEyeRayFailedGrants({ campaignName: C, attackerName: BH, targetName: T, ray: ray('paralyzing') });
        await npcTarget(20);
        const res = await applyEyeRaysTurnEnd(C, T);
        expect(res.handled).toBe(true);
        expect(res.success).toBe(true);
        expect(tes().some(te => te.effect === EYE_RAY_PARALYZED_TE)).toBe(false);
        expect(runtimeStore[`${T}.activeConditions`] || []).not.toContain('paralyzed');
        expect(logs.some(e => e.type === 'save_result' && e.rollType === 'save-paralyzing-repeat' && e.success)).toBe(true);
    });

    it('paralyzing repeat save fails (NPC auto-roll low CON) → stays Paralyzed (clock owns auto-success)', async () => {
        await applyEyeRayFailedGrants({ campaignName: C, attackerName: BH, targetName: T, ray: ray('paralyzing') });
        await npcTarget(-20);
        const res = await applyEyeRaysTurnEnd(C, T);
        expect(res.success).toBe(false);
        expect(tes().some(te => te.effect === EYE_RAY_PARALYZED_TE)).toBe(true);
        expect(runtimeStore[`${T}.activeConditions`]).toContain('paralyzed');
    });

    it('petrification ladder: failed repeat save escalates Restrained → Petrified, te cleared', async () => {
        await applyEyeRayFailedGrants({ campaignName: C, attackerName: BH, targetName: T, ray: ray('petrification') });
        await npcTarget(-20);
        const res = await applyEyeRaysTurnEnd(C, T);
        expect(res.success).toBe(false);
        expect(runtimeStore[`${T}.activeConditions`]).toContain('petrified');
        expect(runtimeStore[`${T}.activeConditions`]).not.toContain('restrained');
        expect(tes().some(te => te.effect === EYE_RAY_PETRIFYING_TE)).toBe(false);
        expect(logs.some(e => e.type === 'condition' && e.condition === 'Petrified')).toBe(true);
    });

    it('petrification ladder: successful repeat save sheds Restrained without petrifying', async () => {
        await applyEyeRayFailedGrants({ campaignName: C, attackerName: BH, targetName: T, ray: ray('petrification') });
        await npcTarget(20);
        const res = await applyEyeRaysTurnEnd(C, T);
        expect(res.success).toBe(true);
        expect(runtimeStore[`${T}.activeConditions`] || []).not.toContain('restrained');
        expect(runtimeStore[`${T}.activeConditions`] || []).not.toContain('petrified');
    });

    it('PC target repeat save routes through the queued save prompt', async () => {
        await applyEyeRayFailedGrants({ campaignName: C, attackerName: BH, targetName: T, ray: ray('paralyzing') });
        csCreatures = [{ name: T, type: 'player' }];
        const promise = applyEyeRaysTurnEnd(C, T);
        nextSaveResolve({ roll: 19, saveBonus: 5, success: true });
        const res = await promise;
        expect(res.success).toBe(true);
        expect(logs.some(e => e.type === 'ability_use' && /repeats its Constitution save/.test(e.description))).toBe(true);
    });
});

// ── MA-0383: Beholder Zombie rows ride the identical service (DC 14) ────
describe('MA-0383 zombie DC propagation through the shared ladder', () => {
    it('zombie paralyzing ray (save_dc 14): te + repeat ladder register with DC 14, ONE rounds:10 clock', async () => {
        await applyEyeRayFailedGrants({ campaignName: C, attackerName: 'Beholder Zombie 1', targetName: T, ray: { ...ray('paralyzing'), save_dc: 14, ladder: 'paralyzed' } });
        const te = tes().find(e => e.effect === EYE_RAY_PARALYZED_TE);
        expect(te).toMatchObject({ target: T, source: 'Beholder Zombie 1', dc: 14, saveType: 'CON', stage: 'paralyzed' });
        expect(runtimeStore[`${T}.activeConditions`]).toContain('paralyzed');
        expect(expirations).toHaveLength(1);
        expect(expirations[0]).toMatchObject({ attackerName: 'Beholder Zombie 1', targetName: T, rounds: 10 });
    });

    it('zombie turn-end repeat save: fail vs DC 14 keeps Paralyzed, logs the DC 14 ladder roll', async () => {
        await applyEyeRayFailedGrants({ campaignName: C, attackerName: 'Beholder Zombie 1', targetName: T, ray: { ...ray('paralyzing'), save_dc: 14, ladder: 'paralyzed' } });
        csCreatures = [{ name: T, type: 'player' }];
        logs.length = 0;
        const promise = applyEyeRaysTurnEnd(C, T);
        nextSaveResolve({ roll: 3, saveBonus: 0, success: false });
        const res = await promise;
        expect(res).toMatchObject({ handled: true, success: false, total: 3 });
        const saveRow = logs.find(e => e.type === 'save_result' && e.rollType === 'save-paralyzing-repeat');
        expect(saveRow).toMatchObject({ saveDc: 14, saveType: 'CON', success: false });
    });

    it('zombie enervation ray: no_healing te with rounds:2 clock (same shape as beholder)', async () => {
        await applyEyeRayFailedGrants({ campaignName: C, attackerName: 'Beholder Zombie 1', targetName: T, ray: { ...ray('enervation'), save_dc: 14 } });
        const te = tes().find(e => e.effect === 'no_healing');
        expect(te).toMatchObject({ target: T, source: 'Beholder Zombie 1', saveType: 'CONSTITUTION' });
        expect(expirations).toHaveLength(1);
        expect(expirations[0].rounds).toBe(2);
    });
});
