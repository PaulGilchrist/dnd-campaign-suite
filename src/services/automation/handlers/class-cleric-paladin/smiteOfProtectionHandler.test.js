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
        it('returns info popup without side effects when smite cover is already active', async () => {
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'smiteOfProtectionActive') return true;
                return null;
            });

            const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Smite of Protection');
            expect(setRuntimeValue).not.toHaveBeenCalled();
            expect(addExpiration).not.toHaveBeenCalled();
            expect(addEntry).not.toHaveBeenCalled();
        });
    });

    describe('activation', () => {
        it('activates smite cover, sets expiration, logs the ability, and returns success popup', async () => {
            const now = Date.now();
            vi.spyOn(Date, 'now').mockReturnValue(now);

            const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

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
                undefined,
                playerName,
            );
            expect(addEntry).toHaveBeenCalledWith(campaignName, {
                type: 'ability_use',
                characterName: playerName,
                abilityName: 'Smite of Protection',
                description: `${playerName} activated Smite of Protection. You and allies in Aura of Protection have Half Cover until start of your next turn.`,
                timestamp: now,
            });
            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Smite of Protection');
            expect(result.payload.automationType).toBe('post_cast_smite_cover');
            expect(result.payload.description).toBe(
                'Smite of Protection activated! You and allies within your Aura of Protection have Half Cover until the start of your next turn.',
            );
            expect(result.payload.automation).toEqual(makeAction().automation);
        });

        it('treats falsy runtime values as inactive and proceeds with activation', async () => {
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
    });
});
