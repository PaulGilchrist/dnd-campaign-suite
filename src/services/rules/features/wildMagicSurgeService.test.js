// @improved-by-ai
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
import { getCurrentCombatRound } from '../../encounters/combatData.js';
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';

vi.mock('../../automation/index.js', () => ({
    executeHandler: vi.fn(),
}));

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../encounters/combatData.js', () => ({
    getCurrentCombatRound: vi.fn(() => 1),
}));

const CAMPAIGN_NAME = 'TestCampaign';
const MAP_NAME = 'testMap';

const BASE_SURGE_TABLE = [
    { min: 1, max: 5, effect: 'Effect 1' },
    { min: 6, max: 10, effect: 'Effect 2' },
    { min: 11, max: 15, effect: 'Effect 3' },
    { min: 16, max: 20, effect: 'Effect 4' },
];

const BASE_PLAYER_STATS = {
    name: 'Sorcerer',
    class: { name: 'Sorcerer' },
    automation: {
        passives: [
            { type: 'wild_magic_surge', name: 'Wild Surge' },
        ],
    },
    wildMagicSurgeTable: BASE_SURGE_TABLE,
};

const SPELL = { name: 'Fire Bolt', level: 1 };

function mockDefaults() {
    executeHandler.mockResolvedValue({ type: 'popup', payload: {} });
    getCurrentCombatRound.mockReturnValue(1);
    getRuntimeValue.mockReturnValue(null);
    setRuntimeValue.mockReturnValue(undefined);
}

describe('wildMagicSurgeService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockDefaults();
    });

    describe('getWildMagicSurgeFeatures', () => {
        it('filters passives to wild_magic_surge type only', () => {
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

        it('returns empty array when passives exist but no wild_magic_surge entries', () => {
            const playerStats = {
                automation: { passives: [{ type: 'other' }] },
            };
            expect(getWildMagicSurgeFeatures(playerStats)).toEqual([]);
        });

        it('throws when automation.passives is null', () => {
            const playerStats = { automation: { passives: null } };
            expect(() => getWildMagicSurgeFeatures(playerStats)).toThrow('Expected array, got null');
        });

        it('throws when automation is missing', () => {
            expect(() => getWildMagicSurgeFeatures({})).toThrow('Expected array, got undefined');
        });
    });

    describe('hasWildMagicSurge', () => {
        it('returns true when at least one wild_magic_surge passive exists', () => {
            const playerStats = {
                automation: { passives: [{ type: 'wild_magic_surge' }] },
            };
            expect(hasWildMagicSurge(playerStats)).toBe(true);
        });

        it('returns false when no wild_magic_surge passives exist', () => {
            const playerStats = {
                automation: { passives: [{ type: 'other' }] },
            };
            expect(hasWildMagicSurge(playerStats)).toBe(false);
        });
    });

    describe('getControlledChaosFeature', () => {
        it('returns the auto_effect wild_magic_double_roll passive', () => {
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

        it('returns undefined when no matching feature exists', () => {
            const playerStats = {
                automation: { passives: [{ type: 'other' }] },
            };
            expect(getControlledChaosFeature(playerStats)).toBeUndefined();
        });

        it('throws when passives is missing', () => {
            expect(() => getControlledChaosFeature({})).toThrow('Expected array, got undefined');
        });
    });

    describe('getTamedSurgeFeature', () => {
        it('returns the wild_magic_tamed passive', () => {
            const playerStats = {
                automation: { passives: [{ type: 'wild_magic_tamed', name: 'Tamed Surge' }] },
            };
            const result = getTamedSurgeFeature(playerStats);
            expect(result).toEqual({ type: 'wild_magic_tamed', name: 'Tamed Surge' });
        });

        it('returns undefined when no matching feature exists', () => {
            const playerStats = {
                automation: { passives: [{ type: 'other' }] },
            };
            expect(getTamedSurgeFeature(playerStats)).toBeUndefined();
        });

        it('throws when passives is missing', () => {
            expect(() => getTamedSurgeFeature({})).toThrow('Expected array, got undefined');
        });
    });

    describe('getFeatsOfChaosFeature', () => {
        it('returns the conditional_advantage feats_of_chaos_active passive', () => {
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

        it('returns undefined when condition does not match', () => {
            const playerStats = {
                automation: { passives: [{ type: 'conditional_advantage', condition: 'other' }] },
            };
            expect(getFeatsOfChaosFeature(playerStats)).toBeUndefined();
        });

        it('throws when passives is missing', () => {
            expect(() => getFeatsOfChaosFeature({})).toThrow('Expected array, got undefined');
        });
    });

    describe('triggerWildMagicSurge', () => {
        it('returns null for non-Sorcerer class without Sorcerer in spell.classes', async () => {
            const playerStats = { ...BASE_PLAYER_STATS, class: { name: 'Wizard' } };
            const spell = { ...SPELL };

            const result = await triggerWildMagicSurge(spell, {}, playerStats, CAMPAIGN_NAME, MAP_NAME);

            expect(result).toBeNull();
            expect(executeHandler).not.toHaveBeenCalled();
        });

        it('triggers when spell.classes includes Sorcerer even if caster is different class', async () => {
            executeHandler.mockResolvedValue({ type: 'popup', payload: { type: 'automation_info' } });
            const playerStats = { ...BASE_PLAYER_STATS, class: { name: 'Wizard' } };
            const spell = { ...SPELL, classes: ['Sorcerer'] };

            const result = await triggerWildMagicSurge(spell, { slotLevel: 1 }, playerStats, CAMPAIGN_NAME, MAP_NAME);

            expect(result).not.toBeNull();
            expect(result.type).toBe('popup');
            expect(executeHandler).toHaveBeenCalled();
        });

        it('returns null when spell does not use a spell slot', async () => {
            const playerStats = { ...BASE_PLAYER_STATS };
            const spell = { name: 'Eldritch Blast', level: 0 };

            const result = await triggerWildMagicSurge(spell, { slotLevel: 0 }, playerStats, CAMPAIGN_NAME, MAP_NAME);

            expect(result).toBeNull();
            expect(executeHandler).not.toHaveBeenCalled();
        });

        it('returns null when spell has no wild magic surge features', async () => {
            const playerStats = {
                ...BASE_PLAYER_STATS,
                automation: { passives: [] },
            };
            const spell = { ...SPELL };

            const result = await triggerWildMagicSurge(spell, { slotLevel: 1 }, playerStats, CAMPAIGN_NAME, MAP_NAME);

            expect(result).toBeNull();
            expect(executeHandler).not.toHaveBeenCalled();
        });

        it('returns null when playerStats is null', async () => {
            const spell = { ...SPELL };
            const result = await triggerWildMagicSurge(spell, { slotLevel: 1 }, null, CAMPAIGN_NAME, MAP_NAME);
            expect(result).toBeNull();
        });

        it('returns null when playerStats is undefined', async () => {
            const spell = { ...SPELL };
            const result = await triggerWildMagicSurge(spell, { slotLevel: 1 }, undefined, CAMPAIGN_NAME, MAP_NAME);
            expect(result).toBeNull();
        });

        it('throws TypeError when spell is null and caster is not Sorcerer', async () => {
            const playerStats = { ...BASE_PLAYER_STATS, class: { name: 'Wizard' } };
            await expect(
                triggerWildMagicSurge(null, { slotLevel: 1 }, playerStats, CAMPAIGN_NAME, MAP_NAME),
            ).rejects.toThrow('Cannot read properties of null');
        });

        it('throws TypeError when spell is undefined and caster is not Sorcerer', async () => {
            const playerStats = { ...BASE_PLAYER_STATS, class: { name: 'Wizard' } };
            await expect(
                triggerWildMagicSurge(undefined, { slotLevel: 1 }, playerStats, CAMPAIGN_NAME, MAP_NAME),
            ).rejects.toThrow('Cannot read properties of undefined');
        });

        it('sets wildMagicDoubleRoll when controlled chaos feature exists', async () => {
            const playerStats = {
                ...BASE_PLAYER_STATS,
                automation: {
                    passives: [
                        { type: 'wild_magic_surge', name: 'Wild Surge' },
                        { type: 'auto_effect', effect: 'wild_magic_double_roll', name: 'Controlled Chaos' },
                    ],
                },
            };
            const spell = { ...SPELL };

            executeHandler.mockResolvedValue({ type: 'popup', payload: {} });

            await triggerWildMagicSurge(spell, { slotLevel: 1 }, playerStats, CAMPAIGN_NAME, MAP_NAME);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                playerStats.name,
                'wildMagicDoubleRoll',
                true,
                CAMPAIGN_NAME,
                true,
            );
        });

        it('returns modal for tamed surge when available surges exist', async () => {
            const playerStats = {
                ...BASE_PLAYER_STATS,
                automation: {
                    passives: [
                        { type: 'wild_magic_surge', name: 'Wild Surge' },
                        { type: 'wild_magic_tamed', name: 'Tamed Surge' },
                    ],
                },
            };
            const spell = { ...SPELL };

            getRuntimeValue.mockImplementation((_charKey, prop) => {
                if (prop === 'tamedSurgeUses') return 1;
                if (prop === 'tamedSurgeLastRest') return null;
                return null;
            });

            const result = await triggerWildMagicSurge(spell, { slotLevel: 1 }, playerStats, CAMPAIGN_NAME, MAP_NAME);

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
                    campaignName: CAMPAIGN_NAME,
                },
            });
            expect(executeHandler).not.toHaveBeenCalled();
        });

        it('falls through to executeHandler when tamed surge has no available surges (all max=20)', async () => {
            const playerStats = {
                ...BASE_PLAYER_STATS,
                automation: {
                    passives: [
                        { type: 'wild_magic_surge', name: 'Wild Surge' },
                        { type: 'wild_magic_tamed', name: 'Tamed Surge' },
                    ],
                },
                wildMagicSurgeTable: [{ min: 1, max: 20, effect: 'All surges' }],
            };
            const spell = { ...SPELL };

            getRuntimeValue.mockImplementation((_charKey, prop) => {
                if (prop === 'tamedSurgeUses') return 1;
                return null;
            });

            const result = await triggerWildMagicSurge(spell, { slotLevel: 1 }, playerStats, CAMPAIGN_NAME, MAP_NAME);

            expect(result).toEqual({ type: 'popup', payload: {} });
            expect(executeHandler).toHaveBeenCalled();
        });

        it('falls through to executeHandler when tamed surge uses is 0', async () => {
            const playerStats = {
                ...BASE_PLAYER_STATS,
                automation: {
                    passives: [
                        { type: 'wild_magic_surge', name: 'Wild Surge' },
                        { type: 'wild_magic_tamed', name: 'Tamed Surge' },
                    ],
                },
            };
            const spell = { ...SPELL };

            getRuntimeValue.mockImplementation((_charKey, prop) => {
                if (prop === 'tamedSurgeUses') return 0;
                return null;
            });

            const result = await triggerWildMagicSurge(spell, { slotLevel: 1 }, playerStats, CAMPAIGN_NAME, MAP_NAME);

            expect(result).toEqual({ type: 'popup', payload: {} });
            expect(executeHandler).toHaveBeenCalled();
        });

        it('falls through to executeHandler when tamed surge uses is null (defaults to 0)', async () => {
            const playerStats = {
                ...BASE_PLAYER_STATS,
                automation: {
                    passives: [
                        { type: 'wild_magic_surge', name: 'Wild Surge' },
                        { type: 'wild_magic_tamed', name: 'Tamed Surge' },
                    ],
                },
            };
            const spell = { ...SPELL };

            getRuntimeValue.mockImplementation((_charKey, prop) => {
                if (prop === 'tamedSurgeUses') return null;
                return null;
            });

            const result = await triggerWildMagicSurge(spell, { slotLevel: 1 }, playerStats, CAMPAIGN_NAME, MAP_NAME);

            expect(result).toEqual({ type: 'popup', payload: {} });
            expect(executeHandler).toHaveBeenCalled();
        });

        it('falls through to executeHandler when tamed surge uses is undefined (defaults to 0)', async () => {
            const playerStats = {
                ...BASE_PLAYER_STATS,
                automation: {
                    passives: [
                        { type: 'wild_magic_surge', name: 'Wild Surge' },
                        { type: 'wild_magic_tamed', name: 'Tamed Surge' },
                    ],
                },
            };
            const spell = { ...SPELL };

            getRuntimeValue.mockReturnValue(null);

            const result = await triggerWildMagicSurge(spell, { slotLevel: 1 }, playerStats, CAMPAIGN_NAME, MAP_NAME);

            expect(result).toEqual({ type: 'popup', payload: {} });
            expect(executeHandler).toHaveBeenCalled();
        });

        it('executes feats of chaos when feature exists and has uses', async () => {
            const playerStats = {
                ...BASE_PLAYER_STATS,
                automation: {
                    passives: [
                        { type: 'wild_magic_surge', name: 'Wild Surge' },
                        { type: 'conditional_advantage', condition: 'feats_of_chaos_active', name: 'Feats of Chaos' },
                    ],
                },
            };
            const spell = { ...SPELL };

            getRuntimeValue.mockImplementation((_charKey, prop) => {
                if (prop === 'featsOfChaosUses') return 1;
                if (prop === 'featsOfChaosLastRest') return null;
                if (prop === 'featsOfChaosActive') return false;
                return null;
            });

            executeHandler.mockResolvedValue({ type: 'popup', payload: {} });

            const result = await triggerWildMagicSurge(spell, { slotLevel: 1 }, playerStats, CAMPAIGN_NAME, MAP_NAME);

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
                CAMPAIGN_NAME,
                true,
            );
        });

        it('toggles featsOfChaosActive from true to false when already active', async () => {
            const playerStats = {
                ...BASE_PLAYER_STATS,
                automation: {
                    passives: [
                        { type: 'wild_magic_surge', name: 'Wild Surge' },
                        { type: 'conditional_advantage', condition: 'feats_of_chaos_active', name: 'Feats of Chaos' },
                    ],
                },
            };
            const spell = { ...SPELL };

            getRuntimeValue.mockImplementation((_charKey, prop) => {
                if (prop === 'featsOfChaosUses') return 1;
                if (prop === 'featsOfChaosActive') return true;
                return null;
            });

            executeHandler.mockResolvedValue({ type: 'popup', payload: {} });

            await triggerWildMagicSurge(spell, { slotLevel: 1 }, playerStats, CAMPAIGN_NAME, MAP_NAME);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                playerStats.name,
                'featsOfChaosActive',
                false,
                CAMPAIGN_NAME,
                true,
            );
        });

        it('toggles featsOfChaosActive from false to true when not yet active', async () => {
            const playerStats = {
                ...BASE_PLAYER_STATS,
                automation: {
                    passives: [
                        { type: 'wild_magic_surge', name: 'Wild Surge' },
                        { type: 'conditional_advantage', condition: 'feats_of_chaos_active', name: 'Feats of Chaos' },
                    ],
                },
            };
            const spell = { ...SPELL };

            getRuntimeValue.mockImplementation((_charKey, prop) => {
                if (prop === 'featsOfChaosUses') return 1;
                if (prop === 'featsOfChaosActive') return false;
                return null;
            });

            executeHandler.mockResolvedValue({ type: 'popup', payload: {} });

            await triggerWildMagicSurge(spell, { slotLevel: 1 }, playerStats, CAMPAIGN_NAME, MAP_NAME);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                playerStats.name,
                'featsOfChaosActive',
                true,
                CAMPAIGN_NAME,
                true,
            );
        });

        it('does not set last rest timestamp when feats of chaos uses reach 0', async () => {
            const playerStats = {
                ...BASE_PLAYER_STATS,
                automation: {
                    passives: [
                        { type: 'wild_magic_surge', name: 'Wild Surge' },
                        { type: 'conditional_advantage', condition: 'feats_of_chaos_active', name: 'Feats of Chaos' },
                    ],
                },
            };
            const spell = { ...SPELL };

            getRuntimeValue.mockImplementation((_charKey, prop) => {
                if (prop === 'featsOfChaosUses') return 1;
                if (prop === 'featsOfChaosActive') return false;
                return null;
            });

            executeHandler.mockResolvedValue({ type: 'popup', payload: {} });

            await triggerWildMagicSurge(spell, { slotLevel: 1 }, playerStats, CAMPAIGN_NAME, MAP_NAME);

            const lastRestCalls = setRuntimeValue.mock.calls.filter(
                call => call[1] === 'featsOfChaosLastRest',
            );
            expect(lastRestCalls).toHaveLength(0);
        });

        it('falls through to executeHandler when feats of chaos uses are 0 within rest period', async () => {
            const now = Date.now();
            const playerStats = {
                ...BASE_PLAYER_STATS,
                automation: {
                    passives: [
                        { type: 'wild_magic_surge', name: 'Wild Surge' },
                        { type: 'conditional_advantage', condition: 'feats_of_chaos_active', name: 'Feats of Chaos' },
                    ],
                },
            };
            const spell = { ...SPELL };

            getRuntimeValue.mockImplementation((_charKey, prop) => {
                if (prop === 'featsOfChaosUses') return 0;
                if (prop === 'featsOfChaosLastRest') return now - 3600000;
                if (prop === 'featsOfChaosActive') return false;
                return null;
            });

            const result = await triggerWildMagicSurge(spell, { slotLevel: 1 }, playerStats, CAMPAIGN_NAME, MAP_NAME);

            expect(result).toEqual({ type: 'popup', payload: {} });
            expect(executeHandler).toHaveBeenCalled();
        });

        it('resets feats of chaos uses when rest period expired', async () => {
            const now = Date.now();
            const playerStats = {
                ...BASE_PLAYER_STATS,
                automation: {
                    passives: [
                        { type: 'wild_magic_surge', name: 'Wild Surge' },
                        { type: 'conditional_advantage', condition: 'feats_of_chaos_active', name: 'Feats of Chaos' },
                    ],
                },
            };
            const spell = { ...SPELL };

            getRuntimeValue.mockImplementation((_charKey, prop) => {
                if (prop === 'featsOfChaosUses') return 0;
                if (prop === 'featsOfChaosLastRest') return now - 172800000;
                if (prop === 'featsOfChaosActive') return false;
                return null;
            });

            executeHandler.mockResolvedValue({ type: 'popup', payload: {} });

            const result = await triggerWildMagicSurge(spell, { slotLevel: 1 }, playerStats, CAMPAIGN_NAME, MAP_NAME);

            expect(result).not.toBeNull();
        });

        it('returns null when surge was already used this combat round', async () => {
            const playerStats = { ...BASE_PLAYER_STATS };
            const spell = { ...SPELL };

            getRuntimeValue.mockImplementation((_charKey, prop) => {
                if (prop === 'surgeUsedRound') return 1;
                return null;
            });

            const result = await triggerWildMagicSurge(spell, { slotLevel: 1 }, playerStats, CAMPAIGN_NAME, MAP_NAME);

            expect(result).toBeNull();
            expect(executeHandler).not.toHaveBeenCalled();
        });

        it('returns null when executeHandler returns null', async () => {
            const playerStats = { ...BASE_PLAYER_STATS };
            const spell = { ...SPELL };

            executeHandler.mockResolvedValue(null);

            const result = await triggerWildMagicSurge(spell, { slotLevel: 1 }, playerStats, CAMPAIGN_NAME, MAP_NAME);

            expect(result).toBeNull();
        });

        it('throws when executeHandler throws an error', async () => {
            const playerStats = { ...BASE_PLAYER_STATS };
            const spell = { ...SPELL };

            executeHandler.mockRejectedValue(new Error('Handler failed'));

            await expect(
                triggerWildMagicSurge(spell, { slotLevel: 1 }, playerStats, CAMPAIGN_NAME, MAP_NAME),
            ).rejects.toThrow('Handler failed');
        });

        it('uses spell.level when metaCtx has no slotLevel', async () => {
            const playerStats = { ...BASE_PLAYER_STATS, class: { name: 'Sorcerer' } };
            const spell = { ...SPELL, level: 3 };

            executeHandler.mockResolvedValue({ type: 'popup', payload: {} });

            const result = await triggerWildMagicSurge(spell, {}, playerStats, CAMPAIGN_NAME, MAP_NAME);

            expect(result).not.toBeNull();
            expect(executeHandler).toHaveBeenCalled();
        });

        it('passes campaignName and mapName to executeHandler', async () => {
            const playerStats = { ...BASE_PLAYER_STATS };
            const spell = { ...SPELL };

            executeHandler.mockResolvedValue({ type: 'popup', payload: {} });

            await triggerWildMagicSurge(spell, { slotLevel: 1 }, playerStats, CAMPAIGN_NAME, MAP_NAME);

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    name: 'Wild Surge',
                }),
                playerStats,
                CAMPAIGN_NAME,
                MAP_NAME,
            );
        });

        it('sets surgeUsedRound after successful executeHandler', async () => {
            const playerStats = { ...BASE_PLAYER_STATS };
            const spell = { ...SPELL };

            executeHandler.mockResolvedValue({ type: 'popup', payload: {} });

            await triggerWildMagicSurge(spell, { slotLevel: 1 }, playerStats, CAMPAIGN_NAME, MAP_NAME);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                playerStats.name,
                'surgeUsedRound',
                1,
                CAMPAIGN_NAME,
                true,
            );
        });

        it('does not set surgeUsedRound when executeHandler returns falsy', async () => {
            const playerStats = { ...BASE_PLAYER_STATS };
            const spell = { ...SPELL };

            executeHandler.mockResolvedValue(null);

            await triggerWildMagicSurge(spell, { slotLevel: 1 }, playerStats, CAMPAIGN_NAME, MAP_NAME);

            const surgeRoundCalls = setRuntimeValue.mock.calls.filter(
                call => call[1] === 'surgeUsedRound',
            );
            expect(surgeRoundCalls).toHaveLength(0);
        });

        it('handles empty wildMagicSurgeTable by returning executeHandler result', async () => {
            const playerStats = {
                ...BASE_PLAYER_STATS,
                wildMagicSurgeTable: [],
            };
            const spell = { ...SPELL };

            executeHandler.mockResolvedValue({ type: 'popup', payload: {} });

            const result = await triggerWildMagicSurge(spell, { slotLevel: 1 }, playerStats, CAMPAIGN_NAME, MAP_NAME);

            expect(result).toEqual({ type: 'popup', payload: {} });
        });

        it('uses default surge effect when d20 roll finds no matching entry', async () => {
            const playerStats = {
                ...BASE_PLAYER_STATS,
                automation: {
                    passives: [
                        { type: 'wild_magic_surge', name: 'Wild Surge' },
                        { type: 'conditional_advantage', condition: 'feats_of_chaos_active', name: 'Feats of Chaos' },
                    ],
                },
                wildMagicSurgeTable: [],
            };
            const spell = { ...SPELL };

            getRuntimeValue.mockImplementation((_charKey, prop) => {
                if (prop === 'featsOfChaosUses') return 1;
                if (prop === 'featsOfChaosActive') return false;
                return null;
            });

            executeHandler.mockResolvedValue({ type: 'popup', payload: {} });

            const result = await triggerWildMagicSurge(spell, { slotLevel: 1 }, playerStats, CAMPAIGN_NAME, MAP_NAME);

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
    });
});
