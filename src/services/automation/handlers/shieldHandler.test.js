import { handle } from './shieldHandler.js';
import * as buffToggle from '../common/buffToggle.js';
import * as expirations from '../../rules/effects/expirations.js';

vi.mock('../common/buffToggle.js', () => ({
    toggleBuff: vi.fn(),
}));

vi.mock('../../rules/effects/expirations.js', () => ({
    addExpiration: vi.fn(),
}));

describe('shieldHandler', () => {
    const mockPlayerStats = { name: 'TestCharacter' };
    const mockCampaignName = 'test-campaign';

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should toggle buff and return popup when activating', async () => {
        buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

        const action = {
            name: 'Shield',
            automation: { type: 'shield' },
        };

        const result = await handle(action, mockPlayerStats, mockCampaignName, null);

        expect(buffToggle.toggleBuff).toHaveBeenCalledWith(
            'TestCharacter',
            'Shield',
            expect.objectContaining({ effect: 'shield' }),
            mockCampaignName
        );

        expect(expirations.addExpiration).toHaveBeenCalledWith(
            'TestCharacter',
            'TestCharacter',
            [{ type: 'remove_active_buff', buffName: 'Shield' }],
            mockCampaignName
        );

        expect(result).toEqual({
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: 'Shield',
                automationType: 'shield',
                description: 'Shield activated — +5 AC until start of your next turn, immune to Magic Missile',
                automation: { type: 'shield' },
            },
        });
    });

    it('should toggle buff and skip expiration when deactivating', async () => {
        buffToggle.toggleBuff.mockReturnValue({ wasActive: true });

        const action = {
            name: 'Shield',
            automation: { type: 'shield' },
        };

        const result = await handle(action, mockPlayerStats, mockCampaignName, null);

        expect(buffToggle.toggleBuff).toHaveBeenCalledWith(
            'TestCharacter',
            'Shield',
            expect.objectContaining({ effect: 'shield' }),
            mockCampaignName
        );

        expect(expirations.addExpiration).not.toHaveBeenCalled();

        expect(result.payload.description).toContain('Shield expired');
    });
});
