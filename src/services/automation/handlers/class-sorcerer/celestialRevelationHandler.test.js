// @maintained-by-ai
// Celestial Revelation dispatcher contract: level/uses gates (shared via
// celestialRevelationGates), option storage, buff arming, and exact popup
// copy. Deterministic — all collaborators mocked, no timers, no DOM.
// Callee halves owned elsewhere: setCondition internals → conditionHandler
// (see conditionHandler-necroticShroud.test.js), rest re-arm constants →
// restRules-constants.cla048-celestial.test.js, rider consumption →
// attackRollBonuses-cla048-celestial-rider.test.js, modal UI →
// CelestialRevelationModal.test.jsx (mocks this handler).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handle, confirmCelestialRevelation } from './celestialRevelationHandler.js';
import * as runtimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as expirations from '../../../rules/effects/expirations.js';
import * as buffToggle from '../../common/buffToggle.js';
import * as logService from '../../../ui/logService.js';
import * as conditionHandler from '../buffs/conditionHandler.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(async () => {}),
}));

vi.mock('../../../rules/effects/expirations.js', () => ({
    addExpiration: vi.fn(),
    applyAuraDamage: vi.fn(),
}));

vi.mock('../../common/buffToggle.js', () => ({
    toggleBuff: vi.fn(() => ({ wasActive: false, buffs: [], isActive: false })),
}));

vi.mock('../buffs/buffHandler.js', () => ({
    handle: vi.fn(() => null),
}));

vi.mock('../buffs/conditionHandler.js', () => ({
    handle: vi.fn(() => ({
        type: 'modal',
        modalName: 'setCondition',
        payload: {
            conditionName: 'frightened',
            saveType: 'CHA',
            rangeFeet: 10,
        },
    })),
}));

vi.mock('../combat/saveAttackHandler.js', () => ({
    handle: vi.fn(() => null),
}));

vi.mock('../combat/attackRiderHandler.js', () => ({
    handle: vi.fn(() => null),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

const campaignName = 'test-campaign';
const playerName = 'SorcererBoy';
const defaultUsesKey = '_celestialRevelationUses';

beforeEach(() => {
    vi.clearAllMocks();
    runtimeState.getRuntimeValue.mockReturnValue(null);
});

function makePlayerStats(overrides = {}) {
    return {
        name: playerName,
        level: 3,
        proficiency: 2,
        ...overrides,
    };
}

function makeAction(overrides = {}) {
    return {
        name: 'Celestial Revelation',
        automation: {
            type: 'celestial_revelation',
            minLevel: 3,
            ...overrides.automation,
        },
        ...overrides,
    };
}

describe('celestialRevelationHandler', () => {
    describe('handle', () => {
        it('returns popup with level requirement when below minimum level', async () => {
            const lowLevelStats = makePlayerStats({ level: 1 });

            const result = await handle(makeAction(), lowLevelStats, campaignName, null);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Celestial Revelation');
            expect(result.payload.description).toBe(
                'Celestial Revelation requires character level 3. You are currently level 1.'
            );
            expect(result.payload.automation).toBeDefined();
            expect(expirations.addExpiration).not.toHaveBeenCalled();
            expect(buffToggle.toggleBuff).not.toHaveBeenCalled();
            expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
        });

        it('returns modal when level gate passes (null runtime value defaults to maxUses — allows first use)', async () => {
            const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(result.type).toBe('modal');
            expect(result.modalName).toBe('celestialRevelation');
            expect(result.payload.action).toEqual(makeAction());
            expect(result.payload.playerStats).toEqual(makePlayerStats());
            expect(result.payload.campaignName).toBe(campaignName);
        });

        it('returns popup when uses are depleted', async () => {
            const action = makeAction({ automation: { uses: 1, usesMax: 1 } });
            runtimeState.getRuntimeValue.mockReturnValue(0);

            const result = await handle(action, makePlayerStats(), campaignName, null);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Celestial Revelation');
            expect(result.payload.description).toBe(
                'Celestial Revelation has been used and cannot be used again until a Long Rest.'
            );
            expect(expirations.addExpiration).not.toHaveBeenCalled();
            expect(buffToggle.toggleBuff).not.toHaveBeenCalled();
            expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
        });

        it('treats maxUses of 0 as unlimited (skips uses check)', async () => {
            const action = makeAction({ automation: { uses: 0, usesMax: 0 } });
            runtimeState.getRuntimeValue.mockReturnValue(0);

            const result = await handle(action, makePlayerStats(), campaignName, null);

            expect(result.type).toBe('modal');
            expect(result.modalName).toBe('celestialRevelation');
        });

        it('uses usesMax over uses when both are provided', async () => {
            const action = makeAction({ automation: { uses: 0, usesMax: 1 } });
            runtimeState.getRuntimeValue.mockReturnValue(0);

            const result = await handle(action, makePlayerStats(), campaignName, null);

            // maxUses must read from usesMax (1), not uses (0): the depletion
            // check stays active and refuses. If uses won, maxUses would be 0,
            // the check would be skipped, and the modal would wrongly open.
            expect(result.type).toBe('popup');
            expect(result.payload.description).toBe(
                'Celestial Revelation has been used and cannot be used again until a Long Rest.'
            );
        });

        it('uses custom resourceKey when provided', async () => {
            const action = makeAction({ automation: { resourceKey: 'customUsesKey', uses: 1 } });
            runtimeState.getRuntimeValue.mockReturnValue(1);

            await handle(action, makePlayerStats(), campaignName, null);

            expect(runtimeState.getRuntimeValue).toHaveBeenCalledWith(
                playerName,
                'customUsesKey',
                campaignName
            );
        });

        it('uses default key when no resourceKey provided', async () => {
            runtimeState.getRuntimeValue.mockReturnValue(1);

            await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(runtimeState.getRuntimeValue).toHaveBeenCalledWith(
                playerName,
                defaultUsesKey,
                campaignName
            );
        });

        it('handles string "0" representation of depleted uses from runtime storage', async () => {
            const action = makeAction({ automation: { uses: 1, usesMax: 1 } });
            runtimeState.getRuntimeValue.mockReturnValue('0');

            const result = await handle(action, makePlayerStats(), campaignName, null);

            expect(result.type).toBe('popup');
        });
    });

    describe('confirmCelestialRevelation', () => {
        it('returns popup with level requirement when below minimum level', async () => {
            const lowLevelStats = makePlayerStats({ level: 1 });

            const result = await confirmCelestialRevelation(
                lowLevelStats,
                'Heavenly Wings',
                campaignName
            );

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Celestial Revelation');
            expect(result.payload.description).toBe(
                'Celestial Revelation requires character level 3. You are currently level 1.'
            );
            expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
            expect(expirations.addExpiration).not.toHaveBeenCalled();
            expect(buffToggle.toggleBuff).not.toHaveBeenCalled();
            expect(logService.addEntry).not.toHaveBeenCalled();
        });

        it('decrements uses by 1 when uses are available', async () => {
            runtimeState.getRuntimeValue.mockReturnValue(1);

            await confirmCelestialRevelation(makePlayerStats(), 'Heavenly Wings', campaignName);

            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                playerName,
                defaultUsesKey,
                0,
                campaignName
            );
        });

        it('skips decrement and side effects when uses are depleted', async () => {
            runtimeState.getRuntimeValue.mockReturnValue(0);

            const result = await confirmCelestialRevelation(
                makePlayerStats(),
                'Heavenly Wings',
                campaignName
            );

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Celestial Revelation');
            expect(result.payload.description).toBe(
                'Celestial Revelation has been used and cannot be used again until a Long Rest.'
            );
            expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
            expect(expirations.addExpiration).not.toHaveBeenCalled();
            expect(buffToggle.toggleBuff).not.toHaveBeenCalled();
            expect(logService.addEntry).not.toHaveBeenCalled();
        });

        it('stores chosen transformation option in runtime state', async () => {
            runtimeState.getRuntimeValue.mockReturnValue(1);

            await confirmCelestialRevelation(makePlayerStats(), 'Inner Radiance', campaignName);

            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                playerName,
                '_celestialRevelationOption',
                'Inner Radiance',
                campaignName
            );
        });

        it('CLA-048: adds expiration with rounds:10 for the 1-minute buff', async () => {
            runtimeState.getRuntimeValue.mockReturnValue(1);

            await confirmCelestialRevelation(makePlayerStats(), 'Necrotic Shroud', campaignName);

            // rounds must be 10 (1 minute) — omitted rounds => Infinity clock, buff never expires.
            expect(expirations.addExpiration).toHaveBeenCalledWith({ attackerName: playerName, targetName: playerName, effects: [{ type: 'remove_active_buff', buffName: 'Necrotic Shroud' }], campaignName, rounds: 10 });
        });

        it('calls toggleBuff with correct effect for each transformation option', async () => {
            runtimeState.getRuntimeValue.mockReturnValue(1);

            await confirmCelestialRevelation(makePlayerStats(), 'Heavenly Wings', campaignName);
            expect(buffToggle.toggleBuff).toHaveBeenCalledWith(
                playerName,
                'Heavenly Wings',
                { effect: 'fly_speed_equals_walk_speed', duration: '1_minute' },
                campaignName,
                playerName
            );

            await confirmCelestialRevelation(makePlayerStats(), 'Inner Radiance', campaignName);
            expect(buffToggle.toggleBuff).toHaveBeenCalledWith(
                playerName,
                'Inner Radiance',
                { effect: 'inner_radiance', duration: '1_minute' },
                campaignName,
                playerName
            );

            await confirmCelestialRevelation(makePlayerStats(), 'Necrotic Shroud', campaignName);
            expect(buffToggle.toggleBuff).toHaveBeenCalledWith(
                playerName,
                'Necrotic Shroud',
                { effect: 'necrotic_shroud', duration: '1_minute' },
                campaignName,
                playerName
            );
        });

        it('falls back to the chosen option name as buff effect for unknown options', async () => {
            runtimeState.getRuntimeValue.mockReturnValue(1);

            await confirmCelestialRevelation(makePlayerStats(), 'Astral Mantle', campaignName);

            expect(buffToggle.toggleBuff).toHaveBeenCalledWith(
                playerName,
                'Astral Mantle',
                { effect: 'Astral Mantle', duration: '1_minute' },
                campaignName,
                playerName
            );
        });

        it('returns popup with transformation description for each option', async () => {
            const cases = [
                {
                    option: 'Heavenly Wings',
                    expectedTexts: [
                        'Transforming into Heavenly Wings',
                        'Two spectral wings sprout from your back',
                        '1 minute or until you end it',
                    ],
                },
                {
                    option: 'Inner Radiance',
                    expectedTexts: [
                        'Transforming into Inner Radiance',
                        'shed Bright Light in a 10-foot radius',
                        '1 minute or until you end it',
                    ],
                },
                {
                    option: 'Unknown Option',
                    expectedTexts: [
                        'Transforming into Unknown Option',
                        '1 minute or until you end it',
                    ],
                },
            ];

            for (const { option, expectedTexts } of cases) {
                runtimeState.getRuntimeValue.mockReturnValue(1);
                const result = await confirmCelestialRevelation(
                    makePlayerStats(),
                    option,
                    campaignName
                );
                expect(result.type).toBe('popup');
                expect(result.payload.type).toBe('automation_info');
                expect(result.payload.name).toBe('Celestial Revelation');
                for (const text of expectedTexts) {
                    expect(result.payload.description).toContain(text);
                }
            }
        });

        it('returns setCondition modal for Necrotic Shroud', async () => {
            runtimeState.getRuntimeValue.mockReturnValue(1);

            const result = await confirmCelestialRevelation(
                makePlayerStats(),
                'Necrotic Shroud',
                campaignName
            );

            expect(result.type).toBe('setCondition');
            expect(result.payload.conditionName).toBe('frightened');
            expect(result.payload.saveType).toBe('CHA');
            expect(result.payload.rangeFeet).toBe(10);
        });

        it('CLA-239: passes explicit saveAbility CHA to conditionHandler for Necrotic Shroud', async () => {
            runtimeState.getRuntimeValue.mockReturnValue(1);

            await confirmCelestialRevelation(
                makePlayerStats({ level: 14, proficiency: 5 }),
                'Necrotic Shroud',
                campaignName
            );

            expect(conditionHandler.handle).toHaveBeenCalled();
            const call = conditionHandler.handle.mock.calls.at(-1);
            const auto = call[0].automation;
            expect(auto.type).toBe('set_condition');
            expect(auto.saveType).toBe('CHA');
            expect(auto.saveAbility).toBe('CHA');
            expect(auto.saveDc).toBe('ability');
            expect(auto.duration).toBe('until_end_of_next_turn');
            expect(call[3]).toBeNull();
        });

        it('uses player name for all runtime state and buff operations', async () => {
            runtimeState.getRuntimeValue.mockReturnValue(1);

            const customStats = makePlayerStats({ name: 'CustomSorcerer' });

            await confirmCelestialRevelation(customStats, 'Heavenly Wings', campaignName);

            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                'CustomSorcerer',
                '_celestialRevelationUses',
                0,
                campaignName
            );
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                'CustomSorcerer',
                '_celestialRevelationOption',
                'Heavenly Wings',
                campaignName
            );
            expect(expirations.addExpiration).toHaveBeenCalledWith({ attackerName: 'CustomSorcerer', targetName: 'CustomSorcerer', effects: expect.any(Array), campaignName, rounds: 10 });
            expect(buffToggle.toggleBuff).toHaveBeenCalledWith(
                'CustomSorcerer',
                'Heavenly Wings',
                expect.any(Object),
                campaignName,
                'CustomSorcerer'
            );
        });

        it('CLA-048: logs exactly ONE ability_use entry with correct shape (no attackRiderHandler double log)', async () => {
            runtimeState.getRuntimeValue.mockReturnValue(1);

            await confirmCelestialRevelation(makePlayerStats(), 'Heavenly Wings', campaignName);

            expect(logService.addEntry).toHaveBeenCalledTimes(1);
            expect(logService.addEntry).toHaveBeenCalledWith(
                campaignName,
                expect.objectContaining({
                    type: 'ability_use',
                    characterName: playerName,
                    abilityName: 'Heavenly Wings',
                    description: 'Heavenly Wings used',
                })
            );
        });

        it('CLA-048: no handleAttackRider dispatch — rider consumed by pipeline step', async () => {
            runtimeState.getRuntimeValue.mockReturnValue(1);
            const { handle: riderHandle } = await import('../combat/attackRiderHandler.js');

            await confirmCelestialRevelation(makePlayerStats(), 'Heavenly Wings', campaignName);

            expect(riderHandle).not.toHaveBeenCalled();
        });

        it('handles addEntry rejection gracefully', async () => {
            runtimeState.getRuntimeValue.mockReturnValue(1);
            logService.addEntry.mockRejectedValueOnce(new Error('log fail'));

            const result = await confirmCelestialRevelation(
                makePlayerStats(),
                'Heavenly Wings',
                campaignName
            );

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
        });

        it('BUG CLA-198: Inner Radiance arms innerRadianceActive flag only — no burst aura damage at activation', async () => {
            runtimeState.getRuntimeValue.mockReturnValue(1);

            await confirmCelestialRevelation(makePlayerStats(), 'Inner Radiance', campaignName);

            // The recurring tick is applied by applyTurnStartEffects at the turn
            // boundary — activation must only arm the flag, never damage immediately.
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                playerName,
                'innerRadianceActive',
                true,
                campaignName
            );
            expect(expirations.applyAuraDamage).not.toHaveBeenCalled();
        });

        it('does not arm innerRadianceActive for other transformation options', async () => {
            runtimeState.getRuntimeValue.mockReturnValue(1);

            await confirmCelestialRevelation(makePlayerStats(), 'Heavenly Wings', campaignName);

            expect(runtimeState.setRuntimeValue).not.toHaveBeenCalledWith(
                playerName,
                'innerRadianceActive',
                expect.anything(),
                campaignName
            );
        });
    });
});
