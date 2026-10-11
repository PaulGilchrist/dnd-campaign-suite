// MA-1867: Cthulhu "Tentacles" — compound attack+save row shipped attack-only;
// the DC 26 Strength save half (post-hit rider save → pulled 20 ft. + Grappled,
// escape DC 26) was structurally absent (no save_dc/save_type → ActionSaveRoll
// returns null, MonsterAction.jsx:116; zero save adjudication; grapple never
// granted). DATA fix on cthulhu.actions[2]: save_dc:26 + save_type:"Strength" +
// dc_success:"none" + save_effect byte-carrying the canonical word "Grappled" +
// the RAW pull clause + escape_dc:26 (MA-0010 byte-shape). Two-chip fork
// (MA-0551/§159): "+18" attack chip pays FULL fixed 4d8+10 with saveDc nulled
// (buildAttackChipSaveOptions); standalone "DC 26 Strength" chip adjudicates the
// rider alone — rider-only (saveLegIsConditionRider, MA-0551 Death Dog twin,
// MA-0586/MA-0927 grell sibling): save_effect carries NO damage POOL (the
// ongoing "4d8 … damage" clause stays in description — inside save_effect it
// would flip riderOnly=false and render the DC chip UNCLICKABLE or double-charge
// the primary pool, §259). Grapple is on SAVE-FAIL via save lane (§346 word
// scan → applyFailedSaveConditions, MA-0368 live); NO hit_conditions authored —
// the attack-lane hit-clause clause stays null (grapple on hit = wrong axis).
// RESIDUALS (locked here as pins, not defects): save-lane condition meta is
// {source} only — activeConditionMeta.grappled carries NO dc/ability (MA-0010
// escape badge is the attack-lane hit-clause seam, handlePlainDamage:660) —
// save-lane escape badge stays a documented gap; ongoing 4d8 turn-start tick has
// NO save-lane producer (MA-1842 grapple_ongoing_damage rides handlePlainDamage
// hit-clause ATTACK lane only, saveProcessing grep-zero — MA-1842-b/§70
// advisory); 20 ft. pull save-path unthreaded (§235, gridless advisory anyway).
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';

const runtimeStore = {};
const addEntryLogs = [];
const rollExpression = vi.fn(() => ({ total: 18, rolls: [4, 4, 4, 6], modifier: 0 }));
const applyDamageToTarget = vi.fn(async (_cs, _target, finalDamage) => ({ finalDamage, newHp: 62 - finalDamage }));
const addExpiration = vi.fn();

// Partial mocks (§385 barrel-surface rule): automation/index links every
// named export of these modules, so spread the original and override ONLY
// the behaviour keys this row's save lane touches.
vi.mock('../../hooks/runtime/useRuntimeState.js', async (importOriginal) => ({
    ...(await importOriginal()),
    getRuntimeValue: (name, key) => runtimeStore[`${name}.${key}`],
    setRuntimeValue: (name, key, value) => { runtimeStore[`${name}.${key}`] = value; return Promise.resolve(); },
}));

vi.mock('../../services/dice/diceRoller.js', async (importOriginal) => ({
    ...(await importOriginal()),
    rollExpression: (...args) => rollExpression(...args),
}));

// EB-NPC inline lane never opens a save prompt — stub the listener.
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
    getCurrentCombatRound: () => 1,
    getCombatSummary: () => null,
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
import { buildHitConditionClause, attackRowMissingToHit, extractConditionsFromSaveEffect } from './MonsterCardHelpers.js';
import { isCompositeAttackSaveRow, saveLegIsConditionRider, saveLegCarriesSecondaryDamage, saveChipPlan } from './MonsterCardModal.jsx';

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
    it('save fields armed after damage_type_primary (MA-0927/MA-0860 byte-shape): DC 26 Strength, dc_success none, escape_dc 26', () => {
        expect(TENTACLES.name).toBe('Tentacles');
        expect(TENTACLES.save_dc).toBe(26);
        expect(TENTACLES.save_type).toBe('Strength');
        expect(TENTACLES.dc_success).toBe('none');
        expect(TENTACLES.escape_dc).toBe(26);
        const keys = Object.keys(TENTACLES);
        expect(keys.indexOf('save_dc')).toBe(keys.indexOf('damage_type_primary') + 1);
        expect(keys.indexOf('save_type')).toBe(keys.indexOf('save_dc') + 1);
        expect(keys.indexOf('dc_success')).toBe(keys.indexOf('save_type') + 1);
        expect(keys.indexOf('save_effect')).toBe(keys.indexOf('dc_success') + 1);
        expect(keys.indexOf('escape_dc')).toBe(keys.indexOf('save_effect') + 1);
    });

    it('save_effect byte-carries canonical "Grappled" + RAW pull clause, escape DC 26 — and NO damage POOL (rider-only pin: the ongoing 4d8 clause stays description-only, §259)', () => {
        expect(TENTACLES.save_effect).toBe('The target is pulled 20 ft. toward Cthulhu and has the Grappled condition (escape DC 26).');
        expect(extractConditionsFromSaveEffect(TENTACLES.save_effect)).toEqual(['grappled']);
        // §259 discriminator: dice + "damage" word in save_effect would disarm the
        // clickable rider chip (or re-roll the primary pool) — must stay absent.
        expect(/\d+\s*d\s*\d+/i.test(TENTACLES.save_effect)).toBe(false);
    });

    it('grapple axis is SAVE-FAIL only: NO hit_conditions authored, hit-clause stays null (attack chip never grants)', () => {
        expect(TENTACLES.hit_conditions).toBeUndefined();
        expect(buildHitConditionClause(TENTACLES)).toBeNull();
    });

    it('attack half byte-unchanged: +18 / reach 20 ft. / 4d8 + 10 / Bludgeoning / RAW description intact', () => {
        expect(TENTACLES.attack_bonus).toBe(18);
        expect(TENTACLES.reach).toBe('20 ft.');
        expect(TENTACLES.damage_dice_primary).toBe('4d8 + 10');
        expect(TENTACLES.damage_type_primary).toBe('Bludgeoning');
        expect(TENTACLES.description).toBe(RAW_DESCRIPTION);
        expect(attackRowMissingToHit(TENTACLES)).toBe(false);
    });
});

describe('MA-1867 compound two-chip fork (MA-0551/§159)', () => {
    it('rider-only composite save chip: no secondary, no formula, CLICKABLE (pre-fix the row had no save_dc at all)', () => {
        expect(isCompositeAttackSaveRow(TENTACLES)).toBe(true);
        expect(saveLegCarriesSecondaryDamage(TENTACLES)).toBe(false);
        expect(saveLegIsConditionRider(TENTACLES)).toBe(true);
        const plan = saveChipPlan(TENTACLES, false);
        expect(plan.riderOnly).toBe(true);
        expect(plan.formula).toBeNull();
        expect(plan.rollable).toBe(false);
        expect(plan.clickable).toBe(true);
    });

    it('renders TWO chips: "+18" attack + "DC 26 Strength" save; save chip press threads (action, null formula, [grappled])', () => {
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
        expect(onAttack).toHaveBeenCalledWith('Tentacles', 18, expect.objectContaining({ name: 'Tentacles' }));
        const saveChip = container.querySelector('.mc-dice-link-save-clickable');
        expect(saveChip).not.toBeNull();
        expect(saveChip.textContent.trim()).toBe('DC 26 Strength');
        fireEvent.click(saveChip);
        expect(onSaveRoll).toHaveBeenCalledWith(TENTACLES, null, ['grappled']);
    });
});

describe('MA-1867 save-lane adjudication (MA-0586/MA-0368 EB-NPC inline seam)', () => {
    it('failed STR save: Grappled granted with source meta, zero save-damage, no roll, no clock', async () => {
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
        // §346: save-lane meta is {source} only — escape-badge dc/ability stays
        // the MA-0010 ATTACK-lane seam (residual pinned, NOT a fake grant).
        expect(runtimeStore[`${VICTIM}.activeConditionMeta`].grappled).toEqual({ source: CTHULHU });

        const grant = addEntryLogs.find((e) => e.type === 'condition' && e.action === 'applied');
        expect(grant).toBeTruthy();
        expect(grant.characterName).toBe(VICTIM);
        expect(grant.condition).toBe('Grappled');
        expect(grant.sourceName).toBe(CTHULHU);
        expect(grant.sourceAbility).toBe('Tentacles');

        // ZERO save-damage on both halves: no damage rolls, no applier, no hp entries.
        expect(rollExpression).not.toHaveBeenCalled();
        expect(applyDamageToTarget).not.toHaveBeenCalled();
        expect(logEntry.mock.calls.some(([e]) => e.rollType === 'save-damage' || e.rollType === 'damage')).toBe(false);
        expect(addEntryLogs.some((e) => e.type === 'hp_change')).toBe(false);
        // Condition-only lane carries no addExpiration clock (§346).
        expect(addExpiration).not.toHaveBeenCalled();
    });

    it('successful STR save: zero grant, zero log-condition, zero damage (dc_success none, rider fail-only)', async () => {
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
