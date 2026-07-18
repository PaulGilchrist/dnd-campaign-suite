// @cleaned-by-ai
// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { handle, applyBendFateChoice } from './reactionBonusHandler.js';

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

vi.mock('../../common/damageRollback.js', () => ({}));

vi.mock('../../../ui/storage.js', () => ({
    __esModule: true,
    default: {
        set: vi.fn().mockResolvedValue(undefined),
        get: vi.fn().mockResolvedValue({ value: null }),
    },
}));

vi.mock('../../../rules/combat/applyDamage.js', () => ({
    applyDamageToTarget: vi.fn(),
}));

vi.mock('../../../rules/combat/applyHealing.js', () => ({
    applyHealingToTarget: vi.fn(),
}));

// ── Re-import after mocking ────────────────────────────────────

import storage from '../../../ui/storage.js';
import { applyDamageToTarget } from '../../../rules/combat/applyDamage.js';
import { applyHealingToTarget } from '../../../rules/combat/applyHealing.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { rollExpression } from '../../../dice/diceRoller.js';
import { getCurrentSorceryPoints } from '../../../../hooks/combat/useMetamagic.js';
import { spendSorceryPoints } from '../../../../hooks/combat/useMetamagic.js';
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
        rollExpression.mockReturnValue({ total: 3, rolls: [3] });
        getCurrentSorceryPoints.mockReturnValue(3);
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
            getCombatContext.mockReturnValue({ lastAttack: { rollType: 'attack', attackerName: 'Goblin', d20: 15, bonus: 5, targetName: 'Orc' } });
            const action = makeAction({ automation: { effect: 'bonus_or_penalty_choice' } });
            const result = await handle(action, makePlayerStats(), CAMPAIGN, MAP);

            expect(result.type).toBe('modal');
            expect(result.modalName).toBe('bendFateChoice');
            expect(result.payload.d4Roll).toEqual({ total: 3, rolls: [3] });
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
    // NOTE: Full coverage lives in reactionBonusHandler.unbreakableMajesty.test.js

    describe('handleUnbreakableMajesty', () => {
        it('should route to handleUnbreakableMajesty for miss_on_failed_save effect', async () => {
            const action = makeAction({ automation: { effect: 'miss_on_failed_save', duration: '1_minute' } });
            const result = await handle(action, makePlayerStats(), CAMPAIGN, MAP);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('activated');
            expect(result.payload.description).toContain('CHA save');
            expect(result.payload.description).toContain('DC 13');
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

        it('should reject when no recent d20 test found', async () => {
            getCombatContext.mockReturnValue({ lastAttack: null });
            const action = makeAction({ automation: { effect: 'bonus_or_penalty_choice' } });
            const result = await handle(action, makePlayerStats(), CAMPAIGN, MAP);

            expect(result.payload.description).toContain('No recent D20 test');
        });

        it('should reject when target is self', async () => {
            getCombatContext.mockReturnValue({ lastAttack: { rollType: 'attack', attackerName: 'Goblin', d20: 15, bonus: 5, targetName: HERO_NAME } });
            const action = makeAction({ automation: { effect: 'bonus_or_penalty_choice' } });
            const result = await handle(action, makePlayerStats(), CAMPAIGN, MAP);

            expect(result.payload.description).toContain('not yourself');
        });

        it('should succeed with attack roll type', async () => {
            getCombatContext.mockReturnValue({ lastAttack: { rollType: 'attack', attackerName: 'Goblin', d20: 15, bonus: 5, targetName: 'Orc', targetAc: 16 } });
            const action = makeAction({ automation: { effect: 'bonus_or_penalty_choice' } });
            const result = await handle(action, makePlayerStats(), CAMPAIGN, MAP);

            expect(result.type).toBe('modal');
            expect(result.modalName).toBe('bendFateChoice');
            expect(result.payload.isAttack).toBe(true);
            expect(result.payload.attackerName).toBe('Goblin');
            expect(result.payload.eventLabel).toContain('Goblin');
        });

        it('should succeed with save roll type', async () => {
            getCombatContext.mockReturnValue({ lastAttack: { rollType: 'save', attackerName: 'Goblin', d20: 10, bonus: 3, saveType: 'dexterity', saveDc: 13 } });
            const action = makeAction({ automation: { effect: 'bonus_or_penalty_choice' } });
            const result = await handle(action, makePlayerStats(), CAMPAIGN, MAP);

            expect(result.type).toBe('modal');
            expect(result.modalName).toBe('bendFateChoice');
            expect(result.payload.isSave).toBe(true);
        });

        it('should detect save from attack event with saveDc and saveResult', async () => {
            getCombatContext.mockReturnValue({ lastAttack: { rollType: 'attack', attackerName: 'Goblin', d20: 10, bonus: 3, saveType: 'dexterity', saveDc: 13, saveResult: 'failure' } });
            const action = makeAction({ automation: { effect: 'bonus_or_penalty_choice' } });
            const result = await handle(action, makePlayerStats(), CAMPAIGN, MAP);

            expect(result.type).toBe('modal');
            expect(result.modalName).toBe('bendFateChoice');
            expect(result.payload.isSave).toBe(true);
        });

        it('should succeed with check roll type', async () => {
            getCombatContext.mockReturnValue({ lastAttack: { rollType: 'check', attackerName: 'Goblin', d20: 18, bonus: 4, checkName: 'Stealth' } });
            const action = makeAction({ automation: { effect: 'bonus_or_penalty_choice' } });
            const result = await handle(action, makePlayerStats(), CAMPAIGN, MAP);

            expect(result.type).toBe('modal');
            expect(result.modalName).toBe('bendFateChoice');
            expect(result.payload.isCheck).toBe(true);
        });

        it('should fail gracefully when rollExpression returns null', async () => {
            rollExpression.mockReturnValue(null);
            getCombatContext.mockReturnValue({ lastAttack: { rollType: 'attack', attackerName: 'Goblin', d20: 15, bonus: 5, targetName: 'Orc' } });
            const action = makeAction({ automation: { effect: 'bonus_or_penalty_choice' } });
            const result = await handle(action, makePlayerStats(), CAMPAIGN, MAP);

            expect(result.payload.description).toContain('Roll failed');
            expect(spendSorceryPoints).not.toHaveBeenCalled();
        });

        it('should use max sorcery points from class features', async () => {
            getClassFeatures.mockReturnValue({ maxSorceryPoints: 5 });
            getCurrentSorceryPoints.mockReturnValue(5);
            getCombatContext.mockReturnValue({ lastAttack: { rollType: 'attack', attackerName: 'Goblin', d20: 15, bonus: 5, targetName: 'Orc' } });
            const action = makeAction({ automation: { effect: 'bonus_or_penalty_choice' } });
            const result = await handle(action, makePlayerStats(), CAMPAIGN, MAP);

            expect(result.type).toBe('modal');
        });
    });

    // ── applyBendFateChoice ──────────────────────────────────

    describe('applyBendFateChoice', () => {
        const baseLastAttack = {
            d20: 12,
            bonus: 5,
            targetName: 'Goblin',
            rollType: 'attack',
            attackerName: 'Goblin',
        };

        it('should update lastAttack with bendFateApplied flag for attack', async () => {
            const lastAttack = { ...baseLastAttack, targetAc: 16, hit: false };
            getCombatContext.mockReturnValue({ lastAttack: lastAttack });
            getCombatContext.mockReturnValue({ lastAttack: { ...lastAttack } });

            const result = await applyBendFateChoice(
                { name: 'Bend Fate', automation: { type: 'reaction_bonus' } },
                makePlayerStats(),
                CAMPAIGN,
                3,
                lastAttack,
                'bonus'
            );

            expect(storage.set).toHaveBeenCalledWith('combatSummary', expect.any(Object), CAMPAIGN);
            expect(result.payload.description).toContain('Target:');
            expect(spendSorceryPoints).toHaveBeenCalledWith(HERO_NAME, 1, CAMPAIGN);
        });

        it('should change miss to hit for attack', async () => {
            const lastAttack = {
                ...baseLastAttack,
                targetAc: 20,
                hit: false,
                damageFormula: '2d6+3',
                damageType: 'slashing',
            };
            getCombatContext.mockReturnValue({ lastAttack: lastAttack });
            getCombatContext.mockReturnValue({ lastAttack: { ...lastAttack } });
            rollExpression.mockReturnValueOnce({ total: 10 }).mockReturnValueOnce({ total: 10 });
            applyDamageToTarget.mockReturnValue({ finalDamage: 10 });

            const result = await applyBendFateChoice(
                { name: 'Bend Fate', automation: { type: 'reaction_bonus' } },
                makePlayerStats(),
                CAMPAIGN,
                3,
                lastAttack,
                'bonus'
            );

            expect(result.payload.description).toContain('The attack now hits');
            expect(result.payload.description).toContain('Rolled 10 damage');
        });

        it('should change hit to miss for attack and undo damage', async () => {
            const lastAttack = {
                ...baseLastAttack,
                targetAc: 16,
                hit: true,
                primaryDamage: 8,
                rawDamage: 8,
            };
            getCombatContext.mockReturnValue({ lastAttack: lastAttack });
            getCombatContext.mockReturnValue({ lastAttack: { ...lastAttack }, creatures: [{ name: 'Goblin' }] });
            applyHealingToTarget.mockReturnValue({ actualHeal: 8, oldHp: 15, newHp: 23 });

            const result = await applyBendFateChoice(
                { name: 'Bend Fate', automation: { type: 'reaction_bonus' } },
                makePlayerStats(),
                CAMPAIGN,
                3,
                lastAttack,
                'penalty'
            );

            expect(result.payload.description).toContain('The attack now misses');
            expect(result.payload.description).toContain('Undid 8 damage');
        });

        it('should change save failure to success and remove conditions', async () => {
            const lastAttack = {
                d20: 8,
                bonus: 3,
                targetName: 'Goblin',
                rollType: 'save',
                saveType: 'wisdom',
                saveDc: 13,
                saveConditions: ['charmed', 'incapacitated'],
            };
            getRuntimeValue.mockImplementation((targetName, key) => {
                if (key === 'activeConditions' && targetName === 'Goblin') return ['charmed', 'incapacitated'];
                return null;
            });
            getCombatContext.mockReturnValue({ lastAttack: lastAttack });
            getCombatContext.mockReturnValue({ lastAttack: { ...lastAttack } });

            const result = await applyBendFateChoice(
                { name: 'Bend Fate', automation: { type: 'reaction_bonus' } },
                makePlayerStats(),
                CAMPAIGN,
                3,
                lastAttack,
                'bonus'
            );

            expect(result.payload.description).toContain('The save now succeeds');
            expect(result.payload.description).toContain('Conditions removed');
            expect(setRuntimeValue).toHaveBeenCalledWith('Goblin', 'activeConditions', expect.any(Array), CAMPAIGN);
        });

        it('should change save success to failure and add conditions', async () => {
            const lastAttack = {
                d20: 10,
                bonus: 3,
                targetName: 'Goblin',
                rollType: 'save',
                saveType: 'wisdom',
                saveDc: 13,
                saveConditions: ['charmed'],
            };
            getRuntimeValue.mockImplementation((targetName, key) => {
                if (key === 'activeConditions' && targetName === 'Goblin') return ['frightened'];
                return null;
            });
            getCombatContext.mockReturnValue({ lastAttack: lastAttack });
            getCombatContext.mockReturnValue({ lastAttack: { ...lastAttack } });

            const result = await applyBendFateChoice(
                { name: 'Bend Fate', automation: { type: 'reaction_bonus' } },
                makePlayerStats(),
                CAMPAIGN,
                3,
                lastAttack,
                'penalty'
            );

            expect(result.payload.description).toContain('The save now fails');
            expect(result.payload.description).toContain('Conditions applied');
            expect(setRuntimeValue).toHaveBeenCalledWith('Goblin', 'activeConditions', expect.any(Array), CAMPAIGN);
        });

        it('should spend sorcery points on success', async () => {
            getCombatContext.mockReturnValue({ lastAttack: baseLastAttack });
            getCombatContext.mockReturnValue({ lastAttack: { ...baseLastAttack } });

            await applyBendFateChoice(
                { name: 'Bend Fate', automation: { type: 'reaction_bonus' } },
                makePlayerStats(),
                CAMPAIGN,
                3,
                baseLastAttack,
                'bonus'
            );

            expect(spendSorceryPoints).toHaveBeenCalledWith(HERO_NAME, 1, CAMPAIGN);
        });

        it('should log to campaign log', async () => {
            const { addEntry } = await import('../../../ui/logService.js');
            getCombatContext.mockReturnValue({ lastAttack: baseLastAttack });
            getCombatContext.mockReturnValue({ lastAttack: { ...baseLastAttack } });

            await applyBendFateChoice(
                { name: 'Bend Fate', automation: { type: 'reaction_bonus' } },
                makePlayerStats(),
                CAMPAIGN,
                3,
                baseLastAttack,
                'bonus'
            );

            expect(addEntry).toHaveBeenCalledWith(CAMPAIGN, expect.objectContaining({
                type: 'ability_use',
                characterName: HERO_NAME,
                abilityName: 'Bend Fate',
            }));
        });
    });

    // ── handleAcBonus ────────────────────────────────────────
    // NOTE: Toggle and duration coverage lives in reactionBonusHandler.unbreakableMajesty.test.js

    describe('handleAcBonus', () => {
        it('should route to handleAcBonus for ac_bonus effect', async () => {
            const action = makeAction({ automation: { effect: 'ac_bonus' } });
            const result = await handle(action, makePlayerStats(), CAMPAIGN, MAP);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('activated');
            expect(result.payload.description).toContain('Proficiency Bonus');
        });
    });

    // ── handleLeapAside / handleVeer ─────────────────────────
    // Both share identical mount + incapacitated validation logic

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

        it('should reject when player or mount is incapacitated (object and string formats)', async () => {
            getRuntimeValue.mockReturnValue('Warhorse');
            let stats = makePlayerStats({ conditions: [{ key: 'incapacitated' }] });
            let action = makeAction({ automation: { effect: 'zero_on_success_half_on_fail_for_mount' } });
            let result = await handle(action, stats, CAMPAIGN, MAP);
            expect(result.payload.description).toContain('not be Incapacitated');

            getRuntimeValue.mockReturnValue('Warhorse');
            stats = makePlayerStats({ conditions: ['incapacitated'] });
            action = makeAction({ automation: { effect: 'zero_on_success_half_on_fail_for_mount' } });
            result = await handle(action, stats, CAMPAIGN, MAP);
            expect(result.payload.description).toContain('not be Incapacitated');

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
    // NOTE: Full coverage (no map, no-OA, ally resolution, uses tracking, log entry)
    // lives in reactionBonusHandler.inspiringMovement.test.js

    describe('handleInspiringMovement', () => {
        it('should route to handleInspiringMovement for unknown effects', async () => {
            getCombatContext.mockReturnValue(makeCombatSummary([]));
            const action = makeAction({ automation: { effect: 'inspiring_movement', allyRange: '30_ft' } });
            const result = await handle(action, makePlayerStats(), CAMPAIGN, MAP);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('move up to 15 ft');
        });

        it('should use half speed based on player speed', async () => {
            getCombatContext.mockReturnValue(makeCombatSummary([]));
            getRuntimeValue.mockReturnValue(1);
            const stats = makePlayerStats({ speed: 25 });
            const action = makeAction({ automation: { effect: 'inspiring_movement' } });
            const result = await handle(action, stats, CAMPAIGN, MAP);

            expect(result.payload.description).toContain('12 ft');
        });

        it('should return a modal when creatures exist in combat', async () => {
            getCombatContext.mockReturnValue(makeCombatSummary([
                { name: 'Goblin', currentHp: 7, maxHp: 7, size: 'Small', type: 'humanoid' },
            ]));
            const action = makeAction({ automation: { effect: 'inspiring_movement' } });
            const result = await handle(action, makePlayerStats(), CAMPAIGN, MAP);

            expect(result.type).toBe('modal');
            expect(result.modalName).toBe('inspiringMovementAlly');
        });
    });
});

function makeCombatSummary(creatures) {
    return { creatures };
}
