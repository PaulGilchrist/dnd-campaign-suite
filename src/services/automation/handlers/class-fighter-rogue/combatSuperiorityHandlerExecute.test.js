import { describe, it, expect, vi, beforeEach } from 'vitest';
import { onCombatSuperioritySelected } from './combatSuperiorityHandler.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { rollExpression } from '../../../dice/diceRoller.js';
import * as targetResolver from '../../common/targetResolver.js';
import { getCurrentCombatRound } from '../../../../services/encounters/combatData.js';
import * as automationService from '../../../combat/automation/automationService.js';
import * as dataLoader from '../../../../services/ui/dataLoader.js';
import * as savePrompt from '../../../automation/common/savePrompt.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../../rules/effects/expirations.js', () => ({
    addExpiration: vi.fn(),
}));

vi.mock('../../../../services/encounters/combatData.js', () => ({
    getCurrentCombatRound: vi.fn(() => 1),
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

vi.mock('../../../rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(),
    getTargetFromAttacker: vi.fn(),
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

describe('combatSuperiorityHandler.executeManeuver - basic execution', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getRuntimeValue.mockImplementation((_playerName, key, _campaignName) => {
            if (key === 'superiorityDice') return 2;
            return undefined;
        });
        rollExpression.mockReturnValue({ total: 5 });
        automationService.evaluateAutoExpression.mockReturnValue(10);
        targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });
    });

    it('returns popup when maneuver not found', async () => {
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
        expect(result.payload.description).toContain('Nonexistent Maneuver');
        expect(result.payload.description).toContain('not found');
    });

    it('expend superiority die on normal execution', async () => {
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
            1,
            'test-campaign'
        );
    });

    it('uses default max uses when runtime value is missing', async () => {
        getRuntimeValue.mockImplementation((_playerName, key, _campaignName) => {
            if (key === 'superiorityDice') return undefined;
            return undefined;
        });
        rollExpression.mockReturnValue({ total: 5 });

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

    it('uses custom uses_max from automation', async () => {
        getRuntimeValue.mockImplementation((_playerName, key, _campaignName) => {
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

    it('returns popup when no superiority dice remaining', async () => {
        getRuntimeValue.mockImplementation((_playerName, key, _campaignName) => {
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
        expect(result.payload.description).toContain('No Superiority Dice remaining');
        expect(result.payload.description).toContain('Short or Long Rest');
    });

    it('includes target name in description when target exists', async () => {
        rollExpression.mockReturnValue({ total: 7 });

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

    it('includes damage bonus in description when maneuver has damageBonus', async () => {
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

    it('uses die value from rollExpression', async () => {
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

        expect(result.payload.description).toContain('Rolled 10 for 9');
    });

    it('handles no target from resolveTarget', async () => {
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
});

describe('combatSuperiorityHandler.executeManeuver - save type maneuvers', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getRuntimeValue.mockImplementation((_playerName, key, _campaignName) => {
            if (key === 'superiorityDice') return 2;
            return undefined;
        });
        rollExpression.mockReturnValue({ total: 5 });
        automationService.evaluateAutoExpression.mockReturnValue(10);
        targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });
        savePrompt.buildSaveDc.mockReturnValue(15);
        savePrompt.createSaveListener.mockReturnValue({
            promise: Promise.resolve({ success: false }),
        });
    });

    it('includes save DC for push effect', async () => {
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

        expect(result.payload.description).toContain('STR save DC');
        expect(result.payload.description).toContain('push');
        expect(result.payload.description).toContain('15 feet');
    });

    it('includes save DC for goad effect with condition', async () => {
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

        expect(result.payload.description).toContain('WIS save DC');
        expect(result.payload.description).toContain('Disadvantage on attacks against targets other than you');
    });

    it('includes save DC for frightened effect', async () => {
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

        expect(result.payload.description).toContain('WIS save DC');
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

        expect(result.payload.description).toContain('STR save DC');
        expect(result.payload.description).toContain('dropped the object');
    });
});

describe('combatSuperiorityHandler.executeManeuver - effect descriptions', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getRuntimeValue.mockImplementation((_playerName, key, _campaignName) => {
            if (key === 'superiorityDice') return 2;
            return undefined;
        });
        rollExpression.mockReturnValue({ total: 5 });
        automationService.evaluateAutoExpression.mockReturnValue(10);
        targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });
    });

    it('describes distracting_strike_advantage effect', async () => {
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

    it('describes ally_movement effect', async () => {
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

        expect(result.payload.description).toContain('Reaction to move');
        expect(result.payload.description).toContain('Opportunity Attacks');
    });

    it('describes grant_attack actionType', async () => {
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
        expect(result.payload.description).toContain('5');
    });

    it('describes ac_bonus_and_swap effect', async () => {
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
    });

    it('describes ac_bonus_disengage effect', async () => {
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
    });

    it('describes advantage_and_damage effect', async () => {
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
        expect(result.payload.description).toContain('5');
    });

    it('describes dash_and_damage effect', async () => {
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
        expect(result.payload.description).toContain('5');
    });

    it('describes temp_hp effect with fighter level', async () => {
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
        expect(result.payload.description).toContain('12'); // 5 (die) + 7 (15/2 rounded down)
        expect(result.payload.description).toContain('half Fighter level');
    });

    it('describes damage_reduction effect with STR/DEX modifier', async () => {
        dataLoader.loadManeuvers.mockResolvedValue([
            { name: 'Parry', effect: 'damage_reduction' },
        ]);

        rollExpression.mockReturnValue({ total: 5 });

        const result = await onCombatSuperioritySelected(
            makeAction(),
            makePlayerStats(),
            'test-campaign',
            null,
            'Parry'
        );

        expect(result.payload.description).toContain('Damage reduced by');
        expect(result.payload.description).toContain('9'); // 5 (die) + 4 (STR modifier)
        expect(result.payload.description).toContain('STR/DEX modifier');
    });

    it('describes melee_attack_reaction effect', async () => {
        dataLoader.loadManeuvers.mockResolvedValue([
            { name: 'Riposte', effect: 'melee_attack_reaction', damageBonus: true },
        ]);

        const playerStats = makePlayerStats({
            attacks: [{ name: 'Melee Attack', hitBonus: 5, range: '5 ft', damage: '1d8' }],
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
    });

    it('describes secondary_damage effect', async () => {
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
        expect(result.payload.description).toContain('5 damage');
    });

    it('describes attack_roll_bonus effect', async () => {
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

        expect(result.payload.description).toContain('5');
        expect(result.payload.description).toContain('attack roll');
    });

    it('describes skill_check actionType', async () => {
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

        expect(result.payload.description).toContain('5');
        expect(result.payload.description).toContain('ability check');
    });
});

describe('combatSuperiorityHandler.executeManeuver - edge cases', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getRuntimeValue.mockImplementation((_playerName, key, _campaignName) => {
            if (key === 'superiorityDice') return 2;
            return undefined;
        });
        rollExpression.mockReturnValue({ total: 5 });
        automationService.evaluateAutoExpression.mockReturnValue(10);
        targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });
    });

    it('handles rollExpression returning null by using die size as fallback', async () => {
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

        // When rollExpression returns null, the code uses superiorityDieSize (10) as fallback
        expect(result.payload.description).toContain('10');
    });

    it('handles maneuver without saveType (no save description)', async () => {
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

        expect(result.payload.description).not.toContain('save');
        expect(result.payload.description).toContain('Advantage');
    });

    it('handles maneuver without damageBonus (no "Added" description)', async () => {
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

    it('uses max of STR/DEX for damage_reduction', async () => {
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

    it('uses player level 1 when level is missing for temp_hp', async () => {
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

    it('uses current combat round for relentless tracking', async () => {
        getCurrentCombatRound.mockReturnValue(3);
        getRuntimeValue.mockImplementation((_playerName, key, _campaignName) => {
            if (key === 'superiorityDice') return 0;
            if (key === 'relentlessUsedRound') return undefined;
            return undefined;
        });

        dataLoader.loadManeuvers.mockResolvedValue([
            { name: 'Relentless', effect: 'relentless' },
        ]);

        rollExpression.mockReturnValue({ total: 6 });

        await onCombatSuperioritySelected(
            makeAction(),
            makePlayerStats({
                automation: {
                    passives: [{ type: 'passive_rule', effect: 'relentless', name: 'Relentless' }],
                },
            }),
            'test-campaign',
            null,
            'Relentless'
        );

        expect(setRuntimeValue).toHaveBeenCalledWith(
            'TestFighter',
            'relentlessUsedRound',
            3,
            'test-campaign'
        );
    });

    it('heals HP when damage_reduction effect is used', async () => {
        dataLoader.loadManeuvers.mockResolvedValue([
            { name: 'Parry', effect: 'damage_reduction' },
        ]);

        rollExpression.mockReturnValue({ total: 5 });
        getRuntimeValue.mockImplementation((_playerName, key, _campaignName) => {
            if (key === 'superiorityDice') return 2;
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
        expect(result.payload.description).toContain('HP restored: 8 → 17');
    });

    it('caps HP restoration at max HP', async () => {
        dataLoader.loadManeuvers.mockResolvedValue([
            { name: 'Parry', effect: 'damage_reduction' },
        ]);

        rollExpression.mockReturnValue({ total: 5 });
        getRuntimeValue.mockImplementation((_playerName, key, _campaignName) => {
            if (key === 'superiorityDice') return 2;
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
        expect(result.payload.description).toContain('HP restored: 18 → 20');
    });

    it('does not set HP when already at max', async () => {
        dataLoader.loadManeuvers.mockResolvedValue([
            { name: 'Parry', effect: 'damage_reduction' },
        ]);

        rollExpression.mockReturnValue({ total: 5 });
        getRuntimeValue.mockImplementation((_playerName, key, _campaignName) => {
            if (key === 'superiorityDice') return 2;
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
        expect(result.payload.description).toContain('HP restored: 20 → 20');
    });
});
