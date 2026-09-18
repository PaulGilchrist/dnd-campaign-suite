// MA-0427: Brazen Gorgon Smelting Charge save row carries
// damage_dice_secondary "3d8" Fire alongside damage_dice_primary "2d8 + 4"
// Piercing. The SAVE path adjudicates BOTH legs: failure = full + full,
// success = half + half (each leg floored independently via the same
// computeDamageAfterEvasion dc_success semantics as the primary), each leg
// its own save-damage log entry + its own applyDamageToTarget pass. Rows
// WITHOUT a secondary stay byte-identical (single entry, no popup keys).
import { describe, it, expect, vi, beforeEach } from 'vitest';

const runtimeStore = {};

vi.mock('../runtime/useRuntimeState.js', () => ({
    getRuntimeValue: (name, key) => runtimeStore[`${name}.${key}`],
    setRuntimeValue: (name, key, value) => { runtimeStore[`${name}.${key}`] = value; return Promise.resolve(); },
}));

vi.mock('../../services/ui/utils.js', () => ({
    default: { guid: () => 'id-' + Math.random().toString(36).slice(2) },
}));

const rollExpression = vi.fn((formula) => {
    if (formula === '2d8 + 4') return { total: 15, rolls: [8, 3], modifier: 4 };
    if (formula === '3d8') return { total: 13, rolls: [4, 5, 4], modifier: 0 };
    return null;
});
vi.mock('../../services/dice/diceRoller.js', () => ({
    rollExpression: (...args) => rollExpression(...args),
}));

let pendingSaveResolve = null;
const listenerConfigs = [];
vi.mock('../../services/automation/common/savePrompt.js', () => ({
    createSaveListener: (_campaignName, config) => {
        listenerConfigs.push(config);
        const promise = new Promise((resolve) => { pendingSaveResolve = resolve; });
        return { promise };
    },
}));

vi.mock('../../services/ui/logService.js', () => ({
    addEntry: () => Promise.resolve(),
}));

vi.mock('../../services/encounters/combatData.js', () => ({
    loadCombatSummary: async () => ({ creatures: [{ name: 'HexWarlock', type: 'player', currentHp: 69 }], activeCreatureName: 'Brazen Gorgon 1' }),
}));

const hpState = { hp: 69 };
const damageCalls = [];
vi.mock('../../services/rules/combat/applyDamage.js', () => ({
    normalizeSaveType: (t) => String(t || '').toUpperCase(),
    computeDamageAfterEvasion: (raw, saveSuccess, dcSuccess, evasionActive) => {
        if (evasionActive && dcSuccess === 'half') return saveSuccess ? 0 : Math.floor(raw / 2);
        if (!saveSuccess) return raw;
        if (dcSuccess === 'half') return Math.floor(raw / 2);
        if (dcSuccess === 'full') return raw;
        return 0;
    },
    applyDamageToTarget: async (_cs, _target, damage, damageTypes) => {
        damageCalls.push({ damage, damageTypes: [...(damageTypes || [])] });
        hpState.hp -= damage;
        return { finalDamage: damage, newHp: hpState.hp };
    },
}));

vi.mock('../../services/automation/handlers/buffs/circleOfPowerHandler.js', () => ({
    isCircleOfPowerActive: () => false,
}));

vi.mock('../../services/combat/automation/automationService.js', () => ({
    hasIgnoreResistance: () => false,
    playerIsImmuneToCondition: () => false,
}));

import { processSaveRoll } from './saveProcessing.js';

const campaignName = 'test-campaign';

const dualContext = {
    saveDc: 16,
    saveType: 'DEX',
    dcSuccess: 'half',
    attackerName: 'Brazen Gorgon 1',
    actionName: 'Smelting Charge',
    autoDamageFormula: '2d8 + 4',
    autoDamageDamageType: 'Piercing',
    autoDamageName: 'Smelting Charge',
    autoDamageSecondaryFormula: '3d8',
    autoDamageSecondaryName: 'Smelting Charge',
    autoDamageSecondaryDamageType: 'Fire',
    saveConditions: ['grappled', 'restrained'],
};

const gmLog = [];
const logEntry = (e) => gmLog.push(e);
let popup = null;
const setPopupHtml = (p) => { popup = p; };

beforeEach(() => {
    vi.clearAllMocks();
    for (const k of Object.keys(runtimeStore)) delete runtimeStore[k];
    gmLog.length = 0;
    damageCalls.length = 0;
    listenerConfigs.length = 0;
    hpState.hp = 69;
    popup = null;
});

function runDualSave(saveSuccess) {
    const promise = processSaveRoll({
        rollType: 'save',
        target: { name: 'HexWarlock', type: 'player' },
        characterName: 'HexWarlock',
        campaignName,
        context: { ...dualContext },
        logEntry,
        setPopupHtml,
    });
    pendingSaveResolve({
        success: saveSuccess,
        roll: saveSuccess ? 19 : 15,
        total: saveSuccess ? 18 : 14,
        saveBonus: -1,
        rawRolls: [],
        mode: 'normal',
    });
    return promise;
}

function saveDamageEntries() {
    return gmLog.filter(e => e.rollType === 'save-damage');
}

function singleDamageContext() {
    const ctx = { ...dualContext };
    delete ctx.autoDamageSecondaryFormula;
    delete ctx.autoDamageSecondaryName;
    delete ctx.autoDamageSecondaryDamageType;
    return ctx;
}

describe('MA-0427 save-path secondary damage', () => {
    it('SAVE FAILURE: TWO full save-damage entries (2d8+4 Piercing + 3d8 Fire), hp delta = sum', async () => {
        await runDualSave(false);

        const entries = saveDamageEntries();
        expect(entries).toHaveLength(2);
        expect(entries[0]).toMatchObject({ rollType: 'save-damage', formula: '2d8 + 4', damageType: 'Piercing', total: 15, finalDamage: 15, saveSuccess: false, name: 'Smelting Charge', targetName: 'HexWarlock' });
        expect(entries[1]).toMatchObject({ rollType: 'save-damage', formula: '3d8', damageType: 'Fire', total: 13, finalDamage: 13, saveSuccess: false, name: 'Smelting Charge', targetName: 'HexWarlock' });

        expect(damageCalls).toEqual([
            { damage: 15, damageTypes: ['Piercing'] },
            { damage: 13, damageTypes: ['Fire'] },
        ]);
        expect(hpState.hp).toBe(69 - 28);

        expect(popup).toMatchObject({ type: 'save-damage', formula: '2d8 + 4', secondaryFormula: '3d8', secondaryDamageType: 'Fire', secondaryTotal: 13, secondaryFinalDamage: 13, finalDamage: 15, targetCurrentHp: 41 });
    });

    it('SAVE SUCCESS: both legs halved with independent floors (7 + 6)', async () => {
        await runDualSave(true);

        const entries = saveDamageEntries();
        expect(entries).toHaveLength(2);
        expect(entries[0]).toMatchObject({ formula: '2d8 + 4', total: 7, finalDamage: 7, saveSuccess: true });
        expect(entries[1]).toMatchObject({ formula: '3d8', total: 6, finalDamage: 6, saveSuccess: true });

        expect(damageCalls).toEqual([
            { damage: 7, damageTypes: ['Piercing'] },
            { damage: 6, damageTypes: ['Fire'] },
        ]);
        expect(hpState.hp).toBe(69 - 13);
    });

    it('row WITHOUT secondary: exactly ONE save-damage entry, popup carries no secondary keys', async () => {
        const promise = processSaveRoll({
            rollType: 'save',
            target: { name: 'HexWarlock', type: 'player' },
            characterName: 'HexWarlock',
            campaignName,
            context: singleDamageContext(),
            logEntry,
            setPopupHtml,
        });
        pendingSaveResolve({ success: false, roll: 15, total: 14, saveBonus: -1, rawRolls: [], mode: 'normal' });
        await promise;

        const entries = saveDamageEntries();
        expect(entries).toHaveLength(1);
        expect(entries[0]).toMatchObject({ formula: '2d8 + 4', damageType: 'Piercing', total: 15, finalDamage: 15 });
        expect(damageCalls).toEqual([{ damage: 15, damageTypes: ['Piercing'] }]);
        expect(popup.secondaryFormula).toBeUndefined();
        expect(popup.secondaryFinalDamage).toBeUndefined();
    });

    it('prompt config: dual rows transport BOTH formulas to the save prompt; single rows stay null', async () => {
        await runDualSave(false);
        expect(listenerConfigs[0]).toMatchObject({
            damageFormula: '2d8 + 4',
            damageType: 'Piercing',
            secondaryFormula: '3d8',
            secondaryDamageType: 'Fire',
        });

        const promise = processSaveRoll({
            rollType: 'save',
            target: { name: 'HexWarlock', type: 'player' },
            characterName: 'HexWarlock',
            campaignName,
            context: singleDamageContext(),
            logEntry,
            setPopupHtml,
        });
        pendingSaveResolve({ success: true, roll: 19, total: 18, saveBonus: -1, rawRolls: [], mode: 'normal' });
        await promise;

        expect(listenerConfigs[1]).toMatchObject({ damageFormula: null, damageType: null, secondaryFormula: null, secondaryDamageType: null });
    });
});
