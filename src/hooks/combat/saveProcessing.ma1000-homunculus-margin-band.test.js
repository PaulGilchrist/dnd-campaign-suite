// MA-1000: Homunculus Bite fail-margin bands — the rider-only composite save
// chip (MA-0560 fork, MA-1000 guard fix) rides applyDamagelessSaveConditions
// with saveConditions ['poisoned'] (shallow-band-only save_effect, MA-0639
// twin layout) + structured context.saveMargin {failsBy:5, also:'unconscious'}.
// Shallow fail (margin < 5): POISONED ONLY — the extracted word list carries
// no unconscious, so the shallow over-grant is suppressed at the source (§214).
// Deep fail (margin >= 5): applySaveMarginRider adds UNCONSCIOUS with ONE
// merged rounds:600 clock (§37/§170). Success: zero grants, zero clock.
// Wake-on-damage early-end ("ends early if the target takes any damage") is a
// §70 advisory residual — no consumer app-wide, GM-enforced, never a defect.
// The save leg pays NO damage (§410/§416): autoDamageFormula null, so no
// applyDamageToTarget call and no save-damage log on any band.
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

const rollExpression = vi.fn(() => ({ total: 5, rolls: [5], modifier: 0 }));
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
    loadCombatSummary: async () => ({ creatures: [], activeCreatureName: 'Homunculus 1' }),
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
const ATTACKER = 'Homunculus 1';
const TARGET = 'Bandit 1';

// Fixed disk row context (saveChipPlan riderOnly: saveDamageFormula null;
// buildAbilitySaveRollContext arms saveMargin + saveConditions:['poisoned']).
const biteContext = (total) => ({
    saveDc: 12,
    saveType: 'CON',
    attackerName: ATTACKER,
    actionName: 'Bite',
    dcSuccess: null,
    autoDamageFormula: null,
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
        context: biteContext(total),
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

describe('MA-1000 Homunculus Bite margin bands', () => {
    it('shallow fail, margin 3 (total 9 vs DC 12): POISONED only — no Unconscious over-grant', async () => {
        await resolveNpcSave(9);

        expect(runtimeStore[`${TARGET}.activeConditions`]).toEqual(['poisoned']);
        expect(appliedLogs().map(e => e.condition)).toEqual(['Poisoned']);
        expect(runtimeStore[`${TARGET}.activeConditionMeta`].poisoned).toMatchObject({ source: ATTACKER });
        expect(addExpiration).not.toHaveBeenCalled();
    });

    it('deep fail at the boundary, margin exactly 5 (total 7 vs DC 12): Poisoned + Unconscious', async () => {
        await resolveNpcSave(7);

        expect(runtimeStore[`${TARGET}.activeConditions`]).toEqual(['poisoned', 'unconscious']);
        const conds = appliedLogs().map(e => e.condition);
        expect(conds).toContain('Poisoned');
        expect(conds).toContain('Unconscious');
        const uncons = appliedLogs().find(e => e.condition === 'Unconscious');
        expect(uncons.description).toMatch(/failed the save by 5/);
    });

    it('deep fail beyond the band, margin 10 (nat 2 vs DC 12): Poisoned + Unconscious', async () => {
        await resolveNpcSave(2);

        expect(runtimeStore[`${TARGET}.activeConditions`]).toEqual(['poisoned', 'unconscious']);
        expect(appliedLogs().find(e => e.condition === 'Unconscious').description).toMatch(/failed the save by 10/);
    });

    it('success (total 12 vs DC 12): zero grants, zero clock, zero damage', async () => {
        await resolveNpcSave(12);

        expect(runtimeStore[`${TARGET}.activeConditions`]).toBeUndefined();
        expect(appliedLogs()).toHaveLength(0);
        expect(addExpiration).not.toHaveBeenCalled();
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

    it('condition rider pays NO damage on any band (§410/§416: dc_success semantics N/A)', async () => {
        await resolveNpcSave(2);
        await resolveNpcSave(9);

        expect(applyDamageToTarget).not.toHaveBeenCalled();
        expect(conditionLogs.filter(e => e.type === 'roll' && e.rollType === 'save-damage')).toHaveLength(0);
    });
});
