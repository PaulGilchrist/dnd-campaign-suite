// MA-1351: Pseudodragon Sting fail-margin bands on the DAMAGE-BEARING save
// leg — unlike the MA-0639/MA-1000 rider-only composites (save chip pays no
// damage), Sting's save adjudicates its own 2d4 Poison pool (live proof:
// "DC/half-damage core correct"), so the DC chip routes applySaveOutcome →
// applySaveDamage. The structured context.saveMargin rider must fire there too:
// shallow fail (margin < 5): POISONED ONLY; deep fail (margin >= 5):
// applySaveMarginRider adds UNCONSCIOUS with ONE merged rounds:600 clock
// (§37 hours×600, poisoned 1 hour). Success: half damage (dc_success absent
// → half convention), zero conditions, zero clock. Pre-fix fingerprint:
// ungated unconscious over-grant on every failed save (deep band still in
// save_effect, no save_margin key); rider-only fix without the damage-leg
// wiring flips the defect to deep-band inert — both must stay green here.
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

const rollExpression = vi.fn(() => ({ total: 5, rolls: [2, 3], modifier: 0 }));
vi.mock('../../services/dice/diceRoller.js', () => ({
    rollExpression: (...args) => rollExpression(...args),
}));

vi.mock('../../services/automation/common/savePrompt.js', () => ({
    createSaveListener: () => ({ promise: new Promise(() => {}) }),
}));

vi.mock('../../services/ui/logService.js', () => ({
    addEntry: (campaignName, entry) => { conditionLogs.push(entry); return Promise.resolve(); },
}));

vi.mock('../../services/encounters/combatData.js', () => ({
    loadCombatSummary: async () => ({ creatures: [], activeCreatureName: 'Pseudodragon 1' }),
    getCurrentCombatRound: () => 1,
    getCombatSummary: () => null,
}));

const applyDamageToTarget = vi.fn(async (_cs, _target, finalDamage) => ({ finalDamage, newHp: 999 - finalDamage }));
vi.mock('../../services/rules/combat/applyDamage.js', () => ({
    normalizeSaveType: (t) => String(t || '').toLowerCase(),
    computeDamageAfterEvasion: (total, saveSuccess) => (saveSuccess ? Math.floor(total / 2) : total),
    applyDamageToTarget: (...args) => applyDamageToTarget(...args),
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
const ATTACKER = 'Pseudodragon 1';
const TARGET = 'Bandit 1';

// Fixed disk row context (DC chip on the damage-bearing save row:
// autoDamageFormula '2d4' rides applySaveOutcome → applySaveDamage;
// buildAbilitySaveRollContext arms saveMargin + saveConditions:['poisoned']
// from the truncated shallow-band save_effect).
const stingContext = (total) => ({
    saveDc: 12,
    saveType: 'CON',
    attackerName: ATTACKER,
    actionName: 'Sting',
    dcSuccess: 'half',
    autoDamageFormula: '2d4',
    autoDamageDamageType: 'Poison',
    saveConditions: ['poisoned'],
    saveMargin: { failsBy: 5, also: 'unconscious' },
    effectiveD20: total,
    effectiveBonus: 0,
});

async function resolveNpcSave(total) {
    await processSaveRoll({
        rollType: 'save',
        target: { name: TARGET, type: 'npc' },
        characterName: TARGET,
        campaignName,
        context: stingContext(total),
        bonus: 0,
        r1: total,
        r2: null,
        logEntry: vi.fn(),
        setPopupHtml: vi.fn(),
    });
}

const appliedLogs = () => conditionLogs.filter(e => e.type === 'condition' && e.action === 'applied');

beforeEach(() => {
    vi.clearAllMocks();
    for (const k of Object.keys(runtimeStore)) delete runtimeStore[k];
    conditionLogs.length = 0;
});

describe('MA-1351 Pseudodragon Sting margin bands (damage-bearing save leg)', () => {
    it('shallow fail by 4 (total 8 vs DC 12): POISONED only — no Unconscious over-grant', async () => {
        await resolveNpcSave(8);

        expect(runtimeStore[`${TARGET}.activeConditions`]).toEqual(['poisoned']);
        expect(appliedLogs().map(e => e.condition)).toEqual(['Poisoned']);
        expect(runtimeStore[`${TARGET}.activeConditionMeta`].poisoned).toMatchObject({ source: ATTACKER });
        expect(addExpiration).not.toHaveBeenCalled();
    });

    it('shallow fail by 1 (total 11 vs DC 12): poisoned only', async () => {
        await resolveNpcSave(11);

        expect(runtimeStore[`${TARGET}.activeConditions`]).toEqual(['poisoned']);
        expect(appliedLogs().map(e => e.condition)).toEqual(['Poisoned']);
    });

    it('deep fail at the boundary, margin exactly 5 (total 7 vs DC 12): Poisoned + Unconscious', async () => {
        await resolveNpcSave(7);

        expect(runtimeStore[`${TARGET}.activeConditions`]).toEqual(['poisoned', 'unconscious']);
        const conds = appliedLogs().map(e => e.condition);
        expect(conds).toContain('Poisoned');
        expect(conds).toContain('Unconscious');
        const uncons = appliedLogs().find(e => e.condition === 'Unconscious');
        expect(uncons.sourceName).toBe(ATTACKER);
        expect(uncons.sourceAbility).toBe('Sting');
        expect(uncons.description).toMatch(/failed the save by 5/);
    });

    it('deep fail beyond the band (nat 2 vs DC 12): Poisoned + Unconscious', async () => {
        await resolveNpcSave(2);

        expect(runtimeStore[`${TARGET}.activeConditions`]).toEqual(['poisoned', 'unconscious']);
        expect(appliedLogs().find(e => e.condition === 'Unconscious').description).toMatch(/failed the save by 10/);
    });

    it('success (total 12 vs DC 12): half damage, zero conditions, zero clock', async () => {
        await resolveNpcSave(12);

        expect(runtimeStore[`${TARGET}.activeConditions`]).toBeUndefined();
        expect(appliedLogs()).toHaveLength(0);
        expect(addExpiration).not.toHaveBeenCalled();
        expect(applyDamageToTarget).toHaveBeenCalledTimes(1);
        expect(applyDamageToTarget.mock.calls[0][2]).toBe(2);
    });

    it('failed save pays the FULL 2d4 pool on the save leg (fail-by-5 face)', async () => {
        await resolveNpcSave(7);

        expect(applyDamageToTarget).toHaveBeenCalledTimes(1);
        expect(applyDamageToTarget.mock.calls[0][2]).toBe(5);
    });

    it('ONE merged addExpiration clock on the deep band: rounds:600, both legs (§37/§170)', async () => {
        await resolveNpcSave(2);

        expect(addExpiration).toHaveBeenCalledTimes(1);
        expect(addExpiration).toHaveBeenCalledWith(expect.objectContaining({
            attackerName: ATTACKER,
            targetName: TARGET,
            campaignName,
            rounds: 600,
            effects: [
                { type: 'condition', condition: 'poisoned' },
                { type: 'condition', condition: 'unconscious' },
            ],
        }));
    });

    it('byte-inert without the structured key: poisoned + full damage, no clock (legacy row)', async () => {
        await processSaveRoll({
            rollType: 'save',
            target: { name: TARGET, type: 'npc' },
            characterName: TARGET,
            campaignName,
            context: { ...stingContext(2), saveMargin: null },
            bonus: 0,
            r1: 2,
            r2: null,
            logEntry: vi.fn(),
            setPopupHtml: vi.fn(),
        });

        expect(runtimeStore[`${TARGET}.activeConditions`]).toEqual(['poisoned']);
        expect(appliedLogs().map(e => e.condition)).toEqual(['Poisoned']);
        expect(addExpiration).not.toHaveBeenCalled();
        expect(applyDamageToTarget).toHaveBeenCalledTimes(1);
    });
});
