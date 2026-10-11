// MA-1872: Cthulhu Madness Whisper — the adjudicated half of the fix. The
// row (now authored save_dc 24 + save_type Wisdom + damage_dice_primary 4d6
// Psychic + dc_success none + save_effect "can't take Reactions until the end
// of its next turn") rides the INLINE block-save seam (single-target "one
// creature within 120 ft." prose — no shape token, breathAoeShape null, picker
// never opens §162 accepted degradation):
//   FAIL face — applySaveDamage rolls the 4d6 pool at FULL (computeDamageAfter
//   Save raw) + grantSlowedClausesInline grants the registered te
//   no_reactions (MA-0711/MA-1863 twin), victim-anchored ONE rounds:2 clock
//   (§216 /next turn/ fork) + `condition applied` "No Reactions" grant log.
//   SUCCESS face — dc_success:"none" → ZERO damage (§63/MV-20 half-leak
//   closed; save-damage stamps finalDamage:0 with NO hp_change §335), zero te,
//   zero clock, zero grant log.
// Pre-fix the gated press delegated into Psychic Shatter's pool (live:
// INTELLIGENCE DC 24 half-on-success, 6d10 35 psychic + Stunned applied, te
// absent) — this file pins both mis-route axes closed: no 6d10 formula, no
// Stunned condition grant, on EITHER face. Rows without the clause stay
// byte-inert (Psychic Shatter control).
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

const rollExpression = vi.fn(() => ({ total: 14, rolls: [5, 4, 3, 2], modifier: 0 }));
vi.mock('../../services/dice/diceRoller.js', () => ({
    rollExpression: (...args) => rollExpression(...args),
}));

// NPC inline lane never opens a save prompt — static module stub suffices.
vi.mock('../../services/automation/common/savePrompt.js', () => ({
    createSaveListener: () => ({ promise: Promise.resolve({ success: true, roll: 20, total: 20, saveBonus: 0, rawRolls: [], mode: 'normal' }) }),
}));

vi.mock('../../services/ui/logService.js', () => ({
    addEntry: (campaignName, entry) => { addEntryLogs.push(entry); return Promise.resolve(); },
}));

vi.mock('../../services/encounters/combatData.js', () => ({
    loadCombatSummary: async () => ({ creatures: [], activeCreatureName: 'Cthulhu 1' }),
    getCurrentCombatRound: () => 1,
    getCombatSummary: () => null,
}));

const applyDamageToTarget = vi.fn(async (_cs, _target, finalDamage) => ({ finalDamage, newHp: 999 - finalDamage }));
vi.mock('../../services/rules/combat/applyDamage.js', () => ({
    normalizeSaveType: (t) => String(t || '').toUpperCase(),
    // REAL computeDamageAfterSave semantics pinned byte-for-byte (§13 §91-101):
    // fail → raw FULL; 'half' → floor; 'full' → raw; 'none'/else → ZERO.
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

import { processSaveRoll } from './saveProcessing.js';
import { parseSlowedClauses } from '../../components/encounter/MonsterCardHelpers.js';
import { extractConditionDurationNote } from '../../services/encounters/monsterAbilityUses.js';
import monstersData from '../../../public/data/monsters.json';

const campaignName = 'test-campaign';
const CTHULHU = 'Cthulhu 1';
const TARGET = 'Bandit 1';

// Cthulhu Madness Whisper (monsters.json cthulhu legendary_actions[3],
// MA-1872 fix) — DC 24 Wisdom, 4d6 Psychic fail-full/success-none, te
// no_reactions on the MA-0711 prose lane ("Costs 2 Actions" spend stays
// advisory engine-side MA-1847 floor).
const WHISPER = monstersData.find(m => m.index === 'cthulhu').legendary_actions[3];

const whisperContext = {
    saveDc: WHISPER.save_dc,
    saveType: WHISPER.save_type,
    attackerName: CTHULHU,
    actionName: WHISPER.name,
    dcSuccess: WHISPER.dc_success,
    autoDamageFormula: WHISPER.damage_dice_primary,
    autoDamageDamageType: WHISPER.damage_type_primary,
    autoDamageName: WHISPER.name,
    saveConditions: [],
    slowedClauses: parseSlowedClauses(WHISPER.save_effect),
    conditionDurationNote: extractConditionDurationNote(WHISPER.save_effect),
};

async function resolveSave(context, success, roll) {
    // EB-NPC inline lane (MA-0695/§211): the dice is rolled upstream by
    // useLoggedDiceRollSaves and lands pre-stamped on context.effectiveD20 —
    // processNpcSave never creates a save-prompt listener. DC 24 faces:
    // nat 20 + bonus 19 = 39 ≥ 24 ✓ | nat 5 + bonus 0 = 5 ✗.
    const bonus = success ? 19 : 0;
    await processSaveRoll({
        rollType: 'save',
        target: { name: TARGET, type: 'npc' },
        characterName: TARGET,
        campaignName,
        context: { ...context, effectiveD20: success ? 20 : roll, effectiveBonus: bonus },
        bonus,
        r1: success ? 20 : roll,
        r2: success ? 20 : roll,
        logEntry: (e) => logEntryLogs.push(e),
        setPopupHtml: vi.fn(),
    });
}

beforeEach(() => {
    vi.clearAllMocks();
    for (const k of Object.keys(runtimeStore)) delete runtimeStore[k];
    addEntryLogs.length = 0;
    logEntryLogs.length = 0;
});

describe('MA-1872 Cthulhu Madness Whisper save adjudication', () => {
    it('parse/field lock: DC 24 Wisdom, 4d6 Psychic, dc_success none, no_reactions te transport', () => {
        expect(WHISPER.save_dc).toBe(24);
        expect(WHISPER.save_type).toBe('Wisdom');
        expect(WHISPER.damage_dice_primary).toBe('4d6');
        expect(WHISPER.damage_type_primary).toBe('Psychic');
        expect(WHISPER.dc_success).toBe('none');
        expect(WHISPER.delegates_to).toBeUndefined();
        expect(parseSlowedClauses(WHISPER.save_effect)).toEqual({ effects: ['no_reactions'] });
        expect(/next turn/i.test(whisperContext.conditionDurationNote)).toBe(true);
    });

    it('failed WIS save: FULL 4d6 Psychic applied + te no_reactions on victim + ONE rounds:2 clock + "No Reactions" grant log', async () => {
        await resolveSave({ ...whisperContext }, false, 5);

        // damage leg: raw roll pays FULL on fail (dc_success none bites success only)
        expect(applyDamageToTarget).toHaveBeenCalled();
        const [, applyTarget, finalDamage, damageTypes] = applyDamageToTarget.mock.calls[0];
        expect(applyTarget).toBe(TARGET);
        expect(finalDamage).toBe(14);
        expect(damageTypes).toEqual(['Psychic']);
        const dmg = logEntryLogs.find(e => e.rollType === 'save-damage');
        expect(dmg).toBeTruthy();
        expect(dmg.formula).toBe('4d6');
        expect(dmg.total).toBe(14);
        expect(dmg.saveSuccess).toBe(false);
        expect(dmg.damageType).toBe('Psychic');

        // te leg: registered no_reactions, victim-anchored, MA-1863 byte-shape
        const tes = runtimeStore['campaign.targetEffects'] || [];
        expect(tes).toHaveLength(1);
        expect(tes[0]).toMatchObject({
            target: TARGET,
            effect: 'no_reactions',
            source: CTHULHU,
            duration: 'until_end_of_next_turn',
            actionName: 'Madness Whisper (Costs 2 Actions)',
        });
        expect(addExpiration).toHaveBeenCalledTimes(1);
        expect(addExpiration.mock.calls[0][0]).toMatchObject({
            attackerName: CTHULHU,
            targetName: TARGET,
            campaignName,
            rounds: 2,
            effects: [{ type: 'remove_target_effect', effectKey: 'no_reactions', source: CTHULHU, target: TARGET }],
        });
        const grant = addEntryLogs.find(e => e.type === 'condition' && e.action === 'applied');
        expect(grant).toBeTruthy();
        expect(grant.characterName).toBe(TARGET);
        expect(grant.sourceName).toBe(CTHULHU);
        expect(grant.condition).toBe('No Reactions');
        expect(grant.description).toMatch(/failed Cthulhu 1's Madness Whisper \(Costs 2 Actions\) save/i);
        expect(grant.description).toMatch(/until the end of Bandit 1's next turn/i);

        // mis-route axes stay CLOSED: no 6d10 pool, no Stunned rider (Psychic Shatter's)
        expect([...addEntryLogs, ...logEntryLogs].some(e => e.formula === '6d10')).toBe(false);
        expect(addEntryLogs.some(e => e.condition === 'Stunned')).toBe(false);
        expect(runtimeStore[`${TARGET}.activeConditions`] || []).not.toContain('stunned');
    });

    it('successful save: ZERO damage (dc_success none, §63 half-leak closed) + zero te + zero clock + zero grant log', async () => {
        await resolveSave({ ...whisperContext }, true, 20);

        expect(applyDamageToTarget).toHaveBeenCalled();
        const [, , finalDamage] = applyDamageToTarget.mock.calls[0];
        expect(finalDamage).toBe(0);
        const dmg = logEntryLogs.find(e => e.rollType === 'save-damage');
        expect(dmg).toBeTruthy();
        expect(dmg.saveSuccess).toBe(true);
        expect(dmg.total).toBe(0);
        expect(dmg.finalDamage).toBe(0);

        expect((runtimeStore['campaign.targetEffects'] || []).length).toBe(0);
        expect(addExpiration).not.toHaveBeenCalled();
        expect(addEntryLogs.some(e => e.type === 'condition' && e.action === 'applied')).toBe(false);
        expect(addEntryLogs.some(e => e.condition === 'Stunned')).toBe(false);
        expect([...addEntryLogs, ...logEntryLogs].some(e => e.formula === '6d10')).toBe(false);
    });

    it('byte-inert control: Psychic Shatter save_effect arms NO slowedClauses (its Stunned lane stays its own)', () => {
        const shatter = monstersData.find(m => m.index === 'cthulhu').actions[3];
        expect(parseSlowedClauses(shatter.save_effect)).toBeNull();
    });
});
