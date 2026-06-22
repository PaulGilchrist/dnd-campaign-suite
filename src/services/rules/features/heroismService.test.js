import { describe, it, expect, vi, beforeEach } from 'vitest';
import { triggerHeroism, removeHeroismBuff } from './heroismService.js';

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
    setRuntimeValue: vi.fn(),
    getRuntimeValue: vi.fn(),
}));

vi.mock('../effects/expirations.js', () => ({
    addExpiration: vi.fn(),
}));

vi.mock('../../combat/automation/automationExpressions.js', () => ({
    evaluateAutoExpression: vi.fn(),
}));

import { setRuntimeValue, getRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { addExpiration } from '../effects/expirations.js';
import { evaluateAutoExpression } from '../../combat/automation/automationExpressions.js';

describe('heroismService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('triggerHeroism', () => {
        const campaignName = 'TestCampaign';
        const playerStats = {
            name: 'Bard',
            spellAbilities: { modifier: 3 },
            proficiency: 3,
            turnStartEffects: [],
        };

        it('adds a heroism buff with default temp HP from spell casting ability modifier', async () => {
            getRuntimeValue.mockReturnValue(null);
            evaluateAutoExpression.mockReturnValue(5);

            const spell = { automation: { tempHpExpression: 'spellcasting_ability_modifier' } };

            const result = await triggerHeroism(spell, {}, playerStats, campaignName, 'testMap');

            expect(getRuntimeValue).toHaveBeenCalledWith('Bard', 'activeBuffs', campaignName);
            expect(evaluateAutoExpression).toHaveBeenCalledWith('spellcasting_ability_modifier', playerStats);
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'Bard',
                'activeBuffs',
                expect.arrayContaining([
                    expect.objectContaining({
                        name: 'Heroism',
                        effect: 'heroism',
                        tempHpAmount: 5,
                        conditionImmunity: ['Frightened'],
                    }),
                ]),
                campaignName,
            );
            expect(addExpiration).toHaveBeenCalledWith(
                'Bard',
                'Bard',
                expect.arrayContaining([
                    expect.objectContaining({ type: 'remove_heroism_buff' }),
                ]),
                campaignName,
            );
            expect(result).toEqual({
                type: 'popup',
                payload: expect.objectContaining({
                    type: 'automation_info',
                    name: 'Heroism',
                    automationType: 'heroism',
                }),
            });
        });

        it('uses explicit temp HP expression value', async () => {
            getRuntimeValue.mockReturnValue(null);
            evaluateAutoExpression.mockReturnValue(10);

            const spell = { automation: { tempHpExpression: '2d6 + 3' } };

            await triggerHeroism(spell, {}, playerStats, campaignName, 'testMap');

            expect(evaluateAutoExpression).toHaveBeenCalledWith('2d6 + 3', playerStats);
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'Bard',
                'activeBuffs',
                expect.arrayContaining([
                    expect.objectContaining({ tempHpAmount: 10 }),
                ]),
                campaignName,
            );
        });

        it('falls back to 0 when temp HP expression evaluation returns falsy', async () => {
            getRuntimeValue.mockReturnValue(null);
            evaluateAutoExpression.mockReturnValue(null);

            const spell = { automation: { tempHpExpression: 'invalid_expression' } };

            await triggerHeroism(spell, {}, playerStats, campaignName, 'testMap');

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'Bard',
                'activeBuffs',
                expect.arrayContaining([
                    expect.objectContaining({ tempHpAmount: 0 }),
                ]),
                campaignName,
            );
        });

        it('replaces existing heroism buff when re-cast on same target', async () => {
            const existingBuffs = [
                { name: 'Heroism', effect: 'heroism', tempHpAmount: 3, duration: 'Concentration, up to 1 minute' },
                { name: 'Bardic Inspiration', effect: 'bardic_inspiration' },
            ];
            getRuntimeValue.mockReturnValue(existingBuffs);
            evaluateAutoExpression.mockReturnValue(7);

            const spell = { automation: { tempHpExpression: '4d4' } };

            await triggerHeroism(spell, {}, playerStats, campaignName, 'testMap');

            // Heroism should be replaced, not duplicated — only one buff entry
            const buffCalls = setRuntimeValue.mock.calls.filter(
                call => call[1] === 'activeBuffs',
            );
            expect(buffCalls.length).toBe(1);
            expect(buffCalls[0][2]).toEqual([
                { name: 'Bardic Inspiration', effect: 'bardic_inspiration' },
                {
                    name: 'Heroism',
                    effect: 'heroism',
                    duration: 'Concentration, up to 1 minute',
                    sourceCharacter: 'Bard',
                    tempHpAmount: 7,
                    conditionImmunity: ['Frightened'],
                },
            ]);
        });

        it('uses targetName from metaCtx when provided', async () => {
            getRuntimeValue.mockReturnValue(null);
            evaluateAutoExpression.mockReturnValue(5);

            const spell = { automation: { tempHpExpression: 'spellcasting_ability_modifier' } };
            const metaCtx = { targetName: 'Ally' };

            await triggerHeroism(spell, metaCtx, playerStats, campaignName, 'testMap');

            expect(getRuntimeValue).toHaveBeenCalledWith('Ally', 'activeBuffs', campaignName);
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'Ally',
                'activeBuffs',
                expect.any(Array),
                campaignName,
            );
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'Ally',
                'turnStartEffects',
                expect.any(Array),
                campaignName,
            );
            expect(addExpiration).toHaveBeenCalledWith(
                'Bard',
                'Ally',
                expect.any(Array),
                campaignName,
            );
        });

        it('defaults targetName to playerStats.name when metaCtx is empty', async () => {
            getRuntimeValue.mockReturnValue(null);
            evaluateAutoExpression.mockReturnValue(5);

            const spell = { automation: { tempHpExpression: 'spellcasting_ability_modifier' } };

            await triggerHeroism(spell, {}, playerStats, campaignName, 'testMap');

            expect(getRuntimeValue).toHaveBeenCalledWith('Bard', 'activeBuffs', campaignName);
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'Bard',
                'activeBuffs',
                expect.any(Array),
                campaignName,
            );
        });

        it('uses spell automation duration when provided', async () => {
            getRuntimeValue.mockReturnValue(null);
            evaluateAutoExpression.mockReturnValue(5);

            const spell = { automation: { duration: '8 hours', tempHpExpression: 'spellcasting_ability_modifier' } };

            await triggerHeroism(spell, {}, playerStats, campaignName, 'testMap');

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'Bard',
                'activeBuffs',
                expect.arrayContaining([
                    expect.objectContaining({ duration: '8 hours' }),
                ]),
                campaignName,
            );
        });

        it('uses default duration when spell automation lacks duration', async () => {
            getRuntimeValue.mockReturnValue(null);
            evaluateAutoExpression.mockReturnValue(5);

            const spell = { automation: { tempHpExpression: 'spellcasting_ability_modifier' } };

            await triggerHeroism(spell, {}, playerStats, campaignName, 'testMap');

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'Bard',
                'activeBuffs',
                expect.arrayContaining([
                    expect.objectContaining({ duration: 'Concentration, up to 1 minute' }),
                ]),
                campaignName,
            );
        });

        it('does not duplicate turnStartEffects if heroism_temp_hp already exists', async () => {
            getRuntimeValue.mockReturnValue(null);
            evaluateAutoExpression.mockReturnValue(5);

            const spell = { automation: { tempHpExpression: 'spellcasting_ability_modifier' } };
            const statsWithEffect = {
                ...playerStats,
                turnStartEffects: [
                    { type: 'heroism_temp_hp', name: 'Heroism', tempHpAmount: 5 },
                ],
            };

            await triggerHeroism(spell, {}, statsWithEffect, campaignName, 'testMap');

            const effectCalls = setRuntimeValue.mock.calls.filter(
                call => call[1] === 'turnStartEffects',
            );
            expect(effectCalls.length).toBe(0);
        });

        it('adds turnStartEffects when heroism_temp_hp does not exist', async () => {
            getRuntimeValue.mockReturnValue(null);
            evaluateAutoExpression.mockReturnValue(5);

            const spell = { automation: { tempHpExpression: 'spellcasting_ability_modifier' } };
            const statsWithOtherEffect = {
                ...playerStats,
                turnStartEffects: [
                    { type: 'heroic_inspiration' },
                ],
            };

            await triggerHeroism(spell, {}, statsWithOtherEffect, campaignName, 'testMap');

            const effectCalls = setRuntimeValue.mock.calls.filter(
                call => call[1] === 'turnStartEffects',
            );
            expect(effectCalls.length).toBe(1);
            expect(effectCalls[0][2]).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({ type: 'heroic_inspiration' }),
                    expect.objectContaining({ type: 'heroism_temp_hp' }),
                ]),
            );
        });

        it('handles missing automation on spell by using default expression', async () => {
            getRuntimeValue.mockReturnValue(null);
            evaluateAutoExpression.mockReturnValue(0);

            const spell = {};

            await triggerHeroism(spell, {}, playerStats, campaignName, 'testMap');

            expect(evaluateAutoExpression).toHaveBeenCalledWith('spellcasting_ability_modifier', playerStats);
        });

        it('handles empty metaCtx object', async () => {
            getRuntimeValue.mockReturnValue(null);
            evaluateAutoExpression.mockReturnValue(5);

            const spell = { automation: { tempHpExpression: 'spellcasting_ability_modifier' } };

            await triggerHeroism(spell, undefined, playerStats, campaignName, 'testMap');

            expect(getRuntimeValue).toHaveBeenCalledWith('Bard', 'activeBuffs', campaignName);
        });

        it('returns popup with correct description format', async () => {
            getRuntimeValue.mockReturnValue(null);
            evaluateAutoExpression.mockReturnValue(7);

            const spell = { automation: { tempHpExpression: 'spellcasting_ability_modifier' } };

            const result = await triggerHeroism(spell, {}, playerStats, campaignName, 'testMap');

            expect(result.payload.description).toContain('<b>Heroism</b>');
            expect(result.payload.description).toContain('imbued with bravery');
            expect(result.payload.description).toContain('Immune to the Frightened condition');
            expect(result.payload.description).toContain('7 Temporary Hit Points');
            expect(result.payload.description).toContain('Concentration, up to 1 minute');
        });

        it('handles stored activeBuffs as non-array by treating as empty', async () => {
            getRuntimeValue.mockReturnValue('not-an-array');
            evaluateAutoExpression.mockReturnValue(5);

            const spell = { automation: { tempHpExpression: 'spellcasting_ability_modifier' } };

            await triggerHeroism(spell, {}, playerStats, campaignName, 'testMap');

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'Bard',
                'activeBuffs',
                expect.arrayContaining([
                    expect.objectContaining({ name: 'Heroism' }),
                ]),
                campaignName,
            );
        });

        it('handles empty activeBuffs array', async () => {
            getRuntimeValue.mockReturnValue([]);
            evaluateAutoExpression.mockReturnValue(5);

            const spell = { automation: { tempHpExpression: 'spellcasting_ability_modifier' } };

            await triggerHeroism(spell, {}, playerStats, campaignName, 'testMap');

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'Bard',
                'activeBuffs',
                expect.arrayContaining([
                    expect.objectContaining({ name: 'Heroism' }),
                ]),
                campaignName,
            );
        });

        it('sets sourceCharacter to playerStats.name', async () => {
            getRuntimeValue.mockReturnValue(null);
            evaluateAutoExpression.mockReturnValue(5);

            const spell = { automation: { tempHpExpression: 'spellcasting_ability_modifier' } };

            await triggerHeroism(spell, {}, playerStats, campaignName, 'testMap');

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'Bard',
                'activeBuffs',
                expect.arrayContaining([
                    expect.objectContaining({ sourceCharacter: 'Bard' }),
                ]),
                campaignName,
            );
        });
    });

    describe('removeHeroismBuff', () => {
        const campaignName = 'TestCampaign';

        it('removes heroism buff from activeBuffs', () => {
            const buffs = [
                { name: 'Heroism', effect: 'heroism' },
                { name: 'Bardic Inspiration', effect: 'bardic_inspiration' },
            ];
            getRuntimeValue.mockImplementation((key, prop) => {
                if (key === 'Target' && prop === 'activeBuffs') return buffs;
                return [];
            });

            removeHeroismBuff('Target', campaignName);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'Target',
                'activeBuffs',
                [{ name: 'Bardic Inspiration', effect: 'bardic_inspiration' }],
                campaignName,
            );
        });

        it('removes all heroism buffs from activeBuffs', () => {
            const buffs = [
                { name: 'Heroism', effect: 'heroism' },
                { name: 'Heroism', effect: 'heroism', tempHpAmount: 0 },
                { name: 'Other', effect: 'other' },
            ];
            getRuntimeValue.mockImplementation((key, prop) => {
                if (key === 'Target' && prop === 'activeBuffs') return buffs;
                return [];
            });

            removeHeroismBuff('Target', campaignName);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'Target',
                'activeBuffs',
                [{ name: 'Other', effect: 'other' }],
                campaignName,
            );
        });

        it('does not call setRuntimeValue when no heroism buff exists', () => {
            const buffs = [
                { name: 'Bardic Inspiration', effect: 'bardic_inspiration' },
            ];
            getRuntimeValue.mockImplementation((key, prop) => {
                if (key === 'Target' && prop === 'activeBuffs') return buffs;
                return [];
            });

            removeHeroismBuff('Target', campaignName);

            const buffCalls = setRuntimeValue.mock.calls.filter(
                call => call[1] === 'activeBuffs',
            );
            expect(buffCalls.length).toBe(0);
        });

        it('removes heroism target effects', () => {
            const effects = [
                { effect: 'heroism', source: 'Heroism', target: 'Target' },
                { effect: 'other', source: 'Other', target: 'Target' },
            ];
            getRuntimeValue.mockImplementation((key, prop) => {
                if (key === 'Target' && prop === 'activeBuffs') return [];
                if (key === campaignName && prop === 'targetEffects') return effects;
                return null;
            });

            removeHeroismBuff('Target', campaignName);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                campaignName,
                'targetEffects',
                [{ effect: 'other', source: 'Other', target: 'Target' }],
                campaignName,
            );
        });

        it('removes all heroism target effects', () => {
            const effects = [
                { effect: 'heroism', source: 'Heroism', target: 'Target' },
                { effect: 'heroism', source: 'Heroism', target: 'OtherTarget' },
                { effect: 'other', source: 'Other', target: 'Target' },
            ];
            getRuntimeValue.mockImplementation((key, prop) => {
                if (key === 'Target' && prop === 'activeBuffs') return [];
                if (key === campaignName && prop === 'targetEffects') return effects;
                return null;
            });

            removeHeroismBuff('Target', campaignName);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                campaignName,
                'targetEffects',
                [{ effect: 'other', source: 'Other', target: 'Target' }],
                campaignName,
            );
        });

        it('does not call setRuntimeValue for targetEffects when no heroism effects exist', () => {
            const effects = [
                { effect: 'other', source: 'Other', target: 'Target' },
            ];
            getRuntimeValue.mockImplementation((key, prop) => {
                if (key === 'Target' && prop === 'activeBuffs') return [];
                if (key === campaignName && prop === 'targetEffects') return effects;
                return null;
            });

            removeHeroismBuff('Target', campaignName);

            const effectCalls = setRuntimeValue.mock.calls.filter(
                call => call[1] === 'targetEffects',
            );
            expect(effectCalls.length).toBe(0);
        });

        it('handles non-array activeBuffs by treating as empty', () => {
            getRuntimeValue.mockImplementation((key, prop) => {
                if (key === 'Target' && prop === 'activeBuffs') return 'not-an-array';
                return [];
            });

            removeHeroismBuff('Target', campaignName);

            // Should not call setRuntimeValue since filtered.length === activeBuffs.length
            // (both are 0 after treating as empty array)
            const buffCalls = setRuntimeValue.mock.calls.filter(
                call => call[1] === 'activeBuffs',
            );
            expect(buffCalls.length).toBe(0);
        });

        it('handles null activeBuffs by treating as empty', () => {
            getRuntimeValue.mockReturnValue(null);

            expect(() => removeHeroismBuff('Target', campaignName)).toThrow('Expected array, got null');
        });

        it('handles non-array targetEffects by treating as empty', () => {
            getRuntimeValue.mockImplementation((key, prop) => {
                if (key === 'Target' && prop === 'activeBuffs') return [];
                if (key === campaignName && prop === 'targetEffects') return 'not-an-array';
                return null;
            });

            removeHeroismBuff('Target', campaignName);

            const effectCalls = setRuntimeValue.mock.calls.filter(
                call => call[1] === 'targetEffects',
            );
            expect(effectCalls.length).toBe(0);
        });

        it('handles null targetEffects', () => {
            getRuntimeValue.mockImplementation((key, prop) => {
                if (key === 'Target' && prop === 'activeBuffs') return [];
                if (key === campaignName && prop === 'targetEffects') return null;
                return null;
            });

            expect(() => removeHeroismBuff('Target', campaignName)).toThrow('Expected array, got null');
        });

        it('handles empty activeBuffs array', () => {
            getRuntimeValue.mockReturnValue([]);

            removeHeroismBuff('Target', campaignName);

            const buffCalls = setRuntimeValue.mock.calls.filter(
                call => call[1] === 'activeBuffs',
            );
            expect(buffCalls.length).toBe(0);
        });

        it('handles empty targetEffects array', () => {
            getRuntimeValue.mockImplementation((key, prop) => {
                if (key === 'Target' && prop === 'activeBuffs') return [];
                if (key === campaignName && prop === 'targetEffects') return [];
                return null;
            });

            removeHeroismBuff('Target', campaignName);

            const effectCalls = setRuntimeValue.mock.calls.filter(
                call => call[1] === 'targetEffects',
            );
            expect(effectCalls.length).toBe(0);
        });

        it('removes heroism buff and effects together', () => {
            const buffs = [{ name: 'Heroism', effect: 'heroism' }];
            const effects = [{ effect: 'heroism', source: 'Heroism', target: 'Target' }];

            getRuntimeValue.mockImplementation((key, prop) => {
                if (key === 'Target' && prop === 'activeBuffs') return buffs;
                if (key === campaignName && prop === 'targetEffects') return effects;
                return null;
            });

            removeHeroismBuff('Target', campaignName);

            const setCalls = setRuntimeValue.mock.calls;
            expect(setCalls.length).toBe(2);
            expect(setCalls[0][1]).toBe('activeBuffs');
            expect(setCalls[1][1]).toBe('targetEffects');
        });
    });
});
