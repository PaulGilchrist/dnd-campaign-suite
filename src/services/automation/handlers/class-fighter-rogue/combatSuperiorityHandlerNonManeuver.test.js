// @maintained-by-ai: 2026-10-15
// combatSuperiorityHandlerNonManeuver.test.js — export-contract lane for the
// non-maneuver dispatchers re-exported through the combatSuperiorityHandler
// barrel: handleCombatSuperioritySkillCheck and
// handleCombatSuperiorityCommandingPresenceReaction (maneuverName guard +
// delegation to their dedicated executors — the routed-level guard messages are
// pinned at a different contract level by combatSuperiorityHandler.test.js),
// plus onCombatSuperioritySelected's multi-selection contract (empty-array
// clear, valid/invalid filtering with the join-message format, falsy-ruleset
// fallback) and its no-selection guard.
//
// Trim notes (2026-10-15): the dispatcher's single-use branch (singleUseManeuverName
// execution, priority over arrays, and the known-list removal incl. isReload
// guards) is unreachable from the only production caller — useCombatSuperiorityModal
// short-circuits single-use to executeManeuver BEFORE dispatching and its
// confirm-basic lane pins that (dispatcher not called). Those five tests were
// removed. Multiple falsy-guard variants hitting the same branch were
// consolidated to one pin per branch per repo convention.

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

const makeSelectionAction = () => ({
    name: 'Test',
    automation: { type: 'combat_superiority' },
});

/* ------------------------------------------------------------------ */
/*  handleCombatSuperioritySkillCheck                                  */
/* ------------------------------------------------------------------ */

describe('handleCombatSuperioritySkillCheck', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // Missing automation, null automation, and empty-string maneuverName all hit
    // the same falsy branch of `action.automation?.maneuverName` — one pin suffices
    // (the routed-level twin of this guard is pinned in combatSuperiorityHandler.test.js).
    it('returns popup with error when maneuverName is missing', async () => {
        const result = await handleCombatSuperioritySkillCheck(
            { name: 'Test' },
            makePlayerStats(),
            'test-campaign',
            null
        );

        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.name).toBe('Test');
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

    // Same single falsy-branch pin as the skill-check dispatcher above.
    it('returns popup with error when maneuverName is missing', async () => {
        const result = await handleCombatSuperiorityCommandingPresenceReaction(
            { name: 'Test' },
            makePlayerStats(),
            'test-campaign',
            null
        );

        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.name).toBe('Test');
        expect(result.payload.description).toBe('No maneuver specified.');
    });

    // Pins that this dispatcher delegates to the CP-SPECIFIC executor
    // (executeCommandingPresenceReaction → target chooser modal), not the
    // generic skill-check lane. Executor internals live in mn004.
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
/*  onCombatSuperioritySelected (multi-selection contract)             */
/* ------------------------------------------------------------------ */

describe('onCombatSuperioritySelected', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // Production callers (useCombatSuperiorityModal) always pass an array with
    // singleUseManeuverName undefined; the dispatcher's single-use branch is
    // unreachable and its consumer lane pins that — only the array + guard
    // paths are pinned here.

    it('clears selection and returns info popup when empty array is passed', async () => {
        const result = await onCombatSuperioritySelected(
            makeSelectionAction(),
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

    it('filters invalid names, stores valid ones, and joins them in the confirmation popup', async () => {
        const result = await onCombatSuperioritySelected(
            makeSelectionAction(),
            makePlayerStats(),
            'test-campaign',
            ['Trip Attack', 'Nonexistent Maneuver', 'Pushing Attack']
        );

        expect(result.type).toBe('popup');
        expect(result.payload.description).toBe('Maneuvers selected: Trip Attack, Pushing Attack.');
        expect(setRuntimeValue).toHaveBeenCalledWith(
            'TestFighter',
            SELECTION_KEY,
            ['Trip Attack', 'Pushing Attack'],
            'test-campaign'
        );
    });

    it('returns error popup when all selected maneuvers are invalid', async () => {
        const result = await onCombatSuperioritySelected(
            makeSelectionAction(),
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

    // null hits the same falsy branch of `playerStats.rules || '2024'` as
    // undefined — one fallback pin plus the 5e passthrough suffice.
    it.each([
        [undefined, '2024'],
        ['5e', '5e'],
    ])('uses %s ruleset fallback when playerStats.rules is %s', async (rulesValue, expectedRules) => {
        await onCombatSuperioritySelected(
            makeSelectionAction(),
            makePlayerStats({ rules: rulesValue }),
            'test-campaign',
            ['Trip Attack']
        );

        expect(dataLoader.loadManeuvers).toHaveBeenCalledWith(expectedRules);
    });

    it('returns error popup when no maneuver names are provided', async () => {
        const result = await onCombatSuperioritySelected(
            makeSelectionAction(),
            makePlayerStats(),
            'test-campaign',
            null,
            null
        );

        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.description).toBe('No maneuver selected.');
    });
});
