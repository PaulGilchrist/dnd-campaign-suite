// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks BEFORE imports ───────────────────────────────────────

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(async () => ({ round: 1, activeCreatureName: 'TestRogue' })),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

// ── Imports ────────────────────────────────────────────────────

import { handle, applyBonusActionChoice } from './bonusActionChoiceHandler.js';
import * as useRuntimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as damageUtils from '../../../rules/combat/damageUtils.js';
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

    it('returns info popup when options are missing or empty', async () => {
        const ps = makePlayerStats();

        const resultUndef = await handle({ ...makeAction({ options: undefined }), automation: { type: 'bonus_action_choice', options: undefined } }, ps, campaignName);
        expect(resultUndef.type).toBe('popup');
        expect(resultUndef.payload.type).toBe('automation_info');
        expect(resultUndef.payload.description).toContain('no options available');

        vi.clearAllMocks();

        const resultEmpty = await handle({ ...makeAction({ options: [] }), automation: { type: 'bonus_action_choice', options: [] } }, ps, campaignName);
        expect(resultEmpty.type).toBe('popup');
        expect(resultEmpty.payload.type).toBe('automation_info');
        expect(resultEmpty.payload.description).toContain('has no options available');
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
        expect(useRuntimeState.getRuntimeValue).toHaveBeenCalled();
    });

    it('returns info popup with Fast Hands tracking when oncePerTurn is true and already used', async () => {
        const ps = makePlayerStats();
        const action = makeFastHandsAction({ oncePerTurn: true });
        damageUtils.getCombatContext.mockResolvedValue({ round: 1, activeCreatureName: 'TestRogue' });
        useRuntimeState.getRuntimeValue.mockReturnValue({ round: 1, activeCreature: 'TestRogue' });

        const result = await handle(action, ps, campaignName);

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('once per turn');
        expect(useRuntimeState.getRuntimeValue).toHaveBeenCalledWith(
            null,
            '_FastHands_usedRound',
            campaignName,
        );
    });

    it('proceeds to modal when oncePerTurn is true but round differs', async () => {
        const ps = makePlayerStats();
        const action = makeAction({ oncePerTurn: true });
        damageUtils.getCombatContext.mockResolvedValue({ round: 2, activeCreatureName: 'TestRogue' });
        useRuntimeState.getRuntimeValue.mockReturnValue({ round: 1, activeCreature: 'TestRogue' });

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
        expect(useRuntimeState.getRuntimeValue).not.toHaveBeenCalled();
    });
});

// ── applyBonusActionChoice: known options ──────────────────────

describe('applyBonusActionChoice — known options', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns popup with correct description for each option', async () => {
        const ps = makePlayerStats();

        let result = await applyBonusActionChoice(makeAction(), ps, campaignName, 'Dash');
        expect(result.payload.description).toBe('Dash selected: You take the Dash bonus action. Your movement speed is doubled until the end of the turn.');

        vi.clearAllMocks();

        result = await applyBonusActionChoice(makeAction(), ps, campaignName, 'Disengage');
        expect(result.payload.description).toBe('Disengage selected: You take the Disengage bonus action. Your movement doesn\'t provoke opportunity attacks until the end of the turn.');

        vi.clearAllMocks();

        result = await applyBonusActionChoice(makeAction(), ps, campaignName, 'Hide');
        expect(result.payload.description).toBe('Hide selected: You attempt to Hide. Make a Dexterity (Stealth) check to try to become hidden from creatures until the end of the turn.');

        vi.clearAllMocks();

        result = await applyBonusActionChoice(makeFastHandsAction(), ps, campaignName, 'Sleight of Hand');
        expect(result.payload.description).toBe('Sleight of Hand selected: You use Fast Hands to make a Dexterity (Sleight of Hand) check — pick pocket, palming a small object, hiding a small item, etc.');

        vi.clearAllMocks();

        result = await applyBonusActionChoice(makeFastHandsAction(), ps, campaignName, 'Thieves\' Tools');
        expect(result.payload.description).toBe('Thieves\' Tools selected: You use Fast Hands to use thieves\' tools to pick a lock or disarm a trap.');

        vi.clearAllMocks();

        result = await applyBonusActionChoice(makeFastHandsAction(), ps, campaignName, 'Use an Object');
        expect(result.payload.description).toBe('Use an Object selected: You use Fast Hands to use an object. Using a magic item that requires an action uses the Utilize action. Normal objects use the standard Action.');
    });
});

// ── applyBonusActionChoice: unknown option ─────────────────────

describe('applyBonusActionChoice — unknown option', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns popup with unknown option message for unrecognized or missing options', async () => {
        const ps = makePlayerStats();

        let result = await applyBonusActionChoice(makeAction(), ps, campaignName, 'Foo');
        expect(result.payload.description).toBe('Unknown option: Foo');

        vi.clearAllMocks();

        result = await applyBonusActionChoice(makeAction({ options: [] }), ps, campaignName, 'Dash');
        expect(result.payload.description).toBe('Unknown option: Dash');

        vi.clearAllMocks();

        result = await applyBonusActionChoice(makeAction({ options: undefined }), ps, campaignName, 'Dash');
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

    it('does not track when oncePerTurn is falsy', async () => {
        const ps = makePlayerStats();

        await applyBonusActionChoice(makeAction({ oncePerTurn: false }), ps, campaignName, 'Dash');
        expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();

        vi.clearAllMocks();

        await applyBonusActionChoice(makeAction(), ps, campaignName, 'Dash');
        expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
    });
});

// ── applyBonusActionChoice: campaign logging ───────────────────

describe('applyBonusActionChoice — campaign logging', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('logs campaign entry for selected bonus action options', async () => {
        const ps = makePlayerStats();

        await applyBonusActionChoice(makeFastHandsAction(), ps, campaignName, 'Sleight of Hand');
        expect(logService.addEntry).toHaveBeenCalledWith(campaignName, {
            type: 'ability_use',
            characterName: ps.name,
            abilityName: 'Fast Hands',
            description: 'Sleight of Hand selected',
        });

        vi.clearAllMocks();

        await applyBonusActionChoice(makeFastHandsAction(), ps, campaignName, 'Thieves\' Tools');
        expect(logService.addEntry).toHaveBeenCalledWith(campaignName, {
            type: 'ability_use',
            characterName: ps.name,
            abilityName: 'Fast Hands',
            description: 'Thieves\' Tools selected',
        });

        vi.clearAllMocks();

        await applyBonusActionChoice(makeAction(), ps, campaignName, 'Dash');
        expect(logService.addEntry).toHaveBeenCalledWith(campaignName, {
            type: 'ability_use',
            characterName: ps.name,
            abilityName: 'Cunning Action',
            description: 'Dash selected',
        });
    });
});
