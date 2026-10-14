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

describe('interceptionHandler targetEffects', () => {
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

    describe('targetEffects protection', () => {
        it('pushes new protection effect when none exists', async () => {
            const action = makeAction();
            const ps = makePlayerStats({
                inventory: { equipped: ['Shield'] },
                equipment: [{ name: 'Shield', armor_category: 'Shield' }],
            });

            await handle(action, ps, campaignName, mapName);

            expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
                'campaign',
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
});
