import { describe, it, expect, vi, beforeEach } from 'vitest';

import { handle, applyMasteryEffect, MASTERY_EFFECTS } from './weaponMasteryHandler.js';

// ── Mocks ──────────────────────────────────────────────────────

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(() => null),
    setRuntimeValue: vi.fn(async () => {}),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(async () => {}),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(async () => null),
    getTargetFromAttacker: vi.fn(() => null),
}));

vi.mock('../../../../../services/encounters/combatData.js', () => ({
    getCurrentCombatRound: vi.fn(() => 1),
}));

vi.mock('../../../automation/common/savePrompt.js', () => ({
    createSaveListener: vi.fn(() => ({ promptId: 'test-prompt-id' })),
}));

// ── Re-import after mocking ────────────────────────────────────

import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';

// ── Helpers ────────────────────────────────────────────────────

function makeAction(overrides = {}) {
    return {
        name: 'Weapon Mastery',
        description: 'Apply a weapon mastery effect.',
        automation: {
            type: 'mastery_rider',
            masteries: ['Vex', 'Push', 'Topple', 'Sap', 'Slow', 'Cleave', 'Nick', 'Graze'],
            ...overrides.automation,
        },
        ...overrides,
    };
}

function makePlayerStats(overrides = {}) {
    return {
        name: 'TestHero',
        proficiency: 3,
        size: 'Medium',
        abilities: [
            { name: 'Constitution', bonus: 2 },
            { name: 'Strength', bonus: 3 },
        ],
        ...overrides,
    };
}

// ── Tests ──────────────────────────────────────────────────────

describe('weaponMasteryHandler', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('MASTERY_EFFECTS', () => {
        it('should define all 8 mastery effects', () => {
            expect(Object.keys(MASTERY_EFFECTS)).toEqual(['Push', 'Topple', 'Sap', 'Slow', 'Vex', 'Cleave', 'Nick', 'Graze']);
        });

        it('should include labels and descriptions', () => {
            Object.values(MASTERY_EFFECTS).forEach((mastery) => {
                expect(mastery.label).toBeDefined();
                expect(mastery.description).toBeDefined();
                expect(mastery.effect).toBeDefined();
            });
        });
    });

    describe('handle', () => {
        it('should return modal with available masteries', async () => {
            const action = makeAction();
            const result = await handle(action, makePlayerStats(), 'campaign', 'map');

            expect(result.type).toBe('modal');
            expect(result.modalName).toBe('weaponMastery');
            expect(result.payload.availableMasteries).toEqual(['Vex', 'Push', 'Topple', 'Sap', 'Slow', 'Cleave', 'Nick', 'Graze']);
        });



        it('should include target name in payload when target exists', async () => {
            vi.mocked(await import('../../../rules/combat/damageUtils.js')).getCombatContext.mockResolvedValue({
                creatures: [{ name: 'Goblin' }],
            });
            vi.mocked(await import('../../../rules/combat/damageUtils.js')).getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });

            const action = makeAction();
            const result = await handle(action, makePlayerStats(), 'campaign', 'map');

            expect(result.payload.targetName).toBe('Goblin');
        });
    });

    describe('applyMasteryEffect', () => {
        it('should return null for unknown mastery', async () => {
            const result = await applyMasteryEffect('Unknown', makePlayerStats(), 'campaign', 'Goblin');
            expect(result).toBe(null);
        });

        it('should apply Push effect', async () => {
            getRuntimeValue.mockReturnValue([]);
            const result = await applyMasteryEffect('Push', makePlayerStats(), 'campaign', 'Goblin');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Push applied');
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'campaign',
                'targetEffects',
                expect.any(Array),
                'campaign'
            );
        });

        it('should reject Push for target too large', async () => {
            getRuntimeValue.mockReturnValue([]);
            vi.mocked(await import('../../../rules/combat/damageUtils.js')).getCombatContext.mockResolvedValue({
                creatures: [{ name: 'Goblin', size: 'Gargantuan' }],
            });

            const result = await applyMasteryEffect('Push', makePlayerStats(), 'campaign', 'Goblin');

            expect(result.payload.description).toContain('too large');
        });

        it('should apply Topple effect with save', async () => {
            getRuntimeValue.mockReturnValue([]);
            vi.mocked(await import('../../../automation/common/savePrompt.js')).createSaveListener.mockReturnValue({ promptId: 'test-id' });

            const result = await applyMasteryEffect('Topple', makePlayerStats(), 'campaign', 'Goblin');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Topple');
        });

        it('should apply Sap effect', async () => {
            getRuntimeValue.mockReturnValue([]);
            const result = await applyMasteryEffect('Sap', makePlayerStats(), 'campaign', 'Goblin');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Sap');
        });

        it('should apply Slow effect', async () => {
            getRuntimeValue.mockReturnValue([]);
            const result = await applyMasteryEffect('Slow', makePlayerStats(), 'campaign', 'Goblin');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Slow');
        });

        it('should reject Slow if target already has Slow', async () => {
            getRuntimeValue.mockReturnValue([
                { target: 'Goblin', effect: 'speed_reduction', source: 'Slow' },
            ]);

            const result = await applyMasteryEffect('Slow', makePlayerStats(), 'campaign', 'Goblin');

            expect(result.payload.description).toContain('already has Speed reduction from Slow');
        });

        it('should apply Vex effect targeting the player', async () => {
            getRuntimeValue.mockReturnValue([]);
            const result = await applyMasteryEffect('Vex', makePlayerStats(), 'campaign', 'Goblin');

            expect(result.type).toBe('popup');
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'campaign',
                'targetEffects',
                expect.any(Array),
                'campaign'
            );
        });

        it('should apply Cleave effect', async () => {
            getRuntimeValue.mockReturnValue([]);
            const result = await applyMasteryEffect('Cleave', makePlayerStats(), 'campaign', 'Goblin');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Cleave');
        });

        it('should reject Cleave if already used this turn', async () => {
            getRuntimeValue.mockReturnValue(1);
            const result = await applyMasteryEffect('Cleave', makePlayerStats(), 'campaign', 'Goblin');

            expect(result.payload.description).toContain('once per turn');
        });

        it('should apply Nick effect', async () => {
            getRuntimeValue.mockReturnValue([]);
            const result = await applyMasteryEffect('Nick', makePlayerStats(), 'campaign', 'Goblin');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Nick');
        });

        it('should reject Nick if already used this turn', async () => {
            getRuntimeValue.mockReturnValue(1);
            const result = await applyMasteryEffect('Nick', makePlayerStats(), 'campaign', 'Goblin');

            expect(result.payload.description).toContain('once per turn');
        });

        it('should apply Graze effect', async () => {
            getRuntimeValue.mockReturnValue([]);
            const result = await applyMasteryEffect('Graze', makePlayerStats(), 'campaign', 'Goblin');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Graze');
        });

        it('should store abilityName and abilityMod for Graze effect', async () => {
            getRuntimeValue.mockReturnValue([]);
            const ps = makePlayerStats();
            await applyMasteryEffect('Graze', ps, 'campaign', 'Goblin');

            expect(setRuntimeValue).toHaveBeenCalled();
            const callArgs = setRuntimeValue.mock.calls[0];
            if (callArgs[1] === 'targetEffects') {
                const grazeEffect = callArgs[2].find(e => e.effect === 'graze');
                expect(grazeEffect).toBeDefined();
                expect(grazeEffect.abilityName).toBe('Strength');
                expect(grazeEffect.abilityMod).toBe(3);
                expect(grazeEffect.duration).toBe('until_end_of_turn');
            }
        });

        it('should create save listener for Topple', async () => {
            getRuntimeValue.mockReturnValue([]);
            vi.mocked(await import('../../../automation/common/savePrompt.js')).createSaveListener.mockReturnValue({ promptId: 'test-id' });

            await applyMasteryEffect('Topple', makePlayerStats(), 'campaign', 'Goblin');

            expect(vi.mocked(await import('../../../automation/common/savePrompt.js')).createSaveListener).toHaveBeenCalled();
        });
    });
});
