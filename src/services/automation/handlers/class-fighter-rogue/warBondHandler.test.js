// @maintained-by-ai
// CLA-379: War Bond (Eldritch Knight lv3, 2024).
// Owns the warBondHandler contract: handle() routing (refusal popup / auto-summon /
// warBondSummon chooser payload), handleSummon() persist + popup strings, handleBond()
// bonded-pool writes (cap, dedupe, inventory guard), and the CLA-379 campaign-log
// entries (ability_use + war_bond_refused). Adjacent layers own their own tests:
// chooser modal registration (useCharActionsAutomation), chooser rendering
// (WarBondChooserModal.test.jsx), automation type registry (automationCollector.types.test.js).
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

const BONDED_KEY = 'warBondWeapons';
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

function makeInventoryStats(overrides = {}) {
    return makePlayerStats({
        inventory: {
            equipped: ['Scimitar', 'Longsword'],
            backpack: ['Shortbow'],
            ...overrides,
        },
    });
}

// Runtime router: only warBondWeapons is ever populated; everything else reads empty.
function bondedRouter(value) {
    return (_name, key) => (key === BONDED_KEY ? value : undefined);
}

describe('warBondHandler', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('handle', () => {
        it('refuses when nothing is bonded: exact popup, nothing persisted, war_bond_refused logged', async () => {
            getRuntimeValue.mockImplementation(bondedRouter([]));

            const action = makeAction();
            const result = await handle(action, makePlayerStats(), 'test-campaign');

            expect(getRuntimeValue).toHaveBeenCalledWith('TestFighter', BONDED_KEY, 'test-campaign');
            expect(result).toEqual({
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: 'War Bond',
                    automationType: 'war_bond_summon',
                    description: 'No bonded weapons. Use "Bond Weapon:" to bond a weapon first (up to 2).',
                    automation: action.automation,
                },
            });
            expect(setRuntimeValue).not.toHaveBeenCalled();
            expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
                type: 'automation',
                automationType: 'war_bond_refused',
                characterName: 'TestFighter',
            }));
        });

        it('interpolates custom maxBonded into the refusal description', async () => {
            getRuntimeValue.mockImplementation(bondedRouter([]));

            const result = await handle(
                makeAction({ automation: { bondedWeaponCount: 5 } }),
                makePlayerStats(),
                'test-campaign'
            );

            expect(result.payload.description).toBe(
                'No bonded weapons. Use "Bond Weapon:" to bond a weapon first (up to 5).'
            );
        });

        it('defaults maxBonded to 2 when automation omits bondedWeaponCount and storage is missing', async () => {
            getRuntimeValue.mockImplementation(bondedRouter(undefined));

            const result = await handle(
                { name: 'War Bond', automation: { type: 'war_bond_summon' } },
                makePlayerStats(),
                'test-campaign'
            );

            expect(result.payload.description).toBe(
                'No bonded weapons. Use "Bond Weapon:" to bond a weapon first (up to 2).'
            );
            expect(setRuntimeValue).not.toHaveBeenCalled();
        });

        it('auto-summons the only bonded weapon: persists, exact popup, ability_use logged', async () => {
            getRuntimeValue.mockImplementation(bondedRouter(['Longsword']));

            const action = makeAction();
            const result = await handle(action, makePlayerStats(), 'test-campaign');

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestFighter', SUMMONED_KEY, 'Longsword', 'test-campaign'
            );
            expect(result).toEqual({
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: 'War Bond',
                    automationType: 'war_bond_summon',
                    description: 'War Bond: Longsword is summoned to your hand.',
                    automation: action.automation,
                },
            });
            expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
                type: 'ability_use',
                characterName: 'TestFighter',
                abilityName: 'War Bond',
                description: "War Bond: Longsword is summoned to TestFighter's hand.",
            }));
        });

        it('returns the full warBondSummon chooser payload for two bonded weapons, persisting nothing', async () => {
            getRuntimeValue.mockImplementation(bondedRouter(['Longsword', 'Battleaxe']));

            const action = makeAction();
            const playerStats = makePlayerStats();
            const result = await handle(action, playerStats, 'test-campaign');

            expect(setRuntimeValue).not.toHaveBeenCalled();
            expect(result).toEqual({
                type: 'modal',
                modalName: 'warBondSummon',
                payload: {
                    action,
                    playerStats,
                    campaignName: 'test-campaign',
                    bondedWeapons: ['Longsword', 'Battleaxe'],
                    maxBonded: 2,
                },
            });
        });

        it('passes every bonded weapon to the modal, even beyond a custom maxBonded', async () => {
            getRuntimeValue.mockImplementation(bondedRouter(['A', 'B', 'C', 'D']));

            const result = await handle(
                makeAction({ automation: { bondedWeaponCount: 3 } }),
                makePlayerStats(),
                'test-campaign'
            );

            expect(result.type).toBe('modal');
            expect(result.payload.bondedWeapons).toEqual(['A', 'B', 'C', 'D']);
            expect(result.payload.maxBonded).toBe(3);
        });

        it('chooser confirm redispatches through the modal payload: persists the chosen weapon and logs ability_use', async () => {
            getRuntimeValue.mockImplementation(bondedRouter(['Scimitar', 'Longsword']));

            const modalResult = await handle(makeAction(), makePlayerStats(), 'test-campaign');
            const chosen = modalResult.payload.bondedWeapons[1];
            expect(chosen).toBe('Longsword');

            const summonResult = await handleSummon(
                modalResult.payload.action,
                modalResult.payload.playerStats,
                modalResult.payload.campaignName,
                chosen
            );

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestFighter', SUMMONED_KEY, 'Longsword', 'test-campaign'
            );
            expect(summonResult.type).toBe('popup');
            expect(summonResult.payload.description).toBe('War Bond: Longsword is summoned to your hand.');
            expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
                type: 'ability_use',
                description: "War Bond: Longsword is summoned to TestFighter's hand.",
            }));
        });
    });

    describe('handleSummon', () => {
        it('persists the selected weapon: exact popup, ability_use logged', async () => {
            const action = makeAction();
            const result = await handleSummon(action, makePlayerStats(), 'test-campaign', 'Mace');

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestFighter', SUMMONED_KEY, 'Mace', 'test-campaign'
            );
            expect(result).toEqual({
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: 'War Bond',
                    automationType: 'war_bond_summon',
                    description: 'War Bond: Mace is summoned to your hand.',
                    automation: action.automation,
                },
            });
            expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
                type: 'ability_use',
                characterName: 'TestFighter',
                abilityName: 'War Bond',
                description: "War Bond: Mace is summoned to TestFighter's hand.",
            }));
        });

        it('forwards a custom action name and campaign through popup and runtime write', async () => {
            const result = await handleSummon(
                makeAction({ name: 'War Bond (Variant)' }),
                makePlayerStats(),
                'distinct-campaign',
                'Shortbow'
            );

            expect(result.payload.name).toBe('War Bond (Variant)');
            expect(result.payload.description).toBe(
                'War Bond (Variant): Shortbow is summoned to your hand.'
            );
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestFighter', SUMMONED_KEY, 'Shortbow', 'distinct-campaign'
            );
        });

        it('refuses null, undefined, and empty selections: popup, nothing persisted, refusal logged', async () => {
            for (const weapon of [null, undefined, '']) {
                const result = await handleSummon(
                    makeAction(),
                    makePlayerStats(),
                    'test-campaign',
                    weapon
                );

                expect(result.type).toBe('popup');
                expect(result.payload.description).toBe('No weapon selected.');
                expect(setRuntimeValue).not.toHaveBeenCalled();
                expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
                    automationType: 'war_bond_refused',
                    description: 'War Bond refused — No weapon selected.',
                }));
            }
        });
    });

    describe('handleBond', () => {
        it('persists the bonded pool: exact popup, ability_use logged', async () => {
            const result = await handleBond(
                ['Scimitar', 'Longsword'], makeInventoryStats(), 'test-campaign', 2
            );

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestFighter', BONDED_KEY, ['Scimitar', 'Longsword'], 'test-campaign'
            );
            expect(result).toEqual({
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: 'War Bond',
                    description: 'Bonded Scimitar, Longsword (2/2). Summon a bonded weapon as a Bonus Action.',
                },
            });
            expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
                type: 'ability_use',
                abilityName: 'War Bond',
                description: 'War Bond: bonded Scimitar, Longsword (2/2).',
            }));
        });

        it('caps the bonded pool at maxBonded', async () => {
            const stats = makeInventoryStats();
            stats.inventory.equipped = ['Scimitar', 'Longsword', 'Mace'];

            const result = await handleBond(
                ['Scimitar', 'Longsword', 'Mace'], stats, 'test-campaign', 2
            );

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestFighter', BONDED_KEY, ['Scimitar', 'Longsword'], 'test-campaign'
            );
            expect(result.payload.description).toContain('(2/2)');
        });

        it('trims and dedupes repeated selections, defaulting the cap to 2', async () => {
            await handleBond([' Scimitar ', 'Scimitar'], makeInventoryStats(), 'test-campaign');

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestFighter', BONDED_KEY, ['Scimitar'], 'test-campaign'
            );
        });

        it('refuses an empty selection: persists nothing and logs refusal', async () => {
            const result = await handleBond([], makeInventoryStats(), 'test-campaign', 2);

            expect(setRuntimeValue).not.toHaveBeenCalled();
            expect(result.type).toBe('popup');
            expect(result.payload.description).toBe('No weapon selected to bond.');
            expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
                automationType: 'war_bond_refused',
                description: 'War Bond refused — No weapon selected to bond.',
            }));
        });

        it('refuses weapons not in inventory, naming them, persisting nothing, logging refusal', async () => {
            const result = await handleBond(
                ['Scimitar', 'Greataxe'], makeInventoryStats(), 'test-campaign', 2
            );

            expect(setRuntimeValue).not.toHaveBeenCalled();
            expect(result.type).toBe('popup');
            expect(result.payload.description).toBe(
                'Not in inventory: Greataxe. Bond only weapons you carry.'
            );
            expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
                automationType: 'war_bond_refused',
                description: 'War Bond refused — Not in inventory: Greataxe. Bond only weapons you carry.',
            }));
        });
    });
});
