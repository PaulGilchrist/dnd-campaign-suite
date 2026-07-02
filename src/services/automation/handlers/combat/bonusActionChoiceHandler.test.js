// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks BEFORE imports ───────────────────────────────────────

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../../../services/encounters/combatData.js', () => ({
    getCurrentCombatRound: vi.fn(() => 1),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

// ── Imports ────────────────────────────────────────────────────

import { handle, applyBonusActionChoice } from './bonusActionChoiceHandler.js';
import * as useRuntimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as combatData from '../../../../services/encounters/combatData.js';
import * as logService from '../../../ui/logService.js';

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

    it('returns info popup when options key is missing (undefined defaults to empty)', async () => {
        const ps = makePlayerStats();
        const action = makeAction({ options: undefined });

        const result = await handle(action, ps, campaignName);

        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.description).toContain('no options available');
    });

    it('returns info popup when options array is empty', async () => {
        const ps = makePlayerStats();
        const action = makeAction({ options: [] });

        const result = await handle(action, ps, campaignName);

        expect(result).toEqual({
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: 'Cunning Action',
                description: 'Cunning Action has no options available.',
                automation: action.automation,
            },
        });
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
        combatData.getCurrentCombatRound.mockReturnValue(1);
        useRuntimeState.getRuntimeValue.mockReturnValue(1);

        const result = await handle(action, ps, campaignName);

        expect(result).toEqual({
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: 'Cunning Action',
                description: 'Cunning Action can only be used once per turn.',
                automation: action.automation,
            },
        });
        expect(useRuntimeState.getRuntimeValue).toHaveBeenCalledWith(
            ps.name,
            '_CunningAction_usedRound',
            campaignName,
        );
        expect(combatData.getCurrentCombatRound).toHaveBeenCalled();
    });

    it('returns info popup with Fast Hands tracking key when action name is Fast Hands', async () => {
        const ps = makePlayerStats();
        const action = makeFastHandsAction({ oncePerTurn: true });
        combatData.getCurrentCombatRound.mockReturnValue(1);
        useRuntimeState.getRuntimeValue.mockReturnValue(1);

        const result = await handle(action, ps, campaignName);

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('once per turn');
        expect(useRuntimeState.getRuntimeValue).toHaveBeenCalledWith(
            ps.name,
            '_FastHands_usedRound',
            campaignName,
        );
    });

    it('proceeds to modal when oncePerTurn is true but round differs', async () => {
        const ps = makePlayerStats();
        const action = makeAction({ oncePerTurn: true });
        combatData.getCurrentCombatRound.mockReturnValue(2);
        useRuntimeState.getRuntimeValue.mockReturnValue(1);

        const result = await handle(action, ps, campaignName);

        expect(result.type).toBe('modal');
        expect(result.modalName).toBe('bonusActionChoice');
    });

    it('proceeds to modal when oncePerTurn is false', async () => {
        const ps = makePlayerStats();
        const action = makeAction({ oncePerTurn: false });
        useRuntimeState.getRuntimeValue.mockReturnValue(1);

        const result = await handle(action, ps, campaignName);

        expect(result.type).toBe('modal');
        expect(result.modalName).toBe('bonusActionChoice');
        expect(useRuntimeState.getRuntimeValue).not.toHaveBeenCalled();
    });
});

// ── handle: edge cases ─────────────────────────────────────────

describe('bonusActionChoiceHandler.handle — edge cases', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('throws when action has undefined automation', async () => {
        const ps = makePlayerStats();
        const action = { name: 'Broken Ability' };

        await expect(handle(action, ps, campaignName)).rejects.toThrow();
    });

    it('returns info popup when automation exists but options is undefined (fallback to [])', async () => {
        const ps = makePlayerStats();
        const action = { name: 'Empty Ability', automation: { type: 'bonus_action_choice' } };

        const result = await handle(action, ps, campaignName);

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('no options available');
    });
});

// ── applyBonusActionChoice: known options ──────────────────────

describe('applyBonusActionChoice — known options', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns popup with Dash description', async () => {
        const ps = makePlayerStats();
        const action = makeAction();

        const result = await applyBonusActionChoice(action, ps, campaignName, 'Dash');

        expect(result).toEqual({
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: 'Cunning Action',
                description: 'Dash selected: You take the Dash bonus action. Your movement speed is doubled until the end of the turn.',
                automation: action.automation,
            },
        });
    });

    it('returns popup with Disengage description', async () => {
        const ps = makePlayerStats();
        const action = makeAction();

        const result = await applyBonusActionChoice(action, ps, campaignName, 'Disengage');

        expect(result.payload.description).toBe('Disengage selected: You take the Disengage bonus action. Your movement doesn\'t provoke opportunity attacks until the end of the turn.');
    });

    it('returns popup with Hide description', async () => {
        const ps = makePlayerStats();
        const action = makeAction();

        const result = await applyBonusActionChoice(action, ps, campaignName, 'Hide');

        expect(result.payload.description).toBe('Hide selected: You attempt to Hide. Make a Dexterity (Stealth) check to try to become hidden from creatures until the end of the turn.');
    });

    it('returns popup with Sleight of Hand description', async () => {
        const ps = makePlayerStats();
        const action = makeFastHandsAction();

        const result = await applyBonusActionChoice(action, ps, campaignName, 'Sleight of Hand');

        expect(result.payload.description).toBe('Sleight of Hand selected: You use Fast Hands to make a Dexterity (Sleight of Hand) check — pick pocket, palming a small object, hiding a small item, etc.');
    });

    it('returns popup with Thieves\' Tools description', async () => {
        const ps = makePlayerStats();
        const action = makeFastHandsAction();

        const result = await applyBonusActionChoice(action, ps, campaignName, 'Thieves\' Tools');

        expect(result.payload.description).toBe('Thieves\' Tools selected: You use Fast Hands to use thieves\' tools to pick a lock or disarm a trap.');
    });

    it('returns popup with Use an Object description', async () => {
        const ps = makePlayerStats();
        const action = makeFastHandsAction();

        const result = await applyBonusActionChoice(action, ps, campaignName, 'Use an Object');

        expect(result.payload.description).toBe('Use an Object selected: You use Fast Hands to use an object. Using a magic item that requires an action uses the Utilize action. Normal objects use the standard Action.');
    });
});

// ── applyBonusActionChoice: unknown option ─────────────────────

describe('applyBonusActionChoice — unknown option', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns popup with unknown option message for unrecognized option', async () => {
        const ps = makePlayerStats();
        const action = makeAction();

        const result = await applyBonusActionChoice(action, ps, campaignName, 'Foo');

        expect(result).toEqual({
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: 'Cunning Action',
                description: 'Unknown option: Foo',
                automation: action.automation,
            },
        });
    });

    it('returns popup with unknown option message when options array is empty', async () => {
        const ps = makePlayerStats();
        const action = makeAction({ options: [] });

        const result = await applyBonusActionChoice(action, ps, campaignName, 'Dash');

        expect(result.payload.description).toBe('Unknown option: Dash');
    });

    it('returns popup with unknown option message when options is undefined', async () => {
        const ps = makePlayerStats();
        const action = makeAction({ options: undefined });

        const result = await applyBonusActionChoice(action, ps, campaignName, 'Dash');

        expect(result.payload.description).toBe('Unknown option: Dash');
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
        combatData.getCurrentCombatRound.mockReturnValue(3);

        await applyBonusActionChoice(action, ps, campaignName, 'Dash');

        expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
            ps.name,
            '_CunningAction_usedRound',
            3,
            campaignName,
            true,
        );
    });

    it('tracks once-per-turn usage with Fast Hands key when action name is Fast Hands', async () => {
        const ps = makePlayerStats();
        const action = makeFastHandsAction({ oncePerTurn: true });
        combatData.getCurrentCombatRound.mockReturnValue(5);

        await applyBonusActionChoice(action, ps, campaignName, 'Sleight of Hand');

        expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
            ps.name,
            '_FastHands_usedRound',
            5,
            campaignName,
            true,
        );
    });

    it('does not track when oncePerTurn is false', async () => {
        const ps = makePlayerStats();
        const action = makeAction({ oncePerTurn: false });

        await applyBonusActionChoice(action, ps, campaignName, 'Dash');

        expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
    });

    it('does not track when oncePerTurn is undefined', async () => {
        const ps = makePlayerStats();
        const action = makeAction();

        await applyBonusActionChoice(action, ps, campaignName, 'Dash');

        expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
    });
});

// ── applyBonusActionChoice: campaign logging ────────────────────

describe('applyBonusActionChoice — campaign logging', async () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('logs campaign entry when Fast Hands Sleight of Hand is selected', async () => {
        const ps = makePlayerStats();
        const action = makeFastHandsAction();

        await applyBonusActionChoice(action, ps, campaignName, 'Sleight of Hand');

        expect(logService.addEntry).toHaveBeenCalledWith(campaignName, {
            type: 'ability_use',
            characterName: ps.name,
            abilityName: 'Fast Hands',
            description: 'Sleight of Hand selected',
        });
    });

    it('logs campaign entry when Fast Hands Thieves\' Tools is selected', async () => {
        const ps = makePlayerStats();
        const action = makeFastHandsAction();

        await applyBonusActionChoice(action, ps, campaignName, 'Thieves\' Tools');

        expect(logService.addEntry).toHaveBeenCalledWith(campaignName, {
            type: 'ability_use',
            characterName: ps.name,
            abilityName: 'Fast Hands',
            description: 'Thieves\' Tools selected',
        });
    });

    it('logs campaign entry when Cunning Action Dash is selected', async () => {
        const ps = makePlayerStats();
        const action = makeAction();

        await applyBonusActionChoice(action, ps, campaignName, 'Dash');

        expect(logService.addEntry).toHaveBeenCalledWith(campaignName, {
            type: 'ability_use',
            characterName: ps.name,
            abilityName: 'Cunning Action',
            description: 'Dash selected',
        });
    });
});
