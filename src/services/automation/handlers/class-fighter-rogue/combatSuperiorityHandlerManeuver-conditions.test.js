// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeManeuver } from './combatSuperiorityHandler.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';

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

vi.mock('../../../../services/rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn().mockResolvedValue({ creatures: [{ name: 'Goblin' }] }),
}));

vi.mock('../../../../services/automation/common/targetResolver.js', () => ({
    resolveTarget: vi.fn().mockResolvedValue({ target: { name: 'Goblin' } }),
}));

vi.mock('../../../../services/dice/diceRoller.js', () => ({
    rollExpression: vi.fn(() => ({ total: 4 })),
}));

vi.mock('../../../../services/combat/automation/automationService.js', () => ({
    evaluateAutoExpression: vi.fn((expr) => {
        if (expr === 'superiority_die') return 8;
        if (expr === '1d6') return 6;
        return expr;
    }),
    playerIsImmuneToCondition: vi.fn(() => false),
}));

vi.mock('../../../../services/automation/common/savePrompt.js', () => ({
    buildSaveDc: vi.fn(() => 15),
    createSaveListener: vi.fn(() => ({
        promise: Promise.resolve({ success: false }),
    })),
}));

vi.mock('../../../../services/rules/effects/expirations.js', () => ({
    addExpiration: vi.fn(async () => {}),
}));

import * as expirations from '../../../../services/rules/effects/expirations.js';

vi.mock('../../../../services/rules/combat/applyDamage.js', () => ({
    applyDamageToTarget: vi.fn(() => ({ finalDamage: 4 })),
}));

vi.mock('../../../../services/rules/combat/rangeValidation.js', () => ({
    getDistanceFeet: vi.fn(() => 5),
    rangeToFeet: vi.fn((range) => {
        if (range === '5_ft') return 5;
        if (range === '8_ft') return 8;
        return 5;
    }),
}));

vi.mock('../../../../services/rules/combat/rangeCheck.js', () => ({
    isWithinRange: vi.fn().mockResolvedValue(true),
}));

vi.mock('../../../../services/ui/logService.js', () => ({
    addEntry: vi.fn(async () => {}),
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
    attacks: [{ name: 'Longsword', weaponType: 'melee', damage: '1d8+4', damageType: 'slashing' }],
    automation: { passives: [], actions: [], bonusActions: [], reactions: [], specialActions: [] },
    ...overrides,
});

/* ------------------------------------------------------------------ */
/*  executeManeuver — condition/save effects                           */
/* ------------------------------------------------------------------ */

describe('executeManeuver — condition/save effects', () => {
    beforeEach(async () => {
        vi.clearAllMocks();
        const savePrompt = await import('../../../../services/automation/common/savePrompt.js');
        savePrompt.createSaveListener.mockReturnValue({
            promise: Promise.resolve({ success: false }),
        });
    });

    // ── prone (Trip Attack) ─────────────────────────────────────────────

    it.each([
        { saveSuccess: false, expectCondition: true, expectDescription: 'STR save DC 15: Failure' },
        { saveSuccess: true, expectCondition: false, expectDescription: 'STR save DC 15: Success' },
    ])('handles prone effect — save $saveSuccess', async ({ saveSuccess, expectCondition, expectDescription }) => {
        const savePrompt = await import('../../../../services/automation/common/savePrompt.js');
        savePrompt.createSaveListener.mockReturnValue({
            promise: Promise.resolve({ success: saveSuccess }),
        });

        getRuntimeValue.mockImplementation((_playerName, key, _campaignName) => {
            if (key === 'superiorityDice') return 4;
            if (key === SELECTION_KEY) return ['Trip Attack'];
            if (key === 'activeConditions') return [];
            return undefined;
        });

        const result = await executeManeuver(
            { name: 'Test', automation: { type: 'combat_superiority' } },
            makePlayerStats(),
            'test-campaign',
            'Trip Attack'
        );

        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.description).toContain(expectDescription);
        expect(result.payload.description).toContain('Target: Goblin');
        expect(result.payload.description).toContain('Added 4 to the damage roll');
        expect(result.logEntries).toHaveLength(1);
        expect(result.logEntries[0].type).toBe('ability_use');
        expect(result.logEntries[0].characterName).toBe('TestFighter');
        expect(result.logEntries[0].abilityName).toBe('Trip Attack');
        expect(setRuntimeValue).toHaveBeenCalledWith('TestFighter', 'superiorityDice', 3, 'test-campaign');

        if (expectCondition) {
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'Goblin',
                'activeConditions',
                expect.arrayContaining(['prone']),
                'test-campaign'
            );
        } else {
            expect(setRuntimeValue).not.toHaveBeenCalledWith(
                'Goblin',
                'activeConditions',
                expect.arrayContaining(['prone']),
                'test-campaign'
            );
        }
    });

    // ── goad (Goading Attack) ───────────────────────────────────────────

    it.each([
        { saveSuccess: false, expectTargetEffect: true, expectDescription: 'WIS save DC 15: Failure' },
        { saveSuccess: true, expectTargetEffect: false, expectDescription: 'WIS save DC 15: Success' },
    ])('handles goad effect — save $saveSuccess', async ({ saveSuccess, expectTargetEffect, expectDescription }) => {
        const savePrompt = await import('../../../../services/automation/common/savePrompt.js');
        savePrompt.createSaveListener.mockReturnValue({
            promise: Promise.resolve({ success: saveSuccess }),
        });

        getRuntimeValue.mockImplementation((_playerName, key, _campaignName) => {
            if (key === 'superiorityDice') return 4;
            if (key === SELECTION_KEY) return ['Goading Attack'];
            if (key === 'targetEffects') return [];
            return undefined;
        });

        const result = await executeManeuver(
            { name: 'Test', automation: { type: 'combat_superiority' } },
            makePlayerStats(),
            'test-campaign',
            'Goading Attack'
        );

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain(expectDescription);
        expect(setRuntimeValue).toHaveBeenCalledWith('TestFighter', 'superiorityDice', 3, 'test-campaign');

        if (expectTargetEffect) {
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'campaign',
                'targetEffects',
                expect.arrayContaining([
                    expect.objectContaining({
                        target: 'Goblin',
                        source: 'TestFighter',
                        effect: 'taunting_step',
                        duration: 'until_end_of_user_next_turn',
                    }),
                ]),
                'test-campaign'
            );
        } else {
            expect(setRuntimeValue).not.toHaveBeenCalledWith(
                'campaign',
                'targetEffects',
                expect.anything(),
                'test-campaign'
            );
        }
    });

    // ── frightened (Menacing Attack) ────────────────────────────────────

    it.each([
        { saveSuccess: false, expectCondition: true, expectExpiration: true, expectDescription: 'WIS save DC 15: Failure' },
        { saveSuccess: true, expectCondition: false, expectExpiration: false, expectDescription: 'WIS save DC 15: Success' },
    ])('handles frightened effect — save $saveSuccess', async ({ saveSuccess, expectCondition, expectExpiration, expectDescription }) => {
        const savePrompt = await import('../../../../services/automation/common/savePrompt.js');
        savePrompt.createSaveListener.mockReturnValue({
            promise: Promise.resolve({ success: saveSuccess }),
        });

        getRuntimeValue.mockImplementation((_playerName, key, _campaignName) => {
            if (key === 'superiorityDice') return 4;
            if (key === SELECTION_KEY) return ['Menacing Attack'];
            if (key === 'activeConditions') return [];
            return undefined;
        });

        const result = await executeManeuver(
            { name: 'Test', automation: { type: 'combat_superiority' } },
            makePlayerStats(),
            'test-campaign',
            'Menacing Attack'
        );

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain(expectDescription);
        expect(setRuntimeValue).toHaveBeenCalledWith('TestFighter', 'superiorityDice', 3, 'test-campaign');

        if (expectCondition) {
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'Goblin',
                'activeConditions',
                expect.arrayContaining(['frightened']),
                'test-campaign'
            );
        } else {
            expect(setRuntimeValue).not.toHaveBeenCalledWith(
                'Goblin',
                'activeConditions',
                expect.arrayContaining(['frightened']),
                'test-campaign'
            );
        }

        if (expectExpiration) {
            expect(expirations.addExpiration).toHaveBeenCalledWith({ attackerName: 'TestFighter', targetName: 'Goblin', effects: expect.arrayContaining([{ type: 'condition', condition: 'frightened' }]), campaignName: 'test-campaign', rounds: 2 });
        } else {
            expect(expirations.addExpiration).not.toHaveBeenCalled();
        }
    });

    // ── distracting_strike_advantage (Distracting Strike) ──────────────

    it('sets targetEffects for distracting_strike_advantage', async () => {
        getRuntimeValue.mockImplementation((_playerName, key, _campaignName) => {
            if (key === 'superiorityDice') return 4;
            if (key === SELECTION_KEY) return ['Distracting Strike'];
            if (key === 'targetEffects') return [];
            return undefined;
        });

        const result = await executeManeuver(
            { name: 'Test', automation: { type: 'combat_superiority' } },
            makePlayerStats(),
            'test-campaign',
            'Distracting Strike'
        );

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('next attack against');
        expect(result.payload.description).toContain('Advantage');
        expect(setRuntimeValue).toHaveBeenCalledWith('TestFighter', 'superiorityDice', 3, 'test-campaign');
        expect(setRuntimeValue).toHaveBeenCalledWith(
            'campaign',
            'targetEffects',
            expect.arrayContaining([
                expect.objectContaining({
                    target: 'Goblin',
                    source: 'TestFighter',
                    effect: 'distracting_strike_advantage',
                    duration: 'until_end_of_turn',
                }),
            ]),
            'test-campaign'
        );
    });

    // ── push (Pushing Attack) ───────────────────────────────────────────

    it.each([
        { saveSuccess: false, expectPushed: true, expectDescription: 'STR save DC 15: Failure' },
        { saveSuccess: true, expectPushed: false, expectDescription: 'STR save DC 15: Success' },
    ])('handles push effect — save $saveSuccess', async ({ saveSuccess, expectPushed, expectDescription }) => {
        const savePrompt = await import('../../../../services/automation/common/savePrompt.js');
        savePrompt.createSaveListener.mockReturnValue({
            promise: Promise.resolve({ success: saveSuccess }),
        });

        getRuntimeValue.mockImplementation((_playerName, key, _campaignName) => {
            if (key === 'superiorityDice') return 4;
            if (key === SELECTION_KEY) return ['Pushing Attack'];
            return undefined;
        });

        const result = await executeManeuver(
            { name: 'Test', automation: { type: 'combat_superiority' } },
            makePlayerStats(),
            'test-campaign',
            'Pushing Attack'
        );

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain(expectDescription);
        expect(setRuntimeValue).toHaveBeenCalledWith('TestFighter', 'superiorityDice', 3, 'test-campaign');

        if (expectPushed) {
            expect(result.payload.description).toContain('was pushed 15 feet');
        } else {
            expect(result.payload.description).not.toContain('was pushed');
        }
    });

    // ── disarm (Disarming Attack) ───────────────────────────────────────

    it.each([
        { saveSuccess: false, expectDisarmed: true, expectDescription: 'STR save DC 15: Failure' },
        { saveSuccess: true, expectDisarmed: false, expectDescription: 'STR save DC 15: Success' },
    ])('handles disarm effect — save $saveSuccess', async ({ saveSuccess, expectDisarmed, expectDescription }) => {
        const savePrompt = await import('../../../../services/automation/common/savePrompt.js');
        savePrompt.createSaveListener.mockReturnValue({
            promise: Promise.resolve({ success: saveSuccess }),
        });

        getRuntimeValue.mockImplementation((_playerName, key, _campaignName) => {
            if (key === 'superiorityDice') return 4;
            if (key === SELECTION_KEY) return ['Disarming Attack'];
            return undefined;
        });

        const result = await executeManeuver(
            { name: 'Test', automation: { type: 'combat_superiority' } },
            makePlayerStats(),
            'test-campaign',
            'Disarming Attack'
        );

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain(expectDescription);
        expect(setRuntimeValue).toHaveBeenCalledWith('TestFighter', 'superiorityDice', 3, 'test-campaign');

        if (expectDisarmed) {
            expect(result.payload.description).toContain('dropped the object');
        } else {
            expect(result.payload.description).not.toContain('dropped the object');
        }
    });
});
