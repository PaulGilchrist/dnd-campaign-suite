// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handle, confirmDragonCompanion } from './dragonCompanionHandler.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

const { getRuntimeValue, setRuntimeValue } = await import('../../../../hooks/runtime/useRuntimeState.js');

const campaignName = 'test-campaign';

function makeAction(overrides = {}) {
    return {
        name: 'Dragon Companion',
        automation: { type: 'dragon_companion', action: 'action', spell: 'Summon Dragon', usesMax: 1, recharge: 'long_rest', ...overrides.automation },
        ...overrides,
    };
}

function makePlayerStats(overrides = {}) {
    return {
        name: 'SorcererBoy',
        ...overrides,
    };
}

beforeEach(() => {
    vi.clearAllMocks();
});

describe('dragonCompanionHandler', () => {
    describe('exported constants', () => {
        it('should export modalName', async () => {
            const mod = await import('./dragonCompanionHandler.js');
            expect(mod.modalName).toBe('dragonCompanion');
        });

        it('should export confirmType', async () => {
            const mod = await import('./dragonCompanionHandler.js');
            expect(mod.confirmType).toBe('dragon_companion_confirm');
        });
    });

    describe('handle', () => {
        it('returns popup when no uses remaining (count 0)', async () => {
            getRuntimeValue.mockReturnValue(0);

            const result = await handle(makeAction(), makePlayerStats(), campaignName);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('No free casts remaining');
            expect(result.payload.description).toContain('Long Rest');
        });

        it('returns popup when usesMax is 0 and no stored value', async () => {
            getRuntimeValue.mockReturnValue(null);

            const result = await handle(makeAction({ automation: { usesMax: 0 } }), makePlayerStats(), campaignName);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('No free casts remaining');
        });

        it('returns modal when uses are available', async () => {
            getRuntimeValue.mockReturnValue(1);

            const result = await handle(makeAction(), makePlayerStats(), campaignName);

            expect(result.type).toBe('modal');
            expect(result.modalName).toBe('dragonCompanion');
            expect(result.payload.noConcentrationOption).toBe(true);
            expect(result.payload.action).toBeInstanceOf(Object);
            expect(result.payload.playerStats).toBeInstanceOf(Object);
            expect(result.payload.campaignName).toBe(campaignName);
        });

        it('falls through to usesMax when runtime value is null', async () => {
            getRuntimeValue.mockReturnValue(null);

            const result = await handle(makeAction({ automation: { usesMax: 3 } }), makePlayerStats(), campaignName);

            expect(result.type).toBe('modal');
        });

        it('falls through to usesMax when runtime value is undefined', async () => {
            getRuntimeValue.mockReturnValue(undefined);

            const result = await handle(makeAction({ automation: { usesMax: 2 } }), makePlayerStats(), campaignName);

            expect(result.type).toBe('modal');
        });

        it('uses the action name to build the runtime key', async () => {
            getRuntimeValue.mockReturnValue(1);

            const action = makeAction({ name: 'My Dragon Companion' });
            await handle(action, makePlayerStats(), campaignName);

            expect(getRuntimeValue).toHaveBeenCalledWith(
                'SorcererBoy',
                '_My_Dragon_Companion_freeCastCount',
                campaignName
            );
        });

        it('uses default feature name when action.name is missing', async () => {
            getRuntimeValue.mockReturnValue(1);

            const action = makeAction({ name: undefined });
            await handle(action, makePlayerStats(), campaignName);

            expect(getRuntimeValue).toHaveBeenCalledWith(
                'SorcererBoy',
                '_Dragon_Companion_freeCastCount',
                campaignName
            );
        });
    });

    describe('confirmDragonCompanion', () => {
        it('decrements counter and returns success popup', async () => {
            getRuntimeValue.mockReturnValue(1);
            setRuntimeValue.mockResolvedValue(undefined);

            const result = await confirmDragonCompanion(makeAction(), makePlayerStats(), campaignName, false);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Dragon Companion');
            expect(result.payload.description).toContain('Free cast of Summon Dragon (0 remaining)');
            expect(result.payload.description).not.toContain('Does not require Concentration');
            expect(result.payload.description).not.toContain('Duration: 1 minute');
            expect(result.payload.description).toContain('no spell slot or material components');
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'SorcererBoy',
                '_Dragon_Companion_freeCastCount',
                0,
                campaignName
            );
        });

        it('decrements from arbitrary count (3 to 2)', async () => {
            getRuntimeValue.mockReturnValue(3);
            setRuntimeValue.mockResolvedValue(undefined);

            const result = await confirmDragonCompanion(makeAction(), makePlayerStats(), campaignName, false);

            expect(result.payload.description).toContain('Free cast of Summon Dragon (2 remaining)');
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'SorcererBoy',
                '_Dragon_Companion_freeCastCount',
                2,
                campaignName
            );
        });

        it('includes no-concentration info when noConcentration=true', async () => {
            getRuntimeValue.mockReturnValue(1);
            setRuntimeValue.mockResolvedValue(undefined);

            const result = await confirmDragonCompanion(makeAction(), makePlayerStats(), campaignName, true);

            expect(result.payload.description).toContain('Does not require Concentration');
            expect(result.payload.description).toContain('Duration: 1 minute');
            expect(result.payload.automation.noConcentration).toBe(true);
            expect(setRuntimeValue).toHaveBeenCalled();
        });

        it('returns error popup when no uses remaining', async () => {
            getRuntimeValue.mockReturnValue(0);

            const result = await confirmDragonCompanion(makeAction(), makePlayerStats(), campaignName, false);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('No free casts remaining');
            expect(setRuntimeValue).not.toHaveBeenCalled();
        });

        it('uses custom spell name from automation', async () => {
            getRuntimeValue.mockReturnValue(1);
            setRuntimeValue.mockResolvedValue(undefined);

            const action = makeAction({ automation: { spell: 'Call Wyrm' } });
            const result = await confirmDragonCompanion(action, makePlayerStats(), campaignName, false);

            expect(result.payload.description).toContain('Free cast of Call Wyrm');
        });

        it('uses custom feature name in runtime key and description', async () => {
            getRuntimeValue.mockReturnValue(1);
            setRuntimeValue.mockResolvedValue(undefined);

            const action = makeAction({ name: 'Ancient Dragon Companion' });
            const result = await confirmDragonCompanion(action, makePlayerStats(), campaignName, false);

            expect(result.payload.name).toBe('Ancient Dragon Companion');
            expect(result.payload.description).toContain('Free cast of Summon Dragon (0 remaining)');
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'SorcererBoy',
                '_Ancient_Dragon_Companion_freeCastCount',
                0,
                campaignName
            );
        });
    });
});
