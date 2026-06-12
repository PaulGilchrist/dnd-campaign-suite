import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handle, handleSummon, handleCommand, handleRestore, handleBonusActionCommand, applyBonusActionCommand } from './primalCompanionHandler.js';
import * as runtimeState from '../../../hooks/useRuntimeState.js';

describe('primalCompanionHandler', () => {
    const mockPlayerStats = { name: 'TestRanger' };
    const mockCampaignName = 'test-campaign';

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('handle (summon)', () => {
        it('returns modal when no companion is summoned', async () => {
            vi.spyOn(runtimeState, 'getRuntimeValue').mockReturnValue(null);

            const action = {
                name: 'Primal Companion',
                automation: {
                    type: 'primal_companion_summon',
                    action: 'bonus_action',
                    casting_time: '1 bonus action',
                    companionTypes: []
                }
            };

            const result = await handle(action, mockPlayerStats, mockCampaignName);

            expect(result.type).toBe('modal');
            expect(result.modalName).toBe('primalCompanionSummon');
            expect(result.payload.action).toBe(action);
        });

        it('returns popup when companion is already summoned', async () => {
            vi.spyOn(runtimeState, 'getRuntimeValue').mockReturnValue('Beast of the Land');

            const action = {
                name: 'Primal Companion',
                automation: { type: 'primal_companion_summon' }
            };

            const result = await handle(action, mockPlayerStats, mockCampaignName);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Beast of the Land');
        });
    });

    describe('handleSummon', () => {
        it('sets runtime value and returns success popup', async () => {
            const setSpy = vi.spyOn(runtimeState, 'setRuntimeValue').mockResolvedValue(undefined);
            const action = {
                name: 'Primal Companion',
                automation: { type: 'primal_companion_summon' }
            };

            const result = await handleSummon(action, mockPlayerStats, mockCampaignName, 'Beast of the Sea');

            expect(setSpy).toHaveBeenCalledWith('TestRanger', 'primalCompanionType', 'Beast of the Sea', mockCampaignName);
            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Beast of the Sea');
        });

        it('returns error popup when no type selected', async () => {
            const action = { name: 'Primal Companion', automation: { type: 'primal_companion_summon' } };
            const result = await handleSummon(action, mockPlayerStats, mockCampaignName, null);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toBe('No companion type selected.');
        });
    });

    describe('handleCommand', () => {
        it('returns popup when companion exists', async () => {
            vi.spyOn(runtimeState, 'getRuntimeValue').mockReturnValue('Beast of the Sky');

            const action = {
                name: 'Primal Companion',
                automation: { type: 'primal_companion_command', commandType: 'beasts_strike' }
            };

            const result = await handleCommand(action, mockPlayerStats, mockCampaignName);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Beast of the Sky');
            expect(result.payload.description).toContain('Beast\'s Strike');
        });

        it('returns error when no companion', async () => {
            vi.spyOn(runtimeState, 'getRuntimeValue').mockReturnValue(null);

            const action = { name: 'Primal Companion', automation: { type: 'primal_companion_command' } };
            const result = await handleCommand(action, mockPlayerStats, mockCampaignName);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toBe('No primal companion summoned.');
        });
    });

    describe('handleRestore', () => {
        it('restores companion and returns success', async () => {
            const setSpy = vi.spyOn(runtimeState, 'setRuntimeValue').mockResolvedValue(undefined);
            vi.spyOn(runtimeState, 'getRuntimeValue').mockReturnValue('Beast of the Land');

            const action = {
                name: 'Primal Companion',
                automation: { type: 'primal_companion_restore', spellSlotCost: true }
            };

            const result = await handleRestore(action, mockPlayerStats, mockCampaignName);

            expect(setSpy).toHaveBeenCalledWith('TestRanger', 'primalCompanionAlive', true, mockCampaignName);
            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('restored with full HP');
        });

        it('returns error when no companion', async () => {
            vi.spyOn(runtimeState, 'getRuntimeValue').mockReturnValue(null);

            const action = { name: 'Primal Companion', automation: { type: 'primal_companion_restore' } };
            const result = await handleRestore(action, mockPlayerStats, mockCampaignName);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toBe('No primal companion to restore.');
        });
    });

    describe('handleBonusActionCommand', () => {
        it('returns modal when companion exists', async () => {
            vi.spyOn(runtimeState, 'getRuntimeValue').mockReturnValue('Beast of the Land');

            const action = {
                name: 'Exceptional Training',
                automation: { type: 'primal_companion_bonus_action_command', forceDamageOption: true }
            };

            const result = await handleBonusActionCommand(action, mockPlayerStats, mockCampaignName);

            expect(result.type).toBe('modal');
            expect(result.modalName).toBe('primalCompanionBonusActionCommand');
            expect(result.payload.companionType).toBe('Beast of the Land');
        });

        it('returns error popup when no companion', async () => {
            vi.spyOn(runtimeState, 'getRuntimeValue').mockReturnValue(null);

            const action = { name: 'Exceptional Training', automation: { type: 'primal_companion_bonus_action_command' } };
            const result = await handleBonusActionCommand(action, mockPlayerStats, mockCampaignName);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toBe('No primal companion to command.');
        });
    });

    describe('applyBonusActionCommand', () => {
        it('returns success popup with selected action when companion exists', async () => {
            vi.spyOn(runtimeState, 'getRuntimeValue').mockReturnValue('Beast of the Land');

            const action = {
                name: 'Exceptional Training',
                automation: { type: 'primal_companion_bonus_action_command', forceDamageOption: true }
            };

            const result = await applyBonusActionCommand(action, mockPlayerStats, mockCampaignName, 'Dash', false);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Beast of the Land');
            expect(result.payload.description).toContain('Dash');
            expect(result.payload.description).not.toContain('Force');
        });

        it('includes Force damage note when useForceDamage is true', async () => {
            vi.spyOn(runtimeState, 'getRuntimeValue').mockReturnValue('Beast of the Sea');

            const action = {
                name: 'Exceptional Training',
                automation: { type: 'primal_companion_bonus_action_command', forceDamageOption: true }
            };

            const result = await applyBonusActionCommand(action, mockPlayerStats, mockCampaignName, 'Dodge', true);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Force damage');
        });

        it('returns error when no companion', async () => {
            vi.spyOn(runtimeState, 'getRuntimeValue').mockReturnValue(null);

            const action = { name: 'Exceptional Training', automation: { type: 'primal_companion_bonus_action_command' } };
            const result = await applyBonusActionCommand(action, mockPlayerStats, mockCampaignName, 'Dash', false);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toBe('No primal companion to command.');
        });

        it('returns error when invalid action selected', async () => {
            vi.spyOn(runtimeState, 'getRuntimeValue').mockReturnValue('Beast of the Sky');

            const action = { name: 'Exceptional Training', automation: { type: 'primal_companion_bonus_action_command' } };
            const result = await applyBonusActionCommand(action, mockPlayerStats, mockCampaignName, 'InvalidAction', false);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toBe('No action selected.');
        });
    });
});
