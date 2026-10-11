// MA-1863: Behemoth Trumpet — the granted half of the fix. The row (now
// authored save_dc 23 + save_type Wisdom + dc_success none + save_effect
// "can't take Reactions until the end of its next turn") rides the INLINE
// block-save seam (shapeless "within 60 ft." prose — no shape token,
// breathAoeShape null, picker never opens §162/§1843 accepted degradation):
// buildAbilitySaveRollContext arms slowedClauses via parseSlowedClauses
// (MA-0711 Euphoria-Breath twin shape), and saveProcessing.grantSlowedClausesInline
// grants the registered te no_reactions on the FAIL face ONLY, drained by
// ONE merged rounds:2 clock (MA-0073 shape; consumer /next turn/ duration
// fork §216 → end-of-target's-next-turn) + `condition applied` grant log.
// Success face: zero grant, zero clock, zero grant/advisory logs. Rows
// without the clause stay byte-inert.
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

const rollExpression = vi.fn(() => ({ total: 7, rolls: [3, 4], modifier: 0 }));
vi.mock('../../services/dice/diceRoller.js', () => ({
    rollExpression: (...args) => rollExpression(...args),
}));

// NPC inline lane never opens a save prompt — static module stub suffices.
vi.mock('../../services/automation/common/savePrompt.js', () => ({
    createSaveListener: () => ({ promise: Promise.resolve({ success: true, roll: 20, total: 20, saveBonus: 0, rawRolls: [], mode: 'normal' }) }),
}));

vi.mock('../../services/ui/logService.js', () => ({
    addEntry: (campaignName, entry) => { addEntryLogs.push(entry); return Promise.resolve(); },
}));

vi.mock('../../services/encounters/combatData.js', () => ({
    loadCombatSummary: async () => ({ creatures: [], activeCreatureName: 'Behemoth 1' }),
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
import { parseSlowedClauses } from '../../components/encounter/MonsterCardHelpers.js';
import { extractConditionDurationNote } from '../../services/encounters/monsterAbilityUses.js';
import monstersData from '../../../public/data/monsters.json';

const campaignName = 'test-campaign';
const BEHEMOTH = 'Behemoth 1';
const TARGET = 'Bandit 1';

// Behemoth Trumpet (monsters.json behemoth legendary_actions[3], MA-1863 fix)
// — DC 23 Wisdom, condition-only fail face ("Costs 2 Actions" spend stays
// advisory engine-side MA-1847 floor; this file locks the SAVE adjudication).
const TRUMPET = monstersData.find(m => m.name === 'Behemoth').legendary_actions[3];

const trumpetContext = {
    saveDc: TRUMPET.save_dc,
    saveType: TRUMPET.save_type,
    attackerName: BEHEMOTH,
    actionName: TRUMPET.name,
    dcSuccess: TRUMPET.dc_success,
    saveConditions: [],
    slowedClauses: parseSlowedClauses(TRUMPET.save_effect),
    conditionDurationNote: extractConditionDurationNote(TRUMPET.save_effect),
};

async function resolveSave(context, success, roll) {
    // EB-NPC inline lane (MA-0695/§211): the dice is rolled upstream by
    // useLoggedDiceRollSaves and lands pre-stamped on context.effectiveD20 —
    // processNpcSave never creates a save-prompt listener. Bonus folded into
    // the total at processNpcSave :296: face-deterministic vs DC 23.
    const bonus = success ? 4 : 0; // nat20+4=24 ≥ 23 ✓ | nat 5+0=5 ✗
    await processSaveRoll({
        rollType: 'save',
        target: { name: TARGET, type: 'npc' },
        characterName: TARGET,
        campaignName,
        context: { ...context, effectiveD20: success ? 20 : roll, effectiveBonus: bonus },
        bonus,
        r1: success ? 20 : roll,
        r2: success ? 20 : roll,
        logEntry: vi.fn(),
        setPopupHtml: vi.fn(),
    });
}

beforeEach(() => {
    vi.clearAllMocks();
    for (const k of Object.keys(runtimeStore)) delete runtimeStore[k];
    addEntryLogs.length = 0;
});

describe('MA-1863 Behemoth Trumpet inline failed-save no_reactions te', () => {
    it('parse lock: Trumpet save_effect arms no_reactions only; save fields DC 23 Wisdom none', () => {
        expect(TRUMPET.save_dc).toBe(23);
        expect(TRUMPET.save_type).toBe('Wisdom');
        expect(TRUMPET.dc_success).toBe('none');
        expect(parseSlowedClauses(TRUMPET.save_effect)).toEqual({ effects: ['no_reactions'] });
        expect(/next turn/i.test(trumpetContext.conditionDurationNote)).toBe(true);
    });

    it('failed save: no_reactions te on target sourced from Behemoth, rounds:2 end-of-next-turn clock, grant log', async () => {
        await resolveSave({ ...trumpetContext }, false, 5);

        const tes = runtimeStore['campaign.targetEffects'] || [];
        expect(tes).toHaveLength(1);
        expect(tes[0]).toMatchObject({
            target: TARGET,
            effect: 'no_reactions',
            source: BEHEMOTH,
            duration: 'until_end_of_next_turn',
            actionName: 'Trumpet (Costs 2 Actions)',
        });

        expect(addExpiration).toHaveBeenCalledTimes(1);
        expect(addExpiration.mock.calls[0][0]).toMatchObject({
            attackerName: BEHEMOTH,
            targetName: TARGET,
            campaignName,
            rounds: 2,
            effects: [{ type: 'remove_target_effect', effectKey: 'no_reactions', source: BEHEMOTH, target: TARGET }],
        });

        const grant = addEntryLogs.find(e => e.type === 'condition' && e.action === 'applied');
        expect(grant).toBeTruthy();
        expect(grant.characterName).toBe(TARGET);
        expect(grant.sourceName).toBe(BEHEMOTH);
        expect(grant.condition).toBe('No Reactions');
        expect(grant.description).toMatch(/failed Behemoth 1's Trumpet \(Costs 2 Actions\) save/i);
        expect(grant.description).toMatch(/until the end of Bandit 1's next turn/i);
    });

    it('successful save: no te, no expiry, no grant/advisory logs (clause is Failure-only)', async () => {
        await resolveSave({ ...trumpetContext }, true, 20);

        expect((runtimeStore['campaign.targetEffects'] || []).length).toBe(0);
        expect(addExpiration).not.toHaveBeenCalled();
        expect(addEntryLogs.some(e => e.type === 'condition' && e.action === 'applied')).toBe(false);
        expect(addEntryLogs.some(e => e.automationType === 'condition_clauses_advisory')).toBe(false);
    });

    it('byte-inert: clauseless legendary sibling (Behemoth Gore) arms nothing even on a failed save', async () => {
        const gore = { ...trumpetContext, actionName: 'Gore', slowedClauses: null };
        await resolveSave(gore, false, 2);

        expect((runtimeStore['campaign.targetEffects'] || []).length).toBe(0);
        expect(addExpiration).not.toHaveBeenCalled();
        expect(addEntryLogs.some(e => e.automationType === 'condition_clauses_advisory')).toBe(false);
    });
});
