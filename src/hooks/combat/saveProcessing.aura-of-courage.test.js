// @maintained-by-ai: 2026-10-14
// CLA-019: Aura of Courage — saveProcessing failed-save leg suppresses aura-covered
// conditions (suppression logged); control targets and uncovered conditions still land.
// Seam-only: the aura membership/range channel itself is verified in
// services/combat/auras/auraComboEffects.test.js and auraConditionImmunity.test.js;
// the charmed sibling is saveProcessing.aura-of-devotion.test.js.
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

// Aura channel: ElderPaladin hosts the party Aura of Courage (frightened);
// Thug 1 stands outside the aura as the unprotected control.
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

async function runFailedSave(targetName, saveConditions = ['frightened']) {
    const promise = processSaveRoll({
        rollType: 'save',
        target: { name: targetName, type: 'player' },
        characterName: targetName,
        campaignName,
        context: {
            saveDc: 16,
            saveType: 'WIS',
            attackerName: 'HexWarlock',
            actionName: 'Fear',
            dcSuccess: 'none',
            autoDamageFormula: null,
            saveConditions,
            _characters: [
                { name: 'ElderPaladin', computedStats: {} },
                { name: targetName, computedStats: {} },
            ],
        },
        logEntry: vi.fn(),
        setPopupHtml: vi.fn(),
    });
    pendingSaveResolve({ success: false, roll: 4, total: 4, saveBonus: 0, rawRolls: [], mode: 'normal' });
    await promise;
}

beforeEach(() => {
    vi.clearAllMocks();
    for (const k of Object.keys(runtimeStore)) delete runtimeStore[k];
    conditionLogs.length = 0;
});

describe('CLA-019 aura immunity on failed-save leg', () => {
    it('aura member: failed WIS save vs Fear does NOT apply frightened, immunity logged, no applied-log', async () => {
        await runFailedSave('EvasiveFighter');

        expect(runtimeStore['EvasiveFighter.activeConditions']).toBeUndefined();
        const immunity = conditionLogs.filter(e => e.automationType === 'condition_immunity_aura');
        expect(immunity).toHaveLength(1);
        expect(immunity[0]).toMatchObject({
            type: 'automation',
            characterName: 'EvasiveFighter',
            sourceName: 'ElderPaladin',
        });
        expect(immunity[0].description).toContain('EvasiveFighter is immune to Frightened (Aura of Courage from ElderPaladin)');
        expect(conditionLogs.some(e => e.type === 'condition' && e.action === 'applied')).toBe(false);
    });

    it('control target outside the aura: failed save still applies frightened, no immunity log', async () => {
        await runFailedSave('Thug 1');

        expect(runtimeStore['Thug 1.activeConditions']).toEqual(['frightened']);
        expect(conditionLogs.some(e => e.automationType === 'condition_immunity_aura')).toBe(false);
        expect(conditionLogs.some(e => e.type === 'condition' && e.action === 'applied')).toBe(true);
    });

    it('multi-condition row: covered frightened suppressed, remainder applied (spread-new array)', async () => {
        await runFailedSave('EvasiveFighter', ['frightened', 'stunned']);

        expect(runtimeStore['EvasiveFighter.activeConditions']).toEqual(['stunned']);
        expect(conditionLogs.filter(e => e.automationType === 'condition_immunity_aura')).toHaveLength(1);
        expect(conditionLogs.some(e => e.type === 'condition' && e.action === 'applied' && e.condition === 'Stunned')).toBe(true);
    });
});
