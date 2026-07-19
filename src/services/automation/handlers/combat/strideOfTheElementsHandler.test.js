vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(() => null),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../encounters/combatData.js', () => ({
    getCurrentCombatRound: vi.fn(() => 1),
}));

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handle } from './strideOfTheElementsHandler.js';
import { getRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';

const campaignName = 'test-campaign';

function makePlayerStats(name = 'TestMonk') {
    return {
        name,
        level: 6,
    };
}

function makeAction(overrides = {}) {
    return {
        name: 'Stride of the Elements',
        description: 'When you use your Elemental Attunement, you can gain a special movement type.',
        automation: {
            type: 'stride_of_the_elements',
            effect: 'elemental_movement',
            casting_time: 'passive',
            options: [
                { name: 'Cold', effect: 'ice_walk' },
                { name: 'Fire', effect: 'speed_boost', speedBonus: 10 },
                { name: 'Lightning', effect: 'fly_speed', flySpeed: 'equals_walk_speed' },
                { name: 'Thunder', effect: 'teleport', teleportDistance: '30 ft' },
            ],
        },
        ...overrides,
    };
}

describe('strideOfTheElementsHandler', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should return popup when Elemental Attunement is not active', async () => {
        getRuntimeValue.mockImplementation((_attackerName, key) => {
            if (key === 'elementalAttunementActive') return false;
            return null;
        });
        const result = await handle(makeAction(), makePlayerStats(), campaignName);
        expect(result).toEqual({
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: 'Stride of the Elements',
                automationType: 'stride_of_the_elements',
                description: 'Elemental Attunement must be active to use Stride of the Elements.',
                automation: expect.objectContaining({ type: 'stride_of_the_elements' }),
            },
        });
    });

    it('should return popup when Elemental Attunement is null', async () => {
        getRuntimeValue.mockImplementation((_attackerName, key) => {
            if (key === 'elementalAttunementActive') return null;
            return null;
        });
        const result = await handle(makeAction(), makePlayerStats(), campaignName);
        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('Elemental Attunement must be active');
    });

    it('should return modal when Elemental Attunement is active', async () => {
        getRuntimeValue.mockImplementation((_attackerName, key) => {
            if (key === 'elementalAttunementActive') return true;
            if (key === 'elementalAttunementElement') return 'Fire';
            return null;
        });
        const result = await handle(makeAction(), makePlayerStats(), campaignName);
        expect(result).toEqual({
            type: 'modal',
            modalName: 'strideOfTheElements',
            payload: expect.objectContaining({
                action: expect.objectContaining({ name: 'Stride of the Elements' }),
                campaignName,
            }),
        });
    });

    it('should gate on elementalAttunementActive being truthy', async () => {
        getRuntimeValue.mockImplementation((_attackerName, key) => {
            if (key === 'elementalAttunementActive') return true;
            return null;
        });
        const result = await handle(makeAction(), makePlayerStats(), campaignName);
        expect(result.type).toBe('modal');
        expect(result.modalName).toBe('strideOfTheElements');
    });
});
