/** @cleaned-by-ai */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../common/targetResolver.js', () => ({
    resolveMapPositions: vi.fn(),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn().mockResolvedValue({}),
}));

vi.mock('../../../rules/combat/rangeValidation.js', () => ({
    getDistanceFeet: vi.fn(),
    rangeToFeet: vi.fn(),
}));

vi.mock('../../../rules/combat/rangeCheck.js', () => ({
    isWithinRange: vi.fn().mockResolvedValue(true),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(),
}));

vi.mock('../../../rules/combat/applyHealing.js', () => ({
    applyHealingToTarget: vi.fn(),
}));

vi.mock('../../common/damageRollback.js', () => ({
    findLastAttack: vi.fn().mockResolvedValue({
        attackEvent: null,
        attackerName: null,
        targetName: null,
        primaryDamage: 0,
        secondaryDamage: 0,
        totalDamage: 0,
        damageTypes: [],
    }),
}));

vi.mock('../../../dice/diceRoller.js', () => ({
    rollExpression: vi.fn(),
}));

// ── Imports ─────────────────────────────────────────────────────

import { handle } from './interceptionHandler.js';

import * as useRuntimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as logService from '../../../ui/logService.js';
import * as rangeValidation from '../../../rules/combat/rangeValidation.js';
import * as rangeCheck from '../../../rules/combat/rangeCheck.js';
import * as damageUtils from '../../../rules/combat/damageUtils.js';
import * as applyHealing from '../../../rules/combat/applyHealing.js';
import * as damageRollback from '../../common/damageRollback.js';
import * as diceRoller from '../../../dice/diceRoller.js';
import * as targetResolver from '../../common/targetResolver.js';

// ── Helpers ─────────────────────────────────────────────────────

const campaignName = 'test-campaign';
const mapName = 'test-map';
const playerName = 'Paladin';
const defenderName = 'Rogue';
const attackerName = 'Goblin';

function makePlayerStats(overrides = {}) {
    return {
        name: playerName,
        proficiency: 3,
        inventory: { equipped: [] },
        equipment: [],
        ...overrides,
    };
}

function makeAction(overrides = {}) {
    return {
        name: 'Interception',
        automation: {
            type: 'interception',
            trigger: 'ally_within_5ft_attacked',
            range: '5_ft',
            damageExpression: '1d10',
            damageType: '',
            damageBonusExpression: 'proficiency_bonus',
            requiresShield: true,
            casting_time: '1 reaction',
            hasAutomation: true,
            ...overrides.automation,
        },
        ...overrides,
    };
}

function makeCombatSummary() {
    return {
        players: [{ name: defenderName, hp: 50, maxHp: 50 }],
        lastAttack: {
            attackerName,
            targetName: defenderName,
            d20: 15,
            bonus: 5,
            hit: true,
            targetAc: 16,
            primaryDamage: 12,
            rawDamage: 12,
            actualDamage: 12,
            damageTypes: ['slashing'],
        },
    };
}

// ── Tests ───────────────────────────────────────────────────────

describe('interceptionHandler', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        useRuntimeState.getRuntimeValue.mockReturnValue(null);
        useRuntimeState.setRuntimeValue.mockResolvedValue(undefined);
        logService.addEntry.mockResolvedValue({});
        targetResolver.resolveMapPositions.mockResolvedValue({
            attackerPos: { x: 0, y: 0 },
            targetPos: { x: 1, y: 0 },
        });
        rangeValidation.getDistanceFeet.mockReturnValue(5);
        rangeValidation.rangeToFeet.mockReturnValue(5);
        rangeCheck.isWithinRange.mockResolvedValue(true);
        damageUtils.getCombatContext.mockResolvedValue(makeCombatSummary());
        damageRollback.findLastAttack.mockResolvedValue({
            attackEvent: makeCombatSummary().lastAttack,
            attackerName,
            targetName: defenderName,
            primaryDamage: 12,
            secondaryDamage: 0,
            totalDamage: 12,
            damageTypes: ['slashing'],
        });
        diceRoller.rollExpression.mockReturnValue({ total: 5, rolls: [5], modifier: 0 });
        applyHealing.applyHealingToTarget.mockReturnValue({ actualHeal: 5, oldHp: 50, newHp: 55 });
    });

    describe('no recent attack', () => {
        it('returns error popup when no attack found', async () => {
            const action = makeAction();
            const ps = makePlayerStats();
            damageRollback.findLastAttack.mockResolvedValue({
                attackEvent: null,
                attackerName: null,
                targetName: null,
                totalDamage: 0,
            });

            const result = await handle(action, ps, campaignName, mapName);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('No recent attack found');
            expect(result.payload.description).toContain('Can only be used after an attack roll');
        });

        it('uses action.name as feature name in error message', async () => {
            const action = makeAction({ name: 'CustomFeature' });
            const ps = makePlayerStats();
            damageRollback.findLastAttack.mockResolvedValue({
                attackEvent: null,
                attackerName: null,
                targetName: null,
                totalDamage: 0,
            });

            const result = await handle(action, ps, campaignName, mapName);

            expect(result.payload.description).toContain('CustomFeature: No recent attack found');
        });

        it('uses "Feature" as fallback when action has no name', async () => {
            const action = { automation: { type: 'interception' } };
            const ps = makePlayerStats();
            damageRollback.findLastAttack.mockResolvedValue({
                attackEvent: null,
                attackerName: null,
                targetName: null,
                totalDamage: 0,
            });

            const result = await handle(action, ps, campaignName, mapName);

            expect(result.payload.description).toContain('Feature: No recent attack found');
        });
    });

    describe('shield or weapon requirement', () => {
        it('returns error popup when no shield or weapon equipped', async () => {
            const action = makeAction();
            const ps = makePlayerStats();

            const result = await handle(action, ps, campaignName, mapName);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('You must be holding a Shield');
            expect(result.payload.description).toContain('Simple or Martial weapon');
        });

        it('proceeds when shield, weapon, or both are equipped', async () => {
            const testCases = [
                { inventory: { equipped: ['Shield'] }, equipment: [{ name: 'Shield', armor_category: 'Shield' }] },
                { inventory: { equipped: ['Longsword'] }, equipment: [{ name: 'Longsword', equipment_category: 'Weapon' }] },
                { inventory: { equipped: ['Shield', 'Shortsword'] }, equipment: [{ name: 'Shield', armor_category: 'Shield' }, { name: 'Shortsword', equipment_category: 'Weapon' }] },
                { inventory: { equipped: ['+1 Shield'] }, equipment: [{ name: 'Shield', armor_category: 'Shield' }] },
                { inventory: { equipped: ['+1 Mace'] }, equipment: [{ name: 'Mace', equipment_category: 'Weapon' }] },
                { inventory: { equipped: [null, 'Shield', undefined] }, equipment: [{ name: 'Shield', armor_category: 'Shield' }] },
            ];

            for (const tc of testCases) {
                const action = makeAction();
                const ps = makePlayerStats(tc);
                const result = await handle(action, ps, campaignName, mapName);
                expect(result.type).toBe('popup');
                expect(result.payload.description).not.toContain('You must be holding a Shield');
                expect(result.payload.description).toContain('interpose yourself');
            }
        });
    });

    describe('range check', () => {
        it('returns error popup when attacker is out of range', async () => {
            const action = makeAction();
            const ps = makePlayerStats({
                inventory: { equipped: ['Shield'] },
                equipment: [{ name: 'Shield', armor_category: 'Shield' }],
            });
            rangeValidation.getDistanceFeet.mockReturnValue(10);
            rangeCheck.isWithinRange.mockResolvedValue(false);

            const result = await handle(action, ps, campaignName, mapName);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('out of range');
        });

        it('uses custom range from automation config', async () => {
            const action = makeAction({
                automation: {
                    ...makeAction().automation,
                    range: '10_ft',
                },
            });
            const ps = makePlayerStats({
                inventory: { equipped: ['Shield'] },
                equipment: [{ name: 'Shield', armor_category: 'Shield' }],
            });
            rangeValidation.rangeToFeet.mockReturnValue(10);
            rangeValidation.getDistanceFeet.mockReturnValue(15);
            rangeCheck.isWithinRange.mockResolvedValue(false);

            const result = await handle(action, ps, campaignName, mapName);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('out of range');
        });

        it('rounds distance in range error message', async () => {
            const action = makeAction();
            const ps = makePlayerStats({
                inventory: { equipped: ['Shield'] },
                equipment: [{ name: 'Shield', armor_category: 'Shield' }],
            });
            rangeValidation.getDistanceFeet.mockReturnValue(7.8);
            rangeCheck.isWithinRange.mockResolvedValue(false);

            const result = await handle(action, ps, campaignName, mapName);

            expect(result.payload.description).toContain('out of range');
        });

        it('passes range check when attacker is within range', async () => {
            const action = makeAction();
            const ps = makePlayerStats({
                inventory: { equipped: ['Shield'] },
                equipment: [{ name: 'Shield', armor_category: 'Shield' }],
            });
            rangeValidation.getDistanceFeet.mockReturnValue(5);

            const result = await handle(action, ps, campaignName, mapName);

            expect(result.type).toBe('popup');
            expect(result.payload.description).not.toContain('out of range');
            expect(result.payload.description).toContain('interpose yourself');
        });

        it('skips range check when no map', async () => {
            const action = makeAction();
            const ps = makePlayerStats({
                inventory: { equipped: ['Shield'] },
                equipment: [{ name: 'Shield', armor_category: 'Shield' }],
            });

            const result = await handle(action, ps, campaignName, null);

            expect(result.payload.description).not.toContain('out of range');
            expect(rangeValidation.getDistanceFeet).not.toHaveBeenCalled();
        });

        it('skips range check when rangeToFeet returns null, positions unavailable, or only one position', async () => {
            const basePs = {
                inventory: { equipped: ['Shield'] },
                equipment: [{ name: 'Shield', armor_category: 'Shield' }],
            };

            // rangeToFeet returns null
            rangeValidation.rangeToFeet.mockReturnValue(null);
            let result = await handle(makeAction(), makePlayerStats(basePs), campaignName, mapName);
            expect(result.payload.description).not.toContain('out of range');
            expect(rangeValidation.getDistanceFeet).not.toHaveBeenCalled();
            rangeValidation.rangeToFeet.mockReturnValue(5);

            // Map positions unavailable
            targetResolver.resolveMapPositions.mockResolvedValue(null);
            result = await handle(makeAction(), makePlayerStats(basePs), campaignName, mapName);
            expect(result.payload.description).not.toContain('out of range');
            expect(rangeValidation.getDistanceFeet).not.toHaveBeenCalled();

            // Only attacker position
            targetResolver.resolveMapPositions.mockResolvedValue({ attackerPos: { x: 0, y: 0 }, targetPos: null });
            result = await handle(makeAction(), makePlayerStats(basePs), campaignName, mapName);
            expect(result.payload.description).not.toContain('out of range');
            expect(rangeValidation.getDistanceFeet).not.toHaveBeenCalled();

            // Only target position
            targetResolver.resolveMapPositions.mockResolvedValue({ attackerPos: null, targetPos: { x: 1, y: 0 } });
            result = await handle(makeAction(), makePlayerStats(basePs), campaignName, mapName);
            expect(result.payload.description).not.toContain('out of range');
            expect(rangeValidation.getDistanceFeet).not.toHaveBeenCalled();
        });
    });

    describe('targetEffects protection', () => {
        it('pushes new protection effect when none exists', async () => {
            const action = makeAction();
            const ps = makePlayerStats({
                inventory: { equipped: ['Shield'] },
                equipment: [{ name: 'Shield', armor_category: 'Shield' }],
            });

            await handle(action, ps, campaignName, mapName);

            expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
                playerName,
                'targetEffects',
                expect.arrayContaining([
                    expect.objectContaining({
                        effect: 'protection',
                        target: defenderName,
                        source: playerName,
                        duration: 'until_start_of_next_turn',
                        timestamp: expect.any(Number),
                    }),
                ]),
                campaignName
            );
        });

        it('updates existing protection effect for the same defender', async () => {
            const action = makeAction();
            const ps = makePlayerStats({
                inventory: { equipped: ['Shield'] },
                equipment: [{ name: 'Shield', armor_category: 'Shield' }],
            });
            const existingEffects = [
                {
                    effect: 'protection',
                    target: defenderName,
                    source: 'OldSource',
                    duration: 'until_start_of_next_turn',
                    timestamp: 100,
                },
                {
                    effect: 'something_else',
                    target: 'Other',
                    source: 'OtherSource',
                    duration: '1_round',
                    timestamp: 200,
                },
            ];
            useRuntimeState.getRuntimeValue.mockReturnValue(existingEffects);

            await handle(action, ps, campaignName, mapName);

            const callArgs = useRuntimeState.setRuntimeValue.mock.calls[0];
            const updatedEffects = callArgs[2];
            const protectionEffect = updatedEffects.find(
                te => te.effect === 'protection' && te.target === defenderName
            );
            expect(protectionEffect.source).toBe(playerName);
            expect(protectionEffect.timestamp).not.toBe(100);
            const otherEffect = updatedEffects.find(te => te.effect === 'something_else');
            expect(otherEffect).toBeDefined();
        });

        it('does not add protection effect for different defender', async () => {
            const action = makeAction();
            const ps = makePlayerStats({
                inventory: { equipped: ['Shield'] },
                equipment: [{ name: 'Shield', armor_category: 'Shield' }],
            });
            const existingEffects = [
                {
                    effect: 'protection',
                    target: 'OtherDefender',
                    source: 'OtherSource',
                    duration: 'until_start_of_next_turn',
                    timestamp: 100,
                },
            ];
            useRuntimeState.getRuntimeValue.mockReturnValue(existingEffects);

            await handle(action, ps, campaignName, mapName);

            const callArgs = useRuntimeState.setRuntimeValue.mock.calls[0];
            const updatedEffects = callArgs[2];
            expect(updatedEffects.length).toBe(2);
            const newProtection = updatedEffects.find(
                te => te.effect === 'protection' && te.target === defenderName
            );
            expect(newProtection.source).toBe(playerName);
        });
    });

    describe('damage reduction calculation', () => {
        it('reduces damage by 1d10 + proficiency when attack hits', async () => {
            const action = makeAction();
            const ps = makePlayerStats({
                inventory: { equipped: ['Shield'] },
                equipment: [{ name: 'Shield', armor_category: 'Shield' }],
            });
            diceRoller.rollExpression.mockReturnValue({ total: 7, rolls: [7], modifier: 0 });

            const result = await handle(action, ps, campaignName, mapName);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Original damage: 12');
            expect(result.payload.description).toContain('Interception damage reduction: 1d10(7) + 3');
            expect(result.payload.description).toContain('Reduced damage:');
        });

        it('uses proficiency bonus from playerStats when damageBonusExpression is proficiency_bonus', async () => {
            const action = makeAction();
            const ps = makePlayerStats({
                inventory: { equipped: ['Shield'] },
                equipment: [{ name: 'Shield', armor_category: 'Shield' }],
                proficiency: 6,
            });
            diceRoller.rollExpression.mockReturnValue({ total: 3, rolls: [3], modifier: 0 });

            const result = await handle(action, ps, campaignName, mapName);

            expect(result.payload.description).toContain('Interception damage reduction: 1d10(3) + 6');
        });

        it('uses numeric damageBonusExpression value', async () => {
            const action = makeAction({
                automation: {
                    ...makeAction().automation,
                    damageBonusExpression: '5',
                },
            });
            const ps = makePlayerStats({
                inventory: { equipped: ['Shield'] },
                equipment: [{ name: 'Shield', armor_category: 'Shield' }],
            });
            diceRoller.rollExpression.mockReturnValue({ total: 4, rolls: [4], modifier: 0 });

            const result = await handle(action, ps, campaignName, mapName);

            expect(result.payload.description).toContain('Interception damage reduction: 1d10(4) + 5');
        });

        it('ignores invalid damageBonusExpression', async () => {
            const action = makeAction({
                automation: {
                    ...makeAction().automation,
                    damageBonusExpression: 'not_a_number',
                },
            });
            const ps = makePlayerStats({
                inventory: { equipped: ['Shield'] },
                equipment: [{ name: 'Shield', armor_category: 'Shield' }],
            });
            diceRoller.rollExpression.mockReturnValue({ total: 6, rolls: [6], modifier: 0 });

            const result = await handle(action, ps, campaignName, mapName);

            expect(result.payload.description).toContain('Interception damage reduction: 1d10(6) + 0');
        });

        it('uses pre-computed damageBonus from automation when present', async () => {
            const action = makeAction({
                automation: {
                    ...makeAction().automation,
                    damageBonus: 10,
                    damageBonusExpression: 'proficiency_bonus',
                },
            });
            const ps = makePlayerStats({
                inventory: { equipped: ['Shield'] },
                equipment: [{ name: 'Shield', armor_category: 'Shield' }],
            });
            diceRoller.rollExpression.mockReturnValue({ total: 4, rolls: [4], modifier: 0 });

            const result = await handle(action, ps, campaignName, mapName);

            expect(result.payload.description).toContain('Interception damage reduction: 1d10(4) + 10');
        });

        it('defaults to 1d10 when no damageExpression', async () => {
            const action = makeAction({
                automation: {
                    ...makeAction().automation,
                    damageExpression: null,
                },
            });
            const ps = makePlayerStats({
                inventory: { equipped: ['Shield'] },
                equipment: [{ name: 'Shield', armor_category: 'Shield' }],
            });
            diceRoller.rollExpression.mockReturnValue({ total: 3, rolls: [3], modifier: 0 });

            const result = await handle(action, ps, campaignName, mapName);

            expect(result.payload.description).toContain('Interception damage reduction: 1d10(3)');
        });

        it('clamps reduced damage to minimum 0', async () => {
            const action = makeAction();
            const ps = makePlayerStats({
                inventory: { equipped: ['Shield'] },
                equipment: [{ name: 'Shield', armor_category: 'Shield' }],
            });
            diceRoller.rollExpression.mockReturnValue({ total: 12, rolls: [12], modifier: 0 });

            const result = await handle(action, ps, campaignName, mapName);

            expect(result.payload.description).toContain('Reduced damage: <b>0</b>');
        });

        it('handles zero original damage', async () => {
            const action = makeAction();
            const ps = makePlayerStats({
                inventory: { equipped: ['Shield'] },
                equipment: [{ name: 'Shield', armor_category: 'Shield' }],
            });
            damageRollback.findLastAttack.mockResolvedValue({
                attackEvent: { ...makeCombatSummary().lastAttack, primaryDamage: 0, rawDamage: 0, actualDamage: 0 },
                attackerName,
                targetName: defenderName,
                primaryDamage: 0,
                secondaryDamage: 0,
                totalDamage: 0,
                damageTypes: [],
            });
            diceRoller.rollExpression.mockReturnValue({ total: 5, rolls: [5], modifier: 0 });

            const result = await handle(action, ps, campaignName, mapName);

            expect(result.payload.description).toContain('Original damage: 0');
            expect(result.payload.description).toContain('Reduced damage: <b>0</b>');
            expect(applyHealing.applyHealingToTarget).not.toHaveBeenCalled();
        });

        it('handles null damage roll result', async () => {
            const action = makeAction();
            const ps = makePlayerStats({
                inventory: { equipped: ['Shield'] },
                equipment: [{ name: 'Shield', armor_category: 'Shield' }],
            });
            diceRoller.rollExpression.mockReturnValue(null);

            const result = await handle(action, ps, campaignName, mapName);

            expect(result.payload.description).toContain('1d10(0)');
            expect(result.payload.description).toContain('Reduced damage: <b>9</b>');
            expect(applyHealing.applyHealingToTarget).toHaveBeenCalledWith(
                expect.anything(),
                defenderName,
                3,
                campaignName
            );
        });
    });

    describe('healing application', () => {
        it('applies healing to target equal to reduction amount (capped at original damage)', async () => {
            const action = makeAction();
            const ps = makePlayerStats({
                inventory: { equipped: ['Shield'] },
                equipment: [{ name: 'Shield', armor_category: 'Shield' }],
            });
            diceRoller.rollExpression.mockReturnValue({ total: 8, rolls: [8], modifier: 0 });

            await handle(action, ps, campaignName, mapName);

            expect(applyHealing.applyHealingToTarget).toHaveBeenCalledWith(
                expect.anything(),
                defenderName,
                11,
                campaignName
            );
        });

        it('still applies healing from damageBonus even when dice roll is 0', async () => {
            const action = makeAction();
            const ps = makePlayerStats({
                inventory: { equipped: ['Shield'] },
                equipment: [{ name: 'Shield', armor_category: 'Shield' }],
            });
            diceRoller.rollExpression.mockReturnValue({ total: 0, rolls: [0], modifier: 0 });

            await handle(action, ps, campaignName, mapName);

            expect(applyHealing.applyHealingToTarget).toHaveBeenCalledWith(
                expect.anything(),
                defenderName,
                3,
                campaignName
            );
        });

        it('does not apply healing when defenderName is null', async () => {
            const action = makeAction();
            const ps = makePlayerStats({
                inventory: { equipped: ['Shield'] },
                equipment: [{ name: 'Shield', armor_category: 'Shield' }],
            });
            damageRollback.findLastAttack.mockResolvedValue({
                attackEvent: { ...makeCombatSummary().lastAttack, targetName: null },
                attackerName,
                targetName: null,
                primaryDamage: 12,
                secondaryDamage: 0,
                totalDamage: 12,
                damageTypes: ['slashing'],
            });
            diceRoller.rollExpression.mockReturnValue({ total: 5, rolls: [5], modifier: 0 });

            await handle(action, ps, campaignName, mapName);

            expect(applyHealing.applyHealingToTarget).not.toHaveBeenCalled();
        });

        it('does not apply healing when attack missed (totalDamage is 0)', async () => {
            const action = makeAction();
            const ps = makePlayerStats({
                inventory: { equipped: ['Shield'] },
                equipment: [{ name: 'Shield', armor_category: 'Shield' }],
            });
            damageRollback.findLastAttack.mockResolvedValue({
                attackEvent: { ...makeCombatSummary().lastAttack, hit: false },
                attackerName,
                targetName: defenderName,
                primaryDamage: 0,
                secondaryDamage: 0,
                totalDamage: 0,
                damageTypes: [],
            });
            diceRoller.rollExpression.mockReturnValue({ total: 5, rolls: [5], modifier: 0 });

            const result = await handle(action, ps, campaignName, mapName);

            expect(result.payload.description).toContain('Original damage: 0');
            expect(applyHealing.applyHealingToTarget).not.toHaveBeenCalled();
        });
    });

    describe('description generation', () => {
        it('includes base description with attacker and defender names', async () => {
            const action = makeAction();
            const ps = makePlayerStats({
                inventory: { equipped: ['Shield'] },
                equipment: [{ name: 'Shield', armor_category: 'Shield' }],
            });

            const result = await handle(action, ps, campaignName, mapName);

            expect(result.payload.description).toContain('interpose yourself between');
            expect(result.payload.description).toContain(attackerName);
            expect(result.payload.description).toContain(defenderName);
            expect(result.payload.description).toContain('Disadvantage');
            expect(result.payload.description).toContain('until the start of your next turn');
        });

        it('includes attack roll details when attack event exists', async () => {
            const action = makeAction();
            const ps = makePlayerStats({
                inventory: { equipped: ['Shield'] },
                equipment: [{ name: 'Shield', armor_category: 'Shield' }],
            });

            const result = await handle(action, ps, campaignName, mapName);

            expect(result.payload.description).toContain('Attack roll:');
            expect(result.payload.description).toContain('d20(15)');
            expect(result.payload.description).toContain('+ 5');
            expect(result.payload.description).toContain('vs AC 16');
            expect(result.payload.description).toContain('HIT');
        });

        it('includes damage reduction breakdown in description', async () => {
            const action = makeAction();
            const ps = makePlayerStats({
                inventory: { equipped: ['Shield'] },
                equipment: [{ name: 'Shield', armor_category: 'Shield' }],
            });

            const result = await handle(action, ps, campaignName, mapName);

            expect(result.payload.description).toContain('Interception damage reduction:');
            expect(result.payload.description).toContain('Reduced damage:');
        });

        it('includes heal note when actual heal > 0', async () => {
            const action = makeAction();
            const ps = makePlayerStats({
                inventory: { equipped: ['Shield'] },
                equipment: [{ name: 'Shield', armor_category: 'Shield' }],
            });

            const result = await handle(action, ps, campaignName, mapName);

            expect(result.payload.description).toContain('healed for');
            expect(result.payload.description).toContain('HP');
        });

        it('uses action.name in popup name and description heading', async () => {
            const action = makeAction({ name: 'MyInterception' });
            const ps = makePlayerStats({
                inventory: { equipped: ['Shield'] },
                equipment: [{ name: 'Shield', armor_category: 'Shield' }],
            });

            const result = await handle(action, ps, campaignName, mapName);

            expect(result.payload.name).toBe('MyInterception');
            expect(result.payload.description).toContain('<b>MyInterception</b>');
        });

        it('returns popup with basic description when combatSummary is null', async () => {
            const action = makeAction();
            const ps = makePlayerStats({
                inventory: { equipped: ['Shield'] },
                equipment: [{ name: 'Shield', armor_category: 'Shield' }],
            });
            damageUtils.getCombatContext.mockResolvedValue(null);

            const result = await handle(action, ps, campaignName, mapName);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('interpose yourself between');
            expect(result.payload.description).not.toContain('Attack roll:');
            expect(result.payload.description).not.toContain('Original damage:');
            expect(result.payload.description).not.toContain('Interception damage reduction:');
        });

        it('handles attack event with missing optional fields (targetAc, bonus, d20, hit)', async () => {
            const basePs = {
                inventory: { equipped: ['Shield'] },
                equipment: [{ name: 'Shield', armor_category: 'Shield' }],
            };

            // Missing targetAc
            damageRollback.findLastAttack.mockResolvedValue({
                attackEvent: { ...makeCombatSummary().lastAttack, targetAc: null },
                attackerName,
                targetName: defenderName,
                primaryDamage: 12,
                secondaryDamage: 0,
                totalDamage: 12,
                damageTypes: ['slashing'],
            });
            let result = await handle(makeAction(), makePlayerStats(basePs), campaignName, mapName);
            expect(result.payload.description).toContain('vs AC —');

            // Missing bonus
            damageRollback.findLastAttack.mockResolvedValue({
                attackEvent: { ...makeCombatSummary().lastAttack, bonus: null },
                attackerName,
                targetName: defenderName,
                primaryDamage: 12,
                secondaryDamage: 0,
                totalDamage: 12,
                damageTypes: ['slashing'],
            });
            result = await handle(makeAction(), makePlayerStats(basePs), campaignName, mapName);
            expect(result.payload.description).toContain('+ 0');

            // Missing d20
            damageRollback.findLastAttack.mockResolvedValue({
                attackEvent: {
                    attackerName,
                    targetName: defenderName,
                    bonus: 5,
                    hit: true,
                    targetAc: 16,
                    primaryDamage: 12,
                    rawDamage: 12,
                    actualDamage: 12,
                    damageTypes: ['slashing'],
                },
                attackerName,
                targetName: defenderName,
                primaryDamage: 12,
                secondaryDamage: 0,
                totalDamage: 12,
                damageTypes: ['slashing'],
            });
            result = await handle(makeAction(), makePlayerStats(basePs), campaignName, mapName);
            expect(result.payload.description).toContain('d20(undefined)');

            // hit undefined as MISS
            damageRollback.findLastAttack.mockResolvedValue({
                attackEvent: { ...makeCombatSummary().lastAttack, hit: undefined },
                attackerName,
                targetName: defenderName,
                primaryDamage: 12,
                secondaryDamage: 0,
                totalDamage: 12,
                damageTypes: ['slashing'],
            });
            result = await handle(makeAction(), makePlayerStats(basePs), campaignName, mapName);
            expect(result.payload.description).toContain('MISS');
        });
    });

    describe('logging', () => {
        it('logs the ability use to campaign log', async () => {
            const action = makeAction();
            const ps = makePlayerStats({
                inventory: { equipped: ['Shield'] },
                equipment: [{ name: 'Shield', armor_category: 'Shield' }],
            });

            await handle(action, ps, campaignName, mapName);

            expect(logService.addEntry).toHaveBeenCalledWith(
                campaignName,
                expect.objectContaining({
                    type: 'ability_use',
                    characterName: playerName,
                    abilityName: 'Interception',
                    targetName: defenderName,
                    timestamp: expect.any(Number),
                })
            );
        });

        it('includes feature name and attacker/target in log description', async () => {
            const action = makeAction();
            const ps = makePlayerStats({
                inventory: { equipped: ['Shield'] },
                equipment: [{ name: 'Shield', armor_category: 'Shield' }],
            });

            await handle(action, ps, campaignName, mapName);

            const logEntry = logService.addEntry.mock.calls[0][1];
            expect(logEntry.description).toContain(playerName);
            expect(logEntry.description).toContain('Interception');
            expect(logEntry.description).toContain('Disadvantage');
            expect(logEntry.description).toContain(attackerName);
            expect(logEntry.description).toContain(defenderName);
        });

        it('logs with custom ability name', async () => {
            const action = makeAction({ name: 'CustomIntercept' });
            const ps = makePlayerStats({
                inventory: { equipped: ['Shield'] },
                equipment: [{ name: 'Shield', armor_category: 'Shield' }],
            });

            await handle(action, ps, campaignName, mapName);

            const logEntry = logService.addEntry.mock.calls[0][1];
            expect(logEntry.abilityName).toBe('CustomIntercept');
            expect(logEntry.description).toContain('CustomIntercept');
        });

        it('handles logService.addEntry rejection gracefully', async () => {
            const action = makeAction();
            const ps = makePlayerStats({
                inventory: { equipped: ['Shield'] },
                equipment: [{ name: 'Shield', armor_category: 'Shield' }],
            });
            const logError = new Error('Log service unavailable');
            logService.addEntry.mockRejectedValue(logError);

            const result = await handle(action, ps, campaignName, mapName);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(logService.addEntry).toHaveBeenCalled();
        });
    });

    describe('return value structure', () => {
        it('returns popup with automation_info payload type and automation object', async () => {
            const action = makeAction();
            const ps = makePlayerStats({
                inventory: { equipped: ['Shield'] },
                equipment: [{ name: 'Shield', armor_category: 'Shield' }],
            });

            const result = await handle(action, ps, campaignName, mapName);

            expect(result).toEqual({
                type: 'popup',
                payload: expect.objectContaining({
                    type: 'automation_info',
                    name: 'Interception',
                    description: expect.any(String),
                    automation: expect.objectContaining({
                        type: 'interception',
                    }),
                }),
            });
            expect(result.payload.automation).toEqual(action.automation);
        });

        it('returns error popup with automation object for all error paths', async () => {
            const action = makeAction();
            const ps = makePlayerStats({
                inventory: { equipped: ['Shield'] },
                equipment: [{ name: 'Shield', armor_category: 'Shield' }],
            });

            // No attack
            damageRollback.findLastAttack.mockResolvedValue({
                attackEvent: null,
                attackerName: null,
                targetName: null,
                totalDamage: 0,
            });
            let result = await handle(action, ps, campaignName, mapName);
            expect(result.payload.automation).toEqual(action.automation);
            vi.clearAllMocks();
            useRuntimeState.getRuntimeValue.mockReturnValue(null);
            damageUtils.getCombatContext.mockResolvedValue(makeCombatSummary());
            targetResolver.resolveMapPositions.mockResolvedValue({ attackerPos: { x: 0, y: 0 }, targetPos: { x: 1, y: 0 } });
            rangeValidation.getDistanceFeet.mockReturnValue(5);
            rangeValidation.rangeToFeet.mockReturnValue(5);
            damageRollback.findLastAttack.mockResolvedValue({
                attackEvent: makeCombatSummary().lastAttack,
                attackerName,
                targetName: defenderName,
                primaryDamage: 12,
                secondaryDamage: 0,
                totalDamage: 12,
                damageTypes: ['slashing'],
            });

            // No shield/weapon
            result = await handle(makeAction(), makePlayerStats(), campaignName, mapName);
            expect(result.payload.automation).toEqual(makeAction().automation);
            vi.clearAllMocks();
            useRuntimeState.getRuntimeValue.mockReturnValue(null);
            damageUtils.getCombatContext.mockResolvedValue(makeCombatSummary());
            targetResolver.resolveMapPositions.mockResolvedValue({ attackerPos: { x: 0, y: 0 }, targetPos: { x: 1, y: 0 } });
            rangeValidation.getDistanceFeet.mockReturnValue(5);
            rangeValidation.rangeToFeet.mockReturnValue(5);
            damageRollback.findLastAttack.mockResolvedValue({
                attackEvent: makeCombatSummary().lastAttack,
                attackerName,
                targetName: defenderName,
                primaryDamage: 12,
                secondaryDamage: 0,
                totalDamage: 12,
                damageTypes: ['slashing'],
            });

            // Out of range
            result = await handle(action, ps, campaignName, mapName);
            expect(result.payload.automation).toEqual(action.automation);
        });
    });
});
