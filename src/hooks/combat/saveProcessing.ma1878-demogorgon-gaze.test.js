// @maintained-by-ai: 2026-10-14
// MA-1878: Demogorgon Gaze choose-or-roll-d6 variant row — the unique
// contract locked HERE (gaze generics live in the other gaze lanes:
// frightening-gaze, chilling-gaze-immunity, ma1877-tentacle).
// The row (DC 23 Wisdom, range:"120 feet", variants[] trio
// beguiling→stunned / confusing→confusion te / hypnotic→charmed, rounds:2,
// dc_success:"none") rides the INLINE block-save seam: shapeless single-
// target sighted save (Bone Naga Serpentine Gaze canonical twin, §211) —
// the fake-60-ft-Line picker is killed by the MA-1878 LOS guard in
// breathAoeShape. Post-fix the GM chooser's picked variant threads via
// buildAbilitySaveRollContext.saveVariant (pruned stamp) and the fail-face
// consumer grantSaveVariantClause registers the declared te (MA-1847/MA-0595
// byte-shape) + arms ONE merged §80 clock (rounds:2 "until start of the
// demogorgon's next turn") covering the declared conditions AND the te
// removal. Canonical conditions ride the proven saveConditions lane (§159).
// Success face is fail-only (§511): zero grants, zero clock, zero damage
// (row authors no damage_dice — applySaveDamage never runs). Rows without
// the chooser stamp stay byte-inert (§384 pin). The Confusion 1d10 behavior
// roll stays §410 GM-enforced for EB-NPC victims (TURN_START_HANDLERS
// guard).
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

vi.mock('../../services/dice/diceRoller.js', () => ({
    rollExpression: () => ({ total: 0, rolls: [], modifier: 0 }),
}));

// NPC inline lane never opens a save prompt — static module stub suffices.
vi.mock('../../services/automation/common/savePrompt.js', () => ({
    createSaveListener: () => ({ promise: Promise.resolve({ success: true, roll: 20, total: 20, saveBonus: 0, rawRolls: [], mode: 'normal' }) }),
}));

vi.mock('../../services/ui/logService.js', () => ({
    addEntry: (campaignName, entry) => { addEntryLogs.push(entry); return Promise.resolve(); },
}));

vi.mock('../../services/encounters/combatData.js', () => ({
    loadCombatSummary: async () => ({ creatures: [], activeCreatureName: 'Demogorgon 1' }),
    getCurrentCombatRound: () => 1,
    getCombatSummary: () => null,
}));

const applyDamageToTarget = vi.fn(async (_cs, _target, finalDamage) => ({ finalDamage, newHp: 999 - finalDamage }));
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

import { processSaveRoll } from './saveProcessing.js';
import { parseSaveVariantChooser } from '../../components/encounter/MonsterCardHelpers.js';
import monstersData from '../../../public/data/monsters.json';

const campaignName = 'test-campaign';
const DEMO = 'Demogorgon 1';

// Demogorgon Gaze (monsters.json demogorgon.actions[2], MA-1878 fix) —
// DC 23 Wisdom, single-target sighted save at 120 feet, choose-one variants.
const GAZE = monstersData.find(m => m.index === 'demogorgon').actions[2];
const byKey = Object.fromEntries(GAZE.variants.map(v => [v.key, v]));

// Context exactly as buildAbilitySaveRollContext emits it after the MA-1436
// chooser resolves via resolveSaveVariantSelection → executeBlockSaveRoll:
// variant owns saveConditions, damage_null formula (row authors none),
// dc_success, conditionDurationNote + the MA-1878 pruned saveVariant stamp.
function gazeContext(variant) {
    return {
        saveDc: GAZE.save_dc,
        saveType: GAZE.save_type,
        attackerName: DEMO,
        actionName: GAZE.name,
        dcSuccess: variant.dc_success,
        autoDamageFormula: variant.damage_dice ?? null,
        saveConditions: variant.conditions ?? [],
        conditionDurationNote: variant.duration_note,
        saveVariant: { key: variant.key, label: variant.label, te: variant.te ?? null, conditions: variant.conditions ?? [], rounds: variant.rounds ?? null },
    };
}

// EB-NPC inline lane (§211/§336): dice rolled upstream, pre-stamped on
// context.effectiveD20. DC 23 faces (§511 rig): fail = low roll + 0 bonus;
// success = nat 20 + 4 bonus ≥ 23.
async function resolveSave(target, context, success, roll) {
    const bonus = success ? 4 : 0;
    await processSaveRoll({
        rollType: 'save',
        target: { name: target, type: 'npc' },
        characterName: target,
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

describe('MA-1878 Demogorgon Gaze DATA lock', () => {
    it('row: DC 23 WIS, range "120 feet", no attack/damage, 3 chooser variants (beguiling=stunned, confusing=te confusion, hypnotic=charmed) — all rounds:2, dc_success none, no damage', () => {
        expect(GAZE.name).toBe('Gaze');
        expect(GAZE.save_dc).toBe(23);
        expect(GAZE.save_type).toBe('Wisdom');
        expect(GAZE.attack_bonus ?? null).toBeNull();
        expect(GAZE.damage_dice_primary ?? null).toBeNull();
        expect(GAZE.range).toBe('120 feet');
        expect(GAZE.description.startsWith('Wisdom Saving Throw: DC 23, one creature it can see within 120 ft.')).toBe(true);
        expect(GAZE.description.endsWith('No damage.')).toBe(true);
        expect(GAZE.variants).toHaveLength(3);

        expect(byKey.beguiling.conditions).toEqual(['stunned']);
        expect(byKey.beguiling.te ?? null).toBeNull();
        expect(byKey.confusing.te).toBe('confusion');
        expect(byKey.confusing.conditions ?? []).toEqual([]);
        expect(byKey.hypnotic.conditions).toEqual(['charmed']);
        for (const v of GAZE.variants) {
            expect(v.rounds).toBe(2);
            expect(v.dc_success).toBe('none');
            expect(v.damage_dice ?? null).toBeNull();
            expect(v.label).toMatch(/Gaze \(\d-\d\)/);
        }
        // chooser arms ONLY on the structured payload (MA-1436 parser, te-aware MA-1878 twin)
        expect(parseSaveVariantChooser(GAZE)?.variants.map(v => v.key)).toEqual(['beguiling', 'confusing', 'hypnotic']);
    });
});

describe('MA-1878 Demogorgon Gaze failed-save adjudication (GM chooser faces)', () => {
    // Canonical-condition legs share one lane (saveConditions §159) — one
    // test loops both d6 condition ranges; the te leg is its own contract.
    it.each([
        ['beguiling', 'Bandit 1', 'stunned', 'Stunned', 10],
        ['hypnotic', 'Bandit 2', 'charmed', 'Charmed', 5],
    ])('%s: %s granted + ONE rounds:2 condition clock + grant log, zero te, zero damage', async (_key, target, condition, label, roll) => {
        await resolveSave(target, gazeContext(byKey[_key]), false, roll);

        expect(runtimeStore[`${target}.activeConditions`]).toContain(condition);
        expect(addExpiration).toHaveBeenCalledTimes(1);
        expect(addExpiration.mock.calls[0][0]).toMatchObject({
            attackerName: DEMO,
            targetName: target,
            campaignName,
            rounds: 2,
            effects: [{ type: 'condition', condition }],
        });
        const grant = addEntryLogs.find(e => e.type === 'condition' && e.action === 'applied');
        expect(grant).toBeTruthy();
        expect(grant.characterName).toBe(target);
        expect(grant.sourceName).toBe(DEMO);
        expect(grant.condition).toBe(label);
        expect((runtimeStore['campaign.targetEffects'] || []).length).toBe(0);
        expect(applyDamageToTarget).not.toHaveBeenCalled();
        expect(logEntryLogs.some(e => e.rollType === 'save-damage')).toBe(false);
    });

    it('confusing: confusion te registered on targetEffects fail-only + ONE rounds:2 merged te-removal clock + "Confused" grant log, zero canonical conditions', async () => {
        await resolveSave('Bandit 3', gazeContext(byKey.confusing), false, 7);

        const tes = runtimeStore['campaign.targetEffects'] || [];
        expect(tes).toHaveLength(1);
        expect(tes[0]).toMatchObject({
            target: 'Bandit 3',
            effect: 'confusion',
            source: DEMO,
            duration: 'until_start_of_next_turn',
        });
        expect(addExpiration).toHaveBeenCalledTimes(1);
        expect(addExpiration.mock.calls[0][0]).toMatchObject({
            attackerName: DEMO,
            targetName: 'Bandit 3',
            campaignName,
            rounds: 2,
            effects: [{ type: 'remove_target_effect', effectKey: 'confusion', source: DEMO, target: 'Bandit 3' }],
        });
        const grant = addEntryLogs.find(e => e.type === 'condition' && e.action === 'applied');
        expect(grant).toBeTruthy();
        expect(grant.condition).toBe('Confused');
        expect(grant.characterName).toBe('Bandit 3');
        // zero canonical-condition spray (stunned/charmed stay ungranted)
        expect(runtimeStore['Bandit 3.activeConditions'] || []).toEqual([]);
        expect(applyDamageToTarget).not.toHaveBeenCalled();
    });
});

describe('MA-1878 success face + byte-inertia (§511 fail-only, §384 pin)', () => {
    it.each([
        ['confusing', 'Bandit 1'],
        ['beguiling', 'Bandit 2'],
    ])('%s success face (nat 20 + 4 ≥ 23): zero condition, zero te, zero clock, zero grant log, zero damage', async (key, target) => {
        await resolveSave(target, gazeContext(byKey[key]), true, 20);

        expect(runtimeStore[`${target}.activeConditions`] || []).toEqual([]);
        expect((runtimeStore['campaign.targetEffects'] || []).length).toBe(0);
        expect(addExpiration).not.toHaveBeenCalled();
        expect(addEntryLogs.some(e => e.type === 'condition' && e.action === 'applied')).toBe(false);
        expect(applyDamageToTarget).not.toHaveBeenCalled();
    });

    it('byte-inert control: chooserless row (no context.saveVariant) arms NO te, NO clock from this seam', async () => {
        const ctx = gazeContext(byKey.confusing);
        delete ctx.saveVariant;
        await resolveSave('Bandit 1', ctx, false, 10);

        expect((runtimeStore['campaign.targetEffects'] || []).length).toBe(0);
        expect(addExpiration).not.toHaveBeenCalled();
        expect(addEntryLogs.some(e => e.type === 'condition' && e.action === 'applied')).toBe(false);
    });
});
