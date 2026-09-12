// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
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

describe('oceanicGiftHandler', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('handle', () => {
        it('returns popup when not enough Wild Shape uses remaining', async () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (name === playerName && key === 'wildShapeUses') return 0;
                return undefined;
            });

            const result = await handle(makeAction(), makePlayerStats(), campaignName);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('Not enough Wild Shape uses remaining');
            expect(result.payload.description).toContain('1 use required');
            expect(result.payload.automation).toEqual(makeAction().automation);
        });

        it('returns popup with "uses" plural when doubleEmanation requires 2', async () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (name === playerName && key === 'wildShapeUses') return 1;
                return undefined;
            });

            const result = await handle(makeAction({ doubleEmanation: true }), makePlayerStats(), campaignName);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('2 uses required');
        });

        it('returns modal with ally targets when enough Wild Shape uses', async () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (name === playerName && key === 'wildShapeUses') return 2;
                return undefined;
            });
            loadCombatSummary.mockResolvedValue({
                creatures: [
                    { name: playerName, type: 'player' },
                    makeAlly(),
                    makeAlly({ name: 'AllyTwo' }),
                    makeEnemy(),
                ],
            });
            buildSaveDc.mockReturnValue(13);

            const result = await handle(makeAction(), makePlayerStats(), campaignName);

            expect(result.type).toBe('modal');
            expect(result.modalName).toBe('oceanicGiftTarget');
            expect(result.payload.creatureTargets).toHaveLength(2);
            expect(result.payload.creatureTargets[0].name).toBe('AllyOne');
            expect(result.payload.creatureTargets[1].name).toBe('AllyTwo');
        });

        it('excludes the player themselves from ally targets', async () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (name === playerName && key === 'wildShapeUses') return 2;
                return undefined;
            });
            loadCombatSummary.mockResolvedValue({
                creatures: [
                    { name: playerName, type: 'player' },
                    makeAlly(),
                ],
            });
            buildSaveDc.mockReturnValue(13);

            const result = await handle(makeAction(), makePlayerStats(), campaignName);

            expect(result.payload.creatureTargets).toHaveLength(1);
            expect(result.payload.creatureTargets[0].name).toBe('AllyOne');
        });

        it('excludes NPCs from ally targets', async () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (name === playerName && key === 'wildShapeUses') return 2;
                return undefined;
            });
            loadCombatSummary.mockResolvedValue({
                creatures: [
                    makeEnemy(),
                    makeEnemy({ name: 'Orc' }),
                ],
            });
            buildSaveDc.mockReturnValue(13);

            const result = await handle(makeAction(), makePlayerStats(), campaignName);

            expect(result.payload.creatureTargets).toHaveLength(0);
        });

        it('handles null combatSummary gracefully', async () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (name === playerName && key === 'wildShapeUses') return 2;
                return undefined;
            });
            loadCombatSummary.mockResolvedValue(null);
            buildSaveDc.mockReturnValue(13);

            const result = await handle(makeAction(), makePlayerStats(), campaignName);

            expect(result.type).toBe('modal');
            expect(result.payload.creatureTargets).toEqual([]);
        });

        it('handles combatSummary with no creatures property', async () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (name === playerName && key === 'wildShapeUses') return 2;
                return undefined;
            });
            loadCombatSummary.mockResolvedValue({});
            buildSaveDc.mockReturnValue(13);

            const result = await handle(makeAction(), makePlayerStats(), campaignName);

            expect(result.payload.creatureTargets).toEqual([]);
        });

        it('passes spellSaveDc from buildSaveDc into payload', async () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (name === playerName && key === 'wildShapeUses') return 2;
                return undefined;
            });
            loadCombatSummary.mockResolvedValue({ creatures: [makeAlly()] });
            buildSaveDc.mockReturnValue(15);

            const result = await handle(makeAction(), makePlayerStats(), campaignName);

            expect(result.payload.spellSaveDc).toBe(15);
        });

        it('passes wisMod from playerStats Wisdom ability into payload', async () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (name === playerName && key === 'wildShapeUses') return 2;
                return undefined;
            });
            loadCombatSummary.mockResolvedValue({ creatures: [] });
            buildSaveDc.mockReturnValue(13);

            const stats = makePlayerStats({ abilities: [{ name: 'Wisdom', bonus: 3 }] });
            const result = await handle(makeAction(), stats, campaignName);

            expect(result.payload.wisMod).toBe(3);
        });

        it('uses fallback wisMod of 1 when Wisdom ability is missing', async () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (name === playerName && key === 'wildShapeUses') return 2;
                return undefined;
            });
            loadCombatSummary.mockResolvedValue({ creatures: [] });
            buildSaveDc.mockReturnValue(13);

            const emptyStats = { name: playerName };
            const result = await handle(makeAction(), emptyStats, campaignName);

            expect(result.payload.wisMod).toBe(1);
        });

        it('passes doubleEmanation flag into payload', async () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (name === playerName && key === 'wildShapeUses') return 2;
                return undefined;
            });
            loadCombatSummary.mockResolvedValue({ creatures: [makeAlly()] });
            buildSaveDc.mockReturnValue(13);

            const result = await handle(makeAction({ doubleEmanation: true }), makePlayerStats(), campaignName);

            expect(result.payload.doubleEmanation).toBe(true);
            expect(result.payload.cost).toBe(2);
        });

        it('passes cost=1 when doubleEmanation is not set', async () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (name === playerName && key === 'wildShapeUses') return 2;
                return undefined;
            });
            loadCombatSummary.mockResolvedValue({ creatures: [makeAlly()] });
            buildSaveDc.mockReturnValue(13);

            const result = await handle(makeAction(), makePlayerStats(), campaignName);

            expect(result.payload.doubleEmanation).toBe(false);
            expect(result.payload.cost).toBe(1);
        });

        it('uses wild_shape from class_levels as fallback when wildShapeUses runtime value is undefined (via ??)', async () => {
            // getRuntimeValue returns undefined, ?? falls back to maxWS (2), so it passes
            getRuntimeValue.mockReturnValue(undefined);

            const result = await handle(makeAction(), makePlayerStats(), campaignName);

            expect(result.type).toBe('modal');
        });

        it('uses wild_shape from class_levels as fallback when wildShapeUses runtime value is null (via ??)', async () => {
            // getRuntimeValue returns null, ?? falls back to maxWS (2), so it passes
            getRuntimeValue.mockReturnValue(null);

            const result = await handle(makeAction(), makePlayerStats(), campaignName);

            expect(result.type).toBe('modal');
        });

        it('allows activation when currentWS exactly equals cost', async () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (name === playerName && key === 'wildShapeUses') return 1;
                return undefined;
            });
            loadCombatSummary.mockResolvedValue({ creatures: [makeAlly()] });
            buildSaveDc.mockReturnValue(13);

            const result = await handle(makeAction(), makePlayerStats(), campaignName);

            expect(result.type).toBe('modal');
        });

        it('passes action and playerStats into modal payload', async () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (name === playerName && key === 'wildShapeUses') return 2;
                return undefined;
            });
            loadCombatSummary.mockResolvedValue({ creatures: [makeAlly()] });
            buildSaveDc.mockReturnValue(13);

            const result = await handle(makeAction(), makePlayerStats(), campaignName);

            expect(result.payload.action).toEqual(makeAction());
            expect(result.payload.playerStats).toEqual(makePlayerStats());
            expect(result.payload.campaignName).toBe(campaignName);
        });
    });

    describe('confirmOceanicGift', () => {
        it('grants wrathOfTheSeaActive to selected ally', async () => {
            const result = await confirmOceanicGift({
                action: makeAction(),
                playerStats: makePlayerStats(),
                campaignName,
                selectedAllyName: 'AllyOne',
                spellSaveDc: 13,
                wisMod: 1,
                doubleEmanation: false,
            })

            expect(setRuntimeValue).toHaveBeenCalledWith('AllyOne', 'wrathOfTheSeaActive', true, campaignName);
            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('Wrath of the Sea granted to AllyOne');
        });

        it('sets wrathOfTheSeaDc on the ally', async () => {
            await confirmOceanicGift({
                action: makeAction(),
                playerStats: makePlayerStats(),
                campaignName,
                selectedAllyName: 'AllyTwo',
                spellSaveDc: 15,
                wisMod: 3,
                doubleEmanation: false,
            })

            expect(setRuntimeValue).toHaveBeenCalledWith('AllyTwo', 'wrathOfTheSeaDc', 15, campaignName);
        });

        it('sets wrathOfTheSeaWisMod on the ally', async () => {
            await confirmOceanicGift({
                action: makeAction(),
                playerStats: makePlayerStats(),
                campaignName,
                selectedAllyName: 'AllyTwo',
                spellSaveDc: 15,
                wisMod: 3,
                doubleEmanation: false,
            })

            expect(setRuntimeValue).toHaveBeenCalledWith('AllyTwo', 'wrathOfTheSeaWisMod', 3, campaignName);
        });

        it('sets wrathOfTheSeaSource on the ally', async () => {
            await confirmOceanicGift({
                action: makeAction(),
                playerStats: makePlayerStats(),
                campaignName,
                selectedAllyName: 'AllyTwo',
                spellSaveDc: 15,
                wisMod: 3,
                doubleEmanation: false,
            })

            expect(setRuntimeValue).toHaveBeenCalledWith('AllyTwo', 'wrathOfTheSeaSource', playerName, campaignName);
        });

        it('logs an ability_use entry when ally is selected', async () => {
            await confirmOceanicGift({
                action: makeAction(),
                playerStats: makePlayerStats(),
                campaignName,
                selectedAllyName: 'AllyOne',
                spellSaveDc: 13,
                wisMod: 1,
                doubleEmanation: false,
            })

            expect(addEntry).toHaveBeenCalledWith(
                campaignName,
                expect.objectContaining({
                    type: 'ability_use',
                    characterName: playerName,
                    abilityName: 'Oceanic Gift',
                }),
            );
        });

        it('grants wrathOfTheSeaActive to the player when doubleEmanation is true', async () => {
            await confirmOceanicGift({
                action: makeAction({ doubleEmanation: true }),
                playerStats: makePlayerStats(),
                campaignName,
                selectedAllyName: 'AllyOne',
                spellSaveDc: 13,
                wisMod: 1,
                doubleEmanation: true,
            })

            expect(setRuntimeValue).toHaveBeenCalledWith(playerName, 'wrathOfTheSeaActive', true, campaignName);
        });

        it('logs with combined message when doubleEmanation is true', async () => {
            await confirmOceanicGift({
                action: makeAction({ doubleEmanation: true }),
                playerStats: makePlayerStats(),
                campaignName,
                selectedAllyName: 'AllyOne',
                spellSaveDc: 13,
                wisMod: 1,
                doubleEmanation: true,
            })

            expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
                description: expect.stringContaining('both themselves and AllyOne'),
            }));
        });

        it('deducts cost from wildShapeUses', async () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (name === playerName && key === 'wildShapeUses') return 3;
                return undefined;
            });

            await confirmOceanicGift({
                action: makeAction(),
                playerStats: makePlayerStats(),
                campaignName,
                selectedAllyName: 'AllyOne',
                spellSaveDc: 13,
                wisMod: 1,
                doubleEmanation: false,
            })

            expect(setRuntimeValue).toHaveBeenCalledWith(playerName, 'wildShapeUses', 2, campaignName);
        });

        it('deducts 2 from wildShapeUses when doubleEmanation', async () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (name === playerName && key === 'wildShapeUses') return 3;
                return undefined;
            });

            await confirmOceanicGift({
                action: makeAction({ doubleEmanation: true }),
                playerStats: makePlayerStats(),
                campaignName,
                selectedAllyName: 'AllyOne',
                spellSaveDc: 13,
                wisMod: 1,
                doubleEmanation: true,
            })

            expect(setRuntimeValue).toHaveBeenCalledWith(playerName, 'wildShapeUses', 1, campaignName);
        });

        it('handles null wildShapeUses runtime value (treats as 0)', async () => {
            getRuntimeValue.mockReturnValue(null);

            await confirmOceanicGift({
                action: makeAction(),
                playerStats: makePlayerStats(),
                campaignName,
                selectedAllyName: 'AllyOne',
                spellSaveDc: 13,
                wisMod: 1,
                doubleEmanation: false,
            })

            expect(setRuntimeValue).toHaveBeenCalledWith(playerName, 'wildShapeUses', -1, campaignName);
        });

        it('skips ally grants when selectedAllyName is null', async () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (name === playerName && key === 'wildShapeUses') return 2;
                return undefined;
            });

            const result = await confirmOceanicGift({
                action: makeAction(),
                playerStats: makePlayerStats(),
                campaignName,
                selectedAllyName: null,
                spellSaveDc: 13,
                wisMod: 1,
                doubleEmanation: false,
            })

            expect(setRuntimeValue).toHaveBeenCalledWith(playerName, 'wildShapeUses', 1, campaignName);
            expect(setRuntimeValue).not.toHaveBeenCalledWith('AllyOne', 'wrathOfTheSeaActive', true, campaignName);
            expect(result.payload.description).toContain('skipped');
        });

        it('skips ally grants when selectedAllyName is empty string', async () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (name === playerName && key === 'wildShapeUses') return 2;
                return undefined;
            });

            const result = await confirmOceanicGift({
                action: makeAction(),
                playerStats: makePlayerStats(),
                campaignName,
                selectedAllyName: '',
                spellSaveDc: 13,
                wisMod: 1,
                doubleEmanation: false,
            })

            expect(result.payload.description).toContain('skipped');
        });

        it('includes automationType in popup when doubleEmanation', async () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (name === playerName && key === 'wildShapeUses') return 3;
                return undefined;
            });

            const result = await confirmOceanicGift({
                action: makeAction({ doubleEmanation: true }),
                playerStats: makePlayerStats(),
                campaignName,
                selectedAllyName: 'AllyOne',
                spellSaveDc: 13,
                wisMod: 1,
                doubleEmanation: true,
            })

            expect(result.payload.description).toContain('You also gain the Emanation');
        });

        it('does not include Emanation text when doubleEmanation is false', async () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (name === playerName && key === 'wildShapeUses') return 2;
                return undefined;
            });

            const result = await confirmOceanicGift({
                action: makeAction(),
                playerStats: makePlayerStats(),
                campaignName,
                selectedAllyName: 'AllyOne',
                spellSaveDc: 13,
                wisMod: 1,
                doubleEmanation: false,
            })

            expect(result.payload.description).not.toContain('You also gain the Emanation');
            expect(result.payload.description).toContain('Wrath of the Sea granted to AllyOne');
        });

        it('passes action.automation into popup payload', async () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (name === playerName && key === 'wildShapeUses') return 2;
                return undefined;
            });

            const result = await confirmOceanicGift({
                action: makeAction({ doubleEmanation: true }),
                playerStats: makePlayerStats(),
                campaignName,
                selectedAllyName: 'AllyOne',
                spellSaveDc: 13,
                wisMod: 1,
                doubleEmanation: true,
            })

            expect(result.payload.automation).toEqual(makeAction({ doubleEmanation: true }).automation);
        });

        it('handles addEntry rejection gracefully', async () => {
            addEntry.mockRejectedValue(new Error('log error'));
            getRuntimeValue.mockImplementation((name, key) => {
                if (name === playerName && key === 'wildShapeUses') return 2;
                return undefined;
            });

            const result = await confirmOceanicGift({
                action: makeAction(),
                playerStats: makePlayerStats(),
                campaignName,
                selectedAllyName: 'AllyOne',
                spellSaveDc: 13,
                wisMod: 1,
                doubleEmanation: false,
            })

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Wrath of the Sea granted to AllyOne');
        });

        it('sets all four wrathOfTheSea runtime values on the ally', async () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (name === playerName && key === 'wildShapeUses') return 2;
                return undefined;
            });

            await confirmOceanicGift({
                action: makeAction(),
                playerStats: makePlayerStats(),
                campaignName,
                selectedAllyName: 'AllyOne',
                spellSaveDc: 14,
                wisMod: 2,
                doubleEmanation: false,
            })

            expect(setRuntimeValue).toHaveBeenCalledWith('AllyOne', 'wrathOfTheSeaActive', true, campaignName);
            expect(setRuntimeValue).toHaveBeenCalledWith('AllyOne', 'wrathOfTheSeaDc', 14, campaignName);
            expect(setRuntimeValue).toHaveBeenCalledWith('AllyOne', 'wrathOfTheSeaWisMod', 2, campaignName);
            expect(setRuntimeValue).toHaveBeenCalledWith('AllyOne', 'wrathOfTheSeaSource', playerName, campaignName);
        });
    });

    describe('CLA-240 double-emanation variant', () => {
        it('passes availableUses (current Wild Shape uses) into the modal payload', async () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (name === playerName && key === 'wildShapeUses') return 3;
                return undefined;
            });
            loadCombatSummary.mockResolvedValue({ creatures: [makeAlly()] });
            buildSaveDc.mockReturnValue(17);

            const result = await handle(makeAction(), makePlayerStats(), campaignName);

            expect(result.payload.availableUses).toBe(3);
        });

        it('blocks the double variant with a popup and spends nothing when only 1 use remains', async () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (name === playerName && key === 'wildShapeUses') return 1;
                return undefined;
            });

            const result = await confirmOceanicGift({
                action: makeAction(),
                playerStats: makePlayerStats(),
                campaignName,
                selectedAllyName: 'AllyOne',
                spellSaveDc: 17,
                wisMod: 3,
                doubleEmanation: true,
            })

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Not enough Wild Shape uses remaining');
            expect(result.payload.description).toContain('2 uses required');
            expect(setRuntimeValue).not.toHaveBeenCalledWith(playerName, 'wildShapeUses', 0, campaignName);
            expect(setRuntimeValue).not.toHaveBeenCalledWith('AllyOne', 'wrathOfTheSeaActive', true, campaignName);
        });

        it('spends 2 uses and grants both druid and ally when 2 uses remain', async () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (name === playerName && key === 'wildShapeUses') return 2;
                return undefined;
            });

            const result = await confirmOceanicGift({
                action: makeAction(),
                playerStats: makePlayerStats(),
                campaignName,
                selectedAllyName: 'AllyOne',
                spellSaveDc: 17,
                wisMod: 3,
                doubleEmanation: true,
            })

            expect(setRuntimeValue).toHaveBeenCalledWith(playerName, 'wildShapeUses', 0, campaignName);
            expect(setRuntimeValue).toHaveBeenCalledWith('AllyOne', 'wrathOfTheSeaActive', true, campaignName);
            expect(setRuntimeValue).toHaveBeenCalledWith(playerName, 'wrathOfTheSeaActive', true, campaignName);
            expect(result.payload.description).toContain('You also gain the Emanation');
            expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
                type: 'ability_use',
                description: expect.stringContaining('both themselves and AllyOne'),
            }));
        });

        it('sets wrathOfTheSeaDc and wrathOfTheSeaWisMod on the druid for the double variant', async () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (name === playerName && key === 'wildShapeUses') return 2;
                return undefined;
            });

            await confirmOceanicGift({
                action: makeAction(),
                playerStats: makePlayerStats(),
                campaignName,
                selectedAllyName: 'AllyOne',
                spellSaveDc: 17,
                wisMod: 3,
                doubleEmanation: true,
            })

            expect(setRuntimeValue).toHaveBeenCalledWith(playerName, 'wrathOfTheSeaDc', 17, campaignName);
            expect(setRuntimeValue).toHaveBeenCalledWith(playerName, 'wrathOfTheSeaWisMod', 3, campaignName);
        });

        it('does NOT write wrathOfTheSea keys on the druid for the verified single variant', async () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (name === playerName && key === 'wildShapeUses') return 2;
                return undefined;
            });

            await confirmOceanicGift({
                action: makeAction(),
                playerStats: makePlayerStats(),
                campaignName,
                selectedAllyName: 'AllyOne',
                spellSaveDc: 17,
                wisMod: 3,
                doubleEmanation: false,
            })

            expect(setRuntimeValue).not.toHaveBeenCalledWith(playerName, 'wrathOfTheSeaActive', true, campaignName);
            expect(setRuntimeValue).not.toHaveBeenCalledWith(playerName, 'wrathOfTheSeaDc', 17, campaignName);
        });
    });

    describe('clearOceanicGiftAllies', () => {
        it('clears oceanic gift allies by setting to null', () => {
            clearOceanicGiftAllies(playerName, campaignName);

            expect(setRuntimeValue).toHaveBeenCalledWith(playerName, 'oceanicGiftAllies', null, campaignName);
        });

        it('uses the correct key constant for oceanic gift allies', () => {
            clearOceanicGiftAllies(playerName, campaignName);

            const call = setRuntimeValue.mock.calls[0];
            expect(call[1]).toBe('oceanicGiftAllies');
        });
    });
});
