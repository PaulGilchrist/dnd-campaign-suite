// @maintained-by-ai 2026-11-26
// MA-1639: Vampire "Bite" SAVE-seam ATTACKER-RECOVER consumer — the regain
// twin of MA-1547's drain seam (saveProcessing.ma1547-draining-kiss.test.js
// harness twin; single-damage drain rows and clauseless dual-row damage legs
// are covered there and in saveProcessing.secondary-save-damage.test.js).
// processSaveRoll → applySaveDamage consumes the structured
// save_attacker_recover:{equal_to:"damage"} clause (monsters.json Vampire row:
// DC 17 CON, dc_success:"half", 1d4+4 Piercing + 3d8 Necrotic). On the dual-
// damage row BOTH riders ride the NECROTIC (secondary) pool — RAW "decreases
// by an amount equal to the Necrotic damage taken, and the vampire regains Hit
// Points equal to that amount" — fail pays full 3d8, success pays half
// (floored); the recover rider heals the ATTACKER's cs currentHp via the
// canonical applyHealingToTarget choke point (§17 monster HP truth) with the
// save_attacker_recover face log; an unresolvable attacker HP pool takes the
// save_attacker_recover_refused advisory branch (no write, honest log).
// Rows without the recover clause never heal.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import monsters from '../../../public/data/monsters.json';
import { parseSaveHpMaxReduce, parseSaveAttackerRecover, extractConditionsFromSaveEffect } from '../../components/encounter/MonsterCardHelpers.js';

const campaignName = 'test-campaign';
const VAMPIRE = 'Vampire 1';
const TARGET = 'Bandit';

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
function biteRolls(formula) {
    if (formula === '1d4 + 4') return { total: 6, rolls: [2, 0, 0], modifier: 4 };
    if (formula === '3d8') return { total: 13, rolls: [4, 5, 4], modifier: 0 };
    return null;
}
const rollExpression = vi.fn((formula) => biteRolls(formula));
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

const cs = { creatures: [] };
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

vi.mock('../../services/ui/storage.js', () => ({
    default: { set: vi.fn(), get: vi.fn(() => null) },
}));

// CANONICAL HEAL ROUTE — mocked to record every applyHealingToTarget call;
// null (unresolvable HP) mirrors the real choke point when modifyHitPoints
// cannot find the creature, driving the MA-1639 refused-advisory branch.
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

// Bite block-save context. fix#279(b) hand-mirror→disk conversion: fields now
// derive BY-name from monsters.json, keyed as buildAbilitySaveRollContext
// stamps them — saveDc :1818, saveType full word :1819 (the mirror's hand-typed
// 'CON' was LIVE DRIFT vs disk "Constitution", the fix#279 disease class; the
// consumer reads context.saveType only for log stamps + normalizeSaveType
// evasion comparisons whose te fixtures carry no saveType key → inert across
// the live branch), autoDamage primary + MA-0427 secondary transport via
// resolveSaveLegDamageFields :1827/buildSecondaryDamageTransport :1224-1225
// (autoDamageSecondaryName = row name), dcSuccess :1347 passthrough, riders via
// parseSaveHpMaxReduce :1935 / parseSaveAttackerRecover :1943 (both disk
// {equal_to:'damage'} → {equalTo:'damage'}). SYNTHETIC-BY-DESIGN: saveConditions
// stays [] — disk save_effect prerequisite prose DOES arm grappled/
// incapacitated/restrained via extractConditionsFromSaveEffect (:1829 production
// stamp, pinned live in the clauseless-row test so this attribution cannot go
// stale); this lane locks the drain+regain rider legs ONLY — condition legs
// belong to saveProcessing.failed-save-conditions.test.js. The hp_max_reduce
// ledger SHAPE rides the mock drain consumer but is owned/pinned by
// saveProcessing.ma1547-draining-kiss.test.js — here the victim's maxHp number
// is evidence only that BOTH riders rode the NECROTIC amount. The zero-face
// test likewise overrides dcSuccess to synthetic 'none' (disk arms 'half' —
// labeled by test title). fp byte-fingerprint + parse truth table: owner lane
// MonsterCardHelpers.ma1639-vampire-bite-recover.test.js (never edited here).
const BITE = monsters.find((m) => m.name === 'Vampire').actions.find((a) => a.name === 'Bite');
const biteContext = ({ saveHpMaxReduce, saveAttackerRecover, dcSuccess = BITE.dc_success } = {}) => ({
    saveDc: BITE.save_dc,
    saveType: BITE.save_type,
    attackerName: VAMPIRE,
    actionName: BITE.name,
    dcSuccess,
    autoDamageFormula: BITE.damage_dice_primary,
    autoDamageDamageType: BITE.damage_type_primary,
    autoDamageSecondaryFormula: BITE.damage_dice_secondary,
    autoDamageSecondaryName: BITE.name,
    autoDamageSecondaryDamageType: BITE.damage_type_secondary,
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
const bothRiders = () => biteContext({ saveHpMaxReduce: parseSaveHpMaxReduce(BITE), saveAttackerRecover: parseSaveAttackerRecover(BITE) });
const logsOfType = (t, at) => addEntryLogs.filter(e => e.type === t && (!at || e.automationType === at));
const saveDamageLogs = () => logsOfType('roll').filter(e => e.rollType === 'save-damage');

beforeEach(() => {
    vi.clearAllMocks();
    for (const k of Object.keys(runtimeStore)) delete runtimeStore[k];
    addEntryLogs.length = 0;
    healCalls.length = 0;
    cs.creatures = [
        { name: TARGET, type: 'npc', currentHp: 999, maxHp: 999, currentHitPoints: 999, maxHitPoints: 999 },
        { name: VAMPIRE, type: 'npc', currentHp: 150, maxHp: 195 },
    ];
});

describe('MA-1639 recover lane: rider rides the NECROTIC pool on both faces', () => {
    it('FAIL face (nat 1 bonus −19 vs DC 17): heal = secondary finalDamage 13, not the primary 6 or the 19 total', async () => {
        const out = await resolveSave(bothRiders(), { d20: 1, bonus: -19 });
        expect(out.saveSuccess).toBe(false);

        // both damage legs land full — the necrotic 13 is what the riders consume
        expect(saveDamageLogs().map(e => e.finalDamage)).toEqual([6, 13]);

        // attacker healed via the canonical choke point with the NECROTIC amount
        expect(healCalls).toEqual([{ targetName: VAMPIRE, healAmount: 13, campaignName }]);
        expect(csV().currentHp).toBe(163);

        // drain rider rode the SAME necrotic amount (ledger shape owned by MA-1547)
        expect(csB().maxHp).toBe(986);

        const recover = logsOfType('automation', 'save_attacker_recover');
        expect(recover.length).toBe(1);
        expect(recover[0].description).toMatch(/regains 13 Hit Points/);
        expect(recover[0].description).toMatch(/save failed vs DC 17/);
        expect(recover[0].description).toMatch(/150 → 163/);
    });

    it('SUCCESS face (nat 20 ≥ DC 17) pays HALF and heals HALF: floor(13/2)=6 → 150→156', async () => {
        const out = await resolveSave(bothRiders(), { d20: 20, bonus: 0 });
        expect(out.saveSuccess).toBe(true);

        expect(saveDamageLogs()[1].finalDamage).toBe(6);

        expect(healCalls).toEqual([{ targetName: VAMPIRE, healAmount: 6, campaignName }]);
        expect(csV().currentHp).toBe(156);
        expect(csB().maxHp).toBe(993);

        const recover = logsOfType('automation', 'save_attacker_recover');
        expect(recover.length).toBe(1);
        expect(recover[0].description).toMatch(/regains 6 Hit Points/);
        expect(recover[0].description).toMatch(/save succeeded vs DC 17/);
    });

    it('zero face (synthetic dc_success "none", labeled — disk arms "half"): honest zero log, no heal call, no cs writes', async () => {
        const out = await resolveSave({ ...bothRiders(), dcSuccess: 'none' }, { d20: 20, bonus: 0 });
        expect(out.saveSuccess).toBe(true);
        expect(healCalls.length).toBe(0);
        expect(csV().currentHp).toBe(150);
        const recover = logsOfType('automation', 'save_attacker_recover');
        expect(recover.length).toBe(1);
        expect(recover[0].description).toMatch(/regains 0 Hit Points/);
    });

    it('refused lane: attacker HP unresolvable in cs → no heal lands, save_attacker_recover_refused advisory instead of the success log', async () => {
        const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        try {
            cs.creatures = cs.creatures.filter(c => c.name !== VAMPIRE);
            const out = await resolveSave(bothRiders(), { d20: 1, bonus: -19 });
            expect(out.saveSuccess).toBe(false);

            // the canonical route was still attempted with the necrotic amount
            expect(healCalls).toEqual([{ targetName: VAMPIRE, healAmount: 13, campaignName }]);
            // ...but the null choke-point result swaps the face log for the advisory
            expect(logsOfType('automation', 'save_attacker_recover').length).toBe(0);
            const refused = logsOfType('automation', 'save_attacker_recover_refused');
            expect(refused.length).toBe(1);
            expect(refused[0].description).toMatch(/drained 13 Hit Points/);
            expect(refused[0].description).toMatch(/advisory only/);
            expect(errSpy).toHaveBeenCalled();
        } finally {
            errSpy.mockRestore();
        }
    });
});

describe('MA-1639 byte-inertness: no recover clause, no heal', () => {
    it('recover null (synthetic probe — disk arms the clause) + drain armed: drain lives, ZERO heal/logs', async () => {
        const out = await resolveSave(biteContext({ saveHpMaxReduce: parseSaveHpMaxReduce(BITE), saveAttackerRecover: null }), { d20: 1, bonus: -19 });
        expect(out.saveSuccess).toBe(false);
        expect(csB().maxHp).toBe(986);
        expect(healCalls.length).toBe(0);
        expect(csV().currentHp).toBe(150);
        expect(logsOfType('automation', 'save_attacker_recover').length).toBe(0);
    });

    it('fully clauseless dual-damage row: damage legs byte-identical, neither rider fires', async () => {
        // synthetic-by-design pin (biteContext header): disk save_effect prose DOES arm
        // three prerequisite conditions via the production extract — the fixture's
        // saveConditions:[] is the documented rider-only trim, never disk fidelity.
        expect(extractConditionsFromSaveEffect(BITE.save_effect)).toEqual(['grappled', 'incapacitated', 'restrained']);
        const out = await resolveSave(biteContext({}), { d20: 1, bonus: -19 });
        expect(out.saveSuccess).toBe(false);
        expect(saveDamageLogs().map(e => e.finalDamage)).toEqual([6, 13]);
        expect(csB().maxHp).toBe(999);
        expect(healCalls.length).toBe(0);
        expect(registerTargetEffect).not.toHaveBeenCalled();
        expect(logsOfType('automation', 'save_attacker_recover').length).toBe(0);
    });
});
