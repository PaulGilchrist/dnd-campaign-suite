import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    getWildMagicSurgeFeatures,
    hasWildMagicSurge,
    getControlledChaosFeature,
    getTamedSurgeFeature,
    getFeatsOfChaosFeature,
    triggerWildMagicSurge,
} from './wildMagicSurgeService.js';
import { executeHandler } from '../../automation/index.js';

vi.mock('../../automation/index.js', () => ({
    executeHandler: vi.fn(),
}));

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

import { getRuntimeValue, setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';

describe('wildMagicSurgeService', () => {
    beforeEach(() => {
        vi.resetAllMocks();
    });

    describe('getWildMagicSurgeFeatures', () => {
        it('returns wild_magic_surge passives from playerStats', () => {
            const playerStats = {
                automation: {
                    passives: [
                        { type: 'wild_magic_surge', name: 'Wild Surge' },
                        { type: 'other', name: 'Other' },
                        { type: 'wild_magic_surge', name: 'Surge 2' },
                    ],
                },
            };
            const result = getWildMagicSurgeFeatures(playerStats);
            expect(result).toHaveLength(2);
            expect(result[0].name).toBe('Wild Surge');
            expect(result[1].name).toBe('Surge 2');
        });

        it('throws when no passives exist', () => {
            expect(() => getWildMagicSurgeFeatures({})).toThrow('Expected array, got undefined');
        });

        it('throws when passives is undefined', () => {
            expect(() => getWildMagicSurgeFeatures({ automation: {} })).toThrow('Expected array, got undefined');
        });

        it('throws when automation is undefined', () => {
            expect(() => getWildMagicSurgeFeatures({})).toThrow('Expected array, got undefined');
        });
    });

    describe('hasWildMagicSurge', () => {
        it('returns true when wild_magic_surge features exist', () => {
            const playerStats = {
                automation: { passives: [{ type: 'wild_magic_surge' }] },
            };
            expect(hasWildMagicSurge(playerStats)).toBe(true);
        });

        it('returns false when no wild_magic_surge features exist', () => {
            const playerStats = {
                automation: { passives: [{ type: 'other' }] },
            };
            expect(hasWildMagicSurge(playerStats)).toBe(false);
        });

        it('throws when no passives exist', () => {
            expect(() => hasWildMagicSurge({})).toThrow('Expected array, got undefined');
        });
    });

    describe('getControlledChaosFeature', () => {
        it('returns auto_effect wild_magic_double_roll passive', () => {
            const playerStats = {
                automation: {
                    passives: [
                        { type: 'auto_effect', effect: 'wild_magic_double_roll', name: 'Controlled Chaos' },
                        { type: 'other' },
                    ],
                },
            };
            const result = getControlledChaosFeature(playerStats);
            expect(result).toEqual({ type: 'auto_effect', effect: 'wild_magic_double_roll', name: 'Controlled Chaos' });
        });

        it('returns undefined when feature does not exist', () => {
            const playerStats = {
                automation: { passives: [{ type: 'other' }] },
            };
            expect(getControlledChaosFeature(playerStats)).toBeUndefined();
        });

        it('throws when no passives exist', () => {
            expect(() => getControlledChaosFeature({})).toThrow('Expected array, got undefined');
        });
    });

    describe('getTamedSurgeFeature', () => {
        it('returns wild_magic_tamed passive', () => {
            const playerStats = {
                automation: {
                    passives: [
                        { type: 'wild_magic_tamed', name: 'Tamed Surge' },
                    ],
                },
            };
            const result = getTamedSurgeFeature(playerStats);
            expect(result).toEqual({ type: 'wild_magic_tamed', name: 'Tamed Surge' });
        });

        it('returns undefined when feature does not exist', () => {
            const playerStats = {
                automation: { passives: [{ type: 'other' }] },
            };
            expect(getTamedSurgeFeature(playerStats)).toBeUndefined();
        });

        it('throws when no passives exist', () => {
            expect(() => getTamedSurgeFeature({})).toThrow('Expected array, got undefined');
        });
    });

    describe('getFeatsOfChaosFeature', () => {
        it('returns conditional_advantage feats_of_chaos_active passive', () => {
            const playerStats = {
                automation: {
                    passives: [
                        { type: 'conditional_advantage', condition: 'feats_of_chaos_active', name: 'Feats of Chaos' },
                    ],
                },
            };
            const result = getFeatsOfChaosFeature(playerStats);
            expect(result).toEqual({ type: 'conditional_advantage', condition: 'feats_of_chaos_active', name: 'Feats of Chaos' });
        });

        it('returns undefined when feature does not exist', () => {
            const playerStats = {
                automation: { passives: [{ type: 'conditional_advantage', condition: 'other' }] },
            };
            expect(getFeatsOfChaosFeature(playerStats)).toBeUndefined();
        });

        it('throws when no passives exist', () => {
            expect(() => getFeatsOfChaosFeature({})).toThrow('Expected array, got undefined');
        });
    });

    describe('triggerWildMagicSurge', () => {
        const campaignName = 'TestCampaign';
        const mapName = 'testMap';
        const basePlayerStats = {
            name: 'Sorcerer',
            class: { name: 'Sorcerer' },
            automation: {
                passives: [
                    { type: 'wild_magic_surge', name: 'Wild Surge' },
                ],
            },
            wildMagicSurgeTable: [
                { min: 1, max: 5, effect: 'Effect 1' },
                { min: 6, max: 10, effect: 'Effect 2' },
                { min: 11, max: 15, effect: 'Effect 3' },
                { min: 16, max: 20, effect: 'Effect 4' },
            ],
        };

        it('returns null for non-Sorcerer class', async () => {
            const playerStats = { ...basePlayerStats };
            playerStats.class = { name: 'Wizard' };
            const spell = { name: 'Fire Bolt', level: 0 };

            const result = await triggerWildMagicSurge(
                spell,
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(result).toBeNull();
            expect(executeHandler).not.toHaveBeenCalled();
        });

        it('returns true when spell class includes Sorcerer', async () => {
            executeHandler.mockResolvedValue({ type: 'popup', payload: {} });
            const playerStats = {
                ...basePlayerStats,
                class: { name: 'Wizard' },
            };
            const spell = { name: 'Fire Bolt', level: 1, classes: ['Sorcerer'] };

            const result = await triggerWildMagicSurge(
                spell,
                { slotLevel: 1 },
                playerStats,
                campaignName,
                mapName,
            );

            expect(result).not.toBeNull();
        });

        it('returns null when spell does not use a spell slot', async () => {
            const playerStats = { ...basePlayerStats };
            playerStats.class = { name: 'Sorcerer' };
            const spell = { name: 'Eldritch Blast', level: 0 };

            const result = await triggerWildMagicSurge(
                spell,
                { slotLevel: 0 },
                playerStats,
                campaignName,
                mapName,
            );

            expect(result).toBeNull();
            expect(executeHandler).not.toHaveBeenCalled();
        });

        it('returns null when no wild magic surge features exist', async () => {
            const playerStats = {
                ...basePlayerStats,
                automation: { passives: [] },
            };
            const spell = { name: 'Fire Bolt', level: 1 };

            const result = await triggerWildMagicSurge(
                spell,
                { slotLevel: 1 },
                playerStats,
                campaignName,
                mapName,
            );

            expect(result).toBeNull();
            expect(executeHandler).not.toHaveBeenCalled();
        });

        it('sets wildMagicDoubleRoll when controlled chaos feature exists', async () => {
            const playerStats = {
                ...basePlayerStats,
                automation: {
                    passives: [
                        { type: 'wild_magic_surge', name: 'Wild Surge' },
                        { type: 'auto_effect', effect: 'wild_magic_double_roll', name: 'Controlled Chaos' },
                    ],
                },
            };
            const spell = { name: 'Fire Bolt', level: 1 };

            executeHandler.mockResolvedValue({ type: 'popup', payload: {} });

            await triggerWildMagicSurge(
                spell,
                { slotLevel: 1 },
                playerStats,
                campaignName,
                mapName,
            );

            expect(setRuntimeValue).toHaveBeenCalledWith(
                playerStats.name,
                'wildMagicDoubleRoll',
                true,
                campaignName,
                true,
            );
        });

        it('returns modal for tamed surge when available surges exist and uses > 0', async () => {
            const playerStats = {
                ...basePlayerStats,
                automation: {
                    passives: [
                        { type: 'wild_magic_surge', name: 'Wild Surge' },
                        { type: 'wild_magic_tamed', name: 'Tamed Surge' },
                    ],
                },
            };
            const spell = { name: 'Fire Bolt', level: 1 };

            getRuntimeValue.mockImplementation((charKey, prop) => {
                if (prop === 'tamedSurgeUses') return 1;
                if (prop === 'tamedSurgeLastRest') return null;
                return null;
            });

            const result = await triggerWildMagicSurge(
                spell,
                { slotLevel: 1 },
                playerStats,
                campaignName,
                mapName,
            );

            expect(result).toEqual({
                type: 'modal',
                modalName: 'wildMagicTamed',
                payload: {
                    featureName: 'Tamed Surge',
                    availableSurges: [
                        { min: 1, max: 5, effect: 'Effect 1' },
                        { min: 6, max: 10, effect: 'Effect 2' },
                        { min: 11, max: 15, effect: 'Effect 3' },
                    ],
                    playerStats,
                    campaignName,
                },
            });
        });

        it('returns null for tamed surge when no available surges (all max=20)', async () => {
            executeHandler.mockResolvedValue(null);
            const playerStats = {
                ...basePlayerStats,
                automation: {
                    passives: [
                        { type: 'wild_magic_surge', name: 'Wild Surge' },
                        { type: 'wild_magic_tamed', name: 'Tamed Surge' },
                    ],
                },
                wildMagicSurgeTable: [
                    { min: 1, max: 20, effect: 'All surges' },
                ],
            };
            const spell = { name: 'Fire Bolt', level: 1 };

            getRuntimeValue.mockImplementation((charKey, prop) => {
                if (prop === 'tamedSurgeUses') return 1;
                if (prop === 'tamedSurgeLastRest') return null;
                return null;
            });

            const result = await triggerWildMagicSurge(
                spell,
                { slotLevel: 1 },
                playerStats,
                campaignName,
                mapName,
            );

            expect(result).toBeNull();
        });

        it('uses stored uses when within rest period', async () => {
            const playerStats = {
                ...basePlayerStats,
                automation: {
                    passives: [
                        { type: 'wild_magic_surge', name: 'Wild Surge' },
                        { type: 'wild_magic_tamed', name: 'Tamed Surge' },
                    ],
                },
            };
            const spell = { name: 'Fire Bolt', level: 1 };
            const now = Date.now();

            getRuntimeValue.mockImplementation((charKey, prop) => {
                if (prop === 'tamedSurgeUses') return 2;
                if (prop === 'tamedSurgeLastRest') return now - 3600000; // 1 hour ago
                return null;
            });

            const result = await triggerWildMagicSurge(
                spell,
                { slotLevel: 1 },
                playerStats,
                campaignName,
                mapName,
            );

            expect(result).toEqual({
                type: 'modal',
                modalName: 'wildMagicTamed',
                payload: expect.objectContaining({
                    featureName: 'Tamed Surge',
                }),
            });
        });

        it('uses stored uses when no rest timestamp exists', async () => {
            const playerStats = {
                ...basePlayerStats,
                automation: {
                    passives: [
                        { type: 'wild_magic_surge', name: 'Wild Surge' },
                        { type: 'wild_magic_tamed', name: 'Tamed Surge' },
                    ],
                },
            };
            const spell = { name: 'Fire Bolt', level: 1 };

            getRuntimeValue.mockImplementation((charKey, prop) => {
                if (prop === 'tamedSurgeUses') return 3;
                return null;
            });

            const result = await triggerWildMagicSurge(
                spell,
                { slotLevel: 1 },
                playerStats,
                campaignName,
                mapName,
            );

            expect(result).toEqual({
                type: 'modal',
                modalName: 'wildMagicTamed',
                payload: expect.objectContaining({
                    featureName: 'Tamed Surge',
                }),
            });
        });

        it('executes feats of chaos when feature exists and has uses', async () => {
            const playerStats = {
                ...basePlayerStats,
                automation: {
                    passives: [
                        { type: 'wild_magic_surge', name: 'Wild Surge' },
                        { type: 'conditional_advantage', condition: 'feats_of_chaos_active', name: 'Feats of Chaos' },
                    ],
                },
            };
            const spell = { name: 'Fire Bolt', level: 1 };

            getRuntimeValue.mockImplementation((charKey, prop) => {
                if (prop === 'featsOfChaosUses') return 1;
                if (prop === 'featsOfChaosLastRest') return null;
                if (prop === 'featsOfChaosActive') return false;
                return null;
            });

            executeHandler.mockResolvedValue({ type: 'popup', payload: {} });

            const result = await triggerWildMagicSurge(
                spell,
                { slotLevel: 1 },
                playerStats,
                campaignName,
                mapName,
            );

            expect(result).toEqual({
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: 'Feats of Chaos',
                    description: expect.stringContaining('Advantage granted, Wild Magic Surge triggered!'),
                    automation: expect.objectContaining({
                        type: 'conditional_advantage',
                        condition: 'feats_of_chaos_active',
                    }),
                },
            });

            expect(setRuntimeValue).toHaveBeenCalledWith(
                playerStats.name,
                'featsOfChaosUses',
                0,
                campaignName,
                true,
            );
        });

        it('toggles featsOfChaosActive runtime value', async () => {
            const playerStats = {
                ...basePlayerStats,
                automation: {
                    passives: [
                        { type: 'wild_magic_surge', name: 'Wild Surge' },
                        { type: 'conditional_advantage', condition: 'feats_of_chaos_active', name: 'Feats of Chaos' },
                    ],
                },
            };
            const spell = { name: 'Fire Bolt', level: 1 };

            getRuntimeValue.mockImplementation((charKey, prop) => {
                if (prop === 'featsOfChaosUses') return 1;
                if (prop === 'featsOfChaosLastRest') return null;
                if (prop === 'featsOfChaosActive') return true; // already active
                return null;
            });

            executeHandler.mockResolvedValue({ type: 'popup', payload: {} });

            await triggerWildMagicSurge(
                spell,
                { slotLevel: 1 },
                playerStats,
                campaignName,
                mapName,
            );

            expect(setRuntimeValue).toHaveBeenCalledWith(
                playerStats.name,
                'featsOfChaosActive',
                false,
                campaignName,
                true,
            );
        });

        it('does not set last rest timestamp when feats of chaos uses reach 0', async () => {
            const playerStats = {
                ...basePlayerStats,
                automation: {
                    passives: [
                        { type: 'wild_magic_surge', name: 'Wild Surge' },
                        { type: 'conditional_advantage', condition: 'feats_of_chaos_active', name: 'Feats of Chaos' },
                    ],
                },
            };
            const spell = { name: 'Fire Bolt', level: 1 };

            getRuntimeValue.mockImplementation((charKey, prop) => {
                if (prop === 'featsOfChaosUses') return 1;
                if (prop === 'featsOfChaosLastRest') return null;
                if (prop === 'featsOfChaosActive') return false;
                return null;
            });

            executeHandler.mockResolvedValue({ type: 'popup', payload: {} });

            await triggerWildMagicSurge(
                spell,
                { slotLevel: 1 },
                playerStats,
                campaignName,
                mapName,
            );

            expect(setRuntimeValue).not.toHaveBeenCalledWith(
                playerStats.name,
                'featsOfChaosLastRest',
                expect.any(Number),
                campaignName,
                true,
            );
        });

        it('returns null for feats of chaos when uses are 0 and within rest period', async () => {
            executeHandler.mockResolvedValue(null);
            const playerStats = {
                ...basePlayerStats,
                automation: {
                    passives: [
                        { type: 'wild_magic_surge', name: 'Wild Surge' },
                        { type: 'conditional_advantage', condition: 'feats_of_chaos_active', name: 'Feats of Chaos' },
                    ],
                },
            };
            const spell = { name: 'Fire Bolt', level: 1 };
            const now = Date.now();

            getRuntimeValue.mockImplementation((charKey, prop) => {
                if (prop === 'featsOfChaosUses') return 0;
                if (prop === 'featsOfChaosLastRest') return now - 3600000; // 1 hour ago
                if (prop === 'featsOfChaosActive') return false;
                return null;
            });

            executeHandler.mockResolvedValue(null);

            const result = await triggerWildMagicSurge(
                spell,
                { slotLevel: 1 },
                playerStats,
                campaignName,
                mapName,
            );

            expect(result).toBeNull();
        });

        it('resets feats of chaos uses when rest period expired', async () => {
            const playerStats = {
                ...basePlayerStats,
                automation: {
                    passives: [
                        { type: 'wild_magic_surge', name: 'Wild Surge' },
                        { type: 'conditional_advantage', condition: 'feats_of_chaos_active', name: 'Feats of Chaos' },
                    ],
                },
            };
            const spell = { name: 'Fire Bolt', level: 1 };
            const now = Date.now();

            getRuntimeValue.mockImplementation((charKey, prop) => {
                if (prop === 'featsOfChaosUses') return 0;
                if (prop === 'featsOfChaosLastRest') return now - 172800000; // 2 days ago
                if (prop === 'featsOfChaosActive') return false;
                return null;
            });

            executeHandler.mockResolvedValue({ type: 'popup', payload: {} });

            const result = await triggerWildMagicSurge(
                spell,
                { slotLevel: 1 },
                playerStats,
                campaignName,
                mapName,
            );

            expect(result).not.toBeNull();
        });

        it('respects 60-second cooldown on standard surge trigger', async () => {
            const playerStats = { ...basePlayerStats };
            const spell = { name: 'Fire Bolt', level: 1 };
            const now = Date.now();

            getRuntimeValue.mockImplementation((charKey, prop) => {
                if (prop === 'wildMagicSurgeTriggered') return now - 30000; // 30 seconds ago
                return null;
            });

            const result = await triggerWildMagicSurge(
                spell,
                { slotLevel: 1 },
                playerStats,
                campaignName,
                mapName,
            );

            expect(result).toBeNull();
            expect(executeHandler).not.toHaveBeenCalled();
        });

        it('executes handler when cooldown has passed', async () => {
            const playerStats = { ...basePlayerStats };
            const spell = { name: 'Fire Bolt', level: 1 };
            const now = Date.now();

            getRuntimeValue.mockImplementation((charKey, prop) => {
                if (prop === 'wildMagicSurgeTriggered') return now - 120000; // 2 minutes ago
                return null;
            });

            executeHandler.mockResolvedValue({ type: 'popup', payload: {} });

            const result = await triggerWildMagicSurge(
                spell,
                { slotLevel: 1 },
                playerStats,
                campaignName,
                mapName,
            );

            expect(result).toEqual({ type: 'popup', payload: {} });
            expect(setRuntimeValue).toHaveBeenCalledWith(
                playerStats.name,
                'wildMagicSurgeTriggered',
                expect.any(Number),
                campaignName,
                true,
            );
        });

        it('returns null when executeHandler returns null', async () => {
            const playerStats = { ...basePlayerStats };
            const spell = { name: 'Fire Bolt', level: 1 };

            getRuntimeValue.mockImplementation((charKey, prop) => {
                if (prop === 'wildMagicSurgeTriggered') return null;
                return null;
            });

            executeHandler.mockResolvedValue(null);

            const result = await triggerWildMagicSurge(
                spell,
                { slotLevel: 1 },
                playerStats,
                campaignName,
                mapName,
            );

            expect(result).toBeNull();
        });

        it('throws when executeHandler throws an error', async () => {
            const playerStats = { ...basePlayerStats };
            const spell = { name: 'Fire Bolt', level: 1 };

            getRuntimeValue.mockImplementation((charKey, prop) => {
                if (prop === 'wildMagicSurgeTriggered') return null;
                return null;
            });

            executeHandler.mockRejectedValue(new Error('Handler failed'));

            await expect(
                triggerWildMagicSurge(
                    spell,
                    { slotLevel: 1 },
                    playerStats,
                    campaignName,
                    mapName,
                ),
            ).rejects.toThrow('Handler failed');
        });

        it('uses spell.level when metaCtx has no slotLevel', async () => {
            const playerStats = { ...basePlayerStats };
            playerStats.class = { name: 'Sorcerer' };
            const spell = { name: 'Fire Bolt', level: 3 };

            getRuntimeValue.mockImplementation((charKey, prop) => {
                if (prop === 'wildMagicSurgeTriggered') return null;
                return null;
            });

            executeHandler.mockResolvedValue({ type: 'popup', payload: {} });

            const result = await triggerWildMagicSurge(
                spell,
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(result).not.toBeNull();
        });

        it('throws when spell is undefined', async () => {
            const playerStats = { ...basePlayerStats };

            await expect(
                triggerWildMagicSurge(
                    undefined,
                    {},
                    playerStats,
                    campaignName,
                    mapName,
                ),
            ).rejects.toThrow();
        });

        it('throws when spell is null', async () => {
            const playerStats = { ...basePlayerStats };

            await expect(
                triggerWildMagicSurge(
                    null,
                    {},
                    playerStats,
                    campaignName,
                    mapName,
                ),
            ).rejects.toThrow();
        });

        it('handles undefined playerStats gracefully', async () => {
            const spell = { name: 'Fire Bolt', level: 1 };

            const result = await triggerWildMagicSurge(
                spell,
                {},
                undefined,
                campaignName,
                mapName,
            );

            expect(result).toBeNull();
        });

        it('handles empty wildMagicSurgeTable', async () => {
            const playerStats = {
                ...basePlayerStats,
                wildMagicSurgeTable: [],
            };
            const spell = { name: 'Fire Bolt', level: 1 };

            getRuntimeValue.mockImplementation((charKey, prop) => {
                if (prop === 'wildMagicSurgeTriggered') return null;
                return null;
            });

            executeHandler.mockResolvedValue({ type: 'popup', payload: {} });

            const result = await triggerWildMagicSurge(
                spell,
                { slotLevel: 1 },
                playerStats,
                campaignName,
                mapName,
            );

            expect(result).toEqual({ type: 'popup', payload: {} });
        });

        it('uses default surge effect when d20 roll finds no matching entry', async () => {
            const playerStats = {
                ...basePlayerStats,
                automation: {
                    passives: [
                        { type: 'wild_magic_surge', name: 'Wild Surge' },
                        { type: 'conditional_advantage', condition: 'feats_of_chaos_active', name: 'Feats of Chaos' },
                    ],
                },
                wildMagicSurgeTable: [],
            };
            const spell = { name: 'Fire Bolt', level: 1 };

            getRuntimeValue.mockImplementation((charKey, prop) => {
                if (prop === 'featsOfChaosUses') return 1;
                if (prop === 'featsOfChaosLastRest') return null;
                if (prop === 'featsOfChaosActive') return false;
                return null;
            });

            executeHandler.mockResolvedValue({ type: 'popup', payload: {} });

            const result = await triggerWildMagicSurge(
                spell,
                { slotLevel: 1 },
                playerStats,
                campaignName,
                mapName,
            );

            expect(result).toEqual({
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: 'Feats of Chaos',
                    description: expect.stringContaining('Unknown Wild Magic effect.'),
                    automation: expect.objectContaining({
                        type: 'conditional_advantage',
                        condition: 'feats_of_chaos_active',
                    }),
                },
            });
        });

        it('passes campaignName and mapName to executeHandler', async () => {
            const playerStats = { ...basePlayerStats };
            const spell = { name: 'Fire Bolt', level: 1 };

            getRuntimeValue.mockImplementation((charKey, prop) => {
                if (prop === 'wildMagicSurgeTriggered') return null;
                return null;
            });

            executeHandler.mockResolvedValue({ type: 'popup', payload: {} });

            await triggerWildMagicSurge(
                spell,
                { slotLevel: 1 },
                playerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    name: 'Wild Surge',
                }),
                playerStats,
                campaignName,
                mapName,
            );
        });

        it('handles tamed surge with null stored uses defaulting to 0', async () => {
            const playerStats = {
                ...basePlayerStats,
                automation: {
                    passives: [
                        { type: 'wild_magic_surge', name: 'Wild Surge' },
                        { type: 'wild_magic_tamed', name: 'Tamed Surge' },
                    ],
                },
            };
            const spell = { name: 'Fire Bolt', level: 1 };

            getRuntimeValue.mockImplementation((charKey, prop) => {
                if (prop === 'tamedSurgeUses') return null;
                if (prop === 'tamedSurgeLastRest') return null;
                return null;
            });

            const result = await triggerWildMagicSurge(
                spell,
                { slotLevel: 1 },
                playerStats,
                campaignName,
                mapName,
            );

            expect(result).toBeNull();
        });

        it('handles tamed surge with undefined stored uses defaulting to 0', async () => {
            const playerStats = {
                ...basePlayerStats,
                automation: {
                    passives: [
                        { type: 'wild_magic_surge', name: 'Wild Surge' },
                        { type: 'wild_magic_tamed', name: 'Tamed Surge' },
                    ],
                },
            };
            const spell = { name: 'Fire Bolt', level: 1 };

            getRuntimeValue.mockReturnValue(null);

            const result = await triggerWildMagicSurge(
                spell,
                { slotLevel: 1 },
                playerStats,
                campaignName,
                mapName,
            );

            expect(result).toBeNull();
        });

        it('does not set runtime value when executeHandler returns falsy', async () => {
            const playerStats = { ...basePlayerStats };
            const spell = { name: 'Fire Bolt', level: 1 };

            getRuntimeValue.mockImplementation((charKey, prop) => {
                if (prop === 'wildMagicSurgeTriggered') return null;
                return null;
            });

            executeHandler.mockResolvedValue(null);

            await triggerWildMagicSurge(
                spell,
                { slotLevel: 1 },
                playerStats,
                campaignName,
                mapName,
            );

            expect(setRuntimeValue).not.toHaveBeenCalled();
        });

        it('returns null when tamed surge has 0 uses', async () => {
            const playerStats = {
                ...basePlayerStats,
                automation: {
                    passives: [
                        { type: 'wild_magic_surge', name: 'Wild Surge' },
                        { type: 'wild_magic_tamed', name: 'Tamed Surge' },
                    ],
                },
            };
            const spell = { name: 'Fire Bolt', level: 1 };

            getRuntimeValue.mockImplementation((charKey, prop) => {
                if (prop === 'tamedSurgeUses') return 0;
                if (prop === 'tamedSurgeLastRest') return null;
                return null;
            });

            const result = await triggerWildMagicSurge(
                spell,
                { slotLevel: 1 },
                playerStats,
                campaignName,
                mapName,
            );

            expect(result).toBeNull();
        });

        it('returns null when tamed surge has 0 uses within rest period', async () => {
            const playerStats = {
                ...basePlayerStats,
                automation: {
                    passives: [
                        { type: 'wild_magic_surge', name: 'Wild Surge' },
                        { type: 'wild_magic_tamed', name: 'Tamed Surge' },
                    ],
                },
            };
            const spell = { name: 'Fire Bolt', level: 1 };
            const now = Date.now();

            getRuntimeValue.mockImplementation((charKey, prop) => {
                if (prop === 'tamedSurgeUses') return 0;
                if (prop === 'tamedSurgeLastRest') return now - 3600000; // 1 hour ago
                return null;
            });

            const result = await triggerWildMagicSurge(
                spell,
                { slotLevel: 1 },
                playerStats,
                campaignName,
                mapName,
            );

            expect(result).toBeNull();
        });
    });
});
