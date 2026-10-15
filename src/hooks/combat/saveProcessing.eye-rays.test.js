// MA-0374 / MA-0383: saveProcessing Eye Rays dispatcher — failed-save grant
// hook delegated to beholderEyeRayService (te grants + repeat-save ladders)
// and the Disintegration/Death Ray 0-HP advisory record. Beholder (d10 row,
// DC 16) and Beholder Zombie (d4 row, DC 14) ride the identical, ray-agnostic
// dispatcher, so the zombie legs are folded into the shared tests below.
// Rays/DCs/types are derived from monsters.json — never hardcoded.
// Byte-inert for rows without context.eyeRay.
// @maintained-by-ai: 2026-10-14
import { describe, it, expect, vi, beforeEach } from 'vitest';
import monsters from '../../../public/data/monsters.json';

const runtimeStore = {};
const addEntryLogs = [];

vi.mock('../runtime/useRuntimeState.js', () => ({
    getRuntimeValue: (name, key) => runtimeStore[`${name}.${key}`],
    setRuntimeValue: (name, key, value) => { runtimeStore[`${name}.${key}`] = value; return Promise.resolve(); },
}));

vi.mock('../../services/ui/utils.js', () => ({
    default: { guid: () => 'id-' + Math.random().toString(36).slice(2) },
}));

const rollExpression = vi.fn(() => ({ total: 32, rolls: [4, 4, 4, 4, 4, 4, 4, 4], modifier: 0 }));
vi.mock('../../services/dice/diceRoller.js', () => ({
    rollExpression: (...args) => rollExpression(...args),
}));

let pendingSaveResolve = null;
vi.mock('../../services/automation/common/savePrompt.js', () => ({
    createSaveListener: () => {
        const promise = new Promise((resolve) => { pendingSaveResolve = resolve; });
        return { promise };
    },
}));

vi.mock('../../services/ui/logService.js', () => ({
    addEntry: (_campaign, entry) => { addEntryLogs.push(entry); return Promise.resolve(); },
}));

vi.mock('../../services/encounters/combatData.js', () => ({
    loadCombatSummary: async () => ({ creatures: [], activeCreatureName: 'Beholder 1' }),
    getCurrentCombatRound: () => 1,
    getCombatSummary: () => null,
}));

const applyDamageToTarget = vi.fn(async (_cs, _target, finalDamage) => ({ finalDamage, newHp: 60 - finalDamage }));
vi.mock('../../services/rules/combat/applyDamage.js', () => ({
    normalizeSaveType: (t) => String(t || '').toUpperCase(),
    computeDamageAfterSave: (raw, success, dcSuccess) => (!success ? raw : dcSuccess === 'half' ? Math.floor(raw / 2) : 0),
    computeDamageAfterEvasion: (total, saveSuccess, dcSuccess, evasionActive) =>
        (evasionActive && dcSuccess === 'half') ? (saveSuccess ? 0 : Math.floor(total / 2))
            : (!saveSuccess ? total : dcSuccess === 'half' ? Math.floor(total / 2) : 0),
    applyDamageToTarget: (...args) => applyDamageToTarget(...args),
}));

vi.mock('../../services/automation/handlers/buffs/circleOfPowerHandler.js', () => ({
    isCircleOfPowerActive: () => false,
}));

vi.mock('../../services/combat/automation/automationService.js', () => ({
    hasIgnoreResistance: () => false,
    playerIsImmuneToCondition: () => false,
}));

vi.mock('../../services/rules/effects/expirationQueue.js', () => ({
    addExpiration: vi.fn(),
}));

const applyEyeRayFailedGrants = vi.fn(async () => {});
vi.mock('../../services/rules/features/beholderEyeRayService.js', () => ({
    applyEyeRayFailedGrants: (...args) => applyEyeRayFailedGrants(...args),
}));

import { processSaveRoll } from './saveProcessing.js';

const campaignName = 'test-campaign';
const T = 'HexWarlock';

const list = Array.isArray(monsters) ? monsters : monsters.monsters;
// The authored Eye Rays row for a monster (rays[] + row save_dc), exactly the
// shape MonsterCardHelpers.buildEyeRayAction synthesizes the save context from.
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

const BH = 'Beholder 1';
const BH_ROW = rayRow('Beholder');            // d10 table, DC 16
const ZOMBIE_ROW = rayRow('Beholder Zombie'); // d4 table, DC 14

// Save context as the monster-card seam builds it: row DC stamped onto the ray,
// one save_type, one dice formula, one dc_success.
function rayContext(row, ray) {
    return {
        saveDc: row.save_dc,
        saveType: ray.save_ability,
        attackerName: BH,
        actionName: `${ray.name} (Eye Rays)`,
        dcSuccess: ray.dc_success,
        autoDamageFormula: ray.damage_dice ?? null,
        autoDamageDamageType: ray.damage_type ?? null,
        saveConditions: ray.conditions ?? [],
        eyeRay: { ...ray, save_dc: row.save_dc },
    };
}

async function resolveSave(context, success, roll) {
    const promise = processSaveRoll({
        rollType: 'save',
        target: { name: T, type: 'player' },
        characterName: T,
        campaignName,
        context,
        logEntry: vi.fn(),
        setPopupHtml: vi.fn(),
    });
    pendingSaveResolve({ success, roll, total: roll, saveBonus: 0, rawRolls: [], mode: 'normal' });
    await promise;
}

function zeroHpAdvisories() {
    return addEntryLogs.filter(e => e.automationType === 'eye_ray_zero_hp_advisory');
}

beforeEach(() => {
    vi.clearAllMocks();
    for (const k of Object.keys(runtimeStore)) delete runtimeStore[k];
    addEntryLogs.length = 0;
    applyDamageToTarget.mockImplementation(async (_cs, _target, finalDamage) => ({ finalDamage, newHp: 60 - finalDamage }));
});

describe('saveProcessing Eye Rays dispatcher (MA-0374 Beholder / MA-0383 Zombie)', () => {
    it('failed save delegates the picked ray grant once, full damage on the fail leg', async () => {
        await resolveSave(rayContext(BH_ROW, pickRay(BH_ROW, 'slowing')), false, 5);
        expect(applyEyeRayFailedGrants).toHaveBeenCalledTimes(1);
        expect(applyEyeRayFailedGrants.mock.calls[0][0]).toMatchObject({
            campaignName,
            attackerName: BH,
            targetName: T,
            ray: { key: 'slowing', save_dc: BH_ROW.save_dc, te_grants: ['speed_half', 'no_reactions', 'no_action_and_bonus_action'] },
        });
        expect(applyDamageToTarget.mock.calls[0][2]).toBe(32);
    });

    it('Beholder Zombie d4 row rides the identical dispatcher: grant + Poisoned condition, DC 14', async () => {
        await resolveSave(rayContext(ZOMBIE_ROW, pickRay(ZOMBIE_ROW, 'enervation')), false, 5);
        expect(applyEyeRayFailedGrants).toHaveBeenCalledTimes(1);
        expect(applyEyeRayFailedGrants.mock.calls[0][0].ray).toMatchObject({ key: 'enervation', te_grants: ['no_healing'], save_dc: ZOMBIE_ROW.save_dc });
        expect(runtimeStore[`${T}.activeConditions`]).toContain('poisoned');
        expect(applyDamageToTarget.mock.calls[0][2]).toBe(32);
    });

    it('successful save: no grant leg, half damage (dc_success:half)', async () => {
        await resolveSave(rayContext(BH_ROW, pickRay(BH_ROW, 'slowing')), true, 20);
        expect(applyEyeRayFailedGrants).not.toHaveBeenCalled();
        expect(applyDamageToTarget.mock.calls[0][2]).toBe(16);
    });

    it('damageless rays roll no dice but still delegate the grant — Restrained and the Zombie Paralyzed ladder', async () => {
        await resolveSave(rayContext(BH_ROW, pickRay(BH_ROW, 'telekinetic')), false, 4);
        expect(applyDamageToTarget).not.toHaveBeenCalled();
        expect(applyEyeRayFailedGrants).toHaveBeenCalledTimes(1);
        expect(runtimeStore[`${T}.activeConditions`]).toContain('restrained');

        applyEyeRayFailedGrants.mock.calls.length = 0;
        await resolveSave(rayContext(ZOMBIE_ROW, pickRay(ZOMBIE_ROW, 'paralyzing')), false, 2);
        expect(applyDamageToTarget).not.toHaveBeenCalled();
        expect(applyEyeRayFailedGrants).toHaveBeenCalledTimes(1);
        expect(applyEyeRayFailedGrants.mock.calls[0][0].ray).toMatchObject({ ladder: 'paralyzed', save_dc: ZOMBIE_ROW.save_dc });
    });

    it('zero_hp_clause rays log the eye_ray_zero_hp_advisory on EITHER outcome', async () => {
        applyDamageToTarget.mockImplementation(async (_cs, _target, finalDamage) => ({ finalDamage, newHp: 0 }));
        const clauseRays = [
            [BH_ROW, pickRay(BH_ROW, 'death')],
            [ZOMBIE_ROW, pickRay(ZOMBIE_ROW, 'disintegration')],
        ];
        expect(clauseRays.map(([, r]) => r.zero_hp_clause)).toEqual(['dies', 'disintegrates into dust']);
        for (const [row, ray] of clauseRays) {
            for (const success of [false, true]) {
                addEntryLogs.length = 0;
                await resolveSave(rayContext(row, ray), success, success ? 20 : 3);
                const adv = zeroHpAdvisories();
                expect(adv.length).toBeGreaterThan(0);
                expect(adv[0].characterName).toBe(T);
                expect(adv[0].description).toContain(ray.zero_hp_clause);
            }
        }
    });

    it('byte-inert without context.eyeRay: no grant call, no advisory even at 0 HP', async () => {
        applyDamageToTarget.mockImplementation(async (_cs, _target, finalDamage) => ({ finalDamage, newHp: 0 }));
        const claw = { saveDc: BH_ROW.save_dc, saveType: 'Dexterity', attackerName: BH, actionName: 'Claw', dcSuccess: 'half', autoDamageFormula: '2d6', autoDamageDamageType: 'Slashing', saveConditions: [] };
        await resolveSave(claw, false, 3);
        expect(applyEyeRayFailedGrants).not.toHaveBeenCalled();
        expect(zeroHpAdvisories()).toHaveLength(0);
    });
});
