// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { handle } from './bonusActionAttackHandler.js';

// ── Mocks ──────────────────────────────────────────────────────

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../common/damageRollback.js', () => ({
    findLastAttack: vi.fn(),
}));

vi.mock('../../common/polearmUtils.js', () => ({
    isPolearmWeapon: vi.fn(),
}));

vi.mock('../../../combat/baseCombatActions.js', () => ({
    MELEE_REACH_FEET: 5,
}));

vi.mock('../../../shared/popupResponse.js', () => ({
    automationInfoPopup: vi.fn((action) => ({
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            automationType: action.automation?.type,
            description: action.description || '',
            automation: action.automation,
        },
    })),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(),
    getTargetFromAttacker: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn().mockResolvedValue(undefined),
}));

// ── Re-imports after mocking ───────────────────────────────────

import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { findLastAttack } from '../../common/damageRollback.js';
import { isPolearmWeapon } from '../../common/polearmUtils.js';
import { MELEE_REACH_FEET } from '../../../combat/baseCombatActions.js';
import { automationInfoPopup } from '../../../shared/popupResponse.js';
import { getCombatContext, getTargetFromAttacker } from '../../../rules/combat/damageUtils.js';
import { addEntry } from '../../../ui/logService.js';

// ── Constants ──────────────────────────────────────────────────

const CAMPAIGN_NAME = 'TestCampaign';

// ── Helpers ────────────────────────────────────────────────────

function makeAction(overrides = {}) {
    return {
        name: 'Bonus Action Attack',
        description: 'Make a bonus action attack.',
        automation: {
            type: 'bonus_action_attack',
            ...overrides.automation,
        },
        ...overrides,
    };
}

function makePlayerStats(overrides = {}) {
    return {
        name: 'TestHero',
        proficiency: 3,
        inventory: { equipped: [] },
        attacks: [
            { name: 'Unarmed Strike', weaponType: 'unarmed', hitBonus: 2, damage: '1d4-1', damageType: 'Bludgeoning', range: 5, properties: [] },
        ],
        ...overrides,
    };
}

function mockUses(value) {
    getRuntimeValue.mockImplementation((_name, key) => (key === 'warPriestUses' ? value : null));
}

function armCombat(targetName = 'Goblin') {
    getCombatContext.mockResolvedValue({ creatures: [{ name: 'TestHero', targetName }, { name: targetName }], round: 1 });
    getTargetFromAttacker.mockImplementation((cs, attackerName) => cs?.creatures?.find(c => c.name === cs?.creatures?.find(x => x.name === attackerName)?.targetName) || null);
}

// ── Tests ──────────────────────────────────────────────────────

describe('bonusActionAttackHandler', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(automationInfoPopup).mockClear();
    });

    describe('handle', () => {
        describe('basic case (no special triggers/effects)', () => {
            it('should return automation_info popup with action details', async () => {
                const action = makeAction();
                const result = await handle(action, makePlayerStats(), CAMPAIGN_NAME, 'map', []);

                expect(result.type).toBe('popup');
                expect(result.payload.type).toBe('automation_info');
                expect(result.payload.name).toBe('Bonus Action Attack');
                expect(result.payload.description).toBe('Make a bonus action attack.');
                expect(result.payload.automationType).toBe('bonus_action_attack');
                expect(result.payload.automation).toEqual(action.automation);
                expect(automationInfoPopup).toHaveBeenCalledWith(action);
            });

            it('should use empty string for description when falsy', async () => {
                const action = makeAction({ description: undefined });
                const result = await handle(action, makePlayerStats(), CAMPAIGN_NAME, 'map', []);

                expect(result.payload.description).toBe('');
            });
        });

        describe('uses tracking', () => {
            it('should refuse with recharge text and log a refusal when uses exhausted', async () => {
                const action = makeAction({ automation: { usesMax: 3 } });
                mockUses(0);

                const result = await handle(action, makePlayerStats(), CAMPAIGN_NAME, 'map', []);

                expect(result.type).toBe('popup');
                expect(result.payload.description).toBe('Bonus Action Attack has no uses remaining. Recharges on a Long Rest.');
                expect(setRuntimeValue).not.toHaveBeenCalled();
                expect(addEntry).toHaveBeenCalledWith(CAMPAIGN_NAME, expect.objectContaining({
                    automationType: 'bonus_action_attack_refused',
                }));
            });

            it('should return popup with custom recharge text when uses exhausted', async () => {
                const action = makeAction({ automation: { usesMax: 1, recharge: 'Short Rest' } });
                mockUses(0);

                const result = await handle(action, makePlayerStats(), CAMPAIGN_NAME, 'map', []);

                expect(result.payload.description).toBe('Bonus Action Attack has no uses remaining. Recharges on a Short Rest.');
                expect(setRuntimeValue).not.toHaveBeenCalled();
            });

            it('should decrement uses and return attack_roll', async () => {
                const action = makeAction({ automation: { usesMax: 3 } });
                mockUses(2);
                armCombat();

                const result = await handle(action, makePlayerStats(), CAMPAIGN_NAME, 'map', []);

                expect(result.type).toBe('attack_roll');
                expect(setRuntimeValue).toHaveBeenCalledWith(
                    'TestHero',
                    'warPriestUses',
                    1,
                    CAMPAIGN_NAME,
                );
            });

            it('should use custom resourceKey when provided', async () => {
                const action = makeAction({ automation: { usesMax: 1, resourceKey: 'warPriestUses' } });
                mockUses(1);
                armCombat();

                const result = await handle(action, makePlayerStats(), CAMPAIGN_NAME, 'map', []);

                expect(result.type).toBe('attack_roll');
                expect(setRuntimeValue).toHaveBeenCalledWith(
                    'TestHero',
                    'warPriestUses',
                    0,
                    CAMPAIGN_NAME,
                );
            });

            it('should skip use tracking when usesMax is not positive', async () => {
                const action = makeAction({ automation: { usesMax: 0 } });
                mockUses(0);

                const result = await handle(action, makePlayerStats(), CAMPAIGN_NAME, 'map', []);

                expect(result.type).toBe('popup');
                expect(setRuntimeValue).not.toHaveBeenCalled();
            });

            it('should decrement float values correctly', async () => {
                const action = makeAction({ automation: { usesMax: 3 } });
                mockUses(2.5);
                armCombat();

                const result = await handle(action, makePlayerStats(), CAMPAIGN_NAME, 'map', []);

                expect(result.type).toBe('attack_roll');
                expect(setRuntimeValue).toHaveBeenCalledWith(
                    'TestHero',
                    'warPriestUses',
                    1.5,
                    CAMPAIGN_NAME,
                );
            });

            it('should treat non-positive currentUses as exhausted', async () => {
                const action = makeAction({ automation: { usesMax: 3 } });
                mockUses(-1);

                const result = await handle(action, makePlayerStats(), CAMPAIGN_NAME, 'map', []);

                expect(result.payload.description).toContain('no uses remaining');
                expect(setRuntimeValue).not.toHaveBeenCalled();
            });

            it('should default to usesMax when getRuntimeValue returns null or undefined', async () => {
                const action = makeAction({ automation: { usesMax: 2 } });
                mockUses(null);
                armCombat();

                const result = await handle(action, makePlayerStats(), CAMPAIGN_NAME, 'map', []);

                expect(result.type).toBe('attack_roll');
                expect(setRuntimeValue).toHaveBeenCalledWith(
                    'TestHero',
                    'warPriestUses',
                    1,
                    CAMPAIGN_NAME,
                );
            });
        });

        describe('CLA-382 War Priest (uses_expression, no trigger)', () => {
            const warPriestAction = () => makeAction({
                name: 'War Priest',
                automation: {
                    type: 'bonus_action_attack',
                    action: 'bonus_action',
                    uses_expression: 'WIS modifier_min_1',
                    recharge: 'short_rest',
                    casting_time: '1 bonus action',
                },
            });

            const wisCleric = (wisBonus) => makePlayerStats({
                abilities: [{ name: 'Wisdom', bonus: wisBonus }, { name: 'Strength', bonus: -1 }],
            });

            it('should resolve usesMax from uses_expression and spend one use with an attack_roll', async () => {
                armCombat('Thug 1');
                mockUses(null); // fresh: null → usesMax

                const result = await handle(warPriestAction(), wisCleric(4), CAMPAIGN_NAME, 'map', []);

                expect(result.type).toBe('attack_roll');
                expect(result.payload.attack.type).toBe('Bonus Action');
                expect(result.payload.attack.hitBonus).toBe(2);
                expect(result.payload.attack.damage).toBe('1d4-1');
                expect(result.payload.attack.damageType).toBe('Bludgeoning');
                expect(result.payload.attack.autoDamageFormula).toBe('1d4-1');
                expect(result.payload.attack.name).toContain('War Priest');
                expect(result.payload.attack.name).toContain('Unarmed Strike');
                expect(result.payload.targetName).toBe('Thug 1');
                expect(setRuntimeValue).toHaveBeenCalledWith('TestHero', 'warPriestUses', 3, CAMPAIGN_NAME);
                expect(addEntry).toHaveBeenCalledWith(CAMPAIGN_NAME, expect.objectContaining({
                    type: 'ability_use',
                    abilityName: 'War Priest',
                }));
            });

            it('should honour WIS negative floor of 1 in uses_expression', async () => {
                armCombat('Thug 1');
                mockUses(1);

                const result = await handle(warPriestAction(), wisCleric(-2), CAMPAIGN_NAME, 'map', []);

                expect(result.type).toBe('attack_roll');
                expect(setRuntimeValue).toHaveBeenCalledWith('TestHero', 'warPriestUses', 0, CAMPAIGN_NAME);
            });

            it('should refuse with war_priest_refused log at 0 uses, spending nothing', async () => {
                mockUses(0);

                const result = await handle(warPriestAction(), wisCleric(4), CAMPAIGN_NAME, 'map', []);

                expect(result.type).toBe('popup');
                expect(result.payload.description).toBe('War Priest has no uses remaining. Recharges on a Short Rest.');
                expect(setRuntimeValue).not.toHaveBeenCalled();
                expect(addEntry).toHaveBeenCalledWith(CAMPAIGN_NAME, expect.objectContaining({
                    type: 'automation',
                    automationType: 'war_priest_refused',
                }));
            });

            it('should fall back to Unarmed Strike when no equipped weapon rows', async () => {
                armCombat('Thug 1');
                mockUses(2);

                const result = await handle(warPriestAction(), wisCleric(4), CAMPAIGN_NAME, 'map', []);

                expect(result.type).toBe('attack_roll');
                expect(result.payload.attack.name).toBe('War Priest (Unarmed Strike)');
                expect(result.payload.attack.autoDamageName).toBe('War Priest (Unarmed Strike)');
            });

            it('should prefer equipped melee weapon over ranged (ranged row may sit first)', async () => {
                armCombat('Thug 1');
                mockUses(2);
                const stats = makePlayerStats({
                    attacks: [
                        { name: 'Shortbow', weaponType: 'ranged', hitBonus: 5, damage: '1d6+2', damageType: 'Piercing', range: 80, properties: [] },
                        { name: 'Scimitar', weaponType: 'melee', hitBonus: 5, damage: '1d6+2', damageType: 'Slashing', range: 5, properties: [] },
                    ],
                });

                const result = await handle(warPriestAction(), stats, CAMPAIGN_NAME, 'map', []);

                expect(result.payload.attack.name).toBe('War Priest (Scimitar)');
                expect(result.payload.attack.damageType).toBe('Slashing');
            });

            it('should not pick a Loading ranged weapon and fall back to Unarmed Strike', async () => {
                armCombat('Thug 1');
                mockUses(2);
                const stats = makePlayerStats({
                    attacks: [
                        { name: 'Heavy Crossbow', weaponType: 'ranged', hitBonus: 5, damage: '1d10+2', damageType: 'Piercing', range: 100, properties: ['Heavy', 'Loading'] },
                        { name: 'Unarmed Strike', weaponType: 'unarmed', hitBonus: 2, damage: '1d4-1', damageType: 'Bludgeoning', range: 5, properties: [] },
                    ],
                });

                const result = await handle(warPriestAction(), stats, CAMPAIGN_NAME, 'map', []);

                expect(result.payload.attack.name).toBe('War Priest (Unarmed Strike)');
            });

            it('should refuse without spending when no target is armed', async () => {
                mockUses(2);
                getCombatContext.mockResolvedValue({ creatures: [{ name: 'TestHero', targetName: null }], round: 1 });
                getTargetFromAttacker.mockReturnValue(null);

                const result = await handle(warPriestAction(), wisCleric(4), CAMPAIGN_NAME, 'map', []);

                expect(result.type).toBe('popup');
                expect(result.payload.description).toContain('No target selected');
                expect(setRuntimeValue).not.toHaveBeenCalled();
                expect(addEntry).toHaveBeenCalledWith(CAMPAIGN_NAME, expect.objectContaining({
                    automationType: 'war_priest_refused',
                }));
            });

            it('should refuse without spending when no attack rows exist', async () => {
                armCombat('Thug 1');
                mockUses(2);

                const result = await handle(warPriestAction(), makePlayerStats({ attacks: [] }), CAMPAIGN_NAME, 'map', []);

                expect(result.type).toBe('popup');
                expect(result.payload.description).toContain('No usable weapon');
                expect(setRuntimeValue).not.toHaveBeenCalled();
                expect(addEntry).toHaveBeenCalledWith(CAMPAIGN_NAME, expect.objectContaining({
                    automationType: 'war_priest_refused',
                }));
            });
        });

        describe('polearm trigger validation', () => {
            it('should reject when isPolearmWeapon returns false', async () => {
                isPolearmWeapon.mockResolvedValue(false);
                findLastAttack.mockResolvedValue({ attackEvent: { bonus: 5 }, targetName: 'Goblin' });
                const action = makeAction({ automation: { trigger: 'after_attack_action_with_polearm' } });

                const result = await handle(action, makePlayerStats(), CAMPAIGN_NAME, 'map', []);

                expect(result.type).toBe('popup');
                expect(result.payload.description).toBe(
                    'Bonus Action Attack requires you to be holding a Quarterstaff, Spear, or a weapon with the Heavy and Reach properties.',
                );
                expect(findLastAttack).toHaveBeenCalledWith(CAMPAIGN_NAME);
                expect(isPolearmWeapon).toHaveBeenCalled();
            });
        });

        describe('polearm trigger attack_roll path', () => {
            it('should return attack_roll with Quarterstaff and explicit damage', async () => {
                isPolearmWeapon.mockResolvedValue(true);
                findLastAttack.mockResolvedValue({ attackEvent: { bonus: 7 }, targetName: 'Goblin' });
                const action = makeAction({
                    automation: {
                        trigger: 'after_attack_action_with_polearm',
                        damage: '1d4',
                        damageType: 'Bludgeoning',
                    },
                    name: 'Pole Strike',
                });
                const stats = makePlayerStats({ inventory: { equipped: ['Quarterstaff'] }, proficiency: 2 });
                const allEquipment = [{ name: 'Quarterstaff', properties: [] }];

                const result = await handle(action, stats, CAMPAIGN_NAME, 'map', allEquipment);

                expect(result.type).toBe('attack_roll');
                expect(result.payload.attack.name).toBe('Pole Strike');
                expect(result.payload.attack.type).toBe('Bonus Action');
                expect(result.payload.attack.hitBonus).toBe(7);
                expect(result.payload.attack.damage).toBe('1d4');
                expect(result.payload.attack.damageType).toBe('Bludgeoning');
                expect(result.payload.attack.autoDamageFormula).toBe('1d4');
                expect(result.payload.attack.autoDamageName).toBe('Pole Strike');
                expect(result.payload.attack.range).toBe(MELEE_REACH_FEET);
                expect(result.payload.targetName).toBe('Goblin');
                expect(result.payload.sourceName).toBe('Pole Strike');
            });

            it('should return attack_roll with Spear using default damage', async () => {
                isPolearmWeapon.mockResolvedValue(true);
                findLastAttack.mockResolvedValue({ attackEvent: { bonus: 5 }, targetName: 'Orc' });
                const action = makeAction({
                    automation: { trigger: 'after_attack_action_with_polearm' },
                    name: 'Polearm Master',
                });
                const stats = makePlayerStats({ inventory: { equipped: ['Spear'] } });
                const allEquipment = [{ name: 'Spear', properties: [] }];

                const result = await handle(action, stats, CAMPAIGN_NAME, 'map', allEquipment);

                expect(result.type).toBe('attack_roll');
                expect(result.payload.attack.hitBonus).toBe(5);
                expect(result.payload.attack.autoDamageFormula).toBe('1d4');
                expect(result.payload.attack.damageType).toBe('Bludgeoning');
                expect(result.payload.attack.name).toBe('Polearm Master');
                expect(result.payload.attack.autoDamageName).toBe('Polearm Master');
                expect(result.payload.targetName).toBe('Orc');
            });

            it('should return attack_roll with Heavy + Reach weapon', async () => {
                isPolearmWeapon.mockResolvedValue(true);
                findLastAttack.mockResolvedValue({ attackEvent: { bonus: 6 }, targetName: 'Troll' });
                const action = makeAction({
                    automation: {
                        trigger: 'after_attack_action_with_polearm',
                        extraDamageExpression: '1d4',
                    },
                    name: 'Polearm Master',
                });
                const stats = makePlayerStats({ inventory: { equipped: ['Glaive'] } });
                const allEquipment = [{ name: 'Glaive', properties: ['Heavy', 'Reach', 'Two-Handed'] }];

                const result = await handle(action, stats, CAMPAIGN_NAME, 'map', allEquipment);

                expect(result.type).toBe('attack_roll');
                expect(result.payload.attack.hitBonus).toBe(6);
                expect(result.payload.attack.autoDamageFormula).toBe('1d4');
            });

            it('should fall back to proficiency bonus when no lastAttack', async () => {
                isPolearmWeapon.mockResolvedValue(true);
                findLastAttack.mockResolvedValue({ attackEvent: null, targetName: null });
                const action = makeAction({
                    automation: { trigger: 'after_attack_action_with_polearm' },
                    name: 'Pole Strike',
                });
                const stats = makePlayerStats({ inventory: { equipped: ['Halberd'] }, proficiency: 4 });
                const allEquipment = [{ name: 'Halberd', properties: ['Heavy', 'Reach', 'Two-Handed'] }];

                const result = await handle(action, stats, CAMPAIGN_NAME, 'map', allEquipment);

                expect(result.type).toBe('attack_roll');
                expect(result.payload.attack.hitBonus).toBe(4);
                expect(result.payload.targetName).toBeNull();
            });

            it('should fall back to action name "Pole Strike" when action has no name', async () => {
                isPolearmWeapon.mockResolvedValue(true);
                findLastAttack.mockResolvedValue({ attackEvent: { bonus: 5 }, targetName: 'Goblin' });
                const action = makeAction({
                    automation: { trigger: 'after_attack_action_with_polearm' },
                    name: undefined,
                });
                const stats = makePlayerStats({ inventory: { equipped: ['Halberd'] } });
                const allEquipment = [{ name: 'Halberd', properties: ['Heavy', 'Reach', 'Two-Handed'] }];

                const result = await handle(action, stats, CAMPAIGN_NAME, 'map', allEquipment);

                expect(result.type).toBe('attack_roll');
                expect(result.payload.attack.name).toBe('Pole Strike');
                expect(result.payload.attack.autoDamageName).toBe('Pole Strike');
            });

            it('should prefer damage over extraDamageExpression', async () => {
                isPolearmWeapon.mockResolvedValue(true);
                findLastAttack.mockResolvedValue({ attackEvent: { bonus: 5 }, targetName: 'Goblin' });
                const action = makeAction({
                    automation: {
                        trigger: 'after_attack_action_with_polearm',
                        damage: '2d6',
                        extraDamageExpression: '1d4',
                    },
                    name: 'Pole Strike',
                });
                const stats = makePlayerStats({ inventory: { equipped: ['Halberd'] } });
                const allEquipment = [{ name: 'Halberd', properties: ['Heavy', 'Reach', 'Two-Handed'] }];

                const result = await handle(action, stats, CAMPAIGN_NAME, 'map', allEquipment);

                expect(result.payload.attack.autoDamageFormula).toBe('2d6');
            });
        });

        describe('weaponRequirement trigger', () => {
            it('should return attack_roll when weaponRequirement is set and polearm check passes', async () => {
                isPolearmWeapon.mockResolvedValue(true);
                findLastAttack.mockResolvedValue({ attackEvent: { bonus: 8 }, targetName: 'Dragon' });
                const action = makeAction({
                    automation: {
                        weaponRequirement: 'quarterstaff_spear_heavy_reach',
                        trigger: 'after_attack_action_with_polearm',
                        damage: '1d4',
                        damageType: 'Bludgeoning',
                    },
                    name: 'Pole Strike',
                });
                const stats = makePlayerStats({ inventory: { equipped: ['Pike'] }, proficiency: 3 });
                const allEquipment = [{ name: 'Pike', properties: ['Heavy', 'Reach', 'Two-Handed'] }];

                const result = await handle(action, stats, CAMPAIGN_NAME, 'map', allEquipment);

                expect(result.type).toBe('attack_roll');
                expect(result.payload.attack.hitBonus).toBe(8);
                expect(result.payload.attack.damageType).toBe('Bludgeoning');
            });
        });

        describe('combined trigger + uses tracking', () => {
            it('should validate polearm, decrement uses, then return attack_roll', async () => {
                isPolearmWeapon.mockResolvedValue(true);
                findLastAttack.mockResolvedValue({ attackEvent: { bonus: 5 }, targetName: 'Goblin' });
                getRuntimeValue.mockReturnValue(2);
                const action = makeAction({
                    automation: {
                        trigger: 'after_attack_action_with_polearm',
                        usesMax: 3,
                        damage: '1d4',
                        damageType: 'Bludgeoning',
                    },
                    name: 'War Priest Strike',
                });
                const stats = makePlayerStats({ inventory: { equipped: ['Quarterstaff'] } });
                const allEquipment = [{ name: 'Quarterstaff', properties: [] }];

                const result = await handle(action, stats, CAMPAIGN_NAME, 'map', allEquipment);

                expect(result.type).toBe('attack_roll');
                expect(result.payload.attack.name).toBe('War Priest Strike');
                expect(setRuntimeValue).toHaveBeenCalledWith(
                    'TestHero',
                    'warPriestUses',
                    1,
                    CAMPAIGN_NAME,
                );
            });

            it('should return popup when polearm valid but uses exhausted', async () => {
                isPolearmWeapon.mockResolvedValue(true);
                findLastAttack.mockResolvedValue({ attackEvent: { bonus: 5 }, targetName: 'Goblin' });
                getRuntimeValue.mockReturnValue(0);
                const action = makeAction({
                    automation: {
                        trigger: 'after_attack_action_with_polearm',
                        usesMax: 1,
                    },
                    name: 'War Priest Strike',
                });
                const stats = makePlayerStats({ inventory: { equipped: ['Quarterstaff'] } });

                const result = await handle(action, stats, CAMPAIGN_NAME, 'map', []);

                expect(result.type).toBe('popup');
                expect(result.payload.description).toBe(
                    'War Priest Strike has no uses remaining. Recharges on a Long Rest.',
                );
                expect(setRuntimeValue).not.toHaveBeenCalled();
            });
        });

        describe('disengage_end_grappled effect', () => {
            it('should remove grappled condition and show disengage message', async () => {
                getRuntimeValue.mockImplementation((name, key) => {
                    if (key === 'activeConditions') return ['grappled', 'fatigued'];
                    return null;
                });
                const action = makeAction({ automation: { effect: 'disengage_end_grappled' } });

                const result = await handle(action, makePlayerStats(), CAMPAIGN_NAME, 'map', []);

                expect(result.payload.description).toBe(
                    'You take the Disengage action and the Grappled condition ends on you.',
                );
                expect(setRuntimeValue).toHaveBeenCalledWith(
                    'TestHero',
                    'activeConditions',
                    ['fatigued'],
                    CAMPAIGN_NAME,
                );
            });

            it('should not modify conditions if player is not grappled', async () => {
                getRuntimeValue.mockImplementation((name, key) => {
                    if (key === 'activeConditions') return ['fatigued'];
                    return null;
                });
                const action = makeAction({ automation: { effect: 'disengage_end_grappled' } });

                const result = await handle(action, makePlayerStats(), CAMPAIGN_NAME, 'map', []);

                expect(result.payload.description).toBe(
                    'You take the Disengage action and the Grappled condition ends on you.',
                );
                expect(setRuntimeValue).not.toHaveBeenCalled();
            });

            it('should only remove grappled and preserve other conditions', async () => {
                getRuntimeValue.mockImplementation((name, key) => {
                    if (key === 'activeConditions') return ['grappled', 'restrained', 'grappled'];
                    return null;
                });
                const action = makeAction({ automation: { effect: 'disengage_end_grappled' } });

                await handle(action, makePlayerStats(), CAMPAIGN_NAME, 'map', []);

                expect(setRuntimeValue).toHaveBeenCalledWith(
                    'TestHero',
                    'activeConditions',
                    ['restrained'],
                    CAMPAIGN_NAME,
                );
            });

            it('should handle case-insensitive grappled matching', async () => {
                getRuntimeValue.mockImplementation((name, key) => {
                    if (key === 'activeConditions') return ['Grappled', 'FATIGUED'];
                    return null;
                });
                const action = makeAction({ automation: { effect: 'disengage_end_grappled' } });

                await handle(action, makePlayerStats(), CAMPAIGN_NAME, 'map', []);

                expect(setRuntimeValue).toHaveBeenCalledWith(
                    'TestHero',
                    'activeConditions',
                    ['FATIGUED'],
                    CAMPAIGN_NAME,
                );
            });
        });
    });
});
