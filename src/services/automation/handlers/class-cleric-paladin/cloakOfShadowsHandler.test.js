import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handle } from './cloakOfShadowsHandler.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(async () => {}),
}));

vi.mock('../../../character/classFeatures.js', () => ({
    getClassFeatures: vi.fn(() => ({ maxFocusPoints: 3 })),
}));

const { getRuntimeValue, setRuntimeValue } = await import('../../../../hooks/runtime/useRuntimeState.js');
const { getClassFeatures } = await import('../../../character/classFeatures.js');

beforeEach(() => {
    vi.clearAllMocks();
});

function makePlayerStats(overrides = {}) {
    return {
        name: 'TestCleric',
        level: 6,
        class: {
            class_levels: [{ level: 6, focus_points: 3 }],
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
    describe('toggling', () => {
        it('returns info popup when feature is already active', async () => {
            getRuntimeValue.mockImplementation((player, key, _campaign) => {
                if (key === 'activeBuffs') {
                    return [{ name: 'Cloak of Shadows', effect: 'cloak_of_shadows' }];
                }
                return null;
            });

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign');

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('ended');
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestCleric',
                'activeBuffs',
                expect.any(Array),
                'test-campaign'
            );
        });

        it('returns info popup when buff is not the matching name', async () => {
            getRuntimeValue.mockImplementation((player, key) => {
                if (key === 'activeBuffs') {
                    return [{ name: 'Different Buff' }];
                }
                if (key === 'focusPoints') {
                    return 3;
                }
                return null;
            });
            getClassFeatures.mockReturnValue({ maxFocusPoints: 3 });

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign');

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('activated');
        });
    });

    describe('focus point checks', () => {
        it('returns error when not enough focus points', async () => {
            getRuntimeValue.mockImplementation((player, key) => {
                if (key === 'activeBuffs') return [];
                if (key === 'focusPoints') return 2;
                return null;
            });

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign');

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('Not enough Focus Points');
            expect(setRuntimeValue).not.toHaveBeenCalledWith(
                'TestCleric',
                'focusPoints',
                expect.anything(),
                'test-campaign'
            );
        });

        it('uses class focus_points when available', async () => {
            getRuntimeValue.mockImplementation((player, key) => {
                if (key === 'activeBuffs') return [];
                if (key === 'focusPoints') return null;
                return null;
            });
            getClassFeatures.mockReturnValue({ maxFocusPoints: 3 });

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign');

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('activated');
        });

        it('delegates to getClassFeatures when class_levels missing', async () => {
            getRuntimeValue.mockImplementation((player, key) => {
                if (key === 'activeBuffs') return [];
                if (key === 'focusPoints') return null;
                return null;
            });
            getClassFeatures.mockReturnValue({ maxFocusPoints: 3 });

            await handle(makeAction(), makePlayerStats({ class: null }), 'test-campaign');

            expect(getClassFeatures).toHaveBeenCalled();
        });
    });

    describe('activation', () => {
        it('spends 3 focus points and adds buff', async () => {
            getRuntimeValue.mockImplementation((player, key) => {
                if (key === 'activeBuffs') return [];
                if (key === 'focusPoints') return 5;
                return null;
            });

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign');

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestCleric',
                'focusPoints',
                2,
                'test-campaign'
            );
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestCleric',
                'activeBuffs',
                expect.arrayContaining([
                    expect.objectContaining({
                        name: 'Cloak of Shadows',
                        effect: 'cloak_of_shadows',
                        duration: '1_minute',
                        hasAutomation: true,
                    }),
                ]),
                'test-campaign'
            );
            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('activated');
        });

        it('appends buff to existing buffs', async () => {
            getRuntimeValue.mockImplementation((player, key) => {
                if (key === 'activeBuffs') return [{ name: 'Existing Buff' }];
                if (key === 'focusPoints') return 5;
                return null;
            });

            await handle(makeAction(), makePlayerStats(), 'test-campaign');

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestCleric',
                'activeBuffs',
                expect.arrayContaining([
                    expect.objectContaining({ name: 'Existing Buff' }),
                    expect.objectContaining({ name: 'Cloak of Shadows' }),
                ]),
                'test-campaign'
            );
        });

        it('uses automation duration when provided', async () => {
            getRuntimeValue.mockImplementation((player, key) => {
                if (key === 'activeBuffs') return [];
                if (key === 'focusPoints') return 5;
                return null;
            });

            await handle(makeAction({ automation: { duration: 'until_end_of_turn' } }), makePlayerStats(), 'test-campaign');

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestCleric',
                'activeBuffs',
                expect.arrayContaining([
                    expect.objectContaining({ duration: 'until_end_of_turn' }),
                ]),
                'test-campaign'
            );
        });

        it('handles non-array stored activeBuffs', async () => {
            getRuntimeValue.mockImplementation((player, key) => {
                if (key === 'activeBuffs') return 'not-an-array';
                if (key === 'focusPoints') return 5;
                return null;
            });

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('activated');
        });

        it('returns popup with correct payload fields', async () => {
            getRuntimeValue.mockImplementation((player, key) => {
                if (key === 'activeBuffs') return [];
                if (key === 'focusPoints') return 5;
                return null;
            });

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign');

            expect(result.payload.name).toBe('Cloak of Shadows');
            expect(result.payload.automationType).toBe('cloak_of_shadows');
        });
    });
});
