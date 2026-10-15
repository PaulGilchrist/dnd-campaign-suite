// @maintained-by-ai: 2026-10-14
// MA-0875: Gnoll Demoniac "Hunger of Yeenoghu" — INLINE block-save THP-grant
// seam, authoritative home for the generic grant-on-save rules (replace-if-
// larger, stacking; the MA-0275 animal-spirit lane explicitly delegates here).
// context.tempHpGrant (parseTempHpGrantClause over the live monsters.json row,
// forwarded by buildAbilitySaveRollContext) arms grantFailedSaveTempHp:
// failed save → real tempHpService replace-if-larger on the ATTACKER
// (MA-0275 Fortify producer twin, self-grant default, "creature of its choice"
// chooser GM-enforced) + one temp_hp_granted log, no expiration clock;
// successful save grants ZERO; clauseless contexts are byte-inert.
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

const rollExpression = vi.fn(() => ({ total: 26, rolls: [4, 4, 4, 4, 3, 3, 2, 2], modifier: 0 }));
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
    // MonsterCardHelpers (imported by saveProcessing) needs this export to exist on the mock.
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
import { parseTempHpGrantClause } from '../../components/encounter/MonsterCardHelpers.js';
import monstersData from '../../../public/data/monsters.json';

const campaignName = 'test-campaign';
const GNOLL = 'Gnoll Demoniac 1';
const TARGET = 'AberrantSorcerer';

// Context built from the LIVE data row + the live parser, so the whole
// clause chain (row → parse → save context → grant seam) stays in sync.
const HUNGER_ROW = monstersData.find(m => m.name === 'Gnoll Demoniac').actions.find(a => a.name === 'Hunger of Yeenoghu');
const GRANT_HP = parseTempHpGrantClause(HUNGER_ROW.save_effect)?.tempHp;

const hungerContext = {
    saveDc: HUNGER_ROW.save_dc,
    saveType: HUNGER_ROW.save_type,
    attackerName: GNOLL,
    actionName: 'Hunger of Yeenoghu',
    dcSuccess: 'half',
    autoDamageFormula: HUNGER_ROW.damage_dice_primary,
    autoDamageDamageType: HUNGER_ROW.damage_type_primary,
    saveConditions: [],
    tempHpGrant: { tempHp: GRANT_HP },
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

const grantLog = () => addEntryLogs.find(e => e.automationType === 'temp_hp_granted');

function resetState() {
    vi.clearAllMocks();
    for (const k of Object.keys(runtimeStore)) delete runtimeStore[k];
    addEntryLogs.length = 0;
}

beforeEach(resetState);

describe('MA-0875 inline saveProcessing THP grant (Hunger of Yeenoghu clause)', () => {
    it('failed save: full damage + replace-if-larger THP on the ATTACKER, grant log, no clock', async () => {
        expect(GRANT_HP).toBe(10); // data pin: row still authors "gains 10 Temporary Hit Points"
        await resolveSave({ ...hungerContext }, false, 5);
        expect(applyDamageToTarget.mock.calls[0][2]).toBe(26);
        expect(runtimeStore[`${GNOLL}.tempHp`]).toBe(GRANT_HP);
        expect(runtimeStore[`${TARGET}.tempHp`]).toBeUndefined();
        // No addExpiration clock rides the grant — THP is consumed by damage (Fortify twin).
        expect(addExpiration).not.toHaveBeenCalled();
        const grant = grantLog();
        expect(grant).toBeTruthy();
        expect(grant).toMatchObject({ characterName: GNOLL, abilityName: 'Hunger of Yeenoghu' });
        expect(grant.description).toMatch(new RegExp(`gains ${GRANT_HP} temporary hit points \\(now ${GRANT_HP} THP, replace-if-larger\\)`));
    });

    it('replace-if-larger stacking: standing 15 pool held (logged "now 15 THP"), standing 5 pool replaced up', async () => {
        runtimeStore[`${GNOLL}.tempHp`] = 15;
        await resolveSave({ ...hungerContext }, false, 5);
        expect(runtimeStore[`${GNOLL}.tempHp`]).toBe(15);
        expect(grantLog().description).toMatch(/now 15 THP/);

        resetState();
        runtimeStore[`${GNOLL}.tempHp`] = 5;
        await resolveSave({ ...hungerContext }, false, 5);
        expect(runtimeStore[`${GNOLL}.tempHp`]).toBe(GRANT_HP);
        expect(grantLog().description).toMatch(/now 10 THP/);
    });

    it('successful save: ZERO THP, zero grant log', async () => {
        await resolveSave({ ...hungerContext }, true, 20);
        expect(runtimeStore[`${GNOLL}.tempHp`]).toBeUndefined();
        expect(grantLog()).toBeFalsy();
    });

    it('clauseless context is byte-inert: no THP write, no grant log', async () => {
        const legacy = { ...hungerContext };
        delete legacy.tempHpGrant;
        await resolveSave(legacy, false, 5);
        expect(runtimeStore[`${GNOLL}.tempHp`]).toBeUndefined();
        expect(grantLog()).toBeFalsy();
    });
});
