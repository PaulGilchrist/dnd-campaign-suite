// MA-1665: Vine Blight "Entangling Plants" (actions[1]) — row-local cast-save
// lane (§MA-1656 family: ActionSaveRoll renders the DC chip, spellInfo UNDEFINED
// so findMonsterSpell is UNREACHABLE and the spells-DB axes are never pulled).
// Pre-fix the row authored save_type "Constitution" (casting-ability conflation)
// with NO save_effect/dc_success: the DC 12 chip enforced honestly but
// extractConditionsFromSaveEffect(undefined)=[] → applyDamagelessSaveConditions
// early-returned (saveProcessing.js:1047) — failed save written NOTHING
// (§52/§1092 FAIL(b)/DATA twin of MA-1546 succubus Charm). Fix rides the LIVE
// consumers with ZERO code: save_type "Strength" (RAW Entangle dc_type STR in
// BOTH spells DBs; NOT Dexterity), dc_success "none" (RAW success = nothing),
// save_effect byte-carrying the canonical word "Restrained" (MA-1546 twin
// grammar; MA-0479 Chain Devil save row) → extractConditionsFromSaveEffect →
// applyFailedSaveConditions grants + `condition applied` log (Helpers:377 /
// saveProcessing:1058/1079). save_effect carries ONLY "Restrained" — any other
// canonical word would over-grant via the whole-string word scan (§793/§1105).
// save_dc 12 + description byte-unchanged. 20-ft square zone, difficult-terrain,
// concentration and the until-spell-ends clock are clockless-grant advisories
// (§62 cube/square picker never opens; §70/§87; MA-0479/MA-1541 shape).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { extractConditionsFromSaveEffect } from '../../components/encounter/MonsterCardHelpers.js';
import { extractConditionDurationNote } from '../../services/encounters/monsterAbilityUses.js';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const VINE = monsters.find((m) => m.name === 'Vine Blight');
const ROW = VINE.actions[1];

const CANONICAL = ['blinded', 'charmed', 'cursed', 'deafened', 'frightened', 'grappled', 'incapacitated', 'paralyzed', 'petrified', 'poisoned', 'prone', 'restrained', 'stunned', 'unconscious'];

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

vi.mock('../../services/combat/conditions/targetEffectDefinitions.js', async (importActual) => ({
    ...(await importActual()),
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

const saveContext = () => ({
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
});

async function resolveSave({ d20, bonus }) {
    return await processSaveRoll({
        rollType: 'save',
        target: { name: VICTIM, type: 'npc' },
        characterName: ATTACKER,
        campaignName,
        context: { ...saveContext(), effectiveD20: d20, effectiveBonus: bonus },
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

beforeEach(() => {
    vi.clearAllMocks();
    for (const k of Object.keys(runtimeStore)) delete runtimeStore[k];
    addEntryLogs.length = 0;
    gmLog.length = 0;
    cs.creatures = [{ name: VICTIM, type: 'npc', currentHp: 999, maxHp: 999, currentHitPoints: 999, maxHitPoints: 999 }];
});

describe('MA-1665 disk fingerprint: vine-blight Entangling Plants DATA fix', () => {
    it('save_dc 12 + description byte-unchanged; save_type RAW-aligned to Strength', () => {
        expect(ROW.name).toBe('Entangling Plants');
        expect(ROW.description).toBe('The blight casts the Entangle spell, using Constitution as the spellcasting ability (spell save DC 12).');
        expect(ROW.save_dc).toBe(12);
        expect(ROW.save_type).toBe('Strength');
    });

    it('dc_success "none" authored after save_type (MA-1656 twin placement)', () => {
        expect(ROW.dc_success).toBe('none');
        const keys = Object.keys(ROW);
        expect(keys.indexOf('dc_success')).toBe(keys.indexOf('save_type') + 1);
        expect(keys.indexOf('save_effect')).toBe(keys.indexOf('dc_success') + 1);
    });

    it('save_effect byte-carries ONLY the canonical word "Restrained" — extractor yields exactly ["restrained"] (MV-31; no over-grant spray §793)', () => {
        expect(extractConditionsFromSaveEffect(ROW.save_effect)).toEqual(['restrained']);
        for (const word of CANONICAL) {
            if (word === 'restrained') continue;
            expect(ROW.save_effect).not.toMatch(new RegExp(`\\b${word}\\b`, 'i'));
        }
    });

    it('duration note rides RAW "until the spell ends" — clockless GM-enforced grant (MA-0479/MA-1541 shape)', () => {
        expect(extractConditionDurationNote(ROW.save_effect)).toBe('until the spell ends (GM-enforced)');
    });

    it('zero fabricated numerics: damageless row, no dice/zone/automation/te fields (§62/§70 advisories stay unauthored)', () => {
        expect(ROW.damage_dice_primary).toBeUndefined();
        expect(ROW.damage_type_primary).toBeUndefined();
        expect(ROW.automation).toBeUndefined();
        expect(ROW.hit_conditions).toBeUndefined();
        expect(ROW.zone).toBeUndefined();
        expect(ROW.range).toBeUndefined();
    });
});

describe('MA-1665 FAIL face: con −19 / DC 12 → Restrained granted via applyDamagelessSaveConditions', () => {
    it('nat 1 bonus −19 total −18: honest failure stamped, restrained + meta + condition log, zero damage', async () => {
        const out = await resolveSave({ d20: 1, bonus: -19 });
        expect(out.saveSuccess).toBe(false);

        const victims = victimSaveLogs();
        expect(victims.length).toBe(1);
        expect(victims[0].saveDc).toBe(12);
        expect(victims[0].saveType).toBe('Strength');
        expect(victims[0].saveResult).toBe('failure');

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

describe('MA-1665 SUCCESS face: con +19 → dc_success "none" pays nothing, zero grant', () => {
    it('nat 20 bonus +19 total 39 ≥ DC 12: no activeConditions, no condition log, zero damage', async () => {
        const out = await resolveSave({ d20: 20, bonus: 19 });
        expect(out.saveSuccess).toBe(true);

        expect(runtimeStore[`${VICTIM}.activeConditions`]).toBeUndefined();
        expect(runtimeStore[`${VICTIM}.activeConditionMeta`]).toBeUndefined();
        expect(condLogs()).toHaveLength(0);
        expect(applyDamageToTarget).not.toHaveBeenCalled();
        expect(gmLog.filter((e) => e.rollType === 'save-damage')).toHaveLength(0);
        expect(csV().currentHp).toBe(999);
    });
});

describe('MA-1665 byte-inertness: the broken pre-fix row shape (MA-1546 fingerprint)', () => {
    it('no save_effect / saveConditions [] (disk row pre-fix): failed save writes NOTHING', async () => {
        const broken = { ...saveContext(), saveConditions: [], dcSuccess: undefined };
        const out = await processSaveRoll({
            rollType: 'save',
            target: { name: VICTIM, type: 'npc' },
            characterName: ATTACKER,
            campaignName,
            context: { ...broken, effectiveD20: 1, effectiveBonus: -19 },
            bonus: -19,
            r1: 1,
            r2: 1,
            logEntry: (entry) => gmLog.push(entry),
            setPopupHtml: vi.fn(),
        });
        expect(out.saveSuccess).toBe(false);
        expect(runtimeStore[`${VICTIM}.activeConditions`]).toBeUndefined();
        expect(condLogs()).toHaveLength(0);
        expect(applyDamageToTarget).not.toHaveBeenCalled();
        expect(rollExpression).not.toHaveBeenCalled();
        expect(csV().currentHp).toBe(999);
    });
});
