// @improved-by-ai
import { describe, it, expect, vi } from 'vitest';
import {
    handleCombatSuperioritySkillCheck,
    executeCommanderStrikeChoice,
    executeReactionManeuver,
    executeSkillCheckManeuver,
    handleCombatSuperiorityCommandingPresenceReaction,
    executeCommandingPresenceReaction,
} from './combatSuperiorityHandler.js';
import { setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import * as dataLoader from '../../../../services/ui/dataLoader.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../../../services/ui/dataLoader.js', () => ({
    loadManeuvers: vi.fn(),
}));

const makeAction = (auto = {}) => ({
    name: 'Combat Superiority',
    automation: {
        type: 'combat_superiority',
        saveType: 'WIS',
        saveAbility: 'STR',
        saveDc: 'ability',
        dieExpression: 'superiority_die',
        ...auto,
    },
});

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

describe('executeReactionManeuver', () => {
    it('returns popup when maneuver not found', async () => {
        dataLoader.loadManeuvers.mockResolvedValue([{ name: 'Riposte' }]);

        const result = await executeReactionManeuver(
            makeAction(),
            makePlayerStats(),
            'test-campaign',
            'Fake'
        );

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('Fake');
        expect(result.payload.description).toContain('not found');
    });
});

describe('handleCombatSuperioritySkillCheck', () => {
    it('returns popup when no maneuver specified', async () => {
        const result = await handleCombatSuperioritySkillCheck(
            { name: 'Test', automation: { type: 'combat_superiority' } },
            makePlayerStats(),
            'test-campaign',
            null
        );

        expect(result.type).toBe('popup');
        expect(result.payload.description).toBe('No maneuver specified.');
    });
});

describe('executeSkillCheckManeuver', () => {
    it('returns popup when maneuver not found', async () => {
        dataLoader.loadManeuvers.mockResolvedValue([{ name: 'Ambush' }]);

        const result = await executeSkillCheckManeuver(
            makeAction(),
            makePlayerStats(),
            'test-campaign',
            'Fake'
        );

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('Fake');
        expect(result.payload.description).toContain('not found');
    });
});

describe('handleCombatSuperiorityCommandingPresenceReaction', () => {
    it('returns popup when no maneuver specified', async () => {
        const result = await handleCombatSuperiorityCommandingPresenceReaction(
            { name: 'Test', automation: { type: 'combat_superiority' } },
            makePlayerStats(),
            'test-campaign',
            null
        );

        expect(result.type).toBe('popup');
        expect(result.payload.description).toBe('No maneuver specified.');
    });
});

describe('executeCommandingPresenceReaction', () => {
    it('returns popup when maneuver not found', async () => {
        dataLoader.loadManeuvers.mockResolvedValue([{ name: 'Commanding Presence' }]);

        const result = await executeCommandingPresenceReaction(
            { ...makeAction(), automation: { ...makeAction().automation, maneuverName: 'Commanding Presence', reactionEffect: 'disadvantage_next_attack', targetName: 'Goblin' } },
            makePlayerStats(),
            'test-campaign',
            'Fake'
        );

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('Fake');
        expect(result.payload.description).toContain('not found');
    });
});

describe('executeCommanderStrikeChoice', () => {
    it('returns popup when no chosen target', async () => {
        const result = await executeCommanderStrikeChoice(
            { dieValue: 5, maneuverName: "Commander's Strike" },
            makePlayerStats(),
            'test-campaign',
            null
        );

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('No target selected');
    });

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

    it('uses default maneuver name when not provided', async () => {
        await executeCommanderStrikeChoice(
            { dieValue: 3 },
            makePlayerStats(),
            'test-campaign',
            'AllyRogue'
        );

        expect(setRuntimeValue).toHaveBeenCalledWith('AllyRogue', 'commanderStrikeSource', "Commander's Strike", 'test-campaign');
    });

    it('returns popup when playerStats is null', async () => {
        const result = await executeCommanderStrikeChoice(
            { dieValue: 5 },
            null,
            'test-campaign',
            'AllyRogue'
        );

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('No target selected');
    });

    it('returns popup when campaignName is null', async () => {
        const result = await executeCommanderStrikeChoice(
            { dieValue: 5 },
            makePlayerStats(),
            null,
            'AllyRogue'
        );

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('No target selected');
    });
});
