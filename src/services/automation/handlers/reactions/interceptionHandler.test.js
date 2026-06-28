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
            expect(result.payload.description).toContain('No recent attack found');
        });
    });

    describe('shield requirement', () => {
        it('returns error popup when no shield equipped', async () => {
            const action = makeAction();
            const ps = makePlayerStats();

            const result = await handle(action, ps, campaignName, mapName);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('You must be holding a Shield');
        });

        it('proceeds when shield is equipped', async () => {
            const action = makeAction();
            const ps = makePlayerStats({
                inventory: { equipped: ['Shield'] },
                equipment: [{ name: 'Shield', armor_category: 'Shield' }],
            });

            const result = await handle(action, ps, campaignName, mapName);

            expect(result.type).toBe('popup');
            expect(result.payload.description).not.toContain('You must be holding a Shield');
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

            const result = await handle(action, ps, campaignName, mapName);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('out of range');
        });
    });

    describe('disadvantage buff', () => {
        it('sets targetEffects protection effect on the defender', async () => {
            const action = makeAction();
            const ps = makePlayerStats({
                inventory: { equipped: ['Shield'] },
                equipment: [{ name: 'Shield', armor_category: 'Shield' }],
            });

            await handle(action, ps, campaignName, mapName);

            expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
                campaignName,
                'targetEffects',
                expect.arrayContaining([
                    expect.objectContaining({
                        effect: 'protection',
                        target: defenderName,
                        source: playerName,
                        duration: 'until_start_of_next_turn',
                    }),
                ]),
                campaignName
            );
        });
    });

    describe('damage reduction', () => {
        it('reduces damage by 1d10 + proficiency when attack hit', async () => {
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

        it('clamps damage reduction to original damage', async () => {
            const action = makeAction();
            const ps = makePlayerStats({
                inventory: { equipped: ['Shield'] },
                equipment: [{ name: 'Shield', armor_category: 'Shield' }],
            });
            diceRoller.rollExpression.mockReturnValue({ total: 12, rolls: [12], modifier: 0 });

            const result = await handle(action, ps, campaignName, mapName);

            expect(result.payload.description).toContain('Reduced damage:');
        });

        it('applies healing to target for reduced damage', async () => {
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

        it('uses damageBonus 0 when no damageBonusExpression and no pre-computed damageBonus', async () => {
            const action = makeAction({
                automation: {
                    type: 'interception',
                    trigger: 'ally_within_5ft_attacked',
                    range: '5_ft',
                    damageExpression: '1d10',
                    damageType: '',
                    requiresShield: true,
                    casting_time: '1 reaction',
                    hasAutomation: true,
                },
            });
            const ps = makePlayerStats({
                inventory: { equipped: ['Shield'] },
                equipment: [{ name: 'Shield', armor_category: 'Shield' }],
            });
            diceRoller.rollExpression.mockReturnValue({ total: 4, rolls: [4], modifier: 0 });

            await handle(action, ps, campaignName, mapName);

            expect(applyHealing.applyHealingToTarget).toHaveBeenCalledWith(
                expect.anything(),
                defenderName,
                4,
                campaignName
            );
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
                })
            );
        });
    });

    describe('no shield or weapon', () => {
        it('returns error popup when requiresShieldOrWeapon and no shield or weapon', async () => {
            const action = makeAction({
                automation: {
                    type: 'interception',
                    trigger: 'creature_hits_ally_within_5ft',
                    range: '5_ft',
                    damageExpression: '1d10',
                    damageType: '',
                    damageBonusExpression: 'proficiency_bonus',
                    requiresShieldOrWeapon: true,
                    casting_time: '1 reaction',
                    hasAutomation: true,
                },
            });
            const ps = makePlayerStats();

            const result = await handle(action, ps, campaignName, mapName);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Shield or a Simple or Martial weapon');
        });

        it('proceeds when hasShieldOrWeapon', async () => {
            const action = makeAction({
                automation: {
                    type: 'interception',
                    trigger: 'creature_hits_ally_within_5ft',
                    range: '5_ft',
                    damageExpression: '1d10',
                    damageType: '',
                    damageBonusExpression: 'proficiency_bonus',
                    requiresShieldOrWeapon: true,
                    casting_time: '1 reaction',
                    hasAutomation: true,
                },
            });
            const ps = makePlayerStats({
                inventory: { equipped: ['Longsword'] },
                equipment: [{ name: 'Longsword', equipment_category: 'Weapon' }],
            });

            const result = await handle(action, ps, campaignName, mapName);

            expect(result.type).toBe('popup');
            expect(result.payload.description).not.toContain('Shield or a Simple or Martial weapon');
        });
    });
});
