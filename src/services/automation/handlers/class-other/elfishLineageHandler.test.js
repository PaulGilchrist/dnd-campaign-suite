import { describe, it, expect, vi, beforeEach } from 'vitest';

import { handle, confirmElfisLineage, changeElfisLineageCantrip, getElfisLineageSelection, getElfisLineageAbility, getElfisLineageCantrip, getElfisLineageLevel3Spell, getElfisLineageLevel5Spell, getElfisLineageWizardCantrip, restoreUses } from './elfishLineageHandler.js';

// ── Mocks ──────────────────────────────────────────────────────

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(() => null),
    setRuntimeValue: vi.fn(async () => {}),
}));

// ── Re-import after mocking ────────────────────────────────────

import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';

// ── Helpers ────────────────────────────────────────────────────

function makeAction(overrides = {}) {
    return {
        name: 'Elfish Lineage',
        description: 'Choose an elfish lineage.',
        automation: { type: 'elfish_lineage' },
        ...overrides,
    };
}

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
        it('should return modal when no lineage is selected', async () => {
            getRuntimeValue.mockReturnValue(null);
            const action = makeAction();
            const result = await handle(action, makePlayerStats(), 'campaign', 'map');

            expect(result.type).toBe('modal');
            expect(result.modalName).toBe('elfishLineage');
            expect(result.payload.action).toBe(action);
        });

        it('should return popup with info when lineage is already selected', async () => {
            getRuntimeValue.mockReturnValue('Drow');
            const action = makeAction();
            const result = await handle(action, makePlayerStats(), 'campaign', 'map');

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('Drow');
            expect(result.payload.description).toContain('already selected');
        });
    });

    describe('confirmElfisLineage', () => {
        it('should store Drow lineage and return confirmation', async () => {
            const result = await confirmElfisLineage(makePlayerStats(), 'Drow', 'campaign');

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('Drow');
            expect(result.payload.description).toContain('Spellcasting ability');
            expect(setRuntimeValue).toHaveBeenCalledWith('TestHero', '_elfishLineageSelection', 'Drow', 'campaign');
            expect(setRuntimeValue).toHaveBeenCalledWith('TestHero', '_elfishLineageAbility', 'Charisma', 'campaign');
        });

        it('should store High Elf lineage and set wizard cantrip', async () => {
            const result = await confirmElfisLineage(makePlayerStats(), 'High Elf', 'campaign');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('High Elf');
            expect(setRuntimeValue).toHaveBeenCalledWith('TestHero', '_elfishLineageSelection', 'High Elf', 'campaign');
            expect(setRuntimeValue).toHaveBeenCalledWith('TestHero', '_elfishLineageAbility', 'Intelligence', 'campaign');
        });

        it('should store Wood Elf lineage', async () => {
            const result = await confirmElfisLineage(makePlayerStats(), 'Wood Elf', 'campaign');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Wood Elf');
            expect(setRuntimeValue).toHaveBeenCalledWith('TestHero', '_elfishLineageSelection', 'Wood Elf', 'campaign');
            expect(setRuntimeValue).toHaveBeenCalledWith('TestHero', '_elfishLineageAbility', 'Wisdom', 'campaign');
        });

        it('should return error when lineage is not found', async () => {
            const result = await confirmElfisLineage(makePlayerStats(), 'Nonexistent', 'campaign');

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toBe('No lineage selected.');
        });
    });

    describe('changeElfisLineageCantrip', () => {
        it('should store the new wizard cantrip', async () => {
            const result = await changeElfisLineageCantrip(makePlayerStats(), 'Fire Bolt', 'campaign');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Fire Bolt');
            expect(setRuntimeValue).toHaveBeenCalledWith('TestHero', '_elfishLineageWizardCantrip', 'Fire Bolt', 'campaign');
        });
    });

    describe('getElfisLineageSelection', () => {
        it('should return the stored lineage', () => {
            getRuntimeValue.mockReturnValue('Drow');
            const selection = getElfisLineageSelection(makePlayerStats(), 'campaign');
            expect(selection).toBe('Drow');
        });

        it('should return null when no lineage exists', () => {
            getRuntimeValue.mockReturnValue(null);
            const selection = getElfisLineageSelection(makePlayerStats(), 'campaign');
            expect(selection).toBe(null);
        });
    });

    describe('getElfisLineageAbility', () => {
        it('should return the stored spellcasting ability', () => {
            getRuntimeValue.mockReturnValue('Charisma');
            const ability = getElfisLineageAbility(makePlayerStats(), 'campaign');
            expect(ability).toBe('Charisma');
        });
    });

    describe('getElfisLineageCantrip', () => {
        it('should return the stored cantrip', () => {
            getRuntimeValue.mockReturnValue('Dancing Lights');
            const cantrip = getElfisLineageCantrip(makePlayerStats(), 'campaign');
            expect(cantrip).toBe('Dancing Lights');
        });
    });

    describe('getElfisLineageLevel3Spell', () => {
        it('should return the stored level 3 spell', () => {
            getRuntimeValue.mockReturnValue('Faerie Fire');
            const spell = getElfisLineageLevel3Spell(makePlayerStats(), 'campaign');
            expect(spell).toBe('Faerie Fire');
        });
    });

    describe('getElfisLineageLevel5Spell', () => {
        it('should return the stored level 5 spell', () => {
            getRuntimeValue.mockReturnValue('Darkness');
            const spell = getElfisLineageLevel5Spell(makePlayerStats(), 'campaign');
            expect(spell).toBe('Darkness');
        });
    });

    describe('getElfisLineageWizardCantrip', () => {
        it('should return the stored wizard cantrip', () => {
            getRuntimeValue.mockReturnValue('Prestidigitation');
            const cantrip = getElfisLineageWizardCantrip(makePlayerStats(), 'campaign');
            expect(cantrip).toBe('Prestidigitation');
        });
    });

    describe('restoreUses', () => {
        it('should clear all lineage keys', async () => {
            restoreUses('TestHero', 'campaign');

            expect(setRuntimeValue).toHaveBeenCalledWith('TestHero', '_elfishLineageSelection', null, 'campaign');
            expect(setRuntimeValue).toHaveBeenCalledWith('TestHero', '_elfishLineageAbility', null, 'campaign');
            expect(setRuntimeValue).toHaveBeenCalledWith('TestHero', '_elfishLineageCantrip', null, 'campaign');
            expect(setRuntimeValue).toHaveBeenCalledWith('TestHero', '_elfishLineageLevel3', null, 'campaign');
            expect(setRuntimeValue).toHaveBeenCalledWith('TestHero', '_elfishLineageLevel5', null, 'campaign');
            expect(setRuntimeValue).toHaveBeenCalledWith('TestHero', '_elfishLineageWizardCantrip', null, 'campaign');
        });
    });
});
