// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { triggerHolyAura } from './holyAuraService.js';
import { executeHandler } from '../../automation/index.js';
import { setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';

vi.mock('../../automation/index.js', () => ({
    executeHandler: vi.fn(),
}));

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
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
            it.each([
                ['spellAbilities.saveDc', basePlayerStats, 15],
                ['proficiency only', { name: 'Paladin', proficiency: 3 }, 11],
                ['no spellAbilities.saveDc', { name: 'Paladin', spellAbilities: { modifier: 4 }, proficiency: 4 }, 12],
                ['missing proficiency', { name: 'Paladin' }, NaN],
            ])('computes saveDc from %s', async (_label, stats, expectedDc) => {
                executeHandler.mockResolvedValue({ success: true });
                await callTrigger(baseSpell, {}, stats);
                expect(setRuntimeValue).toHaveBeenCalledWith(stats.name, 'holyAuraSaveDc', expectedDc, campaignName);
                expect(executeHandler).toHaveBeenCalledWith(
                    expect.objectContaining({ dc: expectedDc }),
                    stats, campaignName, mapName,
                );
            });
        });

        describe('action passed to executeHandler', () => {
            it('includes automation type holy_aura with default auraRange 30 and defaults', async () => {
                executeHandler.mockResolvedValue({ success: true });
                await callTrigger();
                expect(executeHandler).toHaveBeenCalledWith(
                    expect.objectContaining({
                        automation: expect.objectContaining({
                            type: 'holy_aura',
                            auraRange: 30,
                            duration: '1_minute',
                            casting_time: '1 action',
                        }),
                    }),
                    basePlayerStats, campaignName, mapName,
                );
            });

            it('uses custom duration and casting_time when provided', async () => {
                executeHandler.mockResolvedValue({ success: true });
                await callTrigger({ ...baseSpell, duration: '10_minutes', casting_time: '1 reaction' });
                expect(executeHandler).toHaveBeenCalledWith(
                    expect.objectContaining({
                        automation: expect.objectContaining({
                            duration: '10_minutes',
                            casting_time: '1 reaction',
                        }),
                    }),
                    basePlayerStats, campaignName, mapName,
                );
            });

            it('passes the full spell object into the action', async () => {
                executeHandler.mockResolvedValue({ success: true });
                const spell = { name: 'Holy Aura', level: 9, school: 'Abjuration' };
                await callTrigger(spell);
                expect(executeHandler).toHaveBeenCalledWith(
                    expect.objectContaining({ spell }),
                    basePlayerStats, campaignName, mapName,
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
                    basePlayerStats, campaignName, mapName,
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

            it('returns null and logs error when executeHandler returns null or throws', async () => {
                const consoleSpy = vi.spyOn(console, 'error');

                executeHandler.mockResolvedValue(null);
                let result = await callTrigger();
                expect(result).toBeNull();

                executeHandler.mockRejectedValue(new Error('Handler failed'));
                result = await callTrigger();
                expect(result).toBeNull();
                expect(consoleSpy).toHaveBeenCalledWith('[holyAura] Trigger failed:', expect.any(Error));

                consoleSpy.mockRestore();
            });
        });
    });
});
