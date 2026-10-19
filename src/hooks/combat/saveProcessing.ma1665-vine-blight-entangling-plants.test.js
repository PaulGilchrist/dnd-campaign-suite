// @maintained-by-ai
// MA-1665: Vine Blight "Entangling Plants" (actions[1]) — row-local cast-save
// PROCESSING lane (§MA-1656 family). Save-domain seams:
//   #847 rollConditionSaveHandler  — save ROLL UI seam (dice input, prompt)
//   #871 saveResultHandlers        — save-result tracking prompt/counters
//   THIS FILE                      — post-save RESOLUTION of the damageless row:
//                                    DC enforcement + Restrained grant on fail
//   #876 LogCondition              — condition-entry RENDER (other lane)
// Data fix (old→new): save_type "Constitution"→"Strength" (RAW Entangle dc_type
// STR in BOTH spells DBs), dc_success ""→"none", save_effect ""→canonical word
// "Restrained"; save_dc 12 + description byte-unchanged. Pre-fix the row failed
// into applyDamagelessSaveConditions with saveConditions [] → wrote NOTHING
// (§52/§1092 FAIL(b)/DATA twin of MA-1546 succubus Charm). Fix rides the LIVE
// consumers with ZERO code: extractConditionsFromSaveEffect → applyFailedSave-
// Conditions grants + `condition applied` log. save_effect carries ONLY
// "Restrained" — any other canonical word would over-grant (§793/§1105).
// clockless-grant advisories (§62/§70/§87; MA-0479/MA-1541): no dice, no zone,
// no automation fields, no timer expiry — duration is GM-enforced.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { extractConditionsFromSaveEffect } from '../../components/encounter/MonsterCardHelpers.js';
import { extractConditionDurationNote } from '../../services/encounters/monsterAbilityUses.js';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const VINE = monsters.find((m) => m.name === 'Vine Blight');
const ROW = VINE.actions[1];

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

// Damageless row: NO dice pool may ever roll (§62 no autoDamageFormula).
const rollExpression = vi.fn(() => null);
vi.mock('../../services/dice/diceRoller.js', () => ({
    rollExpression: (...args) => rollExpression(...args),
    rollD20: vi.fn(() => 10),
    rollExpressionDoubled: vi.fn((f) => ({ total: 0, rolls: [], modifier: 0, formula: f })),
    parseConstant: vi.fn(),
    canRollExpression: vi.fn(() => false),
    formatDamageFormula: vi.fn((f) => f),
}));

vi.mock('../../services/automation/common/savePrompt.js', () => ({
    createSaveListener: () => ({ promise: new Promise(() => {}) }),
}));

vi.mock('../../services/ui/logService.js', () => ({
    addEntry: (campaignName, entry) => { addEntryLogs.push(entry); return Promise.resolve(); },
}));

const cs = { creatures: [{ name: 'Bandit 1', type: 'npc', currentHp: 999, maxHp: 999, currentHitPoints: 999, maxHitPoints: 999 }] };
vi.mock('../../services/encounters/combatData.js', () => ({
    loadCombatSummary: async () => cs,
    getCurrentCombatRound: () => 1,
    getCombatSummary: () => cs,
}));

const applyDamageToTarget = vi.fn(async (_cs, target) => ({ finalDamage: 0, newHp: _cs.creatures.find((c) => c.name === target).currentHp }));
vi.mock('../../services/rules/combat/applyDamage.js', () => ({
    normalizeSaveType: (t) => String(t || '').toUpperCase(),
    computeDamageAfterSave: (raw, success, dcSuccess) => (!success ? raw : dcSuccess === 'half' ? Math.floor(raw / 2) : dcSuccess === 'full' ? raw : 0),
    computeDamageAfterEvasion: (total, saveSuccess, dcSuccess, evasionActive) => {
        if (evasionActive && dcSuccess === 'half') return saveSuccess ? 0 : Math.floor(total / 2);
        if (!saveSuccess) return total;
        if (dcSuccess === 'half') return Math.floor(total / 2);
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

vi.mock('../../services/ui/storage.js', () => ({
    default: { set: vi.fn(), get: vi.fn(() => null) },
}));

vi.mock('../../services/rules/combat/applyHealing.js', () => ({
    applyHealingToTarget: vi.fn(() => null),
}));

import { processSaveRoll } from './saveProcessing.js';

const campaignName = 'test-campaign';
const VICTIM = 'Bandit 1';
const ATTACKER = 'Vine Blight 1';

const saveContext = (overrides = {}) => ({
    saveDc: ROW.save_dc,
    saveType: ROW.save_type,
    attackerName: ATTACKER,
    actionName: ROW.name,
    dcSuccess: ROW.dc_success,
    autoDamageFormula: undefined,
    autoDamageDamageType: undefined,
    saveConditions: extractConditionsFromSaveEffect(ROW.save_effect),
    conditionDurationNote: extractConditionDurationNote(ROW.save_effect),
    _characters: [{ name: VICTIM, computedStats: { armorClass: 12 } }],
    _target: { name: VICTIM, type: 'npc' },
    ...overrides,
});

// Totals land at DC±1 so the DC 12 comparison itself is falsifiable.
async function resolveSave({ d20, bonus = 0, context = saveContext() }) {
    return await processSaveRoll({
        rollType: 'save',
        target: { name: VICTIM, type: 'npc' },
        characterName: ATTACKER,
        campaignName,
        context: { ...context, effectiveD20: d20, effectiveBonus: bonus },
        bonus,
        r1: d20,
        r2: d20,
        logEntry: (entry) => gmLog.push(entry),
        setPopupHtml: vi.fn(),
    });
}

const victimSaveLogs = () => gmLog.filter((e) => e.type === 'roll' && e.rollType === 'save' && e.characterName === VICTIM);
const condLogs = () => addEntryLogs.filter((e) => e.type === 'condition');
const csV = () => cs.creatures.find((c) => c.name === VICTIM);

const expectZeroGrant = () => {
    expect(runtimeStore[`${VICTIM}.activeConditions`]).toBeUndefined();
    expect(runtimeStore[`${VICTIM}.activeConditionMeta`]).toBeUndefined();
    expect(condLogs()).toHaveLength(0);
    expect(applyDamageToTarget).not.toHaveBeenCalled();
    expect(gmLog.filter((e) => e.rollType === 'save-damage')).toHaveLength(0);
    expect(rollExpression).not.toHaveBeenCalled();
    expect(csV().currentHp).toBe(999);
};

beforeEach(() => {
    vi.clearAllMocks();
    for (const k of Object.keys(runtimeStore)) delete runtimeStore[k];
    addEntryLogs.length = 0;
    gmLog.length = 0;
    cs.creatures = [{ name: VICTIM, type: 'npc', currentHp: 999, maxHp: 999, currentHitPoints: 999, maxHitPoints: 999 }];
});

describe('MA-1665 disk fingerprint: vine-blight Entangling Plants DATA fix', () => {
    it('row is EXACTLY the fixed shape — save_dc 12 + description unchanged, RAW Strength axis, dc_success none, save_effect only "Restrained", zero fabricated fields', () => {
        expect(ROW).toEqual({
            name: 'Entangling Plants',
            description: 'The blight casts the Entangle spell, using Constitution as the spellcasting ability (spell save DC 12).',
            save_dc: 12,
            save_type: 'Strength',
            dc_success: 'none',
            save_effect: 'Target has the Restrained condition until the spell ends. Escape: Strength (Athletics) action vs spell save DC 12. Difficult terrain and concentration clauses are GM-enforced.',
        });
        // Extractor contract on these exact bytes: exactly one canonical condition.
        expect(extractConditionsFromSaveEffect(ROW.save_effect)).toEqual(['restrained']);
        expect(extractConditionDurationNote(ROW.save_effect)).toBe('until the spell ends (GM-enforced)');
    });
});

describe('MA-1665 FAIL face: total 11 vs DC 12 → Restrained granted via applyDamagelessSaveConditions', () => {
    it('near-miss fail: honest failure stamped, restrained + meta + condition log bytes, zero damage, no dice', async () => {
        const out = await resolveSave({ d20: 11 });
        expect(out.saveSuccess).toBe(false);

        const victims = victimSaveLogs();
        expect(victims.length).toBe(1);
        expect(victims[0]).toMatchObject({ saveDc: 12, saveType: 'Strength', saveResult: 'failure' });

        expect(runtimeStore[`${VICTIM}.activeConditions`]).toEqual(['restrained']);
        expect(runtimeStore[`${VICTIM}.activeConditionMeta`].restrained.source).toBe(ATTACKER);
        expect(runtimeStore[`${VICTIM}.activeConditionMeta`].restrained.durationNote).toBe('until the spell ends (GM-enforced)');

        const cond = condLogs();
        expect(cond.length).toBe(1);
        expect(cond[0]).toMatchObject({ type: 'condition', action: 'applied', characterName: VICTIM, condition: 'Restrained', sourceName: ATTACKER, sourceAbility: 'Entangling Plants' });

        expect(applyDamageToTarget).not.toHaveBeenCalled();
        expect(gmLog.filter((e) => e.rollType === 'save-damage')).toHaveLength(0);
        expect(rollExpression).not.toHaveBeenCalled();
        expect(csV().currentHp).toBe(999);
    });
});

describe('MA-1665 zero-grant controls (same-shape pairs): nothing pays nothing', () => {
    it('save success at EXACTLY DC 12 (total 12): success logged, zero grant (dc_success "none")', async () => {
        const out = await resolveSave({ d20: 12 });
        expect(out.saveSuccess).toBe(true);

        const victims = victimSaveLogs();
        expect(victims.length).toBe(1);
        expect(victims[0]).toMatchObject({ saveDc: 12, saveType: 'Strength', saveResult: 'success' });

        expectZeroGrant();
    });

    it('pre-fix broken row (saveConditions [], dc_success undefined) failed save writes NOTHING (MA-1546 fingerprint)', async () => {
        const broken = { saveConditions: [], dcSuccess: undefined };
        const out = await resolveSave({ d20: 11, context: saveContext(broken) });
        expect(out.saveSuccess).toBe(false);
        expectZeroGrant();
    });
});
