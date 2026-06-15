import { describe, it, expect } from 'vitest';
import { handle } from './healingPoolHandler.js';

describe('healingPoolHandler.handle', () => {
    const campaignName = 'TestCampaign';
    const mapName = 'TestMap';

    it('should return the correct modal response with minimal automation data', async () => {
        const action = {
            name: 'Healing Touch',
            automation: {
                pool: 'healing_pool',
                resourceKey: 'hp_pool'
            }
        };
        const playerStats = {};

        const result = await handle(action, playerStats, campaignName, mapName);

        expect(result).toEqual({
            type: 'modal',
            modalName: 'healingPool',
            payload: {
                name: 'Healing Touch',
                pool: 'healing_pool',
                poolExpression: undefined,
                isDicePool: undefined,
                dieType: undefined,
                resourceKey: 'hp_pool',
                alsoCures: [],
                cureCost: 5,
                range: '',
                resourceCost: '',
                bloodiedOnly: false,
                restoringTouchConditions: [],
                maxDicePerUse: '',
            },
        });
    });

    it('should return correct payload when full automation data is provided', async () => {
        const action = {
            name: 'Advanced Healing',
            automation: {
                pool: 'advanced_pool',
                poolExpression: 'level * 2',
                isDicePool: true,
                dieType: 'd8',
                resourceKey: 'special_pool',
                alsoCures: ['Poisoned', 'Stunned'],
                cureCost: 10,
                range: '30ft',
                resourceCost: 'channel_divinity',
                bloodiedOnly: true
            }
        };
        const playerStats = {};

        const result = await handle(action, playerStats, campaignName, mapName);

        expect(result.payload).toEqual({
            name: 'Advanced Healing',
            pool: 'advanced_pool',
            poolExpression: 'level * 2',
            isDicePool: true,
            dieType: 'd8',
            resourceKey: 'special_pool',
            alsoCures: ['Poisoned', 'Stunned'],
            cureCost: 10,
            range: '30ft',
            resourceCost: 'channel_divinity',
            bloodiedOnly: true,
            restoringTouchConditions: [],
            maxDicePerUse: '',
        });
    });

    it('should include restoringTouchConditions when Restoring Touch feature is present', async () => {
        const action = {
            name: 'Healing Touch',
            automation: { pool: 'p' }
        };
        const playerStats = {
            characterAdvancement: [
                { 
                    name: 'Restoring Touch', 
                    automation: { cureConditions: ['Bloodied', 'Unconscious'] } 
                },
                { name: 'Other Feature' }
            ]
        };

        const result = await handle(action, playerStats, campaignName, mapName);

        expect(result.payload.restoringTouchConditions).toEqual(['Bloodied', 'Unconscious']);
    });

    it('should return empty restoringTouchConditions when Restoring Touch is missing from characterAdvancement', async () => {
        const action = {
            name: 'Healing Touch',
            automation: { pool: 'p' }
        };
        const playerStats = {
            characterAdvancement: [
                { name: 'Other Feature' }
            ]
        };

        const result = await handle(action, playerStats, campaignName, mapName);

        expect(result.payload.restoringTouchConditions).toEqual([]);
    });

    it('should return empty restoringTouchConditions when characterAdvancement is undefined', async () => {
        const action = {
            name: 'Healing Touch',
            automation: { pool: 'p' }
        };
        const playerStats = {};

        const result = await handle(action, playerStats, campaignName, mapName);

        expect(result.payload.restoringTouchConditions).toEqual([]);
    });

    it('should return empty restoringTouchConditions even if Restoring Touch is present but has no cureConditions', async () => {
        const action = {
            name: 'Healing Touch',
            automation: { pool: 'p' }
        };
        const playerStats = {
            characterAdvancement: [
                { name: 'Restoring Touch' } // missing automation or cureConditions
            ]
        };

        const result = await handle(action, playerStats, campaignName, mapName);

        expect(result.payload.restoringTouchConditions).toEqual([]);
    });
});

