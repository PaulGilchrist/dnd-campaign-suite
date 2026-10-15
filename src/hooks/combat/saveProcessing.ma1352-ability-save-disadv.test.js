// @maintained-by-ai: 2026-10-14
// MA-1352: ability-scoped ability_save_disadvantage te on the monster-card
// save-chip seam. processNpcSave is the auto-roll path for GM-pressed DC
// chips against NPC victims (live fingerprint: roll save stamps rolls:[d20],
// mode from context.forcedMode; pre-fix the chip path NEVER consulted te —
// mode pinned 'normal' even with an active rider). The seam must force
// Disadvantage (min(r1, r2) + mode 'disadvantage') ONLY for saves of the
// te's chosen ability; every other save type stays normal, and the te is
// NOT consumed nor re-anchored (duration-anchored clock is owned by the
// hit-side producer, playbook §38). Matcher-branch coverage lives in
// targetEffectDefinitions.test.js; the hit/hit-consume seams are covered by
// handleNpcSaveDamage.ma1352 and handlePlainDamage.ma1352-pseudopod — this
// file owns ONLY the saveProcessing-side fold.
import { describe, it, expect, vi, beforeEach } from 'vitest';

const runtimeStore = {};

vi.mock('../runtime/useRuntimeState.js', () => ({
    getRuntimeValue: (name, key) => runtimeStore[`${name}.${key}`],
    setRuntimeValue: (name, key, value) => { runtimeStore[`${name}.${key}`] = value; return Promise.resolve(); },
}));

vi.mock('../../services/ui/utils.js', () => ({
    default: { guid: () => 'id-' + Math.random().toString(36).slice(2) },
}));

vi.mock('../../services/dice/diceRoller.js', () => ({
    rollExpression: () => ({ total: 5, rolls: [5], modifier: 0 }),
}));

vi.mock('../../services/automation/common/savePrompt.js', () => ({
    createSaveListener: () => ({ promise: new Promise(() => {}) }),
}));

vi.mock('../../services/ui/logService.js', () => ({
    addEntry: () => Promise.resolve(),
}));

vi.mock('../../services/encounters/combatData.js', () => ({
    loadCombatSummary: async () => ({ creatures: [], activeCreatureName: 'Psychic Gray Ooze 1' }),
    getCurrentCombatRound: () => 1,
    getCombatSummary: () => null,
}));

vi.mock('../../services/rules/combat/applyDamage.js', () => ({
    normalizeSaveType: (t) => String(t || '').toLowerCase(),
    computeDamageAfterEvasion: (total, saveSuccess) => (saveSuccess ? Math.floor(total / 2) : total),
    applyDamageToTarget: async (_cs, _t, finalDamage) => ({ finalDamage, newHp: 999 - finalDamage }),
}));

vi.mock('../../services/automation/handlers/buffs/circleOfPowerHandler.js', () => ({
    isCircleOfPowerActive: () => false,
}));

vi.mock('../../services/combat/automation/automationService.js', () => ({
    hasIgnoreResistance: vi.fn(() => false),
    playerIsImmuneToCondition: vi.fn(() => false),
}));

const addExpiration = vi.fn();
vi.mock('../../services/rules/effects/expirationQueue.js', () => ({
    addExpiration: (...args) => addExpiration(...args),
}));

import { processSaveRoll } from './saveProcessing.js';

const campaignName = 'test-campaign';
const ATTACKER = 'Psychic Gray Ooze 1';
const TARGET = 'Bandit 1';

const te = (ability, target = TARGET) => ([{
    target,
    effect: 'ability_save_disadvantage',
    source: ATTACKER,
    duration: 'until_start_of_next_turn',
    ability,
}]);

// Fixed disk row context (Psychic Crush DC chip: save_type 'Intelligence'
// full word, DC 10, "Failure: 3d8 Psychic" → dc_success 'none' per
// monsters.json; chip ctx carries effectiveD20 = r1 alongside r1/r2).
const crushContext = (saveType) => ({
    saveDc: 10,
    saveType,
    attackerName: ATTACKER,
    actionName: 'Psychic Crush',
    dcSuccess: 'none',
    autoDamageFormula: '3d8',
    autoDamageDamageType: 'Psychic',
    saveConditions: [],
    effectiveBonus: 0,
});

async function resolveNpcSave(saveType, r1, r2) {
    const logEntry = vi.fn();
    const result = await processSaveRoll({
        rollType: 'save',
        target: { name: TARGET, type: 'npc' },
        characterName: TARGET,
        campaignName,
        context: { ...crushContext(saveType), effectiveD20: r1 },
        bonus: 0,
        r1,
        r2,
        logEntry,
        setPopupHtml: vi.fn(),
    });
    return { result, logEntry };
}

beforeEach(() => {
    vi.clearAllMocks();
    for (const k of Object.keys(runtimeStore)) delete runtimeStore[k];
});

describe('MA-1352 ability_save_disadvantage on the NPC save-chip seam', () => {
    it('Intelligence save with active INT te: min(r1, r2) in both dice orders, mode disadvantage, te + expiry untouched', async () => {
        runtimeStore['campaign.targetEffects'] = te('int');

        const higherFirst = await resolveNpcSave('Intelligence', 15, 6);
        expect(higherFirst.result.effectiveD20ForSave).toBe(6);
        expect(higherFirst.logEntry.mock.calls[0][0]).toMatchObject({ type: 'roll', rollType: 'save', mode: 'disadvantage' });

        const lowerFirst = await resolveNpcSave('Intelligence', 4, 17);
        expect(lowerFirst.result.effectiveD20ForSave).toBe(4);
        expect(lowerFirst.logEntry.mock.calls[0][0]).toMatchObject({ mode: 'disadvantage' });

        // Non-consuming: the te survives the resolve and this seam never
        // re-registers its attacker-anchored expiration clock.
        expect(runtimeStore['campaign.targetEffects']).toEqual(te('int'));
        expect(addExpiration).not.toHaveBeenCalled();
    });

    it('inert lanes stay normal mode, r1 wins: no te, mismatched ability, mismatched target', async () => {
        const noTe = await resolveNpcSave('Intelligence', 15, 6);
        expect(noTe.result.effectiveD20ForSave).toBe(15);
        expect(noTe.logEntry.mock.calls[0][0].mode).toBe('normal');

        runtimeStore['campaign.targetEffects'] = te('int');
        const otherAbility = await resolveNpcSave('DEX', 15, 6);
        expect(otherAbility.result.effectiveD20ForSave).toBe(15);
        expect(otherAbility.logEntry.mock.calls[0][0].mode).toBe('normal');

        runtimeStore['campaign.targetEffects'] = te('int', 'AasimarTest');
        const otherTarget = await resolveNpcSave('Intelligence', 15, 6);
        expect(otherTarget.result.effectiveD20ForSave).toBe(15);
        expect(otherTarget.logEntry.mock.calls[0][0].mode).toBe('normal');
    });
});
