// @improved-by-ai
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
        const basePlayerStats = {
            name: 'Paladin',
            spellAbilities: { saveDc: 15, modifier: 4, spellCastingAbility: 'Charisma', toHit: 9 },
            proficiency: 4,
        };
        const baseSpell = { name: 'Holy Aura', level: 9 };

        function callTrigger(spell = baseSpell, metaCtx = {}, stats = basePlayerStats) {
            return triggerHolyAura(spell, metaCtx, stats, campaignName, mapName);
        }

        describe('save DC computation', () => {
            it('uses spellAbilities.saveDc when provided', async () => {
                executeHandler.mockResolvedValue({ success: true });

                await callTrigger();

                expect(setRuntimeValue).toHaveBeenCalledWith(
                    basePlayerStats.name,
                    'holyAuraSaveDc',
                    15,
                    campaignName,
                );
                expect(executeHandler).toHaveBeenCalledWith(
                    expect.objectContaining({ dc: 15 }),
                    basePlayerStats,
                    campaignName,
                    mapName,
                );
            });

            it('computes 8 + proficiency when spellAbilities.saveDc is missing', async () => {
                executeHandler.mockResolvedValue({ success: true });
                const stats = { name: 'Paladin', proficiency: 3 };

                await callTrigger(baseSpell, {}, stats);

                expect(setRuntimeValue).toHaveBeenCalledWith(
                    stats.name,
                    'holyAuraSaveDc',
                    11,
                    campaignName,
                );
                expect(executeHandler).toHaveBeenCalledWith(
                    expect.objectContaining({ dc: 11 }),
                    stats,
                    campaignName,
                    mapName,
                );
            });

            it('computes 8 + proficiency when spellAbilities is undefined', async () => {
                executeHandler.mockResolvedValue({ success: true });
                const stats = { name: 'Paladin', proficiency: 5 };

                await callTrigger(baseSpell, {}, stats);

                expect(setRuntimeValue).toHaveBeenCalledWith(
                    stats.name,
                    'holyAuraSaveDc',
                    13,
                    campaignName,
                );
                expect(executeHandler).toHaveBeenCalledWith(
                    expect.objectContaining({ dc: 13 }),
                    stats,
                    campaignName,
                    mapName,
                );
            });

            it('falls back to 8 + proficiency when spellAbilities.saveDc is undefined', async () => {
                executeHandler.mockResolvedValue({ success: true });
                const stats = {
                    name: 'Paladin',
                    spellAbilities: { modifier: 4 },
                    proficiency: 4,
                };

                await callTrigger(baseSpell, {}, stats);

                expect(setRuntimeValue).toHaveBeenCalledWith(
                    stats.name,
                    'holyAuraSaveDc',
                    12,
                    campaignName,
                );
            });

            it('produces NaN when proficiency is missing', async () => {
                executeHandler.mockResolvedValue({ success: true });
                const stats = { name: 'Paladin' };

                await callTrigger(baseSpell, {}, stats);

                expect(setRuntimeValue).toHaveBeenCalledWith(
                    stats.name,
                    'holyAuraSaveDc',
                    NaN,
                    campaignName,
                );
            });
        });

        describe('action passed to executeHandler', () => {
            it('includes automation type holy_aura with default auraRange 30', async () => {
                executeHandler.mockResolvedValue({ success: true });

                await callTrigger();

                expect(executeHandler).toHaveBeenCalledWith(
                    expect.objectContaining({
                        automation: expect.objectContaining({
                            type: 'holy_aura',
                            auraRange: 30,
                        }),
                    }),
                    basePlayerStats,
                    campaignName,
                    mapName,
                );
            });

            it('includes spell duration when provided', async () => {
                executeHandler.mockResolvedValue({ success: true });

                await callTrigger({ ...baseSpell, duration: '10_minutes' });

                expect(executeHandler).toHaveBeenCalledWith(
                    expect.objectContaining({
                        automation: expect.objectContaining({
                            duration: '10_minutes',
                        }),
                    }),
                    basePlayerStats,
                    campaignName,
                    mapName,
                );
            });

            it('uses default duration 1_minute when spell.duration is missing', async () => {
                executeHandler.mockResolvedValue({ success: true });

                await callTrigger();

                expect(executeHandler).toHaveBeenCalledWith(
                    expect.objectContaining({
                        automation: expect.objectContaining({
                            duration: '1_minute',
                        }),
                    }),
                    basePlayerStats,
                    campaignName,
                    mapName,
                );
            });

            it('includes spell casting_time when provided', async () => {
                executeHandler.mockResolvedValue({ success: true });

                await callTrigger({ ...baseSpell, casting_time: '1 reaction' });

                expect(executeHandler).toHaveBeenCalledWith(
                    expect.objectContaining({
                        automation: expect.objectContaining({
                            casting_time: '1 reaction',
                        }),
                    }),
                    basePlayerStats,
                    campaignName,
                    mapName,
                );
            });

            it('uses default casting_time 1_action when spell.casting_time is missing', async () => {
                executeHandler.mockResolvedValue({ success: true });

                await callTrigger();

                expect(executeHandler).toHaveBeenCalledWith(
                    expect.objectContaining({
                        automation: expect.objectContaining({
                            casting_time: '1 action',
                        }),
                    }),
                    basePlayerStats,
                    campaignName,
                    mapName,
                );
            });

            it('passes the full spell object into the action', async () => {
                executeHandler.mockResolvedValue({ success: true });
                const spell = { name: 'Holy Aura', level: 9, school: 'Abjuration' };

                await callTrigger(spell);

                expect(executeHandler).toHaveBeenCalledWith(
                    expect.objectContaining({ spell }),
                    basePlayerStats,
                    campaignName,
                    mapName,
                );
            });

            it('passes campaignName and mapName to executeHandler', async () => {
                executeHandler.mockResolvedValue({ success: true });

                await callTrigger();

                expect(executeHandler).toHaveBeenCalledWith(
                    expect.any(Object),
                    basePlayerStats,
                    campaignName,
                    mapName,
                );
            });

            it('handles empty spell object with defaults', async () => {
                executeHandler.mockResolvedValue({ success: true });

                await callTrigger({}, {});

                expect(executeHandler).toHaveBeenCalledWith(
                    expect.objectContaining({
                        name: 'Holy Aura',
                        automation: expect.objectContaining({
                            duration: '1_minute',
                            casting_time: '1 action',
                            auraRange: 30,
                        }),
                    }),
                    basePlayerStats,
                    campaignName,
                    mapName,
                );
            });
        });

        describe('return value', () => {
            it('returns executeHandler result on success', async () => {
                const expectedResult = {
                    type: 'popup',
                    payload: { type: 'automation_info', name: 'Holy Aura', description: 'A protective aura...' },
                };
                executeHandler.mockResolvedValue(expectedResult);

                const result = await callTrigger();

                expect(result).toBe(expectedResult);
            });

            it('returns executeHandler result without modification', async () => {
                const expectedResult = {
                    success: true,
                    affectedEnemies: 3,
                    saveResults: ['success', 'failure', 'failure'],
                };
                executeHandler.mockResolvedValue(expectedResult);

                const result = await callTrigger();

                expect(result).toEqual(expectedResult);
            });

            it('returns null when executeHandler returns null', async () => {
                executeHandler.mockResolvedValue(null);

                const result = await callTrigger();

                expect(result).toBeNull();
            });

            it('returns null and logs error when executeHandler throws', async () => {
                executeHandler.mockRejectedValue(new Error('Handler failed'));
                const consoleSpy = vi.spyOn(console, 'error');

                const result = await callTrigger();

                expect(result).toBeNull();
                expect(consoleSpy).toHaveBeenCalledWith(
                    '[holyAura] Trigger failed:',
                    expect.any(Error),
                );
                consoleSpy.mockRestore();
            });
        });
    });
});
