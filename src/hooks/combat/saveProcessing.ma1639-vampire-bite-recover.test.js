// MA-1639: Vampire "Bite" SAVE-seam ATTACKER-RECOVER consumer — the regain
// twin of MA-1547's drain seam and the MA-0651 applySummonSelfDamage pattern
// mirrored for HEALING. processSaveRoll → processNpcSave → applySaveDamage now
// consumes the structured save_attacker_recover:{equal_to:"damage"} clause
// parsed onto the block-save context. On a DUAL-damage save row the rider
// amount rides the NECROTIC (secondary) pool — RAW "decreases by an amount
// equal to the Necrotic damage taken, and the vampire regains Hit Points equal
// to that amount" — fail pays full 3d8, success pays dc_success:"half"
// (floored); the drain rider consumes the SAME amount (max HP ledger), the
// recover rider heals the ATTACKER's cs currentHp via the canonical
// applyHealingToTarget choke point (§17 monster HP truth) with the
// save_attacker_recover face log. Single-damage and clauseless rows are
// byte-inert: PRIMARY finalDamage / zero heal, zero logs.
// saveProcessing.ma1547-draining-kiss.test.js harness twin.
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

// Bite pools: PRIMARY 1d4 + 4 = 6 Piercing, SECONDARY 3d8 = 13 Necrotic.
const rollExpression = vi.fn((formula) => {
    if (formula === '1d4 + 4') return { total: 6, rolls: [2, 0, 0], modifier: 4 };
    if (formula === '3d8') return { total: 13, rolls: [4, 5, 4], modifier: 0 };
    return null;
});
vi.mock('../../services/dice/diceRoller.js', () => ({
    rollExpression: (...args) => rollExpression(...args),
    rollD20: vi.fn(() => 10),
    rollExpressionDoubled: vi.fn((f) => ({ total: 0, rolls: [], modifier: 0, formula: f })),
    parseConstant: vi.fn(),
    canRollExpression: vi.fn(() => true),
    formatDamageFormula: vi.fn((f) => f),
}));

vi.mock('../../services/automation/common/savePrompt.js', () => ({
    createSaveListener: () => ({ promise: new Promise(() => {}) }),
}));

vi.mock('../../services/ui/logService.js', () => ({
    addEntry: (campaignName, entry) => { addEntryLogs.push(entry); return Promise.resolve(); },
}));

const cs = {
    creatures: [
        { name: 'Bandit', type: 'npc', currentHp: 999, maxHp: 999, currentHitPoints: 999, maxHitPoints: 999 },
        { name: 'Vampire 1', type: 'npc', currentHp: 150, maxHp: 195 },
    ],
};
vi.mock('../../services/encounters/combatData.js', () => ({
    loadCombatSummary: async () => cs,
    getCurrentCombatRound: () => 1,
    getCombatSummary: () => cs,
}));

// applyDamage.js manual mock — computeDamageAfterSave/Evasion byte-mirror the
// real semantics (half floors, 'none' zeroes, 'full' pays full).
const applyDamageToTarget = vi.fn(async (_cs, target, dmg) => {
    const cr = _cs.creatures.find(c => c.name === target);
    if (cr) cr.currentHp = Math.max(0, Number(cr.currentHp) - dmg);
    return { finalDamage: dmg, newHp: cr ? cr.currentHp : 0 };
});
vi.mock('../../services/rules/combat/applyDamage.js', () => ({
    normalizeSaveType: (t) => String(t || '').toUpperCase(),
    computeDamageAfterSave: (raw, success, dcSuccess) => (!success ? raw : dcSuccess === 'half' ? Math.floor(raw / 2) : dcSuccess === 'full' ? raw : 0),
    computeDamageAfterEvasion: (total, saveSuccess, dcSuccess, evasionActive) => {
        if (evasionActive && dcSuccess === 'half') return saveSuccess ? 0 : Math.floor(total / 2);
        if (!saveSuccess) return total;
        if (dcSuccess === 'half') return Math.floor(total / 2);
        if (dcSuccess === 'full') return total;
        return 0;
    },
    applyDamageToTarget: (...args) => applyDamageToTarget(...args),
}));

vi.mock('../../services/automation/handlers/buffs/circleOfPowerHandler.js', () => ({
    isCircleOfPowerActive: () => false,
}));

vi.mock('../../services/combat/automation/automationService.js', () => ({
    hasIgnoreResistance: () => false,
    playerIsImmuneToCondition: () => false,
}));

vi.mock('../../services/rules/effects/expirationQueue.js', () => ({
    addExpiration: vi.fn(),
}));

const registerTargetEffect = vi.fn();
vi.mock('../../services/combat/conditions/targetEffectDefinitions.js', async (importActual) => ({
    ...(await importActual()),
    registerTargetEffect: (...args) => registerTargetEffect(...args),
}));

const storageSet = vi.fn();
vi.mock('../../services/ui/storage.js', () => ({
    default: { set: (...args) => storageSet(...args), get: vi.fn(() => null) },
}));

// CANONICAL HEAL ROUTE — mocked to record every applyHealingToTarget call.
const healCalls = [];
vi.mock('../../services/rules/combat/applyHealing.js', () => ({
    applyHealingToTarget: (combatSummary, targetName, healAmount, campaignName) => {
        healCalls.push({ targetName, healAmount, campaignName });
        const cr = combatSummary?.creatures?.find(c => c.name === targetName);
        if (!cr) return null;
        const oldHp = Number(cr.currentHp);
        const newHp = Math.min(Number(cr.maxHp), Math.max(0, oldHp + Number(healAmount)));
        cr.currentHp = newHp;
        return { actualHeal: newHp - oldHp, oldHp, newHp, maxHp: cr.maxHp };
    },
}));

import { processSaveRoll } from './saveProcessing.js';

const campaignName = 'test-campaign';
const VAMPIRE = 'Vampire 1';
const TARGET = 'Bandit';

// Bite block-save context exactly as buildAbilitySaveRollContext stamps it
// from the fixed row (dc_success:"half" + both structured riders + MA-0427
// secondary transport).
const biteContext = ({ saveHpMaxReduce, saveAttackerRecover, dcSuccess = 'half' } = {}) => ({
    saveDc: 17,
    saveType: 'CON',
    attackerName: VAMPIRE,
    actionName: 'Bite',
    dcSuccess,
    autoDamageFormula: '1d4 + 4',
    autoDamageDamageType: 'Piercing',
    autoDamageSecondaryFormula: '3d8',
    autoDamageSecondaryName: 'Bite',
    autoDamageSecondaryDamageType: 'Necrotic',
    saveConditions: [],
    saveHpMaxReduce,
    saveAttackerRecover,
    _characters: [{ name: TARGET, computedStats: { armorClass: 12 } }],
    _target: { name: TARGET, type: 'npc' },
});

async function resolveSave(context, { d20, bonus }) {
    return await processSaveRoll({
        rollType: 'save',
        target: { name: TARGET, type: 'npc' },
        characterName: VAMPIRE,
        campaignName,
        context: { ...context, effectiveD20: d20, effectiveBonus: bonus },
        bonus,
        r1: d20,
        r2: d20,
        logEntry: (entry) => addEntryLogs.push(entry),
        setPopupHtml: vi.fn(),
    });
}

const csB = () => cs.creatures.find(c => c.name === TARGET);
const csV = () => cs.creatures.find(c => c.name === VAMPIRE);
const logsOfType = (t, at) => addEntryLogs.filter(e => e.type === t && (!at || e.automationType === at));

const biteRolls = (formula) => {
    if (formula === '1d4 + 4') return { total: 6, rolls: [2, 0, 0], modifier: 4 };
    if (formula === '3d8') return { total: 13, rolls: [4, 5, 4], modifier: 0 };
    return null;
};

beforeEach(() => {
    vi.clearAllMocks();
    for (const k of Object.keys(runtimeStore)) delete runtimeStore[k];
    addEntryLogs.length = 0;
    healCalls.length = 0;
    // §45: clearAllMocks KEEPS implementations — re-stub every test.
    rollExpression.mockImplementation(biteRolls);
    cs.creatures = [
        { name: TARGET, type: 'npc', currentHp: 999, maxHp: 999, currentHitPoints: 999, maxHitPoints: 999 },
        { name: VAMPIRE, type: 'npc', currentHp: 150, maxHp: 195 },
    ];
});

describe('MA-1639 regain: FAIL face heals the attacker the FULL necrotic amount (not the total, not half)', () => {
    it('nat 1 bonus −19 vs DC 17: riderDamage = secondary finalDamage 13 → heal 13, cs 150→163, drain rides necrotic too', async () => {
        const out = await resolveSave(biteContext({ saveHpMaxReduce: { equalTo: 'damage' }, saveAttackerRecover: { equalTo: 'damage' } }), { d20: 1, bonus: -19 });
        expect(out.saveSuccess).toBe(false);

        // both damage legs land full
        const saveLogs = logsOfType('roll', null).filter(e => e.rollType === 'save-damage');
        expect(saveLogs.length).toBe(2);
        expect(saveLogs[0].finalDamage).toBe(6);
        expect(saveLogs[1].finalDamage).toBe(13);

        // attacker healed via canonical route with the NECROTIC amount
        expect(healCalls.length).toBe(1);
        expect(healCalls[0]).toEqual({ targetName: VAMPIRE, healAmount: 13, campaignName });
        expect(csV().currentHp).toBe(163);

        // drain rider rides the SAME necrotic amount (not PRIMARY 6)
        expect(csB().maxHp).toBe(986);
        expect(registerTargetEffect).toHaveBeenCalledWith(campaignName, TARGET, 'hp_max_reduce', VAMPIRE, {
            baseMax: 999, reduced: 13, max: 986, duration: 'until_long_rest',
        });

        const recover = logsOfType('automation', 'save_attacker_recover');
        expect(recover.length).toBe(1);
        expect(recover[0].description).toMatch(/regains 13 Hit Points/);
        expect(recover[0].description).toMatch(/save failed vs DC 17/);
        expect(recover[0].description).toMatch(/150 → 163/);
    });
});

describe('MA-1639 regain: SUCCESS face pays HALF and heals HALF (floored)', () => {
    it('nat 20 ≥ DC 17: secondary floor(13/2)=6 → heal 6 → 150→156, max reduce 6', async () => {
        const out = await resolveSave(biteContext({ saveHpMaxReduce: { equalTo: 'damage' }, saveAttackerRecover: { equalTo: 'damage' } }), { d20: 20, bonus: 0 });
        expect(out.saveSuccess).toBe(true);

        const saveLogs = logsOfType('roll', null).filter(e => e.rollType === 'save-damage');
        expect(saveLogs[1].finalDamage).toBe(6);

        expect(healCalls.length).toBe(1);
        expect(healCalls[0].healAmount).toBe(6);
        expect(csV().currentHp).toBe(156);
        expect(csB().maxHp).toBe(993);

        const recover = logsOfType('automation', 'save_attacker_recover');
        expect(recover.length).toBe(1);
        expect(recover[0].description).toMatch(/regains 6 Hit Points/);
        expect(recover[0].description).toMatch(/save succeeded vs DC 17/);
    });
});

describe('MA-1639 byte-inertness: rows without the structured key', () => {
    it('saveAttackerRecover null + drain armed: damage+drain live, ZERO heal/logs', async () => {
        const out = await resolveSave(biteContext({ saveHpMaxReduce: { equalTo: 'damage' }, saveAttackerRecover: null }), { d20: 1, bonus: -19 });
        expect(out.saveSuccess).toBe(false);
        expect(csB().maxHp).toBe(986);
        expect(healCalls.length).toBe(0);
        expect(csV().currentHp).toBe(150);
        expect(logsOfType('automation', 'save_attacker_recover').length).toBe(0);
    });

    it('fully clauseless dual-damage row (MA-0427 legacy): damage legs byte-identical, no riders', async () => {
        const out = await resolveSave(biteContext({}), { d20: 1, bonus: -19 });
        expect(out.saveSuccess).toBe(false);
        const saveLogs = logsOfType('roll', null).filter(e => e.rollType === 'save-damage');
        expect(saveLogs.length).toBe(2);
        expect(saveLogs[0].finalDamage).toBe(6);
        expect(saveLogs[1].finalDamage).toBe(13);
        expect(csB().maxHp).toBe(999);
        expect(healCalls.length).toBe(0);
        expect(registerTargetEffect).not.toHaveBeenCalled();
        expect(logsOfType('automation', 'save_attacker_recover').length).toBe(0);
    });

    it('single-damage succubus-shape row: rider still rides PRIMARY finalDamage byte-identically', async () => {
        rollExpression.mockImplementation((formula) => (formula === '3d8' ? { total: 13, rolls: [4, 5, 4], modifier: 0 } : null));
        const out = await resolveSave({
            saveDc: 15,
            saveType: 'CON',
            attackerName: VAMPIRE,
            actionName: 'Draining Kiss',
            dcSuccess: 'half',
            autoDamageFormula: '3d8',
            autoDamageDamageType: 'Psychic',
            saveConditions: [],
            saveHpMaxReduce: { equalTo: 'damage' },
            saveAttackerRecover: null,
            _characters: [{ name: TARGET, computedStats: { armorClass: 12 } }],
            _target: { name: TARGET, type: 'npc' },
        }, { d20: 5, bonus: 0 });
        expect(out.saveSuccess).toBe(false);
        expect(csB().maxHp).toBe(986);
        expect(healCalls.length).toBe(0);
    });
});

describe('MA-1639 zero + refusal faces', () => {
    it('zero-damage save (dc_success none on success): recover logs the honest zero entry, no cs writes', async () => {
        const out = await resolveSave(biteContext({ saveHpMaxReduce: { equalTo: 'damage' }, saveAttackerRecover: { equalTo: 'damage' }, dcSuccess: 'none' }), { d20: 20, bonus: 0 });
        expect(out.saveSuccess).toBe(true);
        expect(healCalls.length).toBe(0);
        expect(csV().currentHp).toBe(150);
        const recover = logsOfType('automation', 'save_attacker_recover');
        expect(recover.length).toBe(1);
        expect(recover[0].description).toMatch(/regains 0 Hit Points/);
    });
});
