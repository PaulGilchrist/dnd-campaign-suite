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

describe('interceptionHandler logging', () => {
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
});
