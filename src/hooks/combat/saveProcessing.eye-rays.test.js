// MA-0374: saveProcessing dispatcher arms — failed-save Eye Ray grant hook
// (delegated to beholderEyeRayService) and the Disintegration/Death Ray
// 0-HP advisory record. Byte-inert for rows without context.eyeRay.
import { describe, it, expect, vi, beforeEach } from 'vitest';

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
const BH = 'Beholder 1';
const T = 'HexWarlock';

const slowingRay = { key: 'slowing', name: 'Slowing Ray', save_ability: 'Constitution', damage_dice: '4d8', damage_type: 'Necrotic', dc_success: 'half', conditions: [], te_grants: ['speed_half', 'no_reactions', 'no_action_and_bonus_action'], clock_rounds: 2 };
const deathRay = { key: 'death', name: 'Death Ray', save_ability: 'Dexterity', damage_dice: '10d10', damage_type: 'Necrotic', dc_success: 'half', conditions: [], zero_hp_clause: 'dies' };

function rayContext(ray, over = {}) {
    return {
        saveDc: 16,
        saveType: ray.save_ability,
        attackerName: BH,
        actionName: `${ray.name} (Eye Rays)`,
        dcSuccess: ray.dc_success,
        autoDamageFormula: ray.damage_dice || null,
        autoDamageDamageType: ray.damage_type || null,
        saveConditions: ray.conditions || [],
        eyeRay: ray,
        ...over,
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

beforeEach(() => {
    vi.clearAllMocks();
    for (const k of Object.keys(runtimeStore)) delete runtimeStore[k];
    addEntryLogs.length = 0;
    applyDamageToTarget.mockImplementation(async (_cs, _target, finalDamage) => ({ finalDamage, newHp: 60 - finalDamage }));
});

describe('MA-0374 saveProcessing Eye Rays dispatcher', () => {
    it('failed save delegates the ray grant spec once, full damage on the fail leg', async () => {
        await resolveSave(rayContext(slowingRay), false, 5);
        expect(applyEyeRayFailedGrants).toHaveBeenCalledTimes(1);
        expect(applyEyeRayFailedGrants.mock.calls[0][0]).toMatchObject({ campaignName, attackerName: BH, targetName: T, ray: slowingRay });
        expect(applyDamageToTarget.mock.calls[0][2]).toBe(32);
    });

    it('successful save: no grant leg, half damage (dc_success:half)', async () => {
        await resolveSave(rayContext(slowingRay), true, 20);
        expect(applyEyeRayFailedGrants).not.toHaveBeenCalled();
        expect(applyDamageToTarget.mock.calls[0][2]).toBe(16);
    });

    it('fear ray: standard condition leg lands Frightened on the fail', async () => {
        const fear = { key: 'fear', name: 'Fear Ray', save_ability: 'Wisdom', damage_dice: '4d6', damage_type: 'Psychic', dc_success: 'half', conditions: ['frightened'], clock_rounds: 2 };
        await resolveSave(rayContext(fear), false, 6);
        expect(runtimeStore[`${T}.activeConditions`]).toContain('frightened');
        expect(addEntryLogs.some(e => e.type === 'condition' && e.action === 'applied' && e.condition === 'Frightened')).toBe(true);
    });

    it('damageless telekinetic ray: Restrained lands with no damage rolled', async () => {
        const tk = { key: 'telekinetic', name: 'Telekinetic Ray', save_ability: 'Strength', damage_dice: null, damage_type: null, dc_success: 'none', conditions: ['restrained'], te_grants: ['telekinetic_movement'], clock_rounds: 2 };
        await resolveSave(rayContext(tk), false, 4);
        expect(applyDamageToTarget).not.toHaveBeenCalled();
        expect(runtimeStore[`${T}.activeConditions`]).toContain('restrained');
        expect(applyEyeRayFailedGrants).toHaveBeenCalledTimes(1);
    });

    it('death ray at 0 HP: eye_ray_zero_hp_advisory named record on EITHER outcome', async () => {
        applyDamageToTarget.mockImplementation(async (_cs, _target, finalDamage) => ({ finalDamage, newHp: 0 }));
        await resolveSave(rayContext(deathRay), false, 2);
        const adv = addEntryLogs.find(e => e.automationType === 'eye_ray_zero_hp_advisory');
        expect(adv).toBeTruthy();
        expect(adv.characterName).toBe(T);
        expect(adv.description).toMatch(/dies \(GM-enforced/);

        addEntryLogs.length = 0;
        await resolveSave(rayContext(deathRay), true, 20);
        expect(addEntryLogs.some(e => e.automationType === 'eye_ray_zero_hp_advisory')).toBe(true);
    });

    it('byte-inert without context.eyeRay: no grant call, no advisory even at 0 HP', async () => {
        applyDamageToTarget.mockImplementation(async (_cs, _target, finalDamage) => ({ finalDamage, newHp: 0 }));
        const claw = { saveDc: 16, saveType: 'Dexterity', attackerName: BH, actionName: 'Claw', dcSuccess: 'half', autoDamageFormula: '2d6', autoDamageDamageType: 'Slashing', saveConditions: [] };
        await resolveSave(claw, false, 3);
        expect(applyEyeRayFailedGrants).not.toHaveBeenCalled();
        expect(addEntryLogs.some(e => e.automationType === 'eye_ray_zero_hp_advisory')).toBe(false);
    });
});

// ── MA-0383: Beholder Zombie rays ride the identical dispatcher (d4 row) ──
describe('MA-0383 saveProcessing Beholder Zombie legs', () => {
    const zEnervation = { key: 'enervation', name: 'Enervation Ray', save_ability: 'Constitution', save_dc: 14, damage_dice: '3d6', damage_type: 'Necrotic', dc_success: 'half', conditions: ['poisoned'], te_grants: ['no_healing'], clock_rounds: 2 };
    const zParalyzing = { key: 'paralyzing', name: 'Paralyzing Ray', save_ability: 'Constitution', save_dc: 14, damage_dice: null, damage_type: null, dc_success: 'none', conditions: [], ladder: 'paralyzed' };
    const zDisintegration = { key: 'disintegration', name: 'Disintegration Ray', save_ability: 'Dexterity', save_dc: 14, damage_dice: '5d10', damage_type: 'Force', dc_success: 'half', conditions: [], zero_hp_clause: 'disintegrates into dust' };

    it('enervation fail: full 3d6-equivalent damage, Poisoned condition + no_healing grant delegated', async () => {
        await resolveSave(rayContext(zEnervation, { saveDc: 14 }), false, 5);
        expect(applyEyeRayFailedGrants).toHaveBeenCalledTimes(1);
        expect(applyEyeRayFailedGrants.mock.calls[0][0].ray).toMatchObject({ key: 'enervation', te_grants: ['no_healing'], save_dc: 14 });
        expect(runtimeStore[`${T}.activeConditions`]).toContain('poisoned');
        expect(applyDamageToTarget.mock.calls[0][2]).toBe(32);
    });

    it('paralyzing fail: ladder delegated once with DC 14, zero damage rolled', async () => {
        await resolveSave(rayContext(zParalyzing, { saveDc: 14 }), false, 2);
        expect(applyEyeRayFailedGrants).toHaveBeenCalledTimes(1);
        expect(applyEyeRayFailedGrants.mock.calls[0][0].ray).toMatchObject({ ladder: 'paralyzed', save_dc: 14 });
        expect(applyDamageToTarget).not.toHaveBeenCalled();
    });

    it('disintegration at 0 HP: dust advisory on EITHER outcome, half damage on success', async () => {
        applyDamageToTarget.mockImplementation(async (_cs, _target, finalDamage) => ({ finalDamage, newHp: 0 }));
        await resolveSave(rayContext(zDisintegration, { saveDc: 14 }), true, 20);
        expect(applyDamageToTarget.mock.calls[0][2]).toBe(16);
        const adv = addEntryLogs.find(e => e.automationType === 'eye_ray_zero_hp_advisory');
        expect(adv).toBeTruthy();
        expect(adv.description).toMatch(/disintegrates into dust \(GM-enforced/);

        addEntryLogs.length = 0;
        applyDamageToTarget.mock.calls.length = 0;
        await resolveSave(rayContext(zDisintegration, { saveDc: 14 }), false, 3);
        expect(addEntryLogs.some(e => e.automationType === 'eye_ray_zero_hp_advisory')).toBe(true);
        expect(applyDamageToTarget.mock.calls[0][2]).toBe(32);
    });
});
