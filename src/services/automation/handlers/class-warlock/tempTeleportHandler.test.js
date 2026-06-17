import { describe, it, expect, vi, beforeEach } from 'vitest';

import { handle, confirmTeleport, clearExtendedFlag, isExtendedAvailable } from './tempTeleportHandler.js';

// ── Mocks ──────────────────────────────────────────────────────

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(() => null),
    setRuntimeValue: vi.fn(async () => {}),
}));

vi.mock('../../../combat/automation/automationService.js', () => ({
    evaluateAutoExpression: vi.fn(() => 3),
}));

vi.mock('../../common/savePrompt.js', () => ({
    buildSaveDc: vi.fn(() => 13),
    createSaveListener: vi.fn(() => ({ promptId: 'test-id' })),
}));

vi.mock('../../common/targetResolver.js', () => ({
    resolveTarget: vi.fn(async () => ({ target: { name: 'Goblin' } })),
}));

// ── Re-import after mocking ────────────────────────────────────

import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';

// ── Helpers ────────────────────────────────────────────────────

function makeAction(overrides = {}) {
    return {
        name: 'Shadow of Moil',
        description: 'Teleport ability.',
        automation: {
            type: 'teleport',
            distance: '60 ft',
            effect: 'teleport',
            ...overrides.automation,
        },
        ...overrides,
    };
}

function makePlayerStats(overrides = {}) {
    return {
        name: 'TestHero',
        proficiency: 3,
        abilities: [{ name: 'Wisdom', bonus: 2 }],
        automation: { passives: [] },
        ...overrides,
    };
}

// ── Tests ──────────────────────────────────────────────────────

describe('tempTeleportHandler', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('handle', () => {
        it('should return modal for basic teleport', async () => {
            const action = makeAction();
            const result = await handle(action, makePlayerStats(), 'campaign', 'map');

            expect(result.type).toBe('modal');
            expect(result.modalName).toBe('teleport');
        });

        it('should check uses for moonlight_step_teleport', async () => {
            getRuntimeValue.mockReturnValue(1);
            const action = makeAction({
                automation: { effect: 'moonlight_step_teleport' },
            });
            const result = await handle(action, makePlayerStats(), 'campaign', 'map');

            expect(result.type).toBe('modal');
        });

        it('should return info popup when no uses remaining for moonlight step', async () => {
            getRuntimeValue.mockReturnValue(0);
            const action = makeAction({
                automation: { effect: 'moonlight_step_teleport' },
            });
            const result = await handle(action, makePlayerStats(), 'campaign', 'map');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('no uses remaining');
        });
    });

    describe('confirmTeleport', () => {
        it('should return description for basic teleport', async () => {
            const action = makeAction();
            const result = await confirmTeleport(action, makePlayerStats(), 'campaign', false);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Teleported 60 ft');
        });

        it('should use extended distance when useExtended is true', async () => {
            const action = makeAction({
                automation: { extendedDistance: '150 ft' },
            });
            const result = await confirmTeleport(action, makePlayerStats(), 'campaign', true);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('150 ft');
            expect(setRuntimeValue).toHaveBeenCalledWith('TestHero', '_teleportExtendedUsed', true, 'campaign');
        });

        it('should describe swap with illusion', async () => {
            const action = makeAction({
                automation: { effect: 'teleport_swap_with_illusion' },
            });
            const result = await confirmTeleport(action, makePlayerStats(), 'campaign', false);

            expect(result.payload.description).toContain('Swapped places with your illusion');
        });

        it('should add next_attack_advantage effect for shadow_step_teleport', async () => {
            getRuntimeValue.mockImplementation((_name, key, _campaign) => {
                if (key === 'targetEffects') return [];
                return null;
            });
            const action = makeAction({
                automation: { effect: 'shadow_step_teleport' },
            });
            const result = await confirmTeleport(action, makePlayerStats(), 'campaign', false);

            expect(result.type).toBe('popup');
            expect(setRuntimeValue).toHaveBeenCalledWith('campaign', 'targetEffects', expect.any(Array), 'campaign');
        });

        it('should add next_attack_advantage effect for moonlight_step_teleport', async () => {
            getRuntimeValue.mockImplementation((_name, key, _campaign) => {
                if (key === 'targetEffects') return [];
                return null;
            });
            const action = makeAction({
                automation: { effect: 'moonlight_step_teleport' },
            });
            const result = await confirmTeleport(action, makePlayerStats(), 'campaign', false);

            expect(result.type).toBe('popup');
            expect(setRuntimeValue).toHaveBeenCalledWith('campaign', 'targetEffects', expect.any(Array), 'campaign');
        });

        it('should bring allies when useExtended with allyCount', async () => {
            getRuntimeValue.mockImplementation((key1, key2) => {
                if (key2 === 'targetEffects') return [];
                return null;
            });
            const action = makeAction({
                automation: { extendedDistance: '150 ft', bringAllies: true, allyCount: 3, teleportRange: '10 ft' },
            });
            const result = await confirmTeleport(action, makePlayerStats(), 'campaign', true);

            expect(result.payload.description).toContain('150 ft');
            expect(result.payload.description).toContain('3 willing creatures');
        });

        it('should add Shared Moonlight effect when Lunar Form passive exists', async () => {
            getRuntimeValue.mockImplementation((key1, key2) => {
                if (key2 === 'targetEffects') return [];
                return null;
            });
            const stats = makePlayerStats({
                automation: { passives: [{ name: 'Lunar Form' }] },
            });
            const action = makeAction({
                automation: { effect: 'moonlight_step_teleport' },
            });
            const result = await confirmTeleport(action, stats, 'campaign', false);

            expect(result.payload.description).toContain('Shared Moonlight');
        });

        it('should add Improved Shadow Step effects when passive exists', async () => {
            getRuntimeValue.mockImplementation((key1, key2) => {
                if (key2 === 'targetEffects') return [];
                return null;
            });
            const stats = makePlayerStats({
                automation: { passives: [{ name: 'Improved Shadow Step' }] },
            });
            const action = makeAction({
                automation: { effect: 'shadow_step_teleport' },
            });
            const result = await confirmTeleport(action, stats, 'campaign', false);

            expect(result.payload.description).toContain('Improved Shadow Step');
            expect(result.payload.description).toContain('disadvantage');
        });

        it('should not decrement uses when moonlight step at zero', async () => {
            getRuntimeValue.mockImplementation((key1, key2) => {
                if (key2 === 'targetEffects') return [];
                if (key2 === 'moonlightStepUses') return 0;
                return null;
            });
            const action = makeAction({
                automation: { effect: 'moonlight_step_teleport' },
            });
            await confirmTeleport(action, makePlayerStats(), 'campaign', false);

            expect(setRuntimeValue).not.toHaveBeenCalledWith('TestHero', 'moonlightStepUses', -1, 'campaign');
        });

        it('should use default distance when automation distance is missing', async () => {
            const action = makeAction({
                automation: { effect: 'teleport' },
            });
            const result = await confirmTeleport(action, makePlayerStats(), 'campaign', false);

            expect(result.payload.description).toContain('60 ft');
        });

        it('should use default ally teleport range when missing', async () => {
            getRuntimeValue.mockImplementation((key1, key2) => {
                if (key2 === 'targetEffects') return [];
                return null;
            });
            const action = makeAction({
                automation: { extendedDistance: '150 ft', bringAllies: true, allyCount: 2 },
            });
            const result = await confirmTeleport(action, makePlayerStats(), 'campaign', true);

            expect(result.payload.description).toContain('10 ft');
        });

        it('should decrement moonlight step uses', async () => {
            getRuntimeValue.mockImplementation((key1, key2) => {
                if (key2 === 'targetEffects') return [];
                if (key2 === 'moonlightStepUses') return 3;
                return null;
            });
            const action = makeAction({
                automation: { effect: 'moonlight_step_teleport' },
            });
            await confirmTeleport(action, makePlayerStats(), 'campaign', false);

            expect(setRuntimeValue).toHaveBeenCalledWith('TestHero', 'moonlightStepUses', 2, 'campaign');
        });

        it('should not decrement uses when already at zero', async () => {
            getRuntimeValue.mockReturnValue(0);
            const action = makeAction({
                automation: { effect: 'moonlight_step_teleport' },
            });
            await confirmTeleport(action, makePlayerStats(), 'campaign', false);

            expect(setRuntimeValue).not.toHaveBeenCalledWith('TestHero', 'moonlightStepUses', -1, 'campaign');
        });
    });

    describe('clearExtendedFlag', () => {
        it('should set extended used flag to false', async () => {
            await clearExtendedFlag('TestHero', 'campaign');

            expect(setRuntimeValue).toHaveBeenCalledWith('TestHero', '_teleportExtendedUsed', false, 'campaign');
        });
    });

    describe('isExtendedAvailable', () => {
        it('should return true when flag is false', () => {
            getRuntimeValue.mockReturnValue(false);
            expect(isExtendedAvailable('TestHero', 'campaign')).toBe(true);
        });

        it('should return false when flag is true', () => {
            getRuntimeValue.mockReturnValue(true);
            expect(isExtendedAvailable('TestHero', 'campaign')).toBe(false);
        });

        it('should return true when flag is null (not set)', () => {
            getRuntimeValue.mockReturnValue(null);
            expect(isExtendedAvailable('TestHero', 'campaign')).toBe(true);
        });
    });
});
