// MA-0019 provenance + memory-gain clause: failed-save condition writes stamp
// activeConditionMeta[cond].source = the inflicting monster (backward compat:
// existing dc/ability keys preserved), and a Consume Memories save that drops
// a Humanoid target to 0 HP logs the advisory consume_memories automation entry.
import { describe, it, expect, vi, beforeEach } from 'vitest';

const runtimeStore = {};
const autoLogs = [];

vi.mock('../runtime/useRuntimeState.js', () => ({
    getRuntimeValue: (name, key) => runtimeStore[`${name}.${key}`],
    setRuntimeValue: (name, key, value) => { runtimeStore[`${name}.${key}`] = value; return Promise.resolve(); },
}));

vi.mock('../../services/ui/utils.js', () => ({
    default: { guid: () => 'id-' + Math.random().toString(36).slice(2) },
}));

vi.mock('../../services/dice/diceRoller.js', () => ({
    rollExpression: vi.fn(() => ({ total: 12, rolls: [3, 3, 6], modifier: 0 })),
}));

let pendingSaveResolve = null;
vi.mock('../../services/automation/common/savePrompt.js', () => ({
    createSaveListener: () => {
        const promise = new Promise((resolve) => { pendingSaveResolve = resolve; });
        return { promise };
    },
}));

vi.mock('../../services/ui/logService.js', () => ({
    addEntry: (campaignName, entry) => { autoLogs.push(entry); return Promise.resolve(); },
}));

const combatSummary = {
    activeCreatureName: 'Aboleth 1',
    creatures: [
        { name: 'Aboleth 1', type: 'npc', monsterType: 'aberration' },
        { name: 'TestPC', type: 'player' },
        { name: 'Thug 1', type: 'npc', monsterType: 'humanoid' },
        { name: 'Guard Beast', type: 'npc', monsterType: 'beast' },
    ],
};
vi.mock('../../services/encounters/combatData.js', () => ({
    loadCombatSummary: async () => combatSummary,
}));

const applyDamageToTarget = vi.fn(async (_cs, _target, finalDamage) => ({ finalDamage, newHp: 29 }));
vi.mock('../../services/rules/combat/applyDamage.js', () => ({
    normalizeSaveType: (t) => String(t || '').toLowerCase(),
    computeDamageAfterEvasion: (total, saveSuccess) => (saveSuccess ? Math.floor(total / 2) : total),
    applyDamageToTarget: (...args) => applyDamageToTarget(...args),
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
const logEntry = vi.fn();

function domContext(extra = {}) {
    return {
        saveDc: 16,
        saveType: 'INT',
        attackerName: 'Aboleth 1',
        actionName: 'Consume Memories',
        dcSuccess: 'half',
        autoDamageFormula: '3d6',
        autoDamageDamageType: 'Psychic',
        saveConditions: [],
        consumeMemoriesClause: true,
        ...extra,
    };
}

function resolvePlayerSave(success) {
    const promise = processSaveRoll({
        rollType: 'save',
        target: { name: 'TestPC', type: 'player' },
        characterName: 'TestPC',
        campaignName,
        context: domContext(),
        logEntry,
        setPopupHtml: vi.fn(),
    });
    pendingSaveResolve({ success, roll: 4, total: 3, saveBonus: -1, rawRolls: [], mode: 'normal' });
    return promise;
}

beforeEach(() => {
    vi.clearAllMocks();
    for (const k of Object.keys(runtimeStore)) delete runtimeStore[k];
    autoLogs.length = 0;
    applyDamageToTarget.mockImplementation(async (_cs, _t, d) => ({ finalDamage: d, newHp: 29 }));
});

describe('MA-0019 provenance stamp on failed-save conditions', () => {
    it('damageless save-fail stamps meta source, preserving existing dc/ability', async () => {
        runtimeStore['TestPC.activeConditionMeta'] = { charmed: { dc: 10, ability: 'wis' } };
        const promise = processSaveRoll({
            rollType: 'save',
            target: { name: 'TestPC', type: 'player' },
            characterName: 'TestPC',
            campaignName,
            context: domContext({ autoDamageFormula: null, saveConditions: ['charmed'] }),
            logEntry,
            setPopupHtml: vi.fn(),
        });
        pendingSaveResolve({ success: false, roll: 4, total: 3, saveBonus: -1, rawRolls: [], mode: 'normal' });
        await promise;

        expect(runtimeStore['TestPC.activeConditions']).toEqual(['charmed']);
        expect(runtimeStore['TestPC.activeConditionMeta']).toEqual({ charmed: { dc: 10, ability: 'wis', source: 'Aboleth 1' } });
    });

    it('successful save writes no condition meta', async () => {
        const promise = processSaveRoll({
            rollType: 'save',
            target: { name: 'TestPC', type: 'player' },
            characterName: 'TestPC',
            campaignName,
            context: domContext({ autoDamageFormula: null, saveConditions: ['charmed'] }),
            logEntry,
            setPopupHtml: vi.fn(),
        });
        pendingSaveResolve({ success: true, roll: 18, total: 17, saveBonus: -1, rawRolls: [], mode: 'normal' });
        await promise;
        expect(runtimeStore['TestPC.activeConditionMeta']).toBeUndefined();
    });
});

describe('MA-0019 memory-gain-at-0-HP advisory log', () => {
    it('save-fail damage to 0 HP on a Humanoid logs consume_memories', async () => {
        applyDamageToTarget.mockImplementation(async (_cs, _t, d) => ({ finalDamage: d, newHp: 0 }));
        await resolvePlayerSave(false);

        const entry = autoLogs.find(e => e.automationType === 'consume_memories');
        expect(entry).toBeTruthy();
        expect(entry.type).toBe('automation');
        expect(entry.characterName).toBe('Aboleth 1');
        expect(entry.targetName).toBe('TestPC');
        expect(entry.description).toContain('memories');
        expect(entry.description).toContain('GM-enforced');
    });

    it('target above 0 HP: no consume_memories log', async () => {
        await resolvePlayerSave(false);
        expect(autoLogs.some(e => e.automationType === 'consume_memories')).toBe(false);
    });

    it('successful save to 0-buffer target: no consume_memories log even at 0 HP', async () => {
        applyDamageToTarget.mockImplementation(async (_cs, _t, d) => ({ finalDamage: d, newHp: 0 }));
        await resolvePlayerSave(true);
        expect(autoLogs.some(e => e.automationType === 'consume_memories')).toBe(false);
    });

    it('npc beast at 0 HP: not Humanoid, no consume_memories log', async () => {
        applyDamageToTarget.mockImplementation(async (_cs, _t, d) => ({ finalDamage: d, newHp: 0 }));
        await processSaveRoll({
            rollType: 'save',
            target: { name: 'Guard Beast', type: 'npc' },
            characterName: 'Aboleth 1',
            campaignName,
            context: domContext({ effectiveD20: 4, effectiveBonus: 0 }),
            bonus: 0,
            r1: 4,
            r2: null,
            logEntry,
            setPopupHtml: vi.fn(),
        });
        expect(autoLogs.some(e => e.automationType === 'consume_memories')).toBe(false);
    });

    it('npc humanoid at 0 HP: consume_memories logged', async () => {
        applyDamageToTarget.mockImplementation(async (_cs, _t, d) => ({ finalDamage: d, newHp: 0 }));
        await processSaveRoll({
            rollType: 'save',
            target: { name: 'Thug 1', type: 'npc' },
            characterName: 'Aboleth 1',
            campaignName,
            context: domContext({ effectiveD20: 4, effectiveBonus: 0 }),
            bonus: 0,
            r1: 4,
            r2: null,
            logEntry,
            setPopupHtml: vi.fn(),
        });
        expect(autoLogs.some(e => e.automationType === 'consume_memories')).toBe(true);
    });
});
