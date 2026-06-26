// @improved-by-ai
import { describe, it, expect, vi } from 'vitest';
import { onCombatSuperioritySelected } from './combatSuperiorityHandler.js';
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
        damageUtils.getCombatContext.mockResolvedValue({
            creatures: [
                { name: 'TestFighter' },
                { name: 'AllyRogue' },
            ],
        });

        const result = await onCombatSuperioritySelected(
            makeAction(),
            makePlayerStats(),
            'test-campaign',
            null,
            "Commander's Strike"
        );

        expect(result.type).toBe('modal');
        expect(result.modalName).toBe('commanderStrikeChoice');
        expect(result.payload.dieValue).toBe(DIE_ROLL_TOTAL);
        expect(result.payload.options.length).toBe(1);
        expect(result.payload.options[0].value).toBe('AllyRogue');
    });

    it('returns modal for ac_bonus_and_swap effect with self and ally options', async () => {
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

        expect(result.type).toBe('modal');
        expect(result.modalName).toBe('baitAndSwitchChoice');
        expect(result.payload.dieValue).toBe(DIE_ROLL_TOTAL);
        expect(result.payload.maneuverName).toBe('Bait and Switch');
        expect(result.payload.options).toBeDefined();
        expect(result.payload.options.length).toBeGreaterThanOrEqual(1);
        expect(result.payload.options[0].value).toBe('TestFighter');
        expect(result.payload.description).toContain('+5 AC');
        expect(result.payload.description).not.toContain('Target:');
        expect(setRuntimeValue).not.toHaveBeenCalledWith(expect.any(String), 'baitAndSwitchActive', true, expect.any(String));
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
        expect(result.payload.description).toContain('next melee hit this turn');
        expect(result.payload.description).toContain(String(DIE_ROLL_TOTAL));
    });

    it('describes temp_hp effect returns rallyChoice modal with ally options', async () => {
        dataLoader.loadManeuvers.mockResolvedValue([
            { name: 'Rally', effect: 'temp_hp' },
        ]);
        damageUtils.getCombatContext.mockResolvedValue({
            creatures: [
                { name: 'Goblin' },
            ],
        });

        const result = await onCombatSuperioritySelected(
            makeAction(),
            makePlayerStats({ level: 15 }),
            'test-campaign',
            null,
            'Rally'
        );

        expect(result.type).toBe('modal');
        expect(result.modalName).toBe('rallyChoice');
        expect(result.payload.allyOptions).toHaveLength(1);
        expect(result.payload.allyOptions[0].label).toBe('Goblin');
        expect(result.payload.totalHp).toBe(12);
        expect(result.payload.extraHp).toBe(7);
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
