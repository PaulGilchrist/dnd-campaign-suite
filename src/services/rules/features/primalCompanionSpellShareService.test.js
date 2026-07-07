// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    triggerPrimalCompanionSpellShare,
    hasShareSpells,
    getShareSpellsFeature,
} from './primalCompanionSpellShareService.js';

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../automation/index.js', () => ({
    executeHandler: vi.fn(),
}));

import { getRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { executeHandler } from '../../automation/index.js';

describe('primalCompanionSpellShareService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('hasShareSpells', () => {
        it('returns true when automation passives includes primal_companion_spell_share', () => {
            const playerStats = {
                automation: {
                    passives: [{ type: 'primal_companion_spell_share', name: 'Share Spells' }],
                },
            };
            expect(hasShareSpells(playerStats)).toBe(true);
        });

        it('returns false when no primal_companion_spell_share passive exists', () => {
            const playerStats = {
                automation: {
                    passives: [{ type: 'post_cast_rider', name: 'Some Rider' }],
                },
            };
            expect(hasShareSpells(playerStats)).toBe(false);
        });

        it('returns false when passives is empty', () => {
            const playerStats = { automation: { passives: [] } };
            expect(hasShareSpells(playerStats)).toBe(false);
        });

        it('throws when automation.passives is null or undefined', () => {
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

            const nullStats = { automation: { passives: null } };
            expect(() => hasShareSpells(nullStats)).toThrow('Expected array, got null');

            const undefStats = { automation: { passives: undefined } };
            expect(() => hasShareSpells(undefStats)).toThrow('Expected array, got undefined');

            const noAutomationStats = {};
            expect(() => hasShareSpells(noAutomationStats)).toThrow('Expected array, got undefined');

            consoleSpy.mockRestore();
        });
    });

    describe('getShareSpellsFeature', () => {
        it('returns the share spells feature from passives', () => {
            const playerStats = {
                automation: {
                    passives: [
                        { type: 'post_cast_rider', name: 'Rider' },
                        { type: 'primal_companion_spell_share', name: 'Share Spells', range: '30_ft' },
                    ],
                },
            };
            const feature = getShareSpellsFeature(playerStats);
            expect(feature).toEqual({ type: 'primal_companion_spell_share', name: 'Share Spells', range: '30_ft' });
        });

        it('returns the first matching feature when multiple exist', () => {
            const playerStats = {
                automation: {
                    passives: [
                        { type: 'primal_companion_spell_share', name: 'Share Spells', range: '30_ft' },
                        { type: 'primal_companion_spell_share', name: 'Share Spells v2', range: '60_ft' },
                    ],
                },
            };
            const feature = getShareSpellsFeature(playerStats);
            expect(feature.name).toBe('Share Spells');
            expect(feature.range).toBe('30_ft');
        });

        it('returns undefined when no share spells feature exists', () => {
            const playerStats = {
                automation: {
                    passives: [{ type: 'post_cast_rider', name: 'Rider' }],
                },
            };
            const feature = getShareSpellsFeature(playerStats);
            expect(feature).toBeUndefined();
        });
    });

    describe('triggerPrimalCompanionSpellShare', () => {
        const campaignName = 'test-campaign';

        const createPlayerStats = (overrides = {}) => ({
            name: 'TestRanger',
            automation: {
                passives: [{ type: 'primal_companion_spell_share', name: 'Share Spells', range: '30_ft' }],
            },
            ...overrides,
        });

        const createSpell = (overrides = {}) => ({
            name: 'Shield',
            level: 1,
            range: 'Self',
            ...overrides,
        });

        const createMetaCtx = (overrides = {}) => ({
            ...overrides,
        });

        it('returns null when no share spells feature exists', async () => {
            const playerStats = createPlayerStats({ automation: { passives: [] } });
            const result = await triggerPrimalCompanionSpellShare(
                createSpell(),
                createMetaCtx(),
                playerStats,
                campaignName
            );
            expect(result).toBeNull();
            expect(executeHandler).not.toHaveBeenCalled();
        });

        it('returns null for non-self-targeted spells', async () => {
            const result = await triggerPrimalCompanionSpellShare(
                createSpell({ range: '120 feet' }),
                createMetaCtx(),
                createPlayerStats(),
                campaignName
            );
            expect(result).toBeNull();
            expect(executeHandler).not.toHaveBeenCalled();
        });

        it('returns null for self-targeted spells with undefined or empty range', async () => {
            const result1 = await triggerPrimalCompanionSpellShare(
                createSpell({ range: undefined }),
                createMetaCtx(),
                createPlayerStats(),
                campaignName
            );
            expect(result1).toBeNull();

            const result2 = await triggerPrimalCompanionSpellShare(
                createSpell({ range: '' }),
                createMetaCtx(),
                createPlayerStats(),
                campaignName
            );
            expect(result2).toBeNull();
        });

        it('returns null for cantrips (level 0)', async () => {
            const spell = createSpell({ level: 0 });
            const result = await triggerPrimalCompanionSpellShare(
                spell,
                createMetaCtx(),
                createPlayerStats(),
                campaignName
            );
            expect(result).toBeNull();
            expect(executeHandler).not.toHaveBeenCalled();
        });

        it('returns null for area effect casting with multiTarget or aoeTarget', async () => {
            getRuntimeValue.mockImplementation((player, key, _campaign) => {
                if (key === 'primalCompanionType') return 'Beast of the Forest';
                if (key === 'primalCompanionAlive') return true;
                return undefined;
            });

            const result1 = await triggerPrimalCompanionSpellShare(
                createSpell(),
                createMetaCtx({ multiTarget: 'Goblin' }),
                createPlayerStats(),
                campaignName
            );
            expect(result1).toBeNull();

            const result2 = await triggerPrimalCompanionSpellShare(
                createSpell(),
                createMetaCtx({ aoeTarget: 'area' }),
                createPlayerStats(),
                campaignName
            );
            expect(result2).toBeNull();
        });

        it('returns null when no companion is summoned', async () => {
            getRuntimeValue.mockReturnValue(null);

            const result = await triggerPrimalCompanionSpellShare(
                createSpell(),
                createMetaCtx(),
                createPlayerStats(),
                campaignName
            );
            expect(result).toBeNull();
            expect(executeHandler).not.toHaveBeenCalled();
        });

        it('returns null when companion is not alive', async () => {
            getRuntimeValue.mockImplementation((player, key, _campaign) => {
                if (key === 'primalCompanionType') return 'Beast of the Sea';
                if (key === 'primalCompanionAlive') return false;
                return undefined;
            });

            const result = await triggerPrimalCompanionSpellShare(
                createSpell(),
                createMetaCtx(),
                createPlayerStats(),
                campaignName
            );
            expect(result).toBeNull();
            expect(executeHandler).not.toHaveBeenCalled();
        });

        it('triggers when companion alive is undefined (not explicitly false)', async () => {
            getRuntimeValue.mockImplementation((player, key, _campaign) => {
                if (key === 'primalCompanionType') return 'Beast of the Sea';
                return undefined;
            });

            executeHandler.mockResolvedValue({ type: 'modal', modalName: 'primalCompanionSpellShare' });

            const result = await triggerPrimalCompanionSpellShare(
                createSpell(),
                createMetaCtx(),
                createPlayerStats(),
                campaignName
            );

            expect(executeHandler).toHaveBeenCalled();
            expect(result).toEqual({ type: 'modal', modalName: 'primalCompanionSpellShare' });
        });

        it('triggers for self (30-foot cone) and self (60-foot cone) spells', async () => {
            getRuntimeValue.mockImplementation((player, key, _campaign) => {
                if (key === 'primalCompanionType') return 'Beast of the Sea';
                if (key === 'primalCompanionAlive') return true;
                return undefined;
            });

            executeHandler.mockResolvedValue({
                type: 'modal',
                modalName: 'primalCompanionSpellShare',
            });

            const result1 = await triggerPrimalCompanionSpellShare(
                createSpell({ name: 'Acid Splash', level: 1, range: 'Self (30-foot cone)' }),
                createMetaCtx(),
                createPlayerStats(),
                campaignName
            );
            expect(executeHandler).toHaveBeenCalled();
            expect(result1).toEqual({
                type: 'modal',
                modalName: 'primalCompanionSpellShare',
            });

            const result2 = await triggerPrimalCompanionSpellShare(
                createSpell({ name: 'Frostbite', level: 1, range: 'Self (60-foot cone)' }),
                createMetaCtx(),
                createPlayerStats(),
                campaignName
            );
            expect(result2).toEqual({
                type: 'modal',
                modalName: 'primalCompanionSpellShare',
            });
        });

        it('triggers for lowercase self range', async () => {
            getRuntimeValue.mockImplementation((player, key, _campaign) => {
                if (key === 'primalCompanionType') return 'Beast of the Sea';
                if (key === 'primalCompanionAlive') return true;
                return undefined;
            });

            executeHandler.mockResolvedValue({
                type: 'modal',
                modalName: 'primalCompanionSpellShare',
            });

            const spell = createSpell({ range: 'self' });
            const result = await triggerPrimalCompanionSpellShare(
                spell,
                createMetaCtx(),
                createPlayerStats(),
                campaignName
            );

            expect(executeHandler).toHaveBeenCalled();
            expect(result).toEqual({
                type: 'modal',
                modalName: 'primalCompanionSpellShare',
            });
        });

        it('calls executeHandler with correct action when companion is summoned and alive', async () => {
            getRuntimeValue.mockImplementation((player, key, _campaign) => {
                if (key === 'primalCompanionType') return 'Beast of the Sea';
                if (key === 'primalCompanionAlive') return true;
                return undefined;
            });

            const expectedAction = expect.objectContaining({
                name: 'Share Spells',
                automation: expect.objectContaining({
                    type: 'primal_companion_spell_share',
                    companionType: 'Beast of the Sea',
                    range: '30_ft',
                }),
            });

            executeHandler.mockResolvedValue({
                type: 'modal',
                modalName: 'primalCompanionSpellShare',
                payload: { companionType: 'Beast of the Sea' },
            });

            const spell = createSpell();
            const result = await triggerPrimalCompanionSpellShare(
                spell,
                createMetaCtx(),
                createPlayerStats(),
                campaignName,
                'test-map'
            );

            expect(executeHandler).toHaveBeenCalledTimes(1);
            expect(executeHandler).toHaveBeenCalledWith(
                expectedAction,
                createPlayerStats(),
                campaignName,
                'test-map'
            );
            expect(result).toEqual({
                type: 'modal',
                modalName: 'primalCompanionSpellShare',
                payload: { companionType: 'Beast of the Sea' },
            });
        });

        it('uses shareFeature fallbacks when range and description are missing', async () => {
            getRuntimeValue.mockImplementation((player, key, _campaign) => {
                if (key === 'primalCompanionType') return 'Beast of the Sea';
                if (key === 'primalCompanionAlive') return true;
                return undefined;
            });

            executeHandler.mockResolvedValue({ type: 'modal', modalName: 'primalCompanionSpellShare' });

            const playerStats = createPlayerStats({
                automation: {
                    passives: [{ type: 'primal_companion_spell_share', name: 'Share Spells' }],
                },
            });

            await triggerPrimalCompanionSpellShare(
                createSpell(),
                createMetaCtx(),
                playerStats,
                campaignName
            );

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    automation: expect.objectContaining({ range: '30_ft' }),
                    description: 'When you cast a spell targeting yourself, you can also affect your Primal Companion beast if within 30 feet.',
                }),
                expect.any(Object),
                campaignName,
                undefined
            );
        });

        it('passes mapName when provided', async () => {
            getRuntimeValue.mockImplementation((player, key, _campaign) => {
                if (key === 'primalCompanionType') return 'Beast of the Sea';
                if (key === 'primalCompanionAlive') return true;
                return undefined;
            });

            executeHandler.mockResolvedValue({ type: 'modal', modalName: 'primalCompanionSpellShare' });

            await triggerPrimalCompanionSpellShare(
                createSpell(),
                createMetaCtx(),
                createPlayerStats(),
                campaignName,
                'dungeon-level-3'
            );

            expect(executeHandler).toHaveBeenCalledWith(
                expect.any(Object),
                expect.any(Object),
                campaignName,
                'dungeon-level-3'
            );
        });

        it('returns null and logs error when executeHandler throws', async () => {
            getRuntimeValue.mockImplementation((player, key, _campaign) => {
                if (key === 'primalCompanionType') return 'Beast of the Forest';
                if (key === 'primalCompanionAlive') return true;
                return undefined;
            });

            executeHandler.mockRejectedValue(new Error('Handler failed'));

            const spell = createSpell();
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

            const result = await triggerPrimalCompanionSpellShare(
                spell,
                createMetaCtx(),
                createPlayerStats(),
                campaignName,
                'test-map'
            );

            expect(result).toBeNull();
            expect(consoleSpy).toHaveBeenCalledWith(
                '[primalCompanionSpellShare] Failed to execute spell share for Shield:',
                expect.any(Error)
            );

            consoleSpy.mockRestore();
        });

        it('returns null when executeHandler resolves to null', async () => {
            getRuntimeValue.mockImplementation((player, key, _campaign) => {
                if (key === 'primalCompanionType') return 'Beast of the Forest';
                if (key === 'primalCompanionAlive') return true;
                return undefined;
            });

            executeHandler.mockResolvedValue(null);

            const result = await triggerPrimalCompanionSpellShare(
                createSpell(),
                createMetaCtx(),
                createPlayerStats(),
                campaignName
            );

            expect(result).toBeNull();
        });

        it('returns null when metaCtx is null or undefined', async () => {
            getRuntimeValue.mockImplementation((player, key, _campaign) => {
                if (key === 'primalCompanionType') return 'Beast of the Forest';
                if (key === 'primalCompanionAlive') return true;
                return undefined;
            });

            executeHandler.mockResolvedValue({ type: 'modal', modalName: 'primalCompanionSpellShare' });

            const result1 = await triggerPrimalCompanionSpellShare(
                createSpell(),
                undefined,
                createPlayerStats(),
                campaignName
            );
            expect(executeHandler).toHaveBeenCalled();
            expect(result1).toEqual({ type: 'modal', modalName: 'primalCompanionSpellShare' });

            const result2 = await triggerPrimalCompanionSpellShare(
                createSpell(),
                null,
                createPlayerStats(),
                campaignName
            );
            expect(result2).toEqual({ type: 'modal', modalName: 'primalCompanionSpellShare' });
        });

        it('throws when spell is null or undefined', async () => {
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

            await expect(
                triggerPrimalCompanionSpellShare(
                    undefined,
                    createMetaCtx(),
                    createPlayerStats(),
                    campaignName
                )
            ).rejects.toThrow("Cannot read properties of undefined (reading 'range')");

            await expect(
                triggerPrimalCompanionSpellShare(
                    null,
                    createMetaCtx(),
                    createPlayerStats(),
                    campaignName
                )
            ).rejects.toThrow("Cannot read properties of null (reading 'range')");

            expect(executeHandler).not.toHaveBeenCalled();

            consoleSpy.mockRestore();
        });

        it('returns null when spell has no range property', async () => {
            const spell = { name: 'Shield', level: 1 };
            const result = await triggerPrimalCompanionSpellShare(
                spell,
                createMetaCtx(),
                createPlayerStats(),
                campaignName
            );

            expect(result).toBeNull();
            expect(executeHandler).not.toHaveBeenCalled();
        });
    });
});
