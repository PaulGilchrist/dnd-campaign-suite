import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createConcentrationHandlers } from './createConcentrationHandlers.js';
import { getRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import storage from '../../services/ui/storage.js';
import {
    rollConcentrationSave,
    buildConcentrationPopup,
    cleanupConcentrationEffects,
} from '../../services/combat/concentration/concentrationService.js';
import { logConcentrationSave } from '../../services/encounters/combatLoggingService.js';

// @improved-by-ai
// @cleaned-by-ai

vi.mock('../../services/ui/storage.js', () => ({
    default: {
        get: vi.fn(),
        set: vi.fn(),
        getProperty: vi.fn(),
        setProperty: vi.fn(),
    },
}));

vi.mock('../../services/combat/concentration/concentrationService.js', () => ({
    rollConcentrationSave: vi.fn(),
    buildConcentrationPopup: vi.fn(),
    cleanupConcentrationEffects: vi.fn(),
}));

vi.mock('../../services/encounters/combatLoggingService.js', () => ({
    logConcentrationSave: vi.fn(),
}));

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

describe('createConcentrationHandlers', () => {
    let mockCombatSummary;
    let mockCharacters;
    let mockCampaignNpcs;
    let mockSetConditionPopup;
    let mockSetCombatSummary;

    beforeEach(() => {
        vi.clearAllMocks();
        // storage.set is a void function; vi.fn() returns undefined by default.
        mockCombatSummary = {
            round: 1,
            creatures: [
                { name: 'Alice', type: 'player' },
                { name: 'Goblin', type: 'npc' },
            ],
        };
        mockCharacters = [
            { name: 'Alice', saveModifiers: [], computedStats: {} },
            { name: 'Goblin', saveModifiers: [], computedStats: {} },
        ];
        mockCampaignNpcs = [];
        mockSetConditionPopup = vi.fn();
        mockSetCombatSummary = vi.fn();
    });

    function createHandlers(overrides = {}) {
        return createConcentrationHandlers({
            combatSummary: mockCombatSummary,
            campaignName: 'test-campaign',
            characters: mockCharacters,
            campaignNpcs: mockCampaignNpcs,
            mapName: 'test-map',
            setConditionPopup: mockSetConditionPopup,
            setCombatSummary: mockSetCombatSummary,
            ...overrides,
        });
    }

    function mockSuccessResult() {
        return {
            roll: 15, success: true, bonus: 2, bonusDetail: undefined,
            starryDragonFloor: false, displayRolls: [15],
        };
    }

    function mockFailureResult() {
        return {
            roll: 5, success: false, bonus: 2, bonusDetail: undefined,
            starryDragonFloor: false, displayRolls: [5],
        };
    }

    // ------------------------------------------------------------------
    // handleRollConcentrationSave — early returns
    // ------------------------------------------------------------------

    describe('handleRollConcentrationSave — early returns', () => {
        it('should return early when combatSummary is null', async () => {
            const { handleRollConcentrationSave } = createConcentrationHandlers({
                combatSummary: null,
                campaignName: 'test-campaign',
                characters: mockCharacters,
                campaignNpcs: mockCampaignNpcs,
                mapName: 'test-map',
                setConditionPopup: mockSetConditionPopup,
                setCombatSummary: mockSetCombatSummary,
            });
            await handleRollConcentrationSave('Alice');
            expect(rollConcentrationSave).not.toHaveBeenCalled();
        });

        it('should return early when creature is not found or has no concentration', async () => {
            const { handleRollConcentrationSave } = createHandlers();
            await handleRollConcentrationSave('NonExistent');
            expect(rollConcentrationSave).not.toHaveBeenCalled();

            mockCombatSummary.creatures[0].concentration = null;
            await handleRollConcentrationSave('Alice');
            expect(rollConcentrationSave).not.toHaveBeenCalled();
        });
    });

    // ------------------------------------------------------------------
    // handleRollConcentrationSave — successful save
    // ------------------------------------------------------------------

    describe('handleRollConcentrationSave — successful save', () => {
        it('should execute full flow on success and preserve concentration', async () => {
            mockCombatSummary.creatures[0].concentration = { spell: 'Fireball', dc: 13 };
            rollConcentrationSave.mockResolvedValue(mockSuccessResult());

            const { handleRollConcentrationSave } = createHandlers();
            await handleRollConcentrationSave('Alice');

            expect(rollConcentrationSave).toHaveBeenCalledWith({
                creature: { name: 'Alice', type: 'player', concentration: { spell: 'Fireball', dc: 13 } },
                concentration: { spell: 'Fireball', dc: 13 },
                characters: mockCharacters,
                campaignNpcs: mockCampaignNpcs,
                campaignName: 'test-campaign',
                mapName: 'test-map',
                getName: expect.any(Function),
                disadvantage: false,
            });
            expect(storage.set).toHaveBeenCalledWith('combatSummary', mockCombatSummary, 'test-campaign');
            expect(mockSetCombatSummary).toHaveBeenCalled();
            expect(buildConcentrationPopup).toHaveBeenCalled();
            expect(logConcentrationSave).toHaveBeenCalled();
            expect(cleanupConcentrationEffects).not.toHaveBeenCalled();
            expect(mockCombatSummary.creatures[0].concentration).toEqual({ spell: 'Fireball', dc: 13 });
        });
    });

    // ------------------------------------------------------------------
    // handleRollConcentrationSave — failed save
    // ------------------------------------------------------------------

    describe('handleRollConcentrationSave — failed save', () => {
        it('should clear concentration and call cleanup on failure', async () => {
            mockCombatSummary.creatures[0].concentration = { spell: 'Fireball', dc: 13 };
            rollConcentrationSave.mockResolvedValue(mockFailureResult());

            const { handleRollConcentrationSave } = createHandlers();
            await handleRollConcentrationSave('Alice');

            expect(mockCombatSummary.creatures[0].concentration).toBeNull();
            expect(storage.set).toHaveBeenCalledWith('combatSummary', mockCombatSummary, 'test-campaign');
            expect(buildConcentrationPopup).toHaveBeenCalled();
            expect(logConcentrationSave).toHaveBeenCalled();
            expect(cleanupConcentrationEffects).toHaveBeenCalledWith(
                'Alice',
                'Fireball',
                'test-campaign'
            );
        });
    });

    // ------------------------------------------------------------------
    // handleRollConcentrationSave — hasConcentrationBreaker (disadvantage)
    // ------------------------------------------------------------------

    describe('handleRollConcentrationSave — hasConcentrationBreaker', () => {
        it('should pass hasConcentrationBreaker=true when attacker has concentration_breaker disadvantage modifier', async () => {
            mockCombatSummary.creatures[0].concentration = { spell: 'Fireball', dc: 13 };
            rollConcentrationSave.mockResolvedValue(mockSuccessResult());
            getRuntimeValue.mockResolvedValue({ attackerName: 'Goblin' });
            mockCharacters[1].saveModifiers = [
                { condition: 'concentration_breaker', effect: 'disadvantage', source: 'Goblin' },
            ];

            const { handleRollConcentrationSave } = createHandlers();
            await handleRollConcentrationSave('Alice');

            expect(rollConcentrationSave).toHaveBeenCalledWith({
                creature: expect.any(Object),
                concentration: expect.any(Object),
                characters: expect.any(Array),
                campaignNpcs: expect.any(Array),
                campaignName: 'test-campaign',
                mapName: 'test-map',
                getName: expect.any(Function),
                disadvantage: true,
            });
            expect(logConcentrationSave).toHaveBeenCalledWith(
                expect.objectContaining({
                    campaignName: 'test-campaign',
                    creatureName: 'Alice',
                    roll: 15,
                    bonus: 2,
                    bonusDetail: undefined,
                    spellName: 'Fireball',
                    dc: 13,
                    success: true,
                    mode: 'disadvantage',
                })
            );
        });

        it('should default hasConcentrationBreaker to false when lastAttack is null', async () => {
            mockCombatSummary.creatures[0].concentration = { spell: 'Fireball', dc: 13 };
            rollConcentrationSave.mockResolvedValue(mockSuccessResult());
            getRuntimeValue.mockResolvedValue(null);

            const { handleRollConcentrationSave } = createHandlers();
            await handleRollConcentrationSave('Alice');

            expect(rollConcentrationSave).toHaveBeenCalledWith({
                creature: expect.any(Object),
                concentration: expect.any(Object),
                characters: expect.any(Array),
                campaignNpcs: expect.any(Array),
                campaignName: 'test-campaign',
                mapName: 'test-map',
                getName: expect.any(Function),
                disadvantage: false,
            });
        });

        it('should default hasConcentrationBreaker to false when lastAttack has no attackerName', async () => {
            mockCombatSummary.creatures[0].concentration = { spell: 'Fireball', dc: 13 };
            rollConcentrationSave.mockResolvedValue(mockSuccessResult());
            getRuntimeValue.mockResolvedValue({});

            const { handleRollConcentrationSave } = createHandlers();
            await handleRollConcentrationSave('Alice');

            expect(rollConcentrationSave).toHaveBeenCalledWith({
                creature: expect.any(Object),
                concentration: expect.any(Object),
                characters: expect.any(Array),
                campaignNpcs: expect.any(Array),
                campaignName: 'test-campaign',
                mapName: 'test-map',
                getName: expect.any(Function),
                disadvantage: false,
            });
        });
    });

    // ------------------------------------------------------------------
    // handleRollConcentrationSave — advantageSources from targetModifiers
    // ------------------------------------------------------------------

    describe('handleRollConcentrationSave — advantageSources', () => {
        function setupAdvantageTest(saveModifiers = []) {
            mockCombatSummary.creatures[0].concentration = { spell: 'Fireball', dc: 13 };
            rollConcentrationSave.mockResolvedValue(mockSuccessResult());
            getRuntimeValue.mockResolvedValue(null);
            mockCharacters[0].saveModifiers = saveModifiers;
        }

        it('should collect advantageSources from concentration_saving_throws, Constitution spell damage, deduplicate, and default to normal', async () => {
            const { handleRollConcentrationSave } = createHandlers();

            // concentration_saving_throws target — advantage
            setupAdvantageTest([
                { source: 'Bard', target: 'concentration_saving_throws', condition: 'bless', effect: 'advantage' },
            ]);
            await handleRollConcentrationSave('Alice');
            expect(logConcentrationSave).toHaveBeenCalledWith(
                expect.objectContaining({
                    campaignName: 'test-campaign', creatureName: 'Alice', roll: 15, bonus: 2,
                    spellName: 'Fireball', dc: 13, success: true, mode: 'advantage',
                })
            );

            vi.clearAllMocks();
            setupAdvantageTest([
                { source: 'Paladin', target: 'saving_throw', condition: 'concentration_spell_damage', effect: 'advantage', abilities: ['Constitution'] },
            ]);
            await handleRollConcentrationSave('Alice');
            expect(logConcentrationSave).toHaveBeenCalledWith(
                expect.objectContaining({
                    campaignName: 'test-campaign', creatureName: 'Alice', roll: 15, bonus: 2,
                    spellName: 'Fireball', dc: 13, success: true, mode: 'advantage',
                })
            );

            vi.clearAllMocks();
            setupAdvantageTest([
                { source: 'SomeSource', target: 'saving_throw', condition: 'concentration_spell_damage', effect: 'advantage', abilities: ['Strength'] },
            ]);
            await handleRollConcentrationSave('Alice');
            expect(logConcentrationSave).toHaveBeenCalledWith(
                expect.objectContaining({
                    campaignName: 'test-campaign', creatureName: 'Alice', roll: 15, bonus: 2,
                    spellName: 'Fireball', dc: 13, success: true, mode: 'normal',
                })
            );

            vi.clearAllMocks();
            setupAdvantageTest([
                { source: 'Bard', target: 'concentration_saving_throws', condition: 'bless', effect: 'advantage' },
                { source: 'Bard', target: 'concentration_saving_throws', condition: 'other', effect: 'advantage' },
            ]);
            await handleRollConcentrationSave('Alice');
            expect(logConcentrationSave).toHaveBeenCalledWith(
                expect.objectContaining({
                    campaignName: 'test-campaign', creatureName: 'Alice', roll: 15, bonus: 2,
                    spellName: 'Fireball', dc: 13, success: true, mode: 'advantage',
                })
            );

            vi.clearAllMocks();
            setupAdvantageTest(undefined);
            await handleRollConcentrationSave('Alice');
            expect(logConcentrationSave).toHaveBeenCalledWith(
                expect.objectContaining({
                    campaignName: 'test-campaign', creatureName: 'Alice', roll: 15, bonus: 2,
                    spellName: 'Fireball', dc: 13, success: true, mode: 'normal',
                })
            );

            vi.clearAllMocks();
            setupAdvantageTest([]);
            await handleRollConcentrationSave('Alice');
            expect(logConcentrationSave).toHaveBeenCalledWith(
                expect.objectContaining({
                    campaignName: 'test-campaign', creatureName: 'Alice', roll: 15, bonus: 2,
                    spellName: 'Fireball', dc: 13, success: true, mode: 'normal',
                })
            );
        });
    });

});
