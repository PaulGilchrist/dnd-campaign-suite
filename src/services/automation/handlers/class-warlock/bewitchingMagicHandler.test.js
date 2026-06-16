import { handle } from './bewitchingMagicHandler.js';
import * as runtimeState from '../../../../hooks/runtime/useRuntimeState.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    setRuntimeValue: vi.fn(),
}));

const makeAction = (overrides = {}) => ({
    name: 'Bewitching Magic',
    automation: { type: 'bewitching_magic', ...overrides },
});

const makePlayerStats = (overrides = {}) => ({
    name: 'TestWarlock',
    ...overrides,
});

describe('bewitchingMagicHandler', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('handle', () => {
        it('should set freeCastKey to Misty Step', async () => {
            await handle(makeAction(), makePlayerStats(), 'campaign', 'map');

            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                'TestWarlock',
                '_Bewitching_Magic_freeCast',
                ['Misty Step'],
                'campaign'
            );
        });

        it('should return popup with Misty Step description', async () => {
            const result = await handle(makeAction(), makePlayerStats(), 'campaign', 'map');

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Bewitching Magic');
            expect(result.payload.description).toContain('Misty Step');
        });

        it('should return popup with cast without slot description', async () => {
            const result = await handle(makeAction(), makePlayerStats(), 'campaign', 'map');

            expect(result.payload.description).toContain('without expending a spell slot');
        });

        it('should work with custom action name', async () => {
            const action = { name: 'Custom Feature', automation: { type: 'bewitching_magic' } };
            await handle(action, makePlayerStats(), 'campaign', 'map');
        });
    });
});
