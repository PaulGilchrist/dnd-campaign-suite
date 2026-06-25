// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handle, handleSummon } from './warBondHandler.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(async () => {}),
}));

import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';

const SEASON_KEY = 'warBondWeapons';
const SUMMONED_KEY = 'warBondSummoned';

function makeAction(overrides = {}) {
    return {
        name: 'War Bond',
        automation: {
            type: 'war_bond_summon',
            action: 'bonus_action',
            bondedWeaponCount: 2,
            casting_time: '1 bonus action',
            ...overrides.automation,
        },
        ...overrides,
    };
}

function makePlayerStats(overrides = {}) {
    return {
        name: 'TestFighter',
        ...overrides,
    };
}

describe('warBondHandler', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('handle', () => {
        describe('no bonded weapons', () => {
            it('returns popup when stored value is empty array', async () => {
                getRuntimeValue.mockReturnValue([]);

                const result = await handle(makeAction(), makePlayerStats(), 'test-campaign');

                expect(result).toEqual({
                    type: 'popup',
                    payload: {
                        type: 'automation_info',
                        name: 'War Bond',
                        automationType: 'war_bond_summon',
                        description: 'No bonded weapons. Bond a weapon first (up to 2).',
                        automation: makeAction().automation,
                    },
                });
            });

            it('returns popup when stored value is null', async () => {
                getRuntimeValue.mockReturnValue(null);

                const result = await handle(makeAction(), makePlayerStats(), 'test-campaign');

                expect(result.type).toBe('popup');
                expect(result.payload.type).toBe('automation_info');
                expect(result.payload.description).toContain('No bonded weapons');
            });

            it('returns popup when stored value is undefined', async () => {
                getRuntimeValue.mockReturnValue(undefined);

                const result = await handle(makeAction(), makePlayerStats(), 'test-campaign');

                expect(result.type).toBe('popup');
                expect(result.payload.description).toContain('No bonded weapons');
            });

            it('returns popup when stored value is a non-array string', async () => {
                getRuntimeValue.mockReturnValue('not-an-array');

                const result = await handle(makeAction(), makePlayerStats(), 'test-campaign');

                expect(result.type).toBe('popup');
                expect(result.payload.description).toContain('No bonded weapons');
            });

            it('uses custom maxBonded in description when bondedWeaponCount is set', async () => {
                getRuntimeValue.mockReturnValue([]);

                const result = await handle(
                    makeAction({ automation: { bondedWeaponCount: 5 } }),
                    makePlayerStats(),
                    'test-campaign'
                );

                expect(result.payload.description).toContain('up to 5');
            });

            it('uses default maxBonded of 2 when bondedWeaponCount is null', async () => {
                getRuntimeValue.mockReturnValue([]);

                const result = await handle(
                    makeAction({ automation: { bondedWeaponCount: null } }),
                    makePlayerStats(),
                    'test-campaign'
                );

                expect(result.payload.description).toContain('up to 2');
            });

            it('uses default maxBonded of 2 when bondedWeaponCount is undefined', async () => {
                getRuntimeValue.mockReturnValue([]);

                const result = await handle(
                    makeAction({ automation: {} }),
                    makePlayerStats(),
                    'test-campaign'
                );

                expect(result.payload.description).toContain('up to 2');
            });
        });

        describe('single bonded weapon', () => {
            it('summons the weapon and returns popup on success', async () => {
                getRuntimeValue.mockImplementation((_name, key) =>
                    key === SEASON_KEY ? ['Longsword'] : undefined
                );

                const result = await handle(makeAction(), makePlayerStats(), 'test-campaign');

                expect(setRuntimeValue).toHaveBeenCalledWith(
                    'TestFighter',
                    SUMMONED_KEY,
                    'Longsword',
                    'test-campaign'
                );
                expect(result).toEqual({
                    type: 'popup',
                    payload: {
                        type: 'automation_info',
                        name: 'War Bond',
                        automationType: 'war_bond_summon',
                        description: 'War Bond: Longsword is summoned to your hand.',
                        automation: makeAction().automation,
                    },
                });
            });

            it('uses custom action name in description', async () => {
                getRuntimeValue.mockImplementation((_name, key) =>
                    key === SEASON_KEY ? ['Shortsword'] : undefined
                );

                const result = await handle(
                    makeAction({ name: 'War Bond (Variant)' }),
                    makePlayerStats(),
                    'test-campaign'
                );

                expect(result.payload.description).toContain('War Bond (Variant): Shortsword');
            });

            it('passes the automation object into the popup payload', async () => {
                getRuntimeValue.mockImplementation((_name, key) =>
                    key === SEASON_KEY ? ['Mace'] : undefined
                );

                const action = makeAction({ automation: { customField: 'customValue' } });

                const result = await handle(action, makePlayerStats(), 'test-campaign');

                expect(result.payload.automation).toEqual(action.automation);
            });
        });

        describe('multiple bonded weapons', () => {
            it('returns modal with weapon selection when two weapons bonded', async () => {
                getRuntimeValue.mockImplementation((_name, key) =>
                    key === SEASON_KEY ? ['Longsword', 'Battleaxe'] : undefined
                );

                const result = await handle(makeAction(), makePlayerStats(), 'test-campaign');

                expect(result.type).toBe('modal');
                expect(result.modalName).toBe('warBondSummon');
                expect(result.payload.bondedWeapons).toEqual(['Longsword', 'Battleaxe']);
                expect(result.payload.maxBonded).toBe(2);
                expect(result.payload.action).toBeInstanceOf(Object);
                expect(result.payload.playerStats).toBeInstanceOf(Object);
                expect(result.payload.campaignName).toBe('test-campaign');
            });

            it('respects custom bondedWeaponCount from automation', async () => {
                getRuntimeValue.mockImplementation((_name, key) =>
                    key === SEASON_KEY ? ['Longsword', 'Battleaxe', 'Spear'] : undefined
                );

                const result = await handle(
                    makeAction({ automation: { bondedWeaponCount: 3 } }),
                    makePlayerStats(),
                    'test-campaign'
                );

                expect(result.type).toBe('modal');
                expect(result.payload.maxBonded).toBe(3);
                expect(result.payload.bondedWeapons).toHaveLength(3);
            });

            it('passes action, playerStats, and campaignName by reference in modal payload', async () => {
                getRuntimeValue.mockImplementation((_name, key) =>
                    key === SEASON_KEY ? ['Rapier', 'Dagger'] : undefined
                );

                const action = makeAction();
                const playerStats = makePlayerStats();
                const campaignName = 'my-campaign';

                const result = await handle(action, playerStats, campaignName);

                expect(result.payload.action).toBe(action);
                expect(result.payload.playerStats).toBe(playerStats);
                expect(result.payload.campaignName).toBe(campaignName);
            });

            it('handles more weapons than maxBonded from stored data', async () => {
                getRuntimeValue.mockImplementation((_name, key) =>
                    key === SEASON_KEY ? ['A', 'B', 'C', 'D'] : undefined
                );

                const result = await handle(
                    makeAction({ automation: { bondedWeaponCount: 2 } }),
                    makePlayerStats(),
                    'test-campaign'
                );

                expect(result.type).toBe('modal');
                expect(result.payload.bondedWeapons).toEqual(['A', 'B', 'C', 'D']);
                expect(result.payload.maxBonded).toBe(2);
            });
        });
    });

    describe('handleSummon', () => {
        it('summons a weapon and returns popup on success', async () => {
            const result = await handleSummon(
                makeAction(),
                makePlayerStats(),
                'test-campaign',
                'Longsword'
            );

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestFighter',
                SUMMONED_KEY,
                'Longsword',
                'test-campaign'
            );
            expect(result).toEqual({
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: 'War Bond',
                    automationType: 'war_bond_summon',
                    description: 'War Bond: Longsword is summoned to your hand.',
                    automation: makeAction().automation,
                },
            });
        });

        it('returns error popup when no weapon selected (null)', async () => {
            const result = await handleSummon(
                makeAction(),
                makePlayerStats(),
                'test-campaign',
                null
            );

            expect(setRuntimeValue).not.toHaveBeenCalled();
            expect(result).toEqual({
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: 'War Bond',
                    description: 'No weapon selected.',
                    automation: makeAction().automation,
                },
            });
        });

        it('returns error popup when no weapon selected (undefined)', async () => {
            const result = await handleSummon(
                makeAction(),
                makePlayerStats(),
                'test-campaign',
                undefined
            );

            expect(setRuntimeValue).not.toHaveBeenCalled();
            expect(result.type).toBe('popup');
            expect(result.payload.description).toBe('No weapon selected.');
        });

        it('returns error popup when no weapon selected (empty string)', async () => {
            const result = await handleSummon(
                makeAction(),
                makePlayerStats(),
                'test-campaign',
                ''
            );

            expect(setRuntimeValue).not.toHaveBeenCalled();
            expect(result.type).toBe('popup');
            expect(result.payload.description).toBe('No weapon selected.');
        });

        it('uses custom action name in success description', async () => {
            const result = await handleSummon(
                makeAction({ name: 'War Bond (Variant)' }),
                makePlayerStats(),
                'test-campaign',
                'Shortbow'
            );

            expect(result.payload.description).toBe('War Bond (Variant): Shortbow is summoned to your hand.');
        });

        it('uses custom action name in error description when no weapon selected', async () => {
            const result = await handleSummon(
                makeAction({ name: 'War Bond (Variant)' }),
                makePlayerStats(),
                'test-campaign',
                null
            );

            expect(result.payload.name).toBe('War Bond (Variant)');
        });
    });
});
