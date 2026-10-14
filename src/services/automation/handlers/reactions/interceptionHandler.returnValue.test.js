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

describe('interceptionHandler return value', () => {
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
