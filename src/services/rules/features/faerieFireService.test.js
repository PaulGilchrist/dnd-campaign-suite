import { describe, it, expect, vi, beforeEach } from 'vitest';
import { triggerFaerieFire } from './faerieFireService.js';
import { executeHandler } from '../../automation/index.js';

vi.mock('../../automation/index.js', () => ({
    executeHandler: vi.fn(),
}));

describe('faerieFireService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    const campaignName = 'TestCampaign';
    const mapName = 'testMap';
    const playerStats = {
        name: 'Wizard',
        spellAbilities: { saveDc: 15, modifier: 4 },
        proficiency: 4,
    };

    describe('triggerFaerieFire', () => {
        describe('action construction', () => {
            it('calls executeHandler with correct action structure', async () => {
                executeHandler.mockResolvedValue({ type: 'popup' });

                await triggerFaerieFire(
                    { name: 'Faerie Fire', level: 1 },
                    {},
                    playerStats,
                    campaignName,
                    mapName,
                );

                expect(executeHandler).toHaveBeenCalledTimes(1);
                const [action] = executeHandler.mock.calls[0];
                expect(action.name).toBe('Faerie Fire');
                expect(action.automation.type).toBe('faerie_fire');
                expect(action.automation.saveType).toBe('DEX');
                expect(action.spell).toEqual({ name: 'Faerie Fire', level: 1 });
            });

            it('copies metaCtx into action.metaCtx as a shallow clone', async () => {
                executeHandler.mockResolvedValue({ type: 'popup' });

                const metaCtx = { target: 'Goblin', heightenTarget: 'Goblin' };
                await triggerFaerieFire(
                    { name: 'Faerie Fire', level: 1 },
                    metaCtx,
                    playerStats,
                    campaignName,
                    mapName,
                );

                const [action] = executeHandler.mock.calls[0];
                expect(action.metaCtx).toEqual(metaCtx);
                expect(action.metaCtx).not.toBe(metaCtx);
            });

            it('handles null metaCtx by spreading to empty object', async () => {
                executeHandler.mockResolvedValue({ type: 'popup' });

                await triggerFaerieFire(
                    { name: 'Faerie Fire', level: 1 },
                    null,
                    playerStats,
                    campaignName,
                    mapName,
                );

                const [action] = executeHandler.mock.calls[0];
                expect(action.metaCtx).toEqual({});
            });

            it('handles undefined metaCtx by spreading to empty object', async () => {
                executeHandler.mockResolvedValue({ type: 'popup' });

                await triggerFaerieFire(
                    { name: 'Faerie Fire', level: 1 },
                    undefined,
                    playerStats,
                    campaignName,
                    mapName,
                );

                const [action] = executeHandler.mock.calls[0];
                expect(action.metaCtx).toEqual({});
            });
        });

        describe('save DC resolution', () => {
            it('uses metaCtx spellSaveDc when provided', async () => {
                executeHandler.mockResolvedValue({ type: 'popup' });

                await triggerFaerieFire(
                    { name: 'Faerie Fire', level: 1 },
                    { spellSaveDc: 18 },
                    playerStats,
                    campaignName,
                    mapName,
                );

                const [action] = executeHandler.mock.calls[0];
                expect(action.automation.saveDc).toBe(18);
            });

            it('falls back to playerStats.spellAbilities.saveDc when metaCtx lacks it', async () => {
                executeHandler.mockResolvedValue({ type: 'popup' });

                await triggerFaerieFire(
                    { name: 'Faerie Fire', level: 1 },
                    {},
                    playerStats,
                    campaignName,
                    mapName,
                );

                const [action] = executeHandler.mock.calls[0];
                expect(action.automation.saveDc).toBe(15);
            });

            it('computes saveDc from proficiency when spellAbilities is missing', async () => {
                executeHandler.mockResolvedValue({ type: 'popup' });
                const stats = { name: 'Wizard', proficiency: 3 };

                await triggerFaerieFire(
                    { name: 'Faerie Fire', level: 1 },
                    {},
                    stats,
                    campaignName,
                    mapName,
                );

                const [action] = executeHandler.mock.calls[0];
                // 8 + 3 = 11
                expect(action.automation.saveDc).toBe(11);
            });

            it('uses default saveDc of 10 when stats object is empty', async () => {
                executeHandler.mockResolvedValue({ type: 'popup' });

                await triggerFaerieFire(
                    { name: 'Faerie Fire', level: 1 },
                    {},
                    {},
                    campaignName,
                    mapName,
                );

                const [action] = executeHandler.mock.calls[0];
                // 8 + (2 default) = 10
                expect(action.automation.saveDc).toBe(10);
            });
        });

        describe('slot level resolution', () => {
            it('uses metaCtx slotLevel when provided', async () => {
                executeHandler.mockResolvedValue({ type: 'popup' });

                await triggerFaerieFire(
                    { name: 'Faerie Fire', level: 1 },
                    { slotLevel: 5 },
                    playerStats,
                    campaignName,
                    mapName,
                );

                const [action] = executeHandler.mock.calls[0];
                expect(action.spellSlotLevel).toBe(5);
            });

            it('falls back to spell.level when metaCtx has no slotLevel', async () => {
                executeHandler.mockResolvedValue({ type: 'popup' });

                await triggerFaerieFire(
                    { name: 'Faerie Fire', level: 3 },
                    { spellSaveDc: 17 },
                    playerStats,
                    campaignName,
                    mapName,
                );

                const [action] = executeHandler.mock.calls[0];
                expect(action.spellSlotLevel).toBe(3);
            });

            it('defaults slotLevel to 1 when neither metaCtx nor spell has level', async () => {
                executeHandler.mockResolvedValue({ type: 'popup' });

                await triggerFaerieFire(
                    { name: 'Faerie Fire' },
                    {},
                    playerStats,
                    campaignName,
                    mapName,
                );

                const [action] = executeHandler.mock.calls[0];
                expect(action.spellSlotLevel).toBe(1);
            });
        });

        describe('return value', () => {
            it('returns result from executeHandler on success', async () => {
                const expectedResult = {
                    type: 'popup',
                    payload: { type: 'automation_info', name: 'Faerie Fire', description: '...' },
                };
                executeHandler.mockResolvedValue(expectedResult);

                const result = await triggerFaerieFire(
                    { name: 'Faerie Fire', level: 1 },
                    {},
                    playerStats,
                    campaignName,
                    mapName,
                );

                expect(result).toBe(expectedResult);
            });

            it('returns null when executeHandler throws an error', async () => {
                executeHandler.mockRejectedValue(new Error('Handler failed'));

                const result = await triggerFaerieFire(
                    { name: 'Faerie Fire', level: 1 },
                    {},
                    playerStats,
                    campaignName,
                    mapName,
                );

                expect(result).toBeNull();
            });

            it('returns null when executeHandler returns null', async () => {
                executeHandler.mockResolvedValue(null);

                const result = await triggerFaerieFire(
                    { name: 'Faerie Fire', level: 1 },
                    {},
                    playerStats,
                    campaignName,
                    mapName,
                );

                expect(result).toBeNull();
            });
        });
    });
});
