// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handle, applyHeroism, removeHeroismBuff, isHeroismActive } from './heroismService.js';

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
    setRuntimeValue: vi.fn(),
    getRuntimeValue: vi.fn(),
}));

vi.mock('../effects/expirations.js', () => ({
    addExpiration: vi.fn(),
}));

vi.mock('../../../services/ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../services/encounters/combatData.js', () => ({
    getCombatSummary: vi.fn(() => null),
}));

vi.mock('../../../services/combat/concentration/concentrationService.js', () => ({
    addConcentration: vi.fn(),
}));

vi.mock('../../../services/automation/handlers/buffs/tempHpService.js', () => ({
    setTempHp: vi.fn(),
}));

import { setRuntimeValue, getRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { addExpiration } from '../effects/expirations.js';
import { addEntry } from '../../../services/ui/logService.js';
import { getCombatSummary } from '../../../services/encounters/combatData.js';
import { addConcentration } from '../../../services/combat/concentration/concentrationService.js';

const CAMPAIGN_NAME = 'TestCampaign';
const MAP_NAME = 'testMap';

const PLAYER_STATS = {
    name: 'Bard',
    spellAbilities: { modifier: 3, saveDc: 13 },
    proficiency: 3,
    turnStartEffects: [],
};

const makeSpell = (overrides = {}) => ({
    name: 'Heroism',
    level: 1,
    casting_time: 'Action',
    range: 'Touch',
    automation: { type: 'heroism', tempHpExpression: 'spellcasting_ability_modifier', duration: 'Concentration, up to 1 minute', ...overrides },
});

describe('heroismService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('handle', () => {
        it('returns target selection popup with creature targets', () => {
            getCombatSummary.mockReturnValue({
                creatures: [
                    { name: 'Bard' },
                    { name: 'Fighter' },
                    { name: 'Rogue' },
                ],
            });

            const result = handle({ name: 'Heroism', spell: makeSpell() }, PLAYER_STATS, CAMPAIGN_NAME, MAP_NAME);

            expect(result).toEqual({
                type: 'popup',
                payload: expect.objectContaining({
                    type: 'heroism_target_selection',
                    name: 'Heroism',
                    creatureTargets: ['Bard', 'Fighter', 'Rogue'],
                    range: 'Touch',
                    duration: 'Concentration, up to 1 minute',
                }),
            });
        });

        it('returns empty creature targets when no combat summary', () => {
            getCombatSummary.mockReturnValue(null);

            const result = handle({ name: 'Heroism', spell: makeSpell() }, PLAYER_STATS, CAMPAIGN_NAME, MAP_NAME);

            expect(result.payload.creatureTargets).toEqual([]);
        });
    });

    describe('applyHeroism', () => {
        it('applies heroism to a single target with correct buff', async () => {
            getRuntimeValue.mockReturnValue(null);

            const result = await applyHeroism(
                { name: 'Heroism', spell: makeSpell() },
                PLAYER_STATS,
                CAMPAIGN_NAME,
                MAP_NAME,
                ['Fighter']
            );

            expect(getRuntimeValue).toHaveBeenCalledWith('Fighter', 'activeBuffs', CAMPAIGN_NAME);

            const buffCalls = setRuntimeValue.mock.calls.filter(call => call[1] === 'activeBuffs');
            expect(buffCalls.length).toBe(1);
            expect(buffCalls[0][2]).toEqual([
                expect.objectContaining({
                    name: 'Heroism',
                    effect: 'heroism',
                    duration: 'Concentration, up to 1 minute',
                    sourceCharacter: 'Bard',
                    tempHpAmount: 3,
                    conditionImmunity: ['Frightened'],
                }),
            ]);

            expect(addExpiration).toHaveBeenCalledWith({ attackerName: 'Bard', targetName: 'Fighter', effects: expect.arrayContaining([
                    expect.objectContaining({ type: 'remove_heroism_buff' }),
                ]), campaignName: CAMPAIGN_NAME });

            expect(addEntry).toHaveBeenCalledWith(CAMPAIGN_NAME, expect.objectContaining({
                type: 'ability_use',
                characterName: 'Bard',
                abilityName: 'Heroism',
                description: expect.stringContaining('Bard cast Heroism on Fighter'),
            }));

            expect(result).toEqual({
                type: 'popup',
                payload: expect.objectContaining({
                    type: 'automation_info',
                    name: 'Heroism',
                    description: expect.stringContaining('Fighter gained Heroism'),
                }),
            });
        });

        it('registers targetEffect for the heroism effect', async () => {
            getRuntimeValue.mockReturnValue([]);

            await applyHeroism(
                { name: 'Heroism', spell: makeSpell() },
                PLAYER_STATS,
                CAMPAIGN_NAME,
                MAP_NAME,
                ['Fighter']
            );

            const effectCalls = setRuntimeValue.mock.calls.filter(call => call[1] === 'targetEffects');
            expect(effectCalls.length).toBeGreaterThanOrEqual(1);
            const lastEffectCall = effectCalls[effectCalls.length - 1];
            const effects = lastEffectCall[2];
            expect(effects).toContainEqual({
                target: 'Fighter',
                effect: 'heroism',
                source: 'Heroism',
                duration: 'concentration',
            });
        });

        it('registers wisdom_save_advantage targetEffect for WIS save advantage', async () => {
            getRuntimeValue.mockReturnValue([]);

            await applyHeroism(
                { name: 'Heroism', spell: makeSpell() },
                PLAYER_STATS,
                CAMPAIGN_NAME,
                MAP_NAME,
                ['Fighter']
            );

            const effectCalls = setRuntimeValue.mock.calls.filter(call => call[1] === 'targetEffects');
            expect(effectCalls.length).toBeGreaterThanOrEqual(1);
            const lastEffectCall = effectCalls[effectCalls.length - 1];
            const effects = lastEffectCall[2];
            expect(effects).toContainEqual({
                target: 'Fighter',
                effect: 'wisdom_save_advantage',
                source: 'Heroism',
                duration: 'concentration',
            });
        });

        it('adds turnStartEffects for heroism temp HP', async () => {
            getRuntimeValue.mockReturnValue(null);

            await applyHeroism(
                { name: 'Heroism', spell: makeSpell() },
                PLAYER_STATS,
                CAMPAIGN_NAME,
                MAP_NAME,
                ['Fighter']
            );

            const effectCalls = setRuntimeValue.mock.calls.filter(call => call[1] === 'turnStartEffects');
            expect(effectCalls.length).toBe(1);
            expect(effectCalls[0][2]).toEqual([
                expect.objectContaining({
                    type: 'heroism_temp_hp',
                    name: 'Heroism',
                    tempHpAmount: 3,
                }),
            ]);
        });

        it('registers concentration when combatSummary is available', async () => {
            getRuntimeValue.mockReturnValue(null);
            getCombatSummary.mockReturnValue({ creatures: [{ name: 'Bard' }] });
            window.dispatchEvent = vi.fn();

            await applyHeroism(
                { name: 'Heroism', spell: makeSpell() },
                PLAYER_STATS,
                CAMPAIGN_NAME,
                MAP_NAME,
                ['Fighter']
            );

            expect(addConcentration).toHaveBeenCalledWith(
                expect.objectContaining({ creatures: [{ name: 'Bard' }] }),
                'Bard',
                'Heroism',
                13,
                'Fighter'
            );
            expect(window.dispatchEvent).toHaveBeenCalledWith(new CustomEvent('combat-summary-updated'));
        });

        it('handles multiple targets', async () => {
            getRuntimeValue.mockReturnValue(null);

            const result = await applyHeroism(
                { name: 'Heroism', spell: makeSpell() },
                PLAYER_STATS,
                CAMPAIGN_NAME,
                MAP_NAME,
                ['Fighter', 'Rogue']
            );

            const buffCalls = setRuntimeValue.mock.calls.filter(call => call[1] === 'activeBuffs');
            expect(buffCalls.length).toBe(2);

            expect(result.payload.description).toContain('2 targets');
            expect(result.payload.description).toContain('Fighter, Rogue');
        });

        it('replaces existing heroism buff on re-cast', async () => {
            const existingBuffs = [
                { name: 'Heroism', effect: 'heroism', tempHpAmount: 2 },
                { name: 'Bardic Inspiration', effect: 'bardic_inspiration' },
            ];
            getRuntimeValue.mockImplementation((key, prop) => {
                if (key === 'Fighter' && prop === 'activeBuffs') return existingBuffs;
                return [];
            });

            await applyHeroism(
                { name: 'Heroism', spell: makeSpell({ tempHpExpression: 'spellcasting_ability_modifier' }) },
                PLAYER_STATS,
                CAMPAIGN_NAME,
                MAP_NAME,
                ['Fighter']
            );

            const buffCalls = setRuntimeValue.mock.calls.filter(call => call[1] === 'activeBuffs');
            expect(buffCalls.length).toBe(1);
            expect(buffCalls[0][2]).toEqual([
                { name: 'Bardic Inspiration', effect: 'bardic_inspiration' },
                expect.objectContaining({
                    name: 'Heroism',
                    tempHpAmount: 3,
                }),
            ]);
        });

        it('returns null when no targets provided', async () => {
            const result = await applyHeroism(
                { name: 'Heroism', spell: makeSpell() },
                PLAYER_STATS,
                CAMPAIGN_NAME,
                MAP_NAME,
                []
            );

            expect(result).toBeNull();
        });

        it('uses 0 temp HP when spellcasting ability modifier is 0', async () => {
            getRuntimeValue.mockReturnValue(null);
            const zeroModStats = { ...PLAYER_STATS, spellAbilities: { modifier: 0, saveDc: 10 } };

            await applyHeroism(
                { name: 'Heroism', spell: makeSpell() },
                zeroModStats,
                CAMPAIGN_NAME,
                MAP_NAME,
                ['Fighter']
            );

            const buffCalls = setRuntimeValue.mock.calls.filter(call => call[1] === 'activeBuffs');
            expect(buffCalls[0][2][0].tempHpAmount).toBe(0);
        });

        it('skips turnStartEffects when already present', async () => {
            getRuntimeValue.mockImplementation((key, prop) => {
                if (key === 'Fighter' && prop === 'activeBuffs') return [];
                return null;
            });

            const statsWithEffect = {
                ...PLAYER_STATS,
                turnStartEffects: [{ type: 'heroism_temp_hp', name: 'Heroism', tempHpAmount: 3 }],
            };

            await applyHeroism(
                { name: 'Heroism', spell: makeSpell() },
                statsWithEffect,
                CAMPAIGN_NAME,
                MAP_NAME,
                ['Fighter']
            );

            const effectCalls = setRuntimeValue.mock.calls.filter(call => call[1] === 'turnStartEffects');
            expect(effectCalls.length).toBe(0);
        });
    });

    describe('removeHeroismBuff', () => {
        it('removes heroism buffs while preserving other buffs', () => {
            getRuntimeValue.mockImplementation((key, prop) => {
                if (key === 'Fighter' && prop === 'activeBuffs') return [
                    { name: 'Heroism', effect: 'heroism' },
                    { name: 'Bardic Inspiration', effect: 'bardic_inspiration' },
                ];
                if (key === 'campaign' && prop === 'targetEffects') return [];
                return null;
            });

            removeHeroismBuff('Fighter', CAMPAIGN_NAME);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'Fighter',
                'activeBuffs',
                [{ name: 'Bardic Inspiration', effect: 'bardic_inspiration' }],
                CAMPAIGN_NAME,
            );
        });

        it('removes heroism target effects', () => {
            getRuntimeValue.mockImplementation((key, prop) => {
                if (key === 'Fighter' && prop === 'activeBuffs') return [];
                if (key === 'campaign' && prop === 'targetEffects') return [
                    { effect: 'heroism', source: 'Heroism', target: 'Fighter' },
                    { effect: 'bless_bonus', source: 'Bard', target: 'Fighter' },
                ];
                return null;
            });

            removeHeroismBuff('Fighter', CAMPAIGN_NAME);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'campaign',
                'targetEffects',
                [{ effect: 'bless_bonus', source: 'Bard', target: 'Fighter' }],
                CAMPAIGN_NAME,
            );
        });

        it('removes both buff and effects in one call', () => {
            getRuntimeValue.mockImplementation((key, prop) => {
                if (key === 'Fighter' && prop === 'activeBuffs') return [{ name: 'Heroism', effect: 'heroism' }];
                if (key === 'campaign' && prop === 'targetEffects') return [
                    { effect: 'heroism', source: 'Heroism', target: 'Fighter' },
                ];
                return null;
            });

            removeHeroismBuff('Fighter', CAMPAIGN_NAME);

            const setCalls = setRuntimeValue.mock.calls;
            expect(setCalls.length).toBe(2);
            expect(setCalls[0][1]).toBe('activeBuffs');
            expect(setCalls[1][1]).toBe('targetEffects');
        });

        it('skips setRuntimeValue when nothing to remove', () => {
            getRuntimeValue.mockImplementation((key, prop) => {
                if (key === 'Fighter' && prop === 'activeBuffs') return [{ name: 'Bardic Inspiration' }];
                if (key === 'campaign' && prop === 'targetEffects') return [{ effect: 'bless_bonus' }];
                return null;
            });

            removeHeroismBuff('Fighter', CAMPAIGN_NAME);

            const buffCalls = setRuntimeValue.mock.calls.filter(call => call[1] === 'activeBuffs');
            const effectCalls = setRuntimeValue.mock.calls.filter(call => call[1] === 'targetEffects');
            expect(buffCalls.length).toBe(0);
            expect(effectCalls.length).toBe(0);
        });
    });

    describe('isHeroismActive', () => {
        it('returns true when heroism buff exists', () => {
            getRuntimeValue.mockReturnValue([
                { name: 'Heroism', effect: 'heroism' },
            ]);

            expect(isHeroismActive('Fighter', CAMPAIGN_NAME)).toBe(true);
        });

        it('returns false when heroism buff does not exist', () => {
            getRuntimeValue.mockReturnValue([
                { name: 'Bardic Inspiration', effect: 'bardic_inspiration' },
            ]);

            expect(isHeroismActive('Fighter', CAMPAIGN_NAME)).toBe(false);
        });

        it('returns false when no buffs exist', () => {
            getRuntimeValue.mockReturnValue(null);

            expect(isHeroismActive('Fighter', CAMPAIGN_NAME)).toBe(false);
        });
    });
});
