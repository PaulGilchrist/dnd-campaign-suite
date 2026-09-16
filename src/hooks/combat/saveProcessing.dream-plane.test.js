// MA-0107: Adult Gold Dragon lair action Dream Plane Banishment authored
// failed-save grant — distinct te `lair_dream_plane` on the target (not the
// MA-0104 `banished_demiplane` and not the PC spell `banishment`), rounds:2
// clock mirroring the verified MA-0104 shape, and a granted log stating the
// RAW initiative-count-20 expiry, contested-Charisma escape and reappearance
// as GM-enforced (no initiative lair seam §7).
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

const rollExpression = vi.fn(() => ({ total: 9, rolls: [5, 4], modifier: 0 }));
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
    loadCombatSummary: async () => ({ creatures: [], activeCreatureName: 'Adult Gold Dragon 1' }),
    getCurrentCombatRound: () => 1,
    getCombatSummary: () => null,
}));

const applyDamageToTarget = vi.fn(async (_cs, _target, finalDamage) => ({ finalDamage, newHp: 100 - finalDamage }));
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
const DRAGON = 'Adult Gold Dragon 1';
const TARGET = 'ElderPaladin';

// MA-0107 Adult Gold Dragon Dream Plane Banishment (lair save row shape —
// damageless, dc_success none, te clause armed by parseDreamPlaneBanishClause).
const dreamContext = {
    saveDc: 15,
    saveType: 'Charisma',
    attackerName: DRAGON,
    actionName: 'Dream Plane Banishment',
    dcSuccess: 'none',
    autoDamageFormula: null,
    saveConditions: [],
    dreamPlaneBanishment: { effect: 'lair_dream_plane' },
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

describe('MA-0107 Dream Plane Banishment failed-save lair_dream_plane te', () => {
    it('failed save: lair_dream_plane te on target sourced from dragon + rounds:2 clock + granted log, zero damage', async () => {
        await resolveSave({ ...dreamContext }, false, 8);

        expect(applyDamageToTarget).not.toHaveBeenCalled();

        const tes = runtimeStore['campaign.targetEffects'] || [];
        expect(tes).toHaveLength(1);
        expect(tes[0]).toMatchObject({
            target: TARGET,
            effect: 'lair_dream_plane',
            source: DRAGON,
            duration: 'until_initiative_count_20_next_round',
            actionName: 'Dream Plane Banishment',
        });

        expect(addExpiration).toHaveBeenCalledTimes(1);
        expect(addExpiration.mock.calls[0][0]).toMatchObject({
            attackerName: DRAGON,
            targetName: TARGET,
            campaignName,
            rounds: 2,
            effects: [{ type: 'remove_target_effect', effectKey: 'lair_dream_plane', source: DRAGON, target: TARGET }],
        });

        const grant = addEntryLogs.find(e => e.automationType === 'lair_dream_plane_granted');
        expect(grant).toBeTruthy();
        expect(grant.characterName).toBe(TARGET);
        expect(grant.sourceName).toBe(DRAGON);
        expect(grant.description).toMatch(/banished to a dream plane until the effect ends on initiative count 20 on the next round/i);
        expect(grant.description).toMatch(/contested Charisma check/i);
        expect(grant.description).toMatch(/reappearance/i);
        expect(grant.description).toMatch(/GM-enforced/);
    });

    it('successful save: no te, no expiry, no grant log, no damage — honest success is inert', async () => {
        await resolveSave({ ...dreamContext }, true, 24);

        expect((runtimeStore['campaign.targetEffects'] || []).length).toBe(0);
        expect(addExpiration).not.toHaveBeenCalled();
        expect(addEntryLogs.some(e => e.automationType === 'lair_dream_plane_granted')).toBe(false);
        expect(applyDamageToTarget).not.toHaveBeenCalled();
    });

    it('rows without the clause are byte-inert: no te even on a failed save', async () => {
        const claw = { ...dreamContext, actionName: 'Claw', dreamPlaneBanishment: null };
        await resolveSave(claw, false, 3);

        expect((runtimeStore['campaign.targetEffects'] || []).length).toBe(0);
        expect(addExpiration).not.toHaveBeenCalled();
    });

    it('never reuses sibling te keys: grant writes neither banishment nor banished_demiplane', async () => {
        await resolveSave({ ...dreamContext }, false, 4);
        const tes = runtimeStore['campaign.targetEffects'] || [];
        expect(tes.every(te => te.effect !== 'banishment' && te.effect !== 'banished_demiplane')).toBe(true);
    });
});
