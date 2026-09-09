// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handle, handleSummon, handleBond } from './warBondHandler.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(async () => {}),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(async () => {}),
}));

const { getRuntimeValue, setRuntimeValue } = await import(
    '../../../../hooks/runtime/useRuntimeState.js'
);
const { addEntry } = await import('../../../ui/logService.js');

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
                        description: 'No bonded weapons. Use "Bond Weapon:" to bond a weapon first (up to 2).',
                        automation: makeAction().automation,
                    },
                });
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

            it('uses default maxBonded of 2 when bondedWeaponCount is missing', async () => {
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
                expect(result.payload.campaignName).toBe('test-campaign');
                expect(result.payload.action).toBeDefined();
                expect(result.payload.playerStats).toBeDefined();
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

            it('passes all weapons to modal even when more than maxBonded', async () => {
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

        it('returns error popup when no weapon selected', async () => {
            for (const weapon of [null, undefined, '']) {
                const result = await handleSummon(
                    makeAction(),
                    makePlayerStats(),
                    'test-campaign',
                    weapon
                );

                expect(setRuntimeValue).not.toHaveBeenCalled();
                expect(result.type).toBe('popup');
                expect(result.payload.description).toBe('No weapon selected.');
            }
        });

        it('uses custom action name in success description', async () => {
            const result = await handleSummon(
                makeAction({ name: 'War Bond (Variant)' }),
                makePlayerStats(),
                'test-campaign',
                'Shortbow'
            );

            expect(result.payload.description).toBe(
                'War Bond (Variant): Shortbow is summoned to your hand.'
            );
        });

        it('calls setRuntimeValue with campaignName on success', async () => {
            await handleSummon(
                makeAction(),
                makePlayerStats(),
                'distinct-campaign',
                'Mace'
            );

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestFighter',
                SUMMONED_KEY,
                'Mace',
                'distinct-campaign'
            );
        });
    });
});

describe('CLA-379 logging + bond flow', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    function makeInventoryStats() {
        return makePlayerStats({
            inventory: {
                equipped: ['Scimitar', 'Longsword'],
                backpack: ['Shortbow'],
            },
        });
    }

    it('guard refusal logs a war_bond_refused entry and spends nothing', async () => {
        getRuntimeValue.mockReturnValue([]);

        const result = await handle(makeAction(), makePlayerStats(), 'test-campaign');

        expect(result.type).toBe('popup');
        expect(setRuntimeValue).not.toHaveBeenCalled();
        expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
            automationType: 'war_bond_refused',
            characterName: 'TestFighter',
        }));
    });

    it('single bonded summon logs ability_use with the weapon name', async () => {
        getRuntimeValue.mockReturnValue(['Scimitar']);

        const result = await handle(makeAction(), makePlayerStats(), 'test-campaign');

        expect(result.type).toBe('popup');
        expect(setRuntimeValue).toHaveBeenCalledWith(
            'TestFighter', SUMMONED_KEY, 'Scimitar', 'test-campaign'
        );
        expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
            type: 'ability_use',
            characterName: 'TestFighter',
            abilityName: 'War Bond',
        }));
        const entry = addEntry.mock.calls.at(-1)[1];
        expect(entry.description).toContain('Scimitar');
    });

    it('two bonded weapons return the registered warBondSummon chooser modal', async () => {
        getRuntimeValue.mockReturnValue(['Scimitar', 'Longsword']);

        const result = await handle(makeAction(), makePlayerStats(), 'test-campaign');

        expect(result.type).toBe('modal');
        expect(result.modalName).toBe('warBondSummon');
        expect(result.payload.bondedWeapons).toEqual(['Scimitar', 'Longsword']);
    });

    it('chooser confirm dispatches to handleSummon: persists and logs ability_use', async () => {
        getRuntimeValue.mockReturnValue(['Scimitar', 'Longsword']);

        const modalResult = await handle(makeAction(), makePlayerStats(), 'test-campaign');
        const chosen = modalResult.payload.bondedWeapons[1];
        const summonResult = await handleSummon(
            modalResult.payload.action, modalResult.payload.playerStats,
            modalResult.payload.campaignName, chosen
        );

        expect(setRuntimeValue).toHaveBeenCalledWith(
            'TestFighter', SUMMONED_KEY, 'Longsword', 'test-campaign'
        );
        expect(summonResult.type).toBe('popup');
        const abilityEntry = addEntry.mock.calls.map(c => c[1]).filter(e => e.type === 'ability_use').at(-1);
        expect(abilityEntry.description).toContain('Longsword');
    });

    it('summon refusal without selection logs refusal and persists nothing', async () => {
        const result = await handleSummon(makeAction(), makePlayerStats(), 'test-campaign', null);

        expect(result.type).toBe('popup');
        expect(setRuntimeValue).not.toHaveBeenCalled();
        expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
            automationType: 'war_bond_refused',
        }));
    });

    describe('handleBond', () => {
        it('writes warBondWeapons (cap 2) and logs ability_use', async () => {
            const stats = makeInventoryStats();

            const result = await handleBond(['Scimitar', 'Longsword'], stats, 'test-campaign', 2);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestFighter', SEASON_KEY, ['Scimitar', 'Longsword'], 'test-campaign'
            );
            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Scimitar, Longsword');
            expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
                type: 'ability_use',
                abilityName: 'War Bond',
            }));
        });

        it('caps the bonded pool at maxBonded', async () => {
            const stats = makeInventoryStats();
            stats.inventory = { equipped: ['Scimitar', 'Longsword', 'Mace'], backpack: [] };

            const result = await handleBond(['Scimitar', 'Longsword', 'Mace'], stats, 'test-campaign', 2);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestFighter', SEASON_KEY, ['Scimitar', 'Longsword'], 'test-campaign'
            );
            expect(result.payload.description).toContain('(2/2)');
        });

        it('dedupes repeated selections', async () => {
            const stats = makeInventoryStats();

            await handleBond(['Scimitar', 'Scimitar'], stats, 'test-campaign', 2);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestFighter', SEASON_KEY, ['Scimitar'], 'test-campaign'
            );
        });

        it('refuses an empty selection, persisting nothing and logging refusal', async () => {
            const stats = makeInventoryStats();

            const result = await handleBond([], stats, 'test-campaign', 2);

            expect(setRuntimeValue).not.toHaveBeenCalled();
            expect(result.type).toBe('popup');
            expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
                automationType: 'war_bond_refused',
            }));
        });

        it('refuses weapons not in inventory/equipped, persisting nothing', async () => {
            const stats = makeInventoryStats();

            const result = await handleBond(['Scimitar', 'Greataxe'], stats, 'test-campaign', 2);

            expect(setRuntimeValue).not.toHaveBeenCalled();
            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Greataxe');
            expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
                automationType: 'war_bond_refused',
            }));
        });
    });
});
