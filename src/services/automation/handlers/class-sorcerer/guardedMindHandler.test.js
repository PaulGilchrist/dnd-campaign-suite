// @maintained-by-ai
// Deterministic CLA-155 contract suite for guardedMindHandler (Fighter Psi Warrior lv10):
// spend gate, condition-entry normalisation, merged-write, meta purge, logging.
// All runtime reads route through mockRuntime (key-routed, read-order independent);
// writes/log entries are exact-key pins. Pure behaviour — no timers, no UI moving parts.
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

// Key-routed runtime mock: dispatches by the key the handler reads, so tests
// are immune to read-order changes (and a wrong-key read shows as undefined).
function mockRuntime(values) {
    runtimeState.getRuntimeValue.mockImplementation((_name, key) => values[key]);
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
            mockRuntime({ psionicEnergy: 0, activeConditions: ['charmed'] });

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
                mockRuntime({ psionicEnergy: 5, activeConditions: storedConditions });

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
            mockRuntime({ psionicEnergy: null, activeConditions: ['charmed'] });

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
            mockRuntime({ psionicEnergy: null, activeConditions: ['frightened'] });

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

        it('refuses with zero spend when no max can be resolved (unarmored resource, no fallback row)', async () => {
            mockRuntime({ psionicEnergy: null, activeConditions: ['charmed'] });

            const stats = makePlayerStats({ _trackedResources: { psionicEnergy: { max: 0 } } });
            const result = await handle(makeAction(), stats, campaignName);

            expect(result.payload.description).toContain('No Psionic Energy remaining');
            expect(runtimeState.setRuntimeBatch).not.toHaveBeenCalled();
            expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
            expect(logService.addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
                automationType: 'guarded_mind_refused',
                automationDetail: 'no_psionic_energy',
            }));
        });
    });

    describe('condition removal', () => {
        it('ends eligible conditions and spends exactly one die in one merged write', async () => {
            mockRuntime({ psionicEnergy: 5, activeConditions: ['charmed', 'blinded'] });

            const action = makeAction();
            const result = await handle(action, makePlayerStats(), campaignName);

            expect(runtimeState.getRuntimeValue).toHaveBeenCalledWith(playerName, 'psionicEnergy', campaignName);
            expect(runtimeState.getRuntimeValue).toHaveBeenCalledWith(playerName, 'activeConditions', campaignName);
            expect(runtimeState.setRuntimeBatch).toHaveBeenCalledTimes(1);
            expect(runtimeState.setRuntimeBatch).toHaveBeenCalledWith(
                playerName,
                { psionicEnergy: 4, activeConditions: ['blinded'] },
                campaignName
            );
            // no activeConditionMeta present → no stray per-key write
            expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toBe('Guarded Mind: Ended Charmed. Psionic Energy: 4/6.');
        });

        it('normalises mixed string/object condition entries case-insensitively and keeps untouched entries intact', async () => {
            mockRuntime({
                psionicEnergy: 5,
                activeConditions: ['CHARMED', 'blinded', { condition: 'Frightened' }, { key: 'dazed' }],
            });

            const result = await handle(makeAction(), makePlayerStats(), campaignName);

            expect(result.payload.description).toContain('Ended Charmed and Frightened');
            expect(runtimeState.setRuntimeBatch).toHaveBeenCalledWith(
                playerName,
                expect.objectContaining({
                    psionicEnergy: 4,
                    activeConditions: ['blinded', { key: 'dazed' }],
                }),
                campaignName
            );
        });

        it('logs one canonical condition-removed event per removed condition plus ability_use', async () => {
            mockRuntime({ psionicEnergy: 2, activeConditions: ['charmed', 'frightened', 'poisoned'] });

            await handle(makeAction(), makePlayerStats(), campaignName);

            expect(combatLoggingService.logConditionEvent).toHaveBeenCalledTimes(2);
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
            expect(useEntry[1].description).toBe('TestHero used Guarded Mind and ended Charmed and Frightened. Psionic Energy: 1/6.');
        });

        it('purges activeConditionMeta for removed conditions only', async () => {
            mockRuntime({
                psionicEnergy: 3,
                activeConditions: ['charmed', 'blinded'],
                activeConditionMeta: { charmed: { dc: 10, ability: 'wis' }, blinded: { dc: 12 } },
            });

            await handle(makeAction(), makePlayerStats(), campaignName);

            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                playerName, 'activeConditionMeta', { blinded: { dc: 12 } }, campaignName
            );
        });
    });

    describe('custom resource config', () => {
        it('uses custom resource key from automation config', async () => {
            mockRuntime({ runeCharge: 8, activeConditions: ['charmed'] });

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
            mockRuntime({ psionicEnergy: 5, activeConditions: ['charmed'] });
            logService.addEntry.mockRejectedValueOnce(new Error('log fail'));

            const result = await handle(makeAction(), makePlayerStats(), campaignName);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
        });
    });
});
