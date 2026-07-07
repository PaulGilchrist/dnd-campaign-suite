// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { triggerInspiringSmite, getInspiringSmitePassives } from './inspiringSmiteService.js';
import { executeHandler } from '../../automation/index.js';

vi.mock('../../automation/index.js', () => ({
    executeHandler: vi.fn(),
}));

describe('inspiringSmiteService', () => {
    beforeEach(() => {
        vi.resetAllMocks();
    });

    describe('getInspiringSmitePassives', () => {
        it('returns only post_cast_inspiting_smite passives', () => {
            const stats = {
                automation: {
                    passives: [
                        { type: 'post_cast_inspiring_smite', name: 'Inspire 1' },
                        { type: 'other_type', name: 'Other' },
                        { type: 'post_cast_inspiring_smite', name: 'Inspire 2' },
                    ],
                },
            };
            const result = getInspiringSmitePassives(stats);
            expect(result).toHaveLength(2);
            expect(result[0].name).toBe('Inspire 1');
            expect(result[1].name).toBe('Inspire 2');
        });

        it('returns empty array when no matching passives exist', () => {
            const stats = { automation: { passives: [{ type: 'other_type', name: 'Other' }] } };
            expect(getInspiringSmitePassives(stats)).toEqual([]);
        });

        it('throws when automation.passives is null or undefined', () => {
            expect(() => getInspiringSmitePassives({})).toThrow('Expected array, got undefined');
            expect(() => getInspiringSmitePassives({ automation: { passives: null } })).toThrow('Expected array, got null');
        });
    });

    describe('triggerInspiringSmite', () => {
        const campaignName = 'TestCampaign';
        const mapName = 'testMap';

        const createStats = (overrides = {}) => ({
            automation: {
                passives: [{ type: 'post_cast_inspiring_smite', name: 'Inspire Smite', ...overrides }],
            },
            ...overrides,
        });

        it('returns null for non-divine smite spell', async () => {
            const result = await triggerInspiringSmite({ name: 'Fireball' }, {}, createStats(), campaignName, mapName);
            expect(result).toBeNull();
            expect(executeHandler).not.toHaveBeenCalled();
        });

        it('returns null when slot level is zero', async () => {
            const result = await triggerInspiringSmite({ name: 'Divine Smite', level: 0 }, { slotLevel: 0 }, createStats(), campaignName, mapName);
            expect(result).toBeNull();
            expect(executeHandler).not.toHaveBeenCalled();
        });

        it('returns null when no passives exist', async () => {
            const result = await triggerInspiringSmite({ name: 'Divine Smite' }, {}, { automation: { passives: [] } }, campaignName, mapName);
            expect(result).toBeNull();
            expect(executeHandler).not.toHaveBeenCalled();
        });

        it('calls executeHandler for each inspiring smite passive with correct action shape', async () => {
            executeHandler.mockResolvedValue({ success: true });
            const stats = { automation: { passives: [{ type: 'post_cast_inspiring_smite', name: 'Inspire Smite' }] } };

            const result = await triggerInspiringSmite({ name: 'Divine Smite' }, { slotLevel: 2 }, stats, campaignName, mapName);

            expect(executeHandler).toHaveBeenCalledTimes(1);
            const [action] = vi.mocked(executeHandler).mock.calls[0];
            expect(action).toEqual({
                name: 'Inspire Smite',
                automation: { type: 'post_cast_inspiring_smite', casting_time: 'passive' },
            });
            expect(result).toEqual([{ success: true }]);
        });

        it('filters out falsy results from executeHandler', async () => {
            executeHandler.mockResolvedValueOnce({ result: 1 });
            executeHandler.mockResolvedValueOnce(null);
            executeHandler.mockResolvedValueOnce({ result: 3 });

            const stats = {
                automation: {
                    passives: [
                        { type: 'post_cast_inspiring_smite', name: 'Inspire 1' },
                        { type: 'post_cast_inspiring_smite', name: 'Inspire 2' },
                        { type: 'post_cast_inspiring_smite', name: 'Inspire 3' },
                    ],
                },
            };

            const result = await triggerInspiringSmite({ name: 'Divine Smite' }, { slotLevel: 1 }, stats, campaignName, mapName);
            expect(result).toEqual([{ result: 1 }, { result: 3 }]);
        });

        it('uses custom casting_time from passive when provided', async () => {
            executeHandler.mockResolvedValue({ success: true });
            const stats = {
                automation: {
                    passives: [{ type: 'post_cast_inspiring_smite', name: 'Inspire', casting_time: '1 action' }],
                },
            };
            await triggerInspiringSmite({ name: 'Divine Smite' }, { slotLevel: 1 }, stats, campaignName, mapName);
            const [action] = vi.mocked(executeHandler).mock.calls[0];
            expect(action.automation.casting_time).toBe('1 action');
        });

        it('defaults casting_time to passive when spell has level but no slotLevel', async () => {
            executeHandler.mockResolvedValue({ success: true });
            const stats = { automation: { passives: [{ type: 'post_cast_inspiring_smite', name: 'Inspire' }] } };

            await triggerInspiringSmite({ name: 'Divine Smite', level: 1 }, {}, stats, campaignName, mapName);

            const [action] = vi.mocked(executeHandler).mock.calls[0];
            expect(action.automation.casting_time).toBe('passive');
        });

        it('returns null when all executeHandler results are falsy', async () => {
            executeHandler.mockResolvedValue(null);
            const stats = { automation: { passives: [{ type: 'post_cast_inspiring_smite', name: 'Inspire' }] } };

            const result = await triggerInspiringSmite({ name: 'Divine Smite' }, { slotLevel: 2 }, stats, campaignName, mapName);
            expect(result).toBeNull();
        });

        it('throws on first handler failure and stops processing remaining passives', async () => {
            executeHandler.mockRejectedValueOnce(new Error('handler failed'));
            const stats = {
                automation: {
                    passives: [
                        { type: 'post_cast_inspiring_smite', name: 'Inspire 1' },
                        { type: 'post_cast_inspiring_smite', name: 'Inspire 2' },
                    ],
                },
            };
            await expect(
                triggerInspiringSmite({ name: 'Divine Smite' }, { slotLevel: 1 }, stats, campaignName, mapName)
            ).rejects.toThrow('handler failed');
            expect(executeHandler).toHaveBeenCalledTimes(1);
        });
    });
});
