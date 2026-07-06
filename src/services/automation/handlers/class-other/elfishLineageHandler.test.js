import { describe, it, expect, vi, beforeEach } from 'vitest';

import {
    handle,
    confirmElfisLineage,
    changeElfisLineageCantrip,
    restoreUses,
} from './elfishLineageHandler.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(async () => {}),
}));

const { getRuntimeValue, setRuntimeValue } = await import(
    '../../../../hooks/runtime/useRuntimeState.js'
);

function makePlayerStats(overrides = {}) {
    return {
        name: 'TestHero',
        proficiency: 3,
        ...overrides,
    };
}

const LINEAGE_DATA = {
    Drow: {
        ability: 'Charisma',
        cantrip: 'Dancing Lights',
        level3: 'Faerie Fire',
        level5: 'Darkness',
    },
    'High Elf': {
        ability: 'Intelligence',
        cantrip: 'Prestidigitation',
        level3: 'Detect Magic',
        level5: 'Misty Step',
        wizardCantrip: 'Prestidigitation',
    },
    'Wood Elf': {
        ability: 'Wisdom',
        cantrip: 'Druidcraft',
        level3: 'Longstrider',
        level5: 'Pass Without Trace',
    },
};

describe('elfishLineageHandler', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('handle', () => {
        it('returns modal when no lineage is selected', async () => {
            getRuntimeValue.mockReturnValue(null);

            const result = await handle(
                { name: 'Elfish Lineage', description: 'Choose an elfish lineage.', automation: { type: 'elfish_lineage' } },
                makePlayerStats(),
                'test-campaign',
                'test-map'
            );

            expect(result.type).toBe('modal');
            expect(result.modalName).toBe('elfishLineage');
            expect(result.payload.action.name).toBe('Elfish Lineage');
            expect(result.payload.playerStats).toEqual(makePlayerStats());
            expect(result.payload.campaignName).toBe('test-campaign');
        });

        it('returns popup with info when lineage is already selected', async () => {
            getRuntimeValue.mockReturnValue('Drow');

            const result = await handle(
                { name: 'Elfish Lineage', automation: { type: 'elfish_lineage' } },
                makePlayerStats(),
                'test-campaign',
                null
            );

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('Drow');
            expect(result.payload.description).toContain('already selected');
            expect(result.payload.automation.type).toBe('elfish_lineage');
        });
    });

    describe('confirmElfisLineage', () => {
        it.each(Object.entries(LINEAGE_DATA))('stores lineage data for %s', async (lineage, data) => {
            const result = await confirmElfisLineage(makePlayerStats(), lineage, 'test-campaign');

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Elfish Lineage');
            expect(result.payload.description).toContain(lineage);
            expect(result.payload.description).toContain(data.ability);
            expect(result.payload.automation).toBeDefined();
            expect(result.payload.automation.type).toBe('elfish_lineage');

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestHero', '_elfishLineageSelection', lineage, 'test-campaign'
            );
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestHero', '_elfishLineageAbility', data.ability, 'test-campaign'
            );
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestHero', '_elfishLineageCantrip', data.cantrip, 'test-campaign'
            );
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestHero', '_elfishLineageLevel3', data.level3, 'test-campaign'
            );
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestHero', '_elfishLineageLevel5', data.level5, 'test-campaign'
            );
            if (data.wizardCantrip) {
                expect(setRuntimeValue).toHaveBeenCalledWith(
                    'TestHero', '_elfishLineageWizardCantrip', data.wizardCantrip, 'test-campaign'
                );
            }
        });

        it('returns error popup when lineage is invalid, empty, or undefined', async () => {
            const invalidResult = await confirmElfisLineage(makePlayerStats(), 'Nonexistent', 'test-campaign');
            expect(invalidResult.type).toBe('popup');
            expect(invalidResult.payload.description).toBe('No lineage selected.');

            const emptyResult = await confirmElfisLineage(makePlayerStats(), '', 'test-campaign');
            expect(emptyResult.type).toBe('popup');
            expect(emptyResult.payload.description).toBe('No lineage selected.');

            const undefinedResult = await confirmElfisLineage(makePlayerStats(), undefined, 'test-campaign');
            expect(undefinedResult.type).toBe('popup');
            expect(undefinedResult.payload.description).toBe('No lineage selected.');
        });
    });

    describe('changeElfisLineageCantrip', () => {
        it('stores the new wizard cantrip and returns confirmation', async () => {
            const result = await changeElfisLineageCantrip(makePlayerStats(), 'Fire Bolt', 'test-campaign');

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('Fire Bolt');
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestHero', '_elfishLineageWizardCantrip', 'Fire Bolt', 'test-campaign'
            );
        });
    });

    describe('restoreUses', () => {
        it('clears all lineage keys including wizard cantrip', async () => {
            await restoreUses('TestHero', 'test-campaign');

            expect(setRuntimeValue).toHaveBeenCalledTimes(6);
            const calls = setRuntimeValue.mock.calls;
            const keys = calls.map((c) => c[1]);
            expect(keys).toEqual([
                '_elfishLineageSelection',
                '_elfishLineageAbility',
                '_elfishLineageCantrip',
                '_elfishLineageLevel3',
                '_elfishLineageLevel5',
                '_elfishLineageWizardCantrip',
            ]);
            calls.forEach((c) => {
                expect(c[2]).toBeNull();
            });
        });
    });
});
