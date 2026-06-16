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
        it('should return popup with default range', async () => {
            const result = await handle(makeAction(), makePlayerStats(), 'campaign', 'map');

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('30');
        });

        it('should return popup with custom range', async () => {
            const result = await handle(makeAction({ range: '60' }), makePlayerStats(), 'campaign', 'map');

            expect(result.payload.description).toContain('60');
        });

        it('should add campaign log entry', async () => {
            await handle(makeAction(), makePlayerStats(), 'campaign', 'map');

            expect(logService.addEntry).toHaveBeenCalledWith('campaign', expect.objectContaining({
                type: 'ability_use',
                characterName: 'TestHero',
                abilityName: 'Telekinetic Movement',
            }));
        });

        it('should include ability name in description', async () => {
            const result = await handle(makeAction(), makePlayerStats(), 'campaign', 'map');

            expect(result.payload.description).toContain('Telekinetic Movement');
        });

        it('should use default range when automation has no range', async () => {
            const result = await handle(makeAction({}), makePlayerStats(), 'campaign', 'map');

            expect(result.payload.description).toContain('30');
        });

        it('should include automation type in result', async () => {
            const result = await handle(makeAction(), makePlayerStats(), 'campaign', 'map');

            expect(result.payload.automationType).toBe('telekinetic_movement');
        });
    });
});
