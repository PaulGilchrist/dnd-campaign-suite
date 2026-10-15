// @maintained-by-ai: 2026-10-14
// MA-1877: Demogorgon Tentacle — the save-FAIL-face max-HP-reduce consumer
// (§388 code-gap fix, MA-1847 §511 fail-face grant seam precedent). The row
// (monsters.json demogorgon actions[1]) now authors save_dc 23 +
// save_type Constitution + dc_success:"full" (§87: the save gates ONLY the
// non-damage rider — the attack chip pays FULL 3d12+9 Force on both faces) +
// dice-less save_effect (MA-1867 §536: zero dice+damage pool keeps the two-chip
// fork's "DC 23 Constitution" chip clickable) + save_hp_max_reduce:{equal_to:
// "damage"}. hit_hp_max_reduce STAYS OFF — the attack lane is save-blind
// (fires on every resolved hit, live-proven round 1).
// Consumer seam: processNpcSave/processPlayerSave → applySaveOutcome →
// applyAuthoredClauseGrants → applyFailedSaveClauseGrants →
// grantFailedSaveHpMaxReduce — FAIL face ONLY, consuming the click-time
// same-action damage snapshot (context.saveRiderAttackDamage: the save stamp
// replaces campaign lastAttack with a save descriptor BEFORE applySaveOutcome).
// Both-faces rows (MA-1547 Draining Kiss: autoDamageFormula set) are refused
// HERE and stay on applySaveHpMaxReduceLeg byte-identically — the guard is
// the double-pay closure (both-faces lane itself is exhaustively locked in
// saveProcessing.ma1547-draining-kiss.test.js; only the refusal pin lives
// here). Real hpMaxReduceService runs: cs maxHp drop + currentHp clamp +
// te ledger {baseMax,reduced,max} duration until_long_rest
// (LR clear rides LONG_REST_TARGET_EFFECT_CLEAR_KEYS) + hp_max_reduce face
// log + `condition applied` "Max HP Reduced"; NO addExpiration clock.
import { describe, it, expect, vi, beforeEach } from 'vitest';

const runtimeStore = {};
const addEntryLogs = [];
const logEntryLogs = [];

vi.mock('../runtime/useRuntimeState.js', () => ({
    getRuntimeValue: (name, key) => runtimeStore[`${name}.${key}`],
    setRuntimeValue: (name, key, value) => { runtimeStore[`${name}.${key}`] = value; return Promise.resolve(); },
}));

vi.mock('../../services/ui/utils.js', () => ({
    default: { guid: () => 'id-' + Math.random().toString(36).slice(2) },
}));

// Fixed 3d8 total for the MA-1547 double-pay refusal pin; the rider-only
// tentacle lane never rolls (formula-less save leg).
vi.mock('../../services/dice/diceRoller.js', () => ({
    rollExpression: () => ({ total: 20, rolls: [5, 6, 9], modifier: 0 }),
}));

// EB-NPC inline lane never opens a save prompt — static stub suffices.
vi.mock('../../services/automation/common/savePrompt.js', () => ({
    createSaveListener: () => ({ promise: Promise.resolve({ success: true, roll: 20, total: 20, saveBonus: 0, rawRolls: [], mode: 'normal' }) }),
}));

vi.mock('../../services/ui/logService.js', () => ({
    addEntry: (campaignName, entry) => { addEntryLogs.push(entry); return Promise.resolve(); },
}));

const cs = {
    creatures: [{ name: 'Bandit 1', type: 'npc', currentHp: 999, maxHp: 999, currentHitPoints: 999, maxHitPoints: 999 }],
};
vi.mock('../../services/encounters/combatData.js', () => ({
    loadCombatSummary: async () => cs,
    getCurrentCombatRound: () => 1,
    getCombatSummary: () => cs,
}));

const applyDamageToTarget = vi.fn(async (_cs, _target, dmg) => ({ finalDamage: dmg, newHp: Math.max(0, 999 - dmg) }));
vi.mock('../../services/rules/combat/applyDamage.js', () => ({
    normalizeSaveType: (t) => String(t || '').toUpperCase(),
    computeDamageAfterSave: (raw, success, dcSuccess) => (!success ? raw : dcSuccess === 'half' ? Math.floor(raw / 2) : dcSuccess === 'full' ? raw : 0),
    computeDamageAfterEvasion: (total, saveSuccess, dcSuccess, evasionActive) =>
        (evasionActive && dcSuccess === 'half') ? (saveSuccess ? 0 : Math.floor(total / 2))
            : (!saveSuccess ? total : dcSuccess === 'half' ? Math.floor(total / 2) : dcSuccess === 'full' ? total : 0),
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

const registerTargetEffect = vi.fn();
vi.mock('../../services/combat/conditions/targetEffectDefinitions.js', async (importActual) => ({
    ...(await importActual()),
    registerTargetEffect: (...args) => registerTargetEffect(...args),
}));

const storageSet = vi.fn();
vi.mock('../../services/ui/storage.js', () => ({
    default: { set: (...args) => storageSet(...args), get: vi.fn(() => null) },
}));

import { processSaveRoll } from './saveProcessing.js';
import { parseSaveHpMaxReduce } from '../../components/encounter/MonsterCardHelpers.js';
import monstersData from '../../../public/data/monsters.json';

const campaignName = 'test-campaign';
const DEMOGORGON = 'Demogorgon 1';
const TARGET = 'Bandit 1';

const TENTACLE = monstersData.find(m => m.index === 'demogorgon').actions[1];
const CTHULHU_TENTACLES = monstersData.find(m => m.index === 'cthulhu').actions[2];
const SUCCUBUS_KISS = monstersData.find(m => m.index === 'succubus').actions[3];

const bandit = cs.creatures[0];

// Rider-only composite save context exactly as buildAbilitySaveRollContext
// stamps it post-fix: saveChipPlan.formula null (riderOnly, MA-1867 §536)
// → autoDamageFormula null; saveRiderAttackDamage = the +17 chip's damage
// snapshot taken at DC-chip click.
const tentacleContext = (overrides = {}) => ({
    saveDc: TENTACLE.save_dc,
    saveType: TENTACLE.save_type,
    attackerName: DEMOGORGON,
    actionName: TENTACLE.name,
    dcSuccess: TENTACLE.dc_success,
    autoDamageFormula: null,
    autoDamageDamageType: null,
    autoDamageName: TENTACLE.name,
    saveConditions: [],
    saveHpMaxReduce: parseSaveHpMaxReduce(TENTACLE),
    saveRiderAttackDamage: 30,
    _characters: [{ name: TARGET, computedStats: { armorClass: 12 } }],
    _target: { name: TARGET, type: 'npc' },
    ...overrides,
});

async function resolveSave(context, { d20, bonus, characterName = DEMOGORGON }) {
    return await processSaveRoll({
        rollType: 'save',
        target: { name: TARGET, type: 'npc' },
        characterName,
        campaignName,
        context: { ...context, effectiveD20: d20, effectiveBonus: bonus },
        bonus,
        r1: d20,
        r2: d20,
        logEntry: (entry) => logEntryLogs.push(entry),
        setPopupHtml: vi.fn(),
    });
}

function hpMaxReduceLogs() {
    return [...addEntryLogs, ...logEntryLogs].filter(e => e.automationType === 'hp_max_reduce');
}

beforeEach(() => {
    vi.clearAllMocks();
    for (const k of Object.keys(runtimeStore)) delete runtimeStore[k];
    addEntryLogs.length = 0;
    logEntryLogs.length = 0;
    bandit.currentHp = 999; bandit.maxHp = 999;
    bandit.currentHitPoints = 999; bandit.maxHitPoints = 999;
});

describe('MA-1877 Demogorgon Tentacle data/parse lock', () => {
    it('row authors the save-gated rider shape; attack bytes byte-exact; attack lane STAYS OFF', () => {
        expect(TENTACLE.attack_bonus).toBe(17);
        expect(TENTACLE.reach).toBe('10 ft.');
        expect(TENTACLE.damage_dice_primary).toBe('3d12 + 9');
        expect(TENTACLE.damage_type_primary).toBe('Force');
        expect(TENTACLE.save_dc).toBe(23);
        expect(TENTACLE.save_type).toBe('Constitution');
        expect(TENTACLE.dc_success).toBe('full');
        expect(TENTACLE.save_hp_max_reduce).toEqual({ equal_to: 'damage' });
        // §536: dice-less save_effect keeps the rider DC chip clickable (two-chip fork)
        expect(/\d+\s*d\s*\d+/i.test(TENTACLE.save_effect)).toBe(false);
        expect(/long rest/i.test(TENTACLE.save_effect)).toBe(true);
        expect(parseSaveHpMaxReduce(TENTACLE)).toEqual({ equalTo: 'damage' });
        // hit_hp_max_reduce STAYS OFF — save-blind attack lane (§233)
        expect(TENTACLE.hit_hp_max_reduce).toBeUndefined();
    });
});

describe('MA-1877 save-FAIL face: rider pays', () => {
    it('failed CON save: max HP drops by the attack damage TAKEN + te ledger + LR-duration logs, zero save-leg damage', async () => {
        // nat 4 + 0 = 4 < 23 → failure (unproficient Bandit, §73 clean CON canvas)
        await resolveSave(tentacleContext(), { d20: 4, bonus: 0 });

        expect(registerTargetEffect).toHaveBeenCalledTimes(1);
        expect(registerTargetEffect.mock.calls[0]).toEqual([
            campaignName, TARGET, 'hp_max_reduce', DEMOGORGON,
            { baseMax: 999, reduced: 30, max: 969, duration: 'until_long_rest' },
        ]);
        expect(bandit.maxHp).toBe(969);
        expect(bandit.currentHp).toBe(969); // clamp toward the NEW max (§1489 core)
        expect(storageSet).toHaveBeenCalledWith('combatSummary', cs, campaignName);

        const face = hpMaxReduceLogs().find(e => /failed the save/i.test(e.description || ''));
        expect(face).toBeTruthy();
        expect(face.description).toMatch(/reduced by 30/i);
        expect(face.description).toMatch(/long rest/i);
        expect(face.description).toMatch(/999 → 969/);
        const grant = addEntryLogs.find(e => e.type === 'condition' && e.action === 'applied' && e.condition === 'Max HP Reduced');
        expect(grant).toBeTruthy();
        expect(grant.reason).toMatch(/30, equal to damage taken/);

        // NO clock on this rider — LR clears via the te ledger (§233)
        expect(addExpiration).not.toHaveBeenCalled();
        // rider-only save chip pays ZERO save-leg damage (§117 fork, §87 damage lives on the attack chip)
        expect(applyDamageToTarget).not.toHaveBeenCalled();
    });

    it('zero/no same-action hit: honest "No change" record, never a fabricated reduction', async () => {
        await resolveSave(tentacleContext({ saveRiderAttackDamage: null }), { d20: 4, bonus: 0 });

        expect(registerTargetEffect).not.toHaveBeenCalled();
        expect(bandit.maxHp).toBe(999);
        const zero = hpMaxReduceLogs().find(e => /No change/i.test(e.description || ''));
        expect(zero).toBeTruthy();
        expect(zero.description).toMatch(/reduced by 0/i);
    });
});

describe('MA-1877 save-SUCCESS face: rider zero-pays (§87 dc_success full)', () => {
    it('successful CON save: ZERO consumer calls, maxHp unchanged, zero ledger', async () => {
        // nat 20 + 19 = 39 ≥ 23 → success
        await resolveSave(tentacleContext(), { d20: 20, bonus: 19 });

        expect(registerTargetEffect).not.toHaveBeenCalled();
        expect(bandit.maxHp).toBe(999);
        expect(bandit.currentHp).toBe(999);
        expect(hpMaxReduceLogs()).toHaveLength(0);
        expect(addExpiration).not.toHaveBeenCalled();
        expect(addEntryLogs.some(e => e.condition === 'Max HP Reduced')).toBe(false);
        // the FULL attack damage (§87) is paid on the ATTACK chip seam —
        // the DC chip adds nothing on either face (data lock above:
        // riderOnly keeps the save leg formula-less)
        expect(applyDamageToTarget).not.toHaveBeenCalled();
    });
});

describe('MA-1877 byte-inert + double-pay closure', () => {
    it('MA-1547 refusal pin: Draining Kiss (autoDamageFormula set, both-faces lane) reduces EXACTLY once on fail — the new fail-face leg never second-pays', async () => {
        // nat 5 + 0 = 5 < 15 → failure: save leg pays FULL 3d8 (mock 20) and
        // applySaveHpMaxReduceLeg reduces max by 20 — ONCE; the fail-face leg
        // returns at its autoDamageFormula guard. (Both-faces lane behavior is
        // exhaustively locked in saveProcessing.ma1547-draining-kiss.test.js.)
        await resolveSave(tentacleContext({
            saveDc: SUCCUBUS_KISS.save_dc,
            saveType: SUCCUBUS_KISS.save_type,
            actionName: SUCCUBUS_KISS.name,
            dcSuccess: SUCCUBUS_KISS.dc_success,
            autoDamageFormula: SUCCUBUS_KISS.damage_dice_primary,
            autoDamageDamageType: 'Psychic',
            autoDamageName: SUCCUBUS_KISS.name,
            saveHpMaxReduce: parseSaveHpMaxReduce(SUCCUBUS_KISS),
        }), { d20: 5, bonus: 0, characterName: 'Succubus 1' });

        expect(applyDamageToTarget).toHaveBeenCalledTimes(1);
        expect(applyDamageToTarget.mock.calls[0][2]).toBe(20);
        expect(registerTargetEffect).toHaveBeenCalledTimes(1);
        expect(registerTargetEffect.mock.calls[0][4]).toMatchObject({ baseMax: 999, reduced: 20, max: 979 });
        expect(bandit.maxHp).toBe(979);
    });

    it('rows without the rider key stay byte-inert on fail — Cthulhu rider-only sibling AND a clauseless context (no te, no logs, max untouched)', async () => {
        expect(parseSaveHpMaxReduce(CTHULHU_TENTACLES)).toBeNull();
        const inertContexts = [
            // MA-1867 sibling: Cthulhu Tentacles (grapple composite, NO save_hp_max_reduce
            // key) — dangerous variant: damage snapshot present, rider key absent.
            tentacleContext({
                saveDc: CTHULHU_TENTACLES.save_dc,
                saveType: CTHULHU_TENTACLES.save_type,
                actionName: CTHULHU_TENTACLES.name,
                saveHpMaxReduce: parseSaveHpMaxReduce(CTHULHU_TENTACLES),
                saveRiderAttackDamage: 22,
            }),
            // Clauseless: both rider keys stripped.
            tentacleContext({ saveHpMaxReduce: null, saveRiderAttackDamage: null }),
        ];
        for (const context of inertContexts) {
            // nat 3 + 0 fails BOTH DCs (23 tentacle, 26 cthulhu) → fail face runs
            await resolveSave(context, { d20: 3, bonus: 0 });
            expect(registerTargetEffect).not.toHaveBeenCalled();
            expect(hpMaxReduceLogs()).toHaveLength(0);
            expect(bandit.maxHp).toBe(999);
            expect(bandit.currentHp).toBe(999);
        }
    });
});
