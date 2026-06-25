// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { handle } from './smiteOfProtectionHandler.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addExpiration } from '../../../rules/effects/expirations.js';
import { addEntry } from '../../../ui/logService.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../../rules/effects/expirations.js', () => ({
    addExpiration: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

const campaignName = 'test-campaign';
const playerName = 'Paladin';

function makePlayerStats(overrides = {}) {
    return { name: playerName, ...overrides };
}

function makeAction(overrides = {}) {
    return {
        name: 'Smite of Protection',
        automation: { type: 'post_cast_smite_cover', casting_time: 'passive', ...overrides.automation },
        ...overrides,
    };
}

describe('smiteOfProtectionHandler.handle', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getRuntimeValue.mockReturnValue(null);
    });

    describe('deactivation (already active)', () => {
        it('returns info popup when smite cover is already active', async () => {
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'smiteOfProtectionActive') return true;
                return null;
            });

            const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toBe('Smite of Protection is already active.');
            expect(result.payload.name).toBe('Smite of Protection');
        });

        it('does not activate or set expiration when already active', async () => {
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'smiteOfProtectionActive') return true;
                return null;
            });

            await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(setRuntimeValue).not.toHaveBeenCalled();
            expect(addExpiration).not.toHaveBeenCalled();
        });

        it('does not log ability use when already active', async () => {
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'smiteOfProtectionActive') return true;
                return null;
            });

            await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(addEntry).not.toHaveBeenCalled();
        });
    });

    describe('activation', () => {
        it('sets smiteOfProtectionActive to true', async () => {
            const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(result.type).toBe('popup');
            expect(setRuntimeValue).toHaveBeenCalledWith(
                playerName,
                'smiteOfProtectionActive',
                true,
                campaignName,
            );
        });

        it('sets an expiration to remove smite of protection on next turn', async () => {
            await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(addExpiration).toHaveBeenCalledWith(
                playerName,
                playerName,
                [{ type: 'remove_smite_of_protection' }],
                campaignName,
                1,
            );
        });

        it('logs the ability use', async () => {
            const now = Date.now();
            vi.spyOn(Date, 'now').mockReturnValue(now);

            await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(addEntry).toHaveBeenCalledWith(campaignName, {
                type: 'ability_use',
                characterName: playerName,
                abilityName: 'Smite of Protection',
                description: `${playerName} activated Smite of Protection. You and allies in Aura of Protection have Half Cover until start of your next turn.`,
                timestamp: now,
            });
        });

        it('returns success popup with activation description', async () => {
            const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Smite of Protection');
            expect(result.payload.description).toBe(
                'Smite of Protection activated! You and allies within your Aura of Protection have Half Cover until the start of your next turn.',
            );
            expect(result.payload.automationType).toBe('post_cast_smite_cover');
            expect(result.payload.automation).toEqual(makeAction().automation);
        });

        it('ignores the mapName parameter', async () => {
            await handle(makeAction(), makePlayerStats(), campaignName, 'test-map');

            expect(setRuntimeValue).toHaveBeenCalledWith(
                playerName,
                'smiteOfProtectionActive',
                true,
                campaignName,
            );
            expect(addExpiration).toHaveBeenCalledWith(
                playerName,
                playerName,
                [{ type: 'remove_smite_of_protection' }],
                campaignName,
                1,
            );
        });
    });

    describe('runtime state guard', () => {
        it('treats falsy runtime values as not active', async () => {
            getRuntimeValue.mockReturnValue(false);

            const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(setRuntimeValue).toHaveBeenCalledWith(
                playerName,
                'smiteOfProtectionActive',
                true,
                campaignName,
            );
        });

        it('treats empty string as not active', async () => {
            getRuntimeValue.mockReturnValue('');

            const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(result.type).toBe('popup');
            expect(setRuntimeValue).toHaveBeenCalledWith(
                playerName,
                'smiteOfProtectionActive',
                true,
                campaignName,
            );
        });

        it('treats zero as not active', async () => {
            getRuntimeValue.mockReturnValue(0);

            const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(result.type).toBe('popup');
            expect(setRuntimeValue).toHaveBeenCalledWith(
                playerName,
                'smiteOfProtectionActive',
                true,
                campaignName,
            );
        });
    });
});
