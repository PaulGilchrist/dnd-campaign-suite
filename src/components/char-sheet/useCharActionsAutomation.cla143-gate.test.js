// @maintained-by-ai
// CLA-143 READ-side gate lane: the feature-row lane must gate `after_attack_action`
// rows on `_attackActionTakenRound === getCurrentCombatRound()` — refusal (popup +
// byte-exact `<feature>_refused` log, §5 convention) with ZERO writes, or proceed
// with the Focus pre-spend (exactly 1, CLA-159) and dispatch.
// Owned elsewhere: latch WRITE seam → useCharActionsAttackHandlers.cla143-stamp.test.js;
// Fleet Step grant → useCharActionsAutomation.fleetStep.test.js;
// after_casting_action_spell refusal + FP cost lanes → useCharActionsAutomation.test.js.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import useCharActionsAutomation from './useCharActionsAutomation.js';

// Live combat round as a controllable prop so the gate comparison is pinned to
// getCurrentCombatRound() itself, not to a hardcoded round 1.
const { combatRound } = vi.hoisted(() => ({ combatRound: { current: 5 } }));

// Seam isolation — each mock maps 1:1 to a direct import of useCharActionsAutomation.js,
// keeping the hook's unrelated outbound lanes (divine intervention, spell cast, stunning
// strike context, class-feature FP fallback) inert. combatData keeps the extra keys its
// live unmocked consumers (buffHandler → expirations → expireStaleEffects, :L7) import.
vi.mock('../../services/automation/handlers/class-cleric-paladin/divineInterventionHandler.js', () => ({
    onSpellSelected: vi.fn(),
    handle: vi.fn(),
}));
vi.mock('../../services/rules/spells/spellCastService.js', () => ({
    executeSpellCast: vi.fn(),
}));
vi.mock('../../services/rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(),
    getTargetFromAttacker: vi.fn(),
}));
vi.mock('../../services/character/classFeatures.js', () => ({
    getClassFeatures: vi.fn(),
}));
vi.mock('../../services/encounters/combatData.js', () => ({
    getCurrentCombatRound: vi.fn(() => combatRound.current),
    getCombatSummary: vi.fn(),
    getActiveCreatureName: vi.fn(),
    loadCombatSummary: vi.fn(),
}));

const campaignName = 'test-campaign';

const flurryRow = {
    name: 'Heightened Flurry of Blows',
    automation: {
        type: 'bonus_attacks',
        attacks: 3,
        attackType: 'unarmed_strike',
        cost: { resource: 'focus_points', amount: 1 },
        trigger: 'after_attack_action',
        casting_time: '1 bonus action',
    },
};

const monkStats = {
    name: 'Disciplined_Monk',
    level: 20,
    rules: '2024',
    class: { name: 'Monk', class_levels: [{ level: 20, focus_points: 20 }] },
    abilities: [{ name: 'Wisdom', bonus: 5 }],
    specialActions: [],
};

function createHarness(armedRound) {
    const getRuntimeValue = vi.fn((charKey, key) => {
        if (key === 'activeBuffs') return [];
        if (key === 'focusPoints') return 20;
        if (key === '_attackActionTakenRound') return armedRound;
        if (key === 'lastActionSpellCast') return null;
        return undefined;
    });
    const hooks = {
        cannotAct: false,
        playerStats: monkStats,
        campaignName,
        mapName: 'test-map',
        characters: [],
        getRuntimeValue,
        setRuntimeValue: vi.fn(() => Promise.resolve()),
        setPopupHtml: vi.fn(),
        setModalState: vi.fn(),
        modalState: {},
        rollDamage: vi.fn(),
        rollAttack: vi.fn(),
        // Null result short-circuits before dispatch side effects (result
        // shapes and the Fleet Step grant are pinned in their own lanes).
        executeHandler: vi.fn(() => Promise.resolve(null)),
        addEntry: vi.fn(() => Promise.resolve()),
        onBuffsChange: vi.fn(),
    };
    return hooks;
}

describe('CLA-143 after_attack_action gate (row lane, read side)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        combatRound.current = 5;
    });

    it.each([
        { armedRound: null, branch: 'no latch stored — never armed' },
        { armedRound: 0, branch: 'latch reads round 0' },
        { armedRound: 3, branch: 'armed on a previous round (round-wrap re-arm)' },
    ])('refuses Flurry with zero writes and zero dispatch — $branch (live round 5)', async ({ armedRound }) => {
        const hooks = createHarness(armedRound);
        await useCharActionsAutomation(hooks).handleAutomationAction(flurryRow);

        expect(hooks.setPopupHtml).toHaveBeenCalledWith('<b>Heightened Flurry of Blows</b><br/>You must take the Attack action first.');
        expect(hooks.addEntry).toHaveBeenCalledTimes(1);
        expect(hooks.addEntry).toHaveBeenCalledWith(campaignName, {
            type: 'automation',
            characterName: 'Disciplined_Monk',
            automationType: 'heightened_flurry_of_blows_refused',
            name: 'Heightened Flurry of Blows',
            description: 'Heightened Flurry of Blows refused — no_attack_action_taken: You must take the Attack action first.',
            timestamp: expect.any(Number),
        });
        // Focus is 20 (>0): the refusal sits BEFORE the pre-spend and burns nothing —
        // the injected setter has no calls at all, not just no focusPoints write.
        expect(hooks.setRuntimeValue).not.toHaveBeenCalled();
        expect(hooks.executeHandler).not.toHaveBeenCalled();
    });

    it('proceeds when the latch matches the live round: FP spends exactly 1, then dispatch', async () => {
        const hooks = createHarness(combatRound.current);
        await useCharActionsAutomation(hooks).handleAutomationAction(flurryRow);

        expect(hooks.executeHandler).toHaveBeenCalledWith(flurryRow, monkStats, campaignName, 'test-map', []);
        expect(hooks.setRuntimeValue).toHaveBeenCalledTimes(1);
        expect(hooks.setRuntimeValue).toHaveBeenCalledWith('Disciplined_Monk', 'focusPoints', 19, campaignName);
        // Positive leg reached the dispatch seam, so the absence of the refusal is real gating.
        expect(hooks.addEntry.mock.calls.filter(c => c[1].automationType === 'heightened_flurry_of_blows_refused')).toHaveLength(0);
    });
});
