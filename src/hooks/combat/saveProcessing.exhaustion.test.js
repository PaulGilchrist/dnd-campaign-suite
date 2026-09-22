// MA-0751: Fomorian Warping Hex — failed WIS save DC 16 "and the target
// gains 1 Exhaustion level". The canonical CONDITION grant could never carry
// it (exhaustion is LEVEL-based, absent from the CONDITIONS word list —
// §239 fingerprint, zero exhaustionLevel/meta/log state on failed saves).
// parseExhaustionLevelClause (inline buildAbilitySaveRollContext arm,
// MA-0711 slowedClauses twin shape) now rides the parsed level through
// saveProcessing.applyFailedSaveClauseGrants: the grant stacks the level(s)
// onto the victim's canonical runtime exhaustionLevel storage (the numeric
// key exhaustionRules/CharConditions/rest rules consume — no te, no boolean
// condition entry, NO expiry clock: RAW persistence ends only at a rest),
// stamps source+level into activeConditionMeta, and logs `condition applied`.
// Success grants nothing; every clauseless row stays byte-inert.
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

const rollExpression = vi.fn(() => ({ total: 25, rolls: [2, 6, 5, 1, 5, 6], modifier: 0 }));
vi.mock('../../services/dice/diceRoller.js', () => ({
    rollExpression: (...args) => rollExpression(...args),
}));

vi.mock('../../services/automation/common/savePrompt.js', () => ({
    createSaveListener: () => ({ promise: new Promise(() => {}) }),
}));

vi.mock('../../services/ui/logService.js', () => ({
    addEntry: (campaignName, entry) => { addEntryLogs.push(entry); return Promise.resolve(); },
}));

let csCreatures = [{ name: 'Bandit 1', type: 'npc', immunities: [] }];
vi.mock('../../services/encounters/combatData.js', () => ({
    loadCombatSummary: async () => ({ creatures: csCreatures, activeCreatureName: 'Fomorian 1' }),
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
import { parseExhaustionLevelClause } from '../../components/encounter/MonsterCardHelpers.js';
import monstersData from '../../../public/data/monsters.json';

const campaignName = 'test-campaign';
const FOMORIAN = 'Fomorian 1';
const TARGET = 'Bandit 1';

// Fomorian Warping Hex (monsters.json fomorian actions[2], byte-exact).
const hexRow = monstersData.find(m => m.index === 'fomorian').actions.find(a => a.name === 'Warping Hex');

const hexContext = {
    saveDc: 16,
    saveType: 'Wisdom',
    attackerName: FOMORIAN,
    actionName: 'Warping Hex',
    dcSuccess: 'half',
    autoDamageFormula: '6d6',
    autoDamageDamageType: 'Psychic',
    saveConditions: [],
    exhaustionLevel: parseExhaustionLevelClause(hexRow.save_effect),
};

// EB-NPC inline seam (§208/§209): non-player target → processNpcSave, total
// = effectiveD20 + bonus folded in saveProcessing.
async function resolveSave(context, { d20, bonus }) {
    return await processSaveRoll({
        rollType: 'save',
        target: { name: TARGET, type: 'npc' },
        characterName: FOMORIAN,
        campaignName,
        context: { ...context, effectiveD20: d20, effectiveBonus: bonus },
        bonus,
        r1: d20,
        r2: d20,
        logEntry: vi.fn(),
        setPopupHtml: vi.fn(),
    });
}

beforeEach(() => {
    vi.clearAllMocks();
    for (const k of Object.keys(runtimeStore)) delete runtimeStore[k];
    addEntryLogs.length = 0;
    csCreatures = [{ name: TARGET, type: 'npc', immunities: [] }];
});

describe('MA-0751 Fomorian Warping Hex exhaustion grant', () => {
    it('parse lock: save_effect arms level 1 (CONDITIONS extract stays empty)', () => {
        expect(parseExhaustionLevelClause(hexRow.save_effect)).toEqual({ effect: 'exhaustion', level: 1 });
    });

    it('failed save (total 11 < DC 16): exhaustionLevel 1 on victim + meta source/level + condition-applied log', async () => {
        const out = await resolveSave(hexContext, { d20: 16, bonus: -5 });
        expect(out.saveSuccess).toBe(false);

        expect(runtimeStore[`${TARGET}.exhaustionLevel`]).toBe(1);
        expect(runtimeStore[`${TARGET}.activeConditionMeta`]).toMatchObject({
            exhaustion: { source: FOMORIAN, level: 1 },
        });

        const grant = addEntryLogs.find(e => e.type === 'condition' && e.action === 'applied');
        expect(grant).toBeTruthy();
        expect(grant.characterName).toBe(TARGET);
        expect(grant.sourceName).toBe(FOMORIAN);
        expect(grant.sourceAbility).toBe('Warping Hex');
        expect(grant.condition).toBe('Exhaustion 1');
        expect(grant.description).toMatch(/failed Fomorian 1's Warping Hex save/i);
        expect(grant.description).toMatch(/gains 1 Exhaustion level/i);
        expect(grant.description).toMatch(/now 1\/6/);

        // exhaustion is rest-removed, not clock-expired — and it rides the
        // numeric channel, NOT a te / the boolean condition list.
        expect(addExpiration).not.toHaveBeenCalled();
        expect((runtimeStore['campaign.targetEffects'] || []).length).toBe(0);
        expect(runtimeStore[`${TARGET}.activeConditions`] || []).not.toContain('exhaustion');
    });

    it('stacks: pre-existing exhaustionLevel 2 → failed save grants level 3', async () => {
        runtimeStore[`${TARGET}.exhaustionLevel`] = 2;
        await resolveSave(hexContext, { d20: 4, bonus: -5 });
        expect(runtimeStore[`${TARGET}.exhaustionLevel`]).toBe(3);
        expect(runtimeStore[`${TARGET}.activeConditionMeta`].exhaustion).toMatchObject({ source: FOMORIAN, level: 3 });
        const grant = addEntryLogs.find(e => e.type === 'condition' && e.action === 'applied');
        expect(grant.condition).toBe('Exhaustion 3');
        expect(grant.description).toMatch(/now 3\/6/);
    });

    it('death cap: level 6 is the ceiling (5 + 1 → 6)', async () => {
        runtimeStore[`${TARGET}.exhaustionLevel`] = 5;
        await resolveSave(hexContext, { d20: 1, bonus: -5 });
        expect(runtimeStore[`${TARGET}.exhaustionLevel`]).toBe(6);
    });

    it('successful save (total 35 ≥ DC 16): half damage, ZERO exhaustion state', async () => {
        const out = await resolveSave(hexContext, { d20: 16, bonus: 19 });
        expect(out.saveSuccess).toBe(true);

        expect(runtimeStore[`${TARGET}.exhaustionLevel`]).toBeUndefined();
        expect(runtimeStore[`${TARGET}.activeConditionMeta`]).toBeUndefined();
        expect(addEntryLogs.some(e => e.type === 'condition' && e.action === 'applied')).toBe(false);
        expect(addExpiration).not.toHaveBeenCalled();
    });

    it('byte-inert: rows without the clause grant nothing even on a failed save', async () => {
        const inert = { ...hexContext, actionName: 'Stone Club', exhaustionLevel: null };
        await resolveSave(inert, { d20: 2, bonus: -5 });

        expect(runtimeStore[`${TARGET}.exhaustionLevel`]).toBeUndefined();
        expect(runtimeStore[`${TARGET}.activeConditionMeta`]).toBeUndefined();
        expect(addEntryLogs.some(e => e.type === 'condition' && e.action === 'applied')).toBe(false);
    });

    it('exhaustion-immune victim: zero grant, named advisory log', async () => {
        csCreatures = [{ name: TARGET, type: 'npc', immunities: ['Exhaustion'] }];
        await resolveSave(hexContext, { d20: 3, bonus: -5 });

        expect(runtimeStore[`${TARGET}.exhaustionLevel`]).toBeUndefined();
        expect(addEntryLogs.some(e => e.type === 'condition' && e.action === 'applied')).toBe(false);
        const advisory = addEntryLogs.find(e => e.automationType === 'exhaustion_immune_advisory');
        expect(advisory).toBeTruthy();
        expect(advisory.characterName).toBe(TARGET);
        expect(advisory.description).toMatch(/immune to Exhaustion/i);
    });
});
