import { describe, it, expect, vi, beforeEach } from 'vitest';
import { triggerHolyAura } from './holyAuraService.js';
import { executeHandler } from '../../automation/index.js';
import { setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';

vi.mock('../../automation/index.js', () => ({
    executeHandler: vi.fn(),
}));

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
    setRuntimeValue: vi.fn(),
}));

describe('holyAuraService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('triggerHolyAura', () => {
        const campaignName = 'TestCampaign';
        const mapName = 'testMap';
        const playerStats = {
            name: 'Paladin',
            spellAbilities: { saveDc: 15, modifier: 4, spellCastingAbility: 'Charisma', toHit: 9 },
            proficiency: 4,
        };

        it('sets runtime value for holyAuraSaveDc', async () => {
            executeHandler.mockResolvedValue({ type: 'popup', payload: { type: 'automation_info' } });

            await triggerHolyAura(
                { name: 'Holy Aura', level: 9 },
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(setRuntimeValue).toHaveBeenCalledWith(
                playerStats.name,
                'holyAuraSaveDc',
                15,
                campaignName,
            );
        });

        it('computes saveDc from proficiency when no spellAbilities.saveDc', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });
            const stats = { name: 'Paladin', proficiency: 3 };

            await triggerHolyAura(
                { name: 'Holy Aura', level: 9 },
                {},
                stats,
                campaignName,
                mapName,
            );

            expect(setRuntimeValue).toHaveBeenCalledWith(
                stats.name,
                'holyAuraSaveDc',
                11,
                campaignName,
            );
        });

        it('produces NaN when proficiency is missing and no spellAbilities', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });
            const stats = { name: 'Paladin' };

            await triggerHolyAura(
                { name: 'Holy Aura', level: 9 },
                {},
                stats,
                campaignName,
                mapName,
            );

            expect(setRuntimeValue).toHaveBeenCalledWith(
                stats.name,
                'holyAuraSaveDc',
                NaN,
                campaignName,
            );
        });

        it('passes spellSaveDc to executeHandler action via dc and automation', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            await triggerHolyAura(
                { name: 'Holy Aura', level: 9 },
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    automation: expect.objectContaining({
                        type: 'holy_aura',
                        auraRange: 30,
                    }),
                    dc: 15,
                    spell: { name: 'Holy Aura', level: 9 },
                }),
                playerStats,
                campaignName,
                mapName,
            );
        });

        it('uses spell.duration when provided', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            await triggerHolyAura(
                { name: 'Holy Aura', level: 9, duration: '10_minutes' },
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    automation: expect.objectContaining({
                        duration: '10_minutes',
                    }),
                }),
                playerStats,
                campaignName,
                mapName,
            );
        });

        it('uses default duration of 1_minute when spell.duration is missing', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            await triggerHolyAura(
                { name: 'Holy Aura', level: 9 },
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    automation: expect.objectContaining({
                        duration: '1_minute',
                    }),
                }),
                playerStats,
                campaignName,
                mapName,
            );
        });

        it('uses spell.casting_time when provided', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            await triggerHolyAura(
                { name: 'Holy Aura', level: 9, casting_time: '1 reaction' },
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    automation: expect.objectContaining({
                        casting_time: '1 reaction',
                    }),
                }),
                playerStats,
                campaignName,
                mapName,
            );
        });

        it('uses default casting_time when spell.casting_time is missing', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            await triggerHolyAura(
                { name: 'Holy Aura', level: 9 },
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    automation: expect.objectContaining({
                        casting_time: '1 action',
                    }),
                }),
                playerStats,
                campaignName,
                mapName,
            );
        });

        it('returns result from executeHandler on success', async () => {
            const expectedResult = {
                type: 'popup',
                payload: { type: 'automation_info', name: 'Holy Aura', description: 'A protective aura...' },
            };
            executeHandler.mockResolvedValue(expectedResult);

            const result = await triggerHolyAura(
                { name: 'Holy Aura', level: 9 },
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(result).toBe(expectedResult);
        });

        it('returns null when executeHandler returns null', async () => {
            executeHandler.mockResolvedValue(null);

            const result = await triggerHolyAura(
                { name: 'Holy Aura', level: 9 },
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(result).toBeNull();
        });

        it('returns null and logs error when executeHandler throws', async () => {
            executeHandler.mockRejectedValue(new Error('Handler failed'));
            const consoleSpy = vi.spyOn(console, 'error');

            const result = await triggerHolyAura(
                { name: 'Holy Aura', level: 9 },
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(result).toBeNull();
            expect(consoleSpy).toHaveBeenCalledWith(
                '[holyAura] Trigger failed:',
                expect.any(Error),
            );
            consoleSpy.mockRestore();
        });

        it('passes the spell object into the action', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });
            const spell = { name: 'Holy Aura', level: 9, school: 'Abjuration' };

            await triggerHolyAura(spell, {}, playerStats, campaignName, mapName);

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({ spell }),
                playerStats,
                campaignName,
                mapName,
            );
        });

        it('uses spellAbilities.saveDc when provided', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });
            const stats = {
                name: 'Paladin',
                spellAbilities: { saveDc: 18, modifier: 5 },
                proficiency: 4,
            };

            await triggerHolyAura(
                { name: 'Holy Aura', level: 9 },
                {},
                stats,
                campaignName,
                mapName,
            );

            expect(setRuntimeValue).toHaveBeenCalledWith(
                stats.name,
                'holyAuraSaveDc',
                18,
                campaignName,
            );
            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    automation: expect.objectContaining({
                        type: 'holy_aura',
                        auraRange: 30,
                    }),
                    dc: 18,
                }),
                stats,
                campaignName,
                mapName,
            );
        });

        it('falls back to 8 + proficiency when spellAbilities is undefined', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });
            const stats = { name: 'Paladin', proficiency: 5 };

            await triggerHolyAura(
                { name: 'Holy Aura', level: 9 },
                {},
                stats,
                campaignName,
                mapName,
            );

            expect(setRuntimeValue).toHaveBeenCalledWith(
                stats.name,
                'holyAuraSaveDc',
                13,
                campaignName,
            );
            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    automation: expect.objectContaining({
                        type: 'holy_aura',
                        auraRange: 30,
                    }),
                    dc: 13,
                }),
                stats,
                campaignName,
                mapName,
            );
        });

        it('produces NaN when both spellAbilities and proficiency are missing', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });
            const stats = { name: 'Paladin' };

            await triggerHolyAura(
                { name: 'Holy Aura', level: 9 },
                {},
                stats,
                campaignName,
                mapName,
            );

            expect(setRuntimeValue).toHaveBeenCalledWith(
                stats.name,
                'holyAuraSaveDc',
                NaN,
                campaignName,
            );
        });

        it('calls setRuntimeValue with campaignName', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            await triggerHolyAura(
                { name: 'Holy Aura', level: 9 },
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(setRuntimeValue).toHaveBeenCalledWith(
                playerStats.name,
                'holyAuraSaveDc',
                15,
                campaignName,
            );
        });

        it('passes campaignName and mapName to executeHandler', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            await triggerHolyAura(
                { name: 'Holy Aura', level: 9 },
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalledWith(
                expect.any(Object),
                playerStats,
                campaignName,
                mapName,
            );
        });

        it('handles empty spell object with defaults', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            await triggerHolyAura(
                {},
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    name: 'Holy Aura',
                    automation: expect.objectContaining({
                        duration: '1_minute',
                        casting_time: '1 action',
                        auraRange: 30,
                    }),
                }),
                playerStats,
                campaignName,
                mapName,
            );
        });

        it('returns executeHandler result directly without modification', async () => {
            const expectedResult = {
                success: true,
                affectedEnemies: 3,
                saveResults: ['success', 'failure', 'failure'],
            };
            executeHandler.mockResolvedValue(expectedResult);

            const result = await triggerHolyAura(
                { name: 'Holy Aura', level: 9 },
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(result).toEqual(expectedResult);
        });
    });
});
