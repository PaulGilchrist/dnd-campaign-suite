// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { handle } from './cloakOfShadowsHandler.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../character/classFeatures.js', () => ({
    getClassFeatures: vi.fn(),
}));

vi.mock('../../../rules/effects/expirations.js', () => ({
    addExpiration: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn().mockResolvedValue(undefined),
}));

const { getRuntimeValue, setRuntimeValue } = await import(
    '../../../../hooks/runtime/useRuntimeState.js'
);
const { getClassFeatures } = await import('../../../character/classFeatures.js');
const { addExpiration } = await import('../../../rules/effects/expirations.js');
const { addEntry } = await import('../../../ui/logService.js');

const campaignName = 'TestCampaign';

function makePlayerStats(overrides = {}) {
    return {
        name: 'TestMonk',
        level: 17,
        class: {
            class_levels: [{ level: 17, focus_points: 4 }],
            ...overrides.class,
        },
        ...overrides,
    };
}

function makeAction(overrides = {}) {
    return {
        name: 'Cloak of Shadows',
        automation: {
            type: 'cloak_of_shadows',
            duration: '1_minute',
            ...overrides.automation,
        },
        ...overrides,
    };
}

describe('cloakOfShadowsHandler', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('deactivation (toggle off)', () => {
        it('removes the buff and returns info popup when feature is active', async () => {
            getRuntimeValue.mockImplementation((player, key) => {
                if (key === 'activeBuffs') {
                    return [
                        { name: 'Cloak of Shadows', effect: 'cloak_of_shadows' },
                        { name: 'Other Buff' },
                    ];
                }
                return null;
            });

            const result = await handle(makeAction(), makePlayerStats(), campaignName);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toBe('Cloak of Shadows ended');
            expect(result.payload.name).toBe('Cloak of Shadows');
            expect(result.payload.automationType).toBe('cloak_of_shadows');

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestMonk',
                'activeBuffs',
                [{ name: 'Other Buff' }],
                campaignName,
            );
        });

        it('removes invisible condition on deactivation', async () => {
            getRuntimeValue.mockImplementation((player, key) => {
                if (key === 'activeBuffs') {
                    return [{ name: 'Cloak of Shadows', effect: 'cloak_of_shadows' }];
                }
                if (key === 'activeConditions') {
                    return ['invisible', 'frightened'];
                }
                return null;
            });

            await handle(makeAction(), makePlayerStats(), campaignName);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestMonk',
                'activeConditions',
                ['frightened'],
                campaignName,
            );
        });

        it('clears invisibility tracking key on deactivation', async () => {
            getRuntimeValue.mockImplementation((player, key) => {
                if (key === 'activeBuffs') {
                    return [{ name: 'Cloak of Shadows', effect: 'cloak_of_shadows' }];
                }
                return null;
            });

            await handle(makeAction(), makePlayerStats(), campaignName);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                campaignName,
                '_activeInvisibility_TestMonk',
                null,
                campaignName,
            );
        });

        it('logs deactivation to campaign log', async () => {
            getRuntimeValue.mockImplementation((player, key) => {
                if (key === 'activeBuffs') {
                    return [{ name: 'Cloak of Shadows', effect: 'cloak_of_shadows' }];
                }
                return null;
            });

            await handle(makeAction(), makePlayerStats(), campaignName);

            expect(addEntry).toHaveBeenCalledWith(campaignName, {
                type: 'ability_use',
                characterName: 'TestMonk',
                abilityName: 'Cloak of Shadows',
                description: 'TestMonk ended Cloak of Shadows.',
            });
        });

        it('does not modify conditions if invisible is not present', async () => {
            getRuntimeValue.mockImplementation((player, key) => {
                if (key === 'activeBuffs') {
                    return [{ name: 'Cloak of Shadows', effect: 'cloak_of_shadows' }];
                }
                if (key === 'activeConditions') {
                    return ['frightened'];
                }
                return null;
            });

            await handle(makeAction(), makePlayerStats(), campaignName);

            expect(setRuntimeValue).not.toHaveBeenCalledWith(
                'TestMonk',
                'activeConditions',
                expect.anything(),
                campaignName,
            );
        });
    });

    describe('focus point validation', () => {
        it('returns error when focus points are below 3', async () => {
            getRuntimeValue.mockImplementation((player, key) => {
                if (key === 'activeBuffs') return [];
                if (key === 'focusPoints') return 2;
                return null;
            });

            const result = await handle(makeAction(), makePlayerStats(), campaignName);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toBe(
                'Not enough Focus Points. Need 3, have 2.',
            );
            expect(setRuntimeValue).not.toHaveBeenCalled();
        });
    });

    describe('focus point fallback', () => {
        it('uses getClassFeatures maxFocusPoints when class_levels is missing', async () => {
            getRuntimeValue.mockImplementation((player, key) => {
                if (key === 'activeBuffs') return [];
                if (key === 'focusPoints') return null;
                return null;
            });
            getClassFeatures.mockReturnValue({ maxFocusPoints: 3 });

            const result = await handle(
                makeAction(),
                makePlayerStats({ class: null }),
                campaignName,
            );

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('activated');
        });

        it('defaults to 0 focus when no class data or fallback available', async () => {
            getRuntimeValue.mockImplementation((player, key) => {
                if (key === 'activeBuffs') return [];
                if (key === 'focusPoints') return null;
                return null;
            });
            getClassFeatures.mockReturnValue({});

            const result = await handle(
                makeAction(),
                makePlayerStats({ class: null }),
                campaignName,
            );

            expect(result.type).toBe('popup');
            expect(result.payload.description).toBe(
                'Not enough Focus Points. Need 3, have 0.',
            );
        });
    });

    describe('activation', () => {
        it('spends 3 focus points and adds buff to empty buffs', async () => {
            getRuntimeValue.mockImplementation((player, key) => {
                if (key === 'activeBuffs') return [];
                if (key === 'focusPoints') return 5;
                return null;
            });

            const result = await handle(makeAction(), makePlayerStats(), campaignName);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestMonk',
                'focusPoints',
                2,
                campaignName,
            );
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestMonk',
                'activeBuffs',
                expect.arrayContaining([
                    expect.objectContaining({
                        name: 'Cloak of Shadows',
                        effect: 'cloak_of_shadows',
                        duration: '1_minute',
                        hasAutomation: true,
                    }),
                ]),
                campaignName,
            );
            expect(result.type).toBe('popup');
            expect(result.payload.description).toBe(
                'Cloak of Shadows activated. You gain Invisibility, can move through occupied spaces, and Flurry of Blows costs no Focus Points.',
            );
        });

        it('appends buff to existing buffs', async () => {
            getRuntimeValue.mockImplementation((player, key) => {
                if (key === 'activeBuffs') return [{ name: 'Existing Buff' }];
                if (key === 'focusPoints') return 5;
                return null;
            });

            await handle(makeAction(), makePlayerStats(), campaignName);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestMonk',
                'activeBuffs',
                expect.arrayContaining([
                    expect.objectContaining({ name: 'Existing Buff' }),
                    expect.objectContaining({ name: 'Cloak of Shadows' }),
                ]),
                campaignName,
            );
        });

        it('sets invisible condition on activation', async () => {
            getRuntimeValue.mockImplementation((player, key) => {
                if (key === 'activeBuffs') return [];
                if (key === 'focusPoints') return 5;
                if (key === 'activeConditions') return [];
                return null;
            });

            await handle(makeAction(), makePlayerStats(), campaignName);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestMonk',
                'activeConditions',
                ['invisible'],
                campaignName,
            );
        });

        it('does not duplicate invisible if already present', async () => {
            getRuntimeValue.mockImplementation((player, key) => {
                if (key === 'activeBuffs') return [];
                if (key === 'focusPoints') return 5;
                if (key === 'activeConditions') return ['invisible', 'frightened'];
                return null;
            });

            await handle(makeAction(), makePlayerStats(), campaignName);

            // Should not call setRuntimeValue with activeConditions since invisible is already there
            const activeCondCalls = setRuntimeValue.mock.calls.filter(
                call => call[1] === 'activeConditions'
            );
            expect(activeCondCalls).toHaveLength(0);
        });

        it('sets invisibility tracking key on activation', async () => {
            getRuntimeValue.mockImplementation((player, key) => {
                if (key === 'activeBuffs') return [];
                if (key === 'focusPoints') return 5;
                if (key === 'activeConditions') return [];
                return null;
            });

            await handle(makeAction(), makePlayerStats(), campaignName);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                campaignName,
                '_activeInvisibility_TestMonk',
                'TestMonk',
                campaignName,
            );
        });

        it('registers initiative expiration via addExpiration', async () => {
            getRuntimeValue.mockImplementation((player, key) => {
                if (key === 'activeBuffs') return [];
                if (key === 'focusPoints') return 5;
                if (key === 'activeConditions') return [];
                return null;
            });

            await handle(makeAction(), makePlayerStats(), campaignName);

            expect(addExpiration).toHaveBeenCalledWith(
                'TestMonk',
                'TestMonk',
                [{ type: 'condition', condition: 'invisible' }],
                campaignName,
                undefined,
                'TestMonk',
            );
        });

        it('logs activation to campaign log', async () => {
            getRuntimeValue.mockImplementation((player, key) => {
                if (key === 'activeBuffs') return [];
                if (key === 'focusPoints') return 5;
                if (key === 'activeConditions') return [];
                return null;
            });

            await handle(makeAction(), makePlayerStats(), campaignName);

            expect(addEntry).toHaveBeenCalledWith(campaignName, {
                type: 'ability_use',
                characterName: 'TestMonk',
                abilityName: 'Cloak of Shadows',
                description: 'TestMonk activated Cloak of Shadows. You gain Invisibility, can move through occupied spaces, and Flurry of Blows costs no Focus Points.',
            });
        });

        it('uses custom duration from automation config', async () => {
            getRuntimeValue.mockImplementation((player, key) => {
                if (key === 'activeBuffs') return [];
                if (key === 'focusPoints') return 5;
                if (key === 'activeConditions') return [];
                return null;
            });

            await handle(
                makeAction({ automation: { duration: 'until_end_of_turn' } }),
                makePlayerStats(),
                campaignName,
            );

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestMonk',
                'activeBuffs',
                expect.arrayContaining([
                    expect.objectContaining({ duration: 'until_end_of_turn' }),
                ]),
                campaignName,
            );
        });

        it('uses default duration when automation has no duration', async () => {
            getRuntimeValue.mockImplementation((player, key) => {
                if (key === 'activeBuffs') return [];
                if (key === 'focusPoints') return 5;
                if (key === 'activeConditions') return [];
                return null;
            });

            await handle(
                makeAction({ automation: {} }),
                makePlayerStats(),
                campaignName,
            );

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestMonk',
                'activeBuffs',
                expect.arrayContaining([
                    expect.objectContaining({ duration: '1_minute' }),
                ]),
                campaignName,
            );
        });

        it('treats non-array activeBuffs as empty array', async () => {
            getRuntimeValue.mockImplementation((player, key) => {
                if (key === 'activeBuffs') return 'not-an-array';
                if (key === 'focusPoints') return 5;
                if (key === 'activeConditions') return [];
                return null;
            });

            const result = await handle(makeAction(), makePlayerStats(), campaignName);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('activated');
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestMonk',
                'activeBuffs',
                expect.arrayContaining([
                    expect.objectContaining({ name: 'Cloak of Shadows' }),
                ]),
                campaignName,
            );
        });

        it('uses runtime focusPoints over class focus_points when both exist', async () => {
            getRuntimeValue.mockImplementation((player, key) => {
                if (key === 'activeBuffs') return [];
                if (key === 'focusPoints') return 10;
                if (key === 'activeConditions') return [];
                return null;
            });

            await handle(makeAction(), makePlayerStats(), campaignName);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestMonk',
                'focusPoints',
                7,
                campaignName,
            );
        });
    });


});
