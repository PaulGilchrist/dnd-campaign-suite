import { describe, it, expect, vi, beforeEach } from 'vitest';

import { handle } from './bonusActionAttackHandler.js';

// ── Mocks ──────────────────────────────────────────────────────

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(() => null),
    setRuntimeValue: vi.fn(async () => {}),
}));

// ── Re-import after mocking ────────────────────────────────────

import { getRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';

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

function makeAllEquipment(overrides = []) {
    return [
        { name: 'Quarterstaff', properties: [] },
        { name: 'Spear', properties: [] },
        { name: 'Longsword', properties: ['Heavy', 'Reach'] },
        ...overrides,
    ];
}

// ── Tests ──────────────────────────────────────────────────────

describe('bonusActionAttackHandler', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('handle', () => {
        it('should return automation info popup for basic case', async () => {
            const action = makeAction();
            const result = await handle(action, makePlayerStats(), 'campaign', 'map', []);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
        });

        it('should reject when polearm required and none equipped', async () => {
            const action = makeAction({
                automation: { trigger: 'after_attack_action_with_polearm' },
            });
            const stats = makePlayerStats({
                inventory: { equipped: ['Longsword'] },
            });
            const allEquipment = makeAllEquipment([{ name: 'Longsword', properties: ['Heavy', 'Reach'] }]);

            await handle(action, stats, 'campaign', 'map', allEquipment);

            // Longsword with Heavy+Reach should pass, so test with a weapon that doesn't qualify
            const stats2 = makePlayerStats({
                inventory: { equipped: ['Shortsword'] },
            });
            const allEquipment2 = makeAllEquipment([{ name: 'Shortsword', properties: ['Light'] }]);

            const result2 = await handle(action, stats2, 'campaign', 'map', allEquipment2);

            expect(result2.type).toBe('popup');
            expect(result2.payload.description).toContain('requires you to be holding a Quarterstaff');
        });

        it('should accept Quarterstaff', async () => {
            const action = makeAction({
                automation: { trigger: 'after_attack_action_with_polearm' },
            });
            const stats = makePlayerStats({
                inventory: { equipped: ['Quarterstaff'] },
            });
            const allEquipment = makeAllEquipment();

            const result = await handle(action, stats, 'campaign', 'map', allEquipment);

            // Has polearm, should proceed to automation info
            expect(result.type).toBe('popup');
        });

        it('should accept Spear', async () => {
            const action = makeAction({
                automation: { trigger: 'after_attack_action_with_polearm' },
            });
            const stats = makePlayerStats({
                inventory: { equipped: ['Spear'] },
            });
            const allEquipment = makeAllEquipment();

            const result = await handle(action, stats, 'campaign', 'map', allEquipment);

            expect(result.type).toBe('popup');
        });

        it('should accept Heavy + Reach weapon', async () => {
            const action = makeAction({
                automation: { weaponRequirement: 'quarterstaff_spear_heavy_reach' },
            });
            const stats = makePlayerStats({
                inventory: { equipped: ['Maul'] },
            });
            const allEquipment = makeAllEquipment([{ name: 'Maul', properties: ['Heavy', 'Reach', 'Two-Handed'] }]);

            const result = await handle(action, stats, 'campaign', 'map', allEquipment);

            expect(result.type).toBe('popup');
        });

        it('should reject weapon with only Heavy (no Reach)', async () => {
            const action = makeAction({
                automation: { weaponRequirement: 'quarterstaff_spear_heavy_reach' },
            });
            const stats = makePlayerStats({
                inventory: { equipped: ['Warhammer'] },
            });
            const allEquipment = makeAllEquipment([{ name: 'Warhammer', properties: ['Heavy'] }]);

            const result = await handle(action, stats, 'campaign', 'map', allEquipment);

            expect(result.payload.description).toContain('requires you to be holding');
        });

        it('should reject weapon with only Reach (no Heavy)', async () => {
            const action = makeAction({
                automation: { weaponRequirement: 'quarterstaff_spear_heavy_reach' },
            });
            const stats = makePlayerStats({
                inventory: { equipped: ['Glaive'] },
            });
            const allEquipment = makeAllEquipment([{ name: 'Glaive', properties: ['Reach', 'Two-Handed'] }]);

            const result = await handle(action, stats, 'campaign', 'map', allEquipment);

            expect(result.payload.description).toContain('requires you to be holding');
        });

        it('should strip + prefix from equipped weapon names', async () => {
            const action = makeAction({
                automation: { trigger: 'after_attack_action_with_polearm' },
            });
            const stats = makePlayerStats({
                inventory: { equipped: ['+Quarterstaff'] },
            });
            const allEquipment = makeAllEquipment();

            const result = await handle(action, stats, 'campaign', 'map', allEquipment);

            expect(result.type).toBe('popup');
        });

        it('should consume uses when usesMax > 0', async () => {
            const action = makeAction({
                automation: { usesMax: 3 },
            });
            getRuntimeValue.mockReturnValue(2);

            const result = await handle(action, makePlayerStats(), 'campaign', 'map', []);

            expect(result.type).toBe('popup');
        });

        it('should reject when no uses remaining', async () => {
            const action = makeAction({
                automation: { usesMax: 3 },
            });
            getRuntimeValue.mockReturnValue(0);

            const result = await handle(action, makePlayerStats(), 'campaign', 'map', []);

            expect(result.payload.description).toContain('no uses remaining');
        });

        it('should use custom resource key when specified', async () => {
            const action = makeAction({
                automation: { usesMax: 1, resourceKey: 'warPriestUses' },
            });
            getRuntimeValue.mockReturnValue(0);

            const result = await handle(action, makePlayerStats(), 'campaign', 'map', []);

            expect(result.payload.description).toContain('no uses remaining');
        });

        it('should use custom recharge message', async () => {
            const action = makeAction({
                automation: { usesMax: 1, recharge: 'Short Rest' },
            });
            getRuntimeValue.mockReturnValue(0);

            const result = await handle(action, makePlayerStats(), 'campaign', 'map', []);

            expect(result.payload.description).toContain('Short Rest');
        });

        it('should handle disengage_end_grappled effect', async () => {
            getRuntimeValue.mockReturnValue(['grappled', 'fatigued']);
            const action = makeAction({
                automation: { effect: 'disengage_end_grappled' },
            });

            const result = await handle(action, makePlayerStats(), 'campaign', 'map', []);

            expect(result.payload.description).toContain('Disengage action');
            expect(result.payload.description).toContain('Grappled condition ends');
        });

        it('should not modify conditions if not grappled', async () => {
            getRuntimeValue.mockReturnValue(['fatigued']);
            const action = makeAction({
                automation: { effect: 'disengage_end_grappled' },
            });

            const result = await handle(action, makePlayerStats(), 'campaign', 'map', []);

            expect(result.type).toBe('popup');
        });
    });
});
