// @cleaned-by-ai
import { describe, it, expect, vi } from 'vitest';
import { executeCommanderStrikeChoice } from './combatSuperiorityHandler.js';
import { setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

const makePlayerStats = (overrides = {}) => ({
    name: 'TestFighter',
    proficiency: 3,
    abilities: [
        { name: 'Strength', bonus: 4 },
        { name: 'Dexterity', bonus: 2 },
        { name: 'Constitution', bonus: 1 },
        { name: 'Intelligence', bonus: 0 },
        { name: 'Wisdom', bonus: 0 },
        { name: 'Charisma', bonus: 0 },
    ],
    level: 5,
    rules: '2024',
    automation: { passives: [], actions: [], bonusActions: [], reactions: [], specialActions: [] },
    ...overrides,
});

describe('executeCommanderStrikeChoice', () => {
    it('applies commander strike bonus to chosen ally', async () => {
        const result = await executeCommanderStrikeChoice(
            { dieValue: 5, maneuverName: "Commander's Strike" },
            makePlayerStats(),
            'test-campaign',
            'AllyRogue'
        );

        expect(setRuntimeValue).toHaveBeenCalledWith('AllyRogue', 'commanderStrikeActive', true, 'test-campaign');
        expect(setRuntimeValue).toHaveBeenCalledWith('AllyRogue', 'commanderStrikeBonus', 5, 'test-campaign');
        expect(setRuntimeValue).toHaveBeenCalledWith('AllyRogue', 'commanderStrikeSource', "Commander's Strike", 'test-campaign');
        expect(result.payload.description).toContain('AllyRogue');
        expect(result.payload.description).toContain('5');
        expect(result.payload.description).toContain('next attack');
    });
});

// @cleaned-by-ai
