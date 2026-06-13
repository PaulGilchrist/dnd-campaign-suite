import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handle, applyThirdEye } from './thirdEyeHandler.js';
import * as runtimeState from '../../../hooks/useRuntimeState.js';

describe('thirdEyeHandler', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    describe('handle', () => {
        it('should return popup when Third Eye is already active', async () => {
            vi.spyOn(runtimeState, 'getRuntimeValue').mockReturnValue([
                { name: 'The Third Eye', effect: 'darkvision_120' }
            ]);

            const action = {
                name: 'The Third Eye',
                automation: { type: 'third_eye', casting_time: '1 bonus action' }
            };
            const playerStats = { name: 'Test Character' };

            const result = await handle(action, playerStats, 'TestCampaign');

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('currently active');
        });

        it('should return modal when Third Eye is not active', async () => {
            vi.spyOn(runtimeState, 'getRuntimeValue').mockReturnValue([]);

            const action = {
                name: 'The Third Eye',
                automation: { type: 'third_eye', casting_time: '1 bonus action' }
            };
            const playerStats = { name: 'Test Character' };

            const result = await handle(action, playerStats, 'TestCampaign');

            expect(result.type).toBe('modal');
            expect(result.modalName).toBe('thirdEye');
        });
    });

    describe('applyThirdEye', () => {
        it('should apply Darkvision option', async () => {
            const setRuntimeValue = vi.spyOn(runtimeState, 'setRuntimeValue').mockResolvedValue(undefined);
            vi.spyOn(runtimeState, 'getRuntimeValue').mockReturnValue([]);

            const action = {
                name: 'The Third Eye',
                automation: { type: 'third_eye', duration: 'short_or_long_rest' }
            };
            const playerStats = { name: 'Test Character' };

            const result = await applyThirdEye(action, playerStats, 'TestCampaign', 'Darkvision (120 feet)');

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('Darkvision');
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'Test Character',
                'activeBuffs',
                expect.arrayContaining([
                    expect.objectContaining({
                        name: 'The Third Eye',
                        effect: 'darkvision_120',
                        darkvisionRange: '120 ft.',
                    })
                ]),
                'TestCampaign'
            );
        });

        it('should apply Greater Comprehension option', async () => {
            vi.spyOn(runtimeState, 'setRuntimeValue').mockResolvedValue(undefined);
            vi.spyOn(runtimeState, 'getRuntimeValue').mockReturnValue([]);

            const action = {
                name: 'The Third Eye',
                automation: { type: 'third_eye', duration: 'short_or_long_rest' }
            };
            const playerStats = { name: 'Test Character' };

            const result = await applyThirdEye(action, playerStats, 'TestCampaign', 'Greater Comprehension');

            expect(result.payload.description).toContain('read any language');
        });

        it('should apply See Invisibility option', async () => {
            vi.spyOn(runtimeState, 'setRuntimeValue').mockResolvedValue(undefined);
            vi.spyOn(runtimeState, 'getRuntimeValue').mockReturnValue([]);

            const action = {
                name: 'The Third Eye',
                automation: { type: 'third_eye', duration: 'short_or_long_rest' }
            };
            const playerStats = { name: 'Test Character' };

            const result = await applyThirdEye(action, playerStats, 'TestCampaign', 'See Invisibility');

            expect(result.payload.description).toContain('invisible');
        });

        it('should return error for unknown option', async () => {
            const action = {
                name: 'The Third Eye',
                automation: { type: 'third_eye' }
            };
            const playerStats = { name: 'Test Character' };

            const result = await applyThirdEye(action, playerStats, 'TestCampaign', 'Unknown Option');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Unknown option');
        });
    });
});
