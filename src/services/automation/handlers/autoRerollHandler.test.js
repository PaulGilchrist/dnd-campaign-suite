import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handle } from './autoRerollHandler.js';
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/useRuntimeState.js';
import { addEntry } from '../../ui/logService.js';
import { getLastAttackRoll, getLastAbilityCheck } from '../../../hooks/useMetamagic.js';
import { automationInfoPopup } from '../../shared/popupResponse.js';
import { getCombatContext } from '../../rules/damageUtils.js';
import { getDistanceFeet, rangeToFeet } from '../../rules/rangeValidation.js';
import { resolveMapPositions } from '../common/targetResolver.js';

vi.mock('../../../hooks/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../ui/logService.js', () => ({
    addEntry: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../hooks/useMetamagic.js', () => ({
    getLastAttackRoll: vi.fn(),
    getLastAbilityCheck: vi.fn(),
}));

vi.mock('../../shared/popupResponse.js', () => ({
    automationInfoPopup: vi.fn(),
}));

vi.mock('../../rules/damageUtils.js', () => ({
    getCombatContext: vi.fn(),
}));

vi.mock('../../rules/rangeValidation.js', () => ({
    getDistanceFeet: vi.fn(),
    rangeToFeet: vi.fn(),
}));

vi.mock('../common/targetResolver.js', () => ({
    resolveMapPositions: vi.fn(),
}));

describe('autoRerollHandler.handle', () => {
    let action;
    let playerStats;
    const campaignName = 'TestCampaign';
    const mapName = 'TestMap';

    beforeEach(() => {
        vi.clearAllMocks();

        getLastAttackRoll.mockReturnValue(null);
        getLastAbilityCheck.mockReturnValue(null);
        getRuntimeValue.mockReturnValue(undefined);

        playerStats = {
            name: 'Player',
            level: 2,
            proficiency: 2,
            class: {
                class_levels: [
                    { level: 1, bardic_die: 4, bardic_inspiration_uses: 2 },
                    { level: 2, bardic_die: 4, bardic_inspiration_uses: 2 },
                ]
            }
        };

        automationInfoPopup.mockImplementation((a) => ({ type: 'popup', payload: { name: a.name } }));
    });

    describe('Bardic Inspiration Path', () => {
        let bardAction;
        beforeEach(() => {
            bardAction = {
                name: 'Bardic Reroll',
                automation: { bonusExpression: 'bardic_inspiration_die' }
            };
        });

        it('should return popup when uses are exhausted', async () => {
            getRuntimeValue.mockReturnValue(2); // used 2, max is 2
            const result = await handle(bardAction, playerStats, campaignName, mapName);
            expect(result).toEqual({
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: bardAction.name,
                    description: `${bardAction.name} has no uses remaining. Recharges on a Long Rest.`,
                    automation: bardAction.automation,
                },
            });
        });

        it('should return popup when even with uses, no recent failure is found', async () => {
            getRuntimeValue.mockReturnValue(0);
            getLastAttackRoll.mockReturnValue(null);
            getLastAbilityCheck.mockReturnValue(null);
            const result = await handle(bardAction, playerStats, campaignName, mapName);
            expect(result).toEqual({
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: bardAction.name,
                    description: `No recent failed ability check or attack roll found. ${bardAction.name} can only be used shortly after a failure.`,
                    automation: bardAction.automation,
                },
            });
        });

        it('should apply to a fresh failed attack roll', async () => {
            getRuntimeValue.mockReturnValue(0);
            getLastAttackRoll.mockReturnValue({
                timestamp: Date.now(),
                d20: 5,
                bonus: 3,
                targetAc: 12,
                hit: false,
                effectiveAc: null
            });
            getLastAbilityCheck.mockReturnValue(null);

            const result = await handle(bardAction, playerStats, campaignName, mapName);
            
            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Bardic Reroll'); 
        });

        it('should apply to a fresh ability check', async () => {
            getRuntimeValue.mockReturnValue(0);
            getLastAttackRoll.mockReturnValue(null);
            getLastAbilityCheck.mockReturnValue({
                timestamp: Date.now(),
                d20: 10,
                bonus: 2,
                checkName: 'Athletics'
            });

            const result = await handle(bardAction, playerStats, campaignName, mapName);
            expect(result.payload.description).toContain('Athletics');
            expect(setRuntimeValue).toHaveBeenCalledWith(playerStats.name, 'bardicInspirationUses', 1, campaignName);
            expect(addEntry).toHaveBeenCalled();
        });

        it('should ignore stale failures', async () => {
            getRuntimeValue.mockReturnValue(0);
            getLastAttackRoll.mockReturnValue({ timestamp: Date.now() - 70000, hit: false });
            getLastAbilityCheck.mockReturnValue({ timestamp: Date.now() - 70000 });

            const result = await handle(bardAction, playerStats, campaignName, mapName);
            expect(result.payload.description).toContain('No recent failed ability check');
        });
    });

    describe('Fixed Bonus Path', () => {
        let bonusAction;
        beforeEach(() => {
            bonusAction = {
                name: 'Blessing',
                automation: { bonus: 2 }
            };
        });

        it('should fail if channel divinity charges are empty', async () => {
            bonusAction.automation.resourceCost = 'channel_divinity';
            getRuntimeValue.mockReturnValue(0); // stored Charges

            const result = await handle(bonusAction, playerStats, campaignName, mapName);
            expect(result).toEqual({
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: playerStats.name,
                    description: 'No Channel Divinity charges remaining.',
                    automation: bonusAction.automation,
                },
            });
        });

        it('should consume channel divinity charge and proceed if available', async () => {
            bonusAction.automation.resourceCost = 'channel_divinity';
            getRuntimeValue.mockReturnValue(1); 
            getLastAttackRoll.mockReturnValue({ timestamp: Date.now(), hit: false, d20: 5, bonus: 3, targetAc: 15 });
            
            await handle(bonusAction, playerStats, campaignName, mapName);
            expect(setRuntimeValue).toHaveBeenCalledWith(playerStats.name, 'channelDivinityCharges', 0, campaignName);
        });

        it('should prioritize own failed attack roll over ability check', async () => {
            getLastAttackRoll.mockReturnValue({ timestamp: Date.now(), hit: false, d20: 5, bonus: 3, targetAc: 15 });
            getLastAbilityCheck.mockReturnValue({ timestamp: Date.now(), d20: 10, bonus: 2 });

            const result = await handle(bonusAction, playerStats, campaignName, mapName);
            expect(result.payload.description).toContain('Attack roll');
        });

        it('should use ability check if no failed attack exists', async () => {
            getLastAttackRoll.mockReturnValue(null);
            getLastAbilityCheck.mockReturnValue({ timestamp: Date.now(), d20: 10, bonus: 2 });

            const result = await handle(bonusAction, playerStats, campaignName, mapName);
            expect(result.payload.description).toContain('Modified');
        });

        it('should look for ally missed attack if own succeeded/missing and range is specified', async () => {
            getLastAttackRoll.mockReturnValue({ timestamp: Date.now(), hit: true }); // Own hit
            bonusAction.automation.range = '30ft';
            rangeToFeet.mockReturnValue(30);
            getCombatContext.mockResolvedValue({
                creatures: [
                    { name: 'Player' },
                    { name: 'Ally' }
                ]
            });
            getLastAttackRoll.mockImplementation((name) => {
                if (name === 'Player') return { timestamp: Date.now(), hit: true };
                if (name === 'Ally') return { timestamp: Date.now(), hit: false, d20: 5, bonus: 3, targetAc: 15 };
                return null;
            });
            resolveMapPositions.mockResolvedValue({ attackerPos: { x: 0, y: 0 }, targetPos: { x: 10, y: 0 } });
            getDistanceFeet.mockReturnValue(10);

            const result = await handle(bonusAction, playerStats, campaignName, mapName);
            expect(result.payload.description).toContain('Attacker: Ally');
        });

        it('should ignore ally if outside range', async () => {
            getLastAttackRoll.mockReturnValue({ timestamp: Date.now(), hit: true });
            bonusAction.automation.range = '30ft';
            rangeToFeet.mockReturnValue(30);
            getCombatContext.mockResolvedValue({ creatures: [{ name: 'Player' }, { name: 'Ally' }] });
            getLastAttackRoll.mockImplementation((name) => {
                if (name === 'Player') return { timestamp: Date.now(), hit: true };
                if (name === 'Ally') return { timestamp: Date.now(), hit: false, d20: 5, bonus: 3, targetAc: 15 };
                return null;
            });
            resolveMapPositions.mockResolvedValue({ attackerPos: { x: 0, y: 0 }, targetPos: { x: 60, y: 0 } });
            getDistanceFeet.mockReturnValue(60);

            const result = await handle(bonusAction, playerStats, campaignName, mapName);
            expect(result.payload.description).toContain('No recent failed attack roll or ability check found for you or any ally');
        });

        it('should return general failure popup if nothing is fresh', async () => {
            getLastAttackRoll.mockReturnValue(null);
            getLastAbilityCheck.mockReturnValue(null);
            const result = await handle(bonusAction, playerStats, campaignName, mapName);
            expect(result.payload.description).toContain('No recent failed attack roll or ability check found');
        });
    });

    describe('Default Fallback', () => {
        it('should return automationInfoPopup for an action without applicable automation', async () => {
            const action = { name: 'Simple Action', automation: {} };
            const result = await handle(action, playerStats, campaignName, mapName);
            expect(automationInfoPopup).toHaveBeenCalledWith(action);
            expect(result).toEqual({ type: 'popup', payload: { name: 'Simple Action' } });
        });
    });
});
