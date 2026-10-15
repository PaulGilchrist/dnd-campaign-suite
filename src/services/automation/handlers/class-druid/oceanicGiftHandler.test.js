// @maintained-by-ai
// Deterministic unit tests for the Oceanic Gift automation handler: pure control
// flow over fully-mocked runtime/log/combat boundaries. Pins the exact server-first
// runtime keys and full popup/log strings that form the stable contract consumed by
// the Wrath of the Sea lane and the modal wiring (tested separately at that layer
// in useCharActionsModalHandlers.oceanicGift.test.js / SecondaryTargetModals).
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../encounters/combatData.js', () => ({
    loadCombatSummary: vi.fn(),
}));

vi.mock('../../common/savePrompt.js', () => ({
    buildSaveDc: vi.fn(),
}));

import { handle, confirmOceanicGift, clearOceanicGiftAllies } from './oceanicGiftHandler.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { loadCombatSummary } from '../../../encounters/combatData.js';
import { buildSaveDc } from '../../common/savePrompt.js';

const campaignName = 'test-campaign';
const playerName = 'Maribelle';

function makePlayerStats(overrides = {}) {
    return {
        name: playerName,
        level: 3,
        proficiency: 2,
        abilities: [{ name: 'Wisdom', bonus: 1 }],
        class: {
            class_levels: [{ level: 3, wild_shape: 2 }],
        },
        ...overrides,
    };
}

function makeAction(automation = {}) {
    return {
        name: 'Oceanic Gift',
        automation: {
            type: 'oceanic_gift',
            ...automation,
        },
    };
}

function makeAlly(overrides = {}) {
    return {
        name: 'AllyOne',
        type: 'player',
        ...overrides,
    };
}

function makeEnemy(overrides = {}) {
    return {
        name: 'Goblin',
        type: 'npc',
        ...overrides,
    };
}

// Router over getRuntimeValue so tests never depend on call order.
function mockRuntime(values = {}) {
    getRuntimeValue.mockImplementation((name, key) => values[`${name}.${key}`]);
}

function confirmArgs(overrides = {}) {
    return {
        action: makeAction(),
        playerStats: makePlayerStats(),
        campaignName,
        selectedAllyName: 'AllyOne',
        spellSaveDc: 13,
        wisMod: 1,
        doubleEmanation: false,
        ...overrides,
    };
}

describe('oceanicGiftHandler', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('handle', () => {
        it('blocks with a popup and touches nothing when no Wild Shape uses remain', async () => {
            mockRuntime({ [`${playerName}.wildShapeUses`]: 0 });

            const result = await handle(makeAction(), makePlayerStats(), campaignName);

            expect(result).toEqual({
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: 'Oceanic Gift',
                    description: 'Oceanic Gift: Not enough Wild Shape uses remaining. 1 use required.',
                    automation: { type: 'oceanic_gift' },
                },
            });
            expect(loadCombatSummary).not.toHaveBeenCalled();
            expect(buildSaveDc).not.toHaveBeenCalled();
            expect(setRuntimeValue).not.toHaveBeenCalled();
        });

        it('blocks the double variant with a plural popup when only 1 use remains', async () => {
            mockRuntime({ [`${playerName}.wildShapeUses`]: 1 });

            const result = await handle(makeAction({ doubleEmanation: true }), makePlayerStats(), campaignName);

            expect(result.payload.description).toBe(
                'Oceanic Gift: Not enough Wild Shape uses remaining. 2 uses required.'
            );
            expect(setRuntimeValue).not.toHaveBeenCalled();
        });

        it('returns the oceanicGiftTarget modal with the full strict payload, filtering allies only', async () => {
            mockRuntime({ [`${playerName}.wildShapeUses`]: 3 });
            loadCombatSummary.mockResolvedValue({
                creatures: [
                    { name: playerName, type: 'player' },
                    makeAlly(),
                    makeAlly({ name: 'AllyTwo' }),
                    makeEnemy(),
                    makeEnemy({ name: 'Orc' }),
                ],
            });
            buildSaveDc.mockReturnValue(17);

            const stats = makePlayerStats({ abilities: [{ name: 'Wisdom', bonus: 3 }] });
            const result = await handle(makeAction(), stats, campaignName);

            expect(result.type).toBe('modal');
            expect(result.modalName).toBe('oceanicGiftTarget');
            expect(buildSaveDc).toHaveBeenCalledWith({ type: 'oceanic_gift' }, stats);
            expect(result.payload).toEqual({
                action: makeAction(),
                playerStats: stats,
                campaignName,
                creatureTargets: [makeAlly(), makeAlly({ name: 'AllyTwo' })],
                spellSaveDc: 17,
                wisMod: 3,
                doubleEmanation: false,
                cost: 1,
                availableUses: 3,
            });
        });

        it('returns an empty target list when combatSummary is null or has no creatures', async () => {
            mockRuntime({ [`${playerName}.wildShapeUses`]: 2 });
            buildSaveDc.mockReturnValue(13);

            loadCombatSummary.mockResolvedValue(null);
            const nullResult = await handle(makeAction(), makePlayerStats(), campaignName);
            expect(nullResult.type).toBe('modal');
            expect(nullResult.payload.creatureTargets).toEqual([]);

            loadCombatSummary.mockResolvedValue({});
            const emptyResult = await handle(makeAction(), makePlayerStats(), campaignName);
            expect(emptyResult.payload.creatureTargets).toEqual([]);
        });

        it('falls back to class_levels wild_shape when the runtime value is undefined or null', async () => {
            loadCombatSummary.mockResolvedValue({ creatures: [] });
            buildSaveDc.mockReturnValue(13);

            mockRuntime({});
            const result = await handle(makeAction(), makePlayerStats(), campaignName);

            expect(result.type).toBe('modal');
            expect(result.payload.availableUses).toBe(2);

            mockRuntime({ [`${playerName}.wildShapeUses`]: null });
            const nullResult = await handle(makeAction(), makePlayerStats(), campaignName);

            expect(nullResult.type).toBe('modal');
            expect(nullResult.payload.availableUses).toBe(2);
        });

        it('blocks when class_levels provides no wild_shape and the runtime value is unset', async () => {
            mockRuntime({});
            const stats = { name: playerName, level: 3, abilities: [] };

            const result = await handle(makeAction(), stats, campaignName);

            expect(result.type).toBe('popup');
            expect(loadCombatSummary).not.toHaveBeenCalled();
        });

        it.each([
            { doubleEmanation: false, uses: 1 },
            { doubleEmanation: true, uses: 2 },
        ])('allows activation when uses exactly equal cost (double=$doubleEmanation)', async ({ doubleEmanation, uses }) => {
            mockRuntime({ [`${playerName}.wildShapeUses`]: uses });
            loadCombatSummary.mockResolvedValue({ creatures: [makeAlly()] });
            buildSaveDc.mockReturnValue(13);

            const result = await handle(makeAction({ doubleEmanation }), makePlayerStats(), campaignName);

            expect(result.type).toBe('modal');
            expect(result.payload.cost).toBe(uses);
            expect(result.payload.availableUses).toBe(uses);
        });

        it('uses Wisdom bonus from abilities and falls back to 1 when the ability is missing', async () => {
            mockRuntime({ [`${playerName}.wildShapeUses`]: 2 });
            loadCombatSummary.mockResolvedValue({ creatures: [] });
            buildSaveDc.mockReturnValue(13);

            const withWis = await handle(makeAction(), makePlayerStats({ abilities: [{ name: 'Wisdom', bonus: 5 }] }), campaignName);
            expect(withWis.payload.wisMod).toBe(5);

            const withoutWis = await handle(makeAction(), { name: playerName }, campaignName);
            expect(withoutWis.payload.wisMod).toBe(1);
        });
    });

    describe('confirmOceanicGift', () => {
        it('single variant: spends 1 use, writes exactly the four ally wrath keys, and pops the grant message', async () => {
            mockRuntime({ [`${playerName}.wildShapeUses`]: 3 });

            const result = await confirmOceanicGift(confirmArgs({ spellSaveDc: 14, wisMod: 2 }));

            expect(setRuntimeValue.mock.calls).toEqual([
                [playerName, 'wildShapeUses', 2, campaignName],
                ['AllyOne', 'wrathOfTheSeaActive', true, campaignName],
                ['AllyOne', 'wrathOfTheSeaDc', 14, campaignName],
                ['AllyOne', 'wrathOfTheSeaWisMod', 2, campaignName],
                ['AllyOne', 'wrathOfTheSeaSource', playerName, campaignName],
            ]);
            expect(addEntry).toHaveBeenCalledTimes(1);
            expect(addEntry).toHaveBeenCalledWith(campaignName, {
                type: 'ability_use',
                characterName: playerName,
                abilityName: 'Oceanic Gift',
                description: 'Maribelle used Oceanic Gift to grant Wrath of the Sea to AllyOne.',
                timestamp: expect.any(Number),
            });
            expect(result).toEqual({
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: 'Oceanic Gift',
                    automationType: 'oceanic_gift',
                    description: 'Oceanic Gift — Wrath of the Sea granted to AllyOne. ',
                    automation: { type: 'oceanic_gift' },
                },
            });
        });

        it('treats a null wildShapeUses runtime value as 0 and writes -1', async () => {
            mockRuntime({ [`${playerName}.wildShapeUses`]: null });

            await confirmOceanicGift(confirmArgs());

            expect(setRuntimeValue.mock.calls[0]).toEqual([playerName, 'wildShapeUses', -1, campaignName]);
        });

        it.each([null, ''])('skips ally grants and the log when selectedAllyName is %s', async (selectedAllyName) => {
            mockRuntime({ [`${playerName}.wildShapeUses`]: 2 });

            const result = await confirmOceanicGift(confirmArgs({ selectedAllyName }));

            expect(setRuntimeValue.mock.calls).toEqual([
                [playerName, 'wildShapeUses', 1, campaignName],
            ]);
            expect(addEntry).not.toHaveBeenCalled();
            expect(result.payload.description).toBe('Oceanic Gift skipped.');
        });

        it('returns the popup even when addEntry rejects', async () => {
            mockRuntime({ [`${playerName}.wildShapeUses`]: 2 });
            addEntry.mockRejectedValueOnce(new Error('log error'));

            const result = await confirmOceanicGift(confirmArgs());

            expect(result.payload.description).toContain('Wrath of the Sea granted to AllyOne');
            expect(setRuntimeValue).toHaveBeenCalledWith('AllyOne', 'wrathOfTheSeaActive', true, campaignName);
        });
    });

    describe('CLA-240 double-emanation variant', () => {
        it('passes availableUses into the modal payload', async () => {
            mockRuntime({ [`${playerName}.wildShapeUses`]: 3 });
            loadCombatSummary.mockResolvedValue({ creatures: [makeAlly()] });
            buildSaveDc.mockReturnValue(17);

            const result = await handle(makeAction({ doubleEmanation: true }), makePlayerStats(), campaignName);

            expect(result.payload.availableUses).toBe(3);
            expect(result.payload.doubleEmanation).toBe(true);
            expect(result.payload.cost).toBe(2);
        });

        it('blocks the double variant with a popup and spends nothing when only 1 use remains', async () => {
            mockRuntime({ [`${playerName}.wildShapeUses`]: 1 });

            const result = await confirmOceanicGift(confirmArgs({ doubleEmanation: true, spellSaveDc: 17, wisMod: 3 }));

            expect(result).toEqual({
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: 'Oceanic Gift',
                    description: 'Oceanic Gift: Not enough Wild Shape uses remaining. 2 uses required.',
                    automation: { type: 'oceanic_gift' },
                },
            });
            expect(setRuntimeValue).not.toHaveBeenCalled();
            expect(addEntry).not.toHaveBeenCalled();
        });

        it('spends 2 uses, grants druid and ally in full, and logs both entries', async () => {
            mockRuntime({ [`${playerName}.wildShapeUses`]: 2 });

            const result = await confirmOceanicGift(confirmArgs({
                action: makeAction({ doubleEmanation: true }),
                doubleEmanation: true,
                spellSaveDc: 17,
                wisMod: 3,
            }));

            expect(setRuntimeValue.mock.calls).toEqual([
                [playerName, 'wildShapeUses', 0, campaignName],
                ['AllyOne', 'wrathOfTheSeaActive', true, campaignName],
                ['AllyOne', 'wrathOfTheSeaDc', 17, campaignName],
                ['AllyOne', 'wrathOfTheSeaWisMod', 3, campaignName],
                ['AllyOne', 'wrathOfTheSeaSource', playerName, campaignName],
                [playerName, 'wrathOfTheSeaActive', true, campaignName],
                [playerName, 'wrathOfTheSeaDc', 17, campaignName],
                [playerName, 'wrathOfTheSeaWisMod', 3, campaignName],
            ]);
            expect(addEntry).toHaveBeenCalledTimes(2);
            expect(addEntry).toHaveBeenNthCalledWith(2, campaignName, {
                type: 'ability_use',
                characterName: playerName,
                abilityName: 'Oceanic Gift',
                description: 'Maribelle manifested Wrath of the Sea around both themselves and AllyOne.',
                timestamp: expect.any(Number),
            });
            expect(result.payload.description).toBe(
                'Oceanic Gift — Wrath of the Sea granted to AllyOne. You also gain the Emanation.'
            );
        });
    });

    describe('clearOceanicGiftAllies', () => {
        it('delegates a single null write of the oceanicGiftAllies key', () => {
            clearOceanicGiftAllies(playerName, campaignName);

            expect(setRuntimeValue.mock.calls).toEqual([
                [playerName, 'oceanicGiftAllies', null, campaignName],
            ]);
        });
    });
});
