import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handle } from './bardicInspirationHandler.js';
import { resolveTarget, resolveMapPositions } from '../common/targetResolver.js';
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/useRuntimeState.js';
import { addExpiration } from '../../rules/effects/expirations.js';
import { evaluateAutoExpression } from '../../combat/automationService.js';
import { getDistanceFeet, rangeToFeet } from '../../rules/combat/rangeValidation.js';

vi.mock('../common/targetResolver.js', () => ({
    resolveTarget: vi.fn(),
    resolveMapPositions: vi.fn(),
}));

vi.mock('../../../hooks/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../rules/effects/expirations.js', () => ({
    addExpiration: vi.fn(),
}));

vi.mock('../../combat/automationService.js', () => ({
    evaluateAutoExpression: vi.fn(),
}));

vi.mock('../../rules/combat/rangeValidation.js', () => ({
    getDistanceFeet: vi.fn(),
    rangeToFeet: vi.fn(),
}));

describe('bardicInspirationHandler.handle', () => {
    let action;
    let playerStats;
    let campaignName = 'TestCampaign';
    let mapName = 'TestMap';

    beforeEach(() => {
        vi.clearAllMocks();

        action = {
            name: 'Bardic Inspiration',
            automation: {
                range: '60_ft',
                uses_expression: 'some_expr'
            }
        };

        playerStats = {
            name: 'Bard',
            level: 3,
            class: {
                class_levels: [
                    { level: 3, bardic_die: 8 }
                ]
            },
            automation: {
                passives: []
            }
        };

        // Default mocks for successful path
        evaluateAutoExpression.mockReturnValue(4);
        getRuntimeValue.mockReturnValue(0);
        resolveTarget.mockResolvedValue({ target: { name: 'Ally' } });
        rangeToFeet.mockReturnValue(60);
        resolveMapPositions.mockResolvedValue({ attackerPos: { x: 0, y: 0 }, targetPos: { x: 10, y: 10 } });
        getDistanceFeet.mockReturnValue(14);
    });

    it('should return popup when uses are exhausted', async () => {
        evaluateAutoExpression.mockReturnValue(2);
        getRuntimeValue.mockReturnValue(0);

        const result = await handle(action, playerStats, campaignName, mapName);

        expect(result).toEqual({
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `${action.name} has no uses remaining. Recharges on a Long Rest.`,
                automation: action.automation,
            },
        });
        expect(setRuntimeValue).not.toHaveBeenCalled();
    });

    it('should increment used charges when within limits', async () => {
        evaluateAutoExpression.mockReturnValue(4);
        getRuntimeValue.mockReturnValue(1);

        await handle(action, playerStats, campaignName, mapName);

        expect(setRuntimeValue).toHaveBeenCalledWith('Bard', 'bardicInspirationUses', 0, campaignName);
    });

    it('should use default uses (0) if no expression is provided', async () => {
        const actionNoExpr = { ...action, automation: { ...action.automation, uses_expression: undefined } };
        
        await handle(actionNoExpr, playerStats, campaignName, mapName);

        expect(evaluateAutoExpression).not.toHaveBeenCalled();
        // Should proceed to success because usesMax is 0 -> block not entered
    });

    it('should return popup when no target is resolved', async () => {
        getRuntimeValue.mockReturnValue(2);
        resolveTarget.mockResolvedValue(null);

        const result = await handle(action, playerStats, campaignName, mapName);

        expect(result).toEqual({
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `${action.name} requires a target. Select a creature in combat and try again.`,
                automation: action.automation,
            },
        });
    });

    it('should return popup when target is out of range', async () => {
        getRuntimeValue.mockReturnValue(2);
        rangeToFeet.mockReturnValue(60);
        getDistanceFeet.mockReturnValue(100);

        const result = await handle(action, playerStats, campaignName, mapName);

        expect(result).toEqual({
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `Ally is out of range (${Math.round(100)} ft > 60 ft).`,
                automation: action.automation,
            },
        });
    });

    it('should ignore range check if mapName is not provided', async () => {
        getRuntimeValue.mockReturnValue(2);
        getDistanceFeet.mockReturnValue(100); // Far away but no map
        rangeToFeet.mockReturnValue(60);

        const result = await handle(action, playerStats, campaignName, null);

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('granted to Ally');
    });

    it('should ignore range check if positions cannot be resolved', async () => {
        getRuntimeValue.mockReturnValue(2);
        resolveMapPositions.mockResolvedValue(null);

        const result = await handle(action, playerStats, campaignName, mapName);

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('granted to Ally');
    });

    it('should apply inspiration and create expiration', async () => {
        getRuntimeValue.mockReturnValue(2);
        const result = await handle(action, playerStats, campaignName, mapName);

        expect(setRuntimeValue).toHaveBeenCalledWith('Ally', 'bardicInspirationDie', '8', campaignName);
        expect(setRuntimeValue).toHaveBeenCalledWith('Ally', 'bardicInspirationGrantedBy', 'Bard', campaignName);
        expect(addExpiration).toHaveBeenCalledWith('Bard', 'Ally', [{ type: 'remove_bardic_inspiration' }], campaignName, 100);
        
        expect(result).toEqual({
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `${action.name} (d8) granted to Ally. They can roll it on one ability check.`,
                automation: action.automation,
            },
        });
    });

    it('should use default die size if class level is missing', async () => {
        getRuntimeValue.mockReturnValue(2);
        playerStats.class = { class_levels: [] }; // No matching level 3

        await handle(action, playerStats, campaignName, mapName);

        expect(setRuntimeValue).toHaveBeenCalledWith('Ally', 'bardicInspirationDie', '6', campaignName);
    });

    it('should set combat options if passive is present', async () => {
        getRuntimeValue.mockReturnValue(2);
        playerStats.automation.passives = [{ effect: 'bardic_inspiration_combat_options' }];
        action.automation.options = ['custom_option'];

        await handle(action, playerStats, campaignName, mapName);

        expect(setRuntimeValue).toHaveBeenCalledWith('Ally', 'bardicInspirationCombatOptions', JSON.stringify(['custom_option']), campaignName);
    });

    it('should use default combat options if passive is present but no options specified in action', async () => {
        getRuntimeValue.mockReturnValue(2);
        playerStats.automation.passives = [{ effect: 'bardic_inspiration_combat_options' }];
        delete action.automation.options;

        await handle(action, playerStats, campaignName, mapName);

        expect(setRuntimeValue).toHaveBeenCalledWith('Ally', 'bardicInspirationCombatOptions', JSON.stringify(['defense_add_to_ac', 'offense_add_to_damage']), campaignName);
    });

    it('should not set combat options if passive is missing', async () => {
        playerStats.automation.passives = [];
        action.automation.options = ['some_option'];

        await handle(action, playerStats, campaignName, mapName);

        expect(setRuntimeValue).not.toHaveBeenCalledWith('Ally', 'bardicInspirationCombatOptions', expect.any(String), campaignName);
    });
});
