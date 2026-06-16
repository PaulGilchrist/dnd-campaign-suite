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
    it('returns popup with automation info', async () => {
        const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.name).toBe('Mage Hand Control');
        expect(result.payload.automationType).toBe('mage_hand_control');
    });

    it('includes range in description', async () => {
        const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

        expect(result.payload.description).toContain('30');
        expect(result.payload.description).toContain('spectral hand');
    });

    it('uses default range when not provided', async () => {
        const result = await handle(
            makeAction({ automation: {} }),
            makePlayerStats(),
            'test-campaign',
            null
        );

        expect(result.payload.description).toContain('30');
    });

    it('logs the ability use', async () => {
        await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

        expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
            type: 'ability_use',
            characterName: 'TestWizard',
            abilityName: 'Mage Hand Control',
        }));
    });

    it('includes custom range in log entry', async () => {
        await handle(
            makeAction({ automation: { range: '60' } }),
            makePlayerStats(),
            'test-campaign',
            null
        );

        expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
            description: expect.stringContaining('60'),
        }));
    });

    it('includes automation in payload', async () => {
        const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

        expect(result.payload.automation).toEqual(makeAction().automation);
    });
});
