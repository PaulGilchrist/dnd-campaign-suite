// @maintained-by-ai: 2026-10-15
// combatSuperiorityHandlerQuery.test.js — Query-lane baseline for the maneuver
// option builders behind the combatSuperiorityHandler barrel (combatSuperiorityQueries.js
// + dispatchers.js): early-return gates (no known maneuvers / no superiority dice),
// actionType + trigger filtering, attack-rider / skill-check prompt payloads (null
// gates, pending-prompt clearing on exhaustion, modal payload shape), and the
// consumer-facing options formatting passthrough. Deterministic — runtime, dataLoader
// and combatData are fully mocked and the maneuver cache is armed in every beforeEach,
// so no test depends on another test's side effects.
//
// Trim notes (2026-10-15): removed 'filters miss-triggered maneuvers when attack
// missed' (same assertion as combatSuperiorityQueries.mn018.test.js 'still offers
// Precision Attack on a miss', triple-covered by mn014's 'still offers Precision
// Attack on a MISS (both entry points)') and 'attack-rider prompt keeps Battle Master
// level-table superiority_die token' (same assertion as combatSuperiorityQueries.mn020.test.js
// 'rebuilds the action automation with the "ability" token, not a number'). Wrapper-level
// "returns empty" pins on getAttackRiderOptions(ByContext) folded into the inner query
// gates — one pin per branch. The opaque no-op handleAttackRiderPrompt calls that
// secretly relied on a prior test populating the module cache were replaced with an
// explicit arming step. Added the untested dice-gate branches and the prompt-clear /
// no-write side-effect pins the early returns perform.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    getAvailableAttackRiderManeuvers,
    getAvailableAttackRiderManeuversByTrigger,
    getAvailableSkillCheckManeuvers,
    getAttackRiderOptions,
    getAttackRiderOptionsByContext,
    getManeuversForRules,
    handleAttackRiderPrompt,
    handleSkillCheckPrompt,
} from './combatSuperiorityHandler.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import * as dataLoader from '../../../../services/ui/dataLoader.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../../../services/ui/dataLoader.js', () => ({
    loadManeuvers: vi.fn(),
    loadWildMagicSurgeTable: vi.fn(async () => []),
}));

vi.mock('../../../../services/encounters/combatData.js', () => ({
    getCurrentCombatRound: vi.fn(() => 1),
}));

const SELECTION_KEY = 'BattleMasterManeuvers_selection';

const allManeuvers = [
    { name: 'Trip Attack', effect: 'knock_prone', actionType: 'attack_rider', trigger: 'melee_weapon_attack_hit' },
    { name: 'Pushing Attack', effect: 'push', actionType: 'attack_rider', trigger: 'weapon_attack_hit', saveType: 'STR', value: 15 },
    { name: 'Rally', effect: 'temp_hp', actionType: 'bonus_action' },
    { name: 'Distracting Strike', effect: 'distracting_strike_advantage', actionType: 'attack_rider', trigger: 'melee_weapon_attack_hit' },
    { name: 'Maneuvering Attack', effect: 'ally_movement', actionType: 'attack_rider', trigger: 'any', damageBonus: true },
    { name: 'Precision Attack', effect: 'attack_roll_bonus', actionType: 'attack_rider', trigger: 'any' },
    { name: 'Ambush', actionType: 'skill_check', skills: ['Stealth', 'DEX'], initiativeBonus: false },
    { name: 'Quick Insight', actionType: 'skill_check', initiativeBonus: true },
];

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
    size: 'Medium',
    ...overrides,
});

// ── Shared helpers ─────────────────────────────────────────────────────

// The queries module caches loadManeuvers() results per ruleset on first call.
// Every block arms that cache explicitly in beforeEach — a query must never
// depend on some earlier test having populated it.
async function populateManeuverCache() {
    await getManeuversForRules('2024');
}

// ── Shared runtime fixtures ────────────────────────────────────────────

const makeNoManeuversRuntime = () =>
    vi.fn().mockImplementation((_playerName, key, _campaignName) => {
        if (key === 'superiorityDice') return 4;
        if (key === SELECTION_KEY) return [];
        return undefined;
    });

const makeNoDiceRuntime = () =>
    vi.fn().mockImplementation((_playerName, key, _campaignName) => {
        if (key === 'superiorityDice') return 0;
        if (key === SELECTION_KEY) return ['Trip Attack'];
        return undefined;
    });

const makeReadyRuntime = (maneuverNames = ['Trip Attack', 'Pushing Attack']) =>
    vi.fn().mockImplementation((_playerName, key, _campaignName) => {
        if (key === 'superiorityDice') return 4;
        if (key === SELECTION_KEY) return maneuverNames;
        return undefined;
    });

// ── getAvailableAttackRiderManeuvers ───────────────────────────────────

describe('getAvailableAttackRiderManeuvers', () => {
    beforeEach(async () => {
        vi.clearAllMocks();
        dataLoader.loadManeuvers.mockResolvedValue(allManeuvers);
        await populateManeuverCache();
    });

    it('returns empty when no maneuvers are known', async () => {
        getRuntimeValue.mockImplementation(makeNoManeuversRuntime());

        const result = await getAvailableAttackRiderManeuvers(
            makePlayerStats(),
            'test-campaign',
            { weaponType: 'melee', hit: true }
        );

        expect(result).toEqual([]);
    });

    it('returns empty when no superiority dice even with known maneuvers', async () => {
        getRuntimeValue.mockImplementation(makeNoDiceRuntime());

        const result = await getAvailableAttackRiderManeuvers(
            makePlayerStats(),
            'test-campaign',
            { weaponType: 'melee', hit: true }
        );

        expect(result).toEqual([]);
    });

    it('filters known maneuvers to attack_rider types matching the attack trigger', async () => {
        // Rally (bonus_action) must fall to the actionType gate even when known.
        getRuntimeValue.mockImplementation(makeReadyRuntime(['Trip Attack', 'Maneuvering Attack', 'Rally']));

        const result = await getAvailableAttackRiderManeuvers(
            makePlayerStats(),
            'test-campaign',
            { weaponType: 'melee', hit: true }
        );

        expect(result).toHaveLength(2);
        expect(result.map(m => m.name)).toEqual(['Trip Attack', 'Maneuvering Attack']);
    });
});

// ── getAvailableAttackRiderManeuversByTrigger ──────────────────────────

describe('getAvailableAttackRiderManeuversByTrigger', () => {
    beforeEach(async () => {
        vi.clearAllMocks();
        dataLoader.loadManeuvers.mockResolvedValue(allManeuvers);
        await populateManeuverCache();
    });

    it('returns empty when no maneuvers are known', async () => {
        getRuntimeValue.mockImplementation(makeNoManeuversRuntime());

        const result = await getAvailableAttackRiderManeuversByTrigger(
            makePlayerStats(),
            'test-campaign',
            { weaponType: 'melee', hit: true }
        );

        expect(result).toEqual([]);
    });

    it('returns empty when no superiority dice even with known maneuvers', async () => {
        getRuntimeValue.mockImplementation(makeNoDiceRuntime());

        const result = await getAvailableAttackRiderManeuversByTrigger(
            makePlayerStats(),
            'test-campaign',
            { weaponType: 'melee', hit: true }
        );

        expect(result).toEqual([]);
    });

    // Melee-context miss offers live in the mn018/mn014 offer-gate lanes;
    // this pins the RANGED variant of the same gates (mn files stay melee).
    it('excludes melee-only maneuvers on ranged miss but still offers trigger-agnostic riders', async () => {
        getRuntimeValue.mockImplementation(makeReadyRuntime(['Trip Attack', 'Precision Attack']));

        const result = await getAvailableAttackRiderManeuversByTrigger(
            makePlayerStats(),
            'test-campaign',
            { weaponType: 'ranged', hit: false }
        );

        expect(result).toHaveLength(1);
        expect(result[0].name).toBe('Precision Attack');
    });
});

// ── getAvailableSkillCheckManeuvers ────────────────────────────────────

describe('getAvailableSkillCheckManeuvers', () => {
    beforeEach(async () => {
        vi.clearAllMocks();
        dataLoader.loadManeuvers.mockResolvedValue(allManeuvers);
        await populateManeuverCache();
    });

    it('returns empty when no maneuvers are known', () => {
        getRuntimeValue.mockImplementation(makeNoManeuversRuntime());

        const result = getAvailableSkillCheckManeuvers(
            makePlayerStats(),
            'test-campaign',
            'Stealth',
            false
        );

        expect(result).toEqual([]);
    });

    it('returns empty when no superiority dice even with known maneuvers', () => {
        getRuntimeValue.mockImplementation(makeNoDiceRuntime());

        const result = getAvailableSkillCheckManeuvers(
            makePlayerStats(),
            'test-campaign',
            'Stealth',
            false
        );

        expect(result).toEqual([]);
    });

    it('filters skill_check maneuvers by skill name', () => {
        getRuntimeValue.mockImplementation(makeReadyRuntime(['Ambush', 'Quick Insight']));

        const result = getAvailableSkillCheckManeuvers(
            makePlayerStats(),
            'test-campaign',
            'Stealth',
            false
        );

        expect(result).toHaveLength(1);
        expect(result[0].name).toBe('Ambush');
    });

    it('returns initiative maneuvers when isInitiative is true', () => {
        getRuntimeValue.mockImplementation(makeReadyRuntime(['Ambush', 'Quick Insight']));

        const result = getAvailableSkillCheckManeuvers(
            makePlayerStats(),
            'test-campaign',
            'Stealth',
            true
        );

        expect(result).toHaveLength(2);
    });
});

// ── handleAttackRiderPrompt ────────────────────────────────────────────

describe('handleAttackRiderPrompt', () => {
    beforeEach(async () => {
        vi.clearAllMocks();
        dataLoader.loadManeuvers.mockResolvedValue(allManeuvers);
        await populateManeuverCache();
    });

    it('returns null without touching the store when no prompt is pending', async () => {
        getRuntimeValue.mockReturnValue(null);

        const result = await handleAttackRiderPrompt(
            { name: 'Test', automation: { type: 'combat_superiority' } },
            makePlayerStats(),
            'test-campaign',
            null
        );

        expect(result).toBeNull();
        expect(setRuntimeValue).not.toHaveBeenCalled();
    });

    // Exhaustion branches must disarm the pending prompt, never strand it.
    it.each([
        ['no maneuvers are known', [], 4],
        ['no superiority dice remain', ['Trip Attack'], 0],
    ])('returns null and clears the pending prompt when %s', async (_label, selection, dice) => {
        getRuntimeValue.mockImplementation((_playerName, key, _campaignName) => {
            if (key === 'pendingCombatSuperiorityPrompt') return { attackContext: { hit: true, weaponType: 'melee' } };
            if (key === 'superiorityDice') return dice;
            if (key === SELECTION_KEY) return selection;
            return undefined;
        });

        const result = await handleAttackRiderPrompt(
            { name: 'Test', automation: { type: 'combat_superiority' } },
            makePlayerStats(),
            'test-campaign',
            null
        );

        expect(result).toBeNull();
        expect(setRuntimeValue).toHaveBeenCalledWith(
            'TestFighter',
            'pendingCombatSuperiorityPrompt',
            null,
            'test-campaign'
        );
    });

    it('returns modal with available maneuvers when conditions are met', async () => {
        getRuntimeValue.mockImplementation((_playerName, key, _campaignName) => {
            if (key === 'pendingCombatSuperiorityPrompt') return { attackContext: { hit: true, weaponType: 'melee' } };
            if (key === 'superiorityDice') return 4;
            if (key === SELECTION_KEY) return ['Trip Attack'];
            return undefined;
        });

        const result = await handleAttackRiderPrompt(
            { name: 'Test', automation: { type: 'combat_superiority' } },
            makePlayerStats(),
            'test-campaign',
            null
        );

        expect(result.type).toBe('modal');
        expect(result.modalName).toBe('combatSuperiority');
        expect(result.payload.knownManeuvers).toEqual(['Trip Attack']);
        expect(result.payload.maxOptions).toBe(1);
        // A live prompt is NOT cleared — the modal still owns it.
        expect(setRuntimeValue).not.toHaveBeenCalled();
    });
});

// ── handleSkillCheckPrompt ─────────────────────────────────────────────

describe('handleSkillCheckPrompt', () => {
    beforeEach(async () => {
        vi.clearAllMocks();
        dataLoader.loadManeuvers.mockResolvedValue(allManeuvers);
        await populateManeuverCache();
    });

    it('returns null without touching the store when no prompt is pending', async () => {
        getRuntimeValue.mockReturnValue(null);

        const result = await handleSkillCheckPrompt(
            { name: 'Test', automation: { type: 'combat_superiority' } },
            makePlayerStats(),
            'test-campaign',
            null
        );

        expect(result).toBeNull();
        expect(setRuntimeValue).not.toHaveBeenCalled();
    });

    // Unlike the attack-rider lane, the skill-check lane returns null without
    // clearing the prompt (the caller owns lifecycle) — kept unpinned so a
    // future parity fix does not break this baseline.
    it('returns null when no maneuvers are known', async () => {
        getRuntimeValue.mockImplementation((_playerName, key, _campaignName) => {
            if (key === 'pendingCombatSuperiorityPrompt') return { skillContext: { skillName: 'Stealth' } };
            if (key === 'superiorityDice') return 4;
            if (key === SELECTION_KEY) return [];
            return undefined;
        });

        const result = await handleSkillCheckPrompt(
            { name: 'Test', automation: { type: 'combat_superiority' } },
            makePlayerStats(),
            'test-campaign',
            null
        );

        expect(result).toBeNull();
    });

    it('returns null when no superiority dice remain', async () => {
        getRuntimeValue.mockImplementation((_playerName, key, _campaignName) => {
            if (key === 'pendingCombatSuperiorityPrompt') return { skillContext: { skillName: 'Stealth' } };
            if (key === 'superiorityDice') return 0;
            if (key === SELECTION_KEY) return ['Ambush'];
            return undefined;
        });

        const result = await handleSkillCheckPrompt(
            { name: 'Test', automation: { type: 'combat_superiority' } },
            makePlayerStats(),
            'test-campaign',
            null
        );

        expect(result).toBeNull();
    });

    it('returns modal with skill check maneuvers when conditions are met', async () => {
        getRuntimeValue.mockImplementation((_playerName, key, _campaignName) => {
            if (key === 'pendingCombatSuperiorityPrompt') return { skillContext: { skillName: 'Stealth', isInitiative: false } };
            if (key === SELECTION_KEY) return ['Ambush'];
            if (key === 'superiorityDice') return 4;
            return undefined;
        });

        const result = await handleSkillCheckPrompt(
            { name: 'Test', automation: { type: 'combat_superiority' } },
            makePlayerStats(),
            'test-campaign',
            null
        );

        expect(result.type).toBe('modal');
        expect(result.modalName).toBe('combatSuperiority');
        expect(result.payload.knownManeuvers).toEqual(['Ambush']);
        expect(result.payload.skillContext).toEqual({ skillName: 'Stealth', isInitiative: false });
        expect(setRuntimeValue).not.toHaveBeenCalled();
    });
});

// ── getAttackRiderOptions / getAttackRiderOptionsByContext (formatters) ─

describe('getAttackRiderOptions', () => {
    beforeEach(async () => {
        vi.clearAllMocks();
        dataLoader.loadManeuvers.mockResolvedValue(allManeuvers);
        await populateManeuverCache();
    });

    it('returns formatted options for known attack rider maneuvers', async () => {
        getRuntimeValue.mockImplementation(makeReadyRuntime(['Trip Attack', 'Pushing Attack']));

        const result = await getAttackRiderOptions(
            makePlayerStats(),
            'test-campaign',
            { weaponType: 'melee', hit: true, targetName: 'Goblin' }
        );

        expect(result).toHaveLength(2);
        expect(result[0]).toEqual(
            expect.objectContaining({
                name: 'Trip Attack',
                effect: 'knock_prone',
                damageBonus: false,
                saveType: null,
                saveAbility: null,
                conditionInflicted: null,
                value: null,
                range: null,
                dieExpression: 'superiority_die',
            })
        );
        // Maneuvers that DO declare save/metadata must pass it through untouched.
        expect(result[1]).toEqual(
            expect.objectContaining({
                name: 'Pushing Attack',
                effect: 'push',
                damageBonus: false,
                saveType: 'STR',
                value: 15,
                dieExpression: 'superiority_die',
            })
        );
    });
});

describe('getAttackRiderOptionsByContext', () => {
    beforeEach(async () => {
        vi.clearAllMocks();
        dataLoader.loadManeuvers.mockResolvedValue(allManeuvers);
        await populateManeuverCache();
    });

    it('passes trigger, actionType and context through for trigger-agnostic maneuvers', async () => {
        getRuntimeValue.mockImplementation(makeReadyRuntime(['Maneuvering Attack']));

        const result = await getAttackRiderOptionsByContext(
            makePlayerStats(),
            'test-campaign',
            { weaponType: 'ranged', hit: false },
            'miss'
        );

        expect(result).toHaveLength(1);
        expect(result[0]).toEqual(
            expect.objectContaining({
                name: 'Maneuvering Attack',
                effect: 'ally_movement',
                damageBonus: true,
                dieExpression: 'superiority_die',
                trigger: 'any',
                actionType: 'attack_rider',
                context: 'miss',
            })
        );
    });
});

// ── FS-010: prompt payload dieExpression honors the character's style ──
// Battle Master token passthrough is pinned by combatSuperiorityQueries.mn020.test.js.

describe('FS-010 prompt payload dieExpression', () => {
    beforeEach(async () => {
        vi.clearAllMocks();
        dataLoader.loadManeuvers.mockResolvedValue(allManeuvers);
        await populateManeuverCache();
    });

    const styleStats = () => makePlayerStats({
        level: 18,
        class: { name: 'Fighter', subclass: { name: 'Champion' }, fightingStyles: ['Superior Technique'] },
        specialActions: [{
            name: 'Combat Superiority',
            type: 'combat_superiority',
            automation: { type: 'combat_superiority', dieExpression: '6', uses_max: 1, maxOptions: 1 },
        }],
    });

    const makePromptRuntime = (maneuverNames, extra = {}) =>
        vi.fn().mockImplementation((_playerName, key, _campaignName) => {
            if (key === 'superiorityDice') return 1;
            if (key === SELECTION_KEY) return maneuverNames;
            if (key === 'pendingCombatSuperiorityPrompt') return extra;
            return undefined;
        });

    it('attack-rider prompt carries the Superior Technique style d6, not the level-table token', async () => {
        getRuntimeValue.mockImplementation(makePromptRuntime(['Trip Attack'], { attackContext: { hit: true, weaponType: 'melee', targetName: 'Thug 1' } }));

        const result = await handleAttackRiderPrompt(
            { name: 'Combat Superiority', automation: { trigger: 'attack_rider' } },
            styleStats(),
            'test-campaign',
            null
        );

        expect(result.type).toBe('modal');
        expect(result.payload.action.automation.dieExpression).toBe('6');
    });

    it('skill-check prompt carries the style d6 for Superior Technique fighters', async () => {
        getRuntimeValue.mockImplementation(makePromptRuntime(['Ambush'], { skillContext: { skillName: 'Stealth' } }));

        const result = await handleSkillCheckPrompt(
            { name: 'Combat Superiority', automation: { trigger: 'skill_check' } },
            styleStats(),
            'test-campaign',
            null
        );

        expect(result.type).toBe('modal');
        expect(result.payload.action.automation.dieExpression).toBe('6');
    });
});
