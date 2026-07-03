// @cleaned-by-ai
// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { handle } from './reactionBonusHandler.js';

// ── Mocks ──────────────────────────────────────────────────────

vi.mock('../../common/targetResolver.js', () => ({
    resolveTarget: vi.fn(),
    resolveMapPositions: vi.fn(),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../../rules/effects/expirations.js', () => ({
    addExpiration: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../rules/combat/rangeValidation.js', () => ({
    getDistanceFeet: vi.fn(),
    rangeToFeet: vi.fn((r) => {
        const m = String(r).match(/^(\d+)_?ft$/i);
        return m ? parseInt(m[1], 10) : null;
    }),
}));

vi.mock('../../../dice/diceRoller.js', () => ({
    rollExpression: vi.fn(),
}));

vi.mock('../../../../hooks/combat/useMetamagic.js', () => ({
    spendSorceryPoints: vi.fn(),
    getCurrentSorceryPoints: vi.fn(),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(),
}));

vi.mock('../../../../services/character/classFeatures.js', () => ({
    getClassFeatures: vi.fn(),
}));

// ── Re-import after mocking ────────────────────────────────────

import { resolveTarget, resolveMapPositions } from '../../common/targetResolver.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addExpiration } from '../../../rules/effects/expirations.js';
import { rollExpression } from '../../../dice/diceRoller.js';
import { getCurrentSorceryPoints } from '../../../../hooks/combat/useMetamagic.js';
import { spendSorceryPoints } from '../../../../hooks/combat/useMetamagic.js';
import { getDistanceFeet } from '../../../rules/combat/rangeValidation.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { getClassFeatures } from '../../../../services/character/classFeatures.js';

// ── Helpers ────────────────────────────────────────────────────

const CAMPAIGN = 'test-campaign';
const MAP = 'test-map';
const HERO_NAME = 'TestHero';

function makeAction(overrides = {}) {
    return {
        name: 'Test Reaction',
        description: 'A reaction bonus.',
        automation: {
            type: 'reaction_bonus',
            ...overrides.automation,
        },
        ...overrides,
    };
}

function makePlayerStats(overrides = {}) {
    return {
        name: HERO_NAME,
        proficiency: 3,
        abilities: [
            { name: 'Charisma', bonus: 2 },
        ],
        conditions: [],
        speed: 30,
        ...overrides,
    };
}

// ── Tests ──────────────────────────────────────────────────────

describe('reactionBonusHandler', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getRuntimeValue.mockReturnValue(null);
        resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });
        resolveMapPositions.mockResolvedValue({
            attackerPos: { gridX: 1, gridY: 1 },
            targetPos: { gridX: 2, gridY: 2 },
        });
        getDistanceFeet.mockReturnValue(10);
        rollExpression.mockReturnValue({ total: 3, rolls: [3] });
        getCurrentSorceryPoints.mockReturnValue(3);
        getCombatContext.mockReturnValue({ lastAttack: null });
        getClassFeatures.mockReturnValue(null);
    });

    // ── Routing ──────────────────────────────────────────────

    describe('handle routing', () => {
        it('should route miss_on_failed_save to handleUnbreakableMajesty', async () => {
            const action = makeAction({ automation: { effect: 'miss_on_failed_save', duration: '1_minute' } });
            const result = await handle(action, makePlayerStats(), CAMPAIGN, MAP);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('activated');
        });

        it('should route bonus_or_penalty_choice to handleBendFate', async () => {
            getCombatContext.mockReturnValue({
                lastAttack: { rollType: 'attack', attackerName: 'Goblin', d20: 15, bonus: 5, targetName: HERO_NAME },
            });
            const action = makeAction({ automation: { effect: 'bonus_or_penalty_choice' } });
            const result = await handle(action, makePlayerStats(), CAMPAIGN, MAP);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('1d4');
            expect(spendSorceryPoints).toHaveBeenCalledWith(HERO_NAME, 1, CAMPAIGN);
        });

        it('should route ac_bonus to handleAcBonus', async () => {
            const action = makeAction({ automation: { effect: 'ac_bonus' } });
            const result = await handle(action, makePlayerStats(), CAMPAIGN, MAP);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('activated');
        });

        it('should default to handleInspiringMovement for unknown effects', async () => {
            const action = makeAction({ automation: { effect: 'unknown_effect' } });
            const result = await handle(action, makePlayerStats(), CAMPAIGN, MAP);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('half your Speed');
        });
    });

    // ── handleUnbreakableMajesty ─────────────────────────────

    describe('handleUnbreakableMajesty', () => {
        it('should activate and set runtime state', async () => {
            const action = makeAction({ automation: { effect: 'miss_on_failed_save', duration: '1_minute' } });
            const result = await handle(action, makePlayerStats(), CAMPAIGN, MAP);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('activated');
            expect(result.payload.description).toContain('CHA save');
            expect(result.payload.description).toContain('DC 13');
            expect(setRuntimeValue).toHaveBeenCalledWith(HERO_NAME, 'unbreakableMajestyActive', true, CAMPAIGN);
            expect(setRuntimeValue).toHaveBeenCalledWith(HERO_NAME, 'unbreakableMajestySaveDc', 13, CAMPAIGN);
            expect(addExpiration).toHaveBeenCalledWith(HERO_NAME, HERO_NAME, [{ type: 'unbreakable_majesty' }], CAMPAIGN, 10);
        });

        it('should toggle off when already active', async () => {
            getRuntimeValue.mockImplementation((playerName, key) => {
                if (key === 'unbreakableMajestyActive') return true;
                return null;
            });
            const action = makeAction({ automation: { effect: 'miss_on_failed_save', duration: '1_minute' } });
            const result = await handle(action, makePlayerStats(), CAMPAIGN, MAP);

            expect(result.payload.description).toContain('ended');
            expect(setRuntimeValue).toHaveBeenCalledWith(HERO_NAME, 'unbreakableMajestyActive', null, CAMPAIGN);
        });

        it('should use custom duration in rounds', async () => {
            const action = makeAction({ automation: { effect: 'miss_on_failed_save', duration: '3_rounds' } });
            await handle(action, makePlayerStats(), CAMPAIGN, MAP);

            expect(addExpiration).toHaveBeenCalledWith(HERO_NAME, HERO_NAME, [{ type: 'unbreakable_majesty' }], CAMPAIGN, 3);
        });
    });

    // ── handleBendFate ───────────────────────────────────────

    describe('handleBendFate', () => {
        it('should reject when no sorcery points available', async () => {
            getCurrentSorceryPoints.mockReturnValue(0);
            const action = makeAction({ automation: { effect: 'bonus_or_penalty_choice' } });
            const result = await handle(action, makePlayerStats(), CAMPAIGN, MAP);

            expect(result.payload.description).toContain('No Sorcery Points available');
            expect(spendSorceryPoints).not.toHaveBeenCalled();
        });

        it('should reject when target is self', async () => {
            resolveTarget.mockResolvedValue({ target: { name: HERO_NAME } });
            const action = makeAction({ automation: { effect: 'bonus_or_penalty_choice' } });
            const result = await handle(action, makePlayerStats(), CAMPAIGN, MAP);

            expect(result.payload.description).toContain('not yourself');
        });

        it('should reject when no target resolved', async () => {
            resolveTarget.mockResolvedValue({ target: null });
            const action = makeAction({ automation: { effect: 'bonus_or_penalty_choice' } });
            const result = await handle(action, makePlayerStats(), CAMPAIGN, MAP);

            expect(result.payload.description).toContain('selecting a creature');
        });

        it('should reject when no recent d20 test for target', async () => {
            getCombatContext.mockReturnValue({ lastAttack: { rollType: 'spell_attack', attackerName: 'Goblin' } });
            const action = makeAction({ automation: { effect: 'bonus_or_penalty_choice' } });
            const result = await handle(action, makePlayerStats(), CAMPAIGN, MAP);

            expect(result.payload.description).toContain('No recent D20 test');
        });

        it('should succeed with attack, save, and check roll types', async () => {
            const cases = [
                { lastAttack: { rollType: 'attack', attackerName: 'Goblin', d20: 15, bonus: 5, targetName: HERO_NAME }, expected: 'Attack roll' },
                { lastAttack: { rollType: 'save', attackerName: 'Goblin', d20: 10, bonus: 3, saveType: 'dexterity' }, expected: 'DEX' },
                { lastAttack: { rollType: 'check', attackerName: 'Goblin', d20: 18, bonus: 4, checkName: 'Stealth' }, expected: 'Stealth' },
            ];

            for (const { lastAttack, expected } of cases) {
                vi.clearAllMocks();
                getCombatContext.mockReturnValue({ lastAttack });
                getCurrentSorceryPoints.mockReturnValue(3);
                getClassFeatures.mockReturnValue(null);

                const action = makeAction({ automation: { effect: 'bonus_or_penalty_choice' } });
                const result = await handle(action, makePlayerStats(), CAMPAIGN, MAP);

                expect(result.payload.description).toContain(expected);
                expect(result.payload.description).toContain('1d4');
                expect(spendSorceryPoints).toHaveBeenCalledWith(HERO_NAME, 1, CAMPAIGN);
            }
        });

        it('should fail gracefully when rollExpression returns null', async () => {
            rollExpression.mockReturnValue(null);
            getCombatContext.mockReturnValue({
                lastAttack: { rollType: 'attack', attackerName: 'Goblin', d20: 15, bonus: 5, targetName: HERO_NAME },
            });
            const action = makeAction({ automation: { effect: 'bonus_or_penalty_choice' } });
            const result = await handle(action, makePlayerStats(), CAMPAIGN, MAP);

            expect(result.payload.description).toContain('Roll failed');
            expect(spendSorceryPoints).not.toHaveBeenCalled();
        });

        it('should use max sorcery points from class features', async () => {
            getClassFeatures.mockReturnValue({ maxSorceryPoints: 5 });
            getCurrentSorceryPoints.mockReturnValue(5);
            getCombatContext.mockReturnValue({
                lastAttack: { rollType: 'attack', attackerName: 'Goblin', d20: 15, bonus: 5, targetName: HERO_NAME },
            });
            const action = makeAction({ automation: { effect: 'bonus_or_penalty_choice' } });
            const result = await handle(action, makePlayerStats(), CAMPAIGN, MAP);

            expect(result.type).toBe('popup');
            expect(spendSorceryPoints).toHaveBeenCalledWith(HERO_NAME, 1, CAMPAIGN);
        });
    });

    // ── handleAcBonus ────────────────────────────────────────

    describe('handleAcBonus', () => {
        it('should activate defensive duelist and set runtime state', async () => {
            const action = makeAction({ automation: { effect: 'ac_bonus' } });
            const result = await handle(action, makePlayerStats(), CAMPAIGN, MAP);

            expect(result.payload.description).toContain('activated');
            expect(result.payload.description).toContain('Proficiency Bonus');
            expect(result.payload.description).toContain('Add 3');
            expect(setRuntimeValue).toHaveBeenCalledWith(HERO_NAME, 'defensiveDuelistActive', true, CAMPAIGN);
            expect(setRuntimeValue).toHaveBeenCalledWith(HERO_NAME, 'defensiveDuelistBonus', 3, CAMPAIGN);
            expect(addExpiration).toHaveBeenCalledWith(HERO_NAME, HERO_NAME, [{ type: 'defensive_duelist' }], CAMPAIGN, 1);
        });

        it('should toggle off when already active', async () => {
            getRuntimeValue.mockImplementation((playerName, key) => {
                if (key === 'defensiveDuelistActive') return true;
                return null;
            });
            const action = makeAction({ automation: { effect: 'ac_bonus' } });
            const result = await handle(action, makePlayerStats(), CAMPAIGN, MAP);

            expect(result.payload.description).toContain('ended');
            expect(setRuntimeValue).toHaveBeenCalledWith(HERO_NAME, 'defensiveDuelistActive', null, CAMPAIGN);
        });

        it('should use custom duration in rounds', async () => {
            const action = makeAction({ automation: { effect: 'ac_bonus', duration: '2_rounds' } });
            await handle(action, makePlayerStats(), CAMPAIGN, MAP);

            expect(addExpiration).toHaveBeenCalledWith(HERO_NAME, HERO_NAME, [{ type: 'defensive_duelist' }], CAMPAIGN, 2);
        });
    });

    // ── handleLeapAside ──────────────────────────────────────

    describe('handleLeapAside', () => {
        it('should reject when no mount', async () => {
            getRuntimeValue.mockImplementation((playerName, key) => {
                if (key === 'mountName') return null;
                return null;
            });
            const action = makeAction({ automation: { effect: 'zero_on_success_half_on_fail_for_mount' } });
            const result = await handle(action, makePlayerStats(), CAMPAIGN, MAP);

            expect(result.payload.description).toContain('requires you to be mounted');
        });

        it('should reject when player or mount is incapacitated', async () => {
            // Player incapacitated (object format)
            getRuntimeValue.mockReturnValue('Warhorse');
            let stats = makePlayerStats({ conditions: [{ key: 'incapacitated' }] });
            let action = makeAction({ automation: { effect: 'zero_on_success_half_on_fail_for_mount' } });
            let result = await handle(action, stats, CAMPAIGN, MAP);
            expect(result.payload.description).toContain('not be Incapacitated');

            vi.clearAllMocks();
            getRuntimeValue.mockReturnValue('Warhorse');
            stats = makePlayerStats({ conditions: ['incapacitated'] });
            action = makeAction({ automation: { effect: 'zero_on_success_half_on_fail_for_mount' } });
            result = await handle(action, stats, CAMPAIGN, MAP);
            expect(result.payload.description).toContain('not be Incapacitated');

            vi.clearAllMocks();
            getRuntimeValue.mockImplementation((playerName, key) => {
                if (key === 'mountName') return 'Warhorse';
                if (key === 'conditions' && playerName === 'Warhorse') return [{ key: 'incapacitated' }];
                return null;
            });
            action = makeAction({ automation: { effect: 'zero_on_success_half_on_fail_for_mount' } });
            result = await handle(action, makePlayerStats(), CAMPAIGN, MAP);
            expect(result.payload.description).toContain('mount to not be Incapacitated');
        });

        it('should activate successfully', async () => {
            getRuntimeValue.mockImplementation((playerName, key) => {
                if (key === 'mountName') return 'Warhorse';
                if (key === 'conditions') return [];
                return null;
            });
            const action = makeAction({ automation: { effect: 'zero_on_success_half_on_fail_for_mount' } });
            const result = await handle(action, makePlayerStats(), CAMPAIGN, MAP);

            expect(result.payload.description).toContain('activated');
            expect(result.payload.description).toContain('Warhorse');
            expect(setRuntimeValue).toHaveBeenCalledWith(HERO_NAME, 'leapAsideActive', true, CAMPAIGN);
        });
    });

    // ── handleVeer ───────────────────────────────────────────

    describe('handleVeer', () => {
        it('should reject when no mount', async () => {
            getRuntimeValue.mockImplementation((playerName, key) => {
                if (key === 'mountName') return null;
                return null;
            });
            const action = makeAction({ automation: { effect: 'redirect_attack_to_self' } });
            const result = await handle(action, makePlayerStats(), CAMPAIGN, MAP);

            expect(result.payload.description).toContain('requires you to be mounted');
        });

        it('should reject when player is incapacitated', async () => {
            getRuntimeValue.mockReturnValue('Warhorse');
            let stats = makePlayerStats({ conditions: [{ key: 'incapacitated' }] });
            let action = makeAction({ automation: { effect: 'redirect_attack_to_self' } });
            let result = await handle(action, stats, CAMPAIGN, MAP);
            expect(result.payload.description).toContain('not be Incapacitated');

            vi.clearAllMocks();
            getRuntimeValue.mockReturnValue('Warhorse');
            stats = makePlayerStats({ conditions: ['incapacitated'] });
            action = makeAction({ automation: { effect: 'redirect_attack_to_self' } });
            result = await handle(action, stats, CAMPAIGN, MAP);
            expect(result.payload.description).toContain('not be Incapacitated');
        });

        it('should activate successfully', async () => {
            getRuntimeValue.mockReturnValue('Warhorse');
            const action = makeAction({ automation: { effect: 'redirect_attack_to_self' } });
            const result = await handle(action, makePlayerStats(), CAMPAIGN, MAP);

            expect(result.payload.description).toContain('activated');
            expect(result.payload.description).toContain('Warhorse');
            expect(setRuntimeValue).toHaveBeenCalledWith(HERO_NAME, 'veerActive', true, CAMPAIGN);
        });
    });

    // ── handleInspiringMovement ──────────────────────────────

    describe('handleInspiringMovement', () => {
        it('should return popup with movement description', async () => {
            const action = makeAction({ automation: { effect: 'inspiring_movement', allyRange: '30_ft' } });
            const result = await handle(action, makePlayerStats(), CAMPAIGN, MAP);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('move up to 15 ft');
        });

        it('should reject when no uses remaining', async () => {
            getRuntimeValue.mockImplementation((playerName, key) => {
                if (key === 'bardicInspirationUses') return 0;
                return null;
            });
            const action = makeAction({ automation: { effect: 'inspiring_movement', usesMax: 3 } });
            const result = await handle(action, makePlayerStats(), CAMPAIGN, MAP);

            expect(result.payload.description).toContain('no uses remaining');
        });

        it('should consume a use', async () => {
            getRuntimeValue.mockImplementation((playerName, key) => {
                if (key === 'bardicInspirationUses') return 1;
                return null;
            });
            const action = makeAction({ automation: { effect: 'inspiring_movement', usesMax: 3 } });
            await handle(action, makePlayerStats(), CAMPAIGN, MAP);

            expect(setRuntimeValue).toHaveBeenCalledWith(HERO_NAME, 'bardicInspirationUses', 0, CAMPAIGN);
        });

        it('should use custom resource key and consume a use', async () => {
            getRuntimeValue.mockImplementation((playerName, key) => {
                if (key === 'customUses') return 2;
                return null;
            });
            const action = makeAction({ automation: { effect: 'inspiring_movement', usesMax: 3, resourceKey: 'customUses' } });
            await handle(action, makePlayerStats(), CAMPAIGN, MAP);

            expect(setRuntimeValue).toHaveBeenCalledWith(HERO_NAME, 'customUses', 1, CAMPAIGN);
        });

        it('should skip uses check when usesMax is 0', async () => {
            getRuntimeValue.mockReturnValue(0);
            const action = makeAction({ automation: { effect: 'inspiring_movement', usesMax: 0 } });
            const result = await handle(action, makePlayerStats(), CAMPAIGN, MAP);

            expect(result.payload.description).toContain('half your Speed');
            expect(setRuntimeValue).not.toHaveBeenCalledWith(HERO_NAME, 'bardicInspirationUses', 0, CAMPAIGN);
        });

        it('should handle noOAs flag for self', async () => {
            getRuntimeValue.mockReturnValue(2);

            const action = makeAction({ automation: { effect: 'inspiring_movement', noOAs: true, usesMax: 3 } });
            const result = await handle(action, makePlayerStats(), CAMPAIGN, MAP);

            expect(result.payload.description).toContain('does not provoke Opportunity Attacks');
            expect(setRuntimeValue).toHaveBeenCalledWith(HERO_NAME, 'bardicInspirationUses', 1, CAMPAIGN);
            expect(setRuntimeValue).toHaveBeenCalledWith(HERO_NAME, 'inspiringMovementNoOA', true, CAMPAIGN);
            expect(addExpiration).toHaveBeenCalledWith(HERO_NAME, HERO_NAME, [{ type: 'inspiring_movement_no_oa' }], CAMPAIGN, 1);
        });

        it('should find ally within range on map', async () => {
            getRuntimeValue.mockReturnValue(2);
            resolveTarget.mockResolvedValue({ target: { name: 'Ally' } });
            getDistanceFeet.mockReturnValue(10);

            const action = makeAction({ automation: { effect: 'inspiring_movement', allyRange: '30_ft', usesMax: 3 } });
            const result = await handle(action, makePlayerStats(), CAMPAIGN, MAP);

            expect(result.payload.description).toContain('Ally');
            expect(result.payload.description).toContain('can also move');
            expect(setRuntimeValue).toHaveBeenCalledWith('Ally', 'inspiringMovementGranted', true, CAMPAIGN);
        });

        it('should not find ally when distance exceeds range', async () => {
            getRuntimeValue.mockReturnValue(2);
            resolveTarget.mockResolvedValue({ target: { name: 'Ally' } });
            getDistanceFeet.mockReturnValue(60);

            const action = makeAction({ automation: { effect: 'inspiring_movement', allyRange: '30_ft', usesMax: 3 } });
            const result = await handle(action, makePlayerStats(), CAMPAIGN, MAP);

            expect(result.payload.description).not.toContain('can also move');
            expect(result.payload.description).toContain('Select an ally');
        });

        it('should use half speed based on player speed', async () => {
            getRuntimeValue.mockReturnValue(1);
            const stats = makePlayerStats({ speed: 25 });
            const action = makeAction({ automation: { effect: 'inspiring_movement' } });
            const result = await handle(action, stats, CAMPAIGN, MAP);

            expect(result.payload.description).toContain('12 ft');
        });
    });
});
