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

describe('smiteOfProtectionHandler.handle', () => {
    const campaignName = 'test-campaign';
    const playerName = 'Paladin';
    const playerStats = { name: playerName };
    const action = {
        name: 'Smite of Protection',
        automation: { type: 'post_cast_smite_cover', casting_time: 'passive' },
    };

    beforeEach(() => {
        vi.clearAllMocks();
        getRuntimeValue.mockReturnValue(undefined);
    });

    it('activates smite of protection when not already active', async () => {
        const result = await handle(action, playerStats, campaignName, null);

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

        expect(addEntry).toHaveBeenCalledWith(campaignName, {
            type: 'ability_use',
            characterName: playerName,
            abilityName: 'Smite of Protection',
            description: expect.stringContaining('Smite of Protection'),
            timestamp: expect.any(Number),
        });

        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.description).toContain('Half Cover');
    });

    it('returns already active message when smite cover is already active', async () => {
        getRuntimeValue.mockReturnValue(true);

        const result = await handle(action, playerStats, campaignName, null);

        expect(setRuntimeValue).not.toHaveBeenCalled();
        expect(addExpiration).not.toHaveBeenCalled();

        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.description).toContain('already active');
    });
});
