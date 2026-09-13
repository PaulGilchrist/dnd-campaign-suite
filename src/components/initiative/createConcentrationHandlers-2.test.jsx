import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createConcentrationHandlers } from './createConcentrationHandlers.js';

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
    breakConcentration: vi.fn(),
    buildConcentrationPopup: vi.fn(),
    cleanupConcentrationEffects: vi.fn(),
}));

vi.mock('../../services/encounters/combatLoggingService.js', () => ({
    logConcentrationSave: vi.fn(),
    logConditionEvent: vi.fn(),
}));

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

import storage from '../../services/ui/storage.js';
import {
    breakConcentration,
    cleanupConcentrationEffects,
} from '../../services/combat/concentration/concentrationService.js';
import { logConditionEvent } from '../../services/encounters/combatLoggingService.js';

describe('createConcentrationHandlers', () => {
    let mockCombatSummary;
    let mockCharacters;
    let mockCampaignNpcs;
    let mockSetConditionPopup;
    let mockSetCombatSummary;

    beforeEach(() => {
        vi.clearAllMocks();
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

    function createHandlers() {
        return createConcentrationHandlers({
            combatSummary: mockCombatSummary,
            campaignName: 'test-campaign',
            characters: mockCharacters,
            campaignNpcs: mockCampaignNpcs,
            mapName: 'test-map',
            setConditionPopup: mockSetConditionPopup,
            setCombatSummary: mockSetCombatSummary,
        });
    }

    // ------------------------------------------------------------------
    // handleBreakConcentration — successful break
    // ------------------------------------------------------------------

    describe('handleBreakConcentration', () => {
        it('should execute full flow on break', () => {
            mockCombatSummary.creatures[0].concentration = { spell: 'Fireball', dc: 13 };
            breakConcentration.mockReturnValue('Fireball');

            const { handleBreakConcentration } = createHandlers();
            handleBreakConcentration('Alice');

            expect(breakConcentration).toHaveBeenCalledWith(mockCombatSummary, 'Alice');
            expect(storage.set).toHaveBeenCalledWith('combatSummary', mockCombatSummary, 'test-campaign');
            expect(mockSetCombatSummary).toHaveBeenCalled();
            expect(logConditionEvent).toHaveBeenCalledWith({
                campaignName: 'test-campaign',
                action: 'removed',
                creatureName: 'Alice',
                conditionLabel: 'Concentration: Fireball'
            });
            expect(cleanupConcentrationEffects).toHaveBeenCalledWith(
                'Alice',
                'Fireball',
                'test-campaign'
            );
        });
    });

});
