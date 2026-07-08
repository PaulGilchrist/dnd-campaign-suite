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

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

import { handle } from './silenceHandler.js';
import { toggleBuff } from '../../common/buffToggle.js';
import { addExpiration } from '../../../rules/effects/expirations.js';
import { setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { addEntry } from '../../../ui/logService.js';

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
            it('returns popup with automation_info type and correct payload', async () => {
                const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

                expect(result.type).toBe('popup');
                expect(result.payload.type).toBe('automation_info');
                expect(result.payload.name).toBe('Silence');
                expect(result.payload.automationType).toBe('silence');
                expect(result.payload.automation).toEqual(makeAction().automation);
            });

            it('includes description with aoe radius in activation message', async () => {
                const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

                expect(result.payload.description).toContain('20-foot-radius');
                expect(result.payload.description).toContain('Sphere of silence');
                expect(result.payload.description).toContain('activated');
            });

            it('uses custom aoeRadius from automation in description and log', async () => {
                const action = makeAction({ automation: { aoeRadius: 30 } });
                const result = await handle(action, makePlayerStats(), campaignName, null);

                expect(result.payload.description).toContain('30-foot-radius');

                expect(addEntry).toHaveBeenCalledWith(
                    campaignName,
                    expect.objectContaining({
                        description: expect.stringContaining('30-foot-radius'),
                    }),
                );
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

            it('sets runtime values for silence state on activation', async () => {
                await handle(makeAction(), makePlayerStats(), campaignName, null);

                expect(setRuntimeValue).toHaveBeenCalledWith(
                    casterName, 'silenceCaster', true, campaignName,
                );
                expect(setRuntimeValue).toHaveBeenCalledWith(
                    casterName, 'silenceRadius', 20, campaignName,
                );
            });

            it('sets silence center based on combat context or null when unavailable', async () => {
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

                vi.clearAllMocks();
                toggleBuff.mockReturnValue({ wasActive: false });
                getCombatContext.mockResolvedValue({ players: [{ name: 'OtherCleric', gridX: 3, gridY: 7 }] });
                await handle(makeAction(), makePlayerStats(), campaignName, null);
                expect(setRuntimeValue).toHaveBeenCalledWith(
                    casterName, 'silenceCenter', null, campaignName,
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

                expect(addEntry).toHaveBeenCalledWith(campaignName, {
                    type: 'ability_use',
                    characterName: casterName,
                    abilityName: 'Silence',
                    description: expect.stringContaining('cast Silence'),
                    timestamp: expect.any(Number),
                });
            });
        });

        describe('deactivation (previously active)', () => {
            it('returns popup with ended description', async () => {
                toggleBuff.mockReturnValue({ wasActive: true });

                const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

                expect(result.payload.description).toBe('Silence ended');
                expect(result.payload.automation).toEqual(makeAction().automation);
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

            it('does not add expiration or post log when deactivating', async () => {
                toggleBuff.mockReturnValue({ wasActive: true });

                await handle(makeAction(), makePlayerStats(), campaignName, null);

                expect(addExpiration).not.toHaveBeenCalled();
                expect(addEntry).not.toHaveBeenCalled();
            });
        });
    });

});
// @cleaned-by-ai
