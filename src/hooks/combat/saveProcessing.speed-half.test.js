// @maintained-by-ai: 2026-10-14
// MA-0073: Adult Brass Dragon Scorching Sands — the failed-save speed_half te
// PRODUCER seam in saveProcessing (grantSpeedHalf): registry te on the target
// sourced from the attacker, duration until_end_of_next_turn with the rounds:2
// pendingExpirations clock (MA-0038 shape), plus the named grant log.
// Context is built EXACTLY as production MonsterCardModal wires it:
// speedHalf: parseSpeedHalfClause(save_effect) off the adult-brass-dragon
// disk row (DC 16 DEX, 6d8 Fire, dc_success:"none" — the ancient row's DC 20
// 8d8 twin is byte-distinct; this file pins the adult row).
// Cross-refs (do not duplicate here): parser contract →
// MonsterCardHelpers.speed-half.test.js; speed_zero twin (MA-0146/MA-2013) →
// saveProcessing.ma2013-sun-wukong-locking-word.test.js; multi-clause slowed
// modal consumer → SaveAttackAoeModal.slowed-breath.test.jsx; te consumers →
// ConditionEffectBadges + conditionEffects speed_half.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';

import { parseSpeedHalfClause, extractConditionsFromSaveEffect } from '../../components/encounter/MonsterCardHelpers.js';

const runtimeStore = {};
const addEntryLogs = [];

vi.mock('../runtime/useRuntimeState.js', () => ({
    getRuntimeValue: (name, key) => runtimeStore[`${name}.${key}`],
    setRuntimeValue: (name, key, value) => { runtimeStore[`${name}.${key}`] = value; return Promise.resolve(); },
}));

vi.mock('../../services/ui/utils.js', () => ({
    default: { guid: () => 'id-' + Math.random().toString(36).slice(2) },
}));

const rollExpression = vi.fn(() => ({ total: 30, rolls: [5, 5, 5, 5, 4, 6], modifier: 0 }));
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
    loadCombatSummary: async () => ({ creatures: [], activeCreatureName: 'Adult Brass Dragon 1' }),
    getCurrentCombatRound: () => 1,
    getCombatSummary: () => null,
}));

const applyDamageToTarget = vi.fn(async (_cs, _target, finalDamage) => ({ finalDamage, newHp: 224 - finalDamage }));
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

const campaignName = 'test-campaign';
const DRAGON = 'Adult Brass Dragon 1';
const TARGET = 'AberrantSorcerer';

// Live disk row — adult-brass-dragon Scorching Sands (legendary).
const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const SANDS = monsters
    .find((m) => m.index === 'adult-brass-dragon')
    .legendary_actions.find(a => a.name === 'Scorching Sands');

// Modal-shaped save context (MonsterCardModal inline-save builder): every
// scalar derived from the row's bytes so data drift breaks this lane loudly.
const sandsContext = {
    saveDc: SANDS.save_dc,
    saveType: SANDS.save_type,
    attackerName: DRAGON,
    actionName: SANDS.name,
    dcSuccess: SANDS.dc_success,
    autoDamageFormula: SANDS.damage_dice_primary,
    autoDamageDamageType: SANDS.damage_type_primary,
    saveConditions: extractConditionsFromSaveEffect(SANDS.save_effect),
    speedHalf: parseSpeedHalfClause(SANDS.save_effect),
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

beforeEach(() => {
    vi.clearAllMocks();
    for (const k of Object.keys(runtimeStore)) delete runtimeStore[k];
    addEntryLogs.length = 0;
});

describe('MA-0073 Scorching Sands failed-save speed_half te', () => {
    it('failed save: speed_half te on target sourced from dragon, until_end_of_next_turn, rounds:2 clock + granted log', async () => {
        // Row-contract pin: adult row untouched, clause parses to the seam's key.
        expect(SANDS).toMatchObject({
            name: 'Scorching Sands',
            save_dc: 16,
            save_type: 'Dexterity',
            dc_success: 'none',
            damage_dice_primary: '6d8',
            damage_type_primary: 'Fire',
        });
        expect(sandsContext.speedHalf).toEqual({ effect: 'speed_half' });

        await resolveSave({ ...sandsContext }, false, 8);

        // dc_success:"none" → fail takes full auto-roll damage (30 from mock).
        expect(applyDamageToTarget.mock.calls[0][2]).toBe(30);

        const tes = runtimeStore['campaign.targetEffects'] || [];
        expect(tes).toHaveLength(1);
        expect(tes[0]).toMatchObject({
            target: TARGET,
            effect: 'speed_half',
            source: DRAGON,
            duration: 'until_end_of_next_turn',
            actionName: 'Scorching Sands',
        });

        expect(addExpiration).toHaveBeenCalledTimes(1);
        expect(addExpiration.mock.calls[0][0]).toMatchObject({
            attackerName: DRAGON,
            targetName: TARGET,
            campaignName,
            rounds: 2,
            effects: [{ type: 'remove_target_effect', effectKey: 'speed_half', source: DRAGON, target: TARGET }],
        });

        const grant = addEntryLogs.find(e => e.automationType === 'speed_half_granted');
        expect(grant).toBeTruthy();
        expect(grant.characterName).toBe(TARGET);
        expect(grant.sourceName).toBe(DRAGON);
        expect(grant.description).toMatch(/Speed halved until the end of/i);
    });

    it('successful save: no te, no expiry, no grant log (clause is Failure-only)', async () => {
        await resolveSave({ ...sandsContext }, true, 20);

        expect((runtimeStore['campaign.targetEffects'] || []).length).toBe(0);
        expect(addExpiration).not.toHaveBeenCalled();
        expect(addEntryLogs.some(e => e.automationType === 'speed_half_granted')).toBe(false);
    });

    it('rows without the clause are byte-inert: no te even on a failed save', async () => {
        const claw = { ...sandsContext, actionName: 'Claw', speedHalf: parseSpeedHalfClause(undefined) };
        await resolveSave(claw, false, 3);

        expect((runtimeStore['campaign.targetEffects'] || []).length).toBe(0);
        expect(addExpiration).not.toHaveBeenCalled();
    });
});
