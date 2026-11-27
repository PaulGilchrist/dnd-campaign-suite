// @maintained-by-ai 2026-11-26
import { describe, it, expect, vi, beforeEach } from 'vitest';

// SP-094: Protection from Evil and Good charm immunity must be enforced on the
// monster save-chip lane. saveProcessing threads the attacker's real creature type
// (combatSummary monsterType → resolveCreatureType) into playerIsImmuneToCondition
// and logs a refusal via logWardedConditionImmunity when the ward — not some other
// immunity — is what blocked the condition. Generic failed-save legs live in
// saveProcessing.failed-save-conditions.test.js; the PFEG immunity FORMULA is owned
// by services/combat/automation/automationImmunities.test.js; aura split logic is
// owned by the auraConditionImmunity tests — this file keeps only the processSaveRoll
// ward seam: per-condition suppression, refusal-gate branches, and grant passthrough.

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

// Stand-in for automationImmunities.playerIsImmuneToCondition (the real formula
// is pinned at the services level): raw immunities match, OR PFEG buff active AND
// condition charmed/frightened AND attacker type warded. This seam asserts only
// what processSaveRoll DOES with the verdict, never the mock's internals.
const WARDED = ['Aberration', 'Celestial', 'Elemental', 'Fey', 'Fiend', 'Undead'];
vi.mock('../../services/combat/automation/automationService.js', () => ({
    hasIgnoreResistance: () => false,
    playerIsImmuneToCondition: ({ conditionKey, playerStats, sourceCreatureType }) => {
        const low = String(conditionKey || '').toLowerCase();
        if (Array.isArray(playerStats?.immunities) &&
            playerStats.immunities.some(i => String(i).toLowerCase() === low)) return true;
        const buffs = runtimeStore[`${playerStats?.name}.activeBuffs`] || [];
        if (!buffs.some(b => b.effect === 'protection_from_evil_and_good')) return false;
        if (low !== 'charmed' && low !== 'frightened') return false;
        return WARDED.some(t => t.toLowerCase() === String(sourceCreatureType || '').toLowerCase());
    },
}));

import { processSaveRoll } from './saveProcessing.js';

const campaignName = 'test-campaign';

function resetState() {
    for (const k of Object.keys(runtimeStore)) delete runtimeStore[k];
    entries.length = 0;
}

function seedWard() {
    runtimeStore['War_Cleric.activeBuffs'] = [{ name: 'Protection from Evil and Good', effect: 'protection_from_evil_and_good' }];
    // Real logWardedConditionImmunity reads this persisted key (handler's
    // protectionFromEvilAndGoodWardedTypes) before logging the refusal.
    runtimeStore['War_Cleric.protectionFromEvilAndGoodWardedTypes'] = WARDED;
}

async function resolveFailedSave(attackerName, saveConditions = ['charmed'], immunities = []) {
    const promise = processSaveRoll({
        rollType: 'save',
        target: { name: 'War_Cleric', type: 'player' },
        characterName: 'War_Cleric',
        campaignName,
        context: {
            saveDc: 15, saveType: 'CHA', attackerName,
            actionName: 'Charm', dcSuccess: 'none',
            autoDamageFormula: null, saveConditions,
            // SP-094: the modal save builder threads _characters so targetStats
            // resolves and immunity can fire on this lane.
            _characters: [{ name: 'War_Cleric', computedStats: { name: 'War_Cleric', immunities } }],
        },
        logEntry: () => {},
        setPopupHtml: vi.fn(),
    });
    pendingSaveResolve({ success: false, roll: 1, total: 7, saveBonus: 6, rawRolls: [], mode: 'normal' });
    await promise;
}

beforeEach(resetState);

describe('SP-094 PFEG charm immunity on monster save-chip lane', () => {
    it('fiend attacker: failed charm save is blocked, no condition, ward refusal logged', async () => {
        seedWard();
        await resolveFailedSave('Succubus 1');

        expect(runtimeStore['War_Cleric.activeConditions']).toBeUndefined();
        expect(entries.some(e => e.type === 'condition' && e.action === 'applied')).toBe(false);
        const blocked = entries.find(e => e.type === 'automation blocked');
        expect(blocked).toMatchObject({ characterName: 'War_Cleric', sourceName: 'Succubus 1', abilityName: 'Charm' });
        // Real logWardedConditionImmunity formats the condition, resolved attacker
        // type (monsterType → resolveCreatureType) and ward attribution verbatim.
        expect(blocked.description).toContain("can't be Charmed by Succubus 1 (Fiend) — Protection from Evil and Good");
    });

    it('humanoid attacker: charm is not warded, condition still lands', async () => {
        seedWard();
        await resolveFailedSave('Bandit 1');

        expect(runtimeStore['War_Cleric.activeConditions']).toEqual(['charmed']);
        expect(entries.some(e => e.type === 'automation blocked')).toBe(false);
    });

    // Multi-condition row: immunity/ward is PER-CONDITION (mirroring the aura split),
    // never a whole-row veto and never positional — checking only applicable[0] both
    // suppressed a sibling behind a warded first condition (hag's Curse "Charmed and
    // Poisoned", extractConditionsFromSaveEffect order) and leaked a warded second
    // condition past the row. RAW: the ward blocks only charmed/frightened; poisoned
    // still lands with its normal condition log, in either authored order.
    it('multi-condition row: ward blocks only charmed, poisoned still lands in either order', async () => {
        for (const saveConditions of [['charmed', 'poisoned'], ['poisoned', 'charmed']]) {
            resetState();
            seedWard();
            await resolveFailedSave('Succubus 1', saveConditions);

            expect(runtimeStore['War_Cleric.activeConditions']).toEqual(['poisoned']);
            // The warded condition keeps its single `automation blocked` row…
            const blocked = entries.filter(e => e.type === 'automation blocked');
            expect(blocked).toHaveLength(1);
            expect(blocked[0]).toMatchObject({ characterName: 'War_Cleric', sourceName: 'Succubus 1' });
            // …and the surviving condition applies + logs like a normal grant.
            const applied = entries.find(e => e.type === 'condition' && e.action === 'applied');
            expect(applied).toMatchObject({ characterName: 'War_Cleric', condition: 'Poisoned' });
        }
    });

    // Refusal gate: a RAW immunity (not the ward) sheds the condition silently even
    // while the ward is active — logWardedConditionImmunity only fires when the
    // ward's own warded-types list actually covers the attacker. Humanoid attacker is
    // outside the ward, so the charmed drop must log no `automation blocked` row,
    // while the sibling poisoned still grants.
    it('raw immunity sheds charmed silently: ward active but attacker type unwarded logs no refusal', async () => {
        seedWard();
        await resolveFailedSave('Bandit 1', ['charmed', 'poisoned'], ['charmed']);

        expect(runtimeStore['War_Cleric.activeConditions']).toEqual(['poisoned']);
        expect(entries.some(e => e.type === 'automation blocked')).toBe(false);
        const applied = entries.find(e => e.type === 'condition' && e.action === 'applied');
        expect(applied).toMatchObject({ characterName: 'War_Cleric', condition: 'Poisoned' });
    });
});
