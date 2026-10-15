// @maintained-by-ai: 2026-10-14
// MA-0751 save-side exhaustion seam: Fomorian Warping Hex — failed WIS save
// DC 16 "and the target gains 1 Exhaustion level". exhaustion is LEVEL-based
// (stackable to 6, rest-removed), absent from the CONDITIONS word list, so
// the canonical CONDITION grant can never carry it. saveProcessing
// .applyFailedSaveClauseGrants rides the parsed context.exhaustionLevel
// (parse + buildAbilitySaveRollContext threading pinned in
// MonsterCardHelpers.exhaustion-clause.test.js) onto the victim's canonical
// runtime exhaustionLevel storage (the numeric key exhaustionRules /
// CharConditions / rest rules consume — no te, no boolean condition entry,
// NO expiry clock: RAW persistence ends only at a rest), stamps source+level
// into activeConditionMeta, and logs `condition applied`. Success grants
// nothing; clauseless rows and exhaustion-immune victims stay inert.
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

vi.mock('../../services/dice/diceRoller.js', () => ({
    rollExpression: vi.fn(() => ({ total: 25, rolls: [2, 6, 5, 1, 5, 6], modifier: 0 })),
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

vi.mock('../../services/rules/combat/applyDamage.js', () => ({
    normalizeSaveType: (t) => String(t || '').toUpperCase(),
    computeDamageAfterSave: (raw, success, dcSuccess) => (!success ? raw : dcSuccess === 'half' ? Math.floor(raw / 2) : 0),
    computeDamageAfterEvasion: (total, saveSuccess, dcSuccess, evasionActive) =>
        (evasionActive && dcSuccess === 'half') ? (saveSuccess ? 0 : Math.floor(total / 2))
            : (!saveSuccess ? total : dcSuccess === 'half' ? Math.floor(total / 2) : 0),
    applyDamageToTarget: vi.fn(async (_cs, _target, finalDamage) => ({ finalDamage, newHp: 999 - finalDamage })),
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

// Fomorian Warping Hex context, exhaustionLevel parsed LIVE from the
// monsters.json save_effect (row parse/lock covered by the dedicated
// MonsterCardHelpers.exhaustion-clause.test.js).
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
function resolveSave({ d20, bonus }, context = hexContext) {
    return processSaveRoll({
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

const grantLogs = () => addEntryLogs.filter(e => e.type === 'condition' && e.action === 'applied');

beforeEach(() => {
    vi.clearAllMocks();
    for (const k of Object.keys(runtimeStore)) delete runtimeStore[k];
    addEntryLogs.length = 0;
    csCreatures = [{ name: TARGET, type: 'npc', immunities: [] }];
});

describe('MA-0751 Fomorian Warping Hex exhaustion grant', () => {
    it('failed save (total 11 < DC 16): level 1 on canonical numeric channel + meta + applied log, no clock/te/boolean', async () => {
        const out = await resolveSave({ d20: 16, bonus: -5 });
        expect(out.saveSuccess).toBe(false);

        expect(runtimeStore[`${TARGET}.exhaustionLevel`]).toBe(1);
        expect(runtimeStore[`${TARGET}.activeConditionMeta`]).toMatchObject({
            exhaustion: { source: FOMORIAN, level: 1 },
        });

        const [grant] = grantLogs();
        expect(grant).toMatchObject({
            characterName: TARGET,
            sourceName: FOMORIAN,
            sourceAbility: 'Warping Hex',
            condition: 'Exhaustion 1',
        });
        expect(grant.description).toMatch(/failed Fomorian 1's Warping Hex save — gains 1 Exhaustion level, now 1\/6/);

        // rest-removed, not clock-expired — and it rides the numeric channel,
        // NOT a te / the boolean condition list.
        expect(addExpiration).not.toHaveBeenCalled();
        expect((runtimeStore['campaign.targetEffects'] || []).length).toBe(0);
        expect(runtimeStore[`${TARGET}.activeConditions`] || []).not.toContain('exhaustion');
    });

    it('stacks onto existing levels and caps at 6 (2→3, 5+1→6)', async () => {
        runtimeStore[`${TARGET}.exhaustionLevel`] = 2;
        await resolveSave({ d20: 4, bonus: -5 });
        expect(runtimeStore[`${TARGET}.exhaustionLevel`]).toBe(3);
        expect(runtimeStore[`${TARGET}.activeConditionMeta`].exhaustion).toMatchObject({ source: FOMORIAN, level: 3 });
        expect(grantLogs()[0]).toMatchObject({ condition: 'Exhaustion 3' });

        runtimeStore[`${TARGET}.exhaustionLevel`] = 5;
        await resolveSave({ d20: 1, bonus: -5 });
        expect(runtimeStore[`${TARGET}.exhaustionLevel`]).toBe(6);
    });

    it('successful save (total 35 ≥ DC 16): ZERO exhaustion state', async () => {
        const out = await resolveSave({ d20: 16, bonus: 19 });
        expect(out.saveSuccess).toBe(true);

        expect(runtimeStore[`${TARGET}.exhaustionLevel`]).toBeUndefined();
        expect(runtimeStore[`${TARGET}.activeConditionMeta`]).toBeUndefined();
        expect(grantLogs()).toHaveLength(0);
        expect(addExpiration).not.toHaveBeenCalled();
    });

    it('byte-inert: clauseless row grants nothing even on a failed save', async () => {
        await resolveSave({ d20: 2, bonus: -5 }, { ...hexContext, actionName: 'Stone Club', exhaustionLevel: null });

        expect(runtimeStore[`${TARGET}.exhaustionLevel`]).toBeUndefined();
        expect(runtimeStore[`${TARGET}.activeConditionMeta`]).toBeUndefined();
        expect(grantLogs()).toHaveLength(0);
    });

    it('exhaustion-immune victim: zero grant, named advisory log', async () => {
        csCreatures = [{ name: TARGET, type: 'npc', immunities: ['Exhaustion'] }];
        await resolveSave({ d20: 3, bonus: -5 });

        expect(runtimeStore[`${TARGET}.exhaustionLevel`]).toBeUndefined();
        expect(grantLogs()).toHaveLength(0);
        const advisory = addEntryLogs.find(e => e.automationType === 'exhaustion_immune_advisory');
        expect(advisory).toMatchObject({ characterName: TARGET });
        expect(advisory.description).toMatch(/immune to Exhaustion/i);
    });
});
