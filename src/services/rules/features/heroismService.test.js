// @improved-by-ai
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
    const campaignName = 'TestCampaign';
    const mapName = 'testMap';
    const playerStats = {
        name: 'Bard',
        spellAbilities: { modifier: 3 },
        proficiency: 3,
        turnStartEffects: [],
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('triggerHeroism', () => {
        const makeSpell = (overrides = {}) => ({
            automation: { tempHpExpression: 'spellcasting_ability_modifier', ...overrides },
        });

        it('adds a heroism buff with temp HP from spellcasting ability modifier', async () => {
            getRuntimeValue.mockReturnValue(null);
            evaluateAutoExpression.mockReturnValue(5);

            const result = await triggerHeroism(makeSpell(), {}, playerStats, campaignName, mapName);

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

        it('evaluates an explicit temp HP expression when provided', async () => {
            getRuntimeValue.mockReturnValue(null);
            evaluateAutoExpression.mockReturnValue(10);

            await triggerHeroism(makeSpell({ tempHpExpression: '2d6 + 3' }), {}, playerStats, campaignName, mapName);

            expect(evaluateAutoExpression).toHaveBeenCalledWith('2d6 + 3', playerStats);
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'Bard',
                'activeBuffs',
                expect.arrayContaining([expect.objectContaining({ tempHpAmount: 10 })]),
                campaignName,
            );
        });

        it('uses 0 when temp HP expression evaluates to falsy', async () => {
            getRuntimeValue.mockReturnValue(null);
            evaluateAutoExpression.mockReturnValue(null);

            await triggerHeroism(makeSpell({ tempHpExpression: 'invalid' }), {}, playerStats, campaignName, mapName);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'Bard',
                'activeBuffs',
                expect.arrayContaining([expect.objectContaining({ tempHpAmount: 0 })]),
                campaignName,
            );
        });

        it('replaces existing heroism buff on re-cast', async () => {
            const existingBuffs = [
                { name: 'Heroism', effect: 'heroism', tempHpAmount: 3 },
                { name: 'Bardic Inspiration', effect: 'bardic_inspiration' },
            ];
            getRuntimeValue.mockReturnValue(existingBuffs);
            evaluateAutoExpression.mockReturnValue(7);

            await triggerHeroism(makeSpell({ tempHpExpression: '4d4' }), {}, playerStats, campaignName, mapName);

            const buffCalls = setRuntimeValue.mock.calls.filter(call => call[1] === 'activeBuffs');
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

        it('targets a different character when metaCtx.targetName is provided', async () => {
            getRuntimeValue.mockReturnValue(null);
            evaluateAutoExpression.mockReturnValue(5);

            await triggerHeroism(makeSpell(), { targetName: 'Ally' }, playerStats, campaignName, mapName);

            expect(getRuntimeValue).toHaveBeenCalledWith('Ally', 'activeBuffs', campaignName);
            expect(setRuntimeValue).toHaveBeenNthCalledWith(
                1,
                'Ally',
                'activeBuffs',
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

        it('defaults target to caster when metaCtx is empty', async () => {
            getRuntimeValue.mockReturnValue(null);
            evaluateAutoExpression.mockReturnValue(5);

            await triggerHeroism(makeSpell(), {}, playerStats, campaignName, mapName);

            expect(getRuntimeValue).toHaveBeenCalledWith('Bard', 'activeBuffs', campaignName);
        });

        it('defaults target to caster when metaCtx is null', async () => {
            getRuntimeValue.mockReturnValue(null);
            evaluateAutoExpression.mockReturnValue(5);

            await triggerHeroism(makeSpell(), null, playerStats, campaignName, mapName);

            expect(getRuntimeValue).toHaveBeenCalledWith('Bard', 'activeBuffs', campaignName);
        });

        it('uses spell automation duration when provided', async () => {
            getRuntimeValue.mockReturnValue(null);
            evaluateAutoExpression.mockReturnValue(5);

            await triggerHeroism(makeSpell({ duration: '8 hours' }), {}, playerStats, campaignName, mapName);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'Bard',
                'activeBuffs',
                expect.arrayContaining([expect.objectContaining({ duration: '8 hours' })]),
                campaignName,
            );
        });

        it('uses default duration when automation lacks duration', async () => {
            getRuntimeValue.mockReturnValue(null);
            evaluateAutoExpression.mockReturnValue(5);

            await triggerHeroism(makeSpell({}), {}, playerStats, campaignName, mapName);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'Bard',
                'activeBuffs',
                expect.arrayContaining([expect.objectContaining({ duration: 'Concentration, up to 1 minute' })]),
                campaignName,
            );
        });

        it('skips turnStartEffects when heroism_temp_hp already exists', async () => {
            getRuntimeValue.mockReturnValue(null);
            evaluateAutoExpression.mockReturnValue(5);

            const statsWithEffect = {
                ...playerStats,
                turnStartEffects: [{ type: 'heroism_temp_hp', name: 'Heroism', tempHpAmount: 5 }],
            };

            await triggerHeroism(makeSpell(), {}, statsWithEffect, campaignName, mapName);

            const effectCalls = setRuntimeValue.mock.calls.filter(call => call[1] === 'turnStartEffects');
            expect(effectCalls.length).toBe(0);
        });

        it('adds turnStartEffects when heroism_temp_hp is absent', async () => {
            getRuntimeValue.mockReturnValue(null);
            evaluateAutoExpression.mockReturnValue(5);

            const statsWithOtherEffect = {
                ...playerStats,
                turnStartEffects: [{ type: 'heroic_inspiration' }],
            };

            await triggerHeroism(makeSpell(), {}, statsWithOtherEffect, campaignName, mapName);

            const effectCalls = setRuntimeValue.mock.calls.filter(call => call[1] === 'turnStartEffects');
            expect(effectCalls.length).toBe(1);
            expect(effectCalls[0][2]).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({ type: 'heroic_inspiration' }),
                    expect.objectContaining({ type: 'heroism_temp_hp' }),
                ]),
            );
        });

        it('uses default expression when spell has no automation', async () => {
            getRuntimeValue.mockReturnValue(null);
            evaluateAutoExpression.mockReturnValue(0);

            await triggerHeroism({}, {}, playerStats, campaignName, mapName);

            expect(evaluateAutoExpression).toHaveBeenCalledWith('spellcasting_ability_modifier', playerStats);
        });

        it('uses default expression when automation lacks tempHpExpression', async () => {
            getRuntimeValue.mockReturnValue(null);
            evaluateAutoExpression.mockReturnValue(0);

            await triggerHeroism({ automation: { duration: '1 hour' } }, {}, playerStats, campaignName, mapName);

            expect(evaluateAutoExpression).toHaveBeenCalledWith('spellcasting_ability_modifier', playerStats);
        });

        it('returns popup with description containing key details', async () => {
            getRuntimeValue.mockReturnValue(null);
            evaluateAutoExpression.mockReturnValue(7);

            const result = await triggerHeroism(makeSpell(), {}, playerStats, campaignName, mapName);

            expect(result.payload.description).toContain('<b>Heroism</b>');
            expect(result.payload.description).toContain('imbued with bravery');
            expect(result.payload.description).toContain('Immune to the Frightened condition');
            expect(result.payload.description).toContain('7 Temporary Hit Points');
            expect(result.payload.description).toContain('Concentration, up to 1 minute');
        });

        it('treats non-array activeBuffs as empty', async () => {
            getRuntimeValue.mockReturnValue('not-an-array');
            evaluateAutoExpression.mockReturnValue(5);

            await triggerHeroism(makeSpell(), {}, playerStats, campaignName, mapName);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'Bard',
                'activeBuffs',
                expect.arrayContaining([expect.objectContaining({ name: 'Heroism' })]),
                campaignName,
            );
        });

        it('sets sourceCharacter to caster name', async () => {
            getRuntimeValue.mockReturnValue(null);
            evaluateAutoExpression.mockReturnValue(5);

            await triggerHeroism(makeSpell(), {}, playerStats, campaignName, mapName);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'Bard',
                'activeBuffs',
                expect.arrayContaining([expect.objectContaining({ sourceCharacter: 'Bard' })]),
                campaignName,
            );
        });

        it('ignores the mapName parameter', async () => {
            getRuntimeValue.mockReturnValue(null);
            evaluateAutoExpression.mockReturnValue(5);

            await triggerHeroism(makeSpell(), {}, playerStats, campaignName, mapName);

            // Verify the internal logic does not pass mapName to any mocked function
            for (const call of setRuntimeValue.mock.calls) {
                expect(call).not.toContainEqual(mapName);
            }
            expect(addExpiration).not.toHaveBeenCalledWith(
                expect.any(String),
                expect.any(String),
                expect.any(Array),
                expect.any(String),
                mapName,
            );
        });
    });

    describe('removeHeroismBuff', () => {
        it('removes heroism buffs while preserving other buffs', () => {
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

        it('skips setRuntimeValue when no heroism buff exists', () => {
            const buffs = [{ name: 'Bardic Inspiration', effect: 'bardic_inspiration' }];
            getRuntimeValue.mockImplementation((key, prop) => {
                if (key === 'Target' && prop === 'activeBuffs') return buffs;
                return [];
            });

            removeHeroismBuff('Target', campaignName);

            const buffCalls = setRuntimeValue.mock.calls.filter(call => call[1] === 'activeBuffs');
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

        it('skips setRuntimeValue when no heroism target effects exist', () => {
            const effects = [{ effect: 'other', source: 'Other', target: 'Target' }];
            getRuntimeValue.mockImplementation((key, prop) => {
                if (key === 'Target' && prop === 'activeBuffs') return [];
                if (key === campaignName && prop === 'targetEffects') return effects;
                return null;
            });

            removeHeroismBuff('Target', campaignName);

            const effectCalls = setRuntimeValue.mock.calls.filter(call => call[1] === 'targetEffects');
            expect(effectCalls.length).toBe(0);
        });

        it('removes both heroism buff and effects in one call', () => {
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

        it('treats non-array activeBuffs as empty without error', () => {
            getRuntimeValue.mockImplementation((key, prop) => {
                if (key === 'Target' && prop === 'activeBuffs') return 'not-an-array';
                return [];
            });

            removeHeroismBuff('Target', campaignName);

            const buffCalls = setRuntimeValue.mock.calls.filter(call => call[1] === 'activeBuffs');
            expect(buffCalls.length).toBe(0);
        });

        it('throws when targetEffects is null', () => {
            getRuntimeValue.mockImplementation((key, prop) => {
                if (key === 'Target' && prop === 'activeBuffs') return [];
                if (key === campaignName && prop === 'targetEffects') return null;
                return null;
            });

            expect(() => removeHeroismBuff('Target', campaignName)).toThrow('Expected array, got null');
        });

        it('treats non-array targetEffects as empty', () => {
            getRuntimeValue.mockImplementation((key, prop) => {
                if (key === 'Target' && prop === 'activeBuffs') return [];
                if (key === campaignName && prop === 'targetEffects') return 'not-an-array';
                return null;
            });

            removeHeroismBuff('Target', campaignName);

            const effectCalls = setRuntimeValue.mock.calls.filter(call => call[1] === 'targetEffects');
            expect(effectCalls.length).toBe(0);
        });

        it('skips setRuntimeValue when activeBuffs is empty', () => {
            getRuntimeValue.mockReturnValue([]);

            removeHeroismBuff('Target', campaignName);

            const buffCalls = setRuntimeValue.mock.calls.filter(call => call[1] === 'activeBuffs');
            expect(buffCalls.length).toBe(0);
        });

        it('skips setRuntimeValue when targetEffects is empty', () => {
            getRuntimeValue.mockImplementation((key, prop) => {
                if (key === 'Target' && prop === 'activeBuffs') return [];
                if (key === campaignName && prop === 'targetEffects') return [];
                return null;
            });

            removeHeroismBuff('Target', campaignName);

            const effectCalls = setRuntimeValue.mock.calls.filter(call => call[1] === 'targetEffects');
            expect(effectCalls.length).toBe(0);
        });
    });
});
