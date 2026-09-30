// MA-1656: Vampire Umbral Lord "Hunger of Hadar" (actions[3]) SAVE-seam
// consumer lock. Row-local DATA fix (MA-0839/MA-1301 verified byte-shape):
// damage_dice_primary 4d6 + damage_type_primary Acid + dc_success "none" +
// save_effect carrying "Blinded" — harvested from the 2024 disk spell
// (DEX save, none on success, lv5 pool 4d6). The DC chip press threads
// saveChipPlan.formula → buildAbilitySaveRollContext.autoDamageFormula/
// autoDamageDamageType/saveConditions → processNpcSave → applySaveDamage:
// FAIL pays the FULL 4d6 Acid (save-damage log + cs hp_change) AND grants
// Blinded (runtime activeConditions + meta source + `condition applied`
// log, applySaveDamage:1446); SUCCESS honors dc_success:"none" — inline
// seam still emits the honest save-damage total:0 entry (§280) with ZERO
// hp_change and NO condition. Pre-fix the row authored neither pool nor
// save_effect: every face was zero-state (MA-1546 fingerprint).
// saveProcessing.ma1639-vampire-bite-recover.test.js harness twin.
import { describe, it, expect, vi, beforeEach } from 'vitest';

const runtimeStore = {};
const addEntryLogs = [];
const gmLog = [];

vi.mock('../runtime/useRuntimeState.js', () => ({
    getRuntimeValue: (name, key) => runtimeStore[`${name}.${key}`],
    setRuntimeValue: (name, key, value) => { runtimeStore[`${name}.${key}`] = value; return Promise.resolve(); },
}));

vi.mock('../../services/ui/utils.js', () => ({
    default: { guid: () => 'id-' + Math.random().toString(36).slice(2) },
}));

// Hunger pool: '4d6' → 11 (2+3+4+2).
const rollExpression = vi.fn((formula) => {
    if (formula === '4d6') return { total: 11, rolls: [2, 3, 4, 2], modifier: 0 };
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
        { name: 'Bandit 1', type: 'npc', currentHp: 999, maxHp: 999, currentHitPoints: 999, maxHitPoints: 999 },
        { name: 'Vampire Umbral Lord 1', type: 'npc', currentHp: 187, maxHp: 187 },
    ],
};
vi.mock('../../services/encounters/combatData.js', () => ({
    loadCombatSummary: async () => cs,
    getCurrentCombatRound: () => 1,
    getCombatSummary: () => cs,
}));

// applyDamage.js manual mock — computeDamageAfterEvasion byte-mirrors the
// real semantics ('none' zeroes the success face, fail pays full).
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

vi.mock('../../services/rules/combat/applyHealing.js', () => ({
    applyHealingToTarget: vi.fn(() => null),
}));

import { processSaveRoll } from './saveProcessing.js';

const campaignName = 'test-campaign';
const VAMPIRE = 'Vampire Umbral Lord 1';
const TARGET = 'Bandit 1';

// Context exactly as executeBlockSaveRoll/buildAbilitySaveRollContext stamps
// it from the fixed row (chip formula 4d6 via damage_dice_primary fallback,
// dc_success:"none" authored — no half-default leak).
const hungerContext = () => ({
    saveDc: 18,
    saveType: 'Dexterity',
    attackerName: VAMPIRE,
    actionName: 'Hunger of Hadar',
    dcSuccess: 'none',
    autoDamageFormula: '4d6',
    autoDamageDamageType: 'Acid',
    saveConditions: ['blinded'],
    _characters: [{ name: TARGET, computedStats: { armorClass: 12 } }],
    _target: { name: TARGET, type: 'npc' },
});

async function resolveSave({ d20, bonus }) {
    return await processSaveRoll({
        rollType: 'save',
        target: { name: TARGET, type: 'npc' },
        characterName: VAMPIRE,
        campaignName,
        context: { ...hungerContext(), effectiveD20: d20, effectiveBonus: bonus },
        bonus,
        r1: d20,
        r2: d20,
        logEntry: (entry) => gmLog.push(entry),
        setPopupHtml: vi.fn(),
    });
}

const csB = () => cs.creatures.find(c => c.name === TARGET);
const logsOfType = (t, at) => addEntryLogs.filter(e => e.type === t && (!at || e.automationType === at));
const saveDamageLogs = () => gmLog.filter(e => e.type === 'roll' && e.rollType === 'save-damage');
const victimSaveLogs = () => gmLog.filter(e => e.type === 'roll' && e.rollType === 'save' && e.characterName === TARGET);

beforeEach(() => {
    vi.clearAllMocks();
    for (const k of Object.keys(runtimeStore)) delete runtimeStore[k];
    addEntryLogs.length = 0;
    gmLog.length = 0;
    rollExpression.mockImplementation((formula) => (formula === '4d6' ? { total: 11, rolls: [2, 3, 4, 2], modifier: 0 } : null));
    cs.creatures = [
        { name: TARGET, type: 'npc', currentHp: 999, maxHp: 999, currentHitPoints: 999, maxHitPoints: 999 },
        { name: VAMPIRE, type: 'npc', currentHp: 187, maxHp: 187 },
    ];
});

describe('MA-1656 FAIL face: full 4d6 Acid + Blinded on failed DEX save', () => {
    it('nat 5 bonus −19 vs DC 18: save-damage 11 Acid, hp 999→988, Blinded granted + logged', async () => {
        const out = await resolveSave({ d20: 5, bonus: -19 });
        expect(out.saveSuccess).toBe(false);

        const victims = victimSaveLogs();
        expect(victims.length).toBe(1);
        expect(victims[0].saveDc).toBe(18);
        expect(victims[0].saveType).toBe('Dexterity');
        expect(victims[0].saveResult).toBe('failure');

        const dmg = saveDamageLogs();
        expect(dmg.length).toBe(1);
        expect(dmg[0].formula).toBe('4d6');
        expect(dmg[0].damageType).toBe('Acid');
        expect(dmg[0].total).toBe(11);
        expect(dmg[0].finalDamage).toBe(11);
        expect(dmg[0].targetName).toBe(TARGET);
        expect(applyDamageToTarget).toHaveBeenCalledTimes(1);
        expect(applyDamageToTarget.mock.calls[0][2]).toBe(11);
        expect(csB().currentHp).toBe(988);

        expect(runtimeStore[`${TARGET}.activeConditions`]).toEqual(['blinded']);
        expect(runtimeStore[`${TARGET}.activeConditionMeta`].blinded.source).toBe(VAMPIRE);
        const cond = logsOfType('condition');
        expect(cond.length).toBe(1);
        expect(cond[0]).toMatchObject({ type: 'condition', action: 'applied', characterName: TARGET, condition: 'Blinded', sourceName: VAMPIRE });
    });
});

describe('MA-1656 SUCCESS face: dc_success "none" pays ZERO (spell authority)', () => {
    it('nat 20 bonus +5 ≥ DC 18: zero-damage save-damage entry (§280), hp unchanged, NO condition', async () => {
        const out = await resolveSave({ d20: 20, bonus: 5 });
        expect(out.saveSuccess).toBe(true);

        const dmg = saveDamageLogs();
        expect(dmg.length).toBe(1);
        expect(dmg[0].total).toBe(0);
        expect(dmg[0].finalDamage).toBe(0);
        expect(dmg[0].dcSuccess ?? hungerContext().dcSuccess).toBe('none');
        expect(csB().currentHp).toBe(999);

        expect(runtimeStore[`${TARGET}.activeConditions`]).toBeUndefined();
        expect(logsOfType('condition')).toHaveLength(0);
    });
});

describe('MA-1656 byte-inertness: the broken pre-fix row shape', () => {
    it('no pool + no saveConditions (the disk row pre-fix): both faces zero-state', async () => {
        const broken = { ...hungerContext(), autoDamageFormula: null, autoDamageDamageType: null, saveConditions: [] };
        const out = await processSaveRoll({
            rollType: 'save',
            target: { name: TARGET, type: 'npc' },
            characterName: VAMPIRE,
            campaignName,
            context: { ...broken, effectiveD20: 5, effectiveBonus: -19 },
            bonus: -19,
            r1: 5,
            r2: 5,
            logEntry: (entry) => gmLog.push(entry),
            setPopupHtml: vi.fn(),
        });
        expect(out.saveSuccess).toBe(false);
        expect(saveDamageLogs()).toHaveLength(0);
        expect(applyDamageToTarget).not.toHaveBeenCalled();
        expect(csB().currentHp).toBe(999);
        expect(runtimeStore[`${TARGET}.activeConditions`]).toBeUndefined();
        expect(rollExpression).not.toHaveBeenCalled();
    });
});
