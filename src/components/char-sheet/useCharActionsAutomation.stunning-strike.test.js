// CLA-342 regression: Stunning Strike row must gate on the sheet trigger
// (monk_weapon_or_unarmed_hit): own melee HIT required, once-per-turn latch,
// refusal BEFORE Focus Point spend, arm + spend + latch stamp + logs on pass.
import { describe, it, expect, vi } from 'vitest';
import useCharActionsAutomation from './useCharActionsAutomation.js';
import { createHooks, campaignName, basePlayerStats } from './useCharActionsAutomation.test.setup.js';

vi.mock('../../services/automation/handlers/class-cleric-paladin/divineInterventionHandler.js', () => ({
    handle: vi.fn(),
    onSpellSelected: vi.fn(),
}));

vi.mock('../../services/rules/spells/spellCastService.js', () => ({
    executeSpellCast: vi.fn(),
}));

let mockRound = 1;
vi.mock('../../services/rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(async () => ({ round: mockRound, creatures: [] })),
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

function makeGRV({ lastAttack, used, focusPoints = 3 } = {}) {
    return vi.fn((charKey, key, _cn) => {
        if (key === 'activeBuffs') return [];
        if (key === 'focusPoints') return focusPoints;
        if (key === 'lastActionSpellCast') return null;
        if (key === 'lastAttack') return lastAttack;
        if (key === '_StunningStrike_usedRound') return used;
        return undefined;
    });
}

const HIT = { attackerName: 'TestFighter', weaponType: 'melee', hit: true, targetName: 'Thug 1' };

describe('CLA-342 Stunning Strike trigger gate', () => {
    it('refuses with popup + log, spends no FP, dispatches nothing when there is no lastAttack', async () => {
        const srw = vi.fn();
        const hooks = createHooks({ getRuntimeValue: makeGRV({ lastAttack: undefined }), setRuntimeValue: srw });
        const { handleAutomationAction } = useCharActionsAutomation(hooks);

        await handleAutomationAction(SS_ACTION);

        expect(hooks.setPopupHtml).toHaveBeenCalledWith(expect.stringContaining('Last attack was not made by you'));
        expect(hooks.addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
            type: 'ability_use',
            description: expect.stringContaining('blocked'),
        }));
        expect(srw).not.toHaveBeenCalledWith('TestFighter', 'focusPoints', expect.any(Number), campaignName);
        expect(hooks.executeHandler).not.toHaveBeenCalled();
    });

    it('refuses when the last attack was made by another creature', async () => {
        const srw = vi.fn();
        const hooks = createHooks({
            getRuntimeValue: makeGRV({ lastAttack: { ...HIT, attackerName: 'SomeoneElse' } }),
            setRuntimeValue: srw,
        });
        const { handleAutomationAction } = useCharActionsAutomation(hooks);

        await handleAutomationAction(SS_ACTION);

        expect(hooks.setPopupHtml).toHaveBeenCalledWith(expect.stringContaining('Last attack was not made by you'));
        expect(srw).not.toHaveBeenCalledWith('TestFighter', 'focusPoints', expect.any(Number), campaignName);
        expect(hooks.executeHandler).not.toHaveBeenCalled();
    });

    it('refuses when the last melee attack missed', async () => {
        const srw = vi.fn();
        const hooks = createHooks({
            getRuntimeValue: makeGRV({ lastAttack: { ...HIT, hit: false } }),
            setRuntimeValue: srw,
        });
        const { handleAutomationAction } = useCharActionsAutomation(hooks);

        await handleAutomationAction(SS_ACTION);

        expect(hooks.setPopupHtml).toHaveBeenCalledWith(expect.stringContaining('did not hit'));
        expect(srw).not.toHaveBeenCalledWith('TestFighter', 'focusPoints', expect.any(Number), campaignName);
        expect(hooks.executeHandler).not.toHaveBeenCalled();
    });

    it('refuses when the last attack was ranged', async () => {
        const srw = vi.fn();
        const hooks = createHooks({
            getRuntimeValue: makeGRV({ lastAttack: { ...HIT, weaponType: 'ranged' } }),
            setRuntimeValue: srw,
        });
        const { handleAutomationAction } = useCharActionsAutomation(hooks);

        await handleAutomationAction(SS_ACTION);

        expect(hooks.setPopupHtml).toHaveBeenCalledWith(expect.stringContaining('melee weapon attack'));
        expect(srw).not.toHaveBeenCalledWith('TestFighter', 'focusPoints', expect.any(Number), campaignName);
        expect(hooks.executeHandler).not.toHaveBeenCalled();
    });

    it('refuses once-per-turn when the latch round matches the current round, without spending FP', async () => {
        mockRound = 2;
        const srw = vi.fn();
        const hooks = createHooks({
            getRuntimeValue: makeGRV({ lastAttack: HIT, used: { round: 2, activeCreature: 'TestFighter' } }),
            setRuntimeValue: srw,
        });
        const { handleAutomationAction } = useCharActionsAutomation(hooks);

        await handleAutomationAction(SS_ACTION);

        expect(hooks.setPopupHtml).toHaveBeenCalledWith(expect.stringContaining('Once per turn'));
        expect(srw).not.toHaveBeenCalledWith('TestFighter', 'focusPoints', expect.any(Number), campaignName);
        expect(hooks.executeHandler).not.toHaveBeenCalled();
        mockRound = 1;
    });

    it('arms on a qualifying melee hit: spends 1 FP, stamps the once-per-turn latch, logs the spend, dispatches the handler', async () => {
        mockRound = 3;
        const srw = vi.fn().mockResolvedValue(undefined);
        const hooks = createHooks({
            playerStats: { ...basePlayerStats, rules: '2024' },
            getRuntimeValue: makeGRV({ lastAttack: HIT, used: { round: 1, activeCreature: 'TestFighter' }, focusPoints: 4 }),
            setRuntimeValue: srw,
        });
        hooks.executeHandler.mockResolvedValue({ type: 'popup', payload: 'done' });
        const { handleAutomationAction } = useCharActionsAutomation(hooks);

        await handleAutomationAction(SS_ACTION);

        expect(srw).toHaveBeenCalledWith('TestFighter', 'focusPoints', 3, campaignName);
        expect(srw).toHaveBeenCalledWith('TestFighter', '_StunningStrike_usedRound', { round: 3, activeCreature: 'TestFighter' }, campaignName);
        expect(hooks.addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
            type: 'ability_use',
            description: expect.stringContaining('expended 1 Focus Point'),
        }));
        expect(hooks.executeHandler).toHaveBeenCalled();
        mockRound = 1;
    });
});
