import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handle, isSilenceActive } from './silenceHandler.js';

vi.mock('../../common/buffToggle.js', () => ({
    toggleBuff: vi.fn(() => ({ wasActive: false })),
}));

vi.mock('../../../rules/effects/expirations.js', () => ({
    addExpiration: vi.fn(),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    setRuntimeValue: vi.fn(async () => {}),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(),
}));

vi.mock('../../../shared/logPoster.js', () => ({
    postLogEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../rules/features/silenceService.js', () => ({
    isSilenceActive: vi.fn(),
}));

const { toggleBuff } = await import('../../common/buffToggle.js');
const { addExpiration } = await import('../../../rules/effects/expirations.js');
const { setRuntimeValue } = await import('../../../../hooks/runtime/useRuntimeState.js');
const { getCombatContext } = await import('../../../rules/combat/damageUtils.js');
const { postLogEntry } = await import('../../../shared/logPoster.js');
const { isSilenceActive: isSilenceActiveService } = await import('../../../rules/features/silenceService.js');

beforeEach(() => {
    vi.clearAllMocks();
    toggleBuff.mockReturnValue({ wasActive: false });
    getCombatContext.mockResolvedValue(null);
});

function makePlayerStats(overrides = {}) {
    return {
        name: 'ClericBoy',
        ...overrides,
    };
}

function makeAction(overrides = {}) {
    return {
        name: 'Silence',
        automation: {
            type: 'silence',
            aoeRadius: 20,
            ...overrides.automation,
        },
        ...overrides,
    };
}

describe('silenceHandler', () => {
    describe('handle', () => {
        it('returns popup with automation_info', async () => {
            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Silence');
        });

        it('includes automationType in payload', async () => {
            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(result.payload.automationType).toBe('silence');
        });

        it('includes description with aoe radius', async () => {
            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(result.payload.description).toContain('20-foot-radius');
            expect(result.payload.description).toContain('Sphere of silence');
        });

        it('uses custom aoeRadius from automation when provided', async () => {
            const action = makeAction({ automation: { aoeRadius: 30 } });
            const result = await handle(action, makePlayerStats(), 'test-campaign', null);

            expect(result.payload.description).toContain('30-foot-radius');
        });

        it('calls toggleBuff with correct parameters', async () => {
            const action = makeAction();

            await handle(action, makePlayerStats(), 'test-campaign', null);

            expect(toggleBuff).toHaveBeenCalledWith(
                'ClericBoy',
                'Silence',
                { type: 'silence', aoeRadius: 20, effect: 'silence' },
                'test-campaign'
            );
        });

        it('sets runtime values when not previously active', async () => {
            toggleBuff.mockReturnValue({ wasActive: false });

            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'ClericBoy',
                'silenceCaster',
                true,
                'test-campaign'
            );
        });

        it('sets silence center grid when combat context exists', async () => {
            toggleBuff.mockReturnValue({ wasActive: false });
            getCombatContext.mockResolvedValue({
                players: [{ name: 'ClericBoy', gridX: 5, gridY: 10 }],
            });

            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'ClericBoy',
                'silenceCenter',
                '{"gridX":5,"gridY":10}',
                'test-campaign'
            );
        });

        it('sets silence center to null when no combat context', async () => {
            toggleBuff.mockReturnValue({ wasActive: false });
            getCombatContext.mockResolvedValue(null);

            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'ClericBoy',
                'silenceCenter',
                null,
                'test-campaign'
            );
        });

        it('sets silence radius when not previously active', async () => {
            toggleBuff.mockReturnValue({ wasActive: false });

            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'ClericBoy',
                'silenceRadius',
                20,
                'test-campaign'
            );
        });

        it('adds expiration for removing active buff', async () => {
            toggleBuff.mockReturnValue({ wasActive: false });

            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(addExpiration).toHaveBeenCalledWith(
                'ClericBoy',
                'ClericBoy',
                [{ type: 'remove_active_buff', buffName: 'Silence' }],
                'test-campaign'
            );
        });

        it('posts log entry when not previously active', async () => {
            toggleBuff.mockReturnValue({ wasActive: false });

            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(postLogEntry).toHaveBeenCalledWith('test-campaign', {
                type: 'ability_use',
                characterName: 'ClericBoy',
                abilityName: 'Silence',
                description: expect.stringContaining('cast Silence'),
                timestamp: expect.any(Number),
            });
        });

        it('returns ended description when previously active', async () => {
            toggleBuff.mockReturnValue({ wasActive: true });

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(result.payload.description).toBe('Silence ended');
        });

        it('sets runtime values to false when previously active', async () => {
            toggleBuff.mockReturnValue({ wasActive: true });

            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'ClericBoy',
                'silenceCaster',
                false,
                'test-campaign'
            );
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'ClericBoy',
                'silenceCenter',
                null,
                'test-campaign'
            );
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'ClericBoy',
                'silenceRadius',
                null,
                'test-campaign'
            );
        });

        it('does not add expiration when previously active', async () => {
            toggleBuff.mockReturnValue({ wasActive: true });

            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(addExpiration).not.toHaveBeenCalled();
        });
    });

    describe('isSilenceActive', () => {
        it('delegates to silenceService isSilenceActive', () => {
            isSilenceActiveService.mockReturnValue(true);

            expect(isSilenceActive('ClericBoy', 'test-campaign')).toBe(true);

            expect(isSilenceActiveService).toHaveBeenCalledWith('ClericBoy', 'test-campaign');
        });

        it('returns false when service returns false', () => {
            isSilenceActiveService.mockReturnValue(false);

            expect(isSilenceActive('ClericBoy', 'test-campaign')).toBe(false);
        });
    });
});
