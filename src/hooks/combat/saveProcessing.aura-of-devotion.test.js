// CLA-020: Aura of Devotion — saveProcessing failed-save leg suppresses aura-covered
// charmed (suppression logged naming Aura of Devotion); control targets still get it.
// Mirrors saveProcessing.aura-of-courage.test.js byte-shapes (CLA-019 sibling).
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
    rollExpression: vi.fn(() => ({ total: 0, rolls: [], modifier: 0 })),
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

// Aura channel: ElderPaladin hosts Aura of Devotion (charmed); Thug 1 is the control.
vi.mock('../../services/combat/auras/auraConditionImmunity.js', async (importActual) => {
    const actual = await importActual();
    return {
        ...actual,
        getAuraConditionImmunities: vi.fn(async ({ targetName }) => (
            targetName === 'Thug 1'
                ? { immunities: [], immunitySources: {} }
                : { immunities: ['charmed'], immunitySources: { charmed: 'ElderPaladin' } }
        )),
    };
});

import { processSaveRoll } from './saveProcessing.js';

const campaignName = 'test-campaign';

function charmContext(targetName) {
    return {
        saveDc: 16,
        saveType: 'WIS',
        attackerName: 'HexWarlock',
        actionName: 'Charm Person',
        dcSuccess: 'none',
        autoDamageFormula: null,
        saveConditions: ['charmed'],
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

async function runFailedSave(targetName, saveConditions = ['charmed']) {
    const context = { ...charmContext(targetName), saveConditions };
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

describe('CLA-020 Aura of Devotion immunity on failed-save leg', () => {
    it('aura member: failed WIS save vs Charm Person does NOT apply charmed, immunity logged, no applied-log', async () => {
        await runFailedSave('EvasiveFighter');

        expect(runtimeStore['EvasiveFighter.activeConditions']).toBeUndefined();
        const immunity = conditionLogs.filter(e => e.automationType === 'condition_immunity_aura');
        expect(immunity).toHaveLength(1);
        expect(immunity[0].type).toBe('automation');
        expect(immunity[0].characterName).toBe('EvasiveFighter');
        expect(immunity[0].sourceName).toBe('ElderPaladin');
        expect(immunity[0].description).toContain('EvasiveFighter is immune to Charmed (Aura of Devotion from ElderPaladin)');
        expect(conditionLogs.some(e => e.type === 'condition' && e.action === 'applied')).toBe(false);
    });

    it('control target: failed save still applies charmed, no immunity log', async () => {
        await runFailedSave('Thug 1');

        expect(runtimeStore['Thug 1.activeConditions']).toEqual(['charmed']);
        expect(conditionLogs.some(e => e.automationType === 'condition_immunity_aura')).toBe(false);
        expect(conditionLogs.some(e => e.type === 'condition' && e.action === 'applied')).toBe(true);
    });

    it('multi-condition row: covered charmed suppressed, remainder applied (spread-new array)', async () => {
        await runFailedSave('EvasiveFighter', ['charmed', 'stunned']);

        expect(runtimeStore['EvasiveFighter.activeConditions']).toEqual(['stunned']);
        expect(conditionLogs.filter(e => e.automationType === 'condition_immunity_aura')).toHaveLength(1);
        expect(conditionLogs.some(e => e.type === 'condition' && e.action === 'applied' && e.condition === 'Stunned')).toBe(true);
    });

    it('CLA-019 parity: frightened-only leg on same channel mock (charmed coverage) still applies frightened', async () => {
        await runFailedSave('EvasiveFighter', ['frightened']);

        expect(runtimeStore['EvasiveFighter.activeConditions']).toEqual(['frightened']);
        expect(conditionLogs.some(e => e.automationType === 'condition_immunity_aura')).toBe(false);
    });

    it('successful save: nothing lands, no immunity log (byte-identical legacy)', async () => {
        const context = charmContext('EvasiveFighter');
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
