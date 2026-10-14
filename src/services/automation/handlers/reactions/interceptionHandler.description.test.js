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

describe('interceptionHandler description', () => {
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
});
