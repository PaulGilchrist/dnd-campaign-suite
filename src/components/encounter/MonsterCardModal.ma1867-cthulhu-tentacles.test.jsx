// @maintained-by-ai
// MA-1867: Cthulhu "Tentacles" — compound attack+save row shipped attack-only;
// the DC 26 Strength rider save half (post-hit → pulled 20 ft. + Grappled,
// escape DC 26) was structurally absent (no save_dc/save_type → ActionSaveRoll
// returns null, MonsterAction.jsx:116). DATA fix on cthulhu.actions[2]:
// save_dc:26 + save_type:"Strength" + dc_success:"none" + save_effect
// byte-carrying canonical "Grappled" + RAW pull clause + escape_dc:26
// (MA-0010 byte-shape). Two-chip fork (MA-0551/§159): "+18" attack chip pays
// FULL 4d8+10 (action passed byte-exact, MonsterAction.jsx:480); standalone
// "DC 26 Strength" chip adjudicates the rider alone — rider-only because
// save_effect carries NO damage POOL (§259: dice+"damage" inside save_effect
// would flip riderOnly false → UNCLICKABLE chip or double-charge the primary
// pool). Grapple lands on SAVE-FAIL via the save lane word scan (§346 →
// applyFailedSaveConditions, MA-0368 canonical in
// saveProcessing.failed-save-conditions.test.js); NO hit_conditions authored —
// attack-lane hit-clause stays null (grapple on hit = wrong axis).
// Owned elsewhere (not re-derived here): riderOnly truth table (MA-1000
// ma1000:74), grell two-chip twin (MA-0927), buildAbilitySaveRollContext
// transport + Cthulhu saveRiderAttackDamage byte-inert (MA-1877), escape-badge
// dc/ability (MA-0010 ATTACK-lane seam, handlePlainDamage:660).
// RESIDUALS (pinned, not defects): save-lane condition meta is {source} only;
// ongoing 4d8 turn-start tick has NO save-lane producer (MA-1842 rides the
// attack-lane hit clause only — MA-1842-b/§70 advisory); 20 ft. pull
// save-path unthreaded (§235 gridless advisory).
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';

const runtimeStore = {};
const addEntryLogs = [];
const rollExpression = vi.fn(() => ({ total: 18, rolls: [4, 4, 4, 6], modifier: 0 }));
const applyDamageToTarget = vi.fn(async (_cs, _target, finalDamage) => ({ finalDamage, newHp: 62 - finalDamage }));
const addExpiration = vi.fn();

// Partial mocks (§385 barrel-surface rule): automation/index links every
// named export of these modules, so spread the original and override ONLY the
// behaviour keys this row's save lane touches. rollExpression/applyDamageToTarget/
// addExpiration stay as ZERO-CALL canaries — a rider-only row must never roll
// the primary pool, apply damage, or start a clock (§259/§346/no-timers).
vi.mock('../../hooks/runtime/useRuntimeState.js', async (importOriginal) => ({
    ...(await importOriginal()),
    getRuntimeValue: (name, key) => runtimeStore[`${name}.${key}`],
    setRuntimeValue: (name, key, value) => { runtimeStore[`${name}.${key}`] = value; return Promise.resolve(); },
}));

vi.mock('../../services/dice/diceRoller.js', async (importOriginal) => ({
    ...(await importOriginal()),
    rollExpression: (...args) => rollExpression(...args),
}));

// EB-NPC inline lane never opens a save prompt — stub keeps the lane
// deterministic if the seam ever regresses into a hanging listener.
vi.mock('../../services/automation/common/savePrompt.js', async (importOriginal) => ({
    ...(await importOriginal()),
    createSaveListener: () => ({ promise: Promise.resolve({ success: true, roll: 20, total: 20, saveBonus: 0, rawRolls: [], mode: 'normal' }) }),
}));

vi.mock('../../services/ui/logService.js', async (importOriginal) => ({
    ...(await importOriginal()),
    addEntry: (campaignName, entry) => { addEntryLogs.push(entry); return Promise.resolve(); },
}));

vi.mock('../../services/encounters/combatData.js', async (importOriginal) => ({
    ...(await importOriginal()),
    loadCombatSummary: async () => ({ creatures: [], activeCreatureName: 'Cthulhu 1' }),
}));

vi.mock('../../services/rules/combat/applyDamage.js', async (importOriginal) => ({
    ...(await importOriginal()),
    applyDamageToTarget: (...args) => applyDamageToTarget(...args),
}));

vi.mock('../../services/automation/handlers/buffs/circleOfPowerHandler.js', async (importOriginal) => ({
    ...(await importOriginal()),
    isCircleOfPowerActive: () => false,
}));

vi.mock('../../services/combat/automation/automationService.js', async (importOriginal) => ({
    ...(await importOriginal()),
    playerIsImmuneToCondition: () => false,
}));

vi.mock('../../services/rules/effects/expirationQueue.js', async (importOriginal) => ({
    ...(await importOriginal()),
    addExpiration: (...args) => addExpiration(...args),
}));

import { processSaveRoll } from '../../hooks/combat/saveProcessing.js';
import { MonsterAction } from './MonsterAction.jsx';
import { buildHitConditionClause, extractConditionsFromSaveEffect } from './MonsterCardHelpers.js';
import { isCompositeAttackSaveRow, saveLegCarriesSecondaryDamage, saveChipPlan } from './MonsterCardModal.jsx';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const TENTACLES = monsters.find((m) => m.index === 'cthulhu').actions[2];

const RAW_DESCRIPTION = 'Melee Attack Roll: +18, reach 20 ft. Hit: 28 (4d8 + 10) Bludgeoning damage. If the target is a Huge or smaller creature, it must succeed on a DC 26 Strength saving throw or be pulled 20 ft. toward Cthulhu and have the Grappled condition (escape DC 26). While Grappled this way, the target automatically takes 18 (4d8) Bludgeoning damage at the start of its next turn.';

const campaignName = 'test-campaign';
const CTHULHU = 'Cthulhu 1';
const VICTIM = 'Bandit 1';

// Save chip transport exactly as buildAbilitySaveRollContext threads it on this
// row (rider-only: autoDamageFormula null, saveConditions word-extracted).
const tentaclesSaveContext = {
    saveDc: 26,
    saveType: 'Strength',
    dcSuccess: 'none',
    attackerName: CTHULHU,
    actionName: 'Tentacles',
    targetName: VICTIM,
    autoDamageFormula: null,
    autoDamageName: 'Tentacles',
    saveConditions: extractConditionsFromSaveEffect(TENTACLES.save_effect),
    _characters: [],
};

beforeEach(() => {
    vi.clearAllMocks();
    for (const k of Object.keys(runtimeStore)) delete runtimeStore[k];
    addEntryLogs.length = 0;
});

describe('MA-1867 disk fingerprint: cthulhu Tentacles save half armed (DATA fix)', () => {
    it('full-row byte-lock (MA-0927/MA-0860 byte-shape): save half armed after damage_type_primary, NO hit_conditions (grapple axis = save-fail only), save_effect dice-free (§259 rider-only)', () => {
        expect(TENTACLES).toEqual({
            name: 'Tentacles',
            description: RAW_DESCRIPTION,
            reach: '20 ft.',
            attack_bonus: 18,
            damage_dice_primary: '4d8 + 10',
            damage_type_primary: 'Bludgeoning',
            save_dc: 26,
            save_type: 'Strength',
            dc_success: 'none',
            save_effect: 'The target is pulled 20 ft. toward Cthulhu and has the Grappled condition (escape DC 26).',
            escape_dc: 26,
        });
        // Key-order pins the MA-0010 authoring seam (save fields slot in
        // immediately after damage_type_primary; escape_dc trails save_effect).
        expect(Object.keys(TENTACLES)).toEqual(['name', 'description', 'reach', 'attack_bonus', 'damage_dice_primary', 'damage_type_primary', 'save_dc', 'save_type', 'dc_success', 'save_effect', 'escape_dc']);
        // toEqual already forbids hit_conditions — the attack lane must never
        // grant grapple (grapple on hit = wrong axis); assert the clause itself.
        expect(buildHitConditionClause(TENTACLES)).toBeNull();
    });
});

describe('MA-1867 two-chip fork (MA-0551/§159): rider-only plan + live dispatch', () => {
    it('plan is formula-less riderOnly CLICKABLE (no pool re-roll, no secondary), renders "+18" + "DC 26 Strength" only, and dispatches attack byte-exact / save rider-only [grappled]', () => {
        expect(isCompositeAttackSaveRow(TENTACLES)).toBe(true);
        expect(saveLegCarriesSecondaryDamage(TENTACLES)).toBe(false);
        expect(saveChipPlan(TENTACLES, false)).toEqual({ riderOnly: true, formula: null, rollable: false, clickable: true });

        const onAttack = vi.fn();
        const onSaveRoll = vi.fn();
        const { container } = render(
            <MonsterAction
                action={TENTACLES}
                index={0}
                attackerCannotAct={false}
                onAttack={onAttack}
                onDamage={vi.fn()}
                onSaveRoll={onSaveRoll}
                onSpellCast={vi.fn()}
                reactionUsesUsed={{}}
                onGatedReaction={vi.fn()}
            />
        );
        const chips = [...container.querySelectorAll('.mc-dice-link')].map((c) => c.textContent.trim());
        expect(chips).toEqual(['+18', 'DC 26 Strength']);
        fireEvent.click(container.querySelectorAll('.mc-dice-link')[0]);
        expect(onAttack).toHaveBeenCalledWith('Tentacles', 18, TENTACLES);
        const saveChips = container.querySelectorAll('.mc-dice-link-save-clickable');
        expect(saveChips).toHaveLength(1);
        fireEvent.click(saveChips[0]);
        expect(onSaveRoll).toHaveBeenCalledWith(TENTACLES, null, ['grappled']);
    });
});

describe('MA-1867 save-lane adjudication (MA-0368/§346 EB-NPC inline seam)', () => {
    it('failed STR save: Grappled granted with {source}-only meta + grant log, zero save-damage, zero clock', async () => {
        // EB-NPC inline lane (§159/MA-0586): dice stamped upstream on
        // context.effectiveD20, total folded at processNpcSave. FAIL: 5+0 < 26.
        const logEntry = vi.fn();
        await processSaveRoll({
            rollType: 'save',
            target: { name: VICTIM, type: 'npc' },
            characterName: VICTIM,
            campaignName,
            context: { ...tentaclesSaveContext, effectiveD20: 5, effectiveBonus: 0 },
            bonus: 0,
            r1: 5,
            r2: 5,
            logEntry,
            setPopupHtml: vi.fn(),
        });

        expect(runtimeStore[`${VICTIM}.activeConditions`]).toEqual(['grappled']);
        // §346 residual pin: save-lane meta is {source} only — escape-badge
        // dc/ability stays the MA-0010 ATTACK-lane seam, NOT a fake grant.
        expect(runtimeStore[`${VICTIM}.activeConditionMeta`].grappled).toEqual({ source: CTHULHU });

        const grant = addEntryLogs.find((e) => e.type === 'condition' && e.action === 'applied');
        expect(grant).toBeTruthy();
        expect({ ...grant }).toMatchObject({ characterName: VICTIM, condition: 'Grappled', sourceName: CTHULHU, sourceAbility: 'Tentacles' });

        // Rider-only: zero save-damage — no rolls, no applier, no hp entries,
        // no expiration clock on a condition-only lane (§259/§346/no-timers).
        expect(rollExpression).not.toHaveBeenCalled();
        expect(applyDamageToTarget).not.toHaveBeenCalled();
        expect(logEntry.mock.calls.some(([e]) => e.rollType === 'save-damage' || e.rollType === 'damage')).toBe(false);
        expect(addEntryLogs.some((e) => e.type === 'hp_change')).toBe(false);
        expect(addExpiration).not.toHaveBeenCalled();
    });

    it('successful STR save (dc_success:"none" canary, MV-20/§335): zero grant, zero damage — half-default never leaks a save-damage leg', async () => {
        // SUCCESS face: nat20 + STR-proficient +6 = 26 ≥ 26 (ElderPaladin-class).
        const logEntry = vi.fn();
        await processSaveRoll({
            rollType: 'save',
            target: { name: VICTIM, type: 'npc' },
            characterName: VICTIM,
            campaignName,
            context: { ...tentaclesSaveContext, effectiveD20: 20, effectiveBonus: 6 },
            bonus: 6,
            r1: 20,
            r2: 20,
            logEntry,
            setPopupHtml: vi.fn(),
        });

        expect(runtimeStore[`${VICTIM}.activeConditions`]).toBeUndefined();
        expect(addEntryLogs.some((e) => e.type === 'condition' && e.action === 'applied')).toBe(false);
        expect(rollExpression).not.toHaveBeenCalled();
        expect(applyDamageToTarget).not.toHaveBeenCalled();
        expect(logEntry.mock.calls.some(([e]) => e.rollType === 'save-damage' || e.rollType === 'damage')).toBe(false);
    });
});
