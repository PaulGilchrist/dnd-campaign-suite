import { describe, it, expect, vi, beforeEach } from 'vitest';

import { handle } from './contactPatronHandler.js';
import * as runtimeState from '../../../../hooks/runtime/useRuntimeState.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(async () => {}),
}));

const campaignName = 'campaign';

function makeAction(overrides = {}) {
    return {
        name: 'Contact Patron',
        automation: { type: 'contact_patron', ...overrides.automation },
        ...overrides,
    };
}

function makePlayerStats(overrides = {}) {
    return {
        name: 'TestWarlock',
        ...overrides,
    };
}

beforeEach(() => {
    vi.clearAllMocks();
});

describe('contactPatronHandler', () => {
    describe('zero remaining', () => {
        it('should return info popup when stored count is 0', async () => {
            runtimeState.getRuntimeValue.mockReturnValue(0);

            const result = await handle(makeAction(), makePlayerStats(), campaignName);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Contact Patron');
            expect(result.payload.description).toContain('No free casts remaining');
            expect(result.payload.description).toContain('Long Rest');
            expect(result.payload.automation).toEqual({ type: 'contact_patron' });
            expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
        });

        it('should return info popup when stored count is negative', async () => {
            runtimeState.getRuntimeValue.mockReturnValue(-3);

            const result = await handle(makeAction(), makePlayerStats(), campaignName);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('No free casts remaining');
            expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
        });
    });

    describe('successful activation', () => {
        it('should decrement from 1 to 0 and return success popup', async () => {
            runtimeState.getRuntimeValue.mockReturnValue(1);

            const result = await handle(makeAction(), makePlayerStats(), campaignName);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Contact Patron');
            expect(result.payload.description).toContain('Contact Other Plane');
            expect(result.payload.description).toContain('automatically succeed');
            expect(result.payload.description).toContain('0 remaining');
            expect(result.payload.automation).toEqual({ type: 'contact_patron' });
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                'TestWarlock',
                '_Contact_Patron_freeCastCount',
                0,
                campaignName
            );
        });

        it('should use automation.uses as the max and decrement from there', async () => {
            runtimeState.getRuntimeValue.mockReturnValue(5);

            const result = await handle(makeAction({ automation: { uses: 5 } }), makePlayerStats(), campaignName);

            expect(result.payload.description).toContain('4 remaining');
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                'TestWarlock',
                '_Contact_Patron_freeCastCount',
                4,
                campaignName
            );
        });

        it('should default to usesMax when no stored runtime value exists', async () => {
            runtimeState.getRuntimeValue.mockReturnValue(null);

            const result = await handle(makeAction({ automation: { uses: 3 } }), makePlayerStats(), campaignName);

            expect(result.payload.description).toContain('2 remaining');
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                'TestWarlock',
                '_Contact_Patron_freeCastCount',
                2,
                campaignName
            );
        });

        it('should default uses to 1 when automation.uses is missing', async () => {
            runtimeState.getRuntimeValue.mockReturnValue(null);

            const result = await handle(makeAction(), makePlayerStats(), campaignName);

            expect(result.payload.description).toContain('0 remaining');
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                'TestWarlock',
                '_Contact_Patron_freeCastCount',
                0,
                campaignName
            );
        });
    });

    describe('custom action name', () => {
        it('should use the action name to build the runtime key and show it in the popup', async () => {
            runtimeState.getRuntimeValue.mockReturnValue(1);

            const action = {
                name: 'My Patron Contact',
                automation: { type: 'contact_patron' },
            };

            const result = await handle(action, makePlayerStats(), campaignName);

            expect(result.payload.name).toBe('My Patron Contact');
            expect(result.payload.description).toContain('0 remaining');
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                'TestWarlock',
                '_My_Patron_Contact_freeCastCount',
                0,
                campaignName
            );
        });
    });
});