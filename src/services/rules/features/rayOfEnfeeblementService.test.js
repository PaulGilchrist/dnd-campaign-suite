// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { triggerRayOfEnfeeblement } from './rayOfEnfeeblementService.js';
import { executeHandler } from '../../automation/index.js';

vi.mock('../../automation/index.js', () => ({
    executeHandler: vi.fn(),
}));

describe('rayOfEnfeeblementService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    const campaignName = 'TestCampaign';
    const mapName = 'testMap';
    const playerStats = {
        name: 'Wizard',
        spellAbilities: { saveDc: 15, modifier: 4, spellCastingAbility: 'Intelligence', toHit: 9 },
        proficiency: 4,
    };

    describe('triggerRayOfEnfeeblement', () => {
        it('executes handler with correct automation type and targetName', async () => {
            executeHandler.mockResolvedValue(null);
            await triggerRayOfEnfeeblement({ name: 'Ray of Enfeeblement', level: 2 }, { targetName: 'Goblin' }, playerStats, campaignName, mapName);
            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    name: 'Ray of Enfeeblement',
                    automation: { type: 'ray_of_enfeeblement', targetName: 'Goblin' },
                }),
                playerStats, campaignName, mapName,
            );
        });

        it.each([null, {}])('falls back to "Unknown" when metaCtx is %s', async (metaCtx) => {
            executeHandler.mockResolvedValue(null);
            await triggerRayOfEnfeeblement({ name: 'Ray of Enfeeblement', level: 2 }, metaCtx, playerStats, campaignName, mapName);
            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({ automation: expect.objectContaining({ targetName: 'Unknown' }) }),
                playerStats, campaignName, mapName,
            );
        });

        it('re-throws when executeHandler rejects', async () => {
            executeHandler.mockRejectedValue(new Error('Handler failed'));
            await expect(triggerRayOfEnfeeblement({ name: 'Ray of Enfeeblement', level: 2 }, { targetName: 'Goblin' }, playerStats, campaignName, mapName)).rejects.toThrow('Handler failed');
        });
    });
});
