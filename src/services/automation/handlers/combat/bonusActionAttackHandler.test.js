// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { handle } from './bonusActionAttackHandler.js';

// ── Mocks ──────────────────────────────────────────────────────

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(async () => {}),
}));

// ── Re-import after mocking ────────────────────────────────────

import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';

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
        ...overrides,
    };
}

// ── Tests ──────────────────────────────────────────────────────

describe('bonusActionAttackHandler', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('handle', () => {
        describe('basic case (no special triggers/effects)', () => {
            it('should return automation_info popup with action details', async () => {
                const action = makeAction();
                const result = await handle(action, makePlayerStats(), 'campaign', 'map', []);

                expect(result.type).toBe('popup');
                expect(result.payload.type).toBe('automation_info');
                expect(result.payload.name).toBe('Bonus Action Attack');
                expect(result.payload.description).toBe('Make a bonus action attack.');
                expect(result.payload.automation).toEqual(action.automation);
            });

            it('should use empty string for description when missing', async () => {
                const action = makeAction({ description: undefined });
                const result = await handle(action, makePlayerStats(), 'campaign', 'map', []);

                expect(result.payload.description).toBe('');
            });
        });

        describe('uses tracking', () => {
            it('should return uses remaining message when uses exhausted', async () => {
                const action = makeAction({ automation: { usesMax: 3 } });
                getRuntimeValue.mockReturnValue(0);

                const result = await handle(action, makePlayerStats(), 'campaign', 'map', []);

                expect(result.type).toBe('popup');
                expect(result.payload.description).toContain('no uses remaining');
                expect(result.payload.description).toContain('Long Rest');
                expect(setRuntimeValue).not.toHaveBeenCalled();
            });

            it('should return uses remaining message with custom recharge text', async () => {
                const action = makeAction({ automation: { usesMax: 1, recharge: 'Short Rest' } });
                getRuntimeValue.mockReturnValue(0);

                const result = await handle(action, makePlayerStats(), 'campaign', 'map', []);

                expect(result.payload.description).toContain('Short Rest');
                expect(setRuntimeValue).not.toHaveBeenCalled();
            });

            it('should decrement uses and return success popup', async () => {
                const action = makeAction({ automation: { usesMax: 3 } });
                getRuntimeValue.mockReturnValue(2);

                const result = await handle(action, makePlayerStats(), 'campaign', 'map', []);

                expect(result.type).toBe('popup');
                expect(setRuntimeValue).toHaveBeenCalledWith('TestHero', 'warPriestUses', 1, 'campaign');
            });

            it('should decrement to zero when last use consumed', async () => {
                const action = makeAction({ automation: { usesMax: 1 } });
                getRuntimeValue.mockReturnValue(1);

                await handle(action, makePlayerStats(), 'campaign', 'map', []);

                expect(setRuntimeValue).toHaveBeenCalledWith('TestHero', 'warPriestUses', 0, 'campaign');
            });

            it('should use custom resourceKey for tracking', async () => {
                const action = makeAction({ automation: { usesMax: 1, resourceKey: 'warPriestUses' } });
                getRuntimeValue.mockReturnValue(1);

                await handle(action, makePlayerStats(), 'campaign', 'map', []);

                expect(setRuntimeValue).toHaveBeenCalledWith('TestHero', 'warPriestUses', 0, 'campaign');
            });

            it('should skip use tracking when usesMax is 0', async () => {
                const action = makeAction({ automation: { usesMax: 0 } });
                getRuntimeValue.mockReturnValue(0);

                const result = await handle(action, makePlayerStats(), 'campaign', 'map', []);

                expect(result.type).toBe('popup');
                expect(setRuntimeValue).not.toHaveBeenCalled();
            });

            it('should skip use tracking when usesMax is undefined', async () => {
                const action = makeAction();

                const result = await handle(action, makePlayerStats(), 'campaign', 'map', []);

                expect(result.type).toBe('popup');
                expect(setRuntimeValue).not.toHaveBeenCalled();
            });
        });

        describe('polearm trigger', () => {
            it('should reject when no equipped weapons', async () => {
                const action = makeAction({ automation: { trigger: 'after_attack_action_with_polearm' } });
                const stats = makePlayerStats({ inventory: { equipped: [] } });

                const result = await handle(action, stats, 'campaign', 'map', []);

                expect(result.payload.description).toContain('requires you to be holding');
            });

            it('should accept Quarterstaff', async () => {
                const action = makeAction({ automation: { trigger: 'after_attack_action_with_polearm' } });
                const stats = makePlayerStats({ inventory: { equipped: ['Quarterstaff'] } });
                const allEquipment = [{ name: 'Quarterstaff', properties: [] }];

                const result = await handle(action, stats, 'campaign', 'map', allEquipment);

                expect(result.type).toBe('popup');
            });

            it('should accept Spear', async () => {
                const action = makeAction({ automation: { trigger: 'after_attack_action_with_polearm' } });
                const stats = makePlayerStats({ inventory: { equipped: ['Spear'] } });
                const allEquipment = [{ name: 'Spear', properties: [] }];

                const result = await handle(action, stats, 'campaign', 'map', allEquipment);

                expect(result.type).toBe('popup');
            });

            it('should accept weapon with Heavy + Reach properties', async () => {
                const action = makeAction({ automation: { trigger: 'after_attack_action_with_polearm' } });
                const stats = makePlayerStats({ inventory: { equipped: ['Maul'] } });
                const allEquipment = [{ name: 'Maul', properties: ['Heavy', 'Reach', 'Two-Handed'] }];

                const result = await handle(action, stats, 'campaign', 'map', allEquipment);

                expect(result.type).toBe('popup');
            });

            it('should reject weapon with only Heavy property', async () => {
                const action = makeAction({ automation: { trigger: 'after_attack_action_with_polearm' } });
                const stats = makePlayerStats({ inventory: { equipped: ['Warhammer'] } });
                const allEquipment = [{ name: 'Warhammer', properties: ['Heavy'] }];

                const result = await handle(action, stats, 'campaign', 'map', allEquipment);

                expect(result.payload.description).toContain('requires you to be holding');
            });

            it('should reject weapon with only Reach property', async () => {
                const action = makeAction({ automation: { trigger: 'after_attack_action_with_polearm' } });
                const stats = makePlayerStats({ inventory: { equipped: ['Glaive'] } });
                const allEquipment = [{ name: 'Glaive', properties: ['Reach', 'Two-Handed'] }];

                const result = await handle(action, stats, 'campaign', 'map', allEquipment);

                expect(result.payload.description).toContain('requires you to be holding');
            });

            it('should match equipped weapon names with + prefix (strips 3 chars)', async () => {
                const action = makeAction({ automation: { trigger: 'after_attack_action_with_polearm' } });
                const stats = makePlayerStats({ inventory: { equipped: ['+Quarterstaff'] } });
                const allEquipment = [{ name: 'Quarterstaff', properties: [] }];

                const result = await handle(action, stats, 'campaign', 'map', allEquipment);

                expect(result.type).toBe('popup');
            });

            it('should reject when equipped weapon not in allEquipment list', async () => {
                const action = makeAction({ automation: { trigger: 'after_attack_action_with_polearm' } });
                const stats = makePlayerStats({ inventory: { equipped: ['Longsword'] } });

                const result = await handle(action, stats, 'campaign', 'map', []);

                expect(result.payload.description).toContain('requires you to be holding');
            });

            it('should handle null/undefined equipped array gracefully', async () => {
                const action = makeAction({ automation: { trigger: 'after_attack_action_with_polearm' } });
                const stats = makePlayerStats({ inventory: { equipped: null } });

                const result = await handle(action, stats, 'campaign', 'map', []);

                expect(result.payload.description).toContain('requires you to be holding');
            });
        });

        describe('weaponRequirement trigger', () => {
            it('should accept Heavy + Reach weapon via weaponRequirement', async () => {
                const action = makeAction({ automation: { weaponRequirement: 'quarterstaff_spear_heavy_reach' } });
                const stats = makePlayerStats({ inventory: { equipped: ['Maul'] } });
                const allEquipment = [{ name: 'Maul', properties: ['Heavy', 'Reach', 'Two-Handed'] }];

                const result = await handle(action, stats, 'campaign', 'map', allEquipment);

                expect(result.type).toBe('popup');
            });

            it('should reject Heavy-only weapon via weaponRequirement', async () => {
                const action = makeAction({ automation: { weaponRequirement: 'quarterstaff_spear_heavy_reach' } });
                const stats = makePlayerStats({ inventory: { equipped: ['Warhammer'] } });
                const allEquipment = [{ name: 'Warhammer', properties: ['Heavy'] }];

                const result = await handle(action, stats, 'campaign', 'map', allEquipment);

                expect(result.payload.description).toContain('requires you to be holding');
            });

            it('should reject Reach-only weapon via weaponRequirement', async () => {
                const action = makeAction({ automation: { weaponRequirement: 'quarterstaff_spear_heavy_reach' } });
                const stats = makePlayerStats({ inventory: { equipped: ['Glaive'] } });
                const allEquipment = [{ name: 'Glaive', properties: ['Reach', 'Two-Handed'] }];

                const result = await handle(action, stats, 'campaign', 'map', allEquipment);

                expect(result.payload.description).toContain('requires you to be holding');
            });
        });

        describe('disengage_end_grappled effect', () => {
            it('should remove grappled condition and show disengage message', async () => {
                getRuntimeValue.mockImplementation((name, key) => {
                    if (key === 'activeConditions') return ['grappled', 'fatigued'];
                    return null;
                });
                const action = makeAction({ automation: { effect: 'disengage_end_grappled' } });

                const result = await handle(action, makePlayerStats(), 'campaign', 'map', []);

                expect(result.payload.description).toContain('Disengage action');
                expect(result.payload.description).toContain('Grappled condition ends');
                expect(setRuntimeValue).toHaveBeenCalledWith('TestHero', 'activeConditions', ['fatigued'], 'campaign');
            });

            it('should not modify conditions if player is not grappled', async () => {
                getRuntimeValue.mockImplementation((name, key) => {
                    if (key === 'activeConditions') return ['fatigued'];
                    return null;
                });
                const action = makeAction({ automation: { effect: 'disengage_end_grappled' } });

                const result = await handle(action, makePlayerStats(), 'campaign', 'map', []);

                expect(result.payload.description).toContain('Disengage action');
                expect(setRuntimeValue).not.toHaveBeenCalled();
            });

            it('should handle empty conditions array', async () => {
                getRuntimeValue.mockImplementation((name, key) => {
                    if (key === 'activeConditions') return [];
                    return null;
                });
                const action = makeAction({ automation: { effect: 'disengage_end_grappled' } });

                const result = await handle(action, makePlayerStats(), 'campaign', 'map', []);

                expect(result.payload.description).toContain('Disengage action');
                expect(setRuntimeValue).not.toHaveBeenCalled();
            });

            it('should handle non-array activeConditions by treating as empty', async () => {
                getRuntimeValue.mockImplementation((name, key) => {
                    if (key === 'activeConditions') return 'grappled';
                    return null;
                });
                const action = makeAction({ automation: { effect: 'disengage_end_grappled' } });

                const result = await handle(action, makePlayerStats(), 'campaign', 'map', []);

                expect(result.payload.description).toContain('Disengage action');
            });

            it('should preserve order of non-grappled conditions', async () => {
                getRuntimeValue.mockImplementation((name, key) => {
                    if (key === 'activeConditions') return ['exhausted', 'grappled', 'poisoned'];
                    return null;
                });
                const action = makeAction({ automation: { effect: 'disengage_end_grappled' } });

                await handle(action, makePlayerStats(), 'campaign', 'map', []);

                expect(setRuntimeValue).toHaveBeenCalledWith('TestHero', 'activeConditions', ['exhausted', 'poisoned'], 'campaign');
            });
        });
    });
});
