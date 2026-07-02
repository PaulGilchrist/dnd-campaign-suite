// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

import {
    handle,
    confirmElfisLineage,
    changeElfisLineageCantrip,
    getElfisLineageSelection,
    getElfisLineageAbility,
    getElfisLineageCantrip,
    getElfisLineageLevel3Spell,
    getElfisLineageLevel5Spell,
    getElfisLineageWizardCantrip,
    restoreUses,
} from './elfishLineageHandler.js';

// ── Mocks ──────────────────────────────────────────────────────

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(async () => {}),
}));

const { getRuntimeValue, setRuntimeValue } = await import(
    '../../../../hooks/runtime/useRuntimeState.js'
);

// ── Helpers ────────────────────────────────────────────────────

function makePlayerStats(overrides = {}) {
    return {
        name: 'TestHero',
        proficiency: 3,
        ...overrides,
    };
}

// ── Tests ──────────────────────────────────────────────────────

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

        it('passes the original action object in modal payload', async () => {
            getRuntimeValue.mockReturnValue(null);
            const action = { name: 'Elfish Lineage', automation: { type: 'elfish_lineage' } };

            const result = await handle(action, makePlayerStats(), 'test-campaign', null);

            expect(result.payload.action).toBe(action);
        });
    });

    describe('confirmElfisLineage', () => {
        it('stores Drow lineage and returns confirmation with Charisma ability', async () => {
            const result = await confirmElfisLineage(makePlayerStats(), 'Drow', 'test-campaign');

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Elfish Lineage');
            expect(result.payload.description).toContain('Drow');
            expect(result.payload.description).toContain('Charisma');
            expect(result.payload.automation).toBeDefined();
            expect(result.payload.automation.type).toBe('elfish_lineage');

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestHero',
                '_elfishLineageSelection',
                'Drow',
                'test-campaign'
            );
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestHero',
                '_elfishLineageAbility',
                'Charisma',
                'test-campaign'
            );
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestHero',
                '_elfishLineageCantrip',
                'Dancing Lights',
                'test-campaign'
            );
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestHero',
                '_elfishLineageLevel3',
                'Faerie Fire',
                'test-campaign'
            );
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestHero',
                '_elfishLineageLevel5',
                'Darkness',
                'test-campaign'
            );
        });

        it('stores High Elf lineage and sets Intelligence ability with wizard cantrip swap', async () => {
            const result = await confirmElfisLineage(makePlayerStats(), 'High Elf', 'test-campaign');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('High Elf');
            expect(result.payload.description).toContain('Intelligence');

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestHero',
                '_elfishLineageSelection',
                'High Elf',
                'test-campaign'
            );
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestHero',
                '_elfishLineageAbility',
                'Intelligence',
                'test-campaign'
            );
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestHero',
                '_elfishLineageCantrip',
                'Prestidigitation',
                'test-campaign'
            );
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestHero',
                '_elfishLineageLevel3',
                'Detect Magic',
                'test-campaign'
            );
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestHero',
                '_elfishLineageLevel5',
                'Misty Step',
                'test-campaign'
            );
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestHero',
                '_elfishLineageWizardCantrip',
                'Prestidigitation',
                'test-campaign'
            );
        });

        it('stores Wood Elf lineage and sets Wisdom ability', async () => {
            const result = await confirmElfisLineage(makePlayerStats(), 'Wood Elf', 'test-campaign');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Wood Elf');
            expect(result.payload.description).toContain('Wisdom');

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestHero',
                '_elfishLineageSelection',
                'Wood Elf',
                'test-campaign'
            );
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestHero',
                '_elfishLineageAbility',
                'Wisdom',
                'test-campaign'
            );
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestHero',
                '_elfishLineageCantrip',
                'Druidcraft',
                'test-campaign'
            );
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestHero',
                '_elfishLineageLevel3',
                'Longstrider',
                'test-campaign'
            );
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestHero',
                '_elfishLineageLevel5',
                'Pass Without Trace',
                'test-campaign'
            );
        });

        it('returns error popup when lineage name does not match any option', async () => {
            const result = await confirmElfisLineage(makePlayerStats(), 'Nonexistent', 'test-campaign');

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toBe('No lineage selected.');
        });

        it('returns error popup when lineage is an empty string', async () => {
            const result = await confirmElfisLineage(makePlayerStats(), '', 'test-campaign');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toBe('No lineage selected.');
        });

        it('returns error popup when lineage is undefined', async () => {
            const result = await confirmElfisLineage(makePlayerStats(), undefined, 'test-campaign');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toBe('No lineage selected.');
        });

        it('stores cantrip, level 3 spell, and level 5 spell for Drow lineage', async () => {
            await confirmElfisLineage(makePlayerStats(), 'Drow', 'test-campaign');

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestHero',
                '_elfishLineageCantrip',
                'Dancing Lights',
                'test-campaign'
            );
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestHero',
                '_elfishLineageLevel3',
                'Faerie Fire',
                'test-campaign'
            );
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestHero',
                '_elfishLineageLevel5',
                'Darkness',
                'test-campaign'
            );
        });

        it('stores cantrip, level 3 spell, and level 5 spell for High Elf lineage', async () => {
            await confirmElfisLineage(makePlayerStats(), 'High Elf', 'test-campaign');

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestHero',
                '_elfishLineageCantrip',
                'Prestidigitation',
                'test-campaign'
            );
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestHero',
                '_elfishLineageLevel3',
                'Detect Magic',
                'test-campaign'
            );
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestHero',
                '_elfishLineageLevel5',
                'Misty Step',
                'test-campaign'
            );
        });
    });

    describe('changeElfisLineageCantrip', () => {
        it('stores the new wizard cantrip and returns confirmation', async () => {
            const result = await changeElfisLineageCantrip(makePlayerStats(), 'Fire Bolt', 'test-campaign');

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('Fire Bolt');
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestHero',
                '_elfishLineageWizardCantrip',
                'Fire Bolt',
                'test-campaign'
            );
        });

        it('stores an empty cantrip name', async () => {
            const result = await changeElfisLineageCantrip(makePlayerStats(), '', 'test-campaign');

            expect(result.type).toBe('popup');
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestHero',
                '_elfishLineageWizardCantrip',
                '',
                'test-campaign'
            );
        });
    });

    describe('getElfisLineageSelection', () => {
        it('returns the stored lineage', () => {
            getRuntimeValue.mockReturnValue('Drow');

            const selection = getElfisLineageSelection(makePlayerStats(), 'test-campaign');
            expect(selection).toBe('Drow');
        });

        it('returns null when no lineage is stored', () => {
            getRuntimeValue.mockReturnValue(null);

            const selection = getElfisLineageSelection(makePlayerStats(), 'test-campaign');
            expect(selection).toBe(null);
        });

        it('passes the correct key and campaign to getRuntimeValue', () => {
            getRuntimeValue.mockReturnValue('Wood Elf');

            getElfisLineageSelection(makePlayerStats(), 'my-campaign');

            expect(getRuntimeValue).toHaveBeenCalledWith(
                'TestHero',
                '_elfishLineageSelection',
                'my-campaign'
            );
        });
    });

    describe('getElfisLineageAbility', () => {
        it('returns the stored spellcasting ability', () => {
            getRuntimeValue.mockReturnValue('Charisma');

            const ability = getElfisLineageAbility(makePlayerStats(), 'test-campaign');
            expect(ability).toBe('Charisma');
        });

        it('returns null when no ability is stored', () => {
            getRuntimeValue.mockReturnValue(null);

            const ability = getElfisLineageAbility(makePlayerStats(), 'test-campaign');
            expect(ability).toBe(null);
        });
    });

    describe('getElfisLineageCantrip', () => {
        it('returns the stored cantrip', () => {
            getRuntimeValue.mockReturnValue('Dancing Lights');

            const cantrip = getElfisLineageCantrip(makePlayerStats(), 'test-campaign');
            expect(cantrip).toBe('Dancing Lights');
        });

        it('returns null when no cantrip is stored', () => {
            getRuntimeValue.mockReturnValue(null);

            const cantrip = getElfisLineageCantrip(makePlayerStats(), 'test-campaign');
            expect(cantrip).toBe(null);
        });
    });

    describe('getElfisLineageLevel3Spell', () => {
        it('returns the stored level 3 spell', () => {
            getRuntimeValue.mockReturnValue('Faerie Fire');

            const spell = getElfisLineageLevel3Spell(makePlayerStats(), 'test-campaign');
            expect(spell).toBe('Faerie Fire');
        });

        it('returns null when no level 3 spell is stored', () => {
            getRuntimeValue.mockReturnValue(null);

            const spell = getElfisLineageLevel3Spell(makePlayerStats(), 'test-campaign');
            expect(spell).toBe(null);
        });
    });

    describe('getElfisLineageLevel5Spell', () => {
        it('returns the stored level 5 spell', () => {
            getRuntimeValue.mockReturnValue('Darkness');

            const spell = getElfisLineageLevel5Spell(makePlayerStats(), 'test-campaign');
            expect(spell).toBe('Darkness');
        });

        it('returns null when no level 5 spell is stored', () => {
            getRuntimeValue.mockReturnValue(null);

            const spell = getElfisLineageLevel5Spell(makePlayerStats(), 'test-campaign');
            expect(spell).toBe(null);
        });
    });

    describe('getElfisLineageWizardCantrip', () => {
        it('returns the stored wizard cantrip', () => {
            getRuntimeValue.mockReturnValue('Prestidigitation');

            const cantrip = getElfisLineageWizardCantrip(makePlayerStats(), 'test-campaign');
            expect(cantrip).toBe('Prestidigitation');
        });

        it('returns null when no wizard cantrip is stored', () => {
            getRuntimeValue.mockReturnValue(null);

            const cantrip = getElfisLineageWizardCantrip(makePlayerStats(), 'test-campaign');
            expect(cantrip).toBe(null);
        });
    });

    describe('restoreUses', () => {
        it('clears all lineage keys including wizard cantrip', async () => {
            await restoreUses('TestHero', 'test-campaign');

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestHero',
                '_elfishLineageSelection',
                null,
                'test-campaign'
            );
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestHero',
                '_elfishLineageAbility',
                null,
                'test-campaign'
            );
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestHero',
                '_elfishLineageCantrip',
                null,
                'test-campaign'
            );
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestHero',
                '_elfishLineageLevel3',
                null,
                'test-campaign'
            );
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestHero',
                '_elfishLineageLevel5',
                null,
                'test-campaign'
            );
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestHero',
                '_elfishLineageWizardCantrip',
                null,
                'test-campaign'
            );
        });

        it('uses the provided player name, not playerStats.name', async () => {
            await restoreUses('DifferentPlayer', 'test-campaign');

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'DifferentPlayer',
                '_elfishLineageSelection',
                null,
                'test-campaign'
            );
        });
    });
});
