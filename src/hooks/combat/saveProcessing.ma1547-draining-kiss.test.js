// @maintained-by-ai: 2026-10-14
// MA-1547: Succubus "Draining Kiss" SAVE-SEAM consumer — the §1096 save-path
// twin of MA-1489's attack-lane hp_max_reduce seam; the authoritative save-path
// HP-max-drain service integration (service-internals unit rides along here
// until the queued hpMaxReduceService.test.js adopts it). processNpcSave →
// applySaveOutcome → applySaveDamage consumes the structured
// save_hp_max_reduce:{equal_to:"damage"} clause (monsters.json Succubus row,
// parseSaveHpMaxReduce shape {equalTo:'damage'}): on BOTH RAW faces the
// victim's max HP drops by the damage TAKEN — failure pays FULL 3d8, a save
// SUCCESS pays dc_success:"half" (floored). cs maxHp / maxHitPoints drop +
// currentHp clamp via the canonical storage.set('combatSummary') channel; the
// te ledger carries {baseMax, reduced, max}; NO addExpiration clock (RAW ends
// at greater restoration; LR restore rides the ledger). Every legacy save row
// (no key, saveHpMaxReduce null) stays byte-inert. saveProcessing.exhaustion
// .test.js harness twin.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import monsters from '../../../public/data/monsters.json';
import { parseSaveHpMaxReduce, extractConditionsFromSaveEffect } from '../../components/encounter/MonsterCardHelpers.js';

const runtimeStore = {};
const addEntryLogs = [];
const logEntry = (entry) => addEntryLogs.push(entry);

vi.mock('../runtime/useRuntimeState.js', () => ({
    getRuntimeValue: (name, key) => runtimeStore[`${name}.${key}`],
    setRuntimeValue: (name, key, value) => { runtimeStore[`${name}.${key}`] = value; return Promise.resolve(); },
}));

vi.mock('../../services/ui/utils.js', () => ({
    default: { guid: () => 'id-' + Math.random().toString(36).slice(2) },
}));

const rollExpression = vi.fn(() => ({ total: 20, rolls: [5, 8, 7], modifier: 0 }));
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
    creatures: [{ name: 'Bandit', type: 'npc', currentHp: 200, maxHp: 200, currentHitPoints: 200, maxHitPoints: 200 }],
};
vi.mock('../../services/encounters/combatData.js', () => ({
    loadCombatSummary: async () => cs,
    getCurrentCombatRound: () => 1,
    getCombatSummary: () => cs,
}));

// applyDamage.js manual mock — computeDamageAfterSave/Evasion byte-mirror the
// real semantics (half floors, 'none' zeroes, 'full' pays full), applyDamageToTarget
// records without mutating.
const applyDamageToTarget = vi.fn(async (_cs, _target, dmg) => ({ finalDamage: dmg, newHp: Math.max(0, 200 - dmg) }));
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
import { applyHpMaxReduce } from '../../services/rules/features/hpMaxReduceService.js';

const campaignName = 'test-campaign';
const SUCCUBUS = 'Succubus 1';
const TARGET = 'Bandit';

// Draining Kiss block-save context. fix#279(b) hand-mirror→disk conversion:
// this context USED to hand-mirror the Succubus row; the diff found ONE live
// drift — saveType was hand-typed 'CON' while disk carries "Constitution"
// (the CON-vs-Constitution disease fix#279 caught live; the consumer reads
// context.saveType only for log stamps + normalizeSaveType evasion/disadvantage
// comparisons whose te fixtures carry no saveType key, so the fix is inert
// across the live branch — yeti chilling-gaze precedent). Every disk-backed
// field now derives BY-name from monsters.json, keyed exactly as the
// production transport stamps: buildAbilitySaveRollContext saveDc :1818,
// saveType full word :1819, autoDamage fields via resolveSaveLegDamageFields
// :1827, saveConditions :1829 (extract = [] — no CONDITIONS word in this
// row's save_effect, pinned live in the fail-face test), rider via
// parseSaveHpMaxReduce (MonsterCardModal :1935). The saveHpMaxReduce PARAM
// stays: armed callers pass the parsed disk truth; the byte-inert test passes
// synthetic null (legacy-row probe — disk arms the key). attackerName/
// _characters/_target are runtime scenario identities, not disk bytes.
const KISS = monsters.find((m) => m.name === 'Succubus').actions.find((a) => a.name === 'Draining Kiss');
const kissContext = (saveHpMaxReduce) => ({
    saveDc: KISS.save_dc,
    saveType: KISS.save_type,
    attackerName: SUCCUBUS,
    actionName: KISS.name,
    dcSuccess: KISS.dc_success,
    autoDamageFormula: KISS.damage_dice_primary,
    autoDamageDamageType: KISS.damage_type_primary,
    saveConditions: extractConditionsFromSaveEffect(KISS.save_effect),
    saveHpMaxReduce,
    _characters: [{ name: TARGET, computedStats: { armorClass: 12 } }],
    _target: { name: TARGET, type: 'npc' },
});

async function resolveSave(context, { d20, bonus }) {
    return await processSaveRoll({
        rollType: 'save',
        target: { name: TARGET, type: 'npc' },
        characterName: SUCCUBUS,
        campaignName,
        context: { ...context, effectiveD20: d20, effectiveBonus: bonus },
        bonus,
        r1: d20,
        r2: d20,
        logEntry,
        setPopupHtml: vi.fn(),
    });
}

const csB = () => cs.creatures.find(c => c.name === TARGET);
const logsOfType = (t, at) => addEntryLogs.filter(e => e.type === t && (!at || e.automationType === at));
const saveDamageLog = () => logsOfType('roll').find(e => e.rollType === 'save-damage');
const faceLogs = () => logsOfType('automation', 'hp_max_reduce');

beforeEach(() => {
    vi.clearAllMocks();
    for (const k of Object.keys(runtimeStore)) delete runtimeStore[k];
    addEntryLogs.length = 0;
    cs.creatures = [{ name: TARGET, type: 'npc', currentHp: 200, maxHp: 200, currentHitPoints: 200, maxHitPoints: 200 }];
    rollExpression.mockReturnValue({ total: 20, rolls: [5, 8, 7], modifier: 0 });
});

describe('MA-1547 save seam — both RAW faces, ledger accumulation, legacy inert', () => {
    it('fail face pays FULL: nat 5 vs DC 15 → finalDamage 20, maxHp 200→180, ledger + face log, no clock', async () => {
        const out = await resolveSave(kissContext(parseSaveHpMaxReduce(KISS)), { d20: 5, bonus: 0 });
        expect(out.saveSuccess).toBe(false);
        expect(saveDamageLog().finalDamage).toBe(20);
        // transport-derived saveConditions pin: disk save_effect carries no
        // CONDITIONS word → extract [] (the header's inert-conditions claim, live).
        expect(extractConditionsFromSaveEffect(KISS.save_effect)).toEqual([]);

        expect(csB().maxHp).toBe(180);
        expect(csB().maxHitPoints).toBe(180);
        expect(csB().currentHp).toBe(180);
        expect(storageSet).toHaveBeenCalledWith('combatSummary', cs, campaignName);

        expect(registerTargetEffect).toHaveBeenCalledWith(campaignName, TARGET, 'hp_max_reduce', SUCCUBUS, {
            baseMax: 200, reduced: 20, max: 180, duration: 'until_long_rest',
        });
        const face = faceLogs();
        expect(face.length).toBe(1);
        expect(face[0].description).toMatch(/failed the save/i);
        expect(face[0].description).toMatch(/reduced by 20 \(equal to damage taken\): 200 → 180/);
        expect(logsOfType('condition').some(e => e.condition === 'Max HP Reduced')).toBe(true);
        expect(addExpiration).not.toHaveBeenCalled();
    });

    it('success face pays HALF: total 20 ≥ DC 15 → finalDamage floor(20/2)=10, maxHp drops by exactly 10', async () => {
        const out = await resolveSave(kissContext(parseSaveHpMaxReduce(KISS)), { d20: 20, bonus: 0 });
        expect(out.saveSuccess).toBe(true);
        expect(saveDamageLog().finalDamage).toBe(10);

        expect(csB().maxHp).toBe(190);
        expect(csB().maxHitPoints).toBe(190);
        expect(csB().currentHp).toBe(190);
        expect(registerTargetEffect).toHaveBeenCalledWith(campaignName, TARGET, 'hp_max_reduce', SUCCUBUS, {
            baseMax: 200, reduced: 10, max: 190, duration: 'until_long_rest',
        });
        const face = faceLogs();
        expect(face.length).toBe(1);
        expect(face[0].description).toMatch(/succeeded the save/i);
        expect(face[0].description).toMatch(/reduced by 10 \(equal to damage taken\): 200 → 190/);
        expect(addExpiration).not.toHaveBeenCalled();
    });

    it('odd raw halves floored: raw 21 on success → drain rides the halved 10, not the raw 21', async () => {
        rollExpression.mockReturnValue({ total: 21, rolls: [6, 8, 7], modifier: 0 });
        await resolveSave(kissContext(parseSaveHpMaxReduce(KISS)), { d20: 20, bonus: 0 });
        expect(saveDamageLog().finalDamage).toBe(10);
        expect(csB().maxHp).toBe(190);
    });

    it('standing ledger {baseMax:200,reduced:10,max:190} + failed full 20 → reduced 30, max 170', async () => {
        runtimeStore['campaign.targetEffects'] = [{ target: TARGET, effect: 'hp_max_reduce', source: SUCCUBUS, baseMax: 200, reduced: 10, max: 190 }];
        await resolveSave(kissContext(parseSaveHpMaxReduce(KISS)), { d20: 5, bonus: 0 });
        expect(csB().maxHp).toBe(170);
        expect(registerTargetEffect).toHaveBeenCalledWith(campaignName, TARGET, 'hp_max_reduce', SUCCUBUS, {
            baseMax: 200, reduced: 30, max: 170, duration: 'until_long_rest',
        });
    });

    it('byte-inert legacy row (saveHpMaxReduce null): damage lands, max untouched, zero hp_max_reduce state/logs', async () => {
        const out = await resolveSave(kissContext(null), { d20: 5, bonus: 0 });
        expect(out.saveSuccess).toBe(false);
        expect(saveDamageLog().finalDamage).toBe(20);
        expect(csB().maxHp).toBe(200);
        expect(storageSet).not.toHaveBeenCalled();
        expect(registerTargetEffect).not.toHaveBeenCalled();
        expect(faceLogs().length).toBe(0);
        expect(logsOfType('condition').some(e => e.condition === 'Max HP Reduced')).toBe(false);
    });
});

describe('MA-1547 hpMaxReduceService via save lane — PC keys, zero face, lethal clamp', () => {
    it('PC victim stamps hitPoints/currentHitPoints/hpMaxReduction (greaterRestorationHandler shape)', async () => {
        runtimeStore['Hero.hitPoints'] = 90;
        runtimeStore['Hero.currentHitPoints'] = 60;
        const ledger = await applyHpMaxReduce({ attackName: 'Draining Kiss', target: { name: 'Hero', type: 'player' }, damage: 10, combatSummary: cs, characters: [], campaignName, attackerName: SUCCUBUS, logEntry, saveOutcome: 'success' });
        expect(ledger).toEqual({ baseMax: 90, reduced: 10, max: 80 });
        expect(runtimeStore['Hero.hitPoints']).toBe(80);
        expect(runtimeStore['Hero.currentHitPoints']).toBe(60);
        expect(runtimeStore['Hero.hpMaxReduction']).toBe(10);
    });

    it('zero-damage success face still logs the equal-to-damage zero entry', async () => {
        const ledger = await applyHpMaxReduce({ attackName: 'Draining Kiss', target: { name: TARGET, type: 'npc' }, damage: 0, combatSummary: cs, characters: [], campaignName, attackerName: SUCCUBUS, logEntry, saveOutcome: 'success' });
        expect(ledger).toBe('zero');
        const zero = faceLogs();
        expect(zero.length).toBe(1);
        expect(zero[0].description).toMatch(/dealt 0 damage/);
        expect(csB().maxHp).toBe(200);
    });

    it('max reaching 0 rides the canonical lethal clamp', async () => {
        runtimeStore['campaign.targetEffects'] = [{ target: TARGET, effect: 'hp_max_reduce', source: SUCCUBUS, baseMax: 200, reduced: 195, max: 5 }];
        cs.creatures[0].maxHp = 5;
        cs.creatures[0].currentHp = 5;
        const ledger = await applyHpMaxReduce({ attackName: 'Draining Kiss', target: { name: TARGET, type: 'npc' }, damage: 20, combatSummary: cs, characters: [], campaignName, attackerName: SUCCUBUS, logEntry, saveOutcome: 'failure' });
        expect(ledger.max).toBe(-15);
        expect(csB().maxHp).toBe(0);
        expect(logsOfType('automation', 'hp_max_reduce_lethal').length).toBe(1);
        expect(applyDamageToTarget).toHaveBeenCalledWith(cs, TARGET, 5, ['Necrotic'], expect.objectContaining({ ignoreResistance: true, attackerName: SUCCUBUS }));
    });
});
