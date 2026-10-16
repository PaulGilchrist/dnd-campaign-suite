// @maintained-by-ai
// interceptionHandler sextet — lane: DAMAGE MATH (computeInterceptionReduction +
// resolveInterceptionDamageBonus: roll + bonus, clamp to 0, null roll, zero damage;
// applyHealingToTarget amounts and skip paths). Owns the repo-wide
// 'Interception damage reduction' numeric pins and applyHealing amount pins
// (shed by the consumption lane). Does NOT pin addExpiration (consumption owns
// the rounds:1 latch) nor upsertProtectionEffect store writes (targetEffects
// companion owns push/update/append).
//
// Deterministic: runtime/logService/dice/healing/range/expirations mocked, pure
// handler, exact numeric pins — no churn expected.
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

// addExpiration pins live in the consumption lane; keep the barrel graph inert here.
vi.mock('../../../rules/effects/expirations.js', () => ({
    addExpiration: vi.fn(),
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
    const { automation, ...rest } = overrides;
    return {
        name: 'Interception',
        ...rest,
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
            ...automation,
        },
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
            expect(result.payload.description).toContain('Interception damage reduction: 1d10(7) + 3 = <b>10</b>');
            expect(result.payload.description).toContain('Reduced damage: <b>2</b>');
            expect(applyHealing.applyHealingToTarget).toHaveBeenCalledWith(
                expect.anything(),
                defenderName,
                10,
                campaignName
            );
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

            expect(result.payload.description).toContain('Interception damage reduction: 1d10(3) + 6 = <b>9</b>');
        });

        it('uses numeric damageBonusExpression value', async () => {
            const action = makeAction({ automation: { damageBonusExpression: '5' } });
            const ps = makePlayerStats({
                inventory: { equipped: ['Shield'] },
                equipment: [{ name: 'Shield', armor_category: 'Shield' }],
            });
            diceRoller.rollExpression.mockReturnValue({ total: 4, rolls: [4], modifier: 0 });

            const result = await handle(action, ps, campaignName, mapName);

            expect(result.payload.description).toContain('Interception damage reduction: 1d10(4) + 5 = <b>9</b>');
        });

        it('ignores invalid damageBonusExpression', async () => {
            const action = makeAction({ automation: { damageBonusExpression: 'not_a_number' } });
            const ps = makePlayerStats({
                inventory: { equipped: ['Shield'] },
                equipment: [{ name: 'Shield', armor_category: 'Shield' }],
            });
            diceRoller.rollExpression.mockReturnValue({ total: 6, rolls: [6], modifier: 0 });

            const result = await handle(action, ps, campaignName, mapName);

            expect(result.payload.description).toContain('Interception damage reduction: 1d10(6) + 0 = <b>6</b>');
        });

        it('uses pre-computed damageBonus from automation when present', async () => {
            const action = makeAction({
                automation: { damageBonus: 10, damageBonusExpression: 'proficiency_bonus' },
            });
            const ps = makePlayerStats({
                inventory: { equipped: ['Shield'] },
                equipment: [{ name: 'Shield', armor_category: 'Shield' }],
            });
            diceRoller.rollExpression.mockReturnValue({ total: 4, rolls: [4], modifier: 0 });

            const result = await handle(action, ps, campaignName, mapName);

            expect(result.payload.description).toContain('Interception damage reduction: 1d10(4) + 10 = <b>14</b>');
        });

        it('defaults to 1d10 when no damageExpression', async () => {
            const action = makeAction({ automation: { damageExpression: null } });
            const ps = makePlayerStats({
                inventory: { equipped: ['Shield'] },
                equipment: [{ name: 'Shield', armor_category: 'Shield' }],
            });
            diceRoller.rollExpression.mockReturnValue({ total: 3, rolls: [3], modifier: 0 });

            const result = await handle(action, ps, campaignName, mapName);

            expect(diceRoller.rollExpression).toHaveBeenCalledWith('1d10');
            expect(result.payload.description).toContain('Interception damage reduction: 1d10(3) + 3 = <b>6</b>');
        });

        it('clamps reduced damage to minimum 0 and heals at most original damage', async () => {
            const action = makeAction();
            const ps = makePlayerStats({
                inventory: { equipped: ['Shield'] },
                equipment: [{ name: 'Shield', armor_category: 'Shield' }],
            });
            diceRoller.rollExpression.mockReturnValue({ total: 12, rolls: [12], modifier: 0 });

            const result = await handle(action, ps, campaignName, mapName);

            // reduction 12+3=15 > original 12 → reduced 0, heal capped at 12
            expect(result.payload.description).toContain('Interception damage reduction: 1d10(12) + 3 = <b>15</b>');
            expect(result.payload.description).toContain('Reduced damage: <b>0</b>');
            expect(applyHealing.applyHealingToTarget).toHaveBeenCalledWith(
                expect.anything(),
                defenderName,
                12,
                campaignName
            );
        });

        it('handles zero original damage (reduction rolls but nothing to heal)', async () => {
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

            expect(result.payload.description).toContain('Interception damage reduction: 1d10(0) + 3 = <b>3</b>');
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
        it('applies healing to target equal to reduction amount (5+3=8)', async () => {
            const action = makeAction();
            const ps = makePlayerStats({
                inventory: { equipped: ['Shield'] },
                equipment: [{ name: 'Shield', armor_category: 'Shield' }],
            });
            // beforeEach default roll total 5 → reduction 5+3=8, original 12, heal 8
            const result = await handle(action, ps, campaignName, mapName);

            expect(result.payload.description).toContain('Interception damage reduction: 1d10(5) + 3 = <b>8</b>');
            expect(result.payload.description).toContain('Reduced damage: <b>4</b>');
            expect(applyHealing.applyHealingToTarget).toHaveBeenCalledWith(
                expect.anything(),
                defenderName,
                8,
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

            // roll 0 → reduction 0+3=3, heal still 3
            const result = await handle(action, ps, campaignName, mapName);
            expect(result.payload.description).toContain('Interception damage reduction: 1d10(0) + 3 = <b>3</b>');
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

            await handle(action, ps, campaignName, mapName);

            expect(applyHealing.applyHealingToTarget).not.toHaveBeenCalled();
        });
    });
});
