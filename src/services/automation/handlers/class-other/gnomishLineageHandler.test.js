@improved-by-ai
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

const { getRuntimeValue, setRuntimeValue } = await import('../../../../hooks/runtime useRuntimeState.js');

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

        it('reads lineage using player stats name and campaign name', async () => {
            getRuntimeValue.mockReturnValue(undefined);

            await handle(makeAction(), makePlayerStats({ name: 'OtherPlayer' }), 'my-campaign', null);

            expect(getRuntimeValue).toHaveBeenCalledWith('OtherPlayer', '_gnomishLineageSelection', 'my-campaign');
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

        it('returns success popup for Forest Gnome', async () => {
            const result = await confirmGnomishLineage(makePlayerStats(), 'Forest Gnome', 'test-campaign');

            expect(result.payload.description).toBe('Selected Forest Gnome lineage. Spellcasting ability: Intelligence.');
        });

        it('returns success popup for Rock Gnome', async () => {
            const result = await confirmGnomishLineage(makePlayerStats(), 'Rock Gnome', 'test-campaign');

            expect(result.payload.description).toBe('Selected Rock Gnome lineage. Spellcasting ability: Intelligence.');
        });

        it('stores all runtime values for a valid lineage', async () => {
            await confirmGnomishLineage(makePlayerStats(), 'Deep Gnome', 'test-campaign');

            const calls = setRuntimeValue.mock.calls;
            expect(calls).toHaveLength(5);

            expect(calls[0]).toEqual(['GnomeBoy', '_gnomishLineageSelection', 'Deep Gnome', 'test-campaign']);
            expect(calls[1]).toEqual(['GnomeBoy', '_gnomishLineageAbility', 'Intelligence', 'test-campaign']);
            expect(calls[2]).toEqual(['GnomeBoy', '_gnomishLineageCantrip', undefined, 'test-campaign']);
            expect(calls[3]).toEqual(['GnomeBoy', '_gnomishLineageLevel3', undefined, 'test-campaign']);
            expect(calls[4]).toEqual(['GnomeBoy', '_gnomishLineageLevel5', undefined, 'test-campaign']);
        });

        it('stores correct lineage name for each lineage type', async () => {
            await confirmGnomishLineage(makePlayerStats(), 'Forest Gnome', 'test-campaign');
            const calls = setRuntimeValue.mock.calls;
            expect(calls[0][2]).toBe('Forest Gnome');

            await confirmGnomishLineage(makePlayerStats(), 'Rock Gnome', 'test-campaign');
            const calls2 = setRuntimeValue.mock.calls;
            expect(calls2[0][2]).toBe('Rock Gnome');
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

        it('returns null when no lineage stored', () => {
            getRuntimeValue.mockReturnValue(null);

            expect(getGnomishLineageSelection(makePlayerStats(), 'test-campaign')).toBeNull();
        });

        it('passes correct keys to getRuntimeValue', () => {
            getRuntimeValue.mockReturnValue('Rock Gnome');

            getGnomishLineageSelection(makePlayerStats({ name: 'OtherPlayer' }), 'my-campaign');

            expect(getRuntimeValue).toHaveBeenCalledWith('OtherPlayer', '_gnomishLineageSelection', 'my-campaign');
        });
    });

    describe('getGnomishLineageAbility', () => {
        it('returns stored ability value', () => {
            getRuntimeValue.mockReturnValue('Intelligence');

            expect(getGnomishLineageAbility(makePlayerStats(), 'test-campaign')).toBe('Intelligence');
        });

        it('passes correct keys to getRuntimeValue', () => {
            getRuntimeValue.mockReturnValue('Wisdom');

            getGnomishLineageAbility(makePlayerStats({ name: 'OtherPlayer' }), 'my-campaign');

            expect(getRuntimeValue).toHaveBeenCalledWith('OtherPlayer', '_gnomishLineageAbility', 'my-campaign');
        });
    });

    describe('getGnomishLineageCantrip', () => {
        it('returns stored cantrip value', () => {
            getRuntimeValue.mockReturnValue('Minor Illusion');

            expect(getGnomishLineageCantrip(makePlayerStats(), 'test-campaign')).toBe('Minor Illusion');
        });

        it('passes correct keys to getRuntimeValue', () => {
            getRuntimeValue.mockReturnValue('Mending');

            getGnomishLineageCantrip(makePlayerStats({ name: 'OtherPlayer' }), 'my-campaign');

            expect(getRuntimeValue).toHaveBeenCalledWith('OtherPlayer', '_gnomishLineageCantrip', 'my-campaign');
        });
    });

    describe('getGnomishLineageLevel3Spell', () => {
        it('returns stored level 3 spell value', () => {
            getRuntimeValue.mockReturnValue('Speak with Animals');

            expect(getGnomishLineageLevel3Spell(makePlayerStats(), 'test-campaign')).toBe('Speak with Animals');
        });

        it('passes correct keys to getRuntimeValue', () => {
            getRuntimeValue.mockReturnValue('Prestidigitation');

            getGnomishLineageLevel3Spell(makePlayerStats({ name: 'OtherPlayer' }), 'my-campaign');

            expect(getRuntimeValue).toHaveBeenCalledWith('OtherPlayer', '_gnomishLineageLevel3', 'my-campaign');
        });
    });

    describe('getGnomishLineageLevel5Spell', () => {
        it('returns stored level 5 spell value', () => {
            getRuntimeValue.mockReturnValue('Call Lightning');

            expect(getGnomishLineageLevel5Spell(makePlayerStats(), 'test-campaign')).toBe('Call Lightning');
        });

        it('passes correct keys to getRuntimeValue', () => {
            getRuntimeValue.mockReturnValue('Passwall');

            getGnomishLineageLevel5Spell(makePlayerStats({ name: 'OtherPlayer' }), 'my-campaign');

            expect(getRuntimeValue).toHaveBeenCalledWith('OtherPlayer', '_gnomishLineageLevel5', 'my-campaign');
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

        it('uses player stats name and campaign name for runtime writes', () => {
            restoreUses('OtherPlayer', 'my-campaign');

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'OtherPlayer',
                '_gnomishLineageSelection',
                null,
                'my-campaign'
            );
        });
    });
});
