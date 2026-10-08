import { describe, it, expect, vi, beforeEach } from 'vitest';

// SP-094: Protection from Evil and Good charm immunity must be enforced on the
// monster save-chip lane. saveProcessing threads the attacker's real creature type
// (combatSummary monsterType) into playerIsImmuneToCondition and logs a refusal
// when the ward — not some other immunity — is what blocked the condition.

const runtimeStore = {};
const entries = [];

vi.mock('../runtime/useRuntimeState.js', () => ({
    getRuntimeValue: (name, key) => runtimeStore[`${name}.${key}`],
    setRuntimeValue: (name, key, value) => { runtimeStore[`${name}.${key}`] = value; return Promise.resolve(); },
}));

vi.mock('../../services/ui/utils.js', () => ({
    default: { guid: () => 'id-' + Math.random().toString(36).slice(2) },
}));

vi.mock('../../services/dice/diceRoller.js', () => ({
    rollExpression: () => ({ total: 8, rolls: [3, 5], modifier: 0 }),
}));

let pendingSaveResolve = null;
vi.mock('../../services/automation/common/savePrompt.js', () => ({
    createSaveListener: () => {
        const promise = new Promise((resolve) => { pendingSaveResolve = resolve; });
        return { promise };
    },
}));

vi.mock('../../services/ui/logService.js', () => ({
    addEntry: (_campaignName, entry) => { entries.push(entry); return Promise.resolve(); },
}));

const WARDED = ['Aberration', 'Celestial', 'Elemental', 'Fey', 'Fiend', 'Undead'];
vi.mock('../../services/encounters/combatData.js', () => ({
    loadCombatSummary: async () => ({
        creatures: [
            { name: 'War_Cleric', type: 'pc' },
            { name: 'Succubus 1', type: 'npc', monsterType: 'Fiend' },
            { name: 'Bandit 1', type: 'npc', monsterType: 'Humanoid' },
        ],
        activeCreatureName: 'Succubus 1',
    }),
    getCombatSummary: () => null,
}));

vi.mock('../../services/rules/combat/applyDamage.js', () => ({
    normalizeSaveType: (t) => String(t || '').toLowerCase(),
    computeDamageAfterEvasion: (total, saveSuccess) => (saveSuccess ? Math.floor(total / 2) : total),
    applyDamageToTarget: async (_cs, _target, finalDamage) => ({ finalDamage, newHp: 40 }),
}));

vi.mock('../../services/automation/handlers/buffs/circleOfPowerHandler.js', () => ({
    isCircleOfPowerActive: () => false,
}));

// Mirror automationImmunities.isWardedConditionImmunity: PFEG must be active AND
// the condition charmed/frightened AND the attacker type warded.
vi.mock('../../services/combat/automation/automationService.js', () => ({
    hasIgnoreResistance: () => false,
    playerIsImmuneToCondition: ({ conditionKey, playerStats, sourceCreatureType }) => {
        const buffs = runtimeStore[`${playerStats?.name}.activeBuffs`] || [];
        const active = buffs.some(b => b.effect === 'protection_from_evil_and_good');
        if (!active) return false;
        const low = String(conditionKey || '').toLowerCase();
        if (low !== 'charmed' && low !== 'frightened') return false;
        return WARDED.some(t => t.toLowerCase() === String(sourceCreatureType || '').toLowerCase());
    },
}));

import { processSaveRoll } from './saveProcessing.js';

const campaignName = 'test-campaign';

function seedWard() {
    runtimeStore['War_Cleric.activeBuffs'] = [{ name: 'Protection from Evil and Good', effect: 'protection_from_evil_and_good' }];
    runtimeStore['War_Cleric.protectionFromEvilAndGoodWardedTypes'] = WARDED;
}

async function resolveFailedSave(attackerName) {
    const context = {
        saveDc: 15, saveType: 'CHA', attackerName,
        actionName: 'Charm', dcSuccess: 'none',
        autoDamageFormula: null, saveConditions: ['charmed'],
        // SP-094: the modal save builder now threads _characters so targetStats
        // resolves and immunity can fire on this lane.
        _characters: [{ name: 'War_Cleric', computedStats: { name: 'War_Cleric', immunities: [] } }],
    };
    const promise = processSaveRoll({
        rollType: 'save',
        target: { name: 'War_Cleric', type: 'player' },
        characterName: 'War_Cleric',
        campaignName,
        context,
        logEntry: () => {},
        setPopupHtml: vi.fn(),
    });
    pendingSaveResolve({ success: false, roll: 1, total: 7, saveBonus: 6, rawRolls: [], mode: 'normal' });
    await promise;
}

beforeEach(() => {
    vi.clearAllMocks();
    for (const k of Object.keys(runtimeStore)) delete runtimeStore[k];
    entries.length = 0;
});

describe('SP-094 PFEG charm immunity on monster save-chip lane', () => {
    it('fiend attacker: failed charm save is blocked, no condition, refusal logged', async () => {
        seedWard();
        await resolveFailedSave('Succubus 1');

        expect(runtimeStore['War_Cleric.activeConditions']).toBeUndefined();
        expect(entries.some(e => e.type === 'condition' && e.action === 'applied')).toBe(false);
        const blocked = entries.find(e => e.type === 'automation blocked');
        expect(blocked).toBeTruthy();
        expect(blocked).toMatchObject({ characterName: 'War_Cleric', sourceName: 'Succubus 1', abilityName: 'Charm' });
        expect(blocked.description).toMatch(/Fiend/);
    });

    it('humanoid attacker: charm is not warded, condition still lands', async () => {
        seedWard();
        await resolveFailedSave('Bandit 1');

        expect(runtimeStore['War_Cleric.activeConditions']).toEqual(['charmed']);
        expect(entries.some(e => e.type === 'automation blocked')).toBe(false);
        expect(entries.some(e => e.type === 'condition' && e.action === 'applied')).toBe(true);
    });

    it('no ward active: fiend charm lands (byte-inert when unwarded)', async () => {
        await resolveFailedSave('Succubus 1');

        expect(runtimeStore['War_Cleric.activeConditions']).toEqual(['charmed']);
        expect(entries.some(e => e.type === 'automation blocked')).toBe(false);
    });
});
