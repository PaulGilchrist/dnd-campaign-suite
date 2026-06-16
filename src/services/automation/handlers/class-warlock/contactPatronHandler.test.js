import { handle } from './contactPatronHandler.js';
import * as runtimeState from '../../../../hooks/runtime/useRuntimeState.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

const makeAction = (auto = {}) => ({
    name: 'Contact Patron',
    automation: { type: 'contact_patron', uses: 1, ...auto },
});

const makePlayerStats = (overrides = {}) => ({
    name: 'TestWarlock',
    ...overrides,
});

describe('contactPatronHandler', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('handle', () => {
        it('should return info popup when no free casts remaining', async () => {
            runtimeState.getRuntimeValue.mockReturnValue(0);

            const result = await handle(makeAction(), makePlayerStats(), 'campaign');

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('No free casts remaining');
            expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
        });

        it('should decrement free cast count when available', async () => {
            runtimeState.getRuntimeValue.mockReturnValue(1);

            const result = await handle(makeAction(), makePlayerStats(), 'campaign');

            expect(result.type).toBe('popup');
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                'TestWarlock',
                '_Contact_Patron_freeCastCount',
                0,
                'campaign'
            );
        });

        it('should return success popup with contact description', async () => {
            runtimeState.getRuntimeValue.mockReturnValue(1);

            const result = await handle(makeAction(), makePlayerStats(), 'campaign');

            expect(result.payload.description).toContain('Contact Other Plane');
            expect(result.payload.description).toContain('0 remaining');
        });

        it('should use custom uses from automation', async () => {
            runtimeState.getRuntimeValue.mockReturnValue(2);

            const result = await handle(makeAction({ uses: 3 }), makePlayerStats(), 'campaign');

            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                'TestWarlock',
                '_Contact_Patron_freeCastCount',
                1,
                'campaign'
            );
            expect(result.payload.description).toContain('1 remaining');
        });

        it('should default to usesMax when no stored value', async () => {
            runtimeState.getRuntimeValue.mockReturnValue(null);

            const result = await handle(makeAction({ uses: 3 }), makePlayerStats(), 'campaign');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('2 remaining');
        });

        it('should handle custom action name in key', async () => {
            runtimeState.getRuntimeValue.mockReturnValue(1);

            const action = {
                name: 'Custom Contact',
                automation: { type: 'contact_patron', uses: 1 },
            };

            await handle(action, makePlayerStats(), 'campaign');

            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                'TestWarlock',
                '_Custom_Contact_freeCastCount',
                0,
                'campaign'
            );
        });

        it('should default featureName to Contact Patron', async () => {
            runtimeState.getRuntimeValue.mockReturnValue(1);

            const action = {
                automation: { type: 'contact_patron', uses: 1 },
            };

            const result = await handle(action, makePlayerStats(), 'campaign');

            expect(result.payload.name).toBe('Contact Patron');
        });

        it('should mention automatic success in description', async () => {
            runtimeState.getRuntimeValue.mockReturnValue(1);

            const result = await handle(makeAction(), makePlayerStats(), 'campaign');

            expect(result.payload.description).toContain('automatically succeed');
        });
    });
});
