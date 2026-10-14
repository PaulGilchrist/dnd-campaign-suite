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
import * as rangeValidation from '../../../rules/combat/rangeValidation.js';
import * as rangeCheck from '../../../rules/combat/rangeCheck.js';
import * as damageUtils from '../../../rules/combat/damageUtils.js';
import * as damageRollback from '../../common/damageRollback.js';
import * as diceRoller from '../../../dice/diceRoller.js';
import * as applyHealing from '../../../rules/combat/applyHealing.js';
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

describe('interceptionHandler damage & healing', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        useRuntimeState.getRuntimeValue.mockReturnValue(null);
        useRuntimeState.setRuntimeValue.mockResolvedValue(undefined);
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
});
