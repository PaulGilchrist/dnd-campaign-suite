// @maintained-by-ai: 2026-10-15 — deterministic full-mock lane over the stable
// CLA-158 gate/economy/scaling contracts; no churn expected as the app moves.
// CLA-158: Hand of Harm standalone reaction lane.
// Holder-targeted trigger creature_within_5ft_hits_on_attack_roll (registered
// reaction_damage in services/automation/index.js) — mirrors the CLA-150
// Glorious Defense seam (target from findLastAttack, holder was hit), CLA-361
// round-latch shape, CLA-144 harm save/damage/te lane reuse, and CLA-113 FP
// pre-modal spend (paid value, not refunded).
//
// HAND OF HARM LANE SPLIT (verified at source, test-trim audit 2026-10-15):
// THIS file = the STANDALONE reaction press through reactionDamageHandler
// (gateCreatureHitHolder / holderHitReactionLatchKey / consumeResourceCost /
// resolveReactionDamageExpression). bonusAttacksHandler.cla144-flurry-healing-
// harm.test.js = the Flurry-embedded harm leg inside bonusAttacksHandler.js —
// a genuinely different module (handleBonusAttacks never dispatches here, see
// the consumeResourceCost comment at reactionDamageHandler.js ~L178). NO
// removals were taken from the cla144 lane on this file's account.
// TRIO map on reactionDamageHandler.js: this file owns the holder-hit save
// trigger; reactionDamageHandler.reactiveStrike.test.js owns FT-103
// creature_enters_reach_while_holding_polearm (own gate + latch key);
// reactionDamageHandler.test.js owns the generic save-type/no-save paths,
// energy redirection, Thought Shield and CLA-297 Retaliation.
// Shed here (canonical homes must STAY in the main file — do not trim there):
//   'save success: zero damage, zero te' → main's 'does not apply damage when
//   save succeeds' + 'does not apply targetEffects when save succeeds' (same
//   trigger-agnostic handleSaveResult skip). The ability_use log test was
//   KEPT but hardened to a holder-lane-unique full-string pin (attacker-
//   derived target in the composed description), no longer a bare duplicate
//   of main's promptId-only pin.
// Flag TO the main lane: its 'charges the focus point cost for standalone Hand
// of Harm even with Flurry of Healing and Harm' re-pins the same
// consumeResourceCost FP-write statement as this file's 'charges 1 Focus Point
// on commit' — the held-Flurry specialActions mock is inert (no flurry branch
// remains in consumeResourceCost), so that test is a merge candidate there.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handle } from './reactionDamageHandler.js';

vi.mock('../../common/savePrompt.js', () => ({
    buildSaveDc: vi.fn((auto, playerStats) => {
        const mods = { WIS: 7, CON: 0 };
        return 8 + (mods[auto.saveAbility] || 0) + (playerStats.proficiency || 0);
    }),
    createSaveListener: vi.fn((_campaignName, _config) => ({
        promptId: 'hoh-prompt-id',
        promise: Promise.resolve({ success: true }),
    })),
}));

vi.mock('../../../dice/diceRoller.js', () => ({
    rollExpression: vi.fn(() => ({ total: 11, rolls: [3, 4, 4] })),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(() => undefined),
    setRuntimeValue: vi.fn(async () => {}),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../common/targetResolver.js', () => ({
    resolveTarget: vi.fn(),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(async () => ({ round: 1, creatures: [] })),
}));

vi.mock('../../../combat/automation/automationService.js', () => ({
    evaluateAutoExpression: vi.fn(() => 1),
}));

vi.mock('../../../rules/combat/applyDamage.js', () => ({
    applyDamageToTarget: vi.fn(async () => ({ finalDamage: 11, newHp: 0 })),
    computeDamageAfterSave: vi.fn((raw, saveSuccess) => (saveSuccess ? 0 : raw)),
}));

vi.mock('../../../shared/abilityLookup.js', () => ({
    getAbilityModifier: vi.fn((_abilities, ability) => (ability === 'WIS' ? 7 : 0)),
}));

vi.mock('../../../combat/baseCombatActions.js', () => ({
    MELEE_REACH_FEET: 5,
}));

vi.mock('../../common/damageRollback.js', () => ({
    findLastAttack: vi.fn(),
}));

vi.mock('../../common/polearmUtils.js', () => ({
    isPolearmWeapon: vi.fn(async () => true),
}));

vi.mock('../../../rules/combat/rangeCheck.js', () => ({
    isWithinRange: vi.fn(async () => true),
}));

const { getRuntimeValue, setRuntimeValue } = await import('../../../../hooks/runtime/useRuntimeState.js');
const { addEntry } = await import('../../../ui/logService.js');
const { findLastAttack } = await import('../../common/damageRollback.js');
const { createSaveListener } = await import('../../common/savePrompt.js');
const { applyDamageToTarget } = await import('../../../rules/combat/applyDamage.js');
const { isWithinRange } = await import('../../../rules/combat/rangeCheck.js');
const { rollExpression } = await import('../../../dice/diceRoller.js');
const { getCombatContext } = await import('../../../rules/combat/damageUtils.js');

const CAMPAIGN = 'test-campaign';

// Canonical 2024 classes.json Warrior of Mercy lv3 row (raw automation — the
// scaling map + saveDc:'ability' token are resolved at execution time).
const HOH_ROW = {
    name: 'Hand of Harm',
    automation: {
        type: 'reaction_damage',
        trigger: 'creature_within_5ft_hits_on_attack_roll',
        damageExpression: '1d6',
        damageType: 'Necrotic',
        saveType: 'CON',
        saveDc: 'ability',
        scaling: { 11: '2d6', 17: '3d6' },
        resourceCost: 'focus_point',
        alsoInflicts: 'disadvantage_next_attack',
        casting_time: '1 reaction',
    },
};

function makeMonk(overrides = {}) {
    return {
        name: 'Disciplined_Monk',
        level: 20,
        proficiency: 6,
        class: { name: 'Monk', class_levels: [{ level: 20, focus_points: 20 }] },
        abilities: [{ name: 'Wisdom', bonus: 7 }],
        ...overrides,
    };
}

function armedState(runtimeMap = {}) {
    getRuntimeValue.mockImplementation((_key, prop) => runtimeMap[prop]);
}

function hitAgainst(name = 'Disciplined_Monk') {
    findLastAttack.mockResolvedValue({
        attackEvent: { hit: true, weaponType: 'melee', d20: 19, bonus: 3, total: 22 },
        attackerName: 'Bandit 1',
        targetName: name,
        totalDamage: 9,
        damageTypes: ['Slashing'],
    });
}

async function flush() {
    await new Promise(r => setTimeout(r, 0));
}

beforeEach(() => {
    vi.resetAllMocks();
    setRuntimeValue.mockImplementation(async () => {});
    addEntry.mockResolvedValue(undefined);
    createSaveListener.mockReturnValue({ promptId: 'hoh-prompt-id', promise: Promise.resolve({ success: true }) });
    rollExpression.mockReturnValue({ total: 11, rolls: [3, 4, 4] });
    applyDamageToTarget.mockResolvedValue({ finalDamage: 11, newHp: 0 });
    isWithinRange.mockResolvedValue(true);
    getCombatContext.mockResolvedValue({ round: 1, creatures: [] });
});

describe('CLA-158 Hand of Harm standalone reaction', () => {
    it('arms after a qualifying hit: CON save prompted vs holder spell DC, target = attacker', async () => {
        hitAgainst();
        armedState({ focusPoints: 20 });

        const result = await handle(HOH_ROW, makeMonk(), CAMPAIGN, null, []);

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('CON saving throw');
        expect(result.payload.description).toContain('DC 21');
        expect(createSaveListener).toHaveBeenCalledWith(CAMPAIGN, expect.objectContaining({
            targetName: 'Bandit 1',
            saveType: 'CON',
            saveDc: 21,
            attackerName: 'Disciplined_Monk',
        }));
    });

    it('charges 1 Focus Point on commit (standalone RAW — never free at lv11+)', async () => {
        hitAgainst();
        armedState({ focusPoints: 20 });

        await handle(HOH_ROW, makeMonk(), CAMPAIGN, null, []);

        expect(setRuntimeValue).toHaveBeenCalledWith('Disciplined_Monk', 'focusPoints', 19, CAMPAIGN);
    });

    it('stamps the once-per-round latch on commit', async () => {
        hitAgainst();
        armedState({ focusPoints: 20 });

        await handle(HOH_ROW, makeMonk(), CAMPAIGN, null, []);

        expect(setRuntimeValue).toHaveBeenCalledWith('Disciplined_Monk', '_Hand_of_Harm_usedRound', 1, CAMPAIGN);
    });

    it('refuses with no recent attack — hand_of_harm_refused logged, zero spend', async () => {
        findLastAttack.mockResolvedValue({ attackEvent: null, attackerName: null, targetName: null, totalDamage: 0 });
        armedState({ focusPoints: 20 });

        const result = await handle(HOH_ROW, makeMonk(), CAMPAIGN, null, []);

        expect(result.payload.description).toContain('No recent attack');
        expect(addEntry).toHaveBeenCalledWith(CAMPAIGN, expect.objectContaining({
            type: 'automation',
            automationType: 'hand_of_harm_refused',
        }));
        expect(createSaveListener).not.toHaveBeenCalled();
        expect(setRuntimeValue).not.toHaveBeenCalledWith('Disciplined_Monk', 'focusPoints', expect.any(Number), CAMPAIGN);
    });

    it('refuses when the last attack missed', async () => {
        findLastAttack.mockResolvedValue({
            attackEvent: { hit: false },
            attackerName: 'Bandit 1',
            targetName: 'Disciplined_Monk',
            totalDamage: 0,
        });
        armedState({ focusPoints: 20 });

        const result = await handle(HOH_ROW, makeMonk(), CAMPAIGN, null, []);

        expect(result.payload.description).toContain('missed');
        expect(addEntry).toHaveBeenCalledWith(CAMPAIGN, expect.objectContaining({
            automationType: 'hand_of_harm_refused',
        }));
        expect(createSaveListener).not.toHaveBeenCalled();
    });

    it('refuses when the holder was not the target of the last attack', async () => {
        hitAgainst('ElderPaladin');
        armedState({ focusPoints: 20 });

        const result = await handle(HOH_ROW, makeMonk(), CAMPAIGN, null, []);

        expect(result.payload.description).toContain('not the target');
        expect(createSaveListener).not.toHaveBeenCalled();
    });

    it('refuses when the last attack was made by the holder (self-check before target check)', async () => {
        findLastAttack.mockResolvedValue({
            attackEvent: { hit: true, weaponType: 'melee', d20: 19, total: 22 },
            attackerName: 'Disciplined_Monk',
            targetName: 'ElderPaladin',
            totalDamage: 9,
            damageTypes: ['Slashing'],
        });
        armedState({ focusPoints: 20 });

        const result = await handle(HOH_ROW, makeMonk(), CAMPAIGN, null, []);

        expect(result.payload.description).toContain('cannot trigger this reaction on yourself');
        expect(addEntry).toHaveBeenCalledWith(CAMPAIGN, expect.objectContaining({
            automationType: 'hand_of_harm_refused',
        }));
        expect(createSaveListener).not.toHaveBeenCalled();
        expect(setRuntimeValue).not.toHaveBeenCalledWith('Disciplined_Monk', 'focusPoints', expect.any(Number), CAMPAIGN);
    });

    it('refuses a second press in the same round (Reaction spent) with zero spend', async () => {
        hitAgainst();
        armedState({ focusPoints: 20, _Hand_of_Harm_usedRound: 1 });

        const result = await handle(HOH_ROW, makeMonk(), CAMPAIGN, null, []);

        expect(result.payload.description).toContain('already used Hand of Harm this round');
        expect(addEntry).toHaveBeenCalledWith(CAMPAIGN, expect.objectContaining({
            automationType: 'hand_of_harm_refused',
        }));
        expect(setRuntimeValue).not.toHaveBeenCalledWith('Disciplined_Monk', 'focusPoints', expect.any(Number), CAMPAIGN);
        expect(createSaveListener).not.toHaveBeenCalled();
    });

    it('re-arms on a new round after the round latch cleared', async () => {
        hitAgainst();
        armedState({ focusPoints: 19 });
        getCombatContext.mockResolvedValue({ round: 2, creatures: [] });

        const result = await handle(HOH_ROW, makeMonk(), CAMPAIGN, null, []);

        expect(result.payload.description).toContain('CON saving throw');
        expect(setRuntimeValue).toHaveBeenCalledWith('Disciplined_Monk', '_Hand_of_Harm_usedRound', 2, CAMPAIGN);
    });

    it('refuses an out-of-range attacker (isWithinRange lenient seam)', async () => {
        hitAgainst();
        armedState({ focusPoints: 20 });
        isWithinRange.mockResolvedValue(false);

        const result = await handle(HOH_ROW, makeMonk(), CAMPAIGN, null, []);

        expect(result.payload.description).toContain('not within 5 feet');
        expect(createSaveListener).not.toHaveBeenCalled();
    });

    it('refuses with no Focus Points — refusal logged, no prompt, zero spend', async () => {
        hitAgainst();
        armedState({ focusPoints: 0 });

        const result = await handle(HOH_ROW, makeMonk(), CAMPAIGN, null, []);

        expect(result.payload.description).toContain('No Focus Points remaining');
        expect(addEntry).toHaveBeenCalledWith(CAMPAIGN, expect.objectContaining({
            automationType: 'hand_of_harm_refused',
        }));
        expect(createSaveListener).not.toHaveBeenCalled();
    });

    it('save fail: lv20 scaled 3d6 necrotic applied to attacker + disadvantage_next_attack te + condition log', async () => {
        hitAgainst();
        armedState({ focusPoints: 20, targetEffects: [] });
        getCombatContext.mockResolvedValue({
            round: 1,
            creatures: [{ name: 'Bandit 1', type: 'npc', currentHp: 11, maxHp: 11 }],
        });

        await handle(HOH_ROW, makeMonk(), CAMPAIGN, null, []);

        window.dispatchEvent(new CustomEvent('save-result', {
            detail: { promptId: 'hoh-prompt-id', success: false },
        }));
        await flush();

        expect(rollExpression).toHaveBeenCalledWith('3d6');
        expect(applyDamageToTarget).toHaveBeenCalledWith(
            expect.objectContaining({ round: 1 }),
            'Bandit 1',
            11,
            ['Necrotic'],
            expect.objectContaining({ campaignName: CAMPAIGN, attackerName: 'Disciplined_Monk' }),
        );
        expect(setRuntimeValue).toHaveBeenCalledWith('campaign', 'targetEffects', expect.arrayContaining([
            expect.objectContaining({ target: 'Bandit 1', effect: 'disadvantage_next_attack', duration: 'until_used' }),
        ]), CAMPAIGN);
        expect(addEntry).toHaveBeenCalledWith(CAMPAIGN, expect.objectContaining({
            type: 'condition',
            action: 'applied',
            condition: 'Disadvantage on next attack roll',
        }));
    });

    it('lv11 monk rolls the 2d6 rung (scaling resolved at execution time)', async () => {
        hitAgainst();
        armedState({ focusPoints: 4, targetEffects: [] });
        const lv11Monk = makeMonk({
            level: 11,
            proficiency: 3,
            class: { name: 'Monk', class_levels: [{ level: 11, focus_points: 11 }] },
        });

        await handle(HOH_ROW, lv11Monk, CAMPAIGN, null, []);

        window.dispatchEvent(new CustomEvent('save-result', {
            detail: { promptId: 'hoh-prompt-id', success: false },
        }));
        await flush();

        expect(rollExpression).toHaveBeenCalledWith('2d6');
    });

    it('logs ability_use with the attacker-derived target and promptId on commit', async () => {
        hitAgainst();
        armedState({ focusPoints: 20 });

        await handle(HOH_ROW, makeMonk(), CAMPAIGN, null, []);

        expect(addEntry).toHaveBeenCalledWith(CAMPAIGN, expect.objectContaining({
            type: 'ability_use',
            characterName: 'Disciplined_Monk',
            abilityName: 'Hand of Harm',
            description: 'Hand of Harm triggered — Bandit 1 must make CON save (DC 21)',
            promptId: 'hoh-prompt-id',
        }));
    });
});
