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
    describe('return value', () => {
        it('returns a popup with automation_info payload type', async () => {
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
        });

        it('passes the automation object through to the payload', async () => {
            const customAutomation = { type: 'mage_hand_control', range: '45', customFlag: true };
            const result = await handle(
                makeAction({ automation: customAutomation }),
                makePlayerStats(),
                'test-campaign',
                null
            );

            expect(result.payload.automation).toBe(customAutomation);
        });
    });

    describe('description formatting', () => {
        it('includes the ability name in the description', async () => {
            const result = await handle(
                makeAction(),
                makePlayerStats(),
                'test-campaign',
                null
            );

            expect(result.payload.description).toContain('Mage Hand Control');
        });

        it('includes the configured range in the description', async () => {
            const result = await handle(
                makeAction({ automation: { range: '60' } }),
                makePlayerStats(),
                'test-campaign',
                null
            );

            expect(result.payload.description).toContain('60');
        });

        it('uses default range "30" when range is missing', async () => {
            const result = await handle(
                makeAction({ automation: { type: 'mage_hand_control' } }),
                makePlayerStats(),
                'test-campaign',
                null
            );

            expect(result.payload.description).toContain('30');
        });
    });

    describe('logging', () => {
        it('logs an ability_use entry on success', async () => {
            await handle(
                makeAction(),
                makePlayerStats(),
                'test-campaign',
                null
            );

            expect(addEntry).toHaveBeenCalledTimes(1);
            expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
                type: 'ability_use',
                characterName: 'TestWizard',
                abilityName: 'Mage Hand Control',
            }));
        });

        it('uses the player stats name in the log entry', async () => {
            const playerStats = makePlayerStats({ name: 'ElvenRogue' });

            await handle(
                makeAction(),
                playerStats,
                'test-campaign',
                null
            );

            expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
                characterName: 'ElvenRogue',
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
});
