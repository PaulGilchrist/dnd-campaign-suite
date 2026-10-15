// @maintained-by-ai: 2026-10-14
// MA-0019 Consume Memories save seam: failed-save condition writes stamp
// activeConditionMeta[cond].source = the inflicting monster (existing dc/ability
// keys preserved), and a save-fail that drops a Humanoid target to 0 HP logs the
// advisory consume_memories automation entry (maybeLogMemoryGainAtZeroHp).
// Producer-side context flag construction lives in MonsterCardModal — covered there.
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

const zeroHp = async (_cs, _t, d) => ({ finalDamage: d, newHp: 0 });
const consumeLogs = () => autoLogs.filter(e => e.automationType === 'consume_memories');

function resolvePlayerSave(success, contextExtra = {}) {
    const promise = processSaveRoll({
        rollType: 'save',
        target: { name: 'TestPC', type: 'player' },
        characterName: 'TestPC',
        campaignName,
        context: domContext(contextExtra),
        logEntry,
        setPopupHtml: vi.fn(),
    });
    pendingSaveResolve({ success, roll: success ? 18 : 4, total: success ? 17 : 3, saveBonus: -1, rawRolls: [], mode: 'normal' });
    return promise;
}

function resolveNpcSave(targetName) {
    return processSaveRoll({
        rollType: 'save',
        target: { name: targetName, type: 'npc' },
        characterName: 'Aboleth 1',
        campaignName,
        context: domContext({ effectiveD20: 4, effectiveBonus: 0 }),
        bonus: 0,
        r1: 4,
        r2: null,
        logEntry,
        setPopupHtml: vi.fn(),
    });
}

beforeEach(() => {
    vi.clearAllMocks();
    for (const k of Object.keys(runtimeStore)) delete runtimeStore[k];
    autoLogs.length = 0;
    applyDamageToTarget.mockImplementation(async (_cs, _t, d) => ({ finalDamage: d, newHp: 29 }));
});

describe('MA-0019 failed-save condition meta provenance stamp', () => {
    it('success writes no condition/meta; fail stamps source preserving existing dc/ability', async () => {
        const damageless = { autoDamageFormula: null, saveConditions: ['charmed'] };

        await resolvePlayerSave(true, damageless);
        expect(runtimeStore['TestPC.activeConditions']).toBeUndefined();
        expect(runtimeStore['TestPC.activeConditionMeta']).toBeUndefined();

        runtimeStore['TestPC.activeConditionMeta'] = { charmed: { dc: 10, ability: 'wis' } };
        await resolvePlayerSave(false, damageless);
        expect(runtimeStore['TestPC.activeConditions']).toEqual(['charmed']);
        expect(runtimeStore['TestPC.activeConditionMeta']).toEqual({ charmed: { dc: 10, ability: 'wis', source: 'Aboleth 1' } });
    });
});

describe('MA-0019 memory-gain-at-0-HP advisory log', () => {
    it('save-fail damage to 0 HP on a Humanoid player logs consume_memories', async () => {
        applyDamageToTarget.mockImplementation(zeroHp);
        await resolvePlayerSave(false);

        expect(consumeLogs()).toHaveLength(1);
        expect(consumeLogs()[0]).toMatchObject({
            type: 'automation',
            characterName: 'Aboleth 1',
            abilityName: 'Consume Memories',
            targetName: 'TestPC',
        });
        expect(consumeLogs()[0].description).toContain('memories');
        expect(consumeLogs()[0].description).toContain('GM-enforced');
    });

    it('no log when the target survives or the save succeeds at 0 HP', async () => {
        await resolvePlayerSave(false); // survives (newHp 29)
        expect(consumeLogs()).toHaveLength(0);

        applyDamageToTarget.mockImplementation(zeroHp);
        await resolvePlayerSave(true); // at 0 HP but save succeeded
        expect(consumeLogs()).toHaveLength(0);
    });

    it('creature-type gate: humanoid npc at 0 HP logs, beast does not', async () => {
        applyDamageToTarget.mockImplementation(zeroHp);
        await resolveNpcSave('Guard Beast');
        expect(consumeLogs()).toHaveLength(0);

        await resolveNpcSave('Thug 1');
        expect(consumeLogs()).toHaveLength(1);
    });
});
