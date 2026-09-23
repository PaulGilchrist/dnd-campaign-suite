// MA-0875: Gnoll Demoniac "Hunger of Yeenoghu" — INLINE block-save seam.
// context.tempHpGrant (parseTempHpGrantClause, forwarded by
// buildAbilitySaveRollContext) arms grantFailedSaveFailOnly THP: failed
// save → tempHpService replace-if-larger on the ATTACKER (MA-0275 Fortify
// producer twin, self-grant default, chooser GM-enforced) + one
// temp_hp_granted log; successful save grants ZERO; clauseless contexts are
// byte-inert. Cube rows normally route the picker (its own seam) — this is
// the inline gap-fixed twin demanded by the MA-0875 mandate.
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

const rollExpression = vi.fn(() => ({ total: 26, rolls: [5, 6, 1, 5, 4, 4, 1, 1], modifier: 0 }));
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

vi.mock('../../services/encounters/combatData.js', () => ({
    loadCombatSummary: async () => ({ creatures: [], activeCreatureName: 'Gnoll Demoniac 1' }),
    getCurrentCombatRound: () => 1,
    getCombatSummary: () => null,
}));

const applyDamageToTarget = vi.fn(async (_cs, _target, finalDamage) => ({ finalDamage, newHp: 999 - finalDamage }));
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

const addExpiration = vi.fn();
vi.mock('../../services/rules/effects/expirationQueue.js', () => ({
    addExpiration: (...args) => addExpiration(...args),
}));

import { processSaveRoll } from './saveProcessing.js';

const campaignName = 'test-campaign';
const GNOLL = 'Gnoll Demoniac 1';
const TARGET = 'AberrantSorcerer';

// MA-0875 Hunger of Yeenoghu inline context shape (cube rows normally ride
// the picker; this proves the inline seam grant with the same clause).
const hungerContext = {
    saveDc: 14,
    saveType: 'Dexterity',
    attackerName: GNOLL,
    actionName: 'Hunger of Yeenoghu',
    dcSuccess: 'half',
    autoDamageFormula: '8d6',
    autoDamageDamageType: 'Necrotic',
    saveConditions: [],
    tempHpGrant: { tempHp: 10 },
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
    await promise;
}

beforeEach(() => {
    vi.clearAllMocks();
    for (const k of Object.keys(runtimeStore)) delete runtimeStore[k];
    addEntryLogs.length = 0;
});

describe('MA-0875 inline saveProcessing THP grant (Hunger of Yeenoghu clause)', () => {
    it('failed save: attacker tempHp 10 via replace-if-larger + temp_hp_granted log; full damage applied', async () => {
        await resolveSave({ ...hungerContext }, false, 5);
        expect(applyDamageToTarget.mock.calls[0][2]).toBe(26);
        expect(runtimeStore[`${GNOLL}.tempHp`]).toBe(10);
        expect(runtimeStore[`${TARGET}.tempHp`]).toBeUndefined();
        const grant = addEntryLogs.find(e => e.automationType === 'temp_hp_granted');
        expect(grant).toBeTruthy();
        expect(grant.characterName).toBe(GNOLL);
        expect(grant.abilityName).toBe('Hunger of Yeenoghu');
        expect(grant.description).toMatch(/gains 10 temporary hit points/);
    });

    it('standing 15 THP pool is NOT lowered by the 10-THP grant; held value logged', async () => {
        runtimeStore[`${GNOLL}.tempHp`] = 15;
        await resolveSave({ ...hungerContext }, false, 5);
        expect(runtimeStore[`${GNOLL}.tempHp`]).toBe(15);
        const grant = addEntryLogs.find(e => e.automationType === 'temp_hp_granted');
        expect(grant.description).toMatch(/now 15 THP/);
    });

    it('successful save: ZERO THP, zero grant log', async () => {
        await resolveSave({ ...hungerContext }, true, 20);
        expect(runtimeStore[`${GNOLL}.tempHp`]).toBeUndefined();
        expect(addEntryLogs.find(e => e.automationType === 'temp_hp_granted')).toBeFalsy();
    });

    it('clauseless context is byte-inert: no THP write, no grant log', async () => {
        const legacy = { ...hungerContext };
        delete legacy.tempHpGrant;
        await resolveSave(legacy, false, 5);
        expect(applyDamageToTarget.mock.calls[0][2]).toBe(26);
        expect(runtimeStore[`${GNOLL}.tempHp`]).toBeUndefined();
        expect(addEntryLogs.find(e => e.automationType === 'temp_hp_granted')).toBeFalsy();
    });

    it('no addExpiration clock rides the THP grant (THP is consumed by damage, Fortify twin)', async () => {
        await resolveSave({ ...hungerContext }, false, 5);
        expect(addExpiration).not.toHaveBeenCalled();
    });
});
