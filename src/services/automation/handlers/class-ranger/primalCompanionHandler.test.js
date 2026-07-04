// @cleaned-by-ai
import { handle, handleSummon, handleCommand, handleRestore, handleBonusActionCommand, applyBonusActionCommand } from './primalCompanionHandler.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';

describe('primalCompanionHandler', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    const mockPlayerStats = { name: 'TestRanger' };
    const mockCampaignName = 'test-campaign';

    function makeAction(overrides = {}) {
        return {
            name: 'Primal Companion',
            automation: {
                type: 'primal_companion_summon',
                ...overrides.automation,
            },
            ...overrides,
        };
    }

    describe('handle (summon)', () => {
        it('returns modal when no companion is summoned', async () => {
            getRuntimeValue.mockReturnValue(null);

            const action = makeAction({
                automation: {
                    type: 'primal_companion_summon',
                    action: 'bonus_action',
                    casting_time: '1 bonus action',
                    companionTypes: [],
                },
            });

            const result = await handle(action, mockPlayerStats, mockCampaignName);

            expect(result.type).toBe('modal');
            expect(result.modalName).toBe('primalCompanionSummon');
            expect(result.payload.action).toBe(action);
            expect(result.payload.playerStats).toBe(mockPlayerStats);
            expect(result.payload.campaignName).toBe(mockCampaignName);
        });

        it('returns popup with companion info when companion is already summoned', async () => {
            getRuntimeValue.mockReturnValue('Beast of the Land');

            const action = makeAction();

            const result = await handle(action, mockPlayerStats, mockCampaignName);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Primal Companion');
            expect(result.payload.automationType).toBe('primal_companion_summon');
            expect(result.payload.description).toContain('Beast of the Land');
            expect(result.payload.automation).toBe(action.automation);
        });
    });

    describe('handleSummon', () => {
        it('sets runtime value and returns success popup', async () => {
            const action = makeAction();

            const result = await handleSummon(action, mockPlayerStats, mockCampaignName, 'Beast of the Sea');

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestRanger',
                'primalCompanionType',
                'Beast of the Sea',
                mockCampaignName
            );
            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Primal Companion');
            expect(result.payload.automationType).toBe('primal_companion_summon');
            expect(result.payload.description).toContain('Beast of the Sea');
            expect(result.payload.description).toContain('summoned and active');
            expect(result.payload.automation).toBe(action.automation);
        });

        it('returns error popup when no type selected', async () => {
            const action = makeAction();

            const result = await handleSummon(action, mockPlayerStats, mockCampaignName, null);

            expect(setRuntimeValue).not.toHaveBeenCalled();
            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Primal Companion');
            expect(result.payload.description).toBe('No companion type selected.');
            expect(result.payload.automation).toBe(action.automation);
        });
    });

    describe('handleCommand', () => {
        it('returns popup with companion and command info when companion exists', async () => {
            getRuntimeValue.mockReturnValue('Beast of the Sky');

            const action = makeAction({
                automation: { type: 'primal_companion_command', commandType: 'beasts_strike' },
            });

            const result = await handleCommand(action, mockPlayerStats, mockCampaignName);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Primal Companion');
            expect(result.payload.automationType).toBe('primal_companion_command');
            expect(result.payload.description).toContain('Beast of the Sky');
            expect(result.payload.description).toContain("Beast's Strike");
            expect(result.payload.automation).toBe(action.automation);
        });

        it('includes Bestial Fury note when player has the feature', async () => {
            getRuntimeValue.mockReturnValue('Beast of the Land');

            const action = makeAction({ automation: { type: 'primal_companion_command' } });

            const playerStatsWithFeature = {
                name: 'TestRanger',
                class: {
                    class_levels: [
                        { features: [{ name: 'Extra Attack' }, { name: 'Bestial Fury' }] },
                    ],
                },
            };

            const result = await handleCommand(action, playerStatsWithFeature, mockCampaignName);

            expect(result.payload.description).toContain("Bestial Fury: beast attacks twice!");
        });

        it('includes Bestial Fury note from subclass levels', async () => {
            getRuntimeValue.mockReturnValue('Beast of the Sea');

            const action = makeAction({ automation: { type: 'primal_companion_command' } });

            const playerStatsWithSubclassFeature = {
                name: 'TestRanger',
                class: {
                    class_levels: [{ features: [{ name: 'Extra Attack' }] }],
                    subclass: {
                        class_levels: [{ features: [{ name: 'Bestial Fury' }] }],
                    },
                },
            };

            const result = await handleCommand(action, playerStatsWithSubclassFeature, mockCampaignName);

            expect(result.payload.description).toContain("Bestial Fury: beast attacks twice!");
        });

        it('omits Bestial Fury note when player lacks the feature', async () => {
            getRuntimeValue.mockReturnValue('Beast of the Land');

            const action = makeAction({ automation: { type: 'primal_companion_command' } });

            const playerStatsNoFeature = {
                name: 'TestRanger',
                class: {
                    class_levels: [{ features: [{ name: 'Extra Attack' }] }],
                },
            };

            const result = await handleCommand(action, playerStatsNoFeature, mockCampaignName);

            expect(result.payload.description).not.toContain('Bestial Fury');
            expect(result.payload.description).toContain("Beast's Strike");
        });

        it('handles missing class info gracefully', async () => {
            getRuntimeValue.mockReturnValue('Beast of the Land');

            const action = makeAction({ automation: { type: 'primal_companion_command' } });

            const playerStatsNoClass = { name: 'TestRanger' };

            const result = await handleCommand(action, playerStatsNoClass, mockCampaignName);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain("Beast's Strike");
            expect(result.payload.description).not.toContain('Bestial Fury');
        });

        it('returns error when no companion is summoned', async () => {
            getRuntimeValue.mockReturnValue(null);

            const action = makeAction({ automation: { type: 'primal_companion_command' } });

            const result = await handleCommand(action, mockPlayerStats, mockCampaignName);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Primal Companion');
            expect(result.payload.description).toBe('No primal companion summoned.');
            expect(result.payload.automation).toBe(action.automation);
        });
    });

    describe('handleRestore', () => {
        it('restores companion and returns success popup', async () => {
            getRuntimeValue.mockReturnValue('Beast of the Land');

            const action = makeAction({
                automation: { type: 'primal_companion_restore', spellSlotCost: true },
            });

            const result = await handleRestore(action, mockPlayerStats, mockCampaignName);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestRanger',
                'primalCompanionAlive',
                true,
                mockCampaignName
            );
            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Primal Companion');
            expect(result.payload.automationType).toBe('primal_companion_restore');
            expect(result.payload.description).toContain('Beast of the Land');
            expect(result.payload.description).toContain('restored with full HP');
            expect(result.payload.automation).toBe(action.automation);
        });

        it('returns error when no companion to restore', async () => {
            getRuntimeValue.mockReturnValue(null);

            const action = makeAction({ automation: { type: 'primal_companion_restore' } });

            const result = await handleRestore(action, mockPlayerStats, mockCampaignName);

            expect(setRuntimeValue).not.toHaveBeenCalled();
            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Primal Companion');
            expect(result.payload.description).toBe('No primal companion to restore.');
            expect(result.payload.automation).toBe(action.automation);
        });
    });

    describe('handleBonusActionCommand', () => {
        it('returns modal with companion info when companion exists', async () => {
            getRuntimeValue.mockReturnValue('Beast of the Land');

            const action = makeAction({
                name: 'Exceptional Training',
                automation: { type: 'primal_companion_bonus_action_command', forceDamageOption: true },
            });

            const result = await handleBonusActionCommand(action, mockPlayerStats, mockCampaignName);

            expect(result.type).toBe('modal');
            expect(result.modalName).toBe('primalCompanionBonusActionCommand');
            expect(result.payload.action).toBe(action);
            expect(result.payload.playerStats).toBe(mockPlayerStats);
            expect(result.payload.campaignName).toBe(mockCampaignName);
            expect(result.payload.companionType).toBe('Beast of the Land');
        });

        it('returns error popup when no companion is summoned', async () => {
            getRuntimeValue.mockReturnValue(null);

            const action = makeAction({
                name: 'Exceptional Training',
                automation: { type: 'primal_companion_bonus_action_command' },
            });

            const result = await handleBonusActionCommand(action, mockPlayerStats, mockCampaignName);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Exceptional Training');
            expect(result.payload.description).toBe('No primal companion to command.');
            expect(result.payload.automation).toBe(action.automation);
        });
    });

    describe('applyBonusActionCommand', () => {
        it('returns success popup with selected action when companion exists', async () => {
            getRuntimeValue.mockReturnValue('Beast of the Land');

            const action = makeAction({
                name: 'Exceptional Training',
                automation: { type: 'primal_companion_bonus_action_command', forceDamageOption: true },
            });

            const result = await applyBonusActionCommand(action, mockPlayerStats, mockCampaignName, 'Dash', false);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Exceptional Training');
            expect(result.payload.automationType).toBe('primal_companion_bonus_action_command');
            expect(result.payload.description).toContain('Beast of the Land');
            expect(result.payload.description).toContain('Dash');
            expect(result.payload.description).not.toContain('Force');
            expect(result.payload.automation).toBe(action.automation);
        });

        it('includes Force damage note when useForceDamage is true and option is available', async () => {
            getRuntimeValue.mockReturnValue('Beast of the Sea');

            const action = makeAction({
                name: 'Exceptional Training',
                automation: { type: 'primal_companion_bonus_action_command', forceDamageOption: true },
            });

            const result = await applyBonusActionCommand(action, mockPlayerStats, mockCampaignName, 'Dodge', true);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Force damage');
            expect(result.payload.description).toContain('instead of its normal damage type');
        });

        it('omits Force damage note when useForceDamage is true but option is not available', async () => {
            getRuntimeValue.mockReturnValue('Beast of the Sky');

            const action = makeAction({
                name: 'Exceptional Training',
                automation: { type: 'primal_companion_bonus_action_command', forceDamageOption: false },
            });

            const result = await applyBonusActionCommand(action, mockPlayerStats, mockCampaignName, 'Help', true);

            expect(result.type).toBe('popup');
            expect(result.payload.description).not.toContain('Force damage');
        });

        it('returns error when no companion is summoned', async () => {
            getRuntimeValue.mockReturnValue(null);

            const action = makeAction({
                name: 'Exceptional Training',
                automation: { type: 'primal_companion_bonus_action_command' },
            });

            const result = await applyBonusActionCommand(action, mockPlayerStats, mockCampaignName, 'Dash', false);

            expect(setRuntimeValue).not.toHaveBeenCalled();
            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Exceptional Training');
            expect(result.payload.description).toBe('No primal companion to command.');
            expect(result.payload.automation).toBe(action.automation);
        });

        it('returns error when invalid action selected', async () => {
            getRuntimeValue.mockReturnValue('Beast of the Sky');

            const action = makeAction({
                name: 'Exceptional Training',
                automation: { type: 'primal_companion_bonus_action_command' },
            });

            const result = await applyBonusActionCommand(action, mockPlayerStats, mockCampaignName, 'InvalidAction', false);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Exceptional Training');
            expect(result.payload.description).toBe('No action selected.');
            expect(result.payload.automation).toBe(action.automation);
        });

    });
});
