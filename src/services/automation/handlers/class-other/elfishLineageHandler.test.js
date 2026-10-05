// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

import {
    handle,
    confirmElfisLineage,
    changeElfisLineageCantrip,
    restoreUses,
    resolveElfishLineage,
    elfishLineageSpeedBonus,
    stampElfishLineageRuntime,
    getElfisLineageSelection,
    getElfisLineageAbility,
    getElfisLineageCantrip,
    getElfisLineageLevel3Spell,
    getElfisLineageLevel5Spell,
    getElfisLineageWizardCantrip,
} from './elfishLineageHandler.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeObject: vi.fn(),
    setRuntimeValue: vi.fn(async () => {}),
}));

const { getRuntimeValue, setRuntimeObject, setRuntimeValue } = await import(
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

    describe('getElfisLineageSelection', () => {
        it('returns the stored lineage selection', () => {
            getRuntimeValue.mockReturnValue('Drow');
            const result = getElfisLineageSelection(makePlayerStats(), 'test-campaign');
            expect(result).toBe('Drow');
            expect(getRuntimeValue).toHaveBeenCalledWith('TestHero', '_elfishLineageSelection', 'test-campaign');
        });
    });

    describe('getElfisLineageAbility', () => {
        it('returns the stored spellcasting ability', () => {
            getRuntimeValue.mockReturnValue('Charisma');
            const result = getElfisLineageAbility(makePlayerStats(), 'test-campaign');
            expect(result).toBe('Charisma');
            expect(getRuntimeValue).toHaveBeenCalledWith('TestHero', '_elfishLineageAbility', 'test-campaign');
        });
    });

    describe('getElfisLineageCantrip', () => {
        it('returns the stored cantrip', () => {
            getRuntimeValue.mockReturnValue('Dancing Lights');
            const result = getElfisLineageCantrip(makePlayerStats(), 'test-campaign');
            expect(result).toBe('Dancing Lights');
            expect(getRuntimeValue).toHaveBeenCalledWith('TestHero', '_elfishLineageCantrip', 'test-campaign');
        });
    });

    describe('getElfisLineageLevel3Spell', () => {
        it('returns the stored level 3 spell', () => {
            getRuntimeValue.mockReturnValue('Faerie Fire');
            const result = getElfisLineageLevel3Spell(makePlayerStats(), 'test-campaign');
            expect(result).toBe('Faerie Fire');
            expect(getRuntimeValue).toHaveBeenCalledWith('TestHero', '_elfishLineageLevel3', 'test-campaign');
        });
    });

    describe('getElfisLineageLevel5Spell', () => {
        it('returns the stored level 5 spell', () => {
            getRuntimeValue.mockReturnValue('Darkness');
            const result = getElfisLineageLevel5Spell(makePlayerStats(), 'test-campaign');
            expect(result).toBe('Darkness');
            expect(getRuntimeValue).toHaveBeenCalledWith('TestHero', '_elfishLineageLevel5', 'test-campaign');
        });
    });

    describe('getElfisLineageWizardCantrip', () => {
        it('returns the stored wizard cantrip', () => {
            getRuntimeValue.mockReturnValue('Prestidigitation');
            const result = getElfisLineageWizardCantrip(makePlayerStats(), 'test-campaign');
            expect(result).toBe('Prestidigitation');
            expect(getRuntimeValue).toHaveBeenCalledWith('TestHero', '_elfishLineageWizardCantrip', 'test-campaign');
        });
    });

    // CLA-118: race.subrace is authoritative when the runtime key is stale/absent
    describe('resolveElfishLineage (CLA-118 precedence)', () => {
        it('prefers race.subrace over a stale runtime selection', () => {
            getRuntimeValue.mockReturnValue('Wood Elf');
            const stats = makePlayerStats({ race: { name: 'Elf', subrace: { name: 'Drow' } } });
            expect(resolveElfishLineage(stats, 'test-campaign')).toBe('Drow');
        });

        it('falls back to the runtime selection when no subrace is persisted', () => {
            getRuntimeValue.mockReturnValue('Wood Elf');
            expect(resolveElfishLineage(makePlayerStats({ race: { name: 'Elf' } }), 'test-campaign')).toBe('Wood Elf');
        });

        it('prefers race.lineage over subrace and runtime', () => {
            getRuntimeValue.mockReturnValue('Wood Elf');
            const stats = makePlayerStats({ race: { name: 'Elf', lineage: 'High Elf', subrace: { name: 'Drow' } } });
            expect(resolveElfishLineage(stats, 'test-campaign')).toBe('High Elf');
        });
    });

    describe('elfishLineageSpeedBonus (CLA-118)', () => {
        const woodElfAuto = {
            specialActions: [{
                type: 'elfish_lineage',
                options: [{ name: 'Wood Elf', spellcastingAbility: 'Wisdom', cantrip: 'Druidcraft', level3Spell: 'Longstrider', level5Spell: 'Pass Without Trace', speedBonus: 5 }],
            }],
        };

        it('returns 5 for a 2024 Wood Elf resolved via subrace with no runtime key', () => {
            getRuntimeValue.mockReturnValue(null);
            const stats = makePlayerStats({ race: { name: 'Elf', speed: 30, subrace: { name: 'Wood Elf' } }, automation: woodElfAuto });
            expect(elfishLineageSpeedBonus(stats, 'test-campaign')).toBe(5);
        });

        it('returns 0 when the resolved lineage is not Wood Elf', () => {
            getRuntimeValue.mockReturnValue(null);
            const stats = makePlayerStats({ race: { name: 'Elf', speed: 30, subrace: { name: 'Drow' } }, automation: woodElfAuto });
            expect(elfishLineageSpeedBonus(stats, 'test-campaign')).toBe(0);
        });

        it('returns 0 when the character lacks the elfish_lineage trait', () => {
            getRuntimeValue.mockReturnValue(null);
            const stats = makePlayerStats({ race: { name: 'Elf', speed: 30, subrace: { name: 'Wood Elf' } }, automation: {} });
            expect(elfishLineageSpeedBonus(stats, 'test-campaign')).toBe(0);
        });

        it('returns 0 when the 5e subrace JSON already carries the absolute speed', () => {
            getRuntimeValue.mockReturnValue(null);
            const stats = makePlayerStats({ race: { name: 'Elf', speed: 30, subrace: { name: 'Wood Elf', speed: 35 } }, automation: woodElfAuto });
            expect(elfishLineageSpeedBonus(stats, 'test-campaign')).toBe(0);
        });

        it('logs an error and returns 0 when the Wood Elf option lacks speedBonus', () => {
            const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
            getRuntimeValue.mockReturnValue(null);
            const stats = makePlayerStats({
                race: { name: 'Elf', speed: 30, subrace: { name: 'Wood Elf' } },
                automation: { specialActions: [{ type: 'elfish_lineage', options: [{ name: 'Wood Elf', cantrip: 'Druidcraft' }] }] },
            });
            expect(elfishLineageSpeedBonus(stats, 'test-campaign')).toBe(0);
            expect(spy).toHaveBeenCalled();
            spy.mockRestore();
        });
    });

    describe('stampElfishLineageRuntime (CLA-118 wizard seam)', () => {
        it('writes all runtime lineage keys in one merged write', () => {
            stampElfishLineageRuntime('ElfTest', 'Drow', 'test-campaign');
            expect(setRuntimeObject).toHaveBeenCalledTimes(1);
            const [name, patch, campaign] = setRuntimeObject.mock.calls[0];
            expect(name).toBe('ElfTest');
            expect(campaign).toBe('test-campaign');
            expect(patch).toEqual({
                _elfishLineageSelection: 'Drow',
                _elfishLineageAbility: 'Charisma',
                _elfishLineageCantrip: 'Dancing Lights',
                _elfishLineageLevel3: 'Faerie Fire',
                _elfishLineageLevel5: 'Darkness',
            });
        });

        it('includes the wizard cantrip swap for High Elf', () => {
            stampElfishLineageRuntime('ElfTest', 'High Elf', 'test-campaign');
            expect(setRuntimeObject.mock.calls[0][1]._elfishLineageWizardCantrip).toBe('Prestidigitation');
        });

        it('logs an error and writes nothing for an unknown subrace', () => {
            const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
            stampElfishLineageRuntime('ElfTest', 'Moon Elf', 'test-campaign');
            expect(setRuntimeObject).not.toHaveBeenCalled();
            expect(spy).toHaveBeenCalled();
            spy.mockRestore();
        });
    });

    describe('handle popup precedence (CLA-118)', () => {
        it('reports the subrace-authoritative lineage, not the stale runtime value', async () => {
            getRuntimeValue.mockReturnValue('Wood Elf');
            const stats = makePlayerStats({ race: { name: 'Elf', subrace: { name: 'Drow' } } });
            const result = await handle({ name: 'Elfish Lineage', automation: { type: 'elfish_lineage' } }, stats, 'test-campaign', null);
            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Drow');
            expect(result.payload.description).not.toContain('Wood Elf');
        });
    });
});
