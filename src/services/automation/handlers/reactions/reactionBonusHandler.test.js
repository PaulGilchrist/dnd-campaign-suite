// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { handle, applyBendFateChoice } from './reactionBonusHandler.js';

// ── Mocks ──────────────────────────────────────────────────────

vi.mock('../../common/targetResolver.js', () => ({
    resolveTarget: vi.fn(),
    resolveMapPositions: vi.fn(),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../rules/effects/expirations.js', () => ({
    addExpiration: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../rules/combat/rangeValidation.js', () => ({
    getDistanceFeet: vi.fn(),
    rangeToFeet: vi.fn(),
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
    getTargetFromAttacker: vi.fn(),
}));

vi.mock('../../../../services/character/classFeatures.js', () => ({
    getClassFeatures: vi.fn(),
}));

vi.mock('../../common/damageRollback.js', () => ({
    findAttackRollAgainstTarget: vi.fn(),
    rollbackDamage: vi.fn(),
}));

vi.mock('../../common/buffToggle.js', () => ({
    toggleBuff: vi.fn(),
}));

vi.mock('../../../rules/combat/applyDamage.js', () => ({
    applyDamageToTarget: vi.fn(),
}));

vi.mock('../../../rules/combat/applyHealing.js', () => ({
    applyHealingToTarget: vi.fn(),
}));

// ── Re-import after mocking ────────────────────────────────────

import { applyDamageToTarget } from '../../../rules/combat/applyDamage.js';
import { applyHealingToTarget } from '../../../rules/combat/applyHealing.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { rollExpression } from '../../../dice/diceRoller.js';
import { getCurrentSorceryPoints } from '../../../../hooks/combat/useMetamagic.js';
import { spendSorceryPoints } from '../../../../hooks/combat/useMetamagic.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { findAttackRollAgainstTarget, rollbackDamage } from '../../common/damageRollback.js';
import { toggleBuff } from '../../common/buffToggle.js';
import { addEntry } from '../../../ui/logService.js';
import { addExpiration } from '../../../rules/effects/expirations.js';
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
        inventory: {
            equipped: overrides.equipped || [],
        },
        equipment: overrides.equipment || [],
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
        setRuntimeValue.mockResolvedValue(undefined);
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
            getRuntimeValue.mockReturnValue(null);
            const action = makeAction({ automation: { effect: 'bonus_or_penalty_choice' } });
            const result = await handle(action, makePlayerStats(), CAMPAIGN, MAP);

            expect(result.payload.description).toContain('No recent D20 test');
        });

        it('should reject when target is self', async () => {
            getRuntimeValue.mockImplementation((_characterKey, propertyName) => {
                if (propertyName === 'lastAttack') {
                    return { rollType: 'attack', attackerName: 'Goblin', d20: 15, bonus: 5, targetName: HERO_NAME };
                }
                return undefined;
            });
            const action = makeAction({ automation: { effect: 'bonus_or_penalty_choice' } });
            const result = await handle(action, makePlayerStats(), CAMPAIGN, MAP);

            expect(result.payload.description).toContain('not yourself');
        });

        it('should fail gracefully when rollExpression returns null', async () => {
            rollExpression.mockReturnValue(null);
            getRuntimeValue.mockImplementation((_characterKey, propertyName) => {
                if (propertyName === 'lastAttack') {
                    return { rollType: 'attack', attackerName: 'Goblin', d20: 15, bonus: 5, targetName: 'Orc' };
                }
                return undefined;
            });
            const action = makeAction({ automation: { effect: 'bonus_or_penalty_choice' } });
            const result = await handle(action, makePlayerStats(), CAMPAIGN, MAP);

            expect(result.payload.description).toContain('Roll failed');
            expect(spendSorceryPoints).not.toHaveBeenCalled();
        });

        it('should use max sorcery points from class features', async () => {
            getClassFeatures.mockReturnValue({ maxSorceryPoints: 5 });
            getCurrentSorceryPoints.mockReturnValue(5);
            getRuntimeValue.mockImplementation((_characterKey, propertyName) => {
                if (propertyName === 'lastAttack') {
                    return { rollType: 'attack', attackerName: 'Goblin', d20: 15, bonus: 5, targetName: 'Orc' };
                }
                return undefined;
            });
            const action = makeAction({ automation: { effect: 'bonus_or_penalty_choice' } });
            const result = await handle(action, makePlayerStats(), CAMPAIGN, MAP);

            expect(result.type).toBe('modal');
        });

        it('should return modal with correct payload for each roll type', async () => {
            // attack roll type
            getRuntimeValue.mockImplementation((_characterKey, propertyName) => {
                if (propertyName === 'lastAttack') {
                    return { rollType: 'attack', attackerName: 'Goblin', d20: 15, bonus: 5, targetName: 'Orc', targetAc: 16 };
                }
                return undefined;
            });
            let result = await handle(makeAction({ automation: { effect: 'bonus_or_penalty_choice' } }), makePlayerStats(), CAMPAIGN, MAP);
            expect(result.type).toBe('modal');
            expect(result.modalName).toBe('bendFateChoice');
            expect(result.payload.isAttack).toBe(true);
            expect(result.payload.attackerName).toBe('Goblin');
            expect(result.payload.hitStatus).toBe('Hit');

            // save roll type
            getRuntimeValue.mockImplementation((_characterKey, propertyName) => {
                if (propertyName === 'lastAttack') {
                    return { rollType: 'save', attackerName: 'Goblin', d20: 10, bonus: 3, saveType: 'dexterity', saveDc: 13 };
                }
                return undefined;
            });
            result = await handle(makeAction({ automation: { effect: 'bonus_or_penalty_choice' } }), makePlayerStats(), CAMPAIGN, MAP);
            expect(result.payload.isSave).toBe(true);
            expect(result.payload.saveStatus).toBe('Success');

            // attack event with saveDc → treated as save
            getRuntimeValue.mockImplementation((_characterKey, propertyName) => {
                if (propertyName === 'lastAttack') {
                    return { rollType: 'attack', attackerName: 'Goblin', d20: 10, bonus: 3, saveType: 'dexterity', saveDc: 13, saveResult: 'failure' };
                }
                return undefined;
            });
            result = await handle(makeAction({ automation: { effect: 'bonus_or_penalty_choice' } }), makePlayerStats(), CAMPAIGN, MAP);
            expect(result.payload.isSave).toBe(true);

            // check roll type
            getRuntimeValue.mockImplementation((_characterKey, propertyName) => {
                if (propertyName === 'lastAttack') {
                    return { rollType: 'check', attackerName: 'Goblin', d20: 18, bonus: 4, checkName: 'Stealth' };
                }
                return undefined;
            });
            result = await handle(makeAction({ automation: { effect: 'bonus_or_penalty_choice' } }), makePlayerStats(), CAMPAIGN, MAP);
            expect(result.payload.isCheck).toBe(true);
            expect(result.payload.eventLabel).toContain('Stealth');

            // skill roll type (same path as check)
            getRuntimeValue.mockImplementation((_characterKey, propertyName) => {
                if (propertyName === 'lastAttack') {
                    return { rollType: 'skill', attackerName: 'Goblin', d20: 18, bonus: 4, checkName: 'Stealth' };
                }
                return undefined;
            });
            result = await handle(makeAction({ automation: { effect: 'bonus_or_penalty_choice' } }), makePlayerStats(), CAMPAIGN, MAP);
            expect(result.payload.isCheck).toBe(true);
        });

        it('should handle missing d20 or attackerName in lastAttack', async () => {
            // missing d20 — should still produce modal with fallback total
            getRuntimeValue.mockImplementation((_characterKey, propertyName) => {
                if (propertyName === 'lastAttack') {
                    return { rollType: 'attack', attackerName: 'Goblin', bonus: 5, targetName: 'Orc' };
                }
                return undefined;
            });
            let result = await handle(makeAction({ automation: { effect: 'bonus_or_penalty_choice' } }), makePlayerStats(), CAMPAIGN, MAP);
            expect(result.type).toBe('modal');

            // missing attackerName
            getRuntimeValue.mockImplementation((_characterKey, propertyName) => {
                if (propertyName === 'lastAttack') {
                    return { rollType: 'attack', d20: 15, bonus: 5, targetName: 'Orc' };
                }
                return undefined;
            });
            result = await handle(makeAction({ automation: { effect: 'bonus_or_penalty_choice' } }), makePlayerStats(), CAMPAIGN, MAP);
            expect(result.payload.attackerName).toBeUndefined();
        });

        it('should show correct hit/miss status based on attack total vs AC', async () => {
            // miss status
            getRuntimeValue.mockImplementation((_characterKey, propertyName) => {
                if (propertyName === 'lastAttack') {
                    return { rollType: 'attack', attackerName: 'Goblin', d20: 5, bonus: 2, targetName: 'Orc', targetAc: 16 };
                }
                return undefined;
            });
            let result = await handle(makeAction({ automation: { effect: 'bonus_or_penalty_choice' } }), makePlayerStats(), CAMPAIGN, MAP);
            expect(result.payload.hitStatus).toBe('Miss');

            // hit status
            getRuntimeValue.mockImplementation((_characterKey, propertyName) => {
                if (propertyName === 'lastAttack') {
                    return { rollType: 'attack', attackerName: 'Goblin', d20: 15, bonus: 5, targetName: 'Orc', targetAc: 16 };
                }
                return undefined;
            });
            result = await handle(makeAction({ automation: { effect: 'bonus_or_penalty_choice' } }), makePlayerStats(), CAMPAIGN, MAP);
            expect(result.payload.hitStatus).toBe('Hit');

            // save success
            getRuntimeValue.mockImplementation((_characterKey, propertyName) => {
                if (propertyName === 'lastAttack') {
                    return { rollType: 'save', attackerName: 'Goblin', d20: 10, bonus: 5, saveType: 'wisdom', saveDc: 13 };
                }
                return undefined;
            });
            result = await handle(makeAction({ automation: { effect: 'bonus_or_penalty_choice' } }), makePlayerStats(), CAMPAIGN, MAP);
            expect(result.payload.saveStatus).toBe('Success');
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
            getCombatContext.mockReturnValue({ lastAttack });

            const result = await applyBendFateChoice({
                    action: { name: 'Bend Luck', automation: { type: 'reaction_bonus' } },
                    playerStats: makePlayerStats(),
                    campaignName: CAMPAIGN,
                    d4Roll: 3,
                    lastAttack,
                    mode: 'bonus',
                });

            expect(setRuntimeValue).toHaveBeenCalledWith('campaign', 'lastAttack', expect.objectContaining({ bendFateApplied: true }), CAMPAIGN);
            expect(result.payload.description).toContain('Target:');
            expect(spendSorceryPoints).toHaveBeenCalledWith(HERO_NAME, 1, CAMPAIGN, 0);
        });

        it('should change miss to hit for attack and deal damage', async () => {
            const lastAttack = {
                ...baseLastAttack,
                targetAc: 20,
                hit: false,
                damageFormula: '2d6+3',
                damageType: 'slashing',
            };
            getCombatContext.mockReturnValue({ lastAttack });
            rollExpression.mockReturnValueOnce({ total: 10 }).mockReturnValueOnce({ total: 10 });
            applyDamageToTarget.mockReturnValue({ finalDamage: 10 });

            const result = await applyBendFateChoice({
                    action: { name: 'Bend Luck', automation: { type: 'reaction_bonus' } },
                    playerStats: makePlayerStats(),
                    campaignName: CAMPAIGN,
                    d4Roll: 3,
                    lastAttack,
                    mode: 'bonus',
                });

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
            getCombatContext.mockReturnValue({ lastAttack, creatures: [{ name: 'Goblin' }] });
            applyHealingToTarget.mockReturnValue({ actualHeal: 8, oldHp: 15, newHp: 23 });

            const result = await applyBendFateChoice({
                    action: { name: 'Bend Luck', automation: { type: 'reaction_bonus' } },
                    playerStats: makePlayerStats(),
                    campaignName: CAMPAIGN,
                    d4Roll: 3,
                    lastAttack,
                    mode: 'penalty',
                });

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
            getCombatContext.mockReturnValue({ lastAttack });
            getRuntimeValue.mockImplementation((targetName, key) => {
                if (key === 'activeConditions' && targetName === 'Goblin') return ['charmed', 'incapacitated'];
                return null;
            });

            const result = await applyBendFateChoice({
                    action: { name: 'Bend Luck', automation: { type: 'reaction_bonus' } },
                    playerStats: makePlayerStats(),
                    campaignName: CAMPAIGN,
                    d4Roll: 3,
                    lastAttack,
                    mode: 'bonus',
                });

            expect(result.payload.description).toContain('The save now succeeds');
            expect(result.payload.description).toContain('Conditions removed');
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
            getCombatContext.mockReturnValue({ lastAttack });
            getRuntimeValue.mockImplementation((targetName, key) => {
                if (key === 'activeConditions' && targetName === 'Goblin') return ['frightened'];
                return null;
            });

            const result = await applyBendFateChoice({
                    action: { name: 'Bend Luck', automation: { type: 'reaction_bonus' } },
                    playerStats: makePlayerStats(),
                    campaignName: CAMPAIGN,
                    d4Roll: 3,
                    lastAttack,
                    mode: 'penalty',
                });

            expect(result.payload.description).toContain('The save now fails');
            expect(result.payload.description).toContain('Conditions applied');
        });

        it('should spend sorcery points on success', async () => {
            getCombatContext.mockReturnValue({ lastAttack: { ...baseLastAttack } });

            await applyBendFateChoice({
                    action: { name: 'Bend Luck', automation: { type: 'reaction_bonus' } },
                    playerStats: makePlayerStats(),
                    campaignName: CAMPAIGN,
                    d4Roll: 3,
                    lastAttack: baseLastAttack,
                    mode: 'bonus',
                });

            expect(spendSorceryPoints).toHaveBeenCalledWith(HERO_NAME, 1, CAMPAIGN, 0);
        });

        it('should log to campaign log', async () => {
            const { addEntry } = await import('../../../ui/logService.js');
            getCombatContext.mockReturnValue({ lastAttack: { ...baseLastAttack } });

            await applyBendFateChoice({
                    action: { name: 'Bend Luck', automation: { type: 'reaction_bonus' } },
                    playerStats: makePlayerStats(),
                    campaignName: CAMPAIGN,
                    d4Roll: 3,
                    lastAttack: baseLastAttack,
                    mode: 'bonus',
                });

            expect(addEntry).toHaveBeenCalledWith(CAMPAIGN, expect.objectContaining({
                type: 'ability_use',
                characterName: HERO_NAME,
                abilityName: 'Bend Luck',
            }));
        });

        it('should handle attack with no damageFormula when hit changes', async () => {
            const lastAttack = {
                ...baseLastAttack,
                targetAc: 20,
                hit: false,
            };
            getCombatContext.mockReturnValue({ lastAttack });

            const result = await applyBendFateChoice({
                    action: { name: 'Bend Luck', automation: { type: 'reaction_bonus' } },
                    playerStats: makePlayerStats(),
                    campaignName: CAMPAIGN,
                    d4Roll: 3,
                    lastAttack,
                    mode: 'bonus',
                });

            expect(result.payload.description).toContain('The attack now hits');
            expect(applyDamageToTarget).not.toHaveBeenCalled();
        });

        it('should handle damageFormula roll returning null or applyDamageToTarget returning null', async () => {
            const lastAttack = {
                ...baseLastAttack,
                targetAc: 20,
                hit: false,
                damageFormula: '2d6+3',
                damageType: 'slashing',
            };
            getCombatContext.mockReturnValue({ lastAttack });
            rollExpression.mockReturnValueOnce({ total: 3 }).mockReturnValueOnce(null);

            let result = await applyBendFateChoice({
                    action: { name: 'Bend Luck', automation: { type: 'reaction_bonus' } },
                    playerStats: makePlayerStats(),
                    campaignName: CAMPAIGN,
                    d4Roll: 3,
                    lastAttack,
                    mode: 'bonus',
                });
            expect(result.payload.description).toContain('The attack now hits');

            rollExpression.mockReturnValueOnce({ total: 3 }).mockReturnValueOnce({ total: 5 });
            applyDamageToTarget.mockReturnValue(null);

            result = await applyBendFateChoice({
                    action: { name: 'Bend Luck', automation: { type: 'reaction_bonus' } },
                    playerStats: makePlayerStats(),
                    campaignName: CAMPAIGN,
                    d4Roll: 3,
                    lastAttack,
                    mode: 'bonus',
                });
            expect(result.payload.description).toContain('The attack now hits');
        });

        it('should handle no outcome change (hit-to-hit, miss-to-miss, save still succeeds/fails)', async () => {
            // hit-to-hit
            let lastAttack = {
                ...baseLastAttack,
                targetAc: 14,
                hit: true,
            };
            getCombatContext.mockReturnValue({ lastAttack });
            let result = await applyBendFateChoice({
                    action: { name: 'Bend Luck', automation: { type: 'reaction_bonus' } },
                    playerStats: makePlayerStats(),
                    campaignName: CAMPAIGN,
                    d4Roll: 3,
                    lastAttack,
                    mode: 'bonus',
                });
            expect(result.payload.description).toContain('still hits');

            // miss-to-miss
            lastAttack = {
                ...baseLastAttack,
                targetAc: 25,
                hit: false,
            };
            getCombatContext.mockReturnValue({ lastAttack });
            result = await applyBendFateChoice({
                    action: { name: 'Bend Luck', automation: { type: 'reaction_bonus' } },
                    playerStats: makePlayerStats(),
                    campaignName: CAMPAIGN,
                    d4Roll: 3,
                    lastAttack,
                    mode: 'penalty',
                });
            expect(result.payload.description).toContain('still misses');

            // save still succeeds
            lastAttack = {
                d20: 10,
                bonus: 5,
                targetName: 'Goblin',
                rollType: 'save',
                saveType: 'wisdom',
                saveDc: 12,
                saveConditions: ['charmed'],
            };
            getCombatContext.mockReturnValue({ lastAttack });
            result = await applyBendFateChoice({
                    action: { name: 'Bend Luck', automation: { type: 'reaction_bonus' } },
                    playerStats: makePlayerStats(),
                    campaignName: CAMPAIGN,
                    d4Roll: 3,
                    lastAttack,
                    mode: 'penalty',
                });
            expect(result.payload.description).toContain('still succeeds');

            // save still fails
            lastAttack = {
                d20: 5,
                bonus: 2,
                targetName: 'Goblin',
                rollType: 'save',
                saveType: 'wisdom',
                saveDc: 13,
                saveConditions: ['charmed'],
            };
            getCombatContext.mockReturnValue({ lastAttack });
            result = await applyBendFateChoice({
                    action: { name: 'Bend Luck', automation: { type: 'reaction_bonus' } },
                    playerStats: makePlayerStats(),
                    campaignName: CAMPAIGN,
                    d4Roll: 3,
                    lastAttack,
                    mode: 'bonus',
                });
            expect(result.payload.description).toContain('still fails');
        });

        it('should handle check roll type', async () => {
            const lastAttack = {
                d20: 15,
                bonus: 4,
                targetName: 'Goblin',
                rollType: 'check',
                attackerName: 'Goblin',
                checkName: 'Stealth',
            };
            getCombatContext.mockReturnValue({ lastAttack });

            const result = await applyBendFateChoice({
                    action: { name: 'Bend Luck', automation: { type: 'reaction_bonus' } },
                    playerStats: makePlayerStats(),
                    campaignName: CAMPAIGN,
                    d4Roll: 3,
                    lastAttack,
                    mode: 'bonus',
                });

            expect(result.payload.description).toContain('New total: 22');
        });

        it('should return popup when getCombatContext returns null', async () => {
            getCombatContext.mockReturnValue(null);

            let result = await applyBendFateChoice({
                    action: { name: 'Bend Luck', automation: { type: 'reaction_bonus' } },
                    playerStats: makePlayerStats(),
                    campaignName: CAMPAIGN,
                    d4Roll: 3,
                    lastAttack: { ...baseLastAttack },
                    mode: 'bonus',
                });
            expect(result.type).toBe('popup');

            // save type with null context
            result = await applyBendFateChoice({
                    action: { name: 'Bend Luck', automation: { type: 'reaction_bonus' } },
                    playerStats: makePlayerStats(),
                    campaignName: CAMPAIGN,
                    d4Roll: 3,
                    lastAttack: {
                    d20: 8,
                    bonus: 3,
                    targetName: 'Goblin',
                    rollType: 'save',
                    saveType: 'wisdom',
                    saveDc: 13,
                    saveConditions: ['charmed'],
                },
                    mode: 'bonus',
                });
            expect(result.type).toBe('popup');
        });

        it('should support d4Roll as object or number', async () => {
            getCombatContext.mockReturnValue({ lastAttack: { ...baseLastAttack } });
            const d4Roll = { total: 4, rolls: [4] };

            await applyBendFateChoice({
                    action: { name: 'Bend Luck', automation: { type: 'reaction_bonus' } },
                    playerStats: makePlayerStats(),
                    campaignName: CAMPAIGN,
                    d4Roll,
                    lastAttack: baseLastAttack,
                    mode: 'bonus',
                });
            expect(spendSorceryPoints).toHaveBeenCalledWith(HERO_NAME, 1, CAMPAIGN, 0);

            vi.clearAllMocks();
            getCombatContext.mockReturnValue({ lastAttack: { ...baseLastAttack } });
            getCurrentSorceryPoints.mockReturnValue(3);

            await applyBendFateChoice({
                    action: { name: 'Bend Luck', automation: { type: 'reaction_bonus' } },
                    playerStats: makePlayerStats(),
                    campaignName: CAMPAIGN,
                    d4Roll: 2,
                    lastAttack: baseLastAttack,
                    mode: 'bonus',
                });
            expect(spendSorceryPoints).toHaveBeenCalledWith(HERO_NAME, 1, CAMPAIGN, 0);
        });

        it('should include conditions added/removed in popup description', async () => {
            // conditions added (save failure)
            let lastAttack = {
                d20: 10,
                bonus: 3,
                targetName: 'Goblin',
                rollType: 'save',
                saveType: 'wisdom',
                saveDc: 13,
                saveConditions: ['charmed', 'frightened'],
            };
            getCombatContext.mockReturnValue({ lastAttack });
            getRuntimeValue.mockImplementation((targetName, key) => {
                if (key === 'activeConditions' && targetName === 'Goblin') return ['frightened'];
                return null;
            });
            let result = await applyBendFateChoice({
                    action: { name: 'Bend Luck', automation: { type: 'reaction_bonus' } },
                    playerStats: makePlayerStats(),
                    campaignName: CAMPAIGN,
                    d4Roll: 3,
                    lastAttack,
                    mode: 'penalty',
                });
            expect(result.payload.description).toContain('Conditions applied');
            expect(result.payload.description).toContain('charmed');

            // conditions removed (save success)
            vi.clearAllMocks();
            getCombatContext.mockReturnValue({ lastAttack });
            getCurrentSorceryPoints.mockReturnValue(3);
            lastAttack = {
                d20: 8,
                bonus: 3,
                targetName: 'Goblin',
                rollType: 'save',
                saveType: 'wisdom',
                saveDc: 13,
                saveConditions: ['charmed'],
            };
            getRuntimeValue.mockImplementation((targetName, key) => {
                if (key === 'activeConditions' && targetName === 'Goblin') return ['charmed'];
                return null;
            });
            result = await applyBendFateChoice({
                    action: { name: 'Bend Luck', automation: { type: 'reaction_bonus' } },
                    playerStats: makePlayerStats(),
                    campaignName: CAMPAIGN,
                    d4Roll: 3,
                    lastAttack,
                    mode: 'bonus',
                });
            expect(result.payload.description).toContain('Conditions removed');
            expect(result.payload.description).toContain('charmed');
        });

        it('should handle missing saveConditions gracefully', async () => {
            const lastAttack = {
                d20: 8,
                bonus: 3,
                targetName: 'Goblin',
                rollType: 'save',
                saveType: 'wisdom',
                saveDc: 13,
            };
            getCombatContext.mockReturnValue({ lastAttack });

            const result = await applyBendFateChoice({
                    action: { name: 'Bend Luck', automation: { type: 'reaction_bonus' } },
                    playerStats: makePlayerStats(),
                    campaignName: CAMPAIGN,
                    d4Roll: 3,
                    lastAttack,
                    mode: 'bonus',
                });

            expect(result.payload.description).toContain('The save now succeeds');
        });

        it('should handle missing targetAc/effectiveAc with existing hit flag', async () => {
            const lastAttack = {
                ...baseLastAttack,
                hit: true,
            };
            getCombatContext.mockReturnValue({ lastAttack });

            const result = await applyBendFateChoice({
                    action: { name: 'Bend Luck', automation: { type: 'reaction_bonus' } },
                    playerStats: makePlayerStats(),
                    campaignName: CAMPAIGN,
                    d4Roll: 3,
                    lastAttack,
                    mode: 'bonus',
                });

            expect(result.payload.description).toContain('Original was a hit');
        });
    });

    // ── handleAcBonus (Defensive Duelist / Parry) ──────────────

    describe('handleAcBonus', () => {
        const finesseWeapon = { name: 'Shortsword', equipment_category: 'Weapon', properties: ['Finesse', 'Light'] };
        const nonFinesseWeapon = { name: 'Longsword', equipment_category: 'Weapon', properties: [] };
        const mockAttackEvent = { d20: 14, bonus: 5, targetAc: 15, rawDamage: 8, attackerName: 'Goblin' };

        beforeEach(() => {
            toggleBuff.mockReturnValue({ wasActive: false });
            findAttackRollAgainstTarget.mockResolvedValue({ attackEvent: null, attackerName: null });
            rollbackDamage.mockResolvedValue(0);
            addEntry.mockResolvedValue(undefined);
            getCombatContext.mockReturnValue(null);
            applyHealingToTarget.mockReturnValue(null);
        });

        it('should reject when not wielding a Finesse weapon', async () => {
            // no equipped items
            let result = await handle(
                makeAction({ automation: { effect: 'ac_bonus' } }),
                makePlayerStats(),
                CAMPAIGN, MAP
            );
            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('must be wielding a Finesse weapon');
            expect(toggleBuff).not.toHaveBeenCalled();

            // equipped but no Finesse
            result = await handle(
                makeAction({ automation: { effect: 'ac_bonus' } }),
                makePlayerStats({ equipped: ['Longsword'], equipment: [nonFinesseWeapon] }),
                CAMPAIGN, MAP
            );
            expect(result.payload.description).toContain('must be wielding a Finesse weapon');

            // magic-prefixed item name stripped correctly
            result = await handle(
                makeAction({ automation: { effect: 'ac_bonus' } }),
                makePlayerStats({ equipped: ['+3 Shortsword'], equipment: [finesseWeapon] }),
                CAMPAIGN, MAP
            );
            expect(result.payload.description).toContain('No recent attack');
        });

        it('should reject when no recent attack targeting player', async () => {
            const result = await handle(
                makeAction({ automation: { effect: 'ac_bonus' } }),
                makePlayerStats({ equipped: ['Shortsword'], equipment: [finesseWeapon] }),
                CAMPAIGN, MAP
            );

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('No recent attack targeting');
            expect(toggleBuff).not.toHaveBeenCalled();
        });

        it('should activate when Finesse weapon and attack targeting player', async () => {
            findAttackRollAgainstTarget.mockResolvedValue({ attackEvent: mockAttackEvent, attackerName: 'Goblin' });
            const action = makeAction({ automation: { effect: 'ac_bonus' } });
            const result = await handle(action, makePlayerStats({ equipped: ['Shortsword'], equipment: [finesseWeapon] }), CAMPAIGN, MAP);

            expect(toggleBuff).toHaveBeenCalledWith(HERO_NAME, 'Test Reaction', expect.objectContaining({ effect: 'defensive_duelist' }), CAMPAIGN);
            expect(addExpiration).toHaveBeenCalledWith({ attackerName: HERO_NAME, targetName: HERO_NAME, effects: expect.arrayContaining([
                expect.objectContaining({ type: 'remove_active_buff', buffName: 'Test Reaction' })
            ]), campaignName: CAMPAIGN, rounds: undefined, expireOnCreatureName: HERO_NAME });
            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('activated');
        });

        it('should show "already active" when buff is already toggled on', async () => {
            toggleBuff.mockReturnValue({ wasActive: true });
            findAttackRollAgainstTarget.mockResolvedValue({ attackEvent: mockAttackEvent, attackerName: 'Goblin' });
            const action = makeAction({ automation: { effect: 'ac_bonus' } });
            const result = await handle(action, makePlayerStats({ equipped: ['Shortsword'], equipment: [finesseWeapon] }), CAMPAIGN, MAP);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('already active');
            expect(addExpiration).not.toHaveBeenCalled();
            expect(rollbackDamage).not.toHaveBeenCalled();
        });

        it('should show "still hits" when roll >= new AC', async () => {
            findAttackRollAgainstTarget.mockResolvedValue({ attackEvent: mockAttackEvent, attackerName: 'Goblin' });
            const action = makeAction({ automation: { effect: 'ac_bonus' } });
            const result = await handle(action, makePlayerStats({ proficiency: 3, equipped: ['Shortsword'], equipment: [finesseWeapon] }), CAMPAIGN, MAP);

            expect(result.payload.description).toContain('still hits');
            expect(result.payload.description).toContain('Roll 19');
            expect(rollbackDamage).not.toHaveBeenCalled();
            expect(addEntry).toHaveBeenCalledWith(CAMPAIGN, expect.objectContaining({
                type: 'ability_use',
                characterName: HERO_NAME,
                abilityName: 'Test Reaction',
            }));
        });

        it('should show "misses" and rollback when roll < new AC and damage > 0', async () => {
            const attackWithDamage = { ...mockAttackEvent, rawDamage: 8, targetAc: 17 };
            findAttackRollAgainstTarget.mockResolvedValue({ attackEvent: attackWithDamage, attackerName: 'Goblin' });
            getCombatContext.mockReturnValue({ creatures: [] });
            applyHealingToTarget.mockReturnValue({ actualHeal: 5, oldHp: 10, newHp: 15 });
            const action = makeAction({ automation: { effect: 'ac_bonus' } });
            const result = await handle(action, makePlayerStats({ proficiency: 3, equipped: ['Shortsword'], equipment: [finesseWeapon] }), CAMPAIGN, MAP);

            expect(result.payload.description).toContain('misses');
            expect(result.payload.description).toContain('Roll 19 < AC 20');
            expect(result.payload.description).toContain('5 HP healed');
        });

        it('should show "misses" without healing when no damage or applyHealingToTarget returns null', async () => {
            // no damage dealt
            const attackNoDamage = { ...mockAttackEvent, rawDamage: 0, targetAc: 17 };
            findAttackRollAgainstTarget.mockResolvedValue({ attackEvent: attackNoDamage, attackerName: 'Goblin' });
            let result = await handle(makeAction({ automation: { effect: 'ac_bonus' } }), makePlayerStats({ proficiency: 3, equipped: ['Shortsword'], equipment: [finesseWeapon] }), CAMPAIGN, MAP);
            expect(result.payload.description).toContain('misses');
            expect(result.payload.description).not.toContain('healed');

            // applyHealingToTarget returns null
            const attackWithDamage = { ...mockAttackEvent, rawDamage: 8, targetAc: 17 };
            findAttackRollAgainstTarget.mockResolvedValue({ attackEvent: attackWithDamage, attackerName: 'Goblin' });
            applyHealingToTarget.mockReturnValue(null);
            result = await handle(makeAction({ automation: { effect: 'ac_bonus' } }), makePlayerStats({ proficiency: 3, equipped: ['Shortsword'], equipment: [finesseWeapon] }), CAMPAIGN, MAP);
            expect(result.payload.description).toContain('misses');
            expect(result.payload.description).not.toContain('healed');
        });

        it('should handle null targetAc, null combatContext, missing proficiency, and non-string equipped entries', async () => {
            // null targetAc — still activates
            const attackNoAc = { ...mockAttackEvent, targetAc: null };
            findAttackRollAgainstTarget.mockResolvedValue({ attackEvent: attackNoAc, attackerName: 'Goblin' });
            let result = await handle(makeAction({ automation: { effect: 'ac_bonus' } }), makePlayerStats({ proficiency: 3, equipped: ['Shortsword'], equipment: [finesseWeapon] }), CAMPAIGN, MAP);
            expect(result.payload.description).toContain('activated');

            // null combatContext during healing — misses without healing
            const attackWithDamage = { ...mockAttackEvent, rawDamage: 8, targetAc: 17 };
            findAttackRollAgainstTarget.mockResolvedValue({ attackEvent: attackWithDamage, attackerName: 'Goblin' });
            getCombatContext.mockReturnValue(null);
            result = await handle(makeAction({ automation: { effect: 'ac_bonus' } }), makePlayerStats({ proficiency: 3, equipped: ['Shortsword'], equipment: [finesseWeapon] }), CAMPAIGN, MAP);
            expect(result.payload.description).toContain('misses');
            expect(result.payload.description).not.toContain('healed');

            // missing proficiency — still activates
            findAttackRollAgainstTarget.mockResolvedValue({ attackEvent: mockAttackEvent, attackerName: 'Goblin' });
            getCombatContext.mockReturnValue(null);
            result = await handle(makeAction({ automation: { effect: 'ac_bonus' } }), makePlayerStats({ equipped: ['Shortsword'], equipment: [finesseWeapon] }), CAMPAIGN, MAP);
            expect(result.payload.description).toContain('activated');

            // non-string equipped entries
            findAttackRollAgainstTarget.mockResolvedValue({ attackEvent: null, attackerName: null });
            getCombatContext.mockReturnValue(null);
            result = await handle(
                makeAction({ automation: { effect: 'ac_bonus' } }),
                makePlayerStats({ equipped: [null, undefined, 'Shortsword'], equipment: [finesseWeapon] }),
                CAMPAIGN, MAP
            );
            expect(result.payload.description).toContain('No recent attack');
        });

        it('should handle missing equipment array or inventory.equipped', async () => {
            let result = await handle(
                makeAction({ automation: { effect: 'ac_bonus' } }),
                makePlayerStats({ equipped: ['Shortsword'], equipment: undefined }),
                CAMPAIGN, MAP
            );
            expect(result.payload.description).toContain('must be wielding a Finesse weapon');

            result = await handle(
                makeAction({ automation: { effect: 'ac_bonus' } }),
                makePlayerStats({ inventory: {} }),
                CAMPAIGN, MAP
            );
            expect(result.payload.description).toContain('must be wielding a Finesse weapon');
        });

        it('should log same description as popup', async () => {
            findAttackRollAgainstTarget.mockResolvedValue({ attackEvent: mockAttackEvent, attackerName: 'Goblin' });
            getCombatContext.mockReturnValue(null);
            const action = makeAction({ automation: { effect: 'ac_bonus' } });
            const result = await handle(action, makePlayerStats({ proficiency: 3, equipped: ['Shortsword'], equipment: [finesseWeapon] }), CAMPAIGN, MAP);

            expect(addEntry).toHaveBeenCalledWith(CAMPAIGN, expect.objectContaining({
                description: result.payload.description,
            }));
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

        it('should reject when player has multiple conditions including incapacitated', async () => {
            getRuntimeValue.mockReturnValue('Warhorse');
            const stats = makePlayerStats({ conditions: ['frightened', 'incapacitated', 'poisoned'] });
            const action = makeAction({ automation: { effect: 'zero_on_success_half_on_fail_for_mount' } });
            const result = await handle(action, stats, CAMPAIGN, MAP);

            expect(result.payload.description).toContain('not be Incapacitated');
        });

        it('should allow activation when mount conditions is null', async () => {
            getRuntimeValue.mockImplementation((playerName, key) => {
                if (key === 'mountName') return 'Warhorse';
                if (key === 'conditions') return null;
                return null;
            });
            const action = makeAction({ automation: { effect: 'zero_on_success_half_on_fail_for_mount' } });
            const result = await handle(action, makePlayerStats(), CAMPAIGN, MAP);

            expect(result.payload.description).toContain('activated');
        });

        it('should use custom feature name and log with fallback name', async () => {
            getRuntimeValue.mockImplementation((playerName, key) => {
                if (key === 'mountName') return 'Warhorse';
                if (key === 'conditions') return [];
                return null;
            });
            const action = makeAction({ automation: { effect: 'zero_on_success_half_on_fail_for_mount' } });
            action.name = 'Custom Leap Aside';
            const result = await handle(action, makePlayerStats(), CAMPAIGN, MAP);

            expect(result.payload.name).toBe('Custom Leap Aside');
            expect(result.payload.description).toContain('Custom Leap Aside');

            // fallback name logging
            vi.clearAllMocks();
            getRuntimeValue.mockImplementation((playerName, key) => {
                if (key === 'mountName') return 'Warhorse';
                if (key === 'conditions') return [];
                return null;
            });
            const action2 = makeAction({ automation: { effect: 'zero_on_success_half_on_fail_for_mount' } });
            delete action2.name;
            await handle(action2, makePlayerStats(), CAMPAIGN, MAP);

            expect(addEntry).toHaveBeenCalledWith(CAMPAIGN, expect.objectContaining({
                type: 'ability_use',
                characterName: HERO_NAME,
                abilityName: 'Leap Aside',
            }));
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

        it('should reject when player is incapacitated (object and string formats)', async () => {
            getRuntimeValue.mockReturnValue('Warhorse');
            let stats = makePlayerStats({ conditions: [{ key: 'incapacitated' }] });
            let action = makeAction({ automation: { effect: 'redirect_attack_to_self' } });
            let result = await handle(action, stats, CAMPAIGN, MAP);
            expect(result.payload.description).toContain('not be Incapacitated');

            getRuntimeValue.mockReturnValue('Warhorse');
            stats = makePlayerStats({ conditions: ['incapacitated'] });
            action = makeAction({ automation: { effect: 'redirect_attack_to_self' } });
            result = await handle(action, stats, CAMPAIGN, MAP);
            expect(result.payload.description).toContain('not be Incapacitated');
        });

        it('should use custom feature name and log with fallback name', async () => {
            getRuntimeValue.mockReturnValue('Warhorse');
            const action = makeAction({ automation: { effect: 'redirect_attack_to_self' } });
            action.name = 'Custom Veer';
            const result = await handle(action, makePlayerStats(), CAMPAIGN, MAP);

            expect(result.payload.name).toBe('Custom Veer');
            expect(result.payload.description).toContain('Custom Veer');

            // fallback name logging
            vi.clearAllMocks();
            getRuntimeValue.mockReturnValue('Warhorse');
            const action2 = makeAction({ automation: { effect: 'redirect_attack_to_self' } });
            delete action2.name;
            await handle(action2, makePlayerStats(), CAMPAIGN, MAP);

            expect(addEntry).toHaveBeenCalledWith(CAMPAIGN, expect.objectContaining({
                type: 'ability_use',
                characterName: HERO_NAME,
                abilityName: 'Veer',
            }));
        });

        it('should handle mount name from getRuntimeValue', async () => {
            getRuntimeValue.mockReturnValue('Shadowmere');
            const action = makeAction({ automation: { effect: 'redirect_attack_to_self' } });
            const result = await handle(action, makePlayerStats(), CAMPAIGN, MAP);

            expect(result.payload.description).toContain('Shadowmere');
        });
    });
});
