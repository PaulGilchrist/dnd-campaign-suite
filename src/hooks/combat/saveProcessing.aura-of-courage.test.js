// CLA-019: Aura of Courage — saveProcessing failed-save leg suppresses aura-covered
// conditions (suppression logged); control targets still get the condition.
import { describe, it, expect, vi, beforeEach } from 'vitest';

const runtimeStore = {};
const conditionLogs = [];

vi.mock('../runtime/useRuntimeState.js', () => ({
    getRuntimeValue: (name, key) => runtimeStore[`${name}.${key}`],
    setRuntimeValue: (name, key, value) => { runtimeStore[`${name}.${key}`] = value; return Promise.resolve(); },
}));

vi.mock('../../services/ui/utils.js', () => ({
    default: { guid: () => 'id-' + Math.random().toString(36).slice(2) },
}));

vi.mock('../../services/dice/diceRoller.js', () => ({
    rollExpression: vi.fn(() => ({ total: 17, rolls: [5, 6, 6], modifier: 0 })),
}));

let pendingSaveResolve = null;
vi.mock('../../services/automation/common/savePrompt.js', () => ({
    createSaveListener: () => {
        const promise = new Promise((resolve) => { pendingSaveResolve = resolve; });
        return { promise };
    },
}));

vi.mock('../../services/ui/logService.js', () => ({
    addEntry: (campaignName, entry) => { conditionLogs.push(entry); return Promise.resolve(); },
}));

vi.mock('../../services/encounters/combatData.js', () => ({
    loadCombatSummary: async () => ({ creatures: [], activeCreatureName: 'HexWarlock' }),
}));

vi.mock('../../services/rules/combat/applyDamage.js', () => ({
    normalizeSaveType: (t) => String(t || '').toLowerCase(),
    computeDamageAfterEvasion: (total, saveSuccess) => (saveSuccess ? Math.floor(total / 2) : total),
    applyDamageToTarget: vi.fn(async (_cs, _target, finalDamage) => ({ finalDamage, newHp: 24 })),
}));

vi.mock('../../services/automation/handlers/buffs/circleOfPowerHandler.js', () => ({
    isCircleOfPowerActive: () => false,
}));

vi.mock('../../services/combat/automation/automationService.js', () => ({
    hasIgnoreResistance: () => false,
    playerIsImmuneToCondition: () => false,
}));

// Aura channel: ElderPaladin hosts the party aura; Thug 1 is the unprotected control.
vi.mock('../../services/combat/auras/auraConditionImmunity.js', async (importActual) => {
    const actual = await importActual();
    return {
        ...actual,
        getAuraConditionImmunities: vi.fn(async ({ targetName }) => (
            targetName === 'Thug 1'
                ? { immunities: [], immunitySources: {} }
                : { immunities: ['frightened'], immunitySources: { frightened: 'ElderPaladin' } }
        )),
    };
});

import { processSaveRoll } from './saveProcessing.js';

const campaignName = 'test-campaign';

function fearContext(targetName) {
    return {
        saveDc: 16,
        saveType: 'WIS',
        attackerName: 'HexWarlock',
        actionName: 'Fear',
        dcSuccess: 'none',
        autoDamageFormula: null,
        saveConditions: ['frightened'],
        _characters: [
            { name: 'ElderPaladin', computedStats: { automation: { passives: [{ name: 'Aura of Protection' }] } } },
            { name: targetName, computedStats: {} },
        ],
    };
}

beforeEach(() => {
    vi.clearAllMocks();
    for (const k of Object.keys(runtimeStore)) delete runtimeStore[k];
    conditionLogs.length = 0;
});

async function runFailedSave(targetName, saveConditions = ['frightened']) {
    const context = { ...fearContext(targetName), saveConditions };
    const promise = processSaveRoll({
        rollType: 'save',
        target: { name: targetName, type: 'player' },
        characterName: targetName,
        campaignName,
        context,
        logEntry: vi.fn(),
        setPopupHtml: vi.fn(),
    });
    pendingSaveResolve({ success: false, roll: 4, total: 4, saveBonus: 0, rawRolls: [], mode: 'normal' });
    await promise;
}

describe('CLA-019 aura immunity on failed-save leg', () => {
    it('aura member: failed WIS save vs Fear does NOT apply frightened, immunity logged, no applied-log', async () => {
        await runFailedSave('EvasiveFighter');

        expect(runtimeStore['EvasiveFighter.activeConditions']).toBeUndefined();
        const immunity = conditionLogs.filter(e => e.automationType === 'condition_immunity_aura');
        expect(immunity).toHaveLength(1);
        expect(immunity[0].type).toBe('automation');
        expect(immunity[0].characterName).toBe('EvasiveFighter');
        expect(immunity[0].sourceName).toBe('ElderPaladin');
        expect(immunity[0].description).toContain('EvasiveFighter is immune to Frightened (Aura of Courage from ElderPaladin)');
        expect(conditionLogs.some(e => e.type === 'condition' && e.action === 'applied')).toBe(false);
    });

    it('control target: failed save still applies frightened, no immunity log', async () => {
        await runFailedSave('Thug 1');

        expect(runtimeStore['Thug 1.activeConditions']).toEqual(['frightened']);
        expect(conditionLogs.some(e => e.automationType === 'condition_immunity_aura')).toBe(false);
        expect(conditionLogs.some(e => e.type === 'condition' && e.action === 'applied')).toBe(true);
    });

    it('aura member, non-covered condition (charmed via other source): unaffected path byte-identical', async () => {
        await runFailedSave('EvasiveFighter', ['charmed']);

        expect(runtimeStore['EvasiveFighter.activeConditions']).toEqual(['charmed']);
        expect(conditionLogs.some(e => e.automationType === 'condition_immunity_aura')).toBe(false);
    });

    it('multi-condition row: covered suppressed, remainder applied (spread-new array)', async () => {
        await runFailedSave('EvasiveFighter', ['frightened', 'stunned']);

        expect(runtimeStore['EvasiveFighter.activeConditions']).toEqual(['stunned']);
        expect(conditionLogs.filter(e => e.automationType === 'condition_immunity_aura')).toHaveLength(1);
        expect(conditionLogs.some(e => e.type === 'condition' && e.action === 'applied' && e.condition === 'Stunned')).toBe(true);
    });

    it('successful save: nothing lands, no immunity log (byte-identical legacy)', async () => {
        const context = fearContext('EvasiveFighter');
        const promise = processSaveRoll({
            rollType: 'save',
            target: { name: 'EvasiveFighter', type: 'player' },
            characterName: 'EvasiveFighter',
            campaignName,
            context,
            logEntry: vi.fn(),
            setPopupHtml: vi.fn(),
        });
        pendingSaveResolve({ success: true, roll: 19, total: 19, saveBonus: 0, rawRolls: [], mode: 'normal' });
        await promise;

        expect(runtimeStore['EvasiveFighter.activeConditions']).toBeUndefined();
        expect(conditionLogs.some(e => e.automationType === 'condition_immunity_aura')).toBe(false);
    });
});
