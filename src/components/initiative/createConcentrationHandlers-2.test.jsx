// @maintained-by-ai
// Lane split for createConcentrationHandlers.js:
//  - createConcentrationHandlers.test.jsx — handleRollConcentrationSave: early returns,
//    success/failure flows, static concentration_breaker, advantage-source modes.
//  - createConcentrationHandlers.te-disadvantage.test.jsx — MA-0038 te-driven
//    disadvantage (concentration_disadvantage) on handleRollConcentrationSave.
//  - THIS lane — handleBreakConcentration ONLY (GM manual break): exact log/persist
//    payloads, exact counts, and the SP-114 strip-summoned-before-persist invariant.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createConcentrationHandlers } from './createConcentrationHandlers.js';

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

// summonedCreatureService runs UNMOCKED here (its strip filter is part of the
// contract under test); this fake keeps its top-level runtime imports off the
// real store. stripSummonedFromCombatSummary itself touches neither.
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
                // SP-114: a spell summon of Alice must NOT survive the break write-back.
                { name: 'Fairy', type: 'npc', summonedBy: 'Alice', summonSource: 'spell' },
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
            mockCombatSummary.creatures[0].concentration = { spell: 'Conjure Animals', dc: 13 };
            breakConcentration.mockReturnValue('Conjure Animals');

            const { handleBreakConcentration } = createHandlers();
            handleBreakConcentration('Alice');

            expect(breakConcentration).toHaveBeenCalledWith(mockCombatSummary, 'Alice');
            // SP-114: real stripSummonedFromCombatSummary removed Alice's spell summon
            // in-place before the persist calls captured these payloads.
            expect(storage.set).toHaveBeenCalledTimes(1);
            expect(storage.set).toHaveBeenCalledWith('combatSummary', mockCombatSummary, 'test-campaign');
            expect(mockSetCombatSummary).toHaveBeenCalledTimes(1);
            expect(mockSetCombatSummary).toHaveBeenCalledWith({
                round: 1,
                creatures: [
                    { name: 'Alice', type: 'player', concentration: { spell: 'Conjure Animals', dc: 13 } },
                    { name: 'Goblin', type: 'npc' },
                ],
            });
            expect(logConditionEvent).toHaveBeenCalledWith({
                campaignName: 'test-campaign',
                action: 'removed',
                creatureName: 'Alice',
                conditionLabel: 'Concentration: Conjure Animals'
            });
            expect(cleanupConcentrationEffects).toHaveBeenCalledWith(
                'Alice',
                'Conjure Animals',
                'test-campaign'
            );
        });

        it('should write nothing when combatSummary is null or creature has no concentration', () => {
            createConcentrationHandlers({
                combatSummary: null,
                campaignName: 'test-campaign',
                characters: mockCharacters,
                campaignNpcs: mockCampaignNpcs,
                mapName: 'test-map',
                setConditionPopup: mockSetConditionPopup,
                setCombatSummary: mockSetCombatSummary,
            }).handleBreakConcentration('Alice');
            expect(breakConcentration).not.toHaveBeenCalled();

            // breakConcentration returns falsy when nothing is concentrated — silent no-op
            breakConcentration.mockReturnValue(undefined);
            createHandlers().handleBreakConcentration('Goblin');
            expect(breakConcentration).toHaveBeenCalledTimes(1);
            expect(breakConcentration).toHaveBeenCalledWith(mockCombatSummary, 'Goblin');

            expect(storage.set).not.toHaveBeenCalled();
            expect(mockSetCombatSummary).not.toHaveBeenCalled();
            expect(logConditionEvent).not.toHaveBeenCalled();
            expect(cleanupConcentrationEffects).not.toHaveBeenCalled();
        });
    });

});
