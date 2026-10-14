import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../../rules/effects/expirations.js', () => ({
    addExpiration: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../encounters/combatData.js', () => ({
    getCombatSummary: vi.fn(),
}));

vi.mock('../../../combat/concentration/concentrationService.js', () => ({
    addConcentration: vi.fn(),
}));

vi.mock('../../../rules/combat/applyHealing.js', () => ({
    applyHealingToTarget: vi.fn().mockReturnValue({ actualHeal: 7, oldHp: 10, newHp: 17 }),
}));

vi.mock('../../../dice/diceRoller.js', () => ({
    rollExpression: vi.fn().mockReturnValue({ total: 7, rolls: [4, 3], modifier: 0, formula: '2d6' }),
}));

import { handle, applyAuraOfVitality, isAuraOfVitalityActive } from './auraOfVitalityHandler.js';
import * as useRuntimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as expirations from '../../../rules/effects/expirations.js';
import * as logService from '../../../ui/logService.js';
import * as combatData from '../../../encounters/combatData.js';
import * as concentrationService from '../../../combat/concentration/concentrationService.js';
import * as applyHealing from '../../../rules/combat/applyHealing.js';
import * as diceRoller from '../../../dice/diceRoller.js';

const campaignName = 'test-campaign';
const defaultAction = { name: 'Aura of Vitality', automation: { type: 'aura_of_vitality' } };
const defaultPlayerStats = { name: 'Cleric', concentrationBonus: 2 };

function makePlayerStats(overrides = {}) {
    return { ...defaultPlayerStats, ...overrides };
}

function makeCombatSummary(creatureNames = []) {
    return {
        creatures: creatureNames.map((name) => ({
            name,
            maxHp: 50,
            currentHp: name === 'Cleric' ? 25 : 40,
        })),
    };
}

function mockPlayerRuntimeValues(entity, hitPoints, currentHitPoints) {
    vi.mocked(useRuntimeState.getRuntimeValue).mockImplementation((e, key) => {
        if (e !== entity) return null;
        if (key === 'hitPoints') return hitPoints;
        if (key === 'currentHitPoints') return currentHitPoints;
        return null;
    });
}

function mockCreature(type, maxHp, currentHp) {
    combatData.getCombatSummary.mockReturnValue({
        creatures: [{ name: 'Ally1', type, maxHp, currentHp }],
    });
}

function defaultMocks(creatureNames) {
    combatData.getCombatSummary.mockReturnValue(makeCombatSummary(creatureNames || ['Cleric', 'Ally1']));
}

function mockFullHealth() {
    combatData.getCombatSummary.mockReturnValue({
        creatures: [{ name: 'Ally1', type: 'npc', maxHp: 50, currentHp: 50 }],
    });
    vi.mocked(diceRoller.rollExpression).mockReturnValue({ total: 10, rolls: [6, 4], modifier: 0, formula: '2d6' });
}

function mockHealDice(total, rolls) {
    vi.mocked(diceRoller.rollExpression).mockReturnValue({
        total, rolls, modifier: 0, formula: '2d6',
    });
}

describe('auraOfVitalityHandler', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(diceRoller.rollExpression).mockReturnValue({ total: 7, rolls: [4, 3], modifier: 0, formula: '2d6' });
    });

    describe('handle', () => {
        it('returns popup with all creature targets', async () => {
            defaultMocks(['Cleric', 'Ally1', 'Ally2', 'Enemy1']);
            const result = await handle(defaultAction, makePlayerStats(), campaignName, null);
            expect(result).toEqual({
                type: 'popup',
                payload: expect.objectContaining({
                    type: 'automation_info',
                    name: 'Aura of Vitality',
                    creatureTargets: ['Cleric', 'Ally1', 'Ally2', 'Enemy1'],
                    maxTargets: 1,
                }),
            });
        });

        it('returns error popup when no combat context', async () => {
            combatData.getCombatSummary.mockReturnValue(null);
            const result = await handle(defaultAction, makePlayerStats(), campaignName, null);
            expect(result).toEqual({
                type: 'popup',
                payload: expect.objectContaining({
                    type: 'automation_info',
                    description: expect.stringContaining('No combat context found'),
                }),
            });
        });

        it('returns popup with empty creatureTargets when combat has no creatures', async () => {
            combatData.getCombatSummary.mockReturnValue({ creatures: [] });
            const result = await handle(defaultAction, makePlayerStats(), campaignName, null);
            expect(result).toEqual({
                type: 'popup',
                payload: expect.objectContaining({
                    type: 'automation_info',
                    creatureTargets: [],
                    maxTargets: 1,
                }),
            });
        });

        it('passes empty automation object when action.automation is falsy', async () => {
            defaultMocks(['Cleric', 'Ally1']);
            const action = { name: 'Aura of Vitality' };
            const result = await handle(action, makePlayerStats(), campaignName, null);
            expect(result).toEqual({
                type: 'popup',
                payload: expect.objectContaining({
                    type: 'automation_info',
                    name: 'Aura of Vitality',
                    automation: {},
                }),
            });
        });

        it('passes existing automation object when provided', async () => {
            defaultMocks(['Cleric', 'Ally1']);
            const action = { name: 'Aura of Vitality', automation: { healExpression: '3d6', customFlag: true } };
            const result = await handle(action, makePlayerStats(), campaignName, null);
            expect(result.payload.automation).toEqual({ healExpression: '3d6', customFlag: true });
        });
    });

    describe('applyAuraOfVitality', () => {
        it('returns null for empty or undefined target list', async () => {
            const result1 = await applyAuraOfVitality(defaultAction, makePlayerStats(), campaignName, null, []);
            expect(result1).toBeNull();
            const result2 = await applyAuraOfVitality(defaultAction, makePlayerStats(), campaignName, null, null);
            expect(result2).toBeNull();
        });

        it('returns error popup when no combat context', async () => {
            combatData.getCombatSummary.mockReturnValue(null);
            const result = await applyAuraOfVitality(defaultAction, makePlayerStats(), campaignName, null, ['Ally1']);
            expect(result).toEqual({
                type: 'popup',
                payload: expect.objectContaining({
                    type: 'automation_info',
                    description: expect.stringContaining('No combat context found'),
                }),
            });
        });

        it('returns error popup when target not found in combat', async () => {
            defaultMocks(['Cleric', 'Ally1']);
            const result = await applyAuraOfVitality(defaultAction, makePlayerStats(), campaignName, null, ['Unknown']);
            expect(result).toEqual({
                type: 'popup',
                payload: expect.objectContaining({
                    type: 'automation_info',
                    description: expect.stringContaining('Target Unknown not found in combat'),
                }),
            });
        });

        it('returns error popup when rollExpression fails', async () => {
            defaultMocks(['Cleric', 'Ally1']);
            vi.mocked(diceRoller.rollExpression).mockReturnValue(null);
            const result = await applyAuraOfVitality(defaultAction, makePlayerStats(), campaignName, null, ['Ally1']);
            expect(result).toEqual({
                type: 'popup',
                payload: expect.objectContaining({
                    type: 'automation_info',
                    description: expect.stringContaining('Failed to roll healing'),
                }),
            });
        });

        it.each([
            ['non-player', 'npc', { maxHp: null, currentHp: 30 }],
            ['player', 'player', { maxHp: 50, currentHp: 30 }],
        ])('returns error popup when maxHp is null for %s creature', async (_type, creatureType, creatureData) => {
            combatData.getCombatSummary.mockReturnValue({
                creatures: [{ name: 'Ally1', type: creatureType, ...creatureData }],
            });
            if (creatureType === 'player') {
                mockPlayerRuntimeValues('Ally1', null, 30);
            }
            const result = await applyAuraOfVitality(defaultAction, makePlayerStats(), campaignName, null, ['Ally1']);
            expect(result).toEqual({
                type: 'popup',
                payload: expect.objectContaining({
                    type: 'automation_info',
                    description: expect.stringContaining('Could not determine max HP'),
                }),
            });
        });

        it.each([
            ['non-player', 'npc', { maxHp: 50, currentHp: null }],
            ['player', 'player', { maxHp: 50, currentHp: 30 }],
        ])('returns error popup when currentHp is null for %s creature', async (_type, creatureType, creatureData) => {
            combatData.getCombatSummary.mockReturnValue({
                creatures: [{ name: 'Ally1', type: creatureType, ...creatureData }],
            });
            if (creatureType === 'player') {
                mockPlayerRuntimeValues('Ally1', 50, null);
            }
            const result = await applyAuraOfVitality(defaultAction, makePlayerStats(), campaignName, null, ['Ally1']);
            expect(result).toEqual({
                type: 'popup',
                payload: expect.objectContaining({
                    type: 'automation_info',
                    description: expect.stringContaining('Could not determine current HP'),
                }),
            });
        });

        it('uses default healExpression when not provided', async () => {
            defaultMocks(['Cleric', 'Ally1']);
            mockHealDice(5, [3, 2]);
            await applyAuraOfVitality(defaultAction, makePlayerStats(), campaignName, null, ['Ally1']);
            expect(vi.mocked(diceRoller.rollExpression)).toHaveBeenCalledWith('2d6');
        });

        it('uses heal_at_slot_level exact match when spell has it', async () => {
            defaultMocks(['Cleric', 'Ally1']);
            mockHealDice(10, [5, 5]);
            const action = { ...defaultAction, spell: { heal_at_slot_level: { '3': '2d6', '4': '3d6' } }, spellSlotLevel: 3 };
            await applyAuraOfVitality(action, makePlayerStats(), campaignName, null, ['Ally1']);
            expect(vi.mocked(diceRoller.rollExpression)).toHaveBeenCalledWith('2d6');
        });

        it('uses heal_at_slot_level highestBelow when no exact match', async () => {
            defaultMocks(['Cleric', 'Ally1']);
            mockHealDice(15, [7, 8]);
            const action = { ...defaultAction, spell: { heal_at_slot_level: { '2': '2d6', '4': '4d6' } }, spellSlotLevel: 3 };
            await applyAuraOfVitality(action, makePlayerStats(), campaignName, null, ['Ally1']);
            expect(vi.mocked(diceRoller.rollExpression)).toHaveBeenCalledWith('2d6');
        });

        it('falls back to default healExpression when highestBelow is undefined', async () => {
            defaultMocks(['Cleric', 'Ally1']);
            mockHealDice(7, [4, 3]);
            const action = { ...defaultAction, spell: { heal_at_slot_level: { '5': '6d6' } }, spellSlotLevel: 3 };
            await applyAuraOfVitality(action, makePlayerStats(), campaignName, null, ['Ally1']);
            expect(vi.mocked(diceRoller.rollExpression)).toHaveBeenCalledWith('2d6');
        });

        it('falls back to default when action.spell exists but heal_at_slot_level is undefined', async () => {
            defaultMocks(['Cleric', 'Ally1']);
            mockHealDice(7, [4, 3]);
            const action = { ...defaultAction, spell: { someOtherProp: true }, spellSlotLevel: 3 };
            await applyAuraOfVitality(action, makePlayerStats(), campaignName, null, ['Ally1']);
            expect(vi.mocked(diceRoller.rollExpression)).toHaveBeenCalledWith('2d6');
        });

        it('uses custom healExpression from automation when provided', async () => {
            defaultMocks(['Cleric', 'Ally1']);
            mockHealDice(12, [6, 6]);
            const action = { ...defaultAction, automation: { ...defaultAction.automation, healExpression: '2d8' } };
            await applyAuraOfVitality(action, makePlayerStats(), campaignName, null, ['Ally1']);
            expect(vi.mocked(diceRoller.rollExpression)).toHaveBeenCalledWith('2d8');
        });

        it('uses automation slotLevel over spellSlotLevel when both exist', async () => {
            defaultMocks(['Cleric', 'Ally1']);
            mockHealDice(10, [5, 5]);
            const action = { ...defaultAction, spell: { heal_at_slot_level: { '3': '2d6', '5': '4d6' } }, spellSlotLevel: 5, automation: { ...defaultAction.automation, slotLevel: 3 } };
            await applyAuraOfVitality(action, makePlayerStats(), campaignName, null, ['Ally1']);
            expect(vi.mocked(diceRoller.rollExpression)).toHaveBeenCalledWith('2d6');
        });

        it('uses spellSlotLevel when automation has no slotLevel', async () => {
            defaultMocks(['Cleric', 'Ally1']);
            mockHealDice(10, [5, 5]);
            const action = { ...defaultAction, spell: { heal_at_slot_level: { '3': '2d6', '5': '4d6' } }, spellSlotLevel: 3 };
            await applyAuraOfVitality(action, makePlayerStats(), campaignName, null, ['Ally1']);
            expect(vi.mocked(diceRoller.rollExpression)).toHaveBeenCalledWith('2d6');
        });

        it('uses default automation object when action.automation is falsy', async () => {
            defaultMocks(['Cleric', 'Ally1']);
            mockPlayerRuntimeValues('Ally1', undefined, 30);
            mockHealDice(8, [5, 3]);
            const action = { name: 'Aura of Vitality' };
            const result = await applyAuraOfVitality(action, makePlayerStats(), campaignName, null, ['Ally1']);
            expect(result).toEqual({
                type: 'popup',
                payload: expect.objectContaining({
                    type: 'automation_info',
                    automation: {},
                }),
            });
            expect(vi.mocked(diceRoller.rollExpression)).toHaveBeenCalledWith('2d6');
        });

        it('uses empty automation object when action.automation is {}', async () => {
            defaultMocks(['Cleric', 'Ally1']);
            mockPlayerRuntimeValues('Ally1', undefined, 30);
            mockHealDice(8, [5, 3]);
            const action = { name: 'Aura of Vitality', automation: {} };
            const result = await applyAuraOfVitality(action, makePlayerStats(), campaignName, null, ['Ally1']);
            expect(result).toEqual({
                type: 'popup',
                payload: expect.objectContaining({
                    type: 'automation_info',
                    automation: {},
                }),
            });
            expect(vi.mocked(diceRoller.rollExpression)).toHaveBeenCalledWith('2d6');
        });

        it('does not call applyHealingToTarget when target is at full health', async () => {
            mockFullHealth();
            const result = await applyAuraOfVitality(defaultAction, makePlayerStats(), campaignName, null, ['Ally1']);
            expect(result).toEqual({
                type: 'popup',
                payload: expect.objectContaining({
                    type: 'automation_info',
                    description: expect.stringContaining('Ally1'),
                }),
            });
            expect(vi.mocked(applyHealing.applyHealingToTarget)).not.toHaveBeenCalled();
            expect(vi.mocked(logService.addEntry)).toHaveBeenCalledTimes(2);
        });

        it('clamps healAmount to remaining HP when target is partially healed', async () => {
            combatData.getCombatSummary.mockReturnValue({
                creatures: [{ name: 'Ally1', type: 'npc', maxHp: 50, currentHp: 45 }],
            });
            mockHealDice(10, [6, 4]);
            const result = await applyAuraOfVitality(defaultAction, makePlayerStats(), campaignName, null, ['Ally1']);
            expect(vi.mocked(applyHealing.applyHealingToTarget)).toHaveBeenCalledWith(
                expect.any(Object),
                'Ally1',
                5,
                campaignName,
            );
            expect(result.payload.description).toContain('Target heals 5 HP');
        });

        it('applies healing, targetEffects, concentration, and expirations for target', async () => {
            defaultMocks(['Cleric', 'Ally1']);
            mockPlayerRuntimeValues('Ally1', undefined, 30);
            mockHealDice(8, [5, 3]);
            const action = { ...defaultAction, spell: { heal_at_slot_level: { '3': '2d6' } }, spellSlotLevel: 3 };
            const result = await applyAuraOfVitality(action, makePlayerStats(), campaignName, null, ['Ally1']);
            expect(result).toEqual({
                type: 'popup',
                payload: expect.objectContaining({
                    type: 'automation_info',
                    name: 'Aura of Vitality',
                    description: expect.stringContaining('Ally1'),
                }),
            });
            expect(vi.mocked(applyHealing.applyHealingToTarget)).toHaveBeenCalled();
            expect(vi.mocked(useRuntimeState.setRuntimeValue))
                .toHaveBeenCalledWith('campaign', 'targetEffects', expect.arrayContaining([
                    expect.objectContaining({
                        target: 'Ally1', effect: 'aura_of_vitality', source: 'Cleric', duration: 'concentration',
                    }),
                ]), campaignName, true);
            expect(vi.mocked(concentrationService.addConcentration)).toHaveBeenCalled();
            expect(vi.mocked(expirations.addExpiration)).toHaveBeenCalled();
            expect(vi.mocked(logService.addEntry)).toHaveBeenCalledTimes(2);
        });

        it('updates existing target effect when aura_of_vitality already exists', async () => {
            defaultMocks(['Cleric', 'Ally1']);
            vi.mocked(useRuntimeState.getRuntimeValue).mockImplementation((entity, key) => {
                if (entity === 'campaign' && key === 'targetEffects') {
                    return [{ target: 'Ally1', effect: 'aura_of_vitality', source: 'Cleric', duration: 'concentration' }];
                }
                if (entity === 'Ally1' && key === 'currentHitPoints') return 30;
                return null;
            });
            mockHealDice(8, [5, 3]);
            await applyAuraOfVitality(defaultAction, makePlayerStats(), campaignName, null, ['Ally1']);
            expect(vi.mocked(useRuntimeState.setRuntimeValue)).toHaveBeenCalledWith(
                'campaign', 'targetEffects',
                expect.arrayContaining([
                    expect.objectContaining({
                        target: 'Ally1', effect: 'aura_of_vitality', source: 'Cleric', duration: 'concentration',
                    }),
                ]),
                campaignName, true,
            );
        });

        it('updates existing caster effect when aura_of_vitality already exists on caster', async () => {
            defaultMocks(['Cleric', 'Ally1']);
            vi.mocked(useRuntimeState.getRuntimeValue).mockImplementation((entity, key) => {
                if (entity === 'campaign' && key === 'targetEffects') {
                    return [{ target: 'Cleric', effect: 'aura_of_vitality', source: 'Cleric', duration: 'concentration' }];
                }
                if (entity === 'Ally1' && key === 'currentHitPoints') return 30;
                return null;
            });
            mockHealDice(8, [5, 3]);
            await applyAuraOfVitality(defaultAction, makePlayerStats(), campaignName, null, ['Ally1']);
            expect(vi.mocked(useRuntimeState.setRuntimeValue)).toHaveBeenCalledWith(
                'campaign', 'targetEffects',
                expect.arrayContaining([
                    expect.objectContaining({
                        target: 'Cleric', effect: 'aura_of_vitality', source: 'Cleric', duration: 'concentration',
                    }),
                ]),
                campaignName, true,
            );
        });

        it('adds both target and caster effects when neither exists', async () => {
            defaultMocks(['Cleric', 'Ally1']);
            vi.mocked(useRuntimeState.getRuntimeValue).mockImplementation((entity, key) => {
                if (entity === 'campaign' && key === 'targetEffects') return [];
                if (entity === 'Ally1' && key === 'currentHitPoints') return 30;
                return null;
            });
            mockHealDice(8, [5, 3]);
            await applyAuraOfVitality(defaultAction, makePlayerStats(), campaignName, null, ['Ally1']);
            const teCalls = vi.mocked(useRuntimeState.setRuntimeValue).mock.calls.filter(
                (c) => c[0] === 'campaign' && c[1] === 'targetEffects'
            );
            const allEffects = teCalls.flatMap((c) => c[2]);
            expect(allEffects).toContainEqual({ target: 'Ally1', effect: 'aura_of_vitality', source: 'Cleric', duration: 'concentration' });
            expect(allEffects).toContainEqual({ target: 'Cleric', effect: 'aura_of_vitality', source: 'Cleric', duration: 'concentration' });
        });

        it('uses player runtime values for player-type creatures', async () => {
            mockCreature('player', 50, 30);
            mockPlayerRuntimeValues('Ally1', 50, 30);
            mockHealDice(8, [5, 3]);
            await applyAuraOfVitality(defaultAction, makePlayerStats(), campaignName, null, ['Ally1']);
            expect(vi.mocked(useRuntimeState.getRuntimeValue)).toHaveBeenCalledWith('Ally1', 'hitPoints');
            expect(vi.mocked(useRuntimeState.getRuntimeValue)).toHaveBeenCalledWith('Ally1', 'currentHitPoints', campaignName);
        });

        it('uses creature properties for non-player creatures', async () => {
            mockCreature('npc', 50, 30);
            vi.mocked(useRuntimeState.getRuntimeValue).mockImplementation(() => null);
            mockHealDice(8, [5, 3]);
            await applyAuraOfVitality(defaultAction, makePlayerStats(), campaignName, null, ['Ally1']);
            expect(vi.mocked(useRuntimeState.getRuntimeValue)).not.toHaveBeenCalledWith('Ally1', 'hitPoints');
            expect(vi.mocked(useRuntimeState.getRuntimeValue)).not.toHaveBeenCalledWith('Ally1', 'currentHitPoints', campaignName);
        });

        it('handles logEntry catch error', async () => {
            defaultMocks(['Cleric', 'Ally1']);
            mockPlayerRuntimeValues('Ally1', undefined, 30);
            mockHealDice(8, [5, 3]);
            const logError = new Error('log failed');
            vi.mocked(logService.addEntry).mockRejectedValue(logError);
            const consoleSpy = vi.spyOn(console, 'error').mockReturnValue();
            await applyAuraOfVitality(defaultAction, makePlayerStats(), campaignName, null, ['Ally1']);
            expect(vi.mocked(console.error)).toHaveBeenCalledWith('[auraOfVitality] Error:', logError);
            consoleSpy.mockRestore();
        });

        it('passes concentrationBonus=0 to addConcentration when bonus is null', async () => {
            defaultMocks(['Cleric', 'Ally1']);
            mockPlayerRuntimeValues('Ally1', undefined, 30);
            mockHealDice(8, [5, 3]);
            await applyAuraOfVitality(defaultAction, makePlayerStats({ concentrationBonus: null }), campaignName, null, ['Ally1']);
            expect(vi.mocked(concentrationService.addConcentration)).toHaveBeenCalledWith(
                expect.any(Object),
                'Cleric',
                'Aura of Vitality',
                10,
            );
        });

        it('passes correct concentration DC with bonus', async () => {
            defaultMocks(['Cleric', 'Ally1']);
            mockPlayerRuntimeValues('Ally1', undefined, 30);
            mockHealDice(8, [5, 3]);
            await applyAuraOfVitality(defaultAction, makePlayerStats({ concentrationBonus: 5 }), campaignName, null, ['Ally1']);
            expect(vi.mocked(concentrationService.addConcentration)).toHaveBeenCalledWith(
                expect.any(Object),
                'Cleric',
                'Aura of Vitality',
                15,
            );
        });

        it('logs ability_use entry with correct description format', async () => {
            defaultMocks(['Cleric', 'Ally1']);
            mockPlayerRuntimeValues('Ally1', undefined, 30);
            mockHealDice(8, [5, 3]);
            await applyAuraOfVitality(defaultAction, makePlayerStats(), campaignName, null, ['Ally1']);
            const abilityUseCall = vi.mocked(logService.addEntry).mock.calls[1][1];
            expect(abilityUseCall.type).toBe('ability_use');
            expect(abilityUseCall.characterName).toBe('Cleric');
            expect(abilityUseCall.abilityName).toBe('Aura of Vitality');
            expect(abilityUseCall.description).toContain('Cleric casts Aura of Vitality on Ally1');
            expect(abilityUseCall.description).toContain('Target heals 8 HP');
            expect(abilityUseCall.description).toContain('rolled 2d6: 8');
        });

        it('logs hp_change entry with correct data', async () => {
            defaultMocks(['Cleric', 'Ally1']);
            mockPlayerRuntimeValues('Ally1', undefined, 30);
            mockHealDice(8, [5, 3]);
            await applyAuraOfVitality(defaultAction, makePlayerStats(), campaignName, null, ['Ally1']);
            const hpChangeCall = vi.mocked(logService.addEntry).mock.calls[0][1];
            expect(hpChangeCall.type).toBe('hp_change');
            expect(hpChangeCall.targetName).toBe('Ally1');
            expect(hpChangeCall.delta).toBe(8);
            expect(hpChangeCall.currentHp).toBe(48);
            expect(hpChangeCall.maxHp).toBe(50);
            expect(hpChangeCall.isHealing).toBe(true);
            expect(hpChangeCall.sourceName).toBe('Cleric');
            expect(hpChangeCall.formula).toBe('2d6');
        });
    });

    describe('isAuraOfVitalityActive', () => {
        it('returns true when aura effect is active on target', () => {
            vi.mocked(useRuntimeState.getRuntimeValue).mockImplementation((entity, key) => {
                if (entity === 'campaign' && key === 'targetEffects') {
                    return [
                        { target: 'Ally1', effect: 'aura_of_vitality', source: 'Cleric', duration: 'concentration' },
                        { target: 'Ally2', effect: 'haste', source: 'Cleric' },
                    ];
                }
                return null;
            });
            expect(isAuraOfVitalityActive('Ally1', campaignName)).toBe(true);
        });

        it('returns false when aura effect is not on target', () => {
            vi.mocked(useRuntimeState.getRuntimeValue).mockImplementation((entity, key) => {
                if (entity === 'campaign' && key === 'targetEffects') {
                    return [{ target: 'Ally2', effect: 'aura_of_vitality', source: 'Cleric' }];
                }
                return null;
            });
            expect(isAuraOfVitalityActive('Ally1', campaignName)).toBe(false);
        });

        it('returns false when no target effects', () => {
            vi.mocked(useRuntimeState.getRuntimeValue).mockImplementation((entity, key) => {
                if (entity === 'campaign' && key === 'targetEffects') return [];
                return null;
            });
            expect(isAuraOfVitalityActive('Ally1', campaignName)).toBe(false);
        });

        it('returns false when targetEffects is falsy', () => {
            vi.mocked(useRuntimeState.getRuntimeValue).mockImplementation((entity, key) => {
                if (entity === 'campaign' && key === 'targetEffects') return null;
                return null;
            });
            expect(isAuraOfVitalityActive('Ally1', campaignName)).toBe(false);
        });
    });
});
