// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handle, confirmCelestialRevelation } from './celestialRevelationHandler.js';
import * as runtimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as expirations from '../../../rules/effects/expirations.js';
import * as buffToggle from '../../common/buffToggle.js';

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
        });

        it('returns modal when level gate passes', async () => {
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
        });

        it('returns modal when uses are available', async () => {
            const action = makeAction({ automation: { uses: 1, usesMax: 1 } });
            runtimeState.getRuntimeValue.mockReturnValue(1);

            const result = await handle(action, makePlayerStats(), campaignName, null);

            expect(result.type).toBe('modal');
            expect(result.modalName).toBe('celestialRevelation');
        });

        it('treats maxUses of 0 as unlimited (skips uses check)', async () => {
            const action = makeAction({ automation: { uses: 0, usesMax: 0 } });
            runtimeState.getRuntimeValue.mockReturnValue(0);

            const result = await handle(action, makePlayerStats(), campaignName, null);

            expect(result.type).toBe('modal');
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

        it('uses usesMax over uses when both are provided', async () => {
            const action = makeAction({ automation: { uses: 0, usesMax: 1 } });
            runtimeState.getRuntimeValue.mockReturnValue(1);

            const result = await handle(action, makePlayerStats(), campaignName, null);

            expect(result.type).toBe('modal');
        });

        it('uses uses when usesMax is not provided', async () => {
            const action = makeAction({ automation: { uses: 1 } });
            runtimeState.getRuntimeValue.mockReturnValue(1);

            const result = await handle(action, makePlayerStats(), campaignName, null);

            expect(result.type).toBe('modal');
        });

        it('handles string "0" representation of depleted uses from runtime storage', async () => {
            const action = makeAction({ automation: { uses: 1, usesMax: 1 } });
            runtimeState.getRuntimeValue.mockReturnValue('0');

            const result = await handle(action, makePlayerStats(), campaignName, null);

            expect(result.type).toBe('popup');
        });

        it('uses custom action name in popup messages', async () => {
            const action = makeAction({
                name: 'Custom Revelation',
                automation: { uses: 1, usesMax: 1 },
            });
            runtimeState.getRuntimeValue.mockReturnValue(0);

            const result = await handle(action, makePlayerStats(), campaignName, null);

            expect(result.payload.name).toBe('Custom Revelation');
            expect(result.payload.description).toBe(
                'Custom Revelation has been used and cannot be used again until a Long Rest.'
            );
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

        it('skips decrement and side effects when maxUses is 0', async () => {
            runtimeState.getRuntimeValue.mockReturnValue(0);

            const result = await confirmCelestialRevelation(
                makePlayerStats(),
                'Heavenly Wings',
                campaignName
            );

            expect(result.type).toBe('popup');
            expect(runtimeState.setRuntimeValue).not.toHaveBeenCalledWith(
                playerName,
                defaultUsesKey,
                expect.any(Number),
                campaignName
            );
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

        it('adds expiration for chosen buff after 10 rounds', async () => {
            runtimeState.getRuntimeValue.mockReturnValue(1);

            await confirmCelestialRevelation(makePlayerStats(), 'Necrotic Shroud', campaignName);

            expect(expirations.addExpiration).toHaveBeenCalledWith(
                playerName,
                playerName,
                [{ type: 'remove_active_buff', buffName: 'Necrotic Shroud' }],
                campaignName,
            );
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

        it('returns popup with transformation description for Heavenly Wings', async () => {
            runtimeState.getRuntimeValue.mockReturnValue(1);

            const result = await confirmCelestialRevelation(
                makePlayerStats(),
                'Heavenly Wings',
                campaignName
            );

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Celestial Revelation');
            expect(result.payload.description).toContain('Transforming into Heavenly Wings');
            expect(result.payload.description).toContain(
                'You gain a Fly Speed equal to your Speed'
            );
            expect(result.payload.description).toContain('1 minute or until you end it');
            expect(result.payload.automation).toBeDefined();
        });

        it('returns popup with transformation description for Inner Radiance', async () => {
            runtimeState.getRuntimeValue.mockReturnValue(1);

            const result = await confirmCelestialRevelation(
                makePlayerStats(),
                'Inner Radiance',
                campaignName
            );

            expect(result.payload.description).toContain('Transforming into Inner Radiance');
            expect(result.payload.description).toContain(
                'shed Bright Light in a 10-foot radius'
            );
            expect(result.payload.description).toContain('1 minute or until you end it');
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

        it('handles unknown option with empty description fallback', async () => {
            runtimeState.getRuntimeValue.mockReturnValue(1);

            const result = await confirmCelestialRevelation(
                makePlayerStats(),
                'Unknown Option',
                campaignName
            );

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Celestial Revelation');
            expect(result.payload.description).toContain('Transforming into Unknown Option');
            expect(result.payload.description).toContain('1 minute or until you end it');
        });

        it('uses default key in confirmCelestialRevelation since it does not accept action', async () => {
            runtimeState.getRuntimeValue.mockReturnValue(1);

            // confirmCelestialRevelation doesn't accept an action parameter,
            // so it always uses the default key path regardless of automation config
            await confirmCelestialRevelation(makePlayerStats(), 'Heavenly Wings', campaignName);

            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                playerName,
                defaultUsesKey,
                0,
                campaignName
            );
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
            expect(expirations.addExpiration).toHaveBeenCalledWith(
                'CustomSorcerer',
                'CustomSorcerer',
                expect.any(Array),
                campaignName,
            );
            expect(buffToggle.toggleBuff).toHaveBeenCalledWith(
                'CustomSorcerer',
                'Heavenly Wings',
                expect.any(Object),
                campaignName,
                'CustomSorcerer'
            );
        });
    });
});
