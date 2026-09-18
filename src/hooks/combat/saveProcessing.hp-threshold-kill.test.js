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

const rollExpression = vi.fn(() => ({ total: 10, rolls: [2, 2, 6], modifier: 0 }));
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
    addEntry: (campaignName, entry) => { addEntryLogs.push(entry); return Promise.resolve(); },
}));

const combatSummary = { creatures: [], activeCreatureName: 'Banshee 1' };
vi.mock('../../services/encounters/combatData.js', () => ({
    loadCombatSummary: async () => combatSummary,
    getCurrentCombatRound: () => 1,
    getCombatSummary: () => null,
}));

const applyDamageToTarget = vi.fn(async (_cs, _target, damage) => ({ finalDamage: damage, newHp: 0 }));
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

import { processSaveRoll } from './saveProcessing.js';

const campaignName = 'test-campaign';
const BANSHEE = 'Banshee 1';
const TARGET = 'LightfootHalfling';

// MA-0352 Banshee Deathly Wail (monsters.json row shape, fixed).
const wailContext = {
    saveDc: 13,
    saveType: 'Constitution',
    attackerName: BANSHEE,
    actionName: 'Deathly Wail (1/Day)',
    dcSuccess: 'none',
    autoDamageFormula: '3d6',
    autoDamageDamageType: 'Psychic',
    saveConditions: [],
    hpThresholdKill: 25,
};

async function resolveSave(context, success, roll) {
    const promise = processSaveRoll({
        rollType: 'save',
        target: { name: TARGET, type: 'player' },
        characterName: TARGET,
        campaignName,
        context,
        logEntry: vi.fn(),
        setPopupHtml: vi.fn(),
    });
    pendingSaveResolve({ success, roll, total: roll, saveBonus: 0, rawRolls: [], mode: 'normal' });
    return await promise;
}

async function resolveSaveCapturePopup(context, success, roll) {
    let popup = null;
    const promise = processSaveRoll({
        rollType: 'save',
        target: { name: TARGET, type: 'player' },
        characterName: TARGET,
        campaignName,
        context,
        logEntry: vi.fn(),
        setPopupHtml: (data) => { popup = data; },
    });
    pendingSaveResolve({ success, roll, total: roll, saveBonus: 0, rawRolls: [], mode: 'normal' });
    await promise;
    return popup;
}

beforeEach(() => {
    vi.clearAllMocks();
    for (const k of Object.keys(runtimeStore)) delete runtimeStore[k];
    addEntryLogs.length = 0;
    combatSummary.creatures = [{ name: TARGET, type: 'player', currentHp: 20, maxHp: 20 }];
});

describe('MA-0352 Deathly Wail HP-threshold kill seam', () => {
    it('failed save, victim 20 HP (≤25): drops to 0, clause logged, normal 3d6 damage skipped', async () => {
        runtimeStore[`${TARGET}.currentHitPoints`] = 20;
        await resolveSave({ ...wailContext }, false, 4);

        expect(applyDamageToTarget).toHaveBeenCalledTimes(1);
        expect(applyDamageToTarget.mock.calls[0][2]).toBe(20);
        expect(applyDamageToTarget.mock.calls[0][4]).toMatchObject({ ignoreResistance: true, attackerName: BANSHEE });
        expect(rollExpression).not.toHaveBeenCalled();

        const kill = addEntryLogs.find(e => e.automationType === 'hp_threshold_kill');
        expect(kill).toBeTruthy();
        expect(kill.characterName).toBe(TARGET);
        expect(kill.sourceName).toBe(BANSHEE);
        expect(kill.description).toMatch(/20 Hit Points \(20 ≤ 25\).*drops to 0 Hit Points/s);

        expect(runtimeStore[`${TARGET}.lastSaveRoll`]).toBeTruthy();
    });

    it('failed save, victim 30 HP (>25): full 3d6 through the normal damage leg, no threshold clause', async () => {
        combatSummary.creatures = [{ name: TARGET, type: 'player', currentHp: 30, maxHp: 30 }];
        runtimeStore[`${TARGET}.currentHitPoints`] = 30;
        await resolveSave({ ...wailContext }, false, 4);

        expect(applyDamageToTarget).toHaveBeenCalledTimes(1);
        expect(applyDamageToTarget.mock.calls[0][2]).toBe(10);
        expect(rollExpression).toHaveBeenCalledWith('3d6');
        expect(addEntryLogs.some(e => e.automationType === 'hp_threshold_kill')).toBe(false);
    });

    it('successful save at 20 HP: ZERO damage, no threshold kill (dc_success none, success never kills)', async () => {
        runtimeStore[`${TARGET}.currentHitPoints`] = 20;
        const popup = await resolveSaveCapturePopup({ ...wailContext }, true, 17);

        expect(applyDamageToTarget).toHaveBeenCalledTimes(1);
        expect(applyDamageToTarget.mock.calls[0][2]).toBe(0);
        expect(addEntryLogs.some(e => e.automationType === 'hp_threshold_kill')).toBe(false);
        expect(popup?.dcSuccess).toBe('none');
    });

    it('already-dead victim (0 HP): threshold branch no-ops, normal damage leg proceeds', async () => {
        combatSummary.creatures = [{ name: TARGET, type: 'player', currentHp: 0, maxHp: 20 }];
        runtimeStore[`${TARGET}.currentHitPoints`] = 0;
        await resolveSave({ ...wailContext }, false, 2);

        expect(addEntryLogs.some(e => e.automationType === 'hp_threshold_kill')).toBe(false);
        expect(applyDamageToTarget).toHaveBeenCalledTimes(1);
        expect(rollExpression).toHaveBeenCalledWith('3d6');
    });

    it('monster victim via cs.currentHp: failed save at 10 HP ≤25 → lethal clamp + clause log', async () => {
        combatSummary.creatures = [{ name: 'Thug 1', type: 'npc', currentHp: 10, maxHp: 32 }];
        const promise = processSaveRoll({
            rollType: 'save',
            target: { name: 'Thug 1', type: 'npc' },
            characterName: 'Thug 1',
            campaignName,
            context: { ...wailContext },
            bonus: 0,
            r1: 3,
            r2: 3,
            effectiveD20: 3,
            logEntry: vi.fn(),
            setPopupHtml: vi.fn(),
        });
        await promise;

        expect(applyDamageToTarget).toHaveBeenCalledTimes(1);
        expect(applyDamageToTarget.mock.calls[0][2]).toBe(10);
        expect(rollExpression).not.toHaveBeenCalled();
        expect(addEntryLogs.some(e => e.automationType === 'hp_threshold_kill')).toBe(true);
    });

    it('rows without the authored key are byte-inert: failed save takes normal 3d6, no clause log', async () => {
        runtimeStore[`${TARGET}.currentHitPoints`] = 20;
        await resolveSave({ ...wailContext, hpThresholdKill: null, actionName: 'Horrify' }, false, 4);

        expect(applyDamageToTarget).toHaveBeenCalledTimes(1);
        expect(applyDamageToTarget.mock.calls[0][2]).toBe(10);
        expect(addEntryLogs.some(e => e.automationType === 'hp_threshold_kill')).toBe(false);
    });

    it('threshold-kill popup carries thresholdKill note and zero damage', async () => {
        runtimeStore[`${TARGET}.currentHitPoints`] = 20;
        const popup = await resolveSaveCapturePopup({ ...wailContext }, false, 4);

        expect(popup?.thresholdKill).toBe(true);
        expect(popup?.finalDamage).toBe(0);
        expect(popup?.targetCurrentHp).toBe(0);
        expect(popup?.thresholdNote).toMatch(/Drops to 0 Hit Points/);
    });
});
