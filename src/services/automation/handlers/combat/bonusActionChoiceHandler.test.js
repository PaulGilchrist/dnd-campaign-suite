// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks BEFORE imports ───────────────────────────────────────

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(() => null),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(async () => ({ round: 1, activeCreatureName: 'TestRogue' })),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../rules/effects/expirations.js', () => ({
    addExpiration: vi.fn(),
}));

// ── Imports ────────────────────────────────────────────────────

import { handle, applyBonusActionChoice } from './bonusActionChoiceHandler.js';
import * as useRuntimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as damageUtils from '../../../rules/combat/damageUtils.js';
import * as logService from '../../../ui/logService.js';
import * as expirations from '../../../rules/effects/expirations.js';

// ── Helpers ────────────────────────────────────────────────────

const campaignName = 'TestCampaign';

function makePlayerStats(overrides = {}) {
    return {
        name: 'TestRogue',
        ...overrides,
    };
}

function makeAction(automation = {}) {
    return {
        name: 'Cunning Action',
        description: 'On your turn, you can take one of the following actions as a Bonus Action: Dash, Disengage, or Hide.',
        automation: {
            type: 'bonus_action_choice',
            options: [
                { name: 'Dash', description: 'Double your movement speed until the end of the turn' },
                { name: 'Disengage', description: 'Your movement doesn\'t provoke opportunity attacks until the end of the turn' },
                { name: 'Hide', description: 'Attempt to hide from creatures until the end of the turn' },
            ],
            ...automation,
        },
    };
}

function makeFastHandsAction(automation = {}) {
    return {
        name: 'Fast Hands',
        description: 'You can use the bonus action granted by the Sleight of Hand feature to make a Dexterity (Sleight of Hand) check, use thieves\' tools to pick a lock or disarm a trap, or use an object.',
        automation: {
            type: 'bonus_action_choice',
            options: [
                { name: 'Sleight of Hand', description: 'Make a Dexterity (Sleight of Hand) check' },
                { name: 'Thieves\' Tools', description: 'Use thieves\' tools to pick a lock or disarm a trap' },
                { name: 'Use an Object', description: 'Use an object' },
            ],
            ...automation,
        },
    };
}

// ── handle: options flow ───────────────────────────────────────

describe('bonusActionChoiceHandler.handle — options flow', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns modal with action and options when options are available', async () => {
        const ps = makePlayerStats();
        const action = makeAction();

        const result = await handle(action, ps, campaignName);

        expect(result).toEqual({
            type: 'modal',
            modalName: 'bonusActionChoice',
            payload: {
                action,
                options: action.automation.options,
            },
        });
    });

    it.each([
        { label: 'undefined', options: undefined, expectedAutomation: { type: 'bonus_action_choice' } },
        { label: 'empty array', options: [], expectedAutomation: undefined },
    ])('returns info popup when options are $label', async ({ options, expectedAutomation }) => {
        const ps = makePlayerStats();
        const action = {
            name: 'Cunning Action',
            automation: {
                type: 'bonus_action_choice',
                options,
            },
        };

        const result = await handle(action, ps, campaignName);

        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.name).toBe('Cunning Action');
        expect(result.payload.description).toBe('Cunning Action has no options available.');
        if (expectedAutomation) {
            expect(result.payload.automation).toEqual(expectedAutomation);
        }
    });
});

// ── handle: once-per-turn flow ─────────────────────────────────

describe('bonusActionChoiceHandler.handle — once-per-turn', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns info popup when oncePerTurn is true and already used this round', async () => {
        const ps = makePlayerStats();
        const action = makeAction({ oncePerTurn: true });
        damageUtils.getCombatContext.mockResolvedValue({ round: 1, activeCreatureName: 'TestRogue' });
        useRuntimeState.getRuntimeValue.mockReturnValue({ round: 1, activeCreature: 'TestRogue' });

        const result = await handle(action, ps, campaignName);

        expect(result).toEqual({
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: 'Cunning Action',
                description: 'Cunning Action can only be used once per turn.',
            },
        });
    });

    it('proceeds to modal when oncePerTurn is true but a new round has passed', async () => {
        const ps = makePlayerStats();
        const action = makeAction({ oncePerTurn: true });
        damageUtils.getCombatContext.mockResolvedValue({ round: 2, activeCreatureName: 'TestRogue' });
        useRuntimeState.getRuntimeValue.mockReturnValue({ round: 1, activeCreature: 'TestRogue' });

        const result = await handle(action, ps, campaignName);

        expect(result.type).toBe('modal');
        expect(result.modalName).toBe('bonusActionChoice');
    });

    it('proceeds to modal when oncePerTurn is true but no stored value exists', async () => {
        const ps = makePlayerStats();
        const action = makeAction({ oncePerTurn: true });
        damageUtils.getCombatContext.mockResolvedValue({ round: 1, activeCreatureName: 'TestRogue' });
        useRuntimeState.getRuntimeValue.mockReturnValue(null);

        const result = await handle(action, ps, campaignName);

        expect(result.type).toBe('modal');
        expect(result.modalName).toBe('bonusActionChoice');
    });

    it('proceeds to modal when oncePerTurn is false', async () => {
        const ps = makePlayerStats();
        const action = makeAction({ oncePerTurn: false });

        const result = await handle(action, ps, campaignName);

        expect(result.type).toBe('modal');
        expect(result.modalName).toBe('bonusActionChoice');
    });
});

// ── handle: missing automation ─────────────────────────────────

describe('bonusActionChoiceHandler.handle — missing automation', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('throws when action.automation is undefined', async () => {
        const ps = makePlayerStats();
        const action = { name: 'Cunning Action' };

        await expect(handle(action, ps, campaignName)).rejects.toThrow(
            "Cannot read properties of undefined (reading 'options')",
        );
    });
});

// ── applyBonusActionChoice: known options ──────────────────────

describe('applyBonusActionChoice — known options', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it.each([
        { action: makeAction(), option: 'Dash', expected: 'Dash selected: You take the Dash bonus action. Speed doubled 30 → 60 ft until the end of the turn.' },
        { action: makeAction(), option: 'Disengage', expected: 'Disengage selected: You take the Disengage bonus action. Your movement doesn\'t provoke opportunity attacks until the end of the turn.' },
        { action: makeAction(), option: 'Hide', expected: 'Hide selected: Hide failed! Dexterity (Stealth) check undefined (d20: ? + 0) vs DC 15 — you remain visible.' },
        { action: makeFastHandsAction(), option: 'Sleight of Hand', expected: 'Sleight of Hand selected: You use Fast Hands to make a Dexterity (Sleight of Hand) check — pick pocket, palming a small object, hiding a small item, etc.' },
        { action: makeFastHandsAction(), option: 'Thieves\' Tools', expected: 'Thieves\' Tools selected: You use Fast Hands to use thieves\' tools to pick a lock or disarm a trap.' },
        { action: makeFastHandsAction(), option: 'Use an Object', expected: 'Use an Object selected: You use Fast Hands to use an object. Using a magic item that requires an action uses the Utilize action. Normal objects use the standard Action.' },
    ])('returns popup with correct description for $option', async ({ action, option, expected }) => {
        const ps = makePlayerStats();
        const result = await applyBonusActionChoice(action, ps, campaignName, option);

        expect(result.payload.description).toBe(expected);
    });

    it('Hide popup reports success with roll breakdown when the stealth check beats DC 15', async () => {
        const ps = makePlayerStats({ abilities: [{ name: 'Dexterity', bonus: 8, skills: [{ name: 'Stealth', bonus: 11 }] }] });
        useRuntimeState.getRuntimeValue.mockImplementation((_name, key) => (key === 'lastAttack' ? { total: 25, d20: 14 } : null));

        const result = await applyBonusActionChoice(makeAction(), ps, campaignName, 'Hide');

        expect(result.payload.description).toBe('Hide selected: Hide successful! Dexterity (Stealth) check 25 (d20: 14 + 11) vs DC 15 — you gain the Invisible condition until you attack, take damage, or are detected.');
    });

    it('returns popup with automation payload for known options', async () => {
        const ps = makePlayerStats();
        const action = makeAction({ oncePerTurn: true, customField: 'test' });
        const result = await applyBonusActionChoice(action, ps, campaignName, 'Dash');

        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.name).toBe('Cunning Action');
        expect(result.payload.automation).toEqual({
            type: 'bonus_action_choice',
            options: action.automation.options,
            oncePerTurn: true,
            customField: 'test',
        });
    });
});

// ── applyBonusActionChoice: unknown option ─────────────────────

describe('applyBonusActionChoice — unknown option', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it.each([
        { action: makeAction(), option: 'Foo', expected: 'Unknown option: Foo' },
        { action: makeAction({ options: [] }), option: 'Dash', expected: 'Unknown option: Dash' },
        { action: makeAction({ options: undefined }), option: 'Dash', expected: 'Unknown option: Dash' },
        { action: makeAction(), option: null, expected: 'Unknown option: null' },
        { action: makeAction(), option: undefined, expected: 'Unknown option: undefined' },
    ])('returns popup with unknown option message for $option', async ({ action, option, expected }) => {
        const ps = makePlayerStats();
        const result = await applyBonusActionChoice(action, ps, campaignName, option);

        expect(result.payload.description).toBe(expected);
    });
});

// ── applyBonusActionChoice: once-per-turn tracking ─────────────

describe('applyBonusActionChoice — once-per-turn tracking', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('tracks once-per-turn usage with Cunning Action key when set', async () => {
        const ps = makePlayerStats();
        const action = makeAction({ oncePerTurn: true });
        damageUtils.getCombatContext.mockResolvedValue({ round: 3, activeCreatureName: 'TestRogue' });

        await applyBonusActionChoice(action, ps, campaignName, 'Dash');

        expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
            ps.name,
            '_CunningAction_usedRound',
            { round: 3, activeCreature: 'TestRogue' },
            campaignName,
        );
    });

    it('tracks once-per-turn usage with Fast Hands key when action name is Fast Hands', async () => {
        const ps = makePlayerStats();
        const action = makeFastHandsAction({ oncePerTurn: true });
        damageUtils.getCombatContext.mockResolvedValue({ round: 5, activeCreatureName: 'TestRogue' });

        await applyBonusActionChoice(action, ps, campaignName, 'Sleight of Hand');

        expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
            ps.name,
            '_FastHands_usedRound',
            { round: 5, activeCreature: 'TestRogue' },
            campaignName,
        );
    });

    it('does not stamp latch keys when oncePerTurn is false or absent', async () => {
        const ps = makePlayerStats();

        await applyBonusActionChoice(makeAction({ oncePerTurn: false }), ps, campaignName, 'Dash');
        expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalledWith(
            ps.name, '_CunningAction_usedRound', expect.anything(), campaignName,
        );

        vi.clearAllMocks();
        await applyBonusActionChoice(makeAction(), ps, campaignName, 'Dash');
        expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalledWith(
            ps.name, '_CunningAction_usedRound', expect.anything(), campaignName,
        );
    });
});

// ── applyBonusActionChoice: CLA-067 mechanical grants ──────────

describe('applyBonusActionChoice — CLA-067 mechanical grants', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        useRuntimeState.getRuntimeValue.mockReturnValue(null);
    });

    it('Dash stamps a speed_boost buff doubling speed and a single expiry clock', async () => {
        const ps = makePlayerStats({ speed: 40 });

        await applyBonusActionChoice(makeAction(), ps, campaignName, 'Dash');

        expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
            ps.name, 'activeBuffs',
            [{ name: 'Cunning Action', effect: 'speed_boost', speedBonus: 40, duration: 'until_end_of_turn' }],
            campaignName,
        );
        expect(expirations.addExpiration).toHaveBeenCalledTimes(1);
        expect(expirations.addExpiration).toHaveBeenCalledWith({
            attackerName: ps.name,
            targetName: ps.name,
            effects: [{ type: 'remove_active_buff', buffName: 'Cunning Action' }],
            campaignName,
            rounds: undefined,
            expireOnCreatureName: ps.name,
        });
        expect(logService.addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
            type: 'ability_use',
            abilityName: 'Cunning Action',
            description: 'Dash: Speed doubled 40 → 80 ft until the end of the turn (+40 ft speed_boost).',
        }));
    });

    it('Dash replaces a prior Cunning Action speed_boost instead of stacking', async () => {
        const ps = makePlayerStats({ speed: 30 });
        useRuntimeState.getRuntimeValue.mockImplementation((_name, key) => (
            key === 'activeBuffs' ? [{ name: 'Longstrider', effect: 'speed_boost', speedBonus: 10 }] : null
        ));

        await applyBonusActionChoice(makeAction(), ps, campaignName, 'Dash');

        expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
            ps.name, 'activeBuffs',
            [
                { name: 'Longstrider', effect: 'speed_boost', speedBonus: 10 },
                { name: 'Cunning Action', effect: 'speed_boost', speedBonus: 30, duration: 'until_end_of_turn' },
            ],
            campaignName,
        );
    });

    it('Disengage stamps self-target no_opportunity_attacks te with a single expiry clock', async () => {
        const ps = makePlayerStats();

        await applyBonusActionChoice(makeAction(), ps, campaignName, 'Disengage');

        expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
            'campaign', 'targetEffects',
            [{ target: ps.name, source: 'Cunning Action', effect: 'no_opportunity_attacks', value: null, duration: 'until_start_of_next_turn' }],
            campaignName,
        );
        expect(expirations.addExpiration).toHaveBeenCalledTimes(1);
        expect(expirations.addExpiration).toHaveBeenCalledWith({
            attackerName: ps.name,
            targetName: ps.name,
            effects: [{ type: 'remove_target_effect', effectKey: 'no_opportunity_attacks', source: 'Cunning Action', target: ps.name }],
            campaignName,
            rounds: undefined,
            expireOnCreatureName: ps.name,
        });
        expect(logService.addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
            type: 'ability_use',
            abilityName: 'Cunning Action',
            description: 'Disengage: movement doesn\'t provoke Opportunity Attacks until the end of the turn (no_opportunity_attacks).',
        }));
    });

    it('Hide dispatches the stealth check lane and stamps Invisible + stealth buff on success', async () => {
        const ps = makePlayerStats({ abilities: [{ name: 'Dexterity', bonus: 8, skills: [{ name: 'Stealth', bonus: 11 }] }] });
        const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
        useRuntimeState.getRuntimeValue.mockImplementation((_name, key) => {
            if (key === 'lastAttack') return { total: 25, d20: 14 };
            return null;
        });

        await applyBonusActionChoice(makeAction(), ps, campaignName, 'Hide');

        expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'internal-skill-check' }));
        expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
            ps.name, 'activeConditions', ['invisible'], campaignName,
        );
        expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
            ps.name, 'activeBuffs', [{ name: 'Hide', effect: 'advantage_on_stealth' }], campaignName,
        );
        expect(logService.addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
            type: 'ability_use',
            abilityName: 'Cunning Action',
            description: 'Hide: Stealth check 25 (d20: 14 + 11) vs DC 15 — Success. Gained the Invisible condition until you attack or take damage.',
        }));
        dispatchSpy.mockRestore();
    });

    it('Hide stamps nothing and logs failure when the stealth check fails', async () => {
        const ps = makePlayerStats();
        useRuntimeState.getRuntimeValue.mockImplementation((_name, key) => {
            if (key === 'lastAttack') return { total: 10, d20: 2 };
            return null;
        });

        await applyBonusActionChoice(makeAction(), ps, campaignName, 'Hide');

        expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalledWith(
            ps.name, 'activeConditions', expect.anything(), campaignName,
        );
        expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalledWith(
            ps.name, 'activeBuffs', expect.anything(), campaignName,
        );
        expect(logService.addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
            type: 'ability_use',
            abilityName: 'Cunning Action',
            description: 'Hide: Stealth check 10 (d20: 2 + 0) vs DC 15 — Failure. You remain visible.',
        }));
    });
});

// ── applyBonusActionChoice: campaign logging ───────────────────

describe('applyBonusActionChoice — campaign logging', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('logs campaign entry for Cunning Action Dash', async () => {
        const ps = makePlayerStats();

        await applyBonusActionChoice(makeAction(), ps, campaignName, 'Dash');
        expect(logService.addEntry).toHaveBeenCalledWith(campaignName, {
            type: 'ability_use',
            characterName: ps.name,
            abilityName: 'Cunning Action',
            description: 'Dash selected',
        });
    });

    it('logs campaign entry for Fast Hands Sleight of Hand', async () => {
        const ps = makePlayerStats();

        await applyBonusActionChoice(makeFastHandsAction(), ps, campaignName, 'Sleight of Hand');
        expect(logService.addEntry).toHaveBeenCalledWith(campaignName, {
            type: 'ability_use',
            characterName: ps.name,
            abilityName: 'Fast Hands',
            description: 'Sleight of Hand selected',
        });
    });

    it('returns popup even when addEntry rejects', async () => {
        const ps = makePlayerStats();
        logService.addEntry.mockRejectedValue(new Error('log failed'));

        const result = await applyBonusActionChoice(makeAction(), ps, campaignName, 'Dash');

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('Dash selected');
    });
});

// ── applyBonusActionChoice: missing automation ─────────────────

describe('applyBonusActionChoice — missing automation', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('throws when automation is null or undefined', async () => {
        const ps = makePlayerStats();

        await expect(applyBonusActionChoice({ name: 'Cunning Action', automation: null }, ps, campaignName, 'Dash')).rejects.toThrow(
            "Cannot read properties of null (reading 'options')",
        );

        await expect(applyBonusActionChoice({ name: 'Cunning Action' }, ps, campaignName, 'Dash')).rejects.toThrow(
            "Cannot read properties of undefined (reading 'options')",
        );
    });
});
