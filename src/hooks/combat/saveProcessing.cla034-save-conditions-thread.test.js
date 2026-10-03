// CLA-034: the monster-card save prompt for a PC must carry the save row's own
// saveConditions (e.g. ['frightened'] from Fear Ray) on the createSaveListener
// config/payload so conditional_advantage passives can key on the SAVE's condition.
import { describe, it, expect, vi, beforeEach } from 'vitest';

const runtimeStore = {};
const listenerConfigs = [];

vi.mock('../runtime/useRuntimeState.js', () => ({
    getRuntimeValue: (name, key) => runtimeStore[`${name}.${key}`],
    setRuntimeValue: (name, key, value) => { runtimeStore[`${name}.${key}`] = value; return Promise.resolve(); },
}));

vi.mock('../../services/ui/utils.js', () => ({
    default: { guid: () => 'id-' + Math.random().toString(36).slice(2) },
}));

vi.mock('../../services/dice/diceRoller.js', () => ({
    rollExpression: vi.fn(() => ({ total: 8, rolls: [3, 5], modifier: 0 })),
}));

let pendingSaveResolve = null;
vi.mock('../../services/automation/common/savePrompt.js', () => ({
    createSaveListener: (campaignName, config) => {
        listenerConfigs.push(config);
        const promise = new Promise((resolve) => { pendingSaveResolve = resolve; });
        return { promise, promptId: 'cla034-listener' };
    },
}));

vi.mock('../../services/ui/logService.js', () => ({
    addEntry: () => Promise.resolve(),
}));

vi.mock('../../services/encounters/combatData.js', () => ({
    loadCombatSummary: async () => ({ creatures: [], activeCreatureName: 'Gazer 1' }),
}));

vi.mock('../../services/rules/combat/applyDamage.js', () => ({
    normalizeSaveType: (t) => String(t || '').toLowerCase(),
    computeDamageAfterEvasion: (total, saveSuccess) => (saveSuccess ? Math.floor(total / 2) : total),
    applyDamageToTarget: vi.fn(async (_cs, _t, finalDamage) => ({ finalDamage, newHp: 24 })),
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

const fearRayContext = {
    saveDc: 12,
    saveType: 'WIS',
    attackerName: 'Gazer 1',
    actionName: '2. Fear Ray',
    dcSuccess: 'none',
    autoDamageFormula: null,
    saveConditions: ['frightened'],
    isSpellDamage: true,
};

function resolveSave(success) {
    const promise = processSaveRoll({
        rollType: 'save',
        target: { name: 'FeyRanger', type: 'player' },
        characterName: 'FeyRanger',
        campaignName,
        context: { ...fearRayContext },
        logEntry: () => {},
        setPopupHtml: vi.fn(),
    });
    pendingSaveResolve(success
        ? { success: true, roll: 13, total: 16, saveBonus: 3, rawRolls: [], mode: 'normal' }
        : { success: false, roll: 3, total: 6, saveBonus: 3, rawRolls: [], mode: 'normal' });
    return promise;
}

beforeEach(() => {
    vi.clearAllMocks();
    for (const k of Object.keys(runtimeStore)) delete runtimeStore[k];
    listenerConfigs.length = 0;
});

describe('CLA-034 saveConditions threaded onto the PC save prompt', () => {
    it('player prompt config carries saveConditions:["frightened"] from the save row', async () => {
        await resolveSave(true);
        expect(listenerConfigs).toHaveLength(1);
        expect(listenerConfigs[0].saveConditions).toEqual(['frightened']);
    });

    it('rows without saveConditions keep the byte-identical null passthrough', async () => {
        const ctx = { ...fearRayContext, saveConditions: undefined };
        const promise = processSaveRoll({
            rollType: 'save',
            target: { name: 'FeyRanger', type: 'player' },
            characterName: 'FeyRanger',
            campaignName,
            context: ctx,
            logEntry: () => {},
            setPopupHtml: vi.fn(),
        });
        pendingSaveResolve({ success: true, roll: 13, total: 16, saveBonus: 3, rawRolls: [], mode: 'normal' });
        await promise;
        expect(listenerConfigs[0].saveConditions).toBeNull();
    });
});
