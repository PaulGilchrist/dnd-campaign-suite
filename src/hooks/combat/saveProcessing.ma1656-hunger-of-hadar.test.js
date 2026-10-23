// @maintained-by-ai: 2026-10-14
// MA-1656: Vampire Umbral Lord "Hunger of Hadar" SAVE-seam consumer lock.
// Row data (monsters.json actions[3]): DEX save DC 18, dc_success:"none",
// damage_dice_primary 4d6 Acid, save_effect Blinded (GM-enforced while inside
// the sphere). NPC chip lane: processSaveRoll → applySaveDamage — FAIL pays
// the FULL 4d6 Acid AND grants Blinded; SUCCESS honors dc_success:"none":
// the inline seam still emits the honest zero-damage save-damage entry with
// NO hp_change and NO condition. Generic damageless/condition legs live in
// saveProcessing.failed-save-conditions.test.js — only this row's both-faces
// damage+condition combination is locked here (pre-fix MA-1546 zero-state
// fingerprint dropped: the disk row now carries the pool + save_effect).
// saveProcessing.ma1639-vampire-bite-recover.test.js harness twin.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import monsters from '../../../public/data/monsters.json';
import { extractConditionsFromSaveEffect } from '../../components/encounter/MonsterCardHelpers.js';

const campaignName = 'test-campaign';
const VAMPIRE = 'Vampire Umbral Lord 1';
const TARGET = 'Bandit 1';

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
vi.mock('../../services/dice/diceRoller.js', () => ({
    rollExpression: vi.fn((formula) => formula === '4d6' ? { total: 11, rolls: [2, 3, 4, 2], modifier: 0 } : null),
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

// applyDamage.js manual mock — byte-mirrors the real semantics
// ('none' zeroes the success face, fail pays full).
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

import { processSaveRoll } from './saveProcessing.js';

// Block-save context. fix#279(b) hand-mirror→disk conversion, ZERO-DRIFT
// confirm: byte-diff of the hand mirror vs the monsters.json BY-name row
// (Vampire Umbral Lord → Hunger of Hadar) found NO drift — every field
// already matched disk (save_dc 18, save_type full word "Dexterity", authored
// dc_success:"none" — no half-default leak, damage_dice_primary '4d6' Acid,
// save_effect arms exactly ['blinded']). The conversion is therefore inert-safe
// by the consumer input-set fix#280 used: saveProcessing reads saveDc (the
// comparator), saveType (log stamps + normalizeSaveType evasion comparisons —
// no evasion/te fixtures here), dcSuccess, autoDamageFormula/DamageType and
// saveConditions (:1240/:1652 fail-face grant — ['blinded'] live-proven below),
// so re-sourcing identical bytes changes no outcome. Keyed as production
// stamps them: buildAbilitySaveRollContext saveDc :1818, saveType :1819,
// autoDamage fields :1827, saveConditions :1829 extractConditionsFromSaveEffect.
// TARGET cs state + attacker instance name are runtime scenario fixtures.
const HADAR = monsters.find((m) => m.name === 'Vampire Umbral Lord').actions.find((a) => a.name === 'Hunger of Hadar');
const hungerContext = () => ({
    saveDc: HADAR.save_dc,
    saveType: HADAR.save_type,
    attackerName: VAMPIRE,
    actionName: HADAR.name,
    dcSuccess: HADAR.dc_success,
    autoDamageFormula: HADAR.damage_dice_primary,
    autoDamageDamageType: HADAR.damage_type_primary,
    saveConditions: extractConditionsFromSaveEffect(HADAR.save_effect),
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

const csTarget = () => cs.creatures.find(c => c.name === TARGET);
const saveDamageLogs = () => gmLog.filter(e => e.type === 'roll' && e.rollType === 'save-damage');

beforeEach(() => {
    vi.clearAllMocks();
    for (const k of Object.keys(runtimeStore)) delete runtimeStore[k];
    addEntryLogs.length = 0;
    gmLog.length = 0;
    cs.creatures = [
        { name: TARGET, type: 'npc', currentHp: 999, maxHp: 999 },
        { name: VAMPIRE, type: 'npc', currentHp: 187, maxHp: 187 },
    ];
});

describe('MA-1656 FAIL face: full 4d6 Acid + Blinded on failed DEX save', () => {
    it('nat 5 bonus −19 vs DC 18: victim save-failure log, save-damage 11 Acid, hp 999→988, Blinded granted + logged', async () => {
        const out = await resolveSave({ d20: 5, bonus: -19 });
        expect(out.saveSuccess).toBe(false);

        const victim = gmLog.filter(e => e.type === 'roll' && e.rollType === 'save' && e.characterName === TARGET);
        expect(victim).toHaveLength(1);
        expect(victim[0]).toMatchObject({ saveDc: 18, saveType: 'Dexterity', saveResult: 'failure' });

        const dmg = saveDamageLogs();
        expect(dmg).toHaveLength(1);
        expect(dmg[0]).toMatchObject({ formula: '4d6', damageType: 'Acid', total: 11, finalDamage: 11, targetName: TARGET });
        expect(applyDamageToTarget).toHaveBeenCalledTimes(1);
        expect(csTarget().currentHp).toBe(988);

        expect(runtimeStore[`${TARGET}.activeConditions`]).toEqual(['blinded']);
        expect(runtimeStore[`${TARGET}.activeConditionMeta`].blinded.source).toBe(VAMPIRE);
        expect(addEntryLogs.filter(e => e.type === 'condition')).toMatchObject([
            { type: 'condition', action: 'applied', characterName: TARGET, condition: 'Blinded', sourceName: VAMPIRE },
        ]);
    });
});

describe('MA-1656 SUCCESS face: dc_success "none" pays ZERO (spell authority)', () => {
    it('nat 20 bonus +5 ≥ DC 18: zero-damage save-damage entry, hp unchanged, NO condition', async () => {
        const out = await resolveSave({ d20: 20, bonus: 5 });
        expect(out.saveSuccess).toBe(true);

        const dmg = saveDamageLogs();
        expect(dmg).toHaveLength(1);
        expect(dmg[0]).toMatchObject({ total: 0, finalDamage: 0, saveSuccess: true });
        expect(csTarget().currentHp).toBe(999);

        expect(runtimeStore[`${TARGET}.activeConditions`]).toBeUndefined();
        expect(addEntryLogs.filter(e => e.type === 'condition')).toHaveLength(0);
    });
});
