// CLA-211: the prompt-save lane folds Leading Evasion ONLY on the GM's
// chooser selection. saveResult.evasionActive (dispatched synchronously with
// the save-result event) is preferred; the leadingEvasionSelections stamp is
// the flagless-lane fallback. Regression: submitResultAndClear prunes the
// stamp synchronously after dispatch while processPlayerSave's continuation
// runs later — stamp-only gating would under-grant the ticked sharee.
import { describe, it, expect, vi, beforeEach } from 'vitest';

const runtimeStore = {};

vi.mock('../runtime/useRuntimeState.js', () => ({
    getRuntimeValue: (name, key) => runtimeStore[`${name}.${key}`],
    setRuntimeValue: (name, key, value) => { runtimeStore[`${name}.${key}`] = value; return Promise.resolve(); },
}));

vi.mock('../../services/ui/utils.js', () => ({
    default: { guid: () => 'id-' + Math.random().toString(36).slice(2), getName: (n) => String(n || '').toLowerCase() },
}));

vi.mock('../../services/dice/diceRoller.js', () => ({
    rollExpression: () => ({ total: 32, rolls: [5, 5, 5, 5, 5, 2, 2, 3], modifier: 0 }),
}));

let pendingSaveResolve = null;
vi.mock('../../services/automation/common/savePrompt.js', () => ({
    createSaveListener: () => {
        const promise = new Promise((resolve) => { pendingSaveResolve = resolve; });
        return { promise };
    },
}));

vi.mock('../../services/ui/logService.js', () => ({
    addEntry: () => Promise.resolve(),
}));

vi.mock('../../services/encounters/combatData.js', () => ({
    loadCombatSummary: async () => ({ creatures: [], activeCreatureName: 'Behir 1' }),
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

import { processSaveRoll } from './saveProcessing.js';
import { stampLeadingEvasionSelections, clearLeadingEvasionSelection } from '../../services/rules/combat/evasionUtils.js';

const campaignName = 'test-campaign';
const BH = 'Behir 1';
const T = 'HexWarlock';

const breathContext = {
    saveDc: 16,
    saveType: 'Dexterity',
    attackerName: BH,
    actionName: 'Lightning Breath',
    dcSuccess: 'half',
    autoDamageFormula: '8d6',
    autoDamageDamageType: 'Lightning',
    saveConditions: [],
};

function runSave(detail) {
    const logEntry = vi.fn();
    const promise = processSaveRoll({
        rollType: 'save',
        target: { name: T, type: 'player' },
        characterName: T,
        campaignName,
        context: breathContext,
        logEntry,
        setPopupHtml: vi.fn(),
    });
    return { promise, logEntry, resolve: () => pendingSaveResolve(detail) };
}

beforeEach(() => {
    vi.clearAllMocks();
    for (const k of Object.keys(runtimeStore)) delete runtimeStore[k];
    applyDamageToTarget.mockImplementation(async (_cs, _target, finalDamage) => ({ finalDamage, newHp: 60 - finalDamage }));
});

describe('CLA-211 saveProcessing prompt-save share gating', () => {
    it('ticked sharee folds half damage even when the stamp is pruned before the continuation runs', async () => {
        stampLeadingEvasionSelections(campaignName, [['p1', [T]]]);
        const { promise, logEntry, resolve } = runSave({ success: false, roll: 5, total: 5, saveBonus: 0, rawRolls: [], mode: 'normal', promptId: 'p1', evasionActive: true });
        resolve();
        clearLeadingEvasionSelection(campaignName, 'p1');
        await promise;
        expect(applyDamageToTarget.mock.calls[0][2]).toBe(16);
        expect(logEntry.mock.calls.some(c => c[0].rollType === 'evasion' && c[0].name === 'Leading Evasion')).toBe(true);
    });

    it('unticked sharee pays full damage with no evasion ledger entry', async () => {
        const { promise, logEntry, resolve } = runSave({ success: false, roll: 5, total: 5, saveBonus: 0, rawRolls: [], mode: 'normal', promptId: 'p1', evasionActive: false });
        resolve();
        await promise;
        expect(applyDamageToTarget.mock.calls[0][2]).toBe(32);
        expect(logEntry.mock.calls.some(c => c[0].rollType === 'evasion')).toBe(false);
    });

    it('flagless dispatch falls back to the stamp (remote lanes)', async () => {
        stampLeadingEvasionSelections(campaignName, [['p1', [T]]]);
        const { promise, resolve } = runSave({ success: false, roll: 5, total: 5, saveBonus: 0, rawRolls: [], mode: 'normal', promptId: 'p1' });
        resolve();
        await promise;
        expect(applyDamageToTarget.mock.calls[0][2]).toBe(16);
    });
});
