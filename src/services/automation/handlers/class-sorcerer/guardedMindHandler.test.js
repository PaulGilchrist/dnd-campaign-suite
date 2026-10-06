import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handle } from './guardedMindHandler.js';
import * as runtimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as logService from '../../../ui/logService.js';
import * as combatLoggingService from '../../../encounters/combatLoggingService.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
    setRuntimeBatch: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../encounters/combatLoggingService.js', () => ({
    logConditionEvent: vi.fn(() => Promise.resolve()),
}));

const campaignName = 'test-campaign';
const playerName = 'TestHero';

function makeAction(overrides = {}) {
    return {
        name: 'Guarded Mind',
        automation: { type: 'guarded_mind', resource: 'psionicEnergy', ...overrides.automation },
    };
}

function makePlayerStats(overrides = {}) {
    return {
        name: playerName,
        level: 10,
        _trackedResources: { psionicEnergy: { max: 6 } },
        ...overrides,
    };
}

describe('guardedMindHandler (CLA-155)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        runtimeState.getRuntimeValue.mockReturnValue(null);
        runtimeState.setRuntimeValue.mockResolvedValue(undefined);
        runtimeState.setRuntimeBatch.mockResolvedValue(undefined);
        logService.addEntry.mockResolvedValue(undefined);
        combatLoggingService.logConditionEvent.mockResolvedValue(undefined);
    });

    describe('spend gate', () => {
        it('refuses with zero spend when no psionic energy remains (explicit 0 is honored)', async () => {
            runtimeState.getRuntimeValue
                .mockReturnValueOnce(0)
                .mockReturnValueOnce(['charmed']);

            const result = await handle(makeAction(), makePlayerStats(), campaignName);

            expect(result.payload.description).toContain('No Psionic Energy remaining');
            expect(runtimeState.setRuntimeBatch).not.toHaveBeenCalled();
            expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
            expect(logService.addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
                type: 'automation',
                automationType: 'guarded_mind_refused',
                automationDetail: 'no_psionic_energy',
            }));
        });

        it('refuses with zero spend when no Charmed/Frightened condition is present (CLA-155: spend-without-effect is FAIL)', async () => {
            const cases = [[], ['blinded', 'poisoned'], null];
            for (const storedConditions of cases) {
                runtimeState.getRuntimeValue
                    .mockReturnValueOnce(5)
                    .mockReturnValueOnce(storedConditions);

                const result = await handle(makeAction(), makePlayerStats(), campaignName);

                expect(result.payload.description).toContain('not Charmed or Frightened');
            }
            expect(runtimeState.setRuntimeBatch).not.toHaveBeenCalled();
            expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
            expect(combatLoggingService.logConditionEvent).not.toHaveBeenCalled();
            expect(logService.addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
                type: 'automation',
                automationType: 'guarded_mind_refused',
                automationDetail: 'not_charmed_or_frightened',
            }));
            expect(logService.addEntry.mock.calls.every(
                ([, entry]) => entry.type !== 'ability_use'
            )).toBe(true);
        });

        it('falls back to max instead of refusing when the resource key is null (CLA-027 null = re-armed)', async () => {
            runtimeState.getRuntimeValue
                .mockReturnValueOnce(null)
                .mockReturnValueOnce(['charmed']);

            const result = await handle(makeAction(), makePlayerStats(), campaignName);

            expect(result.payload.description).toContain('Ended Charmed');
            expect(result.payload.description).toContain('Psionic Energy: 5/6');
            expect(runtimeState.setRuntimeBatch).toHaveBeenCalledWith(
                playerName,
                expect.objectContaining({ psionicEnergy: 5 }),
                campaignName
            );
        });

        it('resolves max from class_levels energy row when tracked resources are stale', async () => {
            runtimeState.getRuntimeValue
                .mockReturnValueOnce(null)
                .mockReturnValueOnce(['frightened']);

            const stats = makePlayerStats({
                level: 18,
                _trackedResources: { psionicEnergy: { max: 0 } },
                class: {
                    name: 'Fighter',
                    subclass: { name: 'Psi Warrior' },
                    class_levels: [{ level: 18, energy: { required_major: 'Psi Warrior', energy_die_num: 12 } }],
                },
            });

            const result = await handle(makeAction(), stats, campaignName);

            expect(result.payload.description).toContain('Psionic Energy: 11/12');
        });
    });

    describe('condition removal', () => {
        it('clears string-entry conditions and spends exactly one die in one merged write', async () => {
            runtimeState.getRuntimeValue
                .mockReturnValueOnce(5)
                .mockReturnValueOnce(['charmed', 'blinded']);

            const result = await handle(makeAction(), makePlayerStats(), campaignName);

            expect(result.payload.description).toContain('Ended Charmed');
            expect(runtimeState.setRuntimeBatch).toHaveBeenCalledTimes(1);
            expect(runtimeState.setRuntimeBatch).toHaveBeenCalledWith(
                playerName,
                { psionicEnergy: 4, activeConditions: ['blinded'] },
                campaignName
            );
        });

        it('clears object-entry conditions ({condition} / {key}) and keeps untouched entries intact', async () => {
            runtimeState.getRuntimeValue
                .mockReturnValueOnce(5)
                .mockReturnValueOnce([
                    { condition: 'charmed' },
                    { key: 'Frightened' },
                    { condition: 'blinded' },
                ]);

            const result = await handle(makeAction(), makePlayerStats(), campaignName);

            expect(result.payload.description).toContain('Ended Charmed and Frightened');
            expect(runtimeState.setRuntimeBatch).toHaveBeenCalledWith(
                playerName,
                expect.objectContaining({
                    psionicEnergy: 4,
                    activeConditions: [{ condition: 'blinded' }],
                }),
                campaignName
            );
        });

        it('is case-insensitive for condition entries', async () => {
            runtimeState.getRuntimeValue
                .mockReturnValueOnce(4)
                .mockReturnValueOnce(['CHARMED', 'Frightened', 'blinded']);

            const result = await handle(makeAction(), makePlayerStats(), campaignName);

            expect(result.payload.description).toContain('Ended Charmed and Frightened');
            expect(runtimeState.setRuntimeBatch).toHaveBeenCalledWith(
                playerName,
                expect.objectContaining({ activeConditions: ['blinded'] }),
                campaignName
            );
        });

        it('logs one canonical condition-removed event per removed condition plus ability_use', async () => {
            runtimeState.getRuntimeValue
                .mockReturnValueOnce(2)
                .mockReturnValueOnce(['charmed', 'frightened', 'poisoned']);

            await handle(makeAction(), makePlayerStats(), campaignName);

            expect(combatLoggingService.logConditionEvent).toHaveBeenCalledWith(expect.objectContaining({
                campaignName, action: 'removed', creatureName: playerName, conditionLabel: 'Charmed',
            }));
            expect(combatLoggingService.logConditionEvent).toHaveBeenCalledWith(expect.objectContaining({
                campaignName, action: 'removed', creatureName: playerName, conditionLabel: 'Frightened',
            }));
            expect(logService.addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
                type: 'ability_use',
                characterName: playerName,
                abilityName: 'Guarded Mind',
            }));
            const useEntry = logService.addEntry.mock.calls.find(([, e]) => e.type === 'ability_use');
            expect(useEntry[1].description).toContain('ended Charmed and Frightened');
        });

        it('purges activeConditionMeta for removed conditions only', async () => {
            runtimeState.getRuntimeValue
                .mockReturnValueOnce(3)
                .mockReturnValueOnce(['charmed', 'blinded'])
                .mockReturnValueOnce({ charmed: { dc: 10, ability: 'wis' }, blinded: { dc: 12 } });

            await handle(makeAction(), makePlayerStats(), campaignName);

            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                playerName, 'activeConditionMeta', { blinded: { dc: 12 } }, campaignName
            );
        });
    });

    describe('custom resource config', () => {
        it('uses custom resource key from automation config', async () => {
            runtimeState.getRuntimeValue
                .mockReturnValueOnce(8)
                .mockReturnValueOnce(['charmed']);

            const customAction = makeAction({ automation: { resource: 'runeCharge' } });

            await handle(customAction, makePlayerStats({ _trackedResources: { runeCharge: { max: 8 } } }), campaignName);

            expect(runtimeState.getRuntimeValue).toHaveBeenCalledWith(
                playerName, 'runeCharge', campaignName
            );
            expect(runtimeState.setRuntimeBatch).toHaveBeenCalledWith(
                playerName, expect.objectContaining({ runeCharge: 7 }), campaignName
            );
        });

        it('handles addEntry rejection gracefully', async () => {
            runtimeState.getRuntimeValue
                .mockReturnValueOnce(5)
                .mockReturnValueOnce(['charmed']);
            logService.addEntry.mockRejectedValueOnce(new Error('log fail'));

            const result = await handle(makeAction(), makePlayerStats(), campaignName);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
        });
    });
});
