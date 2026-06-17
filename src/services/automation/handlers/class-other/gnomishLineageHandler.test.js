import { describe, it, expect, vi, beforeEach } from 'vitest';
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
    setRuntimeValue: vi.fn(async () => {}),
}));

const { getRuntimeValue, setRuntimeValue } = await import('../../../../hooks/runtime/useRuntimeState.js');

beforeEach(() => {
    vi.clearAllMocks();
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
        it('returns popup when lineage already selected', async () => {
            getRuntimeValue.mockReturnValue('Forest Gnome');

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('already selected');
        });

        it('returns modal when no lineage selected', async () => {
            getRuntimeValue.mockReturnValue(undefined);

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(result.type).toBe('modal');
            expect(result.modalName).toBe('gnomishLineage');
            expect(result.payload.action).toBeInstanceOf(Object);
            expect(result.payload.playerStats).toBeInstanceOf(Object);
            expect(result.payload.campaignName).toBe('test-campaign');
        });

        it('passes action, playerStats, campaignName in modal payload', async () => {
            getRuntimeValue.mockReturnValue(undefined);

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(result.payload.action).toBeInstanceOf(Object);
            expect(result.payload.playerStats).toBeInstanceOf(Object);
            expect(result.payload.campaignName).toBe('test-campaign');
        });
    });

    describe('confirmGnomishLineage', () => {
        it('returns popup with "No lineage selected" for invalid lineage', async () => {
            const result = await confirmGnomishLineage(makePlayerStats(), 'Dwarf', 'test-campaign');

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toBe('No lineage selected.');
        });

        it('returns popup for valid Deep Gnome lineage', async () => {
            const result = await confirmGnomishLineage(makePlayerStats(), 'Deep Gnome', 'test-campaign');

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Gnomish Lineage');
            expect(result.payload.description).toContain('Deep Gnome');
            expect(result.payload.description).toContain('Intelligence');
        });

        it('returns popup for valid Forest Gnome lineage', async () => {
            const result = await confirmGnomishLineage(makePlayerStats(), 'Forest Gnome', 'test-campaign');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Forest Gnome');
            expect(result.payload.description).toContain('Intelligence');
        });

        it('returns popup for valid Rock Gnome lineage', async () => {
            const result = await confirmGnomishLineage(makePlayerStats(), 'Rock Gnome', 'test-campaign');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Rock Gnome');
            expect(result.payload.description).toContain('Intelligence');
        });

        it('stores chosen lineage in runtime value', async () => {
            await confirmGnomishLineage(makePlayerStats(), 'Deep Gnome', 'test-campaign');

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'GnomeBoy',
                '_gnomishLineageSelection',
                'Deep Gnome',
                'test-campaign'
            );
        });

        it('stores spellcasting ability in runtime value', async () => {
            await confirmGnomishLineage(makePlayerStats(), 'Forest Gnome', 'test-campaign');

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'GnomeBoy',
                '_gnomishLineageAbility',
                'Intelligence',
                'test-campaign'
            );
        });

        it('includes automation in popup payload', async () => {
            const result = await confirmGnomishLineage(makePlayerStats(), 'Rock Gnome', 'test-campaign');

            expect(result.payload.automation).toBeDefined();
            expect(result.payload.automation.type).toBe('gnomish_lineage');
        });

        it('attempts to store cantrip, level3Spell, and level5Spell in runtime values', async () => {
            await confirmGnomishLineage(makePlayerStats(), 'Deep Gnome', 'test-campaign');

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'GnomeBoy',
                '_gnomishLineageCantrip',
                undefined,
                'test-campaign'
            );
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'GnomeBoy',
                '_gnomishLineageLevel3',
                undefined,
                'test-campaign'
            );
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'GnomeBoy',
                '_gnomishLineageLevel5',
                undefined,
                'test-campaign'
            );
        });
    });

    describe('getGnomishLineageSelection', () => {
        it('returns stored lineage', () => {
            getRuntimeValue.mockReturnValue('Forest Gnome');

            expect(getGnomishLineageSelection(makePlayerStats(), 'test-campaign')).toBe('Forest Gnome');
        });

        it('returns undefined when no lineage stored', () => {
            getRuntimeValue.mockReturnValue(undefined);

            expect(getGnomishLineageSelection(makePlayerStats(), 'test-campaign')).toBeUndefined();
        });
    });

    describe('getGnomishLineageAbility', () => {
        it('returns stored ability', () => {
            getRuntimeValue.mockReturnValue('Intelligence');

            expect(getGnomishLineageAbility(makePlayerStats(), 'test-campaign')).toBe('Intelligence');
        });
    });

    describe('getGnomishLineageCantrip', () => {
        it('returns stored cantrip', () => {
            getRuntimeValue.mockReturnValue('Minor Illusion');

            expect(getGnomishLineageCantrip(makePlayerStats(), 'test-campaign')).toBe('Minor Illusion');
        });
    });

    describe('getGnomishLineageLevel3Spell', () => {
        it('returns stored level 3 spell', () => {
            getRuntimeValue.mockReturnValue('Speak with Animals');

            expect(getGnomishLineageLevel3Spell(makePlayerStats(), 'test-campaign')).toBe('Speak with Animals');
        });
    });

    describe('getGnomishLineageLevel5Spell', () => {
        it('returns stored level 5 spell', () => {
            getRuntimeValue.mockReturnValue('Call Lightning');

            expect(getGnomishLineageLevel5Spell(makePlayerStats(), 'test-campaign')).toBe('Call Lightning');
        });
    });

    describe('restoreUses', () => {
        it('clears all runtime values', async () => {
            await restoreUses('GnomeBoy', 'test-campaign');

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'GnomeBoy',
                '_gnomishLineageSelection',
                null,
                'test-campaign'
            );
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'GnomeBoy',
                '_gnomishLineageAbility',
                null,
                'test-campaign'
            );
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'GnomeBoy',
                '_gnomishLineageCantrip',
                null,
                'test-campaign'
            );
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'GnomeBoy',
                '_gnomishLineageLevel3',
                null,
                'test-campaign'
            );
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'GnomeBoy',
                '_gnomishLineageLevel5',
                null,
                'test-campaign'
            );
        });
    });
});
