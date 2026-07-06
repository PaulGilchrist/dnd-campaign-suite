// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handle } from './mageHandControlHandler.js';

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

const { addEntry } = await import('../../../ui/logService.js');

beforeEach(() => {
    vi.clearAllMocks();
});

function makePlayerStats(overrides = {}) {
    return {
        name: 'TestWizard',
        ...overrides,
    };
}

function makeAction(overrides = {}) {
    return {
        name: 'Mage Hand Control',
        automation: {
            type: 'mage_hand_control',
            range: '30',
            ...overrides.automation,
        },
        ...overrides,
    };
}

describe('mageHandControlHandler', () => {
    it('returns a popup with automation_info payload and logs the ability use', async () => {
        const result = await handle(
            makeAction(),
            makePlayerStats(),
            'test-campaign',
            null
        );

        expect(result).toEqual({
            type: 'popup',
            payload: expect.objectContaining({
                type: 'automation_info',
                name: 'Mage Hand Control',
                automationType: 'mage_hand_control',
            }),
        });
        expect(addEntry).toHaveBeenCalledTimes(1);
        expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
            type: 'ability_use',
            characterName: 'TestWizard',
            abilityName: 'Mage Hand Control',
        }));
    });

    it('gracefully handles log failure without throwing', async () => {
        vi.mocked(addEntry).mockRejectedValueOnce(new Error('network error'));

        const result = await handle(
            makeAction(),
            makePlayerStats(),
            'test-campaign',
            null
        );

        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
    });
});
