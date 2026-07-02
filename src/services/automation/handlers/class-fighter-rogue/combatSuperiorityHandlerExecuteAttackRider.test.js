// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { rollExpression } from '../../../dice/diceRoller.js';
import * as targetResolver from '../../common/targetResolver.js';
import * as automationService from '../../../combat/automation/automationService.js';
import * as dataLoader from '../../../../services/ui/dataLoader.js';
import * as savePrompt from '../../../automation/common/savePrompt.js';
import * as damageUtils from '../../../rules/combat/damageUtils.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../../rules/effects/expirations.js', () => ({
    addExpiration: vi.fn(),
}));

vi.mock('../../../../services/encounters/combatData.js', () => ({
    getCurrentCombatRound: vi.fn(() => 1),
    loadCombatSummary: vi.fn(),
}));

vi.mock('../../../dice/diceRoller.js', () => ({
    rollExpression: vi.fn(),
}));

vi.mock('../../common/targetResolver.js', () => ({
    resolveTarget: vi.fn(),
}));

vi.mock('../../../combat/automation/automationService.js', () => ({
    evaluateAutoExpression: vi.fn(),
}));

vi.mock('../../../../services/ui/dataLoader.js', () => ({
    loadManeuvers: vi.fn(),
}));

vi.mock('../../../automation/common/savePrompt.js', () => ({
    buildSaveDc: vi.fn(),
    createSaveListener: vi.fn(),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(),
    findCreatureByName: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
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

const DEFAULT_SUPERIORITY_DICE = 2;
const DIE_ROLL_TOTAL = 5;

function setupMocks() {
    getRuntimeValue.mockImplementation((_playerName, key) => {
        if (key === 'superiorityDice') return DEFAULT_SUPERIORITY_DICE;
        return undefined;
    });
    rollExpression.mockReturnValue({ total: DIE_ROLL_TOTAL });
    automationService.evaluateAutoExpression.mockReturnValue(10);
    targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });
    savePrompt.buildSaveDc.mockReturnValue(15);
    savePrompt.createSaveListener.mockReturnValue({
        promise: Promise.resolve({ success: false }),
    });
    damageUtils.getCombatContext.mockResolvedValue(null);
}

describe('executeAttackRiderManeuver', () => {
    beforeEach(async () => {
        vi.resetModules();
        vi.clearAllMocks();
        // Re-apply mocks after module reset
        setupMocks();
        // Re-import to get fresh module with clean cache
        await import('./combatSuperiorityHandler.js');
    });

    it('returns popup with not-found message when maneuver does not exist', async () => {
        const { executeAttackRiderManeuver } = await import('./combatSuperiorityHandler.js');
        dataLoader.loadManeuvers.mockResolvedValue([
            { name: 'Trip Attack', effect: 'knock_prone', damageBonus: true },
        ]);

        const result = await executeAttackRiderManeuver(
            makeAction(),
            makePlayerStats(),
            'test-campaign',
            'Nonexistent Maneuver',
            { weaponType: 'melee', hit: true }
        );

        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.name).toBe('Nonexistent Maneuver');
        expect(result.payload.description).toContain('Nonexistent Maneuver');
        expect(result.payload.description).toContain('not found');
    });

    it('returns popup when no superiority dice remain', async () => {
        const { executeAttackRiderManeuver } = await import('./combatSuperiorityHandler.js');
        getRuntimeValue.mockImplementation((_playerName, key) => {
            if (key === 'superiorityDice') return 0;
            return undefined;
        });
        dataLoader.loadManeuvers.mockResolvedValue([
            { name: 'Trip Attack', effect: 'knock_prone', damageBonus: true },
        ]);

        const result = await executeAttackRiderManeuver(
            makeAction(),
            makePlayerStats(),
            'test-campaign',
            'Trip Attack',
            { weaponType: 'melee', hit: true }
        );

        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.name).toBe('Trip Attack');
        expect(result.payload.description).toContain('No Superiority Dice remaining');
    });

    it('expend one superiority die on normal maneuver execution', async () => {
        const { executeAttackRiderManeuver } = await import('./combatSuperiorityHandler.js');
        dataLoader.loadManeuvers.mockResolvedValue([
            { name: 'Trip Attack', effect: 'knock_prone', damageBonus: true },
        ]);

        await executeAttackRiderManeuver(
            makeAction(),
            makePlayerStats(),
            'test-campaign',
            'Trip Attack',
            { weaponType: 'melee', hit: true }
        );

        expect(setRuntimeValue).toHaveBeenCalledWith(
            'TestFighter',
            'superiorityDice',
            DEFAULT_SUPERIORITY_DICE - 1,
            'test-campaign'
        );
    });

    it('does not expend die when relentless is available', async () => {
        const { executeAttackRiderManeuver } = await import('./combatSuperiorityHandler.js');
        getRuntimeValue.mockImplementation((_playerName, key) => {
            if (key === 'superiorityDice') return 0;
            if (key === 'relentlessUsedRound') return undefined;
            return undefined;
        });
        rollExpression.mockReturnValue({ total: 6 });

        dataLoader.loadManeuvers.mockResolvedValue([
            { name: 'Trip Attack', effect: 'knock_prone' },
        ]);

        await executeAttackRiderManeuver(
            makeAction(),
            makePlayerStats({
                automation: {
                    passives: [{ type: 'passive_rule', effect: 'relentless', name: 'Relentless' }],
                },
            }),
            'test-campaign',
            'Trip Attack',
            { weaponType: 'melee', hit: true }
        );

        const diceCalls = setRuntimeValue.mock.calls.filter(
            call => call[0] === 'TestFighter' && call[1] === 'superiorityDice'
        );
        expect(diceCalls).toHaveLength(0);
    });

    it('includes target name in description when target resolves', async () => {
        const { executeAttackRiderManeuver } = await import('./combatSuperiorityHandler.js');
        dataLoader.loadManeuvers.mockResolvedValue([
            { name: 'Trip Attack', effect: 'knock_prone', damageBonus: true },
        ]);

        const result = await executeAttackRiderManeuver(
            makeAction(),
            makePlayerStats(),
            'test-campaign',
            'Trip Attack',
            { weaponType: 'melee', hit: true }
        );

        expect(result.payload.description).toContain('Target: Goblin');
    });

    it('uses attackInfo targetName when target resolver returns null', async () => {
        const { executeAttackRiderManeuver } = await import('./combatSuperiorityHandler.js');
        targetResolver.resolveTarget.mockResolvedValue(null);
        dataLoader.loadManeuvers.mockResolvedValue([
            { name: 'Trip Attack', effect: 'knock_prone', damageBonus: true },
        ]);

        const result = await executeAttackRiderManeuver(
            makeAction(),
            makePlayerStats(),
            'test-campaign',
            'Trip Attack',
            { weaponType: 'melee', hit: true, targetName: 'Orc' }
        );

        expect(result.payload.description).toContain('Target: Orc');
    });

    it('includes damage bonus text when maneuver has damageBonus flag', async () => {
        const { executeAttackRiderManeuver } = await import('./combatSuperiorityHandler.js');
        dataLoader.loadManeuvers.mockResolvedValue([
            { name: 'Trip Attack', effect: 'knock_prone', damageBonus: true },
        ]);

        const result = await executeAttackRiderManeuver(
            makeAction(),
            makePlayerStats(),
            'test-campaign',
            'Trip Attack',
            { weaponType: 'melee', hit: true }
        );

        expect(result.payload.description).toContain('Added 5 to the damage roll');
    });

    it('returns result with logEntries array', async () => {
        const { executeAttackRiderManeuver } = await import('./combatSuperiorityHandler.js');
        dataLoader.loadManeuvers.mockResolvedValue([
            { name: 'Trip Attack', effect: 'knock_prone', damageBonus: true },
        ]);

        const result = await executeAttackRiderManeuver(
            makeAction(),
            makePlayerStats(),
            'test-campaign',
            'Trip Attack',
            { weaponType: 'melee', hit: true }
        );

        expect(result.logEntries).toHaveLength(1);
        expect(result.logEntries[0].type).toBe('ability_use');
        expect(result.logEntries[0].characterName).toBe('TestFighter');
        expect(result.logEntries[0].abilityName).toBe('Trip Attack');
    });

    it('describes distracting_strike_advantage effect with advantage text', async () => {
        const { executeAttackRiderManeuver } = await import('./combatSuperiorityHandler.js');
        dataLoader.loadManeuvers.mockResolvedValue([
            { name: 'Distracting Strike', effect: 'distracting_strike_advantage', damageBonus: true },
        ]);

        const result = await executeAttackRiderManeuver(
            makeAction(),
            makePlayerStats(),
            'test-campaign',
            'Distracting Strike',
            { weaponType: 'melee', hit: true }
        );

        expect(result.payload.description).toContain('next attack');
        expect(result.payload.description).toContain('Advantage');
    });

    it('describes ally_movement effect with reaction text', async () => {
        const { executeAttackRiderManeuver } = await import('./combatSuperiorityHandler.js');
        dataLoader.loadManeuvers.mockResolvedValue([
            { name: 'Maneuvering Attack', effect: 'ally_movement', damageBonus: true },
        ]);

        const result = await executeAttackRiderManeuver(
            makeAction(),
            makePlayerStats(),
            'test-campaign',
            'Maneuvering Attack',
            { weaponType: 'melee', hit: true }
        );

        expect(result.payload.description).toContain('Reaction');
        expect(result.payload.description).toContain('Opportunity Attacks');
    });

    it('describes secondary_damage effect with range and damage text', async () => {
        const { executeAttackRiderManeuver } = await import('./combatSuperiorityHandler.js');
        dataLoader.loadManeuvers.mockResolvedValue([
            { name: 'Sweeping Attack', effect: 'secondary_damage' },
        ]);

        const result = await executeAttackRiderManeuver(
            makeAction(),
            makePlayerStats(),
            'test-campaign',
            'Sweeping Attack',
            { weaponType: 'melee', hit: true }
        );

        expect(result.payload.description).toContain('second creature');
        expect(result.payload.description).toContain('5 feet');
        expect(result.payload.description).toContain(`${DIE_ROLL_TOTAL} damage`);
    });
});
