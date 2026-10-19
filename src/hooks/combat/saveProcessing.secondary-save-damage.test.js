// @maintained-by-ai
// MA-0427 save-path SECONDARY damage lane (saveProcessing.js applySecondarySaveDamageLeg,
// :1436). Fixture is the authored Brazen Gorgon "Smelting Charge" row (monsters.json:
// DEX save DC 16, damage_dice_primary "2d8 + 4" Piercing PLUS damage_dice_secondary
// "3d8" Fire). This file owns, and only this:
//   - dual row: failure = full + full, success = half + half with EACH leg floored
//     INDEPENDENTLY; each leg its own roll, its own save-damage log entry, and its
//     own applyDamageToTarget pass carrying its own damage type;
//   - prompt transport (MA-0427): dual rows surface BOTH formulas; single rows keep
//     every damage field null exactly as before;
//   - single rows byte-inert: ONE entry, ONE apply, no secondary* popup keys at all;
//   - unparseable secondary: nothing rolls past rollExpression-null — console.error
//     routes the leg to GM adjudication, primary leg untouched (#882 honesty).
// Family map: cla034 owns saveConditions prompt threading; failed-save-conditions owns
// the generic grant lane (saveConditions here transport only); #847 owns the roll-prompt
// seam; #871 owns save-result counters; evasion halving internals belong to
// computeDamageAfterEvasion's owners (applyDamage.helpers / save-full) — applyDamage is
// mocked per family convention with byte-faithful copies of its arithmetic, so the
// HP/popup ledger observed here is ORDER + TYPING + RAW-vs-FINAL plumbing, not halves.
// Twins adjudicated: handlers/handlePlainDamage.secondaryDamage.test.js owns the
// ATTACK-path plain-damage twin; DiceRollResult.secondaryDamage.test.jsx owns the
// RENDER of these popup fields — no overlap with this save-adjudication lane.
// Old→new map: old test 1 (failure) + old test 2 (success) + old test 4 dual-prompt →
// folded it.each rows; old test 3 (single row) + old test 4 single-prompt → one
// byte-inert test; NEW: unparseable-secondary GM-adjudicate branch (source :1442).
import { describe, it, expect, vi, beforeEach } from 'vitest';

const runtimeStore = {};

vi.mock('../runtime/useRuntimeState.js', () => ({
    getRuntimeValue: (name, key) => runtimeStore[`${name}.${key}`],
    setRuntimeValue: (name, key, value) => { runtimeStore[`${name}.${key}`] = value; return Promise.resolve(); },
}));

vi.mock('../../services/ui/utils.js', () => ({
    default: { guid: () => 'id-' + Math.random().toString(36).slice(2) },
}));

// ONLY the two authored formulas roll; anything else returns null honestly —
// the unparseable-secondary test leans on this exact behaviour.
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

// HP ledger tracked in the apply mock so popup.targetCurrentHp is observably
// AFTER-BOTH-LEGS (and after-primary for single rows). computeDamageAfterSave /
// computeDamageAfterEvasion are byte-faithful copies — owners: applyDamage.helpers.test.js.
const hpState = { hp: 69 };
const damageCalls = [];
vi.mock('../../services/rules/combat/applyDamage.js', () => {
    const computeDamageAfterSave = (raw, saveSuccess, dcSuccess) => {
        if (!saveSuccess) return raw;
        if (dcSuccess === 'half') return Math.floor(raw / 2);
        if (dcSuccess === 'full') return raw;
        return 0;
    };
    return {
        normalizeSaveType: (t) => String(t || '').toUpperCase(),
        computeDamageAfterSave,
        computeDamageAfterEvasion: (raw, saveSuccess, dcSuccess, evasionActive) => (
            evasionActive && dcSuccess === 'half'
                ? (saveSuccess ? 0 : Math.floor(raw / 2))
                : computeDamageAfterSave(raw, saveSuccess, dcSuccess)
        ),
        applyDamageToTarget: async (_cs, _target, damage, damageTypes) => {
            damageCalls.push({ damage, damageTypes: [...(damageTypes || [])] });
            hpState.hp -= damage;
            return { finalDamage: damage, newHp: hpState.hp };
        },
    };
});

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

function resolveSave(context, saveSuccess) {
    const promise = processSaveRoll({
        rollType: 'save',
        target: { name: 'HexWarlock', type: 'player' },
        characterName: 'HexWarlock',
        campaignName,
        context,
        logEntry,
        setPopupHtml,
    });
    const roll = saveSuccess ? 19 : 15; // saveBonus -1: total 18 ≥ DC 16 / 14 < 16
    pendingSaveResolve({ success: saveSuccess, roll, total: roll - 1, saveBonus: -1, rawRolls: [], mode: 'normal' });
    return promise;
}

function saveDamageEntries() {
    return gmLog.filter(e => e.rollType === 'save-damage');
}

beforeEach(() => {
    vi.clearAllMocks();
    for (const k of Object.keys(runtimeStore)) delete runtimeStore[k];
    gmLog.length = 0;
    damageCalls.length = 0;
    listenerConfigs.length = 0;
    hpState.hp = 69;
    popup = null;
});

describe('MA-0427 save-path secondary damage (Smelting Charge)', () => {
    it.each([
        { label: 'FAILURE', saveSuccess: false, primary: 15, secondary: 13 },
        // halves floored INDEPENDENTLY: floor(15/2)=7, floor(13/2)=6 — not floor(28/2)=14
        { label: 'SUCCESS', saveSuccess: true, primary: 7, secondary: 6 },
    ])('$label: two independent legs (2d8+4 Piercing + 3d8 Fire), prompt carries BOTH formulas', async ({ saveSuccess, primary, secondary }) => {
        await resolveSave(dualContext, saveSuccess);

        expect(listenerConfigs).toHaveLength(1);
        expect(listenerConfigs[0]).toMatchObject({
            damageFormula: '2d8 + 4',
            damageType: 'Piercing',
            secondaryFormula: '3d8',
            secondaryDamageType: 'Fire',
        });

        expect(rollExpression.mock.calls.map(c => c[0])).toEqual(['2d8 + 4', '3d8']);

        const entries = saveDamageEntries();
        expect(entries).toHaveLength(2);
        expect(entries[0]).toMatchObject({ rollType: 'save-damage', characterName: 'Brazen Gorgon 1', name: 'Smelting Charge', targetName: 'HexWarlock', formula: '2d8 + 4', damageType: 'Piercing', total: primary, finalDamage: primary, saveSuccess });
        expect(entries[1]).toMatchObject({ rollType: 'save-damage', characterName: 'Brazen Gorgon 1', name: 'Smelting Charge', targetName: 'HexWarlock', formula: '3d8', damageType: 'Fire', total: secondary, finalDamage: secondary, saveSuccess });

        expect(damageCalls).toEqual([
            { damage: primary, damageTypes: ['Piercing'] },
            { damage: secondary, damageTypes: ['Fire'] },
        ]);
        expect(hpState.hp).toBe(69 - primary - secondary);

        // secondaryTotal stays the RAW dice, secondaryFinalDamage the adjudicated
        // half — they differ exactly when the save succeeds (13 vs 6), and
        // targetCurrentHp is the AFTER-BOTH-LEGS ledger.
        expect(popup).toMatchObject({
            type: 'save-damage',
            formula: '2d8 + 4',
            finalDamage: primary,
            targetCurrentHp: 69 - primary - secondary,
            secondaryFormula: '3d8',
            secondaryRolls: [4, 5, 4],
            secondaryModifier: 0,
            secondaryTotal: 13,
            secondaryFinalDamage: secondary,
            secondaryDamageType: 'Fire',
            secondarySaveResult: { roll: saveSuccess ? 19 : 15, total: saveSuccess ? 18 : 14, success: saveSuccess },
        });
    });

    it('row WITHOUT secondary is byte-inert: one roll, one entry, one apply, null prompt damage fields, zero secondary* popup keys', async () => {
        const singleContext = { ...dualContext };
        delete singleContext.autoDamageSecondaryFormula;
        delete singleContext.autoDamageSecondaryName;
        delete singleContext.autoDamageSecondaryDamageType;
        await resolveSave(singleContext, false);

        expect(listenerConfigs[0]).toMatchObject({ damageFormula: null, damageType: null, secondaryFormula: null, secondaryDamageType: null });
        expect(rollExpression.mock.calls.map(c => c[0])).toEqual(['2d8 + 4']);

        const entries = saveDamageEntries();
        expect(entries).toHaveLength(1);
        expect(entries[0]).toMatchObject({ formula: '2d8 + 4', damageType: 'Piercing', total: 15, finalDamage: 15, saveSuccess: false });
        expect(damageCalls).toEqual([{ damage: 15, damageTypes: ['Piercing'] }]);
        expect(popup.targetCurrentHp).toBe(54);
        expect(Object.keys(popup).filter(k => k.startsWith('secondary'))).toEqual([]);
    });

    it('unparseable secondary formula: secondary leg never applies, console.error routes it to GM, primary untouched', async () => {
        const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        try {
            await resolveSave({ ...dualContext, autoDamageSecondaryFormula: 'bogus(' }, false);

            expect(errSpy).toHaveBeenCalledWith(expect.stringContaining('GM adjudicate'));
            expect(rollExpression.mock.calls.map(c => c[0])).toEqual(['2d8 + 4', 'bogus(']);

            const entries = saveDamageEntries();
            expect(entries).toHaveLength(1);
            expect(entries[0]).toMatchObject({ formula: '2d8 + 4', finalDamage: 15, saveSuccess: false });
            expect(damageCalls).toEqual([{ damage: 15, damageTypes: ['Piercing'] }]);
            expect(popup.targetCurrentHp).toBe(54);
            expect(Object.keys(popup).filter(k => k.startsWith('secondary'))).toEqual([]);
        } finally {
            errSpy.mockRestore();
        }
    });
});
