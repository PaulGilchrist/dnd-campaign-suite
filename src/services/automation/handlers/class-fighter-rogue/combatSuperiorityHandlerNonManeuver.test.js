import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    handleCombatSuperioritySkillCheck,
    handleCombatSuperiorityCommandingPresenceReaction,
    onCombatSuperioritySelected,
} from './combatSuperiorityHandler.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import * as dataLoader from '../../../../services/ui/dataLoader.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(async () => {}),
}));

vi.mock('../../../../services/ui/dataLoader.js', () => ({
    loadManeuvers: vi.fn(async (_rules) => [
        { name: 'Trip Attack', effect: 'prone', trigger: 'weapon_attack_hit', saveType: 'STR', damageBonus: true, actionType: 'attack_rider' },
        { name: 'Pushing Attack', effect: 'push', trigger: 'weapon_attack_hit', saveType: 'STR', value: 15, damageBonus: true, actionType: 'attack_rider' },
        { name: 'Goading Attack', effect: 'goad', trigger: 'weapon_attack_hit', saveType: 'WIS', damageBonus: true, actionType: 'attack_rider' },
        { name: 'Disarming Attack', effect: 'disarm', trigger: 'weapon_attack_hit', saveType: 'STR', damageBonus: true, actionType: 'attack_rider' },
        { name: 'Menacing Attack', effect: 'frightened', trigger: 'weapon_attack_hit', saveType: 'WIS', damageBonus: true, actionType: 'attack_rider' },
        { name: 'Distracting Strike', effect: 'distracting_strike_advantage', trigger: 'weapon_attack_hit', damageBonus: true, actionType: 'attack_rider' },
        { name: 'Maneuvering Attack', effect: 'ally_movement', trigger: 'weapon_attack_hit', damageBonus: true, actionType: 'attack_rider' },
        { name: 'Precision Attack', effect: 'attack_roll_bonus', trigger: 'attack_roll_miss', actionType: 'attack_rider' },
        { name: 'Sweeping Attack', effect: 'secondary_damage', trigger: 'melee_weapon_attack_hit', damageBonus: false, actionType: 'attack_rider' },
        { name: 'Evasive Footwork', effect: 'ac_bonus_disengage', actionType: 'bonus_action' },
        { name: 'Feinting Attack', effect: 'advantage_and_damage', actionType: 'bonus_action' },
        { name: 'Lunging Attack', effect: 'dash_and_damage', actionType: 'bonus_action' },
        { name: 'Rally', effect: 'temp_hp', actionType: 'bonus_action', extraHpExpression: '1d4' },
        { name: "Commander's Strike", effect: null, actionType: 'grant_attack' },
        { name: 'Bait and Switch', effect: 'ac_bonus_and_swap', actionType: 'movement' },
        { name: 'Ambush', actionType: 'skill_check', skills: ['Stealth'], initiativeBonus: true, dieExpression: 'superiority_die' },
        { name: 'Tactical Assessment', actionType: 'skill_check', skills: ['Insight'], ability: 'Wisdom', dieExpression: 'superiority_die' },
        { name: 'Commanding Presence', actionType: 'skill_check', reactionSaveType: 'WIS', reactionEffect: 'disadvantage_next_attack', reactionDuration: 'until_end_of_next_turn' },
        { name: 'Parry', effect: 'damage_reduction', actionType: 'reaction' },
        { name: 'Riposte', effect: 'melee_attack_reaction', actionType: 'reaction' },
    ]),
    loadWildMagicSurgeTable: vi.fn(async () => []),
}));

vi.mock('../../../../services/encounters/combatData.js', () => ({
    getCurrentCombatRound: vi.fn(() => 1),
}));

vi.mock('../../../../services/ui/logService.js', () => ({
    addEntry: vi.fn(async () => {}),
}));

vi.mock('../../../../services/rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn().mockResolvedValue({
        creatures: [
            { name: 'Goblin', type: 'npc', maxHp: 7 },
        ],
    }),
    getTargetFromAttacker: vi.fn(() => null),
}));

const SELECTION_KEY = 'BattleMasterManeuvers_selection';

const makePlayerStats = (overrides = {}) => ({
    name: 'TestFighter',
    proficiency: 3,
    abilities: [
        { name: 'STR', bonus: 4 },
        { name: 'DEX', bonus: 2 },
        { name: 'CON', bonus: 1 },
        { name: 'INT', bonus: 0 },
        { name: 'WIS', bonus: 0 },
        { name: 'CHA', bonus: 0 },
    ],
    level: 5,
    rules: '2024',
    automation: { passives: [], actions: [], bonusActions: [], reactions: [], specialActions: [] },
    ...overrides,
});

/* ------------------------------------------------------------------ */
/*  handleCombatSuperioritySkillCheck                                  */
/* ------------------------------------------------------------------ */

describe('handleCombatSuperioritySkillCheck', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it.each([
        [{ name: 'Test' }, 'missing automation object'],
        [{ name: 'Test', automation: null }, 'automation is null'],
        [{ name: 'Test', automation: { maneuverName: '' } }, 'maneuverName is empty string'],
    ])('returns popup with error when maneuverName is invalid (%s)', async (action, _description) => {
        const result = await handleCombatSuperioritySkillCheck(
            action,
            makePlayerStats(),
            'test-campaign',
            null
        );

        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.description).toBe('No maneuver specified.');
    });

    it('delegates to executeSkillCheckManeuver and returns its result when maneuverName is provided', async () => {
        getRuntimeValue.mockImplementation((_playerName, key, _campaignName) => {
            if (key === 'superiorityDice') return 4;
            if (key === SELECTION_KEY) return ['Tactical Assessment'];
            return undefined;
        });

        const result = await handleCombatSuperioritySkillCheck(
            { name: 'Test', automation: { maneuverName: 'Tactical Assessment' } },
            makePlayerStats(),
            'test-campaign',
            null
        );

        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.name).toBe('Tactical Assessment');
        expect(result.payload.description).toContain('Tactical Assessment');
        expect(result).toHaveProperty('logEntries');
    });
});

/* ------------------------------------------------------------------ */
/*  handleCombatSuperiorityCommandingPresenceReaction                  */
/* ------------------------------------------------------------------ */

describe('handleCombatSuperiorityCommandingPresenceReaction', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it.each([
        [{ name: 'Test' }, 'missing automation object'],
        [{ name: 'Test', automation: null }, 'automation is null'],
        [{ name: 'Test', automation: { maneuverName: '' } }, 'maneuverName is empty string'],
    ])('returns popup with error when maneuverName is invalid (%s)', async (action, _description) => {
        const result = await handleCombatSuperiorityCommandingPresenceReaction(
            action,
            makePlayerStats(),
            'test-campaign',
            null
        );

        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.description).toBe('No maneuver specified.');
    });

    it('delegates to executeCommandingPresenceReaction and returns modal when no target is set', async () => {
        getRuntimeValue.mockImplementation((_playerName, key, _campaignName) => {
            if (key === 'superiorityDice') return 4;
            if (key === SELECTION_KEY) return ['Commanding Presence'];
            return undefined;
        });

        const result = await handleCombatSuperiorityCommandingPresenceReaction(
            { name: 'Test', automation: { maneuverName: 'Commanding Presence' } },
            makePlayerStats(),
            'test-campaign',
            null
        );

        expect(result.type).toBe('modal');
        expect(result.modalName).toBe('commandingPresenceReaction');
        expect(result.payload.onTargetSelected).toBeDefined();
    });
});

/* ------------------------------------------------------------------ */
/*  onCombatSuperioritySelected                                        */
/* ------------------------------------------------------------------ */

describe('onCombatSuperioritySelected', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // ── Empty array path ──────────────────────────────────────────────

    describe('empty array path', () => {
        it('clears selection and returns info popup when empty array is passed', async () => {
            const result = await onCombatSuperioritySelected(
                { name: 'Test', automation: { type: 'combat_superiority' } },
                makePlayerStats(),
                'test-campaign',
                []
            );

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toBe('Battle Master selection cleared.');
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestFighter',
                SELECTION_KEY,
                [],
                'test-campaign'
            );
        });
    });

    // ── Non-empty array path ──────────────────────────────────────────

    describe('non-empty array path', () => {
        it('filters selected maneuvers against known list and stores only valid ones', async () => {
            const result = await onCombatSuperioritySelected(
                { name: 'Test', automation: { type: 'combat_superiority' } },
                makePlayerStats(),
                'test-campaign',
                ['Trip Attack', 'Nonexistent Maneuver']
            );

            expect(result.type).toBe('popup');
            expect(result.payload.description).toBe('Maneuvers selected: Trip Attack.');
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestFighter',
                SELECTION_KEY,
                ['Trip Attack'],
                'test-campaign'
            );
        });

        it('returns error popup when all selected maneuvers are invalid', async () => {
            const result = await onCombatSuperioritySelected(
                { name: 'Test', automation: { type: 'combat_superiority' } },
                makePlayerStats(),
                'test-campaign',
                ['Fake Maneuver 1', 'Fake Maneuver 2']
            );

            expect(result.type).toBe('popup');
            expect(result.payload.description).toBe('No valid maneuvers selected.');
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestFighter',
                SELECTION_KEY,
                [],
                'test-campaign'
            );
        });

        it('stores all valid maneuvers when all are recognized', async () => {
            const allManeuvers = [
                { name: 'Trip Attack', effect: 'prone', trigger: 'weapon_attack_hit', saveType: 'STR', damageBonus: true, actionType: 'attack_rider' },
                { name: 'Pushing Attack', effect: 'push', trigger: 'weapon_attack_hit', saveType: 'STR', value: 15, damageBonus: true, actionType: 'attack_rider' },
                { name: 'Goading Attack', effect: 'goad', trigger: 'weapon_attack_hit', saveType: 'WIS', damageBonus: true, actionType: 'attack_rider' },
            ];
            dataLoader.loadManeuvers.mockResolvedValue(allManeuvers);

            const result = await onCombatSuperioritySelected(
                { name: 'Test', automation: { type: 'combat_superiority' } },
                makePlayerStats(),
                'test-campaign',
                ['Trip Attack', 'Pushing Attack', 'Goading Attack']
            );

            expect(result.type).toBe('popup');
            expect(result.payload.description).toBe('Maneuvers selected: Trip Attack, Pushing Attack, Goading Attack.');
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestFighter',
                SELECTION_KEY,
                ['Trip Attack', 'Pushing Attack', 'Goading Attack'],
                'test-campaign'
            );
        });

        it.each([
            [null, '2024'],
            [undefined, '2024'],
            ['5e', '5e'],
        ])('uses %s ruleset when playerStats.rules is %s', async (rulesValue, expectedRules) => {
            await onCombatSuperioritySelected(
                { name: 'Test', automation: { type: 'combat_superiority' } },
                makePlayerStats({ rules: rulesValue }),
                'test-campaign',
                ['Trip Attack']
            );

            expect(dataLoader.loadManeuvers).toHaveBeenCalledWith(expectedRules);
        });
    });

    // ── Single-use maneuver path ──────────────────────────────────────

    describe('single-use maneuver path', () => {
        it('executes the maneuver when singleUseManeuverName is provided without array', async () => {
            getRuntimeValue.mockImplementation((_playerName, key, _campaignName) => {
                if (key === 'superiorityDice') return 4;
                if (key === SELECTION_KEY) return ['Trip Attack'];
                return undefined;
            });

            const result = await onCombatSuperioritySelected(
                { name: 'Test', automation: { type: 'combat_superiority' } },
                makePlayerStats(),
                'test-campaign',
                null,
                'Trip Attack'
            );

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('Trip Attack');
        });

        it('prefers singleUseManeuverName over array selection', async () => {
            getRuntimeValue.mockImplementation((_playerName, key, _campaignName) => {
                if (key === 'superiorityDice') return 4;
                if (key === SELECTION_KEY) return ['Trip Attack'];
                return undefined;
            });

            const result = await onCombatSuperioritySelected(
                { name: 'Test', automation: { type: 'combat_superiority' } },
                makePlayerStats(),
                'test-campaign',
                ['Pushing Attack'],
                'Trip Attack'
            );

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Trip Attack');
        });

        it('removes singleUseManeuver from known list when singleUseManeuver matches and isReload is false', async () => {
            getRuntimeValue.mockImplementation((_playerName, key, _campaignName) => {
                if (key === 'superiorityDice') return 4;
                if (key === SELECTION_KEY) return ['Trip Attack', 'Pushing Attack'];
                return undefined;
            });

            await onCombatSuperioritySelected(
                { name: 'Test', automation: { type: 'combat_superiority', singleUseManeuver: 'Trip Attack', isReload: false } },
                makePlayerStats(),
                'test-campaign',
                null,
                'Trip Attack'
            );

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestFighter',
                SELECTION_KEY,
                ['Pushing Attack'],
                'test-campaign'
            );
        });

        it('does not remove maneuver from known list when isReload is true', async () => {
            getRuntimeValue.mockImplementation((_playerName, key, _campaignName) => {
                if (key === 'superiorityDice') return 4;
                if (key === SELECTION_KEY) return ['Trip Attack'];
                return undefined;
            });

            await onCombatSuperioritySelected(
                { name: 'Test', automation: { type: 'combat_superiority', singleUseManeuver: 'Trip Attack', isReload: true } },
                makePlayerStats(),
                'test-campaign',
                null,
                'Trip Attack'
            );

            expect(setRuntimeValue).not.toHaveBeenCalledWith(
                'TestFighter',
                SELECTION_KEY,
                expect.anything(),
                'test-campaign'
            );
        });

        it('does not remove maneuver when singleUseManeuver does not match selected name', async () => {
            getRuntimeValue.mockImplementation((_playerName, key, _campaignName) => {
                if (key === 'superiorityDice') return 4;
                if (key === SELECTION_KEY) return ['Trip Attack', 'Pushing Attack'];
                return undefined;
            });

            await onCombatSuperioritySelected(
                { name: 'Test', automation: { type: 'combat_superiority', singleUseManeuver: 'Goading Attack', isReload: false } },
                makePlayerStats(),
                'test-campaign',
                null,
                'Trip Attack'
            );

            expect(setRuntimeValue).not.toHaveBeenCalledWith(
                'TestFighter',
                SELECTION_KEY,
                expect.anything(),
                'test-campaign'
            );
        });
    });

    // ── No maneuver selected path ─────────────────────────────────────

    describe('no maneuver selected path', () => {
        it.each([
            [null, null, 'selectedManeuverNames=null, singleUseManeuverName=null'],
            [undefined, null, 'selectedManeuverNames=undefined, singleUseManeuverName=null'],
            [null, undefined, 'selectedManeuverNames=null, singleUseManeuverName=undefined'],
        ])('returns error when (%s)', async (selectedManeuverNames, singleUseManeuverName, _description) => {
            const result = await onCombatSuperioritySelected(
                { name: 'Test', automation: { type: 'combat_superiority' } },
                makePlayerStats(),
                'test-campaign',
                selectedManeuverNames,
                singleUseManeuverName
            );

            expect(result.type).toBe('popup');
            expect(result.payload.description).toBe('No maneuver selected.');
        });
    });
});
