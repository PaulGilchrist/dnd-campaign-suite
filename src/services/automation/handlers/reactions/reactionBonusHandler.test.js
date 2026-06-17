import { describe, it, expect, vi, beforeEach } from 'vitest';

import { handle } from './reactionBonusHandler.js';

// ── Mocks ──────────────────────────────────────────────────────

vi.mock('../../common/targetResolver.js', () => ({
    resolveTarget: vi.fn(async () => ({ target: { name: 'Goblin' } })),
    resolveMapPositions: vi.fn(async () => ({
        attackerPos: { gridX: 1, gridY: 1 },
        targetPos: { gridX: 2, gridY: 2 },
    })),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn((playerName, key) => {
        if (key === 'defensiveDuelistActive' || key === 'unbreakableMajestyActive') return null;
        if (key === 'conditions') return [];
        if (key === 'speed') return 30;
        if (key === 'mountName' || key === 'mount') return 'Warhorse';
        if (key === 'bardicInspirationUses') return 2;
        if (key === 'usesRemaining') return 2;
        return null;
    }),
    setRuntimeValue: vi.fn(async () => {}),
}));

vi.mock('../../../rules/effects/expirations.js', () => ({
    addExpiration: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(async () => {}),
}));

vi.mock('../../../rules/combat/rangeValidation.js', () => ({
    getDistanceFeet: vi.fn(() => 10),
    rangeToFeet: vi.fn((r) => {
        const m = String(r).match(/^(\d+)_?ft$/i);
        return m ? parseInt(m[1], 10) : null;
    }),
}));

vi.mock('../../../dice/diceRoller.js', () => ({
    rollExpression: vi.fn(() => ({ total: 3, rolls: [3] })),
}));

vi.mock('../../../../hooks/combat/useMetamagic.js', () => ({
    spendSorceryPoints: vi.fn(),
    getCurrentSorceryPoints: vi.fn(() => 3),
    getLastAttackRoll: vi.fn(() => null),
    getLastAbilityCheck: vi.fn(() => null),
    getLastSaveRoll: vi.fn(() => null),
}));

vi.mock('../../../../services/character/classFeatures.js', () => ({
    getClassFeatures: vi.fn(() => null),
}));

// ── Re-import after mocking ────────────────────────────────────

import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addExpiration } from '../../../rules/effects/expirations.js';

// ── Helpers ────────────────────────────────────────────────────

function makeAction(overrides = {}) {
    return {
        name: 'Test Reaction',
        description: 'A reaction bonus.',
        automation: {
            type: 'reaction_bonus',
            ...overrides.automation,
        },
        ...overrides,
    };
}

function makePlayerStats(overrides = {}) {
    return {
        name: 'TestHero',
        proficiency: 3,
        abilities: [
            { name: 'Charisma', bonus: 2 },
        ],
        conditions: [],
        speed: 30,
        ...overrides,
    };
}

// ── Tests ──────────────────────────────────────────────────────

describe('reactionBonusHandler', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('handle routing', () => {
        it('should route miss_on_failed_save to handleUnbreakableMajesty', async () => {
            const action = makeAction({
                automation: { effect: 'miss_on_failed_save', duration: '1_minute' },
            });
            const result = await handle(action, makePlayerStats(), 'campaign', 'map');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('activated');
        });

        it('should route bonus_or_penalty_choice to handleBendFate', async () => {
            const action = makeAction({
                automation: { effect: 'bonus_or_penalty_choice' },
            });
            const result = await handle(action, makePlayerStats(), 'campaign', 'map');

            expect(result.type).toBe('popup');
        });

        it('should route ac_bonus to handleAcBonus', async () => {
            const action = makeAction({
                automation: { effect: 'ac_bonus' },
            });
            const result = await handle(action, makePlayerStats(), 'campaign', 'map');

            expect(result.type).toBe('popup');
        });

        it('should route redirect_attack_to_self to handleVeer', async () => {
            const action = makeAction({
                automation: { effect: 'redirect_attack_to_self' },
            });
            const result = await handle(action, makePlayerStats(), 'campaign', 'map');

            expect(result.type).toBe('popup');
        });

        it('should default to handleInspiringMovement', async () => {
            const action = makeAction({
                automation: { effect: 'inspiring_movement' },
            });
            const result = await handle(action, makePlayerStats(), 'campaign', 'map');

            expect(result.type).toBe('popup');
        });
    });

    describe('handleUnbreakableMajesty', () => {
        it('should activate and return popup', async () => {
            const action = makeAction({
                automation: { effect: 'miss_on_failed_save', duration: '1_minute' },
            });
            const result = await handle(action, makePlayerStats(), 'campaign', 'map');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('activated');
            expect(result.payload.description).toContain('CHA save');
        });

        it('should toggle off when already active', async () => {
            getRuntimeValue.mockImplementation((playerName, key) => {
                if (key === 'unbreakableMajestyActive') return true;
                if (key === 'conditions') return [];
                return null;
            });
            const action = makeAction({
                automation: { effect: 'miss_on_failed_save', duration: '1_minute' },
            });
            const result = await handle(action, makePlayerStats(), 'campaign', 'map');

            expect(result.payload.description).toContain('ended');
        });
    });

    describe('handleBendFate', () => {
        it('should reject when no sorcery points', async () => {
            vi.mocked(await import('../../../../hooks/combat/useMetamagic.js')).getCurrentSorceryPoints.mockReturnValue(0);
            const action = makeAction({
                automation: { effect: 'bonus_or_penalty_choice' },
            });
            const result = await handle(action, makePlayerStats(), 'campaign', 'map');

            expect(result.payload.description).toContain('No Sorcery Points available');
        });

        it('should reject when target is self', async () => {
            vi.mocked(await import('../../common/targetResolver.js')).resolveTarget.mockResolvedValue({ target: { name: 'TestHero' } });
            vi.mocked(await import('../../../../hooks/combat/useMetamagic.js')).getCurrentSorceryPoints.mockReturnValue(1);
            const action = makeAction({
                automation: { effect: 'bonus_or_penalty_choice' },
            });
            const result = await handle(action, makePlayerStats(), 'campaign', 'map');

            expect(result.payload.description).toContain('not yourself');
        });
    });

    describe('handleAcBonus', () => {
        it('should activate defensive duelist', async () => {
            const action = makeAction({
                automation: { effect: 'ac_bonus' },
            });
            const result = await handle(action, makePlayerStats(), 'campaign', 'map');

            expect(result.payload.description).toContain('activated');
            expect(result.payload.description).toContain('Proficiency Bonus');
        });

        it('should toggle off when already active', async () => {
            getRuntimeValue.mockImplementation((playerName, key) => {
                if (key === 'defensiveDuelistActive') return true;
                if (key === 'conditions') return [];
                return null;
            });
            const action = makeAction({
                automation: { effect: 'ac_bonus' },
            });
            const result = await handle(action, makePlayerStats(), 'campaign', 'map');

            expect(result.payload.description).toContain('ended');
        });


    });

    describe('handleLeapAside', () => {
        it('should reject when no mount', async () => {
            getRuntimeValue.mockImplementation((playerName, key) => {
                if (key === 'mountName' || key === 'mount') return null;
                if (key === 'conditions') return [];
                return null;
            });
            const action = makeAction({
                automation: { effect: 'zero_on_success_half_on_fail_for_mount' },
            });
            const result = await handle(action, makePlayerStats(), 'campaign', 'map');

            expect(result.payload.description).toContain('requires you to be mounted');
        });

        it('should reject when player is incapacitated', async () => {
            getRuntimeValue.mockImplementation((playerName, key) => {
                if (key === 'mountName' || key === 'mount') return 'Warhorse';
                if (key === 'conditions') return [{ key: 'incapacitated' }];
                return null;
            });
            const stats = makePlayerStats({
                conditions: [{ key: 'incapacitated' }],
            });
            const action = makeAction({
                automation: { effect: 'zero_on_success_half_on_fail_for_mount' },
            });
            const result = await handle(action, stats, 'campaign', 'map');

            expect(result.payload.description).toContain('not be Incapacitated');
        });

        it('should reject when mount is incapacitated', async () => {
            getRuntimeValue.mockImplementation((playerName, key) => {
                if (key === 'mountName' || key === 'mount') return 'Warhorse';
                if (key === 'conditions') return [{ key: 'incapacitated' }];
                return null;
            });
            const action = makeAction({
                automation: { effect: 'zero_on_success_half_on_fail_for_mount' },
            });
            const result = await handle(action, makePlayerStats(), 'campaign', 'map');

            expect(result.payload.description).toContain('mount to not be Incapacitated');
        });

    });

    describe('handleVeer', () => {
        it('should reject when no mount', async () => {
            getRuntimeValue.mockImplementation((playerName, key) => {
                if (key === 'mountName' || key === 'mount') return null;
                if (key === 'conditions') return [];
                return null;
            });
            const action = makeAction({
                automation: { effect: 'redirect_attack_to_self' },
            });
            const result = await handle(action, makePlayerStats(), 'campaign', 'map');

            expect(result.payload.description).toContain('requires you to be mounted');
        });

        it('should reject when player is incapacitated', async () => {
            getRuntimeValue.mockImplementation((playerName, key) => {
                if (key === 'mountName' || key === 'mount') return 'Warhorse';
                if (key === 'conditions') return ['incapacitated'];
                return null;
            });
            const stats = makePlayerStats({
                conditions: ['incapacitated'],
            });
            const action = makeAction({
                automation: { effect: 'redirect_attack_to_self' },
            });
            const result = await handle(action, stats, 'campaign', 'map');

            expect(result.payload.description).toContain('not be Incapacitated');
        });

        it('should activate successfully', async () => {
            const action = makeAction({
                automation: { effect: 'redirect_attack_to_self' },
            });
            const result = await handle(action, makePlayerStats(), 'campaign', 'map');

            expect(result.payload.description).toContain('activated');
        });
    });

    describe('handleInspiringMovement', () => {
        it('should return popup with movement description', async () => {
            const action = makeAction({
                automation: { effect: 'inspiring_movement', allyRange: '30_ft' },
            });
            const result = await handle(action, makePlayerStats(), 'campaign', 'map');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('move up to 15 ft');
        });

        it('should reject when no uses remaining', async () => {
            getRuntimeValue.mockImplementation((playerName, key) => {
                if (key === 'bardicInspirationUses' || key === 'usesRemaining') return 0;
                if (key === 'conditions') return [];
                return null;
            });
            const action = makeAction({
                automation: { effect: 'inspiring_movement', usesMax: 3 },
            });
            const result = await handle(action, makePlayerStats(), 'campaign', 'map');

            expect(result.payload.description).toContain('no uses remaining');
        });

        it('should consume a use', async () => {
            getRuntimeValue.mockImplementation((playerName, key) => {
                if (key === 'bardicInspirationUses') return 1;
                if (key === 'conditions') return [];
                return null;
            });
            const action = makeAction({
                automation: { effect: 'inspiring_movement', usesMax: 3 },
            });
            await handle(action, makePlayerStats(), 'campaign', 'map');

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestHero',
                'bardicInspirationUses',
                0,
                'campaign'
            );
        });

        it('should use custom resource key', async () => {
            getRuntimeValue.mockImplementation((playerName, key) => {
                if (key === 'customUses') return 2;
                if (key === 'conditions') return [];
                return null;
            });
            const action = makeAction({
                automation: { effect: 'inspiring_movement', usesMax: 3, resourceKey: 'customUses' },
            });
            await handle(action, makePlayerStats(), 'campaign', 'map');

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestHero',
                'customUses',
                1,
                'campaign'
            );
        });

        it('should handle noOAs flag', async () => {
            getRuntimeValue.mockImplementation((playerName, key) => {
                if (key === 'bardicInspirationUses' || key === 'usesRemaining') return 2;
                if (key === 'conditions') return [];
                return null;
            });
            const action = makeAction({
                automation: { effect: 'inspiring_movement', noOAs: true, usesMax: 3 },
            });
            const result = await handle(action, makePlayerStats(), 'campaign', 'map');

            expect(result.payload.description).toContain('does not provoke Opportunity Attacks');
            expect(addExpiration).toHaveBeenCalled();
        });

        it('should use uses_expression when provided', async () => {
            getRuntimeValue.mockImplementation((playerName, key) => {
                if (key === 'bardicInspirationUses' || key === 'usesRemaining') return 2;
                if (key === 'conditions') return [];
                return null;
            });
            const action = makeAction({
                automation: { effect: 'inspiring_movement', uses_expression: 'proficiency_bonus + level', usesMax: 0 },
            });
            const stats = makePlayerStats({ level: 3 });
            const result = await handle(action, stats, 'campaign', 'map');

            expect(result.type).toBe('popup');
        });

        it('should find ally within range on map', async () => {
            vi.mocked(await import('../../common/targetResolver.js')).resolveMapPositions.mockResolvedValue({
                attackerPos: { gridX: 1, gridY: 1 },
                targetPos: { gridX: 2, gridY: 2 },
            });
            vi.mocked(await import('../../common/targetResolver.js')).resolveTarget.mockResolvedValue({
                target: { name: 'Ally' },
            });
            vi.mocked(await import('../../../rules/combat/rangeValidation.js')).getDistanceFeet.mockReturnValue(10);

            const action = makeAction({
                automation: { effect: 'inspiring_movement', allyRange: '30_ft', usesMax: 3 },
            });
            const result = await handle(action, makePlayerStats(), 'campaign', 'map');

            expect(result.payload.description).toContain('Ally');
        });
    });
});
