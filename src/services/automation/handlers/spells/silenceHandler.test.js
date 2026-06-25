// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../common/buffToggle.js', () => ({
    toggleBuff: vi.fn(() => ({ wasActive: false })),
}));

vi.mock('../../../rules/effects/expirations.js', () => ({
    addExpiration: vi.fn(),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    setRuntimeValue: vi.fn(),
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

import { handle, isSilenceActive } from './silenceHandler.js';
import { toggleBuff } from '../../common/buffToggle.js';
import { addExpiration } from '../../../rules/effects/expirations.js';
import { setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { postLogEntry } from '../../../shared/logPoster.js';
import { isSilenceActive as isSilenceActiveService } from '../../../rules/features/silenceService.js';

const campaignName = 'test-campaign';
const casterName = 'ClericBoy';

function makePlayerStats(overrides = {}) {
    return {
        name: casterName,
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
    beforeEach(() => {
        vi.clearAllMocks();
        toggleBuff.mockReturnValue({ wasActive: false });
        getCombatContext.mockResolvedValue(null);
    });

    describe('handle', () => {
        describe('activation (not previously active)', () => {
            it('returns popup with automation_info type', async () => {
                const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

                expect(result.type).toBe('popup');
                expect(result.payload.type).toBe('automation_info');
                expect(result.payload.name).toBe('Silence');
                expect(result.payload.automationType).toBe('silence');
            });

            it('includes description with aoe radius in activation message', async () => {
                const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

                expect(result.payload.description).toContain('20-foot-radius');
                expect(result.payload.description).toContain('Sphere of silence');
                expect(result.payload.description).toContain('activated');
            });

            it('uses custom aoeRadius from automation when provided', async () => {
                const action = makeAction({ automation: { aoeRadius: 30 } });
                const result = await handle(action, makePlayerStats(), campaignName, null);

                expect(result.payload.description).toContain('30-foot-radius');
            });

            it('defaults aoeRadius to 20 when automation has no aoeRadius', async () => {
                const action = makeAction({ automation: {} });
                const result = await handle(action, makePlayerStats(), campaignName, null);

                expect(result.payload.description).toContain('20-foot-radius');
            });

            it('calls toggleBuff with correct parameters', async () => {
                await handle(makeAction(), makePlayerStats(), campaignName, null);

                expect(toggleBuff).toHaveBeenCalledWith(
                    casterName,
                    'Silence',
                    expect.objectContaining({
                        type: 'silence',
                        aoeRadius: 20,
                        effect: 'silence',
                    }),
                    campaignName,
                );
            });

            it('sets runtime values for silence state', async () => {
                await handle(makeAction(), makePlayerStats(), campaignName, null);

                expect(setRuntimeValue).toHaveBeenCalledWith(
                    casterName, 'silenceCaster', true, campaignName,
                );
                expect(setRuntimeValue).toHaveBeenCalledWith(
                    casterName, 'silenceRadius', 20, campaignName,
                );
            });

            it('sets silence center grid when combat context exists with caster position', async () => {
                getCombatContext.mockResolvedValue({
                    players: [{ name: casterName, gridX: 5, gridY: 10 }],
                });

                await handle(makeAction(), makePlayerStats(), campaignName, null);

                expect(setRuntimeValue).toHaveBeenCalledWith(
                    casterName,
                    'silenceCenter',
                    '{"gridX":5,"gridY":10}',
                    campaignName,
                );
            });

            it('sets silence center to null when combat context has no caster position', async () => {
                getCombatContext.mockResolvedValue({
                    players: [{ name: 'OtherCleric', gridX: 3, gridY: 7 }],
                });

                await handle(makeAction(), makePlayerStats(), campaignName, null);

                expect(setRuntimeValue).toHaveBeenCalledWith(
                    casterName,
                    'silenceCenter',
                    null,
                    campaignName,
                );
            });

            it('sets silence center to null when combat context is null', async () => {
                getCombatContext.mockResolvedValue(null);

                await handle(makeAction(), makePlayerStats(), campaignName, null);

                expect(setRuntimeValue).toHaveBeenCalledWith(
                    casterName,
                    'silenceCenter',
                    null,
                    campaignName,
                );
            });

            it('sets silence center to null when caster grid position is incomplete', async () => {
                getCombatContext.mockResolvedValue({
                    players: [{ name: casterName, gridX: 5, gridY: null }],
                });

                await handle(makeAction(), makePlayerStats(), campaignName, null);

                expect(setRuntimeValue).toHaveBeenCalledWith(
                    casterName,
                    'silenceCenter',
                    null,
                    campaignName,
                );
            });

            it('adds expiration to remove the buff', async () => {
                await handle(makeAction(), makePlayerStats(), campaignName, null);

                expect(addExpiration).toHaveBeenCalledWith(
                    casterName,
                    casterName,
                    [{ type: 'remove_active_buff', buffName: 'Silence' }],
                    campaignName,
                );
            });

            it('posts log entry for ability use', async () => {
                await handle(makeAction(), makePlayerStats(), campaignName, null);

                expect(postLogEntry).toHaveBeenCalledWith(campaignName, {
                    type: 'ability_use',
                    characterName: casterName,
                    abilityName: 'Silence',
                    description: expect.stringContaining('cast Silence'),
                    timestamp: expect.any(Number),
                });
            });

            it('includes aoe radius in log description', async () => {
                const action = makeAction({ automation: { aoeRadius: 30 } });

                await handle(action, makePlayerStats(), campaignName, null);

                expect(postLogEntry).toHaveBeenCalledWith(
                    campaignName,
                    expect.objectContaining({
                        description: expect.stringContaining('30-foot-radius'),
                    }),
                );
            });

            it('passes automation object in popup payload', async () => {
                const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

                expect(result.payload.automation).toEqual(makeAction().automation);
            });
        });

        describe('deactivation (previously active)', () => {
            it('returns popup with ended description', async () => {
                toggleBuff.mockReturnValue({ wasActive: true });

                const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

                expect(result.payload.description).toBe('Silence ended');
            });

            it('resets runtime values to false/null', async () => {
                toggleBuff.mockReturnValue({ wasActive: true });

                await handle(makeAction(), makePlayerStats(), campaignName, null);

                expect(setRuntimeValue).toHaveBeenCalledWith(
                    casterName, 'silenceCaster', false, campaignName,
                );
                expect(setRuntimeValue).toHaveBeenCalledWith(
                    casterName, 'silenceCenter', null, campaignName,
                );
                expect(setRuntimeValue).toHaveBeenCalledWith(
                    casterName, 'silenceRadius', null, campaignName,
                );
            });

            it('does not add expiration when deactivating', async () => {
                toggleBuff.mockReturnValue({ wasActive: true });

                await handle(makeAction(), makePlayerStats(), campaignName, null);

                expect(addExpiration).not.toHaveBeenCalled();
            });

            it('does not post log entry when deactivating', async () => {
                toggleBuff.mockReturnValue({ wasActive: true });

                await handle(makeAction(), makePlayerStats(), campaignName, null);

                expect(postLogEntry).not.toHaveBeenCalled();
            });

            it('includes automation in popup payload when ending', async () => {
                toggleBuff.mockReturnValue({ wasActive: true });

                const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

                expect(result.payload.automation).toEqual(makeAction().automation);
            });
        });

        describe('automation field variations', () => {
            it('uses action name from automation field in payload', async () => {
                const action = makeAction({ automation: { type: 'custom_silence' } });
                const result = await handle(action, makePlayerStats(), campaignName, null);

                expect(result.payload.automationType).toBe('custom_silence');
            });
        });
    });

    describe('isSilenceActive', () => {
        it('delegates to silenceService and returns its result true', () => {
            isSilenceActiveService.mockReturnValue(true);

            const result = isSilenceActive(casterName, campaignName);

            expect(result).toBe(true);
            expect(isSilenceActiveService).toHaveBeenCalledWith(casterName, campaignName);
        });

        it('delegates to silenceService and returns its result false', () => {
            isSilenceActiveService.mockReturnValue(false);

            const result = isSilenceActive(casterName, campaignName);

            expect(result).toBe(false);
            expect(isSilenceActiveService).toHaveBeenCalledWith(casterName, campaignName);
        });
    });
});
