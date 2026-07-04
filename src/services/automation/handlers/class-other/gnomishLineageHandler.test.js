// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
    handle,
    confirmGnomishLineage,
    getGnomishLineageSelection,
    getGnomishLineageAbility,
    getGnomishLineageCantrip,
    getGnomishLineageLevel3Spell,
    getGnomishLineageLevel5Spell,
    restoreUses,
} from './gnomishLineageHandler.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

const { getRuntimeValue, setRuntimeValue } = await import('../../../../hooks/runtime/useRuntimeState.js');

beforeEach(() => {
    vi.clearAllMocks();
});

afterEach(() => {
    vi.restoreAllMocks();
});

function makePlayerStats(overrides = {}) {
    return {
        name: 'GnomeBoy',
        ...overrides,
    };
}

function makeAction(overrides = {}) {
    return {
        name: 'Gnomish Lineage',
        automation: {
            type: 'gnomish_lineage',
            ...overrides.automation,
        },
        ...overrides,
    };
}

describe('gnomishLineageHandler', () => {
    describe('handle', () => {
        it('returns popup with stored lineage info when lineage already selected', async () => {
            getRuntimeValue.mockReturnValue('Forest Gnome');

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Gnomish Lineage');
            expect(result.payload.description).toBe('Gnomish Lineage: Forest Gnome (already selected).');
            expect(result.payload.automation).toEqual(makeAction().automation);
        });

        it('returns modal with payload when no lineage selected', async () => {
            getRuntimeValue.mockReturnValue(undefined);

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(result.type).toBe('modal');
            expect(result.modalName).toBe('gnomishLineage');
            expect(result.payload).toEqual({
                action: expect.objectContaining({ name: 'Gnomish Lineage' }),
                playerStats: expect.objectContaining({ name: 'GnomeBoy' }),
                campaignName: 'test-campaign',
            });
        });
    });

    describe('confirmGnomishLineage', () => {
        it('returns error popup with automation for unknown lineage', async () => {
            const result = await confirmGnomishLineage(makePlayerStats(), 'Dwarf', 'test-campaign');

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Gnomish Lineage');
            expect(result.payload.description).toBe('No lineage selected.');
            expect(result.payload.automation).toEqual({
                type: 'gnomish_lineage',
                options: expect.any(Array),
            });
        });

        it('returns success popup with correct description for Deep Gnome', async () => {
            const result = await confirmGnomishLineage(makePlayerStats(), 'Deep Gnome', 'test-campaign');

            expect(result.type).toBe('popup');
            expect(result.payload.name).toBe('Gnomish Lineage');
            expect(result.payload.description).toBe('Selected Deep Gnome lineage. Spellcasting ability: Intelligence.');
            expect(result.payload.automation.type).toBe('gnomish_lineage');
        });

        it('stores all runtime values for a valid lineage', async () => {
            await confirmGnomishLineage(makePlayerStats(), 'Deep Gnome', 'test-campaign');

            const calls = setRuntimeValue.mock.calls;
            expect(calls).toHaveLength(5);

            expect(calls[0]).toEqual(['GnomeBoy', '_gnomishLineageSelection', 'Deep Gnome', 'test-campaign']);
            expect(calls[1]).toEqual(['GnomeBoy', '_gnomishLineageAbility', 'Intelligence', 'test-campaign']);
            expect(calls[2]).toEqual(['GnomeBoy', '_gnomishLineageCantrip', 'Magic Stone', 'test-campaign']);
            expect(calls[3]).toEqual(['GnomeBoy', '_gnomishLineageLevel3', 'Nondetection', 'test-campaign']);
            expect(calls[4]).toEqual(['GnomeBoy', '_gnomishLineageLevel5', 'Passwall', 'test-campaign']);
        });

        it('uses player stats name and campaign name for runtime writes', async () => {
            await confirmGnomishLineage(makePlayerStats({ name: 'OtherPlayer' }), 'Deep Gnome', 'my-campaign');

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'OtherPlayer',
                '_gnomishLineageSelection',
                'Deep Gnome',
                'my-campaign'
            );
        });
    });

    describe('getGnomishLineageSelection', () => {
        it('returns stored lineage value', () => {
            getRuntimeValue.mockReturnValue('Forest Gnome');

            expect(getGnomishLineageSelection(makePlayerStats(), 'test-campaign')).toBe('Forest Gnome');
        });
    });

    describe('getGnomishLineageAbility', () => {
        it('returns stored ability value', () => {
            getRuntimeValue.mockReturnValue('Intelligence');

            expect(getGnomishLineageAbility(makePlayerStats(), 'test-campaign')).toBe('Intelligence');
        });
    });

    describe('getGnomishLineageCantrip', () => {
        it('returns stored cantrip value', () => {
            getRuntimeValue.mockReturnValue('Minor Illusion');

            expect(getGnomishLineageCantrip(makePlayerStats(), 'test-campaign')).toBe('Minor Illusion');
        });
    });

    describe('getGnomishLineageLevel3Spell', () => {
        it('returns stored level 3 spell value', () => {
            getRuntimeValue.mockReturnValue('Speak with Animals');

            expect(getGnomishLineageLevel3Spell(makePlayerStats(), 'test-campaign')).toBe('Speak with Animals');
        });
    });

    describe('getGnomishLineageLevel5Spell', () => {
        it('returns stored level 5 spell value', () => {
            getRuntimeValue.mockReturnValue('Call Lightning');

            expect(getGnomishLineageLevel5Spell(makePlayerStats(), 'test-campaign')).toBe('Call Lightning');
        });
    });

    describe('restoreUses', () => {
        it('clears all five runtime values by setting them to null', () => {
            restoreUses('GnomeBoy', 'test-campaign');

            const calls = setRuntimeValue.mock.calls;
            expect(calls).toHaveLength(5);

            expect(calls[0]).toEqual(['GnomeBoy', '_gnomishLineageSelection', null, 'test-campaign']);
            expect(calls[1]).toEqual(['GnomeBoy', '_gnomishLineageAbility', null, 'test-campaign']);
            expect(calls[2]).toEqual(['GnomeBoy', '_gnomishLineageCantrip', null, 'test-campaign']);
            expect(calls[3]).toEqual(['GnomeBoy', '_gnomishLineageLevel3', null, 'test-campaign']);
            expect(calls[4]).toEqual(['GnomeBoy', '_gnomishLineageLevel5', null, 'test-campaign']);
        });
    });
});
