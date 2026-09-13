// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import useCharActionsBaseActions from './useCharActionsBaseActions.js';
import { createHooks, mockToggleBuff, mockAddExpiration, mockSetPopupHtml, mockAddEntry, campaignName, basePlayerStats } from './useCharActionsBaseActions.test-utils.js';

describe('useCharActionsBaseActions - handleDodgeAction', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('handleDodgeAction', () => {
        it('should return early without side effects when cannotAct is true', async () => {
            const hooks = createHooks({ cannotAct: true });
            const actions = useCharActionsBaseActions(hooks);
            await actions.handleDodgeAction();

            expect(mockToggleBuff).not.toHaveBeenCalled();
            expect(mockSetPopupHtml).not.toHaveBeenCalled();
        });

        it('should activate dodge when buff is not already active', async () => {
            mockToggleBuff.mockReturnValue({ wasActive: false });
            const hooks = createHooks();
            const actions = useCharActionsBaseActions(hooks);
            await actions.handleDodgeAction();

            expect(mockToggleBuff).toHaveBeenCalledWith(
                'TestFighter', 'Dodge',
                { effect: 'dodge', duration: 'until_start_of_next_turn' },
                campaignName, 'TestFighter'
            );
            expect(mockAddExpiration).toHaveBeenCalledWith({ attackerName: 'TestFighter', targetName: 'TestFighter', effects: [{ type: 'remove_active_buff', buffName: 'Dodge' }], campaignName, rounds: undefined, expireOnCreatureName: 'TestFighter' });
            expect(mockAddEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
                type: 'ability_use',
                characterName: 'TestFighter',
                abilityName: 'Dodge',
                description: expect.stringContaining('Dodge action'),
            }));
            expect(mockSetPopupHtml).toHaveBeenCalledWith({
                type: 'automation_info',
                name: 'Dodge',
                description: expect.stringContaining('Dodge activated'),
            });
        });

        it('should deactivate dodge when buff is already active', async () => {
            mockToggleBuff.mockReturnValue({ wasActive: true });
            const hooks = createHooks();
            const actions = useCharActionsBaseActions(hooks);
            await actions.handleDodgeAction();

            expect(mockToggleBuff).toHaveBeenCalled();
            expect(mockAddExpiration).not.toHaveBeenCalled();
            expect(mockAddEntry).not.toHaveBeenCalled();
            expect(mockSetPopupHtml).toHaveBeenCalledWith({
                type: 'automation_info',
                name: 'Dodge',
                description: 'Dodge deactivated.',
            });
        });

        it('should use the character name from playerStats for all side effects', async () => {
            mockToggleBuff.mockReturnValue({ wasActive: false });
            const playerStats = { ...basePlayerStats, name: 'RogueOne' };
            const hooks = createHooks({ playerStats });
            const actions = useCharActionsBaseActions(hooks);
            await actions.handleDodgeAction();

            expect(mockToggleBuff).toHaveBeenCalledWith(
                'RogueOne', 'Dodge',
                { effect: 'dodge', duration: 'until_start_of_next_turn' },
                campaignName, 'RogueOne'
            );
            expect(mockAddExpiration).toHaveBeenCalledWith({ attackerName: 'RogueOne', targetName: 'RogueOne', effects: [{ type: 'remove_active_buff', buffName: 'Dodge' }], campaignName, rounds: undefined, expireOnCreatureName: 'RogueOne' });
            expect(mockAddEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
                characterName: 'RogueOne',
            }));
        });

        it('should log ability_use with the full dodge description on activation', async () => {
            mockToggleBuff.mockReturnValue({ wasActive: false });
            const hooks = createHooks();
            const actions = useCharActionsBaseActions(hooks);
            await actions.handleDodgeAction();

            expect(mockAddEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
                description: 'TestFighter takes the Dodge action. Attackers have disadvantage on attacks against you until the start of your next turn. You have advantage on Dexterity saving throws.',
            }));
        });

        it('should show advantage on Dex saves and disadvantage on attacker popup on activation', async () => {
            mockToggleBuff.mockReturnValue({ wasActive: false });
            const hooks = createHooks();
            const actions = useCharActionsBaseActions(hooks);
            await actions.handleDodgeAction();

            expect(mockSetPopupHtml).toHaveBeenCalledWith({
                type: 'automation_info',
                name: 'Dodge',
                description: 'Dodge activated. Attackers have disadvantage on attacks against you until the start of your next turn. You have advantage on Dexterity saving throws.',
            });
        });
    });
});
