// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../common/buffToggle.js', () => ({
    toggleBuff: vi.fn(() => ({ wasActive: false })),
}));

vi.mock('../../../rules/effects/expirations.js', () => ({
    addExpiration: vi.fn(),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    setRuntimeValue: vi.fn(),
    getRuntimeValue: vi.fn(),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../rules/features/silenceService.js', () => ({
    isSilenceActive: vi.fn(() => false),
    addSilencedTarget: vi.fn(),
    removeSilencedTargets: vi.fn(() => []),
}));

import { handle, handleTargetSelection } from './silenceHandler.js';
import { toggleBuff } from '../../common/buffToggle.js';
import { addExpiration } from '../../../rules/effects/expirations.js';
import { setRuntimeValue, getRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { addEntry } from '../../../ui/logService.js';
import { removeSilencedTargets, addSilencedTarget } from '../../../rules/features/silenceService.js';

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
        removeSilencedTargets.mockReturnValue([]);
    });

    describe('handle', () => {
        describe('activation (not previously active)', () => {
            it('returns popup with silence_target_selection type', async () => {
                const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

                expect(result.type).toBe('popup');
                expect(result.payload.type).toBe('silence_target_selection');
                expect(result.payload.name).toBe('Silence');
                expect(result.payload.automationType).toBe('silence');
                expect(result.payload.automation).toEqual(makeAction().automation);
            });

            it('includes aoeRadius in the payload', async () => {
                const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

                expect(result.payload.aoeRadius).toBe(20);
            });

            it('uses custom aoeRadius from automation', async () => {
                const action = makeAction({ automation: { aoeRadius: 30 } });
                const result = await handle(action, makePlayerStats(), campaignName, null);

                expect(result.payload.aoeRadius).toBe(30);
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

            it('sets silence center based on combat context', async () => {
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

            it('sets silence center to null when caster not found in combat context', async () => {
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

            it('adds expiration to remove the buff and clear silence zone', async () => {
                await handle(makeAction(), makePlayerStats(), campaignName, null);

                expect(addExpiration).toHaveBeenCalledWith({ attackerName: casterName, targetName: casterName, effects: [
                        { type: 'remove_active_buff', buffName: 'Silence' },
                        { type: 'clear_silence_zone', casterName },
                    ], campaignName });
            });

            it('builds target list from combat summary including players and creatures', async () => {
                getCombatContext.mockResolvedValue({
                    players: [
                        { name: 'WizardGirl', gridX: 3, gridY: 4 },
                        { name: casterName, gridX: 5, gridY: 5 },
                    ],
                    creatures: [
                        { name: 'Goblin', gridX: 6, gridY: 6, currentHp: 15, maxHp: 30 },
                        { name: 'Orc', gridX: 7, gridY: 7 },
                    ],
                });

                const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

                expect(result.payload.targets).toHaveLength(4);
                expect(result.payload.targets[0]).toEqual({
                    name: 'WizardGirl',
                    type: 'player',
                });
                expect(result.payload.targets[1]).toEqual({
                    name: casterName,
                    type: 'player',
                });
                expect(result.payload.targets[2]).toEqual({
                    name: 'Goblin',
                    type: 'creature',
                    currentHp: 15,
                    maxHp: 30,
                });
                expect(result.payload.targets[3]).toEqual({
                    name: 'Orc',
                    type: 'creature',
                });
            });

            it('returns empty targets when combat context is null', async () => {
                const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

                expect(result.payload.targets).toHaveLength(0);
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

            it('calls removeSilencedTargets to get silenced targets', async () => {
                toggleBuff.mockReturnValue({ wasActive: true });

                await handle(makeAction(), makePlayerStats(), campaignName, null);

                expect(removeSilencedTargets).toHaveBeenCalledWith(casterName, campaignName);
            });

            it('removes deafened condition from silenced targets', async () => {
                toggleBuff.mockReturnValue({ wasActive: true });
                removeSilencedTargets.mockReturnValue(['Goblin', 'WizardGirl']);
                getRuntimeValue.mockReturnValue(['deafened', 'blinded']);

                await handle(makeAction(), makePlayerStats(), campaignName, null);

                expect(setRuntimeValue).toHaveBeenCalledWith(
                    'Goblin', 'activeConditions', ['blinded'], campaignName,
                );
                expect(setRuntimeValue).toHaveBeenCalledWith(
                    'WizardGirl', 'activeConditions', ['blinded'], campaignName,
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

    describe('handleTargetSelection', () => {
        it('returns early popup when no targets selected', async () => {
            const result = await handleTargetSelection(casterName, [], campaignName, 20);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toBe('No targets selected. Silence not cast.');
        });

        it('sets runtime values for silence state when targets selected', async () => {
            getCombatContext.mockResolvedValue({
                players: [{ name: casterName, gridX: 5, gridY: 5 }],
                creatures: [],
            });

            const result = await handleTargetSelection(casterName, ['Goblin'], campaignName, 20);

            expect(result.type).toBe('popup');
            expect(setRuntimeValue).toHaveBeenCalledWith(casterName, 'silenceCaster', true, campaignName);
            expect(setRuntimeValue).toHaveBeenCalledWith(casterName, 'silenceCenter', '{"gridX":5,"gridY":5}', campaignName);
            expect(setRuntimeValue).toHaveBeenCalledWith(casterName, 'silenceRadius', 20, campaignName);
        });

        it('applies deafened condition to each selected target', async () => {
            getCombatContext.mockResolvedValue({
                players: [{ name: casterName, gridX: 5, gridY: 5 }],
                creatures: [],
            });

            await handleTargetSelection(casterName, ['Goblin'], campaignName, 20);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'Goblin', 'activeConditions', expect.arrayContaining(['deafened']), campaignName,
            );
        });

        it('removes existing deafened before reapplying', async () => {
            getCombatContext.mockResolvedValue({
                players: [{ name: casterName, gridX: 5, gridY: 5 }],
                creatures: [],
            });
            getRuntimeValue.mockReturnValue(['deafened', 'blinded']);

            await handleTargetSelection(casterName, ['Goblin'], campaignName, 20);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'Goblin', 'activeConditions', ['blinded', 'deafened'], campaignName,
            );
        });

        it('adds silenced target to campaign targetEffects', async () => {
            getCombatContext.mockResolvedValue({
                players: [{ name: casterName, gridX: 5, gridY: 5 }],
                creatures: [],
            });

            await handleTargetSelection(casterName, ['Goblin'], campaignName, 20);

            expect(addSilencedTarget).toHaveBeenCalledWith(casterName, 'Goblin', campaignName);
        });

        it('adds expiration to remove deafened from each target', async () => {
            getCombatContext.mockResolvedValue({
                players: [{ name: casterName, gridX: 5, gridY: 5 }],
                creatures: [],
            });

            await handleTargetSelection(casterName, ['Goblin'], campaignName, 20);

            expect(addExpiration).toHaveBeenCalledWith({ attackerName: casterName, targetName: 'Goblin', effects: [{ type: 'condition', condition: 'deafened' }], campaignName });
        });

        it('posts condition log entry for each target', async () => {
            getCombatContext.mockResolvedValue({
                players: [{ name: casterName, gridX: 5, gridY: 5 }],
                creatures: [],
            });

            await handleTargetSelection(casterName, ['Goblin'], campaignName, 20);

            expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
                type: 'condition',
                action: 'applied',
                characterName: 'Goblin',
                condition: 'Deafened',
                reason: 'Silence spell',
                note: expect.stringContaining('Goblin'),
                timestamp: expect.any(Number),
            }));
        });

        it('posts ability_use log entry with summary', async () => {
            getCombatContext.mockResolvedValue({
                players: [{ name: casterName, gridX: 5, gridY: 5 }],
                creatures: [],
            });

            await handleTargetSelection(casterName, ['Goblin'], campaignName, 20);

            expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
                type: 'ability_use',
                characterName: casterName,
                abilityName: 'Silence',
                description: expect.stringContaining('Goblin is Deafened'),
                timestamp: expect.any(Number),
            }));
        });

        it('adds expiration to remove buff and clear silence zone', async () => {
            getCombatContext.mockResolvedValue({
                players: [{ name: casterName, gridX: 5, gridY: 5 }],
                creatures: [],
            });

            await handleTargetSelection(casterName, ['Goblin'], campaignName, 20);

            expect(addExpiration).toHaveBeenCalledWith({ attackerName: casterName, targetName: casterName, effects: [
                    { type: 'remove_active_buff', buffName: 'Silence' },
                    { type: 'clear_silence_zone', casterName },
                ], campaignName });
        });

        it('returns popup with correct summary', async () => {
            getCombatContext.mockResolvedValue({
                players: [{ name: casterName, gridX: 5, gridY: 5 }],
                creatures: [],
            });

            const result = await handleTargetSelection(casterName, ['Goblin', 'Orc'], campaignName, 20);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Silence');
            expect(result.payload.description).toContain('Silence affects 2 creature(s)');
            expect(result.payload.description).toContain('Goblin is Deafened');
            expect(result.payload.description).toContain('Orc is Deafened');
        });

        it('handles targets passed as strings', async () => {
            getCombatContext.mockResolvedValue({
                players: [{ name: casterName, gridX: 5, gridY: 5 }],
                creatures: [],
            });

            await handleTargetSelection(casterName, ['Goblin'], campaignName, 20);

            expect(addSilencedTarget).toHaveBeenCalledWith(casterName, 'Goblin', campaignName);
        });

        it('handles targets passed as objects with name property', async () => {
            getCombatContext.mockResolvedValue({
                players: [{ name: casterName, gridX: 5, gridY: 5 }],
                creatures: [],
            });

            await handleTargetSelection(casterName, [{ name: 'Goblin' }], campaignName, 20);

            expect(addSilencedTarget).toHaveBeenCalledWith(casterName, 'Goblin', campaignName);
        });
    });
});
