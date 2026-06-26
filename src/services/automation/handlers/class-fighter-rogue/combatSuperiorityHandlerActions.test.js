// @improved-by-ai
import { describe, it, expect } from 'vitest';
import {
    handleCombatSuperiorityBonusAction,
    handleCombatSuperiorityReaction,
    handleCombatSuperiorityGrantAttack,
    handleCombatSuperioritySweepingAttack,
    handleCombatSuperiorityMovement,
} from './combatSuperiorityHandler.js';

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

describe('handleCombatSuperiorityBonusAction', () => {
    it('returns popup when no maneuver specified', async () => {
        const result = await handleCombatSuperiorityBonusAction(
            { name: 'Test', automation: { type: 'combat_superiority' } },
            makePlayerStats(),
            'test-campaign',
            null
        );

        expect(result.type).toBe('popup');
        expect(result.payload.description).toBe('No maneuver specified.');
    });
});

describe('handleCombatSuperiorityReaction', () => {
    it('returns popup when no maneuver specified', async () => {
        const result = await handleCombatSuperiorityReaction(
            { name: 'Test', automation: { type: 'combat_superiority' } },
            makePlayerStats(),
            'test-campaign',
            null
        );

        expect(result.type).toBe('popup');
        expect(result.payload.description).toBe('No maneuver specified.');
    });
});

describe('handleCombatSuperiorityGrantAttack', () => {
    it('returns popup when no maneuver specified', async () => {
        const result = await handleCombatSuperiorityGrantAttack(
            { name: 'Test', automation: { type: 'combat_superiority' } },
            makePlayerStats(),
            'test-campaign',
            null
        );

        expect(result.type).toBe('popup');
        expect(result.payload.description).toBe('No maneuver specified.');
    });
});

describe('handleCombatSuperioritySweepingAttack', () => {
    it('returns popup when no secondary target specified', async () => {
        const result = await handleCombatSuperioritySweepingAttack(
            { name: 'Test', automation: { type: 'combat_superiority' } },
            makePlayerStats(),
            'test-campaign',
            null
        );

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('No secondary target selected');
    });
});

describe('handleCombatSuperiorityMovement', () => {
    it('returns popup when no maneuver specified', async () => {
        const result = await handleCombatSuperiorityMovement(
            { name: 'Test', automation: { type: 'combat_superiority' } },
            makePlayerStats(),
            'test-campaign',
            null
        );

        expect(result.type).toBe('popup');
        expect(result.payload.description).toBe('No maneuver specified.');
    });
});
