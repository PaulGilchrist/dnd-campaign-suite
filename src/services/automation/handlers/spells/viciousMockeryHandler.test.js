import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handle } from './viciousMockeryHandler.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(() => []),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../../rules/effects/expirations.js', () => ({
    addExpiration: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

import { setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';

function makePlayerStats(overrides = {}) {
    return {
        name: 'TestBard',
        level: 1,
        proficiency: 2,
        spellAbilities: { saveDc: 12, modifier: 1 },
        abilities: [{ name: 'Charisma', bonus: 1 }],
        automation: {},
        ...overrides,
    };
}

function makeAction(overrides = {}) {
    return {
        name: 'Vicious Mockery',
        automation: { type: 'vicious_mockery', targetName: 'Goblin' },
        ...overrides,
    };
}

describe('viciousMockeryHandler', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('applies disadvantage_next_attack target effect', async () => {
        const result = await handle(makeAction(), makePlayerStats(), 'TestCampaign', 'TestMap');

        expect(result.type).toBe('popup');
        expect(setRuntimeValue).toHaveBeenCalledWith(
            'TestCampaign',
            'targetEffects',
            expect.arrayContaining([
                expect.objectContaining({
                    target: 'Goblin',
                    effect: 'disadvantage_next_attack',
                    source: 'TestBard',
                }),
            ]),
            'TestCampaign',
        );
    });

    it('returns popup with automation info', async () => {
        const result = await handle(makeAction(), makePlayerStats(), 'TestCampaign', 'TestMap');

        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.name).toBe('Vicious Mockery');
        expect(result.payload.targetName).toBe('Goblin');
    });

    it('adds expiration for the disadvantage effect', async () => {
        const { addExpiration } = await import('../../../rules/effects/expirations.js');

        await handle(makeAction(), makePlayerStats(), 'TestCampaign', 'TestMap');

        expect(addExpiration).toHaveBeenCalledWith(
            'TestBard',
            'Goblin',
            expect.arrayContaining([
                expect.objectContaining({
                    type: 'remove_target_effect',
                    effectKey: 'disadvantage_next_attack',
                    source: 'TestBard',
                }),
            ]),
            'TestCampaign',
            undefined,
            'TestBard',
        );
    });
});
