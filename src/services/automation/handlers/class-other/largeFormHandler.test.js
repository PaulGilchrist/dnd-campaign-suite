// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { handle, isLargeFormActive } from './largeFormHandler.js';

// ── Mocks ──────────────────────────────────────────────────────

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn((_name, _key, _campaign) => null),
    setRuntimeValue: vi.fn(async () => {}),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(async () => {}),
}));

// ── Re-import after mocking ────────────────────────────────────

import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';

// ── Constants ──────────────────────────────────────────────────

const campaignName = 'test-campaign';
const playerName = 'Test Character';

// ── Helpers ────────────────────────────────────────────────────

function makeAction(overrides = {}) {
    return {
        name: 'Large Form',
        automation: {
            type: 'large_form',
            duration: '10_minutes',
            casting_time: '1_bonus_action',
            resourceCost: 'long_rest',
            ...overrides.automation,
        },
        ...overrides,
    };
}

function makePlayerStats(overrides = {}) {
    return {
        name: playerName,
        level: 5,
        class: { name: 'Giant' },
        ...overrides,
    };
}

// ── Tests ──────────────────────────────────────────────────────

describe('largeFormHandler', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('handle', () => {
        describe('level gate', () => {
            it('returns info popup when character level is below 5', async () => {
                const stats = makePlayerStats({ level: 3 });
                const result = await handle(makeAction(), stats, campaignName, null);

                expect(result.type).toBe('popup');
                expect(result.payload.type).toBe('automation_info');
                expect(result.payload.description).toBe('Large Form requires character level 5.');
                expect(result.payload.automationType).toBe('large_form');
            });

            it('allows activation when character is exactly level 5', async () => {
                const stats = makePlayerStats({ level: 5 });
                getRuntimeValue.mockImplementation((_name, key) => {
                    if (key === 'largeFormActive') return false;
                    if (key === 'activeBuffs') return [];
                    return null;
                });

                const result = await handle(makeAction(), stats, campaignName, null);

                expect(result.type).toBe('popup');
                expect(result.payload.description).toContain('activated');
                expect(result.payload.description).toContain('Large Form');
            });

            it('allows activation when character is above level 5', async () => {
                const stats = makePlayerStats({ level: 10 });
                getRuntimeValue.mockImplementation((_name, key) => {
                    if (key === 'largeFormActive') return false;
                    if (key === 'activeBuffs') return [];
                    return null;
                });

                const result = await handle(makeAction(), stats, campaignName, null);

                expect(result.type).toBe('popup');
                expect(result.payload.description).toContain('activated');
            });
        });

        describe('deactivation (toggle off)', () => {
            it('ends large form when already active', async () => {
                getRuntimeValue.mockImplementation((_name, key) => {
                    if (key === 'largeFormActive') return true;
                    if (key === 'activeBuffs') return [{ name: 'Large Form', effect: 'large_form' }];
                    return null;
                });

                const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

                expect(result.type).toBe('popup');
                expect(result.payload.description).toBe('Large Form ended.');
                expect(setRuntimeValue).toHaveBeenCalledWith(
                    playerName,
                    'largeFormActive',
                    false,
                    campaignName,
                );
            });

            it('removes the buff from activeBuffs on deactivation', async () => {
                getRuntimeValue.mockImplementation((_name, key) => {
                    if (key === 'largeFormActive') return true;
                    if (key === 'activeBuffs') return [
                        { name: 'Large Form', effect: 'large_form' },
                        { name: 'Other Buff', effect: 'other' },
                    ];
                    return null;
                });

                await handle(makeAction(), makePlayerStats(), campaignName, null);

                expect(setRuntimeValue).toHaveBeenCalledWith(
                    playerName,
                    'activeBuffs',
                    expect.arrayContaining([
                        expect.objectContaining({ name: 'Other Buff' }),
                    ]),
                    campaignName,
                );
                expect(setRuntimeValue).toHaveBeenCalledWith(
                    playerName,
                    'activeBuffs',
                    expect.not.arrayContaining([
                        expect.objectContaining({ name: 'Large Form' }),
                    ]),
                    campaignName,
                );
            });

            it('handles deactivation when activeBuffs is not an array', async () => {
                getRuntimeValue.mockImplementation((_name, key) => {
                    if (key === 'largeFormActive') return true;
                    if (key === 'activeBuffs') return 'not-an-array';
                    return null;
                });

                const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

                expect(result.type).toBe('popup');
                expect(result.payload.description).toBe('Large Form ended.');
                expect(setRuntimeValue).toHaveBeenCalledWith(
                    playerName,
                    'activeBuffs',
                    [],
                    campaignName,
                );
            });
        });

        describe('long rest gate', () => {
            it('blocks activation when long rest mark is set', async () => {
                getRuntimeValue.mockImplementation((_name, key) => {
                    if (key === 'largeFormActive') return false;
                    if (key === 'largeFormActive_restUsed') return true;
                    return null;
                });

                const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

                expect(result.type).toBe('popup');
                expect(result.payload.description).toBe(
                    'Large Form has been used and cannot be used again until a Long Rest.',
                );
            });

            it('allows activation when long rest mark is not set', async () => {
                getRuntimeValue.mockImplementation((_name, key) => {
                    if (key === 'largeFormActive') return false;
                    if (key === 'largeFormActive_restUsed') return false;
                    if (key === 'activeBuffs') return [];
                    return null;
                });

                const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

                expect(result.type).toBe('popup');
                expect(result.payload.description).toContain('activated');
            });
        });

        describe('activation', () => {
            it('sets largeFormActive to true on activation', async () => {
                getRuntimeValue.mockImplementation((_name, key) => {
                    if (key === 'largeFormActive') return false;
                    if (key === 'activeBuffs') return [];
                    return null;
                });

                await handle(makeAction(), makePlayerStats(), campaignName, null);

                expect(setRuntimeValue).toHaveBeenCalledWith(
                    playerName,
                    'largeFormActive',
                    true,
                    campaignName,
                );
            });

            it('adds a buff entry to activeBuffs on activation', async () => {
                getRuntimeValue.mockImplementation((_name, key) => {
                    if (key === 'largeFormActive') return false;
                    if (key === 'activeBuffs') return [];
                    return null;
                });

                await handle(makeAction(), makePlayerStats(), campaignName, null);

                expect(setRuntimeValue).toHaveBeenCalledWith(
                    playerName,
                    'activeBuffs',
                    expect.arrayContaining([
                        expect.objectContaining({
                            name: 'Large Form',
                            effect: 'large_form',
                            duration: '10_minutes',
                            hasAutomation: true,
                        }),
                    ]),
                    campaignName,
                );
            });

            it('does not duplicate buff when it already exists', async () => {
                getRuntimeValue.mockImplementation((_name, key) => {
                    if (key === 'largeFormActive') return false;
                    if (key === 'activeBuffs') return [
                        { name: 'Large Form', effect: 'large_form' },
                    ];
                    return null;
                });

                await handle(makeAction(), makePlayerStats(), campaignName, null);

                expect(setRuntimeValue).toHaveBeenCalledWith(
                    playerName,
                    'activeBuffs',
                    expect.arrayContaining([
                        expect.objectContaining({ name: 'Large Form' }),
                    ]),
                    campaignName,
                );
            });

            it('preserves existing buffs when adding large form', async () => {
                getRuntimeValue.mockImplementation((_name, key) => {
                    if (key === 'largeFormActive') return false;
                    if (key === 'activeBuffs') return [
                        { name: 'Other Buff', effect: 'other' },
                    ];
                    return null;
                });

                await handle(makeAction(), makePlayerStats(), campaignName, null);

                expect(setRuntimeValue).toHaveBeenCalledWith(
                    playerName,
                    'activeBuffs',
                    expect.arrayContaining([
                        expect.objectContaining({ name: 'Other Buff' }),
                        expect.objectContaining({ name: 'Large Form' }),
                    ]),
                    campaignName,
                );
            });

            it('logs the ability use via addEntry', async () => {
                getRuntimeValue.mockImplementation((_name, key) => {
                    if (key === 'largeFormActive') return false;
                    if (key === 'activeBuffs') return [];
                    return null;
                });

                await handle(makeAction(), makePlayerStats(), campaignName, null);

                expect(addEntry).toHaveBeenCalled();
            });

            it('returns popup with full payload structure on activation', async () => {
                getRuntimeValue.mockImplementation((_name, key) => {
                    if (key === 'largeFormActive') return false;
                    if (key === 'activeBuffs') return [];
                    return null;
                });

                const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

                expect(result.type).toBe('popup');
                expect(result.payload).toMatchObject({
                    type: 'automation_info',
                    name: 'Large Form',
                    automationType: 'large_form',
                    description: expect.stringContaining('activated'),
                });
                expect(result.payload.automation).toEqual(makeAction().automation);
            });

            it('handles activation when activeBuffs is not an array', async () => {
                getRuntimeValue.mockImplementation((_name, key) => {
                    if (key === 'largeFormActive') return false;
                    if (key === 'activeBuffs') return 'not-an-array';
                    return null;
                });

                const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

                expect(result.type).toBe('popup');
                expect(result.payload.description).toContain('activated');
                expect(setRuntimeValue).toHaveBeenCalledWith(
                    playerName,
                    'activeBuffs',
                    expect.arrayContaining([
                        expect.objectContaining({ name: 'Large Form' }),
                    ]),
                    campaignName,
                );
            });
        });
    });

    describe('isLargeFormActive', () => {
        it('returns true when the key is true', () => {
            getRuntimeValue.mockReturnValue(true);

            expect(isLargeFormActive(playerName, campaignName)).toBe(true);
        });

        it('returns false when the key is false', () => {
            getRuntimeValue.mockReturnValue(false);

            expect(isLargeFormActive(playerName, campaignName)).toBe(false);
        });

        it('returns false when the key is null', () => {
            getRuntimeValue.mockReturnValue(null);

            expect(isLargeFormActive(playerName, campaignName)).toBe(false);
        });

        it('returns false when the key is undefined', () => {
            getRuntimeValue.mockReturnValue(undefined);

            expect(isLargeFormActive(playerName, campaignName)).toBe(false);
        });

        it('returns false when the key is a non-boolean value', () => {
            getRuntimeValue.mockReturnValue('yes');

            expect(isLargeFormActive(playerName, campaignName)).toBe(false);
        });
    });
});
