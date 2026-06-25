// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { onCombatSuperioritySelected } from './combatSuperiorityHandler.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { rollExpression } from '../../../dice/diceRoller.js';
import * as targetResolver from '../../common/targetResolver.js';
import { getCurrentCombatRound } from '../../../../services/encounters/combatData.js';
import * as automationService from '../../../combat/automation/automationService.js';
import * as dataLoader from '../../../../services/ui/dataLoader.js';
import * as savePrompt from '../../../automation/common/savePrompt.js';
import * as expirations from '../../../rules/effects/expirations.js';

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
        uses_max: 4,
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
    level: 15,
    rules: '2024',
    automation: { passives: [], actions: [], bonusActions: [], reactions: [], specialActions: [] },
    ...overrides,
});

const DEFAULT_SUPERIORITY_DICE = 2;
const DIE_ROLL_TOTAL = 5;

describe('combatSuperiorityHandler.executeManeuver - maneuver not found and no dice', () => {
    beforeEach(() => {
        vi.clearAllMocks();
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
    });

    it('returns popup with not-found message when maneuver does not exist', async () => {
        dataLoader.loadManeuvers.mockResolvedValue([
            { name: 'Trip Attack', effect: 'knock_prone', damageBonus: true },
        ]);

        const result = await onCombatSuperioritySelected(
            makeAction(),
            makePlayerStats(),
            'test-campaign',
            null,
            'Nonexistent Maneuver'
        );

        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.name).toBe('Combat Superiority');
        expect(result.payload.description).toContain('Nonexistent Maneuver');
        expect(result.payload.description).toContain('not found');
        expect(result.payload.automation).toEqual(makeAction().automation);
    });

    it('returns popup when no superiority dice remain and relentless is not active', async () => {
        getRuntimeValue.mockImplementation((_playerName, key) => {
            if (key === 'superiorityDice') return 0;
            return undefined;
        });
        dataLoader.loadManeuvers.mockResolvedValue([
            { name: 'Trip Attack', effect: 'knock_prone', damageBonus: true },
        ]);

        const result = await onCombatSuperioritySelected(
            makeAction(),
            makePlayerStats(),
            'test-campaign',
            null,
            'Trip Attack'
        );

        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.name).toBe('Trip Attack');
        expect(result.payload.description).toContain('No Superiority Dice remaining');
        expect(result.payload.description).toContain('Short or Long Rest');
        expect(result.payload.automation).toEqual(makeAction().automation);
    });

    it('returns popup with name prefix when no dice and relentless is active but already used this round', async () => {
        getRuntimeValue.mockImplementation((_playerName, key) => {
            if (key === 'superiorityDice') return 0;
            if (key === 'relentlessUsedRound') return 1;
            return undefined;
        });
        dataLoader.loadManeuvers.mockResolvedValue([
            { name: 'Trip Attack', effect: 'knock_prone' },
        ]);

        const result = await onCombatSuperioritySelected(
            makeAction(),
            makePlayerStats({
                automation: {
                    passives: [{ type: 'passive_rule', effect: 'relentless', name: 'Relentless' }],
                },
            }),
            'test-campaign',
            null,
            'Trip Attack'
        );

        expect(result.type).toBe('popup');
        expect(result.payload.name).toBe('Trip Attack');
        expect(result.payload.description).toContain('Trip Attack: No Superiority Dice remaining');
    });
});

describe('combatSuperiorityHandler.executeManeuver - die expenditure and roll fallback', () => {
    beforeEach(() => {
        vi.clearAllMocks();
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
    });

    it('expend one superiority die on normal maneuver execution', async () => {
        dataLoader.loadManeuvers.mockResolvedValue([
            { name: 'Trip Attack', effect: 'knock_prone', damageBonus: true },
        ]);

        await onCombatSuperioritySelected(
            makeAction(),
            makePlayerStats(),
            'test-campaign',
            null,
            'Trip Attack'
        );

        expect(setRuntimeValue).toHaveBeenCalledWith(
            'TestFighter',
            'superiorityDice',
            DEFAULT_SUPERIORITY_DICE - 1,
            'test-campaign'
        );
    });

    it('uses default max uses (4) when runtime value is missing', async () => {
        getRuntimeValue.mockImplementation(() => undefined);
        rollExpression.mockReturnValue({ total: DIE_ROLL_TOTAL });

        dataLoader.loadManeuvers.mockResolvedValue([
            { name: 'Trip Attack', effect: 'knock_prone', damageBonus: true },
        ]);

        await onCombatSuperioritySelected(
            makeAction(),
            makePlayerStats(),
            'test-campaign',
            null,
            'Trip Attack'
        );

        expect(setRuntimeValue).toHaveBeenCalledWith(
            'TestFighter',
            'superiorityDice',
            3,
            'test-campaign'
        );
    });

    it('uses custom uses_max from automation config', async () => {
        getRuntimeValue.mockImplementation((_playerName, key) => {
            if (key === 'superiorityDice') return 1;
            return undefined;
        });
        rollExpression.mockReturnValue({ total: 3 });

        dataLoader.loadManeuvers.mockResolvedValue([
            { name: 'Trip Attack', effect: 'knock_prone', damageBonus: true },
        ]);

        await onCombatSuperioritySelected(
            makeAction({ uses_max: 6 }),
            makePlayerStats(),
            'test-campaign',
            null,
            'Trip Attack'
        );

        expect(setRuntimeValue).toHaveBeenCalledWith(
            'TestFighter',
            'superiorityDice',
            0,
            'test-campaign'
        );
    });

    it('uses die roll total from rollExpression in description', async () => {
        rollExpression.mockReturnValue({ total: 9 });

        dataLoader.loadManeuvers.mockResolvedValue([
            { name: 'Trip Attack', effect: 'knock_prone', damageBonus: true },
        ]);

        const result = await onCombatSuperioritySelected(
            makeAction(),
            makePlayerStats(),
            'test-campaign',
            null,
            'Trip Attack'
        );

        expect(result.payload.description).toContain('Rolled d10 for 9');
    });

    it('falls back to die size when rollExpression returns null', async () => {
        rollExpression.mockReturnValue(null);

        dataLoader.loadManeuvers.mockResolvedValue([
            { name: 'Trip Attack', effect: 'knock_prone', damageBonus: true },
        ]);

        const result = await onCombatSuperioritySelected(
            makeAction(),
            makePlayerStats(),
            'test-campaign',
            null,
            'Trip Attack'
        );

        expect(result.payload.description).toContain('Rolled d10 for 10');
    });

    it('does not expend die when relentless is available and not used this round', async () => {
        getRuntimeValue.mockImplementation((_playerName, key) => {
            if (key === 'superiorityDice') return 0;
            if (key === 'relentlessUsedRound') return undefined;
            return undefined;
        });
        rollExpression.mockReturnValue({ total: 6 });

        dataLoader.loadManeuvers.mockResolvedValue([
            { name: 'Trip Attack', effect: 'knock_prone' },
        ]);

        await onCombatSuperioritySelected(
            makeAction(),
            makePlayerStats({
                automation: {
                    passives: [{ type: 'passive_rule', effect: 'relentless', name: 'Relentless' }],
                },
            }),
            'test-campaign',
            null,
            'Trip Attack'
        );

        const diceCalls = setRuntimeValue.mock.calls.filter(
            call => call[0] === 'TestFighter' && call[1] === 'superiorityDice'
        );
        expect(diceCalls).toHaveLength(0);
    });

    it('records relentless used round when relentless die is rolled', async () => {
        getCurrentCombatRound.mockReturnValue(3);
        getRuntimeValue.mockImplementation((_playerName, key) => {
            if (key === 'superiorityDice') return 0;
            if (key === 'relentlessUsedRound') return undefined;
            return undefined;
        });
        rollExpression.mockReturnValue({ total: 6 });

        dataLoader.loadManeuvers.mockResolvedValue([
            { name: 'Trip Attack', effect: 'knock_prone' },
        ]);

        await onCombatSuperioritySelected(
            makeAction(),
            makePlayerStats({
                automation: {
                    passives: [{ type: 'passive_rule', effect: 'relentless', name: 'Relentless' }],
                },
            }),
            'test-campaign',
            null,
            'Trip Attack'
        );

        expect(setRuntimeValue).toHaveBeenCalledWith(
            'TestFighter',
            'relentlessUsedRound',
            3,
            'test-campaign'
        );
    });
});

describe('combatSuperiorityHandler.executeManeuver - target and damage bonus', () => {
    beforeEach(() => {
        vi.clearAllMocks();
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
    });

    it('includes target name in description when target resolves', async () => {
        dataLoader.loadManeuvers.mockResolvedValue([
            { name: 'Trip Attack', effect: 'knock_prone', damageBonus: true },
        ]);

        const result = await onCombatSuperioritySelected(
            makeAction(),
            makePlayerStats(),
            'test-campaign',
            null,
            'Trip Attack'
        );

        expect(result.payload.description).toContain('Target: Goblin');
    });

    it('omits target line when target resolver returns null', async () => {
        targetResolver.resolveTarget.mockResolvedValue(null);

        dataLoader.loadManeuvers.mockResolvedValue([
            { name: 'Trip Attack', effect: 'knock_prone', damageBonus: true },
        ]);

        const result = await onCombatSuperioritySelected(
            makeAction(),
            makePlayerStats(),
            'test-campaign',
            null,
            'Trip Attack'
        );

        expect(result.payload.description).not.toContain('Target:');
    });

    it('includes damage bonus text when maneuver has damageBonus flag', async () => {
        dataLoader.loadManeuvers.mockResolvedValue([
            { name: 'Trip Attack', effect: 'knock_prone', damageBonus: true },
        ]);

        const result = await onCombatSuperioritySelected(
            makeAction(),
            makePlayerStats(),
            'test-campaign',
            null,
            'Trip Attack'
        );

        expect(result.payload.description).toContain('Added 5 to the damage roll');
    });

    it('omits damage bonus text when maneuver lacks damageBonus flag', async () => {
        dataLoader.loadManeuvers.mockResolvedValue([
            { name: 'Feinting Attack', effect: 'advantage_and_damage' },
        ]);

        const result = await onCombatSuperioritySelected(
            makeAction(),
            makePlayerStats(),
            'test-campaign',
            null,
            'Feinting Attack'
        );

        expect(result.payload.description).not.toContain('Added');
    });

    it('returns result with logEntries array', async () => {
        dataLoader.loadManeuvers.mockResolvedValue([
            { name: 'Trip Attack', effect: 'knock_prone', damageBonus: true },
        ]);

        const result = await onCombatSuperioritySelected(
            makeAction(),
            makePlayerStats(),
            'test-campaign',
            null,
            'Trip Attack'
        );

        expect(result.logEntries).toHaveLength(1);
        expect(result.logEntries[0].type).toBe('ability_use');
        expect(result.logEntries[0].characterName).toBe('TestFighter');
        expect(result.logEntries[0].abilityName).toBe('Trip Attack');
    });
});

describe('combatSuperiorityHandler.executeManeuver - save type maneuvers', () => {
    beforeEach(() => {
        vi.clearAllMocks();
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
    });

    it('includes save DC and result for push effect when target fails save', async () => {
        dataLoader.loadManeuvers.mockResolvedValue([
            { name: 'Pushing Attack', effect: 'push', saveType: 'STR', value: 15, damageBonus: true },
        ]);

        const result = await onCombatSuperioritySelected(
            makeAction(),
            makePlayerStats(),
            'test-campaign',
            null,
            'Pushing Attack'
        );

        expect(result.payload.description).toContain('STR save DC 15');
        expect(result.payload.description).toContain('Failure');
        expect(result.payload.description).toContain('pushed 15 feet');
    });

    it('includes save DC for goad effect with conditionInflicted', async () => {
        dataLoader.loadManeuvers.mockResolvedValue([
            { name: 'Goading Attack', effect: 'goad', saveType: 'WIS', conditionInflicted: 'goaded', damageBonus: true },
        ]);

        const result = await onCombatSuperioritySelected(
            makeAction(),
            makePlayerStats(),
            'test-campaign',
            null,
            'Goading Attack'
        );

        expect(result.payload.description).toContain('WIS save DC 15');
        expect(result.payload.description).toContain('Disadvantage on attacks against targets other than you');
    });

    it('includes save DC and condition for frightened effect', async () => {
        dataLoader.loadManeuvers.mockResolvedValue([
            { name: 'Menacing Attack', effect: 'frightened', saveType: 'WIS', conditionInflicted: 'Frightened', damageBonus: true },
        ]);

        const result = await onCombatSuperioritySelected(
            makeAction(),
            makePlayerStats(),
            'test-campaign',
            null,
            'Menacing Attack'
        );

        expect(result.payload.description).toContain('WIS save DC 15');
        expect(result.payload.description).toContain('Frightened');
    });

    it('includes save DC for disarm effect', async () => {
        dataLoader.loadManeuvers.mockResolvedValue([
            { name: 'Disarming Attack', effect: 'disarm', saveType: 'STR', damageBonus: true },
        ]);

        const result = await onCombatSuperioritySelected(
            makeAction(),
            makePlayerStats(),
            'test-campaign',
            null,
            'Disarming Attack'
        );

        expect(result.payload.description).toContain('STR save DC 15');
        expect(result.payload.description).toContain('dropped the object');
    });

    it('includes save DC when target is null (no target branch)', async () => {
        targetResolver.resolveTarget.mockResolvedValue(null);
        dataLoader.loadManeuvers.mockResolvedValue([
            { name: 'Pushing Attack', effect: 'push', saveType: 'STR', value: 15 },
        ]);

        const result = await onCombatSuperioritySelected(
            makeAction(),
            makePlayerStats(),
            'test-campaign',
            null,
            'Pushing Attack'
        );

        expect(result.payload.description).toContain('Target must make a STR save DC 15');
        expect(result.payload.description).toContain('be pushed 15 feet');
    });

    it('reports success when save listener resolves with success true', async () => {
        savePrompt.createSaveListener.mockReturnValue({
            promise: Promise.resolve({ success: true }),
        });
        dataLoader.loadManeuvers.mockResolvedValue([
            { name: 'Pushing Attack', effect: 'push', saveType: 'STR', value: 15 },
        ]);

        const result = await onCombatSuperioritySelected(
            makeAction(),
            makePlayerStats(),
            'test-campaign',
            null,
            'Pushing Attack'
        );

        expect(result.payload.description).toContain('Success');
        expect(result.payload.description).not.toContain('pushed');
    });
});

describe('combatSuperiorityHandler.executeManeuver - effect descriptions', () => {
    beforeEach(() => {
        vi.clearAllMocks();
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
    });

    it('describes distracting_strike_advantage effect with advantage text', async () => {
        dataLoader.loadManeuvers.mockResolvedValue([
            { name: 'Distracting Strike', effect: 'distracting_strike_advantage', damageBonus: true },
        ]);

        const result = await onCombatSuperioritySelected(
            makeAction(),
            makePlayerStats(),
            'test-campaign',
            null,
            'Distracting Strike'
        );

        expect(result.payload.description).toContain('next attack');
        expect(result.payload.description).toContain('Advantage');
    });

    it('describes ally_movement effect with reaction and opportunity attacks text', async () => {
        dataLoader.loadManeuvers.mockResolvedValue([
            { name: 'Maneuvering Attack', effect: 'ally_movement', damageBonus: true },
        ]);

        const result = await onCombatSuperioritySelected(
            makeAction(),
            makePlayerStats(),
            'test-campaign',
            null,
            'Maneuvering Attack'
        );

        expect(result.payload.description).toContain('Reaction');
        expect(result.payload.description).toContain('Opportunity Attacks');
    });

    it('describes grant_attack actionType with reaction attack text', async () => {
        dataLoader.loadManeuvers.mockResolvedValue([
            { name: "Commander's Strike", actionType: 'grant_attack', damageBonus: true },
        ]);

        const result = await onCombatSuperioritySelected(
            makeAction(),
            makePlayerStats(),
            'test-campaign',
            null,
            "Commander's Strike"
        );

        expect(result.payload.description).toContain('Reaction to make an attack');
        expect(result.payload.description).toContain(String(DIE_ROLL_TOTAL));
    });

    it('describes ac_bonus_and_swap effect and sets bait-and-switch runtime values', async () => {
        dataLoader.loadManeuvers.mockResolvedValue([
            { name: 'Bait and Switch', effect: 'ac_bonus_and_swap' },
        ]);

        const result = await onCombatSuperioritySelected(
            makeAction(),
            makePlayerStats(),
            'test-campaign',
            null,
            'Bait and Switch'
        );

        expect(result.payload.description).toContain('+5 AC');
        expect(result.payload.description).toContain('next turn');
        expect(setRuntimeValue).toHaveBeenCalledWith('TestFighter', 'baitAndSwitchActive', true, 'test-campaign');
        expect(setRuntimeValue).toHaveBeenCalledWith('TestFighter', 'baitAndSwitchBonus', 5, 'test-campaign');
        expect(setRuntimeValue).toHaveBeenCalledWith('TestFighter', 'baitAndSwitchSource', 'Bait and Switch', 'test-campaign');
        expect(expirations.addExpiration).toHaveBeenCalled();
        expect(result.payload.description).not.toContain('Target:');
    });

    it('describes ac_bonus_disengage effect and sets bait-and-switch runtime values', async () => {
        dataLoader.loadManeuvers.mockResolvedValue([
            { name: 'Evasive Footwork', effect: 'ac_bonus_disengage' },
        ]);

        const result = await onCombatSuperioritySelected(
            makeAction(),
            makePlayerStats(),
            'test-campaign',
            null,
            'Evasive Footwork'
        );

        expect(result.payload.description).toContain('Disengage action');
        expect(result.payload.description).toContain('+5 AC');
        expect(setRuntimeValue).toHaveBeenCalledWith('TestFighter', 'baitAndSwitchActive', true, 'test-campaign');
        expect(setRuntimeValue).toHaveBeenCalledWith('TestFighter', 'baitAndSwitchBonus', 5, 'test-campaign');
        expect(setRuntimeValue).toHaveBeenCalledWith('TestFighter', 'baitAndSwitchSource', 'Evasive Footwork', 'test-campaign');
        expect(result.payload.description).not.toContain('Target:');
    });

    it('describes advantage_and_damage effect and stores feinting attack state', async () => {
        dataLoader.loadManeuvers.mockResolvedValue([
            { name: 'Feinting Attack', effect: 'advantage_and_damage' },
        ]);

        const result = await onCombatSuperioritySelected(
            makeAction(),
            makePlayerStats(),
            'test-campaign',
            null,
            'Feinting Attack'
        );

        expect(result.payload.description).toContain('Advantage');
        expect(result.payload.description).toContain('next attack roll');
        expect(result.payload.description).toContain(String(DIE_ROLL_TOTAL));
        expect(setRuntimeValue).toHaveBeenCalledWith('TestFighter', 'feintingAttackDieValue', DIE_ROLL_TOTAL, 'test-campaign');
    });

    it('describes dash_and_damage effect with distance text', async () => {
        dataLoader.loadManeuvers.mockResolvedValue([
            { name: 'Lunging Attack', effect: 'dash_and_damage' },
        ]);

        const result = await onCombatSuperioritySelected(
            makeAction(),
            makePlayerStats(),
            'test-campaign',
            null,
            'Lunging Attack'
        );

        expect(result.payload.description).toContain('Dash action');
        expect(result.payload.description).toContain('5+ feet');
        expect(result.payload.description).toContain(String(DIE_ROLL_TOTAL));
    });

    it('describes temp_hp effect with calculated temporary hit points', async () => {
        dataLoader.loadManeuvers.mockResolvedValue([
            { name: 'Rally', effect: 'temp_hp' },
        ]);

        const result = await onCombatSuperioritySelected(
            makeAction(),
            makePlayerStats({ level: 15 }),
            'test-campaign',
            null,
            'Rally'
        );

        expect(result.payload.description).toContain('Temporary Hit Points');
        // 5 (die) + 7 (floor(15/2))
        expect(result.payload.description).toContain('12');
        expect(result.payload.description).toContain('half Fighter level');
    });

    it('describes damage_reduction effect with STR/DEX modifier calculation', async () => {
        dataLoader.loadManeuvers.mockResolvedValue([
            { name: 'Parry', effect: 'damage_reduction' },
        ]);

        const result = await onCombatSuperioritySelected(
            makeAction(),
            makePlayerStats(),
            'test-campaign',
            null,
            'Parry'
        );

        expect(result.payload.description).toContain('Damage reduced by');
        // 5 (die) + 4 (STR modifier)
        expect(result.payload.description).toContain('9');
        expect(result.payload.description).toContain('STR/DEX modifier');
    });

    it('uses max of STR/DEX for damage_reduction when DEX is higher', async () => {
        dataLoader.loadManeuvers.mockResolvedValue([
            { name: 'Parry', effect: 'damage_reduction' },
        ]);
        rollExpression.mockReturnValue({ total: 4 });

        const result = await onCombatSuperioritySelected(
            makeAction(),
            makePlayerStats({
                abilities: [
                    { name: 'Strength', bonus: 2 },
                    { name: 'Dexterity', bonus: 5 },
                ],
            }),
            'test-campaign',
            null,
            'Parry'
        );

        expect(result.payload.description).toContain('9'); // 4 (die) + 5 (DEX modifier)
    });

    it('describes melee_attack_reaction effect and returns attack_roll type', async () => {
        dataLoader.loadManeuvers.mockResolvedValue([
            { name: 'Riposte', effect: 'melee_attack_reaction', damageBonus: true },
        ]);

        const playerStats = makePlayerStats({
            attacks: [{ name: 'Melee Attack', hitBonus: 5, range: '5 ft', damage: '1d8', weaponType: 'melee' }],
        });

        const result = await onCombatSuperioritySelected(
            makeAction(),
            playerStats,
            'test-campaign',
            null,
            'Riposte'
        );

        expect(result.type).toBe('attack_roll');
        expect(result.payload.attack.name).toBe('Melee Attack');
        expect(result.context.superiorityDieValue).toBe(DIE_ROLL_TOTAL);
    });

    it('describes melee_attack_reaction effect when no melee attacks available', async () => {
        dataLoader.loadManeuvers.mockResolvedValue([
            { name: 'Riposte', effect: 'melee_attack_reaction' },
        ]);

        const result = await onCombatSuperioritySelected(
            makeAction(),
            makePlayerStats({ attacks: [] }),
            'test-campaign',
            null,
            'Riposte'
        );

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('No melee attack available');
    });

    it('describes secondary_damage effect with range and damage text', async () => {
        dataLoader.loadManeuvers.mockResolvedValue([
            { name: 'Sweeping Attack', effect: 'secondary_damage' },
        ]);

        const result = await onCombatSuperioritySelected(
            makeAction(),
            makePlayerStats(),
            'test-campaign',
            null,
            'Sweeping Attack'
        );

        expect(result.payload.description).toContain('second creature');
        expect(result.payload.description).toContain('5 feet');
        expect(result.payload.description).toContain(`${DIE_ROLL_TOTAL} damage`);
    });

    it('describes attack_roll_bonus effect with attack roll text', async () => {
        dataLoader.loadManeuvers.mockResolvedValue([
            { name: 'Precision Attack', effect: 'attack_roll_bonus' },
        ]);

        const result = await onCombatSuperioritySelected(
            makeAction(),
            makePlayerStats(),
            'test-campaign',
            null,
            'Precision Attack'
        );

        expect(result.payload.description).toContain(String(DIE_ROLL_TOTAL));
        expect(result.payload.description).toContain('attack roll');
    });

    it('describes skill_check actionType with ability check text', async () => {
        dataLoader.loadManeuvers.mockResolvedValue([
            { name: 'Ambush', actionType: 'skill_check' },
        ]);

        const result = await onCombatSuperioritySelected(
            makeAction(),
            makePlayerStats(),
            'test-campaign',
            null,
            'Ambush'
        );

        expect(result.payload.description).toContain(String(DIE_ROLL_TOTAL));
        expect(result.payload.description).toContain('ability check');
    });
});

describe('combatSuperiorityHandler.executeManeuver - edge cases and HP restoration', () => {
    beforeEach(() => {
        vi.clearAllMocks();
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
    });

    it('uses player level 1 when level is missing for temp_hp calculation', async () => {
        dataLoader.loadManeuvers.mockResolvedValue([
            { name: 'Rally', effect: 'temp_hp' },
        ]);
        rollExpression.mockReturnValue({ total: 3 });

        const result = await onCombatSuperioritySelected(
            makeAction(),
            makePlayerStats({ level: undefined }),
            'test-campaign',
            null,
            'Rally'
        );

        expect(result.payload.description).toContain('3 Temporary Hit Points');
        expect(result.payload.description).toContain('0 from half Fighter level');
    });

    it('restores HP up to max when damage_reduction effect is used', async () => {
        dataLoader.loadManeuvers.mockResolvedValue([
            { name: 'Parry', effect: 'damage_reduction' },
        ]);
        getRuntimeValue.mockImplementation((_playerName, key) => {
            if (key === 'superiorityDice') return DEFAULT_SUPERIORITY_DICE;
            if (key === 'hitPoints') return 20;
            if (key === 'currentHitPoints') return 8;
            return undefined;
        });

        const result = await onCombatSuperioritySelected(
            makeAction(),
            makePlayerStats(),
            'test-campaign',
            null,
            'Parry'
        );

        expect(setRuntimeValue).toHaveBeenCalledWith(
            'TestFighter',
            'currentHitPoints',
            17,
            'test-campaign'
        );
        expect(result.payload.description).toContain('HP restored: 8 \u2192 17');
    });

    it('caps HP restoration at max HP', async () => {
        dataLoader.loadManeuvers.mockResolvedValue([
            { name: 'Parry', effect: 'damage_reduction' },
        ]);
        getRuntimeValue.mockImplementation((_playerName, key) => {
            if (key === 'superiorityDice') return DEFAULT_SUPERIORITY_DICE;
            if (key === 'hitPoints') return 20;
            if (key === 'currentHitPoints') return 18;
            return undefined;
        });

        const result = await onCombatSuperioritySelected(
            makeAction(),
            makePlayerStats(),
            'test-campaign',
            null,
            'Parry'
        );

        expect(setRuntimeValue).toHaveBeenCalledWith(
            'TestFighter',
            'currentHitPoints',
            20,
            'test-campaign'
        );
        expect(result.payload.description).toContain('HP restored: 18 \u2192 20');
    });

    it('skips HP restoration when already at max', async () => {
        dataLoader.loadManeuvers.mockResolvedValue([
            { name: 'Parry', effect: 'damage_reduction' },
        ]);
        getRuntimeValue.mockImplementation((_playerName, key) => {
            if (key === 'superiorityDice') return DEFAULT_SUPERIORITY_DICE;
            if (key === 'hitPoints') return 20;
            if (key === 'currentHitPoints') return 20;
            return undefined;
        });

        const result = await onCombatSuperioritySelected(
            makeAction(),
            makePlayerStats(),
            'test-campaign',
            null,
            'Parry'
        );

        const chpCalls = setRuntimeValue.mock.calls.filter(
            call => call[0] === 'TestFighter' && call[1] === 'currentHitPoints'
        );
        expect(chpCalls).toHaveLength(0);
        expect(result.payload.description).toContain('HP restored: 20 \u2192 20');
    });

    it('does not show target line for ac_bonus_and_swap effect', async () => {
        dataLoader.loadManeuvers.mockResolvedValue([
            { name: 'Bait and Switch', effect: 'ac_bonus_and_swap' },
        ]);

        const result = await onCombatSuperioritySelected(
            makeAction(),
            makePlayerStats(),
            'test-campaign',
            null,
            'Bait and Switch'
        );

        expect(result.payload.description).not.toContain('Target:');
    });

    it('does not show target line for ac_bonus_disengage effect', async () => {
        dataLoader.loadManeuvers.mockResolvedValue([
            { name: 'Evasive Footwork', effect: 'ac_bonus_disengage' },
        ]);

        const result = await onCombatSuperioritySelected(
            makeAction(),
            makePlayerStats(),
            'test-campaign',
            null,
            'Evasive Footwork'
        );

        expect(result.payload.description).not.toContain('Target:');
    });

    it('does not show target line for damage_reduction effect', async () => {
        dataLoader.loadManeuvers.mockResolvedValue([
            { name: 'Parry', effect: 'damage_reduction' },
        ]);

        const result = await onCombatSuperioritySelected(
            makeAction(),
            makePlayerStats(),
            'test-campaign',
            null,
            'Parry'
        );

        expect(result.payload.description).not.toContain('Target:');
    });

    it('includes automation in popup payload for not-found maneuver', async () => {
        dataLoader.loadManeuvers.mockResolvedValue([
            { name: 'Trip Attack', effect: 'knock_prone' },
        ]);

        const result = await onCombatSuperioritySelected(
            makeAction(),
            makePlayerStats(),
            'test-campaign',
            null,
            'Unknown Maneuver'
        );

        expect(result.payload.automation).toEqual(makeAction().automation);
    });
});
