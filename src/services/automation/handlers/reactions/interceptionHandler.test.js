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
import * as damageRollback from '../../common/damageRollback.js';
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
        // Default dice roll for validation tests
        // Individual tests override as needed
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
});
