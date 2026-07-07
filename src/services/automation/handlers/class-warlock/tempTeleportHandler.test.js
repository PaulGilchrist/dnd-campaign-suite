// @improved-by-ai
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { handle, confirmTeleport, clearExtendedFlag, isExtendedAvailable } from './tempTeleportHandler.js';

// ── Mocks ──────────────────────────────────────────────────────

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
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
import { resolveTarget } from '../../common/targetResolver.js';
import { buildSaveDc } from '../../common/savePrompt.js';

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
        getRuntimeValue.mockReturnValue(null);
        buildSaveDc.mockReturnValue(13);
        resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });
    });

    afterEach(() => {
        document.dispatchEvent(new Event('cleanup'));
    });

    describe('handle', () => {
        it('returns modal with payload for basic teleport', async () => {
            const action = makeAction();
            const stats = makePlayerStats();

            const result = await handle(action, stats, 'test-campaign', 'test-map');

            expect(result.type).toBe('modal');
            expect(result.modalName).toBe('teleport');
            expect(result.payload.action).toBe(action);
            expect(result.payload.playerStats).toBe(stats);
            expect(result.payload.campaignName).toBe('test-campaign');
        });

        it('returns info popup when moonlight_step_teleport has zero uses', async () => {
            getRuntimeValue.mockReturnValue(0);
            const action = makeAction({
                automation: { effect: 'moonlight_step_teleport' },
            });
            const result = await handle(action, makePlayerStats(), 'test-campaign', 'test-map');

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Shadow of Moil');
            expect(result.payload.description).toContain('no uses remaining');
            expect(result.payload.description).toContain('Long Rest');
        });

        it('returns modal when moonlight_step_teleport has uses remaining or null', async () => {
            const action = makeAction({
                automation: { effect: 'moonlight_step_teleport' },
            });

            getRuntimeValue.mockReturnValue(1);
            let result = await handle(action, makePlayerStats(), 'test-campaign', 'test-map');
            expect(result.type).toBe('modal');

            getRuntimeValue.mockReturnValue(null);
            result = await handle(action, makePlayerStats(), 'test-campaign', 'test-map');
            expect(result.type).toBe('modal');
        });
    });

    describe('confirmTeleport', () => {
        it('returns popup with distance from automation for basic teleport', async () => {
            const action = makeAction();
            const result = await confirmTeleport(action, makePlayerStats(), 'campaign', false);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('Shadow of Moil');
            expect(result.payload.description).toContain('60 ft');
            expect(result.payload.description).toContain('Teleported');
        });

        it('uses extended distance when useExtended is true', async () => {
            const action = makeAction({
                automation: { extendedDistance: '150 ft' },
            });
            const result = await confirmTeleport(action, makePlayerStats(), 'campaign', true);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('150 ft');
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestHero',
                '_teleportExtendedUsed',
                true,
                'campaign'
            );
        });

        it('describes swap with illusion', async () => {
            const action = makeAction({
                automation: { effect: 'teleport_swap_with_illusion' },
            });
            const result = await confirmTeleport(action, makePlayerStats(), 'campaign', false);

            expect(result.payload.description).toContain('Swapped places with your illusion');
        });

        it('adds next_attack_advantage effect for shadow_step and moonlight_step teleports', async () => {
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'targetEffects') return [];
                return null;
            });

            const shadowAction = makeAction({ automation: { effect: 'shadow_step_teleport' } });
            await confirmTeleport(shadowAction, makePlayerStats(), 'campaign', false);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'campaign',
                'targetEffects',
                expect.any(Array),
                'campaign'
            );

            vi.clearAllMocks();
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'targetEffects') return [];
                return null;
            });

            const moonlightAction = makeAction({ automation: { effect: 'moonlight_step_teleport' } });
            await confirmTeleport(moonlightAction, makePlayerStats(), 'campaign', false);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'campaign',
                'targetEffects',
                expect.any(Array),
                'campaign'
            );
        });

        it('brings allies when useExtended with allyCount', async () => {
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'targetEffects') return [];
                return null;
            });
            const action = makeAction({
                automation: {
                    extendedDistance: '150 ft',
                    bringAllies: true,
                    allyCount: 3,
                    teleportRange: '10 ft',
                },
            });
            const result = await confirmTeleport(action, makePlayerStats(), 'campaign', true);

            expect(result.payload.description).toContain('150 ft');
            expect(result.payload.description).toContain('3 willing creatures');
            expect(result.payload.description).toContain('10 ft');
        });

        it('omits ally text when bringAllies is false or allyCount is zero', async () => {
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'targetEffects') return [];
                return null;
            });

            const noBringAction = makeAction({
                automation: {
                    extendedDistance: '150 ft',
                    bringAllies: false,
                    allyCount: 3,
                },
            });
            let result = await confirmTeleport(noBringAction, makePlayerStats(), 'campaign', true);
            expect(result.payload.description).not.toContain('willing creatures');

            vi.clearAllMocks();
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'targetEffects') return [];
                return null;
            });

            const zeroCountAction = makeAction({
                automation: {
                    extendedDistance: '150 ft',
                    bringAllies: true,
                    allyCount: 0,
                },
            });
            result = await confirmTeleport(zeroCountAction, makePlayerStats(), 'campaign', true);
            expect(result.payload.description).not.toContain('willing creatures');
        });

        it('adds Shared Moonlight effect when Lunar Form passive exists', async () => {
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'targetEffects') return [];
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

        it('adds Improved Shadow Step effects when passive exists', async () => {
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'targetEffects') return [];
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
            expect(result.payload.description).toContain('Blinded');
            expect(resolveTarget).toHaveBeenCalledWith('campaign', 'TestHero');
        });

        it('decrements moonlight step uses when above zero', async () => {
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'targetEffects') return [];
                if (key === 'moonlightStepUses') return 3;
                return null;
            });
            const action = makeAction({
                automation: { effect: 'moonlight_step_teleport' },
            });
            await confirmTeleport(action, makePlayerStats(), 'campaign', false);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestHero',
                'moonlightStepUses',
                2,
                'campaign'
            );
        });
    });

    describe('clearExtendedFlag', () => {
        it('sets extended used flag to false', async () => {
            await clearExtendedFlag('TestHero', 'campaign');

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestHero',
                '_teleportExtendedUsed',
                false,
                'campaign'
            );
        });
    });

    describe('isExtendedAvailable', () => {
        it('returns false when flag is true', () => {
            getRuntimeValue.mockReturnValue(true);
            expect(isExtendedAvailable('TestHero', 'campaign')).toBe(false);
        });

        it('returns true when flag is falsy', () => {
            getRuntimeValue.mockReturnValue(false);
            expect(isExtendedAvailable('TestHero', 'campaign')).toBe(true);
        });
    });
});
