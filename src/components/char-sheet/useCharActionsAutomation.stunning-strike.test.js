// @maintained-by-ai
// CLA-342 Stunning Strike row-gate lane (gateStunningStrike / markStunningStrikeUsed):
// a save_only 'Stunning Strike' row (trigger monk_weapon_or_unarmed_hit) arms ONLY on your
// own melee HIT (not auto-miss), once per turn. Every refusal is popup + byte-exact
// "<name> blocked — <reason>" log with ZERO runtime writes and ZERO dispatch, BEFORE any
// Focus Point pre-spend. Positive leg pins the spend seam byte-exact: 1 FP written first,
// round-attributed latch stamp second, target-named spend log, then executeHandler dispatch
// (the save-dispatch args). Save resolution + condition granting live in saveOnlyHandler.js
// — pinned in saveOnlyHandler.test.js and contextBuilder-sync.stunning-strike.test.js.
// Owned elsewhere: FP-cost + after_casting_action_spell refusals → useCharActionsAutomation.test.js;
// after_attack_action read-gate → .cla143-gate.test.js; Fleet Step grant → .fleetStep.test.js;
// FP spending for automation:{} Stunning Strike rows → .test.early-returns.js.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import useCharActionsAutomation from './useCharActionsAutomation.js';
import { createHooks, campaignName, basePlayerStats } from './useCharActionsAutomation.test.setup.js';

// Seam isolation — each mock maps 1:1 to a direct import of useCharActionsAutomation.js whose
// heavy outbound graphs (divine intervention → buffHandler → automation/index, spell cast)
// the Stunning Strike lane never touches. damageUtils.getCombatContext is the gate's live-round
// read: the round is hoisted so latch comparisons pin to the combat-context value, not to a
// hardcoded round buried in a mock factory.
vi.mock('../../services/automation/handlers/class-cleric-paladin/divineInterventionHandler.js', () => ({
    handle: vi.fn(),
    onSpellSelected: vi.fn(),
}));
vi.mock('../../services/rules/spells/spellCastService.js', () => ({
    executeSpellCast: vi.fn(),
}));
const { combatRound } = vi.hoisted(() => ({ combatRound: { current: 4 } }));
vi.mock('../../services/rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(async () => ({ round: combatRound.current, creatures: [] })),
    getTargetFromAttacker: vi.fn(),
}));

const SS_ACTION = {
    name: 'Stunning Strike',
    automation: {
        type: 'save_only',
        trigger: 'monk_weapon_or_unarmed_hit',
        cost: { resource: 'focus_points', amount: 1 },
        saveType: 'CON',
        saveDc: 'ability',
        saveAbility: 'WIS',
        oncePerTurn: true,
    },
};

const HIT = { attackerName: 'TestFighter', weaponType: 'melee', hit: true, targetName: 'Thug 1' };

// Fresh fixtures per mount; GRV supplies every key the SS path reads
// (activeBuffs, lastAttack, latch, focusPoints) — store-shaped, key-based.
function makeHarness({ rules = '2024', lastAttack, used, focusPoints = 4 } = {}) {
    const getRuntimeValue = vi.fn((charKey, key) => {
        if (key === 'activeBuffs') return [];
        if (key === 'focusPoints') return focusPoints;
        if (key === 'lastActionSpellCast') return null;
        if (key === 'lastAttack') return lastAttack;
        if (key === '_StunningStrike_usedRound') return used;
        return undefined;
    });
    const setRuntimeValue = vi.fn().mockResolvedValue(undefined);
    const hooks = createHooks({
        playerStats: { ...basePlayerStats, rules },
        getRuntimeValue,
        setRuntimeValue,
        // Null result short-circuits after dispatch, before result-shape processing
        // (popup/modal/roll dispatch shapes are pinned in the base .test.js lane).
        executeHandler: vi.fn().mockResolvedValue(null),
    });
    return { hooks, setRuntimeValue };
}

describe('CLA-342 Stunning Strike row gate (own melee hit, once per turn)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        combatRound.current = 4;
    });

    it.each([
        { branch: 'no lastAttack stored', lastAttack: undefined, reason: 'Last attack was not made by you.' },
        { branch: 'last attack made by another creature', lastAttack: { ...HIT, attackerName: 'SomeoneElse' }, reason: 'Last attack was not made by you.' },
        { branch: 'last melee attack missed', lastAttack: { ...HIT, hit: false }, reason: 'Last melee attack did not hit.' },
        { branch: 'last attack was ranged', lastAttack: { ...HIT, weaponType: 'ranged' }, reason: 'Requires a melee weapon attack.' },
        { branch: 'last attack was an auto-miss', lastAttack: { ...HIT, isAutoMiss: true }, reason: 'Requires a melee weapon attack.' },
        { branch: 'once-per-turn latch armed this round', lastAttack: HIT, used: { round: 4, activeCreature: 'TestFighter' }, reason: 'Once per turn — already used this turn.' },
    ])('refuses — $branch: byte-exact popup + blocked log, ZERO writes, ZERO dispatch (live round 4)', async ({ lastAttack, used, reason }) => {
        const { hooks, setRuntimeValue } = makeHarness({ lastAttack, used });

        await useCharActionsAutomation(hooks).handleAutomationAction(SS_ACTION);

        expect(hooks.setPopupHtml).toHaveBeenCalledWith(`<b>Stunning Strike</b><br/>${reason}`);
        expect(hooks.addEntry).toHaveBeenCalledTimes(1);
        expect(hooks.addEntry).toHaveBeenCalledWith(campaignName, {
            type: 'ability_use',
            characterName: 'TestFighter',
            abilityName: 'Stunning Strike',
            description: `Stunning Strike blocked — ${reason}`,
        });
        // The refusal sits BEFORE the Focus pre-spend: the injected setter has no
        // calls at all — no focusPoints write, no latch stamp.
        expect(setRuntimeValue).not.toHaveBeenCalled();
        expect(hooks.executeHandler).not.toHaveBeenCalled();
    });

    it.each([
        { rules: '2024', spendWord: 'Focus Point' },
        { rules: '5e', spendWord: 'ki point' },
    ])('arms on a qualifying melee hit ($rules): spends 1 FP, stamps round-attributed latch, logs spend by target, dispatches save', async ({ rules, spendWord }) => {
        combatRound.current = 7;
        const { hooks, setRuntimeValue } = makeHarness({
            rules,
            lastAttack: HIT,
            // Stale latch from round 2 — round advanced, so the gate must admit.
            used: { round: 2, activeCreature: 'TestFighter' },
            focusPoints: 4,
        });

        await useCharActionsAutomation(hooks).handleAutomationAction(SS_ACTION);

        // Write seam byte-exact and ordered: FP spend (4→3) lands before the latch stamp.
        expect(setRuntimeValue).toHaveBeenCalledTimes(2);
        expect(setRuntimeValue).toHaveBeenNthCalledWith(1, 'TestFighter', 'focusPoints', 3, campaignName);
        expect(setRuntimeValue).toHaveBeenNthCalledWith(2, 'TestFighter', '_StunningStrike_usedRound', { round: 7, activeCreature: 'TestFighter' }, campaignName);
        // Save-dispatch seam: the exact row + live stats reach the handler registry.
        expect(hooks.executeHandler).toHaveBeenCalledWith(SS_ACTION, hooks.playerStats, campaignName, 'test-map', []);
        expect(hooks.addEntry).toHaveBeenCalledTimes(1);
        expect(hooks.addEntry).toHaveBeenCalledWith(campaignName, {
            type: 'ability_use',
            characterName: 'TestFighter',
            abilityName: 'Stunning Strike',
            description: `Stunning Strike — expended 1 ${spendWord} to attempt to stun Thug 1.`,
        });
        // Positive leg reached dispatch, so the absence of any refusal popup is real gating.
        expect(hooks.setPopupHtml).not.toHaveBeenCalled();
    });
});
