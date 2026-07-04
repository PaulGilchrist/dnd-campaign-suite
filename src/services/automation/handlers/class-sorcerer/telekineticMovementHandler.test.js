// @cleaned-by-ai
import { handle } from './telekineticMovementHandler.js';
import * as logService from '../../../ui/logService.js';

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

const makeAction = (auto = {}) => ({
    name: 'Telekinetic Movement',
    automation: { type: 'telekinetic_movement', range: '30', ...auto },
});

const makePlayerStats = (overrides = {}) => ({
    name: 'TestHero',
    ...overrides,
});

describe('telekineticMovementHandler', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('handle', () => {
        it('should return a popup with automation_info type and all payload fields', async () => {
            const result = await handle(makeAction(), makePlayerStats(), 'campaign', 'map');

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Telekinetic Movement');
            expect(result.payload.automationType).toBe('telekinetic_movement');
            expect(result.payload.automation).toEqual({
                type: 'telekinetic_movement',
                range: '30',
            });
        });

        it('should describe the action with the default range when automation.range is missing', async () => {
            const result = await handle(makeAction({ range: undefined }), makePlayerStats(), 'campaign', 'map');

            expect(result.payload.description).toContain('Telekinetic Movement');
            expect(result.payload.description).toContain('30');
        });

        it('should describe the action with a custom range when provided', async () => {
            const result = await handle(makeAction({ range: '60' }), makePlayerStats(), 'campaign', 'map');

            expect(result.payload.description).toContain('Telekinetic Movement');
            expect(result.payload.description).toContain('60');
        });

        it('should log an ability_use entry to the campaign', async () => {
            await handle(makeAction(), makePlayerStats(), 'campaign', 'map');

            expect(logService.addEntry).toHaveBeenCalledWith('campaign', expect.objectContaining({
                type: 'ability_use',
                characterName: 'TestHero',
                abilityName: 'Telekinetic Movement',
            }));
        });

        it('should include a description in the log entry with range', async () => {
            await handle(makeAction({ range: '45' }), makePlayerStats(), 'campaign', 'map');

            expect(logService.addEntry).toHaveBeenCalledWith('campaign', expect.objectContaining({
                description: 'TestHero used Telekinetic Movement to move an object or willing creature up to 45 feet.',
            }));
        });

        it('should use the default range in the log description when range is missing', async () => {
            await handle(makeAction({ range: undefined }), makePlayerStats(), 'campaign', 'map');

            expect(logService.addEntry).toHaveBeenCalledWith('campaign', expect.objectContaining({
                description: 'TestHero used Telekinetic Movement to move an object or willing creature up to 30 feet.',
            }));
        });

        it('should tolerate addEntry rejection without throwing', async () => {
            logService.addEntry.mockRejectedValue(new Error('network error'));

            await expect(
                handle(makeAction(), makePlayerStats(), 'campaign', 'map')
            ).resolves.toMatchObject({
                type: 'popup',
                payload: expect.objectContaining({
                    type: 'automation_info',
                }),
            });
        });
    });
});
