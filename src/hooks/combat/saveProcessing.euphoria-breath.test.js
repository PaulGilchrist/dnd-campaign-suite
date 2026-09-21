// MA-0711: Faerie Dragon Euphoria Breath — the MA-0087 slowed-rider clause
// ("can't take reactions" → registered te no_reactions) was picker-only; the
// shapeless inline block-save row (no range, picker never opens) left ZERO
// state on a failed save (§53 MA-0090 fingerprint). The inline seam arm in
// buildAbilitySaveRollContext now rides the same parseSlowedClauses output to
// saveProcessing.applyFailedSaveClauseGrants (MA-0146 speedZeroClause
// both-seams twin shape): failed save grants the registered te with ONE
// merged §37 clock (1 minute → rounds:10) + a 'condition applied' grant log
// + a §70 GM-enforced advisory naming the d6 behavior-table/repeat-save legs
// (MA-0706 durationNote advisory precedent). Success grants nothing; rows
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
    loadCombatSummary: async () => ({ creatures: [], activeCreatureName: 'Faerie Dragon 1' }),
    getCurrentCombatRound: () => 1,
    getCombatSummary: () => null,
}));

const applyDamageToTarget = vi.fn(async (_cs, _target, finalDamage) => ({ finalDamage, newHp: 9 - finalDamage }));
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
import monstersData from '../../../public/data/monsters.json';

const campaignName = 'test-campaign';
const DRAGON = 'Faerie Dragon 1';
const TARGET = 'Bandit 1';

// Faerie Dragon Euphoria Breath (monsters.json faerie-dragon actions[1],
// byte-exact save_effect) — the slowed-clause parse arms no_reactions only
// (no Speed-halved / action-not-both regex hit).
const faerieRow = monstersData.find(m => m.index === 'faerie-dragon').actions.find(a => a.name === 'Euphoria Breath');

const euphoriaContext = {
    saveDc: 11,
    saveType: 'Wisdom',
    attackerName: DRAGON,
    actionName: 'Euphoria Breath',
    dcSuccess: 'half',
    saveConditions: [],
    slowedClauses: parseSlowedClauses(faerieRow.save_effect),
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
    pendingSaveResolve({ success, roll, total: roll, saveBonus: -5, rawRolls: [], mode: 'normal' });
    await promise;
}

beforeEach(() => {
    vi.clearAllMocks();
    for (const k of Object.keys(runtimeStore)) delete runtimeStore[k];
    addEntryLogs.length = 0;
});

describe('MA-0711 Euphoria Breath inline failed-save no_reactions te', () => {
    it('parse lock: Faerie save_effect arms no_reactions only', () => {
        expect(parseSlowedClauses(faerieRow.save_effect)).toEqual({ effects: ['no_reactions'] });
    });

    it('failed save: no_reactions te on target sourced from dragon, rounds:10 clock, grant + advisory logs', async () => {
        await resolveSave({ ...euphoriaContext }, false, 6);

        const tes = runtimeStore['campaign.targetEffects'] || [];
        expect(tes).toHaveLength(1);
        expect(tes[0]).toMatchObject({
            target: TARGET,
            effect: 'no_reactions',
            source: DRAGON,
            duration: '1_minute',
            actionName: 'Euphoria Breath',
        });

        expect(addExpiration).toHaveBeenCalledTimes(1);
        expect(addExpiration.mock.calls[0][0]).toMatchObject({
            attackerName: DRAGON,
            targetName: TARGET,
            campaignName,
            rounds: 10,
            effects: [{ type: 'remove_target_effect', effectKey: 'no_reactions', source: DRAGON, target: TARGET }],
        });

        const grant = addEntryLogs.find(e => e.type === 'condition' && e.action === 'applied');
        expect(grant).toBeTruthy();
        expect(grant.characterName).toBe(TARGET);
        expect(grant.sourceName).toBe(DRAGON);
        expect(grant.condition).toBe('No Reactions');
        expect(grant.description).toMatch(/failed Faerie Dragon 1's Euphoria Breath save/i);
        expect(grant.description).toMatch(/for 1 minute/i);

        const advisory = addEntryLogs.find(e => e.automationType === 'condition_clauses_advisory');
        expect(advisory).toBeTruthy();
        expect(advisory.characterName).toBe(TARGET);
        expect(advisory.description).toMatch(/d6 start-of-turn behavior table/i);
        expect(advisory.description).toMatch(/repeat save ending on self/i);
        expect(advisory.description).toMatch(/GM-enforced/i);
    });

    it('successful save: no te, no expiry, no grant/advisory logs (clause is Failure-only)', async () => {
        await resolveSave({ ...euphoriaContext }, true, 20);

        expect((runtimeStore['campaign.targetEffects'] || []).length).toBe(0);
        expect(addExpiration).not.toHaveBeenCalled();
        expect(addEntryLogs.some(e => e.type === 'condition' && e.action === 'applied')).toBe(false);
        expect(addEntryLogs.some(e => e.automationType === 'condition_clauses_advisory')).toBe(false);
    });

    it('rows without the clause are byte-inert: no te even on a failed save', async () => {
        const bite = { ...euphoriaContext, actionName: 'Bite', slowedClauses: null };
        await resolveSave(bite, false, 2);

        expect((runtimeStore['campaign.targetEffects'] || []).length).toBe(0);
        expect(addExpiration).not.toHaveBeenCalled();
        expect(addEntryLogs.some(e => e.automationType === 'condition_clauses_advisory')).toBe(false);
    });

    it('MA-0073-shape twin honesty: an "until next turn" clause row keeps the rounds:2 clock (Spectator Confusion Ray)', async () => {
        const spectator = {
            ...euphoriaContext,
            actionName: 'Confusion Ray',
            conditionDurationNote: 'until the end of its next turn (GM-enforced)',
        };
        await resolveSave(spectator, false, 4);

        const tes = runtimeStore['campaign.targetEffects'] || [];
        expect(tes[0]).toMatchObject({ effect: 'no_reactions', duration: 'until_end_of_next_turn' });
        expect(addExpiration.mock.calls[0][0].rounds).toBe(2);
    });
});
