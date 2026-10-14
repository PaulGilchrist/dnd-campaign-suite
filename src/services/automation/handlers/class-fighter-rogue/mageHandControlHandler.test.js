import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handle } from './mageHandControlHandler.js';

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    setRuntimeValue: vi.fn(() => Promise.resolve()),
    getRuntimeValue: vi.fn(),
}));

const { addEntry } = await import('../../../ui/logService.js');
const { setRuntimeValue } = await import('../../../../hooks/runtime/useRuntimeState.js');

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
    it('returns popup with automation_info payload and logs the ability use', async () => {
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
                description: 'Mage Hand Control: Move the spectral hand up to <strong>30</strong> feet. While you control it, Dexterity (Sleight of Hand) checks through it have <strong>Advantage</strong>.',
                automation: { type: 'mage_hand_control', range: '30' },
            }),
        });
        expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
            type: 'ability_use',
            characterName: 'TestWizard',
            abilityName: 'Mage Hand Control',
        }));
        // CLA-218: controlling the hand arms the Sleight of Hand advantage flag
        expect(setRuntimeValue).toHaveBeenCalledWith('TestWizard', 'mageHandControlled', true, 'test-campaign');
    });

    it('renders numeric feet from the data range format (30_ft) — CLA-218', async () => {
        const result = await handle(
            makeAction({ automation: { type: 'mage_hand_control', range: '30_ft' } }),
            makePlayerStats(),
            'test-campaign',
            null
        );
        expect(result.payload.description).toContain('up to <strong>30</strong> feet');
        expect(result.payload.description).not.toContain('30_ft');
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

    it('returns popup with empty automationType and default range when action has no automation', async () => {
        const result = await handle(
            { name: 'Mage Hand Control' },
            makePlayerStats(),
            'test-campaign',
            null
        );

        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.name).toBe('Mage Hand Control');
        expect(result.payload.automationType).toBeUndefined();
        expect(result.payload.description).toContain('Move the spectral hand up to <strong>30</strong> feet.');
        expect(result.payload.automation).toEqual({});
    });
});
